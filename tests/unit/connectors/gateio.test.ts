import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GateioConnector } from '../../../src/connectors/gateio';
import { FundingIntervalCache } from '../../../src/lib/FundingIntervalCache';

// Mock ccxt
vi.mock('ccxt', () => ({
  default: {
    gateio: vi.fn(function() { return {
      fetchTime: vi.fn().mockResolvedValue(Date.now()),
      fetchFundingRate: vi.fn(),
    }; }),
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
    // 重置 FundingIntervalCache 單例，確保測試隔離
    FundingIntervalCache.resetInstance();
    connector = new GateioConnector(false);
    await connector.connect();
  });

  afterEach(async () => {
    if (connector && connector.isConnected()) {
      await connector.disconnect();
    }
    // 確保每個測試後重置單例
    FundingIntervalCache.resetInstance();
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

describe('GateioConnector Connection Management', () => {
  let connector: GateioConnector;

  beforeEach(() => {
    vi.clearAllMocks();
    // 重置 FundingIntervalCache 單例，確保測試隔離
    FundingIntervalCache.resetInstance();
    connector = new GateioConnector(false);
  });

  afterEach(async () => {
    if (connector && connector.isConnected()) {
      await connector.disconnect();
    }
    FundingIntervalCache.resetInstance();
  });

  describe('connect', () => {
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

    it('should have gateio as exchange name', () => {
      expect(connector['name']).toBe('gateio');
    });
  });

  describe('disconnect', () => {
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
  });

  describe('ensureConnected', () => {
    it('should throw ExchangeConnectionError when not connected', async () => {
      const newConnector = new GateioConnector(false);
      expect(() => (newConnector as any).ensureConnected()).toThrow();
    });

    it('should not throw when connected', async () => {
      await connector.connect();
      expect(() => (connector as any).ensureConnected()).not.toThrow();
    });
  });
});

describe('GateioConnector Symbol Conversion', () => {
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

  it('should convert BTCUSDT to BTC/USDT:USDT format internally', async () => {
    const mockClient = (connector as any).client;

    mockClient.fetchFundingRate = vi.fn().mockResolvedValue({
      symbol: 'BTC/USDT:USDT',
      fundingRate: 0.0001,
      fundingTimestamp: Date.now(),
      info: {
        funding_interval: 28800,
      },
    });

    await connector.getFundingRate('BTCUSDT');

    // Check that CCXT was called with the converted format
    expect(mockClient.fetchFundingRate).toHaveBeenCalledWith('BTC/USDT:USDT');
  });

  it('should convert ETHUSDT to ETH/USDT:USDT format internally', async () => {
    const mockClient = (connector as any).client;

    mockClient.fetchFundingRate = vi.fn().mockResolvedValue({
      symbol: 'ETH/USDT:USDT',
      fundingRate: 0.0002,
      fundingTimestamp: Date.now(),
      info: {
        funding_interval: 28800,
      },
    });

    await connector.getFundingRate('ETHUSDT');

    expect(mockClient.fetchFundingRate).toHaveBeenCalledWith('ETH/USDT:USDT');
  });

  it('should convert SOLUSDT to SOL/USDT:USDT format internally', async () => {
    const mockClient = (connector as any).client;

    mockClient.fetchFundingRate = vi.fn().mockResolvedValue({
      symbol: 'SOL/USDT:USDT',
      fundingRate: 0.0003,
      fundingTimestamp: Date.now(),
      info: {
        funding_interval: 28800,
      },
    });

    await connector.getFundingRate('SOLUSDT');

    expect(mockClient.fetchFundingRate).toHaveBeenCalledWith('SOL/USDT:USDT');
  });
});

describe('GateioConnector Testnet Configuration', () => {
  it('should create connector with testnet configuration', async () => {
    const testnetConnector = new GateioConnector(true);
    await testnetConnector.connect();

    expect(testnetConnector.isConnected()).toBe(true);
    expect(testnetConnector['isTestnet']).toBe(true);

    await testnetConnector.disconnect();
  });

  it('should create connector with mainnet configuration by default', async () => {
    const mainnetConnector = new GateioConnector(false);
    await mainnetConnector.connect();

    expect(mainnetConnector.isConnected()).toBe(true);
    expect(mainnetConnector['isTestnet']).toBe(false);

    await mainnetConnector.disconnect();
  });
});

describe('GateioConnector Error Handling', () => {
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

  it('should handle network errors gracefully in getFundingRate', async () => {
    const mockClient = (connector as any).client;
    mockClient.fetchFundingRate = vi.fn().mockRejectedValue(new Error('Network error'));

    // getFundingRate should throw the error
    await expect(connector.getFundingRate('BTCUSDT')).rejects.toThrow();
  });

  it('should handle malformed API response in getFundingInterval', async () => {
    const mockClient = (connector as any).client;
    mockClient.fetchFundingRate = vi.fn().mockResolvedValue({
      // Missing required fields
      info: null,
    });

    const interval = await connector.getFundingInterval('BTCUSDT');

    // Should fallback to default 8h
    expect(interval).toBe(8);
  });

  it('should handle zero funding_interval', async () => {
    const mockClient = (connector as any).client;
    mockClient.fetchFundingRate = vi.fn().mockResolvedValue({
      symbol: 'BTC/USDT:USDT',
      fundingRate: 0.0001,
      fundingTimestamp: Date.now(),
      info: {
        funding_interval: 0,
      },
    });

    const interval = await connector.getFundingInterval('BTCUSDT');

    // Should fallback to default 8h for zero interval
    expect(interval).toBe(8);
  });

  it('should handle negative funding_interval', async () => {
    const mockClient = (connector as any).client;
    mockClient.fetchFundingRate = vi.fn().mockResolvedValue({
      symbol: 'BTC/USDT:USDT',
      fundingRate: 0.0001,
      fundingTimestamp: Date.now(),
      info: {
        funding_interval: -28800,
      },
    });

    const interval = await connector.getFundingInterval('BTCUSDT');

    // Should fallback to default 8h for negative interval
    expect(interval).toBe(8);
  });
});
