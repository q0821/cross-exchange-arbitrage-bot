/**
 * FundingPnLCalculator Unit Tests
 *
 * Feature: 067-position-exit-monitor
 * Phase: 2 - User Story 1
 *
 * 測試累計費率收益計算：
 * - getCumulativeFundingPnL() 計算正確
 * - 5 分鐘 TTL 快取機制
 * - 多方/空方收益加總
 */

// @vitest-environment node
// 需要 node 環境避免 CCXT 的 noble-hashes 在 jsdom 中初始化失敗

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Decimal } from 'decimal.js';

// Use vi.hoisted to define mock functions before vi.mock is hoisted
const { mockFetchFundingHistory, mockPositionUpdate, mockCreateExchangeConnector } = vi.hoisted(() => {
  const fetchFundingHistory = vi.fn();
  const createConnector = vi.fn(() => ({
    fetchFundingHistory,
  }));
  return {
    mockFetchFundingHistory: fetchFundingHistory,
    mockPositionUpdate: vi.fn(),
    mockCreateExchangeConnector: createConnector,
  };
});

// Mock CCXT exchange connector - 必須在動態 import 之前設定
vi.mock('@/lib/exchange-connector-factory', () => ({
  createExchangeConnector: mockCreateExchangeConnector,
  // 也 export 預設值以防萬一
  default: {
    createExchangeConnector: mockCreateExchangeConnector,
  },
}));

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    position: {
      update: mockPositionUpdate,
    },
  },
}));

// Mock logger to suppress output
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Import after mocks
import {
  getCumulativeFundingPnL,
  calculateTotalFundingPnL,
  isCacheValid,
} from '@/lib/funding-pnl-calculator';

describe('FundingPnLCalculator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // 建立測試用的持倉
  const createPosition = (overrides = {}) => ({
    id: 'position-test-001',
    userId: 'user-test-001',
    symbol: 'BTCUSDT',
    longExchange: 'binance',
    shortExchange: 'okx',
    longEntryPrice: new Decimal('65000.00'),
    shortEntryPrice: new Decimal('65050.00'),
    longPositionSize: new Decimal('0.01'),
    shortPositionSize: new Decimal('0.01'),
    openedAt: new Date('2026-01-20T10:00:00Z'),
    cachedFundingPnL: null,
    cachedFundingPnLUpdatedAt: null,
    ...overrides,
  });

  // 建立測試用的 API Key 資訊
  const createApiKeyInfo = (exchange: string) => ({
    exchange,
    apiKey: 'test-api-key',
    apiSecret: 'test-api-secret',
    passphrase: exchange === 'okx' ? 'test-passphrase' : undefined,
    isTestnet: false,
  });

  describe('getCumulativeFundingPnL()', () => {
    it('應該正確計算多方和空方的累計費率收益', async () => {
      const position = createPosition();
      const apiKeys = {
        binance: createApiKeyInfo('binance'),
        okx: createApiKeyInfo('okx'),
      };

      // Mock 多方收益：+5 USDT（Binance 收到資金費率）
      // Mock 空方收益：+8 USDT（OKX 收到資金費率）
      mockFetchFundingHistory
        .mockResolvedValueOnce([
          { amount: 3, timestamp: Date.now() - 8 * 60 * 60 * 1000 },
          { amount: 2, timestamp: Date.now() - 16 * 60 * 60 * 1000 },
        ])
        .mockResolvedValueOnce([
          { amount: 5, timestamp: Date.now() - 8 * 60 * 60 * 1000 },
          { amount: 3, timestamp: Date.now() - 16 * 60 * 60 * 1000 },
        ]);

      const result = await getCumulativeFundingPnL(position as any, apiKeys as any);

      // 總計：5 + 8 = 13 USDT
      expect(result.toNumber()).toBeCloseTo(13, 2);
    });

    it('應該處理負收益（支付資金費率）', async () => {
      const position = createPosition();
      const apiKeys = {
        binance: createApiKeyInfo('binance'),
        okx: createApiKeyInfo('okx'),
      };

      // Mock 多方收益：-3 USDT（Binance 支付資金費率）
      // Mock 空方收益：+10 USDT（OKX 收到資金費率）
      mockFetchFundingHistory
        .mockResolvedValueOnce([{ amount: -3, timestamp: Date.now() }])
        .mockResolvedValueOnce([{ amount: 10, timestamp: Date.now() }]);

      const result = await getCumulativeFundingPnL(position as any, apiKeys as any);

      // 總計：-3 + 10 = 7 USDT
      expect(result.toNumber()).toBeCloseTo(7, 2);
    });

    it('沒有資金費率記錄時應該返回 0', async () => {
      const position = createPosition();
      const apiKeys = {
        binance: createApiKeyInfo('binance'),
        okx: createApiKeyInfo('okx'),
      };

      mockFetchFundingHistory.mockResolvedValue([]);

      const result = await getCumulativeFundingPnL(position as any, apiKeys as any);

      expect(result.toNumber()).toBe(0);
    });

    it('應該只計算開倉後的資金費率', async () => {
      const position = createPosition({
        openedAt: new Date('2026-01-21T00:00:00Z'),
      });
      const apiKeys = {
        binance: createApiKeyInfo('binance'),
        okx: createApiKeyInfo('okx'),
      };

      // 驗證 fetchFundingHistory 呼叫時帶有正確的 since 參數
      mockFetchFundingHistory.mockResolvedValue([]);

      await getCumulativeFundingPnL(position as any, apiKeys as any);

      expect(mockFetchFundingHistory).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          since: expect.any(Number),
        })
      );
    });
  });

  describe('快取機制', () => {
    it('快取未過期時應該使用快取值', async () => {
      const now = new Date('2026-01-21T10:00:00Z');
      vi.setSystemTime(now);

      const position = createPosition({
        cachedFundingPnL: new Decimal('15.50'),
        cachedFundingPnLUpdatedAt: new Date('2026-01-21T09:57:00Z'), // 3 分鐘前
      });
      const apiKeys = {
        binance: createApiKeyInfo('binance'),
        okx: createApiKeyInfo('okx'),
      };

      const result = await getCumulativeFundingPnL(position as any, apiKeys as any);

      // 應該返回快取值，不呼叫 API
      expect(result.toNumber()).toBe(15.5);
      expect(mockFetchFundingHistory).not.toHaveBeenCalled();
    });

    it('快取過期時應該重新查詢 API', async () => {
      const now = new Date('2026-01-21T10:00:00Z');
      vi.setSystemTime(now);

      const position = createPosition({
        cachedFundingPnL: new Decimal('15.50'),
        cachedFundingPnLUpdatedAt: new Date('2026-01-21T09:54:00Z'), // 6 分鐘前（超過 5 分鐘 TTL）
      });
      const apiKeys = {
        binance: createApiKeyInfo('binance'),
        okx: createApiKeyInfo('okx'),
      };

      mockFetchFundingHistory.mockResolvedValue([{ amount: 20, timestamp: Date.now() }]);

      const result = await getCumulativeFundingPnL(position as any, apiKeys as any);

      // 應該呼叫 API 並更新
      expect(mockFetchFundingHistory).toHaveBeenCalled();
      expect(result.toNumber()).toBe(40); // 20 + 20
    });

    it('查詢後應該更新快取', async () => {
      const position = createPosition();
      const apiKeys = {
        binance: createApiKeyInfo('binance'),
        okx: createApiKeyInfo('okx'),
      };

      mockFetchFundingHistory.mockResolvedValue([{ amount: 10, timestamp: Date.now() }]);
      mockPositionUpdate.mockResolvedValue({});

      await getCumulativeFundingPnL(position as any, apiKeys as any);

      // 驗證快取更新
      expect(mockPositionUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: position.id },
          data: expect.objectContaining({
            cachedFundingPnL: expect.any(Object), // Decimal
            cachedFundingPnLUpdatedAt: expect.any(Date),
          }),
        })
      );
    });
  });

  describe('isCacheValid()', () => {
    it('快取存在且未過期時應該返回 true', () => {
      const now = new Date('2026-01-21T10:00:00Z');
      vi.setSystemTime(now);

      const cachedAt = new Date('2026-01-21T09:56:00Z'); // 4 分鐘前

      expect(isCacheValid(cachedAt, 5 * 60 * 1000)).toBe(true);
    });

    it('快取過期時應該返回 false', () => {
      const now = new Date('2026-01-21T10:00:00Z');
      vi.setSystemTime(now);

      const cachedAt = new Date('2026-01-21T09:54:00Z'); // 6 分鐘前

      expect(isCacheValid(cachedAt, 5 * 60 * 1000)).toBe(false);
    });

    it('快取不存在時應該返回 false', () => {
      expect(isCacheValid(null, 5 * 60 * 1000)).toBe(false);
      expect(isCacheValid(undefined, 5 * 60 * 1000)).toBe(false);
    });
  });

  describe('calculateTotalFundingPnL()', () => {
    it('應該正確加總多筆資金費率記錄', () => {
      const entries = [
        { amount: 5.5, timestamp: Date.now() },
        { amount: 3.2, timestamp: Date.now() - 8 * 60 * 60 * 1000 },
        { amount: -1.8, timestamp: Date.now() - 16 * 60 * 60 * 1000 },
      ];

      const result = calculateTotalFundingPnL(entries);

      // 5.5 + 3.2 + (-1.8) = 6.9
      expect(result.toNumber()).toBeCloseTo(6.9, 2);
    });

    it('空陣列應該返回 0', () => {
      const result = calculateTotalFundingPnL([]);

      expect(result.toNumber()).toBe(0);
    });
  });

  describe('錯誤處理', () => {
    it('單一交易所查詢失敗時應該拋出錯誤', async () => {
      const position = createPosition();
      const apiKeys = {
        binance: createApiKeyInfo('binance'),
        okx: createApiKeyInfo('okx'),
      };

      mockFetchFundingHistory
        .mockResolvedValueOnce([{ amount: 5, timestamp: Date.now() }])
        .mockRejectedValueOnce(new Error('API rate limited'));

      await expect(
        getCumulativeFundingPnL(position as any, apiKeys as any)
      ).rejects.toThrow('API rate limited');
    });

    it('缺少 API Key 時應該拋出錯誤', async () => {
      const position = createPosition();
      const apiKeys = {
        binance: createApiKeyInfo('binance'),
        // 缺少 okx
      };

      await expect(
        getCumulativeFundingPnL(position as any, apiKeys as any)
      ).rejects.toThrow();
    });
  });
});
