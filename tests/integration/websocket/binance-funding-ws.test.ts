/**
 * Integration tests for Binance Funding WebSocket
 *
 * Feature: 052-specify-scripts-bash
 * Task: T013
 *
 * NOTE: These tests require real network connections to Binance.
 * Set RUN_INTEGRATION_TESTS=true to run these tests.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { BinanceFundingWs } from '@/services/websocket/BinanceFundingWs';
import type { FundingRateReceived } from '@/types/websocket-events';

const RUN_INTEGRATION = process.env.RUN_INTEGRATION_TESTS === 'true';

describe.skipIf(!RUN_INTEGRATION)('Binance Funding WebSocket Integration', () => {
  let wsClient: BinanceFundingWs;

  beforeAll(() => {
    // 使用較長的測試超時
  });

  afterAll(async () => {
    if (wsClient) {
      wsClient.destroy();
    }
  });

  beforeEach(() => {
    wsClient = new BinanceFundingWs({
      autoReconnect: false, // 測試時禁用自動重連
      enableHealthCheck: false, // 測試時禁用健康檢查
      updateSpeed: '1s',
    });
  });

  describe('Connection', () => {
    it('should connect to Binance WebSocket successfully', async () => {
      const connectedPromise = new Promise<void>((resolve) => {
        wsClient.on('connected', () => {
          resolve();
        });
      });

      await wsClient.connect();
      await connectedPromise;

      expect(wsClient.isReady()).toBe(true);

      await wsClient.disconnect();
    }, 15000);

    it('should handle connection timeout gracefully', async () => {
      // 使用無效的 URL 來測試超時
      const badClient = new BinanceFundingWs({
        wsUrl: 'wss://invalid.binance.invalid/stream',
        autoReconnect: false,
        enableHealthCheck: false,
      });

      await expect(badClient.connect()).rejects.toThrow();

      badClient.destroy();
    }, 15000);
  });

  describe('Subscription', () => {
    it('should subscribe to single symbol and receive funding rate', async () => {
      await wsClient.connect();

      const receivedData = new Promise<FundingRateReceived>((resolve) => {
        wsClient.on('fundingRate', (data) => {
          resolve(data);
        });
      });

      await wsClient.subscribe(['BTCUSDT']);

      // 等待接收第一筆數據（最多 10 秒）
      const data = await Promise.race([
        receivedData,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout waiting for funding rate')), 10000)
        ),
      ]);

      expect(data).toBeDefined();
      expect(data.exchange).toBe('binance');
      expect(data.symbol).toBe('BTCUSDT');
      expect(data.fundingRate).toBeDefined();
      expect(data.nextFundingTime).toBeInstanceOf(Date);
      expect(data.markPrice).toBeDefined();
      expect(data.source).toBe('websocket');

      await wsClient.disconnect();
    }, 20000);

    it('should subscribe to multiple symbols', async () => {
      await wsClient.connect();

      const symbols = ['BTCUSDT', 'ETHUSDT'];
      const receivedSymbols = new Set<string>();

      const allReceived = new Promise<void>((resolve) => {
        wsClient.on('fundingRate', (data) => {
          receivedSymbols.add(data.symbol);
          if (receivedSymbols.size === symbols.length) {
            resolve();
          }
        });
      });

      await wsClient.subscribe(symbols);

      // 等待接收所有符號的數據（最多 15 秒）
      await Promise.race([
        allReceived,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout waiting for all symbols')), 15000)
        ),
      ]);

      expect(receivedSymbols.size).toBe(symbols.length);
      expect(receivedSymbols.has('BTCUSDT')).toBe(true);
      expect(receivedSymbols.has('ETHUSDT')).toBe(true);

      await wsClient.disconnect();
    }, 25000);

    it('should unsubscribe from symbols', async () => {
      await wsClient.connect();
      await wsClient.subscribe(['BTCUSDT']);

      // 確認已訂閱
      expect(wsClient.getSubscribedSymbols()).toContain('BTCUSDT');

      await wsClient.unsubscribe(['BTCUSDT']);

      // 確認已取消訂閱
      expect(wsClient.getSubscribedSymbols()).not.toContain('BTCUSDT');

      await wsClient.disconnect();
    }, 15000);
  });

  describe('Data Validation', () => {
    it('should receive valid funding rate data structure', async () => {
      await wsClient.connect();

      const receivedData = new Promise<FundingRateReceived>((resolve) => {
        wsClient.on('fundingRate', (data) => {
          resolve(data);
        });
      });

      await wsClient.subscribe(['BTCUSDT']);

      const data = await Promise.race([
        receivedData,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 10000)
        ),
      ]);

      // 驗證資料結構
      expect(data.exchange).toBe('binance');
      expect(typeof data.symbol).toBe('string');
      expect(data.fundingRate).toBeDefined();
      expect(data.fundingRate.toNumber).toBeDefined(); // Decimal.js
      expect(data.nextFundingTime).toBeInstanceOf(Date);
      expect(data.markPrice).toBeDefined();
      expect(data.markPrice!.toNumber).toBeDefined(); // Decimal.js
      expect(data.indexPrice).toBeDefined();
      expect(data.source).toBe('websocket');
      expect(data.receivedAt).toBeInstanceOf(Date);

      await wsClient.disconnect();
    }, 15000);

    it('should receive data with reasonable latency', async () => {
      await wsClient.connect();

      const receivedData = new Promise<FundingRateReceived>((resolve) => {
        wsClient.on('fundingRate', (data) => {
          resolve(data);
        });
      });

      const subscribeTime = Date.now();
      await wsClient.subscribe(['BTCUSDT']);

      const data = await Promise.race([
        receivedData,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 10000)
        ),
      ]);

      const latency = data.receivedAt.getTime() - subscribeTime;

      // 第一筆數據應該在 5 秒內收到（1s 更新頻率）
      expect(latency).toBeLessThan(5000);

      await wsClient.disconnect();
    }, 15000);
  });

  describe('Stats', () => {
    it('should track message count', async () => {
      await wsClient.connect();

      // 等待接收幾筆訊息
      await new Promise<void>((resolve) => {
        let count = 0;
        wsClient.on('fundingRate', () => {
          count++;
          if (count >= 3) {
            resolve();
          }
        });
        wsClient.subscribe(['BTCUSDT']);
      });

      const stats = wsClient.getStats();
      expect(stats.messageCount).toBeGreaterThanOrEqual(3);
      expect(stats.isConnected).toBe(true);
      expect(stats.subscribedSymbolCount).toBe(1);
      expect(stats.connectionUptime).toBeGreaterThan(0);

      await wsClient.disconnect();
    }, 20000);
  });
});

describe('Binance Funding WebSocket Unit Tests', () => {
  it('should initialize with default config', () => {
    const client = new BinanceFundingWs();
    expect(client.isReady()).toBe(false);
    expect(client.getSubscribedSymbols()).toEqual([]);
    expect(client.isSubscribedToAll()).toBe(false);
    client.destroy();
  });

  it('should throw error when subscribing without connection', async () => {
    const client = new BinanceFundingWs();
    await expect(client.subscribe(['BTCUSDT'])).rejects.toThrow('Not connected');
    client.destroy();
  });

  it('should throw error when connecting a destroyed client', async () => {
    const client = new BinanceFundingWs();
    client.destroy();
    await expect(client.connect()).rejects.toThrow('Client has been destroyed');
  });

  it('should return correct stats for disconnected client', () => {
    const client = new BinanceFundingWs();
    const stats = client.getStats();

    expect(stats.messageCount).toBe(0);
    expect(stats.lastMessageTime).toBeNull();
    expect(stats.connectionUptime).toBe(0);
    expect(stats.subscribedSymbolCount).toBe(0);
    expect(stats.isConnected).toBe(false);

    client.destroy();
  });
});
