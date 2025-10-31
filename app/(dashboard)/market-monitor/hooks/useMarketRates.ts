/**
 * useMarketRates - 市場費率訂閱 Hook
 * 訂閱即時費率更新和統計資訊
 *
 * Feature: 006-web-trading-platform (User Story 2.5)
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import type { MarketRate } from '../components/RateRow';
import type { MarketStats } from '../components/StatsCard';

interface RatesUpdateEvent {
  type: 'rates:update';
  data: {
    rates: MarketRate[];
    timestamp: string;
  };
}

interface StatsUpdateEvent {
  type: 'rates:stats';
  data: MarketStats;
}

interface UseMarketRatesReturn {
  /** 即時費率數據 */
  rates: MarketRate[];
  /** 統計資訊 */
  stats: MarketStats | null;
  /** WebSocket 連線狀態 */
  isConnected: boolean;
  /** 載入狀態 */
  isLoading: boolean;
  /** 錯誤訊息 */
  error: Error | null;
  /** 手動重新載入 */
  reload: () => Promise<void>;
}

/**
 * useMarketRates Hook
 * 自動訂閱 WebSocket 事件並管理即時費率數據
 */
export function useMarketRates(): UseMarketRatesReturn {
  const [rates, setRates] = useState<MarketRate[]>([]);
  const [stats, setStats] = useState<MarketStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // WebSocket 連線
  const { isConnected, on, off, emit } = useWebSocket({
    onConnect: () => {
      console.log('[useMarketRates] WebSocket connected');
      // 訂閱市場費率更新
      emit('subscribe:market-rates');
    },
    onDisconnect: () => {
      console.log('[useMarketRates] WebSocket disconnected');
    },
    onError: (err) => {
      console.error('[useMarketRates] WebSocket error:', err);
      setError(err);
    },
  });

  // 處理費率更新
  const handleRatesUpdate = useCallback((event: RatesUpdateEvent) => {
    console.log('[useMarketRates] Rates updated:', event.data.rates.length, 'rates');
    setRates(event.data.rates);
    setIsLoading(false);
    setError(null);
  }, []);

  // 處理統計更新
  const handleStatsUpdate = useCallback((event: StatsUpdateEvent) => {
    console.log('[useMarketRates] Stats updated:', event.data);
    setStats(event.data);
  }, []);

  // 訂閱 WebSocket 事件
  useEffect(() => {
    if (!isConnected) {
      return;
    }

    // 訂閱事件
    on('rates:update', handleRatesUpdate);
    on('rates:stats', handleStatsUpdate);

    // 清理函數
    return () => {
      off('rates:update', handleRatesUpdate);
      off('rates:stats', handleStatsUpdate);
    };
  }, [isConnected, on, off, handleRatesUpdate, handleStatsUpdate]);

  // 手動重新載入（從 REST API）
  const reload = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/market-rates');
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        setRates(data.data.rates);
        setStats(data.data.stats);
      } else {
        throw new Error(data.error?.message || 'Failed to fetch rates');
      }
    } catch (err) {
      console.error('[useMarketRates] Failed to reload:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 初始載入（從 REST API）
  useEffect(() => {
    reload();
  }, [reload]);

  return {
    rates,
    stats,
    isConnected,
    isLoading,
    error,
    reload,
  };
}
