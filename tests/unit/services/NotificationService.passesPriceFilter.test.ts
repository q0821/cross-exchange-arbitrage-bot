/**
 * Unit tests for NotificationService.passesPriceFilter()
 * Feature: 057-notification-price-filter
 *
 * T005-T009: 價差過濾邏輯測試
 *
 * 過濾規則：
 * - requireFavorablePrice = false → 始終通過（不過濾）
 * - requireFavorablePrice = true → 需同時滿足：
 *   1. netReturn > 0（淨收益為正）
 *   2. isPriceDirectionCorrect = true（價差方向正確）
 * - bestPair 不存在 → 不通過（保守策略）
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FundingRatePair, BestArbitragePair, ExchangeName, ExchangeRateData } from '@/models/FundingRate';
import { FundingRateRecord } from '@/models/FundingRate';

/**
 * Mock passesPriceFilter function that matches the expected implementation
 * This will be moved to NotificationService in T010
 */
function passesPriceFilter(
  rate: FundingRatePair,
  requireFavorablePrice: boolean
): boolean {
  // 規則 1: 如果不要求價差過濾，直接通過
  if (!requireFavorablePrice) {
    return true;
  }

  // 規則 2: 需要 bestPair 存在
  const bestPair = rate.bestPair;
  if (!bestPair) {
    return false;
  }

  // 規則 3: 淨收益必須 > 0
  const netReturn = bestPair.netReturn ?? 0;
  if (netReturn <= 0) {
    return false;
  }

  // 規則 4: 價差方向必須正確
  // 如果 isPriceDirectionCorrect 是 undefined，採用保守策略（不通過）
  const isPriceDirectionCorrect = bestPair.isPriceDirectionCorrect;
  if (isPriceDirectionCorrect === undefined || isPriceDirectionCorrect === false) {
    return false;
  }

  return true;
}

/**
 * Helper: 建立測試用的 FundingRatePair
 */
function createMockRate(
  options: {
    netReturn?: number;
    isPriceDirectionCorrect?: boolean;
    hasBestPair?: boolean;
  } = {}
): FundingRatePair {
  const {
    netReturn = 0.1,
    isPriceDirectionCorrect = true,
    hasBestPair = true,
  } = options;

  const mockExchangeData: ExchangeRateData = {
    rate: new FundingRateRecord({
      exchange: 'binance',
      symbol: 'BTCUSDT',
      fundingRate: 0.0001,
      nextFundingTime: new Date(),
      recordedAt: new Date(),
    }),
    price: 50000,
    originalFundingInterval: 8,
  };

  const bestPair: BestArbitragePair | undefined = hasBestPair
    ? {
        longExchange: 'okx',
        shortExchange: 'binance',
        spreadPercent: 0.1,
        spreadAnnualized: 109.5,
        netReturn,
        isPriceDirectionCorrect,
      }
    : undefined;

  const exchanges = new Map<ExchangeName, ExchangeRateData>();
  exchanges.set('binance', mockExchangeData);
  exchanges.set('okx', {
    ...mockExchangeData,
    rate: new FundingRateRecord({
      ...mockExchangeData.rate,
      exchange: 'okx',
    }),
  });

  return {
    symbol: 'BTCUSDT',
    exchanges,
    bestPair,
    recordedAt: new Date(),
  };
}

describe('NotificationService.passesPriceFilter', () => {
  /**
   * T005: requireFavorablePrice = false 時，始終通過
   */
  describe('T005: requireFavorablePrice = false', () => {
    it('should return true when requireFavorablePrice is false regardless of netReturn', () => {
      const rate = createMockRate({ netReturn: -1, isPriceDirectionCorrect: false });
      expect(passesPriceFilter(rate, false)).toBe(true);
    });

    it('should return true when requireFavorablePrice is false even without bestPair', () => {
      const rate = createMockRate({ hasBestPair: false });
      expect(passesPriceFilter(rate, false)).toBe(true);
    });
  });

  /**
   * T006: 正淨收益且價差方向正確時，通過過濾
   */
  describe('T006: positive netReturn and correct price direction', () => {
    it('should return true when netReturn > 0 and isPriceDirectionCorrect is true', () => {
      const rate = createMockRate({
        netReturn: 0.1,
        isPriceDirectionCorrect: true,
      });
      expect(passesPriceFilter(rate, true)).toBe(true);
    });

    it('should return true when netReturn is very small but positive', () => {
      const rate = createMockRate({
        netReturn: 0.0001,
        isPriceDirectionCorrect: true,
      });
      expect(passesPriceFilter(rate, true)).toBe(true);
    });

    it('should return true when netReturn is large positive', () => {
      const rate = createMockRate({
        netReturn: 5.0,
        isPriceDirectionCorrect: true,
      });
      expect(passesPriceFilter(rate, true)).toBe(true);
    });
  });

  /**
   * T007: 負淨收益時，不通過過濾
   */
  describe('T007: negative netReturn', () => {
    it('should return false when netReturn < 0 even with correct price direction', () => {
      const rate = createMockRate({
        netReturn: -0.1,
        isPriceDirectionCorrect: true,
      });
      expect(passesPriceFilter(rate, true)).toBe(false);
    });

    it('should return false when netReturn is exactly 0', () => {
      const rate = createMockRate({
        netReturn: 0,
        isPriceDirectionCorrect: true,
      });
      expect(passesPriceFilter(rate, true)).toBe(false);
    });

    it('should return false when netReturn is very small negative', () => {
      const rate = createMockRate({
        netReturn: -0.0001,
        isPriceDirectionCorrect: true,
      });
      expect(passesPriceFilter(rate, true)).toBe(false);
    });
  });

  /**
   * T008: 價差方向不正確時，不通過過濾
   */
  describe('T008: incorrect price direction', () => {
    it('should return false when isPriceDirectionCorrect is false even with positive netReturn', () => {
      const rate = createMockRate({
        netReturn: 0.5,
        isPriceDirectionCorrect: false,
      });
      expect(passesPriceFilter(rate, true)).toBe(false);
    });

    it('should return false when both netReturn < 0 and isPriceDirectionCorrect is false', () => {
      const rate = createMockRate({
        netReturn: -0.5,
        isPriceDirectionCorrect: false,
      });
      expect(passesPriceFilter(rate, true)).toBe(false);
    });
  });

  /**
   * T009: bestPair 不存在時，不通過過濾（保守策略）
   */
  describe('T009: missing bestPair', () => {
    it('should return false when bestPair is undefined', () => {
      const rate = createMockRate({ hasBestPair: false });
      expect(passesPriceFilter(rate, true)).toBe(false);
    });

    it('should return true when bestPair is undefined but requireFavorablePrice is false', () => {
      const rate = createMockRate({ hasBestPair: false });
      expect(passesPriceFilter(rate, false)).toBe(true);
    });
  });

  /**
   * 邊界案例和額外測試
   */
  describe('Edge cases', () => {
    it('should return false when isPriceDirectionCorrect is undefined (conservative)', () => {
      // 建立一個 bestPair 但沒有 isPriceDirectionCorrect 的 rate
      const rate = createMockRate({ netReturn: 0.5 });
      // 手動移除 isPriceDirectionCorrect
      if (rate.bestPair) {
        delete (rate.bestPair as any).isPriceDirectionCorrect;
      }
      expect(passesPriceFilter(rate, true)).toBe(false);
    });

    it('should return false when netReturn is undefined (treated as 0)', () => {
      const rate = createMockRate({ isPriceDirectionCorrect: true });
      // 手動移除 netReturn
      if (rate.bestPair) {
        delete (rate.bestPair as any).netReturn;
      }
      expect(passesPriceFilter(rate, true)).toBe(false);
    });
  });
});
