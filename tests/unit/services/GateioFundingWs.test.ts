/**
 * Gate.io 資金費率 WebSocket 單元測試
 * Feature 052: 交易所 WebSocket 即時數據訂閱
 * Task T011: 單元測試 Gate.io 資金費率解析
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Decimal from 'decimal.js';
import crypto from 'crypto';
import {
  parseGateioTickerEvent,
  parseGateioOrderEvent,
  parseCcxtFundingRate,
} from '@/lib/schemas/websocket-messages';
import { toGateioSymbol, fromGateioSymbol } from '@/lib/symbol-converter';
import { FundingIntervalCache } from '@/lib/FundingIntervalCache';
import type { GateioTickerEvent, GateioOrderEvent } from '@/types/websocket-events';

describe('GateioFundingWs', () => {
  describe('Native Message Parsing', () => {
    describe('parseGateioTickerEvent', () => {
      it('should parse valid Gate.io futures.tickers event', () => {
        const mockMessage: GateioTickerEvent = {
          time: 1704067200,
          channel: 'futures.tickers',
          event: 'update',
          result: [
            {
              contract: 'BTC_USDT',
              last: '42000.5',
              mark_price: '42001.2',
              index_price: '42000.8',
              funding_rate: '0.0001',
              funding_rate_indicative: '0.00012',
              volume_24h: '100000',
              volume_24h_usd: '4200000000',
            },
          ],
        };

        const result = parseGateioTickerEvent(mockMessage);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.channel).toBe('futures.tickers');
          expect(result.data.result[0].contract).toBe('BTC_USDT');
          expect(result.data.result[0].funding_rate).toBe('0.0001');
        }
      });

      it('should parse negative funding rate', () => {
        const mockMessage: GateioTickerEvent = {
          time: 1704067200,
          channel: 'futures.tickers',
          event: 'update',
          result: [
            {
              contract: 'ETH_USDT',
              last: '2200.5',
              mark_price: '2201.2',
              index_price: '2200.8',
              funding_rate: '-0.0002',
              funding_rate_indicative: '-0.00015',
              volume_24h: '50000',
              volume_24h_usd: '110000000',
            },
          ],
        };

        const result = parseGateioTickerEvent(mockMessage);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.result[0].funding_rate).toBe('-0.0002');
        }
      });

      it('should reject invalid channel', () => {
        const invalidMessage = {
          time: 1704067200,
          channel: 'invalid.channel',
          event: 'update',
          result: [
            {
              contract: 'BTC_USDT',
              last: '42000.5',
              mark_price: '42001.2',
              index_price: '42000.8',
              funding_rate: '0.0001',
              funding_rate_indicative: '0.00012',
              volume_24h: '100000',
              volume_24h_usd: '4200000000',
            },
          ],
        };

        const result = parseGateioTickerEvent(invalidMessage);

        expect(result.success).toBe(false);
      });

      it('should reject invalid event type', () => {
        const invalidMessage = {
          time: 1704067200,
          channel: 'futures.tickers',
          event: 'subscribe', // Should be 'update'
          result: [
            {
              contract: 'BTC_USDT',
              last: '42000.5',
              mark_price: '42001.2',
              index_price: '42000.8',
              funding_rate: '0.0001',
              funding_rate_indicative: '0.00012',
              volume_24h: '100000',
              volume_24h_usd: '4200000000',
            },
          ],
        };

        const result = parseGateioTickerEvent(invalidMessage);

        expect(result.success).toBe(false);
      });

      it('should reject message missing required fields', () => {
        const incompleteMessage = {
          time: 1704067200,
          channel: 'futures.tickers',
          event: 'update',
          result: [
            {
              contract: 'BTC_USDT',
              // Missing other required fields
            },
          ],
        };

        const result = parseGateioTickerEvent(incompleteMessage);

        expect(result.success).toBe(false);
      });
    });
  });

  describe('CCXT Format Parsing', () => {
    describe('parseCcxtFundingRate (Gate.io)', () => {
      it('should parse valid CCXT funding rate from Gate.io', () => {
        const mockCcxtData = {
          info: {},
          symbol: 'BTC/USDT:USDT',
          fundingRate: 0.0001,
          fundingTimestamp: 1704096000000,
          fundingDatetime: '2024-01-01T08:00:00.000Z',
          markPrice: 42001.2,
          indexPrice: 42000.8,
        };

        const result = parseCcxtFundingRate(mockCcxtData);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.symbol).toBe('BTC/USDT:USDT');
          expect(result.data.fundingRate).toBe(0.0001);
        }
      });
    });
  });

  describe('Symbol Conversion (using symbol-converter)', () => {
    it('should convert internal symbol to Gate.io format', () => {
      expect(toGateioSymbol('BTCUSDT')).toBe('BTC_USDT');
      expect(toGateioSymbol('ETHUSDT')).toBe('ETH_USDT');
      expect(toGateioSymbol('SOLUSDT')).toBe('SOL_USDT');
    });

    it('should convert Gate.io contract to internal format', () => {
      expect(fromGateioSymbol('BTC_USDT')).toBe('BTCUSDT');
      expect(fromGateioSymbol('ETH_USDT')).toBe('ETHUSDT');
      expect(fromGateioSymbol('SOL_USDT')).toBe('SOLUSDT');
    });

    it('should convert CCXT symbol to internal format', () => {
      const ccxtSymbol = 'BTC/USDT:USDT';
      // CCXT: BTC/USDT:USDT -> BTCUSDT
      const symbol = ccxtSymbol.split('/').join('').split(':')[0];
      expect(symbol).toBe('BTCUSDT');
    });

    it('should handle various Gate.io trading pairs', () => {
      const pairs = [
        { internal: 'BTCUSDT', gateio: 'BTC_USDT' },
        { internal: 'ETHUSDT', gateio: 'ETH_USDT' },
        { internal: 'SOLUSDT', gateio: 'SOL_USDT' },
        { internal: 'DOGEUSDT', gateio: 'DOGE_USDT' },
      ];

      for (const { internal, gateio } of pairs) {
        expect(toGateioSymbol(internal)).toBe(gateio);
        expect(fromGateioSymbol(gateio)).toBe(internal);
      }
    });
  });

  describe('FundingRate Normalization', () => {
    it('should normalize Gate.io funding rate string to Decimal', () => {
      const rateStr = '0.0001';
      const rate = new Decimal(rateStr);

      expect(rate.toString()).toBe('0.0001');
    });

    it('should handle indicative funding rate', () => {
      const currentRate = '0.0001';
      const indicativeRate = '0.00012';

      const current = new Decimal(currentRate);
      const indicative = new Decimal(indicativeRate);

      expect(indicative.greaterThan(current)).toBe(true);
    });
  });

  describe('Timestamp Handling', () => {
    it('should parse Gate.io unix timestamp (seconds)', () => {
      const timestampSec = 1704067200;
      const date = new Date(timestampSec * 1000);

      expect(date.getTime()).toBe(1704067200000);
    });

    it('should differentiate between seconds and milliseconds', () => {
      const timestampSec = 1704067200;
      const timestampMs = 1704067200000;

      // Gate.io uses seconds
      expect(timestampSec < 10000000000).toBe(true);
      expect(timestampMs > 10000000000).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle null message gracefully', () => {
      const result = parseGateioTickerEvent(null);
      expect(result.success).toBe(false);
    });

    it('should handle empty object gracefully', () => {
      const result = parseGateioTickerEvent({});
      expect(result.success).toBe(false);
    });

    it('should handle malformed result gracefully', () => {
      const result = parseGateioTickerEvent({
        time: 1704067200,
        channel: 'futures.tickers',
        event: 'update',
        result: 'invalid',
      });
      expect(result.success).toBe(false);
    });
  });

  // ==========================================================================
  // T024: Gate.io 私有頻道認證測試
  // ==========================================================================
  describe('Private Channel Authentication (T024)', () => {
    describe('Auth Message Generation', () => {
      it('should generate correct auth message structure', () => {
        const apiKey = 'test-api-key';
        const secretKey = 'test-secret-key';
        const channel = 'futures.orders';
        const event = 'subscribe';
        const timestamp = Math.floor(Date.now() / 1000);

        // Gate.io 簽名: HMAC-SHA512(channel + event + timestamp)
        const signatureString = `channel=${channel}&event=${event}&time=${timestamp}`;
        const sign = crypto
          .createHmac('sha512', secretKey)
          .update(signatureString)
          .digest('hex');

        const authMessage = {
          time: timestamp,
          channel,
          event,
          auth: {
            method: 'api_key',
            KEY: apiKey,
            SIGN: sign,
          },
          payload: ['!all'],
        };

        expect(authMessage.channel).toBe('futures.orders');
        expect(authMessage.event).toBe('subscribe');
        expect(authMessage.auth.method).toBe('api_key');
        expect(authMessage.auth.KEY).toBe(apiKey);
        expect(typeof authMessage.auth.SIGN).toBe('string');
        expect(authMessage.auth.SIGN.length).toBe(128); // SHA512 hex = 128 chars
      });

      it('should generate valid HMAC-SHA512 signature', () => {
        const secretKey = 'test-secret';
        const signatureString = 'channel=futures.orders&event=subscribe&time=1704096000';

        const sign = crypto
          .createHmac('sha512', secretKey)
          .update(signatureString)
          .digest('hex');

        // SHA512 = 64 bytes = 128 hex chars
        expect(sign.length).toBe(128);
        // 驗證是有效的 hex 字串
        expect(/^[0-9a-f]+$/.test(sign)).toBe(true);
      });
    });

    describe('Auth Response Handling', () => {
      it('should parse successful auth response', () => {
        const successResponse = {
          time: 1704096000,
          channel: 'futures.orders',
          event: 'subscribe',
          error: null,
          result: { status: 'success' },
        };

        expect(successResponse.error).toBeNull();
        expect(successResponse.result.status).toBe('success');
      });

      it('should detect auth failure', () => {
        const failureResponse = {
          time: 1704096000,
          channel: 'futures.orders',
          event: 'subscribe',
          error: {
            code: 2,
            message: 'invalid signature',
          },
          result: null,
        };

        expect(failureResponse.error).not.toBeNull();
        expect(failureResponse.error?.code).toBe(2);
      });
    });
  });

  // ==========================================================================
  // T024: Gate.io 訂單更新解析測試
  // ==========================================================================
  describe('Order Event Parsing (T024)', () => {
    it('should parse valid Gate.io futures.orders event', () => {
      const mockOrderEvent: GateioOrderEvent = {
        time: 1704096000,
        channel: 'futures.orders',
        event: 'update',
        result: [
          {
            id: 123456789,
            contract: 'BTC_USDT',
            size: 100,
            price: '42000',
            status: 'finished',
            finish_as: 'filled',
            fill_price: '42000',
            left: 0,
            is_close: false,
            is_reduce_only: false,
            create_time: 1704096000,
            finish_time: 1704096001,
          },
        ],
      };

      const result = parseGateioOrderEvent(mockOrderEvent);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.channel).toBe('futures.orders');
        expect(result.data.result[0].id).toBe(123456789);
        expect(result.data.result[0].status).toBe('finished');
        expect(result.data.result[0].finish_as).toBe('filled');
      }
    });

    it('should parse canceled order event', () => {
      const mockCanceledOrder: GateioOrderEvent = {
        time: 1704096000,
        channel: 'futures.orders',
        event: 'update',
        result: [
          {
            id: 987654321,
            contract: 'ETH_USDT',
            size: -50,
            price: '2200',
            status: 'finished',
            finish_as: 'cancelled',
            fill_price: '0',
            left: 50,
            is_close: true,
            is_reduce_only: true,
            create_time: 1704096000,
            finish_time: 1704096002,
          },
        ],
      };

      const result = parseGateioOrderEvent(mockCanceledOrder);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.result[0].status).toBe('finished');
        expect(result.data.result[0].finish_as).toBe('cancelled');
        expect(result.data.result[0].left).toBe(50);
      }
    });

    it('should parse open order', () => {
      const mockOpenOrder: GateioOrderEvent = {
        time: 1704096000,
        channel: 'futures.orders',
        event: 'update',
        result: [
          {
            id: 111222333,
            contract: 'SOL_USDT',
            size: 10,
            price: '100',
            status: 'open',
            finish_as: 'filled', // Not yet finished
            fill_price: '0',
            left: 10,
            is_close: false,
            is_reduce_only: false,
            create_time: 1704096000,
            finish_time: 0,
          },
        ],
      };

      const result = parseGateioOrderEvent(mockOpenOrder);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.result[0].status).toBe('open');
        expect(result.data.result[0].left).toBe(10);
      }
    });

    it('should handle short position order (negative size)', () => {
      const mockShortOrder: GateioOrderEvent = {
        time: 1704096000,
        channel: 'futures.orders',
        event: 'update',
        result: [
          {
            id: 444555666,
            contract: 'BTC_USDT',
            size: -100, // Negative = short
            price: '42000',
            status: 'finished',
            finish_as: 'filled',
            fill_price: '42000',
            left: 0,
            is_close: false,
            is_reduce_only: false,
            create_time: 1704096000,
            finish_time: 1704096003,
          },
        ],
      };

      const result = parseGateioOrderEvent(mockShortOrder);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.result[0].size).toBe(-100);
      }
    });

    it('should reject order event with invalid channel', () => {
      const invalidChannel = {
        time: 1704096000,
        channel: 'futures.tickers', // wrong channel
        event: 'update',
        result: [],
      };

      const result = parseGateioOrderEvent(invalidChannel);
      expect(result.success).toBe(false);
    });
  });

  // ==========================================================================
  // FundingIntervalCache 單例測試
  // ==========================================================================
  describe('FundingIntervalCache Singleton', () => {
    beforeEach(() => {
      // 重置單例以確保測試隔離
      FundingIntervalCache.resetInstance();
    });

    afterEach(() => {
      FundingIntervalCache.resetInstance();
    });

    it('should return the same instance from getInstance()', () => {
      const instance1 = FundingIntervalCache.getInstance();
      const instance2 = FundingIntervalCache.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should share cache data between getInstance() calls', () => {
      const cache1 = FundingIntervalCache.getInstance();
      cache1.set('gateio', 'BTCUSDT', 4, 'native-api');

      const cache2 = FundingIntervalCache.getInstance();
      const interval = cache2.get('gateio', 'BTCUSDT');

      expect(interval).toBe(4);
    });

    it('should allow separate instances via new()', () => {
      const singleton = FundingIntervalCache.getInstance();
      singleton.set('gateio', 'BTCUSDT', 8, 'native-api');

      const separate = new FundingIntervalCache();
      const interval = separate.get('gateio', 'BTCUSDT');

      // 獨立實例不共享數據
      expect(interval).toBeNull();
    });

    it('should return null for uncached symbols', () => {
      const cache = FundingIntervalCache.getInstance();
      const interval = cache.get('gateio', 'NONEXISTENT');

      expect(interval).toBeNull();
    });

    it('should support 1h, 4h, 8h funding intervals', () => {
      const cache = FundingIntervalCache.getInstance();

      cache.set('gateio', 'BTCUSDT', 8, 'native-api');
      cache.set('gateio', 'ETHUSDT', 4, 'native-api');
      cache.set('gateio', 'SOLUSDT', 1, 'native-api');

      expect(cache.get('gateio', 'BTCUSDT')).toBe(8);
      expect(cache.get('gateio', 'ETHUSDT')).toBe(4);
      expect(cache.get('gateio', 'SOLUSDT')).toBe(1);
    });
  });

  // ==========================================================================
  // calculateNextFundingTime 邏輯測試
  // ==========================================================================
  describe('calculateNextFundingTime Logic', () => {
    /**
     * 複製 GateioFundingWs 中的 calculateNextFundingTime 邏輯用於測試
     * 實際程式碼無法直接 import 私有方法，所以複製邏輯進行驗證
     */
    function calculateNextFundingTime(fundingIntervalHours: number = 8, nowDate?: Date): Date {
      const now = nowDate ?? new Date();
      const utcHours = now.getUTCHours();
      const utcMinutes = now.getUTCMinutes();

      const currentTimeInHours = utcHours + utcMinutes / 60;
      const nextSettlementMultiple = Math.ceil(currentTimeInHours / fundingIntervalHours);
      let nextSettlementHour = nextSettlementMultiple * fundingIntervalHours;

      // 如果剛好在結算時間點上，跳到下一個週期
      if (currentTimeInHours === nextSettlementHour) {
        nextSettlementHour += fundingIntervalHours;
      }

      const nextFunding = new Date(now);
      nextFunding.setUTCMinutes(0, 0, 0);

      if (nextSettlementHour >= 24) {
        const daysToAdd = Math.floor(nextSettlementHour / 24);
        nextFunding.setUTCDate(nextFunding.getUTCDate() + daysToAdd);
        nextSettlementHour = nextSettlementHour % 24;
      }

      nextFunding.setUTCHours(nextSettlementHour);

      return nextFunding;
    }

    describe('8h interval (UTC 00:00, 08:00, 16:00)', () => {
      it('should return 08:00 when current time is 03:30', () => {
        const now = new Date('2024-01-15T03:30:00Z');
        const next = calculateNextFundingTime(8, now);

        expect(next.getUTCHours()).toBe(8);
        expect(next.getUTCMinutes()).toBe(0);
        expect(next.getUTCDate()).toBe(15);
      });

      it('should return 16:00 when current time is 10:00', () => {
        const now = new Date('2024-01-15T10:00:00Z');
        const next = calculateNextFundingTime(8, now);

        expect(next.getUTCHours()).toBe(16);
        expect(next.getUTCMinutes()).toBe(0);
      });

      it('should return next day 00:00 when current time is 20:00', () => {
        const now = new Date('2024-01-15T20:00:00Z');
        const next = calculateNextFundingTime(8, now);

        expect(next.getUTCHours()).toBe(0);
        expect(next.getUTCMinutes()).toBe(0);
        expect(next.getUTCDate()).toBe(16);
      });

      it('should skip to next period when exactly at settlement time 08:00', () => {
        const now = new Date('2024-01-15T08:00:00Z');
        const next = calculateNextFundingTime(8, now);

        expect(next.getUTCHours()).toBe(16);
      });
    });

    describe('4h interval (UTC 00:00, 04:00, 08:00, 12:00, 16:00, 20:00)', () => {
      it('should return 04:00 when current time is 02:30', () => {
        const now = new Date('2024-01-15T02:30:00Z');
        const next = calculateNextFundingTime(4, now);

        expect(next.getUTCHours()).toBe(4);
      });

      it('should return 12:00 when current time is 09:45', () => {
        const now = new Date('2024-01-15T09:45:00Z');
        const next = calculateNextFundingTime(4, now);

        expect(next.getUTCHours()).toBe(12);
      });

      it('should return next day 00:00 when current time is 22:00', () => {
        const now = new Date('2024-01-15T22:00:00Z');
        const next = calculateNextFundingTime(4, now);

        expect(next.getUTCHours()).toBe(0);
        expect(next.getUTCDate()).toBe(16);
      });

      it('should skip to next period when exactly at settlement time 08:00', () => {
        const now = new Date('2024-01-15T08:00:00Z');
        const next = calculateNextFundingTime(4, now);

        expect(next.getUTCHours()).toBe(12);
      });
    });

    describe('1h interval (every hour)', () => {
      it('should return 04:00 when current time is 03:15', () => {
        const now = new Date('2024-01-15T03:15:00Z');
        const next = calculateNextFundingTime(1, now);

        expect(next.getUTCHours()).toBe(4);
      });

      it('should return 13:00 when current time is 12:59', () => {
        const now = new Date('2024-01-15T12:59:00Z');
        const next = calculateNextFundingTime(1, now);

        expect(next.getUTCHours()).toBe(13);
      });

      it('should return next day 00:00 when current time is 23:30', () => {
        const now = new Date('2024-01-15T23:30:00Z');
        const next = calculateNextFundingTime(1, now);

        expect(next.getUTCHours()).toBe(0);
        expect(next.getUTCDate()).toBe(16);
      });

      it('should skip to next hour when exactly at settlement time 10:00', () => {
        const now = new Date('2024-01-15T10:00:00Z');
        const next = calculateNextFundingTime(1, now);

        expect(next.getUTCHours()).toBe(11);
      });
    });
  });
});
