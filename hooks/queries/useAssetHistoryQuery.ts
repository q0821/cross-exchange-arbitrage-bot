'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';

/**
 * History snapshot data point
 */
export interface HistorySnapshot {
  id: string;
  timestamp: string;
  totalBalanceUSD: number;
  binanceBalanceUSD?: number | null;
  okxBalanceUSD?: number | null;
  mexcBalanceUSD?: number | null;
  gateioBalanceUSD?: number | null;
  bingxBalanceUSD?: number | null;
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
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Failed to fetch asset history: ${response.status}`);
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
