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
  minScore: 3,
};

const { signals } = runFastBacktest(candles, p);

// Count reason keywords
const reasonCounts: Record<string, number> = {};
for (const s of signals) {
  const keys = s.reason.split('; ');
  for (const k of keys) {
    reasonCounts[k] = (reasonCounts[k] || 0) + 1;
  }
}

console.log('=== Reason keyword counts across all 33 signals ===');
for (const [k, v] of Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(22)} ${v}`);
}

// Now recompute each signal's candle to evaluate outcome
let wins = 0, losses = 0;
for (const s of signals) {
  const c = candles[s.index];
  const next = candles[s.index + 1];
  if (!next) { s.outcome = 'unresolved'; continue; }
  s.exitPrice = next.close;
  s.deltaPct = ((next.close - s.price) / s.price) * 100;
  s.outcome = s.type === 'call' ? (next.close > s.price ? 'win' : 'loss') : next.close < s.price ? 'win' : 'loss';
  if (s.outcome === 'win') wins++;
  else losses++;
}

console.log(`\nOutcome: wins=${wins} losses=${losses} unresolved=${signals.length - wins - losses}`);
  const wr = (wins / signals.length) * 100;
  console.log(`Win rate: ${wr.toFixed(1)}%`);

// Show sample reasons with outcomes
console.log('\n=== Sample signals with outcomes ===');
for (const s of signals.slice(0, 15)) {
  console.log(`  ${s.type.toUpperCase().padEnd(4)}  ${s.reason.padEnd(50)}  outcome=${s.outcome}  delta=${(s.deltaPct ?? 0).toFixed(2)}%  price=${s.price.toFixed(2)}  exit=${s.exitPrice?.toFixed(2)}`);
}