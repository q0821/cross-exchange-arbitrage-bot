/**
 * PnL Calculator Unit Tests
 *
 * Feature: 041-funding-rate-pnl-display (US2)
 * Verify fundingRatePnL is correctly included in totalPnL calculation
 */

import { describe, it, expect } from 'vitest';
import { Decimal } from 'decimal.js';
import {
  calculatePnL,
  calculateLongPnL,
  calculateShortPnL,
  calculatePriceDiffPnL,
  calculateMarginUsed,
  calculateROI,
  calculateHoldingDuration,
  formatHoldingDuration,
  estimatePnL,
  type PnLCalculationInput,
} from '@/lib/pnl-calculator';

describe('PnL Calculator', () => {
  // Common test fixtures
  const baseInput: PnLCalculationInput = {
    longEntryPrice: new Decimal(100),
    longExitPrice: new Decimal(102), // +2% gain
    longPositionSize: new Decimal(10),
    longFee: new Decimal(0.5),
    shortEntryPrice: new Decimal(100),
    shortExitPrice: new Decimal(102), // +2% loss for short
    shortPositionSize: new Decimal(10),
    shortFee: new Decimal(0.5),
    leverage: 10,
    openedAt: new Date('2024-01-01T00:00:00Z'),
    closedAt: new Date('2024-01-01T12:00:00Z'),
  };

  describe('calculatePnL', () => {
    // T020: calculatePnL should correctly calculate totalPnL including fundingRatePnL
    it('should correctly calculate totalPnL = priceDiffPnL + fundingRatePnL - totalFees', () => {
      // Arrange
      const input: PnLCalculationInput = {
        ...baseInput,
        fundingRatePnL: new Decimal(5), // Funding fee income
      };

      // Act
      const result = calculatePnL(input);

      // Assert
      // priceDiffPnL = (102-100)*10 + (100-102)*10 = 20 - 20 = 0
      expect(result.priceDiffPnL.toNumber()).toBe(0);
      // totalFees = 0.5 + 0.5 = 1
      expect(result.totalFees.toNumber()).toBe(1);
      // fundingRatePnL = 5
      expect(result.fundingRatePnL.toNumber()).toBe(5);
      // totalPnL = 0 + 5 - 1 = 4
      expect(result.totalPnL.toNumber()).toBe(4);
    });

    // T021: Positive fundingRatePnL should increase totalPnL
    it('should increase totalPnL when fundingRatePnL is positive', () => {
      // Arrange
      const inputWithoutFunding: PnLCalculationInput = { ...baseInput };
      const inputWithPositiveFunding: PnLCalculationInput = {
        ...baseInput,
        fundingRatePnL: new Decimal(10), // +10 USDT funding income
      };

      // Act
      const resultWithoutFunding = calculatePnL(inputWithoutFunding);
      const resultWithPositiveFunding = calculatePnL(inputWithPositiveFunding);

      // Assert
      expect(resultWithPositiveFunding.totalPnL.toNumber()).toBe(
        resultWithoutFunding.totalPnL.toNumber() + 10,
      );
    });

    // T022: Negative fundingRatePnL should decrease totalPnL
    it('should decrease totalPnL when fundingRatePnL is negative', () => {
      // Arrange
      const inputWithoutFunding: PnLCalculationInput = { ...baseInput };
      const inputWithNegativeFunding: PnLCalculationInput = {
        ...baseInput,
        fundingRatePnL: new Decimal(-8), // -8 USDT funding cost
      };

      // Act
      const resultWithoutFunding = calculatePnL(inputWithoutFunding);
      const resultWithNegativeFunding = calculatePnL(inputWithNegativeFunding);

      // Assert
      expect(resultWithNegativeFunding.totalPnL.toNumber()).toBe(
        resultWithoutFunding.totalPnL.toNumber() - 8,
      );
    });

    it('should default fundingRatePnL to 0 when not provided', () => {
      // Arrange
      const input: PnLCalculationInput = { ...baseInput };

      // Act
      const result = calculatePnL(input);

      // Assert
      expect(result.fundingRatePnL.toNumber()).toBe(0);
    });

    it('should correctly return fundingRatePnL in the result', () => {
      // Arrange
      const input: PnLCalculationInput = {
        ...baseInput,
        fundingRatePnL: new Decimal(3.14159),
      };

      // Act
      const result = calculatePnL(input);

      // Assert
      expect(result.fundingRatePnL.toNumber()).toBe(3.14159);
    });
  });

  describe('calculateLongPnL', () => {
    it('should calculate positive PnL when price goes up', () => {
      const pnl = calculateLongPnL(
        new Decimal(100),
        new Decimal(110),
        new Decimal(5),
      );
      // (110 - 100) * 5 = 50
      expect(pnl.toNumber()).toBe(50);
    });

    it('should calculate negative PnL when price goes down', () => {
      const pnl = calculateLongPnL(
        new Decimal(100),
        new Decimal(90),
        new Decimal(5),
      );
      // (90 - 100) * 5 = -50
      expect(pnl.toNumber()).toBe(-50);
    });
  });

  describe('calculateShortPnL', () => {
    it('should calculate positive PnL when price goes down', () => {
      const pnl = calculateShortPnL(
        new Decimal(100),
        new Decimal(90),
        new Decimal(5),
      );
      // (100 - 90) * 5 = 50
      expect(pnl.toNumber()).toBe(50);
    });

    it('should calculate negative PnL when price goes up', () => {
      const pnl = calculateShortPnL(
        new Decimal(100),
        new Decimal(110),
        new Decimal(5),
      );
      // (100 - 110) * 5 = -50
      expect(pnl.toNumber()).toBe(-50);
    });
  });

  describe('calculatePriceDiffPnL', () => {
    it('should calculate combined Long and Short PnL', () => {
      const pnl = calculatePriceDiffPnL(
        new Decimal(100), // long entry
        new Decimal(105), // long exit (+5%)
        new Decimal(10), // long size
        new Decimal(100), // short entry
        new Decimal(98), // short exit (-2%)
        new Decimal(10), // short size
      );
      // Long: (105-100)*10 = 50
      // Short: (100-98)*10 = 20
      // Total: 70
      expect(pnl.toNumber()).toBe(70);
    });

    it('should handle hedged position with minimal price impact', () => {
      const pnl = calculatePriceDiffPnL(
        new Decimal(100), // long entry
        new Decimal(102), // long exit
        new Decimal(10), // long size
        new Decimal(100), // short entry
        new Decimal(102), // short exit (same price move)
        new Decimal(10), // short size
      );
      // Long: (102-100)*10 = 20
      // Short: (100-102)*10 = -20
      // Total: 0 (hedged)
      expect(pnl.toNumber()).toBe(0);
    });
  });

  describe('calculateMarginUsed', () => {
    it('should calculate total margin for both positions', () => {
      const margin = calculateMarginUsed(
        new Decimal(100), // long entry price
        new Decimal(10), // long size
        new Decimal(100), // short entry price
        new Decimal(10), // short size
        10, // leverage
      );
      // Long margin: 100 * 10 / 10 = 100
      // Short margin: 100 * 10 / 10 = 100
      // Total: 200
      expect(margin.toNumber()).toBe(200);
    });

    it('should scale margin inversely with leverage', () => {
      const marginLow = calculateMarginUsed(
        new Decimal(1000),
        new Decimal(1),
        new Decimal(1000),
        new Decimal(1),
        5,
      );
      const marginHigh = calculateMarginUsed(
        new Decimal(1000),
        new Decimal(1),
        new Decimal(1000),
        new Decimal(1),
        20,
      );
      // 5x leverage: 1000*1/5 + 1000*1/5 = 400
      expect(marginLow.toNumber()).toBe(400);
      // 20x leverage: 1000*1/20 + 1000*1/20 = 100
      expect(marginHigh.toNumber()).toBe(100);
    });

    it('should handle different position sizes', () => {
      const margin = calculateMarginUsed(
        new Decimal(50000), // BTC price
        new Decimal(0.1), // 0.1 BTC
        new Decimal(50000),
        new Decimal(0.1),
        10,
      );
      // Long margin: 50000 * 0.1 / 10 = 500
      // Short margin: 50000 * 0.1 / 10 = 500
      // Total: 1000
      expect(margin.toNumber()).toBe(1000);
    });
  });

  describe('calculateROI', () => {
    it('should calculate positive ROI', () => {
      const roi = calculateROI(new Decimal(50), new Decimal(1000));
      // 50 / 1000 * 100 = 5%
      expect(roi.toNumber()).toBe(5);
    });

    it('should calculate negative ROI', () => {
      const roi = calculateROI(new Decimal(-30), new Decimal(1000));
      // -30 / 1000 * 100 = -3%
      expect(roi.toNumber()).toBe(-3);
    });

    it('should return 0 when margin is zero', () => {
      const roi = calculateROI(new Decimal(100), new Decimal(0));
      expect(roi.toNumber()).toBe(0);
    });

    it('should handle large ROI values', () => {
      const roi = calculateROI(new Decimal(500), new Decimal(100));
      // 500 / 100 * 100 = 500%
      expect(roi.toNumber()).toBe(500);
    });
  });

  describe('calculateHoldingDuration', () => {
    it('should calculate duration in seconds', () => {
      const openedAt = new Date('2024-01-01T00:00:00Z');
      const closedAt = new Date('2024-01-01T01:00:00Z');

      const duration = calculateHoldingDuration(openedAt, closedAt);

      expect(duration).toBe(3600); // 1 hour
    });

    it('should handle multi-day duration', () => {
      const openedAt = new Date('2024-01-01T00:00:00Z');
      const closedAt = new Date('2024-01-03T12:00:00Z');

      const duration = calculateHoldingDuration(openedAt, closedAt);

      // 2.5 days = 2.5 * 24 * 3600 = 216000
      expect(duration).toBe(216000);
    });

    it('should handle very short duration', () => {
      const openedAt = new Date('2024-01-01T00:00:00.000Z');
      const closedAt = new Date('2024-01-01T00:00:30.000Z');

      const duration = calculateHoldingDuration(openedAt, closedAt);

      expect(duration).toBe(30);
    });
  });

  describe('formatHoldingDuration', () => {
    it('should format days, hours, minutes', () => {
      // 1 day, 2 hours, 30 minutes = 95400 seconds
      const duration = 86400 + 7200 + 1800;
      expect(formatHoldingDuration(duration)).toBe('1 天 2 小時 30 分');
    });

    it('should format hours and minutes only', () => {
      // 5 hours, 45 minutes = 20700 seconds
      const duration = 18000 + 2700;
      expect(formatHoldingDuration(duration)).toBe('5 小時 45 分');
    });

    it('should format minutes only', () => {
      const duration = 600; // 10 minutes
      expect(formatHoldingDuration(duration)).toBe('10 分');
    });

    it('should handle less than 1 minute', () => {
      expect(formatHoldingDuration(30)).toBe('少於 1 分鐘');
      expect(formatHoldingDuration(0)).toBe('少於 1 分鐘');
    });

    it('should handle days only', () => {
      const duration = 172800; // 2 days exactly
      expect(formatHoldingDuration(duration)).toBe('2 天');
    });
  });

  describe('estimatePnL', () => {
    it('should estimate PnL for hedged position', () => {
      const result = estimatePnL(
        100, // long entry
        102, // long current (+2%)
        10, // long size
        100, // short entry
        102, // short current (+2%)
        10, // short size
      );

      // Price diff: (102-100)*10 + (100-102)*10 = 20 - 20 = 0
      expect(result.priceDiffPnL).toBe(0);
      // Fees: (102*10*0.0005) + (102*10*0.0005) = 1.02
      expect(result.estimatedFees).toBeCloseTo(1.02, 2);
      // Net: 0 - 1.02 = -1.02
      expect(result.netPnL).toBeCloseTo(-1.02, 2);
    });

    it('should estimate positive PnL for profitable arbitrage', () => {
      const result = estimatePnL(
        100, // long entry
        105, // long current (+5%)
        10, // long size
        100, // short entry
        98, // short current (-2%)
        10, // short size
      );

      // Price diff: (105-100)*10 + (100-98)*10 = 50 + 20 = 70
      expect(result.priceDiffPnL).toBe(70);
      expect(result.netPnL).toBeGreaterThan(0);
    });

    it('should use custom fee rate', () => {
      const result = estimatePnL(100, 100, 10, 100, 100, 10, 0.001); // 0.1% fee

      // Fees: 100*10*0.001 + 100*10*0.001 = 2
      expect(result.estimatedFees).toBe(2);
    });
  });

  describe('Full PnL calculation integration', () => {
    it('should correctly calculate all components for profitable trade', () => {
      const input: PnLCalculationInput = {
        longEntryPrice: new Decimal(50000),
        longExitPrice: new Decimal(50500),
        longPositionSize: new Decimal(0.1),
        longFee: new Decimal(2.5),
        shortEntryPrice: new Decimal(50000),
        shortExitPrice: new Decimal(49800),
        shortPositionSize: new Decimal(0.1),
        shortFee: new Decimal(2.5),
        leverage: 10,
        openedAt: new Date('2024-01-01T00:00:00Z'),
        closedAt: new Date('2024-01-01T08:00:00Z'),
        fundingRatePnL: new Decimal(10),
      };

      const result = calculatePnL(input);

      // Long PnL: (50500-50000)*0.1 = 50
      // Short PnL: (50000-49800)*0.1 = 20
      // Price diff: 70
      expect(result.priceDiffPnL.toNumber()).toBe(70);

      // Total fees: 2.5 + 2.5 = 5
      expect(result.totalFees.toNumber()).toBe(5);

      // Funding: 10
      expect(result.fundingRatePnL.toNumber()).toBe(10);

      // Total PnL: 70 + 10 - 5 = 75
      expect(result.totalPnL.toNumber()).toBe(75);

      // Margin: (50000*0.1/10) + (50000*0.1/10) = 1000
      expect(result.marginUsed.toNumber()).toBe(1000);

      // ROI: 75/1000*100 = 7.5%
      expect(result.roi.toNumber()).toBe(7.5);

      // Duration: 8 hours = 28800 seconds
      expect(result.holdingDuration).toBe(28800);
    });

    it('should handle losing trade correctly', () => {
      const input: PnLCalculationInput = {
        longEntryPrice: new Decimal(100),
        longExitPrice: new Decimal(95), // -5%
        longPositionSize: new Decimal(10),
        longFee: new Decimal(0.5),
        shortEntryPrice: new Decimal(100),
        shortExitPrice: new Decimal(105), // +5% (loss for short)
        shortPositionSize: new Decimal(10),
        shortFee: new Decimal(0.5),
        leverage: 5,
        openedAt: new Date('2024-01-01T00:00:00Z'),
        closedAt: new Date('2024-01-01T04:00:00Z'),
        fundingRatePnL: new Decimal(-5),
      };

      const result = calculatePnL(input);

      // Long PnL: (95-100)*10 = -50
      // Short PnL: (100-105)*10 = -50
      // Price diff: -100
      expect(result.priceDiffPnL.toNumber()).toBe(-100);

      // Total PnL: -100 + (-5) - 1 = -106
      expect(result.totalPnL.toNumber()).toBe(-106);

      // ROI should be negative
      expect(result.roi.toNumber()).toBeLessThan(0);
    });
  });
});
