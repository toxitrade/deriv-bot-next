import { crossUp, crossDown } from 'technicalindicators';
import type { Candle } from '@/lib/types';

export interface CrossoverParams {
  smaPeriod: number;
  emaPeriod: number;
}

export interface CrossoverResult {
  signal: 'call' | 'put' | null;
  reason: string;
  sma: number;
  ema: number;
}

export interface TickCrossoverResult {
  signal: 'call' | 'put' | null;
  side: 'call' | 'put' | null;
}

function computeSmaSeries(closes: number[], period: number): number[] {
  const result: number[] = [];
  let sum = 0;
  for (let i = 0; i < closes.length; i++) {
    sum += closes[i];
    if (i >= period - 1) {
      result.push(sum / period);
      sum -= closes[i - period + 1];
    }
  }
  return result;
}

function computeEmaSeries(closes: number[], period: number): number[] {
  const multiplier = 2 / (period + 1);
  let ema = 0;
  for (let i = 0; i < period; i++) ema += closes[i];
  ema /= period;
  const result: number[] = [ema];
  for (let i = period; i < closes.length; i++) {
    ema = (closes[i] - ema) * multiplier + ema;
    result.push(ema);
  }
  return result;
}

export function analyzeCrossover(
  candles: Candle[],
  params: CrossoverParams
): CrossoverResult {
  const { smaPeriod, emaPeriod } = params;
  const minCandles = Math.max(smaPeriod, emaPeriod);
  if (candles.length < minCandles) {
    return { signal: null, reason: 'Insufficient data', sma: 0, ema: 0 };
  }

  const closes = candles.map((c) => c.close);
  const smaSeries = computeSmaSeries(closes, smaPeriod);
  const emaSeries = computeEmaSeries(closes, emaPeriod);

  const len = Math.min(smaSeries.length, emaSeries.length);
  if (len < 2) {
    return { signal: null, reason: 'Not enough values for crossover detection', sma: 0, ema: 0 };
  }

  const up = crossUp({ lineA: emaSeries.slice(0, len), lineB: smaSeries.slice(0, len) });
  const down = crossDown({ lineA: emaSeries.slice(0, len), lineB: smaSeries.slice(0, len) });

  if (up[len - 1]) {
    return {
      signal: 'call',
      reason: `EMA crossed above SMA (${emaSeries[len - 1].toFixed(2)} > ${smaSeries[len - 1].toFixed(2)})`,
      sma: smaSeries[len - 1],
      ema: emaSeries[len - 1],
    };
  }
  if (down[len - 1]) {
    return {
      signal: 'put',
      reason: `EMA crossed below SMA (${emaSeries[len - 1].toFixed(2)} < ${smaSeries[len - 1].toFixed(2)})`,
      sma: smaSeries[len - 1],
      ema: emaSeries[len - 1],
    };
  }
  return {
    signal: null,
    reason: `No crossover (EMA ${emaSeries[len - 1].toFixed(2)} vs SMA ${smaSeries[len - 1].toFixed(2)})`,
    sma: smaSeries[len - 1],
    ema: emaSeries[len - 1],
  };
}

export function analyzeTickCrossover(
  tickPrice: number,
  sma: number,
  ema: number,
  prevTick: number | null,
  prevSide: 'call' | 'put' | null
): TickCrossoverResult {
  if (prevTick === null) return { signal: null, side: null };

  const wasAbove = prevTick > ema && prevTick > sma;
  const wasBelow = prevTick < ema && prevTick < sma;
  const isAbove = tickPrice > ema && tickPrice > sma;
  const isBelow = tickPrice < ema && tickPrice < sma;

  let signal: 'call' | 'put' | null = null;
  let side: 'call' | 'put' | null = null;

  if (wasBelow && isAbove && prevSide !== 'call') {
    signal = 'call';
    side = 'call';
  } else if (wasAbove && isBelow && prevSide !== 'put') {
    signal = 'put';
    side = 'put';
  } else if (isAbove) {
    side = 'call';
  } else if (isBelow) {
    side = 'put';
  }

  return { signal, side };
}
