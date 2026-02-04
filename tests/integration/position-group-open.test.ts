/**
 * Integration tests for position group open
 * Feature 069: 分單持倉合併顯示與批量平倉
 * Feature 070: 統一持倉 groupId 架構
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Decimal } from 'decimal.js';
import { createPrismaClient } from '@/lib/prisma-factory';
import { PositionGroupService } from '@/services/trading/PositionGroupService';
import type { PrismaClient } from '@/generated/prisma/client';

// Skip if not running integration tests
const RUN_INTEGRATION = process.env.RUN_INTEGRATION_TESTS === 'true';

// UUID v4 pattern for validation
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Helper to create a test position with all required fields
 * Feature 070: groupId is now required (auto-generated if not provided)
 */
function createPositionData(
  userId: string,
  overrides: Partial<{
    symbol: string;
    longExchange: string;
    shortExchange: string;
    longPositionSize: Decimal;
    shortPositionSize: Decimal;
    longEntryPrice: Decimal;
    shortEntryPrice: Decimal;
    longLeverage: number;
    shortLeverage: number;
    status: 'OPEN' | 'PENDING' | 'CLOSED';
    groupId: string;  // Feature 070: No longer nullable
    openedAt: Date;
    cachedFundingPnL: Decimal;
    unrealizedPnL: Decimal;
  }> = {}
) {
  const data: any = {
    userId,
    symbol: overrides.symbol ?? 'BTCUSDT',
    longExchange: overrides.longExchange ?? 'binance',
    shortExchange: overrides.shortExchange ?? 'okx',
    longPositionSize: overrides.longPositionSize ?? new Decimal('0.1'),
    shortPositionSize: overrides.shortPositionSize ?? new Decimal('0.1'),
    longEntryPrice: overrides.longEntryPrice ?? new Decimal('50000'),
    shortEntryPrice: overrides.shortEntryPrice ?? new Decimal('50100'),
    longLeverage: overrides.longLeverage ?? 3,
    shortLeverage: overrides.shortLeverage ?? 3,
    status: overrides.status ?? 'OPEN',
    // Required fields
    openFundingRateLong: new Decimal('0.0001'),
    openFundingRateShort: new Decimal('0.00015'),
    openedAt: overrides.openedAt ?? new Date(),
    cachedFundingPnL: overrides.cachedFundingPnL ?? undefined,
    unrealizedPnL: overrides.unrealizedPnL ?? undefined,
  };

  // Feature 070: Only add groupId if explicitly provided
  // If not provided, database will auto-generate
  if (overrides.groupId !== undefined) {
    data.groupId = overrides.groupId;
  }

  return data;
}

describe.skipIf(!RUN_INTEGRATION)('Position Group Open Integration', () => {
  let prisma: PrismaClient;
  let service: PositionGroupService;
  let testUserId: string;

  beforeEach(async () => {
    prisma = createPrismaClient();
    service = new PositionGroupService(prisma);

    // Create test user
    const user = await prisma.user.create({
      data: {
        email: `test-group-open-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
        password: 'test-password-hash',
      },
    });
    testUserId = user.id;
  });

  afterEach(async () => {
    // Clean up test positions first (FK constraint)
    await prisma.position.deleteMany({
      where: { userId: testUserId },
    });
    // Clean up test user
    await prisma.user.delete({
      where: { id: testUserId },
    });
    await prisma.$disconnect();
  });

  describe('Position creation with groupId', () => {
    it('should store position with explicit groupId', async () => {
      const groupId = PositionGroupService.generateGroupId();

      const position = await prisma.position.create({
        data: createPositionData(testUserId, { groupId }),
      });

      expect(position.groupId).toBe(groupId);

      // Verify from database
      const fetched = await prisma.position.findUnique({
        where: { id: position.id },
      });
      expect(fetched?.groupId).toBe(groupId);
    });

    // Feature 070: Single positions now have auto-generated groupId
    it('should auto-generate groupId for single position', async () => {
      const position = await prisma.position.create({
        data: createPositionData(testUserId, {
          symbol: 'ETHUSDT',
          longExchange: 'binance',
          shortExchange: 'gateio',
        }),
      });

      // Should have a valid UUID groupId
      expect(position.groupId).not.toBeNull();
      expect(position.groupId).toMatch(UUID_PATTERN);
    });

    it('should group multiple positions with same groupId', async () => {
      const groupId = PositionGroupService.generateGroupId();

      // Create 3 positions with same groupId
      const positions = await Promise.all([
        prisma.position.create({
          data: createPositionData(testUserId, {
            groupId,
            longEntryPrice: new Decimal('50000'),
          }),
        }),
        prisma.position.create({
          data: createPositionData(testUserId, {
            groupId,
            longEntryPrice: new Decimal('50050'),
          }),
        }),
        prisma.position.create({
          data: createPositionData(testUserId, {
            groupId,
            longEntryPrice: new Decimal('50100'),
          }),
        }),
      ]);

      expect(positions).toHaveLength(3);
      expect(positions.every((p) => p.groupId === groupId)).toBe(true);
    });
  });

  describe('PositionGroupService with database', () => {
    it('should fetch all positions in groups array', async () => {
      const groupId1 = PositionGroupService.generateGroupId();
      const groupId2 = PositionGroupService.generateGroupId();

      // Create group 1 with 2 positions
      await Promise.all([
        prisma.position.create({
          data: createPositionData(testUserId, {
            groupId: groupId1,
            longPositionSize: new Decimal('0.1'),
          }),
        }),
        prisma.position.create({
          data: createPositionData(testUserId, {
            groupId: groupId1,
            longPositionSize: new Decimal('0.2'),
          }),
        }),
      ]);

      // Create group 2 with 1 position
      await prisma.position.create({
        data: createPositionData(testUserId, {
          symbol: 'ETHUSDT',
          groupId: groupId2,
        }),
      });

      // Create a single position (auto-generated groupId)
      await prisma.position.create({
        data: createPositionData(testUserId, {
          symbol: 'SOLUSDT',
          longExchange: 'okx',
          shortExchange: 'mexc',
        }),
      });

      const result = await service.getPositionsGrouped(testUserId, 'OPEN');

      // Feature 070: All positions in groups, no separate positions array
      expect((result as any).positions).toBeUndefined();
      expect(result.groups).toHaveLength(3); // 2 explicit groups + 1 auto-generated

      // Find group 1
      const group1 = result.groups.find((g) => g.groupId === groupId1);
      expect(group1).toBeDefined();
      expect(group1?.positions).toHaveLength(2);
      expect(group1?.aggregate.positionCount).toBe(2);

      // Find group 2
      const group2 = result.groups.find((g) => g.groupId === groupId2);
      expect(group2).toBeDefined();
      expect(group2?.positions).toHaveLength(1);

      // Find the single position group
      const singleGroup = result.groups.find(
        (g) => g.groupId !== groupId1 && g.groupId !== groupId2
      );
      expect(singleGroup).toBeDefined();
      expect(singleGroup?.positions).toHaveLength(1);
      expect(singleGroup?.aggregate.positionCount).toBe(1);
    });

    it('should validate group ownership correctly', async () => {
      const groupId = PositionGroupService.generateGroupId();

      await prisma.position.create({
        data: createPositionData(testUserId, { groupId }),
      });

      // Test with correct user
      const isOwner = await service.validateGroupOwnership(groupId, testUserId);
      expect(isOwner).toBe(true);

      // Test with wrong user
      const isNotOwner = await service.validateGroupOwnership(
        groupId,
        'non-existent-user'
      );
      expect(isNotOwner).toBe(false);
    });

    it('should calculate aggregate statistics for group', async () => {
      const groupId = PositionGroupService.generateGroupId();

      // Create 3 positions with different sizes and prices
      await Promise.all([
        prisma.position.create({
          data: createPositionData(testUserId, {
            groupId,
            longPositionSize: new Decimal('0.1'),
            shortPositionSize: new Decimal('0.1'),
            longEntryPrice: new Decimal('50000'),
            shortEntryPrice: new Decimal('50100'),
            openedAt: new Date('2024-01-01T10:00:00Z'),
            cachedFundingPnL: new Decimal('10'),
            unrealizedPnL: new Decimal('5'),
          }),
        }),
        prisma.position.create({
          data: createPositionData(testUserId, {
            groupId,
            longPositionSize: new Decimal('0.2'),
            shortPositionSize: new Decimal('0.2'),
            longEntryPrice: new Decimal('51000'),
            shortEntryPrice: new Decimal('51100'),
            openedAt: new Date('2024-01-01T11:00:00Z'),
            cachedFundingPnL: new Decimal('20'),
            unrealizedPnL: new Decimal('15'),
          }),
        }),
        prisma.position.create({
          data: createPositionData(testUserId, {
            groupId,
            longPositionSize: new Decimal('0.1'),
            shortPositionSize: new Decimal('0.1'),
            longEntryPrice: new Decimal('52000'),
            shortEntryPrice: new Decimal('52100'),
            openedAt: new Date('2024-01-01T12:00:00Z'),
            cachedFundingPnL: new Decimal('15'),
            unrealizedPnL: new Decimal('10'),
          }),
        }),
      ]);

      const aggregate = await service.getGroupAggregate(groupId, testUserId);

      expect(aggregate).not.toBeNull();
      expect(aggregate?.positionCount).toBe(3);
      expect(aggregate?.totalQuantity.toString()).toBe('0.4'); // 0.1 + 0.2 + 0.1

      // Weighted average: (50000*0.1 + 51000*0.2 + 52000*0.1) / 0.4 = 51000
      expect(aggregate?.avgLongEntryPrice.toNumber()).toBeCloseTo(51000, 2);

      // Total funding PnL: 10 + 20 + 15 = 45
      expect(aggregate?.totalFundingPnL?.toString()).toBe('45');

      // Total unrealized PnL: 5 + 15 + 10 = 30
      expect(aggregate?.totalUnrealizedPnL?.toString()).toBe('30');

      // First opened at should be the earliest
      expect(aggregate?.firstOpenedAt?.toISOString()).toBe(
        '2024-01-01T10:00:00.000Z'
      );
    });

    it('should query positions by groupId efficiently', async () => {
      const groupId = PositionGroupService.generateGroupId();

      // Create 10 positions in the group
      const createPromises = [];
      for (let i = 0; i < 10; i++) {
        createPromises.push(
          prisma.position.create({
            data: createPositionData(testUserId, {
              groupId,
              longEntryPrice: new Decimal(50000 + i * 100),
              shortEntryPrice: new Decimal(50100 + i * 100),
            }),
          })
        );
      }
      await Promise.all(createPromises);

      // Query by groupId should be fast (index is used)
      const startTime = Date.now();
      const positions = await service.getPositionsByGroupId(groupId, testUserId);
      const duration = Date.now() - startTime;

      expect(positions).toHaveLength(10);
      expect(duration).toBeLessThan(100); // Should be very fast with index
    });
  });
});
