export function calculateStochastic(data, period = 14, smoothK = 3, smoothD = 3) {
  if (data.length < period) return data.map(d => ({ time: d.time, k: null, d: null }));
  
  let result = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push({ time: data[i].time, k: null, d: null });
      continue;
    }
    
    const window = data.slice(i - period + 1, i + 1);
    const high = Math.max(...window.map(d => d.high));
    const low = Math.min(...window.map(d => d.low));
    const close = data[i].close;
    
    if (high === low) {
      result.push({ time: data[i].time, k: 50, d: 50 });
      continue;
    }
    
    const kRaw = ((close - low) / (high - low)) * 100;
    result.push({ time: data[i].time, k: kRaw, d: kRaw });
  }
  return result;
}

export function calculateMACD(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  if (data.length < slowPeriod) return data.map(d => ({ time: d.time, macd: null, signal: null, histogram: null }));
  
  const ema = (arr, period) => {
    if (arr.length < period) return null;
    const k = 2 / (period + 1);
    let emaVal = arr.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < arr.length; i++) {
      emaVal = (arr[i] - emaVal) * k + emaVal;
    }
    return emaVal;
  };
  
  const closes = data.map(d => d.close);
  let result = [];
  
  for (let i = 0; i < data.length; i++) {
    if (i < slowPeriod - 1) {
      result.push({ time: data[i].time, macd: null, signal: null, histogram: null });
      continue;
    }
    
    const fastEma = ema(closes.slice(0, i + 1), fastPeriod);
    const slowEma = ema(closes.slice(0, i + 1), slowPeriod);
    
    if (fastEma === null || slowEma === null) {
      result.push({ time: data[i].time, macd: null, signal: null, histogram: null });
      continue;
    }
    
    const macdLine = fastEma - slowEma;
    const sliceForSignal = result.slice(-signalPeriod).map(r => r.macd).filter(m => m !== null);
    sliceForSignal.push(macdLine);
    
    const signalLine = ema(sliceForSignal, signalPeriod) || macdLine;
    const histogram = macdLine - signalLine;
    
    result.push({ time: data[i].time, macd: macdLine, signal: signalLine, histogram });
  }
  
  return result;
}

export function calculateATR(data, period = 14) {
  if (data.length < 2) return data.map(d => ({ time: d.time, atr: null }));
  
  let result = [];
  let trValues = [];
  
  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      result.push({ time: data[i].time, atr: null });
      continue;
    }
    
    const tr = Math.max(
      data[i].high - data[i].low,
      Math.abs(data[i].high - data[i - 1].close),
      Math.abs(data[i].low - data[i - 1].close)
    );
    trValues.push(tr);
    
    let atr = null;
    if (trValues.length >= period) {
      const recent = trValues.slice(-period);
      atr = recent.reduce((a, b) => a + b, 0) / period;
    }
    
    result.push({ time: data[i].time, atr });
  }
  
  return result;
}

export function analyzeMultiIndicators(data, config = {}) {
  const {
    minConfirmations = 3,
    rsiPeriod = 7,
    rsiHigh = 70,
    rsiLow = 30,
    stochPeriod = 14,
    smaFast = 9,
    smaSlow = 21,
    bbPeriod = 20,
    bbStdDev = 2,
    enabled = { rsi: true, stoch: true, macd: true, sma: true, bb: true }
  } = config;
  
  if (data.length < 30) {
    return { signal: null, reason: 'Insufficient data', indicators: {} };
  }
  
  const bullish = [];
  const bearish = [];
  const currentPrice = data[data.length - 1].close;
  const prevPrice = data[data.length - 2].close;
  
  if (enabled.rsi) {
    const rsiData = data.map((d, i) => ({ time: d.time, close: d.close }));
    let gains = 0, losses = 0;
    for (let i = rsiData.length - rsiPeriod; i < rsiData.length; i++) {
      const change = rsiData[i].close - rsiData[i - 1].close;
      if (change > 0) gains += change;
      else losses += Math.abs(change);
    }
    const avgGain = gains / rsiPeriod;
    const avgLoss = losses / rsiPeriod || 1;
    const rsi = 100 - (100 / (1 + avgGain / avgLoss));
    
    if (rsi < rsiLow) bullish.push(`RSI=${rsi.toFixed(1)}`);
    else if (rsi > rsiHigh) bearish.push(`RSI=${rsi.toFixed(1)}`);
  }
  
  if (enabled.stoch) {
    const stochData = calculateStochastic(data, stochPeriod);
    const stoch = stochData[stochData.length - 1];
    if (stoch && stoch.k !== null) {
      if (stoch.k < 20) bullish.push(`Stoch=${stoch.k.toFixed(1)}`);
      else if (stoch.k > 80) bearish.push(`Stoch=${stoch.k.toFixed(1)}`);
    }
  }
  
  if (enabled.macd) {
    const macdData = calculateMACD(data);
    const macd = macdData[macdData.length - 1];
    const prevMacd = macdData[macdData.length - 2];
    if (macd && prevMacd && macd.histogram !== null && prevMacd.histogram !== null) {
      if (prevMacd.histogram < 0 && macd.histogram > 0) bullish.push('MACD↑');
      else if (prevMacd.histogram > 0 && macd.histogram < 0) bearish.push('MACD↓');
    }
  }
  
  if (enabled.sma) {
    const smaFastVal = data.slice(-smaFast).reduce((a, b) => a + b.close, 0) / smaFast;
    const smaSlowVal = data.slice(-smaSlow).reduce((a, b) => a + b.close, 0) / smaSlow;
    
    if (currentPrice > smaFastVal && smaFastVal > smaSlowVal) bullish.push('SMA9>SMA21');
    else if (currentPrice < smaFastVal && smaFastVal < smaSlowVal) bearish.push('SMA9<SMA21');
  }
  
  if (enabled.bb) {
    const bbAvg = data.slice(-bbPeriod).reduce((a, b) => a + b.close, 0) / bbPeriod;
    const sqSum = data.slice(-bbPeriod).reduce((a, b) => a + Math.pow(b.close - bbAvg, 2), 0);
    const sd = Math.sqrt(sqSum / bbPeriod);
    const upper = bbAvg + sd * bbStdDev;
    const lower = bbAvg - sd * bbStdDev;
    
    if (currentPrice <= lower * 1.001) bullish.push('BB-Bottom');
    else if (currentPrice >= upper * 0.999) bearish.push('BB-Top');
  }
  
  let signal = null;
  let reason = '';
  
if (bullish.length >= minConfirmations) {
    signal = 'call';
    reason = `CALL (${bullish.length}): ${bullish.join(', ')}`;
  } else if (bearish.length >= minConfirmations) {
    signal = 'put';
    reason = `PUT (${bearish.length}): ${bearish.join(', ')}`;
  } else {
    const activeCount = Object.values(enabled).filter(v => v).length;
    reason = `Wait: ${Math.max(bullish.length, bearish.length)}/${minConfirmations}`;
  }
  
  let triggerIndicator = '';
  if (signal === 'call' && bullish.length > 0) {
    const firstSignal = bullish[0];
    if (firstSignal.startsWith('RSI')) triggerIndicator = 'RSI';
    else if (firstSignal.startsWith('Stoch')) triggerIndicator = 'Stoch';
    else if (firstSignal.includes('MACD')) triggerIndicator = 'MACD';
    else if (firstSignal.includes('SMA')) triggerIndicator = 'SMA';
    else if (firstSignal.includes('BB')) triggerIndicator = 'BB';
  } else if (signal === 'put' && bearish.length > 0) {
    const firstSignal = bearish[0];
    if (firstSignal.startsWith('RSI')) triggerIndicator = 'RSI';
    else if (firstSignal.startsWith('Stoch')) triggerIndicator = 'Stoch';
    else if (firstSignal.includes('MACD')) triggerIndicator = 'MACD';
    else if (firstSignal.includes('SMA')) triggerIndicator = 'SMA';
    else if (firstSignal.includes('BB')) triggerIndicator = 'BB';
  }
  
  return {
    signal,
    reason,
    indicators: {
      bullishCount: bullish.length,
      bearishCount: bearish.length,
      activeIndicators: Object.values(enabled).filter(v => v).length,
      signals: { bullish, bearish },
      triggerIndicator
    }
  };
}

export function detectDojiSignal(candle, data, config = {}) {
  const { 
    dojiThreshold = 0.3, 
    rsiPeriod = 7, 
    rsiLow = 35, 
    rsiHigh = 65,
    useBB = true,
    bbPeriod = 20,
    bbStdDev = 2
  } = config;
  
  if (!candle || !data || data.length < rsiPeriod + 1) {
    return null;
  }
  
  const body = Math.abs(candle.close - candle.open);
  const range = candle.high - candle.low;
  
  if (range <= 0 || body / range >= dojiThreshold) {
    return null;
  }
  
  let gains = 0, losses = 0;
  for (let i = data.length - rsiPeriod; i < data.length; i++) {
    const change = data[i].close - data[i - 1].close;
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }
  
  const avgGain = gains / rsiPeriod;
  const avgLoss = losses / rsiPeriod || 1;
  const rsi = 100 - (100 / (1 + avgGain / avgLoss));
  
  const currentPrice = candle.close;
  
  if (useBB) {
    const bbAvg = data.slice(-bbPeriod).reduce((a, b) => a + b.close, 0) / bbPeriod;
    const sqSum = data.slice(-bbPeriod).reduce((a, b) => a + Math.pow(b.close - bbAvg, 2), 0);
    const sd = Math.sqrt(sqSum / bbPeriod);
    const bbLower = bbAvg - sd * bbStdDev;
    const bbUpper = bbAvg + sd * bbStdDev;
    
    if (rsi < rsiLow && currentPrice <= bbLower * 1.01) {
      return { 
        signal: 'call', 
        reason: `DOJI + RSI=${rsi.toFixed(1)}<${rsiLow} + Soporte BB`,
        indicators: { doji: true, rsi, rsiLevel: 'oversold', bbPosition: 'lower', triggerIndicator: 'DOJI' }
      };
    }
    
    if (rsi > rsiHigh && currentPrice >= bbUpper * 0.99) {
      return { 
        signal: 'put', 
        reason: `DOJI + RSI=${rsi.toFixed(1)}>${rsiHigh} + Resistencia BB`,
        indicators: { doji: true, rsi, rsiLevel: 'overbought', bbPosition: 'upper', triggerIndicator: 'DOJI' }
      };
    }
  }
  
  if (rsi < rsiLow) {
    return { 
      signal: 'call', 
      reason: `DOJI + RSI=${rsi.toFixed(1)}<${rsiLow}`,
      indicators: { doji: true, rsi, rsiLevel: 'oversold', triggerIndicator: 'DOJI' }
    };
  }
  
  if (rsi > rsiHigh) {
    return { 
      signal: 'put', 
      reason: `DOJI + RSI=${rsi.toFixed(1)}>${rsiHigh}`,
      indicators: { doji: true, rsi, rsiLevel: 'overbought', triggerIndicator: 'DOJI' }
    };
  }
  
  return null;
}