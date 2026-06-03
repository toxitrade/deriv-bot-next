import MultiMomentumStrategy from './MultiMomentumStrategy.js';
import FastEMASMACrossoverStrategy from './FastEMASMACrossoverStrategy.js';
import AdaptiveConfluenceStrategy from './AdaptiveConfluenceStrategy.js';

const strategies = {
  'multi-momentum': MultiMomentumStrategy,
  'adaptive-confluence': AdaptiveConfluenceStrategy,
  'fast-ema-sma-cross': FastEMASMACrossoverStrategy
};

const metadata = {
  'multi-momentum': {
    name: 'Multi-Momentum',
    description: 'Estrategia multi-indicador: RSI + Stochastic + MACD + SMA + BB para alto volumen',
    defaultParams: {
      minConfirmations: 3,
      rsiPeriod: 7,
      rsiHigh: 70,
      rsiLow: 30,
      stochPeriod: 14,
      macdFast: 12,
      macdSlow: 26,
      macdSignal: 9,
      smaFast: 9,
      smaSlow: 21,
      bbPeriod: 20,
      bbStdDev: 2,
      enabled: {
        rsi: true,
        stoch: true,
        macd: true,
        sma: true,
        bb: true
      }
    }
  },
  'adaptive-confluence': {
    name: 'Adaptive Confluence',
    description: 'Confluencia adaptativa: EMA20/50 + RSI de régimen + cruce MACD + estructura Bollinger + fuerza de vela',
    defaultParams: {
      emaFast: 20,
      emaSlow: 50,
      rsiPeriod: 14,
      rsiBullMin: 45,
      rsiBullMax: 70,
      rsiBearMin: 30,
      rsiBearMax: 55,
      macdFast: 12,
      macdSlow: 26,
      macdSignal: 9,
      bbPeriod: 20,
      bbStdDev: 2,
      minScore: 3,
      coolDownCandles: 8
    }
  },
  'fast-ema-sma-cross': {
    name: 'Fast EMA/SMA Cross',
    description: 'Fast EMA/SMA cross – short periods for quick signals',
    defaultParams: {
      smaPeriod: 15,
      emaPeriod: 8
    }
  }
};

function getStrategy(name, params = {}) {
  const StrategyClass = strategies[name.toLowerCase()];
  if (!StrategyClass) {
    throw new Error(`Strategy '${name}' not found`);
  }
  return new StrategyClass(params);
}

function listStrategies() {
  return Object.keys(metadata).map(key => ({
    id: key,
    ...metadata[key]
  }));
}

function getStrategyMetadata(name) {
  return metadata[name.toLowerCase()] || null;
}

function getAvailableNames() {
  return Object.keys(strategies);
}

export default {
  getStrategy,
  listStrategies,
  getStrategyMetadata,
  getAvailableNames
};