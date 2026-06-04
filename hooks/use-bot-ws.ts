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
  const { apiToken, appId } = options;
  const [ws, setWs] = useState<DerivWS | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const authorizedRef = useRef(false);

  const doAuthorize = useCallback(async (instance: DerivWS, token: string) => {
    try {
      const res = await instance.send<{ msg_type: string; authorize?: Record<string, unknown>; error?: { message: string } }>(
        { authorize: token }
      );
      if (res.error) {
        setError(res.error.message);
        setIsAuthorized(false);
        authorizedRef.current = false;
      } else if (res.msg_type === 'authorize') {
        setIsAuthorized(true);
        authorizedRef.current = true;
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authorization failed');
      setIsAuthorized(false);
      authorizedRef.current = false;
    }
  }, []);

  const connect = useCallback(() => {
    if (ws) return;

    const wsUrl = `${getPublicWsUrl()}?app_id=${appId}`;
    const instance = new DerivWS(wsUrl);

    instance.onConnectionStateChange((connected) => {
      setIsConnected(connected);
      if (connected) {
        setWs(instance);
        if (apiToken && !authorizedRef.current) {
          doAuthorize(instance, apiToken);
        }
      } else {
        setWs(null);
        setIsAuthorized(false);
        authorizedRef.current = false;
      }
    });

    instance.connect().catch((err) => {
      setError(err instanceof Error ? err.message : 'Connection failed');
    });
  }, [appId, apiToken, doAuthorize, ws]);

  const disconnect = useCallback(() => {
    if (ws) {
      ws.disconnect();
      setWs(null);
    }
    setIsConnected(false);
    setIsAuthorized(false);
    authorizedRef.current = false;
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
