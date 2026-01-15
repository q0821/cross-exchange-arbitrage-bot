'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { queryKeys } from '@/lib/query-keys';
import { useSocket } from '@/hooks/useSocket';

/**
 * Exchange Rate Data
 */
export interface ExchangeRate {
  rate: number;
  ratePercent: string;
  price: number;
  nextFundingTime: string;
  normalized?: {
    rate8h?: number;
  };
  originalInterval?: string;
}

/**
 * Best Trading Pair
 */
export interface BestPair {
  longExchange: string;
  shortExchange: string;
  spreadPercent: string;
  annualizedReturn: string;
  priceDiffPercent?: string | null;
}

/**
 * Symbol Rate Data
 */
export interface SymbolRate {
  symbol: string;
  exchanges: Record<string, ExchangeRate>;
  bestPair: BestPair | null;
  status: 'opportunity' | 'approaching' | 'normal';
  timestamp: string;
}

/**
 * Market Stats
 */
export interface MarketStats {
  totalSymbols: number;
  opportunityCount: number;
  approachingCount: number;
  maxSpread: {
    symbol: string;
    spread: string;
  } | null;
  uptime: number;
  lastUpdate: string | null;
}

/**
 * Market Rates Response
 */
export interface MarketRatesData {
  rates: SymbolRate[];
  stats: MarketStats;
  threshold: string;
}

interface UseMarketRatesQueryOptions {
  /** Annualized return threshold filter */
  threshold?: number;
  /** Enable the query (default: true) */
  enabled?: boolean;
}

/**
 * Fetch market rates from API
 */
async function fetchMarketRates(threshold?: number): Promise<MarketRatesData> {
  const params = new URLSearchParams();
  if (threshold !== undefined) {
    params.set('threshold', String(threshold));
  }

  const queryString = params.toString();
  const url = queryString ? `/api/market-rates?${queryString}` : '/api/market-rates';

  const response = await fetch(url, {
    credentials: 'include',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    // API 回傳格式為 { error: { code, message, details } } 或 { error: string }
    const errorMessage =
      typeof errorData.error === 'object' ? errorData.error?.message : errorData.error;
    throw new Error(errorMessage || `Failed to fetch market rates: ${response.status}`);
  }

  const result = await response.json();
  return result.data;
}

/**
 * useMarketRatesQuery - Query hook for market funding rates
 *
 * Features:
 * - Automatic caching with TanStack Query
 * - WebSocket integration for real-time rate updates
 * - staleTime: 0 (always stale - relies on WebSocket for updates)
 *
 * @param options Query options
 * @returns Query result with market rates data + WebSocket connection status
 */
export function useMarketRatesQuery(options: UseMarketRatesQueryOptions = {}) {
  const { threshold, enabled = true } = options;
  const queryClient = useQueryClient();
  const { socket, isConnected } = useSocket({ enabled });

  const query = useQuery({
    queryKey: queryKeys.market.rates(),
    queryFn: () => fetchMarketRates(threshold),
    enabled,
    staleTime: 0, // Always stale - WebSocket provides real-time updates
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
  });

  // WebSocket integration: Update cache on rates:update events
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleRatesUpdate = (data: { rates?: SymbolRate[]; stats?: MarketStats }) => {
      queryClient.setQueryData<MarketRatesData>(queryKeys.market.rates(), (old) => {
        if (!old) return old;

        // Merge updated rates with existing data
        if (data.rates) {
          const ratesMap = new Map(old.rates.map((r) => [r.symbol, r]));

          // Update or add new rates
          for (const updatedRate of data.rates) {
            ratesMap.set(updatedRate.symbol, updatedRate);
          }

          return {
            ...old,
            rates: Array.from(ratesMap.values()),
            stats: data.stats ?? old.stats,
          };
        }

        return old;
      });
    };

    socket.on('rates:update', handleRatesUpdate);

    return () => {
      socket.off('rates:update', handleRatesUpdate);
    };
  }, [socket, isConnected, queryClient]);

  // Return query result with additional isConnected status
  return {
    ...query,
    isConnected,
  };
}
