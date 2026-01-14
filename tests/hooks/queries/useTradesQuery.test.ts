/**
 * useTradesQuery Hook Tests
 *
 * Feature 063: Frontend Data Caching (T015a)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createWrapper, mockFetchResponse } from '@/tests/utils/query-test-utils';

describe('useTradesQuery', () => {
  beforeEach(() => {
    vi.resetModules();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockTradesResponse = {
    success: true,
    data: {
      trades: [
        {
          id: 'trade-1',
          symbol: 'BTCUSDT',
          longExchange: 'binance',
          shortExchange: 'okx',
          totalPnL: '50.25',
          roi: '2.5',
          priceDiffPnL: '45.00',
          fundingFeePnL: '5.25',
          holdingDuration: 7200,
          closedAt: '2026-01-14T10:00:00.000Z',
          closeReason: 'MANUAL',
        },
        {
          id: 'trade-2',
          symbol: 'ETHUSDT',
          longExchange: 'okx',
          shortExchange: 'binance',
          totalPnL: '-15.50',
          roi: '-0.8',
          priceDiffPnL: '-20.00',
          fundingFeePnL: '4.50',
          holdingDuration: 3600,
          closedAt: '2026-01-14T08:00:00.000Z',
          closeReason: 'LONG_SL_TRIGGERED',
        },
      ],
      total: 2,
    },
  };

  it('should fetch trades successfully', async () => {
    const { useTradesQuery } = await import('@/hooks/queries/useTradesQuery');

    vi.mocked(global.fetch).mockResolvedValue(mockFetchResponse(mockTradesResponse));

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTradesQuery(), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBeDefined();
    expect(result.current.data?.trades).toHaveLength(2);
    expect(result.current.data?.total).toBe(2);
    expect(result.current.data?.trades[0].symbol).toBe('BTCUSDT');
  });

  it('should apply limit option', async () => {
    const { useTradesQuery } = await import('@/hooks/queries/useTradesQuery');

    vi.mocked(global.fetch).mockResolvedValue(mockFetchResponse(mockTradesResponse));

    const { wrapper } = createWrapper();
    renderHook(() => useTradesQuery({ limit: 10 }), { wrapper });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    const fetchCall = vi.mocked(global.fetch).mock.calls[0][0] as string;
    expect(fetchCall).toContain('limit=10');
  });

  it('should apply offset option', async () => {
    const { useTradesQuery } = await import('@/hooks/queries/useTradesQuery');

    vi.mocked(global.fetch).mockResolvedValue(mockFetchResponse(mockTradesResponse));

    const { wrapper } = createWrapper();
    renderHook(() => useTradesQuery({ limit: 10, offset: 20 }), { wrapper });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    const fetchCall = vi.mocked(global.fetch).mock.calls[0][0] as string;
    expect(fetchCall).toContain('offset=20');
  });

  it('should handle API errors gracefully', async () => {
    const { useTradesQuery } = await import('@/hooks/queries/useTradesQuery');

    vi.mocked(global.fetch).mockResolvedValue(
      mockFetchResponse({ success: false, error: 'Server error' }, 500)
    );

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTradesQuery(), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
  });

  it('should cache data with 30s staleTime', async () => {
    const { useTradesQuery } = await import('@/hooks/queries/useTradesQuery');

    vi.mocked(global.fetch).mockResolvedValue(mockFetchResponse(mockTradesResponse));

    const { wrapper } = createWrapper();

    // First render
    const { result: result1 } = renderHook(() => useTradesQuery(), { wrapper });

    await waitFor(() => {
      expect(result1.current.isSuccess).toBe(true);
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Second render - should use cache
    const { result: result2 } = renderHook(() => useTradesQuery(), { wrapper });

    expect(result2.current.data).toBeDefined();
    expect(result2.current.data?.trades).toHaveLength(2);

    // Should not have made another fetch within stale time
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should be disabled when enabled is false', async () => {
    const { useTradesQuery } = await import('@/hooks/queries/useTradesQuery');

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTradesQuery({ enabled: false }), { wrapper });

    // Should not fetch when disabled
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isFetching).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
