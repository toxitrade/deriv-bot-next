import type { Candle, IndicatorPoint, BBResult, StochasticPoint, MACDPoint } from '@/lib/types';

function ema(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  const k = 2 / (period + 1);
  let emaVal = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < closes.length; i++) {
    emaVal = (closes[i] - emaVal) * k + emaVal;
  }
  return emaVal;
}

export function calculateSMA(data: Candle[], period: number): IndicatorPoint[] {
  return data.map((d, i) => {
    if (i < period - 1) return { time: d.time, value: null };
    let sum = 0;
    for (let j = 0; j < period; j++) sum += data[i - j].close;
    return { time: d.time, value: sum / period };
  });
}

export function calculateEMA(data: Candle[], period: number): IndicatorPoint[] {
  if (data.length === 0) return [];
  if (data.length < period) return data.map((d) => ({ time: d.time, value: null }));

  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += data[i].close;
  let emaVal = sum / period;

  const result: IndicatorPoint[] = [];
  for (let i = 0; i < period - 1; i++) {
    result.push({ time: data[i].time, value: null });
  }
  for (let i = period - 1; i < data.length; i++) {
    emaVal = (data[i].close - emaVal) * k + emaVal;
    result.push({ time: data[i].time, value: emaVal });
  }
  return result;
}

export function calculateRSI(data: Candle[], period: number): IndicatorPoint[] {
  if (data.length < period + 1) return data.map((d) => ({ time: d.time, value: null }));

  const result: IndicatorPoint[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period) {
      result.push({ time: data[i].time, value: null });
      continue;
    }
    let gains = 0, losses = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const diff = data[j].close - data[j - 1].close;
      diff >= 0 ? (gains += diff) : (losses -= diff);
    }
    const rs = gains / (losses || 1);
    result.push({ time: data[i].time, value: 100 - 100 / (1 + rs) });
  }
  return result;
}

export function calculateBB(data: Candle[], period: number, stdDev = 2): BBResult {
  const upper: IndicatorPoint[] = [];
  const middle: IndicatorPoint[] = [];
  const lower: IndicatorPoint[] = [];

  data.forEach((d, i) => {
    if (i < period - 1) {
      upper.push({ time: d.time, value: null });
      middle.push({ time: d.time, value: null });
      lower.push({ time: d.time, value: null });
      return;
    }
    let sum = 0;
    for (let j = 0; j < period; j++) sum += data[i - j].close;
    const avg = sum / period;
    let sqSum = 0;
    for (let j = 0; j < period; j++) sqSum += Math.pow(data[i - j].close - avg, 2);
    const sd = Math.sqrt(sqSum / period);
    upper.push({ time: d.time, value: avg + sd * stdDev });
    middle.push({ time: d.time, value: avg });
    lower.push({ time: d.time, value: avg - sd * stdDev });
  });

  return { upper, middle, lower };
}

export function calculateMACD(
  data: Candle[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
): MACDPoint[] {
  if (data.length < slowPeriod) return data.map((d) => ({ time: d.time, macd: null, signal: null, histogram: null }));

  const closes = data.map((d) => d.close);
  const result: MACDPoint[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i < slowPeriod - 1) {
      result.push({ time: data[i].time, macd: null, signal: null, histogram: null });
      continue;
    }
    const fastEma = ema(closes.slice(0, i + 1), fastPeriod);
    const slowEma = ema(closes.slice(0, i + 1), slowPeriod);
    if (fastEma === null || slowEma === null) {
      result.push({ time: data[i].time, macd: null, signal: null, histogram: null });
      continue;
    }
    const macdLine = fastEma - slowEma;
    const validMacds = result.slice(-signalPeriod).map((r) => r.macd).filter((m): m is number => m !== null);
    validMacds.push(macdLine);
    const signalLine = ema(validMacds, signalPeriod) || macdLine;
    result.push({ time: data[i].time, macd: macdLine, signal: signalLine, histogram: macdLine - signalLine });
  }
  return result;
}

export function calculateStochastic(data: Candle[], period = 14): StochasticPoint[] {
  if (data.length < period) return data.map((d) => ({ time: d.time, k: null, d: null }));

  return data.map((d, i) => {
    if (i < period - 1) return { time: d.time, k: null, d: null };
    const window = data.slice(i - period + 1, i + 1);
    const high = Math.max(...window.map((c) => c.high));
    const low = Math.min(...window.map((c) => c.low));
    const k = high === low ? 50 : ((d.close - low) / (high - low)) * 100;
    return { time: d.time, k, d: k };
  });
}
