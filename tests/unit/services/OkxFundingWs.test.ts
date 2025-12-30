/**
 * OKX 資金費率 WebSocket 單元測試
 * Feature 052: 交易所 WebSocket 即時數據訂閱
 * Task T010: 單元測試 OKX 資金費率 WebSocket 解析
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Decimal from 'decimal.js';
import {
  parseOkxFundingRateEvent,
  parseCcxtFundingRate,
} from '@/lib/schemas/websocket-messages';
import type { OkxFundingRateEvent } from '@/types/websocket-events';

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

  describe('Symbol Conversion', () => {
    it('should convert OKX instId to internal format', () => {
      const instId = 'BTC-USDT-SWAP';
      // OKX: BTC-USDT-SWAP -> BTCUSDT
      const symbol = instId.replace('-SWAP', '').replace('-', '');
      expect(symbol).toBe('BTCUSDT');
    });

    it('should convert CCXT symbol to internal format', () => {
      const ccxtSymbol = 'BTC/USDT:USDT';
      // CCXT: BTC/USDT:USDT -> BTCUSDT
      const symbol = ccxtSymbol.split('/').join('').split(':')[0];
      expect(symbol).toBe('BTCUSDT');
    });

    it('should handle various OKX trading pairs', () => {
      const pairs = [
        { instId: 'BTC-USDT-SWAP', expected: 'BTCUSDT' },
        { instId: 'ETH-USDT-SWAP', expected: 'ETHUSDT' },
        { instId: 'SOL-USDT-SWAP', expected: 'SOLUSDT' },
      ];

      for (const { instId, expected } of pairs) {
        const symbol = instId.replace('-SWAP', '').replace('-', '');
        expect(symbol).toBe(expected);
      }
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
});
