'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import type { TradePerformanceInfo } from '@/src/types/trading';

/**
 * Trades API Response Type
 */
export interface TradesData {
  trades: TradePerformanceInfo[];
  total: number;
}

interface UseTradesQueryOptions {
  /** Number of trades to fetch (default: 50) */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Enable the query (default: true) */
  enabled?: boolean;
}

/**
 * Fetch trades data from API
 */
async function fetchTrades(options: { limit?: number; offset?: number }): Promise<TradesData> {
  const params = new URLSearchParams();

  if (options.limit !== undefined) {
    params.set('limit', String(options.limit));
  }
  if (options.offset !== undefined) {
    params.set('offset', String(options.offset));
  }

  const queryString = params.toString();
  const url = queryString ? `/api/trades?${queryString}` : '/api/trades';

  const response = await fetch(url, {
    credentials: 'include',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    // API 回傳格式為 { error: { code, message, details } } 或 { error: string }
    const errorMessage =
      typeof errorData.error === 'object' ? errorData.error?.message : errorData.error;
    throw new Error(errorMessage || `Failed to fetch trades: ${response.status}`);
  }

  const result = await response.json();
  return result.data;
}

/**
 * useTradesQuery - Query hook for trade history
 *
 * Features:
 * - Automatic caching with TanStack Query
 * - Configurable pagination (limit, offset)
 * - staleTime: 30 seconds (trades don't change often)
 *
 * @param options Query options
 * @returns Query result with trades data
 */
export function useTradesQuery(options: UseTradesQueryOptions = {}) {
  const { limit = 50, offset, enabled = true } = options;

  return useQuery({
    queryKey: queryKeys.trading.trades(),
    queryFn: () => fetchTrades({ limit, offset }),
    enabled,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}
