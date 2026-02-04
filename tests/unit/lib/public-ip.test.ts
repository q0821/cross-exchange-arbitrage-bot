// @vitest-environment node
/**
 * public-ip 工具單元測試
 *
 * @feature 071-cli-status-dashboard
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('public-ip', () => {
  let originalFetch: typeof globalThis.fetch;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // 清除模組快取以重新載入
    vi.resetModules();

    // Mock fetch
    originalFetch = globalThis.fetch;
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('getPublicIp()', () => {
    it('應該從 ipify API 取得 IP', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ip: '1.2.3.4' }),
      } as Response);

      const { getPublicIp, clearPublicIpCache } = await import('@/lib/public-ip');
      clearPublicIpCache();

      const ip = await getPublicIp();

      expect(ip).toBe('1.2.3.4');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.ipify.org?format=json',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    it('ipify 失敗時應該嘗試備用 API', async () => {
      // 第一次呼叫（ipify）失敗
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      // 第二次呼叫（備用 API）成功
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => '5.6.7.8\n',
      } as Response);

      const { getPublicIp, clearPublicIpCache } = await import('@/lib/public-ip');
      clearPublicIpCache();

      const ip = await getPublicIp();

      expect(ip).toBe('5.6.7.8');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('所有 API 都失敗時應該回傳 null', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      } as Response);

      const { getPublicIp, clearPublicIpCache } = await import('@/lib/public-ip');
      clearPublicIpCache();

      const ip = await getPublicIp();

      expect(ip).toBeNull();
    });

    it('應該快取 IP 結果', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ip: '1.2.3.4' }),
      } as Response);

      const { getPublicIp, clearPublicIpCache } = await import('@/lib/public-ip');
      clearPublicIpCache();

      // 第一次呼叫
      const ip1 = await getPublicIp();
      // 第二次呼叫（應該使用快取）
      const ip2 = await getPublicIp();

      expect(ip1).toBe('1.2.3.4');
      expect(ip2).toBe('1.2.3.4');
      // 只應該呼叫一次 fetch
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('請求 timeout 時應該處理錯誤', async () => {
      // 模擬 AbortError
      mockFetch.mockImplementation(() => {
        const error = new Error('The operation was aborted');
        error.name = 'AbortError';
        return Promise.reject(error);
      });

      const { getPublicIp, clearPublicIpCache } = await import('@/lib/public-ip');
      clearPublicIpCache();

      const ip = await getPublicIp();

      expect(ip).toBeNull();
    });
  });

  describe('getPublicIpCacheInfo()', () => {
    it('初始狀態應該沒有快取', async () => {
      const { getPublicIpCacheInfo, clearPublicIpCache } = await import('@/lib/public-ip');
      clearPublicIpCache();

      const info = getPublicIpCacheInfo();

      expect(info.hasCached).toBe(false);
      expect(info.cachedAt).toBeNull();
    });

    it('取得 IP 後應該有快取', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ip: '1.2.3.4' }),
      } as Response);

      const { getPublicIp, getPublicIpCacheInfo, clearPublicIpCache } = await import('@/lib/public-ip');
      clearPublicIpCache();

      await getPublicIp();
      const info = getPublicIpCacheInfo();

      expect(info.hasCached).toBe(true);
      expect(info.cachedAt).not.toBeNull();
    });
  });

  describe('clearPublicIpCache()', () => {
    it('應該清除快取', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ ip: '1.2.3.4' }),
      } as Response);

      const { getPublicIp, getPublicIpCacheInfo, clearPublicIpCache } = await import('@/lib/public-ip');

      await getPublicIp();
      expect(getPublicIpCacheInfo().hasCached).toBe(true);

      clearPublicIpCache();
      expect(getPublicIpCacheInfo().hasCached).toBe(false);
    });
  });
});
