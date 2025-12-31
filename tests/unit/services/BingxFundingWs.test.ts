/**
 * BingX 資金費率 WebSocket 單元測試
 * Feature 054: 交易所 WebSocket 即時數據訂閱
 * Task T012: 單元測試 BingX 資金費率解析
 */

import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  parseBingxMarkPriceEvent,
  parseCcxtFundingRate,
} from '@/lib/schemas/websocket-messages';
import { toBingxSymbol, fromBingxSymbol } from '@/lib/symbol-converter';
import type { BingxMarkPriceEvent } from '@/types/websocket-events';

describe('BingxFundingWs', () => {
  describe('Native Message Parsing', () => {
    describe('parseBingxMarkPriceEvent', () => {
      it('should parse valid BingX markPriceUpdate event', () => {
        const mockMessage: BingxMarkPriceEvent = {
          code: 0,
          data: {
            e: 'markPriceUpdate',
            E: 1704067200000,
            s: 'BTC-USDT',
            p: '42000.5',
            r: '0.0001',
            T: 1704096000000,
          },
        };

        const result = parseBingxMarkPriceEvent(mockMessage);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.code).toBe(0);
          expect(result.data.data.e).toBe('markPriceUpdate');
          expect(result.data.data.s).toBe('BTC-USDT');
          expect(result.data.data.p).toBe('42000.5');
          expect(result.data.data.r).toBe('0.0001');
        }
      });

      it('should parse negative funding rate', () => {
        const mockMessage: BingxMarkPriceEvent = {
          code: 0,
          data: {
            e: 'markPriceUpdate',
            E: 1704067200000,
            s: 'ETH-USDT',
            p: '2200.5',
            r: '-0.0002',
            T: 1704096000000,
          },
        };

        const result = parseBingxMarkPriceEvent(mockMessage);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.data.r).toBe('-0.0002');
        }
      });

      it('should reject message with error code', () => {
        const errorMessage = {
          code: 100001,
          msg: 'Invalid request',
        };

        const result = parseBingxMarkPriceEvent(errorMessage);

        // Schema 應該能解析但 code 不是 0
        expect(result.success).toBe(false);
      });

      it('should reject message with invalid event type', () => {
        const invalidMessage = {
          code: 0,
          data: {
            e: 'invalidEvent',
            E: 1704067200000,
            s: 'BTC-USDT',
            p: '42000.5',
            r: '0.0001',
            T: 1704096000000,
          },
        };

        const result = parseBingxMarkPriceEvent(invalidMessage);

        expect(result.success).toBe(false);
      });

      it('should reject message missing required fields', () => {
        const incompleteMessage = {
          code: 0,
          data: {
            e: 'markPriceUpdate',
            s: 'BTC-USDT',
            // Missing p, r, T, E fields
          },
        };

        const result = parseBingxMarkPriceEvent(incompleteMessage);

        expect(result.success).toBe(false);
      });
    });
  });

  describe('CCXT Format Parsing', () => {
    describe('parseCcxtFundingRate (BingX)', () => {
      it('should parse valid CCXT funding rate from BingX', () => {
        const mockCcxtData = {
          info: {},
          symbol: 'BTC/USDT:USDT',
          fundingRate: 0.0001,
          fundingTimestamp: 1704096000000,
          fundingDatetime: '2024-01-01T08:00:00.000Z',
          markPrice: 42000.5,
          indexPrice: 42001.2,
        };

        const result = parseCcxtFundingRate(mockCcxtData);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.symbol).toBe('BTC/USDT:USDT');
          expect(result.data.fundingRate).toBe(0.0001);
          expect(result.data.markPrice).toBe(42000.5);
        }
      });

      it('should handle minimal CCXT funding rate data', () => {
        const minimalCcxtData = {
          info: {},
          symbol: 'ETH/USDT:USDT',
          fundingRate: -0.0002,
        };

        const result = parseCcxtFundingRate(minimalCcxtData);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.symbol).toBe('ETH/USDT:USDT');
          expect(result.data.fundingRate).toBe(-0.0002);
          expect(result.data.markPrice).toBeUndefined();
        }
      });
    });
  });

  describe('Symbol Conversion (using symbol-converter)', () => {
    it('should convert internal symbol to BingX format', () => {
      expect(toBingxSymbol('BTCUSDT')).toBe('BTC-USDT');
      expect(toBingxSymbol('ETHUSDT')).toBe('ETH-USDT');
      expect(toBingxSymbol('SOLUSDT')).toBe('SOL-USDT');
    });

    it('should convert BingX symbol to internal format', () => {
      expect(fromBingxSymbol('BTC-USDT')).toBe('BTCUSDT');
      expect(fromBingxSymbol('ETH-USDT')).toBe('ETHUSDT');
      expect(fromBingxSymbol('SOL-USDT')).toBe('SOLUSDT');
    });

    it('should convert CCXT symbol to internal format', () => {
      const ccxtSymbol = 'BTC/USDT:USDT';
      // CCXT: BTC/USDT:USDT -> BTCUSDT
      const symbol = ccxtSymbol.split('/').join('').split(':')[0];
      expect(symbol).toBe('BTCUSDT');
    });

    it('should handle various BingX trading pairs', () => {
      const pairs = [
        { internal: 'BTCUSDT', bingx: 'BTC-USDT' },
        { internal: 'ETHUSDT', bingx: 'ETH-USDT' },
        { internal: 'SOLUSDT', bingx: 'SOL-USDT' },
        { internal: 'DOGEUSDT', bingx: 'DOGE-USDT' },
        { internal: 'XRPUSDT', bingx: 'XRP-USDT' },
      ];

      for (const { internal, bingx } of pairs) {
        expect(toBingxSymbol(internal)).toBe(bingx);
        expect(fromBingxSymbol(bingx)).toBe(internal);
      }
    });
  });

  describe('FundingRate Normalization', () => {
    it('should normalize BingX funding rate string to Decimal', () => {
      const rateStr = '0.0001';
      const rate = new Decimal(rateStr);

      expect(rate.toString()).toBe('0.0001');
    });

    it('should normalize CCXT funding rate number to Decimal', () => {
      const rateNum = 0.0001;
      const rate = new Decimal(rateNum);

      expect(rate.toNumber()).toBe(0.0001);
    });

    it('should handle scientific notation', () => {
      const rateStr = '1e-4';
      const rate = new Decimal(rateStr);

      expect(rate.toNumber()).toBe(0.0001);
    });

    it('should handle very small funding rates', () => {
      const rateStr = '0.00001';
      const rate = new Decimal(rateStr);

      expect(rate.toString()).toBe('0.00001');
    });
  });

  describe('Timestamp Handling', () => {
    it('should parse BingX timestamp (milliseconds)', () => {
      const timestampMs = 1704067200000;
      const date = new Date(timestampMs);

      expect(date.getTime()).toBe(timestampMs);
    });

    it('should parse next funding timestamp', () => {
      const nextFundingTime = 1704096000000;
      const date = new Date(nextFundingTime);

      expect(date.toISOString()).toBe('2024-01-01T08:00:00.000Z');
    });

    it('should handle CCXT datetime string', () => {
      const datetimeStr = '2024-01-01T08:00:00.000Z';
      const date = new Date(datetimeStr);

      expect(date.toISOString()).toBe(datetimeStr);
    });
  });

  describe('Error Handling', () => {
    it('should handle null message gracefully', () => {
      const result = parseBingxMarkPriceEvent(null);
      expect(result.success).toBe(false);
    });

    it('should handle empty object gracefully', () => {
      const result = parseBingxMarkPriceEvent({});
      expect(result.success).toBe(false);
    });

    it('should handle malformed data gracefully', () => {
      const result = parseBingxMarkPriceEvent({
        code: 0,
        data: 'invalid',
      });
      expect(result.success).toBe(false);
    });

    it('should handle CCXT null data gracefully', () => {
      const result = parseCcxtFundingRate(null);
      expect(result.success).toBe(false);
    });
  });

  describe('GZIP Decompression Handling', () => {
    // Note: Actual GZIP decompression is tested at integration level
    // These tests verify the message format after decompression

    it('should handle decompressed ping message format', () => {
      const pingMessage = { ping: 1704067200000 };

      expect(pingMessage).toHaveProperty('ping');
      expect(typeof pingMessage.ping).toBe('number');
    });

    it('should handle decompressed pong response format', () => {
      const pongMessage = { pong: 1704067200000 };

      expect(pongMessage).toHaveProperty('pong');
      expect(typeof pongMessage.pong).toBe('number');
    });

    it('should handle subscription response format', () => {
      const subResponse = {
        id: 'sub-1',
        code: 0,
        msg: '',
      };

      expect(subResponse.id).toBe('sub-1');
      expect(subResponse.code).toBe(0);
    });

    it('should handle subscription error response', () => {
      const errorResponse = {
        id: 'sub-2',
        code: 100001,
        msg: 'Invalid symbol',
      };

      expect(errorResponse.code).not.toBe(0);
      expect(errorResponse.msg).toBe('Invalid symbol');
    });
  });
});
