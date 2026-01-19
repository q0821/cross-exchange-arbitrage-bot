import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePublicOpportunities } from '@/app/(public)/hooks/usePublicOpportunities';

// Mock fetch
global.fetch = vi.fn();

describe('usePublicOpportunities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockResponse = {
    data: [
      {
        id: 'opp-1',
        symbol: 'BTCUSDT',
        longExchange: 'binance',
        shortExchange: 'okx',
        maxSpread: 0.015,
        finalSpread: 0.01,
        realizedAPY: 50.5,
        durationMs: 3600000,
        detectedAt: new Date('2024-01-01T10:00:00Z'),
        disappearedAt: new Date('2024-01-01T11:00:00Z'),
      },
    ],
    pagination: {
      currentPage: 1,
      pageSize: 20,
      totalPages: 5,
      totalItems: 100,
    },
  };

  describe('成功獲取資料', () => {
    it('應正確呼叫 API 並處理回應', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const { result } = renderHook(() => usePublicOpportunities());

      // 初始狀態
      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();
      expect(result.current.error).toBeNull();

      // 等待資料載入
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // 驗證資料
      expect(result.current.data).toEqual(mockResponse);
      expect(result.current.error).toBeNull();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/public/opportunities'),
        expect.any(Object),
      );
    });

    it('應支援分頁參數', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const { result } = renderHook(() =>
        usePublicOpportunities({ page: 2, pageSize: 50 }),
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('page=2'),
        expect.any(Object),
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('pageSize=50'),
        expect.any(Object),
      );
    });

    it('應支援時間範圍篩選參數', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const { result } = renderHook(() => usePublicOpportunities({ days: 30 }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('days=30'),
        expect.any(Object),
      );
    });

    it('應組合所有查詢參數', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const { result } = renderHook(() =>
        usePublicOpportunities({ page: 3, pageSize: 10, days: 7 }),
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const callUrl = (global.fetch as any).mock.calls[0][0];
      expect(callUrl).toContain('page=3');
      expect(callUrl).toContain('pageSize=10');
      expect(callUrl).toContain('days=7');
    });
  });

  describe('錯誤處理', () => {
    it('網路錯誤時應設定 error 狀態', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => usePublicOpportunities());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBeUndefined();
      expect(result.current.error).toBeTruthy();
      expect(result.current.error?.message).toContain('Network error');
    });

    it('API 回應 4xx/5xx 時應設定 error 狀態', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ error: 'Invalid parameters' }),
      });

      const { result } = renderHook(() => usePublicOpportunities());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBeUndefined();
      expect(result.current.error).toBeTruthy();
    });

    it('速率限制（429）時應設定特定錯誤訊息', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: async () => ({ error: 'Rate limit exceeded' }),
      });

      const { result } = renderHook(() => usePublicOpportunities());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error?.message).toContain('Rate limit');
    });
  });

  describe('loading 狀態處理', () => {
    it('初始狀態應為 loading', () => {
      (global.fetch as any).mockImplementation(
        () => new Promise(() => {}), // 永不 resolve
      );

      const { result } = renderHook(() => usePublicOpportunities());

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();
      expect(result.current.error).toBeNull();
    });

    it('資料載入完成後應清除 loading 狀態', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const { result } = renderHook(() => usePublicOpportunities());

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe('參數變更時重新獲取', () => {
    it('page 參數變更時應重新呼叫 API', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const { result, rerender } = renderHook(
        ({ page }) => usePublicOpportunities({ page }),
        { initialProps: { page: 1 } },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(global.fetch).toHaveBeenCalledTimes(1);

      // 變更 page
      rerender({ page: 2 });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });
    });

    it('days 參數變更時應重新呼叫 API', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const { result, rerender } = renderHook(
        ({ days }) => usePublicOpportunities({ days }),
        { initialProps: { days: 90 } },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(global.fetch).toHaveBeenCalledTimes(1);

      // 變更 days
      rerender({ days: 30 });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('預設參數', () => {
    it('未提供參數時應使用預設值', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      renderHook(() => usePublicOpportunities());

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      const callUrl = (global.fetch as any).mock.calls[0][0];

      // 預設值應該是 page=1, pageSize=20, days=90
      expect(callUrl).toContain('page=1');
      expect(callUrl).toContain('pageSize=20');
      expect(callUrl).toContain('days=90');
    });
  });
});
