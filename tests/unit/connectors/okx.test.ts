import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { OKXConnector } from '../../../src/connectors/okx';

// Mock ccxt
vi.mock('ccxt', () => ({
  default: {
    okx: vi.fn(function() { return {
      fetchTime: vi.fn().mockResolvedValue(Date.now()),
      fetchFundingRate: vi.fn(),
    }; }),
    NetworkError: class NetworkError extends Error {},
    ExchangeError: class ExchangeError extends Error {},
  },
}));

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
    okx: {
      apiKey: 'test-api-key',
      apiSecret: 'test-api-secret',
      passphrase: 'test-passphrase',
      testnet: false,
    },
  },
}));

describe('OKXConnector.getFundingInterval', () => {
  let connector: OKXConnector;

  beforeEach(async () => {
    vi.clearAllMocks();
    connector = new OKXConnector(false);
    await connector.connect();
  });

  afterEach(async () => {
    if (connector && connector.isConnected()) {
      await connector.disconnect();
    }
  });

  describe('getFundingInterval method', () => {
    it('should calculate 8h interval from CCXT timestamp difference', async () => {
      // Mock CCXT fetchFundingRate to return info with fundingTime and nextFundingTime
      const mockClient = (connector as any).client;
      const fundingTime = 1700000000000; // Mock timestamp
      const nextFundingTime = fundingTime + (8 * 60 * 60 * 1000); // +8 hours

      mockClient.fetchFundingRate = vi.fn().mockResolvedValue({
        symbol: 'BTC/USDT:USDT',
        fundingRate: 0.0001,
        fundingTimestamp: nextFundingTime,
        info: {
          fundingTime: fundingTime.toString(),
          nextFundingTime: nextFundingTime.toString(),
        },
      });

      const interval = await connector.getFundingInterval('BTCUSDT');

      expect(interval).toBe(8);
    });

    it('should calculate 4h interval from CCXT timestamp difference', async () => {
      const mockClient = (connector as any).client;
      const fundingTime = 1700000000000;
      const nextFundingTime = fundingTime + (4 * 60 * 60 * 1000); // +4 hours

      mockClient.fetchFundingRate = vi.fn().mockResolvedValue({
        symbol: 'ETH/USDT:USDT',
        fundingRate: 0.0002,
        fundingTimestamp: nextFundingTime,
        info: {
          fundingTime: fundingTime.toString(),
          nextFundingTime: nextFundingTime.toString(),
        },
      });

      const interval = await connector.getFundingInterval('ETHUSDT');

      expect(interval).toBe(4);
    });

    it('should use default 8h when CCXT does not expose timestamp fields', async () => {
      const mockClient = (connector as any).client;
      mockClient.fetchFundingRate = vi.fn().mockResolvedValue({
        symbol: 'BTC/USDT:USDT',
        fundingRate: 0.0001,
        fundingTimestamp: Date.now(),
        info: {}, // No fundingTime or nextFundingTime fields
      });

      const interval = await connector.getFundingInterval('BTCUSDT');

      expect(interval).toBe(8); // Default fallback
    });

    it('should use default 8h when timestamps are invalid (nextFundingTime <= fundingTime)', async () => {
      const mockClient = (connector as any).client;
      const fundingTime = 1700000000000;
      const invalidNextFundingTime = fundingTime - 1000; // Invalid: next < current

      mockClient.fetchFundingRate = vi.fn().mockResolvedValue({
        symbol: 'BTC/USDT:USDT',
        fundingRate: 0.0001,
        fundingTimestamp: Date.now(),
        info: {
          fundingTime: fundingTime.toString(),
          nextFundingTime: invalidNextFundingTime.toString(),
        },
      });

      const interval = await connector.getFundingInterval('BTCUSDT');

      expect(interval).toBe(8); // Default fallback for invalid data
    });

    it('should use default 8h when API call fails', async () => {
      const mockClient = (connector as any).client;
      mockClient.fetchFundingRate = vi.fn().mockRejectedValue(new Error('API error'));

      const interval = await connector.getFundingInterval('BTCUSDT');

      expect(interval).toBe(8); // Default fallback
    });

    it('should cache interval values', async () => {
      const mockClient = (connector as any).client;
      const fundingTime = 1700000000000;
      const nextFundingTime = fundingTime + (8 * 60 * 60 * 1000);

      const fetchSpy = vi.fn().mockResolvedValue({
        symbol: 'BTC/USDT:USDT',
        fundingRate: 0.0001,
        fundingTimestamp: nextFundingTime,
        info: {
          fundingTime: fundingTime.toString(),
          nextFundingTime: nextFundingTime.toString(),
        },
      });
      mockClient.fetchFundingRate = fetchSpy;

      // First call
      const interval1 = await connector.getFundingInterval('BTCUSDT');
      expect(interval1).toBe(8);
      const callCountAfterFirst = fetchSpy.mock.calls.length;

      // Second call (should use cache)
      const interval2 = await connector.getFundingInterval('BTCUSDT');
      expect(interval2).toBe(8);

      // Verify API was not called again
      expect(fetchSpy.mock.calls.length).toBe(callCountAfterFirst);
    });

    it('should handle fractional hours by rounding', async () => {
      const mockClient = (connector as any).client;
      const fundingTime = 1700000000000;
      // 8.5 hours -> should round to nearest integer
      const nextFundingTime = fundingTime + (8.5 * 60 * 60 * 1000);

      mockClient.fetchFundingRate = vi.fn().mockResolvedValue({
        symbol: 'BTC/USDT:USDT',
        fundingRate: 0.0001,
        fundingTimestamp: nextFundingTime,
        info: {
          fundingTime: fundingTime.toString(),
          nextFundingTime: nextFundingTime.toString(),
        },
      });

      const interval = await connector.getFundingInterval('BTCUSDT');

      // Should round 8.5 to 9 (or 8, depending on implementation)
      expect(interval).toBeGreaterThan(0);
      expect(Number.isInteger(interval)).toBe(true);
    });
  });

  describe('getFundingRate with dynamic interval', () => {
    it('should populate fundingInterval field dynamically', async () => {
      const mockClient = (connector as any).client;
      const fundingTime = 1700000000000;
      const nextFundingTime = fundingTime + (4 * 60 * 60 * 1000); // 4 hours

      // First call to cache the interval
      mockClient.fetchFundingRate = vi.fn().mockResolvedValue({
        symbol: 'BTC/USDT:USDT',
        fundingRate: 0.0001,
        fundingTimestamp: nextFundingTime,
        markPrice: 50000,
        indexPrice: 50010,
        info: {
          fundingTime: fundingTime.toString(),
          nextFundingTime: nextFundingTime.toString(),
        },
      });

      const interval = await connector.getFundingInterval('BTCUSDT');
      expect(interval).toBe(4);

      // Now call getFundingRate
      const fundingRate = await connector.getFundingRate('BTCUSDT');

      expect(fundingRate.fundingInterval).toBe(4);
      expect(fundingRate.symbol).toBe('BTCUSDT');
    });
  });
});
