'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { DerivWS, getApiBaseUrl } from '@deriv/core';

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

async function fetchOtpUrl(apiToken: string, appId: string): Promise<string> {
  const base = getApiBaseUrl();

  const accountsRes = await fetch(`${base}/accounts`, {
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Deriv-App-ID': appId,
    },
  });
  if (!accountsRes.ok) {
    throw new Error(`Failed to fetch accounts: ${accountsRes.status}`);
  }
  const accountsData = await accountsRes.json();
  const accounts = accountsData?.data?.accounts ?? [];
  if (accounts.length === 0) {
    throw new Error('No trading accounts found');
  }
  const accountId = accounts[0].id;

  const otpRes = await fetch(`${base}/accounts/${accountId}/otp`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Deriv-App-ID': appId,
    },
  });
  if (!otpRes.ok) {
    throw new Error(`Failed to get OTP: ${otpRes.status}`);
  }
  const otpData = await otpRes.json();
  const wsUrl = otpData?.data?.url;
  if (!wsUrl) {
    throw new Error('OTP response missing WebSocket URL');
  }
  return wsUrl as string;
}

export function useBotWS(options: UseBotWSOptions): UseBotWSReturn {
  const { apiToken, appId } = options;
  const [ws, setWs] = useState<DerivWS | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connectingRef = useRef(false);

  const connect = useCallback(async () => {
    if (ws || connectingRef.current) return;
    connectingRef.current = true;
    setError(null);

    try {
      const otpUrl = await fetchOtpUrl(apiToken, appId);
      const instance = new DerivWS(otpUrl);

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

      await instance.connect();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      connectingRef.current = false;
    }
  }, [apiToken, appId, ws]);

  const disconnect = useCallback(() => {
    connectingRef.current = false;
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
