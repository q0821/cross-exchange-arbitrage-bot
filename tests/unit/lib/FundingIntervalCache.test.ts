import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FundingIntervalCache } from '../../../src/lib/FundingIntervalCache';

describe('FundingIntervalCache', () => {
  let cache: FundingIntervalCache;

  beforeEach(() => {
    cache = new FundingIntervalCache();
  });

  describe('set and get', () => {
    it('should store and retrieve interval value', () => {
      cache.set('binance', 'BTCUSDT', 8, 'api');

      const result = cache.get('binance', 'BTCUSDT');

      expect(result).toBe(8);
    });

    it('should return null for non-existent key', () => {
      const result = cache.get('binance', 'NONEXISTENT');

      expect(result).toBeNull();
    });

    it('should distinguish between different exchanges', () => {
      cache.set('binance', 'BTCUSDT', 8, 'api');
      cache.set('okx', 'BTCUSDT', 4, 'calculated');

      expect(cache.get('binance', 'BTCUSDT')).toBe(8);
      expect(cache.get('okx', 'BTCUSDT')).toBe(4);
    });

    it('should distinguish between different symbols', () => {
      cache.set('binance', 'BTCUSDT', 8, 'api');
      cache.set('binance', 'BLZUSDT', 4, 'api');

      expect(cache.get('binance', 'BTCUSDT')).toBe(8);
      expect(cache.get('binance', 'BLZUSDT')).toBe(4);
    });
  });

  describe('TTL expiration', () => {
    it('should return null for expired entries', () => {
      // 建立短 TTL 的快取 (100ms)
      const shortCache = new FundingIntervalCache(100);
      shortCache.set('binance', 'BTCUSDT', 8, 'api');

      // 立即獲取應成功
      expect(shortCache.get('binance', 'BTCUSDT')).toBe(8);

      // 等待過期
      vi.useFakeTimers();
      vi.advanceTimersByTime(150);

      // 過期後應返回 null
      expect(shortCache.get('binance', 'BTCUSDT')).toBeNull();

      vi.useRealTimers();
    });

    it('should not return expired entries even if they exist in cache', () => {
      const shortCache = new FundingIntervalCache(50);
      shortCache.set('binance', 'BTCUSDT', 8, 'api');

      vi.useFakeTimers();
      vi.advanceTimersByTime(100);

      const result = shortCache.get('binance', 'BTCUSDT');
      expect(result).toBeNull();

      vi.useRealTimers();
    });
  });

  describe('setAll', () => {
    it('should set multiple intervals at once', () => {
      const intervals = new Map([
        ['BTCUSDT', 8],
        ['BLZUSDT', 4],
        ['ETHUSDT', 8],
      ]);

      cache.setAll('binance', intervals, 'api');

      expect(cache.get('binance', 'BTCUSDT')).toBe(8);
      expect(cache.get('binance', 'BLZUSDT')).toBe(4);
      expect(cache.get('binance', 'ETHUSDT')).toBe(8);
    });
  });

  describe('clear', () => {
    it('should remove all cached entries', () => {
      cache.set('binance', 'BTCUSDT', 8, 'api');
      cache.set('okx', 'ETHUSDT', 4, 'calculated');

      cache.clear();

      expect(cache.get('binance', 'BTCUSDT')).toBeNull();
      expect(cache.get('okx', 'ETHUSDT')).toBeNull();
    });

    it('should reset statistics', () => {
      cache.set('binance', 'BTCUSDT', 8, 'api');
      cache.get('binance', 'BTCUSDT');
      cache.get('binance', 'NONEXISTENT');

      cache.clear();

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.sets).toBe(0);
    });
  });

  describe('clearExpired', () => {
    it('should remove only expired entries', () => {
      const shortCache = new FundingIntervalCache(100);

      // 設定兩個項目
      shortCache.set('binance', 'BTCUSDT', 8, 'api');
      shortCache.set('binance', 'ETHUSDT', 4, 'api');

      vi.useFakeTimers();

      // 等待第一個過期
      vi.advanceTimersByTime(150);

      // 新增第三個項目 (未過期)
      shortCache.set('binance', 'BLZUSDT', 4, 'api');

      // 清除過期項目
      shortCache.clearExpired();

      // 前兩個應被移除，第三個保留
      expect(shortCache.get('binance', 'BTCUSDT')).toBeNull();
      expect(shortCache.get('binance', 'ETHUSDT')).toBeNull();
      expect(shortCache.get('binance', 'BLZUSDT')).toBe(4);

      vi.useRealTimers();
    });
  });

  describe('getStats', () => {
    it('should track cache hits', () => {
      cache.set('binance', 'BTCUSDT', 8, 'api');
      cache.get('binance', 'BTCUSDT');
      cache.get('binance', 'BTCUSDT');

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
    });

    it('should track cache misses', () => {
      cache.get('binance', 'NONEXISTENT1');
      cache.get('binance', 'NONEXISTENT2');

      const stats = cache.getStats();
      expect(stats.misses).toBe(2);
    });

    it('should track sets', () => {
      cache.set('binance', 'BTCUSDT', 8, 'api');
      cache.set('okx', 'ETHUSDT', 4, 'calculated');

      const stats = cache.getStats();
      expect(stats.sets).toBe(2);
    });

    it('should calculate hit rate correctly', () => {
      cache.set('binance', 'BTCUSDT', 8, 'api');

      cache.get('binance', 'BTCUSDT'); // hit
      cache.get('binance', 'BTCUSDT'); // hit
      cache.get('binance', 'NONEXISTENT'); // miss

      const stats = cache.getStats();
      expect(stats.hitRate).toBeCloseTo(2 / 3, 2);
    });

    it('should return 0 hit rate when no accesses', () => {
      const stats = cache.getStats();
      expect(stats.hitRate).toBe(0);
    });

    it('should return correct cache size', () => {
      cache.set('binance', 'BTCUSDT', 8, 'api');
      cache.set('okx', 'ETHUSDT', 4, 'calculated');

      const stats = cache.getStats();
      expect(stats.size).toBe(2);
    });
  });

  describe('source tracking', () => {
    it('should store different sources correctly', () => {
      cache.set('binance', 'BTCUSDT', 8, 'api');
      cache.set('okx', 'ETHUSDT', 4, 'calculated');
      cache.set('mexc', 'BNBUSDT', 8, 'default');

      // 雖然無法直接取得 source，但確保不會拋出錯誤
      expect(cache.get('binance', 'BTCUSDT')).toBe(8);
      expect(cache.get('okx', 'ETHUSDT')).toBe(4);
      expect(cache.get('mexc', 'BNBUSDT')).toBe(8);
    });
  });
});
