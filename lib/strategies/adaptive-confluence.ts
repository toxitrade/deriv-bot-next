import type { Candle } from '@/lib/types';

export interface AdaptiveConfluenceParams {
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

export interface AdaptiveConfluenceResult {
  signal: 'call' | 'put' | null;
  reason: string;
  bullishCount: number;
  bearishCount: number;
  emaFast: number | null;
  emaSlow: number | null;
  rsi: number | null;
  macdHist: number | null;
  bbPos: number | null;
}

function emaFromCloses(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  const k = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < closes.length; i++) {
    ema = (closes[i] - ema) * k + ema;
  }
  return ema;
}

function rsiFromCloses(closes: number[], period: number): number | null {
  if (closes.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const ch = closes[i] - closes[i - 1];
    if (ch > 0) gains += ch;
    else losses += Math.abs(ch);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

export function macdFromCloses(closes: number[], fast: number, slow: number, signal: number) {
  if (closes.length < slow + signal) return null;
  const macdSeries: number[] = [];
  for (let i = slow; i <= closes.length; i++) {
    const slice = closes.slice(0, i);
    const ef = emaFromCloses(slice, fast);
    const es = emaFromCloses(slice, slow);
    if (ef === null || es === null) continue;
    macdSeries.push(ef - es);
  }
  if (macdSeries.length < signal) return null;
  const sig = emaFromCloses(macdSeries, signal);
  const macdLine = macdSeries[macdSeries.length - 1];
  if (sig === null || macdLine === null) return null;
  return { line: macdLine, signal: sig, hist: macdLine - sig };
}

function bbFromCloses(closes: number[], period: number, stdDev: number) {
  if (closes.length < period) return null;
  const window = closes.slice(-period);
  const mid = window.reduce((a, b) => a + b, 0) / period;
  const variance = window.reduce((acc, p) => acc + (p - mid) ** 2, 0) / period;
  const sd = Math.sqrt(variance);
  return { upper: mid + sd * stdDev, mid, lower: mid - sd * stdDev };
}

export function analyzeAdaptiveConfluence(
  candles: Candle[],
  params: AdaptiveConfluenceParams,
  prevMacdHist: number | null
): AdaptiveConfluenceResult & { nextPrevMacdHist: number | null } {
  if (candles.length < 60) {
    return {
      signal: null,
      reason: 'Insufficient data (need >= 60 candles)',
      bullishCount: 0,
      bearishCount: 0,
      emaFast: null,
      emaSlow: null,
      rsi: null,
      macdHist: null,
      bbPos: null,
      nextPrevMacdHist: prevMacdHist,
    };
  }

  const closes = candles.map((c) => c.close);
  const idx = closes.length - 1;
  const price = closes[idx];

  const emaFast = emaFromCloses(closes, params.emaFast);
  const emaSlow = emaFromCloses(closes, params.emaSlow);
  const rsi = rsiFromCloses(closes, params.rsiPeriod);
  const macd = macdFromCloses(closes, params.macdFast, params.macdSlow, params.macdSignal);
  const bb = bbFromCloses(closes, params.bbPeriod, params.bbStdDev);

  if ([emaFast, emaSlow, rsi, macd, bb].some((v) => v === null)) {
    return {
      signal: null,
      reason: 'Indicator warmup',
      bullishCount: 0,
      bearishCount: 0,
      emaFast,
      emaSlow,
      rsi,
      macdHist: null,
      bbPos: null,
      nextPrevMacdHist: prevMacdHist,
    };
  }

  const range = Math.max(candles[idx].high - candles[idx].low, 1e-9);
  const bbPos = (price - bb!.lower) / Math.max(bb!.upper - bb!.lower, 1e-9);

  const bullish: string[] = [];
  const bearish: string[] = [];

  if (emaFast! > emaSlow!) bullish.push('TrendUp');
  if (emaFast! < emaSlow!) bearish.push('TrendDown');

  if (rsi! >= params.rsiBullMin && rsi! <= params.rsiBullMax) bullish.push(`RSI=${rsi!.toFixed(1)} bull`);
  if (rsi! >= params.rsiBearMin && rsi! <= params.rsiBearMax) bearish.push(`RSI=${rsi!.toFixed(1)} bear`);

  if (prevMacdHist !== null && prevMacdHist <= 0 && macd!.hist > 0) bullish.push('MACD bullish cross');
  if (prevMacdHist !== null && prevMacdHist >= 0 && macd!.hist < 0) bearish.push('MACD bearish cross');

  if (bbPos <= 0.35 && price >= bb!.mid) bullish.push('BB reclaim');
  if (bbPos >= 0.65 && price <= bb!.mid) bearish.push('BB rejection');

  const body = Math.abs(candles[idx].close - candles[idx].open);
  if (body / range > 0.55 && candles[idx].close > candles[idx].open) bullish.push('Strong bullish body');
  if (body / range > 0.55 && candles[idx].close < candles[idx].open) bearish.push('Strong bearish body');

  let signal: 'call' | 'put' | null = null;
  let reason = `bull=${bullish.length}, bear=${bearish.length}`;

  if (bullish.length >= params.minScore && bullish.length > bearish.length) {
    signal = 'call';
    reason = bullish.join('; ');
  } else if (bearish.length >= params.minScore && bearish.length > bullish.length) {
    signal = 'put';
    reason = bearish.join('; ');
  }

  return {
    signal,
    reason,
    bullishCount: bullish.length,
    bearishCount: bearish.length,
    emaFast,
    emaSlow,
    rsi,
    macdHist: macd!.hist,
    bbPos,
    nextPrevMacdHist: macd!.hist,
  };
}
