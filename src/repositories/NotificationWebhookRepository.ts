import { PrismaClient, NotificationWebhook as PrismaWebhook } from '@/generated/prisma/client';
import { logger } from '@lib/logger';
import { DatabaseError, NotFoundError } from '@lib/errors';
import { encrypt, decrypt } from '@lib/encryption';
import type {
  NotificationPlatform,
  WebhookConfig,
  CreateWebhookRequest,
  UpdateWebhookRequest,
} from '../services/notification/types';

/**
 * NotificationWebhookRepository
 * 處理通知 Webhook 設定的持久化操作
 * Feature 026: Discord/Slack 套利機會即時推送通知
 * Feature 027: 套利機會結束監測和通知
 */
export class NotificationWebhookRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * 將 Prisma 模型轉換為 WebhookConfig
   */
  private toWebhookConfig(webhook: PrismaWebhook, decryptUrl = false): WebhookConfig {
    return {
      id: webhook.id,
      userId: webhook.userId,
      platform: webhook.platform as NotificationPlatform,
      webhookUrl: decryptUrl ? decrypt(webhook.webhookUrl) : webhook.webhookUrl,
      name: webhook.name,
      isEnabled: webhook.isEnabled,
      threshold: Number(webhook.threshold),
      notifyOnDisappear: webhook.notifyOnDisappear, // Feature 027
      notificationMinutes: webhook.notificationMinutes ?? [50], // 通知時間
    };
  }

  /**
   * 根據 ID 查詢 Webhook
   */
  async findById(id: string, decryptUrl = false): Promise<WebhookConfig | null> {
    try {
      const webhook = await this.prisma.notificationWebhook.findUnique({
        where: { id },
      });

      if (!webhook) {
        return null;
      }

      return this.toWebhookConfig(webhook, decryptUrl);
    } catch (error) {
      logger.error({ error, webhookId: id }, 'Failed to find webhook by ID');
      throw new DatabaseError('Failed to find webhook', { webhookId: id });
    }
  }

  /**
   * 查詢用戶的所有 Webhooks
   */
  async findByUserId(userId: string): Promise<WebhookConfig[]> {
    try {
      const webhooks = await this.prisma.notificationWebhook.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      return webhooks.map((w) => this.toWebhookConfig(w, false));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ error, errorMessage, userId }, 'Failed to find webhooks by user ID');
      throw new DatabaseError(`Failed to find webhooks: ${errorMessage}`, { userId });
    }
  }

  /**
   * 查詢用戶所有啟用的 Webhooks（含解密的 URL）
   */
  async findEnabledByUserId(userId: string): Promise<WebhookConfig[]> {
    try {
      const webhooks = await this.prisma.notificationWebhook.findMany({
        where: {
          userId,
          isEnabled: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return webhooks.map((w) => this.toWebhookConfig(w, true));
    } catch (error) {
      logger.error({ error, userId }, 'Failed to find enabled webhooks');
      throw new DatabaseError('Failed to find enabled webhooks', { userId });
    }
  }

  /**
   * 查詢所有啟用的 Webhooks（供通知服務使用）
   */
  async findAllEnabled(): Promise<WebhookConfig[]> {
    try {
      const webhooks = await this.prisma.notificationWebhook.findMany({
        where: { isEnabled: true },
      });

      return webhooks.map((w) => this.toWebhookConfig(w, true));
    } catch (error) {
      logger.error({ error }, 'Failed to find all enabled webhooks');
      throw new DatabaseError('Failed to find enabled webhooks');
    }
  }

  /**
   * 建立新的 Webhook
   */
  async create(userId: string, data: CreateWebhookRequest): Promise<WebhookConfig> {
    try {
      const encryptedUrl = encrypt(data.webhookUrl);

      const webhook = await this.prisma.notificationWebhook.create({
        data: {
          userId,
          platform: data.platform,
          webhookUrl: encryptedUrl,
          name: data.name,
          threshold: data.threshold ?? 800,
          isEnabled: true,
          notifyOnDisappear: data.notifyOnDisappear ?? true, // Feature 027
          notificationMinutes: data.notificationMinutes ?? [50], // 通知時間
        },
      });

      logger.info(
        { webhookId: webhook.id, userId, platform: data.platform },
        'Webhook created successfully'
      );

      return this.toWebhookConfig(webhook, false);
    } catch (error) {
      logger.error({ error, userId, platform: data.platform }, 'Failed to create webhook');
      throw new DatabaseError('Failed to create webhook', { userId });
    }
  }

  /**
   * 更新 Webhook
   */
  async update(id: string, userId: string, data: UpdateWebhookRequest): Promise<WebhookConfig> {
    try {
      // 驗證 Webhook 存在且屬於該用戶
      const existing = await this.prisma.notificationWebhook.findFirst({
        where: { id, userId },
      });

      if (!existing) {
        throw new NotFoundError('Webhook not found');
      }

      const updateData: Record<string, unknown> = {};

      if (data.name !== undefined) {
        updateData.name = data.name;
      }
      if (data.isEnabled !== undefined) {
        updateData.isEnabled = data.isEnabled;
      }
      if (data.threshold !== undefined) {
        updateData.threshold = data.threshold;
      }
      if (data.webhookUrl !== undefined) {
        updateData.webhookUrl = encrypt(data.webhookUrl);
      }
      if (data.notifyOnDisappear !== undefined) {
        updateData.notifyOnDisappear = data.notifyOnDisappear; // Feature 027
      }
      if (data.notificationMinutes !== undefined) {
        updateData.notificationMinutes = data.notificationMinutes; // 通知時間
      }

      const webhook = await this.prisma.notificationWebhook.update({
        where: { id },
        data: updateData,
      });

      logger.info({ webhookId: id, userId }, 'Webhook updated successfully');

      return this.toWebhookConfig(webhook, false);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error({ error, webhookId: id, userId }, 'Failed to update webhook');
      throw new DatabaseError('Failed to update webhook', { webhookId: id });
    }
  }

  /**
   * 刪除 Webhook
   */
  async delete(id: string, userId: string): Promise<boolean> {
    try {
      // 驗證 Webhook 存在且屬於該用戶
      const existing = await this.prisma.notificationWebhook.findFirst({
        where: { id, userId },
      });

      if (!existing) {
        throw new NotFoundError('Webhook not found');
      }

      await this.prisma.notificationWebhook.delete({
        where: { id },
      });

      logger.info({ webhookId: id, userId }, 'Webhook deleted successfully');

      return true;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error({ error, webhookId: id, userId }, 'Failed to delete webhook');
      throw new DatabaseError('Failed to delete webhook', { webhookId: id });
    }
  }
}
