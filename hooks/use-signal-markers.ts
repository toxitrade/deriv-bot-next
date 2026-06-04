'use client';

import { useMemo } from 'react';
import type { ContractMarker, MarkerPoint } from '@/lib/chart-markers';
import type { SignalEntry } from '@/hooks/use-signal-execution';

export function useSignalMarkers(signalHistory: SignalEntry[]): ContractMarker[] {
  return useMemo(() => {
    return signalHistory.map((entry, _i, _arr) => {
      const direction = entry.type === 'call' ? 'up' : 'down';
      const markers: MarkerPoint[] = [];

      markers.push({
        epoch: entry.time,
        quote: entry.entryPrice,
        type: 'entrySpot',
        direction,
      });

      if (entry.verified && entry.exitPrice !== undefined) {
        markers.push({
          epoch: entry.time + 60,
          quote: entry.exitPrice,
          type: 'exitSpot',
          direction,
          text: entry.success ? '✓' : '✗',
          textType: entry.success ? 'win' : 'lose',
          color: entry.success ? '#22c55e' : '#ef4444',
        });
      }

      return {
        type: 'NonTickContract' as const,
        markers,
        direction,
        props: {
          isProfit: entry.success ?? true,
          isRunning: !entry.verified,
          contractMarkerLeftPadding: 60,
          markerLabel: entry.type.toUpperCase(),
        },
        profitAndLossText: entry.resultText ?? null,
        currentEpoch: Math.floor(Date.now() / 1000),
      };
    });
  }, [signalHistory]);
}
