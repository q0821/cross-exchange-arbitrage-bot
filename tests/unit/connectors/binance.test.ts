import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { BinanceConnector } from '../../../src/connectors/binance';
import axios from 'axios';

// Mock @binance/connector
vi.mock('@binance/connector', () => ({
  Spot: vi.fn().mockImplementation(() => ({
    time: vi.fn().mockResolvedValue({ data: {} }),
  })),
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

describe('BinanceConnector.getFundingInterval', () => {
  let connector: BinanceConnector;

  beforeEach(async () => {
    vi.clearAllMocks();
    connector = new BinanceConnector(false);

    await connector.connect();
  });

  afterEach(async () => {
    if (connector && connector.isConnected()) {
      await connector.disconnect();
    }
  });

  describe('getFundingInterval method', () => {
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
});
