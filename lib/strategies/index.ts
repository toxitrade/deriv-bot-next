import type { SignalResult, StrategyDefinition } from '@/lib/strategies/strategy-base';
import { analyzeCrossover } from '@/lib/strategies/fast-ema-sma-cross';
import { analyzeMultiMomentum } from '@/lib/strategies/multi-momentum';
import { analyzeAdaptiveConfluence, macdFromCloses } from '@/lib/strategies/adaptive-confluence';
import { analyzeHighConfidence } from '@/lib/strategies/high-confidence';
import { analyzeHmaProFlow } from '@/lib/strategies/hma-pro-flow';

const registry = new Map<string, StrategyDefinition>();

registry.set('fast-ema-sma-cross', {
  metadata: {
    id: 'fast-ema-sma-cross',
    name: 'Fast EMA/SMA Cross',
    description: 'Short-period EMA/SMA crossover for quick signals',
    supportedIndicators: ['sma', 'ema'],
    defaultParams: { smaPeriod: 15, emaPeriod: 8 },
  },
  analyze(candles: import('@/lib/types').Candle[], params: Record<string, unknown>): SignalResult {
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

registry.set('multi-momentum', {
  metadata: {
    id: 'multi-momentum',
    name: 'Multi Momentum',
    description: 'Combines RSI, Stochastic, MACD, SMA, BB for high-confidence signals',
    supportedIndicators: ['rsi', 'stoch', 'macd', 'sma', 'bb'],
    defaultParams: {
      minConfirmations: 3,
      rsiPeriod: 7,
      rsiHigh: 70,
      rsiLow: 30,
      stochPeriod: 14,
      smaFast: 9,
      smaSlow: 21,
      bbPeriod: 20,
      bbStdDev: 2,
      'enabled.rsi': true,
      'enabled.stoch': true,
      'enabled.macd': true,
      'enabled.sma': true,
      'enabled.bb': true,
    },
  },
  analyze(candles: import('@/lib/types').Candle[], params: Record<string, unknown>): SignalResult {
    const result = analyzeMultiMomentum(candles, {
      minConfirmations: (params.minConfirmations as number) || 3,
      rsiPeriod: (params.rsiPeriod as number) || 7,
      rsiHigh: (params.rsiHigh as number) || 70,
      rsiLow: (params.rsiLow as number) || 30,
      stochPeriod: (params.stochPeriod as number) || 14,
      smaFast: (params.smaFast as number) || 9,
      smaSlow: (params.smaSlow as number) || 21,
      bbPeriod: (params.bbPeriod as number) || 20,
      bbStdDev: (params.bbStdDev as number) || 2,
      enabled: {
        rsi: params['enabled.rsi'] !== false,
        stoch: params['enabled.stoch'] !== false,
        macd: params['enabled.macd'] !== false,
        sma: params['enabled.sma'] !== false,
        bb: params['enabled.bb'] !== false,
      },
    });
    return {
      signal: result.signal,
      reason: result.reason,
      bullishCount: result.bullishCount,
      bearishCount: result.bearishCount,
      activeIndicators: result.activeIndicators,
    };
  },
});

registry.set('adaptive-confluence', {
  metadata: {
    id: 'adaptive-confluence',
    name: 'Adaptive Confluence',
    description:
      'Trend (EMA20/50) + RSI regime + MACD cross + BB structure + candle strength',
    supportedIndicators: ['ema', 'rsi', 'macd', 'bb'],
    defaultParams: {
      emaFast: 20,
      emaSlow: 50,
      rsiPeriod: 14,
      rsiBullMin: 45,
      rsiBullMax: 70,
      rsiBearMin: 30,
      rsiBearMax: 55,
      macdFast: 12,
      macdSlow: 26,
      macdSignal: 9,
      bbPeriod: 20,
      bbStdDev: 2,
      minScore: 3,
      coolDownCandles: 8,
    },
  },
  analyze(candles: import('@/lib/types').Candle[], params: Record<string, unknown>): SignalResult {
    const prevMacd = computePrevMacdHist(candles);
    const result = analyzeAdaptiveConfluence(candles, {
      emaFast: (params.emaFast as number) || 20,
      emaSlow: (params.emaSlow as number) || 50,
      rsiPeriod: (params.rsiPeriod as number) || 14,
      rsiBullMin: (params.rsiBullMin as number) || 45,
      rsiBullMax: (params.rsiBullMax as number) || 70,
      rsiBearMin: (params.rsiBearMin as number) || 30,
      rsiBearMax: (params.rsiBearMax as number) || 55,
      macdFast: (params.macdFast as number) || 12,
      macdSlow: (params.macdSlow as number) || 26,
      macdSignal: (params.macdSignal as number) || 9,
      bbPeriod: (params.bbPeriod as number) || 20,
      bbStdDev: (params.bbStdDev as number) || 2,
      minScore: (params.minScore as number) || 3,
      coolDownCandles: (params.coolDownCandles as number) || 8,
    }, prevMacd);
    return {
      signal: result.signal,
      reason: result.reason,
      bullishCount: result.bullishCount,
      bearishCount: result.bearishCount,
      emaFast: result.emaFast,
      emaSlow: result.emaSlow,
      rsi: result.rsi,
      macdHist: result.macdHist,
      bbPos: result.bbPos,
    };
  },
});

registry.set('high-confidence', {
  metadata: {
    id: 'high-confidence',
    name: 'High-Confidence Confluence',
    description:
      'Trend (EMA12/26) + narrow RSI regime (49-51) + MACD cross, BB dead code removed',
    supportedIndicators: ['ema', 'rsi', 'macd'],
    defaultParams: {
      emaFast: 12,
      emaSlow: 26,
      rsiPeriod: 14,
      rsiHigh: 51,
      rsiLow: 49,
      minScore: 3,
      coolDownCandles: 8,
    },
  },
  analyze(candles: import('@/lib/types').Candle[], params: Record<string, unknown>): SignalResult {
    const result = analyzeHighConfidence(candles, {
      emaFast: (params.emaFast as number) || 12,
      emaSlow: (params.emaSlow as number) || 26,
      rsiPeriod: (params.rsiPeriod as number) || 14,
      rsiHigh: (params.rsiHigh as number) || 51,
      rsiLow: (params.rsiLow as number) || 49,
      minScore: (params.minScore as number) || 3,
      coolDownCandles: (params.coolDownCandles as number) || 8,
    });
    return {
      signal: result.signal,
      reason: result.reason,
      bullishCount: result.bullishCount,
      bearishCount: result.bearishCount,
      emaFast: result.rsi !== null ? undefined : result.rsi,
      emaSlow: result.rsi !== null ? undefined : result.rsi,
      rsi: result.rsi,
      macdHist: result.macdHist,
      bbPos: null, // BB removed - dead code
    };
  },
});

function computePrevMacdHist(candles: import('@/lib/types').Candle[]): number | null {
  if (candles.length < 2) return null;
  const closes = candles.map((c) => c.close);
  const prevCloses = closes.slice(0, -1);
  const result = macdFromCloses(prevCloses, 12, 26, 9);
  return result ? result.hist : null;
}

registry.set('hma-pro-flow', {
  metadata: {
    id: 'hma-pro-flow',
    name: 'HMA Pro Flow [Mladen]',
    description:
      'Dual HMA system: Entry HMA (period 14, divisor 0.1) + Trend Filter HMA (period 300, divisor 2). ' +
      'BUY when Fast HMA rising AND Slow HMA rising. SELL when Fast HMA falling AND Slow HMA falling. ' +
      'STOP when Fast HMA direction conflicts with Slow HMA (pullback filter).',
    supportedIndicators: ['hma', 'trend-filter'],
    defaultParams: {
      entryPeriod: 14,
      entryDivisor: 0.1,
      filterPeriod: 300,
      filterDivisor: 2,
      minScore: 1,
      coolDownCandles: 0,
    },
  },
  analyze(candles: import('@/lib/types').Candle[], params: Record<string, unknown>): SignalResult {
    const result = analyzeHmaProFlow(candles, {
      entryPeriod: (params.entryPeriod as number) || 14,
      entryDivisor: (params.entryDivisor as number) || 0.1,
      filterPeriod: (params.filterPeriod as number) || 300,
      filterDivisor: (params.filterDivisor as number) || 2,
      minScore: (params.minScore as number) || 1,
      coolDownCandles: (params.coolDownCandles as number) || 0,
    });
    return {
      signal: result.signal,
      reason: result.reason,
      fastHma: result.fastHma,
      slowHma: result.slowHma,
      fastRising: result.fastRising,
      slowRising: result.slowRising,
      aligned: result.aligned,
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