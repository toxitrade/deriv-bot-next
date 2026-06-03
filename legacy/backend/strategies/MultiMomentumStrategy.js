import StrategyBase from './StrategyBase.js';

class MultiMomentumStrategy extends StrategyBase {
  constructor(params = {}) {
    super('Multi-Momentum', {
      minConfirmations: params.minConfirmations || 3,
      rsiPeriod: params.rsiPeriod || 7,
      rsiHigh: params.rsiHigh || 70,
      rsiLow: params.rsiLow || 30,
      stochPeriod: params.stochPeriod || 14,
      stochK: params.stochK || 3,
      stochD: params.stochD || 3,
      macdFast: params.macdFast || 12,
      macdSlow: params.macdSlow || 26,
      macdSignal: params.macdSignal || 9,
      smaFast: params.smaFast || 9,
      smaSlow: params.smaSlow || 21,
      bbPeriod: params.bbPeriod || 20,
      bbStdDev: params.bbStdDev || 2,
      enabled: {
        rsi: params.enabled?.rsi !== false,
        stoch: params.enabled?.stoch !== false,
        macd: params.enabled?.macd !== false,
        sma: params.enabled?.sma !== false,
        bb: params.enabled?.bb !== false
      }
    });

    this.history = {
      rsi: [],
      stoch: [],
      macd: { hist: [], signal: [], line: [] },
      sma: { fast: [], slow: [] },
      bb: { upper: [], middle: [], lower: [] }
    };
  }

  calculateSMA(candleData, period) {
    if (candleData.length < period) return null;
    const sum = candleData.slice(-period).reduce((a, b) => a + b.close, 0);
    return sum / period;
  }

  calculateEMA(data, period) {
    if (data.length < period) return null;
    const k = 2 / (period + 1);
    let ema = data.slice(0, period).reduce((a, b) => a + b.close, 0) / period;
    for (let i = period; i < data.length; i++) {
      ema = (data[i].close - ema) * k + ema;
    }
    return ema;
  }

  calculateRSI(candleData, period) {
    if (candleData.length < period + 1) return null;
    
    let gains = 0, losses = 0;
    for (let i = candleData.length - period; i < candleData.length; i++) {
      const change = candleData[i].close - candleData[i - 1].close;
      if (change > 0) gains += change;
      else losses += Math.abs(change);
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period || 1;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  calculateStochastic(candleData, period, k, d) {
    if (candleData.length < period) return null;
    
    const recent = candleData.slice(-period);
    const high = Math.max(...recent.map(c => c.high));
    const low = Math.min(...recent.map(c => c.low));
    const close = candleData[candleData.length - 1].close;
    
    if (high === low) return { k: 50, d: 50 };
    
    const kVal = ((close - low) / (high - low)) * 100;
    return { k: kVal, d: kVal };
  }

  calculateMACD(candleData, fast, slow, signal) {
    if (candleData.length < slow + signal) return null;
    
    const emaFast = this.calculateEMA(candleData.slice(-slow - 10), fast);
    const emaSlow = this.calculateEMA(candleData.slice(-slow - 10), slow);
    
    if (emaFast === null || emaSlow === null) return null;
    
    const macdLine = emaFast - emaSlow;
    const signalLine = macdLine * 0.9 + (emaFast - emaSlow) * 0.1;
    const histogram = macdLine - signalLine;
    
    return { line: macdLine, signal: signalLine, histogram };
  }

  calculateBB(candleData, period, stdDev) {
    if (candleData.length < period) return null;
    
    const recent = candleData.slice(-period);
    const sum = recent.reduce((a, b) => a + b.close, 0);
    const avg = sum / period;
    
    const sqSum = recent.reduce((a, b) => a + Math.pow(b.close - avg, 2), 0);
    const sd = Math.sqrt(sqSum / period);
    
    return {
      upper: avg + sd * stdDev,
      middle: avg,
      lower: avg - sd * stdDev
    };
  }

  analyze(candleData, indicators = {}) {
    if (!this.isActive) {
      return { signal: null, reason: 'Strategy not active' };
    }

    if (candleData.length < 30) {
      return { signal: null, reason: 'Insufficient data' };
    }

    const p = this.params;
    const currentPrice = candleData[candleData.length - 1].close;
    const signals = { bullish: [], bearish: [] };

    if (p.enabled.rsi) {
      const rsi = this.calculateRSI(candleData, p.rsiPeriod);
      if (rsi !== null) {
        if (rsi < p.rsiLow) signals.bullish.push(`RSI=${rsi.toFixed(1)}<${p.rsiLow}`);
        else if (rsi > p.rsiHigh) signals.bearish.push(`RSI=${rsi.toFixed(1)}>${p.rsiHigh}`);
      }
      this.history.rsi.push(rsi);
    }

    if (p.enabled.stoch) {
      const stoch = this.calculateStochastic(candleData, p.stochPeriod, p.stochK, p.stochD);
      if (stoch) {
        if (stoch.k < 20 && stoch.k > stoch.d) signals.bullish.push(`Stoch=${stoch.k.toFixed(1)}<20`);
        else if (stoch.k > 80 && stoch.k < stoch.d) signals.bearish.push(`Stoch=${stoch.k.toFixed(1)}>80`);
      }
      this.history.stoch.push(stoch);
    }

    if (p.enabled.macd) {
      const macd = this.calculateMACD(candleData, p.macdFast, p.macdSlow, p.macdSignal);
      if (macd && this.history.macd.hist.length > 0) {
        const prevHist = this.history.macd.hist[this.history.macd.hist.length - 1];
        if (prevHist < 0 && macd.histogram > 0) signals.bullish.push('MACD↑');
        else if (prevHist > 0 && macd.histogram < 0) signals.bearish.push('MACD↓');
      }
      if (macd) {
        this.history.macd.hist.push(macd.histogram);
        this.history.macd.line.push(macd.line);
        this.history.macd.signal.push(macd.signal);
      }
    }

    if (p.enabled.sma) {
      const smaFast = this.calculateSMA(candleData, p.smaFast);
      const smaSlow = this.calculateSMA(candleData, p.smaSlow);
      if (smaFast && smaSlow) {
        if (currentPrice > smaFast && smaFast > smaSlow) signals.bullish.push('Price>SMA9>SMA21');
        else if (currentPrice < smaFast && smaFast < smaSlow) signals.bearish.push('Price<SMA9<SMA21');
      }
    }

    if (p.enabled.bb) {
      const bb = this.calculateBB(candleData, p.bbPeriod, p.bbStdDev);
      if (bb) {
        if (currentPrice <= bb.lower * 1.001) signals.bullish.push('BB-Bottom');
        else if (currentPrice >= bb.upper * 0.999) signals.bearish.push('BB-Top');
      }
    }

    const bullishCount = signals.bullish.length;
    const bearishCount = signals.bearish.length;
    
    let signal = null;
    let reason = '';

    if (bullishCount >= p.minConfirmations) {
      signal = 'call';
      reason = `CALL (${bullishCount}/${Object.values(p.enabled).filter(v => v).length}): ${signals.bullish.join(', ')}`;
    } else if (bearishCount >= p.minConfirmations) {
      signal = 'put';
      reason = `PUT (${bearishCount}/${Object.values(p.enabled).filter(v => v).length}): ${signals.bearish.join(', ')}`;
    } else {
      const activeCount = Object.values(p.enabled).filter(v => v).length;
      reason = `Awaiting: ${Math.min(bullishCount, bearishCount)}/${p.minConfirmations} (Bullish:${bullishCount}, Bearish:${bearishCount})`;
    }

    const result = {
      signal,
      reason,
      indicators: {
        rsi: this.history.rsi[this.history.rsi.length - 1],
        stoch: this.history.stoch[this.history.stoch.length - 1],
        macd: this.history.macd.hist.length > 0 ? this.history.macd.hist[this.history.macd.hist.length - 1] : null,
        bullishCount,
        bearishCount,
        activeIndicators: Object.values(p.enabled).filter(v => v).length
      }
    };

    if (signal) {
      this.lastSignal = result;
      this.emit('signal', result);
    }

    return result;
  }

  reset() {
    this.history = {
      rsi: [],
      stoch: [],
      macd: { hist: [], signal: [], line: [] },
      sma: { fast: [], slow: [] },
      bb: { upper: [], middle: [], lower: [] }
    };
    this.lastSignal = null;
  }

  getMetadata() {
    return {
      ...super.getMetadata(),
      description: 'Multi-Momentum: Combina RSI, Stochastic, MACD, SMA, BB para señales de alto volumen',
      params: {
        minConfirmations: 'Señales mínimas requeridas (default 3)',
        rsiPeriod: 'RSI period (default 7)',
        rsiHigh: 'Overbought (default 70)',
        rsiLow: 'Oversold (default 30)',
        stochPeriod: 'Stochastic period (default 14)',
        smaFast: 'SMA rápido (default 9)',
        smaSlow: 'SMA lento (default 21)',
        bbPeriod: 'BB period (default 20)'
      }
    };
  }
}

export default MultiMomentumStrategy;