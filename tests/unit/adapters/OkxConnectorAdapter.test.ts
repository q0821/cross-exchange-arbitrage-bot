/**
 * Test: OkxConnectorAdapter
 *
 * OKX 連接器適配器單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OkxConnectorAdapter } from '@/adapters/OkxConnectorAdapter';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('OkxConnectorAdapter', () => {
  let adapter: OkxConnectorAdapter;
  let mockConnector: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockConnector = {
      getFundingRateNative: vi.fn(),
    };

    adapter = new OkxConnectorAdapter(mockConnector);
  });

  describe('getFundingRateNative', () => {
    it('should fetch funding rate and convert symbol format', async () => {
      const mockResult = {
        fundingRate: 0.0001,
        nextFundingRate: 0.00012,
        fundingTime: new Date(),
      };
      mockConnector.getFundingRateNative.mockResolvedValue(mockResult);

      const result = await adapter.getFundingRateNative('BTC-USDT-SWAP');

      // Should convert symbol to Binance format
      expect(mockConnector.getFundingRateNative).toHaveBeenCalledWith('BTCUSDT');
      expect(result).toEqual(mockResult);
    });

    it('should handle ETH-USDT-SWAP symbol', async () => {
      const mockResult = { fundingRate: 0.0002 };
      mockConnector.getFundingRateNative.mockResolvedValue(mockResult);

      await adapter.getFundingRateNative('ETH-USDT-SWAP');

      expect(mockConnector.getFundingRateNative).toHaveBeenCalledWith('ETHUSDT');
    });

    it('should handle SOL-USDT-SWAP symbol', async () => {
      const mockResult = { fundingRate: 0.0003 };
      mockConnector.getFundingRateNative.mockResolvedValue(mockResult);

      await adapter.getFundingRateNative('SOL-USDT-SWAP');

      expect(mockConnector.getFundingRateNative).toHaveBeenCalledWith('SOLUSDT');
    });

    it('should handle symbol without -SWAP suffix', async () => {
      const mockResult = { fundingRate: 0.0001 };
      mockConnector.getFundingRateNative.mockResolvedValue(mockResult);

      await adapter.getFundingRateNative('BTC-USDT');

      expect(mockConnector.getFundingRateNative).toHaveBeenCalledWith('BTCUSDT');
    });

    it('should return funding rate result with optional fields', async () => {
      const fundingTime = new Date('2024-01-15T08:00:00Z');
      const mockResult = {
        fundingRate: 0.0001,
        nextFundingRate: 0.00015,
        fundingTime,
      };
      mockConnector.getFundingRateNative.mockResolvedValue(mockResult);

      const result = await adapter.getFundingRateNative('BTC-USDT-SWAP');

      expect(result.fundingRate).toBe(0.0001);
      expect(result.nextFundingRate).toBe(0.00015);
      expect(result.fundingTime).toEqual(fundingTime);
    });

    it('should return result without optional fields', async () => {
      const mockResult = {
        fundingRate: 0.0001,
      };
      mockConnector.getFundingRateNative.mockResolvedValue(mockResult);

      const result = await adapter.getFundingRateNative('BTC-USDT-SWAP');

      expect(result.fundingRate).toBe(0.0001);
      expect(result.nextFundingRate).toBeUndefined();
      expect(result.fundingTime).toBeUndefined();
    });

    it('should throw error when connector fails', async () => {
      mockConnector.getFundingRateNative.mockRejectedValue(new Error('API error'));

      await expect(adapter.getFundingRateNative('BTC-USDT-SWAP')).rejects.toThrow('API error');
    });

    it('should throw error when connector throws non-Error', async () => {
      mockConnector.getFundingRateNative.mockRejectedValue('String error');

      await expect(adapter.getFundingRateNative('BTC-USDT-SWAP')).rejects.toThrow();
    });
  });

  describe('Symbol Conversion', () => {
    // Testing the private toBinanceSymbol method through public API

    it('should convert standard OKX swap symbol', async () => {
      mockConnector.getFundingRateNative.mockResolvedValue({ fundingRate: 0 });

      await adapter.getFundingRateNative('BTC-USDT-SWAP');

      expect(mockConnector.getFundingRateNative).toHaveBeenCalledWith('BTCUSDT');
    });

    it('should convert symbol with multiple hyphens', async () => {
      mockConnector.getFundingRateNative.mockResolvedValue({ fundingRate: 0 });

      await adapter.getFundingRateNative('1000PEPE-USDT-SWAP');

      // Should remove all hyphens
      expect(mockConnector.getFundingRateNative).toHaveBeenCalledWith('1000PEPEUSDT');
    });

    it('should convert lowercase symbol (case-sensitive -SWAP removal)', async () => {
      mockConnector.getFundingRateNative.mockResolvedValue({ fundingRate: 0 });

      await adapter.getFundingRateNative('btc-usdt-swap');

      // Note: replace('-SWAP', '') is case-sensitive, so lowercase -swap is not removed
      expect(mockConnector.getFundingRateNative).toHaveBeenCalledWith('btcusdtswap');
    });

    it('should handle symbol with partial -SWAP suffix', async () => {
      mockConnector.getFundingRateNative.mockResolvedValue({ fundingRate: 0 });

      await adapter.getFundingRateNative('XRPSWAP-USDT');

      // XRPSWAP is not -SWAP suffix, so only hyphens are removed
      expect(mockConnector.getFundingRateNative).toHaveBeenCalledWith('XRPSWAPUSDT');
    });

    it('should handle different quote currencies', async () => {
      mockConnector.getFundingRateNative.mockResolvedValue({ fundingRate: 0 });

      await adapter.getFundingRateNative('BTC-USDC-SWAP');

      expect(mockConnector.getFundingRateNative).toHaveBeenCalledWith('BTCUSDC');
    });
  });

  describe('Error Handling', () => {
    it('should log error with symbol when API fails', async () => {
      const { logger } = await import('@/lib/logger');
      mockConnector.getFundingRateNative.mockRejectedValue(new Error('Network timeout'));

      await expect(adapter.getFundingRateNative('BTC-USDT-SWAP')).rejects.toThrow('Network timeout');

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'BTC-USDT-SWAP',
          error: 'Network timeout',
        }),
        expect.any(String),
      );
    });

    it('should log debug when fetching funding rate', async () => {
      const { logger } = await import('@/lib/logger');
      mockConnector.getFundingRateNative.mockResolvedValue({ fundingRate: 0.0001 });

      await adapter.getFundingRateNative('BTC-USDT-SWAP');

      expect(logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'BTC-USDT-SWAP',
          binanceSymbol: 'BTCUSDT',
        }),
        expect.any(String),
      );
    });
  });

  describe('Constructor', () => {
    it('should accept OKXConnector instance', () => {
      const connector = mockConnector;
      const newAdapter = new OkxConnectorAdapter(connector);

      expect(newAdapter).toBeInstanceOf(OkxConnectorAdapter);
    });

    it('should store connector reference', async () => {
      mockConnector.getFundingRateNative.mockResolvedValue({ fundingRate: 0 });

      await adapter.getFundingRateNative('BTC-USDT-SWAP');

      // Verify the stored connector was called
      expect(mockConnector.getFundingRateNative).toHaveBeenCalled();
    });
  });
});
