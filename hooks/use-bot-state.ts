'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { DerivWS } from '@deriv/core';
import { useCandleHistory } from '@/hooks/use-candle-history';
import { useIndicatorCalculator } from '@/hooks/use-indicator-calculator';
import { useSignalEngine } from '@/hooks/use-signal-engine';
import { useSignalExecution } from '@/hooks/use-signal-execution';
import type { StrategyId } from '@/hooks/use-signal-engine';
import type { IndicatorConfig } from '@/lib/types';

export interface LogEntry {
  id: number;
  time: string;
  message: string;
  type: 'info' | 'call' | 'put' | 'success' | 'error';
}

export interface BotState {
  ws: {
    ws: DerivWS | null;
    isConnected: boolean;
    error: string | null;
  };
  candles: ReturnType<typeof useCandleHistory> & {
    symbol: string;
    setSymbol: (s: string) => void;
    granularity: number;
    setGranularity: (g: number) => void;
  };
  indicators: ReturnType<typeof useIndicatorCalculator>;
  signal: ReturnType<typeof useSignalEngine>;
  execution: ReturnType<typeof useSignalExecution>;
  config: {
    strategyId: StrategyId;
    setStrategyId: (id: StrategyId) => void;
    indicatorConfig: IndicatorConfig;
    setIndicatorConfig: (config: IndicatorConfig) => void;
  };
  logs: LogEntry[];
  addLog: (message: string, type?: LogEntry['type']) => void;
  clearLogs: () => void;
}

let logIdCounter = 0;

export function useBotState(
  ws: DerivWS | null,
  isConnected: boolean,
  error: string | null
): BotState {
  const [symbol, setSymbol] = useState('R_25');
  const [granularity, setGranularity] = useState(60);
  const [strategyId, setStrategyId] = useState<StrategyId>('multi-momentum');
  const [indicatorConfig, setIndicatorConfig] = useState<IndicatorConfig>({
    rsiPeriod: 7,
    rsiHigh: 70,
    rsiLow: 30,
    stochPeriod: 14,
    smaFast: 9,
    smaSlow: 21,
    bbPeriod: 20,
    bbStdDev: 2,
    minConfirmations: 3,
    enabled: {
      rsi: true,
      stoch: true,
      macd: true,
      sma: true,
      bb: true,
    },
  });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const lastSignalRef = useRef<string | null>(null);

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    const entry: LogEntry = {
      id: ++logIdCounter,
      time: new Date().toLocaleTimeString(),
      message,
      type,
    };
    setLogs((prev) => [entry, ...prev].slice(0, 100));
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const candles = useCandleHistory(ws, symbol, granularity);
  const indicators = useIndicatorCalculator(candles.dataHistory, indicatorConfig);
  const signal = useSignalEngine({
    strategyId,
    dataHistory: candles.dataHistory,
    indicators,
    config: indicatorConfig,
  });
  const execution = useSignalExecution(candles.dataHistory);

  // Log connection state changes
  useEffect(() => {
    if (isConnected) {
      addLog('WebSocket connected', 'success');
    }
  }, [isConnected, addLog]);

  // Log errors
  useEffect(() => {
    if (error) {
      addLog(error, 'error');
    }
  }, [error, addLog]);

  // Log candle history loaded
  useEffect(() => {
    if (candles.isHistoryLoaded && candles.dataHistory.length > 0) {
      addLog(`Loaded ${candles.dataHistory.length} candles`, 'info');
    }
  }, [candles.isHistoryLoaded, candles.dataHistory.length, addLog]);

  // Auto-execute signals
  useEffect(() => {
    if (!signal.signal || execution.positionOpen) return;

    const lastCandle = candles.dataHistory[candles.dataHistory.length - 1];
    if (!lastCandle) return;

    const signalKey = `${signal.signal}-${lastCandle.time}`;
    if (lastSignalRef.current === signalKey) return;
    lastSignalRef.current = signalKey;

    addLog(`Signal ${signal.signal.toUpperCase()}: ${signal.reason}`, signal.signal);
    execution.executeSignal(
      signal.signal,
      lastCandle.close,
      lastCandle.time,
      signal.reason
    );
  }, [signal.signal, signal.reason, execution.positionOpen, candles.dataHistory, execution.executeSignal, addLog]);

  // Log execution results
  useEffect(() => {
    if (execution.lastResult) {
      addLog(
        execution.lastResult.success ? 'Trade won!' : 'Trade lost',
        execution.lastResult.success ? 'success' : 'error'
      );
    }
  }, [execution.lastResult, addLog]);

  return {
    ws: { ws, isConnected, error },
    candles: { ...candles, symbol, setSymbol, granularity, setGranularity },
    indicators,
    signal,
    execution,
    config: { strategyId, setStrategyId, indicatorConfig, setIndicatorConfig },
    logs,
    addLog,
    clearLogs,
  };
}
