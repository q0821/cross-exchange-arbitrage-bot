/**
 * useMarketRates - 市場費率訂閱 Hook
 * 訂閱即時費率更新和統計資訊
 *
 * Feature: 006-web-trading-platform (User Story 2.5)
 * Feature: 012-specify-scripts-bash (User Story 1 - T018)
 * Feature: 019-fix-time-basis-switching - 支援前端動態重新計算費率差
 * Feature: 036-opportunity-threshold-settings - 可配置年化收益門檻
 * Feature: 063-frontend-data-caching (T025c) - TanStack Query 整合
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useMarketRatesQuery } from '@/hooks/queries/useMarketRatesQuery';
import { DEFAULT_EXCHANGE_LIST } from '../types';
import type { MarketRate, MarketRatesUpdatePayload, MarketStatsPayload, ExchangeName } from '../types';
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
  /** 後端啟用的交易所列表 */
  activeExchanges: ExchangeName[];
}

/**
 * useMarketRates Hook
 * 自動訂閱 WebSocket 事件並管理即時費率數據
 *
 * Feature 012: 支援標準化費率時間基準選擇
 * Feature 036: 支援可配置年化收益門檻
 * Feature 063: TanStack Query 整合 - 初始資料使用快取
 */
export function useMarketRates(): UseMarketRatesReturn {
  const [ratesMap, setRatesMap] = useState<Map<string, MarketRate>>(new Map());
  const [stats, setStats] = useState<MarketStats | null>(null);
  const [timeBasis, setTimeBasisState] = useState<TimeBasis>(() => getTimeBasisPreference());
  // Feature 036: 年化收益門檻狀態
  const [opportunityThreshold, setOpportunityThresholdState] = useState<number>(
    () => getOpportunityThresholdPreference()
  );
  // 後端啟用的交易所列表（從 WebSocket 訂閱響應獲取）
  const [activeExchanges, setActiveExchanges] = useState<ExchangeName[]>(DEFAULT_EXCHANGE_LIST);

  // Feature 063: TanStack Query 用於初始載入和跨頁面快取
  const {
    data: queryData,
    isLoading: isQueryLoading,
    error: queryError,
    refetch: queryRefetch,
  } = useMarketRatesQuery({ threshold: opportunityThreshold });

  // WebSocket 錯誤狀態
  const [wsError, setWsError] = useState<Error | null>(null);

  // WebSocket 連線
  const { isConnected, on, off, emit } = useWebSocket({
    onConnect: () => {
      console.log('[useMarketRates] WebSocket connected');
      // 訂閱市場費率更新
      emit('subscribe:market-rates');
      setWsError(null);
    },
    onDisconnect: () => {
      console.log('[useMarketRates] WebSocket disconnected');
    },
    onError: (err) => {
      console.error('[useMarketRates] WebSocket error:', err);
      setWsError(err);
    },
  });

  // 處理訂閱確認（包含伺服器端的 timeBasis 偏好和啟用交易所列表）
  const handleSubscribed = useCallback((data: { success: boolean; timeBasis?: number; activeExchanges?: string[] }) => {
    console.log('[useMarketRates] Subscribed to market rates:', data);
    if (data.success && data.timeBasis && [1, 4, 8, 24].includes(data.timeBasis)) {
      // 使用伺服器端儲存的用戶偏好
      const serverTimeBasis = data.timeBasis as TimeBasis;
      setTimeBasisState(serverTimeBasis);
      setTimeBasisPreference(serverTimeBasis); // 同步更新 localStorage
      console.log('[useMarketRates] Using server-side timeBasis preference:', serverTimeBasis);
    }
    // 更新啟用的交易所列表
    if (data.success && data.activeExchanges && data.activeExchanges.length > 0) {
      setActiveExchanges(data.activeExchanges as ExchangeName[]);
      console.log('[useMarketRates] Active exchanges from server:', data.activeExchanges);
    }
  }, []);

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
    on('subscribed:market-rates', handleSubscribed);
    on('rates:update', handleRatesUpdate);
    on('rates:stats', handleStatsUpdate);

    // 清理函數
    return () => {
      off('subscribed:market-rates', handleSubscribed);
      off('rates:update', handleRatesUpdate);
      off('rates:stats', handleStatsUpdate);
    };
  }, [isConnected, on, off, handleSubscribed, handleRatesUpdate, handleStatsUpdate]);

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

  // Feature 063: 從 TanStack Query 初始化資料
  useEffect(() => {
    if (queryData && ratesMap.size === 0) {
      console.log('[useMarketRates] Initializing from TanStack Query cache');
      const newMap = new Map<string, MarketRate>();
      queryData.rates.forEach((rate) => {
        // 轉換 SymbolRate 為 MarketRate 並重新計算 bestPair
        const marketRate: MarketRate = {
          symbol: rate.symbol,
          exchanges: rate.exchanges as unknown as Record<string, import('../types').ExchangeRateData>,
          bestPair: rate.bestPair ? {
            longExchange: rate.bestPair.longExchange as import('../types').ExchangeName,
            shortExchange: rate.bestPair.shortExchange as import('../types').ExchangeName,
            spread: parseFloat(rate.bestPair.spreadPercent),
            spreadPercent: parseFloat(rate.bestPair.spreadPercent),
            annualizedReturn: parseFloat(rate.bestPair.annualizedReturn),
            priceDiffPercent: rate.bestPair.priceDiffPercent ? parseFloat(rate.bestPair.priceDiffPercent) : null,
          } : null,
          status: rate.status,
          timestamp: rate.timestamp,
        };
        // 根據當前 timeBasis 和 threshold 重新計算
        const recalculatedRate = recalculateBestPair(marketRate, timeBasis, opportunityThreshold);
        newMap.set(rate.symbol, recalculatedRate);
      });
      setRatesMap(newMap);
      if (queryData.stats) {
        setStats({
          totalSymbols: queryData.stats.totalSymbols,
          opportunityCount: queryData.stats.opportunityCount,
          approachingCount: queryData.stats.approachingCount,
          maxSpread: queryData.stats.maxSpread ? {
            symbol: queryData.stats.maxSpread.symbol,
            spread: parseFloat(queryData.stats.maxSpread.spread),
          } : null,
          uptime: queryData.stats.uptime,
          lastUpdate: queryData.stats.lastUpdate,
        });
      }
    }
  }, [queryData, ratesMap.size, timeBasis, opportunityThreshold]);

  // 手動重新載入（使用 TanStack Query refetch）
  const reload = useCallback(async () => {
    console.log('[useMarketRates] Manual reload via TanStack Query');
    await queryRefetch();
  }, [queryRefetch]);

  // 計算 loading 和 error 狀態
  const isLoading = isQueryLoading && ratesMap.size === 0;
  // 合併 query error 和 WebSocket error，優先顯示 query error
  const error = queryError
    ? (queryError instanceof Error ? queryError : new Error(String(queryError)))
    : wsError;

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
    activeExchanges,
  };
}
