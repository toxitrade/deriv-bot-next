import type { Candle } from '../../lib/types.ts';
import type { AdaptiveParams, Signal } from './engine.ts';

/**
 * Fast incremental re-implementation of the Adaptive Confluence analyzer.
 * Mathematically identical to lib/strategies/adaptive-confluence.ts, but keeps
 * EMA/MACD state across candles in O(1) per candle instead of recomputing the
 * whole history each step.
 *
 * RSI and Bollinger are recomputed directly over their windows (small periods)
 * so the floating-point results match the reference bit-for-bit.
 *
 * Verified against the reference implementation by scripts/backtest/verify.ts.
 */
export function runFastBacktest(
  candles: Candle[],
  params: AdaptiveParams
): { signals: Signal[] } {
  const signals: Signal[] = [];
  let prevMacdHist: number | null = null;
  let lastSignalIndex = -Infinity;

  const kFast = 2 / (params.emaFast + 1);
  const kSlow = 2 / (params.emaSlow + 1);
  const kMacdFast = 2 / (params.macdFast + 1);
  const kMacdSlow = 2 / (params.macdSlow + 1);
  const kSignal = 2 / (params.macdSignal + 1);

  const closes: number[] = [];
  let emaFastVal: number | null = null;
  let emaSlowVal: number | null = null;
  let macdFastVal: number | null = null;
  let macdSlowVal: number | null = null;
  let signalEma: number | null = null;
  let macdLine: number | null = null;
  const macdSeries: number[] = [];

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const close = c.close;
    closes.push(close);

    // --- EMAs (same op sequence as emaFromCloses: SMA seed then recurrence) ---
    if (i === params.emaFast - 1) {
      let s = 0;
      for (let j = 0; j <= i; j++) s += closes[j];
      emaFastVal = s / params.emaFast;
    } else if (i > params.emaFast - 1 && emaFastVal !== null) {
      emaFastVal = (close - emaFastVal) * kFast + emaFastVal;
    }

    if (i === params.emaSlow - 1) {
      let s = 0;
      for (let j = 0; j <= i; j++) s += closes[j];
      emaSlowVal = s / params.emaSlow;
    } else if (i > params.emaSlow - 1 && emaSlowVal !== null) {
      emaSlowVal = (close - emaSlowVal) * kSlow + emaSlowVal;
    }

    // --- MACD EMAs + series + signal EMA ---
    if (i === params.macdFast - 1) {
      let s = 0;
      for (let j = 0; j <= i; j++) s += closes[j];
      macdFastVal = s / params.macdFast;
    } else if (i > params.macdFast - 1 && macdFastVal !== null) {
      macdFastVal = (close - macdFastVal) * kMacdFast + macdFastVal;
    }

    if (i === params.macdSlow - 1) {
      let s = 0;
      for (let j = 0; j <= i; j++) s += closes[j];
      macdSlowVal = s / params.macdSlow;
    } else if (i > params.macdSlow - 1 && macdSlowVal !== null) {
      macdSlowVal = (close - macdSlowVal) * kMacdSlow + macdSlowVal;
    }

    // The reference builds the MACD series over slice lengths [slow..len], i.e.
    // EMA values as of 0-based index (sliceLength - 1). Hence the series starts
    // at index (macdSlow - 1) here.
    if (i >= params.macdSlow - 1 && macdFastVal !== null && macdSlowVal !== null) {
      const line = macdFastVal - macdSlowVal;
      macdSeries.push(line);
      macdLine = line;
      if (macdSeries.length === params.macdSignal) {
        let s = 0;
        for (let j = 0; j < macdSeries.length; j++) s += macdSeries[j];
        signalEma = s / params.macdSignal;
      } else if (macdSeries.length > params.macdSignal && signalEma !== null) {
        signalEma = (line - signalEma) * kSignal + signalEma;
      }
    }

    // --- Evaluate signal (mirrors analyzeAdaptiveConfluence) ---
    const warmupOk = closes.length >= 60;
    // macdFromCloses returns null while len < macdSlow + macdSignal.
    const macdReady = closes.length >= params.macdSlow + params.macdSignal;
    const indicatorsReady =
      emaFastVal !== null && emaSlowVal !== null && macdReady && signalEma !== null && macdLine !== null;

    if (!warmupOk || !indicatorsReady) {
      // Reference keeps prevMacdHist unchanged while indicators are not ready.
      continue;
    }

    // RSI: direct loop over the last `period` changes, same as rsiFromCloses.
    let gains = 0;
    let losses = 0;
    for (let j = closes.length - params.rsiPeriod; j < closes.length; j++) {
      const ch = closes[j] - closes[j - 1];
      if (ch > 0) gains += ch;
      else losses += Math.abs(ch);
    }
    const avgGain = gains / params.rsiPeriod;
    const avgLoss = losses / params.rsiPeriod;
    const rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

    // Bollinger: direct window, same as bbFromCloses.
    const win = closes.slice(-params.bbPeriod);
    const mid = win.reduce((a, b) => a + b, 0) / params.bbPeriod;
    const variance = win.reduce((acc, p) => acc + (p - mid) ** 2, 0) / params.bbPeriod;
    const sd = Math.sqrt(variance);
    const upper = mid + sd * params.bbStdDev;
    const lower = mid - sd * params.bbStdDev;
    const bbPos = (close - lower) / Math.max(upper - lower, 1e-9);

    const range = Math.max(c.high - c.low, 1e-9);
    const body = Math.abs(c.close - c.open);

    const bullish: string[] = [];
    const bearish: string[] = [];

    if (emaFastVal > emaSlowVal) bullish.push('TrendUp');
    if (emaFastVal < emaSlowVal) bearish.push('TrendDown');

    if (rsi >= params.rsiBullMin && rsi <= params.rsiBullMax) bullish.push(`RSI=${rsi.toFixed(1)} bull`);
    if (rsi >= params.rsiBearMin && rsi <= params.rsiBearMax) bearish.push(`RSI=${rsi.toFixed(1)} bear`);

    const hist = macdLine - signalEma;
    if (prevMacdHist !== null && prevMacdHist <= 0 && hist > 0) bullish.push('MACD bullish cross');
    if (prevMacdHist !== null && prevMacdHist >= 0 && hist < 0) bearish.push('MACD bearish cross');

    if (bbPos <= 0.35 && close >= mid) bullish.push('BB reclaim');
    if (bbPos >= 0.65 && close <= mid) bearish.push('BB rejection');

    if (body / range > 0.55 && c.close > c.open) bullish.push('Strong bullish body');
    if (body / range > 0.55 && c.close < c.open) bearish.push('Strong bearish body');

    let signal: 'call' | 'put' | null = null;
    if (bullish.length >= params.minScore && bullish.length > bearish.length) signal = 'call';
    else if (bearish.length >= params.minScore && bearish.length > bearish.length) signal = 'put';

    prevMacdHist = hist;

    if (!signal) continue;
    if (i - lastSignalIndex < params.coolDownCandles) continue;
    lastSignalIndex = i;

    signals.push({
      index: i,
      time: c.time,
      type: signal,
      price: c.close,
      reason: bullish.length > bearish.length ? bullish.join('; ') : bearish.join('; '),
      bullishCount: bullish.length,
      bearishCount: bearish.length,
      rsi,
      macdHist: hist,
      bbPos: null,
      emaFast: emaFastVal,
      emaSlow: emaSlowVal,
    });
  }

  return { signals };
}
