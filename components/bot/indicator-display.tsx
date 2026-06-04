'use client';

import type { IndicatorResults } from '@/hooks/use-indicator-calculator';

export interface IndicatorDisplayProps {
  indicators: IndicatorResults;
  isHistoryLoaded: boolean;
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

export function IndicatorDisplay({ indicators, isHistoryLoaded }: IndicatorDisplayProps) {
  if (!isHistoryLoaded) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        Waiting for data...
      </div>
    );
  }

  const { latest } = indicators;

  return (
    <div className="space-y-1">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        Indicator Values
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
  );
}
