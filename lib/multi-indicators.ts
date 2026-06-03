import type { Candle, IndicatorConfig } from '@/lib/types';
import { calculateStochastic, calculateMACD } from '@/lib/indicators';

export interface MultiIndicatorResult {
  signal: 'call' | 'put' | null;
  reason: string;
  indicators: {
    bullishCount: number;
    bearishCount: number;
    activeIndicators: number;
    signals: { bullish: string[]; bearish: string[] };
    triggerIndicator: string;
  };
}

export interface DojiResult {
  signal: 'call' | 'put';
  reason: string;
  indicators: {
    doji: boolean;
    rsi: number;
    rsiLevel: string;
    bbPosition?: string;
    triggerIndicator: string;
  };
}

export function analyzeMultiIndicators(data: Candle[], config: IndicatorConfig = {}): MultiIndicatorResult {
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
    enabled = { rsi: true, stoch: true, macd: true, sma: true, bb: true },
  } = config;

  if (data.length < 30) {
    return { signal: null, reason: 'Insufficient data', indicators: { bullishCount: 0, bearishCount: 0, activeIndicators: 0, signals: { bullish: [], bearish: [] }, triggerIndicator: '' } };
  }

  const bullish: string[] = [];
  const bearish: string[] = [];
  const currentPrice = data[data.length - 1].close;

  if (enabled.rsi) {
    let gains = 0, losses = 0;
    for (let i = data.length - rsiPeriod; i < data.length; i++) {
      const change = data[i].close - data[i - 1].close;
      if (change > 0) gains += change;
      else losses += Math.abs(change);
    }
    const avgGain = gains / rsiPeriod;
    const avgLoss = losses / rsiPeriod || 1;
    const rsi = 100 - 100 / (1 + avgGain / avgLoss);

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

  let signal: 'call' | 'put' | null = null;
  let reason = '';

  if (bullish.length >= minConfirmations) {
    signal = 'call';
    reason = `CALL (${bullish.length}): ${bullish.join(', ')}`;
  } else if (bearish.length >= minConfirmations) {
    signal = 'put';
    reason = `PUT (${bearish.length}): ${bearish.join(', ')}`;
  } else {
    reason = `Wait: ${Math.max(bullish.length, bearish.length)}/${minConfirmations}`;
  }

  const triggerIndicator = getTriggerIndicator(signal, bullish, bearish);

  return {
    signal,
    reason,
    indicators: {
      bullishCount: bullish.length,
      bearishCount: bearish.length,
      activeIndicators: Object.values(enabled).filter(Boolean).length,
      signals: { bullish, bearish },
      triggerIndicator,
    },
  };
}

function getTriggerIndicator(signal: 'call' | 'put' | null, bullish: string[], bearish: string[]): string {
  const list = signal === 'call' ? bullish : bearish;
  if (list.length === 0) return '';
  const first = list[0];
  if (first.startsWith('RSI')) return 'RSI';
  if (first.startsWith('Stoch')) return 'Stoch';
  if (first.includes('MACD')) return 'MACD';
  if (first.includes('SMA')) return 'SMA';
  if (first.includes('BB')) return 'BB';
  return '';
}

export function detectDojiSignal(
  candle: Candle | null,
  data: Candle[],
  config: {
    dojiThreshold?: number;
    rsiPeriod?: number;
    rsiLow?: number;
    rsiHigh?: number;
    useBB?: boolean;
    bbPeriod?: number;
    bbStdDev?: number;
  } = {}
): DojiResult | null {
  const {
    dojiThreshold = 0.3,
    rsiPeriod = 7,
    rsiLow = 35,
    rsiHigh = 65,
    useBB = true,
    bbPeriod = 20,
    bbStdDev = 2,
  } = config;

  if (!candle || !data || data.length < rsiPeriod + 1) return null;

  const body = Math.abs(candle.close - candle.open);
  const range = candle.high - candle.low;
  if (range <= 0 || body / range >= dojiThreshold) return null;

  let gains = 0, losses = 0;
  for (let i = data.length - rsiPeriod; i < data.length; i++) {
    const change = data[i].close - data[i - 1].close;
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }
  const avgGain = gains / rsiPeriod;
  const avgLoss = losses / rsiPeriod || 1;
  const rsi = 100 - 100 / (1 + avgGain / avgLoss);

  const currentPrice = candle.close;

  if (useBB) {
    const bbAvg = data.slice(-bbPeriod).reduce((a, b) => a + b.close, 0) / bbPeriod;
    const sqSum = data.slice(-bbPeriod).reduce((a, b) => a + Math.pow(b.close - bbAvg, 2), 0);
    const sd = Math.sqrt(sqSum / bbPeriod);
    const bbLower = bbAvg - sd * bbStdDev;
    const bbUpper = bbAvg + sd * bbStdDev;

    if (rsi < rsiLow && currentPrice <= bbLower * 1.01) {
      return { signal: 'call', reason: `DOJI + RSI=${rsi.toFixed(1)}<${rsiLow} + Soporte BB`, indicators: { doji: true, rsi, rsiLevel: 'oversold', bbPosition: 'lower', triggerIndicator: 'DOJI' } };
    }
    if (rsi > rsiHigh && currentPrice >= bbUpper * 0.99) {
      return { signal: 'put', reason: `DOJI + RSI=${rsi.toFixed(1)}>${rsiHigh} + Resistencia BB`, indicators: { doji: true, rsi, rsiLevel: 'overbought', bbPosition: 'upper', triggerIndicator: 'DOJI' } };
    }
  }

  if (rsi < rsiLow) {
    return { signal: 'call', reason: `DOJI + RSI=${rsi.toFixed(1)}<${rsiLow}`, indicators: { doji: true, rsi, rsiLevel: 'oversold', triggerIndicator: 'DOJI' } };
  }
  if (rsi > rsiHigh) {
    return { signal: 'put', reason: `DOJI + RSI=${rsi.toFixed(1)}>${rsiHigh}`, indicators: { doji: true, rsi, rsiLevel: 'overbought', triggerIndicator: 'DOJI' } };
  }

  return null;
}

export function calculateATR(data: Candle[], period = 14): { time: number; atr: number | null }[] {
  if (data.length < 2) return data.map((d) => ({ time: d.time, atr: null }));

  const result: { time: number; atr: number | null }[] = [];
  const trValues: number[] = [];

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

    let atr: number | null = null;
    if (trValues.length >= period) {
      atr = trValues.slice(-period).reduce((a, b) => a + b, 0) / period;
    }
    result.push({ time: data[i].time, atr });
  }

  return result;
}
