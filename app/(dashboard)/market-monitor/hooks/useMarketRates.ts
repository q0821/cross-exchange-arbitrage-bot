/**
 * useMarketRates - 市場費率訂閱 Hook
 * 訂閱即時費率更新和統計資訊
 *
 * Feature: 006-web-trading-platform (User Story 2.5)
 * Feature: 012-specify-scripts-bash (User Story 1 - T018)
 * Feature: 019-fix-time-basis-switching - 支援前端動態重新計算費率差
 * Feature: 036-opportunity-threshold-settings - 可配置年化收益門檻
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import type { MarketRate, MarketRatesUpdatePayload, MarketStatsPayload } from '../types';
import type { MarketStats } from '../components/StatsCard';
import type { TimeBasis } from '../utils/preferences';
import {
  getTimeBasisPreference,
  setTimeBasisPreference,
  getOpportunityThresholdPreference,
  OPPORTUNITY_THRESHOLD_KEY,
  isValidThreshold,
} from '../utils/preferences';
import { recalculateBestPair } from '../utils/rateCalculations';

interface UseMarketRatesReturn {
  /** 即時費率數據 (Map for O(1) lookups) */
  ratesMap: Map<string, MarketRate>;
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
  /** 當前時間基準 */
  timeBasis: TimeBasis;
  /** 設置時間基準 */
  setTimeBasis: (basis: TimeBasis) => void;
  /** 當前年化收益門檻 (Feature 036) */
  opportunityThreshold: number;
  /** 設置年化收益門檻 (Feature 036) */
  setOpportunityThreshold: (threshold: number) => void;
}

/**
 * useMarketRates Hook
 * 自動訂閱 WebSocket 事件並管理即時費率數據
 *
 * Feature 012: 支援標準化費率時間基準選擇
 * Feature 036: 支援可配置年化收益門檻
 */
export function useMarketRates(): UseMarketRatesReturn {
  const [ratesMap, setRatesMap] = useState<Map<string, MarketRate>>(new Map());
  const [stats, setStats] = useState<MarketStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [timeBasis, setTimeBasisState] = useState<TimeBasis>(() => getTimeBasisPreference());
  // Feature 036: 年化收益門檻狀態
  const [opportunityThreshold, setOpportunityThresholdState] = useState<number>(
    () => getOpportunityThresholdPreference()
  );

  // WebSocket 連線
  const { isConnected, on, off, emit } = useWebSocket({
    onConnect: () => {
      console.log('[useMarketRates] WebSocket connected');
      // 訂閱市場費率更新
      emit('subscribe:market-rates');
      // 發送時間基準偏好
      emit('set-time-basis', { timeBasis });
    },
    onDisconnect: () => {
      console.log('[useMarketRates] WebSocket disconnected');
    },
    onError: (err) => {
      console.error('[useMarketRates] WebSocket error:', err);
      setError(err);
    },
  });

  // 處理時間基準變更
  const handleSetTimeBasis = useCallback((basis: TimeBasis) => {
    setTimeBasisState(basis);
    setTimeBasisPreference(basis);
    // 通知 WebSocket 伺服器時間基準變更
    if (isConnected) {
      emit('set-time-basis', { timeBasis: basis });
    }
  }, [isConnected, emit]);

  // Feature 036: 處理年化收益門檻變更
  const handleSetOpportunityThreshold = useCallback((threshold: number) => {
    setOpportunityThresholdState(threshold);
    // 注意：門檻的 localStorage 儲存由 useOpportunityThreshold hook 負責
    // 這裡只更新本地狀態，用於重新計算費率
  }, []);

  // 處理費率更新 (根據當前 timeBasis 和 opportunityThreshold 重新計算 bestPair)
  // Feature 019: 前端即時計算最佳套利對
  // Feature 036: 使用可配置門檻
  const handleRatesUpdate = useCallback((event: MarketRatesUpdatePayload) => {
    console.log('[useMarketRates] Rates updated:', event.data.rates.length, 'rates');
    setRatesMap((prev) => {
      const next = new Map(prev);
      event.data.rates.forEach((rate) => {
        // 根據當前 timeBasis 和 opportunityThreshold 重新計算 bestPair
        const recalculatedRate = recalculateBestPair(rate, timeBasis, opportunityThreshold);
        next.set(rate.symbol, recalculatedRate); // O(1) update per symbol
      });
      return next;
    });
    setIsLoading(false);
    setError(null);
  }, [timeBasis, opportunityThreshold]);

  // 處理統計更新
  const handleStatsUpdate = useCallback((event: MarketStatsPayload) => {
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

  // Feature 019/036: 當 timeBasis 或 opportunityThreshold 變更時，重新計算所有已快取的費率
  useEffect(() => {
    setRatesMap((prev) => {
      // 如果沒有數據，不需要重新計算
      if (prev.size === 0) {
        return prev;
      }

      console.log('[useMarketRates] Recalculating all rates for timeBasis:', timeBasis, 'threshold:', opportunityThreshold);
      const next = new Map<string, MarketRate>();

      prev.forEach((rate, symbol) => {
        const recalculatedRate = recalculateBestPair(rate, timeBasis, opportunityThreshold);
        next.set(symbol, recalculatedRate);
      });

      return next;
    });
  }, [timeBasis, opportunityThreshold]);

  // Feature 036: 跨標籤頁同步門檻變更
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === OPPORTUNITY_THRESHOLD_KEY && event.newValue) {
        const newThreshold = parseInt(event.newValue, 10);
        if (isValidThreshold(newThreshold)) {
          console.log('[useMarketRates] Threshold updated from another tab:', newThreshold);
          setOpportunityThresholdState(newThreshold);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

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
        // Convert array to Map
        const newMap = new Map<string, MarketRate>();
        data.data.rates.forEach((rate: MarketRate) => {
          newMap.set(rate.symbol, rate);
        });
        setRatesMap(newMap);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 只在組件掛載時執行一次

  return {
    ratesMap,
    stats,
    isConnected,
    isLoading,
    error,
    reload,
    timeBasis,
    setTimeBasis: handleSetTimeBasis,
    opportunityThreshold,
    setOpportunityThreshold: handleSetOpportunityThreshold,
  };
}
