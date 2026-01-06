/**
 * Unit tests for FundingRate model - Normalized Rate Calculations
 * Feature: 019-fix-time-basis-switching
 * User Story 3: 查看基於時間基準的正確費率差
 *
 * Feature: 057-notification-price-filter
 * T003a: isPriceDirectionCorrect calculation tests
 */

import { describe, it, expect } from 'vitest';
import type { ExchangeRateData, TimeBasis, ExchangeName } from '@/models/FundingRate';
import { createMultiExchangeFundingRatePair, FundingRateRecord } from '@/models/FundingRate';
import { MAX_ACCEPTABLE_ADVERSE_PRICE_DIFF } from '@/lib/cost-constants';

/**
 * T020: 驗證不同時間基準下的費率差計算正確性
 * T021: 驗證標準化資料缺失時的降級行為
 *
 * Expected: FAIL before implementation
 * These tests will fail until we implement getNormalizedRate helper
 */
describe('FundingRate - Normalized Rate Calculations', () => {
  /**
   * Helper function to simulate getNormalizedRate
   * This is what we will implement in src/models/FundingRate.ts
   */
  function getNormalizedRate(
    data: ExchangeRateData,
    timeBasis: TimeBasis
  ): number {
    const timeBasisKey = `${timeBasis}h` as '1h' | '4h' | '8h' | '24h';
    const normalized = data.normalized?.[timeBasisKey];

    // Use normalized rate if available and original interval differs from target
    if (
      normalized !== undefined &&
      data.originalFundingInterval &&
      data.originalFundingInterval !== timeBasis
    ) {
      return normalized;
    }

    // Fallback to original rate
    return data.rate.fundingRate;
  }

  /**
   * T020: Test normalized rate calculation for different time bases
   */
  it('T020: should calculate correct spread using normalized rates', () => {
    // Mock data: Binance 8h/0.01% vs OKX 4h/0.005%
    // When normalized to 8h, both should be ~0.01%
    const binanceData: ExchangeRateData = {
      rate: {
        fundingRate: 0.0001, // 0.01% per 8h
        markPrice: 45000,
        nextFundingTime: new Date('2025-01-19T12:00:00Z'),
        fundingInterval: 8 * 3600 * 1000,
      },
      price: 45000,
      normalized: {
        '1h': 0.0000125,
        '4h': 0.00005,
        '8h': 0.0001,
        '24h': 0.0003,
      },
      originalFundingInterval: 8,
    };

    const okxData: ExchangeRateData = {
      rate: {
        fundingRate: 0.00005, // 0.005% per 4h
        markPrice: 45001,
        nextFundingTime: new Date('2025-01-19T11:00:00Z'),
        fundingInterval: 4 * 3600 * 1000,
      },
      price: 45001,
      normalized: {
        '1h': 0.0000125,
        '4h': 0.00005,
        '8h': 0.0001, // Normalized to 8h: 0.00005 * 2 = 0.0001
        '24h': 0.0003,
      },
      originalFundingInterval: 4,
    };

    // Test with timeBasis = 8 hours
    const binanceRate8h = getNormalizedRate(binanceData, 8);
    const okxRate8h = getNormalizedRate(okxData, 8);

    // Both should be 0.0001 when normalized to 8h
    expect(binanceRate8h).toBeCloseTo(0.0001, 6);
    expect(okxRate8h).toBeCloseTo(0.0001, 6);

    // Spread should be close to 0
    const spread8h = Math.abs(binanceRate8h - okxRate8h);
    expect(spread8h).toBeCloseTo(0, 6);

    // Test with timeBasis = 4 hours
    const binanceRate4h = getNormalizedRate(binanceData, 4);
    const okxRate4h = getNormalizedRate(okxData, 4);

    // Both should be 0.00005 when normalized to 4h
    expect(binanceRate4h).toBeCloseTo(0.00005, 6);
    expect(okxRate4h).toBeCloseTo(0.00005, 6);

    // Spread should be close to 0
    const spread4h = Math.abs(binanceRate4h - okxRate4h);
    expect(spread4h).toBeCloseTo(0, 6);

    // Test with timeBasis = 1 hour
    const binanceRate1h = getNormalizedRate(binanceData, 1);
    const okxRate1h = getNormalizedRate(okxData, 1);

    // Both should be 0.0000125 when normalized to 1h
    expect(binanceRate1h).toBeCloseTo(0.0000125, 8);
    expect(okxRate1h).toBeCloseTo(0.0000125, 8);

    // Spread should be close to 0
    const spread1h = Math.abs(binanceRate1h - okxRate1h);
    expect(spread1h).toBeCloseTo(0, 8);
  });

  /**
   * T021: Test fallback behavior when normalized data is missing
   */
  it('T021: should fallback to original rate when normalized data is missing', () => {
    const incompleteData: ExchangeRateData = {
      rate: {
        fundingRate: 0.0001,
        markPrice: 45000,
        nextFundingTime: new Date('2025-01-19T12:00:00Z'),
        fundingInterval: 8 * 3600 * 1000,
      },
      price: 45000,
      // Missing: normalized
      // Missing: originalFundingInterval
    };

    // Should fallback to original rate for all time bases
    const rate1h = getNormalizedRate(incompleteData, 1);
    const rate4h = getNormalizedRate(incompleteData, 4);
    const rate8h = getNormalizedRate(incompleteData, 8);
    const rate24h = getNormalizedRate(incompleteData, 24);

    expect(rate1h).toBe(0.0001);
    expect(rate4h).toBe(0.0001);
    expect(rate8h).toBe(0.0001);
    expect(rate24h).toBe(0.0001);
  });

  /**
   * Additional test: Verify behavior when original interval equals target
   */
  it('should use original rate when original interval equals time basis', () => {
    const binanceData: ExchangeRateData = {
      rate: {
        fundingRate: 0.0001,
        markPrice: 45000,
        nextFundingTime: new Date('2025-01-19T12:00:00Z'),
        fundingInterval: 8 * 3600 * 1000,
      },
      price: 45000,
      normalized: {
        '1h': 0.0000125,
        '4h': 0.00005,
        '8h': 0.0001,
        '24h': 0.0003,
      },
      originalFundingInterval: 8,
    };

    // When timeBasis = originalInterval, should use original rate
    const rate8h = getNormalizedRate(binanceData, 8);
    expect(rate8h).toBe(0.0001); // Original rate, not normalized['8h']
  });

  /**
   * Real-world scenario: Different exchanges with different intervals
   */
  it('should handle real-world scenario with mixed intervals', () => {
    // Binance: 8h interval, 0.01% rate
    const binance: ExchangeRateData = {
      rate: {
        fundingRate: 0.0001,
        markPrice: 50000,
        nextFundingTime: new Date('2025-01-19T16:00:00Z'),
        fundingInterval: 8 * 3600 * 1000,
      },
      price: 50000,
      normalized: {
        '1h': 0.0000125,
        '4h': 0.00005,
        '8h': 0.0001,
        '24h': 0.0003,
      },
      originalFundingInterval: 8,
    };

    // OKX: 4h interval, 0.005% rate (equivalent to 0.01% per 8h)
    const okx: ExchangeRateData = {
      rate: {
        fundingRate: 0.00005,
        markPrice: 50010,
        nextFundingTime: new Date('2025-01-19T15:00:00Z'),
        fundingInterval: 4 * 3600 * 1000,
      },
      price: 50010,
      normalized: {
        '1h': 0.0000125,
        '4h': 0.00005,
        '8h': 0.0001,
        '24h': 0.0003,
      },
      originalFundingInterval: 4,
    };

    // MEXC: 8h interval, 0.008% rate
    const mexc: ExchangeRateData = {
      rate: {
        fundingRate: 0.00008,
        markPrice: 50005,
        nextFundingTime: new Date('2025-01-19T16:00:00Z'),
        fundingInterval: 8 * 3600 * 1000,
      },
      price: 50005,
      normalized: {
        '1h': 0.00001,
        '4h': 0.00004,
        '8h': 0.00008,
        '24h': 0.00024,
      },
      originalFundingInterval: 8,
    };

    // Compare all three exchanges at 8h basis
    const binanceRate = getNormalizedRate(binance, 8);
    const okxRate = getNormalizedRate(okx, 8);
    const mexcRate = getNormalizedRate(mexc, 8);

    expect(binanceRate).toBe(0.0001);
    expect(okxRate).toBe(0.0001); // Normalized from 4h
    expect(mexcRate).toBe(0.00008);

    // Spread between Binance and OKX should be ~0
    const spreadBinanceOkx = Math.abs(binanceRate - okxRate);
    expect(spreadBinanceOkx).toBeCloseTo(0, 6);

    // Spread between Binance and MEXC should be ~0.00002
    const spreadBinanceMexc = Math.abs(binanceRate - mexcRate);
    expect(spreadBinanceMexc).toBeCloseTo(0.00002, 6);
  });
});

/**
 * Unit tests for Annualized Return Calculation
 * Feature: 021-fix-rate-spread-calculation
 * User Story 1: 修正後端年化報酬計算邏輯
 *
 * T005-T009: 驗證年化報酬在不同時間基準下的計算正確性
 */
describe('FundingRate - Annualized Return Calculation', () => {
  /**
   * T005: 驗證 1 小時基準下的年化報酬計算
   */
  it('T005: should calculate annualized return correctly with 1h timeBasis', () => {
    // spread = 0.000751 (0.0751%), timeBasis = 1
    // expected annualized = 0.000751 * 365 * 24 * 100 = 657.876%
    const spread = 0.000751;
    const timeBasis = 1;
    const annualizedReturn = spread * 365 * (24 / timeBasis) * 100;

    expect(annualizedReturn).toBeCloseTo(657.876, 2);
  });

  /**
   * T006: 驗證 4 小時基準下的年化報酬計算
   */
  it('T006: should calculate annualized return correctly with 4h timeBasis', () => {
    // spread = 0.003004 (0.3004%), timeBasis = 4
    // expected annualized = 0.003004 * 365 * 6 * 100 = 657.876%
    const spread = 0.003004;
    const timeBasis = 4;
    const annualizedReturn = spread * 365 * (24 / timeBasis) * 100;

    expect(annualizedReturn).toBeCloseTo(657.876, 2);
  });

  /**
   * T007: 驗證 8 小時基準下的年化報酬計算
   */
  it('T007: should calculate annualized return correctly with 8h timeBasis', () => {
    // spread = 0.006008 (0.6008%), timeBasis = 8
    // expected annualized = 0.006008 * 365 * 3 * 100 = 657.876%
    const spread = 0.006008;
    const timeBasis = 8;
    const annualizedReturn = spread * 365 * (24 / timeBasis) * 100;

    expect(annualizedReturn).toBeCloseTo(657.876, 2);
  });

  /**
   * T008: 驗證 24 小時基準下的年化報酬計算
   */
  it('T008: should calculate annualized return correctly with 24h timeBasis', () => {
    // spread = 0.018024 (1.8024%), timeBasis = 24
    // expected annualized = 0.018024 * 365 * 1 * 100 = 657.876%
    const spread = 0.018024;
    const timeBasis = 24;
    const annualizedReturn = spread * 365 * (24 / timeBasis) * 100;

    expect(annualizedReturn).toBeCloseTo(657.876, 2);
  });

  /**
   * T009: 驗證所有時間基準下的年化報酬保持一致
   */
  it('T009: annualized return should be consistent across all time bases', () => {
    // Using proportional spreads for each time basis
    // 1h: 0.000751, 4h: 0.003004, 8h: 0.006008, 24h: 0.018024
    const testCases = [
      { spread: 0.000751, timeBasis: 1 },
      { spread: 0.003004, timeBasis: 4 },
      { spread: 0.006008, timeBasis: 8 },
      { spread: 0.018024, timeBasis: 24 },
    ];

    const annualizedReturns = testCases.map(({ spread, timeBasis }) =>
      spread * 365 * (24 / timeBasis) * 100
    );

    // All annualized returns should be approximately equal
    const expectedReturn = 657.876;
    annualizedReturns.forEach((annualized, index) => {
      expect(annualized).toBeCloseTo(expectedReturn, 1); // Allow 0.1% tolerance
    });

    // Verify variance is minimal (within 0.5%)
    const maxReturn = Math.max(...annualizedReturns);
    const minReturn = Math.min(...annualizedReturns);
    const variance = maxReturn - minReturn;
    expect(variance).toBeLessThan(expectedReturn * 0.005); // Less than 0.5% variance
  });
});

/**
 * Unit tests for isPriceDirectionCorrect calculation
 * Feature: 057-notification-price-filter
 * T003a: 價差方向判斷測試
 *
 * 規則：
 * - 空方價格 >= 多方價格 → true（有利價差）
 * - 空方價格 < 多方價格但在 0.05% 容忍範圍內 → true（可接受）
 * - 空方價格 < 多方價格超過 0.05% → false（不利價差）
 * - 無價格數據 → undefined（讓消費者決定如何處理）
 */
describe('FundingRate - isPriceDirectionCorrect Calculation', () => {
  /**
   * Helper: 建立測試用的 ExchangeRateData
   */
  function createExchangeData(
    exchange: ExchangeName,
    fundingRate: number,
    price?: number
  ): ExchangeRateData {
    return {
      rate: new FundingRateRecord({
        exchange,
        symbol: 'BTCUSDT',
        fundingRate,
        nextFundingTime: new Date('2025-01-19T16:00:00Z'),
        markPrice: price,
        recordedAt: new Date(),
      }),
      price,
      originalFundingInterval: 8,
    };
  }

  /**
   * T003a-1: 空方價格 > 多方價格時應該返回 true
   */
  it('should set isPriceDirectionCorrect=true when short price > long price', () => {
    // Binance: 0.01%, OKX: -0.01% → 做空 Binance（價格 50010），做多 OKX（價格 50000）
    const exchangesData = new Map<ExchangeName, ExchangeRateData>();
    exchangesData.set('binance', createExchangeData('binance', 0.0001, 50010)); // short
    exchangesData.set('okx', createExchangeData('okx', -0.0001, 50000)); // long

    const pair = createMultiExchangeFundingRatePair('BTCUSDT', exchangesData);

    expect(pair.bestPair).toBeDefined();
    expect(pair.bestPair?.shortExchange).toBe('binance');
    expect(pair.bestPair?.longExchange).toBe('okx');
    // Feature 057: isPriceDirectionCorrect should be calculated
    expect(pair.bestPair?.isPriceDirectionCorrect).toBe(true);
  });

  /**
   * T003a-2: 空方價格 = 多方價格時應該返回 true
   */
  it('should set isPriceDirectionCorrect=true when short price = long price', () => {
    const exchangesData = new Map<ExchangeName, ExchangeRateData>();
    exchangesData.set('binance', createExchangeData('binance', 0.0001, 50000)); // short
    exchangesData.set('okx', createExchangeData('okx', -0.0001, 50000)); // long

    const pair = createMultiExchangeFundingRatePair('BTCUSDT', exchangesData);

    expect(pair.bestPair).toBeDefined();
    expect(pair.bestPair?.isPriceDirectionCorrect).toBe(true);
  });

  /**
   * T003a-3: 空方價格略低於多方，但在 0.05% 容忍範圍內，應返回 true
   */
  it('should set isPriceDirectionCorrect=true when adverse price diff is within tolerance', () => {
    // short price = 50000, long price = 50010
    // priceDiffRate = (50000 - 50010) / 50000 = -0.0002 = -0.02%
    // MAX_ACCEPTABLE_ADVERSE_PRICE_DIFF = 0.0005 = 0.05%
    // |-0.02%| < 0.05% → 在容忍範圍內 → true
    const exchangesData = new Map<ExchangeName, ExchangeRateData>();
    exchangesData.set('binance', createExchangeData('binance', 0.0001, 50000)); // short (lower price)
    exchangesData.set('okx', createExchangeData('okx', -0.0001, 50010)); // long (higher price)

    const pair = createMultiExchangeFundingRatePair('BTCUSDT', exchangesData);

    expect(pair.bestPair).toBeDefined();
    expect(pair.bestPair?.shortExchange).toBe('binance');
    expect(pair.bestPair?.longExchange).toBe('okx');
    expect(pair.bestPair?.isPriceDirectionCorrect).toBe(true);
  });

  /**
   * T003a-4: 空方價格明顯低於多方，超過 0.05% 容忍範圍，應返回 false
   */
  it('should set isPriceDirectionCorrect=false when adverse price diff exceeds tolerance', () => {
    // short price = 50000, long price = 50100
    // priceDiffRate = (50000 - 50100) / 50000 = -0.002 = -0.2%
    // |-0.2%| > 0.05% → 超過容忍範圍 → false
    const exchangesData = new Map<ExchangeName, ExchangeRateData>();
    exchangesData.set('binance', createExchangeData('binance', 0.0001, 50000)); // short (lower price)
    exchangesData.set('okx', createExchangeData('okx', -0.0001, 50100)); // long (higher price)

    const pair = createMultiExchangeFundingRatePair('BTCUSDT', exchangesData);

    expect(pair.bestPair).toBeDefined();
    expect(pair.bestPair?.shortExchange).toBe('binance');
    expect(pair.bestPair?.longExchange).toBe('okx');
    expect(pair.bestPair?.isPriceDirectionCorrect).toBe(false);
  });

  /**
   * T003a-5: 無價格數據時應該返回 undefined
   */
  it('should set isPriceDirectionCorrect=undefined when price data is missing', () => {
    const exchangesData = new Map<ExchangeName, ExchangeRateData>();
    exchangesData.set('binance', createExchangeData('binance', 0.0001, undefined)); // no price
    exchangesData.set('okx', createExchangeData('okx', -0.0001, undefined)); // no price

    const pair = createMultiExchangeFundingRatePair('BTCUSDT', exchangesData);

    expect(pair.bestPair).toBeDefined();
    // 無價格時，應該是 undefined（讓消費者決定如何處理）
    expect(pair.bestPair?.isPriceDirectionCorrect).toBeUndefined();
  });

  /**
   * T003a-6: 只有一方有價格時應該返回 undefined
   */
  it('should set isPriceDirectionCorrect=undefined when only one side has price', () => {
    const exchangesData = new Map<ExchangeName, ExchangeRateData>();
    exchangesData.set('binance', createExchangeData('binance', 0.0001, 50000)); // has price
    exchangesData.set('okx', createExchangeData('okx', -0.0001, undefined)); // no price

    const pair = createMultiExchangeFundingRatePair('BTCUSDT', exchangesData);

    expect(pair.bestPair).toBeDefined();
    expect(pair.bestPair?.isPriceDirectionCorrect).toBeUndefined();
  });

  /**
   * T003a-7: 邊界案例 - 價差剛好在容忍範圍邊界
   */
  it('should set isPriceDirectionCorrect=true when adverse price diff is exactly at tolerance boundary', () => {
    // short price = 50000
    // 要讓 priceDiffRate = -0.0005 = -0.05%
    // (shortPrice - longPrice) / shortPrice = -0.0005
    // shortPrice - longPrice = -0.0005 * shortPrice
    // longPrice = shortPrice * 1.0005 = 50000 * 1.0005 = 50025
    const exchangesData = new Map<ExchangeName, ExchangeRateData>();
    exchangesData.set('binance', createExchangeData('binance', 0.0001, 50000)); // short
    exchangesData.set('okx', createExchangeData('okx', -0.0001, 50025)); // long

    const pair = createMultiExchangeFundingRatePair('BTCUSDT', exchangesData);

    expect(pair.bestPair).toBeDefined();
    // 在邊界上（<= 0.05%），應該是 true
    expect(pair.bestPair?.isPriceDirectionCorrect).toBe(true);
  });

  /**
   * T003a-8: 邊界案例 - 價差剛好超過容忍範圍一點點
   */
  it('should set isPriceDirectionCorrect=false when adverse price diff slightly exceeds tolerance', () => {
    // short price = 50000
    // 要讓 priceDiffRate = -0.0006 = -0.06%（比 0.05% 多一點）
    // longPrice = shortPrice * 1.0006 = 50000 * 1.0006 = 50030
    const exchangesData = new Map<ExchangeName, ExchangeRateData>();
    exchangesData.set('binance', createExchangeData('binance', 0.0001, 50000)); // short
    exchangesData.set('okx', createExchangeData('okx', -0.0001, 50030)); // long

    const pair = createMultiExchangeFundingRatePair('BTCUSDT', exchangesData);

    expect(pair.bestPair).toBeDefined();
    // 超過邊界（> 0.05%），應該是 false
    expect(pair.bestPair?.isPriceDirectionCorrect).toBe(false);
  });
});
