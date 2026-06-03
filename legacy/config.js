// Trading Bot Configuration Constants
// Centralized configuration to avoid magic numbers throughout the codebase

export const CONFIG = {
  // Chart settings
  CHART: {
    DEFAULT_HEIGHT: 300,
    RSI_CHART_HEIGHT: 100,
    DEFAULT_BAR_SPACING: 8,
    MIN_BAR_SPACING: 4,
    MAX_BAR_SPACING: 50,
    DEFAULT_RIGHT_OFFSET: 24,
    DEFAULT_MIN_CANDLES: 24,
  },

  // Indicator defaults
  INDICATORS: {
    SMA_PERIOD: 23,
    EMA_PERIOD: 10,
    BB_PERIOD: 20,
    RSI_PERIOD: 7,
    STOCH_PERIOD: 14,
    MACD_FAST: 12,
    MACD_SLOW: 26,
    MACD_SIGNAL: 9,
  },

  // Signal thresholds
  THRESHOLDS: {
    RSI_HIGH: 65,
    RSI_LOW: 35,
    STOCH_OVERSOLD: 20,
    STOCH_OVERBOUGHT: 80,
    BB_STD_DEV: 2,
    DOJI_THRESHOLD: 0.3,
    MIN_CONFIRMATIONS: 3,
  },

  // Trade settings
  TRADE: {
    DEFAULT_DURATION: 60, // seconds
    VERIFICATION_DELAY: 60000, // 1 minute in ms
    MAX_SIGNAL_HISTORY: 20,
  },

  // Data limits
  DATA: {
    MAX_CANDLES: 500, // Prevent memory leaks
    MIN_CANDLES_FOR_ANALYSIS: 30,
  },

  // WebSocket settings
  WS: {
    RECONNECT_DELAY: 3000, // ms
    MAX_RECONNECT_ATTEMPTS: 10,
    PING_INTERVAL: 30000, // ms
  },

  // UI settings
  UI: {
    AUTO_SCROLL_DEFAULT: true,
    TOOLTIP_DEFAULT: true,
    SOUND_ALERT_DEFAULT: false,
  }
};

export const SYMBOLS = {
  'R_10': 'Jump 10 Index',
  'R_25': 'Jump 25 Index',
  'R_50': 'Jump 50 Index',
  'R_75': 'Jump 75 Index',
  'R_100': 'Jump 100 Index',
};

export const TIMEFRAMES = {
  '1': '1 Segundo',
  '60': '1 Minuto',
  '300': '5 Minutos',
  '900': '15 Minutos',
};