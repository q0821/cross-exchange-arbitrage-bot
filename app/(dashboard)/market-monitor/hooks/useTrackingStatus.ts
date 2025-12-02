/**
 * useTrackingStatus - 追蹤狀態管理 Hook
 * 管理用戶的模擬追蹤狀態和操作
 *
 * Feature 029: Simulated APY Tracking (T016)
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import type { MarketRate, ExchangeName } from '../types';

interface TrackingInfo {
  id: string;
  symbol: string;
  longExchange: string;
  shortExchange: string;
}

interface StartTrackingParams {
  symbol: string;
  longExchange: ExchangeName;
  shortExchange: ExchangeName;
  simulatedCapital: number;
  autoStopOnExpire: boolean;
}

interface UseTrackingStatusReturn {
  // 追蹤狀態
  activeTrackings: TrackingInfo[];
  isLoading: boolean;
  error: string | null;

  // 操作
  startTracking: (params: StartTrackingParams) => Promise<boolean>;
  isTracking: (symbol: string, longExchange: string, shortExchange: string) => boolean;
  refreshTrackings: () => Promise<void>;

  // Dialog 狀態
  selectedRate: MarketRate | null;
  isDialogOpen: boolean;
  openDialog: (rate: MarketRate) => void;
  closeDialog: () => void;
}

export function useTrackingStatus(): UseTrackingStatusReturn {
  const [activeTrackings, setActiveTrackings] = useState<TrackingInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dialog 狀態
  const [selectedRate, setSelectedRate] = useState<MarketRate | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // 獲取用戶的活躍追蹤列表
  const fetchActiveTrackings = useCallback(async () => {
    try {
      const response = await fetch('/api/simulated-tracking?status=ACTIVE');

      if (!response.ok) {
        if (response.status === 401) {
          // 未登入，不顯示錯誤
          return;
        }
        throw new Error('Failed to fetch trackings');
      }

      const data = await response.json();

      if (data.success && data.data?.trackings) {
        setActiveTrackings(
          data.data.trackings.map((t: {
            id: string;
            symbol: string;
            longExchange: string;
            shortExchange: string;
          }) => ({
            id: t.id,
            symbol: t.symbol,
            longExchange: t.longExchange,
            shortExchange: t.shortExchange,
          }))
        );
      }
    } catch (err) {
      console.error('Failed to fetch trackings:', err);
      // 不設置錯誤狀態，避免干擾主頁面
    }
  }, []);

  // 初始載入活躍追蹤
  useEffect(() => {
    fetchActiveTrackings();
  }, [fetchActiveTrackings]);

  // 開始追蹤
  const startTracking = useCallback(
    async (params: StartTrackingParams): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/simulated-tracking', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(params),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Failed to start tracking');
        }

        if (data.success && data.data?.tracking) {
          // 添加新追蹤到列表
          const newTracking = data.data.tracking;
          setActiveTrackings((prev) => [
            ...prev,
            {
              id: newTracking.id,
              symbol: newTracking.symbol,
              longExchange: newTracking.longExchange,
              shortExchange: newTracking.shortExchange,
            },
          ]);

          setIsDialogOpen(false);
          setSelectedRate(null);
          return true;
        }

        throw new Error('Unexpected response format');
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to start tracking';
        setError(message);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // 檢查是否正在追蹤特定機會
  const isTracking = useCallback(
    (symbol: string, longExchange: string, shortExchange: string): boolean => {
      return activeTrackings.some(
        (t) =>
          t.symbol === symbol &&
          t.longExchange.toLowerCase() === longExchange.toLowerCase() &&
          t.shortExchange.toLowerCase() === shortExchange.toLowerCase()
      );
    },
    [activeTrackings]
  );

  // 刷新追蹤列表
  const refreshTrackings = useCallback(async () => {
    await fetchActiveTrackings();
  }, [fetchActiveTrackings]);

  // 開啟對話框
  const openDialog = useCallback((rate: MarketRate) => {
    setSelectedRate(rate);
    setIsDialogOpen(true);
    setError(null);
  }, []);

  // 關閉對話框
  const closeDialog = useCallback(() => {
    setIsDialogOpen(false);
    setSelectedRate(null);
    setError(null);
  }, []);

  return {
    activeTrackings,
    isLoading,
    error,
    startTracking,
    isTracking,
    refreshTrackings,
    selectedRate,
    isDialogOpen,
    openDialog,
    closeDialog,
  };
}
