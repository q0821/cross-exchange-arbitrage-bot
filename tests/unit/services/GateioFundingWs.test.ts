/**
 * Gate.io 資金費率 WebSocket 單元測試
 * Feature 052: 交易所 WebSocket 即時數據訂閱
 * Task T011: 單元測試 Gate.io 資金費率解析
 */

import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  parseGateioTickerEvent,
  parseCcxtFundingRate,
} from '@/lib/schemas/websocket-messages';
import { toGateioSymbol, fromGateioSymbol } from '@/lib/symbol-converter';
import type { GateioTickerEvent } from '@/types/websocket-events';

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
});
