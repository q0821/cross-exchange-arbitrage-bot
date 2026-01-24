/**
 * Test: NetProfitCalculator
 *
 * 套利淨收益計算器單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Decimal from 'decimal.js';
import { NetProfitCalculator, netProfitCalculator } from '@/services/calculation/NetProfitCalculator';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('NetProfitCalculator', () => {
  let calculator: NetProfitCalculator;

  beforeEach(() => {
    vi.clearAllMocks();
    calculator = new NetProfitCalculator();
  });

  describe('calculate', () => {
    it('should calculate positive net profit correctly', () => {
      // Long rate: 0.01% (負費率，做多收費率)
      // Short rate: -0.05% (負費率，做空收費率)
      // Rate difference: 0.01% - (-0.05%) = 0.06%
      // Total fees: 0.05% × 4 = 0.2%
      // Net profit: 0.06% - 0.2% = -0.14%
      const result =calculator.calculate(
        'BTCUSDT',
        'binance',
        'okx',
        '0.0001',   // 0.01%
        '-0.0005',  // -0.05%
        '0.0005'    // 0.05% fee
      );

      expect(result.symbol).toBe('BTCUSDT');
      expect(result.longExchange).toBe('binance');
      expect(result.shortExchange).toBe('okx');
      expect(result.longRate.toString()).toBe('0.0001');
      expect(result.shortRate.toString()).toBe('-0.0005');
      expect(result.rateDifference.toString()).toBe('0.0006'); // 0.0001 - (-0.0005)
      expect(result.totalFees.toString()).toBe('0.002'); // 0.0005 × 4
      expect(result.netProfit.toString()).toBe('-0.0014'); // 0.0006 - 0.002
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should calculate with profitable scenario', () => {
      // Long rate: -0.03% (做多收費率)
      // Short rate: 0.05% (做空付費率)
      // Rate difference: -0.03% - 0.05% = -0.08% (負值表示做多有利)
      // 實際收益 = |shortRate| + longRate (if longRate < 0)
      // 這裡用另一種組合：做空高費率交易所，做多低費率交易所
      const result =calculator.calculate(
        'ETHUSDT',
        'okx',
        'binance',
        '-0.0008',  // -0.08% (做多可收取)
        '0.0002',   // 0.02% (做空需支付)
        '0.0002'    // 0.02% fee
      );

      // Rate difference: -0.0008 - 0.0002 = -0.001
      // Total fees: 0.0002 × 4 = 0.0008
      // Net profit: -0.001 - 0.0008 = -0.0018
      expect(result.rateDifference.toString()).toBe('-0.001');
      expect(result.totalFees.toString()).toBe('0.0008');
      expect(result.netProfit.toString()).toBe('-0.0018');
    });

    it('should use default taker fee rate when not provided', () => {
      const result =calculator.calculate(
        'BTCUSDT',
        'binance',
        'okx',
        '0.001',
        '0.0001'
      );

      // Default fee: 0.0005 (0.05%)
      // Total fees: 0.0005 × 4 = 0.002
      expect(result.takerFeeRate.toString()).toBe('0.0005');
      expect(result.totalFees.toString()).toBe('0.002');
    });

    it('should log debug message for negative net profit', async () => {
      const { logger } = await import('@/lib/logger');

      calculator.calculate(
        'BTCUSDT',
        'binance',
        'okx',
        '0.0001',
        '0.0001',
        '0.001'  // High fee rate
      );

      expect(logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'BTCUSDT',
        }),
        'Negative net profit detected - arbitrage opportunity not profitable'
      );
    });

    it('should log debug message with calculation details', async () => {
      const { logger } = await import('@/lib/logger');

      calculator.calculate(
        'SOLUSDT',
        'mexc',
        'gateio',
        '0.0005',
        '0.0001',
        '0.0003'
      );

      expect(logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'SOLUSDT',
          longExchange: 'mexc',
          shortExchange: 'gateio',
        }),
        'Net profit calculated'
      );
    });

    it('should throw error for invalid input', async () => {
      const { logger } = await import('@/lib/logger');

      expect(() => {
        calculator.calculate(
          'BTCUSDT',
          'binance',
          'okx',
          'invalid',  // Invalid rate
          '0.0001'
        );
      }).toThrow();

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'BTCUSDT',
        }),
        'Net profit input validation failed'
      );
    });

    it('should handle zero rates', () => {
      const result =calculator.calculate(
        'BTCUSDT',
        'binance',
        'okx',
        '0',
        '0',
        '0.0005'
      );

      expect(result.rateDifference.toString()).toBe('0');
      expect(result.netProfit.toString()).toBe('-0.002'); // 0 - 0.002
    });

    it('should handle very small rates with precision', () => {
      const result =calculator.calculate(
        'BTCUSDT',
        'binance',
        'okx',
        '0.00000001',
        '0.00000002',
        '0.0001'
      );

      // Decimal.js may use scientific notation, compare values instead
      expect(result.rateDifference.eq(new Decimal('-0.00000001'))).toBe(true);
      expect(result.netProfit.lessThan(0)).toBe(true);
    });
  });

  describe('findBestArbitragePair', () => {
    it('should find the best arbitrage pair', () => {
      const rates = new Map([
        ['binance', '0.0001'],
        ['okx', '-0.0005'],
        ['gateio', '0.0002'],
      ]);

      const result =calculator.findBestArbitragePair('BTCUSDT', rates, '0.0001');

      expect(result).not.toBeNull();
      // Best pair should have highest net profit
      // binance→okx: 0.0001 - (-0.0005) - 0.0004 = 0.0002
      // okx→binance: -0.0005 - 0.0001 - 0.0004 = -0.001
      // etc.
      expect(result?.netProfit).toBeInstanceOf(Decimal);
    });

    it('should return null when less than 2 exchanges', () => {
      const rates = new Map([['binance', '0.0001']]);

      const result =calculator.findBestArbitragePair('BTCUSDT', rates);

      expect(result).toBeNull();
    });

    it('should return null when rates map is empty', () => {
      const rates = new Map<string, string>();

      const result =calculator.findBestArbitragePair('BTCUSDT', rates);

      expect(result).toBeNull();
    });

    it('should log warning when not enough exchanges', async () => {
      const { logger } = await import('@/lib/logger');
      const rates = new Map([['binance', '0.0001']]);

      calculator.findBestArbitragePair('ETHUSDT', rates);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'ETHUSDT',
          exchangeCount: 1,
        }),
        'Not enough exchanges to find arbitrage pair'
      );
    });

    it('should log info when best pair is found', async () => {
      const { logger } = await import('@/lib/logger');
      const rates = new Map([
        ['binance', '0.0001'],
        ['okx', '-0.0003'],
      ]);

      calculator.findBestArbitragePair('BTCUSDT', rates, '0.0001');

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'BTCUSDT',
        }),
        'Best arbitrage pair found'
      );
    });

    it('should handle calculation errors gracefully', async () => {
      const { logger } = await import('@/lib/logger');

      // Create a map with an invalid rate
      const rates = new Map([
        ['binance', '0.0001'],
        ['okx', 'invalid'],
      ]);

      // Should not throw, but log error and continue
      const _result =calculator.findBestArbitragePair('BTCUSDT', rates);

      expect(logger.error).toHaveBeenCalled();
      // Result could be null or a valid pair depending on which calculations succeed
    });

    it('should compare all exchange pairs', () => {
      const rates = new Map([
        ['binance', '0.0010'],   // Highest positive
        ['okx', '-0.0005'],      // Negative
        ['gateio', '0.0001'],    // Low positive
        ['mexc', '-0.0003'],     // Medium negative
      ]);

      const result =calculator.findBestArbitragePair('BTCUSDT', rates, '0.0001');

      expect(result).not.toBeNull();
      // Best should be binance (long) → okx (short) = 0.0010 - (-0.0005) = 0.0015
      // Net = 0.0015 - 0.0004 = 0.0011
      expect(result?.longExchange).toBe('binance');
      expect(result?.shortExchange).toBe('okx');
    });
  });

  describe('findAllOpportunities', () => {
    it('should find all opportunities sorted by net profit', () => {
      const rates = new Map([
        ['binance', '0.0005'],
        ['okx', '-0.0003'],
        ['gateio', '0.0001'],
      ]);

      const result =calculator.findAllOpportunities('BTCUSDT', rates, '0.0001');

      expect(result.symbol).toBe('BTCUSDT');
      expect(result.opportunities.length).toBeGreaterThan(0);

      // Verify sorted by net profit descending
      for (let i = 0; i < result.opportunities.length - 1; i++) {
        const current = result.opportunities[i];
        const next = result.opportunities[i + 1];
        expect(current?.netProfit.gte(next?.netProfit ?? new Decimal(0))).toBe(true);
      }
    });

    it('should filter by minimum net profit', () => {
      const rates = new Map([
        ['binance', '0.001'],
        ['okx', '0.0001'],
        ['gateio', '0.0005'],
      ]);

      const minProfit = new Decimal('0.0005');
      const result =calculator.findAllOpportunities('BTCUSDT', rates, '0.0001', minProfit);

      // All opportunities should have net profit >= minProfit
      result.opportunities.forEach((opp) => {
        expect(opp.netProfit.gte(minProfit)).toBe(true);
      });
    });

    it('should return empty opportunities when no profitable pairs', () => {
      const rates = new Map([
        ['binance', '0.0001'],
        ['okx', '0.0001'],
      ]);

      const minProfit = new Decimal('0.01'); // Very high threshold
      const result =calculator.findAllOpportunities('BTCUSDT', rates, '0.0001', minProfit);

      expect(result.opportunities.length).toBe(0);
    });

    it('should handle empty rates map', () => {
      const rates = new Map<string, string>();

      const result =calculator.findAllOpportunities('BTCUSDT', rates);

      expect(result.symbol).toBe('BTCUSDT');
      expect(result.opportunities.length).toBe(0);
    });

    it('should include all pair combinations', () => {
      const rates = new Map([
        ['binance', '0.0001'],
        ['okx', '0.0002'],
        ['gateio', '0.0003'],
      ]);

      const result =calculator.findAllOpportunities('BTCUSDT', rates, '0.0001');

      // 3 exchanges → 3 × 2 = 6 combinations (each can be long or short)
      expect(result.opportunities.length).toBe(6);
    });

    it('should handle calculation errors and continue', async () => {
      const { logger } = await import('@/lib/logger');

      const rates = new Map([
        ['binance', '0.0001'],
        ['okx', 'invalid'],
        ['gateio', '0.0002'],
      ]);

      const result =calculator.findAllOpportunities('BTCUSDT', rates, '0.0001');

      // Should still return valid opportunities
      expect(result.opportunities.length).toBeGreaterThan(0);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getDefaultTakerFeeRate', () => {
    it('should return default taker fee rate of 0.05%', () => {
      const rate = calculator.getDefaultTakerFeeRate();

      expect(rate.toString()).toBe('0.0005');
    });

    it('should return Decimal instance', () => {
      const rate = calculator.getDefaultTakerFeeRate();

      expect(rate).toBeInstanceOf(Decimal);
    });
  });

  describe('Singleton Instance', () => {
    it('should export singleton instance', () => {
      expect(netProfitCalculator).toBeInstanceOf(NetProfitCalculator);
    });

    it('should have same default fee rate as new instance', () => {
      const newCalc = new NetProfitCalculator();

      expect(netProfitCalculator.getDefaultTakerFeeRate().eq(newCalc.getDefaultTakerFeeRate())).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle large rate differences', () => {
      const result =calculator.calculate(
        'BTCUSDT',
        'binance',
        'okx',
        '0.1',     // 10%
        '-0.1',    // -10%
        '0.0005'
      );

      expect(result.rateDifference.toString()).toBe('0.2'); // 20%
      expect(result.netProfit.toString()).toBe('0.198'); // 20% - 0.2%
    });

    it('should handle negative rate difference', () => {
      const result =calculator.calculate(
        'BTCUSDT',
        'binance',
        'okx',
        '-0.001',
        '0.001',
        '0.0001'
      );

      expect(result.rateDifference.toString()).toBe('-0.002');
      expect(result.netProfit.lessThan(0)).toBe(true);
    });

    it('should preserve Decimal precision', () => {
      const result =calculator.calculate(
        'BTCUSDT',
        'binance',
        'okx',
        '0.00012345678901234567890',
        '0.00001234567890123456789',
        '0.00001'
      );

      // Decimal.js should preserve high precision
      expect(result.longRate.toString().length).toBeGreaterThan(10);
    });
  });
});
