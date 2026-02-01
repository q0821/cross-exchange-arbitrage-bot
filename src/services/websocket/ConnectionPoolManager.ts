/**
 * ConnectionPoolManager
 *
 * 連線池管理器 - 統一管理所有 ConnectionPool 實例
 * Feature: 066-memory-monitoring
 *
 * 目的：
 * - 作為記憶體監控的單一入口，彙總所有交易所的 WebSocket 訂閱統計
 * - 透過 singleton getter 註冊到 DataStructureRegistry
 */

import type { ExchangeName } from '@/connectors/types';
import type { DataStructureStats, Monitorable } from '@/types/memory-stats';
import type { ConnectionPool } from './ConnectionPool';
import type { BaseExchangeWs } from './BaseExchangeWs';

/** 各交易所連線池詳細統計 */
export interface PoolDetail {
  /** 連線數 */
  connections: number;
  /** 訂閱數 */
  subscriptions: number;
}

/**
 * ConnectionPoolManager - 連線池管理器
 *
 * 單例模式，統一收集各交易所 ConnectionPool 的統計資訊
 */
class ConnectionPoolManagerClass implements Monitorable {
  private static instance: ConnectionPoolManagerClass | null = null;

  /** 已註冊的連線池 */
  private pools: Map<ExchangeName, ConnectionPool<BaseExchangeWs>> = new Map();

  private constructor() {}

  /**
   * 取得單例實例
   */
  static getInstance(): ConnectionPoolManagerClass {
    if (!ConnectionPoolManagerClass.instance) {
      ConnectionPoolManagerClass.instance = new ConnectionPoolManagerClass();
    }
    return ConnectionPoolManagerClass.instance;
  }

  /**
   * 重置單例（僅用於測試）
   */
  static resetInstance(): void {
    if (ConnectionPoolManagerClass.instance) {
      ConnectionPoolManagerClass.instance.pools.clear();
      ConnectionPoolManagerClass.instance = null;
    }
  }

  /**
   * 註冊連線池
   *
   * @param exchange - 交易所名稱
   * @param pool - 連線池實例
   */
  registerPool(exchange: ExchangeName, pool: ConnectionPool<BaseExchangeWs>): void {
    this.pools.set(exchange, pool);
  }

  /**
   * 取消註冊連線池
   *
   * @param exchange - 交易所名稱
   */
  unregisterPool(exchange: ExchangeName): void {
    this.pools.delete(exchange);
  }

  /**
   * 取得已註冊的連線池數量
   */
  getPoolCount(): number {
    return this.pools.size;
  }

  /**
   * 取得所有連線池的統計資訊
   */
  getAllPoolStats(): Map<ExchangeName, PoolDetail> {
    const stats = new Map<ExchangeName, PoolDetail>();

    for (const [exchange, pool] of this.pools) {
      const poolStats = pool.getStats();
      stats.set(exchange, {
        connections: poolStats.activeConnections,
        subscriptions: poolStats.totalSubscriptions,
      });
    }

    return stats;
  }

  /**
   * 取得資料結構統計資訊
   * 實作 Monitorable 介面
   *
   * totalItems = WebSocket 連線總數（記憶體監控最關注的指標）
   */
  getDataStructureStats(): DataStructureStats {
    let wsConnections = 0;
    let subscriptions = 0;
    const poolDetails: Record<string, PoolDetail> = {};

    for (const [exchange, pool] of this.pools) {
      const stats = pool.getStats();
      wsConnections += stats.activeConnections;
      subscriptions += stats.totalSubscriptions;
      poolDetails[exchange] = {
        connections: stats.activeConnections,
        subscriptions: stats.totalSubscriptions,
      };
    }

    return {
      name: 'ConnectionPoolManager',
      sizes: {
        exchanges: this.pools.size,
        wsConnections,
        subscriptions,
      },
      // totalItems = WebSocket 連線數（重點監控指標）
      totalItems: wsConnections,
      details: {
        poolDetails,
      },
    };
  }
}

/**
 * 導出單例
 */
export const ConnectionPoolManager = ConnectionPoolManagerClass.getInstance();

/**
 * 導出類別（用於測試）
 */
export { ConnectionPoolManagerClass };
