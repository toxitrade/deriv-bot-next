// Indicator calculation functions

export function calculateStochastic(data, period = 14) {
    if (data.length < period) return data.map(d => ({ time: d.time, k: null, d: null }));
    return data.map((d, i) => {
        if (i < period - 1) return { time: d.time, k: null, d: null };
        const window = data.slice(i - period + 1, i + 1);
        const high = Math.max(...window.map(c => c.high));
        const low = Math.min(...window.map(c => c.low));
        const k = high === low ? 50 : ((d.close - low) / (high - low)) * 100;
        return { time: d.time, k, d: k };
    });
}

export function calculateMACD(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    if (data.length < slowPeriod) return data.map(d => ({ time: d.time, macd: null, signal: null, histogram: null }));
    const ema = (arr, period) => {
        if (arr.length < period) return null;
        const k = 2 / (period + 1);
        let emaVal = arr.slice(0, period).reduce((a, b) => a + b, 0) / period;
        for (let i = period; i < arr.length; i++) emaVal = (arr[i] - emaVal) * k + emaVal;
        return emaVal;
    };
    const closes = data.map(d => d.close);
    let result = [];
    for (let i = 0; i < data.length; i++) {
        if (i < slowPeriod - 1) { result.push({ time: data[i].time, macd: null, signal: null, histogram: null }); continue; }
        const fastEma = ema(closes.slice(0, i + 1), fastPeriod);
        const slowEma = ema(closes.slice(0, i + 1), slowPeriod);
        if (fastEma === null || slowEma === null) { result.push({ time: data[i].time, macd: null, signal: null, histogram: null }); continue; }
        const macdLine = fastEma - slowEma;
        const validMacds = result.slice(-signalPeriod).map(r => r.macd).filter(m => m !== null);
        validMacds.push(macdLine);
        const signalLine = ema(validMacds, signalPeriod) || macdLine;
        result.push({ time: data[i].time, macd: macdLine, signal: signalLine, histogram: macdLine - signalLine });
    }
    return result;
}

export function calculateSMA(data, period) {
    return data.map((d, i) => {
        if (i < period - 1) return { time: d.time, value: null };
        let sum = 0;
        for (let j = 0; j < period; j++) sum += data[i - j].close;
        return { time: d.time, value: sum / period };
    });
}

export function calculateEMA(data, period) {
    if (data.length === 0) return [];
    if (data.length < period) {
        // Not enough data for EMA, return null values
        return data.map(d => ({ time: d.time, value: null }));
    }
    
    let k = 2 / (period + 1);
    
    // Initialize with SMA of first 'period' values (correct EMA initialization)
    let sum = 0;
    for (let i = 0; i < period; i++) {
        sum += data[i].close;
    }
    let ema = sum / period;
    
    let result = [];
    // Fill null values for first period-1 candles
    for (let i = 0; i < period - 1; i++) {
        result.push({ time: data[i].time, value: null });
    }
    
    // Calculate EMA for remaining candles
    for (let i = period - 1; i < data.length; i++) {
        ema = (data[i].close - ema) * k + ema;
        result.push({ time: data[i].time, value: ema });
    }
    
    return result;
}

export function calculateRSI(data, period) {
    let res = [];
    if (data.length < period + 1) return data.map(d => ({ time: d.time, value: null }));
    
    for (let i = 0; i < data.length; i++) {
        if (i < period) { res.push({ time: data[i].time, value: null }); continue; }
        let gains = 0, losses = 0;
        for (let j = i - period + 1; j <= i; j++) {
            let diff = data[j].close - data[j - 1].close;
            diff >= 0 ? gains += diff : losses -= diff;
        }
        let rs = gains / (losses || 1);
        res.push({ time: data[i].time, value: 100 - (100 / (1 + rs)) });
    }
    return res;
}

export function calculateBB(data, period) {
    let upper = [], middle = [], lower = [];
    data.forEach((d, i) => {
        if (i < period - 1) { 
            upper.push({ time: d.time, value: null }); 
            middle.push({ time: d.time, value: null }); 
            lower.push({ time: d.time, value: null }); 
            return; 
        }
        let sum = 0;
        for (let j = 0; j < period; j++) sum += data[i - j].close;
        let avg = sum / period;
        let sqSum = 0;
        for (let j = 0; j < period; j++) sqSum += Math.pow(data[i - j].close - avg, 2);
        let sd = Math.sqrt(sqSum / period);
        upper.push({ time: d.time, value: avg + sd * 2 });
        middle.push({ time: d.time, value: avg });
        lower.push({ time: d.time, value: avg - sd * 2 });
    });
    return { upper, middle, lower };
}