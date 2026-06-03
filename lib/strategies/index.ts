import type { Candle } from '@/lib/types';
import type { SignalResult, StrategyDefinition } from '@/lib/strategies/strategy-base';
import { analyzeCrossover } from '@/lib/strategies/fast-ema-sma-cross';

const registry = new Map<string, StrategyDefinition>();

registry.set('fast-ema-sma-cross', {
  metadata: {
    id: 'fast-ema-sma-cross',
    name: 'Fast EMA/SMA Cross',
    description: 'Short-period EMA/SMA crossover for quick signals',
    supportedIndicators: ['sma', 'ema'],
    defaultParams: { smaPeriod: 15, emaPeriod: 8 },
  },
  analyze(candles: Candle[], params: Record<string, unknown>): SignalResult {
    const result = analyzeCrossover(candles, {
      smaPeriod: (params.smaPeriod as number) || 15,
      emaPeriod: (params.emaPeriod as number) || 8,
    });
    return {
      signal: result.signal,
      reason: result.reason,
      sma: result.sma,
      ema: result.ema,
    };
  },
});

export function getStrategy(id: string): StrategyDefinition | undefined {
  return registry.get(id);
}

export function getAllStrategies(): StrategyDefinition[] {
  return Array.from(registry.values());
}

export function getStrategyIds(): string[] {
  return Array.from(registry.keys());
}
