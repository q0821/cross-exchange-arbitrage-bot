// @vitest-environment node
/**
 * ConnectionPool 記憶體洩漏測試
 * Feature: WebSocket Memory Leak 修復
 *
 * 驗證：
 * 1. 連線失敗時監聽器應被清理
 * 2. disconnect() 後 connections Map 應為空
 * 3. destroy() 應同步清理所有資源
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { ConnectionPool } from '@/services/websocket/ConnectionPool';
import type { BaseExchangeWs, WebSocketClientStats } from '@/services/websocket/BaseExchangeWs';
import { DataStructureRegistry } from '@/lib/data-structure-registry';
import { ConnectionPoolManager } from '@/services/websocket/ConnectionPoolManager';

// Mock 用的 BaseExchangeWs 實作
class MockBaseExchangeWs extends EventEmitter implements Partial<BaseExchangeWs> {
  private subscribedSymbols: string[] = [];
  private connected = false;
  private destroyed = false;
  public connectShouldFail = false;
  public connectDelay = 0;

  async connect(): Promise<void> {
    if (this.connectDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.connectDelay));
    }
    if (this.connectShouldFail) {
      throw new Error('Connection failed');
    }
    this.connected = true;
    this.emit('connected');
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.emit('disconnected');
  }

  destroy(): void {
    this.destroyed = true;
    this.connected = false;
    this.removeAllListeners();
  }

  isReady(): boolean {
    return this.connected;
  }

  getSubscribedSymbols(): string[] {
    return this.subscribedSymbols;
  }

  async subscribe(symbols: string[]): Promise<void> {
    this.subscribedSymbols.push(...symbols);
  }

  async unsubscribe(symbols: string[]): Promise<void> {
    this.subscribedSymbols = this.subscribedSymbols.filter((s) => !symbols.includes(s));
  }

  getStats(): WebSocketClientStats {
    return {
      exchange: 'binance',
      connectionId: 'test-123',
      isConnected: this.connected,
      messageCount: 0,
      lastMessageTime: null,
      connectionUptime: 0,
      subscribedSymbolCount: this.subscribedSymbols.length,
      reconnectCount: 0,
      latencyStats: { avg: 0, p50: 0, p95: 0, p99: 0, min: 0, max: 0, sampleCount: 0 },
    };
  }
}

describe('ConnectionPool Memory Leak', () => {
  let createdClients: MockBaseExchangeWs[] = [];

  const createClient = () => {
    const client = new MockBaseExchangeWs();
    createdClients.push(client);
    return client as unknown as BaseExchangeWs;
  };

  beforeEach(() => {
    createdClients = [];
  });

  afterEach(() => {
    // 清理所有建立的 clients
    createdClients.forEach((client) => {
      try {
        client.destroy();
      } catch {
        // 忽略
      }
    });
    createdClients = [];

    // 清理 Registry
    DataStructureRegistry.unregister('ConnectionPool:binance');
    ConnectionPoolManager.unregisterPool('binance');
  });

  describe('createConnection 失敗時的清理', () => {
    it('連線失敗時應清理所有監聽器', async () => {
      let capturedClient: MockBaseExchangeWs | null = null;

      const pool = new ConnectionPool<BaseExchangeWs>({
        exchange: 'binance',
        maxPerConnection: 100,
        createClient: () => {
          capturedClient = new MockBaseExchangeWs();
          capturedClient.connectShouldFail = true;
          createdClients.push(capturedClient);
          return capturedClient as unknown as BaseExchangeWs;
        },
      });

      // 嘗試訂閱（會觸發 createConnection）
      await expect(pool.subscribe('BTCUSDT')).rejects.toThrow('Connection failed');

      // 驗證監聽器已清理
      expect(capturedClient).not.toBeNull();
      expect(capturedClient!.listenerCount('fundingRate')).toBe(0);
      expect(capturedClient!.listenerCount('fundingRateBatch')).toBe(0);
      expect(capturedClient!.listenerCount('connected')).toBe(0);
      expect(capturedClient!.listenerCount('disconnected')).toBe(0);
      expect(capturedClient!.listenerCount('error')).toBe(0);

      pool.destroy();
    });

    it('連線失敗時應呼叫 client.destroy()', async () => {
      let destroyCalled = false;

      const pool = new ConnectionPool<BaseExchangeWs>({
        exchange: 'binance',
        maxPerConnection: 100,
        createClient: () => {
          const client = new MockBaseExchangeWs();
          client.connectShouldFail = true;
          const originalDestroy = client.destroy.bind(client);
          client.destroy = () => {
            destroyCalled = true;
            originalDestroy();
          };
          createdClients.push(client);
          return client as unknown as BaseExchangeWs;
        },
      });

      await expect(pool.subscribe('BTCUSDT')).rejects.toThrow();

      expect(destroyCalled).toBe(true);

      pool.destroy();
    });

    it('連線成功時監聽器應保留', async () => {
      let capturedClient: MockBaseExchangeWs | null = null;

      const pool = new ConnectionPool<BaseExchangeWs>({
        exchange: 'binance',
        maxPerConnection: 100,
        createClient: () => {
          capturedClient = new MockBaseExchangeWs();
          createdClients.push(capturedClient);
          return capturedClient as unknown as BaseExchangeWs;
        },
      });

      await pool.subscribe('BTCUSDT');

      // 驗證監聽器存在
      expect(capturedClient).not.toBeNull();
      expect(capturedClient!.listenerCount('fundingRate')).toBe(1);
      expect(capturedClient!.listenerCount('error')).toBe(1);

      pool.destroy();
    });
  });

  describe('disconnect() 清理', () => {
    it('disconnect() 後 connections Map 應為空', async () => {
      const pool = new ConnectionPool<BaseExchangeWs>({
        exchange: 'binance',
        maxPerConnection: 100,
        createClient,
      });

      // 建立連線
      await pool.subscribe('BTCUSDT');
      await pool.subscribe('ETHUSDT');

      const statsBefore = pool.getStats();
      expect(statsBefore.activeConnections).toBe(1);

      // 斷線
      await pool.disconnect();

      const statsAfter = pool.getStats();
      expect(statsAfter.activeConnections).toBe(0);

      pool.destroy();
    });

    it('disconnect() 應移除所有客戶端監聽器', async () => {
      const capturedClients: MockBaseExchangeWs[] = [];

      const pool = new ConnectionPool<BaseExchangeWs>({
        exchange: 'binance',
        maxPerConnection: 2,
        createClient: () => {
          const client = new MockBaseExchangeWs();
          capturedClients.push(client);
          createdClients.push(client);
          return client as unknown as BaseExchangeWs;
        },
      });

      // 建立多個連線
      await pool.subscribeAll(['BTCUSDT', 'ETHUSDT', 'SOLUSDT']);

      expect(capturedClients.length).toBe(2); // 2 個連線（每個最多 2 個訂閱）

      // 斷線
      await pool.disconnect();

      // 驗證所有客戶端監聯器已清理
      capturedClients.forEach((client) => {
        expect(client.listenerCount('fundingRate')).toBe(0);
        expect(client.listenerCount('error')).toBe(0);
      });

      pool.destroy();
    });

    it('disconnect() 時客戶端錯誤應被忽略', async () => {
      const pool = new ConnectionPool<BaseExchangeWs>({
        exchange: 'binance',
        maxPerConnection: 100,
        createClient: () => {
          const client = new MockBaseExchangeWs();
          client.disconnect = async () => {
            throw new Error('Disconnect failed');
          };
          createdClients.push(client);
          return client as unknown as BaseExchangeWs;
        },
      });

      await pool.subscribe('BTCUSDT');

      // 不應拋出錯誤
      await expect(pool.disconnect()).resolves.not.toThrow();

      pool.destroy();
    });
  });

  describe('destroy() 清理', () => {
    it('destroy() 應銷毀所有客戶端', async () => {
      const destroyedClients: MockBaseExchangeWs[] = [];

      const pool = new ConnectionPool<BaseExchangeWs>({
        exchange: 'binance',
        maxPerConnection: 100,
        createClient: () => {
          const client = new MockBaseExchangeWs();
          const originalDestroy = client.destroy.bind(client);
          client.destroy = () => {
            destroyedClients.push(client);
            originalDestroy();
          };
          createdClients.push(client);
          return client as unknown as BaseExchangeWs;
        },
      });

      await pool.subscribe('BTCUSDT');
      await pool.subscribe('ETHUSDT');

      pool.destroy();

      expect(destroyedClients.length).toBe(1);
    });

    it('destroy() 後 pool 應標記為已銷毀', async () => {
      const pool = new ConnectionPool<BaseExchangeWs>({
        exchange: 'binance',
        maxPerConnection: 100,
        createClient,
      });

      await pool.subscribe('BTCUSDT');
      pool.destroy();

      // 嘗試訂閱應拋出錯誤
      await expect(pool.subscribe('ETHUSDT')).rejects.toThrow(
        'ConnectionPool has been destroyed'
      );
    });

    it('destroy() 應清空 subscriptions Map', async () => {
      const pool = new ConnectionPool<BaseExchangeWs>({
        exchange: 'binance',
        maxPerConnection: 100,
        createClient,
      });

      await pool.subscribe('BTCUSDT');
      expect(pool.getSubscribedSymbols()).toContain('BTCUSDT');

      pool.destroy();

      expect(pool.getSubscribedSymbols()).toHaveLength(0);
    });

    it('destroy() 應移除 pool 自身的監聽器', async () => {
      const pool = new ConnectionPool<BaseExchangeWs>({
        exchange: 'binance',
        maxPerConnection: 100,
        createClient,
      });

      const handler = vi.fn();
      pool.on('fundingRate', handler);
      pool.on('error', handler);

      expect(pool.listenerCount('fundingRate')).toBe(1);
      expect(pool.listenerCount('error')).toBe(1);

      pool.destroy();

      expect(pool.listenerCount('fundingRate')).toBe(0);
      expect(pool.listenerCount('error')).toBe(0);
    });
  });

  describe('事件轉發', () => {
    it('連線成功後應正確轉發 fundingRate 事件', async () => {
      let capturedClient: MockBaseExchangeWs | null = null;

      const pool = new ConnectionPool<BaseExchangeWs>({
        exchange: 'binance',
        maxPerConnection: 100,
        createClient: () => {
          capturedClient = new MockBaseExchangeWs();
          createdClients.push(capturedClient);
          return capturedClient as unknown as BaseExchangeWs;
        },
      });

      const fundingRateHandler = vi.fn();
      pool.on('fundingRate', fundingRateHandler);

      await pool.subscribe('BTCUSDT');

      // 模擬 client 發出 fundingRate 事件
      const testData = { symbol: 'BTCUSDT', rate: 0.0001 };
      capturedClient!.emit('fundingRate', testData);

      expect(fundingRateHandler).toHaveBeenCalledWith(testData);

      pool.destroy();
    });
  });
});
