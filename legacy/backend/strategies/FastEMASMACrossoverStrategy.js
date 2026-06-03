import StrategyBase from './StrategyBase.js';

function calculateSMA(candleData, period) {
  if (candleData.length < period) return null;
  const sum = candleData.slice(-period).reduce((a, c) => a + c.close, 0);
  return sum / period;
}

function calculateEMA(candleData, period) {
  if (candleData.length < period) return null;
  const multiplier = 2 / (period + 1);
  let ema = candleData.slice(0, period).reduce((a, c) => a + c.close, 0) / period;
  for (let i = period; i < candleData.length; i++) {
    ema = (candleData[i].close - ema) * multiplier + ema;
  }
  return ema;
}

class FastEMASMACrossoverStrategy extends StrategyBase {
  constructor(params = {}) {
    super('Fast EMA/SMA Cross', {
      smaPeriod: params.smaPeriod || 15,
      emaPeriod: params.emaPeriod || 8
    });
    this.history = [];
  }

  analyze(candleData, indicators = {}) {
    if (!this.isActive) return { signal: null, reason: 'Strategy not active' };
    if (candleData.length < Math.max(this.params.smaPeriod, this.params.emaPeriod)) {
      return { signal: null, reason: 'Insufficient data' };
    }

    const sma = calculateSMA(candleData, this.params.smaPeriod);
    const ema = calculateEMA(candleData, this.params.emaPeriod);
    if (sma === null || ema === null) {
      return { signal: null, reason: 'Insufficient data for indicators' };
    }

    const prev = this.history[this.history.length - 1];
    this.history.push({ sma, ema });
    if (this.history.length > 2) this.history.shift();

    let signal = null;
    let reason = '';
    if (prev) {
      const crossUp = prev.ema <= prev.sma && ema > sma;
      const crossDown = prev.ema >= prev.sma && ema < sma;

      if (crossUp) {
        signal = 'call';
        reason = `EMA crossed above SMA (${ema.toFixed(2)} > ${sma.toFixed(2)})`;
      } else if (crossDown) {
        signal = 'put';
        reason = `EMA crossed below SMA (${ema.toFixed(2)} < ${sma.toFixed(2)})`;
      } else {
        reason = `EMA ${ema.toFixed(2)} vs SMA ${sma.toFixed(2)} – waiting for crossover`;
      }
    } else {
      reason = `EMA ${ema.toFixed(2)} vs SMA ${sma.toFixed(2)} – building history`;
    }
    const result = { signal, reason, sma, ema };
    if (signal) {
      this.lastSignal = result;
      this.emit('signal', result);
    }
    return result;
  }

  reset() {
    this.history = [];
    this.lastSignal = null;
  }

  getMetadata() {
    return {
      ...super.getMetadata(),
      description: 'Fast EMA/SMA cross – short periods for quick signals',
      params: {
        smaPeriod: 'SMA period (default 15)',
        emaPeriod: 'EMA period (default 8)'
      }
    };
  }
}


export default FastEMASMACrossoverStrategy;
