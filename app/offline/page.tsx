'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TradeControls } from '@/components/trade-controls';
import type { ActiveSymbol, ProposalInfo, BuyResult } from '@deriv/core';
import type { Direction, DurationOption, DurationSelectUnit } from '@/lib/types';

const MOCK_SYMBOLS: ActiveSymbol[] = [
  {
    exchange_is_open: 1,
    is_trading_suspended: 0,
    market: 'synthetic_index',
    market_display_name: 'Synthetic Indices',
    pip_size: 3,
    subgroup: 'synthetics',
    subgroup_display_name: 'Synthetics',
    submarket: 'random_index',
    submarket_display_name: 'Continuous Indices',
    trade_count: 0,
    underlying_symbol: 'R_25',
    underlying_symbol_name: 'Jump 25 Index',
    underlying_symbol_type: 'synthetic_index',
  },
  {
    exchange_is_open: 1,
    is_trading_suspended: 0,
    market: 'synthetic_index',
    market_display_name: 'Synthetic Indices',
    pip_size: 3,
    subgroup: 'synthetics',
    subgroup_display_name: 'Synthetics',
    submarket: 'random_index',
    submarket_display_name: 'Continuous Indices',
    trade_count: 0,
    underlying_symbol: 'R_50',
    underlying_symbol_name: 'Volatility 50 Index',
    underlying_symbol_type: 'synthetic_index',
  },
  {
    exchange_is_open: 1,
    is_trading_suspended: 0,
    market: 'synthetic_index',
    market_display_name: 'Synthetic Indices',
    pip_size: 3,
    subgroup: 'synthetics',
    subgroup_display_name: 'Synthetics',
    submarket: 'random_index',
    submarket_display_name: 'Continuous Indices',
    trade_count: 0,
    underlying_symbol: 'R_100',
    underlying_symbol_name: 'Volatility 100 Index',
    underlying_symbol_type: 'synthetic_index',
  },
];

const DURATION_OPTIONS: DurationOption[] = [
  { unit: 's', label: 'Seconds', min: 5, max: 59 },
  { unit: 'm', label: 'Minutes', min: 1, max: 1440 },
  { unit: 'h', label: 'Hours', min: 1, max: 24 },
  { unit: 'd', label: 'Days', min: 1, max: 1 },
];

function formatDuration(duration: number, unit: DurationSelectUnit): string {
  if (unit === 's') return `${duration} seconds`;
  if (unit === 'm') return `${duration} minutes`;
  if (unit === 'h') return `${duration} hours`;
  if (unit === 'd') return `${duration} day`;
  return `${duration} ${unit}`;
}

export default function OfflinePreviewPage() {
  const [symbol, setSymbol] = useState('R_25');
  const [direction, setDirection] = useState<Direction>('CALL');
  const [allowEquals, setAllowEquals] = useState(false);
  const [stake, setStake] = useState('10');
  const [duration, setDuration] = useState(5);
  const [durationUnit, setDurationUnit] = useState<DurationSelectUnit>('s');
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [endTime, setEndTime] = useState('');
  const [buyResult, setBuyResult] = useState<BuyResult | null>(null);

  const activeSymbol = useMemo(
    () => MOCK_SYMBOLS.find((item) => item.underlying_symbol === symbol) ?? MOCK_SYMBOLS[0],
    [symbol]
  );

  const stakeNumber = Number.parseFloat(stake) || 0;
  const payout = Number((stakeNumber * 1.95).toFixed(2));

  const proposal: ProposalInfo = useMemo(() => ({
    id: 'offline-proposal',
    askPrice: stakeNumber,
    payout,
    longcode: `${direction === 'CALL' ? 'Rise' : 'Fall'} mock contract for ${activeSymbol.underlying_symbol_name}, ${formatDuration(duration, durationUnit)}.`,
    minStake: 0.5,
    maxPayout: 9750,
  }), [activeSymbol.underlying_symbol_name, direction, duration, durationUnit, payout, stakeNumber]);

  const buyContract = () => {
    setBuyResult({
      contractId: Date.now(),
      buyPrice: stakeNumber,
      payout,
      longcode: proposal.longcode,
      balanceAfter: 10000 - stakeNumber,
    });
  };

  return (
    <main className="min-h-screen bg-background px-3 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Offline preview</p>
            <h1 className="text-xl font-bold">Deriv Rise/Fall UI</h1>
          </div>
          <Badge variant="secondary">No WebSocket connection</Badge>
        </header>

        <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
          <Card className="min-h-[420px] overflow-hidden">
            <CardHeader className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Mock chart</CardTitle>
                  <p className="text-sm text-muted-foreground">{activeSymbol.underlying_symbol_name} · {symbol}</p>
                </div>
                <div className="min-w-48 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Symbol</Label>
                  <Select value={symbol} onValueChange={setSymbol}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MOCK_SYMBOLS.map((item) => (
                        <SelectItem key={item.underlying_symbol} value={item.underlying_symbol}>
                          {item.underlying_symbol} · {item.underlying_symbol_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative h-[360px] rounded-xl border bg-gradient-to-br from-muted/80 via-background to-muted/40 p-4">
                <div className="absolute left-4 top-4 rounded-lg border bg-background/80 px-3 py-2 text-sm shadow-sm">
                  Live price mock: <span className="font-semibold">1432.517</span>
                </div>
                <svg viewBox="0 0 900 300" className="h-full w-full text-primary" role="img" aria-label="Mock price chart">
                  <defs>
                    <linearGradient id="offlineChartFill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
                      <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d="M0 235 C75 180 110 210 170 155 C235 95 290 130 350 92 C420 46 470 112 535 78 C610 38 665 95 720 62 C795 20 835 58 900 34 L900 300 L0 300 Z" fill="url(#offlineChartFill)" />
                  <path d="M0 235 C75 180 110 210 170 155 C235 95 290 130 350 92 C420 46 470 112 535 78 C610 38 665 95 720 62 C795 20 835 58 900 34" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
                </svg>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Trading controls</CardTitle>
              <p className="text-sm text-muted-foreground">Mock proposal: payout = stake × 1.95</p>
            </CardHeader>
            <CardContent>
              <TradeControls
                direction={direction}
                onDirectionChange={setDirection}
                allowEquals={allowEquals}
                onAllowEqualsChange={setAllowEquals}
                isConnected={true}
                stake={stake}
                onStakeChange={setStake}
                duration={duration}
                onDurationChange={setDuration}
                durationOptions={DURATION_OPTIONS}
                durationUnit={durationUnit}
                onDurationUnitChange={setDurationUnit}
                endDate={endDate}
                onEndDateChange={setEndDate}
                endTime={endTime}
                onEndTimeChange={setEndTime}
                ws={null}
                activeSymbol={activeSymbol}
                proposal={proposal}
                onBuy={buyContract}
                isBuying={false}
                buyResult={buyResult}
                buyError={null}
                onClearBuyResult={() => setBuyResult(null)}
                isAuthenticated={false}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
