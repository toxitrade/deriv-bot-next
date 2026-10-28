#!/usr/bin/env python3
"""
1HZ50V HMA + Mladen Flow Trading Bot — Raspberry Pi ready
==========================================================

Bot autocontenido para Deriv (demo/paper por defecto).
Estrategia: cruce de flujo (Mladen) filtrado por tendencia (Hull MA).
Parámetros optimizados por sweep sobre 1HZ50V (1-min binary).

Archivos necesarios en la Pi:
  - bot_1hz50v_pi.py          (este archivo)
  - .env                      (opcional: DERIV_TOKEN=...)
  - requirements_pi.txt       (pip install -r)

Ejecutar:
  python3 bot_1hz50v_pi.py            # PAPER (solo señales, sin token)
  DERIV_TOKEN=xxx python3 bot_1hz50v_pi.py  # DEMO (coloca contratos)

Variables de entorno:
  DERIV_TOKEN        Token de API de Deriv (demo). Sin él va en PAPER.
  DERIV_SYMBOL       Símbolo (default: 1HZ50V)
  DERIV_STAKE        Stake por contrato (default: 10.0)
  DERIV_DURATION     Duración en minutos (default: 1)
  DERIV_HMA_PERIOD   HMA period (default: 20)
  DERIV_FLOW_PERIOD  Flow period (default: 14)
  DERIV_FLOW_THRESHOLD Umbral de cruce (default: 0.0)
  DERIV_LOG_LEVEL    INFO | DEBUG | WARNING (default: INFO)
  DERIV_LOG_FILE     Archivo de log (default: bot_1hz50v.log)
  DERIV_DEMO         true|false (default: true)

IMPORTANT: mladen_flow() es un placeholder. Reemplaza por la fórmula
real de TradingView antes de operar con dinero.
"""

from __future__ import annotations

import asyncio
import csv
import json
import logging
import math
import os
import signal
import sys
import time
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime
from typing import Deque, List, Optional

try:
    import websockets
except ImportError:
    print("ERROR: falta la librería 'websockets'. Instala con: pip install -r requirements_pi.txt")
    sys.exit(1)


# ============================================================================
# CONFIGURACIÓN
# ============================================================================
def env_str(name: str, default: str) -> str:
    return os.environ.get(name, default)


def env_float(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


def env_int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


def env_bool(name: str, default: bool) -> bool:
    v = os.environ.get(name, "")
    if not v:
        return default
    return v.lower() in ("1", "true", "yes", "on")


CONFIG = {
    "symbol": env_str("DERIV_SYMBOL", "1HZ50V"),
    "stake": env_float("DERIV_STAKE", 10.0),
    "duration": env_int("DERIV_DURATION", 1),
    "duration_unit": env_str("DERIV_DURATION_UNIT", "m"),
    "demo": env_bool("DERIV_DEMO", True),
    "hma_period": env_int("DERIV_HMA_PERIOD", 20),
    "flow_period": env_int("DERIV_FLOW_PERIOD", 14),
    "flow_smooth": env_int("DERIV_FLOW_SMOOTH", 3),
    "flow_threshold": env_float("DERIV_FLOW_THRESHOLD", 0.0),
    "stop_after_losses": env_int("DERIV_STOP_AFTER_LOSSES", 5),
    "max_daily_loss": env_float("DERIV_MAX_DAILY_LOSS", 50.0),
    "log_level": env_str("DERIV_LOG_LEVEL", "INFO"),
    "log_file": env_str("DERIV_LOG_FILE", "bot_1hz50v.log"),
    "token": env_str("DERIV_TOKEN", ""),
}

PUBLIC_WS = "wss://api.derivws.com/trading/v1/options/ws/public"
TRADING_WS = "wss://api.derivws.com/trading/v1/options/ws/public"
TICK_BUFFER = 500
RECONNECT_BASE_DELAY = 5  # segundos
WARMUP_TICKS = 40


# ============================================================================
# LOGGING
# ============================================================================
def setup_logging() -> logging.Logger:
    logger = logging.getLogger("1hz50v_bot")
    logger.setLevel(getattr(logging, CONFIG["log_level"].upper(), logging.INFO))
    logger.handlers.clear()

    fmt = logging.Formatter(
        "%(asctime)s | %(levelname)-8s | %(message)s", datefmt="%Y-%m-%d %H:%M:%S"
    )

    sh = logging.StreamHandler(sys.stdout)
    sh.setFormatter(fmt)
    logger.addHandler(sh)

    try:
        fh = logging.FileHandler(CONFIG["log_file"], encoding="utf-8")
        fh.setFormatter(fmt)
        logger.addHandler(fh)
    except Exception as e:
        logger.warning(f"No se pudo abrir archivo de log {CONFIG['log_file']}: {e}")

    return logger


log = setup_logging()


# ============================================================================
# INDICADORES (estrategia HMA + Mladen Flow)
# ============================================================================
def _wma(values: List[float], period: int) -> List[Optional[float]]:
    out: List[Optional[float]] = [None] * len(values)
    if period <= 0:
        return out
    wsum = sum(range(1, period + 1))
    for i in range(period - 1, len(values)):
        window = values[i - period + 1 : i + 1]
        out[i] = sum((j + 1) * v for j, v in enumerate(window)) / wsum
    return out


def hma(values: List[float], period: int) -> List[Optional[float]]:
    """Hull Moving Average: HMA = WMA(2*WMA(n/2) - WMA(n), round(sqrt(n)))"""
    n = max(1, period)
    half = max(1, n // 2)
    sqrt_n = max(1, round(math.sqrt(n)))

    wma_half = _wma(values, half)
    wma_full = _wma(values, n)

    raw: List[Optional[float]] = [None] * len(values)
    for i in range(len(values)):
        if wma_half[i] is not None and wma_full[i] is not None:
            raw[i] = 2.0 * wma_half[i] - wma_full[i]

    raw_floats = [r if r is not None else float("nan") for r in raw]
    return _wma(raw_floats, sqrt_n)  # type: ignore[return-value]


def hma_direction(hma_series: List[Optional[float]]) -> List[Optional[int]]:
    out: List[Optional[int]] = [None] * len(hma_series)
    for i in range(1, len(hma_series)):
        cur, prev = hma_series[i], hma_series[i - 1]
        if cur is None or prev is None:
            continue
        if cur > prev:
            out[i] = 1
        elif cur < prev:
            out[i] = -1
        else:
            out[i] = 0
    return out


def mladen_flow(prices: List[float], period: int = 14, smooth: int = 3) -> List[Optional[float]]:
    """
    Mladen-style flow oscillator (PLACEHOLDER).
    Rango [-1, 1]: normalizado min-max, centrado, suavizado con WMA.
    Reemplazar por la fórmula original de TradingView (script A8AoLSrN).
    """
    n = max(1, period)
    s = max(1, smooth)
    raw: List[Optional[float]] = [None] * len(prices)
    for i in range(n - 1, len(prices)):
        window = prices[i - n + 1 : i + 1]
        lo = min(window)
        hi = max(window)
        if hi == lo:
            raw[i] = 0.5
        else:
            raw[i] = (prices[i] - lo) / (hi - lo)

    centred = [(v - 0.5) * 2.0 if v is not None else float("nan") for v in raw]
    return _wma(centred, s)  # type: ignore[return-value]


# ============================================================================
# MODELOS DE DATOS
# ============================================================================
@dataclass
class TradeRecord:
    entry_time: str
    exit_time: Optional[str]
    side: str  # CALL / PUT
    entry_price: float
    exit_price: Optional[float]
    stake: float
    pnl: Optional[float]
    win: Optional[bool]
    contract_id: Optional[int]


@dataclass
class BotState:
    running: bool = True
    position: Optional[str] = None  # "long" / "short" / None
    open_contract_id: Optional[int] = None
    open_entry_price: float = 0.0
    open_side: Optional[str] = None
    consec_losses: int = 0
    daily_pnl: float = 0.0
    trades_today: int = 0
    trades: List[TradeRecord] = field(default_factory=list)
    ticks_received: int = 0
    last_tick_time: Optional[str] = None


state = BotState()


# ============================================================================
# PERSISTENCIA (CSV de trades)
# ============================================================================
TRADES_CSV = "trades_1hz50v.csv"


def save_trade_to_csv(trade: TradeRecord) -> None:
    file_exists = os.path.exists(TRADES_CSV)
    with open(TRADES_CSV, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow([
                "entry_time", "exit_time", "side", "entry_price",
                "exit_price", "stake", "pnl", "win", "contract_id",
            ])
        writer.writerow([
            trade.entry_time,
            trade.exit_time or "",
            trade.side,
            f"{trade.entry_price:.4f}",
            f"{trade.exit_price:.4f}" if trade.exit_price is not None else "",
            trade.stake,
            f"{trade.pnl:.2f}" if trade.pnl is not None else "",
            trade.win if trade.win is not None else "",
            trade.contract_id if trade.contract_id is not None else "",
        ])


def now_str() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


# ============================================================================
# BOT
# ============================================================================
class HMAFlowBot:
    def __init__(self, cfg: dict):
        self.cfg = cfg
        self.token = cfg["token"]
        self.symbol = cfg["symbol"]
        self.stake = float(cfg["stake"])
        self.demo = bool(cfg["demo"])
        self.duration = int(cfg["duration"])
        self.duration_unit = cfg["duration_unit"]
        self.hma_period = int(cfg["hma_period"])
        self.flow_period = int(cfg["flow_period"])
        self.flow_smooth = int(cfg["flow_smooth"])
        self.flow_threshold = float(cfg["flow_threshold"])
        self.stop_after_losses = int(cfg["stop_after_losses"])
        self.max_daily_loss = float(cfg["max_daily_loss"])

        self.prices: Deque[float] = deque(maxlen=TICK_BUFFER)
        self.public_ws = None
        self.trading_ws = None

    # ------------------------------------------------------------------
    # Logging helper
    # ------------------------------------------------------------------
    def _log(self, level: str, msg: str) -> None:
        getattr(log, level.lower(), log.info)(msg)

    # ------------------------------------------------------------------
    # WebSocket helpers
    # ------------------------------------------------------------------
    async def _send(self, ws, msg: dict) -> dict:
        await ws.send(json.dumps(msg))
        raw = await ws.recv()
        return json.loads(raw)

    async def connect_public(self) -> None:
        self._log("info", f"Conectando a WebSocket público ({PUBLIC_WS})...")
        self.public_ws = await websockets.connect(PUBLIC_WS)
        self._log("info", "WebSocket público conectado")

    async def subscribe_ticks(self) -> None:
        req = {"ticks": self.symbol, "subscribe": 1}
        await self._send(self.public_ws, req)
        self._log("info", f"Suscrito a ticks de {self.symbol}")

    async def connect_trading(self) -> None:
        if not self.token:
            self._log("warning", "Sin DERIV_TOKEN — modo PAPER (sin operaciones reales)")
            return
        self._log("info", "Conectando a WebSocket de trading...")
        self.trading_ws = await websockets.connect(TRADING_WS)
        auth = await self._send(self.trading_ws, {"authorize": self.token})
        if "error" in auth:
            self._log("error", f"Authorize falló: {auth['error']}")
            self.trading_ws = None
            return
        acct = auth.get("authorize", {})
        self._log("info",
                  f"Autorizado: {acct.get('nickname','?')} "
                  f"(demo={acct.get('is_demo','?')}, cuenta={acct.get('login_id','?')})")

    async def buy_contract(self, contract_type: str) -> dict:
        req = {
            "buy": 1,
            "price": self.stake,
            "parameters": {
                "amount": self.stake,
                "basis": "stake",
                "contract_type": contract_type,
                "currency": "USD",
                "duration": self.duration,
                "duration_unit": self.duration_unit,
                "symbol": self.symbol,
            },
        }
        resp = await self._send(self.trading_ws, req)
        return resp

    async def sell_contract(self, contract_id: int) -> dict:
        req = {"sell": contract_id, "price": 0}
        resp = await self._send(self.trading_ws, req)
        return resp

    # ------------------------------------------------------------------
    # Strategy: on_tick
    # ------------------------------------------------------------------
    def on_tick(self, price: float) -> None:
        self.prices.append(price)
        state.ticks_received += 1
        state.last_tick_time = now_str()

        if len(self.prices) < WARMUP_TICKS:
            return

        plist = list(self.prices)
        hma_series = hma(plist, self.hma_period)
        direction = hma_direction(hma_series)
        flow = mladen_flow(plist, self.flow_period, self.flow_smooth)

        d = direction[-1]
        f = flow[-1]
        if d is None or f is None:
            return

        thr = self.flow_threshold
        now = now_str()

        # ---- Si hay posición abierta, revisar salida ----
        if state.position is not None:
            exit_long = f < 0.0 or d == -1
            exit_short = f > 0.0 or d == 1

            if (state.position == "long" and exit_long) or \
               (state.position == "short" and exit_short):
                side_txt = "LONG" if state.position == "long" else "SHORT"
                self._log("info",
                          f"[{now}] EXIT {side_txt} @ {price:.4f} | "
                          f"flow={f:.4f} hma_dir={d}")
                if state.open_contract_id is not None and self.trading_ws and self.token:
                    asyncio.create_task(self._close_contract(state.open_contract_id))
                self._close_position()
            return

        # ---- Sin posición: buscar entrada ----
        if d == 1 and f > thr:
            self._signal(now, price, "BUY (CALL)", "HMA alcista + flow cruza arriba", "CALL")
        elif d == -1 and f < -thr:
            self._signal(now, price, "SELL (PUT)", "HMA bajista + flow cruza abajo", "PUT")

    def _signal(self, now: str, price: float, action: str, reason: str,
                contract_type: Optional[str]) -> None:
        self._log("info", f"[{now}] {action} @ {price:.4f} | {reason}")

        # Circuit breakers
        if state.consec_losses >= self.stop_after_losses:
            self._log("warning",
                      f"[BLOCKED] pérdidas consecutivas límite ({state.consec_losses})")
            return
        if state.daily_pnl <= -self.max_daily_loss:
            self._log("warning",
                      f"[BLOCKED] pérdida diaria límite ({state.daily_pnl:.2f})")
            return

        if contract_type and self.token and self.trading_ws:
            asyncio.create_task(self._place_trade(action, contract_type))
        elif contract_type and not self.token:
            self._log("info", "  [PAPER] sin token — no se coloca operación")

        if action.startswith("BUY"):
            state.position = "long"
            state.open_side = "CALL"
            state.open_entry_price = price
            state.trades.append(TradeRecord(
                entry_time=now, exit_time=None, side="CALL",
                entry_price=price, exit_price=None, stake=self.stake,
                pnl=None, win=None, contract_id=None,
            ))
        elif action.startswith("SELL"):
            state.position = "short"
            state.open_side = "PUT"
            state.open_entry_price = price
            state.trades.append(TradeRecord(
                entry_time=now, exit_time=None, side="PUT",
                entry_price=price, exit_price=None, stake=self.stake,
                pnl=None, win=None, contract_id=None,
            ))

    async def _place_trade(self, action: str, contract_type: str) -> None:
        try:
            resp = await self.buy_contract(contract_type)
            if "error" in resp:
                self._log("error", f"[TRADE ERROR] {resp['error']}")
                state.position = None
                return
            buy = resp.get("buy", {})
            contract_id = buy.get("contract_id")
            state.open_contract_id = contract_id
            state.trades_today += 1
            if state.trades:
                state.trades[-1].contract_id = contract_id
            self._log("info",
                      f"  [TRADE] id={contract_id} type={contract_type} "
                      f"buy_price={buy.get('buy_price')} "
                      f"tx={buy.get('transaction_id')}")
        except Exception as e:
            self._log("error", f"[TRADE EXCEPTION] {e}")
            state.position = None

    async def _close_contract(self, contract_id: int) -> None:
        try:
            resp = await self.sell_contract(contract_id)
            if "error" in resp:
                self._log("error", f"[SELL ERROR] id={contract_id}: {resp['error']}")
            else:
                sell = resp.get("sell", {})
                sell_price = sell.get("sell_price")
                profit = sell.get("profit")
                self._log("info",
                          f"  [CONTRATO CERRADO] id={contract_id} "
                          f"sell_price={sell_price} profit={profit}")
                if profit is not None:
                    state.daily_pnl += float(profit)
                    if state.trades:
                        state.trades[-1].exit_price = float(sell_price) if sell_price else None
                        state.trades[-1].pnl = float(profit)
                        state.trades[-1].win = float(profit) > 0
                        state.trades[-1].exit_time = now_str()
                        save_trade_to_csv(state.trades[-1])
                    if float(profit) < 0:
                        state.consec_losses += 1
                    else:
                        state.consec_losses = 0
        except Exception as e:
            self._log("error", f"[SELL EXCEPTION] id={contract_id}: {e}")

    def _close_position(self) -> None:
        state.position = None
        state.open_contract_id = None
        state.open_entry_price = 0.0
        state.open_side = None

    # ------------------------------------------------------------------
    # Main loop with reconnection
    # ------------------------------------------------------------------
    async def run(self) -> None:
        reconnect_delay = RECONNECT_BASE_DELAY
        while state.running:
            try:
                await self.connect_public()
                await self.subscribe_ticks()
                await self.connect_trading()
                reconnect_delay = RECONNECT_BASE_DELAY

                while state.running:
                    try:
                        raw = await asyncio.wait_for(self.public_ws.recv(), timeout=30)
                    except asyncio.TimeoutError:
                        continue
                    msg = json.loads(raw)
                    if msg.get("msg_type") == "tick":
                        tick = msg.get("tick", {})
                        price = float(tick.get("quote"))
                        self.on_tick(price)
                    elif msg.get("msg_type") == "error":
                        self._log("error", f"[public] {msg['error']}")
            except asyncio.CancelledError:
                break
            except Exception as e:
                self._log("error", f"Conexión perdida: {e}. Reconectando en {reconnect_delay}s...")
                await asyncio.sleep(reconnect_delay)
                reconnect_delay = min(reconnect_delay * 2, 60)

        if self.public_ws:
            await self.public_ws.close()
        if self.trading_ws:
            await self.trading_ws.close()
        self._log("info", "Bot detenido")


# ============================================================================
# ENTRY POINT
# ============================================================================
def main() -> None:
    print("=" * 60)
    print("1HZ50V HMA + Mladen Flow Bot — Raspberry Pi")
    print("=" * 60)
    print(f"Símbolo     : {CONFIG['symbol']}")
    print(f"HMA         : {CONFIG['hma_period']}")
    print(f"Flow        : {CONFIG['flow_period']} (smooth={CONFIG['flow_smooth']})")
    print(f"Threshold   : {CONFIG['flow_threshold']}")
    print(f"Duración    : {CONFIG['duration']} {CONFIG['duration_unit']}")
    print(f"Stake       : {CONFIG['stake']} USD")
    print(f"Demo        : {CONFIG['demo']}")
    print(f"Token       : {'configurado' if CONFIG['token'] else 'NO (PAPER mode)'}")
    print(f"Log archivo : {CONFIG['log_file']}")
    print("=" * 60)

    if not CONFIG["token"]:
        print("\nAVISO: Ejecutando en MODO PAPER (solo señales, sin operaciones reales).")
        print("Para operar en demo, exporta DERIV_TOKEN antes de iniciar.\n")

    bot = HMAFlowBot(CONFIG)

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    stop_requested = False

    def handle_signal(sig):
        nonlocal stop_requested
        stop_requested = True
        log.info(f"Señal {sig.name} recibida — deteniendo bot...")
        state.running = False

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, handle_signal, sig)
        except NotImplementedError:
            pass  # Windows no soporta add_signal_handler en algunos casos

    try:
        loop.run_until_complete(bot.run())
    except KeyboardInterrupt:
        state.running = False
        log.info("\nInterrumpido por usuario")
    finally:
        # Guardar resumen de trades
        if state.trades:
            wins = [t for t in state.trades if t.win]
            losses = [t for t in state.trades if not t.win]
            total_pnl = sum((t.pnl or 0) for t in state.trades)
            log.info("=" * 60)
            log.info("RESUMEN DE SESIÓN")
            log.info(f"  Trades totales : {len(state.trades)}")
            log.info(f"  Ganadores      : {len(wins)}")
            log.info(f"  Perdedores     : {len(losses)}")
            log.info(f"  PnL total      : {total_pnl:.2f} USD")
            log.info(f"  Ticks recibidos: {state.ticks_received}")
            log.info("=" * 60)
        loop.close()


if __name__ == "__main__":
    main()
