import { readFileSync } from 'node:fs';
import type { Candle } from '../../lib/types.ts';
import { analyzeAdaptiveConfluence, macdFromCloses } from '../../lib/strategies/adaptive-confluence.ts';
import { DEFAULT_PARAMS } from './engine.ts';

const all: Candle[] = JSON.parse(readFileSync('scripts/backtest/data/R_25-60.json', 'utf8'));
const candles = all.slice(-1440);
const p = DEFAULT_PARAMS;

// Replay the reference engine loop, printing the vote breakdown near index 93.
let prevMacdHist: number | null = null;
for (let i = 0; i < 140; i++) {
  const slice = candles.slice(0, i + 1);
  const res = analyzeAdaptiveConfluence(slice, p, prevMacdHist);
  const prevBefore = prevMacdHist;
  prevMacdHist = res.nextPrevMacdHist;

  if (i >= 88 && i <= 96) {
    console.log(`\n--- index ${i} ---`);
    console.log(`  prevMacdHist(in)=${prevBefore === null ? 'null' : prevBefore.toFixed(6)}  next=${res.nextPrevMacdHist?.toFixed(6)}`);
    console.log(`  emaFast=${res.emaFast?.toFixed(4)} emaSlow=${res.emaSlow?.toFixed(4)} rsi=${res.rsi?.toFixed(4)} macdHist=${res.macdHist?.toFixed(6)} bbPos=${res.bbPos?.toFixed(4)}`);
    console.log(`  bull=${res.bullishCount} bear=${res.bearishCount} signal=${res.signal}`);
    console.log(`  reason=${res.reason}`);
  }
}

// Now compute macd hist at index 92 for reference
for (const idx of [91, 92, 93]) {
  const closes = candles.slice(0, idx + 1).map((c) => c.close);
  const m = macdFromCloses(closes, p.macdFast, p.macdSlow, p.macdSignal);
  console.log(`macd hist @${idx}: ${m ? m.hist.toFixed(6) : 'null'}`);
}
