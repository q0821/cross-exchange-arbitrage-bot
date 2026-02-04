/**
 * RatesCache Cleanup Tests
 * Feature: 066-fix-memory-leaks
 * User Story 2: RatesCache 過期項目主動清理
 *
 * 測試 RatesCache 的過期項目清理功能：
 * - getAll() 應該從 Map 中刪除過期項目
 * - get() 應該從 Map 中刪除過期項目
 * - 快取大小應該在清理後減少
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock PrismaClient
vi.mock('@/generated/prisma/client', () => ({
  PrismaClient: vi.fn(),
}));

// Mock NotificationService
vi.mock('@/services/notification/NotificationService', () => ({
  NotificationService: {
    getInstance: vi.fn(),
  },
}));

// Mock SimulatedTrackingService
vi.mock('@/services/tracking/SimulatedTrackingService', () => ({
  SimulatedTrackingService: {
    getInstance: vi.fn(),
  },
}));

// Import after mocks
import { RatesCache } from '@/services/monitor/RatesCache';
import type { FundingRatePair } from '@/models/FundingRate';

describe('RatesCache Cleanup', () => {
  let ratesCache: RatesCache;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Reset singleton before each test
    RatesCache.resetInstance();
    ratesCache = RatesCache.getInstance();
  });

  afterEach(() => {
    vi.useRealTimers();
    RatesCache.resetInstance();
  });

  // Helper to create mock FundingRatePair
  function createMockRate(symbol: string, spreadPercent = 0.01): FundingRatePair {
    return {
      symbol,
      spreadPercent,
      exchanges: new Map(),
      recordedAt: new Date(),
    };
  }

  describe('Stale item removal in getAll()', () => {
    it('should remove stale items from cache Map when getAll() is called', () => {
      // Arrange - add some items
      const rate1 = createMockRate('BTCUSDT', 0.01);
      const rate2 = createMockRate('ETHUSDT', 0.02);
      const rate3 = createMockRate('SOLUSDT', 0.03);

      ratesCache.set('BTCUSDT', rate1);
      ratesCache.set('ETHUSDT', rate2);
      ratesCache.set('SOLUSDT', rate3);

      expect(ratesCache.size()).toBe(3);

      // Act - advance time past stale threshold (10 minutes)
      vi.advanceTimersByTime(11 * 60 * 1000);

      // Call getAll() which should trigger cleanup
      const result = ratesCache.getAll();

      // Assert - stale items should be removed from cache
      expect(result).toHaveLength(0); // No valid items returned
      expect(ratesCache.size()).toBe(0); // Cache should be empty
    });

    it('should only remove stale items while keeping fresh ones', () => {
      // Arrange - add items at different times
      const rate1 = createMockRate('BTCUSDT', 0.01);
      ratesCache.set('BTCUSDT', rate1);

      // Advance time 5 minutes
      vi.advanceTimersByTime(5 * 60 * 1000);

      const rate2 = createMockRate('ETHUSDT', 0.02);
      ratesCache.set('ETHUSDT', rate2);

      // Advance time 6 more minutes (BTCUSDT now 11 min old, ETHUSDT 6 min old)
      vi.advanceTimersByTime(6 * 60 * 1000);

      expect(ratesCache.size()).toBe(2);

      // Act
      const result = ratesCache.getAll();

      // Assert - only fresh item should remain
      expect(result).toHaveLength(1);
      expect(result[0].symbol).toBe('ETHUSDT');
      expect(ratesCache.size()).toBe(1); // Stale BTCUSDT should be removed
    });

    it('should handle empty cache gracefully', () => {
      // Arrange - empty cache
      expect(ratesCache.size()).toBe(0);

      // Act
      const result = ratesCache.getAll();

      // Assert
      expect(result).toHaveLength(0);
      expect(ratesCache.size()).toBe(0);
    });
  });

  describe('Stale item removal in get()', () => {
    it('should remove stale item from cache Map when get() returns null', () => {
      // Arrange
      const rate = createMockRate('BTCUSDT', 0.01);
      ratesCache.set('BTCUSDT', rate);
      expect(ratesCache.size()).toBe(1);

      // Advance time past stale threshold
      vi.advanceTimersByTime(11 * 60 * 1000);

      // Act
      const result = ratesCache.get('BTCUSDT');

      // Assert
      expect(result).toBeNull();
      expect(ratesCache.size()).toBe(0); // Stale item should be removed
    });

    it('should not remove fresh items from cache', () => {
      // Arrange
      const rate = createMockRate('BTCUSDT', 0.01);
      ratesCache.set('BTCUSDT', rate);

      // Advance time but not past threshold
      vi.advanceTimersByTime(5 * 60 * 1000);

      // Act
      const result = ratesCache.get('BTCUSDT');

      // Assert
      expect(result).not.toBeNull();
      expect(result?.symbol).toBe('BTCUSDT');
      expect(ratesCache.size()).toBe(1);
    });
  });

  describe('Memory efficiency', () => {
    it('should reduce cache size after removing stale items', () => {
      // Arrange - add many items
      for (let i = 0; i < 100; i++) {
        ratesCache.set(`SYMBOL${i}`, createMockRate(`SYMBOL${i}`, 0.01));
      }
      expect(ratesCache.size()).toBe(100);

      // Advance time past stale threshold
      vi.advanceTimersByTime(11 * 60 * 1000);

      // Act - trigger cleanup via getAll()
      ratesCache.getAll();

      // Assert - all stale items should be removed
      expect(ratesCache.size()).toBe(0);
    });

    it('should properly clean up with mixed fresh and stale items', () => {
      // Arrange - add 50 items
      for (let i = 0; i < 50; i++) {
        ratesCache.set(`OLD${i}`, createMockRate(`OLD${i}`, 0.01));
      }

      // Advance 8 minutes
      vi.advanceTimersByTime(8 * 60 * 1000);

      // Add 50 more items
      for (let i = 0; i < 50; i++) {
        ratesCache.set(`NEW${i}`, createMockRate(`NEW${i}`, 0.02));
      }

      expect(ratesCache.size()).toBe(100);

      // Advance 3 more minutes (OLD items now 11 min, NEW items 3 min)
      vi.advanceTimersByTime(3 * 60 * 1000);

      // Act
      const result = ratesCache.getAll();

      // Assert
      expect(result).toHaveLength(50); // Only NEW items
      expect(ratesCache.size()).toBe(50); // OLD items removed from cache
    });
  });

  describe('Idempotency', () => {
    it('should handle multiple getAll() calls safely', () => {
      // Arrange
      for (let i = 0; i < 10; i++) {
        ratesCache.set(`SYMBOL${i}`, createMockRate(`SYMBOL${i}`, 0.01));
      }

      // Advance time past stale threshold
      vi.advanceTimersByTime(11 * 60 * 1000);

      // Act - call getAll() multiple times
      ratesCache.getAll();
      ratesCache.getAll();
      ratesCache.getAll();

      // Assert - cache should be empty after first cleanup
      expect(ratesCache.size()).toBe(0);
    });
  });
});

describe('RatesCache getStats 參數優化', () => {
  let ratesCache: RatesCache;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    RatesCache.resetInstance();
    ratesCache = RatesCache.getInstance();
  });

  afterEach(() => {
    vi.useRealTimers();
    RatesCache.resetInstance();
  });

  // Helper to create mock FundingRatePair with bestPair
  function createMockRateWithBestPair(
    symbol: string,
    spreadPercent = 0.01,
    spreadAnnualized = 800
  ): FundingRatePair {
    return {
      symbol,
      spreadPercent,
      exchanges: new Map(),
      recordedAt: new Date(),
      bestPair: {
        longExchange: 'binance',
        shortExchange: 'okx',
        spreadPercent,
        spreadAnnualized,
        priceDiffPercent: 0.01,
      },
    };
  }

  describe('getStats with rates parameter', () => {
    it('應該使用傳入的 rates 而不是再次呼叫 getAll()', () => {
      // Arrange - 在快取中新增一些資料
      ratesCache.set('BTCUSDT', createMockRateWithBestPair('BTCUSDT', 0.01, 900));
      ratesCache.set('ETHUSDT', createMockRateWithBestPair('ETHUSDT', 0.02, 1000));

      // 建立一個自訂的 rates 陣列（只有一個項目）
      const customRates = [createMockRateWithBestPair('SOLUSDT', 0.03, 850)];

      // Act - 傳入自訂 rates
      const stats = ratesCache.getStats(customRates);

      // Assert - 統計應該基於傳入的 rates，不是快取中的資料
      expect(stats.totalSymbols).toBe(1); // 只有 SOLUSDT
      expect(stats.opportunityCount).toBe(1); // 850% >= 800%
    });

    it('不傳入 rates 時應該呼叫 getAll()', () => {
      // Arrange
      ratesCache.set('BTCUSDT', createMockRateWithBestPair('BTCUSDT', 0.01, 900));
      ratesCache.set('ETHUSDT', createMockRateWithBestPair('ETHUSDT', 0.02, 700));

      // Act - 不傳入 rates
      const stats = ratesCache.getStats();

      // Assert - 應該使用快取中的資料
      expect(stats.totalSymbols).toBe(2);
      expect(stats.opportunityCount).toBe(1); // 只有 BTCUSDT >= 800%
      expect(stats.approachingCount).toBe(1); // ETHUSDT 在 600%-800% 之間
    });

    it('傳入空陣列應該返回空統計', () => {
      // Arrange - 快取中有資料
      ratesCache.set('BTCUSDT', createMockRateWithBestPair('BTCUSDT', 0.01, 900));

      // Act - 傳入空陣列
      const stats = ratesCache.getStats([]);

      // Assert
      expect(stats.totalSymbols).toBe(0);
      expect(stats.opportunityCount).toBe(0);
      expect(stats.approachingCount).toBe(0);
      expect(stats.maxSpread).toBeNull();
    });

    it('傳入 undefined 時應該 fallback 到 getAll()', () => {
      // Arrange
      ratesCache.set('BTCUSDT', createMockRateWithBestPair('BTCUSDT', 0.01, 900));

      // Act
      const stats = ratesCache.getStats(undefined);

      // Assert
      expect(stats.totalSymbols).toBe(1);
    });
  });

  describe('getStats with custom threshold', () => {
    it('應該支援同時傳入 rates 和 opportunityThreshold', () => {
      // Arrange
      const customRates = [
        createMockRateWithBestPair('BTCUSDT', 0.01, 500),
        createMockRateWithBestPair('ETHUSDT', 0.02, 400),
      ];

      // Act - 使用較低的門檻 (400%)
      const stats = ratesCache.getStats(customRates, 400);

      // Assert
      expect(stats.opportunityCount).toBe(2); // 兩個都 >= 400%
    });
  });
});
