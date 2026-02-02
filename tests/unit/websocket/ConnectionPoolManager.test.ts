// @vitest-environment node
/**
 * ConnectionPoolManager 單元測試
 * Feature: 066-memory-monitoring
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConnectionPoolManagerClass } from '@/services/websocket/ConnectionPoolManager';
import type { ConnectionPool, ConnectionPoolStats } from '@/services/websocket/ConnectionPool';
import type { BaseExchangeWs } from '@/services/websocket/BaseExchangeWs';
import type { ExchangeName } from '@/connectors/types';

// Mock ConnectionPool
const createMockPool = (
  exchange: ExchangeName,
  activeConnections: number,
  totalSubscriptions: number
): ConnectionPool<BaseExchangeWs> => {
  const mockStats: ConnectionPoolStats = {
    exchange,
    activeConnections,
    totalSubscriptions,
    totalMessages: 1000,
    avgSubscriptionsPerConnection:
      activeConnections > 0 ? totalSubscriptions / activeConnections : 0,
    connectionStats: [],
  };

  return {
    getStats: vi.fn().mockReturnValue(mockStats),
  } as unknown as ConnectionPool<BaseExchangeWs>;
};

describe('ConnectionPoolManager', () => {
  let manager: ConnectionPoolManagerClass;

  beforeEach(() => {
    // 重置單例
    ConnectionPoolManagerClass.resetInstance();
    manager = ConnectionPoolManagerClass.getInstance();
  });

  afterEach(() => {
    ConnectionPoolManagerClass.resetInstance();
  });

  describe('單例模式', () => {
    it('應該返回相同實例', () => {
      const instance1 = ConnectionPoolManagerClass.getInstance();
      const instance2 = ConnectionPoolManagerClass.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('重置後應該返回新實例', () => {
      const instance1 = ConnectionPoolManagerClass.getInstance();
      ConnectionPoolManagerClass.resetInstance();
      const instance2 = ConnectionPoolManagerClass.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('連線池註冊', () => {
    it('應該正確註冊連線池', () => {
      const pool = createMockPool('binance', 3, 68);
      manager.registerPool('binance', pool);
      expect(manager.getPoolCount()).toBe(1);
    });

    it('應該正確取消註冊連線池', () => {
      const pool = createMockPool('binance', 3, 68);
      manager.registerPool('binance', pool);
      manager.unregisterPool('binance');
      expect(manager.getPoolCount()).toBe(0);
    });

    it('應該支援多個交易所連線池', () => {
      manager.registerPool('binance', createMockPool('binance', 3, 68));
      manager.registerPool('okx', createMockPool('okx', 3, 68));
      manager.registerPool('gateio', createMockPool('gateio', 4, 68));
      manager.registerPool('bingx', createMockPool('bingx', 2, 68));
      expect(manager.getPoolCount()).toBe(4);
    });
  });

  describe('getAllPoolStats', () => {
    it('應該返回所有連線池的統計', () => {
      manager.registerPool('binance', createMockPool('binance', 3, 68));
      manager.registerPool('okx', createMockPool('okx', 3, 72));

      const stats = manager.getAllPoolStats();

      expect(stats.size).toBe(2);
      expect(stats.get('binance')).toEqual({ connections: 3, subscriptions: 68 });
      expect(stats.get('okx')).toEqual({ connections: 3, subscriptions: 72 });
    });

    it('沒有連線池時應該返回空 Map', () => {
      const stats = manager.getAllPoolStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('getDataStructureStats（Monitorable 介面）', () => {
    it('沒有連線池時應該返回零值', () => {
      const stats = manager.getDataStructureStats();

      expect(stats.name).toBe('ConnectionPoolManager');
      expect(stats.sizes.exchanges).toBe(0);
      expect(stats.sizes.wsConnections).toBe(0);
      expect(stats.sizes.subscriptions).toBe(0);
      expect(stats.totalItems).toBe(0); // totalItems = wsConnections
      expect(stats.details?.poolDetails).toEqual({});
    });

    it('應該正確彙總所有連線池統計', () => {
      manager.registerPool('binance', createMockPool('binance', 3, 68));
      manager.registerPool('okx', createMockPool('okx', 3, 68));
      manager.registerPool('gateio', createMockPool('gateio', 4, 68));
      manager.registerPool('bingx', createMockPool('bingx', 2, 68));

      const stats = manager.getDataStructureStats();

      expect(stats.name).toBe('ConnectionPoolManager');
      expect(stats.sizes.exchanges).toBe(4);
      expect(stats.sizes.wsConnections).toBe(12); // 3+3+4+2
      expect(stats.sizes.subscriptions).toBe(272); // 68*4
      expect(stats.totalItems).toBe(12); // totalItems = wsConnections

      // 檢查詳細資料
      const poolDetails = stats.details?.poolDetails as Record<
        string,
        { connections: number; subscriptions: number }
      >;
      expect(poolDetails['binance']).toEqual({ connections: 3, subscriptions: 68 });
      expect(poolDetails['okx']).toEqual({ connections: 3, subscriptions: 68 });
      expect(poolDetails['gateio']).toEqual({ connections: 4, subscriptions: 68 });
      expect(poolDetails['bingx']).toEqual({ connections: 2, subscriptions: 68 });
    });

    it('應該正確處理不同訂閱數量', () => {
      manager.registerPool('binance', createMockPool('binance', 2, 100));
      manager.registerPool('okx', createMockPool('okx', 1, 50));

      const stats = manager.getDataStructureStats();

      expect(stats.sizes.wsConnections).toBe(3);
      expect(stats.sizes.subscriptions).toBe(150);
      expect(stats.totalItems).toBe(3); // totalItems = wsConnections
    });
  });
});
