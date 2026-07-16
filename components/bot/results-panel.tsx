'use client';

import type { SignalEntry } from '@/hooks/use-signal-execution';

export interface ResultsPanelProps {
  winCount: number;
  loseCount: number;
  signalHistory: SignalEntry[];
}

export function ResultsPanel({ winCount, loseCount, signalHistory }: ResultsPanelProps) {
  const total = winCount + loseCount;
  const winRate = total > 0 ? ((winCount / total) * 100).toFixed(1) : '--';

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Results
      </h4>

      <div className="grid grid-cols-3 gap-2 max-sm:gap-1.5 sm:gap-2 text-center">
        <div className="rounded-md bg-green-500/10 p-2">
          <div className="text-lg font-bold text-green-500">{winCount}</div>
          <div className="text-xs text-muted-foreground">WIN</div>
        </div>
        <div className="rounded-md bg-red-500/10 p-2">
          <div className="text-lg font-bold text-red-500">{loseCount}</div>
          <div className="text-xs text-muted-foreground">LOSE</div>
        </div>
        <div className="rounded-md bg-muted p-2">
          <div className="text-lg font-bold">{winRate}%</div>
          <div className="text-xs text-muted-foreground">RATE</div>
        </div>
      </div>

      {signalHistory.length > 0 && (
        <div className="space-y-1 max-h-40 overflow-y-auto">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recent Signals
          </div>
          {signalHistory.map((s) => (
            <div
              key={s.id}
              className={`flex justify-between items-center py-1 px-2 rounded text-xs ${
                s.verified
                  ? s.success
                    ? 'bg-green-500/5'
                    : 'bg-red-500/5'
                  : 'bg-muted/50'
              }`}
            >
              <span
                className={`font-mono font-medium ${
                  s.type === 'call' ? 'text-green-500' : 'text-red-500'
                }`}
              >
                {s.type.toUpperCase()}
              </span>
              <span className="text-muted-foreground">
                {s.verified
                  ? s.success
                    ? 'WIN'
                    : 'LOSE'
                  : 'Pending...'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
