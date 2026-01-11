import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { BinanceConnector } from '../../../src/connectors/binance';
import axios from 'axios';

// Mock @binance/connector
vi.mock('@binance/connector', () => ({
  Spot: vi.fn(function() { return {
    time: vi.fn().mockResolvedValue({ data: {} }),
  }; }),
}));

// Mock axios
vi.mock('axios');

// Mock logger
vi.mock('../../../src/lib/logger', () => {
  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  };
  return {
    logger: mockLogger,
    exchangeLogger: mockLogger,
    tradingLogger: mockLogger,
    arbitrageLogger: mockLogger,
    riskLogger: mockLogger,
    wsLogger: mockLogger,
    dbLogger: mockLogger,
    cliLogger: mockLogger,
    createLogger: vi.fn(() => mockLogger),
  };
});

// Mock config
vi.mock('../../../src/lib/config', () => ({
  apiKeys: {
    binance: {
      apiKey: 'test-api-key',
      apiSecret: 'test-api-secret',
      testnet: false,
    },
  },
}));

describe('BinanceConnector', () => {
  let connector: BinanceConnector;

  beforeEach(async () => {
    vi.clearAllMocks();
    connector = new BinanceConnector(false);
  });

  afterEach(async () => {
    if (connector && connector.isConnected()) {
      await connector.disconnect();
    }
  });

  describe('Connection Management', () => {
    it('should connect successfully', async () => {
      await connector.connect();
      expect(connector.isConnected()).toBe(true);
    });

    it('should emit connected event on successful connection', async () => {
      const connectedHandler = vi.fn();
      connector.on('connected', connectedHandler);

      await connector.connect();

      expect(connectedHandler).toHaveBeenCalled();
    });

    it('should disconnect successfully', async () => {
      await connector.connect();
      expect(connector.isConnected()).toBe(true);

      await connector.disconnect();
      expect(connector.isConnected()).toBe(false);
    });

    it('should emit disconnected event on disconnect', async () => {
      await connector.connect();

      const disconnectedHandler = vi.fn();
      connector.on('disconnected', disconnectedHandler);

      await connector.disconnect();

      expect(disconnectedHandler).toHaveBeenCalled();
    });

    it('should have binance as exchange name', () => {
      // BinanceConnector inherits from BaseExchangeConnector with name='binance'
      expect(connector['name']).toBe('binance');
    });
  });

  describe('getFundingInterval method', () => {
    beforeEach(async () => {
      await connector.connect();
    });
    it('should fetch 4h interval for BLZUSDT from Binance API', async () => {
      // Mock /fapi/v1/fundingInfo API response
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: {
          symbol: 'BLZUSDT',
          fundingIntervalHours: 4,
          adjustedFundingRateCap: '0.02500000',
          adjustedFundingRateFloor: '-0.02500000',
        },
      });

      const interval = await connector.getFundingInterval('BLZUSDT');

      expect(interval).toBe(4);
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/fapi/v1/fundingInfo'),
        expect.objectContaining({
          params: { symbol: 'BLZUSDT' },
        })
      );
    });

    it('should fetch 8h interval for BTCUSDT from Binance API', async () => {
      // Mock /fapi/v1/fundingInfo API response
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: {
          symbol: 'BTCUSDT',
          fundingIntervalHours: 8,
          adjustedFundingRateCap: '0.03000000',
          adjustedFundingRateFloor: '-0.03000000',
        },
      });

      const interval = await connector.getFundingInterval('BTCUSDT');

      expect(interval).toBe(8);
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/fapi/v1/fundingInfo'),
        expect.objectContaining({
          params: { symbol: 'BTCUSDT' },
        })
      );
    });

    it('should use default 8h interval when API fails', async () => {
      // Mock API failure
      vi.mocked(axios.get).mockRejectedValueOnce(new Error('Network error'));

      const interval = await connector.getFundingInterval('BTCUSDT');

      expect(interval).toBe(8);
    });

    it('should use default 8h interval when fundingIntervalHours is missing', async () => {
      // Mock API response without fundingIntervalHours field
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: {
          symbol: 'BTCUSDT',
          adjustedFundingRateCap: '0.03000000',
        },
      });

      const interval = await connector.getFundingInterval('BTCUSDT');

      expect(interval).toBe(8);
    });

    it('should cache interval values and not call API twice', async () => {
      // Mock first API call
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: {
          symbol: 'BTCUSDT',
          fundingIntervalHours: 8,
        },
      });

      // First call
      const interval1 = await connector.getFundingInterval('BTCUSDT');
      expect(interval1).toBe(8);

      // Clear previous mocks to verify second call doesn't happen
      const callCountAfterFirst = vi.mocked(axios.get).mock.calls.length;

      // Second call (should use cache)
      const interval2 = await connector.getFundingInterval('BTCUSDT');
      expect(interval2).toBe(8);

      // Verify API was not called again
      expect(vi.mocked(axios.get).mock.calls.length).toBe(callCountAfterFirst);
    });

    it('should handle rate limit errors gracefully', async () => {
      // Mock rate limit error
      const rateLimitError = new Error('Rate limit exceeded');
      (rateLimitError as Error & { response?: { status: number } }).response = { status: 429 };
      vi.mocked(axios.get).mockRejectedValueOnce(rateLimitError);

      const interval = await connector.getFundingInterval('BTCUSDT');

      expect(interval).toBe(8); // Should fallback to default
    });

    it('should handle non-standard intervals (e.g., 6h)', async () => {
      // Mock API response with non-standard interval
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: {
          symbol: 'TESTUSDT',
          fundingIntervalHours: 6,
        },
      });

      const interval = await connector.getFundingInterval('TESTUSDT');

      expect(interval).toBe(6); // Should accept and cache non-standard values
    });
  });

  describe('getFundingRate with dynamic interval', () => {
    beforeEach(async () => {
      await connector.connect();
    });

    it('should populate fundingInterval field dynamically', async () => {
      // First, populate the interval via getFundingInterval
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: {
          symbol: 'BLZUSDT',
          fundingIntervalHours: 4,
        },
      });

      // Call getFundingInterval first to cache the value
      const interval = await connector.getFundingInterval('BLZUSDT');
      expect(interval).toBe(4);

      // Now mock the premiumIndex API call
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: {
          symbol: 'BLZUSDT',
          lastFundingRate: '0.0001',
          nextFundingTime: Date.now() + 3600000,
          markPrice: '0.5',
          indexPrice: '0.49',
        },
      });

      // Now call getFundingRate, which should use the cached interval
      const fundingRate = await connector.getFundingRate('BLZUSDT');

      expect(fundingRate.fundingInterval).toBe(4);
      expect(fundingRate.symbol).toBe('BLZUSDT');
      expect(fundingRate.fundingRate).toBe(0.0001);
    });
  });

  describe('getFundingRates (batch)', () => {
    beforeEach(async () => {
      await connector.connect();
    });

    it('should fetch multiple funding rates at once', async () => {
      // Mock premiumIndex API response for all symbols
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: [
          {
            symbol: 'BTCUSDT',
            lastFundingRate: '0.0001',
            nextFundingTime: Date.now() + 3600000,
            markPrice: '50000',
            indexPrice: '49990',
          },
          {
            symbol: 'ETHUSDT',
            lastFundingRate: '0.00015',
            nextFundingTime: Date.now() + 3600000,
            markPrice: '3000',
            indexPrice: '2998',
          },
        ],
      });

      const rates = await connector.getFundingRates(['BTCUSDT', 'ETHUSDT']);

      expect(rates).toHaveLength(2);
      expect(rates[0].symbol).toBe('BTCUSDT');
      expect(rates[1].symbol).toBe('ETHUSDT');
    });

    it('should filter results to requested symbols only', async () => {
      // Mock API returns all symbols
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: [
          { symbol: 'BTCUSDT', lastFundingRate: '0.0001', nextFundingTime: Date.now() + 3600000 },
          { symbol: 'ETHUSDT', lastFundingRate: '0.00015', nextFundingTime: Date.now() + 3600000 },
          { symbol: 'XRPUSDT', lastFundingRate: '0.0002', nextFundingTime: Date.now() + 3600000 },
        ],
      });

      const rates = await connector.getFundingRates(['BTCUSDT']);

      expect(rates).toHaveLength(1);
      expect(rates[0].symbol).toBe('BTCUSDT');
    });
  });

  describe('getPrice', () => {
    it('should throw error when not connected', async () => {
      // Don't connect, connector should be in disconnected state
      const newConnector = new BinanceConnector(false);

      await expect(newConnector.getPrice('BTCUSDT')).rejects.toThrow();
    });
  });

  describe('ensureConnected', () => {
    it('should throw ExchangeConnectionError when not connected', async () => {
      const newConnector = new BinanceConnector(false);

      // Access protected method via type assertion
      expect(() => (newConnector as any).ensureConnected()).toThrow();
    });

    it('should not throw when connected', async () => {
      await connector.connect();

      // Access protected method via type assertion
      expect(() => (connector as any).ensureConnected()).not.toThrow();
    });
  });

  describe('Testnet Configuration', () => {
    it('should use testnet URLs when testnet is true', async () => {
      const testnetConnector = new BinanceConnector(true);
      await testnetConnector.connect();

      // Verify testnet connector is connected
      expect(testnetConnector.isConnected()).toBe(true);

      await testnetConnector.disconnect();
    });
  });
});
