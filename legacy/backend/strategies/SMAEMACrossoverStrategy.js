import StrategyBase from './StrategyBase.js';

function calculateSMA(candleData, period) {
  if (candleData.length < period) return null;
  
  const closes = candleData.map(c => c.close);
  const sum = closes.slice(-period).reduce((a, b) => a + b, 0);
  return sum / period;
}

function calculateEMA(candleData, period) {
  if (candleData.length < period) return null;
  
  const closes = candleData.map(c => c.close);
  const multiplier = 2 / (period + 1);
  
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  for (let i = period; i < closes.length; i++) {
    ema = (closes[i] - ema) * multiplier + ema;
  }
  
  return ema;
}

class SMAEMACrossoverStrategy extends StrategyBase {
  constructor(params = {}) {
    super('SMA_EMA_Crossover', {
      smaPeriod: params.smaPeriod || 23,
      emaPeriod: params.emaPeriod || 10
    });
    
    this.history = [];
  }

  analyze(candleData, indicators = {}) {
    if (!this.isActive) {
      return { signal: null, reason: 'Strategy not active' };
    }

    if (candleData.length < this.params.smaPeriod) {
      return { signal: null, reason: 'Insufficient data' };
    }

    const smaPeriod = this.params.smaPeriod;
    const emaPeriod = this.params.emaPeriod;
    
    const currentSMA = calculateSMA(candleData, smaPeriod);
    const currentEMA = calculateEMA(candleData, emaPeriod);
    
    if (currentSMA === null || currentEMA === null) {
      return { signal: null, reason: 'Insufficient data for indicators' };
    }

    const prevClose = candleData[candleData.length - 2]?.close;
    const currentClose = candleData[candleData.length - 1]?.close;
    
    if (!prevClose || !currentClose) {
      return { signal: null, reason: 'Missing price data' };
    }

    this.history.push({ sma: currentSMA, ema: currentEMA, close: currentClose });
    if (this.history.length > 50) {
      this.history.shift();
    }

    if (this.history.length < 2) {
      return { signal: null, reason: 'Building history' };
    }

    const prevEMA = this.history[this.history.length - 2].ema;
    const prevSMA = this.history[this.history.length - 2].sma;
    
    let signal = null;
    let reason = '';

    const emaCrossAboveSMA = prevEMA < prevSMA && currentEMA > currentSMA;
    const emaCrossBelowSMA = prevEMA > prevSMA && currentEMA < currentSMA;

    if (emaCrossAboveSMA || currentEMA > currentSMA) {
      signal = 'call';
      reason = `EMA crossed above SMA | EMA: ${currentEMA.toFixed(2)} | SMA: ${currentSMA.toFixed(2)}`;
    } else if (emaCrossBelowSMA || currentEMA < currentSMA) {
      signal = 'put';
      reason = `EMA crossed below SMA | EMA: ${currentEMA.toFixed(2)} | SMA: ${currentSMA.toFixed(2)}`;
    } else {
      reason = `EMA: ${currentEMA.toFixed(2)} | SMA: ${currentSMA.toFixed(2)} | Waiting for crossover`;
    }

    const result = {
      signal,
      reason,
      sma: currentSMA,
      ema: currentEMA,
      smaPeriod,
      emaPeriod
    };

    if (signal) {
      this.lastSignal = result;
      this.emit('signal', result);
    }

    return result;
  }

  getMetadata() {
    return {
      ...super.getMetadata(),
      description: 'SMA/EMA Crossover - signals when EMA crosses SMA',
      params: {
        smaPeriod: 'SMA period (default 23)',
        emaPeriod: 'EMA period (default 10)'
      }
    };
  }
}

export default SMAEMACrossoverStrategy;