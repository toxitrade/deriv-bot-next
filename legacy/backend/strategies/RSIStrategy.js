import StrategyBase from './StrategyBase.js';

class RSIStrategy extends StrategyBase {
  constructor(params = {}) {
    super('RSI', {
      period: params.period || 7,
      highLevel: params.highLevel || 65,
      lowLevel: params.lowLevel || 35
    });
    
    this.rsiValues = [];
  }

  calculateRSI(candleData, period) {
    if (candleData.length < period + 1) {
      return null;
    }

    const gains = [];
    const losses = [];

    for (let i = 1; i < candleData.length; i++) {
      const change = candleData[i].close - candleData[i - 1].close;
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }

    if (gains.length < period) {
      return null;
    }

    let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

    for (let i = period; i < gains.length; i++) {
      avgGain = (avgGain * (period - 1) + gains[i]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    }

    if (avgLoss === 0) {
      return 100;
    }

    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    return rsi;
  }

  analyze(candleData, indicators = {}) {
    if (!this.isActive) {
      return { signal: null, reason: 'Strategy not active' };
    }

    if (candleData.length < 2) {
      return { signal: null, reason: 'Insufficient data' };
    }

    const period = this.params.period;
    const highLevel = this.params.highLevel;
    const lowLevel = this.params.lowLevel;

    const currentRSI = this.calculateRSI(candleData, period);
    
    if (currentRSI === null) {
      return { signal: null, reason: 'Insufficient data for RSI' };
    }

    const prevRSI = this.rsiValues.length > 0 
      ? this.rsiValues[this.rsiValues.length - 1] 
      : null;

    this.rsiValues.push(currentRSI);
    if (this.rsiValues.length > period * 2) {
      this.rsiValues.shift();
    }

    let signal = null;
    let reason = '';

    if (currentRSI > highLevel && currentRSI > prevRSI) {
      signal = 'call';
      reason = `RSI (${currentRSI.toFixed(2)}) > ${highLevel} and rising`;
    } else if (currentRSI < lowLevel && currentRSI < prevRSI) {
      signal = 'put';
      reason = `RSI (${currentRSI.toFixed(2)}) < ${lowLevel} and falling`;
    } else {
      reason = `RSI: ${currentRSI.toFixed(2)} | Prev: ${prevRSI ? prevRSI.toFixed(2) : 'N/A'} | Range: ${lowLevel}-${highLevel}`;
    }

    const result = {
      signal,
      reason,
      rsi: currentRSI,
      prevRSI,
      highLevel,
      lowLevel
    };

    if (signal) {
      this.lastSignal = result;
      this.emit('signal', result);
    }

    return result;
  }

  reset() {
    this.rsiValues = [];
    this.lastSignal = null;
  }

  getMetadata() {
    return {
      ...super.getMetadata(),
      description: 'RSI momentum strategy - signals when RSI crosses threshold',
      params: {
        period: 'RSI period (default 7)',
        highLevel: 'Overbought threshold (default 65)',
        lowLevel: 'Oversold threshold (default 35)'
      }
    };
  }
}

export default RSIStrategy;