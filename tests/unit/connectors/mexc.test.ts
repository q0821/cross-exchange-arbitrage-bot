import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MexcConnector } from '../../../src/connectors/mexc';

// Mock ccxt
vi.mock('ccxt', () => ({
  default: {
    mexc: vi.fn().mockImplementation(() => ({
      fetchTime: vi.fn().mockResolvedValue(Date.now()),
      fetchFundingRate: vi.fn(),
    })),
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
    mexc: {
      apiKey: 'test-api-key',
      apiSecret: 'test-api-secret',
      testnet: false,
    },
  },
}));

describe('MexcConnector.getFundingInterval', () => {
  let connector: MexcConnector;

  beforeEach(async () => {
    vi.clearAllMocks();
    connector = new MexcConnector(false);
    await connector.connect();
  });

  afterEach(async () => {
    if (connector && connector.isConnected()) {
      await connector.disconnect();
    }
  });

  describe('getFundingInterval method', () => {
    it('should parse collectCycle from CCXT response if available', async () => {
      // Mock CCXT fetchFundingRate to return info with collectCycle
      const mockClient = (connector as any).client;
      mockClient.fetchFundingRate = vi.fn().mockResolvedValue({
        symbol: 'BTC/USDT:USDT',
        fundingRate: 0.0001,
        fundingTimestamp: Date.now(),
        info: {
          collectCycle: 8, // MEXC native field (hours)
        },
      });

      const interval = await connector.getFundingInterval('BTCUSDT');

      expect(interval).toBe(8);
    });

    it('should handle 4h interval from collectCycle', async () => {
      const mockClient = (connector as any).client;
      mockClient.fetchFundingRate = vi.fn().mockResolvedValue({
        symbol: 'ETH/USDT:USDT',
        fundingRate: 0.0002,
        fundingTimestamp: Date.now(),
        info: {
          collectCycle: 4,
        },
      });

      const interval = await connector.getFundingInterval('ETHUSDT');

      expect(interval).toBe(4);
    });

    it('should use default 8h when CCXT does not expose collectCycle', async () => {
      const mockClient = (connector as any).client;
      mockClient.fetchFundingRate = vi.fn().mockResolvedValue({
        symbol: 'BTC/USDT:USDT',
        fundingRate: 0.0001,
        fundingTimestamp: Date.now(),
        info: {}, // No collectCycle field
      });

      const interval = await connector.getFundingInterval('BTCUSDT');

      expect(interval).toBe(8); // Default fallback
    });

    it('should use default 8h when both CCXT and native API fail', async () => {
      const mockClient = (connector as any).client;
      mockClient.fetchFundingRate = vi.fn().mockRejectedValue(new Error('API error'));

      const interval = await connector.getFundingInterval('BTCUSDT');

      expect(interval).toBe(8); // Default fallback
    });

    it('should cache interval values', async () => {
      const mockClient = (connector as any).client;
      const fetchSpy = vi.fn().mockResolvedValue({
        symbol: 'BTC/USDT:USDT',
        fundingRate: 0.0001,
        fundingTimestamp: Date.now(),
        info: {
          collectCycle: 8,
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
  });

  describe('getFundingRate with dynamic interval', () => {
    it('should populate fundingInterval field dynamically', async () => {
      const mockClient = (connector as any).client;

      // First call to cache the interval
      mockClient.fetchFundingRate = vi.fn().mockResolvedValue({
        symbol: 'BTC/USDT:USDT',
        fundingRate: 0.0001,
        fundingTimestamp: Date.now() + 3600000,
        info: {
          collectCycle: 4,
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
