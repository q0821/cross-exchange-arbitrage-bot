/**
 * useTradingSettings Hook
 *
 * 獲取用戶的交易設定預設值
 * Feature: 038-specify-scripts-bash (T033)
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import type { TradingSettings } from '@/src/types/trading';

interface UseTradingSettingsResult {
  settings: TradingSettings | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * 預設交易設定（API 失敗時使用）
 */
const DEFAULT_SETTINGS: TradingSettings = {
  defaultStopLossEnabled: true,
  defaultStopLossPercent: 5.0,
  defaultTakeProfitEnabled: false,
  defaultTakeProfitPercent: 3.0,
  defaultLeverage: 1,
  maxPositionSizeUSD: 10000,
};

/**
 * 獲取用戶的交易設定 Hook
 */
export function useTradingSettings(): UseTradingSettingsResult {
  const [settings, setSettings] = useState<TradingSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/settings/trading');

      if (!response.ok) {
        // 如果 API 失敗，使用預設值
        if (response.status === 401) {
          // 未登入時使用預設值
          setSettings(DEFAULT_SETTINGS);
          return;
        }
        throw new Error(`Failed to fetch trading settings: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.data) {
        setSettings(data.data);
      } else {
        throw new Error(data.error?.message || 'Unknown error');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      // 發生錯誤時使用預設值
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return {
    settings,
    isLoading,
    error,
    refetch: fetchSettings,
  };
}
