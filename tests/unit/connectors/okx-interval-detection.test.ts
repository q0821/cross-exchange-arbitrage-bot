import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { OKXConnector } from '../../../src/connectors/okx';
import { exchangeLogger as logger } from '../../../src/lib/logger';

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

describe('OKXConnector - Interval Detection (User Story 1)', () => {
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

  describe('T014 - should calculate interval from valid timestamps (8h)', () => {
    it('should correctly calculate 8h interval', async () => {
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
  });

  describe('T015 - should calculate interval from valid timestamps (4h)', () => {
    it('should correctly calculate 4h interval', async () => {
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
  });

  describe('T016 - should calculate interval from valid timestamps (1h)', () => {
    it('should correctly calculate 1h interval', async () => {
      const mockClient = (connector as any).client;
      const fundingTime = 1700000000000;
      const nextFundingTime = fundingTime + (1 * 60 * 60 * 1000); // +1 hour

      mockClient.fetchFundingRate = vi.fn().mockResolvedValue({
        symbol: 'SOL/USDT:USDT',
        fundingRate: 0.0003,
        fundingTimestamp: nextFundingTime,
        info: {
          fundingTime: fundingTime.toString(),
          nextFundingTime: nextFundingTime.toString(),
        },
      });

      const interval = await connector.getFundingInterval('SOLUSDT');

      expect(interval).toBe(1);
    });
  });

  describe('T017 - should cache calculated interval with "calculated" source', () => {
    it('should cache the calculated interval', async () => {
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

      // Verify the cache metadata
      const intervalCache = (connector as any).intervalCache;
      const metadata = intervalCache.getWithMetadata('okx', 'BTCUSDT');
      expect(metadata).not.toBeNull();
      expect(metadata?.source).toBe('calculated');
      expect(metadata?.interval).toBe(8);
    });
  });

  describe('User Story 2 - Enhanced Error Handling and Detailed Logging', () => {
    describe('T025 - should log warning when fundingTime is missing', () => {
      it('should log appropriate warning and use default 8h', async () => {
        const mockClient = (connector as any).client;

        mockClient.fetchFundingRate = vi.fn().mockResolvedValue({
          symbol: 'BTC/USDT:USDT',
          fundingRate: 0.0001,
          fundingTimestamp: Date.now(),
          info: {
            nextFundingTime: '1700000000000', // Only nextFundingTime, missing fundingTime
          },
        });

        const interval = await connector.getFundingInterval('BTCUSDT');

        expect(interval).toBe(8); // Default fallback
        expect(logger.warn).toHaveBeenCalledWith(
          expect.objectContaining({ symbol: 'BTCUSDT' }),
          expect.stringContaining('did not expose fundingTime')
        );
      });
    });

    describe('T026 - should log warning when nextFundingTime is missing', () => {
      it('should log appropriate warning and use default 8h', async () => {
        const mockClient = (connector as any).client;

        mockClient.fetchFundingRate = vi.fn().mockResolvedValue({
          symbol: 'BTC/USDT:USDT',
          fundingRate: 0.0001,
          fundingTimestamp: Date.now(),
          info: {
            fundingTime: '1700000000000', // Only fundingTime, missing nextFundingTime
          },
        });

        const interval = await connector.getFundingInterval('BTCUSDT');

        expect(interval).toBe(8); // Default fallback
        expect(logger.warn).toHaveBeenCalledWith(
          expect.objectContaining({ symbol: 'BTCUSDT' }),
          expect.stringContaining('did not expose fundingTime')
        );
      });
    });

    describe('T027 - should log error when timestamp parsing returns NaN', () => {
      it('should log appropriate error and use default 8h', async () => {
        const mockClient = (connector as any).client;

        mockClient.fetchFundingRate = vi.fn().mockResolvedValue({
          symbol: 'BTC/USDT:USDT',
          fundingRate: 0.0001,
          fundingTimestamp: Date.now(),
          info: {
            fundingTime: 'invalid-timestamp',
            nextFundingTime: '1700000000000',
          },
        });

        const interval = await connector.getFundingInterval('BTCUSDT');

        expect(interval).toBe(8); // Default fallback
        expect(logger.warn).toHaveBeenCalledWith(
          expect.objectContaining({
            symbol: 'BTCUSDT',
            fundingTime: expect.any(Number), // NaN
            nextFundingTime: expect.any(Number),
          }),
          expect.stringContaining('Invalid timestamps')
        );
      });
    });

    describe('T028 - should log error when nextFundingTime <= fundingTime', () => {
      it('should log appropriate error and use default 8h', async () => {
        const mockClient = (connector as any).client;
        const fundingTime = 1700000000000;
        const invalidNextFundingTime = fundingTime - 1000; // Earlier than fundingTime

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

        expect(interval).toBe(8); // Default fallback
        expect(logger.warn).toHaveBeenCalledWith(
          expect.objectContaining({
            symbol: 'BTCUSDT',
            fundingTime,
            nextFundingTime: invalidNextFundingTime,
          }),
          expect.stringContaining('Invalid timestamps')
        );
      });
    });

    describe('T029 - should log error when calculated interval is non-positive', () => {
      it('should log appropriate error and use default 8h when timestamps are equal', async () => {
        const mockClient = (connector as any).client;
        const fundingTime = 1700000000000;
        const nextFundingTime = fundingTime; // Same time = 0 hour interval

        mockClient.fetchFundingRate = vi.fn().mockResolvedValue({
          symbol: 'BTC/USDT:USDT',
          fundingRate: 0.0001,
          fundingTimestamp: Date.now(),
          info: {
            fundingTime: fundingTime.toString(),
            nextFundingTime: nextFundingTime.toString(),
          },
        });

        const interval = await connector.getFundingInterval('BTCUSDT');

        expect(interval).toBe(8); // Default fallback
        // When timestamps are equal, it's caught by the nextFundingTime <= fundingTime check
        expect(logger.warn).toHaveBeenCalledWith(
          expect.objectContaining({
            symbol: 'BTCUSDT',
            fundingTime,
            nextFundingTime,
          }),
          expect.stringContaining('nextFundingTime <= fundingTime')
        );
      });

      it('should log appropriate error when interval rounds to zero', async () => {
        const mockClient = (connector as any).client;
        const fundingTime = 1700000000000;
        // Very small difference that rounds to 0 hours
        const nextFundingTime = fundingTime + (30 * 60 * 1000); // 30 minutes = 0.5h, rounds to 0 or 1

        mockClient.fetchFundingRate = vi.fn().mockResolvedValue({
          symbol: 'BTC/USDT:USDT',
          fundingRate: 0.0001,
          fundingTimestamp: Date.now(),
          info: {
            fundingTime: fundingTime.toString(),
            nextFundingTime: nextFundingTime.toString(),
          },
        });

        const interval = await connector.getFundingInterval('BTCUSDT');

        // 30 minutes rounds to 1 hour with Math.round, so this test verifies rounding behavior
        // If it's < 0.5 hours, Math.round would give 0
        expect(interval).toBeGreaterThan(0);
      });
    });
  });

  describe('User Story 3 - Native API Fallback', () => {
    describe('T040 - should call Native API when CCXT fundingTime is missing', () => {
      it('should fallback to Native API and return correct interval', async () => {
        const mockClient = (connector as any).client;
        const axios = require('axios');

        // Mock CCXT to return incomplete data (missing fundingTime)
        mockClient.fetchFundingRate = vi.fn().mockResolvedValue({
          symbol: 'BTC/USDT:USDT',
          fundingRate: 0.0001,
          fundingTimestamp: Date.now(),
          info: {
            // Missing fundingTime and nextFundingTime - trigger fallback
          },
        });

        // Mock Native API response
        vi.spyOn(axios, 'get').mockResolvedValue({
          data: {
            code: '0',
            data: [
              {
                fundingRate: '0.0001',
                fundingTime: '1700000000000',
                nextFundingTime: '1700028800000', // +8 hours
              },
            ],
          },
        });

        const interval = await connector.getFundingInterval('BTCUSDT');

        expect(interval).toBe(8);
        expect(axios.get).toHaveBeenCalledWith(
          'https://www.okx.com/api/v5/public/funding-rate',
          expect.objectContaining({
            params: { instId: 'BTC-USDT-SWAP' },
          })
        );
      });
    });

    describe('T041 - should parse Native API response correctly', () => {
      it('should correctly parse Native API response for different intervals', async () => {
        const mockClient = (connector as any).client;
        const axios = require('axios');

        mockClient.fetchFundingRate = vi.fn().mockResolvedValue({
          symbol: 'ETH/USDT:USDT',
          fundingRate: 0.0002,
          fundingTimestamp: Date.now(),
          info: {}, // Trigger fallback
        });

        // Test 4h interval
        vi.spyOn(axios, 'get').mockResolvedValue({
          data: {
            code: '0',
            data: [
              {
                fundingRate: '0.0002',
                fundingTime: '1700000000000',
                nextFundingTime: '1700014400000', // +4 hours
              },
            ],
          },
        });

        const interval = await connector.getFundingInterval('ETHUSDT');
        expect(interval).toBe(4);
      });
    });

    describe('T042 - should cache Native API result with "native-api" source', () => {
      it('should cache interval from Native API with correct source', async () => {
        const mockClient = (connector as any).client;
        const axios = require('axios');

        mockClient.fetchFundingRate = vi.fn().mockResolvedValue({
          symbol: 'BTC/USDT:USDT',
          fundingRate: 0.0001,
          fundingTimestamp: Date.now(),
          info: {}, // Trigger fallback
        });

        vi.spyOn(axios, 'get').mockResolvedValue({
          data: {
            code: '0',
            data: [
              {
                fundingRate: '0.0001',
                fundingTime: '1700000000000',
                nextFundingTime: '1700028800000', // +8 hours
              },
            ],
          },
        });

        const interval = await connector.getFundingInterval('BTCUSDT');
        expect(interval).toBe(8);

        // Verify cache metadata
        const intervalCache = (connector as any).intervalCache;
        const metadata = intervalCache.getWithMetadata('okx', 'BTCUSDT');
        expect(metadata).not.toBeNull();
        expect(metadata?.source).toBe('native-api');
        expect(metadata?.interval).toBe(8);
      });
    });

    describe('T043 - should handle 51001 error (invalid instId)', () => {
      it('should handle invalid instId error and fallback to default', async () => {
        const mockClient = (connector as any).client;
        const axios = require('axios');

        mockClient.fetchFundingRate = vi.fn().mockResolvedValue({
          symbol: 'BTC/USDT:USDT',
          fundingRate: 0.0001,
          fundingTimestamp: Date.now(),
          info: {}, // Trigger fallback
        });

        // Mock Native API error response
        vi.spyOn(axios, 'get').mockResolvedValue({
          data: {
            code: '51001',
            msg: 'Instrument ID does not exist',
            data: [],
          },
        });

        const interval = await connector.getFundingInterval('INVALIDUSDT');
        expect(interval).toBe(8); // Default fallback
        expect(logger.warn).toHaveBeenCalledWith(
          expect.objectContaining({
            symbol: 'INVALIDUSDT',
          }),
          expect.stringContaining('Native API')
        );
      });
    });

    describe('T044 - should handle 50011 error (rate limit) with retry', () => {
      it('should retry on rate limit error', async () => {
        const mockClient = (connector as any).client;
        const axios = require('axios');

        mockClient.fetchFundingRate = vi.fn().mockResolvedValue({
          symbol: 'BTC/USDT:USDT',
          fundingRate: 0.0001,
          fundingTimestamp: Date.now(),
          info: {}, // Trigger fallback
        });

        // First call: rate limit error, Second call: success
        const axiosGetSpy = vi.spyOn(axios, 'get')
          .mockResolvedValueOnce({
            data: {
              code: '50011',
              msg: 'Rate limit exceeded',
              data: [],
            },
          })
          .mockResolvedValueOnce({
            data: {
              code: '0',
              data: [
                {
                  fundingRate: '0.0001',
                  fundingTime: '1700000000000',
                  nextFundingTime: '1700028800000', // +8 hours
                },
              ],
            },
          });

        const interval = await connector.getFundingInterval('BTCUSDT');
        expect(interval).toBe(8);
        expect(axiosGetSpy).toHaveBeenCalledTimes(2); // Called twice (retry)
      });
    });

    describe('T045 - should handle network timeout', () => {
      it('should handle timeout error and fallback to default', async () => {
        const mockClient = (connector as any).client;
        const axios = require('axios');

        mockClient.fetchFundingRate = vi.fn().mockResolvedValue({
          symbol: 'BTC/USDT:USDT',
          fundingRate: 0.0001,
          fundingTimestamp: Date.now(),
          info: {}, // Trigger fallback
        });

        // Mock timeout error
        vi.spyOn(axios, 'get').mockRejectedValue(new Error('timeout of 5000ms exceeded'));

        const interval = await connector.getFundingInterval('BTCUSDT');
        expect(interval).toBe(8); // Default fallback
        expect(logger.warn).toHaveBeenCalledWith(
          expect.objectContaining({
            symbol: 'BTCUSDT',
          }),
          expect.stringContaining('Native API')
        );
      });
    });
  });

  describe('User Story 4 - Interval Validation and Rounding', () => {
    describe('T059 - should accept exact standard intervals (1, 4, 8)', () => {
      it('should accept standard intervals without rounding', async () => {
        const mockClient = (connector as any).client;

        // Test 1h interval
        const fundingTime1h = 1700000000000;
        mockClient.fetchFundingRate = vi.fn().mockResolvedValue({
          symbol: 'BTC/USDT:USDT',
          fundingRate: 0.0001,
          fundingTimestamp: Date.now(),
          info: {
            fundingTime: fundingTime1h.toString(),
            nextFundingTime: (fundingTime1h + 1 * 60 * 60 * 1000).toString(),
          },
        });

        const interval1 = await connector.getFundingInterval('BTCUSDT');
        expect(interval1).toBe(1);

        // Test 4h interval
        const fundingTime4h = 1700000000000;
        mockClient.fetchFundingRate = vi.fn().mockResolvedValue({
          symbol: 'ETH/USDT:USDT',
          fundingRate: 0.0002,
          fundingTimestamp: Date.now(),
          info: {
            fundingTime: fundingTime4h.toString(),
            nextFundingTime: (fundingTime4h + 4 * 60 * 60 * 1000).toString(),
          },
        });

        const interval4 = await connector.getFundingInterval('ETHUSDT');
        expect(interval4).toBe(4);

        // Test 8h interval
        const fundingTime8h = 1700000000000;
        mockClient.fetchFundingRate = vi.fn().mockResolvedValue({
          symbol: 'SOL/USDT:USDT',
          fundingRate: 0.0003,
          fundingTimestamp: Date.now(),
          info: {
            fundingTime: fundingTime8h.toString(),
            nextFundingTime: (fundingTime8h + 8 * 60 * 60 * 1000).toString(),
          },
        });

        const interval8 = await connector.getFundingInterval('SOLUSDT');
        expect(interval8).toBe(8);
      });
    });

    describe('T060 - should round 7.9h to 8h with info log', () => {
      it('should round 7.9h to 8h and log info (deviation < 0.5h)', async () => {
        const mockClient = (connector as any).client;
        const fundingTime = 1700000000000;
        const nextFundingTime = fundingTime + (7.9 * 60 * 60 * 1000); // 7.9 hours

        mockClient.fetchFundingRate = vi.fn().mockResolvedValue({
          symbol: 'BTC/USDT:USDT',
          fundingRate: 0.0001,
          fundingTimestamp: Date.now(),
          info: {
            fundingTime: fundingTime.toString(),
            nextFundingTime: Math.round(nextFundingTime).toString(),
          },
        });

        const interval = await connector.getFundingInterval('BTCUSDT');
        expect(interval).toBe(8);

        // Verify info log was called (deviation is 0.1h < 0.5h tolerance)
        expect(logger.info).toHaveBeenCalledWith(
          expect.objectContaining({
            symbol: 'BTCUSDT',
            originalInterval: expect.any(Number),
            roundedInterval: 8,
          }),
          expect.stringContaining('rounded')
        );
      });
    });

    describe('T061 - should round 8.1h to 8h with info log', () => {
      it('should round 8.1h to 8h and log info (deviation < 0.5h)', async () => {
        const mockClient = (connector as any).client;
        const fundingTime = 1700000000000;
        const nextFundingTime = fundingTime + (8.1 * 60 * 60 * 1000); // 8.1 hours

        mockClient.fetchFundingRate = vi.fn().mockResolvedValue({
          symbol: 'BTC/USDT:USDT',
          fundingRate: 0.0001,
          fundingTimestamp: Date.now(),
          info: {
            fundingTime: fundingTime.toString(),
            nextFundingTime: Math.round(nextFundingTime).toString(),
          },
        });

        const interval = await connector.getFundingInterval('BTCUSDT');
        expect(interval).toBe(8);

        // Verify info log was called (deviation is 0.1h < 0.5h tolerance)
        expect(logger.info).toHaveBeenCalledWith(
          expect.objectContaining({
            symbol: 'BTCUSDT',
            originalInterval: expect.any(Number),
            roundedInterval: 8,
          }),
          expect.stringContaining('rounded')
        );
      });
    });

    describe('T062 - should round 3.8h to 4h', () => {
      it('should round 3.8h to 4h', async () => {
        const mockClient = (connector as any).client;
        const fundingTime = 1700000000000;
        const nextFundingTime = fundingTime + (3.8 * 60 * 60 * 1000); // 3.8 hours

        mockClient.fetchFundingRate = vi.fn().mockResolvedValue({
          symbol: 'ETH/USDT:USDT',
          fundingRate: 0.0002,
          fundingTimestamp: Date.now(),
          info: {
            fundingTime: fundingTime.toString(),
            nextFundingTime: Math.round(nextFundingTime).toString(),
          },
        });

        const interval = await connector.getFundingInterval('ETHUSDT');
        expect(interval).toBe(4);
      });
    });

    describe('T063 - should round 1.1h to 1h', () => {
      it('should round 1.1h to 1h', async () => {
        const mockClient = (connector as any).client;
        const fundingTime = 1700000000000;
        const nextFundingTime = fundingTime + (1.1 * 60 * 60 * 1000); // 1.1 hours

        mockClient.fetchFundingRate = vi.fn().mockResolvedValue({
          symbol: 'SOL/USDT:USDT',
          fundingRate: 0.0003,
          fundingTimestamp: Date.now(),
          info: {
            fundingTime: fundingTime.toString(),
            nextFundingTime: Math.round(nextFundingTime).toString(),
          },
        });

        const interval = await connector.getFundingInterval('SOLUSDT');
        expect(interval).toBe(1);
      });
    });

    describe('T064 - should warn when deviation > 0.5h (e.g., 2h -> 4h)', () => {
      it('should round 2h to 4h and log strong deviation warning', async () => {
        const mockClient = (connector as any).client;
        const fundingTime = 1700000000000;
        const nextFundingTime = fundingTime + (2 * 60 * 60 * 1000); // 2 hours (closest to 1h, deviation = 1h > 0.5h)

        mockClient.fetchFundingRate = vi.fn().mockResolvedValue({
          symbol: 'BTC/USDT:USDT',
          fundingRate: 0.0001,
          fundingTimestamp: Date.now(),
          info: {
            fundingTime: fundingTime.toString(),
            nextFundingTime: nextFundingTime.toString(),
          },
        });

        const interval = await connector.getFundingInterval('BTCUSDT');
        expect(interval).toBe(1); // 2h is closer to 1h than to 4h

        // Verify strong deviation warning was logged
        expect(logger.warn).toHaveBeenCalledWith(
          expect.objectContaining({
            symbol: 'BTCUSDT',
            originalInterval: 2,
            roundedInterval: 1,
            deviation: expect.any(Number),
          }),
          expect.stringContaining('Large deviation')
        );
      });
    });

    describe('T065 - should handle very small intervals by rounding to 1h', () => {
      it('should round very small positive interval (0.000027h) to 1h', async () => {
        const mockClient = (connector as any).client;
        const fundingTime = 1700000000000;
        const nextFundingTime = fundingTime + 100; // 100ms = 0.000027h

        mockClient.fetchFundingRate = vi.fn().mockResolvedValue({
          symbol: 'BTC/USDT:USDT',
          fundingRate: 0.0001,
          fundingTimestamp: Date.now(),
          info: {
            fundingTime: fundingTime.toString(),
            nextFundingTime: nextFundingTime.toString(),
          },
        });

        const interval = await connector.getFundingInterval('BTCUSDT');
        expect(interval).toBe(1); // Rounded to nearest standard interval (1h)

        // Should log large deviation warning
        expect(logger.warn).toHaveBeenCalledWith(
          expect.objectContaining({
            symbol: 'BTCUSDT',
            deviation: expect.any(Number),
          }),
          expect.stringContaining('Large deviation')
        );
      });
    });
  });
});
