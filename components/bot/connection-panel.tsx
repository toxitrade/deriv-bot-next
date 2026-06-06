'use client';

import { Button } from '@/components/ui/button';
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
  symbol: string;
  onSymbolChange: (symbol: string) => void;
  granularity: number;
  onGranularityChange: (granularity: number) => void;
  isConnected: boolean;
  error: string | null;
}

export function ConnectionPanel({
  symbol,
  onSymbolChange,
  granularity,
  onGranularityChange,
  isConnected,
  error,
}: ConnectionPanelProps) {
  const handleGranularityChange = (val: string) => {
    onGranularityChange(parseInt(val));
  };

  return (
    <div className="space-y-4">
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

      <div className="flex items-center gap-2 text-sm">
        <span
          className={`inline-block w-2 h-2 rounded-full ${
            isConnected ? 'bg-green-500' : 'bg-red-500'
          }`}
        />
        <span className="text-muted-foreground">
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
