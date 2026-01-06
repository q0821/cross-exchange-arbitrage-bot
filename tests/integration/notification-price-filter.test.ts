/**
 * Integration tests for Feature 057: Notification Price Filter
 *
 * Tests for:
 * - T014/T015: US1 - Edit webhook with requireFavorablePrice
 * - T022/T023: US2 - Backward compatibility (existing webhooks)
 * - T027/T028: US3 - Create webhook with requireFavorablePrice
 *
 * Note: These tests require a database connection.
 * Run with: RUN_INTEGRATION_TESTS=true pnpm test tests/integration/notification-price-filter.test.ts
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { createPrismaClient } from '@lib/prisma-factory';
import { NotificationWebhookRepository } from '@/repositories/NotificationWebhookRepository';
import type { CreateWebhookRequest } from '@/services/notification/types';

// Skip if not running integration tests
const shouldRunIntegrationTests = process.env.RUN_INTEGRATION_TESTS === 'true';

describe.skipIf(!shouldRunIntegrationTests)('Feature 057: Notification Price Filter Integration', () => {
  let prisma: PrismaClient;
  let repository: NotificationWebhookRepository;
  let testUserId: string;
  let createdWebhookIds: string[] = [];

  beforeAll(async () => {
    prisma = createPrismaClient();
    repository = new NotificationWebhookRepository(prisma);

    // Create a test user
    const user = await prisma.user.create({
      data: {
        email: `test-price-filter-${Date.now()}@test.com`,
        password: 'test-password-hash', // Dummy password for testing
      },
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    // Cleanup: Delete all created webhooks
    for (const id of createdWebhookIds) {
      try {
        await prisma.notificationWebhook.delete({ where: { id } });
      } catch {
        // Ignore if already deleted
      }
    }

    // Delete test user
    try {
      await prisma.user.delete({ where: { id: testUserId } });
    } catch {
      // Ignore if already deleted
    }

    await prisma.$disconnect();
  });

  /**
   * US1: 編輯 Webhook 啟用價差過濾
   */
  describe('US1: Edit webhook with price filter', () => {
    /**
     * T014: 更新 webhook 時可以設定 requireFavorablePrice
     */
    it('T014: should update webhook with requireFavorablePrice=true', async () => {
      // Create a webhook first
      const createData: CreateWebhookRequest = {
        platform: 'discord',
        webhookUrl: 'https://discord.com/api/webhooks/test',
        name: 'Test Webhook for Update',
        threshold: 800,
      };
      const created = await repository.create(testUserId, createData);
      createdWebhookIds.push(created.id);

      // Initially, requireFavorablePrice should be false (default)
      expect(created.requireFavorablePrice).toBe(false);

      // Update to enable price filter
      const updated = await repository.update(created.id, testUserId, {
        requireFavorablePrice: true,
      });

      expect(updated.requireFavorablePrice).toBe(true);

      // Verify it persists
      const fetched = await repository.findById(created.id);
      expect(fetched?.requireFavorablePrice).toBe(true);
    });

    /**
     * T014: 可以將 requireFavorablePrice 從 true 改回 false
     */
    it('T014: should update webhook to disable price filter', async () => {
      // Create with filter enabled
      const createData: CreateWebhookRequest = {
        platform: 'discord',
        webhookUrl: 'https://discord.com/api/webhooks/test2',
        name: 'Test Webhook Enable then Disable',
        requireFavorablePrice: true,
      };
      const created = await repository.create(testUserId, createData);
      createdWebhookIds.push(created.id);

      // Initially enabled
      expect(created.requireFavorablePrice).toBe(true);

      // Disable price filter
      const updated = await repository.update(created.id, testUserId, {
        requireFavorablePrice: false,
      });

      expect(updated.requireFavorablePrice).toBe(false);
    });

    /**
     * T015: findAllEnabled 返回的 webhook 包含 requireFavorablePrice
     * Note: Using findEnabledByUserId to avoid issues with other test data in database
     */
    it('T015: should include requireFavorablePrice in findAllEnabled results', async () => {
      // Create a webhook with filter enabled
      const createData: CreateWebhookRequest = {
        platform: 'slack',
        webhookUrl: 'https://hooks.slack.com/test',
        name: 'Test Webhook for findAllEnabled',
        requireFavorablePrice: true,
      };
      const created = await repository.create(testUserId, createData);
      createdWebhookIds.push(created.id);

      // Fetch enabled webhooks for this test user (avoids conflicts with other data)
      const enabledWebhooks = await repository.findEnabledByUserId(testUserId);

      // Find our webhook
      const ourWebhook = enabledWebhooks.find((w) => w.id === created.id);
      expect(ourWebhook).toBeDefined();
      expect(ourWebhook?.requireFavorablePrice).toBe(true);
    });
  });

  /**
   * US2: 後向兼容性
   */
  describe('US2: Backward compatibility', () => {
    /**
     * T022: 新建 webhook 不指定 requireFavorablePrice 時預設為 false
     */
    it('T022: should default requireFavorablePrice to false for new webhooks', async () => {
      const createData: CreateWebhookRequest = {
        platform: 'discord',
        webhookUrl: 'https://discord.com/api/webhooks/backward-compat',
        name: 'Backward Compat Test',
        // Note: not specifying requireFavorablePrice
      };
      const created = await repository.create(testUserId, createData);
      createdWebhookIds.push(created.id);

      expect(created.requireFavorablePrice).toBe(false);
    });

    /**
     * T023: 更新 webhook 其他欄位時不影響 requireFavorablePrice
     */
    it('T023: should not affect requireFavorablePrice when updating other fields', async () => {
      // Create with default (false)
      const createData: CreateWebhookRequest = {
        platform: 'discord',
        webhookUrl: 'https://discord.com/api/webhooks/partial-update',
        name: 'Partial Update Test',
      };
      const created = await repository.create(testUserId, createData);
      createdWebhookIds.push(created.id);

      expect(created.requireFavorablePrice).toBe(false);

      // Update only threshold
      const updated = await repository.update(created.id, testUserId, {
        threshold: 1000,
      });

      // requireFavorablePrice should still be false
      expect(updated.requireFavorablePrice).toBe(false);
      expect(updated.threshold).toBe(1000);
    });
  });

  /**
   * US3: 新建 Webhook 時設定價差過濾
   */
  describe('US3: Create webhook with price filter', () => {
    /**
     * T027: 新建時可以設定 requireFavorablePrice=true
     */
    it('T027: should create webhook with requireFavorablePrice=true', async () => {
      const createData: CreateWebhookRequest = {
        platform: 'discord',
        webhookUrl: 'https://discord.com/api/webhooks/create-with-filter',
        name: 'Create With Filter Test',
        requireFavorablePrice: true,
      };
      const created = await repository.create(testUserId, createData);
      createdWebhookIds.push(created.id);

      expect(created.requireFavorablePrice).toBe(true);

      // Verify persistence
      const fetched = await repository.findById(created.id);
      expect(fetched?.requireFavorablePrice).toBe(true);
    });

    /**
     * T028: 新建時明確設定 requireFavorablePrice=false
     */
    it('T028: should create webhook with explicit requireFavorablePrice=false', async () => {
      const createData: CreateWebhookRequest = {
        platform: 'slack',
        webhookUrl: 'https://hooks.slack.com/create-without-filter',
        name: 'Create Without Filter Test',
        requireFavorablePrice: false,
      };
      const created = await repository.create(testUserId, createData);
      createdWebhookIds.push(created.id);

      expect(created.requireFavorablePrice).toBe(false);
    });
  });
});
