import { PrismaClient, ApiKey as PrismaApiKey } from '@prisma/client';
import { ApiKey, CreateApiKeyData } from '@models/ApiKey';
import { logger } from '@lib/logger';
import { DatabaseError, NotFoundError } from '@lib/errors';

/**
 * ApiKeyRepository
 * 處理 API Key 資料的持久化操作
 */

export class ApiKeyRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * 根據 ID 查詢 API Key
   */
  async findById(id: string): Promise<ApiKey | null> {
    try {
      const apiKey = await this.prisma.apiKey.findUnique({
        where: { id },
      });

      if (!apiKey) {
        return null;
      }

      return ApiKey.fromPrisma(apiKey);
    } catch (error) {
      logger.error({ error, apiKeyId: id }, 'Failed to find API key by ID');
      throw new DatabaseError('Failed to find API key', { apiKeyId: id });
    }
  }

  /**
   * 查詢用戶的所有 API Keys
   */
  async findByUserId(userId: string): Promise<ApiKey[]> {
    try {
      const apiKeys = await this.prisma.apiKey.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      return apiKeys.map(ApiKey.fromPrisma);
    } catch (error) {
      logger.error({ error, userId }, 'Failed to find API keys by user ID');
      throw new DatabaseError('Failed to find API keys', { userId });
    }
  }

  /**
   * 查詢用戶在特定交易所的 API Keys
   */
  async findByUserIdAndExchange(userId: string, exchange: string): Promise<ApiKey[]> {
    try {
      const apiKeys = await this.prisma.apiKey.findMany({
        where: {
          userId,
          exchange: exchange.toLowerCase(),
        },
        orderBy: { createdAt: 'desc' },
      });

      return apiKeys.map(ApiKey.fromPrisma);
    } catch (error) {
      logger.error({ error, userId, exchange }, 'Failed to find API keys by user ID and exchange');
      throw new DatabaseError('Failed to find API keys', { userId, exchange });
    }
  }

  /**
   * 查詢用戶在特定交易所的特定 Label 的 API Key
   */
  async findByUserIdExchangeAndLabel(
    userId: string,
    exchange: string,
    label: string,
  ): Promise<ApiKey | null> {
    try {
      const apiKey = await this.prisma.apiKey.findUnique({
        where: {
          userId_exchange_label: {
            userId,
            exchange: exchange.toLowerCase(),
            label,
          },
        },
      });

      if (!apiKey) {
        return null;
      }

      return ApiKey.fromPrisma(apiKey);
    } catch (error) {
      logger.error(
        { error, userId, exchange, label },
        'Failed to find API key by user ID, exchange, and label',
      );
      throw new DatabaseError('Failed to find API key', { userId, exchange, label });
    }
  }

  /**
   * 建立新 API Key
   */
  async create(data: CreateApiKeyData): Promise<ApiKey> {
    try {
      const apiKey = await this.prisma.apiKey.create({
        data: {
          userId: data.userId,
          exchange: data.exchange.toLowerCase(),
          environment: data.environment,
          label: data.label,
          encryptedKey: data.encryptedKey,
          encryptedSecret: data.encryptedSecret,
          encryptedPassphrase: data.encryptedPassphrase,
        },
      });

      logger.info(
        {
          apiKeyId: apiKey.id,
          userId: apiKey.userId,
          exchange: apiKey.exchange,
          label: apiKey.label,
        },
        'API key created successfully',
      );

      return ApiKey.fromPrisma(apiKey);
    } catch (error) {
      logger.error(
        {
          error,
          userId: data.userId,
          exchange: data.exchange,
          label: data.label,
        },
        'Failed to create API key',
      );

      // 檢查是否為唯一性約束錯誤
      if (error instanceof Error && error.message.includes('Unique constraint')) {
        throw new DatabaseError(
          'API key with this exchange and label already exists for this user',
          {
            userId: data.userId,
            exchange: data.exchange,
            label: data.label,
          },
        );
      }

      throw new DatabaseError('Failed to create API key', {
        userId: data.userId,
        exchange: data.exchange,
      });
    }
  }

  /**
   * 更新 API Key
   */
  async update(id: string, data: Partial<PrismaApiKey>): Promise<ApiKey> {
    try {
      const apiKey = await this.prisma.apiKey.update({
        where: { id },
        data,
      });

      logger.info({ apiKeyId: id }, 'API key updated successfully');

      return ApiKey.fromPrisma(apiKey);
    } catch (error) {
      logger.error({ error, apiKeyId: id }, 'Failed to update API key');

      if (error instanceof Error && error.message.includes('Record to update not found')) {
        throw new NotFoundError('ApiKey', id);
      }

      throw new DatabaseError('Failed to update API key', { apiKeyId: id });
    }
  }

  /**
   * 標記 API Key 為已驗證
   */
  async markAsValidated(id: string): Promise<ApiKey> {
    return this.update(id, {
      lastValidatedAt: new Date(),
    });
  }

  /**
   * 啟用/停用 API Key
   */
  async setActive(id: string, isActive: boolean): Promise<ApiKey> {
    return this.update(id, { isActive });
  }

  /**
   * 刪除 API Key
   */
  async delete(id: string): Promise<void> {
    try {
      await this.prisma.apiKey.delete({
        where: { id },
      });

      logger.info({ apiKeyId: id }, 'API key deleted successfully');
    } catch (error) {
      logger.error({ error, apiKeyId: id }, 'Failed to delete API key');

      if (error instanceof Error && error.message.includes('Record to delete does not exist')) {
        throw new NotFoundError('ApiKey', id);
      }

      throw new DatabaseError('Failed to delete API key', { apiKeyId: id });
    }
  }

  /**
   * 查詢所有啟用的 API Keys（用於監控服務）
   */
  async findAllActive(): Promise<ApiKey[]> {
    try {
      const apiKeys = await this.prisma.apiKey.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
      });

      return apiKeys.map(ApiKey.fromPrisma);
    } catch (error) {
      logger.error({ error }, 'Failed to find all active API keys');
      throw new DatabaseError('Failed to find all active API keys');
    }
  }
}
