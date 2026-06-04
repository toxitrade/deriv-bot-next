'use client';

import { useMemo } from 'react';
import type { Candle, IndicatorPoint, BBResult, MACDPoint, StochasticPoint, IndicatorConfig } from '@/lib/types';
import { calculateSMA, calculateEMA, calculateRSI, calculateBB, calculateMACD, calculateStochastic } from '@/lib/indicators';
import { calculateATR } from '@/lib/multi-indicators';

export interface IndicatorResults {
  sma: IndicatorPoint[];
  ema: IndicatorPoint[];
  rsi: IndicatorPoint[];
  bb: BBResult;
  macd: MACDPoint[];
  stochastic: StochasticPoint[];
  atr: { time: number; atr: number | null }[];
  latest: {
    sma: number | null;
    ema: number | null;
    rsi: number | null;
    bbUpper: number | null;
    bbLower: number | null;
    bbMiddle: number | null;
    macd: number | null;
    macdSignal: number | null;
    macdHistogram: number | null;
    stochK: number | null;
    stochD: number | null;
    atr: number | null;
  };
}

export function useIndicatorCalculator(
  dataHistory: Candle[],
  config: IndicatorConfig
): IndicatorResults {
  return useMemo(() => {
    const smaPeriod = config.smaFast ?? 9;
    const emaPeriod = config.smaSlow ?? 21;
    const rsiPeriod = config.rsiPeriod ?? 7;
    const bbPeriod = config.bbPeriod ?? 20;
    const bbStdDev = config.bbStdDev ?? 2;
    const stochPeriod = config.stochPeriod ?? 14;

    const sma = config.enabled?.sma !== false ? calculateSMA(dataHistory, smaPeriod) : [];
    const ema = config.enabled?.sma !== false ? calculateEMA(dataHistory, emaPeriod) : [];
    const rsi = config.enabled?.rsi !== false ? calculateRSI(dataHistory, rsiPeriod) : [];
    const bb = config.enabled?.bb !== false ? calculateBB(dataHistory, bbPeriod, bbStdDev) : { upper: [], middle: [], lower: [] };
    const macd = config.enabled?.macd !== false ? calculateMACD(dataHistory) : [];
    const stochastic = config.enabled?.stoch !== false ? calculateStochastic(dataHistory, stochPeriod) : [];
    const atr = calculateATR(dataHistory);

    const last = (arr: { value: number | null }[]): number | null => {
  for (let i = arr.length - 1; i >= 0; i--) {
    const v = arr[i].value;
    if (v != null) return v;
  }
  return null;
};

    const getLast = <T, K extends keyof T>(arr: T[], key: K): T[K] | null => {
  for (let i = arr.length - 1; i >= 0; i--) {
    const v = arr[i][key];
    if (v != null && v !== undefined) return v;
  }
  return null;
};

    const latest = {
      sma: last(sma),
      ema: last(ema),
      rsi: last(rsi),
      bbUpper: bb.upper.length > 0 ? bb.upper[bb.upper.length - 1].value : null,
      bbLower: bb.lower.length > 0 ? bb.lower[bb.lower.length - 1].value : null,
      bbMiddle: bb.middle.length > 0 ? bb.middle[bb.middle.length - 1].value : null,
      macd: getLast(macd, 'macd'),
      macdSignal: getLast(macd, 'signal'),
      macdHistogram: getLast(macd, 'histogram'),
      stochK: getLast(stochastic, 'k'),
      stochD: getLast(stochastic, 'd'),
      atr: atr.length > 0 ? atr[atr.length - 1].atr : null,
    };

    return {
      sma,
      ema,
      rsi,
      bb,
      macd,
      stochastic,
      atr,
      latest,
    };
  }, [dataHistory, config]);
}
