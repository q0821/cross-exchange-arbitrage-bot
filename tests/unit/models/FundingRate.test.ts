/**
 * Unit tests for FundingRate model - Normalized Rate Calculations
 * Feature: 019-fix-time-basis-switching
 * User Story 3: 查看基於時間基準的正確費率差
 */

import { describe, it, expect } from 'vitest';
import type { ExchangeRateData, TimeBasis } from '@/models/FundingRate';

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
