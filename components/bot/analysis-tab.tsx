'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { IndicatorDisplay } from '@/components/bot/indicator-display';
import { BotChart } from '@/components/bot/bot-chart';
import type { BotState, LogEntry } from '@/hooks/use-bot-state';
import type { StrategyId } from '@/hooks/use-signal-engine';

const STRATEGIES: { id: StrategyId; name: string }[] = [
  { id: 'multi-momentum', name: 'Multi Momentum' },
  { id: 'fast-ema-sma-cross', name: 'EMA/SMA Cross Fast' },
  { id: 'adaptive-confluence', name: 'Adaptive Confluence' },
  { id: 'doji', name: 'Doji' },
];

function LogViewer({ logs }: { logs: LogEntry[] }) {
  return (
    <div className="h-32 overflow-y-auto font-mono text-xs space-y-0.5">
      {logs.length === 0 ? (
        <div className="text-muted-foreground">No logs yet</div>
      ) : (
        logs.map((log) => (
          <div key={log.id} className="flex gap-2">
            <span className="text-muted-foreground shrink-0">{log.time}</span>
            <span
              className={
                log.type === 'call'
                  ? 'text-green-500'
                  : log.type === 'put'
                    ? 'text-red-500'
                    : log.type === 'success'
                      ? 'text-green-400'
                      : log.type === 'error'
                        ? 'text-red-400'
                        : 'text-foreground'
              }
            >
              {log.message}
            </span>
          </div>
        ))
      )}
    </div>
  );
}

export interface AnalysisTabProps {
  state: BotState;
}

export function AnalysisTab({ state }: AnalysisTabProps) {
  const { ws, candles, indicators, signal, config, logs } = state;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4">
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Strategy Override</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Strategy (local override)</Label>
              <Select
                value={config.strategyId}
                onValueChange={(v) => config.setStrategyId(v as StrategyId)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select strategy" />
                </SelectTrigger>
                <SelectContent>
                  {STRATEGIES.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p>RSI Period: {config.indicatorConfig.rsiPeriod ?? 7}</p>
              <p>RSI Levels: {config.indicatorConfig.rsiLow ?? 30}/{config.indicatorConfig.rsiHigh ?? 70}</p>
              <p>Stoch Period: {config.indicatorConfig.stochPeriod ?? 14}</p>
              <p>SMA Fast/Slow: {config.indicatorConfig.smaFast ?? 9}/{config.indicatorConfig.smaSlow ?? 21}</p>
              <p>BB Period: {config.indicatorConfig.bbPeriod ?? 20} (StdDev: {config.indicatorConfig.bbStdDev ?? 2})</p>
              <p>Min Confirmations: {config.indicatorConfig.minConfirmations ?? 3}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Indicators</CardTitle>
          </CardHeader>
          <CardContent>
            <IndicatorDisplay
              indicators={indicators}
              isHistoryLoaded={candles.isHistoryLoaded}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Current Signal</CardTitle>
          </CardHeader>
          <CardContent>
            {signal.signal ? (
              <div
                className={`rounded-md p-3 font-bold text-center text-sm ${
                  signal.signal === 'call'
                    ? 'bg-green-500/10 text-green-500 border border-green-500/30'
                    : 'bg-red-500/10 text-red-500 border border-red-500/30'
                }`}
              >
                {signal.signal.toUpperCase()}
                {signal.triggerIndicator && (
                  <span className="ml-2 font-normal opacity-75">
                    ({signal.triggerIndicator})
                  </span>
                )}
                <div className="mt-1 text-xs font-normal opacity-75">
                  {signal.reason}
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-2">
                {signal.reason || 'Waiting for signal...'}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Log</CardTitle>
          </CardHeader>
          <CardContent>
            <LogViewer logs={logs} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Analysis Chart</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[500px]">
            <BotChart
              ws={ws.ws}
              isConnected={ws.isConnected}
              symbol={candles.symbol}
              chartId="bot-analysis-chart"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
