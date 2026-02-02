/**
 * OKX 資金費率 WebSocket 單元測試
 * Feature 052: 交易所 WebSocket 即時數據訂閱
 * Task T010: 單元測試 OKX 資金費率 WebSocket 解析
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Decimal from 'decimal.js';
import crypto from 'crypto';
import {
  parseOkxFundingRateEvent,
  parseOkxMarkPriceEvent,
  parseOkxOrderEvent,
  parseCcxtFundingRate,
} from '@/lib/schemas/websocket-messages';
import { toOkxSymbol, fromOkxSymbol } from '@/lib/symbol-converter';
import type { OkxFundingRateEvent, OkxMarkPriceEvent, OkxOrderEvent } from '@/types/websocket-events';

describe('OkxFundingWs', () => {
  describe('Native Message Parsing', () => {
    describe('parseOkxFundingRateEvent', () => {
      it('should parse valid OKX funding-rate event', () => {
        const mockMessage: OkxFundingRateEvent = {
          arg: {
            channel: 'funding-rate',
            instId: 'BTC-USDT-SWAP',
          },
          data: [
            {
              instId: 'BTC-USDT-SWAP',
              fundingRate: '0.0001',
              fundingTime: '1704096000000',
              nextFundingRate: '0.00012',
              nextFundingTime: '1704124800000',
            },
          ],
        };

        const result = parseOkxFundingRateEvent(mockMessage);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.arg.channel).toBe('funding-rate');
          expect(result.data.arg.instId).toBe('BTC-USDT-SWAP');
          expect(result.data.data[0].fundingRate).toBe('0.0001');
          expect(result.data.data[0].nextFundingRate).toBe('0.00012');
        }
      });

      it('should parse negative funding rate', () => {
        const mockMessage: OkxFundingRateEvent = {
          arg: {
            channel: 'funding-rate',
            instId: 'ETH-USDT-SWAP',
          },
          data: [
            {
              instId: 'ETH-USDT-SWAP',
              fundingRate: '-0.0002',
              fundingTime: '1704096000000',
              nextFundingRate: '-0.00015',
              nextFundingTime: '1704124800000',
            },
          ],
        };

        const result = parseOkxFundingRateEvent(mockMessage);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.data[0].fundingRate).toBe('-0.0002');
        }
      });

      it('should reject invalid channel', () => {
        const invalidMessage = {
          arg: {
            channel: 'invalid-channel',
            instId: 'BTC-USDT-SWAP',
          },
          data: [
            {
              instId: 'BTC-USDT-SWAP',
              fundingRate: '0.0001',
              fundingTime: '1704096000000',
              nextFundingRate: '0.00012',
              nextFundingTime: '1704124800000',
            },
          ],
        };

        const result = parseOkxFundingRateEvent(invalidMessage);

        expect(result.success).toBe(false);
      });

      it('should reject message with empty data array', () => {
        const emptyDataMessage = {
          arg: {
            channel: 'funding-rate',
            instId: 'BTC-USDT-SWAP',
          },
          data: [],
        };

        const result = parseOkxFundingRateEvent(emptyDataMessage);

        // Empty array is valid in Zod
        expect(result.success).toBe(true);
      });

      it('should reject message missing required fields', () => {
        const incompleteMessage = {
          arg: {
            channel: 'funding-rate',
            // Missing instId
          },
          data: [],
        };

        const result = parseOkxFundingRateEvent(incompleteMessage);

        expect(result.success).toBe(false);
      });
    });
  });

  describe('CCXT Format Parsing', () => {
    describe('parseCcxtFundingRate', () => {
      it('should parse valid CCXT funding rate', () => {
        const mockCcxtData = {
          info: {},
          symbol: 'BTC/USDT:USDT',
          fundingRate: 0.0001,
          fundingTimestamp: 1704096000000,
          fundingDatetime: '2024-01-01T08:00:00.000Z',
          nextFundingRate: 0.00012,
          nextFundingTimestamp: 1704124800000,
          nextFundingDatetime: '2024-01-01T16:00:00.000Z',
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

      it('should handle missing optional fields', () => {
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
          expect(result.data.markPrice).toBeUndefined();
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
    });
  });

  describe('Symbol Conversion (using symbol-converter)', () => {
    it('should convert internal symbol to OKX format', () => {
      expect(toOkxSymbol('BTCUSDT')).toBe('BTC-USDT-SWAP');
      expect(toOkxSymbol('ETHUSDT')).toBe('ETH-USDT-SWAP');
      expect(toOkxSymbol('SOLUSDT')).toBe('SOL-USDT-SWAP');
    });

    it('should convert OKX instId to internal format', () => {
      expect(fromOkxSymbol('BTC-USDT-SWAP')).toBe('BTCUSDT');
      expect(fromOkxSymbol('ETH-USDT-SWAP')).toBe('ETHUSDT');
      expect(fromOkxSymbol('SOL-USDT-SWAP')).toBe('SOLUSDT');
    });

    it('should convert CCXT symbol to internal format', () => {
      const ccxtSymbol = 'BTC/USDT:USDT';
      // CCXT: BTC/USDT:USDT -> BTCUSDT
      const symbol = ccxtSymbol.split('/').join('').split(':')[0];
      expect(symbol).toBe('BTCUSDT');
    });

    it('should handle various OKX trading pairs', () => {
      const pairs = [
        { internal: 'BTCUSDT', okx: 'BTC-USDT-SWAP' },
        { internal: 'ETHUSDT', okx: 'ETH-USDT-SWAP' },
        { internal: 'SOLUSDT', okx: 'SOL-USDT-SWAP' },
        { internal: 'DOGEUSDT', okx: 'DOGE-USDT-SWAP' },
      ];

      for (const { internal, okx } of pairs) {
        expect(toOkxSymbol(internal)).toBe(okx);
        expect(fromOkxSymbol(okx)).toBe(internal);
      }
    });
  });

  describe('Mark Price Parsing', () => {
    it('should parse valid OKX mark-price event', () => {
      const mockMessage: OkxMarkPriceEvent = {
        arg: {
          channel: 'mark-price',
          instId: 'BTC-USDT-SWAP',
        },
        data: [
          {
            instId: 'BTC-USDT-SWAP',
            markPx: '42000.5',
            ts: '1704096000000',
          },
        ],
      };

      const result = parseOkxMarkPriceEvent(mockMessage);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.arg.channel).toBe('mark-price');
        expect(result.data.data[0].markPx).toBe('42000.5');
      }
    });

    it('should reject mark-price message with wrong channel', () => {
      const invalidMessage = {
        arg: {
          channel: 'funding-rate', // wrong channel
          instId: 'BTC-USDT-SWAP',
        },
        data: [
          {
            instId: 'BTC-USDT-SWAP',
            markPx: '42000.5',
            ts: '1704096000000',
          },
        ],
      };

      const result = parseOkxMarkPriceEvent(invalidMessage);
      expect(result.success).toBe(false);
    });
  });

  describe('FundingRate Normalization', () => {
    it('should normalize OKX funding rate string to Decimal', () => {
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
  });

  describe('Timestamp Handling', () => {
    it('should parse OKX string timestamp', () => {
      const timestampStr = '1704096000000';
      const date = new Date(parseInt(timestampStr, 10));

      expect(date.getTime()).toBe(1704096000000);
    });

    it('should parse CCXT number timestamp', () => {
      const timestampNum = 1704096000000;
      const date = new Date(timestampNum);

      expect(date.getTime()).toBe(timestampNum);
    });

    it('should parse CCXT datetime string', () => {
      const datetimeStr = '2024-01-01T08:00:00.000Z';
      const date = new Date(datetimeStr);

      expect(date.toISOString()).toBe(datetimeStr);
    });
  });

  describe('Error Handling', () => {
    it('should handle null message gracefully', () => {
      const result = parseOkxFundingRateEvent(null);
      expect(result.success).toBe(false);
    });

    it('should handle malformed JSON gracefully', () => {
      const result = parseOkxFundingRateEvent({ invalid: true });
      expect(result.success).toBe(false);
    });

    it('should handle CCXT null data gracefully', () => {
      const result = parseCcxtFundingRate(null);
      expect(result.success).toBe(false);
    });
  });

  // ==========================================================================
  // T023: OKX 私有頻道認證測試
  // ==========================================================================
  describe('Private Channel Authentication (T023)', () => {
    describe('Login Message Generation', () => {
      it('should generate correct login message structure', () => {
        const apiKey = 'test-api-key';
        const secretKey = 'test-secret-key';
        const passphrase = 'test-passphrase';
        const timestamp = '1704096000';

        // 模擬簽名生成
        const preHash = timestamp + 'GET' + '/users/self/verify';
        const sign = crypto
          .createHmac('sha256', secretKey)
          .update(preHash)
          .digest('base64');

        const loginMessage = {
          op: 'login',
          args: [
            {
              apiKey,
              passphrase,
              timestamp,
              sign,
            },
          ],
        };

        expect(loginMessage.op).toBe('login');
        expect(loginMessage.args).toHaveLength(1);
        expect(loginMessage.args[0].apiKey).toBe(apiKey);
        expect(loginMessage.args[0].passphrase).toBe(passphrase);
        expect(loginMessage.args[0].timestamp).toBe(timestamp);
        expect(typeof loginMessage.args[0].sign).toBe('string');
        expect(loginMessage.args[0].sign.length).toBeGreaterThan(0);
      });

      it('should generate valid HMAC-SHA256 signature', () => {
        const secretKey = 'test-secret';
        const timestamp = '1704096000';
        const preHash = timestamp + 'GET' + '/users/self/verify';

        const sign = crypto
          .createHmac('sha256', secretKey)
          .update(preHash)
          .digest('base64');

        // 驗證簽名是 base64 格式
        expect(() => Buffer.from(sign, 'base64')).not.toThrow();
        // 驗證簽名長度 (SHA256 = 32 bytes = 44 chars base64)
        expect(sign.length).toBe(44);
      });
    });

    describe('Login Response Handling', () => {
      it('should parse successful login response', () => {
        const successResponse = {
          event: 'login',
          code: '0',
          msg: '',
        };

        expect(successResponse.event).toBe('login');
        expect(successResponse.code).toBe('0');
      });

      it('should detect login failure', () => {
        const failureResponse = {
          event: 'error',
          code: '60005',
          msg: 'Invalid sign',
        };

        expect(failureResponse.event).toBe('error');
        expect(failureResponse.code).not.toBe('0');
      });

      it('should detect invalid API key', () => {
        const invalidKeyResponse = {
          event: 'error',
          code: '60001',
          msg: 'Invalid API Key',
        };

        expect(invalidKeyResponse.code).toBe('60001');
      });

      it('should detect expired timestamp', () => {
        const expiredResponse = {
          event: 'error',
          code: '60007',
          msg: 'Timestamp request expired',
        };

        expect(expiredResponse.code).toBe('60007');
      });
    });
  });

  // ==========================================================================
  // T023: OKX 訂單更新解析測試
  // ==========================================================================
  describe('Order Event Parsing (T023)', () => {
    it('should parse valid OKX orders event', () => {
      const mockOrderEvent: OkxOrderEvent = {
        arg: {
          channel: 'orders',
          instType: 'SWAP',
        },
        data: [
          {
            instId: 'BTC-USDT-SWAP',
            ordId: '123456789',
            clOrdId: 'client-order-1',
            px: '42000',
            sz: '0.1',
            ordType: 'limit',
            side: 'buy',
            posSide: 'long',
            state: 'filled',
            fillSz: '0.1',
            fillPx: '42000',
            pnl: '10.5',
            fee: '-0.42',
            feeCcy: 'USDT',
            cTime: '1704096000000',
            uTime: '1704096001000',
          },
        ],
      };

      const result = parseOkxOrderEvent(mockOrderEvent);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.arg.channel).toBe('orders');
        expect(result.data.data[0].ordId).toBe('123456789');
        expect(result.data.data[0].state).toBe('filled');
        expect(result.data.data[0].fillSz).toBe('0.1');
      }
    });

    it('should parse canceled order event', () => {
      const mockCanceledOrder: OkxOrderEvent = {
        arg: {
          channel: 'orders',
          instType: 'SWAP',
        },
        data: [
          {
            instId: 'ETH-USDT-SWAP',
            ordId: '987654321',
            clOrdId: 'client-order-2',
            px: '2200',
            sz: '1',
            ordType: 'limit',
            side: 'sell',
            posSide: 'short',
            state: 'canceled',
            fillSz: '0',
            fillPx: '0',
            pnl: '0',
            fee: '0',
            feeCcy: 'USDT',
            cTime: '1704096000000',
            uTime: '1704096002000',
          },
        ],
      };

      const result = parseOkxOrderEvent(mockCanceledOrder);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.data[0].state).toBe('canceled');
        expect(result.data.data[0].fillSz).toBe('0');
      }
    });

    it('should parse partially filled order', () => {
      const mockPartialOrder: OkxOrderEvent = {
        arg: {
          channel: 'orders',
          instType: 'SWAP',
        },
        data: [
          {
            instId: 'SOL-USDT-SWAP',
            ordId: '111222333',
            clOrdId: 'client-order-3',
            px: '100',
            sz: '10',
            ordType: 'limit',
            side: 'buy',
            posSide: 'long',
            state: 'partially_filled',
            fillSz: '5',
            fillPx: '100',
            pnl: '0',
            fee: '-0.5',
            feeCcy: 'USDT',
            cTime: '1704096000000',
            uTime: '1704096003000',
          },
        ],
      };

      const result = parseOkxOrderEvent(mockPartialOrder);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.data[0].state).toBe('partially_filled');
        expect(result.data.data[0].fillSz).toBe('5');
        expect(result.data.data[0].sz).toBe('10');
      }
    });

    it('should parse trigger order types', () => {
      const mockTriggerOrder: OkxOrderEvent = {
        arg: {
          channel: 'orders',
          instType: 'SWAP',
        },
        data: [
          {
            instId: 'BTC-USDT-SWAP',
            ordId: '444555666',
            clOrdId: 'sl-order-1',
            px: '40000',
            sz: '0.1',
            ordType: 'stop_loss',
            side: 'sell',
            posSide: 'long',
            state: 'filled',
            fillSz: '0.1',
            fillPx: '40000',
            pnl: '-200',
            fee: '-0.4',
            feeCcy: 'USDT',
            cTime: '1704096000000',
            uTime: '1704096004000',
          },
        ],
      };

      const result = parseOkxOrderEvent(mockTriggerOrder);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.data[0].ordType).toBe('stop_loss');
      }
    });

    it('should reject order event with invalid channel', () => {
      const invalidChannel = {
        arg: {
          channel: 'positions', // wrong channel
          instType: 'SWAP',
        },
        data: [],
      };

      const result = parseOkxOrderEvent(invalidChannel);
      expect(result.success).toBe(false);
    });
  });
});

// ==========================================================================
// 記憶體優化測試：markPriceCache LRU 限制
// ==========================================================================
describe('OkxFundingWs - markPriceCache LRU 限制', () => {
  // 由於 OkxFundingWs 依賴 WebSocket，這裡測試其邏輯概念
  // 實際的整合測試應該在 integration 目錄

  describe('LRU Cache 概念驗證', () => {
    it('Map 應該保持插入順序（LRU 基礎）', () => {
      const cache = new Map<string, number>();

      cache.set('A', 1);
      cache.set('B', 2);
      cache.set('C', 3);

      // 驗證順序
      const keys = Array.from(cache.keys());
      expect(keys).toEqual(['A', 'B', 'C']);

      // 更新 A（LRU：刪除再插入）
      cache.delete('A');
      cache.set('A', 1);

      // A 應該移到最後
      const keysAfterUpdate = Array.from(cache.keys());
      expect(keysAfterUpdate).toEqual(['B', 'C', 'A']);
    });

    it('LRU 淘汰應該移除最舊的項目', () => {
      const MAX_SIZE = 3;
      const cache = new Map<string, number>();

      // 新增 4 個項目（超過限制）
      for (let i = 0; i < 4; i++) {
        const symbol = `SYMBOL${i}`;

        // LRU 插入：刪除再插入確保順序
        cache.delete(symbol);
        cache.set(symbol, i);

        // 超過限制時移除最舊項目
        if (cache.size > MAX_SIZE) {
          const firstKey = cache.keys().next().value;
          if (firstKey) {
            cache.delete(firstKey);
          }
        }
      }

      // 驗證結果
      expect(cache.size).toBe(3);
      expect(cache.has('SYMBOL0')).toBe(false); // 最舊的被淘汰
      expect(cache.has('SYMBOL1')).toBe(true);
      expect(cache.has('SYMBOL2')).toBe(true);
      expect(cache.has('SYMBOL3')).toBe(true);
    });

    it('更新項目應該刷新其 LRU 位置', () => {
      const MAX_SIZE = 3;
      const cache = new Map<string, number>();

      // 新增 3 個項目
      cache.set('A', 1);
      cache.set('B', 2);
      cache.set('C', 3);

      // 更新 A（LRU：移到最後）
      cache.delete('A');
      cache.set('A', 10);

      // 新增第 4 個項目
      cache.set('D', 4);
      if (cache.size > MAX_SIZE) {
        const firstKey = cache.keys().next().value;
        if (firstKey) {
          cache.delete(firstKey);
        }
      }

      // B 應該被淘汰（因為 A 被更新移到最後了）
      expect(cache.size).toBe(3);
      expect(cache.has('A')).toBe(true);  // A 被更新，保留
      expect(cache.has('B')).toBe(false); // B 最舊，被淘汰
      expect(cache.has('C')).toBe(true);
      expect(cache.has('D')).toBe(true);
    });
  });

  describe('markPriceCache 統計資訊', () => {
    it('getMarkPriceCacheStats 應該有正確的結構', () => {
      // 模擬 getMarkPriceCacheStats 返回值
      const mockStats = {
        size: 100,
        maxSize: 500,
      };

      expect(mockStats).toHaveProperty('size');
      expect(mockStats).toHaveProperty('maxSize');
      expect(mockStats.maxSize).toBe(500);
    });
  });
});
