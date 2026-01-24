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

/**
 * 組合持倉聚合資訊 (Feature 069)
 */
export interface PositionGroupAggregate {
  totalQuantity: string;
  avgLongEntryPrice: string;
  avgShortEntryPrice: string;
  totalFundingPnL: string | null;
  totalUnrealizedPnL: string | null;
  positionCount: number;
  firstOpenedAt: string | null;
  stopLossPercent: string | null;
  takeProfitPercent: string | null;
}

/**
 * 組合持倉 (Feature 069)
 */
export interface PositionGroup {
  groupId: string;
  symbol: string;
  longExchange: string;
  shortExchange: string;
  positions: Position[];
  aggregate: PositionGroupAggregate;
}

/**
 * 分組後的持倉資料 (Feature 069)
 */
export interface GroupedPositionsData {
  positions: Position[];  // 未分組的持倉
  groups: PositionGroup[];  // 分組後的持倉
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
  /** Return grouped positions (Feature 069) */
  grouped?: boolean;
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
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    // API 回傳格式為 { error: { code, message, details } } 或 { error: string }
    const errorMessage =
      typeof errorData.error === 'object' ? errorData.error?.message : errorData.error;
    throw new Error(errorMessage || `Failed to fetch positions: ${response.status}`);
  }

  const result = await response.json();
  return result.data;
}

/**
 * Fetch grouped positions from API (Feature 069)
 */
async function fetchGroupedPositions(
  options: Omit<UsePositionsQueryOptions, 'grouped'>
): Promise<GroupedPositionsData> {
  const params = new URLSearchParams();

  // Feature 069: Enable grouped response
  params.set('grouped', 'true');

  if (options.status && options.status.length > 0) {
    params.set('status', options.status.join(','));
  }

  const queryString = params.toString();
  const url = `/api/positions?${queryString}`;

  const response = await fetch(url, {
    credentials: 'include',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    const errorMessage =
      typeof errorData.error === 'object' ? errorData.error?.message : errorData.error;
    throw new Error(errorMessage || `Failed to fetch grouped positions: ${response.status}`);
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

/**
 * useGroupedPositionsQuery - Query hook for grouped trading positions
 *
 * Feature 069: 分單持倉合併顯示
 *
 * Features:
 * - Returns positions grouped by groupId
 * - Includes aggregate statistics for each group
 * - Supports status filtering
 *
 * @param options Query options
 * @returns Query result with grouped positions data
 */
export function useGroupedPositionsQuery(
  options: Omit<UsePositionsQueryOptions, 'grouped' | 'limit' | 'offset'> = {}
) {
  const { status, enabled = true } = options;

  return useQuery({
    queryKey: queryKeys.trading.groupedPositions(),
    queryFn: () => fetchGroupedPositions({ status }),
    enabled,
    staleTime: 10 * 1000, // 10 seconds - short for trading accuracy
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}
