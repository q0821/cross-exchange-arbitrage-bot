/**
 * PrivateWsManager
 * Feature: 052-specify-scripts-bash
 * Task: T036
 *
 * 管理所有用戶的私有 WebSocket 連線
 * 統一介面處理不同交易所的私有頻道
 */

import { EventEmitter } from 'events';
import { logger } from '../../lib/logger';
import type { ExchangeName } from '../../connectors/types';
import type {
  PositionChanged,
  BalanceChanged,
  OrderStatusChanged,
} from '../../types/internal-events';

// ==================== 類型定義 ====================

/**
 * 連線狀態
 */
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

/**
 * 用戶連線資訊
 */
export interface UserConnection {
  userId: string;
  exchanges: Map<ExchangeName, ConnectionStatus>;
  createdAt: Date;
  lastActivityAt: Date;
}

/**
 * 交易所 WebSocket 適配器介面
 */
export interface ExchangeWsAdapter extends EventEmitter {
  /** 連接到交易所私有頻道 */
  connect(apiKey: string, apiSecret: string, passphrase?: string): Promise<void>;
  /** 斷開連線 */
  disconnect(): Promise<void>;
  /** 檢查是否已連接 */
  isConnected(): boolean;
  /** 取得交易所名稱 */
  getExchangeName(): ExchangeName;
}

/**
 * 適配器工廠介面
 */
export interface WsAdapterFactory {
  create(exchange: ExchangeName): ExchangeWsAdapter | null;
}

/**
 * PrivateWsManager 選項
 */
export interface PrivateWsManagerOptions {
  /** 連線逾時 (毫秒) */
  connectionTimeoutMs?: number;
  /** 重連間隔 (毫秒) */
  reconnectIntervalMs?: number;
  /** 最大重連次數 */
  maxReconnectAttempts?: number;
}

// ==================== PrivateWsManager 類別 ====================

/**
 * PrivateWsManager
 *
 * 管理多用戶、多交易所的私有 WebSocket 連線
 */
export class PrivateWsManager extends EventEmitter {
  private static instance: PrivateWsManager | null = null;
  private userConnections: Map<string, UserConnection> = new Map();
  private adapters: Map<string, ExchangeWsAdapter> = new Map();
  private adapterFactory: WsAdapterFactory | null = null;
  private options: Required<PrivateWsManagerOptions>;
  private isDestroyed = false;

  private constructor(options?: PrivateWsManagerOptions) {
    super();
    this.options = {
      connectionTimeoutMs: options?.connectionTimeoutMs ?? 30000,
      reconnectIntervalMs: options?.reconnectIntervalMs ?? 5000,
      maxReconnectAttempts: options?.maxReconnectAttempts ?? 5,
    };
  }

  /**
   * 獲取單例實例
   */
  static getInstance(options?: PrivateWsManagerOptions): PrivateWsManager {
    if (!PrivateWsManager.instance) {
      PrivateWsManager.instance = new PrivateWsManager(options);
    }
    return PrivateWsManager.instance;
  }

  /**
   * 重置單例 (僅用於測試)
   */
  static resetInstance(): void {
    if (PrivateWsManager.instance) {
      PrivateWsManager.instance.destroy();
      PrivateWsManager.instance = null;
    }
  }

  /**
   * 設定適配器工廠
   */
  setAdapterFactory(factory: WsAdapterFactory): void {
    this.adapterFactory = factory;
  }

  /**
   * 連接用戶到指定交易所
   */
  async connectUser(
    userId: string,
    exchange: ExchangeName,
    apiKey: string,
    apiSecret: string,
    passphrase?: string
  ): Promise<void> {
    if (this.isDestroyed) {
      throw new Error('PrivateWsManager has been destroyed');
    }

    const adapterKey = this.getAdapterKey(userId, exchange);

    // 檢查是否已連接
    if (this.adapters.has(adapterKey)) {
      const adapter = this.adapters.get(adapterKey)!;
      if (adapter.isConnected()) {
        logger.debug({ userId, exchange }, 'User already connected to exchange');
        return;
      }
    }

    // 建立適配器
    const adapter = this.createAdapter(exchange);
    if (!adapter) {
      throw new Error(`No adapter available for exchange: ${exchange}`);
    }

    // 設定事件監聽
    this.setupAdapterListeners(adapter, userId);

    // 更新用戶連線狀態
    this.updateUserConnectionStatus(userId, exchange, 'connecting');

    try {
      // 連接到交易所
      await Promise.race([
        adapter.connect(apiKey, apiSecret, passphrase),
        this.createTimeoutPromise(this.options.connectionTimeoutMs),
      ]);

      // 儲存適配器
      this.adapters.set(adapterKey, adapter);

      // 更新連線狀態
      this.updateUserConnectionStatus(userId, exchange, 'connected');

      logger.info({ userId, exchange }, 'User connected to private WebSocket');
      this.emit('userConnected', { userId, exchange });
    } catch (error) {
      this.updateUserConnectionStatus(userId, exchange, 'disconnected');
      this.emit('connectionError', { userId, exchange, error });
      throw error;
    }
  }

  /**
   * 斷開用戶與指定交易所的連線
   */
  async disconnectUser(userId: string, exchange: ExchangeName): Promise<void> {
    const adapterKey = this.getAdapterKey(userId, exchange);
    const adapter = this.adapters.get(adapterKey);

    if (adapter) {
      try {
        await adapter.disconnect();
      } catch (error) {
        logger.warn({ userId, exchange, error }, 'Error disconnecting user');
      }

      adapter.removeAllListeners();
      this.adapters.delete(adapterKey);
    }

    this.updateUserConnectionStatus(userId, exchange, 'disconnected');
    logger.info({ userId, exchange }, 'User disconnected from private WebSocket');
    this.emit('userDisconnected', { userId, exchange });
  }

  /**
   * 斷開用戶所有連線
   */
  async disconnectAllForUser(userId: string): Promise<void> {
    const connection = this.userConnections.get(userId);
    if (!connection) return;

    const disconnectPromises: Promise<void>[] = [];
    for (const exchange of connection.exchanges.keys()) {
      disconnectPromises.push(this.disconnectUser(userId, exchange));
    }

    await Promise.allSettled(disconnectPromises);
    this.userConnections.delete(userId);
  }

  /**
   * 檢查用戶是否已連接到指定交易所
   */
  isUserConnected(userId: string, exchange: ExchangeName): boolean {
    const adapterKey = this.getAdapterKey(userId, exchange);
    const adapter = this.adapters.get(adapterKey);
    return adapter?.isConnected() ?? false;
  }

  /**
   * 取得用戶的連線狀態
   */
  getUserConnectionStatus(userId: string): UserConnection | undefined {
    return this.userConnections.get(userId);
  }

  /**
   * 取得所有活躍用戶
   */
  getActiveUsers(): string[] {
    return Array.from(this.userConnections.keys());
  }

  /**
   * 取得用戶已連接的交易所
   */
  getConnectedExchanges(userId: string): ExchangeName[] {
    const connection = this.userConnections.get(userId);
    if (!connection) return [];

    return Array.from(connection.exchanges.entries())
      .filter(([, status]) => status === 'connected')
      .map(([exchange]) => exchange);
  }

  /**
   * 銷毀管理器
   */
  async destroy(): Promise<void> {
    this.isDestroyed = true;

    // 斷開所有連線
    const disconnectPromises: Promise<void>[] = [];
    for (const userId of this.userConnections.keys()) {
      disconnectPromises.push(this.disconnectAllForUser(userId));
    }

    await Promise.allSettled(disconnectPromises);

    this.userConnections.clear();
    this.adapters.clear();
    this.removeAllListeners();

    logger.info('PrivateWsManager destroyed');
  }

  // ==================== 私有方法 ====================

  /**
   * 建立適配器
   */
  private createAdapter(exchange: ExchangeName): ExchangeWsAdapter | null {
    if (this.adapterFactory) {
      return this.adapterFactory.create(exchange);
    }

    // 預設不建立任何適配器，需要注入工廠
    logger.warn({ exchange }, 'No adapter factory set');
    return null;
  }

  /**
   * 設定適配器事件監聽
   */
  private setupAdapterListeners(adapter: ExchangeWsAdapter, userId: string): void {
    const exchange = adapter.getExchangeName();

    adapter.on('positionChanged', (event: PositionChanged) => {
      this.emit('positionChanged', { userId, ...event });
    });

    adapter.on('balanceChanged', (event: BalanceChanged) => {
      this.emit('balanceChanged', { userId, ...event });
    });

    adapter.on('orderStatusChanged', (event: OrderStatusChanged) => {
      this.emit('orderStatusChanged', { userId, ...event });
    });

    adapter.on('connected', () => {
      this.updateUserConnectionStatus(userId, exchange, 'connected');
      this.emit('adapterConnected', { userId, exchange });
    });

    adapter.on('disconnected', () => {
      this.updateUserConnectionStatus(userId, exchange, 'disconnected');
      this.emit('adapterDisconnected', { userId, exchange });
    });

    adapter.on('reconnecting', (attempt: number) => {
      this.updateUserConnectionStatus(userId, exchange, 'reconnecting');
      this.emit('adapterReconnecting', { userId, exchange, attempt });
    });

    adapter.on('error', (error: Error) => {
      this.emit('adapterError', { userId, exchange, error });
    });
  }

  /**
   * 更新用戶連線狀態
   */
  private updateUserConnectionStatus(
    userId: string,
    exchange: ExchangeName,
    status: ConnectionStatus
  ): void {
    let connection = this.userConnections.get(userId);

    if (!connection) {
      connection = {
        userId,
        exchanges: new Map(),
        createdAt: new Date(),
        lastActivityAt: new Date(),
      };
      this.userConnections.set(userId, connection);
    }

    connection.exchanges.set(exchange, status);
    connection.lastActivityAt = new Date();
  }

  /**
   * 取得適配器鍵值
   */
  private getAdapterKey(userId: string, exchange: ExchangeName): string {
    return `${userId}:${exchange}`;
  }

  /**
   * 建立逾時 Promise
   */
  private createTimeoutPromise(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Connection timeout after ${ms}ms`));
      }, ms);
    });
  }
}

/**
 * 導出單例訪問方法
 */
export const privateWsManager = PrivateWsManager.getInstance();

export default PrivateWsManager;
