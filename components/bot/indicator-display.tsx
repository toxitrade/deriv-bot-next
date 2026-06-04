'use client';

import type { IndicatorResults } from '@/hooks/use-indicator-calculator';
import type { IndicatorConfig } from '@/lib/types';
import type { StrategyId } from '@/hooks/use-signal-engine';

export interface IndicatorDisplayProps {
  indicators: IndicatorResults;
  isHistoryLoaded: boolean;
  strategyId: StrategyId;
  indicatorConfig: IndicatorConfig;
}

interface IndicatorRowProps {
  label: string;
  value: string | null;
  signal?: 'call' | 'put' | null;
}

function IndicatorRow({ label, value, signal }: IndicatorRowProps) {
  const colorClass =
    signal === 'call'
      ? 'text-green-500'
      : signal === 'put'
        ? 'text-red-500'
        : 'text-muted-foreground';

  return (
    <div className="flex justify-between items-center py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono font-medium ${colorClass}`}>
        {value ?? '--'}
      </span>
    </div>
  );
}

const STRATEGY_NAMES: Record<StrategyId, string> = {
  'multi-momentum': 'Multi Momentum',
  'fast-ema-sma-cross': 'EMA/SMA Cross Fast',
  'adaptive-confluence': 'Adaptive Confluence',
  doji: 'Doji',
};

interface StrategyParam {
  label: string;
  value: string;
}

function getStrategyParams(strategyId: StrategyId, config: IndicatorConfig): StrategyParam[] {
  switch (strategyId) {
    case 'multi-momentum':
      return [
        { label: 'Min Confirmations', value: String(config.minConfirmations ?? 3) },
        { label: 'RSI Period', value: String(config.rsiPeriod ?? 7) },
        { label: 'RSI Range', value: `${config.rsiLow ?? 30}–${config.rsiHigh ?? 70}` },
        { label: 'Stoch Period', value: String(config.stochPeriod ?? 14) },
        { label: 'SMA Fast/Slow', value: `${config.smaFast ?? 9}/${config.smaSlow ?? 21}` },
        { label: 'BB Period/Std', value: `${config.bbPeriod ?? 20}/${config.bbStdDev ?? 2}` },
      ];
    case 'fast-ema-sma-cross':
      return [
        { label: 'SMA Period', value: String(config.smaFast ?? 9) },
        { label: 'EMA Period', value: String(config.smaSlow ?? 21) },
      ];
    case 'adaptive-confluence':
      return [
        { label: 'EMA Fast/Slow', value: '20/50' },
        { label: 'RSI Period', value: String(config.rsiPeriod ?? 14) },
        { label: 'BB Period/Std', value: `${config.bbPeriod ?? 20}/${config.bbStdDev ?? 2}` },
        { label: 'Min Score', value: String(config.minConfirmations ?? 3) },
      ];
    case 'doji':
      return [
        { label: 'RSI Period', value: String(config.rsiPeriod ?? 7) },
        { label: 'RSI Range', value: `${config.rsiLow ?? 30}–${config.rsiHigh ?? 70}` },
        { label: 'BB Period', value: String(config.bbPeriod ?? 20) },
      ];
  }
}

export function IndicatorDisplay({ indicators, isHistoryLoaded, strategyId, indicatorConfig }: IndicatorDisplayProps) {
  if (!isHistoryLoaded) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        Waiting for data...
      </div>
    );
  }

  const { latest } = indicators;
  const params = getStrategyParams(strategyId, indicatorConfig);

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
          Strategy
        </h4>
        <p className="text-sm font-medium">{STRATEGY_NAMES[strategyId]}</p>
      </div>

      {params.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            Parameters
          </h4>
          <div className="space-y-0.5">
            {params.map((p) => (
              <div key={p.label} className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">{p.label}</span>
                <span className="font-mono text-foreground">{p.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
          Values
        </h4>
        <IndicatorRow label="SMA" value={latest.sma?.toFixed(2) ?? null} />
        <IndicatorRow label="EMA" value={latest.ema?.toFixed(2) ?? null} />
        <IndicatorRow
          label="RSI"
          value={latest.rsi?.toFixed(1) ?? null}
          signal={
            latest.rsi !== null
              ? latest.rsi < 30
                ? 'call'
                : latest.rsi > 70
                  ? 'put'
                  : null
              : null
          }
        />
        <IndicatorRow
          label="BB Range"
          value={
            latest.bbLower !== null && latest.bbUpper !== null
              ? `${latest.bbLower.toFixed(1)}–${latest.bbUpper.toFixed(1)}`
              : null
          }
        />
        <IndicatorRow label="Stoch" value={latest.stochK?.toFixed(1) ?? null} />
        <IndicatorRow label="MACD" value={latest.macd?.toFixed(2) ?? null} />
        <IndicatorRow label="ATR" value={latest.atr?.toFixed(2) ?? null} />
      </div>
    </div>
  );
}
