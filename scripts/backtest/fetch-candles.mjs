#!/usr/bin/env node
/**
 * Fetches public candle history from Deriv for a given symbol/granularity.
 * Usage: node scripts/backtest/fetch-candles.mjs [symbol] [granularity] [count] [outfile]
 */
import { writeFileSync } from 'node:fs';

const symbol = process.argv[2] || 'R_25';
const granularity = Number(process.argv[3] || 60);
const count = Number(process.argv[4] || 1500);
const outFile = process.argv[5] || `scripts/backtest/data/${symbol}-${granularity}.json`;

const CANDIDATE_URLS = [
  'wss://api.derivws.com/trading/v1/options/ws/public',
  'wss://ws.binaryws.com/websockets/v3?app_id=1089',
];

function connect(url) {
  return new Promise((resolve, reject) => {
    let ws;
    try {
      ws = new WebSocket(url);
    } catch (e) {
      reject(e);
      return;
    }
    const timer = setTimeout(() => {
      try { ws.close(); } catch {}
      reject(new Error('timeout connecting to ' + url));
    }, 15000);

    ws.onopen = () => {
      clearTimeout(timer);
      resolve(ws);
    };
    ws.onerror = (e) => {
      clearTimeout(timer);
      reject(new Error('ws error on ' + url + ': ' + (e?.message || 'unknown')));
    };
  });
}

function req(ws, payload) {
  return new Promise((resolve, reject) => {
    const id = payload.req_id;
    const timer = setTimeout(() => reject(new Error('req timeout: ' + payload.req_id)), 90000);
    const onMsg = (ev) => {
      const data = JSON.parse(ev.data);
      if (data.req_id === id) {
        clearTimeout(timer);
        ws.removeEventListener('message', onMsg);
        resolve(data);
      }
    };
    ws.addEventListener('message', onMsg);
    ws.send(JSON.stringify(payload));
  });
}

let reqCounter = 0;
const nextReqId = () => ++reqCounter;

async function tryUrl(url) {
  console.log(`\n=== Trying ${url} ===`);
  const ws = await connect(url);
  console.log('connected');

  // Send a ping to confirm the protocol works
  const ping = await req(ws, { ping: 1, req_id: nextReqId() });
  console.log('ping ->', ping.ping ? 'ok' : JSON.stringify(ping));

  // Page backwards: the public endpoint returns at most 1000 candles per call,
  // so walk `end` earlier until we have enough history.
  const all = [];
  let end = 'latest';
  const seen = new Set();

  while (all.length < count) {
    const res = await req(ws, {
      ticks_history: symbol,
      end,
      start: 1,
      style: 'candles',
      granularity,
      adjust_start_time: 1,
      req_id: nextReqId(),
    });

    if (!res.candles || !Array.isArray(res.candles) || res.candles.length === 0) {
      if (all.length === 0) {
        throw new Error('no candles: ' + JSON.stringify(res).slice(0, 300));
      }
      console.log('no more candles available');
      break;
    }

    let added = 0;
    for (const c of res.candles) {
      if (seen.has(c.epoch)) continue;
      seen.add(c.epoch);
      all.push(c);
      added++;
    }
    console.log(`page: got ${res.candles.length}, new ${added}, total ${all.length}`);

    if (res.candles.length === 0) break;
    const oldest = Math.min(...res.candles.map((c) => c.epoch));
    // Move the window end one granularity before the oldest candle we have.
    const nextEnd = oldest - granularity;
    if (!Number.isFinite(nextEnd) || nextEnd <= 0) break;
    end = nextEnd;
    // Be gentle with the API between pages.
    await new Promise((r) => setTimeout(r, 1500));
  }

  ws.close();
  return all;
}

let candles = null;
let lastErr = null;
for (const url of CANDIDATE_URLS) {
  try {
    candles = await tryUrl(url);
    break;
  } catch (e) {
    lastErr = e;
    console.log('FAILED:', e.message);
  }
}

if (!candles) {
  console.error('\nAll endpoints failed. Last error:', lastErr?.message);
  process.exit(1);
}

const parsed = candles
  .map((c) => ({
    time: c.epoch,
    open: parseFloat(c.open),
    high: parseFloat(c.high),
    low: parseFloat(c.low),
    close: parseFloat(c.close),
  }))
  .filter((c) => Number.isFinite(c.time) && Number.isFinite(c.open) && Number.isFinite(c.close))
  .sort((a, b) => a.time - b.time);

const sliced = parsed.slice(-count);

console.log('\n--- summary ---');
console.log('symbol      :', symbol);
console.log('granularity :', granularity, 'sec');
console.log('total       :', parsed.length);
console.log('kept        :', sliced.length);
console.log('from        :', new Date(sliced[0].time * 1000).toISOString());
console.log('to          :', new Date(sliced[sliced.length - 1].time * 1000).toISOString());
console.log('price range :', Math.min(...sliced.map((c) => c.low)).toFixed(2), '-', Math.max(...sliced.map((c) => c.high)).toFixed(2));

writeFileSync(outFile, JSON.stringify(sliced, null, 0));
console.log('\nwritten ->', outFile);
