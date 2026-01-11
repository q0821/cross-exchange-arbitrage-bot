/**
 * Test: ApiKeyValidator
 *
 * API Key 驗證器單元測試
 *
 * 注意：CCXT 相關交易所（OKX、Gate.io、MEXC、BingX）使用實際的 CCXT 庫，
 * 由於 CCXT 在 Vitest 環境中初始化有問題，這些測試專注於 Binance（使用原生 fetch）
 * 和基本功能測試。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock ccxt 在任何 import 之前 - 避免 scure-starknet 初始化錯誤
vi.mock('ccxt', () => ({
  default: {
    pro: {
      okx: vi.fn(),
      gateio: vi.fn(),
      mexc: vi.fn(),
      bingx: vi.fn(),
    },
  },
  pro: {
    okx: vi.fn(),
    gateio: vi.fn(),
    mexc: vi.fn(),
    bingx: vi.fn(),
  },
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
  },
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// 在 mock 設定後才 import
import { ApiKeyValidator, apiKeyValidator } from '@/services/apikey/ApiKeyValidator';

describe('ApiKeyValidator', () => {
  let validator: ApiKeyValidator;

  beforeEach(() => {
    vi.clearAllMocks();
    validator = new ApiKeyValidator();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateBinanceKey', () => {
    it('should return success for valid Portfolio Margin API key', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { asset: 'USDT', totalWalletBalance: '1000.00', crossMarginFree: '800.00' },
        ],
      });

      const result = await validator.validateBinanceKey('api-key', 'api-secret', 'MAINNET');

      expect(result.isValid).toBe(true);
      expect(result.hasReadPermission).toBe(true);
      expect(result.hasTradePermission).toBe(true);
      expect(result.details?.balance?.total).toBe(1000);
      expect(result.details?.balance?.available).toBe(800);
      expect(result.details?.exchange).toBe('binance');
      expect(result.details?.environment).toBe('MAINNET');
    });

    it('should fallback to Futures API when Portfolio Margin fails', async () => {
      // Portfolio Margin fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => '{"code": -2015, "msg": "Invalid API-key"}',
      });

      // Futures API succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalWalletBalance: '500.00',
          availableBalance: '400.00',
          assets: [{ asset: 'USDT', walletBalance: '500.00', availableBalance: '400.00' }],
        }),
      });

      const result = await validator.validateBinanceKey('api-key', 'api-secret', 'MAINNET');

      expect(result.isValid).toBe(true);
      expect(result.hasTradePermission).toBe(true);
      expect(result.details?.balance?.total).toBe(500);
    });

    it('should fallback to Spot API when both PM and Futures fail', async () => {
      // Portfolio Margin fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => '{}',
      });

      // Futures API fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => '{}',
      });

      // Spot API succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          balances: [{ asset: 'USDT', free: '100.00', locked: '50.00' }],
        }),
      });

      const result = await validator.validateBinanceKey('api-key', 'api-secret', 'MAINNET');

      expect(result.isValid).toBe(true);
      expect(result.hasReadPermission).toBe(true);
      expect(result.hasTradePermission).toBe(false); // Spot only = no futures permission
      expect(result.details?.balance?.total).toBe(150);
      expect(result.details?.balance?.available).toBe(100);
    });

    it('should return error for invalid API key', async () => {
      // All APIs fail with invalid key error
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ code: -2015, msg: 'Invalid API-key' }),
      });

      const result = await validator.validateBinanceKey('invalid-key', 'secret', 'MAINNET');

      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe('INVALID_API_KEY');
      expect(result.error).toContain('Invalid');
    });

    it('should return error for invalid signature', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ code: -1022, msg: 'Signature for this request is not valid' }),
      });

      const result = await validator.validateBinanceKey('key', 'wrong-secret', 'MAINNET');

      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe('INVALID_SECRET');
    });

    it('should return error for IP not whitelisted', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ msg: 'IP not whitelisted' }),
      });

      const result = await validator.validateBinanceKey('key', 'secret', 'MAINNET');

      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe('IP_NOT_WHITELISTED');
    });

    it('should use testnet URLs for TESTNET environment', async () => {
      // Futures API succeeds on testnet
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ totalWalletBalance: '100.00' }),
      });

      await validator.validateBinanceKey('key', 'secret', 'TESTNET');

      // First call should be to futures testnet (no PM testnet)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('testnet.binancefuture.com'),
        expect.any(Object)
      );
    });

    it('should include response time in details', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ asset: 'USDT', totalWalletBalance: '0', crossMarginFree: '0' }],
      });

      const result = await validator.validateBinanceKey('key', 'secret', 'MAINNET');

      expect(result.details?.responseTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle fetch network error', async () => {
      mockFetch.mockImplementation(() => {
        throw new Error('ENOTFOUND');
      });

      const result = await validator.validateBinanceKey('key', 'secret', 'MAINNET');

      expect(result.isValid).toBe(false);
    });

    it('should sign requests correctly with HMAC SHA256', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ asset: 'USDT', totalWalletBalance: '100', crossMarginFree: '100' }],
      });

      await validator.validateBinanceKey('test-key', 'test-secret', 'MAINNET');

      // Check that the request contains required headers and signature
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringMatching(/signature=[a-f0-9]{64}/), // HMAC SHA256 is 64 hex chars
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-MBX-APIKEY': 'test-key',
          }),
        })
      );
    });

    it('should use correct base URL for MAINNET Portfolio Margin', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ asset: 'USDT', totalWalletBalance: '0', crossMarginFree: '0' }],
      });

      await validator.validateBinanceKey('key', 'secret', 'MAINNET');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('papi.binance.com'),
        expect.any(Object)
      );
    });

    it('should extract USDT balance from assets array', async () => {
      // PM fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => '{}',
      });

      // Futures with assets array
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalWalletBalance: '1000.00',
          availableBalance: '800.00',
          assets: [
            { asset: 'BTC', walletBalance: '0.1', availableBalance: '0.05' },
            { asset: 'USDT', walletBalance: '1500.00', availableBalance: '1200.00' },
          ],
        }),
      });

      const result = await validator.validateBinanceKey('key', 'secret', 'MAINNET');

      expect(result.details?.balance?.total).toBe(1500);
      expect(result.details?.balance?.available).toBe(1200);
    });
  });

  describe('validateApiKey (unified entry)', () => {
    it('should route to Binance validation', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ asset: 'USDT', totalWalletBalance: '100', crossMarginFree: '100' }],
      });

      const result = await validator.validateApiKey({
        exchange: 'binance',
        apiKey: 'key',
        apiSecret: 'secret',
        environment: 'MAINNET',
      });

      expect(result.isValid).toBe(true);
      expect(result.details?.exchange).toBe('binance');
    });

    it('should return error for OKX without passphrase', async () => {
      const result = await validator.validateApiKey({
        exchange: 'okx',
        apiKey: 'key',
        apiSecret: 'secret',
        environment: 'MAINNET',
      });

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('OKX requires passphrase');
      expect(result.errorCode).toBe('INVALID_PASSPHRASE');
    });

    it('should return error for unsupported exchange', async () => {
      const result = await validator.validateApiKey({
        exchange: 'kraken' as any,
        apiKey: 'key',
        apiSecret: 'secret',
        environment: 'MAINNET',
      });

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Unsupported exchange');
      expect(result.errorCode).toBe('EXCHANGE_ERROR');
    });
  });

  describe('Singleton Instance', () => {
    it('should export singleton instance', () => {
      expect(apiKeyValidator).toBeInstanceOf(ApiKeyValidator);
    });

    it('should be the same instance on multiple imports', async () => {
      const { apiKeyValidator: validator2 } = await import('@/services/apikey/ApiKeyValidator');
      expect(apiKeyValidator).toBe(validator2);
    });
  });

  describe('ValidationResult structure', () => {
    it('should return correct structure for valid result', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ asset: 'USDT', totalWalletBalance: '100', crossMarginFree: '80' }],
      });

      const result = await validator.validateBinanceKey('key', 'secret', 'MAINNET');

      expect(result).toMatchObject({
        isValid: true,
        hasReadPermission: true,
        hasTradePermission: true,
        details: {
          exchange: 'binance',
          environment: 'MAINNET',
          balance: {
            total: expect.any(Number),
            available: expect.any(Number),
            currency: 'USDT',
          },
          responseTime: expect.any(Number),
        },
      });
      expect(result.error).toBeUndefined();
      expect(result.errorCode).toBeUndefined();
    });

    it('should return correct structure for invalid result', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ code: -2015, msg: 'Invalid API-key' }),
      });

      const result = await validator.validateBinanceKey('key', 'secret', 'MAINNET');

      expect(result).toMatchObject({
        isValid: false,
        hasReadPermission: false,
        hasTradePermission: false,
        error: expect.any(String),
        errorCode: expect.any(String),
      });
      expect(result.details).toBeUndefined();
    });
  });
});
