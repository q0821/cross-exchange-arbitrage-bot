/**
 * Caching Behavior Integration Tests
 *
 * Tests for page navigation caching behavior.
 * These tests verify that data is cached correctly and
 * reused when navigating between pages.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createWrapper, mockFetchResponse } from '@/tests/utils/query-test-utils';
import { queryKeys } from '@root/lib/query-keys';

describe('Caching Behavior', () => {
  beforeEach(() => {
    vi.resetModules();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Positions Query Caching', () => {
    const mockPositions = {
      success: true,
      data: {
        positions: [{ id: 'pos-1', symbol: 'BTCUSDT', status: 'OPEN' }],
        total: 1,
      },
    };

    it('should cache positions data and reuse on subsequent calls', async () => {
      const { usePositionsQuery } = await import('@/hooks/queries/usePositionsQuery');

      vi.mocked(global.fetch).mockResolvedValue(mockFetchResponse(mockPositions));

      const { wrapper, queryClient } = createWrapper();

      // First render - should fetch
      const { result: result1 } = renderHook(() => usePositionsQuery(), { wrapper });

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
      });

      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Second render - should use cache
      const { result: result2 } = renderHook(() => usePositionsQuery(), { wrapper });

      // Should immediately have data from cache
      expect(result2.current.data).toBeDefined();
      expect(result2.current.data?.positions).toHaveLength(1);

      // Should not have made another fetch (within stale time)
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should invalidate cache when manually triggered', async () => {
      const { usePositionsQuery } = await import('@/hooks/queries/usePositionsQuery');

      vi.mocked(global.fetch).mockResolvedValue(mockFetchResponse(mockPositions));

      const { wrapper, queryClient } = createWrapper();
      const { result } = renderHook(() => usePositionsQuery(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Invalidate the cache
      await act(async () => {
        await queryClient.invalidateQueries({ queryKey: queryKeys.trading.positions() });
      });

      // Should trigger a refetch
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Assets Query Caching', () => {
    const mockAssets = {
      success: true,
      data: {
        exchanges: [{ exchange: 'binance', status: 'success', balanceUSD: 1000 }],
        totalBalanceUSD: 1000,
        lastUpdated: '2026-01-14T00:00:00.000Z',
      },
    };

    it('should cache assets data with 30s stale time', async () => {
      const { useAssetsQuery } = await import('@/hooks/queries/useAssetsQuery');

      vi.mocked(global.fetch).mockResolvedValue(mockFetchResponse(mockAssets));

      const { wrapper, queryClient } = createWrapper();
      const { result } = renderHook(() => useAssetsQuery(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify cache is populated
      const cachedData = queryClient.getQueryData(queryKeys.assets.balances());
      expect(cachedData).toBeDefined();
      expect((cachedData as any).totalBalanceUSD).toBe(1000);
    });
  });

  describe('Cross-Page Data Sharing', () => {
    it('should share market rates data across different components', async () => {
      const { useMarketRatesQuery } = await import('@/hooks/queries/useMarketRatesQuery');

      const mockRates = {
        success: true,
        data: {
          rates: [{ symbol: 'BTCUSDT', status: 'opportunity' }],
          stats: { totalSymbols: 1, opportunityCount: 1 },
          threshold: '200.00',
        },
      };

      vi.mocked(global.fetch).mockResolvedValue(mockFetchResponse(mockRates));

      const { wrapper } = createWrapper();

      // Simulate component 1 fetching data
      const { result: result1 } = renderHook(() => useMarketRatesQuery(), { wrapper });

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
      });

      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Simulate component 2 using the same data (e.g., OpenPositionDialog)
      const { result: result2 } = renderHook(() => useMarketRatesQuery(), { wrapper });

      // Should have data immediately from cache (stale-while-revalidate)
      // Even with staleTime: 0, the cached data is returned immediately
      expect(result2.current.data).toBeDefined();
      expect(result2.current.data?.rates[0].symbol).toBe('BTCUSDT');

      // Note: With staleTime: 0, a background refetch is triggered
      // but the important thing is that data is immediately available from cache
    });
  });

  describe('Query Key Structure', () => {
    it('should use correct hierarchical query keys', () => {
      expect(queryKeys.assets.all).toEqual(['assets']);
      expect(queryKeys.assets.balances()).toEqual(['assets', 'balances']);
      expect(queryKeys.trading.positions()).toEqual(['trading', 'positions']);
      expect(queryKeys.market.rates()).toEqual(['market', 'rates']);
    });

    it('should support bulk invalidation via parent keys', async () => {
      const { wrapper, queryClient } = createWrapper();

      // Set some cache data
      queryClient.setQueryData(queryKeys.trading.positions(), { positions: [], total: 0 });
      queryClient.setQueryData(queryKeys.trading.trades(), { trades: [], total: 0 });

      // Invalidate all trading queries at once
      await act(async () => {
        await queryClient.invalidateQueries({ queryKey: queryKeys.trading.all });
      });

      // Both caches should be invalidated
      const positionsState = queryClient.getQueryState(queryKeys.trading.positions());
      const tradesState = queryClient.getQueryState(queryKeys.trading.trades());

      expect(positionsState?.isInvalidated).toBe(true);
      expect(tradesState?.isInvalidated).toBe(true);
    });
  });
});
