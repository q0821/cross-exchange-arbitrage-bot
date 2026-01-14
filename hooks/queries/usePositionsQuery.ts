'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';

/**
 * Position Status Types
 */
export type PositionStatus =
  | 'PENDING'
  | 'OPENING'
  | 'OPEN'
  | 'CLOSING'
  | 'CLOSED'
  | 'FAILED'
  | 'PARTIAL';

export type ConditionalOrderStatus = 'PENDING' | 'SETTING' | 'SET' | 'PARTIAL' | 'FAILED' | null;

/**
 * Position Data Type (matches API response)
 */
export interface Position {
  id: string;
  userId: string;
  symbol: string;
  longExchange: string;
  shortExchange: string;
  leverage: number;
  status: PositionStatus;
  createdAt: string;
  updatedAt: string;
  // Stop Loss / Take Profit (Feature 038)
  stopLossEnabled: boolean;
  stopLossPercent?: number;
  takeProfitEnabled: boolean;
  takeProfitPercent?: number;
  conditionalOrderStatus: ConditionalOrderStatus;
  conditionalOrderError?: string | null;
  longStopLossPrice?: number | null;
  shortStopLossPrice?: number | null;
  longTakeProfitPrice?: number | null;
  shortTakeProfitPrice?: number | null;
}

export interface PositionsData {
  positions: Position[];
  total: number;
}

interface UsePositionsQueryOptions {
  /** Filter by position status (default: all non-CLOSED) */
  status?: PositionStatus[];
  /** Pagination limit (default: 50) */
  limit?: number;
  /** Pagination offset (default: 0) */
  offset?: number;
  /** Enable the query (default: true) */
  enabled?: boolean;
}

/**
 * Fetch positions from API
 */
async function fetchPositions(options: UsePositionsQueryOptions): Promise<PositionsData> {
  const params = new URLSearchParams();

  if (options.status && options.status.length > 0) {
    params.set('status', options.status.join(','));
  }
  if (options.limit !== undefined) {
    params.set('limit', String(options.limit));
  }
  if (options.offset !== undefined) {
    params.set('offset', String(options.offset));
  }

  const queryString = params.toString();
  const url = queryString ? `/api/positions?${queryString}` : '/api/positions';

  const response = await fetch(url, {
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Failed to fetch positions: ${response.status}`);
  }

  const result = await response.json();
  return result.data;
}

/**
 * usePositionsQuery - Query hook for trading positions
 *
 * Features:
 * - Automatic caching with TanStack Query
 * - Short stale time (10s) for trading accuracy
 * - Supports status filtering and pagination
 *
 * @param options Query options
 * @returns Query result with positions data
 */
export function usePositionsQuery(options: UsePositionsQueryOptions = {}) {
  const { status, limit, offset, enabled = true } = options;

  return useQuery({
    queryKey: queryKeys.trading.positions(),
    queryFn: () => fetchPositions({ status, limit, offset }),
    enabled,
    staleTime: 10 * 1000, // 10 seconds - short for trading accuracy
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}
