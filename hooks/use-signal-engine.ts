'use client';

import { useMemo } from 'react';
import type { Candle, IndicatorConfig } from '@/lib/types';
import type { IndicatorResults } from '@/hooks/use-indicator-calculator';
import { getStrategy } from '@/lib/strategies';
import { analyzeMultiIndicators, detectDojiSignal } from '@/lib/multi-indicators';

export type StrategyId = 'multi-momentum' | 'fast-ema-sma-cross' | 'adaptive-confluence' | 'doji';

export interface SignalResult {
  signal: 'call' | 'put' | null;
  reason: string;
  triggerIndicator?: string;
}

export interface UseSignalEngineOptions {
  strategyId: StrategyId;
  dataHistory: Candle[];
  indicators: IndicatorResults;
  config: IndicatorConfig;
}

function buildParams(strategyId: StrategyId, config: IndicatorConfig): Record<string, unknown> {
  switch (strategyId) {
    case 'fast-ema-sma-cross':
      return {
        smaPeriod: config.smaFast ?? 9,
        emaPeriod: config.smaSlow ?? 21,
      };
    case 'multi-momentum': {
      const e = config.enabled ?? { rsi: true, stoch: true, macd: true, sma: true, bb: true };
      return {
        minConfirmations: config.minConfirmations ?? 3,
        rsiPeriod: config.rsiPeriod ?? 7,
        rsiHigh: config.rsiHigh ?? 70,
        rsiLow: config.rsiLow ?? 30,
        stochPeriod: config.stochPeriod ?? 14,
        smaFast: config.smaFast ?? 9,
        smaSlow: config.smaSlow ?? 21,
        bbPeriod: config.bbPeriod ?? 20,
        bbStdDev: config.bbStdDev ?? 2,
        'enabled.rsi': e.rsi,
        'enabled.stoch': e.stoch,
        'enabled.macd': e.macd,
        'enabled.sma': e.sma,
        'enabled.bb': e.bb,
      };
    }
    case 'adaptive-confluence':
      return {
        emaFast: 20,
        emaSlow: 50,
        rsiPeriod: config.rsiPeriod ?? 14,
        rsiBullMin: 45,
        rsiBullMax: 70,
        rsiBearMin: 30,
        rsiBearMax: 55,
        bbPeriod: config.bbPeriod ?? 20,
        bbStdDev: config.bbStdDev ?? 2,
        minScore: config.minConfirmations ?? 3,
      };
    default:
      return {};
  }
}

export function useSignalEngine(options: UseSignalEngineOptions): SignalResult {
  const { strategyId, dataHistory, config } = options;

  return useMemo(() => {
    if (dataHistory.length < 2) {
      return { signal: null, reason: 'Insufficient data' };
    }

    if (strategyId === 'doji') {
      const lastCandle = dataHistory[dataHistory.length - 1];
      const rsiPeriod = config.rsiPeriod ?? 7;
      const rsiLow = config.rsiLow ?? 35;
      const rsiHigh = config.rsiHigh ?? 65;
      const bbPeriod = config.bbPeriod ?? 20;
      const result = detectDojiSignal(lastCandle, dataHistory, {
        rsiPeriod, rsiLow, rsiHigh, useBB: true, bbPeriod,
      });
      if (result) {
        return { signal: result.signal, reason: result.reason, triggerIndicator: result.indicators.triggerIndicator };
      }
      return { signal: null, reason: 'No doji signal' };
    }

    if (strategyId === 'multi-momentum') {
      const result = analyzeMultiIndicators(dataHistory, config);
      return {
        signal: result.signal,
        reason: result.reason,
        triggerIndicator: result.indicators.triggerIndicator || undefined,
      };
    }

    const strategy = getStrategy(strategyId);
    if (!strategy) {
      return { signal: null, reason: `Unknown strategy: ${strategyId}` };
    }

    const params = buildParams(strategyId, config);
    const result = strategy.analyze(dataHistory, params);
    return { signal: result.signal, reason: result.reason, triggerIndicator: result.triggerIndicator as string | undefined };
  }, [strategyId, dataHistory, config]);
}
