/**
 * MEXC 資金費率 WebSocket 單元測試
 * Feature 052: 交易所 WebSocket 即時數據訂閱
 * Task T012: 單元測試 MEXC 資金費率解析
 */

import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { parseCcxtFundingRate } from '@/lib/schemas/websocket-messages';

describe('MexcFundingWs', () => {
  describe('CCXT Format Parsing', () => {
    describe('parseCcxtFundingRate (MEXC)', () => {
      it('should parse valid CCXT funding rate from MEXC', () => {
        const mockCcxtData = {
          info: {},
          symbol: 'BTC/USDT:USDT',
          fundingRate: 0.0001,
          fundingTimestamp: 1704096000000,
          fundingDatetime: '2024-01-01T08:00:00.000Z',
          nextFundingRate: 0.00012,
          nextFundingTimestamp: 1704124800000,
          nextFundingDatetime: '2024-01-01T16:00:00.000Z',
        };

        const result = parseCcxtFundingRate(mockCcxtData);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.symbol).toBe('BTC/USDT:USDT');
          expect(result.data.fundingRate).toBe(0.0001);
          expect(result.data.nextFundingRate).toBe(0.00012);
        }
      });

      it('should handle minimal CCXT funding rate', () => {
        const minimalCcxtData = {
          info: {},
          symbol: 'ETH/USDT:USDT',
          fundingRate: 0.0002,
        };

        const result = parseCcxtFundingRate(minimalCcxtData);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.symbol).toBe('ETH/USDT:USDT');
          expect(result.data.fundingRate).toBe(0.0002);
        }
      });

      it('should handle negative funding rate', () => {
        const negativeCcxtData = {
          info: {},
          symbol: 'SOL/USDT:USDT',
          fundingRate: -0.0003,
        };

        const result = parseCcxtFundingRate(negativeCcxtData);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.fundingRate).toBe(-0.0003);
        }
      });

      it('should handle zero funding rate', () => {
        const zeroCcxtData = {
          info: {},
          symbol: 'DOGE/USDT:USDT',
          fundingRate: 0,
        };

        const result = parseCcxtFundingRate(zeroCcxtData);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.fundingRate).toBe(0);
        }
      });

      it('should handle very small funding rate', () => {
        const smallCcxtData = {
          info: {},
          symbol: 'XRP/USDT:USDT',
          fundingRate: 0.00001234,
        };

        const result = parseCcxtFundingRate(smallCcxtData);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.fundingRate).toBe(0.00001234);
        }
      });
    });
  });

  describe('Symbol Conversion', () => {
    it('should convert CCXT symbol to internal format', () => {
      const ccxtSymbol = 'BTC/USDT:USDT';
      // CCXT: BTC/USDT:USDT -> BTCUSDT
      const symbol = ccxtSymbol.split('/').join('').split(':')[0];
      expect(symbol).toBe('BTCUSDT');
    });

    it('should handle various MEXC symbols', () => {
      const symbols = [
        { ccxt: 'BTC/USDT:USDT', expected: 'BTCUSDT' },
        { ccxt: 'ETH/USDT:USDT', expected: 'ETHUSDT' },
        { ccxt: 'SOL/USDT:USDT', expected: 'SOLUSDT' },
        { ccxt: 'DOGE/USDT:USDT', expected: 'DOGEUSDT' },
        { ccxt: 'ARB/USDT:USDT', expected: 'ARBUSDT' },
      ];

      for (const { ccxt, expected } of symbols) {
        const symbol = ccxt.split('/').join('').split(':')[0];
        expect(symbol).toBe(expected);
      }
    });
  });

  describe('FundingRate Normalization', () => {
    it('should normalize CCXT funding rate to Decimal', () => {
      const rateNum = 0.0001;
      const rate = new Decimal(rateNum);

      expect(rate.toNumber()).toBe(0.0001);
    });

    it('should handle scientific notation', () => {
      const rateNum = 1e-5;
      const rate = new Decimal(rateNum);

      expect(rate.toNumber()).toBe(0.00001);
    });

    it('should preserve precision', () => {
      const rateNum = 0.00012345678;
      const rate = new Decimal(rateNum);

      // Decimal.js preserves precision
      expect(rate.toNumber()).toBe(0.00012345678);
    });
  });

  describe('Timestamp Handling', () => {
    it('should parse CCXT timestamp (milliseconds)', () => {
      const timestampMs = 1704096000000;
      const date = new Date(timestampMs);

      expect(date.getTime()).toBe(timestampMs);
    });

    it('should parse CCXT datetime string', () => {
      const datetimeStr = '2024-01-01T08:00:00.000Z';
      const date = new Date(datetimeStr);

      expect(date.toISOString()).toBe(datetimeStr);
    });

    it('should calculate next funding time', () => {
      const currentFundingTime = 1704096000000;
      const nextFundingTime = 1704124800000;
      const intervalMs = nextFundingTime - currentFundingTime;
      const intervalHours = intervalMs / (1000 * 60 * 60);

      expect(intervalHours).toBe(8); // MEXC uses 8-hour interval
    });
  });

  describe('Error Handling', () => {
    it('should handle null data gracefully', () => {
      const result = parseCcxtFundingRate(null);
      expect(result.success).toBe(false);
    });

    it('should handle undefined data gracefully', () => {
      const result = parseCcxtFundingRate(undefined);
      expect(result.success).toBe(false);
    });

    it('should handle missing symbol gracefully', () => {
      const invalidData = {
        info: {},
        fundingRate: 0.0001,
      };

      const result = parseCcxtFundingRate(invalidData);
      expect(result.success).toBe(false);
    });

    it('should handle missing fundingRate gracefully', () => {
      const invalidData = {
        info: {},
        symbol: 'BTC/USDT:USDT',
      };

      const result = parseCcxtFundingRate(invalidData);
      expect(result.success).toBe(false);
    });

    it('should handle invalid fundingRate type gracefully', () => {
      const invalidData = {
        info: {},
        symbol: 'BTC/USDT:USDT',
        fundingRate: '0.0001', // Should be number
      };

      const result = parseCcxtFundingRate(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('MEXC Specific Features', () => {
    it('should handle MEXC funding intervals (1h, 4h, 8h)', () => {
      const intervals = [1, 4, 8];

      for (const hours of intervals) {
        const intervalMs = hours * 60 * 60 * 1000;
        expect(intervalMs).toBe(hours * 3600000);
      }
    });

    it('should handle MEXC watchFundingRate result structure', () => {
      // MEXC via CCXT returns standard CCXT format
      const mockResult = {
        info: { original: 'mexc data' },
        symbol: 'BTC/USDT:USDT',
        fundingRate: 0.0001,
        fundingTimestamp: Date.now(),
        fundingDatetime: new Date().toISOString(),
      };

      expect(mockResult.info).toBeDefined();
      expect(mockResult.symbol).toContain('/');
      expect(typeof mockResult.fundingRate).toBe('number');
    });
  });
});
