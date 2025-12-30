/**
 * Binance WebSocket Subscription Integration Tests
 * Feature: 052-specify-scripts-bash
 * Task: T056
 *
 * 測試 Binance subscribeWS/unsubscribeWS 介面一致性
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { BinanceConnector } from '../../../src/connectors/binance';
import type { WSSubscription, FundingRateCallback } from '../../../src/connectors/types';

// 跳過需要 API 連線的測試
const skipApiTests = !process.env.BINANCE_API_KEY;

describe('Binance WebSocket Subscription', () => {
  let connector: BinanceConnector;

  beforeAll(() => {
    connector = new BinanceConnector();
  });

  afterAll(async () => {
    // 清理所有訂閱
    try {
      await connector.unsubscribeWS('fundingRate');
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('subscribeWS', () => {
    it('should accept WSSubscription interface', async () => {
      // 驗證介面簽名
      const subscription: WSSubscription = {
        type: 'fundingRate',
        symbol: 'BTCUSDT',
        callback: vi.fn() as FundingRateCallback,
      };

      // 只驗證方法存在且接受正確參數
      expect(typeof connector.subscribeWS).toBe('function');
      expect(connector.subscribeWS.length).toBe(1); // 1 parameter
    });

    it.skipIf(skipApiTests)('should subscribe to funding rate updates', async () => {
      const callback = vi.fn() as FundingRateCallback;
      const subscription: WSSubscription = {
        type: 'fundingRate',
        symbol: 'BTCUSDT',
        callback,
      };

      await connector.subscribeWS(subscription);

      // 等待至少一次數據
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => resolve(), 10000);
        callback.mockImplementation(() => {
          clearTimeout(timeout);
          resolve();
        });
      });

      expect(callback).toHaveBeenCalled();
    }, 15000);
  });

  describe('unsubscribeWS', () => {
    it('should accept type and optional symbol parameters', () => {
      // 驗證介面簽名
      expect(typeof connector.unsubscribeWS).toBe('function');
      expect(connector.unsubscribeWS.length).toBe(2); // 2 parameters (symbol is optional)
    });

    it.skipIf(skipApiTests)('should unsubscribe single symbol', async () => {
      const callback = vi.fn() as FundingRateCallback;

      // 先訂閱
      await connector.subscribeWS({
        type: 'fundingRate',
        symbol: 'BTCUSDT',
        callback,
      });

      // 取消訂閱
      await connector.unsubscribeWS('fundingRate', 'BTCUSDT');

      // 等待確認沒有新的回調
      callback.mockClear();
      await new Promise((resolve) => setTimeout(resolve, 3000));

      expect(callback).not.toHaveBeenCalled();
    }, 10000);

    it.skipIf(skipApiTests)('should unsubscribe all when symbol not provided', async () => {
      const callback1 = vi.fn() as FundingRateCallback;
      const callback2 = vi.fn() as FundingRateCallback;

      // 訂閱多個符號
      await connector.subscribeWS({
        type: 'fundingRate',
        symbol: 'BTCUSDT',
        callback: callback1,
      });
      await connector.subscribeWS({
        type: 'fundingRate',
        symbol: 'ETHUSDT',
        callback: callback2,
      });

      // 取消所有訂閱
      await connector.unsubscribeWS('fundingRate');

      // 等待確認沒有新的回調
      callback1.mockClear();
      callback2.mockClear();
      await new Promise((resolve) => setTimeout(resolve, 3000));

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
    }, 15000);
  });

  describe('interface consistency', () => {
    it('should implement IExchangeConnector WebSocket methods', () => {
      // 驗證方法存在
      expect(connector).toHaveProperty('subscribeWS');
      expect(connector).toHaveProperty('unsubscribeWS');

      // 驗證是 async 函數
      expect(connector.subscribeWS.constructor.name).toBe('AsyncFunction');
      expect(connector.unsubscribeWS.constructor.name).toBe('AsyncFunction');
    });
  });
});
