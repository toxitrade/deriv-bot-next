import { calculateSMA, calculateEMA, calculateRSI, calculateBB, calculateStochastic, calculateMACD } from '../frontend/js/modules/indicators.js';
import { analyzeMultiIndicators, detectDojiSignal } from '../frontend/js/modules/multi-indicators.js';
import { CONFIG } from './config.js';


// ============================================
// State Management - Centralized State Object
// ============================================
const state = {
  // Connection state
  ws: null,
  isConnected: false,
  reconnectAttempts: 0,
  lastConnectedTime: null,
  
  // Market data
  currentSymbol: 'R_25',
  dataHistory: [],
  
  // Trade signals
  signalHistory: [],
  callCount: 0,
  putCount: 0,
  winCount: 0,
  loseCount: 0,
  pendingSignals: [],
  signalTimeouts: {},
  positionOpen: false,
  positionTimer: null,
  positionTimeLeft: 60,
  activeIndicator: null,
  activeSignalType: null,
  updateInterval: null,
};

// Legacy globals for backward compatibility
let priceChart, rsiChart, candleSeries, smaSeries, emaSeries, bbUpperSeries, bbMiddleSeries, bbLowerSeries, rsiSeries, stochSeries, macdSeries, macdSignalSeries;
let ws = null, isConnected = false, dataHistory = [];
let currentSymbol = 'R_25';

// Analysis tab globals
let currentTab = 'trade';
let analysisMarks = [];
let tradingMarkers = [];
let analysisMarkType = 'up';
let analysisAutoSignals = [];
let isLoadingStrategy = false;

const chartOptions = {
    layout: { backgroundColor: '#0d1117', textColor: '#e6edf3' },
    grid: { 
        vertLines: { color: '#21262d', style: 1 }, 
        horzLines: { color: '#21262d', style: 1 },
        crossings: false
    },
    crosshair: { 
        mode: LightweightCharts.CrosshairMode.Normal, 
        vertLine: { color: '#58a6ff', width: 1, style: 0, labelBackgroundColor: '#1f6feb' }, 
        horzLine: { color: '#58a6ff', width: 1, style: 0, labelBackgroundColor: '#1f6feb' } 
    },
    rightPriceScale: { 
        borderColor: '#30363d',
        scaleMargins: { top: 0.1, bottom: 0.1 }
    },
    timeScale: { 
        borderColor: '#30363d',
        timeVisible: true, 
        secondsVisible: true, 
        visible: true,
        rightOffset: 24,
        barSpacing: 8
    },
    handleScale: { axisPressedMouseMove: true },
    handleScroll: { vertTouchDrag: false }
};


function initCharts() {
    const pContainer = document.getElementById('price-chart');
    const rContainer = document.getElementById('rsi-chart');
    
    pContainer.innerHTML = `
        <div class="chart-label">${document.getElementById('symbol').value} INDEX</div>
        <div class="chart-controls">
            <button id="zoom-out">-</button>
            <button id="zoom-in">+</button>
            <button id="fit-content">⊡</button>
            <button id="toggle-results">📊</button>
        </div>`;
    rContainer.innerHTML = '<div class="chart-label">RSI / MACD</div>';

    pContainer.style.minHeight = '300px';
    rContainer.style.minHeight = '100px';

    document.getElementById('zoom-in').onclick = () => {
        const pOpts = priceChart.timeScale().options();
        const newBarSpacing = Math.min(50, (pOpts.barSpacing || 8) + 2);
        priceChart.timeScale().applyOptions({ barSpacing: newBarSpacing });
        rsiChart.timeScale().applyOptions({ barSpacing: newBarSpacing });
    };
    document.getElementById('zoom-out').onclick = () => {
        const pOpts = priceChart.timeScale().options();
        const newBarSpacing = Math.max(4, (pOpts.barSpacing || 8) - 2);
        priceChart.timeScale().applyOptions({ barSpacing: newBarSpacing });
        rsiChart.timeScale().applyOptions({ barSpacing: newBarSpacing });
    };
    document.getElementById('fit-content').onclick = () => {
        priceChart.timeScale().fitContent();
        rsiChart.timeScale().fitContent();
        const minCandles = parseInt(document.getElementById('min-candles').value) || 24;
        setTimeout(() => {
            const pOpts = priceChart.timeScale().options();
            priceChart.timeScale().applyOptions({ rightOffset: clampZoom(minCandles), barSpacing: 8 });
            rsiChart.timeScale().applyOptions({ rightOffset: clampZoom(minCandles), barSpacing: 8 });
        }, 50);
    };

    priceChart = LightweightCharts.createChart(pContainer, { ...chartOptions, height: pContainer.clientHeight || 300 });
    rsiChart = LightweightCharts.createChart(rContainer, { ...chartOptions, height: rContainer.clientHeight || 100 });

    smaSeries = priceChart.addLineSeries({ color: '#2962ff', lineWidth: 1, title: 'SMA' });
    emaSeries = priceChart.addLineSeries({ color: '#f23645', lineWidth: 1, title: 'EMA' });
    bbUpperSeries = priceChart.addLineSeries({ color: '#00bcd4', lineWidth: 1, lineStyle: 0, title: 'BB Upper' });
    bbMiddleSeries = priceChart.addLineSeries({ color: 'rgba(0,188,212,0.3)', lineWidth: 1, lineStyle: 2, title: 'BB Middle' });
    bbLowerSeries = priceChart.addLineSeries({ color: '#00bcd4', lineWidth: 1, lineStyle: 0, title: 'BB Lower' });
    
    candleSeries = priceChart.addCandlestickSeries({
        upColor: '#089981', downColor: '#f23645',
        borderVisible: false, wickUpColor: '#089981', wickDownColor: '#f23645',
    });

    rsiSeries = rsiChart.addLineSeries({ color: '#ff9800', lineWidth: 1, title: 'RSI' });
    stochSeries = rsiChart.addLineSeries({ color: '#9c27b0', lineWidth: 1, title: 'Stoch' });
    macdSeries = rsiChart.addLineSeries({ color: '#2196f3', lineWidth: 1, title: 'MACD' });
    macdSignalSeries = rsiChart.addLineSeries({ color: '#ff5722', lineWidth: 1, title: 'Signal' });

    const highLevel = parseFloat(document.getElementById('rsi-high').value) || 65;
    const lowLevel = parseFloat(document.getElementById('rsi-low').value) || 35;
    
    rsiSeries.createPriceLine({ price: highLevel, color: '#f23645', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'HIGH' });
    rsiSeries.createPriceLine({ price: lowLevel, color: '#089981', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'LOW' });

    setupCrosshair();
}

function setupCrosshair() {
    const tooltip = document.getElementById('tooltip');
    const showTooltip = document.getElementById('show-tooltip');
    
    priceChart.subscribeCrosshairMove(param => {
        if (!showTooltip.checked || !param.time || !param.seriesData.get(candleSeries)) {
            tooltip.style.display = 'none';
            return;
        }
        
        const data = param.seriesData.get(candleSeries);
        if (data) {
            const date = new Date(param.time * 1000);
            tooltip.querySelector('.tt-time').textContent = date.toLocaleString();
            tooltip.querySelector('.tt-open').textContent = data.open.toFixed(2);
            tooltip.querySelector('.tt-high').textContent = data.high.toFixed(2);
            tooltip.querySelector('.tt-low').textContent = data.low.toFixed(2);
            tooltip.querySelector('.tt-close').textContent = data.close.toFixed(2);
            
            const chartRect = document.getElementById('price-chart').getBoundingClientRect();
            let x = param.point.x + 15;
            let y = param.point.y + 15;
            if (x + 120 > chartRect.width) x = param.point.x - 130;
            if (y + 100 > chartRect.height) y = param.point.y - 110;
            
            tooltip.style.left = x + 'px';
            tooltip.style.top = y + 'px';
            tooltip.style.display = 'block';
        }
    });
}

function updateIndicators() {
    if (dataHistory.length < 2) return;
    try {
        const smaP = parseInt(document.getElementById('sma-period').value) || 9;
        const emaP = parseInt(document.getElementById('ema-period').value) || 10;
        const rsiP = parseInt(document.getElementById('rsi-period').value) || 7;
        const rsiHigh = parseFloat(document.getElementById('rsi-high').value) || 70;
        const rsiLow = parseFloat(document.getElementById('rsi-low').value) || 30;
        const bbP = parseInt(document.getElementById('bb-period').value) || 20;

        const smaData = document.getElementById('sma-enabled').checked ? calculateSMA(dataHistory, smaP).filter(d => d.value !== null) : [];
        const emaData = document.getElementById('ema-enabled').checked ? calculateEMA(dataHistory, emaP) : [];
        const rsiData = document.getElementById('rsi-enabled').checked ? calculateRSI(dataHistory, rsiP).filter(d => d.value !== null) : [];
        const bb = document.getElementById('bb-enabled').checked ? calculateBB(dataHistory, bbP) : { upper: [], middle: [], lower: [] };

        const stochP = parseInt(document.getElementById('stoch-period')?.value) || 14;
        const stochData = calculateStochastic(dataHistory, stochP);
        const macdData = calculateMACD(dataHistory, 12, 26, 9);

        if (smaSeries) smaSeries.setData(smaData);
        if (emaSeries) emaSeries.setData(emaData);
        if (bbUpperSeries) bbUpperSeries.setData(bb.upper.filter(d => d.value !== null));
        if (bbMiddleSeries) bbMiddleSeries.setData(bb.middle?.filter(d => d.value !== null) || []);
        if (bbLowerSeries) bbLowerSeries.setData(bb.lower.filter(d => d.value !== null));
        
        if (rsiSeries) {
            if (document.getElementById('rsi-enabled').checked) {
                rsiSeries.setData(rsiData);
                rsiSeries.applyOptions({ visible: true });
            } else {
                rsiSeries.applyOptions({ visible: false });
            }
        }

        if (stochSeries) {
            const stochPlot = stochData.map(d => ({ time: d.time, value: d.k }));
            stochSeries.setData(stochPlot.filter(d => d.value !== null));
        }

        if (macdSeries && macdSignalSeries) {
            const validMacd = macdData.filter(d => d.macd !== null);
            if (validMacd.length > 0) {
                const macdValues = validMacd.map(d => d.macd);
                const signalValues = validMacd.map(d => d.signal);
                const allValues = [...macdValues, ...signalValues];
                const minVal = Math.min(...allValues);
                const maxVal = Math.max(...allValues);
                const range = maxVal - minVal || 1;
                
                const normalize = (v) => ((v - minVal) / range) * 100;
                
                const macdPlot = macdData.map(d => ({ time: d.time, value: d.macd !== null ? normalize(d.macd) : null })).filter(d => d.value !== null);
                const signalPlot = macdData.map(d => ({ time: d.time, value: d.signal !== null ? normalize(d.signal) : null })).filter(d => d.value !== null);
                
                macdSeries.setData(macdPlot);
                macdSignalSeries.setData(signalPlot);
            }
        }

        const lastSma = smaData.length > 0 ? smaData[smaData.length - 1].value : null;
        const lastEma = emaData.length > 0 ? emaData[emaData.length - 1] : null;
        const lastRsi = rsiData.length > 0 ? rsiData[rsiData.length - 1].value : null;
        const lastBbUpper = bb.upper.length > 0 ? bb.upper[bb.upper.length - 1].value : null;
        const lastBbLower = bb.lower.length > 0 ? bb.lower[bb.lower.length - 1].value : null;
        const lastStochK = stochData.length > 0 ? stochData[stochData.length - 1].k : null;
        const lastMacd = macdData.length > 0 ? macdData[macdData.length - 1].macd : null;

        const els = (id) => document.getElementById(id);
        if (els('val-sma')) els('val-sma').textContent = lastSma !== null ? lastSma.toFixed(2) : '--';
        if (els('val-ema')) els('val-ema').textContent = lastEma !== null ? lastEma.toFixed(2) : '--';
        if (els('val-rsi')) els('val-rsi').textContent = lastRsi !== null ? lastRsi.toFixed(2) : '--';
        if (els('val-bb')) els('val-bb').textContent = lastBbUpper !== null && lastBbLower !== null ? `${lastBbLower.toFixed(1)}-${lastBbUpper.toFixed(1)}` : '--';
        if (els('val-stoch')) els('val-stoch').textContent = lastStochK !== null ? lastStochK.toFixed(1) : '--';
        if (els('val-macd')) els('val-macd').textContent = lastMacd !== null ? lastMacd.toFixed(2) : '--';

        const config = {
            minConfirmations: parseInt(document.getElementById('min-confirmations')?.value) || 3,
            rsiPeriod: rsiP,
            rsiHigh: rsiHigh,
            rsiLow: rsiLow,
            stochPeriod: stochP,
            smaFast: smaP,
            smaSlow: parseInt(document.getElementById('sma-slow')?.value) || 21,
            bbPeriod: bbP,
            bbStdDev: parseFloat(document.getElementById('bb-stddev')?.value) || 2,
            enabled: {
                rsi: document.getElementById('rsi-enabled').checked,
                stoch: document.getElementById('stoch-enabled')?.checked ?? true,
                macd: document.getElementById('macd-enabled')?.checked ?? true,
                sma: document.getElementById('sma-enabled').checked,
                bb: document.getElementById('bb-enabled').checked
            }
        };

        // If the selected strategy is fast EMA/SMA cross, compute signal directly
        const strategyId = document.getElementById('strategy-trade')?.value || '';
        if (strategyId === 'fast-ema-sma-cross') {
            // Compute EMA and SMA values (same as in FastEMASMACrossoverStrategy)
            const sma = calculateSMA(dataHistory, smaP);
            const ema = calculateEMA(dataHistory, emaP);
            if (sma && ema && sma.length > 0 && ema.length > 0) {
                const lastSma = sma[sma.length - 1].value;
                const lastEma = ema[ema.length - 1];
                const prevSma = sma.length > 1 ? sma[sma.length - 2].value : null;
                const prevEma = ema.length > 1 ? ema[ema.length - 2] : null;
                let signal = null;
                let reason = '';
                if (prevSma !== null && prevEma !== null) {
                    const crossUp = prevEma <= prevSma && lastEma > lastSma;
                    const crossDown = prevEma >= prevSma && lastEma < lastSma;
                    if (crossUp) {
                        signal = 'call';
                        reason = `EMA crossed above SMA (${lastEma.toFixed(2)} > ${lastSma.toFixed(2)})`;
                    } else if (crossDown) {
                        signal = 'put';
                        reason = `EMA crossed below SMA (${lastEma.toFixed(2)} < ${lastSma.toFixed(2)})`;
                    }
                }
                if (signal) {
                    const lastCandle = dataHistory[dataHistory.length - 1];
                    processMultiSignals({
                        signal,
                        reason,
                        indicators: {
                            sma: lastSma,
                            ema: lastEma,
                            bullishCount: signal === 'call' ? 1 : 0,
                            bearishCount: signal === 'put' ? 1 : 0,
                            activeIndicators: 2
                        }
                    });
                    return; // Skip the rest of updateIndicators for this strategy
                }
            }
            // If no signal, log a waiting message and exit
            addLog('EMA: esperando cruce');
            return; // Skip the rest of updateIndicators for this strategy
        }

        // Existing Multi‑Momentum / Doji logic
        const momentumResult = analyzeMultiIndicators(dataHistory, config);
        const dojiConfig = { dojiThreshold: 0.3, rsiPeriod: rsiP, rsiLow: rsiLow, rsiHigh: rsiHigh, useBB: true, bbPeriod: bbP };
        const dojiResult = detectDojiSignal(dataHistory[dataHistory.length - 1], dataHistory, dojiConfig);

        if (momentumResult.signal) {
            processMultiSignals(momentumResult);
        } else if (dojiResult && dojiResult.signal) {
            processMultiSignals(dojiResult);
        } else {
            const waitReason = `M: ${momentumResult.indicators?.bullishCount || 0}/${config.minConfirmations}${dojiResult ? ' | D:esperando' : ''}`;
            addLog(waitReason);
        }
    } catch (error) { console.warn('Indicator error:', error); }
}

function processMultiSignals(result) {
    if (positionOpen) {
        return;
    }
    
    if (candleSeries && dataHistory.length > 0) {
        const lastCandle = dataHistory[dataHistory.length - 1];
        const signalTime = lastCandle.time;
        const entryPrice = lastCandle.close;
        const signalType = result.signal;
        const color = signalType === 'call' ? '#089981' : '#f23645';
        
        positionOpen = true;
        activeSignalType = signalType;
        
        activeIndicator = result.indicators?.triggerIndicator || null;
        if (activeIndicator) {
            highlightIndicator(activeIndicator, true);
            updateIndicatorLed(activeIndicator, signalType);
        }
        
        const signalId = Date.now();
        
        showPositionTimer(signalType, entryPrice);
        tradingMarkers.push({
            time: signalTime,
            position: 'aboveBar',
            color: color,
            shape: signalType === 'call' ? 'arrowUp' : 'arrowDown',
            text: signalType,
            labelTextColor: signalType === 'call' ? '#089981' : '#f23645',
            labelBackgroundColor: signalType === 'call' ? '#089981' : '#f23645',
        });
        candleSeries.setMarkers(tradingMarkers);
        addLog(`¡SEÑAL ${signalType.toUpperCase()}! ${result.reason}`, signalType);
        
        signalHistory.unshift({ type: signalType, time: signalTime, price: entryPrice, reason: result.reason, verified: false });
        if (signalHistory.length > 20) signalHistory.pop();
        
        if (signalType === 'call') callCount++; else putCount++;
        updateResults();
        
        pendingSignals.push({ id: signalId, type: signalType, time: signalTime, entryPrice: entryPrice });
        
        addLog(`⏱️ Verificando en 1min... (ID: ${signalId})`);
        
        signalTimeouts[signalId] = setTimeout(() => {
            verifySignal(signalId, signalType, entryPrice, signalTime);
        }, 60000);
        
        if (document.getElementById('sound-alert').checked) {
            try { new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU').play().catch(() => {}); } catch (e) {}
        }
    }
}

function verifySignal(signalId, signalType, entryPrice, signalTime) {
    const index = pendingSignals.findIndex(s => s.id === signalId);
    if (index === -1) return;
    
    const signal = pendingSignals[index];
    pendingSignals.splice(index, 1);
    delete signalTimeouts[signalId];
    
    if (dataHistory.length < 2) {
        addLog(`⚠️ Verificación ${signalId}: Sin datos para verificar`, 'put');
        return;
    }
    
    const currentPrice = dataHistory[dataHistory.length - 1].close;
    const priceChange = currentPrice - entryPrice;
    const priceChangePct = (priceChange / entryPrice) * 100;
    
    let success = false;
    let resultText = '';
    
    if (signalType === 'call') {
        success = currentPrice > entryPrice;
        resultText = success ? `✅ WIN (+${priceChangePct.toFixed(2)}%)` : `❌ LOSE (${priceChangePct.toFixed(2)}%)`;
    } else {
        success = currentPrice < entryPrice;
        resultText = success ? `✅ WIN (${priceChangePct.toFixed(2)}%)` : `❌ LOSE (+${priceChangePct.toFixed(2)}%)`;
    }
    
    addLog(`🔍 ${resultText} | Entry: ${entryPrice.toFixed(2)} → Exit: ${currentPrice.toFixed(2)}`, success ? 'call' : 'put');
    
    const resultColor = success ? '#089981' : '#f23645';
    const resultShape = success ? 'check' : 'cross';
    
    const markers = candleSeries.markers();
    markers.push({
        time: dataHistory[dataHistory.length - 1].time,
        position: 'aboveBar',
        color: resultColor,
        shape: resultShape,
        text: success ? '✓' : '✗'
    });
    candleSeries.setMarkers(markers);
    
    const histIndex = signalHistory.findIndex(s => s.time === signalTime && s.type === signalType);
    if (histIndex !== -1) {
        signalHistory[histIndex].verified = true;
        signalHistory[histIndex].success = success;
        signalHistory[histIndex].exitPrice = currentPrice;
        signalHistory[histIndex].result = resultText;
    }
    
    if (success) winCount++; else loseCount++;
    positionOpen = false;
    hidePositionTimer();
    updateResults();
}

document.getElementById('connect-btn')?.addEventListener('click', () => {
    if (!isConnected) connect();
});

document.getElementById('load-token-btn')?.addEventListener('click', () => {
    document.getElementById('token-file')?.click();
});
document.getElementById('token-file')?.addEventListener('change', (e) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        const token = reader.result?.toString().trim();
        if (token) document.getElementById('api-token').value = token;
    };
    reader.readAsText(file);
});

document.getElementById('stop-btn')?.addEventListener('click', () => {
    if (isConnected) disconnect();
});

document.getElementById('start-btn').addEventListener('click', () => {
    if (isConnected) {
        disconnect();
    } else {
        connect();
    }
});

window.startBot = function() {
    if (!isConnected) connect();
};
window.disconnectBot = function() {
    if (isConnected) disconnect();
};

function connect() {
    // Input validation
    const appIdInput = document.getElementById('app-id').value;
    const tokenInput = document.getElementById('api-token').value;
    const symbolInput = document.getElementById('symbol').value;
    const timeframeInput = document.getElementById('timeframe').value;
    
    // Validate required fields
    if (!appIdInput || appIdInput.trim() === '') {
        addLog('Error: Ingrese un App ID válido', 'put');
        return;
    }
    
    if (!/^\d+$/.test(appIdInput.trim())) {
        addLog('Error: App ID debe ser numérico', 'put');
        return;
    }
    
    const appId = appIdInput.trim();
    const token = tokenInput ? tokenInput.trim() : '';
    const granularity = parseInt(timeframeInput) || 60;
    currentSymbol = symbolInput;

    addLog(`Conectando a ${currentSymbol} (${appId})...`);
    
    const wsUrl = `wss://ws.binaryws.com/websockets/v3?app_id=${appId}`;
    
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        addLog('WebSocket abierto. Solicitando historial...');
        initCharts();
        document.getElementById('api-token').parentElement.style.display = 'none';
        document.getElementById('app-id').parentElement.style.display = 'none';
        document.getElementById('start-btn').style.display = 'none';
        
        if (token) ws.send(JSON.stringify({ authorize: token }));
        else requestHistory();
    };

    ws.onmessage = (msg) => {
        try {
            const res = JSON.parse(msg.data);
            
            if (res.msg_type === 'authorize') {
                if (res.error) addLog('Token error: ' + res.error.message, 'put');
                else { addLog('Autorizado.'); requestHistory(); }
            }
            if (res.msg_type === 'error') {
                addLog('API: ' + (res.error?.message || JSON.stringify(res)), 'put');
            }
            if (res.msg_type === 'candles') {
                const validCandles = res.candles.map(c => ({
                    time: parseInt(c.epoch), open: parseFloat(c.open), high: parseFloat(c.high),
                    low: parseFloat(c.low), close: parseFloat(c.close)
                })).filter(c => c.time && c.open > 0 && c.high >= Math.max(c.open, c.close) && c.low <= Math.min(c.open, c.close));

                if (validCandles.length > 0) {
                    dataHistory = validCandles;
                    resetTickCrossState();
                    // Memory management: limit dataHistory to prevent unbounded growth
                    const maxCandles = CONFIG.DATA.MAX_CANDLES || 500;
                    if (dataHistory.length > maxCandles) {
                        dataHistory = dataHistory.slice(-maxCandles);
                    }
                    candleSeries.setData(dataHistory);
                    if (analysisChartsReady) updateAnalysisCharts();
                    applyMinCandles();
                    updateIndicators();
                    subscribeOHLC();
                    isConnected = true;
                    if (updateInterval) clearInterval(updateInterval);
                    updateInterval = setInterval(() => {
                        if (isConnected && dataHistory.length > 0) {
                            updateIndicators();
                            if (analysisChartsReady && currentTab === 'analysis') updateAnalysisIndicators();
                        }
                    }, 1000);
                    addLog(`Cargado: ${dataHistory.length} velas`);
                }
            }
            if (res.msg_type === 'ohlc') {
                const o = res.ohlc;
                const candle = { time: parseInt(o.open_time), open: parseFloat(o.open), high: parseFloat(o.high), low: parseFloat(o.low), close: parseFloat(o.close) };
                if (candle.time && candle.open > 0) {
                    const isNewCandle = dataHistory.length === 0 || dataHistory[dataHistory.length - 1].time !== candle.time;
                    if (candleSeries) candleSeries.update(candle);
                    if (analysisChartsReady && currentTab === 'analysis') {
                        if (analysisCandleSeries) analysisCandleSeries.update(candle);
                        updateAnalysisIndicators();
                    }
                    if (dataHistory.length > 0 && dataHistory[dataHistory.length - 1].time === candle.time) {
                        dataHistory[dataHistory.length - 1] = candle;
                    } else {
                        dataHistory.push(candle);
                        if (dataHistory.length > 5000) dataHistory.shift();
                    }
                    updateIndicators();
                    if (isNewCandle && document.getElementById('auto-scroll').checked) {
                        scrollToEnd();
                    }
                }
            }
            if (res.msg_type === 'tick') {
                const tickPrice = parseFloat(res.tick?.quote);
                if (Number.isFinite(tickPrice)) {
                    evaluateTickAgainstLastCandle(tickPrice);
                }
            }
        } catch (e) { console.error('[WS] Parse error:', e); }
    };

    ws.onerror = (e) => {
        console.error('[WS] onerror:', e);
        addLog('Error de conexión: ' + (e.message || 'No se pudo conectar'), 'put');
    };
    ws.onclose = (e) => {
        addLog('Desconectado (' + e.code + ')', 'put');
        isConnected = false;
        state.isConnected = false;
        if (updateInterval) { clearInterval(updateInterval); updateInterval = null; }
        
        // Auto-reconnection logic
        if (e.code !== 1000 && state.reconnectAttempts < CONFIG.WS.MAX_RECONNECT_ATTEMPTS) {
            state.reconnectAttempts++;
            const delay = CONFIG.WS.RECONNECT_DELAY * state.reconnectAttempts;
            addLog(`Reconectando en ${delay/1000}s... (intento ${state.reconnectAttempts})`);
            setTimeout(() => {
                const token = document.getElementById('api-token').value;
                const appId = document.getElementById('app-id').value || '1089';
                if (token && appId) connect(token, appId);
            }, delay);
        } else if (state.reconnectAttempts >= CONFIG.WS.MAX_RECONNECT_ATTEMPTS) {
            addLog('Máximo de intentos alcanzado. Recargue la página.', 'put');
        }
    };
}

function disconnect() {
    if (ws) ws.close();
    isConnected = false;
    if (updateInterval) { clearInterval(updateInterval); updateInterval = null; }
}

function requestHistory() {
    const gran = parseInt(document.getElementById('timeframe').value) || 60;
    ws.send(JSON.stringify({ ticks_history: currentSymbol, end: 'latest', start: Math.floor(Date.now() / 1000) - 7200, style: 'candles', granularity: gran }));
}

let lastTickPrice = null;
let lastTickSignalSide = null;

function resetTickCrossState() {
    lastTickPrice = dataHistory.length > 0 ? dataHistory[dataHistory.length - 1].close : null;
    lastTickSignalSide = null;
    positionOpen = false;
}

function subscribeOHLC() {
    const gran = parseInt(document.getElementById('timeframe').value) || 60;
    ws.send(JSON.stringify({ forget_all: 'ohlc' }));
    ws.send(JSON.stringify({ ticks_history: currentSymbol, subscribe: 1, end: 'latest', granularity: gran, style: 'candles' }));
    ws.send(JSON.stringify({ ticks: currentSymbol, subscribe: 1 }));
}

function evaluateTickAgainstLastCandle(tickPrice) {
    const strategyId = document.getElementById('strategy-trade')?.value || '';
    if (strategyId !== 'fast-ema-sma-cross') return;

    const smaP = parseInt(document.getElementById('sma-period')?.value) || 15;
    const emaP = parseInt(document.getElementById('ema-period')?.value) || 8;
    const closedCandles = dataHistory.length > 1 ? dataHistory.slice(0, -1) : [];
    const minCandles = Math.max(smaP, emaP);
    if (closedCandles.length < minCandles) {
        addLog('EMA tick: esperando más velas cerradas');
        return;
    }

    const sma = calculateSMA(closedCandles, smaP);
    const ema = calculateEMA(closedCandles, emaP);
    if (!sma || !ema || sma.length === 0 || ema.length === 0) return;

    const lastSma = sma[sma.length - 1].value;
    const lastEma = ema[ema.length - 1];
    const prevTick = lastTickPrice;
    lastTickPrice = tickPrice;
    addLog(`EMA tick: ${tickPrice.toFixed(2)} | EMA ${lastEma.toFixed(2)} | SMA ${lastSma.toFixed(2)}`);

    let signal = null;
    let reason = '';

    if (prevTick !== null) {
        const wasAbove = prevTick > lastEma && prevTick > lastSma;
        const wasBelow = prevTick < lastEma && prevTick < lastSma;
        const isAbove = tickPrice > lastEma && tickPrice > lastSma;
        const isBelow = tickPrice < lastEma && tickPrice < lastSma;

        if (wasBelow && isAbove && lastTickSignalSide !== 'call') {
            signal = 'call';
            reason = `Tick cruzó arriba de EMA/SMA (${tickPrice.toFixed(2)} > ${lastEma.toFixed(2)} / ${lastSma.toFixed(2)})`;
            lastTickSignalSide = 'call';
        } else if (wasAbove && isBelow && lastTickSignalSide !== 'put') {
            signal = 'put';
            reason = `Tick cruzó abajo de EMA/SMA (${tickPrice.toFixed(2)} < ${lastEma.toFixed(2)} / ${lastSma.toFixed(2)})`;
            lastTickSignalSide = 'put';
        } else if (isAbove) {
            lastTickSignalSide = 'call';
        } else if (isBelow) {
            lastTickSignalSide = 'put';
        }
    }

    if (signal) {
        processMultiSignals({
            signal,
            reason,
            indicators: {
                sma: lastSma,
                ema: lastEma,
                bullishCount: signal === 'call' ? 1 : 0,
                bearishCount: signal === 'put' ? 1 : 0,
                activeIndicators: 2
            }
        });
    }
}

const ZOOM_LIMIT = { min: 10, max: 200 };

function clampZoom(offset) {
    return Math.max(ZOOM_LIMIT.min, Math.min(ZOOM_LIMIT.max, offset));
}

function applyMinCandles() {
    if (dataHistory.length > 0 && priceChart) {
        const minCandles = parseInt(document.getElementById('min-candles').value) || 24;
        const offset = clampZoom(minCandles);
        priceChart.timeScale().applyOptions({ rightOffset: offset });
    }
}

function scrollToEnd() {
    if (dataHistory.length > 0 && priceChart) {
        const minCandles = parseInt(document.getElementById('min-candles').value) || 24;
        const offset = clampZoom(minCandles);
        priceChart.timeScale().applyOptions({ rightOffset: offset });
    }
}

function set1DayView() {
    const gran = parseInt(document.getElementById('timeframe').value) || 60;
    const candlesPerDay = Math.floor(86400 / gran);
    const offset = clampZoom(candlesPerDay);
    if (priceChart) priceChart.timeScale().applyOptions({ rightOffset: offset });
}



function updateResults() {
    document.getElementById('signal-count').textContent = callCount + putCount;
    document.getElementById('call-count').textContent = callCount;
    document.getElementById('put-count').textContent = putCount;
    document.getElementById('win-count').textContent = winCount;
    document.getElementById('lose-count').textContent = loseCount;
    
    const lastVerified = signalHistory.find(s => s.verified !== undefined);
    if (lastVerified) {
        document.getElementById('last-signal').textContent = lastVerified.success ? `✓ WIN` : `✗ LOSE`;
        document.getElementById('last-signal').className = 'value ' + (lastVerified.success ? 'call' : 'put');
    } else if (signalHistory[0]) {
        document.getElementById('last-signal').textContent = signalHistory[0].type === 'call' ? '▲ CALL' : '▼ PUT';
        document.getElementById('last-signal').className = 'value ' + (signalHistory[0]?.type === 'call' ? 'call' : signalHistory[0]?.type === 'put' ? 'put' : '');
    } else {
        document.getElementById('last-signal').textContent = '--';
    }
}

document.querySelectorAll('#timeframe-btns button').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#timeframe-btns button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('timeframe').value = btn.dataset.value;
        if (isConnected) { disconnect(); connect(); }
    });
});

document.getElementById('symbol').addEventListener('change', () => {
    if (isConnected) { disconnect(); connect(); }
});

document.getElementById('view-1d').addEventListener('click', () => {
    if (priceChart) set1DayView();
});

['sma-enabled', 'ema-enabled', 'bb-enabled', 'rsi-enabled', 'stoch-enabled', 'macd-enabled'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', async () => {
        updateIndicators();
        await syncRunningStrategyParams();
    });
});

['sma-period', 'ema-period', 'bb-period', 'rsi-period', 'rsi-high', 'rsi-low', 'stoch-period', 'min-confirmations', 'sma-slow', 'bb-stddev'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', async () => {
        updateIndicators();
        await syncRunningStrategyParams();
    });
});

async function syncRunningStrategyParams() {
    if (isLoadingStrategy) return;
    const strategyId = document.getElementById('strategy-trade')?.value;
    if (!strategyId) return;

    const params = {
        smaPeriod: parseInt(document.getElementById('sma-period')?.value, 10) || 9,
        emaPeriod: parseInt(document.getElementById('ema-period')?.value, 10) || 10,
        bbPeriod: parseInt(document.getElementById('bb-period')?.value, 10) || 20,
        rsiPeriod: parseInt(document.getElementById('rsi-period')?.value, 10) || 7,
        rsiHigh: parseFloat(document.getElementById('rsi-high')?.value) || 70,
        rsiLow: parseFloat(document.getElementById('rsi-low')?.value) || 30
    };

    try {
        await fetch(`/api/strategies/${strategyId}/params`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ params })
        });
    } catch (error) {
        console.warn('[UI] Failed to sync strategy params:', error);
    }
}

// Keyboard sync: Home/End sync both charts
document.addEventListener('keydown', (e) => {
    if (!priceChart || !rsiChart) return;
    
    if (e.key === 'Home') {
        // Show oldest data, fit content
        priceChart.timeScale().fitContent();
        rsiChart.timeScale().fitContent();
    } else if (e.key === 'End') {
        // Show latest data
        if (dataHistory.length > 0) {
            const lastTime = dataHistory[dataHistory.length - 1].time;
            const firstTime = dataHistory[0].time;
            priceChart.timeScale().setVisibleRange({ from: firstTime, to: lastTime + 60 });
            rsiChart.timeScale().setVisibleRange({ from: firstTime, to: lastTime + 60 });
        }
    }
});

function redrawIndicatorsOnly() {
    // Clear series visual data without wiping the underlying dataHistory
    smaSeries.setData([]);
    emaSeries.setData([]);
    bbUpperSeries.setData([]);
    bbMiddleSeries.setData([]);
    bbLowerSeries.setData([]);
    rsiSeries.setData([]);
    stochSeries.setData([]);
    macdSeries.setData([]);
    macdSignalSeries.setData([]);
    
    // Refresh indicators based on existing dataHistory
    updateIndicators();
    priceChart.applyOptions({});
    rsiChart.applyOptions({});
}





window.addEventListener('load', () => {
    initCharts();
    window.dispatchEvent(new Event('resize'));
    const strategySelect = document.getElementById('strategy-trade');
    if (strategySelect) {
        strategySelect.addEventListener('change', async () => {
            redrawIndicatorsOnly();
            resetTickCrossState();
            isLoadingStrategy = true;
            // Load default parameters for the selected strategy and apply to UI inputs
            try {
    const strategyId = document.getElementById('strategy-trade')?.value;
                const res = await fetch(`/api/strategies/${strategyId}`);
                if (res.ok) {
                    const meta = await res.json();
                    const defaults = meta.defaultParams || {};
                    // Map known parameter keys to UI element IDs
                    const mapping = {
                        smaFast: 'sma-period',
                        smaPeriod: 'sma-period',
                        smaSlow: 'sma-period',
                        emaFast: 'ema-period',
                        emaPeriod: 'ema-period',
                        emaSlow: 'ema-period',
                        rsiPeriod: 'rsi-period',
                        rsiLow: 'rsi-low',
                        rsiHigh: 'rsi-high',
                        bbPeriod: 'bb-period',
                        minConfirmations: 'min-confirmations',
                        minScore: 'min-score',
                        coolDownCandles: 'cooldown-candles'
                    };
                    Object.entries(defaults).forEach(([key, val]) => {
                        const elementId = mapping[key];
                        if (elementId) {
                            const el = document.getElementById(elementId);
                            if (el) el.value = val;
                        }
                    });
                    // Enable/disable indicator toggles based on strategy support
                    const toggleIds = {
                        sma: 'sma-enabled',
                        ema: 'ema-enabled',
                        rsi: 'rsi-enabled',
                        bb: 'bb-enabled',
                        stoch: 'stoch-enabled',
                        macd: 'macd-enabled'
                    };
                    const uses = {
                        sma: !!defaults.smaFast || !!defaults.smaPeriod || !!defaults.smaSlow,
                        ema: !!defaults.emaFast || !!defaults.emaPeriod,
                        rsi: !!defaults.rsiPeriod,
                        bb: !!defaults.bbPeriod,
                        stoch: !!defaults.stochPeriod,
                        macd: !!(defaults.macdFast && defaults.macdSlow && defaults.macdSignal)
                    };
                    Object.entries(toggleIds).forEach(([key, id]) => {
                        const el = document.getElementById(id);
                        if (el) {
                            el.checked = !!uses[key];
                            el.disabled = !uses[key];
                            const related = document.getElementById(`${id.replace('-enabled', '')}-period`);
                            if (related) related.style.display = uses[key] ? '' : 'none';
                        }
                    });
                    resetTickCrossState();
                    // NO requestHistory() here, we want to redraw only
                    updateIndicators();
                    isLoadingStrategy = false;
                }
            } catch (e) {
                console.error('Failed to load strategy defaults', e);
                isLoadingStrategy = false;
            }
        });
    }
});

// Toggle results panel
document.getElementById('toggle-results')?.addEventListener('click', () => {
    const panel = document.getElementById('results-panel');
    if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
});

document.getElementById('close-results')?.addEventListener('click', () => {
    const panel = document.getElementById('results-panel');
    if (panel) panel.style.display = 'none';
});

function showPositionTimer(signalType, entryPrice) {
    const overlay = document.getElementById('position-overlay');
    const countdownEl = document.getElementById('overlay-countdown');
    const typeEl = document.getElementById('overlay-type');
    const entryEl = document.getElementById('overlay-entry');
    const progressEl = document.getElementById('progress-fill');
    
    positionTimeLeft = 60;
    countdownEl.textContent = positionTimeLeft;
    progressEl.style.width = '100%';
    
    typeEl.textContent = signalType === 'call' ? '▲ CALL' : '▼ PUT';
    entryEl.textContent = '@ ' + entryPrice.toFixed(2);
    
    overlay.className = signalType === 'call' ? '' : 'put-mode';
    overlay.style.display = 'block';
    
    if (positionTimer) clearInterval(positionTimer);
    
    positionTimer = setInterval(() => {
        positionTimeLeft--;
        countdownEl.textContent = positionTimeLeft;
        progressEl.style.width = (positionTimeLeft / 60 * 100) + '%';
        
        if (positionTimeLeft <= 0) {
            clearInterval(positionTimer);
        }
    }, 1000);
}

function highlightIndicator(name, isActive) {
    const width = isActive ? 4 : 1;
    switch(name) {
        case 'RSI':
            if (rsiSeries) rsiSeries.applyOptions({ lineWidth: width });
            break;
        case 'Stoch':
            if (stochSeries) stochSeries.applyOptions({ lineWidth: width });
            break;
        case 'MACD':
            if (macdSeries) macdSeries.applyOptions({ lineWidth: width });
            if (macdSignalSeries) macdSignalSeries.applyOptions({ lineWidth: width });
            break;
        case 'SMA':
            if (smaSeries) smaSeries.applyOptions({ lineWidth: width });
            break;
        case 'BB':
            if (bbUpperSeries) bbUpperSeries.applyOptions({ lineWidth: width });
            if (bbMiddleSeries) bbMiddleSeries.applyOptions({ lineWidth: width });
            if (bbLowerSeries) bbLowerSeries.applyOptions({ lineWidth: width });
            break;
    }
}

function hidePositionTimer() {
    const overlay = document.getElementById('position-overlay');
    overlay.style.display = 'none';
    if (positionTimer) {
        clearInterval(positionTimer);
        positionTimer = null;
    }
    if (activeIndicator) {
        highlightIndicator(activeIndicator, false);
        activeIndicator = null;
    }
    activeSignalType = null;
    resetIndicatorLeds();
}

function updateIndicatorLed(name, signalType) {
    const ledIds = { 'RSI': 'led-rsi', 'Stoch': 'led-stoch', 'MACD': 'led-macd', 'SMA': 'led-sma', 'BB': 'led-bb' };
    const ledId = ledIds[name];
    if (!ledId) return;
    
    const led = document.getElementById(ledId);
    led.className = 'mini-led active';
    led.classList.add(signalType === 'call' ? 'active-call' : 'active-put');
}

function resetIndicatorLeds() {
    ['led-rsi', 'led-stoch', 'led-macd', 'led-sma', 'led-bb'].forEach(id => {
        const led = document.getElementById(id);
        if (led) led.className = 'mini-led';
    });
}

function addLog(message, type = '') {
    const container = document.getElementById('logs-container');
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerHTML = `<span class="log-time">[${new Date().toLocaleTimeString()}]</span> ${message}`;
    container.appendChild(entry);
    while (container.children.length > 100) container.removeChild(container.firstChild);
    container.scrollTop = container.scrollHeight;
}

// ============================================
// TAB SWITCHING
// ============================================
function switchTab(tab) {
    try {
    console.log('[switchTab] switching to:', tab);
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    const sbMap = { trade:'sidebar-trade', strategy:'sidebar-strategy', analysis:'sidebar-analysis', 'log-config':'sidebar-log-config' };
    const vwMap = { trade:'trade-view', strategy:'strategy-view', analysis:'analysis-view', 'log-config':'log-config-view' };
    Object.values(sbMap).forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    Object.values(vwMap).forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    const sb = document.getElementById(sbMap[tab]); if (sb) sb.style.display = 'flex';
    const vw = document.getElementById(vwMap[tab]); if (vw) vw.style.display = 'flex';

    if (tab === 'analysis') {
        if (!analysisChartsReady) initAnalysisCharts();
        if (dataHistory.length > 0) updateAnalysisCharts();
    }
    setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
    } catch (e) { console.error('switchTab error:', e); }
}

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// ============================================
// ANALYSIS CHARTS
// ============================================
let analysisChartsReady = false;
let analysisPriceChart, analysisRsiChart;
let analysisCandleSeries, analysisSmaSeries, analysisEmaSeries;
let analysisBbUpperSeries, analysisBbMiddleSeries, analysisBbLowerSeries;
let analysisRsiSeries, analysisStochSeries, analysisMacdSeries, analysisMacdSignalSeries;

function initAnalysisCharts() {
    if (analysisChartsReady) return;
    const pContainer = document.getElementById('analysis-price-chart');
    const rContainer = document.getElementById('analysis-rsi-chart');
    if (!pContainer || !rContainer) return;

    pContainer.innerHTML = '<div class="chart-label">ANALISIS - ESTRATEGIA</div><div class="chart-controls"><button id="analysis-zoom-out">-</button><button id="analysis-zoom-in">+</button><button id="analysis-fit-content">&#x22A1;</button></div>';
    rContainer.innerHTML = '<div class="chart-label">RSI / STOCH / MACD</div>';

    pContainer.style.minHeight = '300px';
    rContainer.style.minHeight = '100px';

    document.getElementById('analysis-zoom-in').onclick = () => {
        const bs = Math.min(50, (analysisPriceChart.timeScale().options().barSpacing || 8) + 2);
        analysisPriceChart.timeScale().applyOptions({ barSpacing: bs });
        analysisRsiChart.timeScale().applyOptions({ barSpacing: bs });
    };
    document.getElementById('analysis-zoom-out').onclick = () => {
        const bs = Math.max(4, (analysisPriceChart.timeScale().options().barSpacing || 8) - 2);
        analysisPriceChart.timeScale().applyOptions({ barSpacing: bs });
        analysisRsiChart.timeScale().applyOptions({ barSpacing: bs });
    };
    document.getElementById('analysis-fit-content').onclick = () => {
        analysisPriceChart.timeScale().fitContent();
        analysisRsiChart.timeScale().fitContent();
    };

    const analysisOpts = JSON.parse(JSON.stringify(chartOptions));
    analysisOpts.timeScale.rightOffset = 4;

    analysisPriceChart = LightweightCharts.createChart(pContainer, { ...analysisOpts, height: pContainer.clientHeight || 300 });
    analysisRsiChart = LightweightCharts.createChart(rContainer, { ...analysisOpts, height: rContainer.clientHeight || 100 });

    analysisSmaSeries = analysisPriceChart.addLineSeries({ color: '#2962ff', lineWidth: 1, title: 'SMA' });
    analysisEmaSeries = analysisPriceChart.addLineSeries({ color: '#f23645', lineWidth: 1, title: 'EMA' });
    analysisBbUpperSeries = analysisPriceChart.addLineSeries({ color: '#00bcd4', lineWidth: 1, lineStyle: 0, title: 'BB Upper' });
    analysisBbMiddleSeries = analysisPriceChart.addLineSeries({ color: 'rgba(0,188,212,0.3)', lineWidth: 1, lineStyle: 2, title: 'BB Middle' });
    analysisBbLowerSeries = analysisPriceChart.addLineSeries({ color: '#00bcd4', lineWidth: 1, lineStyle: 0, title: 'BB Lower' });

    analysisCandleSeries = analysisPriceChart.addCandlestickSeries({
        upColor: '#089981', downColor: '#f23645',
        borderVisible: false, wickUpColor: '#089981', wickDownColor: '#f23645',
    });

    analysisRsiSeries = analysisRsiChart.addLineSeries({ color: '#ff9800', lineWidth: 1, title: 'RSI' });
    analysisStochSeries = analysisRsiChart.addLineSeries({ color: '#9c27b0', lineWidth: 1, title: 'Stoch' });
    analysisMacdSeries = analysisRsiChart.addLineSeries({ color: '#2196f3', lineWidth: 1, title: 'MACD' });
    analysisMacdSignalSeries = analysisRsiChart.addLineSeries({ color: '#ff5722', lineWidth: 1, title: 'Signal' });

    const high = parseFloat(document.getElementById('analysis-rsi-high').value) || 65;
    const low = parseFloat(document.getElementById('analysis-rsi-low').value) || 35;
    analysisRsiSeries.createPriceLine({ price: high, color: '#f23645', lineWidth: 1, lineStyle: 2, title: 'HIGH' });
    analysisRsiSeries.createPriceLine({ price: low, color: '#089981', lineWidth: 1, lineStyle: 2, title: 'LOW' });

    // Click to place manual marks on analysis chart
    analysisPriceChart.subscribeClick(param => {
        const markMode = document.getElementById('mark-mode');
        if (!markMode || !markMode.checked) return;
        if (!param.time || !dataHistory.length) return;
        const time = Number(param.time);
        if (analysisMarks.some(m => m.time === time)) {
            analysisAddLog('Ya existe una marca en este momento');
            return;
        }
        const candle = dataHistory.find(c => c.time === time);
        if (!candle) return;

        const ind = getIndicatorValuesAt(time);
        analysisMarks.push({ time, type: analysisMarkType, price: candle.close, indicators: ind });
        renderAnalysisMarksList();
        updateAnalysisMarkers();
        renderComparison();
        analysisAddLog(`Marca ${analysisMarkType === 'up' ? 'UP' : 'DOWN'} @ ${candle.close.toFixed(2)}`);
    });

    analysisChartsReady = true;
    if (dataHistory.length > 0) updateAnalysisCharts();
}

function getIndicatorValuesAt(time) {
    const rsiP = parseInt(document.getElementById('analysis-rsi-period').value) || 7;
    const smaP = parseInt(document.getElementById('analysis-sma-period').value) || 23;
    const bbP = parseInt(document.getElementById('analysis-bb-period').value) || 20;
    const stochP = parseInt(document.getElementById('analysis-stoch-period').value) || 14;

    const findVal = (arr) => {
        if (!arr || !arr.length) return null;
        const entry = [...arr].reverse().find(d => d.time <= time);
        return entry && entry.value !== null ? +entry.value.toFixed(2) : null;
    };

    return {
        sma: findVal(calculateSMA(dataHistory, smaP)),
        rsi: findVal(calculateRSI(dataHistory, rsiP)),
        bbUpper: findVal(calculateBB(dataHistory, bbP).upper),
        bbLower: findVal(calculateBB(dataHistory, bbP).lower),
        stoch: findVal(calculateStochastic(dataHistory, stochP).map(d => ({ time: d.time, value: d.k }))),
        macd: findVal(calculateMACD(dataHistory, 12, 26, 9).map(d => ({ time: d.time, value: d.macd }))),
    };
}

function updateAnalysisCharts() {
    if (!analysisChartsReady || !dataHistory.length) return;
    document.getElementById('analysis-symbol-display').textContent = currentSymbol;
    document.getElementById('analysis-data-status').textContent = 'Conectado';
    document.getElementById('analysis-candle-count').style.display = '';
    document.getElementById('analysis-count-num').textContent = dataHistory.length;
    analysisCandleSeries.setData(dataHistory);
    updateAnalysisIndicators();
}

function updateAnalysisIndicators() {
    if (!analysisChartsReady || dataHistory.length < 2) return;

    const smaP = parseInt(document.getElementById('analysis-sma-period').value) || 23;
    const emaP = parseInt(document.getElementById('analysis-ema-period').value) || 10;
    const rsiP = parseInt(document.getElementById('analysis-rsi-period').value) || 7;
    const bbP = parseInt(document.getElementById('analysis-bb-period').value) || 20;

    const smaData = document.getElementById('analysis-sma-enable').checked ? calculateSMA(dataHistory, smaP).filter(d => d.value !== null) : [];
    const emaData = document.getElementById('analysis-ema-enable').checked ? calculateEMA(dataHistory, emaP) : [];
    const rsiData = document.getElementById('analysis-rsi-enable').checked ? calculateRSI(dataHistory, rsiP).filter(d => d.value !== null) : [];
    const bb = document.getElementById('analysis-bb-enable').checked ? calculateBB(dataHistory, bbP) : { upper: [], middle: [], lower: [] };
    const stochData = calculateStochastic(dataHistory, parseInt(document.getElementById('analysis-stoch-period').value) || 14);
    const macdData = calculateMACD(dataHistory, 12, 26, 9);

    if (analysisSmaSeries) analysisSmaSeries.setData(smaData);
    if (analysisEmaSeries) analysisEmaSeries.setData(emaData);
    if (analysisBbUpperSeries) analysisBbUpperSeries.setData(bb.upper.filter(d => d.value !== null));
    if (analysisBbMiddleSeries) analysisBbMiddleSeries.setData(bb.middle?.filter(d => d.value !== null) || []);
    if (analysisBbLowerSeries) analysisBbLowerSeries.setData(bb.lower.filter(d => d.value !== null));

    if (analysisRsiSeries) { analysisRsiSeries.setData(rsiData); analysisRsiSeries.applyOptions({ visible: rsiData.length > 0 }); }
    if (analysisStochSeries) { const plot = stochData.map(d => ({ time: d.time, value: d.k })).filter(d => d.value !== null); analysisStochSeries.setData(plot); }
    if (analysisMacdSeries && analysisMacdSignalSeries) {
        const valid = macdData.filter(d => d.macd !== null);
        if (valid.length > 0) {
            const all = [...valid.map(d => d.macd), ...valid.map(d => d.signal)];
            const min = Math.min(...all), max = Math.max(...all), range = max - min || 1;
            const norm = v => ((v - min) / range) * 100;
            analysisMacdSeries.setData(macdData.map(d => ({ time: d.time, value: d.macd !== null ? norm(d.macd) : null })).filter(d => d.value !== null));
            analysisMacdSignalSeries.setData(macdData.map(d => ({ time: d.time, value: d.signal !== null ? norm(d.signal) : null })).filter(d => d.value !== null));
        }
    }

    updateAnalysisMarkers();
}

function updateAnalysisMarkers() {
    if (!analysisChartsReady || !analysisCandleSeries) return;
    const manualMarkers = analysisMarks.map(m => ({
        time: m.time,
        position: m.type === 'up' ? 'aboveBar' : 'belowBar',
        color: m.type === 'up' ? '#089981' : '#f23645',
        shape: m.type === 'up' ? 'arrowUp' : 'arrowDown',
        text: m.type === 'up' ? 'UP' : 'DOWN'
    }));

    const autoMarkers = analysisAutoSignals.map(s => ({
        time: s.time,
        position: s.type === 'CALL' ? 'aboveBar' : 'belowBar',
        color: s.type === 'CALL' ? 'rgba(8,153,129,0.55)' : 'rgba(242,54,69,0.55)',
        shape: s.type === 'CALL' ? 'circle' : 'square',
        text: s.type
    }));

    const markers = [...manualMarkers, ...autoMarkers].sort((a, b) => a.time - b.time);
    analysisCandleSeries.setMarkers(markers);
}

function normalizeManualType(type) {
    return type === 'up' ? 'CALL' : 'PUT';
}

function findAutoSignalAt(time) {
    return analysisAutoSignals.find(s => s.time === time) || null;
}

function renderComparison() {
    const statsEl = document.getElementById('analysis-compare-stats');
    const tableEl = document.getElementById('analysis-compare-table');
    if (!statsEl || !tableEl) return;

    if (!analysisAutoSignals.length) {
        statsEl.textContent = 'Aún no hay resultados';
        tableEl.textContent = 'Ejecute backtest para ver coincidencias';
        return;
    }

    let hits = 0;
    let directionMatches = 0;
    const rows = [];

    analysisMarks.forEach((m) => {
        const auto = findAutoSignalAt(m.time);
        const manualType = normalizeManualType(m.type);
        const sameCandle = !!auto;
        const sameDirection = !!auto && auto.type === manualType;

        if (sameCandle) hits += 1;
        if (sameDirection) directionMatches += 1;

        rows.push({
            time: new Date(m.time * 1000).toLocaleTimeString(),
            manual: manualType,
            auto: auto ? auto.type : '—',
            match: sameDirection ? '✓' : (sameCandle ? '✗' : '∅')
        });
    });

    const omissions = Math.max(analysisMarks.length - hits, 0);
    const falsePositives = Math.max(analysisAutoSignals.length - hits, 0);
    statsEl.textContent = `Aciertos: ${directionMatches} · Fallos dir.: ${hits - directionMatches} · Omisiones: ${omissions} · Falsos+: ${falsePositives}`;

    if (!rows.length) {
        tableEl.textContent = 'No hay marcas manuales para comparar';
        return;
    }

    tableEl.innerHTML = rows.map(r => (
        `<div style="display:grid;grid-template-columns:1fr 52px 52px 22px;gap:4px;padding:2px 0;border-bottom:1px solid #1a1a1a;">` +
        `<span style="color:#9ca3af;">${r.time}</span>` +
        `<span>${r.manual}</span>` +
        `<span>${r.auto}</span>` +
        `<span style="text-align:center;">${r.match}</span>` +
        `</div>`
    )).join('');
}

async function runStrategyBacktest() {
    if (!dataHistory.length) {
        analysisAddLog('Sin datos para backtest');
        return;
    }

    const strategyId = document.getElementById('strategy-analysis')?.value || 'multi-momentum';
    const params = {
        minConfirmations: parseInt(document.getElementById('analysis-min-confirmations')?.value) || 3,
        rsiPeriod: parseInt(document.getElementById('analysis-rsi-period').value) || 7,
        rsiHigh: parseFloat(document.getElementById('analysis-rsi-high').value) || 65,
        rsiLow: parseFloat(document.getElementById('analysis-rsi-low').value) || 35,
        stochPeriod: parseInt(document.getElementById('analysis-stoch-period').value) || 14,
        smaFast: parseInt(document.getElementById('analysis-sma-period').value) || 23,
        smaSlow: parseInt(document.getElementById('analysis-sma-slow')?.value) || 21,
        bbPeriod: parseInt(document.getElementById('analysis-bb-period').value) || 20,
        bbStdDev: parseFloat(document.getElementById('analysis-bb-stddev')?.value) || 2
    };

    const durationMin = parseInt(document.getElementById('backtest-duration').value) || 1440;
    const granularity = parseInt(document.getElementById('timeframe').value) || 60;
    const numCandles = Math.max(Math.floor((durationMin * 60) / granularity), 30);
    const slicedData = dataHistory.slice(-numCandles);
    analysisAddLog(`Backtest ${strategyId} iniciado (${slicedData.length}/${dataHistory.length} velas, ${durationMin}min)`);

    try {
        const res = await fetch(`/api/strategies/${strategyId}/backtest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ candles: slicedData, params })
        });

        const result = await res.json();
        if (!res.ok || !result.success) {
            throw new Error(result.error || `HTTP ${res.status}`);
        }

        analysisAutoSignals = Array.isArray(result.signals) ? result.signals : [];
        updateAnalysisMarkers();
        renderComparison();

        const summary = document.getElementById('analysis-backtest-summary');
        if (summary) {
            summary.textContent = `Señales: ${result.stats?.signalsCount || 0} (CALL ${result.stats?.callCount || 0} / PUT ${result.stats?.putCount || 0})`;
        }
        analysisAddLog(`Backtest completado: ${result.stats?.signalsCount || 0} señales`);
    } catch (error) {
        analysisAddLog(`Backtest error: ${error.message}`);
    }
}

function exportMarksJson() {
    const payload = {
        exportedAt: new Date().toISOString(),
        symbol: currentSymbol,
        marks: analysisMarks
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `estr-marks-${currentSymbol}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    analysisAddLog(`Marcas exportadas: ${analysisMarks.length}`);
}

function importMarksJson(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const parsed = JSON.parse(String(reader.result || '{}'));
            const srcMarks = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.marks) ? parsed.marks : []);
            const normalized = srcMarks
                .map(m => ({
                    time: Number(m.time),
                    type: m.type === 'close' ? 'down' : (m.type === 'open' ? 'up' : m.type),
                    price: Number(m.price),
                    indicators: m.indicators || {}
                }))
                .filter(m => Number.isFinite(m.time) && Number.isFinite(m.price));

            if (!normalized.length) {
                analysisAddLog('Importación sin marcas válidas');
                return;
            }

            const byTime = new Map();
            [...analysisMarks, ...normalized].forEach(m => byTime.set(m.time, m));
            analysisMarks = Array.from(byTime.values()).sort((a, b) => a.time - b.time);
            renderAnalysisMarksList();
            updateAnalysisMarkers();
            renderComparison();
            analysisAddLog(`Marcas importadas: +${normalized.length}`);
        } catch (e) {
            analysisAddLog(`Error importando JSON: ${e.message}`);
        }
    };
    reader.readAsText(file);
}

function buildOptimizerParamSets() {
    const rsiMin = parseInt(document.getElementById('opt-rsi-min')?.value || '5', 10);
    const rsiMax = parseInt(document.getElementById('opt-rsi-max')?.value || '21', 10);
    const smaMin = parseInt(document.getElementById('opt-sma-min')?.value || '10', 10);
    const smaMax = parseInt(document.getElementById('opt-sma-max')?.value || '50', 10);

    const sets = [];
    for (let r = rsiMin; r <= rsiMax; r += 2) {
        for (let s = smaMin; s <= smaMax; s += 5) {
            sets.push({
                rsiPeriod: r,
                smaFast: s,
                smaSlow: Math.max(s + 8, 21)
            });
        }
    }
    return sets;
}

function scoreSignalsAgainstMarks(signals, marks) {
    const map = new Map(signals.map(s => [s.time, s]));
    let hits = 0;
    let matches = 0;
    for (const m of marks) {
        const sig = map.get(m.time);
        if (!sig) continue;
        hits += 1;
        if (sig.type === normalizeManualType(m.type)) matches += 1;
    }
    const omissions = Math.max(marks.length - hits, 0);
    const falsePositives = Math.max(signals.length - hits, 0);
    const score = (matches * 3) - ((hits - matches) * 2) - omissions - falsePositives;
    return { score, matches, hits, omissions, falsePositives };
}

async function runOptimizerScan() {
    if (!dataHistory.length) {
        analysisAddLog('Sin datos para optimizar');
        return;
    }
    if (!analysisMarks.length) {
        analysisAddLog('Agregue/importe marcas manuales antes de optimizar');
        return;
    }

    const strategyId = document.getElementById('strategy-analysis')?.value || 'multi-momentum';
    const paramSets = buildOptimizerParamSets();
    const resultsEl = document.getElementById('analysis-optimizer-results');
    const summaryEl = document.getElementById('analysis-optimizer-summary');
    if (resultsEl) resultsEl.textContent = 'Escaneando parámetros...';

    const ranking = [];
    for (let i = 0; i < paramSets.length; i++) {
        const p = paramSets[i];
        const params = {
            minConfirmations: parseInt(document.getElementById('analysis-min-confirmations')?.value) || 3,
            rsiPeriod: p.rsiPeriod,
            rsiHigh: parseFloat(document.getElementById('analysis-rsi-high').value) || 65,
            rsiLow: parseFloat(document.getElementById('analysis-rsi-low').value) || 35,
            stochPeriod: parseInt(document.getElementById('analysis-stoch-period').value) || 14,
            smaFast: p.smaFast,
            smaSlow: p.smaSlow,
            bbPeriod: parseInt(document.getElementById('analysis-bb-period').value) || 20,
            bbStdDev: parseFloat(document.getElementById('analysis-bb-stddev')?.value) || 2
        };

        try {
            const res = await fetch(`/api/strategies/${strategyId}/backtest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ candles: dataHistory, params })
            });
            const result = await res.json();
            if (!res.ok || !result.success) continue;

            const scored = scoreSignalsAgainstMarks(result.signals || [], analysisMarks);
            ranking.push({ params, stats: scored, signals: result.signals || [] });
        } catch (_) {
            // skip failed combo
        }

        if (i % 10 === 0) {
            analysisAddLog(`Optimizando... ${i + 1}/${paramSets.length}`);
        }
    }

    ranking.sort((a, b) => b.stats.score - a.stats.score);
    const top = ranking.slice(0, 10);

    if (!top.length) {
        if (summaryEl) summaryEl.textContent = 'Sin resultados válidos';
        if (resultsEl) resultsEl.textContent = 'No se pudieron evaluar combinaciones';
        return;
    }

    const best = top[0];
    analysisAutoSignals = best.signals;
    updateAnalysisMarkers();
    renderComparison();

    if (summaryEl) {
        summaryEl.textContent = `Mejor: score ${best.stats.score} · RSI ${best.params.rsiPeriod} · SMA ${best.params.smaFast}/${best.params.smaSlow}`;
    }

    if (resultsEl) {
        resultsEl.innerHTML = top.map((r, idx) => (
            `<div style="border-bottom:1px solid #1a1a1a;padding:3px 0;">` +
            `<div><strong>#${idx + 1}</strong> score ${r.stats.score} · RSI ${r.params.rsiPeriod} · SMA ${r.params.smaFast}/${r.params.smaSlow}</div>` +
            `<div style="color:#9ca3af;">Aciertos ${r.stats.matches} · Hits ${r.stats.hits} · Omis ${r.stats.omissions} · FP ${r.stats.falsePositives}</div>` +
            `</div>`
        )).join('');
    }

    analysisAddLog(`Optimización completa (${ranking.length} combinaciones evaluadas)`);
}

function renderAnalysisMarksList() {
    const container = document.getElementById('analysis-marks-list');
    if (!container) return;
    const countEl = document.getElementById('analysis-mark-count');
    if (countEl) countEl.textContent = `(${analysisMarks.length})`;

    if (analysisMarks.length === 0) {
        container.innerHTML = '<div style="color:#555;padding:8px;text-align:center;">Sin marcas</div>';
        return;
    }

    container.innerHTML = analysisMarks.map((m, i) => {
        const d = new Date(m.time * 1000);
        const ind = m.indicators || {};
        const parts = [];
        if (ind.rsi !== null) parts.push(`RSI ${ind.rsi}`);
        if (ind.sma !== null) parts.push(`SMA ${ind.sma}`);
        if (ind.stoch !== null) parts.push(`Stoch ${ind.stoch}`);
        if (ind.macd !== null) parts.push(`MACD ${ind.macd}`);
        if (ind.bbUpper !== null && ind.bbLower !== null) {
            const price = m.price;
            const inBand = price >= ind.bbLower && price <= ind.bbUpper;
            parts.push(`BB ${inBand ? 'dentro' : 'fuera'}`);
        }
        return `<div style="display:flex;flex-direction:column;padding:3px 4px;border-bottom:1px solid #1a1a1a;cursor:pointer;" data-idx="${i}">
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="color:${m.type === 'up' ? '#089981' : '#f23645'};font-weight:bold;">${m.type === 'up' ? '▲' : '▼'} ${m.type.toUpperCase()}</span>
                <span style="color:#888;font-size:9px;">${d.toLocaleTimeString()}</span>
                <span style="color:#aaa;">${m.price.toFixed(2)}</span>
                <span style="color:#444;font-size:9px;">✕</span>
            </div>
            <div style="font-size:8px;color:#555;margin-top:1px;display:flex;flex-wrap:wrap;gap:2px;">${parts.map(p => `<span style="background:#1a1a1a;padding:0 3px;border-radius:2px;">${p}</span>`).join('') || '<span style="color:#444;">—</span>'}</div>
        </div>`;
    }).join('');

    container.querySelectorAll('[data-idx]').forEach(el => {
        el.addEventListener('click', () => {
            const idx = parseInt(el.dataset.idx);
            analysisMarks.splice(idx, 1);
            renderAnalysisMarksList();
            updateAnalysisMarkers();
            renderComparison();
            analysisAddLog('Marca eliminada');
        });
    });
}

function analysisAddLog(message) {
    const container = document.getElementById('analysis-logs');
    if (!container) return;
    const entry = document.createElement('div');
    entry.innerHTML = `<span style="color:#666;">[${new Date().toLocaleTimeString()}]</span> ${message}`;
    container.appendChild(entry);
    while (container.children.length > 50) container.removeChild(container.firstChild);
    container.scrollTop = container.scrollHeight;
}

// Sync: analysis input → trading input
['sma-period', 'ema-period', 'bb-period', 'rsi-period', 'stoch-period'].forEach(id => {
    document.getElementById(`analysis-${id}`)?.addEventListener('input', () => {
        const v = document.getElementById(`analysis-${id}`).value;
        const tradingEl = document.getElementById(id);
        if (tradingEl) tradingEl.value = v;
        updateIndicators();
        updateAnalysisIndicators();
    });
});

// Analysis indicator toggle listeners
['sma', 'ema', 'bb', 'rsi', 'stoch', 'macd'].forEach(name => {
    document.getElementById(`analysis-${name}-enable`)?.addEventListener('change', updateAnalysisIndicators);
});

// Analysis mark controls
document.getElementById('mark-up')?.addEventListener('click', () => {
    analysisMarkType = 'up';
    document.getElementById('mark-up').style.opacity = '1';
    document.getElementById('mark-down').style.opacity = '0.5';
});
document.getElementById('mark-down')?.addEventListener('click', () => {
    analysisMarkType = 'down';
    document.getElementById('mark-down').style.opacity = '1';
    document.getElementById('mark-up').style.opacity = '0.5';
});
document.getElementById('analysis-clear-marks')?.addEventListener('click', () => {
    analysisMarks = [];
    renderAnalysisMarksList();
    updateAnalysisMarkers();
    renderComparison();
    analysisAddLog('Todas las marcas eliminadas');
});
document.getElementById('mark-mode')?.addEventListener('change', (e) => {
    analysisAddLog(e.target.checked ? 'Modo marcado activado — haga clic en el grafico' : 'Modo marcado desactivado');
});

document.getElementById('run-backtest-analysis')?.addEventListener('click', () => {
    runStrategyBacktest();
});




document.getElementById('analysis-export-marks')?.addEventListener('click', () => {
    exportMarksJson();
});

document.getElementById('analysis-import-marks')?.addEventListener('click', () => {
    document.getElementById('analysis-import-file')?.click();
});

document.getElementById('analysis-import-file')?.addEventListener('change', (e) => {
    const file = e.target?.files?.[0];
    importMarksJson(file);
    e.target.value = '';
});

document.getElementById('analysis-run-optimizer')?.addEventListener('click', () => {
    runOptimizerScan();
});

document.getElementById('save-backtest-btn')?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ marks: analysisMarks, signals: analysisAutoSignals }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `backtest-${currentSymbol}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    analysisAddLog('Backtest guardado');
});

document.getElementById('load-backtest-btn')?.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = () => {
            try {
                const d = JSON.parse(r.result);
                if (d.marks) analysisMarks = d.marks;
                if (d.signals) analysisAutoSignals = d.signals;
                renderAnalysisMarksList();
                updateAnalysisMarkers();
                renderComparison();
                analysisAddLog('Backtest cargado');
            } catch (err) { analysisAddLog('Error: ' + err.message); }
        };
        r.readAsText(f);
    };
    input.click();
});

document.getElementById('analyze-marks-btn')?.addEventListener('click', () => {
    if (!analysisMarks.length) { analysisAddLog('Sin marcas para analizar'); return; }
    const ups = analysisMarks.filter(m => m.type === 'up').length;
    const downs = analysisMarks.filter(m => m.type === 'down').length;
    analysisAddLog(`Análisis: ${analysisMarks.length} marcas total (UP: ${ups}, DOWN: ${downs}) — función completa próximamente`);
});

document.getElementById('improve-strategy-btn')?.addEventListener('click', () => {
    analysisAddLog('Mejora de estrategia — próximamente');
});