'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const SYMBOLS = ['R_10', 'R_25', 'R_50', 'R_75', 'R_100'];
const TIMEFRAMES = [
  { value: '60', label: '1m' },
  { value: '300', label: '5m' },
  { value: '900', label: '15m' },
  { value: '86400', label: '1D' },
];

export interface ConnectionPanelProps {
  apiToken: string;
  onApiTokenChange: (token: string) => void;
  appId: string;
  onAppIdChange: (id: string) => void;
  symbol: string;
  onSymbolChange: (symbol: string) => void;
  granularity: number;
  onGranularityChange: (granularity: number) => void;
  isConnected: boolean;
  isAuthorized: boolean;
  error: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function ConnectionPanel({
  apiToken,
  onApiTokenChange,
  appId,
  onAppIdChange,
  symbol,
  onSymbolChange,
  granularity,
  onGranularityChange,
  isConnected,
  isAuthorized,
  error,
  onConnect,
  onDisconnect,
}: ConnectionPanelProps) {
  const handleGranularityChange = (val: string) => {
    onGranularityChange(parseInt(val));
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="api-token">API Token</Label>
        <Input
          id="api-token"
          type="password"
          placeholder="Enter your API token"
          value={apiToken}
          onChange={(e) => onApiTokenChange(e.target.value)}
          disabled={isConnected}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="app-id">App ID</Label>
        <Input
          id="app-id"
          type="text"
          placeholder="1089"
          value={appId}
          onChange={(e) => onAppIdChange(e.target.value)}
          disabled={isConnected}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="symbol">Symbol</Label>
        <Select value={symbol} onValueChange={onSymbolChange} disabled={isConnected}>
          <SelectTrigger id="symbol">
            <SelectValue placeholder="Select symbol" />
          </SelectTrigger>
          <SelectContent>
            {SYMBOLS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Timeframe</Label>
        <div className="flex gap-2">
          {TIMEFRAMES.map((tf) => (
            <Button
              key={tf.value}
              variant={granularity === parseInt(tf.value) ? 'default' : 'outline'}
              size="sm"
              onClick={() => onGranularityChange(parseInt(tf.value))}
              disabled={isConnected}
              className="flex-1"
            >
              {tf.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        {!isConnected ? (
          <Button onClick={onConnect} className="flex-1">
            Connect
          </Button>
        ) : (
          <Button onClick={onDisconnect} variant="destructive" className="flex-1">
            Stop
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span
          className={`inline-block w-2 h-2 rounded-full ${
            isConnected ? (isAuthorized ? 'bg-green-500' : 'bg-yellow-500') : 'bg-red-500'
          }`}
        />
        <span className="text-muted-foreground">
          {isConnected ? (isAuthorized ? 'Connected & Authorized' : 'Connected') : 'Disconnected'}
        </span>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
