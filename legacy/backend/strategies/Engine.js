import strategyRegistry from './index.js';

class StrategyEngine {
  constructor() {
    this.activeStrategy = null;
    this.activeStrategyName = null;
    this.candleData = [];
    this.listeners = new Map();
    this.isRunning = false;
    this.lastSignal = null;
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  emit(event, data) {
    if (!this.listeners.has(event)) return;
    this.listeners.get(event).forEach(callback => {
      try {
        callback(data);
      } catch (e) {
        console.error('[StrategyEngine] Error in listener:', e.message);
      }
    });
  }

  setStrategy(strategyName, params = {}) {
    try {
      const strategy = strategyRegistry.getStrategy(strategyName, params);
      
      if (this.activeStrategy) {
        this.activeStrategy.deactivate();
      }
      
      this.activeStrategy = strategy;
      this.activeStrategyName = strategyName.toLowerCase();
      console.log(`[StrategyEngine] Strategy set to: ${strategyName}`);
      
      this.emit('strategy_changed', {
        name: strategyName,
        metadata: strategy.getMetadata()
      });
      
      return { success: true, metadata: strategy.getMetadata() };
    } catch (e) {
      console.error('[StrategyEngine] Error setting strategy:', e.message);
      return { success: false, error: e.message };
    }
  }

  activateStrategy() {
    if (!this.activeStrategy) {
      return { success: false, error: 'No strategy set' };
    }
    
    this.activeStrategy.activate();
    this.activeStrategy.on('signal', (signal) => {
      this.lastSignal = { ...signal, timestamp: Date.now() };
      this.emit('signal', this.lastSignal);
    });
    
    console.log('[StrategyEngine] Strategy activated');
    this.isRunning = true;
    return { success: true };
  }

  deactivateStrategy() {
    if (!this.activeStrategy) {
      return { success: false, error: 'No strategy set' };
    }
    
    this.activeStrategy.deactivate();
    console.log('[StrategyEngine] Strategy deactivated');
    this.isRunning = false;
    return { success: true };
  }

  updateParams(strategyName, params) {
    if (!this.activeStrategy) {
      return { success: false, error: 'No strategy set' };
    }

    if (!strategyName || strategyName.toLowerCase() !== this.activeStrategyName) {
      return { success: false, error: 'Strategy is not active' };
    }
    
    this.activeStrategy.setParams(params);
    return { success: true };
  }

  addCandle(candle) {
    this.candleData.push(candle);
    if (this.candleData.length > 5000) {
      this.candleData.shift();
    }
    
    this.analyze();
  }

  setHistory(candles) {
    this.candleData = [...candles];
  }

  getHistory() {
    return [...this.candleData];
  }

  analyze() {
    if (!this.activeStrategy || !this.isRunning) {
      return null;
    }
    
    if (this.candleData.length < 2) {
      return null;
    }
    
    const result = this.activeStrategy.analyze(this.candleData, {});
    return result;
  }

  runBacktest(strategyName, candles = [], params = {}) {
    const setResult = this.setStrategy(strategyName, params);
    if (!setResult.success) {
      return { success: false, error: setResult.error || 'Could not set strategy' };
    }

    if (!Array.isArray(candles) || candles.length < 2) {
      return { success: false, error: 'candles must be an array with at least 2 items' };
    }

    const normalized = candles
      .map((c) => ({
        time: Number(c.time),
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close)
      }))
      .filter((c) => Number.isFinite(c.time) && Number.isFinite(c.open) && Number.isFinite(c.high) && Number.isFinite(c.low) && Number.isFinite(c.close))
      .sort((a, b) => a.time - b.time);

    if (normalized.length < 2) {
      return { success: false, error: 'No valid candles after normalization' };
    }

    this.reset();
    this.activateStrategy();

    const signals = [];
    const warmup = 30;

    for (let i = 0; i < normalized.length; i++) {
      const slice = normalized.slice(0, i + 1);
      this.setHistory(slice);
      if (slice.length < warmup) continue;

      const result = this.analyze();
      if (!result || !result.signal) continue;

      const last = slice[slice.length - 1];
      signals.push({
        time: last.time,
        type: String(result.signal).toUpperCase(),
        price: last.close,
        strategyId: strategyName,
        source: 'backend-backtest',
        reason: result.reason || '',
        indicators: result.indicators || {}
      });
    }

    this.deactivateStrategy();

    return {
      success: true,
      strategyId: strategyName,
      processed: normalized.length,
      signals,
      stats: {
        signalsCount: signals.length,
        callCount: signals.filter((s) => s.type === 'CALL').length,
        putCount: signals.filter((s) => s.type === 'PUT').length
      }
    };
  }

  getActiveStrategy() {
    return this.activeStrategy ? this.activeStrategy.getMetadata() : null;
  }

  getLastSignal() {
    return this.lastSignal;
  }

  getState() {
    return {
      isRunning: this.isRunning,
      strategy: this.getActiveStrategy(),
      lastSignal: this.lastSignal,
      dataPoints: this.candleData.length
    };
  }

  reset() {
    this.candleData = [];
    this.lastSignal = null;
    if (this.activeStrategy) {
      this.activeStrategy.reset();
    }
  }
}

export default StrategyEngine;