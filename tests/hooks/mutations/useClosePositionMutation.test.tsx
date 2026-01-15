/**
 * Tests for useClosePositionMutation hook
 *
 * Feature 063: Frontend Data Caching (T033)
 * Testing mutation behavior with automatic cache invalidation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useClosePositionMutation } from '@/hooks/mutations/useClosePositionMutation';
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

describe('useClosePositionMutation', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    mockFetch.mockReset();
  });

  afterEach(() => {
    queryClient.clear();
    vi.clearAllMocks();
  });

  const mockPositionId = 'pos-123';

  const mockSuccessResponse = {
    success: true,
    trade: {
      id: 'trade-1',
      symbol: 'BTCUSDT',
      longExchange: 'binance',
      shortExchange: 'okx',
      realizedPnL: '150.00',
      longEntryPrice: '50000',
      longExitPrice: '51000',
      shortEntryPrice: '50100',
      shortExitPrice: '51100',
      longPositionSize: '0.1',
      shortPositionSize: '0.1',
    },
  };

  it('should be in idle state initially', () => {
    const { result } = renderHook(() => useClosePositionMutation(), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.isPending).toBe(false);
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(result.current.data).toBeUndefined();
  });

  it('should execute close mutation successfully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockSuccessResponse,
    });

    const { result } = renderHook(() => useClosePositionMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate({ positionId: mockPositionId });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockSuccessResponse);
    expect(mockFetch).toHaveBeenCalledWith(`/api/positions/${mockPositionId}/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('should handle error response', async () => {
    const mockErrorResponse = {
      success: false,
      error: 'POSITION_NOT_FOUND',
      message: '持倉不存在',
    };

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => mockErrorResponse,
    });

    const { result } = renderHook(() => useClosePositionMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate({ positionId: mockPositionId });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toContain('持倉不存在');
  });

  it('should handle partial close (207 status)', async () => {
    const mockPartialResponse = {
      success: false,
      error: 'PARTIAL_CLOSE',
      message: '部分平倉成功',
      partialClosed: {
        exchange: 'binance',
        side: 'LONG',
        orderId: 'order-1',
        price: '51000',
        quantity: '0.1',
        fee: '0.5',
      },
      failedSide: {
        exchange: 'okx',
        error: 'Order failed',
        errorCode: 'EXCHANGE_ERROR',
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 207,
      json: async () => mockPartialResponse,
    });

    const { result } = renderHook(() => useClosePositionMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate({ positionId: mockPositionId });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // Partial close is treated as an error state
    expect(result.current.error?.message).toContain('部分平倉');
  });

  it('should handle network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useClosePositionMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate({ positionId: mockPositionId });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Network error');
  });

  it('should invalidate related queries on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockSuccessResponse,
    });

    // Pre-populate cache with data
    queryClient.setQueryData(queryKeys.trading.positions(), { data: [] });
    queryClient.setQueryData(queryKeys.trading.trades(), { data: [] });
    queryClient.setQueryData(queryKeys.assets.balances(), { data: {} });

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useClosePositionMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate({ positionId: mockPositionId });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Verify invalidateQueries was called for positions, trades, and assets
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.trading.positions(),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.trading.trades(),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.assets.all,
    });
  });

  it('should not invalidate queries on failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ success: false, message: 'Server error' }),
    });

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useClosePositionMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate({ positionId: mockPositionId });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it('should call onSuccess callback when provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockSuccessResponse,
    });

    const onSuccessMock = vi.fn();

    const { result } = renderHook(
      () =>
        useClosePositionMutation({
          onSuccess: onSuccessMock,
        }),
      { wrapper: createWrapper(queryClient) }
    );

    await act(async () => {
      result.current.mutate({ positionId: mockPositionId });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(onSuccessMock).toHaveBeenCalledTimes(1);
    expect(onSuccessMock).toHaveBeenCalledWith(
      mockSuccessResponse,
      { positionId: mockPositionId },
      undefined // context is undefined in TanStack Query v5
    );
  });

  it('should call onError callback when provided', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const onErrorMock = vi.fn();

    const { result } = renderHook(
      () =>
        useClosePositionMutation({
          onError: onErrorMock,
        }),
      { wrapper: createWrapper(queryClient) }
    );

    await act(async () => {
      result.current.mutate({ positionId: mockPositionId });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(onErrorMock).toHaveBeenCalledTimes(1);
    // TanStack Query v5 calls onError with (error, variables, context)
    const callArgs = onErrorMock.mock.calls[0];
    expect(callArgs[0]).toBeInstanceOf(Error);
    expect(callArgs[0].message).toBe('Network error');
    expect(callArgs[1]).toEqual({ positionId: mockPositionId });
  });

  it('should support mutateAsync for promise-based usage', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockSuccessResponse,
    });

    const { result } = renderHook(() => useClosePositionMutation(), {
      wrapper: createWrapper(queryClient),
    });

    let response;
    await act(async () => {
      response = await result.current.mutateAsync({ positionId: mockPositionId });
    });

    expect(response).toEqual(mockSuccessResponse);
  });

  it('should reset mutation state with reset()', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockSuccessResponse,
    });

    const { result } = renderHook(() => useClosePositionMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate({ positionId: mockPositionId });
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

  it('should remove specific position from cache on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockSuccessResponse,
    });

    // Pre-populate cache with specific position
    queryClient.setQueryData(queryKeys.trading.position(mockPositionId), {
      id: mockPositionId,
      symbol: 'BTCUSDT',
    });

    const removeQueriesSpy = vi.spyOn(queryClient, 'removeQueries');

    const { result } = renderHook(() => useClosePositionMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate({ positionId: mockPositionId });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Verify the specific position is removed from cache
    expect(removeQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.trading.position(mockPositionId),
    });
  });
});
