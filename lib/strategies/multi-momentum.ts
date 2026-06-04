import type { Candle } from '@/lib/types';

export interface MultiMomentumParams {
  minConfirmations: number;
  rsiPeriod: number;
  rsiHigh: number;
  rsiLow: number;
  stochPeriod: number;
  smaFast: number;
  smaSlow: number;
  bbPeriod: number;
  bbStdDev: number;
  enabled: {
    rsi: boolean;
    stoch: boolean;
    macd: boolean;
    sma: boolean;
    bb: boolean;
  };
}

export interface MultiMomentumResult {
  signal: 'call' | 'put' | null;
  reason: string;
  bullishCount: number;
  bearishCount: number;
  activeIndicators: number;
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
  const avgLoss = losses / period || 1;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

function stochFromCandles(candles: Candle[], period: number): { k: number; d: number } | null {
  if (candles.length < period) return null;
  const window = candles.slice(-period);
  const high = Math.max(...window.map((c) => c.high));
  const low = Math.min(...window.map((c) => c.low));
  if (high === low) return { k: 50, d: 50 };
  const k = ((candles[candles.length - 1].close - low) / (high - low)) * 100;
  return { k, d: k };
}

function smaFromCloses(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  return closes.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function macdFromCloses(closes: number[], fast: number, slow: number, signal: number) {
  if (closes.length < slow + signal) return null;
  const emaFast = emaFromCloses(closes, fast);
  const emaSlow = emaFromCloses(closes, slow);
  if (emaFast === null || emaSlow === null) return null;
  const line = emaFast - emaSlow;
  const sig = line * 0.9 + (emaFast - emaSlow) * 0.1;
  return { line, signal: sig, histogram: line - sig };
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

function bbFromCloses(closes: number[], period: number, stdDev: number) {
  if (closes.length < period) return null;
  const window = closes.slice(-period);
  const mid = window.reduce((a, b) => a + b, 0) / period;
  const variance = window.reduce((acc, p) => acc + (p - mid) ** 2, 0) / period;
  const sd = Math.sqrt(variance);
  return { upper: mid + sd * stdDev, mid, lower: mid - sd * stdDev };
}

export function analyzeMultiMomentum(
  candles: Candle[],
  params: MultiMomentumParams
): MultiMomentumResult {
  const activeCount = Object.values(params.enabled).filter(Boolean).length;
  if (candles.length < 30) {
    return { signal: null, reason: 'Insufficient data', bullishCount: 0, bearishCount: 0, activeIndicators: activeCount };
  }

  const closes = candles.map((c) => c.close);
  const price = closes[closes.length - 1];
  const bullish: string[] = [];
  const bearish: string[] = [];

  if (params.enabled.rsi) {
    const rsi = rsiFromCloses(closes, params.rsiPeriod);
    if (rsi !== null) {
      if (rsi < params.rsiLow) bullish.push(`RSI=${rsi.toFixed(1)}<${params.rsiLow}`);
      else if (rsi > params.rsiHigh) bearish.push(`RSI=${rsi.toFixed(1)}>${params.rsiHigh}`);
    }
  }

  if (params.enabled.stoch) {
    const stoch = stochFromCandles(candles, params.stochPeriod);
    if (stoch !== null) {
      if (stoch.k < 20) bullish.push(`Stoch=${stoch.k.toFixed(1)}<20`);
      else if (stoch.k > 80) bearish.push(`Stoch=${stoch.k.toFixed(1)}>80`);
    }
  }

  if (params.enabled.macd && candles.length >= 2) {
    const prevCloses = closes.slice(0, -1);
    const macd = macdFromCloses(closes, 12, 26, 9);
    const prevMacd = macdFromCloses(prevCloses, 12, 26, 9);
    if (macd && prevMacd) {
      if (prevMacd.histogram < 0 && macd.histogram > 0) bullish.push('MACD↑');
      else if (prevMacd.histogram > 0 && macd.histogram < 0) bearish.push('MACD↓');
    }
  }

  if (params.enabled.sma) {
    const fast = smaFromCloses(closes, params.smaFast);
    const slow = smaFromCloses(closes, params.smaSlow);
    if (fast !== null && slow !== null) {
      if (price > fast && fast > slow) bullish.push('Price>SMA9>SMA21');
      else if (price < fast && fast < slow) bearish.push('Price<SMA9<SMA21');
    }
  }

  if (params.enabled.bb) {
    const bb = bbFromCloses(closes, params.bbPeriod, params.bbStdDev);
    if (bb !== null) {
      if (price <= bb.lower * 1.001) bullish.push('BB-Bottom');
      else if (price >= bb.upper * 0.999) bearish.push('BB-Top');
    }
  }

  const bullishCount = bullish.length;
  const bearishCount = bearish.length;
  let signal: 'call' | 'put' | null = null;
  let reason = '';

  if (bullishCount >= params.minConfirmations) {
    signal = 'call';
    reason = `CALL (${bullishCount}/${activeCount}): ${bullish.join(', ')}`;
  } else if (bearishCount >= params.minConfirmations) {
    signal = 'put';
    reason = `PUT (${bearishCount}/${activeCount}): ${bearish.join(', ')}`;
  } else {
    reason = `Awaiting: ${Math.max(bullishCount, bearishCount)}/${params.minConfirmations}`;
  }

  return { signal, reason, bullishCount, bearishCount, activeIndicators: activeCount };
}
