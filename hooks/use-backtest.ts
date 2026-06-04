'use client';

import { useState, useCallback } from 'react';
import type { Candle, IndicatorConfig } from '@/lib/types';
import type { StrategyId } from '@/hooks/use-signal-engine';
import { analyzeCrossover } from '@/lib/strategies/fast-ema-sma-cross';
import { analyzeMultiIndicators, detectDojiSignal } from '@/lib/multi-indicators';

export interface BacktestSignal {
  time: number;
  type: 'CALL' | 'PUT';
  price: number;
  reason: string;
  strategyId: StrategyId;
  source: string;
}

export interface BacktestResult {
  success: boolean;
  strategyId: StrategyId;
  processed: number;
  signals: BacktestSignal[];
  stats: {
    signalsCount: number;
    callCount: number;
    putCount: number;
  };
  error?: string;
}

export interface UseBacktestReturn {
  result: BacktestResult | null;
  isRunning: boolean;
  runBacktest: (candles: Candle[], strategyId: StrategyId, config: IndicatorConfig) => void;
  resetBacktest: () => void;
}

const WARMUP = 30;

export function useBacktest(): UseBacktestReturn {
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const runBacktest = useCallback(
    (candles: Candle[], strategyId: StrategyId, config: IndicatorConfig) => {
      if (candles.length < 2) {
        setResult({ success: false, strategyId, processed: 0, signals: [], stats: { signalsCount: 0, callCount: 0, putCount: 0 }, error: 'Not enough candles' });
        return;
      }

      const controller = new AbortController();
      setAbortController(controller);
      setIsRunning(true);
      setResult(null);

      const signals: BacktestSignal[] = [];
      const sorted = [...candles].sort((a, b) => a.time - b.time);

      for (let i = 0; i < sorted.length; i++) {
        if (controller.signal.aborted) break;

        const slice = sorted.slice(0, i + 1);
        if (slice.length < WARMUP) continue;

        let signal: 'call' | 'put' | null = null;
        let reason = '';

        switch (strategyId) {
          case 'fast-ema-sma-cross': {
            const smaPeriod = config.smaFast ?? 9;
            const emaPeriod = config.smaSlow ?? 21;
            const res = analyzeCrossover(slice, { smaPeriod, emaPeriod });
            signal = res.signal;
            reason = res.reason;
            break;
          }
          case 'multi-momentum': {
            const res = analyzeMultiIndicators(slice, config);
            signal = res.signal;
            reason = res.reason;
            break;
          }
          case 'doji': {
            const last = slice[slice.length - 1];
            const rsiPeriod = config.rsiPeriod ?? 7;
            const rsiLow = config.rsiLow ?? 35;
            const rsiHigh = config.rsiHigh ?? 65;
            const bbPeriod = config.bbPeriod ?? 20;
            const res = detectDojiSignal(last, slice, { rsiPeriod, rsiLow, rsiHigh, useBB: true, bbPeriod });
            if (res) {
              signal = res.signal;
              reason = res.reason;
            }
            break;
          }
          case 'adaptive-confluence':
            break;
        }

        if (signal) {
          const last = slice[slice.length - 1];
          signals.push({
            time: last.time,
            type: signal.toUpperCase() as 'CALL' | 'PUT',
            price: last.close,
            reason,
            strategyId,
            source: 'frontend-backtest',
          });
        }
      }

      if (!controller.signal.aborted) {
        setResult({
          success: true,
          strategyId,
          processed: sorted.length,
          signals,
          stats: {
            signalsCount: signals.length,
            callCount: signals.filter((s) => s.type === 'CALL').length,
            putCount: signals.filter((s) => s.type === 'PUT').length,
          },
        });
        setIsRunning(false);
      }
    },
    []
  );

  const resetBacktest = useCallback(() => {
    if (abortController) {
      abortController.abort();
    }
    setResult(null);
    setIsRunning(false);
  }, [abortController]);

  return {
    result,
    isRunning,
    runBacktest,
    resetBacktest,
  };
}
