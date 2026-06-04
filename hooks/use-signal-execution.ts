'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { Candle } from '@/lib/types';

export interface SignalEntry {
  id: number;
  type: 'call' | 'put';
  time: number;
  entryPrice: number;
  verified: boolean;
  success?: boolean;
  exitPrice?: number;
  resultText?: string;
}

export interface UseSignalExecutionReturn {
  positionOpen: boolean;
  activeSignalType: 'call' | 'put' | null;
  positionTimeLeft: number;
  winCount: number;
  loseCount: number;
  signalHistory: SignalEntry[];
  lastResult: { success: boolean; text: string } | null;
  executeSignal: (type: 'call' | 'put', price: number, time: number, reason: string) => void;
  reset: () => void;
}

const VERIFY_DELAY_MS = 60000;

export function useSignalExecution(
  dataHistory: Candle[]
): UseSignalExecutionReturn {
  const [positionOpen, setPositionOpen] = useState(false);
  const [activeSignalType, setActiveSignalType] = useState<'call' | 'put' | null>(null);
  const [positionTimeLeft, setPositionTimeLeft] = useState(60);
  const [winCount, setWinCount] = useState(0);
  const [loseCount, setLoseCount] = useState(0);
  const [signalHistory, setSignalHistory] = useState<SignalEntry[]>([]);
  const [lastResult, setLastResult] = useState<{ success: boolean; text: string } | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const verifyRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSignalRef = useRef<SignalEntry | null>(null);

  const clearTimers = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    if (verifyRef.current) {
      clearTimeout(verifyRef.current);
      verifyRef.current = null;
    }
  }, []);

  const hidePosition = useCallback(() => {
    clearTimers();
    setPositionOpen(false);
    setActiveSignalType(null);
    setPositionTimeLeft(60);
    pendingSignalRef.current = null;
  }, [clearTimers]);

  const verifySignal = useCallback((entry: SignalEntry) => {
    if (dataHistory.length < 2) return;

    const currentPrice = dataHistory[dataHistory.length - 1].close;
    const priceChange = currentPrice - entry.entryPrice;
    const priceChangePct = (priceChange / entry.entryPrice) * 100;

    let success = false;
    if (entry.type === 'call') {
      success = currentPrice > entry.entryPrice;
    } else {
      success = currentPrice < entry.entryPrice;
    }

    const resultText = success
      ? `WIN (+${priceChangePct.toFixed(2)}%)`
      : `LOSE (${priceChangePct.toFixed(2)}%)`;

    if (success) {
      setWinCount((c) => c + 1);
    } else {
      setLoseCount((c) => c + 1);
    }

    setLastResult({ success, text: resultText });
    setSignalHistory((prev) =>
      prev.map((s) =>
        s.id === entry.id
          ? { ...s, verified: true, success, exitPrice: currentPrice, resultText }
          : s
      )
    );

    hidePosition();
  }, [dataHistory, hidePosition]);

  const executeSignal = useCallback((type: 'call' | 'put', price: number, time: number, _reason: string) => {
    if (positionOpen) return;

    setPositionOpen(true);
    setActiveSignalType(type);
    setPositionTimeLeft(60);
    setLastResult(null);

    const entry: SignalEntry = {
      id: Date.now(),
      type,
      time,
      entryPrice: price,
      verified: false,
    };
    pendingSignalRef.current = entry;
    setSignalHistory((prev) => [entry, ...prev].slice(0, 20));

    countdownRef.current = setInterval(() => {
      setPositionTimeLeft((prev) => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);

    verifyRef.current = setTimeout(() => {
      if (pendingSignalRef.current) {
        verifySignal(pendingSignalRef.current);
      }
    }, VERIFY_DELAY_MS);
  }, [positionOpen, verifySignal]);

  const reset = useCallback(() => {
    clearTimers();
    setPositionOpen(false);
    setActiveSignalType(null);
    setPositionTimeLeft(60);
    setWinCount(0);
    setLoseCount(0);
    setSignalHistory([]);
    setLastResult(null);
    pendingSignalRef.current = null;
  }, [clearTimers]);

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  return {
    positionOpen,
    activeSignalType,
    positionTimeLeft,
    winCount,
    loseCount,
    signalHistory,
    lastResult,
    executeSignal,
    reset,
  };
}
