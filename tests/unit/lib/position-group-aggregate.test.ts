/**
 * Unit tests for position group aggregate calculation accuracy
 * Feature 069: 分單持倉合併顯示與批量平倉
 * Task: T035 [US4]
 */

import { describe, it, expect } from 'vitest';
import { Decimal } from 'decimal.js';
import {
  calculatePositionGroupAggregate,
  type PositionForGroup,
} from '@/lib/position-group';

/**
 * Helper to create a mock position for testing
 */
function createMockPosition(
  overrides: Partial<PositionForGroup> = {}
): PositionForGroup {
  return {
    id: overrides.id || `pos-${Math.random().toString(36).slice(2)}`,
    userId: overrides.userId || 'test-user',
    symbol: overrides.symbol || 'BTCUSDT',
    longExchange: overrides.longExchange || 'binance',
    shortExchange: overrides.shortExchange || 'okx',
    longEntryPrice: overrides.longEntryPrice || new Decimal('50000'),
    shortEntryPrice: overrides.shortEntryPrice || new Decimal('50100'),
    longPositionSize: overrides.longPositionSize || new Decimal('0.1'),
    shortPositionSize: overrides.shortPositionSize || new Decimal('0.1'),
    longLeverage: overrides.longLeverage || 10,
    shortLeverage: overrides.shortLeverage || 10,
    status: (overrides.status as any) || 'OPEN',
    createdAt: overrides.createdAt || new Date(),
    updatedAt: overrides.updatedAt || new Date(),
    groupId: overrides.groupId || 'group-1',
    openedAt: overrides.openedAt || new Date(),
    cachedFundingPnL: overrides.cachedFundingPnL || null,
    unrealizedPnL: overrides.unrealizedPnL || null,
    stopLossEnabled: overrides.stopLossEnabled ?? false,
    stopLossPercent: overrides.stopLossPercent || null,
    takeProfitEnabled: overrides.takeProfitEnabled ?? false,
    takeProfitPercent: overrides.takeProfitPercent || null,
  };
}

describe('Position Group Aggregate Calculation [US4]', () => {
  describe('Total Quantity Calculation', () => {
    it('should correctly sum quantities from multiple positions', () => {
      const positions: PositionForGroup[] = [
        createMockPosition({ longPositionSize: new Decimal('0.1') }),
        createMockPosition({ longPositionSize: new Decimal('0.2') }),
        createMockPosition({ longPositionSize: new Decimal('0.3') }),
      ];

      const aggregate = calculatePositionGroupAggregate(positions);

      expect(aggregate.totalQuantity.toString()).toBe('0.6');
    });

    it('should handle small quantities with high precision', () => {
      const positions: PositionForGroup[] = [
        createMockPosition({ longPositionSize: new Decimal('0.00001') }),
        createMockPosition({ longPositionSize: new Decimal('0.00002') }),
        createMockPosition({ longPositionSize: new Decimal('0.00003') }),
      ];

      const aggregate = calculatePositionGroupAggregate(positions);

      expect(aggregate.totalQuantity.toString()).toBe('0.00006');
    });

    it('should handle large quantities', () => {
      const positions: PositionForGroup[] = [
        createMockPosition({ longPositionSize: new Decimal('1000') }),
        createMockPosition({ longPositionSize: new Decimal('2000') }),
        createMockPosition({ longPositionSize: new Decimal('3000') }),
      ];

      const aggregate = calculatePositionGroupAggregate(positions);

      expect(aggregate.totalQuantity.toString()).toBe('6000');
    });
  });

  describe('Average Entry Price Calculation', () => {
    it('should calculate weighted average long entry price', () => {
      // Position 1: 0.1 @ 50000 = 5000 value
      // Position 2: 0.2 @ 51000 = 10200 value
      // Total: 0.3 with 15200 value = avg 50666.66...
      const positions: PositionForGroup[] = [
        createMockPosition({
          longPositionSize: new Decimal('0.1'),
          longEntryPrice: new Decimal('50000'),
        }),
        createMockPosition({
          longPositionSize: new Decimal('0.2'),
          longEntryPrice: new Decimal('51000'),
        }),
      ];

      const aggregate = calculatePositionGroupAggregate(positions);
      const avgPrice = aggregate.avgLongEntryPrice.toNumber();

      // Expected: (0.1*50000 + 0.2*51000) / 0.3 = 15200 / 0.3 = 50666.666...
      expect(avgPrice).toBeCloseTo(50666.67, 1);
    });

    it('should calculate weighted average short entry price', () => {
      const positions: PositionForGroup[] = [
        createMockPosition({
          shortPositionSize: new Decimal('0.1'),
          shortEntryPrice: new Decimal('50100'),
        }),
        createMockPosition({
          shortPositionSize: new Decimal('0.2'),
          shortEntryPrice: new Decimal('50200'),
        }),
      ];

      const aggregate = calculatePositionGroupAggregate(positions);
      const avgPrice = aggregate.avgShortEntryPrice.toNumber();

      // Expected: (0.1*50100 + 0.2*50200) / 0.3 = 15050 / 0.3 = 50166.666...
      expect(avgPrice).toBeCloseTo(50166.67, 1);
    });

    it('should handle equal sizes with simple average', () => {
      const positions: PositionForGroup[] = [
        createMockPosition({
          longPositionSize: new Decimal('0.1'),
          longEntryPrice: new Decimal('50000'),
        }),
        createMockPosition({
          longPositionSize: new Decimal('0.1'),
          longEntryPrice: new Decimal('52000'),
        }),
      ];

      const aggregate = calculatePositionGroupAggregate(positions);
      const avgPrice = aggregate.avgLongEntryPrice.toNumber();

      // Simple average: (50000 + 52000) / 2 = 51000
      expect(avgPrice).toBe(51000);
    });

    it('should maintain precision within 0.01% error margin', () => {
      // Create positions with precise prices
      const positions: PositionForGroup[] = [
        createMockPosition({
          longPositionSize: new Decimal('0.12345'),
          longEntryPrice: new Decimal('49876.54321'),
        }),
        createMockPosition({
          longPositionSize: new Decimal('0.23456'),
          longEntryPrice: new Decimal('50123.45678'),
        }),
        createMockPosition({
          longPositionSize: new Decimal('0.34567'),
          longEntryPrice: new Decimal('50234.56789'),
        }),
      ];

      const aggregate = calculatePositionGroupAggregate(positions);
      const avgPrice = aggregate.avgLongEntryPrice.toNumber();

      // Calculate expected manually
      const totalValue = positions.reduce((sum, p) => {
        return sum.plus(p.longPositionSize.times(p.longEntryPrice));
      }, new Decimal(0));
      const totalSize = positions.reduce((sum, p) => {
        return sum.plus(p.longPositionSize);
      }, new Decimal(0));
      const expectedAvg = totalValue.div(totalSize).toNumber();

      // Error should be < 0.01%
      const errorPercent = Math.abs((avgPrice - expectedAvg) / expectedAvg) * 100;
      expect(errorPercent).toBeLessThan(0.01);
    });
  });

  describe('Total Funding PnL Calculation', () => {
    it('should correctly sum funding PnL from all positions', () => {
      const positions: PositionForGroup[] = [
        createMockPosition({ cachedFundingPnL: new Decimal('10.5') }),
        createMockPosition({ cachedFundingPnL: new Decimal('20.3') }),
        createMockPosition({ cachedFundingPnL: new Decimal('-5.2') }),
      ];

      const aggregate = calculatePositionGroupAggregate(positions);
      const totalPnL = aggregate.totalFundingPnL!.toNumber();

      // 10.5 + 20.3 - 5.2 = 25.6
      expect(totalPnL).toBeCloseTo(25.6, 2);
    });

    it('should return null when no positions have funding PnL', () => {
      const positions: PositionForGroup[] = [
        createMockPosition({ cachedFundingPnL: null }),
        createMockPosition({ cachedFundingPnL: null }),
      ];

      const aggregate = calculatePositionGroupAggregate(positions);

      expect(aggregate.totalFundingPnL).toBeNull();
    });

    it('should handle mixed null and non-null funding PnL', () => {
      const positions: PositionForGroup[] = [
        createMockPosition({ cachedFundingPnL: new Decimal('10') }),
        createMockPosition({ cachedFundingPnL: null }),
        createMockPosition({ cachedFundingPnL: new Decimal('5') }),
      ];

      const aggregate = calculatePositionGroupAggregate(positions);
      const totalPnL = aggregate.totalFundingPnL!.toNumber();

      // 10 + 5 = 15 (null is ignored)
      expect(totalPnL).toBe(15);
    });
  });

  describe('Total Unrealized PnL Calculation', () => {
    it('should correctly sum unrealized PnL from all positions', () => {
      const positions: PositionForGroup[] = [
        createMockPosition({ unrealizedPnL: new Decimal('100') }),
        createMockPosition({ unrealizedPnL: new Decimal('-50') }),
        createMockPosition({ unrealizedPnL: new Decimal('75') }),
      ];

      const aggregate = calculatePositionGroupAggregate(positions);
      const totalPnL = aggregate.totalUnrealizedPnL!.toNumber();

      // 100 - 50 + 75 = 125
      expect(totalPnL).toBe(125);
    });

    it('should return null when no positions have unrealized PnL', () => {
      const positions: PositionForGroup[] = [
        createMockPosition({ unrealizedPnL: null }),
        createMockPosition({ unrealizedPnL: null }),
      ];

      const aggregate = calculatePositionGroupAggregate(positions);

      expect(aggregate.totalUnrealizedPnL).toBeNull();
    });
  });

  describe('Position Count', () => {
    it('should correctly count positions', () => {
      const positions: PositionForGroup[] = [
        createMockPosition({}),
        createMockPosition({}),
        createMockPosition({}),
      ];

      const aggregate = calculatePositionGroupAggregate(positions);

      expect(aggregate.positionCount).toBe(3);
    });

    it('should handle single position', () => {
      const positions: PositionForGroup[] = [createMockPosition({})];

      const aggregate = calculatePositionGroupAggregate(positions);

      expect(aggregate.positionCount).toBe(1);
    });
  });

  describe('First Opened At', () => {
    it('should return earliest openedAt date', () => {
      const now = new Date();
      const earlier = new Date(now.getTime() - 3600000); // 1 hour ago
      const earliest = new Date(now.getTime() - 7200000); // 2 hours ago

      const positions: PositionForGroup[] = [
        createMockPosition({ openedAt: now }),
        createMockPosition({ openedAt: earlier }),
        createMockPosition({ openedAt: earliest }),
      ];

      const aggregate = calculatePositionGroupAggregate(positions);

      expect(aggregate.firstOpenedAt).toEqual(earliest);
    });

    it('should handle null openedAt dates', () => {
      const now = new Date();
      const positions: PositionForGroup[] = [
        createMockPosition({ openedAt: null }),
        createMockPosition({ openedAt: now }),
        createMockPosition({ openedAt: null }),
      ];

      const aggregate = calculatePositionGroupAggregate(positions);

      expect(aggregate.firstOpenedAt).toEqual(now);
    });
  });

  describe('Stop Loss and Take Profit Settings', () => {
    it('should return stop loss when all positions have same setting', () => {
      const positions: PositionForGroup[] = [
        createMockPosition({
          stopLossEnabled: true,
          stopLossPercent: new Decimal('2.5'),
        }),
        createMockPosition({
          stopLossEnabled: true,
          stopLossPercent: new Decimal('2.5'),
        }),
      ];

      const aggregate = calculatePositionGroupAggregate(positions);

      expect(aggregate.stopLossPercent?.toString()).toBe('2.5');
    });

    it('should return null when positions have different stop loss', () => {
      const positions: PositionForGroup[] = [
        createMockPosition({
          stopLossEnabled: true,
          stopLossPercent: new Decimal('2.5'),
        }),
        createMockPosition({
          stopLossEnabled: true,
          stopLossPercent: new Decimal('3.0'),
        }),
      ];

      const aggregate = calculatePositionGroupAggregate(positions);

      expect(aggregate.stopLossPercent).toBeNull();
    });

    it('should return take profit when all positions have same setting', () => {
      const positions: PositionForGroup[] = [
        createMockPosition({
          takeProfitEnabled: true,
          takeProfitPercent: new Decimal('5.0'),
        }),
        createMockPosition({
          takeProfitEnabled: true,
          takeProfitPercent: new Decimal('5.0'),
        }),
      ];

      const aggregate = calculatePositionGroupAggregate(positions);

      expect(aggregate.takeProfitPercent?.toString()).toBe('5');
    });

    it('should return null for disabled stop loss', () => {
      const positions: PositionForGroup[] = [
        createMockPosition({
          stopLossEnabled: false,
          stopLossPercent: null,
        }),
      ];

      const aggregate = calculatePositionGroupAggregate(positions);

      expect(aggregate.stopLossPercent).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty position array', () => {
      const positions: PositionForGroup[] = [];

      const aggregate = calculatePositionGroupAggregate(positions);

      expect(aggregate.positionCount).toBe(0);
      expect(aggregate.totalQuantity.toString()).toBe('0');
      expect(aggregate.avgLongEntryPrice.toString()).toBe('0');
      expect(aggregate.avgShortEntryPrice.toString()).toBe('0');
    });

    it('should handle positions with zero quantity', () => {
      const positions: PositionForGroup[] = [
        createMockPosition({ longPositionSize: new Decimal('0') }),
        createMockPosition({ longPositionSize: new Decimal('0.1') }),
      ];

      const aggregate = calculatePositionGroupAggregate(positions);

      expect(aggregate.totalQuantity.toString()).toBe('0.1');
    });

    it('should handle very large position values', () => {
      const positions: PositionForGroup[] = [
        createMockPosition({
          longPositionSize: new Decimal('1000000'),
          longEntryPrice: new Decimal('100000'),
        }),
        createMockPosition({
          longPositionSize: new Decimal('2000000'),
          longEntryPrice: new Decimal('100000'),
        }),
      ];

      const aggregate = calculatePositionGroupAggregate(positions);

      expect(aggregate.totalQuantity.toString()).toBe('3000000');
      expect(aggregate.avgLongEntryPrice.toNumber()).toBe(100000);
    });
  });
});
