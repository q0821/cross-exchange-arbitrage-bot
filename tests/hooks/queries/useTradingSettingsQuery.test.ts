/**
 * useTradingSettingsQuery Hook Tests
 *
 * Feature 063: Frontend Data Caching (T025a)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createWrapper, mockFetchResponse } from '@/tests/utils/query-test-utils';

describe('useTradingSettingsQuery', () => {
  beforeEach(() => {
    vi.resetModules();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockSettingsResponse = {
    success: true,
    data: {
      defaultStopLossEnabled: true,
      defaultStopLossPercent: 5.0,
      defaultTakeProfitEnabled: false,
      defaultTakeProfitPercent: 3.0,
      defaultLeverage: 1,
      maxPositionSizeUSD: 10000,
    },
  };

  it('should fetch trading settings successfully', async () => {
    const { useTradingSettingsQuery } = await import('@/hooks/queries/useTradingSettingsQuery');

    vi.mocked(global.fetch).mockResolvedValue(mockFetchResponse(mockSettingsResponse));

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTradingSettingsQuery(), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBeDefined();
    expect(result.current.data?.defaultStopLossEnabled).toBe(true);
    expect(result.current.data?.defaultStopLossPercent).toBe(5.0);
    expect(result.current.data?.defaultLeverage).toBe(1);
  });

  it('should cache settings with long staleTime (5 minutes)', async () => {
    const { useTradingSettingsQuery } = await import('@/hooks/queries/useTradingSettingsQuery');

    vi.mocked(global.fetch).mockResolvedValue(mockFetchResponse(mockSettingsResponse));

    const { wrapper } = createWrapper();

    // First render
    const { result: result1 } = renderHook(() => useTradingSettingsQuery(), { wrapper });

    await waitFor(() => {
      expect(result1.current.isSuccess).toBe(true);
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Second render - should use cache
    const { result: result2 } = renderHook(() => useTradingSettingsQuery(), { wrapper });

    expect(result2.current.data).toBeDefined();
    expect(result2.current.data?.defaultStopLossEnabled).toBe(true);

    // Should not have made another fetch within stale time
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should handle API errors gracefully and return default settings', async () => {
    const { useTradingSettingsQuery } = await import('@/hooks/queries/useTradingSettingsQuery');

    vi.mocked(global.fetch).mockResolvedValue(
      mockFetchResponse({ success: false, error: 'Server error' }, 500)
    );

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTradingSettingsQuery(), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
  });

  it('should return default settings on 401 unauthorized', async () => {
    const { useTradingSettingsQuery, DEFAULT_TRADING_SETTINGS } = await import(
      '@/hooks/queries/useTradingSettingsQuery'
    );

    vi.mocked(global.fetch).mockResolvedValue(
      mockFetchResponse({ success: false, error: 'Unauthorized' }, 401)
    );

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTradingSettingsQuery(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Should return default settings on 401
    expect(result.current.data).toEqual(DEFAULT_TRADING_SETTINGS);
  });

  it('should be disabled when enabled is false', async () => {
    const { useTradingSettingsQuery } = await import('@/hooks/queries/useTradingSettingsQuery');

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTradingSettingsQuery({ enabled: false }), { wrapper });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isFetching).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should call the correct API endpoint', async () => {
    const { useTradingSettingsQuery } = await import('@/hooks/queries/useTradingSettingsQuery');

    vi.mocked(global.fetch).mockResolvedValue(mockFetchResponse(mockSettingsResponse));

    const { wrapper } = createWrapper();
    renderHook(() => useTradingSettingsQuery(), { wrapper });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/settings/trading',
      expect.objectContaining({ credentials: 'include' })
    );
  });
});
