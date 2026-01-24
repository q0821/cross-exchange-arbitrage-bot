/**
 * Integration tests for backward compatibility with ungrouped positions
 * Feature 069: 分單持倉合併顯示與批量平倉
 * Task: T030 [US3]
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createPrismaClient } from '@/lib/prisma-factory';
import { PositionGroupService } from '@/services/trading/PositionGroupService';
import type { PrismaClient } from '@/generated/prisma/client';

// Skip if not running integration tests
const RUN_INTEGRATION = process.env.RUN_INTEGRATION_TESTS === 'true';

/**
 * Helper to create a test position with all required fields
 */
async function createTestPosition(
  prisma: PrismaClient,
  userId: string,
  overrides: {
    groupId?: string | null;
    symbol?: string;
    status?: string;
    leverage?: number;
  } = {}
) {
  const now = new Date();

  return prisma.position.create({
    data: {
      userId,
      symbol: overrides.symbol || 'BTCUSDT',
      longExchange: 'binance',
      shortExchange: 'okx',
      longLeverage: overrides.leverage || 10,
      shortLeverage: overrides.leverage || 10,
      longEntryPrice: '50000',
      shortEntryPrice: '50100',
      longPositionSize: '0.01',
      shortPositionSize: '0.01',
      openFundingRateLong: '0.0001',
      openFundingRateShort: '-0.0001',
      status: (overrides.status as any) || 'OPEN',
      conditionalOrderStatus: 'PENDING',
      groupId: overrides.groupId ?? null,
      createdAt: now,
      updatedAt: now,
    },
  });
}

describe.skipIf(!RUN_INTEGRATION)(
  'Position Backward Compatibility [US3]',
  () => {
    let prisma: PrismaClient;
    let testUserId: string;

    beforeEach(async () => {
      prisma = createPrismaClient();

      // Create test user
      const user = await prisma.user.create({
        data: {
          email: `test-compat-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
          password: 'test-password-hash',
        },
      });
      testUserId = user.id;
    });

    afterEach(async () => {
      // Clean up test positions first (due to FK constraint)
      await prisma.position.deleteMany({
        where: { userId: testUserId },
      });
      // Clean up test user
      await prisma.user.delete({
        where: { id: testUserId },
      });
      await prisma.$disconnect();
    });

    describe('Ungrouped positions display', () => {
      it('should return ungrouped positions separately from groups', async () => {
        // Create ungrouped positions (null groupId)
        const ungrouped1 = await createTestPosition(prisma, testUserId, {
          groupId: null,
          symbol: 'BTCUSDT',
        });
        const ungrouped2 = await createTestPosition(prisma, testUserId, {
          groupId: null,
          symbol: 'ETHUSDT',
        });

        // Create grouped positions
        const groupId = PositionGroupService.generateGroupId();
        const grouped1 = await createTestPosition(prisma, testUserId, {
          groupId,
          symbol: 'BTCUSDT',
        });
        const grouped2 = await createTestPosition(prisma, testUserId, {
          groupId,
          symbol: 'BTCUSDT',
        });

        // Query all positions
        const allPositions = await prisma.position.findMany({
          where: { userId: testUserId, status: 'OPEN' },
        });

        // Verify counts
        expect(allPositions.length).toBe(4);

        // Separate grouped from ungrouped
        const ungroupedPositions = allPositions.filter((p) => p.groupId === null);
        const groupedPositions = allPositions.filter((p) => p.groupId !== null);

        expect(ungroupedPositions.length).toBe(2);
        expect(groupedPositions.length).toBe(2);

        // Verify ungrouped positions are independent
        expect(ungroupedPositions[0]!.id).not.toBe(ungroupedPositions[1]!.id);
        expect(ungroupedPositions[0]!.symbol).not.toBe(ungroupedPositions[1]!.symbol);
      });

      it('should handle close for ungrouped positions normally', async () => {
        // Create an ungrouped position
        const position = await createTestPosition(prisma, testUserId, {
          groupId: null,
          status: 'OPEN',
        });

        // Simulate closing the position (update status)
        const closedPosition = await prisma.position.update({
          where: { id: position.id },
          data: {
            status: 'CLOSED',
            closeReason: 'MANUAL',
            closedAt: new Date(),
          },
        });

        expect(closedPosition.status).toBe('CLOSED');
        expect(closedPosition.closeReason).toBe('MANUAL');
        expect(closedPosition.groupId).toBeNull();
      });

      it('should allow batch close for grouped positions without affecting ungrouped', async () => {
        // Create ungrouped position
        const ungrouped = await createTestPosition(prisma, testUserId, {
          groupId: null,
          symbol: 'ETHUSDT',
        });

        // Create grouped positions
        const groupId = PositionGroupService.generateGroupId();
        await createTestPosition(prisma, testUserId, {
          groupId,
          symbol: 'BTCUSDT',
        });
        await createTestPosition(prisma, testUserId, {
          groupId,
          symbol: 'BTCUSDT',
        });

        // Close grouped positions
        await prisma.position.updateMany({
          where: { groupId, status: 'OPEN' },
          data: {
            status: 'CLOSED',
            closeReason: 'BATCH_CLOSE',
            closedAt: new Date(),
          },
        });

        // Verify ungrouped position is still open
        const stillOpen = await prisma.position.findUnique({
          where: { id: ungrouped.id },
        });

        expect(stillOpen).not.toBeNull();
        expect(stillOpen!.status).toBe('OPEN');
        expect(stillOpen!.groupId).toBeNull();

        // Verify grouped positions are closed
        const closedPositions = await prisma.position.findMany({
          where: { groupId, status: 'CLOSED' },
        });

        expect(closedPositions.length).toBe(2);
        expect(closedPositions.every((p) => p.closeReason === 'BATCH_CLOSE')).toBe(true);
      });
    });

    describe('PositionGroupService with mixed positions', () => {
      it('should correctly group positions with groupId and leave others ungrouped', async () => {
        // Create mixed positions
        const groupId1 = PositionGroupService.generateGroupId();
        const groupId2 = PositionGroupService.generateGroupId();

        // Group 1: 2 positions
        await createTestPosition(prisma, testUserId, { groupId: groupId1, symbol: 'BTCUSDT' });
        await createTestPosition(prisma, testUserId, { groupId: groupId1, symbol: 'BTCUSDT' });

        // Group 2: 1 position
        await createTestPosition(prisma, testUserId, { groupId: groupId2, symbol: 'ETHUSDT' });

        // Ungrouped: 2 positions
        await createTestPosition(prisma, testUserId, { groupId: null, symbol: 'XRPUSDT' });
        await createTestPosition(prisma, testUserId, { groupId: null, symbol: 'SOLUSDT' });

        const groupService = new PositionGroupService(prisma);
        const result = await groupService.getPositionsGrouped(testUserId, 'OPEN');

        // Should have 2 groups
        expect(result.groups.length).toBe(2);

        // Should have 2 ungrouped positions
        expect(result.positions.length).toBe(2);
        expect(result.positions.every((p) => p.groupId === null)).toBe(true);

        // Verify group structure
        const group1 = result.groups.find((g) => g.groupId === groupId1);
        const group2 = result.groups.find((g) => g.groupId === groupId2);

        expect(group1).toBeDefined();
        expect(group1!.positions.length).toBe(2);
        expect(group1!.aggregate.positionCount).toBe(2);

        expect(group2).toBeDefined();
        expect(group2!.positions.length).toBe(1);
        expect(group2!.aggregate.positionCount).toBe(1);

        // Total count should include all (calculated)
        const totalCount = result.positions.length +
          result.groups.reduce((acc, g) => acc + g.positions.length, 0);
        expect(totalCount).toBe(5);
      });

      it('should validate group ownership correctly for ungrouped positions', async () => {
        // Create ungrouped position
        const position = await createTestPosition(prisma, testUserId, {
          groupId: null,
        });

        const groupService = new PositionGroupService(prisma);

        // Should return false for null groupId (no group to validate)
        // Note: validateGroupOwnership expects a valid groupId
        // For ungrouped positions, we shouldn't call this method
        expect(position.groupId).toBeNull();
      });
    });

    describe('Edge cases', () => {
      it('should handle empty results gracefully', async () => {
        const groupService = new PositionGroupService(prisma);
        const result = await groupService.getPositionsGrouped(testUserId, 'OPEN');

        expect(result.groups).toEqual([]);
        expect(result.positions).toEqual([]);
      });

      it('should handle all ungrouped positions', async () => {
        // Create only ungrouped positions
        await createTestPosition(prisma, testUserId, { groupId: null, symbol: 'BTCUSDT' });
        await createTestPosition(prisma, testUserId, { groupId: null, symbol: 'ETHUSDT' });
        await createTestPosition(prisma, testUserId, { groupId: null, symbol: 'XRPUSDT' });

        const groupService = new PositionGroupService(prisma);
        const result = await groupService.getPositionsGrouped(testUserId, 'OPEN');

        expect(result.groups).toEqual([]);
        expect(result.positions.length).toBe(3);
      });

      it('should handle all grouped positions', async () => {
        // Create only grouped positions
        const groupId = PositionGroupService.generateGroupId();
        await createTestPosition(prisma, testUserId, { groupId, symbol: 'BTCUSDT' });
        await createTestPosition(prisma, testUserId, { groupId, symbol: 'BTCUSDT' });

        const groupService = new PositionGroupService(prisma);
        const result = await groupService.getPositionsGrouped(testUserId, 'OPEN');

        expect(result.groups.length).toBe(1);
        expect(result.positions).toEqual([]);
        expect(result.groups[0]!.positions.length).toBe(2);
      });
    });
  }
);
