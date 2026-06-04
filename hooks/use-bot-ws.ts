'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { DerivWS, getPublicWsUrl } from '@deriv/core';

export interface UseBotWSOptions {
  apiToken: string;
  appId: string;
}

export interface UseBotWSReturn {
  ws: DerivWS | null;
  isConnected: boolean;
  isAuthorized: boolean;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
}

export function useBotWS(options: UseBotWSOptions): UseBotWSReturn {
  const { appId } = options;
  const [ws, setWs] = useState<DerivWS | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(() => {
    if (ws) return;

    const wsUrl = `${getPublicWsUrl()}?app_id=${appId}`;
    const instance = new DerivWS(wsUrl);

    instance.onConnectionStateChange((connected) => {
      setIsConnected(connected);
      if (connected) {
        setWs(instance);
        setIsAuthorized(true);
      } else {
        setWs(null);
        setIsAuthorized(false);
      }
    });

    instance.connect().catch((err) => {
      setError(err instanceof Error ? err.message : 'Connection failed');
    });
  }, [appId, ws]);

  const disconnect = useCallback(() => {
    if (ws) {
      ws.disconnect();
      setWs(null);
    }
    setIsConnected(false);
    setIsAuthorized(false);
    setError(null);
  }, [ws]);

  useEffect(() => {
    return () => {
      if (ws) {
        ws.disconnect();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    ws,
    isConnected,
    isAuthorized,
    error,
    connect,
    disconnect,
  };
}
