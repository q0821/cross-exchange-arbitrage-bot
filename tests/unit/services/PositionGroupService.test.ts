/**
 * Unit tests for PositionGroupService
 * Feature 069: 分單持倉合併顯示與批量平倉
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Decimal } from 'decimal.js';
import { PositionGroupService } from '@/services/trading/PositionGroupService';
import type { PrismaClient, Position, PositionWebStatus } from '@/generated/prisma/client';

// Mock Prisma Client
const mockPrisma = {
  position: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
} as unknown as PrismaClient;

describe('PositionGroupService', () => {
  let service: PositionGroupService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PositionGroupService(mockPrisma);
  });

  // Feature 070: groupId 現為必填
  const createMockPosition = (
    id: string,
    groupId: string,
    overrides: Partial<Position> = {}
  ): Position => ({
    id,
    userId: 'user-1',
    groupId,
    symbol: 'BTCUSDT',
    longExchange: 'binance',
    shortExchange: 'okx',
    longOrderId: 'order-1',
    longEntryPrice: new Decimal('95000'),
    longPositionSize: new Decimal('0.1'),
    longLeverage: 3,
    longExitPrice: null,
    longCloseOrderId: null,
    shortOrderId: 'order-2',
    shortEntryPrice: new Decimal('95100'),
    shortPositionSize: new Decimal('0.1'),
    shortLeverage: 3,
    shortExitPrice: null,
    shortCloseOrderId: null,
    status: 'OPEN' as PositionWebStatus,
    openFundingRateLong: new Decimal('0.0001'),
    openFundingRateShort: new Decimal('-0.0001'),
    unrealizedPnL: new Decimal('10'),
    openedAt: new Date('2026-01-25T10:00:00Z'),
    closedAt: null,
    failureReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    stopLossEnabled: false,
    stopLossPercent: null,
    longStopLossPrice: null,
    longStopLossOrderId: null,
    shortStopLossPrice: null,
    shortStopLossOrderId: null,
    takeProfitEnabled: false,
    takeProfitPercent: null,
    longTakeProfitPrice: null,
    longTakeProfitOrderId: null,
    shortTakeProfitPrice: null,
    shortTakeProfitOrderId: null,
    conditionalOrderStatus: 'PENDING',
    conditionalOrderError: null,
    closeReason: null,
    cachedFundingPnL: new Decimal('5'),
    cachedFundingPnLUpdatedAt: new Date(),
    exitSuggested: false,
    exitSuggestedAt: null,
    exitSuggestedReason: null,
    ...overrides,
  });

  describe('getPositionsGrouped', () => {
    // Feature 070: 所有持倉都在 groups 中，不再有獨立的 positions 陣列
    it('should return all positions grouped by groupId', async () => {
      const mockPositions = [
        createMockPosition('pos-1', 'group-1'),
        createMockPosition('pos-2', 'group-1', {
          longPositionSize: new Decimal('0.2'),
        }),
        createMockPosition('pos-3', 'group-2', { symbol: 'ETHUSDT' }),
      ];

      vi.mocked(mockPrisma.position.findMany).mockResolvedValue(mockPositions);

      const result = await service.getPositionsGrouped('user-1');

      // Feature 070: 不再有 positions 屬性
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

    it('should filter by status when provided', async () => {
      vi.mocked(mockPrisma.position.findMany).mockResolvedValue([]);

      await service.getPositionsGrouped('user-1', 'OPEN');

      expect(mockPrisma.position.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
            status: 'OPEN',
          }),
        })
      );
    });

    it('should filter by multiple statuses when array provided', async () => {
      vi.mocked(mockPrisma.position.findMany).mockResolvedValue([]);

      await service.getPositionsGrouped('user-1', ['OPEN', 'PARTIAL']);

      expect(mockPrisma.position.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
            status: { in: ['OPEN', 'PARTIAL'] },
          }),
        })
      );
    });

    it('should not filter status when ALL is provided', async () => {
      vi.mocked(mockPrisma.position.findMany).mockResolvedValue([]);

      await service.getPositionsGrouped('user-1', 'ALL');

      expect(mockPrisma.position.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
        },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should calculate aggregate for groups', async () => {
      const mockPositions = [
        createMockPosition('pos-1', 'group-1', {
          longPositionSize: new Decimal('0.1'),
          longEntryPrice: new Decimal('95000'),
        }),
        createMockPosition('pos-2', 'group-1', {
          longPositionSize: new Decimal('0.2'),
          longEntryPrice: new Decimal('94500'),
        }),
      ];

      vi.mocked(mockPrisma.position.findMany).mockResolvedValue(mockPositions);

      const result = await service.getPositionsGrouped('user-1');

      expect(result.groups[0].aggregate.totalQuantity.toNumber()).toBe(0.3);
      expect(result.groups[0].aggregate.positionCount).toBe(2);
    });
  });

  describe('getPositionsByGroupId', () => {
    it('should return positions for a specific group', async () => {
      const mockPositions = [
        createMockPosition('pos-1', 'group-1'),
        createMockPosition('pos-2', 'group-1'),
      ];

      vi.mocked(mockPrisma.position.findMany).mockResolvedValue(mockPositions);

      const result = await service.getPositionsByGroupId('group-1', 'user-1');

      expect(result).toHaveLength(2);
      expect(mockPrisma.position.findMany).toHaveBeenCalledWith({
        where: {
          groupId: 'group-1',
          userId: 'user-1',
          status: 'OPEN',
        },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should return empty array for non-existent group', async () => {
      vi.mocked(mockPrisma.position.findMany).mockResolvedValue([]);

      const result = await service.getPositionsByGroupId(
        'non-existent',
        'user-1'
      );

      expect(result).toHaveLength(0);
    });
  });

  describe('validateGroupOwnership', () => {
    it('should return true if user owns the group', async () => {
      vi.mocked(mockPrisma.position.findFirst).mockResolvedValue(
        createMockPosition('pos-1', 'group-1')
      );

      const result = await service.validateGroupOwnership('group-1', 'user-1');

      expect(result).toBe(true);
    });

    it('should return false if group does not exist', async () => {
      vi.mocked(mockPrisma.position.findFirst).mockResolvedValue(null);

      const result = await service.validateGroupOwnership(
        'non-existent',
        'user-1'
      );

      expect(result).toBe(false);
    });

    it('should return false if user does not own the group', async () => {
      vi.mocked(mockPrisma.position.findFirst).mockResolvedValue(null);

      const result = await service.validateGroupOwnership(
        'group-1',
        'other-user'
      );

      expect(result).toBe(false);
    });
  });

  describe('generateGroupId', () => {
    it('should generate a valid UUID', () => {
      const groupId = PositionGroupService.generateGroupId();

      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(groupId).toMatch(uuidRegex);
    });

    it('should generate unique IDs on each call', () => {
      const id1 = PositionGroupService.generateGroupId();
      const id2 = PositionGroupService.generateGroupId();

      expect(id1).not.toBe(id2);
    });
  });

  describe('getGroupAggregate', () => {
    it('should calculate aggregate for a group', async () => {
      const mockPositions = [
        createMockPosition('pos-1', 'group-1', {
          longPositionSize: new Decimal('0.1'),
          cachedFundingPnL: new Decimal('5'),
        }),
        createMockPosition('pos-2', 'group-1', {
          longPositionSize: new Decimal('0.2'),
          cachedFundingPnL: new Decimal('10'),
        }),
      ];

      vi.mocked(mockPrisma.position.findMany).mockResolvedValue(mockPositions);

      const aggregate = await service.getGroupAggregate('group-1', 'user-1');

      expect(aggregate).not.toBeNull();
      expect(aggregate!.totalQuantity.toNumber()).toBe(0.3);
      expect(aggregate!.totalFundingPnL?.toNumber()).toBe(15);
    });

    it('should return null for empty group', async () => {
      vi.mocked(mockPrisma.position.findMany).mockResolvedValue([]);

      const aggregate = await service.getGroupAggregate('empty-group', 'user-1');

      expect(aggregate).toBeNull();
    });
  });
});
