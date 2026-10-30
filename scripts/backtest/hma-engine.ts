import type { Candle } from '../../lib/types.ts';
import { analyzeHmaProFlow, type HmaProFlowParams } from '../../lib/strategies/hma-pro-flow.ts';

export interface HmaParams extends HmaProFlowParams {}

export const DEFAULT_HMA_PARAMS: HmaParams = {
  entryPeriod: 14,
  entryDivisor: 0.1,
  filterPeriod: 300,
  filterDivisor: 2,
  minScore: 1,
  coolDownCandles: 0,
};

export interface Signal {
  index: number;
  time: number;
  type: 'call' | 'put';
  price: number;
  reason: string;
  fastHma: number | null;
  slowHma: number | null;
  fastRising: boolean | null;
  slowRising: boolean | null;
  aligned: boolean | null;
  outcome?: 'win' | 'loss' | 'unresolved';
  exitPrice?: number;
  deltaPct?: number;
}

export interface BacktestOutcome {
  signals: Signal[];
  stats: {
    total: number;
    calls: number;
    puts: number;
    wins: number;
    losses: number;
    unresolved: number;
    winRate: number;
    totalPnl: number;
    avgDelta: number;
  };
}

/**
 * Stateful backtest matching HMA Pro Flow semantics:
 *  - Fast HMA rising + Slow HMA rising = CALL
 *  - Fast HMA falling + Slow HMA falling = PUT
 *  - Conflict cases (fast vs slow diverge) = STOP/skip (no signal)
 *  - cooldown gate blocks signals within coolDownCandles of previous
 * Outcome evaluated against NEXT candle close (mirrors live 60s verification).
 */
export function runHmaProFlowBacktest(
  candles: Candle[],
  params: HmaParams = DEFAULT_HMA_PARAMS
): BacktestOutcome {
  const signals: Signal[] = [];
  let lastSignalIndex = -Infinity;

  for (let i = 0; i < candles.length; i++) {
    const slice = candles.slice(0, i + 1);
    const res = analyzeHmaProFlow(slice, params);

    if (!res.signal) continue;

    const cooledDown = i - lastSignalIndex >= params.coolDownCandles;
    if (!cooledDown) continue;

    lastSignalIndex = i;
    const candle = candles[i];
    signals.push({
      index: i,
      time: candle.time,
      type: res.signal,
      price: candle.close,
      reason: res.reason,
      fastHma: res.fastHma,
      slowHma: res.slowHma,
      fastRising: res.fastRising,
      slowRising: res.slowRising,
      aligned: res.aligned,
    });
  }

  // Evaluate each signal against the next candle's close (60s later).
  for (const s of signals) {
    const next = candles[s.index + 1];
    if (!next) {
      s.outcome = 'unresolved';
      continue;
    }
    s.exitPrice = next.close;
    s.deltaPct = ((next.close - s.price) / s.price) * 100;
    s.outcome =
      s.type === 'call' ? (next.close > s.price ? 'win' : 'loss') : next.close < s.price ? 'win' : 'loss';
  }

  const resolved = signals.filter((s) => s.outcome === 'win' || s.outcome === 'loss');
  const wins = resolved.filter((s) => s.outcome === 'win');
  const losses = resolved.filter((s) => s.outcome === 'loss');
  const totalPnl = resolved.reduce(
    (acc, s) => acc + (s.type === 'call' ? s.deltaPct! : -s.deltaPct!),
    0
  );

  return {
    signals,
    stats: {
      total: signals.length,
      calls: signals.filter((s) => s.type === 'call').length,
      puts: signals.filter((s) => s.type === 'put').length,
      wins: wins.length,
      losses: losses.length,
      unresolved: signals.filter((s) => s.outcome === 'unresolved').length,
      winRate: resolved.length ? (wins.length / resolved.length) * 100 : 0,
      totalPnl,
      avgDelta: resolved.length ? resolved.reduce((a, s) => a + s.deltaPct!, 0) / resolved.length : 0,
    },
  };
}
