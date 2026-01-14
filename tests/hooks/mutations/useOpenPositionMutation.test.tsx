/**
 * Tests for useOpenPositionMutation hook
 *
 * Feature 063: Frontend Data Caching (T032)
 * Testing mutation behavior with automatic cache invalidation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useOpenPositionMutation } from '@/hooks/mutations/useOpenPositionMutation';
import { queryKeys } from '@/lib/query-keys';
import type { ReactNode } from 'react';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useOpenPositionMutation', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    mockFetch.mockReset();
  });

  afterEach(() => {
    queryClient.clear();
    vi.clearAllMocks();
  });

  const mockOpenPositionData = {
    symbol: 'BTCUSDT',
    longExchange: 'binance',
    shortExchange: 'okx',
    quantity: 0.1,
    leverage: 1 as const,
    stopLossEnabled: true,
    stopLossPercent: 5,
    takeProfitEnabled: false,
    takeProfitPercent: 3,
  };

  const mockSuccessResponse = {
    success: true,
    data: {
      positionId: 'pos-123',
      symbol: 'BTCUSDT',
      longOrder: { exchange: 'binance', orderId: 'order-1' },
      shortOrder: { exchange: 'okx', orderId: 'order-2' },
    },
  };

  it('should be in idle state initially', () => {
    const { result } = renderHook(() => useOpenPositionMutation(), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.isPending).toBe(false);
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(result.current.data).toBeUndefined();
  });

  it('should execute mutation successfully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const { result } = renderHook(() => useOpenPositionMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate(mockOpenPositionData);
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockSuccessResponse);
    expect(mockFetch).toHaveBeenCalledWith('/api/positions/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mockOpenPositionData),
    });
  });

  it('should handle error response', async () => {
    const mockErrorResponse = {
      success: false,
      error: { code: 'INSUFFICIENT_BALANCE', message: '餘額不足' },
    };

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => mockErrorResponse,
    });

    const { result } = renderHook(() => useOpenPositionMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate(mockOpenPositionData);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toContain('餘額不足');
  });

  it('should handle network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useOpenPositionMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate(mockOpenPositionData);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Network error');
  });

  it('should invalidate related queries on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    // Pre-populate cache with positions data
    queryClient.setQueryData(queryKeys.trading.positions(), { data: [] });
    queryClient.setQueryData(queryKeys.assets.balances(), { data: {} });

    // Spy on invalidateQueries
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useOpenPositionMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate(mockOpenPositionData);
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Verify invalidateQueries was called for positions and assets
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.trading.positions(),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.assets.all,
    });
  });

  it('should not invalidate queries on failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ success: false, error: { message: 'Failed' } }),
    });

    // Pre-populate cache
    queryClient.setQueryData(queryKeys.trading.positions(), { data: [] });

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useOpenPositionMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate(mockOpenPositionData);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // invalidateQueries should not be called on error
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it('should call onSuccess callback when provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const onSuccessMock = vi.fn();

    const { result } = renderHook(
      () =>
        useOpenPositionMutation({
          onSuccess: onSuccessMock,
        }),
      { wrapper: createWrapper(queryClient) }
    );

    await act(async () => {
      result.current.mutate(mockOpenPositionData);
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(onSuccessMock).toHaveBeenCalledTimes(1);
    expect(onSuccessMock).toHaveBeenCalledWith(
      mockSuccessResponse,
      mockOpenPositionData,
      undefined // context is undefined in TanStack Query v5
    );
  });

  it('should call onError callback when provided', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const onErrorMock = vi.fn();

    const { result } = renderHook(
      () =>
        useOpenPositionMutation({
          onError: onErrorMock,
        }),
      { wrapper: createWrapper(queryClient) }
    );

    await act(async () => {
      result.current.mutate(mockOpenPositionData);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(onErrorMock).toHaveBeenCalledTimes(1);
    // TanStack Query v5 calls onError with (error, variables, context)
    const callArgs = onErrorMock.mock.calls[0];
    expect(callArgs[0]).toBeInstanceOf(Error);
    expect(callArgs[0].message).toBe('Network error');
    expect(callArgs[1]).toEqual(mockOpenPositionData);
  });

  it('should handle 409 lock conflict error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({
        success: false,
        error: { code: 'LOCK_CONFLICT', message: '該交易對正在開倉中' },
      }),
    });

    const { result } = renderHook(() => useOpenPositionMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate(mockOpenPositionData);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toContain('該交易對正在開倉中');
  });

  it('should support mutateAsync for promise-based usage', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const { result } = renderHook(() => useOpenPositionMutation(), {
      wrapper: createWrapper(queryClient),
    });

    let response;
    await act(async () => {
      response = await result.current.mutateAsync(mockOpenPositionData);
    });

    expect(response).toEqual(mockSuccessResponse);
  });

  it('should reset mutation state with reset()', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const { result } = renderHook(() => useOpenPositionMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate(mockOpenPositionData);
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    act(() => {
      result.current.reset();
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(false);
    });
    expect(result.current.data).toBeUndefined();
  });
});
