/**
 * usePositionRates - 持倉即時費率訂閱 Hook
 * 訂閱 WebSocket 即時費率更新，提供持倉相關的費率資訊
 *
 * Feature: 持倉管理頁面顯示即時資金費率
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import type { MarketRate, MarketRatesUpdatePayload } from '../../market-monitor/types';
import type { PositionRateInfo } from '../types/position-rates';
import { extractPositionRateInfo } from '../types/position-rates';

interface UsePositionRatesReturn {
  /** 是否已連線 */
  isConnected: boolean;
  /** 獲取指定持倉的即時費率資訊 */
  getRateForPosition: (
    symbol: string,
    longExchange: string,
    shortExchange: string
  ) => PositionRateInfo | null;
  /** 當前時間戳（用於觸發倒計時重新計算） */
  currentTime: Date;
}

/**
 * usePositionRates Hook
 * 訂閱 WebSocket 費率更新，提供持倉相關的費率查詢功能
 */
export function usePositionRates(): UsePositionRatesReturn {
  // 費率快取 Map<symbol, MarketRate>
  const [ratesMap, setRatesMap] = useState<Map<string, MarketRate>>(new Map());
  // 當前時間（用於觸發倒計時重新計算）
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // WebSocket 連線
  const { isConnected, on, off, emit } = useWebSocket({
    onConnect: () => {
      console.log('[usePositionRates] WebSocket connected');
      // 訂閱市場費率更新
      emit('subscribe:market-rates');
    },
    onDisconnect: () => {
      console.log('[usePositionRates] WebSocket disconnected');
    },
    onError: (err) => {
      console.error('[usePositionRates] WebSocket error:', err);
    },
  });

  // 處理費率更新
  const handleRatesUpdate = useCallback((event: MarketRatesUpdatePayload) => {
    setRatesMap((prev) => {
      const next = new Map(prev);
      event.data.rates.forEach((rate) => {
        next.set(rate.symbol, rate);
      });
      return next;
    });
  }, []);

  // 訂閱 WebSocket 事件
  useEffect(() => {
    if (!isConnected) {
      return;
    }

    on('rates:update', handleRatesUpdate);

    return () => {
      off('rates:update', handleRatesUpdate);
    };
  }, [isConnected, on, off, handleRatesUpdate]);

  // 每分鐘更新當前時間，觸發倒計時重新計算
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // 每 60 秒更新一次

    return () => clearInterval(interval);
  }, []);

  // 獲取指定持倉的費率資訊
  const getRateForPosition = useCallback(
    (symbol: string, longExchange: string, shortExchange: string): PositionRateInfo | null => {
      const marketRate = ratesMap.get(symbol);
      if (!marketRate) {
        return null;
      }
      return extractPositionRateInfo(marketRate, longExchange, shortExchange);
    },
    [ratesMap]
  );

  return {
    isConnected,
    getRateForPosition,
    currentTime,
  };
}

/**
 * PositionRatesProvider Context
 * 提供共享的費率訂閱，避免多個組件重複訂閱
 */
import { createContext, useContext, type ReactNode } from 'react';

const PositionRatesContext = createContext<UsePositionRatesReturn | null>(null);

interface PositionRatesProviderProps {
  children: ReactNode;
}

export function PositionRatesProvider({ children }: PositionRatesProviderProps) {
  const positionRates = usePositionRates();
  return (
    <PositionRatesContext.Provider value={positionRates}>
      {children}
    </PositionRatesContext.Provider>
  );
}

/**
 * usePositionRatesContext
 * 從 Context 獲取費率資訊（需要在 PositionRatesProvider 內使用）
 */
export function usePositionRatesContext(): UsePositionRatesReturn {
  const context = useContext(PositionRatesContext);
  if (!context) {
    throw new Error('usePositionRatesContext must be used within PositionRatesProvider');
  }
  return context;
}
