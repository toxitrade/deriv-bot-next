import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import type { Candle } from '../../lib/types.ts';
import { runAdaptiveConfluenceBacktest, DEFAULT_PARAMS, type AdaptiveParams, type Signal } from './engine.ts';
import { runHmaProFlowBacktest, DEFAULT_HMA_PARAMS, type HmaParams } from './hma-engine.ts';

const DATA_FILE = 'scripts/backtest/data/R_25-60.json';
const MIN_CANDLES = 60;

interface Args {
  durationMin: number;
  granularity: number;
  overrides: Partial<AdaptiveParams>;
  label: string;
  verbose: boolean;
  offset: number;
  split: string;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const args: Args = {
    durationMin: 1440,
    granularity: 60,
    overrides: {},
    label: 'baseline',
    verbose: false,
    offset: 0,
    split: 'all',
  };

  for (const a of argv) {
    if (a === '--verbose' || a === '-v') args.verbose = true;
    else if (a.startsWith('--duration=')) args.durationMin = Number(a.split('=')[1]);
    else if (a.startsWith('--label=')) args.label = a.split('=')[1];
    else if (a.startsWith('--offset=')) args.offset = Number(a.split('=')[1]);
    else if (a.startsWith('--split=')) args.split = a.split('=')[1];
    else if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      args.overrides[k as keyof AdaptiveParams] = Number(v);
    }
  }
  return args;
}

function fmtPct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function printSignals(signals: Signal[], limit: number): void {
  const shown = signals.slice(-limit).reverse();
  console.log('\n  time                 type  price    outcome   delta   bull/bear  reason');
  console.log('  ' + '-'.repeat(100));
  for (const s of shown) {
    const t = new Date(s.time * 1000).toISOString().replace('T', ' ').slice(0, 16);
    const out = s.outcome === 'win' ? 'WIN  ' : s.outcome === 'loss' ? 'LOSS ' : 'UNRES ';
    console.log(
      `  ${t}  ${s.type.toUpperCase().padEnd(4)}  ${s.price.toFixed(2).padStart(7)}  ${out}  ${fmtPct(s.deltaPct ?? 0).padStart(7)}  ${s.bullishCount}/${s.bearishCount}       ${s.reason.slice(0, 52)}`
    );
  }
}

const args = parseArgs();

if (!existsSync(DATA_FILE)) {
  console.error(`Missing data file: ${DATA_FILE}`);
  console.error('Run: node scripts/backtest/fetch-candles.mjs R_25 60 1500');
  process.exit(1);
}

const all: Candle[] = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
const numCandles = Math.max(Math.floor((args.durationMin * 60) / args.granularity), MIN_CANDLES);

// --offset=N shifts the window back N candles from the most recent.
// --split=train uses the OLDER half of the window, --split=test the NEWER half.
let candles: Candle[];
let splitNote = '';
if (args.split === 'train' || args.split === 'test') {
  const half = Math.floor(numCandles / 2);
  if (args.split === 'train') {
    candles = all.slice(all.length - numCandles, all.length - numCandles + half);
    splitNote = 'TRAIN = older half of window';
  } else {
    candles = all.slice(all.length - half);
    splitNote = 'TEST = newer half of window';
  }
} else {
  const end = all.length - args.offset;
  candles = all.slice(Math.max(0, end - numCandles), end);
}
if (args.offset > 0) splitNote = `offset ${args.offset} candles back from latest`;

const params: AdaptiveParams = { ...DEFAULT_PARAMS, ...args.overrides };

console.log('='.repeat(78));
console.log(`BACKTEST: ${args.label}`);
console.log('='.repeat(78));
console.log(`data file   : ${DATA_FILE} (${all.length} candles available)`);
console.log(`window      : ${candles.length} candles = ${args.durationMin} min @ ${args.granularity}s${splitNote ? ' (' + splitNote + ')' : ''}`);
console.log(`from        : ${new Date(candles[0].time * 1000).toISOString()}`);
console.log(`to          : ${new Date(candles[candles.length - 1].time * 1000).toISOString()}`);
console.log(`price range : ${Math.min(...candles.map((c) => c.low)).toFixed(2)} - ${Math.max(...candles.map((c) => c.high)).toFixed(2)}`);
console.log('\nparams:');
for (const [k, v] of Object.entries(params)) {
  const base = DEFAULT_PARAMS[k as keyof AdaptiveParams];
  const changed = base !== v ? '  <-- changed' : '';
  console.log(`  ${k.padEnd(16)} ${String(v).padStart(6)}${changed}`);
}

const t0 = Date.now();
const { signals, stats } = runAdaptiveConfluenceBacktest(candles, params);
const elapsed = Date.now() - t0;

console.log('\n' + '-'.repeat(78));
console.log('RESULTS');
console.log('-'.repeat(78));
console.log(`  signals      : ${stats.total}  (CALL ${stats.calls} / PUT ${stats.puts})`);
console.log(`  resolved     : ${stats.wins + stats.losses}  (unresolved ${stats.unresolved})`);
console.log(`  wins / losses: ${stats.wins} / ${stats.losses}`);
console.log(`  win rate     : ${stats.winRate.toFixed(1)}%`);
console.log(`  total pnl    : ${fmtPct(stats.totalPnl)}`);
console.log(`  avg delta    : ${fmtPct(stats.avgDelta)}`);
console.log(`  runtime      : ${elapsed}ms`);

if (args.verbose) printSignals(signals, 40);

writeFileSync(
  `scripts/backtest/results/${args.label}.json`,
  JSON.stringify({ label: args.label, params, stats, signals }, null, 2)
);
console.log(`\n  saved -> scripts/backtest/results/${args.label}.json`);
