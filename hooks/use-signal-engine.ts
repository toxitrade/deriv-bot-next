'use client';

import { useMemo } from 'react';
import type { Candle, IndicatorConfig } from '@/lib/types';
import type { IndicatorResults } from '@/hooks/use-indicator-calculator';
import { analyzeCrossover } from '@/lib/strategies/fast-ema-sma-cross';
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

export function useSignalEngine(options: UseSignalEngineOptions): SignalResult {
  const { strategyId, dataHistory, indicators, config } = options;

  return useMemo(() => {
    if (dataHistory.length < 2) {
      return { signal: null, reason: 'Insufficient data' };
    }

    switch (strategyId) {
      case 'fast-ema-sma-cross': {
        const smaPeriod = config.smaFast ?? 9;
        const emaPeriod = config.smaSlow ?? 21;
        const result = analyzeCrossover(dataHistory, { smaPeriod, emaPeriod });
        return {
          signal: result.signal,
          reason: result.reason,
          triggerIndicator: result.signal ? 'CROSS' : undefined,
        };
      }

      case 'multi-momentum': {
        const result = analyzeMultiIndicators(dataHistory, config);
        return {
          signal: result.signal,
          reason: result.reason,
          triggerIndicator: result.indicators.triggerIndicator || undefined,
        };
      }

      case 'doji': {
        const lastCandle = dataHistory[dataHistory.length - 1];
        const rsiPeriod = config.rsiPeriod ?? 7;
        const rsiLow = config.rsiLow ?? 35;
        const rsiHigh = config.rsiHigh ?? 65;
        const bbPeriod = config.bbPeriod ?? 20;
        const result = detectDojiSignal(lastCandle, dataHistory, {
          rsiPeriod,
          rsiLow,
          rsiHigh,
          useBB: true,
          bbPeriod,
        });
        if (result) {
          return {
            signal: result.signal,
            reason: result.reason,
            triggerIndicator: result.indicators.triggerIndicator,
          };
        }
        return { signal: null, reason: 'No doji signal' };
      }

      case 'adaptive-confluence':
        return { signal: null, reason: 'Adaptive Confluence strategy not yet implemented' };

      default:
        return { signal: null, reason: `Unknown strategy: ${strategyId}` };
    }
  }, [strategyId, dataHistory, indicators, config]);
}
