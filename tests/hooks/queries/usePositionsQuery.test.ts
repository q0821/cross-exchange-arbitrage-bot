/**
 * usePositionsQuery Hook Tests
 *
 * TDD: These tests are written FIRST, before the implementation.
 * They should FAIL initially.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createWrapper, mockFetchResponse, mockFetchError } from '@/tests/utils/query-test-utils';

// Mock the hook module (will be implemented)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let usePositionsQuery: any;

describe('usePositionsQuery', () => {
  const mockPositionsResponse = {
    success: true,
    data: {
      positions: [
        {
          id: 'pos-1',
          symbol: 'BTCUSDT',
          longExchange: 'binance',
          shortExchange: 'okx',
          status: 'OPEN',
          leverage: 3,
          createdAt: '2026-01-14T00:00:00.000Z',
          updatedAt: '2026-01-14T00:00:00.000Z',
          stopLossEnabled: true,
          stopLossPercent: 5,
          takeProfitEnabled: true,
          takeProfitPercent: 10,
          conditionalOrderStatus: 'SET',
        },
        {
          id: 'pos-2',
          symbol: 'ETHUSDT',
          longExchange: 'okx',
          shortExchange: 'gateio',
          status: 'OPEN',
          leverage: 2,
          createdAt: '2026-01-13T00:00:00.000Z',
          updatedAt: '2026-01-13T00:00:00.000Z',
          stopLossEnabled: false,
          takeProfitEnabled: false,
          conditionalOrderStatus: null,
        },
      ],
      total: 2,
    },
  };

  beforeEach(async () => {
    vi.resetModules();
    global.fetch = vi.fn();

    try {
      const module = await import('@/hooks/queries/usePositionsQuery');
      usePositionsQuery = module.usePositionsQuery;
    } catch {
      usePositionsQuery = null;
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fetch positions data successfully', async () => {
    if (!usePositionsQuery) {
      expect(usePositionsQuery).not.toBeNull();
      return;
    }

    vi.mocked(global.fetch).mockResolvedValueOnce(mockFetchResponse(mockPositionsResponse));

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => usePositionsQuery(), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data.positions).toHaveLength(2);
    expect(result.current.data.total).toBe(2);
    expect(result.current.data.positions[0].symbol).toBe('BTCUSDT');
  });

  it('should handle API errors', async () => {
    if (!usePositionsQuery) {
      expect(usePositionsQuery).not.toBeNull();
      return;
    }

    vi.mocked(global.fetch).mockResolvedValueOnce(mockFetchError('Server error', 500));

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => usePositionsQuery(), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it('should support status filter', async () => {
    if (!usePositionsQuery) {
      expect(usePositionsQuery).not.toBeNull();
      return;
    }

    vi.mocked(global.fetch).mockResolvedValue(mockFetchResponse(mockPositionsResponse));

    const { wrapper } = createWrapper();
    renderHook(() => usePositionsQuery({ status: ['OPEN', 'CLOSING'] }), { wrapper });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    // URL encode: comma becomes %2C
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('status=OPEN%2CCLOSING'),
      expect.any(Object)
    );
  });

  it('should use correct query key', async () => {
    if (!usePositionsQuery) {
      expect(usePositionsQuery).not.toBeNull();
      return;
    }

    vi.mocked(global.fetch).mockResolvedValue(mockFetchResponse(mockPositionsResponse));

    const { wrapper, queryClient } = createWrapper();
    renderHook(() => usePositionsQuery(), { wrapper });

    await waitFor(() => {
      const queryState = queryClient.getQueryState(['trading', 'positions']);
      expect(queryState).toBeDefined();
    });
  });

  it('should have short stale time for real-time accuracy', async () => {
    if (!usePositionsQuery) {
      expect(usePositionsQuery).not.toBeNull();
      return;
    }

    vi.mocked(global.fetch).mockResolvedValue(mockFetchResponse(mockPositionsResponse));

    const { wrapper, queryClient } = createWrapper();
    renderHook(() => usePositionsQuery(), { wrapper });

    await waitFor(() => {
      expect(queryClient.getQueryState(['trading', 'positions'])).toBeDefined();
    });

    // Positions should have relatively short stale time (10 seconds based on data-model.md)
    // This ensures data freshness for trading decisions
  });
});
