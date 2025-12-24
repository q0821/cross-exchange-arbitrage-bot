/**
 * ApiKeyValidator Unit Tests
 *
 * 測試 API Key 驗證服務
 * Feature: 042-api-key-connection-test
 *
 * TDD Red Phase: 撰寫失敗測試
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock logger first (before any imports that use it)
vi.mock('../../../src/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock ccxt to avoid real API calls
vi.mock('ccxt', () => ({
  default: {
    gateio: vi.fn(),
    mexc: vi.fn(),
  },
}));

// Import after mocks are set up
import { ApiKeyValidator } from '../../../src/services/apikey/ApiKeyValidator';
import ccxt from 'ccxt';

describe('ApiKeyValidator', () => {
  let validator: ApiKeyValidator;

  beforeEach(() => {
    vi.clearAllMocks();
    validator = new ApiKeyValidator();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateGateioKey (T007, T008)', () => {
    it('should validate a valid Gate.io API Key and return success (T007)', async () => {
      // Arrange
      const mockBalance = {
        total: { USDT: 1000 },
        free: { USDT: 800 },
      };

      const mockExchange = {
        fetchBalance: vi.fn().mockResolvedValue(mockBalance),
      };

      vi.mocked(ccxt.gateio).mockImplementation(() => mockExchange as any);

      // Act
      const result = await validator.validateGateioKey(
        'valid-api-key',
        'valid-api-secret',
        'MAINNET',
      );

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.hasReadPermission).toBe(true);
      // Gate.io 無法驗證交易權限，預設為 false
      expect(result.hasTradePermission).toBe(false);
      expect(result.error).toBeUndefined();
      expect(result.errorCode).toBeUndefined();
      expect(result.details).toBeDefined();
    });

    it('should return failure with error code for invalid Gate.io API Key (T008)', async () => {
      // Arrange
      const mockExchange = {
        fetchBalance: vi.fn().mockRejectedValue(new Error('Invalid API-key, IP, or permissions for action')),
      };

      vi.mocked(ccxt.gateio).mockImplementation(() => mockExchange as any);

      // Act
      const result = await validator.validateGateioKey(
        'invalid-api-key',
        'invalid-api-secret',
        'MAINNET',
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.hasReadPermission).toBe(false);
      expect(result.hasTradePermission).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.errorCode).toBe('INVALID_API_KEY');
    });

    it('should return IP_NOT_WHITELISTED error code when IP is restricted', async () => {
      // Arrange
      const mockExchange = {
        fetchBalance: vi.fn().mockRejectedValue(new Error('IP address is not whitelisted')),
      };

      vi.mocked(ccxt.gateio).mockImplementation(() => mockExchange as any);

      // Act
      const result = await validator.validateGateioKey(
        'valid-api-key',
        'valid-api-secret',
        'MAINNET',
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe('IP_NOT_WHITELISTED');
    });

    it('should return TIMEOUT error code on timeout', async () => {
      // Arrange
      const mockExchange = {
        fetchBalance: vi.fn().mockRejectedValue(new Error('Request timeout')),
      };

      vi.mocked(ccxt.gateio).mockImplementation(() => mockExchange as any);

      // Act
      const result = await validator.validateGateioKey(
        'valid-api-key',
        'valid-api-secret',
        'MAINNET',
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe('TIMEOUT');
    });
  });

  describe('validateMexcKey (T009, T010)', () => {
    it('should validate a valid MEXC API Key and return success (T009)', async () => {
      // Arrange
      const mockBalance = {
        total: { USDT: 500 },
        free: { USDT: 400 },
      };

      const mockExchange = {
        fetchBalance: vi.fn().mockResolvedValue(mockBalance),
      };

      vi.mocked(ccxt.mexc).mockImplementation(() => mockExchange as any);

      // Act
      const result = await validator.validateMexcKey(
        'valid-api-key',
        'valid-api-secret',
        'MAINNET',
      );

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.hasReadPermission).toBe(true);
      // MEXC 無法驗證交易權限，預設為 false
      expect(result.hasTradePermission).toBe(false);
      expect(result.error).toBeUndefined();
      expect(result.errorCode).toBeUndefined();
      expect(result.details).toBeDefined();
    });

    it('should return failure with error code for invalid MEXC API Key (T010)', async () => {
      // Arrange
      const mockExchange = {
        fetchBalance: vi.fn().mockRejectedValue(new Error('Invalid API-key')),
      };

      vi.mocked(ccxt.mexc).mockImplementation(() => mockExchange as any);

      // Act
      const result = await validator.validateMexcKey(
        'invalid-api-key',
        'invalid-api-secret',
        'MAINNET',
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.hasReadPermission).toBe(false);
      expect(result.hasTradePermission).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.errorCode).toBe('INVALID_API_KEY');
    });

    it('should return INVALID_SECRET error code for signature mismatch', async () => {
      // Arrange
      const mockExchange = {
        fetchBalance: vi.fn().mockRejectedValue(new Error('Signature for this request is not valid')),
      };

      vi.mocked(ccxt.mexc).mockImplementation(() => mockExchange as any);

      // Act
      const result = await validator.validateMexcKey(
        'valid-api-key',
        'invalid-api-secret',
        'MAINNET',
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe('INVALID_SECRET');
    });
  });

  describe('validateApiKey unified entry (T014)', () => {
    it('should route to validateGateioKey for gateio exchange', async () => {
      // Arrange
      const mockBalance = {
        total: { USDT: 1000 },
        free: { USDT: 800 },
      };

      const mockExchange = {
        fetchBalance: vi.fn().mockResolvedValue(mockBalance),
      };

      vi.mocked(ccxt.gateio).mockImplementation(() => mockExchange as any);

      // Act
      const result = await validator.validateApiKey({
        exchange: 'gateio',
        apiKey: 'test-key',
        apiSecret: 'test-secret',
        environment: 'MAINNET',
      });

      // Assert
      expect(result.isValid).toBe(true);
    });

    it('should route to validateMexcKey for mexc exchange', async () => {
      // Arrange
      const mockBalance = {
        total: { USDT: 500 },
        free: { USDT: 400 },
      };

      const mockExchange = {
        fetchBalance: vi.fn().mockResolvedValue(mockBalance),
      };

      vi.mocked(ccxt.mexc).mockImplementation(() => mockExchange as any);

      // Act
      const result = await validator.validateApiKey({
        exchange: 'mexc',
        apiKey: 'test-key',
        apiSecret: 'test-secret',
        environment: 'MAINNET',
      });

      // Assert
      expect(result.isValid).toBe(true);
    });

    it('should return EXCHANGE_ERROR for unsupported exchange', async () => {
      // Act
      const result = await validator.validateApiKey({
        exchange: 'unsupported' as any,
        apiKey: 'test-key',
        apiSecret: 'test-secret',
        environment: 'MAINNET',
      });

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe('EXCHANGE_ERROR');
    });
  });
});
