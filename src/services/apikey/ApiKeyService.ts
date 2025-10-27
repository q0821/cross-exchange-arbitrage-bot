import { PrismaClient } from '@prisma/client';
import { ApiKey, CreateApiKeyData, DecryptedApiKey } from '@models/ApiKey';
import { ApiKeyRepository } from '../../repositories/ApiKeyRepository';
import { encrypt, decrypt } from '@lib/encryption';
import { logger } from '@lib/logger';
import { ValidationError, NotFoundError, UnauthorizedError } from '@lib/errors';

/**
 * ApiKeyService
 * 處理 API Key 相關的業務邏輯
 */

export interface CreateApiKeyRequest {
  userId: string;
  exchange: string;
  label: string;
  apiKey: string;
  apiSecret: string;
  passphrase?: string;
}

export class ApiKeyService {
  private readonly apiKeyRepository: ApiKeyRepository;

  constructor(prisma: PrismaClient) {
    this.apiKeyRepository = new ApiKeyRepository(prisma);
  }

  /**
   * 建立新 API Key
   */
  async createApiKey(request: CreateApiKeyRequest): Promise<ApiKey> {
    const { userId, exchange, label, apiKey, apiSecret, passphrase } = request;

    // 1. 驗證交易所名稱
    const exchangeValidation = ApiKey.validateExchange(exchange);
    if (!exchangeValidation.valid) {
      logger.warn({ userId, exchange }, 'Invalid exchange during API key creation');
      throw new ValidationError(exchangeValidation.message || 'Invalid exchange');
    }

    // 2. 驗證 Label 格式
    const labelValidation = ApiKey.validateLabel(label);
    if (!labelValidation.valid) {
      logger.warn({ userId, label }, 'Invalid label during API key creation');
      throw new ValidationError(labelValidation.message || 'Invalid label');
    }

    // 3. 檢查是否已存在相同的 exchange + label
    const existingApiKey = await this.apiKeyRepository.findByUserIdExchangeAndLabel(
      userId,
      exchange,
      label,
    );

    if (existingApiKey) {
      logger.warn(
        { userId, exchange, label },
        'API key with same exchange and label already exists',
      );
      throw new ValidationError(
        `API key with exchange "${exchange}" and label "${label}" already exists`,
      );
    }

    // 4. 加密 API Key 和 Secret
    const encryptedKey = encrypt(apiKey);
    const encryptedSecret = encrypt(apiSecret);
    const encryptedPassphrase = passphrase ? encrypt(passphrase) : undefined;

    // 5. 建立 API Key
    const apiKeyData: CreateApiKeyData = {
      userId,
      exchange,
      label,
      encryptedKey,
      encryptedSecret,
      encryptedPassphrase,
    };

    const createdApiKey = await this.apiKeyRepository.create(apiKeyData);

    logger.info(
      {
        apiKeyId: createdApiKey.id,
        userId,
        exchange,
        label,
      },
      'API key created successfully',
    );

    return createdApiKey;
  }

  /**
   * 查詢用戶的所有 API Keys
   */
  async getUserApiKeys(userId: string): Promise<ApiKey[]> {
    return this.apiKeyRepository.findByUserId(userId);
  }

  /**
   * 根據 ID 查詢 API Key
   */
  async getApiKeyById(apiKeyId: string, userId: string): Promise<ApiKey> {
    const apiKey = await this.apiKeyRepository.findById(apiKeyId);

    if (!apiKey) {
      logger.warn({ apiKeyId, userId }, 'API key not found');
      throw new NotFoundError('ApiKey', apiKeyId);
    }

    // 驗證 API Key 是否屬於該用戶
    if (apiKey.userId !== userId) {
      logger.warn(
        {
          apiKeyId,
          userId,
          ownerId: apiKey.userId,
        },
        'Unauthorized access to API key',
      );
      throw new UnauthorizedError('You do not have permission to access this API key');
    }

    return apiKey;
  }

  /**
   * 解密 API Key
   */
  async decryptApiKey(apiKeyId: string, userId: string): Promise<DecryptedApiKey> {
    const apiKey = await this.getApiKeyById(apiKeyId, userId);

    try {
      const decryptedKey = decrypt(apiKey.encryptedKey);
      const decryptedSecret = decrypt(apiKey.encryptedSecret);
      const decryptedPassphrase = apiKey.encryptedPassphrase
        ? decrypt(apiKey.encryptedPassphrase)
        : undefined;

      return {
        apiKey: decryptedKey,
        apiSecret: decryptedSecret,
        passphrase: decryptedPassphrase,
      };
    } catch (error) {
      logger.error(
        {
          error,
          apiKeyId,
          userId,
        },
        'Failed to decrypt API key',
      );
      throw new ValidationError('Failed to decrypt API key');
    }
  }

  /**
   * 刪除 API Key
   */
  async deleteApiKey(apiKeyId: string, userId: string): Promise<void> {
    // 先驗證權限
    await this.getApiKeyById(apiKeyId, userId);

    await this.apiKeyRepository.delete(apiKeyId);

    logger.info(
      {
        apiKeyId,
        userId,
      },
      'API key deleted successfully',
    );
  }

  /**
   * 啟用/停用 API Key
   */
  async setApiKeyActive(
    apiKeyId: string,
    userId: string,
    isActive: boolean,
  ): Promise<ApiKey> {
    // 先驗證權限
    await this.getApiKeyById(apiKeyId, userId);

    const updatedApiKey = await this.apiKeyRepository.setActive(apiKeyId, isActive);

    logger.info(
      {
        apiKeyId,
        userId,
        isActive,
      },
      'API key active status updated',
    );

    return updatedApiKey;
  }

  /**
   * 標記 API Key 為已驗證
   */
  async markAsValidated(apiKeyId: string, userId: string): Promise<ApiKey> {
    // 先驗證權限
    await this.getApiKeyById(apiKeyId, userId);

    return this.apiKeyRepository.markAsValidated(apiKeyId);
  }

  /**
   * 驗證 API Key 是否有效（連線測試）
   * TODO: 實作與交易所的實際連線測試
   */
  async validateApiKey(apiKeyId: string, userId: string): Promise<boolean> {
    const apiKey = await this.getApiKeyById(apiKeyId, userId);
    const decrypted = await this.decryptApiKey(apiKeyId, userId);

    // TODO: 根據 exchange 類型，呼叫對應的 CCXT 客戶端進行連線測試
    // 暫時返回 true，待後續實作交易所連線測試
    logger.info(
      {
        apiKeyId,
        userId,
        exchange: apiKey.exchange,
      },
      'API key validation test (placeholder)',
    );

    // 標記為已驗證
    await this.markAsValidated(apiKeyId, userId);

    return true;
  }
}
