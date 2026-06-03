export type {
  ActiveSymbol,
  Tick,
  TicksHistoryResponse,
  ContractsForResponse,
  ContractInfo,
  DurationLimits,
  ProposalResponse,
  ProposalInfo,
  BuyResponse,
  BuyResult,
} from '@deriv/core';

export type { OpenPosition } from '@/hooks/use-open-positions';
export type { ClosedPosition } from '@/hooks/use-closed-positions';

export type Direction = 'CALL' | 'PUT';

export type PositionFilter = 'open' | 'closed' | 'all';

export type { DurationSelectUnit, DurationOption } from '@/lib/duration-utils';

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface IndicatorPoint {
  time: number;
  value: number | null;
}

export interface BBResult {
  upper: IndicatorPoint[];
  middle: IndicatorPoint[];
  lower: IndicatorPoint[];
}

export interface StochasticPoint {
  time: number;
  k: number | null;
  d: number | null;
}

export interface MACDPoint {
  time: number;
  macd: number | null;
  signal: number | null;
  histogram: number | null;
}

export interface IndicatorConfig {
  rsiPeriod?: number;
  rsiHigh?: number;
  rsiLow?: number;
  stochPeriod?: number;
  smaFast?: number;
  smaSlow?: number;
  bbPeriod?: number;
  bbStdDev?: number;
  minConfirmations?: number;
  enabled?: {
    rsi?: boolean;
    stoch?: boolean;
    macd?: boolean;
    sma?: boolean;
    bb?: boolean;
  };
}
