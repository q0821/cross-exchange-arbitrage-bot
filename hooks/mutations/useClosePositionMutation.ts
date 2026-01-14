'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import type { TradePerformanceInfo } from '@/src/types/trading';

/**
 * Close position request data
 */
export interface ClosePositionInput {
  positionId: string;
}

/**
 * Partial close response details
 */
interface PartialCloseDetails {
  exchange: string;
  side: 'LONG' | 'SHORT';
  orderId: string;
  price: string;
  quantity: string;
  fee: string;
}

interface FailedSideDetails {
  exchange: string;
  error: string;
  errorCode: string;
}

/**
 * Close position API response
 */
export interface ClosePositionResponse {
  success: boolean;
  trade?: TradePerformanceInfo;
  error?: string;
  message?: string;
  // For partial close (207)
  partialClosed?: PartialCloseDetails;
  failedSide?: FailedSideDetails;
}

interface UseClosePositionMutationOptions {
  onSuccess?: (
    data: ClosePositionResponse,
    variables: ClosePositionInput,
    context: unknown
  ) => void;
  onError?: (error: Error, variables: ClosePositionInput, context: unknown) => void;
  onSettled?: (
    data: ClosePositionResponse | undefined,
    error: Error | null,
    variables: ClosePositionInput,
    context: unknown
  ) => void;
}

/**
 * Execute close position API call
 */
async function closePosition(data: ClosePositionInput): Promise<ClosePositionResponse> {
  const response = await fetch(`/api/positions/${data.positionId}/close`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const result: ClosePositionResponse = await response.json();

  // Handle 207 partial close as error
  if (response.status === 207) {
    const errorMessage = result.message || '部分平倉成功，部分失敗';
    throw new Error(errorMessage);
  }

  if (!response.ok) {
    const errorMessage = result.message || result.error || '平倉失敗';
    throw new Error(errorMessage);
  }

  return result;
}

/**
 * useClosePositionMutation - Mutation hook for closing positions
 *
 * Features:
 * - Automatic cache invalidation on success (positions, trades, assets)
 * - Removes specific position from cache
 * - Error handling including partial close (207) scenario
 * - Support for custom callbacks (onSuccess, onError, onSettled)
 *
 * Feature 063: Frontend Data Caching (T035)
 *
 * @param options Mutation options (onSuccess, onError, onSettled callbacks)
 * @returns Mutation result with mutate, mutateAsync, isPending, isSuccess, isError, data, error, reset
 */
export function useClosePositionMutation(options: UseClosePositionMutationOptions = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: closePosition,
    onSuccess: (data, variables, context) => {
      // Remove the specific position from cache
      queryClient.removeQueries({
        queryKey: queryKeys.trading.position(variables.positionId),
      });

      // Invalidate positions list cache
      queryClient.invalidateQueries({
        queryKey: queryKeys.trading.positions(),
      });

      // Invalidate trades cache (new trade created)
      queryClient.invalidateQueries({
        queryKey: queryKeys.trading.trades(),
      });

      // Invalidate assets cache (balances changed after closing position)
      queryClient.invalidateQueries({
        queryKey: queryKeys.assets.all,
      });

      // Call user-provided onSuccess callback
      options.onSuccess?.(data, variables, context);
    },
    onError: options.onError,
    onSettled: options.onSettled,
  });
}
