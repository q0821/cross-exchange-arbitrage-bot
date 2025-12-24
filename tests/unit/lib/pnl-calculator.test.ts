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
  });
});
