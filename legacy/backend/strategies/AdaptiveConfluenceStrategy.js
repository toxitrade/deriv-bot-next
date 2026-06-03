import StrategyBase from './StrategyBase.js';

class AdaptiveConfluenceStrategy extends StrategyBase {
  constructor(params = {}) {
    super('Adaptive-Confluence', {
      emaFast: params.emaFast || 20,
      emaSlow: params.emaSlow || 50,
      rsiPeriod: params.rsiPeriod || 14,
      rsiBullMin: params.rsiBullMin || 45,
      rsiBullMax: params.rsiBullMax || 70,
      rsiBearMin: params.rsiBearMin || 30,
      rsiBearMax: params.rsiBearMax || 55,
      macdFast: params.macdFast || 12,
      macdSlow: params.macdSlow || 26,
      macdSignal: params.macdSignal || 9,
      bbPeriod: params.bbPeriod || 20,
      bbStdDev: params.bbStdDev || 2,
      minScore: params.minScore || 3,
      coolDownCandles: params.coolDownCandles || 8
    });

    this.prevMacdHist = null;
    this.lastSignalIndex = -Infinity;
  }

  calculateSMA(values, period) {
    if (values.length < period) return null;
    const s = values.slice(-period).reduce((a, b) => a + b, 0);
    return s / period;
  }

  calculateEMAFromCloses(closes, period) {
    if (closes.length < period) return null;
    const k = 2 / (period + 1);
    let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < closes.length; i++) {
      ema = (closes[i] - ema) * k + ema;
    }
    return ema;
  }

  calculateRSI(closes, period) {
    if (closes.length < period + 1) return null;
    let gains = 0;
    let losses = 0;
    for (let i = closes.length - period; i < closes.length; i++) {
      const ch = closes[i] - closes[i - 1];
      if (ch > 0) gains += ch;
      else losses += Math.abs(ch);
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  calculateMACD(closes, fast, slow, signal) {
    if (closes.length < slow + signal) return null;
    const macdSeries = [];
    for (let i = slow; i <= closes.length; i++) {
      const slice = closes.slice(0, i);
      const emaFast = this.calculateEMAFromCloses(slice, fast);
      const emaSlow = this.calculateEMAFromCloses(slice, slow);
      if (emaFast === null || emaSlow === null) continue;
      macdSeries.push(emaFast - emaSlow);
    }
    if (macdSeries.length < signal) return null;
    const signalLine = this.calculateEMAFromCloses(macdSeries, signal);
    const macdLine = macdSeries[macdSeries.length - 1];
    if (signalLine === null || macdLine === null) return null;
    return { line: macdLine, signal: signalLine, hist: macdLine - signalLine };
  }

  calculateBB(closes, period, stdDev) {
    if (closes.length < period) return null;
    const recent = closes.slice(-period);
    const mid = this.calculateSMA(recent, period);
    const variance = recent.reduce((acc, p) => acc + ((p - mid) ** 2), 0) / period;
    const sd = Math.sqrt(variance);
    return { upper: mid + sd * stdDev, mid, lower: mid - sd * stdDev };
  }

  analyze(candleData) {
    if (!this.isActive) return { signal: null, reason: 'Strategy not active' };
    if (!Array.isArray(candleData) || candleData.length < 60) {
      return { signal: null, reason: 'Insufficient data (need >= 60 candles)' };
    }

    const p = this.params;
    const closes = candleData.map(c => Number(c.close));
    const highs = candleData.map(c => Number(c.high));
    const lows = candleData.map(c => Number(c.low));
    const idx = candleData.length - 1;
    const price = closes[idx];

    const emaFast = this.calculateEMAFromCloses(closes, p.emaFast);
    const emaSlow = this.calculateEMAFromCloses(closes, p.emaSlow);
    const rsi = this.calculateRSI(closes, p.rsiPeriod);
    const macd = this.calculateMACD(closes, p.macdFast, p.macdSlow, p.macdSignal);
    const bb = this.calculateBB(closes, p.bbPeriod, p.bbStdDev);

    if ([emaFast, emaSlow, rsi, macd, bb].some(v => v === null)) {
      return { signal: null, reason: 'Indicator warmup' };
    }

    const range = (highs[idx] - lows[idx]) || 1e-9;
    const bbPos = (price - bb.lower) / Math.max(bb.upper - bb.lower, 1e-9);

    const bullish = [];
    const bearish = [];

    if (emaFast > emaSlow) bullish.push('TrendUp');
    if (emaFast < emaSlow) bearish.push('TrendDown');

    if (rsi >= p.rsiBullMin && rsi <= p.rsiBullMax) bullish.push(`RSI=${rsi.toFixed(1)} in bull zone`);
    if (rsi >= p.rsiBearMin && rsi <= p.rsiBearMax) bearish.push(`RSI=${rsi.toFixed(1)} in bear zone`);

    if (this.prevMacdHist !== null && this.prevMacdHist <= 0 && macd.hist > 0) bullish.push('MACD bullish cross');
    if (this.prevMacdHist !== null && this.prevMacdHist >= 0 && macd.hist < 0) bearish.push('MACD bearish cross');

    if (bbPos <= 0.35 && price >= bb.mid) bullish.push('BB reclaim from lower half');
    if (bbPos >= 0.65 && price <= bb.mid) bearish.push('BB rejection from upper half');

    if (range > 0) {
      const body = Math.abs(candleData[idx].close - candleData[idx].open);
      if (body / range > 0.55 && candleData[idx].close > candleData[idx].open) bullish.push('Strong bullish body');
      if (body / range > 0.55 && candleData[idx].close < candleData[idx].open) bearish.push('Strong bearish body');
    }

    let signal = null;
    let reason = `bull=${bullish.length}, bear=${bearish.length}`;

    const cooledDown = (idx - this.lastSignalIndex) >= p.coolDownCandles;
    if (cooledDown && bullish.length >= p.minScore && bullish.length > bearish.length) {
      signal = 'call';
      reason = bullish.join('; ');
      this.lastSignalIndex = idx;
    } else if (cooledDown && bearish.length >= p.minScore && bearish.length > bullish.length) {
      signal = 'put';
      reason = bearish.join('; ');
      this.lastSignalIndex = idx;
    }

    this.prevMacdHist = macd.hist;

    const result = {
      signal,
      reason,
      indicators: {
        emaFast,
        emaSlow,
        rsi,
        macdHist: macd.hist,
        bbUpper: bb.upper,
        bbMid: bb.mid,
        bbLower: bb.lower,
        bbPos,
        bullishCount: bullish.length,
        bearishCount: bearish.length
      }
    };

    if (signal) {
      this.lastSignal = result;
      this.emit('signal', result);
    }

    return result;
  }

  reset() {
    this.prevMacdHist = null;
    this.lastSignal = null;
    this.lastSignalIndex = -Infinity;
  }

  getMetadata() {
    return {
      ...super.getMetadata(),
      description: 'Adaptive Confluence: Trend (EMA20/50) + RSI regime + MACD cross + Bollinger structure + candle strength',
      params: this.params
    };
  }
}

export default AdaptiveConfluenceStrategy;
