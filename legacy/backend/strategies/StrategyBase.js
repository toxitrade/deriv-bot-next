class StrategyBase {
  constructor(name, params = {}) {
    this.name = name;
    this.params = params;
    this.isActive = false;
    this.lastSignal = null;
    this.listeners = new Map();
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
        console.error(`[Strategy:${this.name}] Error in ${event} listener:`, e.message);
      }
    });
  }

  activate() {
    this.isActive = true;
    console.log(`[Strategy:${this.name}] Activated`);
    this.emit('activated', {});
  }

  deactivate() {
    this.isActive = false;
    console.log(`[Strategy:${this.name}] Deactivated`);
    this.emit('deactivated', {});
  }

  setParams(params) {
    this.params = { ...this.params, ...params };
    console.log(`[Strategy:${this.name}] Params updated:`, this.params);
    this.emit('params_changed', this.params);
  }

  analyze(candleData, indicators) {
    throw new Error('analyze() must be implemented by subclass');
  }

  getSignal() {
    return this.lastSignal;
  }

  getMetadata() {
    return {
      name: this.name,
      params: this.params,
      isActive: this.isActive
    };
  }
}

export default StrategyBase;