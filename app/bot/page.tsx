'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TradeTab } from '@/components/bot/trade-tab';
import { StrategyTab } from '@/components/bot/strategy-tab';
import { AnalysisTab } from '@/components/bot/analysis-tab';
import { useBotState } from '@/hooks/use-bot-state';
import Link from 'next/link';

export default function BotPage() {
  const state = useBotState();

  return (
    <main className="flex flex-col min-h-dvh bg-background">
      <header className="fixed top-0 left-0 right-0 z-50 h-14 border-b border-border bg-background/80 backdrop-blur-sm flex items-center px-4 gap-3">
        <Link href="/" className="text-sm font-medium text-muted-foreground hover:text-foreground">
          Rise/Fall
        </Link>
        <span className="text-sm font-semibold">Trading Bot</span>
        <div className="ml-auto flex items-center gap-2 text-xs">
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              state.ws.isConnected ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          <span className="text-muted-foreground">
            {state.ws.isConnected ? 'Connected' : 'Disconnected'}
          </span>
          <span className="text-muted-foreground/50">|</span>
          <span className="text-muted-foreground">API Token</span>
        </div>
      </header>

      <div className="h-14 shrink-0" />

      <div className="flex-1 w-full max-w-7xl mx-auto px-4 py-4">
        <Tabs defaultValue="trade" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="trade">TRADE</TabsTrigger>
            <TabsTrigger value="strategy">STRATEGY</TabsTrigger>
            <TabsTrigger value="analysis">ANALYSIS</TabsTrigger>
          </TabsList>

          <TabsContent value="trade">
            <TradeTab state={state} />
          </TabsContent>

          <TabsContent value="strategy">
            <StrategyTab
              strategyId={state.config.strategyId}
              onStrategyIdChange={state.config.setStrategyId}
              indicatorConfig={state.config.indicatorConfig}
              onIndicatorConfigChange={state.config.setIndicatorConfig}
            />
          </TabsContent>

          <TabsContent value="analysis">
            <AnalysisTab state={state} />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
