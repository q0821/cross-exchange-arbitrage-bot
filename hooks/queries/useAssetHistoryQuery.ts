'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';

/**
 * History snapshot data point
 * 注意：API 回傳的是已轉換的格式（binance 而非 binanceBalanceUSD）
 */
export interface HistorySnapshot {
  timestamp: string;
  binance: number | null;
  okx: number | null;
  mexc: number | null;
  gate: number | null;
  bingx: number | null;
  total: number;
}

/**
 * History data response
 */
export interface AssetHistoryData {
  snapshots: HistorySnapshot[];
  period: {
    days: number;
    from: string;
    to: string;
  };
  summary: {
    startTotal: number | null;
    endTotal: number | null;
    changeUSD: number | null;
    changePercent: number | null;
  };
}

interface UseAssetHistoryQueryOptions {
  /** Number of days to fetch history for (7, 14, or 30) */
  days: number;
  /** Enable the query (default: true) */
  enabled?: boolean;
}

/**
 * Fetch asset history data from API
 */
async function fetchAssetHistory(days: number): Promise<AssetHistoryData> {
  const response = await fetch(`/api/assets/history?days=${days}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    // API 回傳格式為 { error: { code, message, details } } 或 { error: string }
    const errorMessage =
      typeof errorData.error === 'object' ? errorData.error?.message : errorData.error;
    throw new Error(errorMessage || `Failed to fetch asset history: ${response.status}`);
  }

  const result = await response.json();
  return result.data;
}

/**
 * useAssetHistoryQuery - Query hook for asset history data
 *
 * Features:
 * - Automatic caching with TanStack Query
 * - Different cache key for different time ranges (7, 14, 30 days)
 * - staleTime: 5 minutes (historical data doesn't change often)
 *
 * @param options Query options
 * @returns Query result with asset history data
 */
export function useAssetHistoryQuery(options: UseAssetHistoryQueryOptions) {
  const { days, enabled = true } = options;

  return useQuery({
    queryKey: queryKeys.assets.history(days),
    queryFn: () => fetchAssetHistory(days),
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes - historical data doesn't change often
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}
