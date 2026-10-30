import { readFileSync } from 'node:fs';
import type { Candle } from '../../lib/types.ts';
import { analyzeAdaptiveConfluence } from '../../lib/strategies/adaptive-confluence.ts';
import { DEFAULT_PARAMS } from './engine.ts';

const all: Candle[] = JSON.parse(readFileSync('scripts/backtest/data/R_25-60.json', 'utf8'));

for (const n of [500, 1000, 2000, 4000]) {
  const slice = all.slice(-n);
  const t0 = Date.now();
  analyzeAdaptiveConfluence(slice, DEFAULT_PARAMS, 0.5);
  console.log(`  analyzeAdaptiveConfluence on ${n} candles: ${Date.now() - t0}ms`);
}

console.log('\nThe live bot calls this on every tick over the FULL history');
console.log('(up to MAX_CANDLES=5000 in use-candle-history.ts).');
