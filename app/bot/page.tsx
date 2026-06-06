'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { TradeTab } from '@/components/bot/trade-tab';
import { StrategyTab } from '@/components/bot/strategy-tab';
import { AnalysisTab } from '@/components/bot/analysis-tab';
import { useBotState } from '@/hooks/use-bot-state';
import { useDerivWSContext } from '@/components/custom/deriv-ws-provider';
import Link from 'next/link';

export default function BotPage() {
  const { ws, isConnected, auth } = useDerivWSContext();
  const isAuthenticated = auth.authState === 'authenticated';
  const state = useBotState(isAuthenticated ? ws : null, isAuthenticated ? isConnected : false, auth.error);

  const handleLogin = () => { auth.login().catch((e: Error) => console.error('Login failed', e)); };
  const handleSignUp = () => { auth.signUp().catch((e: Error) => console.error('Sign up failed', e)); };

  return (
    <main className="flex flex-col bg-background max-lg:h-screen max-lg:overflow-hidden">
      <header className="fixed top-0 left-0 right-0 z-50 h-9 border-b border-border bg-background/80 backdrop-blur-sm flex items-center px-3 sm:px-4 gap-2 sm:gap-3">
        <Link href="/" className="text-xs sm:text-sm font-normal text-muted-foreground hover:text-foreground shrink-0">
          Rise/Fall
        </Link>
        <span className="text-xs sm:text-sm font-normal">Trading Bot</span>
        {!isAuthenticated ? (
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleLogin} className="h-7 text-xs">
              Log in
            </Button>
            <Button size="sm" onClick={handleSignUp} className="h-7 text-xs">
              Sign up
            </Button>
          </div>
        ) : (
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2 text-xs">
            {auth.activeAccount && (
              <span className="text-muted-foreground hidden sm:inline text-xs">
                {auth.activeAccount.account_type === 'demo' ? 'DEMO' : 'REAL'} · {auth.activeAccount.balance} {auth.activeAccount.currency}
              </span>
            )}
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                state.ws.isConnected ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <span className="text-muted-foreground hidden sm:inline">
              {state.ws.isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        )}
      </header>

      <div className="h-9 shrink-0" />

      {!isAuthenticated ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4 text-center">
          <p className="text-muted-foreground text-sm">
            Log in with your Deriv account to use the trading bot.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleLogin}>
              Log in
            </Button>
            <Button onClick={handleSignUp}>
              Sign up
            </Button>
          </div>
        </div>
      ) : (
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
      )}
    </main>
  );
}
