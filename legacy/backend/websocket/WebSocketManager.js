import WebSocket from 'ws';
import configManager from '../config/ConfigManager.js';

class WebSocketManager {
  constructor(options = {}) {
    this.appId = options.appId || configManager.get('appId') || '1089';
    this.token = options.token || null;
    this.symbol = options.symbol || configManager.get('symbols')[0] || 'R_25';
    this.granularity = options.granularity || configManager.get('defaultTimeframe') || 60;
    
    this.ws = null;
    this.isConnected = false;
    this.isConnecting = false;
    
    this.reconnectEnabled = configManager.get('websocket.reconnect', true);
    this.maxRetries = configManager.get('websocket.maxRetries', 10);
    this.heartbeatInterval = configManager.get('websocket.heartbeatInterval', 30000);
    
    this.retryCount = 0;
    this.retryTimeout = null;
    this.heartbeatTimer = null;
    this.lastPingTime = 0;
    
    this.messageBuffer = [];
    this listeners = new Map();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;
    const callbacks = this.listeners.get(event);
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  emit(event, data) {
    if (!this.listeners.has(event)) return;
    this.listeners.get(event).forEach(callback => {
      try {
        callback(data);
      } catch (e) {
        console.error(`[WebSocket] Error in ${event} listener:`, e.message);
      }
    });
  }

  connect() {
    if (this.isConnecting || this.isConnected) {
      console.log('[WebSocket] Already connected or connecting');
      return;
    }

    this.isConnecting = true;
    this.emit('connecting', { appId: this.appId });

    const url = `wss://ws.binaryws.com/websockets/v3?app_id=${this.appId}`;
    console.log(`[WebSocket] Connecting to ${url}`);

    try {
      this.ws = new WebSocket(url);

      this.ws.on('open', () => {
        console.log('[WebSocket] Connected');
        this.isConnected = true;
        this.isConnecting = false;
        this.retryCount = 0;
        
        this.startHeartbeat();
        this.flushMessageBuffer();
        this.emit('open', {});

        if (this.token) {
          this.send({ authorize: this.token });
        }

        this.subscribeOHLC();
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (e) {
          console.error('[WebSocket] Error parsing message:', e.message);
        }
      });

      this.ws.on('close', () => {
        console.log('[WebSocket] Disconnected');
        this.isConnected = false;
        this.isConnecting = false;
        this.stopHeartbeat();
        this.emit('close', {});

        if (this.reconnectEnabled && this.retryCount < this.maxRetries) {
          this.scheduleReconnect();
        }
      });

      this.ws.on('error', (error) => {
        console.error('[WebSocket] Error:', error.message);
        this.isConnecting = false;
        this.emit('error', { error });
      });

      this.ws.on('ping', () => {
        this.lastPingTime = Date.now();
      });

      this.ws.on('pong', () => {
        this.lastPingTime = Date.now();
      });

    } catch (e) {
      console.error('[WebSocket] Connection error:', e.message);
      this.isConnecting = false;
      this.emit('error', { error: e });
    }
  }

  disconnect() {
    this.reconnectEnabled = false;
    this.stopHeartbeat();
    
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.isConnected = false;
    this.isConnecting = false;
    console.log('[WebSocket] Disconnected manually');
  }

  send(message) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      if (this.messageBuffer.length < 100) {
        this.messageBuffer.push(message);
      }
      return false;
    }

    try {
      this.ws.send(JSON.stringify(message));
      return true;
    } catch (e) {
      console.error('[WebSocket] Send error:', e.message);
      return false;
    }
  }

  flushMessageBuffer() {
    while (this.messageBuffer.length > 0) {
      const message = this.messageBuffer.shift();
      this.send(message);
    }
  }

  scheduleReconnect() {
    this.retryCount++;
    const delay = Math.min(1000 * Math.pow(2, this.retryCount - 1), 30000);
    
    console.log(`[WebSocket]Scheduling reconnect attempt ${this.retryCount}/${this.maxRetries} in ${delay}ms`);
    this.emit('reconnecting', { attempt: this.retryCount, delay });

    this.retryTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  startHeartbeat() {
    this.lastPingTime = Date.now();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        if (Date.now() - this.lastPingTime > 10000) {
          console.log('[WebSocket] No pong received, reconnecting...');
          this.ws.close();
        } else {
          this.ws.ping();
        }
      }
    }, this.heartbeatInterval);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  handleMessage(message) {
    this.emit('message', message);

    if (message.msg_type === 'candles' && message.candles) {
      this.emit('history', {
        symbol: this.symbol,
        candles: message.candles,
        granularity: this.granularity
      });
    }

    if (message.msg_type === 'ohlc' && message.ohlc) {
      this.emit('candle', {
        symbol: this.symbol,
        ohlc: message.ohlc,
        granularity: this.granularity
      });
    }

    if (message.msg_type === 'error') {
      this.emit('api_error', { error: message.error });
    }
  }

  requestHistory(start = null) {
    if (!start) {
      start = Math.floor(Date.now() / 1000) - 3600;
    }

    const request = {
      ticks_history: this.symbol,
      end: 'latest',
      start: start,
      style: 'candles',
      granularity: this.granularity
    };

    console.log('[WebSocket] Requesting history:', request);
    return this.send(request);
  }

  subscribeOHLC() {
    const request = {
      ticks_history: this.symbol,
      subscribe: 1,
      end: 'latest',
      granularity: this.granularity,
      style: 'candles'
    };

    console.log('[WebSocket] Subscribing to OHLC:', request);
    this.send({ forget_all: 'ohlc' });
    return this.send(request);
  }

  setSymbol(symbol) {
    this.symbol = symbol;
    if (this.isConnected) {
      this.subscribeOHLC();
    }
  }

  setGranularity(granularity) {
    this.granularity = granularity;
    if (this.isConnected) {
      this.subscribeOHLC();
    }
  }

  setToken(token) {
    this.token = token;
    if (this.isConnected) {
      this.send({ authorize: token });
    }
  }

  getState() {
    return {
      connected: this.isConnected,
      connecting: this.isConnecting,
      retryCount: this.retryCount,
      symbol: this.symbol,
      granularity: this.granularity
    };
  }
}

export default WebSocketManager;