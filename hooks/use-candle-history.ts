'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { DerivWS } from '@deriv/core';
import type { Candle } from '@/lib/types';

const MAX_CANDLES = 5000;

interface CandleRaw {
  epoch: number;
  open: string;
  high: string;
  low: string;
  close: string;
}

function parseCandle(raw: CandleRaw): Candle {
  return {
    time: raw.epoch,
    open: parseFloat(raw.open),
    high: parseFloat(raw.high),
    low: parseFloat(raw.low),
    close: parseFloat(raw.close),
  };
}

export interface CandleHistoryState {
  dataHistory: Candle[];
  isHistoryLoaded: boolean;
  latestCandle: Candle | null;
  error: string | null;
}

export function useCandleHistory(
  ws: DerivWS | null,
  symbol: string,
  granularity: number
): CandleHistoryState & {
  setGranularity: (g: number) => void;
  setSymbol: (s: string) => void;
} {
  const [dataHistory, setDataHistory] = useState<Candle[]>([]);
  const [isHistoryLoaded, setIsHistoryLoaded] = useState(false);
  const [latestCandle, setLatestCandle] = useState<Candle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localGranularity, setLocalGranularity] = useState(granularity);
  const [localSymbol, setLocalSymbol] = useState(symbol);
  const historyRef = useRef<Candle[]>([]);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const requestHistory = useCallback(async (wsInstance: DerivWS, sym: string, gran: number) => {
    try {
      const response = await wsInstance.send<{ candles: CandleRaw[] }>({
        ticks_history: sym,
        end: 'latest',
        start: 1,
        style: 'candles',
        granularity: gran,
        adjust_start_time: 1,
      });

      if (response.candles && Array.isArray(response.candles)) {
        const parsed = response.candles.map(parseCandle);
        historyRef.current = parsed.slice(-MAX_CANDLES);
        setDataHistory(historyRef.current);
        setLatestCandle(historyRef.current[historyRef.current.length - 1] ?? null);
        setIsHistoryLoaded(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch candle history');
    }
  }, []);

  const subscribeOHLC = useCallback(async (wsInstance: DerivWS, sym: string, gran: number) => {
    try {
      const { unsubscribe } = await wsInstance.subscribe(
        { ticks_history: sym, granularity: gran, style: 'candles' },
        (data: Record<string, unknown>) => {
          if (data.msg_type === 'ohlc' && data.ohlc) {
            const ohlc = data.ohlc as Record<string, unknown>;
            const newCandle: Candle = {
              time: ohlc.epoch as number,
              open: parseFloat(ohlc.open as string),
              high: parseFloat(ohlc.high as string),
              low: parseFloat(ohlc.low as string),
              close: parseFloat(ohlc.close as string),
            };

            historyRef.current = [...historyRef.current, newCandle].slice(-MAX_CANDLES);
            setDataHistory(historyRef.current);
            setLatestCandle(newCandle);
          }
        }
      );
      unsubscribeRef.current = unsubscribe;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to subscribe to OHLC');
    }
  }, []);

  useEffect(() => {
    if (!ws || !localSymbol) return;

    setIsHistoryLoaded(false);
    setError(null);

    requestHistory(ws, localSymbol, localGranularity).then(() => {
      subscribeOHLC(ws, localSymbol, localGranularity);
    });

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [ws, localSymbol, localGranularity, requestHistory, subscribeOHLC]);

  return {
    dataHistory,
    isHistoryLoaded,
    latestCandle,
    error,
    setGranularity: setLocalGranularity,
    setSymbol: setLocalSymbol,
  };
}
