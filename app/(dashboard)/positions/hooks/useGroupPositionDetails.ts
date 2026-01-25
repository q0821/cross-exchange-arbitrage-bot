/**
 * useGroupPositionDetails - Hook for fetching aggregated position group details
 *
 * Feature 069: 分單持倉合併顯示與批量平倉
 *
 * This hook fetches details for all positions in a group and aggregates:
 * - Current prices (weighted average)
 * - Funding fee breakdown (summed by settlement time)
 * - Unrealized PnL (summed)
 */

'use client';

import { useQueries, UseQueryResult } from '@tanstack/react-query';
import { useMemo } from 'react';
import { queryKeys } from '@/lib/query-keys';
import type { PositionDetailsInfo } from '@/src/types/trading';
import type { PositionGroup } from '@/hooks/queries/usePositionsQuery';

/**
 * 資金費率結算記錄（按時間聚合）
 */
export interface FundingSettlement {
  timestamp: number;
  datetime: string;
  longAmount: number;
  shortAmount: number;
  totalAmount: number;
}

/**
 * Aggregated group details
 */
export interface GroupPositionDetails {
  // Price information
  longCurrentPrice: number | null;
  shortCurrentPrice: number | null;
  priceQuerySuccess: boolean;
  priceQueryError: string | null;

  // Funding fees
  totalLongFundingFee: number;
  totalShortFundingFee: number;
  totalFundingFee: number;
  fundingFeeQuerySuccess: boolean;
  fundingFeeQueryError: string | null;

  // 按時間聚合的結算明細
  fundingSettlements: FundingSettlement[];

  // Unrealized PnL
  totalLongUnrealizedPnL: number;
  totalShortUnrealizedPnL: number;
  totalUnrealizedPnL: number;

  // Fees
  totalOpenFees: number;

  // Meta
  queriedAt: Date;
  positionCount: number;
  loadedCount: number;
}

interface UseGroupPositionDetailsOptions {
  group: PositionGroup;
  enabled?: boolean;
}

/**
 * Fetch position details from API
 */
async function fetchPositionDetails(positionId: string): Promise<PositionDetailsInfo> {
  const response = await fetch(`/api/positions/${positionId}/details`, {
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
    throw new Error(error.error?.message || `Failed to fetch position details: ${response.status}`);
  }

  const result = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error?.message || 'Failed to fetch position details');
  }

  return result.data;
}

/**
 * useGroupPositionDetails - Fetch and aggregate details for all positions in a group
 */
export function useGroupPositionDetails({ group, enabled = false }: UseGroupPositionDetailsOptions) {
  const positionIds = group.positions
    .filter((p) => p.status === 'OPEN')
    .map((p) => p.id);

  // Fetch details for all positions in parallel
  const queries = useQueries({
    queries: positionIds.map((positionId) => ({
      queryKey: queryKeys.trading.positionDetails(positionId),
      queryFn: () => fetchPositionDetails(positionId),
      enabled: enabled && !!positionId,
      staleTime: 30 * 1000, // 30 seconds
      gcTime: 5 * 60 * 1000, // 5 minutes
      retry: 2,
    })),
  }) as UseQueryResult<PositionDetailsInfo, Error>[];

  // Aggregate results
  const aggregatedDetails = useMemo((): GroupPositionDetails | null => {
    // Check if any queries are still loading
    const loadedQueries = queries.filter((q) => q.isSuccess && q.data);
    const loadedCount = loadedQueries.length;

    if (loadedCount === 0) {
      return null;
    }

    const loadedData = loadedQueries.map((q) => q.data!);

    // Price information - use the first successful query (all positions share the same symbol)
    const priceData = loadedData.find((d) => d.priceQuerySuccess);
    const longCurrentPrice = priceData?.longCurrentPrice ?? null;
    const shortCurrentPrice = priceData?.shortCurrentPrice ?? null;
    const priceQuerySuccess = !!priceData;
    const priceQueryError = !priceQuerySuccess
      ? loadedData.find((d) => d.priceQueryError)?.priceQueryError ?? null
      : null;

    // Aggregate funding fees - 使用 entry ID 去重（因為交易所是帳戶級別結算，多個持倉會返回相同數據）
    let fundingFeeQuerySuccess = false;
    let fundingFeeQueryError: string | null = null;

    // 用 entry ID 去重，避免重複計算
    const longEntriesMap = new Map<string, { timestamp: number; datetime: string; amount: number }>();
    const shortEntriesMap = new Map<string, { timestamp: number; datetime: string; amount: number }>();

    for (const data of loadedData) {
      if (data.fundingFeeQuerySuccess && data.fundingFees) {
        fundingFeeQuerySuccess = true;

        // 收集多頭結算記錄（用 ID 去重）
        if (data.fundingFees.longEntries) {
          for (const entry of data.fundingFees.longEntries) {
            if (!longEntriesMap.has(entry.id)) {
              longEntriesMap.set(entry.id, {
                timestamp: entry.timestamp,
                datetime: entry.datetime,
                amount: parseFloat(entry.amount) || 0,
              });
            }
          }
        }

        // 收集空頭結算記錄（用 ID 去重）
        if (data.fundingFees.shortEntries) {
          for (const entry of data.fundingFees.shortEntries) {
            if (!shortEntriesMap.has(entry.id)) {
              shortEntriesMap.set(entry.id, {
                timestamp: entry.timestamp,
                datetime: entry.datetime,
                amount: parseFloat(entry.amount) || 0,
              });
            }
          }
        }
      } else if (!fundingFeeQuerySuccess && data.fundingFeeQueryError) {
        fundingFeeQueryError = data.fundingFeeQueryError;
      }
    }

    // 計算去重後的總額
    let totalLongFundingFee = 0;
    for (const entry of longEntriesMap.values()) {
      totalLongFundingFee += entry.amount;
    }

    let totalShortFundingFee = 0;
    for (const entry of shortEntriesMap.values()) {
      totalShortFundingFee += entry.amount;
    }

    const totalFundingFee = totalLongFundingFee + totalShortFundingFee;

    // 按時間戳合併多頭和空頭結算記錄
    const settlementMap = new Map<number, FundingSettlement>();

    for (const entry of longEntriesMap.values()) {
      const existing = settlementMap.get(entry.timestamp);
      if (existing) {
        existing.longAmount = entry.amount;
        existing.totalAmount = existing.longAmount + existing.shortAmount;
      } else {
        settlementMap.set(entry.timestamp, {
          timestamp: entry.timestamp,
          datetime: entry.datetime,
          longAmount: entry.amount,
          shortAmount: 0,
          totalAmount: entry.amount,
        });
      }
    }

    for (const entry of shortEntriesMap.values()) {
      const existing = settlementMap.get(entry.timestamp);
      if (existing) {
        existing.shortAmount = entry.amount;
        existing.totalAmount = existing.longAmount + existing.shortAmount;
      } else {
        settlementMap.set(entry.timestamp, {
          timestamp: entry.timestamp,
          datetime: entry.datetime,
          longAmount: 0,
          shortAmount: entry.amount,
          totalAmount: entry.amount,
        });
      }
    }

    // 按時間排序（最新的在前）
    const fundingSettlements = Array.from(settlementMap.values())
      .sort((a, b) => b.timestamp - a.timestamp);

    // Aggregate unrealized PnL
    let totalLongUnrealizedPnL = 0;
    let totalShortUnrealizedPnL = 0;

    for (const data of loadedData) {
      if (data.longUnrealizedPnL !== undefined) {
        totalLongUnrealizedPnL += data.longUnrealizedPnL;
      }
      if (data.shortUnrealizedPnL !== undefined) {
        totalShortUnrealizedPnL += data.shortUnrealizedPnL;
      }
    }

    const totalUnrealizedPnL = totalLongUnrealizedPnL + totalShortUnrealizedPnL;

    // Aggregate fees
    let totalOpenFees = 0;
    for (const data of loadedData) {
      if (data.fees?.totalFees) {
        totalOpenFees += parseFloat(data.fees.totalFees) || 0;
      }
    }

    return {
      longCurrentPrice,
      shortCurrentPrice,
      priceQuerySuccess,
      priceQueryError,
      totalLongFundingFee,
      totalShortFundingFee,
      totalFundingFee,
      fundingFeeQuerySuccess,
      fundingFeeQueryError,
      fundingSettlements,
      totalLongUnrealizedPnL,
      totalShortUnrealizedPnL,
      totalUnrealizedPnL,
      totalOpenFees,
      queriedAt: new Date(),
      positionCount: positionIds.length,
      loadedCount,
    };
  }, [queries, positionIds.length]);

  // Overall loading state
  const isLoading = queries.some((q) => q.isLoading);
  const isError = queries.every((q) => q.isError);
  const error = isError ? queries[0]?.error?.message ?? 'Failed to load details' : null;

  // Refetch all queries
  const refetch = () => {
    queries.forEach((q) => q.refetch());
  };

  return {
    details: aggregatedDetails,
    isLoading,
    isError,
    error,
    refetch,
  };
}
