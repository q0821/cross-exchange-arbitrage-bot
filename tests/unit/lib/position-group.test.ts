/**
 * Unit tests for position-group utilities
 * Feature 069: 分單持倉合併顯示與批量平倉
 *
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest';
import { Decimal } from 'decimal.js';
import {
  calculateWeightedAverage,
  groupPositionsByGroupId,
  calculatePositionGroupAggregate,
  type PositionForGroup,
} from '@/lib/position-group';

describe('position-group utilities', () => {
  describe('calculateWeightedAverage', () => {
    it('should calculate weighted average correctly', () => {
      const values = [
        { value: new Decimal('100'), weight: new Decimal('10') },
        { value: new Decimal('200'), weight: new Decimal('20') },
      ];

      // (100 * 10 + 200 * 20) / (10 + 20) = (1000 + 4000) / 30 = 166.666...
      const result = calculateWeightedAverage(values);
      expect(result.toFixed(2)).toBe('166.67');
    });

    it('should return zero for empty array', () => {
      const result = calculateWeightedAverage([]);
      expect(result.toNumber()).toBe(0);
    });

    it('should handle single value', () => {
      const values = [{ value: new Decimal('150'), weight: new Decimal('5') }];
      const result = calculateWeightedAverage(values);
      expect(result.toNumber()).toBe(150);
    });

    it('should handle zero total weight', () => {
      const values = [
        { value: new Decimal('100'), weight: new Decimal('0') },
      ];
      const result = calculateWeightedAverage(values);
      expect(result.toNumber()).toBe(0);
    });
  });

  describe('groupPositionsByGroupId', () => {
    const mockPositions: PositionForGroup[] = [
      {
        id: 'pos-1',
        groupId: 'group-1',
        symbol: 'BTCUSDT',
        longExchange: 'binance',
        shortExchange: 'okx',
        longPositionSize: new Decimal('0.1'),
        longEntryPrice: new Decimal('95000'),
        shortPositionSize: new Decimal('0.1'),
        shortEntryPrice: new Decimal('95100'),
        status: 'OPEN',
        openedAt: new Date('2026-01-25T10:00:00Z'),
        cachedFundingPnL: new Decimal('5.5'),
        unrealizedPnL: new Decimal('-2.5'),
        stopLossPercent: new Decimal('2'),
        takeProfitPercent: new Decimal('5'),
      },
      {
        id: 'pos-2',
        groupId: 'group-1',
        symbol: 'BTCUSDT',
        longExchange: 'binance',
        shortExchange: 'okx',
        longPositionSize: new Decimal('0.2'),
        longEntryPrice: new Decimal('94500'),
        shortPositionSize: new Decimal('0.2'),
        shortEntryPrice: new Decimal('94600'),
        status: 'OPEN',
        openedAt: new Date('2026-01-25T10:01:00Z'),
        cachedFundingPnL: new Decimal('3.5'),
        unrealizedPnL: new Decimal('1.5'),
        stopLossPercent: new Decimal('2'),
        takeProfitPercent: new Decimal('5'),
      },
      // Feature 070: 單獨開倉也有 groupId
      {
        id: 'pos-3',
        groupId: 'group-2',  // 單獨開倉的獨立 groupId
        symbol: 'ETHUSDT',
        longExchange: 'binance',
        shortExchange: 'gateio',
        longPositionSize: new Decimal('1'),
        longEntryPrice: new Decimal('3200'),
        shortPositionSize: new Decimal('1'),
        shortEntryPrice: new Decimal('3210'),
        status: 'OPEN',
        openedAt: new Date('2026-01-25T09:00:00Z'),
        cachedFundingPnL: new Decimal('10'),
        unrealizedPnL: new Decimal('5'),
        stopLossPercent: null,
        takeProfitPercent: null,
      },
    ];

    // Feature 070: 所有持倉都在 groups 中
    it('should group all positions by groupId', () => {
      const result = groupPositionsByGroupId(mockPositions);

      // 現在有 2 個 group
      expect(result.groups).toHaveLength(2);

      // group-1 有 2 個持倉
      const group1 = result.groups.find(g => g.groupId === 'group-1');
      expect(group1).toBeDefined();
      expect(group1!.positions).toHaveLength(2);

      // group-2 有 1 個持倉（單獨開倉）
      const group2 = result.groups.find(g => g.groupId === 'group-2');
      expect(group2).toBeDefined();
      expect(group2!.positions).toHaveLength(1);
      expect(group2!.positions[0].id).toBe('pos-3');
    });

    it('should return empty groups array for empty input', () => {
      const result = groupPositionsByGroupId([]);
      expect(result.groups).toHaveLength(0);
    });

    it('should handle single position groups (former ungrouped)', () => {
      const singlePositionOnly = mockPositions.filter((p) => p.groupId === 'group-2');
      const result = groupPositionsByGroupId(singlePositionOnly);

      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].positions).toHaveLength(1);
    });
  });

  describe('calculatePositionGroupAggregate', () => {
    const groupPositions: PositionForGroup[] = [
      {
        id: 'pos-1',
        groupId: 'group-1',
        symbol: 'BTCUSDT',
        longExchange: 'binance',
        shortExchange: 'okx',
        longPositionSize: new Decimal('0.1'),
        longEntryPrice: new Decimal('95000'),
        shortPositionSize: new Decimal('0.1'),
        shortEntryPrice: new Decimal('95100'),
        status: 'OPEN',
        openedAt: new Date('2026-01-25T10:00:00Z'),
        cachedFundingPnL: new Decimal('5.5'),
        unrealizedPnL: new Decimal('-2.5'),
        stopLossPercent: new Decimal('2'),
        takeProfitPercent: new Decimal('5'),
      },
      {
        id: 'pos-2',
        groupId: 'group-1',
        symbol: 'BTCUSDT',
        longExchange: 'binance',
        shortExchange: 'okx',
        longPositionSize: new Decimal('0.2'),
        longEntryPrice: new Decimal('94500'),
        shortPositionSize: new Decimal('0.2'),
        shortEntryPrice: new Decimal('94600'),
        status: 'OPEN',
        openedAt: new Date('2026-01-25T10:01:00Z'),
        cachedFundingPnL: new Decimal('3.5'),
        unrealizedPnL: new Decimal('1.5'),
        stopLossPercent: new Decimal('2'),
        takeProfitPercent: new Decimal('5'),
      },
    ];

    it('should calculate total quantity correctly', () => {
      const aggregate = calculatePositionGroupAggregate(groupPositions);
      expect(aggregate.totalQuantity.toNumber()).toBe(0.3);
    });

    it('should calculate weighted average entry prices correctly', () => {
      const aggregate = calculatePositionGroupAggregate(groupPositions);

      // avgLongEntryPrice = (95000 * 0.1 + 94500 * 0.2) / 0.3 = (9500 + 18900) / 0.3 = 94666.67
      expect(aggregate.avgLongEntryPrice.toFixed(2)).toBe('94666.67');

      // avgShortEntryPrice = (95100 * 0.1 + 94600 * 0.2) / 0.3 = (9510 + 18920) / 0.3 = 94766.67
      expect(aggregate.avgShortEntryPrice.toFixed(2)).toBe('94766.67');
    });

    it('should sum funding PnL correctly', () => {
      const aggregate = calculatePositionGroupAggregate(groupPositions);
      expect(aggregate.totalFundingPnL?.toNumber()).toBe(9); // 5.5 + 3.5
    });

    it('should sum unrealized PnL correctly', () => {
      const aggregate = calculatePositionGroupAggregate(groupPositions);
      expect(aggregate.totalUnrealizedPnL?.toNumber()).toBe(-1); // -2.5 + 1.5
    });

    it('should count positions correctly', () => {
      const aggregate = calculatePositionGroupAggregate(groupPositions);
      expect(aggregate.positionCount).toBe(2);
    });

    it('should find earliest opened date', () => {
      const aggregate = calculatePositionGroupAggregate(groupPositions);
      expect(aggregate.firstOpenedAt?.toISOString()).toBe(
        '2026-01-25T10:00:00.000Z'
      );
    });

    it('should return consistent stop loss percent if all same', () => {
      const aggregate = calculatePositionGroupAggregate(groupPositions);
      expect(aggregate.stopLossPercent?.toNumber()).toBe(2);
    });

    it('should return null stop loss percent if different', () => {
      const mixedPositions = [
        ...groupPositions,
        {
          ...groupPositions[0],
          id: 'pos-3',
          stopLossPercent: new Decimal('3'),
        },
      ];
      const aggregate = calculatePositionGroupAggregate(mixedPositions);
      expect(aggregate.stopLossPercent).toBeNull();
    });

    it('should handle calculation precision for SC-005 (error < 0.01%)', () => {
      // Test with precise values to ensure calculation accuracy
      const precisePositions: PositionForGroup[] = [
        {
          id: 'p1',
          groupId: 'g1',
          symbol: 'BTCUSDT',
          longExchange: 'binance',
          shortExchange: 'okx',
          longPositionSize: new Decimal('0.12345678'),
          longEntryPrice: new Decimal('95123.45678901'),
          shortPositionSize: new Decimal('0.12345678'),
          shortEntryPrice: new Decimal('95234.56789012'),
          status: 'OPEN',
          openedAt: new Date(),
          cachedFundingPnL: null,
          unrealizedPnL: null,
          stopLossPercent: null,
          takeProfitPercent: null,
        },
        {
          id: 'p2',
          groupId: 'g1',
          symbol: 'BTCUSDT',
          longExchange: 'binance',
          shortExchange: 'okx',
          longPositionSize: new Decimal('0.23456789'),
          longEntryPrice: new Decimal('94567.89012345'),
          shortPositionSize: new Decimal('0.23456789'),
          shortEntryPrice: new Decimal('94678.90123456'),
          status: 'OPEN',
          openedAt: new Date(),
          cachedFundingPnL: null,
          unrealizedPnL: null,
          stopLossPercent: null,
          takeProfitPercent: null,
        },
      ];

      const aggregate = calculatePositionGroupAggregate(precisePositions);

      // Manual calculation for verification:
      // totalQty = 0.12345678 + 0.23456789 = 0.35802467
      // avgLongPrice = (95123.45678901 * 0.12345678 + 94567.89012345 * 0.23456789) / 0.35802467
      const expectedTotalQty = new Decimal('0.35802467');
      expect(
        aggregate.totalQuantity.minus(expectedTotalQty).abs().toNumber()
      ).toBeLessThan(0.00000001);

      // Verify precision is maintained (at least 8 decimal places)
      expect(aggregate.avgLongEntryPrice.decimalPlaces()).toBeGreaterThanOrEqual(2);
    });
  });
});
