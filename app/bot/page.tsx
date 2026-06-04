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
    <main className="flex flex-col bg-background max-lg:h-dvh max-lg:overflow-hidden">
      <header className="fixed top-0 left-0 right-0 z-50 h-14 border-b border-border bg-background/80 backdrop-blur-sm flex items-center px-3 sm:px-4 gap-2 sm:gap-3">
        <Link href="/" className="text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground shrink-0">
          Rise/Fall
        </Link>
        <span className="text-xs sm:text-sm font-semibold">Trading Bot</span>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2 text-xs">
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              state.ws.isConnected ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          <span className="text-muted-foreground hidden sm:inline">
            {state.ws.isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </header>

      <div className="h-14 shrink-0" />

      <div className="flex-1 max-lg:flex max-lg:flex-col max-lg:min-h-0 max-lg:overflow-hidden w-full max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
        <Tabs defaultValue="trade" className="w-full max-lg:flex max-lg:flex-col max-lg:flex-1 max-lg:min-h-0">
          <TabsList className="mb-3 sm:mb-4">
            <TabsTrigger value="trade" className="text-xs sm:text-sm">TRADE</TabsTrigger>
            <TabsTrigger value="strategy" className="text-xs sm:text-sm">STRATEGY</TabsTrigger>
            <TabsTrigger value="analysis" className="text-xs sm:text-sm">ANALYSIS</TabsTrigger>
          </TabsList>

          <TabsContent value="trade" className="max-lg:flex-1 max-lg:min-h-0 max-lg:overflow-y-auto max-lg:overscroll-contain">
            <TradeTab state={state} />
          </TabsContent>

          <TabsContent value="strategy" className="max-lg:flex-1 max-lg:min-h-0 max-lg:overflow-y-auto max-lg:overscroll-contain">
            <StrategyTab
              strategyId={state.config.strategyId}
              onStrategyIdChange={state.config.setStrategyId}
              indicatorConfig={state.config.indicatorConfig}
              onIndicatorConfigChange={state.config.setIndicatorConfig}
            />
          </TabsContent>

          <TabsContent value="analysis" className="max-lg:flex-1 max-lg:min-h-0 max-lg:overflow-y-auto max-lg:overscroll-contain">
            <AnalysisTab state={state} />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
