'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConnectionPanel } from '@/components/bot/connection-panel';
import { IndicatorDisplay } from '@/components/bot/indicator-display';
import { SignalStatus } from '@/components/bot/signal-status';
import { ResultsPanel } from '@/components/bot/results-panel';
import { BotChart } from '@/components/bot/bot-chart';
import { useSignalMarkers } from '@/hooks/use-signal-markers';
import type { BotState, LogEntry } from '@/hooks/use-bot-state';

export interface TradeTabProps {
  state: BotState;
}

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

export function TradeTab({ state }: TradeTabProps) {
  const { ws, candles, indicators, signal, execution, connection, config, logs } = state;
  const signalMarkers = useSignalMarkers(execution.signalHistory);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4">
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Connection</CardTitle>
          </CardHeader>
          <CardContent>
            <ConnectionPanel
              apiToken={connection.apiToken}
              onApiTokenChange={connection.setApiToken}
              appId={connection.appId}
              onAppIdChange={connection.setAppId}
              symbol={candles.symbol}
              onSymbolChange={candles.setSymbol}
              granularity={candles.granularity}
              onGranularityChange={candles.setGranularity}
              isConnected={ws.isConnected}
              isAuthorized={ws.isAuthorized}
              error={ws.error}
              onConnect={ws.connect}
              onDisconnect={ws.disconnect}
            />
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
          <CardContent className="pt-4">
            <SignalStatus
              positionOpen={execution.positionOpen}
              activeSignalType={execution.activeSignalType}
              positionTimeLeft={execution.positionTimeLeft}
              lastResult={execution.lastResult}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <ResultsPanel
              winCount={execution.winCount}
              loseCount={execution.loseCount}
              signalHistory={execution.signalHistory}
            />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">
              Chart — {candles.symbol} ({candles.granularity}s)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              <BotChart
                ws={ws.ws}
                isConnected={ws.isConnected}
                symbol={candles.symbol}
                chartId="bot-trade-chart"
                contractsArray={signalMarkers}
              />
            </div>
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
    </div>
  );
}
