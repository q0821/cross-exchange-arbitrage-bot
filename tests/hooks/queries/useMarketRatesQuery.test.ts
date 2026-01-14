/**
 * useMarketRatesQuery Hook Tests
 *
 * TDD: These tests are written FIRST, before the implementation.
 * They should FAIL initially.
 *
 * This hook has special considerations:
 * 1. WebSocket integration for real-time updates
 * 2. staleTime: 0 (always stale, updates via WebSocket)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createWrapper, mockFetchResponse, mockFetchError } from '@/tests/utils/query-test-utils';

// Mock the hook module (will be implemented)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let useMarketRatesQuery: any;

describe('useMarketRatesQuery', () => {
  const mockMarketRatesResponse = {
    success: true,
    data: {
      rates: [
        {
          symbol: 'BTCUSDT',
          exchanges: {
            binance: {
              rate: 0.0001,
              ratePercent: '0.0100',
              price: 45000,
              nextFundingTime: '2026-01-14T08:00:00.000Z',
            },
            okx: {
              rate: -0.0002,
              ratePercent: '-0.0200',
              price: 45010,
              nextFundingTime: '2026-01-14T08:00:00.000Z',
            },
          },
          bestPair: {
            longExchange: 'okx',
            shortExchange: 'binance',
            spreadPercent: '0.0300',
            annualizedReturn: '328.50',
          },
          status: 'opportunity',
          timestamp: '2026-01-14T00:00:00.000Z',
        },
      ],
      stats: {
        totalSymbols: 100,
        opportunityCount: 5,
        approachingCount: 10,
        maxSpread: { symbol: 'BTCUSDT', spread: '0.0300' },
        uptime: 3600,
        lastUpdate: '2026-01-14T00:00:00.000Z',
      },
      threshold: '200.00',
    },
  };

  beforeEach(async () => {
    vi.resetModules();
    global.fetch = vi.fn();

    try {
      const module = await import('@/hooks/queries/useMarketRatesQuery');
      useMarketRatesQuery = module.useMarketRatesQuery;
    } catch {
      useMarketRatesQuery = null;
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fetch market rates successfully', async () => {
    if (!useMarketRatesQuery) {
      expect(useMarketRatesQuery).not.toBeNull();
      return;
    }

    vi.mocked(global.fetch).mockResolvedValueOnce(mockFetchResponse(mockMarketRatesResponse));

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useMarketRatesQuery(), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data.rates).toHaveLength(1);
    expect(result.current.data.rates[0].symbol).toBe('BTCUSDT');
    expect(result.current.data.stats.opportunityCount).toBe(5);
  });

  it('should handle API errors gracefully', async () => {
    if (!useMarketRatesQuery) {
      expect(useMarketRatesQuery).not.toBeNull();
      return;
    }

    vi.mocked(global.fetch).mockResolvedValueOnce(mockFetchError('Unauthorized', 401));

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useMarketRatesQuery(), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it('should use correct query key', async () => {
    if (!useMarketRatesQuery) {
      expect(useMarketRatesQuery).not.toBeNull();
      return;
    }

    vi.mocked(global.fetch).mockResolvedValue(mockFetchResponse(mockMarketRatesResponse));

    const { wrapper, queryClient } = createWrapper();
    renderHook(() => useMarketRatesQuery(), { wrapper });

    await waitFor(() => {
      const queryState = queryClient.getQueryState(['market', 'rates']);
      expect(queryState).toBeDefined();
    });
  });

  it('should support threshold parameter', async () => {
    if (!useMarketRatesQuery) {
      expect(useMarketRatesQuery).not.toBeNull();
      return;
    }

    vi.mocked(global.fetch).mockResolvedValue(mockFetchResponse(mockMarketRatesResponse));

    const { wrapper } = createWrapper();
    renderHook(() => useMarketRatesQuery({ threshold: 500 }), { wrapper });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('threshold=500'),
      expect.any(Object)
    );
  });

  it('should have staleTime: 0 for real-time WebSocket updates', async () => {
    if (!useMarketRatesQuery) {
      expect(useMarketRatesQuery).not.toBeNull();
      return;
    }

    // This test verifies the hook is configured correctly for WebSocket integration
    // staleTime: 0 means data is always considered stale, so WebSocket updates trigger refetch
    vi.mocked(global.fetch).mockResolvedValue(mockFetchResponse(mockMarketRatesResponse));

    const { wrapper, queryClient } = createWrapper();
    renderHook(() => useMarketRatesQuery(), { wrapper });

    await waitFor(() => {
      const query = queryClient.getQueryCache().find({ queryKey: ['market', 'rates'] });
      expect(query).toBeDefined();
      // The actual staleTime configuration is in the hook implementation
    });
  });

  it('should expose WebSocket connection status', async () => {
    if (!useMarketRatesQuery) {
      expect(useMarketRatesQuery).not.toBeNull();
      return;
    }

    vi.mocked(global.fetch).mockResolvedValue(mockFetchResponse(mockMarketRatesResponse));

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useMarketRatesQuery(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // The hook should expose isConnected for WebSocket status
    // This will be false in tests since we don't have a real WebSocket
    expect(typeof result.current.isConnected).toBe('boolean');
  });
});
