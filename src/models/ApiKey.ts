import { ApiKey as PrismaApiKey } from '@/generated/prisma/client';

/**
 * ApiKey 領域模型
 * 封裝 API Key 相關的業務邏輯
 */

export interface CreateApiKeyData {
  userId: string;
  exchange: string;
  environment: 'MAINNET' | 'TESTNET';
  label: string;
  encryptedKey: string;
  encryptedSecret: string;
  encryptedPassphrase?: string;
}

export interface ApiKeyDTO {
  id: string;
  userId: string;
  exchange: string;
  environment: string;
  label: string;
  maskedKey: string;
  isActive: boolean;
  lastValidatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DecryptedApiKey {
  apiKey: string;
  apiSecret: string;
  passphrase?: string;
}

/**
 * ApiKey 領域模型類別
 */
export class ApiKey {
  readonly id: string;
  readonly userId: string;
  readonly exchange: string;
  readonly environment: string;
  readonly label: string;
  readonly encryptedKey: string;
  readonly encryptedSecret: string;
  readonly encryptedPassphrase: string | null;
  readonly isActive: boolean;
  readonly lastValidatedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(data: PrismaApiKey) {
    this.id = data.id;
    this.userId = data.userId;
    this.exchange = data.exchange;
    this.environment = data.environment;
    this.label = data.label;
    this.encryptedKey = data.encryptedKey;
    this.encryptedSecret = data.encryptedSecret;
    this.encryptedPassphrase = data.encryptedPassphrase;
    this.isActive = data.isActive;
    this.lastValidatedAt = data.lastValidatedAt;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  /**
   * 遮罩 API Key 顯示
   * 例如: "kMzF****dE2p" (顯示前 4 位和後 4 位)
   */
  getMaskedKey(decryptedKey: string): string {
    if (decryptedKey.length <= 8) {
      return '****';
    }

    const firstPart = decryptedKey.slice(0, 4);
    const lastPart = decryptedKey.slice(-4);
    const maskLength = Math.min(decryptedKey.length - 8, 8);

    return `${firstPart}${'*'.repeat(maskLength)}${lastPart}`;
  }

  /**
   * 轉換為 DTO（不包含加密後的密鑰，包含遮罩後的 Key）
   * 注意：需要傳入解密後的 Key 來產生遮罩
   */
  toDTO(decryptedKey?: string): ApiKeyDTO {
    return {
      id: this.id,
      userId: this.userId,
      exchange: this.exchange,
      environment: this.environment,
      label: this.label,
      maskedKey: decryptedKey ? this.getMaskedKey(decryptedKey) : '****',
      isActive: this.isActive,
      lastValidatedAt: this.lastValidatedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * 檢查 API Key 是否可用
   */
  isUsable(): boolean {
    return this.isActive;
  }

  /**
   * 檢查是否需要重新驗證
   * 如果超過 24 小時未驗證，則需要重新驗證
   */
  needsRevalidation(): boolean {
    if (!this.lastValidatedAt) {
      return true;
    }

    const now = new Date();
    const dayInMs = 24 * 60 * 60 * 1000;
    const timeSinceLastValidation = now.getTime() - this.lastValidatedAt.getTime();

    return timeSinceLastValidation > dayInMs;
  }

  /**
   * 靜態方法：驗證交易所名稱
   */
  static validateExchange(exchange: string): { valid: boolean; message?: string } {
    const supportedExchanges = ['binance', 'okx', 'bybit', 'mexc', 'gateio', 'bingx'];

    if (!supportedExchanges.includes(exchange.toLowerCase())) {
      return {
        valid: false,
        message: `Unsupported exchange. Supported exchanges: ${supportedExchanges.join(', ')}`,
      };
    }

    return { valid: true };
  }

  /**
   * 靜態方法：驗證 Label 格式
   */
  static validateLabel(label: string): { valid: boolean; message?: string } {
    if (label.length < 1 || label.length > 100) {
      return {
        valid: false,
        message: 'Label must be between 1 and 100 characters',
      };
    }

    return { valid: true };
  }

  /**
   * 靜態方法：從 Prisma ApiKey 建立領域模型
   */
  static fromPrisma(data: PrismaApiKey): ApiKey {
    return new ApiKey(data);
  }
}
