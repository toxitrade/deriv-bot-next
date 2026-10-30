import type { Candle } from '@/lib/types';

/**
 * HMA Pro Flow [Mladen] + Signals — by vdubus (TradingView)
 *
 * Dual HMA system:
 *   Entry HMA (Fast):  period 14, divisor 0.1  — reacts quickly to price changes
 *   Trend Filter (Slow): period 300, divisor 2  — determines overall market bias
 *
 * Signal logic:
 *   BUY   = Fast HMA rising  AND Slow HMA rising   (momentum + trend aligned long)
 *   SELL  = Fast HMA falling AND Slow HMA falling  (momentum + trend aligned short)
 *   STOP  = Fast HMA changes direction but conflicts with Slow HMA (pullback vs reversal filter)
 *
 * HMA formula (with configurable divisor D, standard HMA uses D=2):
 *   HMA(n) = WMA( D * WMA(n/2) - WMA(n), round(sqrt(n)) )
 */

export interface HmaProFlowParams {
  entryPeriod: number;      // Fast HMA period (default 14)
  entryDivisor: number;     // Fast HMA divisor (default 0.1)
  filterPeriod: number;     // Slow HMA period (default 300)
  filterDivisor: number;    // Slow HMA divisor (default 2)
  minScore: number;         // Min aligned signals required (default 1: just trend alignment)
  coolDownCandles: number;  // Cooldown between signals (default 0 for max signals)
}

export const DEFAULT_HMA_PARAMS: HmaProFlowParams = {
  entryPeriod: 14,
  entryDivisor: 0.1,
  filterPeriod: 300,
  filterDivisor: 2,
  minScore: 1,
  coolDownCandles: 0,
};

export interface HmaResult {
  signal: 'call' | 'put' | null;
  reason: string;
  fastHma: number | null;
  slowHma: number | null;
  fastRising: boolean | null;
  slowRising: boolean | null;
  aligned: boolean | null;
}

/** Weighted Moving Average of a window */
function wmaWindow(values: number[], period: number): number | null {
  if (values.length < period) return null;
  let sum = 0;
  let wsum = 0;
  for (let j = 0; j < period; j++) {
    const w = j + 1;
    sum += values[values.length - period + j] * w;
    wsum += w;
  }
  return sum / wsum;
}

/** Compute the full HMA series for an array of closes */
export function computeHmaSeries(
  closes: number[],
  period: number,
  divisor: number
): (number | null)[] {
  const n = closes.length;
  const halfPeriod = Math.max(1, Math.floor(period / 2));
  const sqrtPeriod = Math.max(1, Math.round(Math.sqrt(period)));

  // WMA over half period, computed at each index
  const wmaHalf: (number | null)[] = new Array(n).fill(null);
  for (let i = halfPeriod - 1; i < n; i++) {
    const v = wmaWindow(closes.slice(0, i + 1), halfPeriod);
    wmaHalf[i] = v;
  }

  // WMA over full period, computed at each index
  const wmaFull: (number | null)[] = new Array(n).fill(null);
  for (let i = period - 1; i < n; i++) {
    const v = wmaWindow(closes.slice(0, i + 1), period);
    wmaFull[i] = v;
  }

  // raw[i] = divisor * WMA_half(i) - WMA_full(i)
  const raw: (number | null)[] = new Array(n).fill(null);
  const rawStart = Math.max(halfPeriod - 1, period - 1);
  for (let i = rawStart; i < n; i++) {
    const wh = wmaHalf[i];
    const wf = wmaFull[i];
    if (wh !== null && wf !== null) {
      raw[i] = divisor * wh - wf;
    }
  }

  // HMA[i] = WMA of raw over sqrtPeriod, ending at i
  const hma: (number | null)[] = new Array(n).fill(null);
  const hmaStart = rawStart + sqrtPeriod - 1;
  for (let i = hmaStart; i < n; i++) {
    let sum = 0;
    let wsum = 0;
    let valid = true;
    for (let j = 0; j < sqrtPeriod; j++) {
      const w = j + 1;
      const val = raw[i - sqrtPeriod + 1 + j];
      if (val === null) { valid = false; break; }
      sum += val * w;
      wsum += w;
    }
    if (valid) hma[i] = sum / wsum;
  }

  return hma;
}

/**
 * Analyze HMA Pro Flow signal at the current candle.
 * Precomputes HMA series for efficiency.
 */
export function analyzeHmaProFlow(
  candles: Candle[],
  params: HmaProFlowParams = DEFAULT_HMA_PARAMS
): HmaResult {
  if (candles.length < params.filterPeriod + 10) {
    return {
      signal: null,
      reason: `Insufficient data (need >= ${params.filterPeriod + 10} candles)`,
      fastHma: null,
      slowHma: null,
      fastRising: null,
      slowRising: null,
      aligned: null,
    };
  }

  const closes = candles.map((c) => c.close);
  const idx = closes.length - 1;
  const price = closes[idx];

  // Precompute both HMA series
  const fastHmaSeries = computeHmaSeries(closes, params.entryPeriod, params.entryDivisor);
  const slowHmaSeries = computeHmaSeries(closes, params.filterPeriod, params.filterDivisor);

  const fastHma = fastHmaSeries[idx];
  const slowHma = slowHmaSeries[idx];
  const fastHmaPrev = fastHmaSeries[idx - 1];
  const slowHmaPrev = slowHmaSeries[idx - 1];

  if (fastHma === null || slowHma === null || fastHmaPrev === null || slowHmaPrev === null) {
    return {
      signal: null,
      reason: 'HMA warmup',
      fastHma,
      slowHma,
      fastRising: null,
      slowRising: null,
      aligned: null,
    };
  }

  const fastRising = fastHma > fastHmaPrev;
  const slowRising = slowHma > slowHmaPrev;
  const aligned = fastRising === slowRising; // both rising or both falling

  const bullish: string[] = [];
  const bearish: string[] = [];

  if (fastRising && slowRising) bullish.push('Fast HMA rising + Slow HMA rising');
  if (!fastRising && !slowRising) bearish.push('Fast HMA falling + Slow HMA falling');
  if (fastRising && !slowRising) bullish.push('Fast HMA rising (conflict with slow)');
  if (!fastRising && slowRising) bearish.push('Fast HMA falling (conflict with slow)');

  let signal: 'call' | 'put' | null = null;
  let reason = `fastRising=${fastRising}, slowRising=${slowRising}, aligned=${aligned}`;

  if (aligned && fastRising && bullish.length >= params.minScore) {
    signal = 'call';
    reason = bullish.join('; ');
  } else if (aligned && !fastRising && bearish.length >= params.minScore) {
    signal = 'put';
    reason = bearish.join('; ');
  }

  return {
    signal,
    reason,
    fastHma,
    slowHma,
    fastRising,
    slowRising,
    aligned,
  };
}
