import { readFileSync } from 'node:fs';
import type { Candle } from '../../lib/types.ts';
import { analyzeAdaptiveConfluence } from '../../lib/strategies/adaptive-confluence.ts';
import { DEFAULT_PARAMS, type AdaptiveParams } from './engine.ts';

const all: Candle[] = JSON.parse(readFileSync('scripts/backtest/data/R_25-60.json', 'utf8'));
const candles = all.slice(-1440);
const p: AdaptiveParams = { ...DEFAULT_PARAMS };

const counts: Record<string, number> = {};
let bothZones = 0;
let bbDeadBull = 0;
let bbDeadBear = 0;
let bbPosSamples: number[] = [];

let prevMacdHist: number | null = null;
for (let i = 0; i < candles.length; i++) {
  const res = analyzeAdaptiveConfluence(candles.slice(0, i + 1), p, prevMacdHist);
  prevMacdHist = res.nextPrevMacdHist;
  if (res.signal === null) continue;

  // Re-derive the raw components to attribute votes.
  const slice = candles.slice(0, i + 1);
  const closes = slice.map((c) => c.close);
  const idx = closes.length - 1;
  const price = closes[idx];
  const c = slice[idx];
  const range = Math.max(c.high - c.low, 1e-9);
  const bbPeriod = p.bbPeriod;
  const win = closes.slice(-bbPeriod);
  const mid = win.reduce((a, b) => a + b, 0) / bbPeriod;
  const sd = Math.sqrt(win.reduce((a, v) => a + (v - mid) ** 2, 0) / bbPeriod);
  const upper = mid + sd * p.bbStdDev;
  const lower = mid - sd * p.bbStdDev;
  const bbPos = (price - lower) / Math.max(upper - lower, 1e-9);
  bbPosSamples.push(bbPos);

  const body = Math.abs(c.close - c.open);
  if (res.emaFast! > res.emaSlow!) counts['TrendUp'] = (counts['TrendUp'] || 0) + 1;
  if (res.emaFast! < res.emaSlow!) counts['TrendDown'] = (counts['TrendDown'] || 0) + 1;
  if (res.rsi! >= p.rsiBullMin && res.rsi! <= p.rsiBullMax) counts['RSI bull'] = (counts['RSI bull'] || 0) + 1;
  if (res.rsi! >= p.rsiBearMin && res.rsi! <= p.rsiBearMax) counts['RSI bear'] = (counts['RSI bear'] || 0) + 1;
  if (res.rsi! >= p.rsiBullMin && res.rsi! <= p.rsiBullMax && res.rsi! >= p.rsiBearMin && res.rsi! <= p.rsiBearMax) {
    bothZones++;
  }
  if (bbPos <= 0.35 && price >= mid) bbDeadBull++;
  if (bbPos >= 0.65 && price <= mid) bbDeadBear++;
  if (body / range > 0.55 && c.close > c.open) counts['Strong bull body'] = (counts['Strong bull body'] || 0) + 1;
  if (body / range > 0.55 && c.close < c.open) counts['Strong bear body'] = (counts['Strong bear body'] || 0) + 1;
  if (res.reason.includes('MACD bullish')) counts['MACD bull cross'] = (counts['MACD bull cross'] || 0) + 1;
  if (res.reason.includes('MACD bearish')) counts['MACD bear cross'] = (counts['MACD bear cross'] || 0) + 1;
  if (res.reason.includes('BB reclaim')) counts['BB reclaim'] = (counts['BB reclaim'] || 0) + 1;
  if (res.reason.includes('BB rejection')) counts['BB rejection'] = (counts['BB rejection'] || 0) + 1;
}

console.log('--- component vote counts (across all 1440 candles) ---');
for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(18)} ${v}`);
}
console.log('\n--- zone overlap / dead-code checks ---');
console.log(`  RSI in BOTH bull+bear zone (45-55): ${bothZones} candles`);
console.log(`  BB reclaim condition true: ${bbDeadBull}  (expected > 0)`);
console.log(`  BB rejection condition true: ${bbDeadBear}  (expected > 0)`);
console.log(`  bbPos range: ${Math.min(...bbPosSamples).toFixed(3)} .. ${Math.max(...bbPosSamples).toFixed(3)}`);
console.log(`  BB mid corresponds to bbPos 0.5; reclaim needs bbPos<=0.35 AND price>=mid`);
console.log(`  -> with stdDev=2, bbPos<=0.35 implies price < mid, so 'price>=mid' can NEVER hold.`);

const bull = counts['TrendUp'] || 0;
const bear = counts['TrendDown'] || 0;
console.log(`\n  Trend votes: bull ${bull} / bear ${bear} (ratio ${(bull / Math.max(bear, 1)).toFixed(2)})`);
