'use client';

import { useState, useCallback } from 'react';

export interface ApiTokenAuth {
  apiToken: string;
  appId: string;
  setApiToken: (token: string) => void;
  setAppId: (id: string) => void;
  clear: () => void;
}

export function useApiTokenAuth(): ApiTokenAuth {
  const [apiToken, setApiToken] = useState('');
  const [appId, setAppId] = useState('1089');

  const clear = useCallback(() => {
    setApiToken('');
    setAppId('1089');
  }, []);

  return { apiToken, appId, setApiToken, setAppId, clear };
}
