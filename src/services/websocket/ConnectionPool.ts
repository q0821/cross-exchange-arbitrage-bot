/**
 * ConnectionPool
 *
 * 多連線管理器
 * Feature: 054-native-websocket-clients
 * Task: T009
 *
 * 當訂閱數量超過單一 WebSocket 連線限制時，自動建立多個連線。
 * 連線限制：
 * - OKX: 100/連線
 * - Gate.io: 20/連線
 * - BingX: 50/連線
 */

import { EventEmitter } from 'events';
import { logger } from '@/lib/logger';
import type { ExchangeName } from '@/connectors/types';
import type { FundingRateReceived } from '@/types/websocket-events';
import type { BaseExchangeWs, WebSocketClientStats } from './BaseExchangeWs';
import type { DataStructureStats, Monitorable } from '@/types/memory-stats';
import { DataStructureRegistry } from '@/lib/data-structure-registry';

// =============================================================================
// 1. 類型定義
// =============================================================================

/** 連線池配置 */
export interface ConnectionPoolConfig<T extends BaseExchangeWs> {
  /** 交易所名稱 */
  exchange: ExchangeName;
  /** 單一連線最大訂閱數 */
  maxPerConnection: number;
  /** 建立客戶端的工廠函式 */
  createClient: () => T;
  /** 是否自動調整連線數 */
  autoScale?: boolean;
}

/** 連線池狀態 */
export interface ConnectionPoolState {
  /** 交易所 */
  exchange: ExchangeName;
  /** 單一連線最大訂閱數 */
  maxPerConnection: number;
  /** 活躍連線數 */
  activeConnections: number;
  /** 總訂閱數 */
  totalSubscriptions: number;
  /** 各連線訂閱分佈 */
  subscriptionDistribution: Map<number, number>;
}

/** 連線池統計 */
export interface ConnectionPoolStats {
  /** 交易所 */
  exchange: ExchangeName;
  /** 活躍連線數 */
  activeConnections: number;
  /** 總訂閱數 */
  totalSubscriptions: number;
  /** 總訊息數 */
  totalMessages: number;
  /** 平均每連線訂閱數 */
  avgSubscriptionsPerConnection: number;
  /** 各連線統計 */
  connectionStats: WebSocketClientStats[];
}

/** 連線池事件 */
export interface ConnectionPoolEvents {
  /** 資金費率更新 */
  'fundingRate': (data: FundingRateReceived) => void;
  /** 批量資金費率更新 */
  'fundingRateBatch': (data: FundingRateReceived[]) => void;
  /** 連線成功 */
  'connected': (connectionIndex: number) => void;
  /** 斷線 */
  'disconnected': (connectionIndex: number) => void;
  /** 錯誤 */
  'error': (error: Error, connectionIndex: number) => void;
  /** 連線數變更 */
  'connectionCountChanged': (count: number) => void;
}

// =============================================================================
// 2. ConnectionPool 類別
// =============================================================================

/**
 * ConnectionPool - 多連線管理器
 *
 * 自動管理多個 WebSocket 連線：
 * - 當訂閱數超過限制時自動建立新連線
 * - 平均分配訂閱到各連線
 * - 統一事件發送（資金費率、錯誤等）
 * - 支援動態擴縮
 */
export class ConnectionPool<T extends BaseExchangeWs> extends EventEmitter implements Monitorable {
  private config: Required<ConnectionPoolConfig<T>>;
  private connections: Map<number, T> = new Map();
  private subscriptions: Map<string, number> = new Map(); // symbol -> connectionIndex
  private nextConnectionIndex = 0;
  private isDestroyed = false;
  private registryKey: string;

  constructor(config: ConnectionPoolConfig<T>) {
    super();

    this.config = {
      exchange: config.exchange,
      maxPerConnection: config.maxPerConnection,
      createClient: config.createClient,
      autoScale: config.autoScale ?? true,
    };

    // Feature 066: 註冊到 DataStructureRegistry
    this.registryKey = `ConnectionPool:${this.config.exchange}`;
    DataStructureRegistry.register(this.registryKey, this);

    logger.debug(
      {
        exchange: this.config.exchange,
        maxPerConnection: this.config.maxPerConnection,
      },
      'ConnectionPool initialized'
    );
  }

  // =============================================================================
  // 3. 連線管理
  // =============================================================================

  /**
   * 建立新連線
   */
  private async createConnection(): Promise<number> {
    const index = this.nextConnectionIndex++;
    const client = this.config.createClient();

    // 綁定事件
    client.on('fundingRate', (data: FundingRateReceived) => {
      this.emit('fundingRate', data);
    });

    client.on('fundingRateBatch', (data: FundingRateReceived[]) => {
      this.emit('fundingRateBatch', data);
    });

    client.on('connected', () => {
      logger.info(
        { exchange: this.config.exchange, connectionIndex: index },
        'Connection established'
      );
      this.emit('connected', index);
    });

    client.on('disconnected', () => {
      logger.info(
        { exchange: this.config.exchange, connectionIndex: index },
        'Connection disconnected'
      );
      this.emit('disconnected', index);
    });

    client.on('error', (error: Error) => {
      logger.error(
        { exchange: this.config.exchange, connectionIndex: index, error: error.message },
        'Connection error'
      );
      this.emit('error', error, index);
    });

    // 連接
    await client.connect();
    this.connections.set(index, client);

    logger.info(
      { exchange: this.config.exchange, connectionIndex: index, totalConnections: this.connections.size },
      'New connection created'
    );

    this.emit('connectionCountChanged', this.connections.size);

    return index;
  }

  /**
   * 找到有可用空間的連線，或建立新連線
   */
  private async findOrCreateConnection(): Promise<number> {
    // 找到有空間的現有連線
    for (const [index, client] of this.connections) {
      const symbolCount = client.getSubscribedSymbols().length;
      if (symbolCount < this.config.maxPerConnection) {
        return index;
      }
    }

    // 沒有可用連線，建立新的
    return this.createConnection();
  }

  /**
   * 取得連線的訂閱數
   */
  private getConnectionSubscriptionCount(connectionIndex: number): number {
    const client = this.connections.get(connectionIndex);
    return client ? client.getSubscribedSymbols().length : 0;
  }

  // =============================================================================
  // 4. 訂閱管理
  // =============================================================================

  /**
   * 訂閱單一交易對
   */
  async subscribe(symbol: string): Promise<void> {
    if (this.isDestroyed) {
      throw new Error('ConnectionPool has been destroyed');
    }

    // 檢查是否已訂閱
    if (this.subscriptions.has(symbol)) {
      logger.warn(
        { exchange: this.config.exchange, symbol },
        'Symbol already subscribed'
      );
      return;
    }

    // 找到可用連線
    const connectionIndex = await this.findOrCreateConnection();
    const client = this.connections.get(connectionIndex);

    if (!client) {
      throw new Error(`Connection ${connectionIndex} not found`);
    }

    // 訂閱
    await client.subscribe([symbol]);
    this.subscriptions.set(symbol, connectionIndex);

    logger.debug(
      { exchange: this.config.exchange, symbol, connectionIndex },
      'Symbol subscribed'
    );
  }

  /**
   * 批量訂閱交易對
   */
  async subscribeAll(symbols: string[]): Promise<void> {
    if (this.isDestroyed) {
      throw new Error('ConnectionPool has been destroyed');
    }

    // 過濾已訂閱的
    const newSymbols = symbols.filter((s) => !this.subscriptions.has(s));

    if (newSymbols.length === 0) {
      logger.info(
        { exchange: this.config.exchange },
        'All symbols already subscribed'
      );
      return;
    }

    // 計算需要的連線數
    const connectionsNeeded = Math.ceil(newSymbols.length / this.config.maxPerConnection);
    logger.info(
      {
        exchange: this.config.exchange,
        symbolCount: newSymbols.length,
        connectionsNeeded,
        currentConnections: this.connections.size,
      },
      'Starting batch subscription'
    );

    // 分批訂閱
    let symbolIndex = 0;

    while (symbolIndex < newSymbols.length) {
      // 取得或建立連線
      const connectionIndex = await this.findOrCreateConnection();
      const client = this.connections.get(connectionIndex);

      if (!client) {
        throw new Error(`Connection ${connectionIndex} not found`);
      }

      // 計算此連線可訂閱多少
      const currentCount = this.getConnectionSubscriptionCount(connectionIndex);
      const available = this.config.maxPerConnection - currentCount;
      const batchSize = Math.min(available, newSymbols.length - symbolIndex);

      if (batchSize <= 0) {
        continue;
      }

      // 取得這批要訂閱的符號
      const batch = newSymbols.slice(symbolIndex, symbolIndex + batchSize);

      // 訂閱
      await client.subscribe(batch);

      // 記錄訂閱
      batch.forEach((symbol) => {
        this.subscriptions.set(symbol, connectionIndex);
      });

      logger.info(
        {
          exchange: this.config.exchange,
          connectionIndex,
          batchSize,
          progress: `${symbolIndex + batchSize}/${newSymbols.length}`,
        },
        'Batch subscribed'
      );

      symbolIndex += batchSize;
    }

    logger.info(
      {
        exchange: this.config.exchange,
        totalSubscriptions: this.subscriptions.size,
        totalConnections: this.connections.size,
      },
      'Batch subscription complete'
    );
  }

  /**
   * 取消訂閱交易對
   */
  async unsubscribe(symbol: string): Promise<void> {
    const connectionIndex = this.subscriptions.get(symbol);
    if (connectionIndex === undefined) {
      logger.warn(
        { exchange: this.config.exchange, symbol },
        'Symbol not subscribed'
      );
      return;
    }

    const client = this.connections.get(connectionIndex);
    if (client) {
      await client.unsubscribe([symbol]);
    }

    this.subscriptions.delete(symbol);

    logger.debug(
      { exchange: this.config.exchange, symbol },
      'Symbol unsubscribed'
    );

    // 自動縮減：如果連線沒有訂閱，考慮關閉它
    if (this.config.autoScale) {
      await this.pruneEmptyConnections();
    }
  }

  /**
   * 取消所有訂閱
   */
  async unsubscribeAll(): Promise<void> {
    for (const client of this.connections.values()) {
      const symbols = client.getSubscribedSymbols();
      if (symbols.length > 0) {
        await client.unsubscribe(symbols);
      }
    }

    this.subscriptions.clear();

    logger.info(
      { exchange: this.config.exchange },
      'All subscriptions cleared'
    );
  }

  /**
   * 清理空連線
   */
  private async pruneEmptyConnections(): Promise<void> {
    const emptyConnections: number[] = [];

    for (const [index, client] of this.connections) {
      if (client.getSubscribedSymbols().length === 0) {
        emptyConnections.push(index);
      }
    }

    // 保留至少一個連線
    if (emptyConnections.length > 0 && this.connections.size > 1) {
      for (const index of emptyConnections) {
        if (this.connections.size <= 1) break;

        const client = this.connections.get(index);
        if (client) {
          client.destroy();
          this.connections.delete(index);

          logger.info(
            { exchange: this.config.exchange, connectionIndex: index },
            'Empty connection pruned'
          );
        }
      }

      this.emit('connectionCountChanged', this.connections.size);
    }
  }

  // =============================================================================
  // 5. 狀態和統計
  // =============================================================================

  /**
   * 取得連線池狀態
   */
  getState(): ConnectionPoolState {
    const distribution = new Map<number, number>();

    for (const [index, client] of this.connections) {
      distribution.set(index, client.getSubscribedSymbols().length);
    }

    return {
      exchange: this.config.exchange,
      maxPerConnection: this.config.maxPerConnection,
      activeConnections: this.connections.size,
      totalSubscriptions: this.subscriptions.size,
      subscriptionDistribution: distribution,
    };
  }

  /**
   * 取得統計資訊
   */
  getStats(): ConnectionPoolStats {
    const connectionStats: WebSocketClientStats[] = [];
    let totalMessages = 0;

    for (const client of this.connections.values()) {
      const stats = client.getStats();
      connectionStats.push(stats);
      totalMessages += stats.messageCount;
    }

    const avgSubscriptions =
      this.connections.size > 0 ? this.subscriptions.size / this.connections.size : 0;

    return {
      exchange: this.config.exchange,
      activeConnections: this.connections.size,
      totalSubscriptions: this.subscriptions.size,
      totalMessages,
      avgSubscriptionsPerConnection: Math.round(avgSubscriptions * 100) / 100,
      connectionStats,
    };
  }

  /**
   * 記錄統計日誌
   */
  logStats(): void {
    const stats = this.getStats();
    logger.info(
      {
        exchange: stats.exchange,
        activeConnections: stats.activeConnections,
        totalSubscriptions: stats.totalSubscriptions,
        totalMessages: stats.totalMessages,
        avgSubscriptionsPerConnection: stats.avgSubscriptionsPerConnection,
      },
      'ConnectionPool stats'
    );
  }

  /**
   * 檢查是否所有連線都已就緒
   */
  isReady(): boolean {
    if (this.connections.size === 0) return false;

    for (const client of this.connections.values()) {
      if (!client.isReady()) return false;
    }

    return true;
  }

  /**
   * 取得所有已訂閱的交易對
   */
  getSubscribedSymbols(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  /**
   * 取得資料結構統計資訊
   * Feature: 066-memory-monitoring
   */
  getDataStructureStats(): DataStructureStats {
    const connectionsSize = this.connections.size;
    const subscriptionsSize = this.subscriptions.size;

    return {
      name: `ConnectionPool:${this.config.exchange}`,
      sizes: {
        connections: connectionsSize,
        subscriptions: subscriptionsSize,
      },
      totalItems: connectionsSize + subscriptionsSize,
    };
  }

  // =============================================================================
  // 6. 生命週期管理
  // =============================================================================

  /**
   * 斷開所有連線
   */
  async disconnect(): Promise<void> {
    logger.info(
      { exchange: this.config.exchange, connections: this.connections.size },
      'Disconnecting all connections'
    );

    const promises: Promise<void>[] = [];

    for (const client of this.connections.values()) {
      promises.push(client.disconnect());
    }

    await Promise.all(promises);
  }

  /**
   * 銷毀連線池
   */
  destroy(): void {
    this.isDestroyed = true;

    // Feature 066: 從 DataStructureRegistry 取消註冊
    DataStructureRegistry.unregister(this.registryKey);

    for (const client of this.connections.values()) {
      client.destroy();
    }

    this.connections.clear();
    this.subscriptions.clear();
    this.removeAllListeners();

    logger.info(
      { exchange: this.config.exchange },
      'ConnectionPool destroyed'
    );
  }
}
