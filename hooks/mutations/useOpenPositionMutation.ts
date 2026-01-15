'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';

/**
 * Open position request data
 */
export interface OpenPositionInput {
  symbol: string;
  longExchange: string;
  shortExchange: string;
  quantity: number;
  leverage: 1 | 2;
  stopLossEnabled: boolean;
  stopLossPercent?: number;
  takeProfitEnabled: boolean;
  takeProfitPercent?: number;
}

/**
 * Open position API response
 */
export interface OpenPositionResponse {
  success: boolean;
  data?: {
    positionId: string;
    symbol: string;
    longOrder: {
      exchange: string;
      orderId: string;
    };
    shortOrder: {
      exchange: string;
      orderId: string;
    };
  };
  error?: {
    code: string;
    message: string;
    requiresManualIntervention?: boolean;
    details?: {
      exchange?: string;
      orderId?: string;
      side?: string;
      quantity?: string;
    };
  };
}

interface UseOpenPositionMutationOptions {
  onSuccess?: (
    data: OpenPositionResponse,
    variables: OpenPositionInput,
    context: unknown
  ) => void;
  onError?: (error: Error, variables: OpenPositionInput, context: unknown) => void;
  onSettled?: (
    data: OpenPositionResponse | undefined,
    error: Error | null,
    variables: OpenPositionInput,
    context: unknown
  ) => void;
}

/**
 * Execute open position API call
 */
async function openPosition(data: OpenPositionInput): Promise<OpenPositionResponse> {
  const response = await fetch('/api/positions/open', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  const result: OpenPositionResponse = await response.json();

  if (!response.ok) {
    const errorMessage = result.error?.message || '開倉失敗';
    throw new Error(errorMessage);
  }

  return result;
}

/**
 * useOpenPositionMutation - Mutation hook for opening positions
 *
 * Features:
 * - Automatic cache invalidation on success (positions, assets)
 * - Error handling with typed error responses
 * - Support for custom callbacks (onSuccess, onError, onSettled)
 *
 * Feature 063: Frontend Data Caching (T034)
 *
 * @param options Mutation options (onSuccess, onError, onSettled callbacks)
 * @returns Mutation result with mutate, mutateAsync, isPending, isSuccess, isError, data, error, reset
 */
export function useOpenPositionMutation(options: UseOpenPositionMutationOptions = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: openPosition,
    onSuccess: (data, variables, context) => {
      // Invalidate positions list cache
      queryClient.invalidateQueries({
        queryKey: queryKeys.trading.positions(),
      });

      // Invalidate assets cache (balances changed after opening position)
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
