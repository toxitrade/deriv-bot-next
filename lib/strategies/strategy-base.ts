import type { Candle } from '@/lib/types';

export type SignalDirection = 'call' | 'put';

export interface SignalResult {
  signal: SignalDirection | null;
  reason: string;
  [key: string]: unknown;
}

export interface StrategyMetadata {
  id: string;
  name: string;
  description: string;
  supportedIndicators: string[];
  defaultParams: Record<string, number | boolean>;
}

export interface StrategyDefinition {
  metadata: StrategyMetadata;
  analyze: (candles: Candle[], params: Record<string, unknown>) => SignalResult;
}
