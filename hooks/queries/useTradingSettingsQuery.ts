'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import type { TradingSettings } from '@/src/types/trading';

/**
 * Default trading settings (used when API fails or user is not logged in)
 */
export const DEFAULT_TRADING_SETTINGS: TradingSettings = {
  defaultStopLossEnabled: true,
  defaultStopLossPercent: 5.0,
  defaultTakeProfitEnabled: false,
  defaultTakeProfitPercent: 3.0,
  defaultLeverage: 1,
  maxPositionSizeUSD: 10000,
};

interface UseTradingSettingsQueryOptions {
  /** Enable the query (default: true) */
  enabled?: boolean;
}

/**
 * Fetch trading settings from API
 */
async function fetchTradingSettings(): Promise<TradingSettings> {
  const response = await fetch('/api/settings/trading', {
    credentials: 'include',
  });

  // Return default settings for 401 (not logged in)
  if (response.status === 401) {
    return DEFAULT_TRADING_SETTINGS;
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    // API 回傳格式為 { error: { code, message, details } } 或 { error: string }
    const errorMessage =
      typeof errorData.error === 'object' ? errorData.error?.message : errorData.error;
    throw new Error(errorMessage || `Failed to fetch trading settings: ${response.status}`);
  }

  const result = await response.json();

  if (result.success && result.data) {
    return result.data;
  }

  throw new Error(result.error?.message || 'Unknown error');
}

/**
 * useTradingSettingsQuery - Query hook for user trading settings
 *
 * Features:
 * - Automatic caching with TanStack Query
 * - Long staleTime (5 minutes) since settings rarely change
 * - Default settings fallback for 401 unauthorized
 *
 * @param options Query options
 * @returns Query result with trading settings
 */
export function useTradingSettingsQuery(options: UseTradingSettingsQueryOptions = {}) {
  const { enabled = true } = options;

  return useQuery({
    queryKey: queryKeys.trading.settings(),
    queryFn: fetchTradingSettings,
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes - settings rarely change
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}
