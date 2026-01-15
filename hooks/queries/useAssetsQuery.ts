'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { queryKeys } from '@/lib/query-keys';
import { useSocket } from '@/hooks/useSocket';

/**
 * Assets API Response Type
 */
export interface AssetsData {
  exchanges: Array<{
    exchange: string;
    status: 'success' | 'error' | 'no_api_key';
    balanceUSD: number | null;
  }>;
  totalBalanceUSD: number;
  lastUpdated: string;
}

interface UseAssetsQueryOptions {
  /** Force refresh from exchange APIs instead of using cached snapshot */
  refresh?: boolean;
  /** Enable the query (default: true) */
  enabled?: boolean;
}

/**
 * Fetch assets data from API
 */
async function fetchAssets(refresh: boolean): Promise<AssetsData> {
  const url = refresh ? '/api/assets?refresh=true' : '/api/assets';

  const response = await fetch(url, {
    credentials: 'include',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    // API 回傳格式為 { error: { code, message, details } } 或 { error: string }
    const errorMessage =
      typeof errorData.error === 'object' ? errorData.error?.message : errorData.error;
    throw new Error(errorMessage || `Failed to fetch assets: ${response.status}`);
  }

  const result = await response.json();
  return result.data;
}

/**
 * useAssetsQuery - Query hook for user assets
 *
 * Features:
 * - Automatic caching with TanStack Query
 * - WebSocket integration for real-time balance updates
 * - Configurable staleTime (30s default based on data-model.md)
 *
 * @param options Query options
 * @returns Query result with assets data
 */
export function useAssetsQuery(options: UseAssetsQueryOptions = {}) {
  const { refresh = false, enabled = true } = options;
  const queryClient = useQueryClient();
  const { socket, isConnected } = useSocket();

  const query = useQuery({
    queryKey: queryKeys.assets.balances(),
    queryFn: () => fetchAssets(refresh),
    enabled,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // WebSocket integration: Update cache on balance:update events
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleBalanceUpdate = (data: { exchanges?: AssetsData['exchanges']; totalBalanceUSD?: number }) => {
      queryClient.setQueryData<AssetsData>(queryKeys.assets.balances(), (old) => {
        if (!old) return old;

        return {
          ...old,
          exchanges: data.exchanges ?? old.exchanges,
          totalBalanceUSD: data.totalBalanceUSD ?? old.totalBalanceUSD,
          lastUpdated: new Date().toISOString(),
        };
      });
    };

    socket.on('balance:update', handleBalanceUpdate);

    return () => {
      socket.off('balance:update', handleBalanceUpdate);
    };
  }, [socket, isConnected, queryClient]);

  return query;
}
