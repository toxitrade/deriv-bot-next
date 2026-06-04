'use client';

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useSmartChartsApi } from '@/hooks/use-smartcharts-api';
import { useIsMobile } from '@/hooks/use-is-mobile';
import type { DerivWS } from '@deriv/core';
import type { SmartChartsSymbol, TradingTimesMap } from '@/hooks/use-smartchart-chart-data';
import type { ContractMarker } from '@/lib/chart-markers';
import { Skeleton } from '@/components/ui/skeleton';

const SmartChartWrapper = dynamic(
  () => import('@/components/custom/smart-chart').then((m) => m.SmartChartWrapper),
  { ssr: false, loading: () => <Skeleton className="h-full w-full rounded-md" /> }
);

export interface BotChartProps {
  ws: DerivWS | null;
  isConnected: boolean;
  symbol: string;
  chartId?: string;
  contractsArray?: ContractMarker[];
}

function buildTradingTimesMap(response: Record<string, unknown>): TradingTimesMap {
  const markets = (response as { trading_times?: { markets?: Array<Record<string, unknown>> } })
    ?.trading_times?.markets;
  if (!markets) return {};

  const map: TradingTimesMap = {};
  const now = new Date();
  const dateStr = now.toISOString().substring(0, 11);

  for (const market of markets) {
    const submarkets = market.submarkets as Array<Record<string, unknown>> | undefined;
    if (!submarkets) continue;
    for (const submarket of submarkets) {
      const symbolsArr = submarket.symbols as
        | Array<{ underlying_symbol?: string; symbol?: string; times: { open: string[]; close: string[] } }>
        | undefined;
      if (!symbolsArr) continue;
      for (const s of symbolsArr) {
        const sym = s.underlying_symbol || s.symbol;
        if (!sym || !s.times) continue;
        const { open, close } = s.times;
        const isOpenAllDay = open.length === 1 && open[0] === '00:00:00' && close[0] === '23:59:59';
        const isClosedAllDay = open.length === 1 && open[0] === '--' && close[0] === '--';
        let isOpen = isOpenAllDay;
        let openTime = '';
        let closeTime = '';
        if (!isClosedAllDay && open.length > 0 && close.length > 0) {
          openTime = `${dateStr}${open[0]}Z`;
          closeTime = `${dateStr}${close[0]}Z`;
          isOpen = now >= new Date(openTime) && now < new Date(closeTime);
        }
        map[sym] = { isOpen, openTime, closeTime };
      }
    }
  }
  return map;
}

export function BotChart({ ws, isConnected, symbol, chartId = 'bot-chart', contractsArray }: BotChartProps) {
  const isMobile = useIsMobile();
  const [tradingTimes, setTradingTimes] = useState<TradingTimesMap | undefined>();
  const [activeSymbols, setActiveSymbols] = useState<SmartChartsSymbol[]>([]);
  const quotesApi = useSmartChartsApi(ws);

  useEffect(() => {
    if (!ws || !isConnected) return;
    let cancelled = false;

    const fetchData = async () => {
      try {
        const [symbolsRes, timesRes] = await Promise.all([
          ws.send<{ active_symbols: Array<Record<string, unknown>> }>({
            active_symbols: 'brief',
            product_type: 'basic',
          }),
          ws.send<Record<string, unknown>>({ trading_times: 'today' }),
        ]);

        if (cancelled) return;

        const mapped: SmartChartsSymbol[] = (symbolsRes.active_symbols || []).map((s) => ({
          symbol: s.symbol as string,
          display_name: (s.display_name as string) || (s.symbol as string),
          exchange_is_open: (s.exchange_is_open as 0 | 1) || 0,
          is_trading_suspended: (s.is_trading_suspended as 0 | 1) || 0,
          market: (s.market as string) || '',
          market_display_name: (s.market_display_name as string) || '',
          pip: (s.pip_size as number) || 0.01,
          subgroup: (s.subgroup as string) || '',
          subgroup_display_name: (s.subgroup_display_name as string) || '',
          submarket: (s.submarket as string) || '',
          submarket_display_name: (s.submarket_display_name as string) || '',
          symbol_type: (s.symbol_type as string) || '',
        }));

        setActiveSymbols(mapped);
        setTradingTimes(buildTradingTimesMap(timesRes));
      } catch {
        if (!cancelled) {
          setActiveSymbols([]);
          setTradingTimes({});
        }
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [ws, isConnected]);

  const chartData = useMemo(() => {
    if (activeSymbols.length === 0 || !tradingTimes) return undefined;
    const filled: TradingTimesMap = { ...tradingTimes };
    for (const s of activeSymbols) {
      if (!filled[s.symbol]) {
        filled[s.symbol] = {
          isOpen: !!s.exchange_is_open,
          openTime: '',
          closeTime: '',
        };
      }
    }
    return { tradingTimes: filled, activeSymbols };
  }, [tradingTimes, activeSymbols]);

  if (!chartData) {
    return (
      <div className="h-full flex items-center justify-center">
        <span className="text-sm text-muted-foreground">
          {isConnected ? 'Loading chart data...' : 'Connect to view chart'}
        </span>
      </div>
    );
  }

  return (
    <SmartChartWrapper
      chartId={chartId}
      symbolKey={`${symbol}-${chartId}`}
      symbol={symbol}
      isConnectionOpened={isConnected}
      isMobile={isMobile}
      chartData={chartData}
      getQuotes={quotesApi.getQuotes}
      subscribeQuotes={quotesApi.subscribeQuotes}
      unsubscribeQuotes={quotesApi.unsubscribeQuotes}
      defaultGranularity={0}
      contractsArray={contractsArray}
    />
  );
}
