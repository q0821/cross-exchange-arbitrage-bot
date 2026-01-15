/**
 * useAssetHistoryQuery Hook Tests
 *
 * Feature 063: Frontend Data Caching (T018)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createWrapper, mockFetchResponse } from '@/tests/utils/query-test-utils';

describe('useAssetHistoryQuery', () => {
  beforeEach(() => {
    vi.resetModules();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockHistoryResponse = {
    success: true,
    data: {
      snapshots: [
        {
          id: '1',
          timestamp: '2026-01-07T00:00:00.000Z',
          totalBalanceUSD: 1000,
          binanceBalanceUSD: 500,
          okxBalanceUSD: 500,
        },
        {
          id: '2',
          timestamp: '2026-01-14T00:00:00.000Z',
          totalBalanceUSD: 1100,
          binanceBalanceUSD: 550,
          okxBalanceUSD: 550,
        },
      ],
      period: {
        days: 7,
        from: '2026-01-07T00:00:00.000Z',
        to: '2026-01-14T00:00:00.000Z',
      },
      summary: {
        startTotal: 1000,
        endTotal: 1100,
        changeUSD: 100,
        changePercent: 10,
      },
    },
  };

  it('should fetch asset history successfully', async () => {
    const { useAssetHistoryQuery } = await import('@/hooks/queries/useAssetHistoryQuery');

    vi.mocked(global.fetch).mockResolvedValue(mockFetchResponse(mockHistoryResponse));

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAssetHistoryQuery({ days: 7 }), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBeDefined();
    expect(result.current.data?.snapshots).toHaveLength(2);
    expect(result.current.data?.period.days).toBe(7);
    expect(result.current.data?.summary.changePercent).toBe(10);
  });

  it('should apply days parameter to API call', async () => {
    const { useAssetHistoryQuery } = await import('@/hooks/queries/useAssetHistoryQuery');

    vi.mocked(global.fetch).mockResolvedValue(mockFetchResponse(mockHistoryResponse));

    const { wrapper } = createWrapper();
    renderHook(() => useAssetHistoryQuery({ days: 30 }), { wrapper });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    const fetchCall = vi.mocked(global.fetch).mock.calls[0][0] as string;
    expect(fetchCall).toContain('days=30');
  });

  it('should handle API errors gracefully', async () => {
    const { useAssetHistoryQuery } = await import('@/hooks/queries/useAssetHistoryQuery');

    vi.mocked(global.fetch).mockResolvedValue(
      mockFetchResponse({ success: false, error: 'Server error' }, 500)
    );

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAssetHistoryQuery({ days: 7 }), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
  });

  it('should cache data with long staleTime (5 minutes)', async () => {
    const { useAssetHistoryQuery } = await import('@/hooks/queries/useAssetHistoryQuery');

    vi.mocked(global.fetch).mockResolvedValue(mockFetchResponse(mockHistoryResponse));

    const { wrapper } = createWrapper();

    // First render
    const { result: result1 } = renderHook(() => useAssetHistoryQuery({ days: 7 }), { wrapper });

    await waitFor(() => {
      expect(result1.current.isSuccess).toBe(true);
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Second render - should use cache
    const { result: result2 } = renderHook(() => useAssetHistoryQuery({ days: 7 }), { wrapper });

    expect(result2.current.data).toBeDefined();
    expect(result2.current.data?.snapshots).toHaveLength(2);

    // Should not have made another fetch within stale time
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should use different cache for different days values', async () => {
    const { useAssetHistoryQuery } = await import('@/hooks/queries/useAssetHistoryQuery');

    vi.mocked(global.fetch).mockResolvedValue(mockFetchResponse(mockHistoryResponse));

    const { wrapper } = createWrapper();

    // Query with 7 days
    const { result: result1 } = renderHook(() => useAssetHistoryQuery({ days: 7 }), { wrapper });

    await waitFor(() => {
      expect(result1.current.isSuccess).toBe(true);
    });

    // Query with 30 days - should make a new fetch
    renderHook(() => useAssetHistoryQuery({ days: 30 }), { wrapper });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  it('should be disabled when enabled is false', async () => {
    const { useAssetHistoryQuery } = await import('@/hooks/queries/useAssetHistoryQuery');

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAssetHistoryQuery({ days: 7, enabled: false }), { wrapper });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isFetching).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
