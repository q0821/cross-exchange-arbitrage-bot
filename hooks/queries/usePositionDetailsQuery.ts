'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import type { PositionDetailsInfo, PositionDetailsResponse } from '@/src/types/trading';

interface UsePositionDetailsQueryOptions {
  /** Position ID to fetch details for */
  positionId: string;
  /** Enable the query (default: false - must be explicitly enabled) */
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

  const result: PositionDetailsResponse = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error?.message || 'Failed to fetch position details');
  }

  return result.data;
}

/**
 * usePositionDetailsQuery - Query hook for position details
 *
 * Features:
 * - Automatic caching with TanStack Query
 * - Data is cached for 5 minutes (gcTime)
 * - Stale after 30 seconds (will refetch in background)
 * - Disabled by default - must be enabled when user clicks "View Details"
 *
 * @param options Query options
 * @returns Query result with position details
 */
export function usePositionDetailsQuery(options: UsePositionDetailsQueryOptions) {
  const { positionId, enabled = false } = options;

  return useQuery({
    queryKey: queryKeys.trading.positionDetails(positionId),
    queryFn: () => fetchPositionDetails(positionId),
    enabled: enabled && !!positionId,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
}
