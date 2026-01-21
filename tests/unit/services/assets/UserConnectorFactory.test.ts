/**
 * UserConnectorFactory 測試
 *
 * 測試用戶連接器工廠的核心功能
 *
 * 注意：此檔案測試 UserConnectorFactory 的 API Key 處理邏輯
 * UserConnector 類別的實際交易所連線由整合測試覆蓋
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// 使用 vi.hoisted 確保 mock 變數在 mock 定義前可用
const { mockGetUserApiKeys, mockDecrypt } = vi.hoisted(() => ({
  mockGetUserApiKeys: vi.fn(),
  mockDecrypt: vi.fn((value: string) => `decrypted_${value}`),
}));

// Mock ApiKeyService
vi.mock('@/services/apikey/ApiKeyService', () => ({
  ApiKeyService: class MockApiKeyService {
    getUserApiKeys = mockGetUserApiKeys;
  },
}));

// Mock 加密函數
vi.mock('@lib/encryption', () => ({
  decrypt: mockDecrypt,
}));

// Mock logger
vi.mock('@lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock env
vi.mock('@lib/env', () => ({
  getProxyUrl: vi.fn(() => undefined),
}));

// Mock undici ProxyAgent
vi.mock('undici', () => ({
  ProxyAgent: vi.fn().mockImplementation(() => ({})),
}));

// Mock ccxt 模組
vi.mock('ccxt', () => {
  const createMockExchange = () => {
    return class MockExchange {
      options: Record<string, unknown> = {};
      fetchBalance = vi.fn().mockResolvedValue({
        total: { USDT: 1000 },
        free: { USDT: 800 },
      });
      fetchPositions = vi.fn().mockResolvedValue([]);
    };
  };

  return {
    default: {
      okx: createMockExchange(),
      mexc: createMockExchange(),
      gateio: createMockExchange(),
      bingx: createMockExchange(),
    },
  };
});

// Mock fetch for Binance (使用原生 fetch API)
const mockFetch = vi.fn();
global.fetch = mockFetch;

import { UserConnectorFactory } from '@/services/assets/UserConnectorFactory';
import type { PrismaClient } from '@/generated/prisma/client';
import { getProxyUrl } from '@lib/env';

describe('UserConnectorFactory', () => {
  let factory: UserConnectorFactory;
  let mockPrisma: PrismaClient;

  beforeEach(() => {
    vi.clearAllMocks();

    // 重設 mock 預設值
    mockGetUserApiKeys.mockResolvedValue([]);
    mockDecrypt.mockImplementation((value: string) => `decrypted_${value}`);

    // 創建 mock PrismaClient 物件
    mockPrisma = {} as PrismaClient;
    factory = new UserConnectorFactory(mockPrisma);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getBalancesForUser', () => {
    it('沒有 API Key 時應返回 no_api_key 狀態', async () => {
      mockGetUserApiKeys.mockResolvedValue([]);

      const results = await factory.getBalancesForUser('user-123');

      expect(results).toHaveLength(5); // 5 個支援的交易所
      expect(results.every((r) => r.status === 'no_api_key')).toBe(true);
      expect(results.every((r) => r.balanceUSD === null)).toBe(true);
    });

    it('不活躍的 API Key 應被過濾', async () => {
      mockGetUserApiKeys.mockResolvedValue([
        {
          exchange: 'okx',
          encryptedKey: 'encrypted_key',
          encryptedSecret: 'encrypted_secret',
          isActive: false, // 不活躍
          environment: 'MAINNET',
        },
      ]);

      const results = await factory.getBalancesForUser('user-123');

      const okxResult = results.find((r) => r.exchange === 'okx');
      expect(okxResult?.status).toBe('no_api_key');
    });

    it('解密失敗時應跳過該 API Key 並記錄錯誤', async () => {
      mockDecrypt.mockImplementationOnce(() => {
        throw new Error('Decryption failed');
      });

      mockGetUserApiKeys.mockResolvedValue([
        {
          exchange: 'okx',
          encryptedKey: 'bad_encrypted_key',
          encryptedSecret: 'encrypted_secret',
          isActive: true,
          environment: 'MAINNET',
        },
      ]);

      const results = await factory.getBalancesForUser('user-123');

      const okxResult = results.find((r) => r.exchange === 'okx');
      expect(okxResult?.status).toBe('no_api_key');

      // 驗證錯誤被記錄
      const { logger } = await import('@lib/logger');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getPositionsForUser', () => {
    it('沒有 API Key 時應返回空持倉', async () => {
      mockGetUserApiKeys.mockResolvedValue([]);

      const results = await factory.getPositionsForUser('user-123');

      expect(results).toHaveLength(5);
      expect(results.every((r) => r.status === 'no_api_key')).toBe(true);
      expect(results.every((r) => r.positions.length === 0)).toBe(true);
    });
  });

  describe('支援的交易所', () => {
    it('應該支援 5 個交易所', async () => {
      mockGetUserApiKeys.mockResolvedValue([]);

      const results = await factory.getBalancesForUser('user-123');

      const exchanges = results.map((r) => r.exchange);
      expect(exchanges).toContain('binance');
      expect(exchanges).toContain('okx');
      expect(exchanges).toContain('mexc');
      expect(exchanges).toContain('gateio');
      expect(exchanges).toContain('bingx');
    });
  });

  describe('API Key 處理', () => {
    it('應該呼叫 ApiKeyService.getUserApiKeys', async () => {
      mockGetUserApiKeys.mockResolvedValue([]);

      await factory.getBalancesForUser('user-123');

      expect(mockGetUserApiKeys).toHaveBeenCalledWith('user-123');
    });

    it('應該只處理活躍的 API Key', async () => {
      mockGetUserApiKeys.mockResolvedValue([
        {
          exchange: 'binance',
          encryptedKey: 'key1',
          encryptedSecret: 'secret1',
          isActive: true,
          environment: 'MAINNET',
        },
        {
          exchange: 'okx',
          encryptedKey: 'key2',
          encryptedSecret: 'secret2',
          isActive: false, // 不活躍
          environment: 'MAINNET',
        },
      ]);

      const results = await factory.getBalancesForUser('user-123');

      // binance 有活躍的 API Key
      const binanceResult = results.find((r) => r.exchange === 'binance');
      expect(binanceResult?.status).not.toBe('no_api_key');

      // okx 沒有活躍的 API Key
      const okxResult = results.find((r) => r.exchange === 'okx');
      expect(okxResult?.status).toBe('no_api_key');
    });

    it('應該解密 API Key 和 Secret', async () => {
      mockGetUserApiKeys.mockResolvedValue([
        {
          exchange: 'okx',
          encryptedKey: 'encrypted_api_key',
          encryptedSecret: 'encrypted_api_secret',
          encryptedPassphrase: 'encrypted_passphrase',
          isActive: true,
          environment: 'MAINNET',
        },
      ]);

      await factory.getBalancesForUser('user-123');

      // 驗證 decrypt 被呼叫了 3 次（key, secret, passphrase）
      expect(mockDecrypt).toHaveBeenCalledWith('encrypted_api_key');
      expect(mockDecrypt).toHaveBeenCalledWith('encrypted_api_secret');
      expect(mockDecrypt).toHaveBeenCalledWith('encrypted_passphrase');
    });
  });

  describe('錯誤處理', () => {
    it('單一交易所錯誤不應影響其他交易所', async () => {
      // 第一次 decrypt 拋出錯誤（模擬 binance）
      mockDecrypt.mockImplementationOnce(() => {
        throw new Error('Decryption error');
      });
      // 後續 decrypt 正常
      mockDecrypt.mockImplementation((v: string) => `decrypted_${v}`);

      mockGetUserApiKeys.mockResolvedValue([
        {
          exchange: 'binance',
          encryptedKey: 'bad_key',
          encryptedSecret: 'secret',
          isActive: true,
          environment: 'MAINNET',
        },
        {
          exchange: 'okx',
          encryptedKey: 'good_key',
          encryptedSecret: 'good_secret',
          encryptedPassphrase: 'passphrase',
          isActive: true,
          environment: 'MAINNET',
        },
      ]);

      const results = await factory.getBalancesForUser('user-123');

      // binance 應該是 no_api_key（因為解密失敗）
      const binanceResult = results.find((r) => r.exchange === 'binance');
      expect(binanceResult?.status).toBe('no_api_key');

      // okx 應該嘗試連線（不是 no_api_key）
      const okxResult = results.find((r) => r.exchange === 'okx');
      // OKX 可能是 success 或 api_error，但不應該是 no_api_key
      expect(okxResult?.status).not.toBe('no_api_key');
    });
  });
});
