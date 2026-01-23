/**
 * BalanceValidator Unit Tests
 *
 * 測試餘額驗證服務
 * Feature: 047-balance-validator-tests
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { Decimal } from 'decimal.js';

// Mock logger first (before any imports that use it)
vi.mock('../../../src/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock UserConnectorFactory - 使用工廠函數確保每次測試都能控制 mock
let mockGetBalancesForUser: Mock;

vi.mock('../../../src/services/assets/UserConnectorFactory', () => {
  return {
    UserConnectorFactory: class MockUserConnectorFactory {
      getBalancesForUser: Mock;
      constructor() {
        this.getBalancesForUser = mockGetBalancesForUser;
      }
    },
  };
});

// Mock PrivateWsManager
vi.mock('../../../src/services/websocket/PrivateWsManager', () => {
  return {
    privateWsManager: {
      getCachedBalance: vi.fn(),
    },
  };
});

// Import after mocks are set up
import { BalanceValidator } from '../../../src/services/trading/BalanceValidator';
import {
  InsufficientBalanceError,
  ApiKeyNotFoundError,
  ExchangeApiError,
} from '../../../src/lib/errors/trading-errors';

describe('BalanceValidator', () => {
  let validator: BalanceValidator;
  const mockPrisma = {} as any;

  beforeEach(() => {
    // 每次測試前重建 mock 函數
    mockGetBalancesForUser = vi.fn();
    validator = new BalanceValidator(mockPrisma);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // Phase 2: User Story 1 - 保證金計算邏輯測試 (Priority: P1) 🎯 MVP
  // ===========================================================================

  describe('calculateRequiredMargin', () => {
    it('should calculate margin with 10% buffer for BTC (1 * 50000 / 10 * 1.1 = 5500)', () => {
      // Arrange
      const quantity = new Decimal('1');
      const price = new Decimal('50000');
      const leverage = 10;

      // Act
      const result = validator.calculateRequiredMargin(quantity, price, leverage);

      // Assert
      // (1 * 50000 / 10) * 1.1 = 5500
      expect(result.toNumber()).toBe(5500);
    });

    it('should calculate margin for ETH (0.5 * 2000 / 5 * 1.1 = 220)', () => {
      // Arrange
      const quantity = new Decimal('0.5');
      const price = new Decimal('2000');
      const leverage = 5;

      // Act
      const result = validator.calculateRequiredMargin(quantity, price, leverage);

      // Assert
      // (0.5 * 2000 / 5) * 1.1 = 220
      expect(result.toNumber()).toBe(220);
    });

    it('should handle high precision decimals (0.001 * 100000)', () => {
      // Arrange
      const quantity = new Decimal('0.001');
      const price = new Decimal('100000');
      const leverage = 10;

      // Act
      const result = validator.calculateRequiredMargin(quantity, price, leverage);

      // Assert
      // (0.001 * 100000 / 10) * 1.1 = 11
      expect(result.toNumber()).toBe(11);
    });

    it('should handle leverage 1x (margin equals position value * 1.1)', () => {
      // Arrange
      const quantity = new Decimal('1');
      const price = new Decimal('1000');
      const leverage = 1;

      // Act
      const result = validator.calculateRequiredMargin(quantity, price, leverage);

      // Assert
      // (1 * 1000 / 1) * 1.1 = 1100
      expect(result.toNumber()).toBe(1100);
    });

    it('should handle leverage 2x', () => {
      // Arrange
      const quantity = new Decimal('1');
      const price = new Decimal('50000');
      const leverage = 2;

      // Act
      const result = validator.calculateRequiredMargin(quantity, price, leverage);

      // Assert
      // (1 * 50000 / 2) * 1.1 = 27500
      expect(result.toNumber()).toBe(27500);
    });

    it('should handle SOL example (10 * 100 / 20 * 1.1 = 55)', () => {
      // Arrange
      const quantity = new Decimal('10');
      const price = new Decimal('100');
      const leverage = 20;

      // Act
      const result = validator.calculateRequiredMargin(quantity, price, leverage);

      // Assert
      // (10 * 100 / 20) * 1.1 = 55
      expect(result.toNumber()).toBe(55);
    });
  });

  // ===========================================================================
  // Phase 3: User Story 2 - 餘額查詢功能測試 (Priority: P1)
  // ===========================================================================

  describe('getBalances', () => {
    it('should return balances for valid API keys', async () => {
      // Arrange - Feature 056: 使用 availableBalanceUSD 進行開倉驗證
      mockGetBalancesForUser.mockResolvedValue([
        { exchange: 'binance', status: 'success', balanceUSD: 10000, availableBalanceUSD: 10000 },
        { exchange: 'okx', status: 'success', balanceUSD: 5000, availableBalanceUSD: 5000 },
      ]);

      // Act
      const result = await validator.getBalances('user-123', ['binance', 'okx']);

      // Assert
      expect(result.get('binance')).toBe(10000);
      expect(result.get('okx')).toBe(5000);
    });

    it('should throw ApiKeyNotFoundError when status is no_api_key', async () => {
      // Arrange
      mockGetBalancesForUser.mockResolvedValue([
        { exchange: 'binance', status: 'no_api_key', balanceUSD: null, availableBalanceUSD: null },
      ]);

      // Act & Assert
      await expect(
        validator.getBalances('user-123', ['binance']),
      ).rejects.toThrow(ApiKeyNotFoundError);
    });

    it('should throw ExchangeApiError when status is api_error', async () => {
      // Arrange
      mockGetBalancesForUser.mockResolvedValue([
        { exchange: 'binance', status: 'api_error', balanceUSD: null, availableBalanceUSD: null, errorMessage: 'Connection failed' },
      ]);

      // Act & Assert
      await expect(
        validator.getBalances('user-123', ['binance']),
      ).rejects.toThrow(ExchangeApiError);
    });

    it('should throw ExchangeApiError with rate_limited flag when status is rate_limited', async () => {
      // Arrange
      mockGetBalancesForUser.mockResolvedValue([
        { exchange: 'okx', status: 'rate_limited', balanceUSD: null, availableBalanceUSD: null, errorMessage: 'Rate limit exceeded' },
      ]);

      // Act & Assert
      await expect(validator.getBalances('user-123', ['okx'])).rejects.toThrow(ExchangeApiError);

      try {
        await validator.getBalances('user-123', ['okx']);
      } catch (error) {
        expect(error).toBeInstanceOf(ExchangeApiError);
        // ExchangeApiError 的 retryable 應該為 true（rate_limited）
        expect((error as ExchangeApiError).retryable).toBe(true);
      }
    });

    it('should set balance to 0 when exchange result is missing', async () => {
      // Arrange
      mockGetBalancesForUser.mockResolvedValue([
        { exchange: 'binance', status: 'success', balanceUSD: 10000, availableBalanceUSD: 10000 },
        // 'okx' is missing from the response
      ]);

      // Act
      const result = await validator.getBalances('user-123', ['binance', 'okx']);

      // Assert
      expect(result.get('binance')).toBe(10000);
      expect(result.get('okx')).toBe(0);
    });

    it('should set balance to 0 when balanceUSD is null', async () => {
      // Arrange
      mockGetBalancesForUser.mockResolvedValue([
        { exchange: 'binance', status: 'success', balanceUSD: null, availableBalanceUSD: null },
      ]);

      // Act
      const result = await validator.getBalances('user-123', ['binance']);

      // Assert
      expect(result.get('binance')).toBe(0);
    });

    it('should set balance to 0 when balanceUSD is undefined', async () => {
      // Arrange
      mockGetBalancesForUser.mockResolvedValue([
        { exchange: 'gateio', status: 'success', balanceUSD: null, availableBalanceUSD: null }, // balanceUSD/availableBalanceUSD is null
      ]);

      // Act
      const result = await validator.getBalances('user-123', ['gateio']);

      // Assert
      expect(result.get('gateio')).toBe(0);
    });
  });

  // ===========================================================================
  // Phase 4: User Story 3 - 餘額充足性驗證測試 (Priority: P1)
  // ===========================================================================

  describe('validateBalance', () => {
    it('should return isValid=true when both exchanges have sufficient balance', async () => {
      // Arrange
      mockGetBalancesForUser.mockResolvedValue([
        { exchange: 'binance', status: 'success', balanceUSD: 10000, availableBalanceUSD: 10000 },
        { exchange: 'okx', status: 'success', balanceUSD: 10000, availableBalanceUSD: 10000 },
      ]);

      // Act
      const result = await validator.validateBalance(
        'user-123',
        'binance',
        'okx',
        new Decimal('1'),
        new Decimal('50000'),
        new Decimal('50000'),
        10,
      );

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.requiredMarginLong).toBe(5500);
      expect(result.requiredMarginShort).toBe(5500);
      expect(result.longExchangeBalance).toBe(10000);
      expect(result.shortExchangeBalance).toBe(10000);
    });

    it('should throw InsufficientBalanceError for long exchange when balance insufficient', async () => {
      // Arrange
      mockGetBalancesForUser.mockResolvedValue([
        { exchange: 'binance', status: 'success', balanceUSD: 1000, availableBalanceUSD: 1000 }, // Not enough
        { exchange: 'okx', status: 'success', balanceUSD: 10000, availableBalanceUSD: 10000 },
      ]);

      // Act & Assert
      await expect(
        validator.validateBalance(
          'user-123',
          'binance',
          'okx',
          new Decimal('1'),
          new Decimal('50000'),
          new Decimal('50000'),
          10,
        ),
      ).rejects.toThrow(InsufficientBalanceError);

      try {
        await validator.validateBalance(
          'user-123',
          'binance',
          'okx',
          new Decimal('1'),
          new Decimal('50000'),
          new Decimal('50000'),
          10,
        );
      } catch (error) {
        expect(error).toBeInstanceOf(InsufficientBalanceError);
        expect((error as InsufficientBalanceError).exchange).toBe('binance');
        expect((error as InsufficientBalanceError).required).toBe(5500);
        expect((error as InsufficientBalanceError).available).toBe(1000);
      }
    });

    it('should throw InsufficientBalanceError for short exchange when balance insufficient', async () => {
      // Arrange
      mockGetBalancesForUser.mockResolvedValue([
        { exchange: 'binance', status: 'success', balanceUSD: 10000, availableBalanceUSD: 10000 },
        { exchange: 'okx', status: 'success', balanceUSD: 1000, availableBalanceUSD: 1000 }, // Not enough
      ]);

      // Act & Assert
      try {
        await validator.validateBalance(
          'user-123',
          'binance',
          'okx',
          new Decimal('1'),
          new Decimal('50000'),
          new Decimal('50000'),
          10,
        );
      } catch (error) {
        expect(error).toBeInstanceOf(InsufficientBalanceError);
        expect((error as InsufficientBalanceError).exchange).toBe('okx');
      }
    });

    it('should check long exchange first when both insufficient', async () => {
      // Arrange
      mockGetBalancesForUser.mockResolvedValue([
        { exchange: 'binance', status: 'success', balanceUSD: 1000, availableBalanceUSD: 1000 }, // Not enough
        { exchange: 'okx', status: 'success', balanceUSD: 1000, availableBalanceUSD: 1000 }, // Not enough
      ]);

      // Act & Assert
      try {
        await validator.validateBalance(
          'user-123',
          'binance',
          'okx',
          new Decimal('1'),
          new Decimal('50000'),
          new Decimal('50000'),
          10,
        );
      } catch (error) {
        expect(error).toBeInstanceOf(InsufficientBalanceError);
        // Long exchange (binance) should be checked first
        expect((error as InsufficientBalanceError).exchange).toBe('binance');
      }
    });

    it('should fail when balance equals required margin without buffer', async () => {
      // Required margin = 5000 (without buffer), with buffer = 5500
      // Balance = 5000, which is less than 5500
      mockGetBalancesForUser.mockResolvedValue([
        { exchange: 'binance', status: 'success', balanceUSD: 5000, availableBalanceUSD: 5000 },
        { exchange: 'okx', status: 'success', balanceUSD: 10000, availableBalanceUSD: 10000 },
      ]);

      // Act & Assert
      await expect(
        validator.validateBalance(
          'user-123',
          'binance',
          'okx',
          new Decimal('1'),
          new Decimal('50000'),
          new Decimal('50000'),
          10,
        ),
      ).rejects.toThrow(InsufficientBalanceError);
    });

    it('should include correct values in validation result', async () => {
      // Arrange
      mockGetBalancesForUser.mockResolvedValue([
        { exchange: 'binance', status: 'success', balanceUSD: 8000, availableBalanceUSD: 8000 },
        { exchange: 'okx', status: 'success', balanceUSD: 6000, availableBalanceUSD: 6000 },
      ]);

      // Act
      const result = await validator.validateBalance(
        'user-123',
        'binance',
        'okx',
        new Decimal('0.5'),
        new Decimal('40000'),
        new Decimal('42000'),
        10,
      );

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.longExchangeBalance).toBe(8000);
      expect(result.shortExchangeBalance).toBe(6000);
      // (0.5 * 40000 / 10) * 1.1 = 2200
      expect(result.requiredMarginLong).toBe(2200);
      // (0.5 * 42000 / 10) * 1.1 = 2310
      expect(result.requiredMarginShort).toBe(2310);
    });
  });

  // ===========================================================================
  // Phase 5: User Story 4 - 快速檢查功能測試 (Priority: P2)
  // ===========================================================================

  describe('checkBalance', () => {
    it('should return isValid=true when balance is sufficient', async () => {
      // Arrange
      mockGetBalancesForUser.mockResolvedValue([
        { exchange: 'binance', status: 'success', balanceUSD: 10000, availableBalanceUSD: 10000 },
        { exchange: 'okx', status: 'success', balanceUSD: 10000, availableBalanceUSD: 10000 },
      ]);

      // Act
      const result = await validator.checkBalance(
        'user-123',
        'binance',
        'okx',
        new Decimal('1'),
        new Decimal('50000'),
        new Decimal('50000'),
        10,
      );

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.insufficientExchange).toBeUndefined();
      expect(result.insufficientAmount).toBeUndefined();
    });

    it('should return isValid=false with insufficientExchange and insufficientAmount when balance insufficient', async () => {
      // Arrange
      mockGetBalancesForUser.mockResolvedValue([
        { exchange: 'binance', status: 'success', balanceUSD: 1000, availableBalanceUSD: 1000 },
        { exchange: 'okx', status: 'success', balanceUSD: 10000, availableBalanceUSD: 10000 },
      ]);

      // Act
      const result = await validator.checkBalance(
        'user-123',
        'binance',
        'okx',
        new Decimal('1'),
        new Decimal('50000'),
        new Decimal('50000'),
        10,
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.insufficientExchange).toBe('binance');
      // required (5500) - available (1000) = 4500
      expect(result.insufficientAmount).toBe(4500);
    });

    it('should re-throw ApiKeyNotFoundError (not convert to validation result)', async () => {
      // Arrange
      mockGetBalancesForUser.mockResolvedValue([
        { exchange: 'binance', status: 'no_api_key' },
      ]);

      // Act & Assert
      await expect(
        validator.checkBalance(
          'user-123',
          'binance',
          'okx',
          new Decimal('1'),
          new Decimal('50000'),
          new Decimal('50000'),
          10,
        ),
      ).rejects.toThrow(ApiKeyNotFoundError);
    });

    it('should re-throw ExchangeApiError (not convert to validation result)', async () => {
      // Arrange
      mockGetBalancesForUser.mockResolvedValue([
        { exchange: 'binance', status: 'api_error', balanceUSD: null, availableBalanceUSD: null, errorMessage: 'Connection failed' },
      ]);

      // Act & Assert
      await expect(
        validator.checkBalance(
          'user-123',
          'binance',
          'okx',
          new Decimal('1'),
          new Decimal('50000'),
          new Decimal('50000'),
          10,
        ),
      ).rejects.toThrow(ExchangeApiError);
    });
  });

  // ===========================================================================
  // Phase 6: User Story 5 - 邊界條件與錯誤處理測試 (Priority: P2)
  // ===========================================================================

  describe('edge cases', () => {
    it('should return 0 margin when quantity is 0', () => {
      // Arrange
      const quantity = new Decimal('0');
      const price = new Decimal('50000');
      const leverage = 10;

      // Act
      const result = validator.calculateRequiredMargin(quantity, price, leverage);

      // Assert
      expect(result.toNumber()).toBe(0);
    });

    it('should return 0 margin when price is 0', () => {
      // Arrange
      const quantity = new Decimal('1');
      const price = new Decimal('0');
      const leverage = 10;

      // Act
      const result = validator.calculateRequiredMargin(quantity, price, leverage);

      // Assert
      expect(result.toNumber()).toBe(0);
    });

    it('should handle same exchange for long and short', async () => {
      // Arrange
      mockGetBalancesForUser.mockResolvedValue([
        { exchange: 'binance', status: 'success', balanceUSD: 20000, availableBalanceUSD: 20000 },
      ]);

      // Act
      const result = await validator.validateBalance(
        'user-123',
        'binance',
        'binance', // Same exchange for both
        new Decimal('1'),
        new Decimal('50000'),
        new Decimal('50000'),
        10,
      );

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.longExchangeBalance).toBe(20000);
      expect(result.shortExchangeBalance).toBe(20000);
    });

    it('should maintain precision for high decimal values', () => {
      // Arrange
      const quantity = new Decimal('0.00012345');
      const price = new Decimal('98765.4321');
      const leverage = 10;

      // Act
      const result = validator.calculateRequiredMargin(quantity, price, leverage);

      // Assert
      // (0.00012345 * 98765.4321 / 10) * 1.1 = 1.34118518520195...
      // 使用較低精度比較避免浮點誤差
      expect(result.toNumber()).toBeCloseTo(1.341185, 4);
    });

    it('should handle null/undefined balanceUSD gracefully in getBalances', async () => {
      // Arrange
      mockGetBalancesForUser.mockResolvedValue([
        { exchange: 'binance', status: 'success', balanceUSD: null, availableBalanceUSD: null },
        { exchange: 'okx', status: 'success', balanceUSD: null, availableBalanceUSD: null }, // null
      ]);

      // Act
      const result = await validator.getBalances('user-123', ['binance', 'okx']);

      // Assert
      expect(result.get('binance')).toBe(0);
      expect(result.get('okx')).toBe(0);
    });

    it('should handle case-insensitive exchange matching', async () => {
      // Arrange
      mockGetBalancesForUser.mockResolvedValue([
        { exchange: 'BINANCE', status: 'success', balanceUSD: 10000, availableBalanceUSD: 10000 },
        { exchange: 'OKX', status: 'success', balanceUSD: 5000, availableBalanceUSD: 5000 },
      ]);

      // Act
      const result = await validator.getBalances('user-123', ['binance', 'okx']);

      // Assert
      expect(result.get('binance')).toBe(10000);
      expect(result.get('okx')).toBe(5000);
    });

    it('should propagate errors from UserConnectorFactory', async () => {
      // Arrange
      mockGetBalancesForUser.mockRejectedValue(new Error('Database connection failed'));

      // Act & Assert
      await expect(
        validator.getBalances('user-123', ['binance']),
      ).rejects.toThrow('Database connection failed');
    });
  });

  // ===========================================================================
  // Phase N: WebSocket 快取餘額驗證測試 (Feature: perf/balance-validator-ws-cache)
  // ===========================================================================

  describe('validateBalance with WebSocket cache', () => {
    it('should use cached balance when useCachedBalance is true and cache is valid', async () => {
      // Arrange
      const userId = 'user-123';
      const longExchange = 'binance';
      const shortExchange = 'okx';
      const quantity = new Decimal('0.1');
      const longPrice = new Decimal('50000');
      const shortPrice = new Decimal('50100');
      const leverage = 1;

      // Mock PrivateWsManager 回傳有效快取
      const mockPrivateWsManager = await import('../../../src/services/websocket/PrivateWsManager');
      vi.spyOn(mockPrivateWsManager.privateWsManager, 'getCachedBalance').mockImplementation((uid, ex) => {
        if (uid === userId && ex === longExchange) {
          return { balance: 10000, timestamp: Date.now() - 5000 }; // 5 秒前
        }
        if (uid === userId && ex === shortExchange) {
          return { balance: 8000, timestamp: Date.now() - 5000 };
        }
        return null;
      });

      // Act
      const result = await validator.validateBalance(
        userId,
        longExchange,
        shortExchange,
        quantity,
        longPrice,
        shortPrice,
        leverage,
        { useCachedBalance: true }
      );

      // Assert - 應該使用快取，不呼叫 API
      expect(mockGetBalancesForUser).not.toHaveBeenCalled();
      expect(result.isValid).toBe(true);
      expect(result.longExchangeBalance).toBe(10000);
      expect(result.shortExchangeBalance).toBe(8000);
    });

    it('should fallback to API when cache is expired', async () => {
      // Arrange
      const userId = 'user-123';
      const longExchange = 'binance';
      const shortExchange = 'okx';
      const quantity = new Decimal('0.1');
      const longPrice = new Decimal('50000');
      const shortPrice = new Decimal('50100');
      const leverage = 1;

      // Mock PrivateWsManager 回傳過期快取
      const mockPrivateWsManager = await import('../../../src/services/websocket/PrivateWsManager');
      vi.spyOn(mockPrivateWsManager.privateWsManager, 'getCachedBalance').mockImplementation((uid, ex) => {
        if (uid === userId && ex === longExchange) {
          return { balance: 10000, timestamp: Date.now() - 60000 }; // 60 秒前（過期）
        }
        if (uid === userId && ex === shortExchange) {
          return { balance: 8000, timestamp: Date.now() - 60000 };
        }
        return null;
      });

      // Mock API 回傳
      mockGetBalancesForUser.mockResolvedValue([
        { exchange: 'binance', status: 'success', balanceUSD: 12000, availableBalanceUSD: 12000 },
        { exchange: 'okx', status: 'success', balanceUSD: 9000, availableBalanceUSD: 9000 },
      ]);

      // Act
      const result = await validator.validateBalance(
        userId,
        longExchange,
        shortExchange,
        quantity,
        longPrice,
        shortPrice,
        leverage,
        { useCachedBalance: true, maxCacheAgeMs: 30000 } // 30 秒有效期
      );

      // Assert - 快取過期，應該呼叫 API
      expect(mockGetBalancesForUser).toHaveBeenCalledWith(userId, [longExchange, shortExchange]);
      expect(result.isValid).toBe(true);
      expect(result.longExchangeBalance).toBe(12000); // 使用 API 回傳值
      expect(result.shortExchangeBalance).toBe(9000);
    });

    it('should fallback to API when cache does not exist', async () => {
      // Arrange
      const userId = 'user-123';
      const longExchange = 'binance';
      const shortExchange = 'okx';
      const quantity = new Decimal('0.1');
      const longPrice = new Decimal('50000');
      const shortPrice = new Decimal('50100');
      const leverage = 1;

      // Mock PrivateWsManager 回傳 null（無快取）
      const mockPrivateWsManager = await import('../../../src/services/websocket/PrivateWsManager');
      vi.spyOn(mockPrivateWsManager.privateWsManager, 'getCachedBalance').mockReturnValue(null);

      // Mock API 回傳
      mockGetBalancesForUser.mockResolvedValue([
        { exchange: 'binance', status: 'success', balanceUSD: 15000, availableBalanceUSD: 15000 },
        { exchange: 'okx', status: 'success', balanceUSD: 10000, availableBalanceUSD: 10000 },
      ]);

      // Act
      const result = await validator.validateBalance(
        userId,
        longExchange,
        shortExchange,
        quantity,
        longPrice,
        shortPrice,
        leverage,
        { useCachedBalance: true }
      );

      // Assert - 無快取，應該呼叫 API
      expect(mockGetBalancesForUser).toHaveBeenCalledWith(userId, [longExchange, shortExchange]);
      expect(result.isValid).toBe(true);
      expect(result.longExchangeBalance).toBe(15000);
      expect(result.shortExchangeBalance).toBe(10000);
    });

    it('should use API when useCachedBalance is false (default behavior)', async () => {
      // Arrange
      const userId = 'user-123';
      const longExchange = 'binance';
      const shortExchange = 'okx';
      const quantity = new Decimal('0.1');
      const longPrice = new Decimal('50000');
      const shortPrice = new Decimal('50100');
      const leverage = 1;

      // Mock API 回傳
      mockGetBalancesForUser.mockResolvedValue([
        { exchange: 'binance', status: 'success', balanceUSD: 20000, availableBalanceUSD: 20000 },
        { exchange: 'okx', status: 'success', balanceUSD: 18000, availableBalanceUSD: 18000 },
      ]);

      // Act - 不傳 options，預設行為
      const result = await validator.validateBalance(
        userId,
        longExchange,
        shortExchange,
        quantity,
        longPrice,
        shortPrice,
        leverage
      );

      // Assert - 應該直接呼叫 API，不查快取
      expect(mockGetBalancesForUser).toHaveBeenCalledWith(userId, [longExchange, shortExchange]);
      expect(result.isValid).toBe(true);
      expect(result.longExchangeBalance).toBe(20000);
      expect(result.shortExchangeBalance).toBe(18000);
    });
  });

  describe('checkBalance with WebSocket cache', () => {
    it('should support cache options in checkBalance method', async () => {
      // Arrange
      const userId = 'user-123';
      const longExchange = 'binance';
      const shortExchange = 'okx';
      const quantity = new Decimal('0.1');
      const longPrice = new Decimal('50000');
      const shortPrice = new Decimal('50100');
      const leverage = 1;

      // Mock PrivateWsManager 回傳有效快取
      const mockPrivateWsManager = await import('../../../src/services/websocket/PrivateWsManager');
      vi.spyOn(mockPrivateWsManager.privateWsManager, 'getCachedBalance').mockImplementation((uid, ex) => {
        if (uid === userId && ex === longExchange) {
          return { balance: 10000, timestamp: Date.now() - 5000 };
        }
        if (uid === userId && ex === shortExchange) {
          return { balance: 8000, timestamp: Date.now() - 5000 };
        }
        return null;
      });

      // Act
      const result = await validator.checkBalance(
        userId,
        longExchange,
        shortExchange,
        quantity,
        longPrice,
        shortPrice,
        leverage,
        { useCachedBalance: true }
      );

      // Assert - checkBalance 也應該支援快取
      expect(mockGetBalancesForUser).not.toHaveBeenCalled();
      expect(result.isValid).toBe(true);
      expect(result.longExchangeBalance).toBe(10000);
      expect(result.shortExchangeBalance).toBe(8000);
    });
  });
});
