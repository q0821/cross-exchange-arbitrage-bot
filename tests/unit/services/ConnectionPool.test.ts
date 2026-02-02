/**
 * ConnectionPool 單元測試
 * Feature 054: 交易所 WebSocket 即時數據訂閱
 * Task T009: 多連線管理器
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { ConnectionPool } from '@/services/websocket/ConnectionPool';
import type { BaseExchangeWs, WebSocketClientStats } from '@/services/websocket/BaseExchangeWs';

// =============================================================================
// Mock BaseExchangeWs
// =============================================================================

class MockExchangeWs extends EventEmitter implements Partial<BaseExchangeWs> {
  private connected = false;
  private subscribedSymbols: string[] = [];
  private messageCount = 0;

  async connect(): Promise<void> {
    this.connected = true;
    this.emit('connected');
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.emit('disconnected');
  }

  destroy(): void {
    this.connected = false;
    this.subscribedSymbols = [];
    this.removeAllListeners();
  }

  isReady(): boolean {
    return this.connected;
  }

  async subscribe(symbols: string[]): Promise<void> {
    if (!this.connected) {
      throw new Error('Not connected');
    }
    this.subscribedSymbols.push(...symbols);
  }

  async unsubscribe(symbols: string[]): Promise<void> {
    if (!this.connected) {
      throw new Error('Not connected');
    }
    this.subscribedSymbols = this.subscribedSymbols.filter((s) => !symbols.includes(s));
  }

  getSubscribedSymbols(): string[] {
    return [...this.subscribedSymbols];
  }

  getStats(): WebSocketClientStats {
    return {
      exchange: 'okx',
      isConnected: this.connected,
      subscribedSymbolCount: this.subscribedSymbols.length,
      messageCount: this.messageCount,
      latencyP50: 10,
      latencyP95: 20,
      latencyP99: 30,
      lastMessageAt: new Date(),
      connectedSince: new Date(),
    };
  }

  // Helper to simulate receiving messages
  simulateFundingRate(data: unknown): void {
    this.messageCount++;
    this.emit('fundingRate', data);
  }
}

// =============================================================================
// Tests
// =============================================================================

describe('ConnectionPool', () => {
  let createClientSpy: ReturnType<typeof vi.fn>;
  let pool: ConnectionPool<MockExchangeWs>;

  beforeEach(() => {
    createClientSpy = vi.fn(() => new MockExchangeWs() as unknown as MockExchangeWs);
  });

  afterEach(() => {
    if (pool) {
      pool.destroy();
    }
  });

  describe('Initialization', () => {
    it('should create pool with default config', () => {
      pool = new ConnectionPool({
        exchange: 'okx',
        maxPerConnection: 100,
        createClient: createClientSpy,
      });

      const state = pool.getState();
      expect(state.exchange).toBe('okx');
      expect(state.maxPerConnection).toBe(100);
      expect(state.activeConnections).toBe(0);
      expect(state.totalSubscriptions).toBe(0);
    });

    it('should accept custom autoScale config', () => {
      pool = new ConnectionPool({
        exchange: 'gateio',
        maxPerConnection: 20,
        createClient: createClientSpy,
        autoScale: false,
      });

      expect(pool).toBeDefined();
    });
  });

  describe('Single Subscription', () => {
    beforeEach(() => {
      pool = new ConnectionPool({
        exchange: 'okx',
        maxPerConnection: 3, // Small limit for testing
        createClient: createClientSpy,
      });
    });

    it('should create connection and subscribe to symbol', async () => {
      await pool.subscribe('BTCUSDT');

      expect(createClientSpy).toHaveBeenCalledTimes(1);
      expect(pool.getSubscribedSymbols()).toContain('BTCUSDT');

      const state = pool.getState();
      expect(state.activeConnections).toBe(1);
      expect(state.totalSubscriptions).toBe(1);
    });

    it('should reuse existing connection for new subscriptions', async () => {
      await pool.subscribe('BTCUSDT');
      await pool.subscribe('ETHUSDT');

      expect(createClientSpy).toHaveBeenCalledTimes(1);
      expect(pool.getSubscribedSymbols()).toHaveLength(2);
    });

    it('should not duplicate subscription for same symbol', async () => {
      await pool.subscribe('BTCUSDT');
      await pool.subscribe('BTCUSDT');

      expect(pool.getSubscribedSymbols()).toHaveLength(1);
    });

    it('should throw error when subscribing after destroy', async () => {
      pool.destroy();

      await expect(pool.subscribe('BTCUSDT')).rejects.toThrow('ConnectionPool has been destroyed');
    });
  });

  describe('Multiple Connections', () => {
    beforeEach(() => {
      pool = new ConnectionPool({
        exchange: 'gateio',
        maxPerConnection: 2, // Very small limit for testing
        createClient: createClientSpy,
      });
    });

    it('should create new connection when limit exceeded', async () => {
      await pool.subscribe('BTCUSDT');
      await pool.subscribe('ETHUSDT');
      await pool.subscribe('SOLUSDT'); // Should trigger new connection

      expect(createClientSpy).toHaveBeenCalledTimes(2);

      const state = pool.getState();
      expect(state.activeConnections).toBe(2);
      expect(state.totalSubscriptions).toBe(3);
    });

    it('should distribute subscriptions across connections', async () => {
      await pool.subscribeAll(['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'DOGEUSDT']);

      expect(createClientSpy).toHaveBeenCalledTimes(2);

      const state = pool.getState();
      expect(state.totalSubscriptions).toBe(4);

      // Check distribution (each connection should have 2)
      let totalInDistribution = 0;
      for (const count of state.subscriptionDistribution.values()) {
        totalInDistribution += count;
        expect(count).toBeLessThanOrEqual(2);
      }
      expect(totalInDistribution).toBe(4);
    });
  });

  describe('Batch Subscription', () => {
    beforeEach(() => {
      pool = new ConnectionPool({
        exchange: 'bingx',
        maxPerConnection: 3,
        createClient: createClientSpy,
      });
    });

    it('should batch subscribe multiple symbols efficiently', async () => {
      await pool.subscribeAll(['BTCUSDT', 'ETHUSDT', 'SOLUSDT']);

      expect(createClientSpy).toHaveBeenCalledTimes(1);
      expect(pool.getSubscribedSymbols()).toHaveLength(3);
    });

    it('should filter already subscribed symbols', async () => {
      await pool.subscribe('BTCUSDT');
      await pool.subscribeAll(['BTCUSDT', 'ETHUSDT', 'SOLUSDT']);

      expect(pool.getSubscribedSymbols()).toHaveLength(3);
    });

    it('should handle empty array gracefully', async () => {
      await pool.subscribeAll([]);

      expect(createClientSpy).not.toHaveBeenCalled();
      expect(pool.getSubscribedSymbols()).toHaveLength(0);
    });
  });

  describe('Unsubscription', () => {
    beforeEach(() => {
      pool = new ConnectionPool({
        exchange: 'okx',
        maxPerConnection: 3,
        createClient: createClientSpy,
        autoScale: true,
      });
    });

    it('should unsubscribe symbol from connection', async () => {
      await pool.subscribe('BTCUSDT');
      await pool.unsubscribe('BTCUSDT');

      expect(pool.getSubscribedSymbols()).toHaveLength(0);
    });

    it('should handle unsubscribe of non-existent symbol gracefully', async () => {
      await pool.unsubscribe('NONEXISTENT');
      // Should not throw
    });

    it('should unsubscribe all symbols', async () => {
      await pool.subscribeAll(['BTCUSDT', 'ETHUSDT', 'SOLUSDT']);
      await pool.unsubscribeAll();

      expect(pool.getSubscribedSymbols()).toHaveLength(0);
    });
  });

  describe('Event Forwarding', () => {
    beforeEach(() => {
      pool = new ConnectionPool({
        exchange: 'okx',
        maxPerConnection: 10,
        createClient: createClientSpy,
      });
    });

    it('should forward fundingRate events', async () => {
      const fundingRateHandler = vi.fn();
      pool.on('fundingRate', fundingRateHandler);

      await pool.subscribe('BTCUSDT');

      // Get the underlying mock client and simulate a message
      const state = pool.getState();
      expect(state.activeConnections).toBe(1);

      // The mock client should have been created
      const mockClient = createClientSpy.mock.results[0].value as MockExchangeWs;
      mockClient.simulateFundingRate({ symbol: 'BTCUSDT', rate: 0.0001 });

      expect(fundingRateHandler).toHaveBeenCalledWith({ symbol: 'BTCUSDT', rate: 0.0001 });
    });

    it('should emit connectionCountChanged when connections change', async () => {
      const countHandler = vi.fn();
      pool.on('connectionCountChanged', countHandler);

      await pool.subscribe('BTCUSDT');

      expect(countHandler).toHaveBeenCalledWith(1);
    });
  });

  describe('Statistics', () => {
    beforeEach(() => {
      pool = new ConnectionPool({
        exchange: 'okx',
        maxPerConnection: 2,
        createClient: createClientSpy,
      });
    });

    it('should return correct stats', async () => {
      await pool.subscribeAll(['BTCUSDT', 'ETHUSDT', 'SOLUSDT']);

      const stats = pool.getStats();

      expect(stats.exchange).toBe('okx');
      expect(stats.activeConnections).toBe(2);
      expect(stats.totalSubscriptions).toBe(3);
      expect(stats.connectionStats).toHaveLength(2);
      expect(stats.avgSubscriptionsPerConnection).toBe(1.5);
    });

    it('should report readiness correctly', async () => {
      expect(pool.isReady()).toBe(false);

      await pool.subscribe('BTCUSDT');

      expect(pool.isReady()).toBe(true);
    });
  });

  describe('Lifecycle Management', () => {
    beforeEach(() => {
      pool = new ConnectionPool({
        exchange: 'okx',
        maxPerConnection: 10,
        createClient: createClientSpy,
      });
    });

    it('should disconnect all connections', async () => {
      await pool.subscribeAll(['BTCUSDT', 'ETHUSDT']);

      await pool.disconnect();

      // disconnect() 會清空 connections Map（避免記憶體洩漏）
      const state = pool.getState();
      expect(state.activeConnections).toBe(0);
    });

    it('should destroy pool and cleanup', async () => {
      await pool.subscribe('BTCUSDT');

      pool.destroy();

      const state = pool.getState();
      expect(state.activeConnections).toBe(0);
      expect(state.totalSubscriptions).toBe(0);
    });

    it('should handle destroy on empty pool', () => {
      pool.destroy();
      // Should not throw
    });
  });

  describe('Exchange-specific Limits', () => {
    it('should handle OKX limit (100/connection)', async () => {
      pool = new ConnectionPool({
        exchange: 'okx',
        maxPerConnection: 100,
        createClient: createClientSpy,
      });

      // Subscribe to 150 symbols should create 2 connections
      const symbols = Array.from({ length: 150 }, (_, i) => `SYMBOL${i}USDT`);
      await pool.subscribeAll(symbols);

      const state = pool.getState();
      expect(state.activeConnections).toBe(2);
      expect(state.totalSubscriptions).toBe(150);
    });

    it('should handle Gate.io limit (20/connection)', async () => {
      pool = new ConnectionPool({
        exchange: 'gateio',
        maxPerConnection: 20,
        createClient: createClientSpy,
      });

      // Subscribe to 50 symbols should create 3 connections
      const symbols = Array.from({ length: 50 }, (_, i) => `SYMBOL${i}USDT`);
      await pool.subscribeAll(symbols);

      const state = pool.getState();
      expect(state.activeConnections).toBe(3);
      expect(state.totalSubscriptions).toBe(50);
    });

    it('should handle BingX limit (50/connection)', async () => {
      pool = new ConnectionPool({
        exchange: 'bingx',
        maxPerConnection: 50,
        createClient: createClientSpy,
      });

      // Subscribe to 100 symbols should create 2 connections
      const symbols = Array.from({ length: 100 }, (_, i) => `SYMBOL${i}USDT`);
      await pool.subscribeAll(symbols);

      const state = pool.getState();
      expect(state.activeConnections).toBe(2);
      expect(state.totalSubscriptions).toBe(100);
    });
  });
});
