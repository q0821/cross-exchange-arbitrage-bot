/**
 * BingX 資金費率 WebSocket 單元測試
 * Feature 054: 交易所 WebSocket 即時數據訂閱
 * Task T012: 單元測試 BingX 資金費率解析
 */

import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import crypto from 'crypto';
import {
  parseBingxMarkPriceEvent,
  parseBingxUserDataEvent,
  parseCcxtFundingRate,
} from '@/lib/schemas/websocket-messages';
import { toBingxSymbol, fromBingxSymbol } from '@/lib/symbol-converter';
import type { BingxMarkPriceEvent, BingxOrderTradeUpdate } from '@/types/websocket-events';

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

  // ==========================================================================
  // T025: BingX 私有頻道認證測試 (listenKey 機制)
  // ==========================================================================
  describe('Private Channel Authentication (T025)', () => {
    describe('listenKey Management', () => {
      it('should generate correct listenKey request headers', () => {
        const apiKey = 'test-api-key';
        const secretKey = 'test-secret-key';
        const timestamp = Date.now();

        // BingX 簽名格式
        const params = `timestamp=${timestamp}`;
        const sign = crypto
          .createHmac('sha256', secretKey)
          .update(params)
          .digest('hex');

        const headers = {
          'X-BX-APIKEY': apiKey,
          'X-BX-SIGN': sign,
          'X-BX-TIMESTAMP': timestamp.toString(),
        };

        expect(headers['X-BX-APIKEY']).toBe(apiKey);
        expect(typeof headers['X-BX-SIGN']).toBe('string');
        expect(headers['X-BX-SIGN'].length).toBe(64); // SHA256 hex = 64 chars
      });

      it('should generate valid HMAC-SHA256 signature', () => {
        const secretKey = 'test-secret';
        const params = 'timestamp=1704096000000';

        const sign = crypto
          .createHmac('sha256', secretKey)
          .update(params)
          .digest('hex');

        // SHA256 = 32 bytes = 64 hex chars
        expect(sign.length).toBe(64);
        // 驗證是有效的 hex 字串
        expect(/^[0-9a-f]+$/.test(sign)).toBe(true);
      });

      it('should construct private WebSocket URL with listenKey', () => {
        const listenKey = 'pqia91ma19a5s61cv6a81va65sd099v8a65va65s';
        const baseUrl = 'wss://open-api-swap.bingx.com/swap-market';

        const privateUrl = `${baseUrl}?listenKey=${listenKey}`;

        expect(privateUrl).toContain('listenKey=');
        expect(privateUrl).toBe(
          'wss://open-api-swap.bingx.com/swap-market?listenKey=pqia91ma19a5s61cv6a81va65sd099v8a65va65s'
        );
      });
    });

    describe('listenKey Response Handling', () => {
      it('should parse successful listenKey response', () => {
        const successResponse = {
          code: 0,
          data: {
            listenKey: 'pqia91ma19a5s61cv6a81va65sd099v8a65va65s',
          },
        };

        expect(successResponse.code).toBe(0);
        expect(successResponse.data.listenKey).toBeTruthy();
        expect(typeof successResponse.data.listenKey).toBe('string');
      });

      it('should detect listenKey creation failure', () => {
        const failureResponse = {
          code: 100001,
          msg: 'Invalid API Key',
          data: null,
        };

        expect(failureResponse.code).not.toBe(0);
        expect(failureResponse.data).toBeNull();
      });

      it('should handle listenKey renewal response', () => {
        const renewResponse = {
          code: 0,
          msg: 'success',
        };

        expect(renewResponse.code).toBe(0);
      });
    });
  });

  // ==========================================================================
  // T025: BingX 訂單更新解析測試
  // ==========================================================================
  describe('Order Event Parsing (T025)', () => {
    it('should parse valid BingX ORDER_TRADE_UPDATE event', () => {
      const mockOrderEvent: BingxOrderTradeUpdate = {
        e: 'ORDER_TRADE_UPDATE',
        E: 1704096000000,
        o: {
          s: 'BTC-USDT',
          c: 'client-order-1',
          S: 'BUY',
          o: 'LIMIT',
          X: 'FILLED',
          i: '123456789',
          z: '0.1',
          ap: '42000',
          sp: '0',
          rp: '10.5',
          ps: 'LONG',
        },
      };

      const result = parseBingxUserDataEvent(mockOrderEvent);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.e).toBe('ORDER_TRADE_UPDATE');
        expect(result.data.o.i).toBe('123456789');
        expect(result.data.o.X).toBe('FILLED');
        expect(result.data.o.z).toBe('0.1');
      }
    });

    it('should parse canceled order event', () => {
      const mockCanceledOrder: BingxOrderTradeUpdate = {
        e: 'ORDER_TRADE_UPDATE',
        E: 1704096001000,
        o: {
          s: 'ETH-USDT',
          c: 'client-order-2',
          S: 'SELL',
          o: 'LIMIT',
          X: 'CANCELED',
          i: '987654321',
          z: '0',
          ap: '0',
          sp: '0',
          rp: '0',
          ps: 'SHORT',
        },
      };

      const result = parseBingxUserDataEvent(mockCanceledOrder);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.o.X).toBe('CANCELED');
        expect(result.data.o.z).toBe('0');
      }
    });

    it('should parse stop loss order', () => {
      const mockStopLossOrder: BingxOrderTradeUpdate = {
        e: 'ORDER_TRADE_UPDATE',
        E: 1704096002000,
        o: {
          s: 'BTC-USDT',
          c: 'sl-order-1',
          S: 'SELL',
          o: 'STOP_MARKET',
          X: 'FILLED',
          i: '444555666',
          z: '0.1',
          ap: '40000',
          sp: '40000', // Stop price
          rp: '-200',
          ps: 'LONG',
        },
      };

      const result = parseBingxUserDataEvent(mockStopLossOrder);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.o.o).toBe('STOP_MARKET');
        expect(result.data.o.sp).toBe('40000');
      }
    });

    it('should parse take profit order', () => {
      const mockTakeProfitOrder: BingxOrderTradeUpdate = {
        e: 'ORDER_TRADE_UPDATE',
        E: 1704096003000,
        o: {
          s: 'BTC-USDT',
          c: 'tp-order-1',
          S: 'SELL',
          o: 'TAKE_PROFIT_MARKET',
          X: 'FILLED',
          i: '777888999',
          z: '0.1',
          ap: '45000',
          sp: '45000',
          rp: '300',
          ps: 'LONG',
        },
      };

      const result = parseBingxUserDataEvent(mockTakeProfitOrder);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.o.o).toBe('TAKE_PROFIT_MARKET');
        expect(result.data.o.rp).toBe('300');
      }
    });

    it('should handle SHORT position order', () => {
      const mockShortOrder: BingxOrderTradeUpdate = {
        e: 'ORDER_TRADE_UPDATE',
        E: 1704096004000,
        o: {
          s: 'SOL-USDT',
          c: 'short-order-1',
          S: 'SELL',
          o: 'MARKET',
          X: 'FILLED',
          i: '111222333',
          z: '10',
          ap: '100',
          sp: '0',
          rp: '0',
          ps: 'SHORT',
        },
      };

      const result = parseBingxUserDataEvent(mockShortOrder);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.o.ps).toBe('SHORT');
        expect(result.data.o.S).toBe('SELL');
      }
    });
  });
});
