/**
 * Integration tests for batch close API
 * Feature 069: 分單持倉合併顯示與批量平倉
 * Task: T021
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Decimal } from 'decimal.js';
import { createPrismaClient } from '@/lib/prisma-factory';
import { PositionGroupService } from '@/services/trading/PositionGroupService';
import type { PrismaClient } from '@/generated/prisma/client';

// Skip if not running integration tests
const RUN_INTEGRATION = process.env.RUN_INTEGRATION_TESTS === 'true';

/**
 * Helper to create a test position with all required fields
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
    status: 'OPEN' | 'PENDING' | 'CLOSED' | 'CLOSING' | 'PARTIAL';
    groupId: string | null;
    openedAt: Date;
    cachedFundingPnL: Decimal;
    unrealizedPnL: Decimal;
    stopLossEnabled: boolean;
    takeProfitEnabled: boolean;
  }> = {}
) {
  return {
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
    groupId: overrides.groupId ?? null,
    // Required fields
    openFundingRateLong: new Decimal('0.0001'),
    openFundingRateShort: new Decimal('0.00015'),
    openedAt: overrides.openedAt ?? new Date(),
    cachedFundingPnL: overrides.cachedFundingPnL ?? undefined,
    unrealizedPnL: overrides.unrealizedPnL ?? undefined,
    stopLossEnabled: overrides.stopLossEnabled ?? false,
    takeProfitEnabled: overrides.takeProfitEnabled ?? false,
  };
}

describe.skipIf(!RUN_INTEGRATION)('Batch Close Integration', () => {
  let prisma: PrismaClient;
  let service: PositionGroupService;
  let testUserId: string;

  beforeEach(async () => {
    prisma = createPrismaClient();
    service = new PositionGroupService(prisma);

    // Create test user
    const user = await prisma.user.create({
      data: {
        email: `test-batch-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
        password: 'test-password-hash',
      },
    });
    testUserId = user.id;
  });

  afterEach(async () => {
    // Cleanup test data
    if (testUserId) {
      await prisma.trade.deleteMany({ where: { userId: testUserId } });
      await prisma.position.deleteMany({ where: { userId: testUserId } });
      await prisma.user.delete({ where: { id: testUserId } });
    }
    await prisma.$disconnect();
  });

  describe('Group positions for batch close', () => {
    it('should correctly identify OPEN positions in a group for batch close', async () => {
      const groupId = PositionGroupService.generateGroupId();

      // Create 3 OPEN positions
      await Promise.all([
        prisma.position.create({
          data: createPositionData(testUserId, {
            groupId,
            status: 'OPEN',
            longEntryPrice: new Decimal('50000'),
          }),
        }),
        prisma.position.create({
          data: createPositionData(testUserId, {
            groupId,
            status: 'OPEN',
            longEntryPrice: new Decimal('50050'),
          }),
        }),
        prisma.position.create({
          data: createPositionData(testUserId, {
            groupId,
            status: 'OPEN',
            longEntryPrice: new Decimal('50100'),
          }),
        }),
      ]);

      // Query for OPEN positions in the group
      const openPositions = await prisma.position.findMany({
        where: {
          userId: testUserId,
          groupId,
          status: 'OPEN',
        },
        orderBy: { createdAt: 'asc' },
      });

      expect(openPositions).toHaveLength(3);
      expect(openPositions.every((p) => p.status === 'OPEN')).toBe(true);
      expect(openPositions.every((p) => p.groupId === groupId)).toBe(true);
    });

    it('should exclude non-OPEN positions from batch close query', async () => {
      const groupId = PositionGroupService.generateGroupId();

      // Create mixed status positions
      await Promise.all([
        prisma.position.create({
          data: createPositionData(testUserId, {
            groupId,
            status: 'OPEN',
          }),
        }),
        prisma.position.create({
          data: createPositionData(testUserId, {
            groupId,
            status: 'CLOSED',
          }),
        }),
        prisma.position.create({
          data: createPositionData(testUserId, {
            groupId,
            status: 'OPEN',
          }),
        }),
      ]);

      // Query for OPEN positions only
      const openPositions = await prisma.position.findMany({
        where: {
          userId: testUserId,
          groupId,
          status: 'OPEN',
        },
      });

      expect(openPositions).toHaveLength(2);
    });

    it('should return empty when no OPEN positions exist', async () => {
      const groupId = PositionGroupService.generateGroupId();

      // Create only CLOSED positions
      await Promise.all([
        prisma.position.create({
          data: createPositionData(testUserId, {
            groupId,
            status: 'CLOSED',
          }),
        }),
        prisma.position.create({
          data: createPositionData(testUserId, {
            groupId,
            status: 'CLOSED',
          }),
        }),
      ]);

      const openPositions = await prisma.position.findMany({
        where: {
          userId: testUserId,
          groupId,
          status: 'OPEN',
        },
      });

      expect(openPositions).toHaveLength(0);
    });
  });

  describe('BATCH_CLOSE closeReason', () => {
    it('should support BATCH_CLOSE as a valid closeReason value', async () => {
      const groupId = PositionGroupService.generateGroupId();

      // Create and then update a position with BATCH_CLOSE reason
      const position = await prisma.position.create({
        data: createPositionData(testUserId, {
          groupId,
          status: 'OPEN',
        }),
      });

      const updatedPosition = await prisma.position.update({
        where: { id: position.id },
        data: {
          status: 'CLOSED',
          closeReason: 'BATCH_CLOSE',
          closedAt: new Date(),
        },
      });

      expect(updatedPosition.closeReason).toBe('BATCH_CLOSE');
      expect(updatedPosition.status).toBe('CLOSED');
    });

    it('should correctly filter positions by closeReason', async () => {
      const groupId = PositionGroupService.generateGroupId();

      // Create positions with different close reasons
      await Promise.all([
        prisma.position.create({
          data: {
            ...createPositionData(testUserId, {
              groupId,
              status: 'CLOSED',
            }),
            closeReason: 'BATCH_CLOSE',
            closedAt: new Date(),
          },
        }),
        prisma.position.create({
          data: {
            ...createPositionData(testUserId, {
              groupId,
              status: 'CLOSED',
            }),
            closeReason: 'MANUAL',
            closedAt: new Date(),
          },
        }),
        prisma.position.create({
          data: {
            ...createPositionData(testUserId, {
              groupId,
              status: 'CLOSED',
            }),
            closeReason: 'BATCH_CLOSE',
            closedAt: new Date(),
          },
        }),
      ]);

      const batchClosedPositions = await prisma.position.findMany({
        where: {
          userId: testUserId,
          groupId,
          closeReason: 'BATCH_CLOSE',
        },
      });

      expect(batchClosedPositions).toHaveLength(2);
    });
  });

  describe('Group ownership validation for batch close', () => {
    it('should validate user owns the group before batch close', async () => {
      const groupId = PositionGroupService.generateGroupId();

      // Create positions for testUserId
      await prisma.position.create({
        data: createPositionData(testUserId, {
          groupId,
          status: 'OPEN',
        }),
      });

      // Should pass for correct user
      const isOwner = await service.validateGroupOwnership(groupId, testUserId);
      expect(isOwner).toBe(true);

      // Should fail for wrong user
      const isNotOwner = await service.validateGroupOwnership(
        groupId,
        'wrong-user-id'
      );
      expect(isNotOwner).toBe(false);
    });

    it('should prevent accessing another user\'s group positions', async () => {
      const groupId = PositionGroupService.generateGroupId();

      // Create another user
      const otherUser = await prisma.user.create({
        data: {
          email: `other-${Date.now()}@example.com`,
          password: 'test-password-hash',
        },
      });

      try {
        // Create positions for otherUser
        await prisma.position.create({
          data: createPositionData(otherUser.id, {
            groupId,
            status: 'OPEN',
          }),
        });

        // testUserId should not be able to access otherUser's positions
        const positions = await prisma.position.findMany({
          where: {
            userId: testUserId, // Wrong user
            groupId,
            status: 'OPEN',
          },
        });

        expect(positions).toHaveLength(0);
      } finally {
        // Cleanup other user's data
        await prisma.position.deleteMany({ where: { userId: otherUser.id } });
        await prisma.user.delete({ where: { id: otherUser.id } });
      }
    });
  });

  describe('Concurrent batch close safety', () => {
    it('should handle concurrent status updates correctly', async () => {
      const groupId = PositionGroupService.generateGroupId();

      const position = await prisma.position.create({
        data: createPositionData(testUserId, {
          groupId,
          status: 'OPEN',
        }),
      });

      // Simulate concurrent updates (like distributed lock scenario)
      // First update to CLOSING
      await prisma.position.update({
        where: { id: position.id },
        data: { status: 'CLOSING' },
      });

      // Verify status changed
      const closingPosition = await prisma.position.findUnique({
        where: { id: position.id },
      });
      expect(closingPosition?.status).toBe('CLOSING');

      // Second update to CLOSED
      await prisma.position.update({
        where: { id: position.id },
        data: {
          status: 'CLOSED',
          closeReason: 'BATCH_CLOSE',
          closedAt: new Date(),
        },
      });

      // Verify final status
      const closedPosition = await prisma.position.findUnique({
        where: { id: position.id },
      });
      expect(closedPosition?.status).toBe('CLOSED');
      expect(closedPosition?.closeReason).toBe('BATCH_CLOSE');
    });
  });

  describe('Group aggregate after batch close', () => {
    it('should show correct aggregate for remaining OPEN positions after partial batch close', async () => {
      const groupId = PositionGroupService.generateGroupId();

      // Create 3 positions
      const positions = await Promise.all([
        prisma.position.create({
          data: createPositionData(testUserId, {
            groupId,
            status: 'OPEN',
            longPositionSize: new Decimal('0.1'),
          }),
        }),
        prisma.position.create({
          data: createPositionData(testUserId, {
            groupId,
            status: 'OPEN',
            longPositionSize: new Decimal('0.2'),
          }),
        }),
        prisma.position.create({
          data: createPositionData(testUserId, {
            groupId,
            status: 'OPEN',
            longPositionSize: new Decimal('0.15'),
          }),
        }),
      ]);

      // Close first position (simulate batch close of one)
      await prisma.position.update({
        where: { id: positions[0].id },
        data: {
          status: 'CLOSED',
          closeReason: 'BATCH_CLOSE',
          closedAt: new Date(),
        },
      });

      // Get remaining OPEN positions
      const remainingPositions = await prisma.position.findMany({
        where: {
          userId: testUserId,
          groupId,
          status: 'OPEN',
        },
      });

      expect(remainingPositions).toHaveLength(2);

      // Calculate aggregate for remaining
      const aggregate = await service.getGroupAggregate(groupId, testUserId);

      // Only 2 OPEN positions remain
      expect(aggregate?.positionCount).toBe(2);
      // Total quantity should be 0.2 + 0.15 = 0.35
      expect(aggregate?.totalQuantity.toString()).toBe('0.35');
    });
  });
});
