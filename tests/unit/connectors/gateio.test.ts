import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GateioConnector } from '../../../src/connectors/gateio';

// Mock ccxt
vi.mock('ccxt', () => ({
  default: {
    gateio: vi.fn().mockImplementation(() => ({
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
    gateio: {
      apiKey: 'test-api-key',
      apiSecret: 'test-api-secret',
      testnet: false,
    },
  },
}));

describe('GateioConnector.getFundingInterval', () => {
  let connector: GateioConnector;

  beforeEach(async () => {
    vi.clearAllMocks();
    connector = new GateioConnector(false);
    await connector.connect();
  });

  afterEach(async () => {
    if (connector && connector.isConnected()) {
      await connector.disconnect();
    }
  });

  describe('getFundingInterval method', () => {
    it('should parse funding_interval (in seconds) from CCXT response and convert to hours', async () => {
      // Mock CCXT fetchFundingRate to return info with funding_interval (in seconds)
      const mockClient = (connector as any).client;
      mockClient.fetchFundingRate = vi.fn().mockResolvedValue({
        symbol: 'BTC/USDT:USDT',
        fundingRate: 0.0001,
        fundingTimestamp: Date.now(),
        info: {
          funding_interval: 28800, // 8 hours in seconds
        },
      });

      const interval = await connector.getFundingInterval('BTCUSDT');

      expect(interval).toBe(8); // Converted from seconds to hours
    });

    it('should handle 4h interval from funding_interval', async () => {
      const mockClient = (connector as any).client;
      mockClient.fetchFundingRate = vi.fn().mockResolvedValue({
        symbol: 'ETH/USDT:USDT',
        fundingRate: 0.0002,
        fundingTimestamp: Date.now(),
        info: {
          funding_interval: 14400, // 4 hours in seconds
        },
      });

      const interval = await connector.getFundingInterval('ETHUSDT');

      expect(interval).toBe(4);
    });

    it('should use default 8h when CCXT does not expose funding_interval', async () => {
      const mockClient = (connector as any).client;
      mockClient.fetchFundingRate = vi.fn().mockResolvedValue({
        symbol: 'BTC/USDT:USDT',
        fundingRate: 0.0001,
        fundingTimestamp: Date.now(),
        info: {}, // No funding_interval field
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
          funding_interval: 28800,
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

    it('should handle invalid funding_interval gracefully', async () => {
      const mockClient = (connector as any).client;
      mockClient.fetchFundingRate = vi.fn().mockResolvedValue({
        symbol: 'BTC/USDT:USDT',
        fundingRate: 0.0001,
        fundingTimestamp: Date.now(),
        info: {
          funding_interval: 'invalid', // Invalid type
        },
      });

      const interval = await connector.getFundingInterval('BTCUSDT');

      expect(interval).toBe(8); // Default fallback
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
          funding_interval: 14400, // 4 hours
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
