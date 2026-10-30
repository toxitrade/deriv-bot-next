import { readFileSync } from 'node:fs';
import type { Candle } from '../../lib/types.ts';
import { runFastBacktest } from './fast-engine.ts';
import { DEFAULT_PARAMS } from './engine.ts';

const all: Candle[] = JSON.parse(readFileSync('scripts/backtest/data/R_25-60.json', 'utf8'));
const candles = all.slice(-1440);

const p: Parameters<typeof runFastBacktest>[1] = {
  ...DEFAULT_PARAMS,
  rsiBullMin: 48, rsiBullMax: 52,
  rsiBearMin: 48, rsiBearMax: 52,
  coolDownCandles: 8,
  emaFast: 12, emaSlow: 26,
  minScore: 1,
};

const { signals } = runFastBacktest(candles, p);

// Per-signal breakdown
let trendUp = 0, trendDown = 0;
let rsiBull = 0, rsiBear = 0;
let macdBull = 0, macdBear = 0;
let bbReclaim = 0, bbReject = 0;
let strongBody = 0;

for (const s of signals) {
  // We need the candle at that index to recompute
  const c = candles[s.index];
  const range = Math.max(c.high - c.low, 1e-9);
  const body = Math.abs(c.close - c.open);
  
  // EMA trend
  // (we don't store emaFast/emaSlow in the signal from the fast-engine earlier,
  //  but we can quickly check using the same logic as the engine)

  if (body / range > 0.55 && c.close > c.open) strongBody++;
}

// Let's instead print the full reason strings and count keyword occurrences
const reasonCounts: Record<string, number> = {};
for (const s of signals) {
  const keys = s.reason.split('; ');
  for (const k of keys) {
    reasonCounts[k] = (reasonCounts[k] || 0) + 1;
  }
}

console.log('=== Reason keyword counts across all 168 signals ===');
for (const [k, v] of Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(22)} ${v}`);
}

console.log('\n=== Sample reasons (first 20) ===');
for (const s of signals.slice(0, 20)) {
  console.log(`  ${s.type.toUpperCase().padEnd(4)}  ${s.reason.slice(0, 80)}`);
}

console.log(`\nTotal signals: ${signals.length}`);
console.log(`Wins: ${signals.filter((s: any) => s.outcome === 'win').length}`);
console.log(`Losses: ${signals.filter((s: any) => s.outcome === 'loss').length}`);