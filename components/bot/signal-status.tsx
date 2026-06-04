'use client';

export interface SignalStatusProps {
  positionOpen: boolean;
  activeSignalType: 'call' | 'put' | null;
  positionTimeLeft: number;
  lastResult: { success: boolean; text: string } | null;
}

export function SignalStatus({
  positionOpen,
  activeSignalType,
  positionTimeLeft,
  lastResult,
}: SignalStatusProps) {
  const signalColor = activeSignalType === 'call' ? 'bg-green-500' : 'bg-red-500';
  const signalText = activeSignalType === 'call' ? 'CALL' : 'PUT';

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Signal Status
      </h4>

      {positionOpen ? (
        <div className={`rounded-md p-3 ${signalColor}/10 border ${signalColor}/30`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`font-bold text-sm ${signalColor.replace('bg-', 'text-')}`}>
              {signalText} ACTIVE
            </span>
            <span className="text-2xl font-mono font-bold">
              {positionTimeLeft}s
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 ease-linear ${signalColor}`}
              style={{ width: `${(positionTimeLeft / 60) * 100}%` }}
            />
          </div>
        </div>
      ) : lastResult ? (
        <div
          className={`rounded-md p-3 ${
            lastResult.success
              ? 'bg-green-500/10 border border-green-500/30'
              : 'bg-red-500/10 border border-red-500/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`font-bold text-sm ${
                lastResult.success ? 'text-green-500' : 'text-red-500'
              }`}
            >
              {lastResult.success ? 'WIN' : 'LOSE'}
            </span>
            <span className="text-sm text-muted-foreground">{lastResult.text}</span>
          </div>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground text-center py-2">
          Waiting for signal...
        </div>
      )}
    </div>
  );
}
