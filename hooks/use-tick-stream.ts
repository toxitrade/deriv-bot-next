'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { DerivWS } from '@deriv/core';

const MAX_TICKS = 1000;

export interface TickData {
  epoch: number;
  quote: number;
}

export interface TickStreamState {
  ticks: TickData[];
  latestTick: TickData | null;
  isSubscribed: boolean;
  error: string | null;
}

export function useTickStream(
  ws: DerivWS | null,
  symbol: string
): TickStreamState & {
  setSymbol: (s: string) => void;
} {
  const [ticks, setTicks] = useState<TickData[]>([]);
  const [latestTick, setLatestTick] = useState<TickData | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localSymbol, setLocalSymbol] = useState(symbol);
  const ticksRef = useRef<TickData[]>([]);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!ws || !localSymbol) return;

    setIsSubscribed(false);
    setError(null);

    const start = async () => {
      try {
        const { unsubscribe } = await ws.subscribe(
          { ticks: localSymbol },
          (data: Record<string, unknown>) => {
            if (data.msg_type === 'tick' && data.tick) {
              const tick = data.tick as Record<string, unknown>;
              const quoted = parseFloat(tick.quote as string);
              if (Number.isFinite(quoted)) {
                const entry: TickData = {
                  epoch: tick.epoch as number,
                  quote: quoted,
                };
                ticksRef.current = [...ticksRef.current, entry].slice(-MAX_TICKS);
                setTicks(ticksRef.current);
                setLatestTick(entry);
              }
            }
          }
        );
        unsubscribeRef.current = unsubscribe;
        setIsSubscribed(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to subscribe to ticks');
      }
    };

    start();

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      setIsSubscribed(false);
    };
  }, [ws, localSymbol]);

  return {
    ticks,
    latestTick,
    isSubscribed,
    error,
    setSymbol: setLocalSymbol,
  };
}
