/**
 * Test: ExchangeQueryService
 * Feature: 053 Bug Fix - 修復條件單觸發誤判導致單邊平倉
 *
 * 測試重點：
 * 1. normalizeSide 方法 - 統一不同交易所的 side 格式
 * 2. checkPositionExists 方法 - 正確識別各交易所的持倉
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock ccxt exchange instance
const mockFetchPositions = vi.fn();
const mockLoadMarkets = vi.fn().mockResolvedValue({});
const mockFapiPrivateGetPositionRisk = vi.fn().mockResolvedValue([]);

const mockExchangeInstance = {
  fetchPositions: mockFetchPositions,
  loadMarkets: mockLoadMarkets,
  fapiPrivateGetPositionRisk: mockFapiPrivateGetPositionRisk,
  markets: {},
};

// Mock ccxt-factory - ExchangeQueryService 使用這個 factory 來創建交易所實例
vi.mock('@/lib/ccxt-factory', () => ({
  createCcxtExchange: vi.fn(() => mockExchangeInstance),
}));

// Mock ccxt - 保留用於類型相關的測試
vi.mock('ccxt', () => ({
  default: {},
  binance: vi.fn(() => mockExchangeInstance),
  okx: vi.fn(() => mockExchangeInstance),
  gateio: vi.fn(() => mockExchangeInstance),
  bingx: vi.fn(() => mockExchangeInstance),
}));

describe('ExchangeQueryService', () => {
  let service: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockFetchPositions.mockReset();
    mockLoadMarkets.mockResolvedValue({});

    // Dynamic import to avoid hoisting issues
    const { ExchangeQueryService } = await import('@/lib/exchange-query-service');
    service = new ExchangeQueryService('binance');
    await service.connect({
      apiKey: 'test-api-key',
      secret: 'test-secret',
    });
  });

  afterEach(async () => {
    if (service) {
      await service.disconnect();
    }
  });

  // ==================== normalizeSide 測試 ====================
  describe('normalizeSide', () => {
    it('should convert "sell" to "short"', () => {
      // 透過反射存取私有方法
      const normalizeSide = (service as any).normalizeSide.bind(service);
      expect(normalizeSide('sell')).toBe('short');
    });

    it('should convert "buy" to "long"', () => {
      const normalizeSide = (service as any).normalizeSide.bind(service);
      expect(normalizeSide('buy')).toBe('long');
    });

    it('should handle "long" as-is', () => {
      const normalizeSide = (service as any).normalizeSide.bind(service);
      expect(normalizeSide('long')).toBe('long');
    });

    it('should handle "short" as-is', () => {
      const normalizeSide = (service as any).normalizeSide.bind(service);
      expect(normalizeSide('short')).toBe('short');
    });

    it('should handle uppercase "LONG"', () => {
      const normalizeSide = (service as any).normalizeSide.bind(service);
      expect(normalizeSide('LONG')).toBe('long');
    });

    it('should handle uppercase "SHORT"', () => {
      const normalizeSide = (service as any).normalizeSide.bind(service);
      expect(normalizeSide('SHORT')).toBe('short');
    });

    it('should handle uppercase "BUY"', () => {
      const normalizeSide = (service as any).normalizeSide.bind(service);
      expect(normalizeSide('BUY')).toBe('long');
    });

    it('should handle uppercase "SELL"', () => {
      const normalizeSide = (service as any).normalizeSide.bind(service);
      expect(normalizeSide('SELL')).toBe('short');
    });

    it('should return empty string for undefined', () => {
      const normalizeSide = (service as any).normalizeSide.bind(service);
      expect(normalizeSide(undefined)).toBe('');
    });

    it('should return empty string for invalid input', () => {
      const normalizeSide = (service as any).normalizeSide.bind(service);
      expect(normalizeSide('invalid')).toBe('');
      expect(normalizeSide('')).toBe('');
    });
  });

  // ==================== checkPositionExists 測試 ====================
  describe('checkPositionExists', () => {
    describe('Binance/OKX/BingX format (long/short)', () => {
      it('should find position with standard "long" side', async () => {
        mockFetchPositions.mockResolvedValue([
          {
            symbol: 'BTC/USDT:USDT',
            side: 'long',
            contracts: 0.001,
          },
        ]);

        const result = await service.checkPositionExists('BTCUSDT', 'long');
        expect(result).toBe(true);
      });

      it('should find position with standard "short" side', async () => {
        mockFetchPositions.mockResolvedValue([
          {
            symbol: 'BTC/USDT:USDT',
            side: 'short',
            contracts: 0.001,
          },
        ]);

        const result = await service.checkPositionExists('BTCUSDT', 'short');
        expect(result).toBe(true);
      });

      it('should not find position when side does not match', async () => {
        mockFetchPositions.mockResolvedValue([
          {
            symbol: 'BTC/USDT:USDT',
            side: 'long',
            contracts: 0.001,
          },
        ]);

        const result = await service.checkPositionExists('BTCUSDT', 'short');
        expect(result).toBe(false);
      });
    });

    describe('Gate.io format (buy/sell)', () => {
      it('should find position with Gate.io "sell" side when querying "short"', async () => {
        mockFetchPositions.mockResolvedValue([
          {
            symbol: 'BTC/USDT:USDT',
            side: 'sell', // Gate.io format
            contracts: 0.001,
          },
        ]);

        const result = await service.checkPositionExists('BTCUSDT', 'short');
        expect(result).toBe(true);
      });

      it('should find position with Gate.io "buy" side when querying "long"', async () => {
        mockFetchPositions.mockResolvedValue([
          {
            symbol: 'BTC/USDT:USDT',
            side: 'buy', // Gate.io format
            contracts: 0.001,
          },
        ]);

        const result = await service.checkPositionExists('BTCUSDT', 'long');
        expect(result).toBe(true);
      });

      it('should not find position with Gate.io "buy" side when querying "short"', async () => {
        mockFetchPositions.mockResolvedValue([
          {
            symbol: 'BTC/USDT:USDT',
            side: 'buy',
            contracts: 0.001,
          },
        ]);

        const result = await service.checkPositionExists('BTCUSDT', 'short');
        expect(result).toBe(false);
      });
    });

    describe('contracts parsing from various fields', () => {
      it('should handle contracts in pos.contracts', async () => {
        mockFetchPositions.mockResolvedValue([
          {
            symbol: 'BTC/USDT:USDT',
            side: 'long',
            contracts: 0.001,
          },
        ]);

        const result = await service.checkPositionExists('BTCUSDT', 'long');
        expect(result).toBe(true);
      });

      it('should handle contracts in pos.contractSize', async () => {
        mockFetchPositions.mockResolvedValue([
          {
            symbol: 'BTC/USDT:USDT',
            side: 'long',
            contractSize: 0.001,
          },
        ]);

        const result = await service.checkPositionExists('BTCUSDT', 'long');
        expect(result).toBe(true);
      });

      it('should handle contracts in pos.info.size', async () => {
        mockFetchPositions.mockResolvedValue([
          {
            symbol: 'BTC/USDT:USDT',
            side: 'long',
            info: {
              size: '0.001',
            },
          },
        ]);

        const result = await service.checkPositionExists('BTCUSDT', 'long');
        expect(result).toBe(true);
      });

      it('should handle contracts in pos.info.contracts', async () => {
        mockFetchPositions.mockResolvedValue([
          {
            symbol: 'BTC/USDT:USDT',
            side: 'long',
            info: {
              contracts: '0.001',
            },
          },
        ]);

        const result = await service.checkPositionExists('BTCUSDT', 'long');
        expect(result).toBe(true);
      });

      it('should return false when contracts is 0', async () => {
        mockFetchPositions.mockResolvedValue([
          {
            symbol: 'BTC/USDT:USDT',
            side: 'long',
            contracts: 0,
          },
        ]);

        const result = await service.checkPositionExists('BTCUSDT', 'long');
        expect(result).toBe(false);
      });
    });

    describe('symbol matching', () => {
      it('should match symbol with different formats', async () => {
        mockFetchPositions.mockResolvedValue([
          {
            symbol: 'BTC/USDT:USDT',
            side: 'long',
            contracts: 0.001,
          },
        ]);

        const result = await service.checkPositionExists('BTCUSDT', 'long');
        expect(result).toBe(true);
      });

      it('should return false when symbol does not match', async () => {
        mockFetchPositions.mockResolvedValue([
          {
            symbol: 'ETH/USDT:USDT',
            side: 'long',
            contracts: 0.001,
          },
        ]);

        const result = await service.checkPositionExists('BTCUSDT', 'long');
        expect(result).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('should return false when no positions', async () => {
        mockFetchPositions.mockResolvedValue([]);

        const result = await service.checkPositionExists('BTCUSDT', 'long');
        expect(result).toBe(false);
      });

      it('should return false when positions is null', async () => {
        mockFetchPositions.mockResolvedValue(null);

        const result = await service.checkPositionExists('BTCUSDT', 'long');
        expect(result).toBe(false);
      });

      it('should throw error when exchange is not connected', async () => {
        await service.disconnect();
        (service as any).exchange = null;

        await expect(service.checkPositionExists('BTCUSDT', 'long')).rejects.toThrow('交易所未連接');
      });
    });
  });

  // ==================== 整合測試：各交易所 side 格式 ====================
  describe('Integration: Exchange side formats', () => {
    const testCases = [
      { exchange: 'binance', rawSide: 'long', expectedMatch: 'long' },
      { exchange: 'binance', rawSide: 'short', expectedMatch: 'short' },
      { exchange: 'okx', rawSide: 'long', expectedMatch: 'long' },
      { exchange: 'okx', rawSide: 'short', expectedMatch: 'short' },
      { exchange: 'gateio', rawSide: 'buy', expectedMatch: 'long' },
      { exchange: 'gateio', rawSide: 'sell', expectedMatch: 'short' },
      { exchange: 'bingx', rawSide: 'long', expectedMatch: 'long' },
      { exchange: 'bingx', rawSide: 'short', expectedMatch: 'short' },
    ];

    testCases.forEach(({ exchange, rawSide, expectedMatch }) => {
      it(`should match ${exchange} "${rawSide}" side as "${expectedMatch}"`, async () => {
        mockFetchPositions.mockResolvedValue([
          {
            symbol: 'BTC/USDT:USDT',
            side: rawSide,
            contracts: 0.001,
          },
        ]);

        const result = await service.checkPositionExists('BTCUSDT', expectedMatch as 'long' | 'short');
        expect(result).toBe(true);
      });
    });
  });
});
