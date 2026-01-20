/**
 * FundingRateHistoryService Unit Tests
 *
 * 測試資金費率歷史查詢與穩定性分析服務
 * Feature: 資金費率穩定性檢測功能
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import {
  FundingRateHistoryService,
  calculateFlipCount,
  calculateDirectionConsistency,
  type FundingRateHistory,
} from '../../../../src/services/monitor/FundingRateHistoryService';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

// Mock logger
vi.mock('../../../../src/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock ccxt
vi.mock('ccxt', () => ({
  default: {
    gateio: vi.fn().mockImplementation(() => ({
      fetchFundingRateHistory: vi.fn(),
    })),
    bingx: vi.fn().mockImplementation(() => ({
      fetchFundingRateHistory: vi.fn(),
    })),
  },
}));

describe('FundingRateHistoryService', () => {
  let service: FundingRateHistoryService;

  beforeEach(() => {
    service = new FundingRateHistoryService({
      hoursToCheck: 24,
      flipThreshold: 2,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    service.destroy();
  });

  describe('calculateFlipCount()', () => {
    it('應該正確計算零次翻轉（全部正費率）', () => {
      const history: FundingRateHistory[] = [
        { exchange: 'binance', symbol: 'BTCUSDT', fundingRate: 0.0001, fundingTime: new Date('2024-01-01T00:00:00Z') },
        { exchange: 'binance', symbol: 'BTCUSDT', fundingRate: 0.0002, fundingTime: new Date('2024-01-01T08:00:00Z') },
        { exchange: 'binance', symbol: 'BTCUSDT', fundingRate: 0.0001, fundingTime: new Date('2024-01-01T16:00:00Z') },
      ];

      expect(calculateFlipCount(history)).toBe(0);
    });

    it('應該正確計算一次翻轉（正轉負）', () => {
      const history: FundingRateHistory[] = [
        { exchange: 'binance', symbol: 'BTCUSDT', fundingRate: 0.0001, fundingTime: new Date('2024-01-01T00:00:00Z') },
        { exchange: 'binance', symbol: 'BTCUSDT', fundingRate: 0.0002, fundingTime: new Date('2024-01-01T08:00:00Z') },
        { exchange: 'binance', symbol: 'BTCUSDT', fundingRate: -0.0001, fundingTime: new Date('2024-01-01T16:00:00Z') },
      ];

      expect(calculateFlipCount(history)).toBe(1);
    });

    it('應該正確計算兩次翻轉（正->負->正）', () => {
      const history: FundingRateHistory[] = [
        { exchange: 'binance', symbol: 'BTCUSDT', fundingRate: 0.0001, fundingTime: new Date('2024-01-01T00:00:00Z') },
        { exchange: 'binance', symbol: 'BTCUSDT', fundingRate: -0.0001, fundingTime: new Date('2024-01-01T08:00:00Z') },
        { exchange: 'binance', symbol: 'BTCUSDT', fundingRate: 0.0002, fundingTime: new Date('2024-01-01T16:00:00Z') },
      ];

      expect(calculateFlipCount(history)).toBe(2);
    });

    it('應該忽略零值不計入翻轉', () => {
      const history: FundingRateHistory[] = [
        { exchange: 'binance', symbol: 'BTCUSDT', fundingRate: 0.0001, fundingTime: new Date('2024-01-01T00:00:00Z') },
        { exchange: 'binance', symbol: 'BTCUSDT', fundingRate: 0, fundingTime: new Date('2024-01-01T08:00:00Z') },
        { exchange: 'binance', symbol: 'BTCUSDT', fundingRate: 0.0002, fundingTime: new Date('2024-01-01T16:00:00Z') },
      ];

      expect(calculateFlipCount(history)).toBe(0);
    });

    it('應該正確處理零值後的翻轉', () => {
      const history: FundingRateHistory[] = [
        { exchange: 'binance', symbol: 'BTCUSDT', fundingRate: 0.0001, fundingTime: new Date('2024-01-01T00:00:00Z') },
        { exchange: 'binance', symbol: 'BTCUSDT', fundingRate: 0, fundingTime: new Date('2024-01-01T08:00:00Z') },
        { exchange: 'binance', symbol: 'BTCUSDT', fundingRate: -0.0001, fundingTime: new Date('2024-01-01T16:00:00Z') },
      ];

      expect(calculateFlipCount(history)).toBe(1);
    });

    it('應該處理空陣列', () => {
      expect(calculateFlipCount([])).toBe(0);
    });

    it('應該處理單筆資料', () => {
      const history: FundingRateHistory[] = [
        { exchange: 'binance', symbol: 'BTCUSDT', fundingRate: 0.0001, fundingTime: new Date('2024-01-01T00:00:00Z') },
      ];

      expect(calculateFlipCount(history)).toBe(0);
    });

    it('應該正確計算多次翻轉（不穩定情況）', () => {
      const history: FundingRateHistory[] = [
        { exchange: 'binance', symbol: 'BTCUSDT', fundingRate: 0.0001, fundingTime: new Date('2024-01-01T00:00:00Z') },
        { exchange: 'binance', symbol: 'BTCUSDT', fundingRate: -0.0001, fundingTime: new Date('2024-01-01T04:00:00Z') },
        { exchange: 'binance', symbol: 'BTCUSDT', fundingRate: 0.0002, fundingTime: new Date('2024-01-01T08:00:00Z') },
        { exchange: 'binance', symbol: 'BTCUSDT', fundingRate: -0.0002, fundingTime: new Date('2024-01-01T12:00:00Z') },
        { exchange: 'binance', symbol: 'BTCUSDT', fundingRate: 0.0001, fundingTime: new Date('2024-01-01T16:00:00Z') },
      ];

      expect(calculateFlipCount(history)).toBe(4);
    });
  });

  describe('calculateDirectionConsistency()', () => {
    it('應該返回 100% 當全部為正費率', () => {
      const history: FundingRateHistory[] = [
        { exchange: 'binance', symbol: 'BTCUSDT', fundingRate: 0.0001, fundingTime: new Date() },
        { exchange: 'binance', symbol: 'BTCUSDT', fundingRate: 0.0002, fundingTime: new Date() },
        { exchange: 'binance', symbol: 'BTCUSDT', fundingRate: 0.0001, fundingTime: new Date() },
      ];

      expect(calculateDirectionConsistency(history)).toBe(100);
    });

    it('應該返回 100% 當全部為負費率', () => {
      const history: FundingRateHistory[] = [
        { exchange: 'binance', symbol: 'BTCUSDT', fundingRate: -0.0001, fundingTime: new Date() },
        { exchange: 'binance', symbol: 'BTCUSDT', fundingRate: -0.0002, fundingTime: new Date() },
        { exchange: 'binance', symbol: 'BTCUSDT', fundingRate: -0.0001, fundingTime: new Date() },
      ];

      expect(calculateDirectionConsistency(history)).toBe(100);
    });

    it('應該返回約 67% 當 2/3 為正費率', () => {
      const history: FundingRateHistory[] = [
        { exchange: 'binance', symbol: 'BTCUSDT', fundingRate: 0.0001, fundingTime: new Date() },
        { exchange: 'binance', symbol: 'BTCUSDT', fundingRate: 0.0002, fundingTime: new Date() },
        { exchange: 'binance', symbol: 'BTCUSDT', fundingRate: -0.0001, fundingTime: new Date() },
      ];

      expect(calculateDirectionConsistency(history)).toBe(67);
    });

    it('應該返回 50% 當正負各半', () => {
      const history: FundingRateHistory[] = [
        { exchange: 'binance', symbol: 'BTCUSDT', fundingRate: 0.0001, fundingTime: new Date() },
        { exchange: 'binance', symbol: 'BTCUSDT', fundingRate: -0.0001, fundingTime: new Date() },
      ];

      expect(calculateDirectionConsistency(history)).toBe(50);
    });

    it('應該忽略零值計算一致性', () => {
      const history: FundingRateHistory[] = [
        { exchange: 'binance', symbol: 'BTCUSDT', fundingRate: 0.0001, fundingTime: new Date() },
        { exchange: 'binance', symbol: 'BTCUSDT', fundingRate: 0, fundingTime: new Date() },
        { exchange: 'binance', symbol: 'BTCUSDT', fundingRate: 0.0002, fundingTime: new Date() },
      ];

      expect(calculateDirectionConsistency(history)).toBe(100);
    });

    it('應該返回 100% 當全部為零', () => {
      const history: FundingRateHistory[] = [
        { exchange: 'binance', symbol: 'BTCUSDT', fundingRate: 0, fundingTime: new Date() },
        { exchange: 'binance', symbol: 'BTCUSDT', fundingRate: 0, fundingTime: new Date() },
      ];

      expect(calculateDirectionConsistency(history)).toBe(100);
    });

    it('應該返回 100% 當陣列為空', () => {
      expect(calculateDirectionConsistency([])).toBe(100);
    });
  });

  describe('getBinanceHistory()', () => {
    it('應該正確查詢 Binance 歷史費率', async () => {
      const mockResponse = {
        data: [
          { symbol: 'BTCUSDT', fundingRate: '0.0001', fundingTime: 1704067200000 },
          { symbol: 'BTCUSDT', fundingRate: '0.00015', fundingTime: 1704096000000 },
        ],
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      const history = await service.getHistory('binance', 'BTCUSDT', 24);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://fapi.binance.com/fapi/v1/fundingRate',
        expect.objectContaining({
          params: expect.objectContaining({
            symbol: 'BTCUSDT',
            limit: 100,
          }),
        })
      );

      expect(history).toHaveLength(2);
      expect(history[0].exchange).toBe('binance');
      expect(history[0].fundingRate).toBe(0.0001);
    });

    it('應該處理 Binance API 錯誤', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('API Error'));

      const history = await service.getHistory('binance', 'BTCUSDT', 24);

      expect(history).toEqual([]);
    });
  });

  describe('getOkxHistory()', () => {
    it('應該正確查詢 OKX 歷史費率', async () => {
      const mockResponse = {
        data: {
          data: [
            { instId: 'BTC-USDT-SWAP', fundingRate: '0.0001', fundingTime: String(Date.now()) },
            { instId: 'BTC-USDT-SWAP', fundingRate: '0.00015', fundingTime: String(Date.now() - 8 * 60 * 60 * 1000) },
          ],
        },
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      const history = await service.getHistory('okx', 'BTCUSDT', 24);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://www.okx.com/api/v5/public/funding-rate-history',
        expect.objectContaining({
          params: expect.objectContaining({
            instId: 'BTC-USDT-SWAP',
            limit: 100,
          }),
        })
      );

      expect(history.length).toBeGreaterThanOrEqual(0);
    });

    it('應該處理 OKX API 錯誤', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('API Error'));

      const history = await service.getHistory('okx', 'BTCUSDT', 24);

      expect(history).toEqual([]);
    });
  });

  describe('checkStability()', () => {
    it('應該判定穩定（翻轉次數 < 閾值）', async () => {
      const mockResponse = {
        data: [
          { symbol: 'BTCUSDT', fundingRate: '0.0001', fundingTime: Date.now() - 16 * 60 * 60 * 1000 },
          { symbol: 'BTCUSDT', fundingRate: '0.00015', fundingTime: Date.now() - 8 * 60 * 60 * 1000 },
          { symbol: 'BTCUSDT', fundingRate: '0.0002', fundingTime: Date.now() },
        ],
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      const result = await service.checkStability('binance', 'BTCUSDT');

      expect(result.isStable).toBe(true);
      expect(result.flipCount).toBe(0);
      expect(result.directionConsistency).toBe(100);
      expect(result.warning).toBeUndefined();
      expect(result.supported).toBe(true);
    });

    it('應該判定不穩定（翻轉次數 >= 閾值）', async () => {
      const mockResponse = {
        data: [
          { symbol: 'BTCUSDT', fundingRate: '0.0001', fundingTime: Date.now() - 16 * 60 * 60 * 1000 },
          { symbol: 'BTCUSDT', fundingRate: '-0.0001', fundingTime: Date.now() - 8 * 60 * 60 * 1000 },
          { symbol: 'BTCUSDT', fundingRate: '0.0002', fundingTime: Date.now() },
        ],
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      const result = await service.checkStability('binance', 'BTCUSDT');

      expect(result.isStable).toBe(false);
      expect(result.flipCount).toBe(2);
      expect(result.warning).toBeDefined();
      expect(result.warning).toContain('翻轉 2 次');
    });

    it('MEXC 應該返回不支援', async () => {
      const result = await service.checkStability('mexc', 'BTCUSDT');

      expect(result.supported).toBe(false);
      expect(result.unsupportedReason).toContain('MEXC');
      expect(result.isStable).toBe(true); // 預設視為穩定
    });

    it('無法取得歷史資料時應該返回預設值', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: [] });

      const result = await service.checkStability('binance', 'BTCUSDT');

      expect(result.isStable).toBe(true);
      expect(result.flipCount).toBe(0);
      expect(result.history).toHaveLength(0);
      expect(result.warning).toContain('無法取得');
    });
  });

  describe('checkStabilityBatch()', () => {
    it('應該批量檢查多個交易所', async () => {
      // Mock Binance response (stable)
      mockedAxios.get.mockResolvedValueOnce({
        data: [
          { symbol: 'BTCUSDT', fundingRate: '0.0001', fundingTime: Date.now() - 8 * 60 * 60 * 1000 },
          { symbol: 'BTCUSDT', fundingRate: '0.0002', fundingTime: Date.now() },
        ],
      });

      // Mock OKX response (unstable)
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          data: [
            { instId: 'BTC-USDT-SWAP', fundingRate: '0.0001', fundingTime: String(Date.now() - 16 * 60 * 60 * 1000) },
            { instId: 'BTC-USDT-SWAP', fundingRate: '-0.0001', fundingTime: String(Date.now() - 8 * 60 * 60 * 1000) },
            { instId: 'BTC-USDT-SWAP', fundingRate: '0.0002', fundingTime: String(Date.now()) },
          ],
        },
      });

      const results = await service.checkStabilityBatch([
        { exchange: 'binance', symbol: 'BTCUSDT' },
        { exchange: 'okx', symbol: 'BTCUSDT' },
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].exchange).toBe('binance');
      expect(results[1].exchange).toBe('okx');
    });
  });

  describe('symbol conversion', () => {
    it('應該正確轉換 OKX symbol 格式', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: { data: [] } });

      await service.getHistory('okx', 'BTCUSDT', 24);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            instId: 'BTC-USDT-SWAP',
          }),
        })
      );
    });

    it('應該正確轉換 ETHUSDT 格式', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: { data: [] } });

      await service.getHistory('okx', 'ETHUSDT', 24);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            instId: 'ETH-USDT-SWAP',
          }),
        })
      );
    });
  });

  describe('edge cases', () => {
    it('應該處理極小費率值', async () => {
      const mockResponse = {
        data: [
          { symbol: 'BTCUSDT', fundingRate: '0.00000001', fundingTime: Date.now() - 8 * 60 * 60 * 1000 },
          { symbol: 'BTCUSDT', fundingRate: '-0.00000001', fundingTime: Date.now() },
        ],
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      const result = await service.checkStability('binance', 'BTCUSDT');

      expect(result.flipCount).toBe(1);
    });

    it('應該處理大量歷史資料', () => {
      const history: FundingRateHistory[] = [];
      for (let i = 0; i < 100; i++) {
        history.push({
          exchange: 'binance',
          symbol: 'BTCUSDT',
          fundingRate: i % 2 === 0 ? 0.0001 : -0.0001,
          fundingTime: new Date(Date.now() - i * 60 * 60 * 1000),
        });
      }

      const flipCount = calculateFlipCount(history);
      expect(flipCount).toBe(99);
    });
  });
});
