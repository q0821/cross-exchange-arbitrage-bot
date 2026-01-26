import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  getCachedAccountType,
  setCachedAccountType,
  clearCachedAccountType,
  clearExchangeAccountTypeCache,
  clearAllAccountTypeCache,
  getAccountTypeCacheStats,
  buildAccountTypeCacheKey,
  ACCOUNT_TYPE_CACHE_TTL_MS,
} from '@/lib/account-type-cache';

describe('account-type-cache', () => {
  const testApiKey = 'Kj2uuAkExxxxxxxxxxxxxxxxxxxxxxx';
  const testApiKey2 = 'abc12345xxxxxxxxxxxxxxxxxxxxxxx';

  beforeEach(() => {
    // 每個測試前清除所有快取
    clearAllAccountTypeCache();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('buildAccountTypeCacheKey', () => {
    it('應該使用 API Key 前 8 字元作為識別', () => {
      const key = buildAccountTypeCacheKey('binance', testApiKey);
      expect(key).toBe('binance:Kj2uuAkE');
    });

    it('應該處理短於 8 字元的 API Key', () => {
      const key = buildAccountTypeCacheKey('okx', 'abc');
      expect(key).toBe('okx:abc');
    });
  });

  describe('setCachedAccountType / getCachedAccountType', () => {
    it('應該能設定並取得快取', () => {
      setCachedAccountType('binance', testApiKey, {
        isPortfolioMargin: true,
        isHedgeMode: true,
      });

      const cached = getCachedAccountType('binance', testApiKey);
      expect(cached).not.toBeNull();
      expect(cached?.isPortfolioMargin).toBe(true);
      expect(cached?.isHedgeMode).toBe(true);
    });

    it('不存在的快取應該返回 null', () => {
      const cached = getCachedAccountType('binance', testApiKey);
      expect(cached).toBeNull();
    });

    it('不同交易所的快取應該獨立', () => {
      setCachedAccountType('binance', testApiKey, {
        isPortfolioMargin: true,
        isHedgeMode: true,
      });
      setCachedAccountType('okx', testApiKey, {
        isPortfolioMargin: false,
        isHedgeMode: false,
      });

      const binanceCached = getCachedAccountType('binance', testApiKey);
      const okxCached = getCachedAccountType('okx', testApiKey);

      expect(binanceCached?.isPortfolioMargin).toBe(true);
      expect(okxCached?.isPortfolioMargin).toBe(false);
    });

    it('不同 API Key 的快取應該獨立', () => {
      setCachedAccountType('binance', testApiKey, {
        isPortfolioMargin: true,
        isHedgeMode: true,
      });
      setCachedAccountType('binance', testApiKey2, {
        isPortfolioMargin: false,
        isHedgeMode: false,
      });

      const cached1 = getCachedAccountType('binance', testApiKey);
      const cached2 = getCachedAccountType('binance', testApiKey2);

      expect(cached1?.isPortfolioMargin).toBe(true);
      expect(cached2?.isPortfolioMargin).toBe(false);
    });
  });

  describe('快取過期', () => {
    it('快取應該在 TTL 後過期', () => {
      setCachedAccountType('binance', testApiKey, {
        isPortfolioMargin: true,
        isHedgeMode: true,
      });

      // 快取應該存在
      expect(getCachedAccountType('binance', testApiKey)).not.toBeNull();

      // 前進時間到快取過期前一毫秒
      vi.advanceTimersByTime(ACCOUNT_TYPE_CACHE_TTL_MS - 1);
      expect(getCachedAccountType('binance', testApiKey)).not.toBeNull();

      // 前進時間讓快取過期
      vi.advanceTimersByTime(2);
      expect(getCachedAccountType('binance', testApiKey)).toBeNull();
    });

    it('應該支援自訂 TTL', () => {
      const customTTL = 1000; // 1 秒
      setCachedAccountType(
        'binance',
        testApiKey,
        { isPortfolioMargin: false, isHedgeMode: true },
        customTTL
      );

      // 快取應該存在
      expect(getCachedAccountType('binance', testApiKey)).not.toBeNull();

      // 前進 1 秒後應該過期
      vi.advanceTimersByTime(customTTL + 1);
      expect(getCachedAccountType('binance', testApiKey)).toBeNull();
    });
  });

  describe('clearCachedAccountType', () => {
    it('應該清除指定帳戶的快取', () => {
      setCachedAccountType('binance', testApiKey, {
        isPortfolioMargin: true,
        isHedgeMode: true,
      });
      setCachedAccountType('binance', testApiKey2, {
        isPortfolioMargin: false,
        isHedgeMode: false,
      });

      clearCachedAccountType('binance', testApiKey);

      expect(getCachedAccountType('binance', testApiKey)).toBeNull();
      expect(getCachedAccountType('binance', testApiKey2)).not.toBeNull();
    });
  });

  describe('clearExchangeAccountTypeCache', () => {
    it('應該清除指定交易所的所有快取', () => {
      setCachedAccountType('binance', testApiKey, {
        isPortfolioMargin: true,
        isHedgeMode: true,
      });
      setCachedAccountType('binance', testApiKey2, {
        isPortfolioMargin: false,
        isHedgeMode: false,
      });
      setCachedAccountType('okx', testApiKey, {
        isPortfolioMargin: false,
        isHedgeMode: true,
      });

      clearExchangeAccountTypeCache('binance');

      expect(getCachedAccountType('binance', testApiKey)).toBeNull();
      expect(getCachedAccountType('binance', testApiKey2)).toBeNull();
      expect(getCachedAccountType('okx', testApiKey)).not.toBeNull();
    });
  });

  describe('clearAllAccountTypeCache', () => {
    it('應該清除所有快取', () => {
      setCachedAccountType('binance', testApiKey, {
        isPortfolioMargin: true,
        isHedgeMode: true,
      });
      setCachedAccountType('okx', testApiKey, {
        isPortfolioMargin: false,
        isHedgeMode: true,
      });

      clearAllAccountTypeCache();

      expect(getCachedAccountType('binance', testApiKey)).toBeNull();
      expect(getCachedAccountType('okx', testApiKey)).toBeNull();
    });
  });

  describe('getAccountTypeCacheStats', () => {
    it('應該返回正確的統計資訊', () => {
      setCachedAccountType('binance', testApiKey, {
        isPortfolioMargin: true,
        isHedgeMode: true,
      });
      setCachedAccountType('okx', testApiKey2, {
        isPortfolioMargin: false,
        isHedgeMode: false,
      });

      const stats = getAccountTypeCacheStats();

      expect(stats.size).toBe(2);
      expect(stats.entries).toContain('binance:Kj2uuAkE');
      expect(stats.entries).toContain('okx:abc12345');
    });

    it('空快取時應該返回空陣列', () => {
      const stats = getAccountTypeCacheStats();
      expect(stats.size).toBe(0);
      expect(stats.entries).toEqual([]);
    });
  });
});
