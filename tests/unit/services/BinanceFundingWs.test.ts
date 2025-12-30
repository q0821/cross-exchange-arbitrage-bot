/**
 * BinanceFundingWs 單元測試
 * Feature 052: 交易所 WebSocket 即時數據訂閱
 * Task T009: 單元測試 BinanceFundingWs 訊息解析
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Decimal from 'decimal.js';
import {
  parseBinanceMarkPriceUpdate,
  BinanceMarkPriceUpdateSchema,
} from '@/lib/schemas/websocket-messages';
import type { BinanceMarkPriceUpdate } from '@/types/websocket-events';

describe('BinanceFundingWs', () => {
  describe('Message Parsing', () => {
    describe('parseBinanceMarkPriceUpdate', () => {
      it('should parse valid markPriceUpdate message', () => {
        const mockMessage: BinanceMarkPriceUpdate = {
          e: 'markPriceUpdate',
          E: 1704067200000,
          s: 'BTCUSDT',
          p: '42000.50',
          i: '42001.20',
          P: '42000.00',
          r: '0.0001',
          T: 1704096000000,
        };

        const result = parseBinanceMarkPriceUpdate(mockMessage);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.e).toBe('markPriceUpdate');
          expect(result.data.s).toBe('BTCUSDT');
          expect(result.data.r).toBe('0.0001');
          expect(result.data.T).toBe(1704096000000);
        }
      });

      it('should parse negative funding rate', () => {
        const mockMessage: BinanceMarkPriceUpdate = {
          e: 'markPriceUpdate',
          E: 1704067200000,
          s: 'ETHUSDT',
          p: '2200.50',
          i: '2201.20',
          P: '2200.00',
          r: '-0.0002',
          T: 1704096000000,
        };

        const result = parseBinanceMarkPriceUpdate(mockMessage);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.r).toBe('-0.0002');
        }
      });

      it('should parse zero funding rate', () => {
        const mockMessage: BinanceMarkPriceUpdate = {
          e: 'markPriceUpdate',
          E: 1704067200000,
          s: 'SOLUSDT',
          p: '100.50',
          i: '100.60',
          P: '100.00',
          r: '0',
          T: 1704096000000,
        };

        const result = parseBinanceMarkPriceUpdate(mockMessage);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.r).toBe('0');
        }
      });

      it('should reject invalid event type', () => {
        const invalidMessage = {
          e: 'invalidEvent',
          E: 1704067200000,
          s: 'BTCUSDT',
          p: '42000.50',
          i: '42001.20',
          P: '42000.00',
          r: '0.0001',
          T: 1704096000000,
        };

        const result = parseBinanceMarkPriceUpdate(invalidMessage);

        expect(result.success).toBe(false);
      });

      it('should reject message missing required fields', () => {
        const incompleteMessage = {
          e: 'markPriceUpdate',
          E: 1704067200000,
          s: 'BTCUSDT',
          // Missing: p, i, P, r, T
        };

        const result = parseBinanceMarkPriceUpdate(incompleteMessage);

        expect(result.success).toBe(false);
      });

      it('should reject message with wrong field types', () => {
        const wrongTypeMessage = {
          e: 'markPriceUpdate',
          E: '1704067200000', // Should be number
          s: 'BTCUSDT',
          p: 42000.50, // Should be string
          i: '42001.20',
          P: '42000.00',
          r: '0.0001',
          T: 1704096000000,
        };

        const result = parseBinanceMarkPriceUpdate(wrongTypeMessage);

        expect(result.success).toBe(false);
      });
    });
  });

  describe('FundingRate Normalization', () => {
    it('should convert funding rate string to Decimal', () => {
      const rateStr = '0.0001';
      const rate = new Decimal(rateStr);

      expect(rate.toString()).toBe('0.0001');
      expect(rate.toNumber()).toBe(0.0001);
    });

    it('should handle very small funding rates', () => {
      const rateStr = '0.00001234';
      const rate = new Decimal(rateStr);

      expect(rate.toString()).toBe('0.00001234');
    });

    it('should handle negative funding rates', () => {
      const rateStr = '-0.0003';
      const rate = new Decimal(rateStr);

      expect(rate.isNegative()).toBe(true);
      expect(rate.toString()).toBe('-0.0003');
    });

    it('should calculate next funding time correctly', () => {
      const nextFundingTimeMs = 1704096000000;
      const nextFundingTime = new Date(nextFundingTimeMs);

      expect(nextFundingTime.getTime()).toBe(nextFundingTimeMs);
    });
  });

  describe('Symbol Handling', () => {
    it('should handle standard USDT pairs', () => {
      const symbol = 'BTCUSDT';
      expect(symbol.endsWith('USDT')).toBe(true);
    });

    it('should handle various trading pairs', () => {
      const pairs = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'];

      for (const pair of pairs) {
        expect(pair.endsWith('USDT')).toBe(true);
        expect(pair.length).toBeGreaterThan(4);
      }
    });
  });

  describe('Batch Message Handling', () => {
    it('should parse array of markPriceUpdate messages', () => {
      const messages: BinanceMarkPriceUpdate[] = [
        {
          e: 'markPriceUpdate',
          E: 1704067200000,
          s: 'BTCUSDT',
          p: '42000.50',
          i: '42001.20',
          P: '42000.00',
          r: '0.0001',
          T: 1704096000000,
        },
        {
          e: 'markPriceUpdate',
          E: 1704067200001,
          s: 'ETHUSDT',
          p: '2200.50',
          i: '2201.20',
          P: '2200.00',
          r: '-0.0002',
          T: 1704096000000,
        },
      ];

      const results = messages.map((msg) => parseBinanceMarkPriceUpdate(msg));

      expect(results.every((r) => r.success)).toBe(true);
      expect(results.length).toBe(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle null message gracefully', () => {
      const result = parseBinanceMarkPriceUpdate(null);
      expect(result.success).toBe(false);
    });

    it('should handle undefined message gracefully', () => {
      const result = parseBinanceMarkPriceUpdate(undefined);
      expect(result.success).toBe(false);
    });

    it('should handle empty object gracefully', () => {
      const result = parseBinanceMarkPriceUpdate({});
      expect(result.success).toBe(false);
    });

    it('should handle non-object message gracefully', () => {
      const result = parseBinanceMarkPriceUpdate('invalid string');
      expect(result.success).toBe(false);
    });
  });
});
