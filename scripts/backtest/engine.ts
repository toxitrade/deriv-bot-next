import type { Candle } from '../../lib/types.ts';
import { analyzeAdaptiveConfluence } from '../../lib/strategies/adaptive-confluence.ts';

export interface AdaptiveParams {
  emaFast: number;
  emaSlow: number;
  rsiPeriod: number;
  rsiBullMin: number;
  rsiBullMax: number;
  rsiBearMin: number;
  rsiBearMax: number;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
  bbPeriod: number;
  bbStdDev: number;
  minScore: number;
  coolDownCandles: number;
}

export const DEFAULT_PARAMS: AdaptiveParams = {
  emaFast: 20,
  emaSlow: 50,
  rsiPeriod: 14,
  rsiBullMin: 45,
  rsiBullMax: 70,
  rsiBearMin: 30,
  rsiBearMax: 55,
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
  bbPeriod: 20,
  bbStdDev: 2,
  minScore: 3,
  coolDownCandles: 8,
};

export interface Signal {
  index: number;
  time: number;
  type: 'call' | 'put';
  price: number;
  reason: string;
  bullishCount: number;
  bearishCount: number;
  rsi: number | null;
  macdHist: number | null;
  bbPos: number | null;
  emaFast: number | null;
  emaSlow: number | null;
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
 * Stateful backtest matching the legacy AdaptiveConfluenceStrategy semantics:
 *  - prevMacdHist is carried forward across candles (enables MACD cross detection)
 *  - a cooldown gate blocks signals within coolDownCandles of the previous one
 * Outcome is evaluated against the NEXT candle close, mirroring the live
 * useSignalExecution verification window (60s).
 */
export function runAdaptiveConfluenceBacktest(
  candles: Candle[],
  params: AdaptiveParams = DEFAULT_PARAMS
): BacktestOutcome {
  const signals: Signal[] = [];
  let prevMacdHist: number | null = null;
  let lastSignalIndex = -Infinity;

  for (let i = 0; i < candles.length; i++) {
    const slice = candles.slice(0, i + 1);
    const res = analyzeAdaptiveConfluence(slice, params, prevMacdHist);
    prevMacdHist = res.nextPrevMacdHist;

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
      bullishCount: res.bullishCount,
      bearishCount: res.bearishCount,
      rsi: res.rsi,
      macdHist: res.macdHist,
      bbPos: res.bbPos,
      emaFast: res.emaFast,
      emaSlow: res.emaSlow,
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
  const totalPnl = resolved.reduce((acc, s) => acc + (s.type === 'call' ? s.deltaPct! : -s.deltaPct!), 0);

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