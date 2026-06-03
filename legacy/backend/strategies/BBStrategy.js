import StrategyBase from './StrategyBase.js';

function calculateSMA(candleData, period) {
  if (candleData.length < period) return null;
  
  const closes = candleData.map(c => c.close);
  const sum = closes.slice(-period).reduce((a, b) => a + b, 0);
  return sum / period;
}

function calculateStdDev(candleData, period, sma) {
  if (candleData.length < period || sma === null) return null;
  
  const closes = candleData.map(c => c.close);
  const squaredDiffs = closes.slice(-period).map(c => Math.pow(c - sma, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
  return Math.sqrt(variance);
}

class BBStrategy extends StrategyBase {
  constructor(params = {}) {
    super('BollingerBands', {
      period: params.period || 20,
      stdDev: params.stdDev || 2
    });
    
    this.history = [];
  }

  analyze(candleData, indicators = {}) {
    if (!this.isActive) {
      return { signal: null, reason: 'Strategy not active' };
    }

    if (candleData.length < this.params.period + 1) {
      return { signal: null, reason: 'Insufficient data' };
    }

    const period = this.params.period;
    const stdDevMult = this.params.stdDev;
    
    const sma = calculateSMA(candleData, period);
    const stdDev = calculateStdDev(candleData, period, sma);
    
    if (sma === null || stdDev === null) {
      return { signal: null, reason: 'Insufficient data for BB' };
    }

    const upper = sma + (stdDev * stdDevMult);
    const lower = sma - (stdDev * stdDevMult);
    
    const currentPrice = candleData[candleData.length - 1].close;
    const prevPrice = candleData[candleData.length - 2].close;
    
    this.history.push({ upper, lower, sma, close: currentPrice });
    if (this.history.length > 50) {
      this.history.shift();
    }

    let signal = null;
    let reason = '';

    if (prevPrice > lower && currentPrice <= lower) {
      signal = 'call';
      reason = `Price touched lower BB (${lower.toFixed(2)}) - potential reversal`;
    } else if (prevPrice < upper && currentPrice >= upper) {
      signal = 'put';
      reason = `Price touched upper BB (${upper.toFixed(2)}) - potential reversal`;
    } else if (currentPrice <= lower) {
      signal = 'call';
      reason = `Price below lower BB - oversold`;
    } else if (currentPrice >= upper) {
      signal = 'put';
      reason = `Price above upper BB - overbought`;
    } else {
      reason = `Price: ${currentPrice.toFixed(2)} | BB: ${lower.toFixed(2)}-${upper.toFixed(2)}`;
    }

    const result = {
      signal,
      reason,
      upper,
      lower,
      sma,
      stdDev,
      period,
      stdDevMult
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
      description: 'Bollinger Bands - signals on price touching bands',
      params: {
        period: 'BB period (default 20)',
        stdDev: 'Standard deviations (default 2)'
      }
    };
  }
}

export default BBStrategy;