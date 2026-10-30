import { readFileSync } from 'node:fs';
import type { Candle } from '../../lib/types.ts';
import { runAdaptiveConfluenceBacktest, DEFAULT_PARAMS, type AdaptiveParams } from './engine.ts';
import { runFastBacktest } from './fast-engine.ts';

const all: Candle[] = JSON.parse(readFileSync('scripts/backtest/data/R_25-60.json', 'utf8'));
const candles = all.slice(-1440);

const variants: Partial<AdaptiveParams>[] = [
  {},
  { minScore: 2 },
  { minScore: 4 },
  { coolDownCandles: 0 },
  { coolDownCandles: 20 },
  { emaFast: 10, emaSlow: 30 },
  { rsiBullMin: 50, rsiBullMax: 65, rsiBearMin: 35, rsiBearMax: 50 },
  { macdFast: 8, macdSlow: 21, macdSignal: 5 },
  { bbPeriod: 30, bbStdDev: 2.5 },
];

let allPass = true;
for (const v of variants) {
  const params: AdaptiveParams = { ...DEFAULT_PARAMS, ...v };
  const ref = runAdaptiveConfluenceBacktest(candles, params);
  const fast = runFastBacktest(candles, params);

  const refSig = ref.signals.map((s) => `${s.index}:${s.type}:${s.price}`).join('|');
  const fastSig = fast.signals.map((s) => `${s.index}:${s.type}:${s.price}`).join('|');
  const match = refSig === fastSig;
  if (!match) allPass = false;

  console.log(`${match ? 'PASS' : 'FAIL'}  ${JSON.stringify(v).padEnd(62)} ref=${ref.signals.length} fast=${fast.signals.length}`);
  if (!match) {
    const refArr = ref.signals.map((s) => `${s.index}:${s.type}`);
    const fastArr = fast.signals.map((s) => `${s.index}:${s.type}`);
    const firstDiff = refArr.findIndex((x, i) => x !== fastArr[i]);
    console.log(`      first diff at ${firstDiff}: ref=${refArr[firstDiff]} fast=${fastArr[firstDiff]}`);
  }
}

console.log(`\n${allPass ? 'ALL VARIANTS MATCH' : 'MISMATCH DETECTED'}`);

// Perf comparison
const t0 = Date.now();
runAdaptiveConfluenceBacktest(candles, DEFAULT_PARAMS);
const tRef = Date.now() - t0;
const t1 = Date.now();
runFastBacktest(candles, DEFAULT_PARAMS);
const tFast = Date.now() - t1;
console.log(`\nperf on 1440 candles: reference ${tRef}ms vs fast ${tFast}ms (${(tRef / Math.max(tFast, 1)).toFixed(0)}x)`);
