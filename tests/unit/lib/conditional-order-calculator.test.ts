/**
 * Conditional Order Calculator Unit Tests
 *
 * Tests for stop-loss and take-profit trigger price calculations
 * Feature: 038-specify-scripts-bash
 */

import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  calculateStopLossPrice,
  calculateTakeProfitPrice,
  calculateTriggerPrices,
  formatPriceForExchange,
  isStopLossPriceValid,
  isTakeProfitPriceValid,
  type TriggerPriceParams,
} from '@/lib/conditional-order-calculator';

describe('Conditional Order Calculator', () => {
  describe('calculateStopLossPrice', () => {
    describe('LONG position', () => {
      it('should calculate stop loss price below entry for long position', () => {
        const entryPrice = new Decimal(100);
        const stopLossPercent = 5; // 5%

        const result = calculateStopLossPrice(entryPrice, stopLossPercent, 'LONG');

        // 100 * (1 - 0.05) = 95
        expect(result.toNumber()).toBe(95);
      });

      it('should handle small stop loss percentage', () => {
        const entryPrice = new Decimal(50000);
        const stopLossPercent = 0.5; // 0.5%

        const result = calculateStopLossPrice(entryPrice, stopLossPercent, 'LONG');

        // 50000 * (1 - 0.005) = 49750
        expect(result.toNumber()).toBe(49750);
      });

      it('should handle large stop loss percentage', () => {
        const entryPrice = new Decimal(100);
        const stopLossPercent = 50; // 50%

        const result = calculateStopLossPrice(entryPrice, stopLossPercent, 'LONG');

        // 100 * (1 - 0.5) = 50
        expect(result.toNumber()).toBe(50);
      });

      it('should handle decimal entry price', () => {
        const entryPrice = new Decimal('0.00012345');
        const stopLossPercent = 10;

        const result = calculateStopLossPrice(entryPrice, stopLossPercent, 'LONG');

        // 0.00012345 * 0.9 = 0.000111105
        expect(result.toNumber()).toBeCloseTo(0.000111105, 9);
      });
    });

    describe('SHORT position', () => {
      it('should calculate stop loss price above entry for short position', () => {
        const entryPrice = new Decimal(100);
        const stopLossPercent = 5; // 5%

        const result = calculateStopLossPrice(entryPrice, stopLossPercent, 'SHORT');

        // 100 * (1 + 0.05) = 105
        expect(result.toNumber()).toBe(105);
      });

      it('should handle small stop loss percentage', () => {
        const entryPrice = new Decimal(50000);
        const stopLossPercent = 0.5; // 0.5%

        const result = calculateStopLossPrice(entryPrice, stopLossPercent, 'SHORT');

        // 50000 * (1 + 0.005) = 50250
        expect(result.toNumber()).toBe(50250);
      });

      it('should handle large stop loss percentage', () => {
        const entryPrice = new Decimal(100);
        const stopLossPercent = 50; // 50%

        const result = calculateStopLossPrice(entryPrice, stopLossPercent, 'SHORT');

        // 100 * (1 + 0.5) = 150
        expect(result.toNumber()).toBe(150);
      });
    });
  });

  describe('calculateTakeProfitPrice', () => {
    describe('LONG position', () => {
      it('should calculate take profit price above entry for long position', () => {
        const entryPrice = new Decimal(100);
        const takeProfitPercent = 10; // 10%

        const result = calculateTakeProfitPrice(entryPrice, takeProfitPercent, 'LONG');

        // 100 * (1 + 0.1) = 110
        expect(result.toNumber()).toBe(110);
      });

      it('should handle small take profit percentage', () => {
        const entryPrice = new Decimal(50000);
        const takeProfitPercent = 0.5; // 0.5%

        const result = calculateTakeProfitPrice(entryPrice, takeProfitPercent, 'LONG');

        // 50000 * (1 + 0.005) = 50250
        expect(result.toNumber()).toBe(50250);
      });

      it('should handle large take profit percentage', () => {
        const entryPrice = new Decimal(100);
        const takeProfitPercent = 100; // 100%

        const result = calculateTakeProfitPrice(entryPrice, takeProfitPercent, 'LONG');

        // 100 * (1 + 1) = 200
        expect(result.toNumber()).toBe(200);
      });
    });

    describe('SHORT position', () => {
      it('should calculate take profit price below entry for short position', () => {
        const entryPrice = new Decimal(100);
        const takeProfitPercent = 10; // 10%

        const result = calculateTakeProfitPrice(entryPrice, takeProfitPercent, 'SHORT');

        // 100 * (1 - 0.1) = 90
        expect(result.toNumber()).toBe(90);
      });

      it('should handle small take profit percentage', () => {
        const entryPrice = new Decimal(50000);
        const takeProfitPercent = 0.5; // 0.5%

        const result = calculateTakeProfitPrice(entryPrice, takeProfitPercent, 'SHORT');

        // 50000 * (1 - 0.005) = 49750
        expect(result.toNumber()).toBe(49750);
      });

      it('should handle large take profit percentage', () => {
        const entryPrice = new Decimal(100);
        const takeProfitPercent = 50; // 50%

        const result = calculateTakeProfitPrice(entryPrice, takeProfitPercent, 'SHORT');

        // 100 * (1 - 0.5) = 50
        expect(result.toNumber()).toBe(50);
      });
    });
  });

  describe('calculateTriggerPrices', () => {
    it('should calculate both stop loss and take profit when both provided', () => {
      const params: TriggerPriceParams = {
        entryPrice: new Decimal(100),
        side: 'LONG',
        stopLossPercent: 5,
        takeProfitPercent: 10,
      };

      const result = calculateTriggerPrices(params);

      expect(result.stopLossPrice?.toNumber()).toBe(95);
      expect(result.takeProfitPrice?.toNumber()).toBe(110);
    });

    it('should calculate only stop loss when take profit not provided', () => {
      const params: TriggerPriceParams = {
        entryPrice: new Decimal(100),
        side: 'LONG',
        stopLossPercent: 5,
      };

      const result = calculateTriggerPrices(params);

      expect(result.stopLossPrice?.toNumber()).toBe(95);
      expect(result.takeProfitPrice).toBeUndefined();
    });

    it('should calculate only take profit when stop loss not provided', () => {
      const params: TriggerPriceParams = {
        entryPrice: new Decimal(100),
        side: 'LONG',
        takeProfitPercent: 10,
      };

      const result = calculateTriggerPrices(params);

      expect(result.stopLossPrice).toBeUndefined();
      expect(result.takeProfitPrice?.toNumber()).toBe(110);
    });

    it('should return empty result when neither stop loss nor take profit provided', () => {
      const params: TriggerPriceParams = {
        entryPrice: new Decimal(100),
        side: 'LONG',
      };

      const result = calculateTriggerPrices(params);

      expect(result.stopLossPrice).toBeUndefined();
      expect(result.takeProfitPrice).toBeUndefined();
    });

    it('should calculate correctly for SHORT position', () => {
      const params: TriggerPriceParams = {
        entryPrice: new Decimal(100),
        side: 'SHORT',
        stopLossPercent: 5,
        takeProfitPercent: 10,
      };

      const result = calculateTriggerPrices(params);

      // Short: SL above entry, TP below entry
      expect(result.stopLossPrice?.toNumber()).toBe(105);
      expect(result.takeProfitPrice?.toNumber()).toBe(90);
    });
  });

  describe('formatPriceForExchange', () => {
    it('should format price with default 8 decimal precision', () => {
      const price = new Decimal('123.456789012345');

      const result = formatPriceForExchange(price);

      expect(result).toBe('123.45678901');
    });

    it('should format price with custom precision', () => {
      const price = new Decimal('123.456789');

      expect(formatPriceForExchange(price, 2)).toBe('123.46');
      expect(formatPriceForExchange(price, 4)).toBe('123.4568');
      expect(formatPriceForExchange(price, 0)).toBe('123');
    });

    it('should round half up', () => {
      const price = new Decimal('123.455');

      expect(formatPriceForExchange(price, 2)).toBe('123.46');
    });

    it('should handle very small prices', () => {
      const price = new Decimal('0.000012345678');

      // Decimal.js may output in scientific notation for very small numbers
      // Testing with a slightly larger number that stays in decimal format
      expect(formatPriceForExchange(price, 8)).toBe('0.00001235');
    });

    it('should handle whole numbers', () => {
      const price = new Decimal('50000');

      expect(formatPriceForExchange(price, 2)).toBe('50000');
    });
  });

  describe('isStopLossPriceValid', () => {
    describe('LONG position', () => {
      it('should return true when stop loss is sufficiently below current price', () => {
        const stopLossPrice = new Decimal(95);
        const currentPrice = new Decimal(100);

        const result = isStopLossPriceValid(stopLossPrice, currentPrice, 'LONG');

        expect(result).toBe(true);
      });

      it('should return false when stop loss is above current price', () => {
        const stopLossPrice = new Decimal(105);
        const currentPrice = new Decimal(100);

        const result = isStopLossPriceValid(stopLossPrice, currentPrice, 'LONG');

        expect(result).toBe(false);
      });

      it('should return false when stop loss is too close to current price', () => {
        const stopLossPrice = new Decimal(99.95);
        const currentPrice = new Decimal(100);

        // Default min distance is 0.1%, so 99.9 is the threshold
        const result = isStopLossPriceValid(stopLossPrice, currentPrice, 'LONG');

        expect(result).toBe(false);
      });

      it('should respect custom minimum distance', () => {
        const stopLossPrice = new Decimal(99);
        const currentPrice = new Decimal(100);

        // With 2% min distance, 98 is the threshold
        const result = isStopLossPriceValid(stopLossPrice, currentPrice, 'LONG', 2);

        expect(result).toBe(false);
      });
    });

    describe('SHORT position', () => {
      it('should return true when stop loss is sufficiently above current price', () => {
        const stopLossPrice = new Decimal(105);
        const currentPrice = new Decimal(100);

        const result = isStopLossPriceValid(stopLossPrice, currentPrice, 'SHORT');

        expect(result).toBe(true);
      });

      it('should return false when stop loss is below current price', () => {
        const stopLossPrice = new Decimal(95);
        const currentPrice = new Decimal(100);

        const result = isStopLossPriceValid(stopLossPrice, currentPrice, 'SHORT');

        expect(result).toBe(false);
      });

      it('should return false when stop loss is too close to current price', () => {
        const stopLossPrice = new Decimal(100.05);
        const currentPrice = new Decimal(100);

        const result = isStopLossPriceValid(stopLossPrice, currentPrice, 'SHORT');

        expect(result).toBe(false);
      });
    });
  });

  describe('isTakeProfitPriceValid', () => {
    describe('LONG position', () => {
      it('should return true when take profit is sufficiently above current price', () => {
        const takeProfitPrice = new Decimal(105);
        const currentPrice = new Decimal(100);

        const result = isTakeProfitPriceValid(takeProfitPrice, currentPrice, 'LONG');

        expect(result).toBe(true);
      });

      it('should return false when take profit is below current price', () => {
        const takeProfitPrice = new Decimal(95);
        const currentPrice = new Decimal(100);

        const result = isTakeProfitPriceValid(takeProfitPrice, currentPrice, 'LONG');

        expect(result).toBe(false);
      });

      it('should return false when take profit is too close to current price', () => {
        const takeProfitPrice = new Decimal(100.05);
        const currentPrice = new Decimal(100);

        const result = isTakeProfitPriceValid(takeProfitPrice, currentPrice, 'LONG');

        expect(result).toBe(false);
      });

      it('should respect custom minimum distance', () => {
        const takeProfitPrice = new Decimal(101);
        const currentPrice = new Decimal(100);

        // With 2% min distance, 102 is the threshold
        const result = isTakeProfitPriceValid(takeProfitPrice, currentPrice, 'LONG', 2);

        expect(result).toBe(false);
      });
    });

    describe('SHORT position', () => {
      it('should return true when take profit is sufficiently below current price', () => {
        const takeProfitPrice = new Decimal(95);
        const currentPrice = new Decimal(100);

        const result = isTakeProfitPriceValid(takeProfitPrice, currentPrice, 'SHORT');

        expect(result).toBe(true);
      });

      it('should return false when take profit is above current price', () => {
        const takeProfitPrice = new Decimal(105);
        const currentPrice = new Decimal(100);

        const result = isTakeProfitPriceValid(takeProfitPrice, currentPrice, 'SHORT');

        expect(result).toBe(false);
      });

      it('should return false when take profit is too close to current price', () => {
        const takeProfitPrice = new Decimal(99.95);
        const currentPrice = new Decimal(100);

        const result = isTakeProfitPriceValid(takeProfitPrice, currentPrice, 'SHORT');

        expect(result).toBe(false);
      });
    });
  });

  describe('Integration scenarios', () => {
    it('should handle BTC price scenario for LONG', () => {
      const entryPrice = new Decimal(95000);
      const stopLossPercent = 2;
      const takeProfitPercent = 5;

      const result = calculateTriggerPrices({
        entryPrice,
        side: 'LONG',
        stopLossPercent,
        takeProfitPercent,
      });

      // SL: 95000 * 0.98 = 93100
      expect(result.stopLossPrice?.toNumber()).toBe(93100);
      // TP: 95000 * 1.05 = 99750
      expect(result.takeProfitPrice?.toNumber()).toBe(99750);
    });

    it('should handle small altcoin price scenario', () => {
      const entryPrice = new Decimal('0.0001234');
      const stopLossPercent = 3;
      const takeProfitPercent = 8;

      const result = calculateTriggerPrices({
        entryPrice,
        side: 'SHORT',
        stopLossPercent,
        takeProfitPercent,
      });

      // SL: 0.0001234 * 1.03
      expect(result.stopLossPrice?.toNumber()).toBeCloseTo(0.00012710, 8);
      // TP: 0.0001234 * 0.92
      expect(result.takeProfitPrice?.toNumber()).toBeCloseTo(0.00011353, 8);
    });

    it('should validate calculated prices against market', () => {
      const entryPrice = new Decimal(100);
      const currentPrice = new Decimal(101); // Price moved up slightly

      const { stopLossPrice, takeProfitPrice } = calculateTriggerPrices({
        entryPrice,
        side: 'LONG',
        stopLossPercent: 5,
        takeProfitPercent: 10,
      });

      // SL at 95 should be valid (far below 101)
      expect(isStopLossPriceValid(stopLossPrice!, currentPrice, 'LONG')).toBe(true);

      // TP at 110 should be valid (above 101)
      expect(isTakeProfitPriceValid(takeProfitPrice!, currentPrice, 'LONG')).toBe(true);
    });
  });
});
