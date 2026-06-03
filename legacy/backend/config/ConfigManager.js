import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ConfigManager {
  constructor() {
    this.config = {};
    this.defaultPath = null;
    this.localPath = null;
  }

  load() {
    this.defaultPath = path.join(__dirname, '../../config/default.json');
    this.localPath = path.join(__dirname, '../../config/local.json');

    let defaultConfig = {};
    if (fs.existsSync(this.defaultPath)) {
      try {
        const content = fs.readFileSync(this.defaultPath, 'utf-8');
        defaultConfig = JSON.parse(content);
      } catch (e) {
        console.error('[Config] Error loading default.json:', e.message);
      }
    }

    let localConfig = {};
    if (fs.existsSync(this.localPath)) {
      try {
        const content = fs.readFileSync(this.localPath, 'utf-8');
        localConfig = JSON.parse(content);
      } catch (e) {
        console.error('[Config] Error loading local.json:', e.message);
      }
    }

    this.config = this.deepMerge(defaultConfig, localConfig);

    this.applyEnvOverrides();

    this.validate();

    return this.config;
  }

  deepMerge(target, source) {
    const result = { ...target };
    for (const key in source) {
      if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }

  applyEnvOverrides() {
    const envMappings = {
      DERIV_APP_ID: 'appId',
      DERIV_DEFAULT_TIMEFRAME: 'defaultTimeframe',
      DERIV_PORT: 'server.port',
      DERIV_HOSTNAME: 'server.hostname',
    };

    for (const envKey in envMappings) {
      const configKey = envMappings[envKey];
      if (process.env[envKey]) {
        const value = process.env[envKey];
        if (configKey.includes('.')) {
          const keys = configKey.split('.');
          let obj = this.config;
          for (let i = 0; i < keys.length - 1; i++) {
            if (!obj[keys[i]]) obj[keys[i]] = {};
            obj = obj[keys[i]];
          }
          obj[keys[keys.length - 1]] = isNaN(value) ? value : parseInt(value);
        } else {
          this.config[configKey] = isNaN(value) ? value : parseInt(value);
        }
      }
    }
  }

  validate() {
    const required = ['appId', 'server'];
    for (const key of required) {
      if (!this.config[key]) {
        throw new Error(`[Config] Missing required field: ${key}`);
      }
    }
    if (!this.config.server.port) {
      this.config.server.port = 3002;
    }
    if (!this.config.server.hostname) {
      this.config.server.hostname = '0.0.0.0';
    }
  }

  get(key, defaultValue = null) {
    if (!key) return this.config;
    if (key.includes('.')) {
      const keys = key.split('.');
      let value = this.config;
      for (const k of keys) {
        if (value === undefined || value === null) return defaultValue;
        value = value[k];
      }
      return value !== undefined ? value : defaultValue;
    }
    return this.config[key] !== undefined ? this.config[key] : defaultValue;
  }

  set(key, value) {
    if (key.includes('.')) {
      const keys = key.split('.');
      let obj = this.config;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!obj[keys[i]]) obj[keys[i]] = {};
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = value;
    } else {
      this.config[key] = value;
    }
  }

  save() {
    if (!this.localPath) return;
    try {
      const dir = path.dirname(this.localPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.localPath, JSON.stringify(this.config, null, 2), 'utf-8');
    } catch (e) {
      console.error('[Config] Error saving config:', e.message);
    }
  }

  getAll() {
    return { ...this.config };
  }
}

const configManager = new ConfigManager();
configManager.load();

export default configManager;