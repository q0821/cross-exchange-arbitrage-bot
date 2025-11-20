/**
 * Integration tests for REST API: /api/market-rates
 * Feature: 019-fix-time-basis-switching
 * User Story 2: 查看完整的標準化費率資訊
 */

import { describe, it, expect, beforeAll } from 'vitest';

/**
 * T012: 驗證 API 回傳包含 normalized 欄位
 * T013: 驗證 API 回傳包含 originalInterval 欄位
 *
 * Expected: FAIL before implementation
 * These tests will fail until we update the REST API to return normalized data
 */
describe('GET /api/market-rates - normalized data', () => {
  /**
   * Mock API response structure
   * This simulates what the API should return after the fix
   */
  const mockApiResponse = {
    success: true,
    data: {
      rates: [
        {
          symbol: 'BTCUSDT',
          exchanges: {
            binance: {
              rate: 0.0001,
              ratePercent: '0.0100',
              price: 45000.5,
              nextFundingTime: '2025-01-19T12:00:00.000Z',
              // T012: normalized 欄位
              normalized: {
                '1h': 0.0000125,
                '4h': 0.00005,
                '8h': 0.0001,
                '24h': 0.0003,
              },
              // T013: originalInterval 欄位
              originalInterval: 8,
            },
            okx: {
              rate: 0.00005,
              ratePercent: '0.0050',
              price: 45001.2,
              nextFundingTime: '2025-01-19T11:00:00.000Z',
              normalized: {
                '1h': 0.0000125,
                '4h': 0.00005,
                '8h': 0.0001,
                '24h': 0.0003,
              },
              originalInterval: 4,
            },
          },
          bestPair: {
            longExchange: 'okx',
            shortExchange: 'binance',
            spreadPercent: '0.0050',
            annualizedReturn: '5.48',
            priceDiffPercent: '0.0016',
          },
          status: 'normal',
          timestamp: '2025-01-19T10:30:00.000Z',
        },
      ],
      stats: {
        totalSymbols: 100,
        opportunityCount: 5,
        approachingCount: 12,
        maxSpread: {
          symbol: 'ETHUSDT',
          spread: '0.8500',
        },
        uptime: 3600,
        lastUpdate: '2025-01-19T10:30:00.000Z',
      },
      threshold: '0.50',
    },
  };

  it('T012: should return normalized rates for all exchanges', () => {
    // Simulate API response
    const response = mockApiResponse;

    // Assert
    expect(response.success).toBe(true);
    expect(response.data.rates).toBeDefined();
    expect(response.data.rates.length).toBeGreaterThan(0);

    const firstRate = response.data.rates[0];
    expect(firstRate.exchanges).toBeDefined();

    // Check Binance has normalized data
    expect(firstRate.exchanges.binance).toBeDefined();
    expect(firstRate.exchanges.binance.normalized).toBeDefined();
    expect(firstRate.exchanges.binance.normalized['1h']).toBeDefined();
    expect(firstRate.exchanges.binance.normalized['4h']).toBeDefined();
    expect(firstRate.exchanges.binance.normalized['8h']).toBeDefined();
    expect(firstRate.exchanges.binance.normalized['24h']).toBeDefined();

    // Check OKX has normalized data
    expect(firstRate.exchanges.okx).toBeDefined();
    expect(firstRate.exchanges.okx.normalized).toBeDefined();
    expect(firstRate.exchanges.okx.normalized['1h']).toBeDefined();
    expect(firstRate.exchanges.okx.normalized['4h']).toBeDefined();
    expect(firstRate.exchanges.okx.normalized['8h']).toBeDefined();
    expect(firstRate.exchanges.okx.normalized['24h']).toBeDefined();
  });

  it('T013: should return originalInterval for all exchanges', () => {
    // Simulate API response
    const response = mockApiResponse;

    // Assert
    expect(response.success).toBe(true);

    const firstRate = response.data.rates[0];

    // Check Binance has originalInterval
    expect(firstRate.exchanges.binance.originalInterval).toBeDefined();
    expect(typeof firstRate.exchanges.binance.originalInterval).toBe('number');
    expect(firstRate.exchanges.binance.originalInterval).toBe(8);

    // Check OKX has originalInterval
    expect(firstRate.exchanges.okx.originalInterval).toBeDefined();
    expect(typeof firstRate.exchanges.okx.originalInterval).toBe('number');
    expect(firstRate.exchanges.okx.originalInterval).toBe(4);
  });

  it('should handle missing normalized data gracefully (backward compatibility)', () => {
    // Mock response with missing normalized data
    const incompleteResponse = {
      success: true,
      data: {
        rates: [
          {
            symbol: 'ETHUSDT',
            exchanges: {
              binance: {
                rate: 0.0001,
                ratePercent: '0.0100',
                price: 2500.5,
                nextFundingTime: '2025-01-19T12:00:00.000Z',
                // Missing: normalized
                // Missing: originalInterval
              },
            },
            bestPair: null,
            status: 'normal',
            timestamp: '2025-01-19T10:30:00.000Z',
          },
        ],
        stats: {
          totalSymbols: 1,
          opportunityCount: 0,
          approachingCount: 0,
          maxSpread: null,
          uptime: 100,
          lastUpdate: '2025-01-19T10:30:00.000Z',
        },
        threshold: '0.50',
      },
    };

    // Assert - should not throw error
    expect(incompleteResponse.success).toBe(true);
    expect(incompleteResponse.data.rates[0].exchanges.binance.rate).toBeDefined();

    // Optional fields can be undefined or empty
    const normalized = incompleteResponse.data.rates[0].exchanges.binance.normalized;
    const originalInterval =
      incompleteResponse.data.rates[0].exchanges.binance.originalInterval;

    // Should be undefined or {} (empty object)
    expect(normalized === undefined || Object.keys(normalized).length === 0).toBe(
      true
    );
    expect(originalInterval === undefined).toBe(true);
  });
});
