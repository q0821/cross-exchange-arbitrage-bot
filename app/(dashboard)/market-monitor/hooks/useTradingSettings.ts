/**
 * useTradingSettings Hook
 *
 * 獲取用戶的交易設定預設值
 * Feature: 038-specify-scripts-bash (T033)
 * Feature: 063-frontend-data-caching (T025d) - TanStack Query 整合
 */

'use client';

import { useCallback } from 'react';
import {
  useTradingSettingsQuery,
  DEFAULT_TRADING_SETTINGS,
} from '@/hooks/queries/useTradingSettingsQuery';
import type { TradingSettings } from '@/src/types/trading';

interface UseTradingSettingsResult {
  settings: TradingSettings | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * 獲取用戶的交易設定 Hook
 *
 * Feature 063: 使用 TanStack Query 進行快取管理
 * - 5 分鐘 staleTime（設定不常變更）
 * - 跨頁面共享快取
 * - 自動處理 401 錯誤（回傳預設值）
 */
export function useTradingSettings(): UseTradingSettingsResult {
  const { data, isLoading, error, refetch } = useTradingSettingsQuery();

  // 將 TanStack Query 的 refetch 包裝為 async void 函數
  const handleRefetch = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    // 如果有資料就用資料，否則用預設值
    settings: data ?? DEFAULT_TRADING_SETTINGS,
    isLoading,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    refetch: handleRefetch,
  };
}
