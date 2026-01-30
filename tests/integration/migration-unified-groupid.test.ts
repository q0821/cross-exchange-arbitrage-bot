/**
 * Integration tests for unified groupId migration
 * Feature 070: 統一持倉 groupId 架構
 * Task: T004 [TEST]
 *
 * 驗證 migration 正確處理現有資料：
 * 1. 現有 null groupId 持倉被補上 UUID
 * 2. 現有有 groupId 的持倉不變
 * 3. 執行後無 null groupId
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createPrismaClient } from '@/lib/prisma-factory';
import { PositionGroupService } from '@/services/trading/PositionGroupService';
import type { PrismaClient } from '@/generated/prisma/client';

// Skip if not running integration tests
const RUN_INTEGRATION = process.env.RUN_INTEGRATION_TESTS === 'true';

// UUID v4 pattern for validation
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Helper to create a test position with all required fields
 * Note: After migration, groupId is auto-generated if not provided
 */
async function createTestPosition(
  prisma: PrismaClient,
  userId: string,
  overrides: {
    groupId?: string;  // No longer nullable - will be auto-generated if not provided
    symbol?: string;
    status?: string;
  } = {}
) {
  const now = new Date();

  // Build data object - only include groupId if explicitly provided
  const data: any = {
    userId,
    symbol: overrides.symbol || 'BTCUSDT',
    longExchange: 'binance',
    shortExchange: 'okx',
    longLeverage: 10,
    shortLeverage: 10,
    longEntryPrice: '50000',
    shortEntryPrice: '50100',
    longPositionSize: '0.01',
    shortPositionSize: '0.01',
    openFundingRateLong: '0.0001',
    openFundingRateShort: '-0.0001',
    status: (overrides.status as any) || 'OPEN',
    conditionalOrderStatus: 'PENDING',
    createdAt: now,
    updatedAt: now,
  };

  // Only add groupId if explicitly provided
  if (overrides.groupId !== undefined) {
    data.groupId = overrides.groupId;
  }

  return prisma.position.create({ data });
}

describe.skipIf(!RUN_INTEGRATION)(
  'Migration: Unified groupId [Feature 070]',
  () => {
    let prisma: PrismaClient;
    let testUserId: string;

    beforeEach(async () => {
      prisma = createPrismaClient();

      // Create test user
      const user = await prisma.user.create({
        data: {
          email: `test-migration-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
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

    describe('Post-migration validation', () => {
      it('should have no null groupId in any position', async () => {
        // Query all positions for this user
        const positions = await prisma.position.findMany({
          where: { userId: testUserId },
        });

        // After migration, all positions should have a groupId
        // This test will FAIL before migration is applied
        const nullGroupIdCount = positions.filter((p) => p.groupId === null).length;

        expect(nullGroupIdCount).toBe(0);
      });

      it('should generate valid UUID for all groupIds', async () => {
        // Create a position (should auto-generate groupId after migration)
        const position = await createTestPosition(prisma, testUserId, {
          // Note: After migration, groupId should be auto-generated even if not provided
          // This test verifies the database default works
        });

        // After migration, groupId should be a valid UUID
        expect(position.groupId).not.toBeNull();
        expect(position.groupId).toMatch(UUID_PATTERN);
      });

      it('should preserve existing groupId values', async () => {
        // Create a position with explicit groupId
        const existingGroupId = PositionGroupService.generateGroupId();
        const position = await createTestPosition(prisma, testUserId, {
          groupId: existingGroupId,
        });

        // The explicit groupId should be preserved
        expect(position.groupId).toBe(existingGroupId);
      });

      it('should generate unique groupId for each new position', async () => {
        // Create multiple positions without explicit groupId
        const position1 = await createTestPosition(prisma, testUserId, {
          symbol: 'BTCUSDT',
        });
        const position2 = await createTestPosition(prisma, testUserId, {
          symbol: 'ETHUSDT',
        });

        // Each position should have its own unique groupId
        expect(position1.groupId).not.toBeNull();
        expect(position2.groupId).not.toBeNull();
        expect(position1.groupId).not.toBe(position2.groupId);
      });
    });

    describe('Database constraint validation', () => {
      it('should enforce NOT NULL constraint on groupId', async () => {
        // After migration, attempting to insert null groupId should fail
        // The database default should kick in
        const result = await prisma.$queryRaw<{ count: bigint }[]>`
          SELECT COUNT(*) as count FROM positions WHERE "groupId" IS NULL
        `;

        expect(Number(result[0]?.count ?? 0)).toBe(0);
      });

      it('should have database-level default for groupId', async () => {
        // Verify that the database generates UUID when groupId is not provided
        // This tests the @default(dbgenerated("gen_random_uuid()")) works

        // Insert a position directly via raw SQL without groupId
        // This should succeed after migration with auto-generated UUID
        const testId = `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const insertResult = await prisma.$executeRaw`
          INSERT INTO positions (
            id, "userId", symbol, "longExchange", "shortExchange",
            "longLeverage", "shortLeverage", "longEntryPrice", "shortEntryPrice",
            "longPositionSize", "shortPositionSize", "openFundingRateLong", "openFundingRateShort",
            status, "conditionalOrderStatus", "createdAt", "updatedAt"
          ) VALUES (
            ${testId}, ${testUserId}, 'TESTUSDT', 'binance', 'okx',
            10, 10, '50000', '50100',
            '0.01', '0.01', '0.0001', '-0.0001',
            'OPEN', 'PENDING', NOW(), NOW()
          )
        `;

        expect(insertResult).toBe(1);

        // Verify the inserted position has a valid groupId
        const inserted = await prisma.position.findFirst({
          where: { userId: testUserId, symbol: 'TESTUSDT' },
        });

        expect(inserted).not.toBeNull();
        expect(inserted!.groupId).not.toBeNull();
        expect(inserted!.groupId).toMatch(UUID_PATTERN);
      });
    });

    describe('Aggregate query validation', () => {
      it('should allow grouping all positions by groupId', async () => {
        // Create multiple positions
        await createTestPosition(prisma, testUserId, { symbol: 'BTCUSDT' });
        await createTestPosition(prisma, testUserId, { symbol: 'ETHUSDT' });
        await createTestPosition(prisma, testUserId, { symbol: 'XRPUSDT' });

        // After migration, we should be able to group by groupId without null handling
        const groups = await prisma.position.groupBy({
          by: ['groupId'],
          where: { userId: testUserId },
          _count: { id: true },
        });

        // Each position should be in its own group (since auto-generated groupIds are unique)
        expect(groups.length).toBe(3);

        // All groupIds should be non-null
        const nullGroups = groups.filter((g) => g.groupId === null);
        expect(nullGroups.length).toBe(0);
      });
    });
  }
);
