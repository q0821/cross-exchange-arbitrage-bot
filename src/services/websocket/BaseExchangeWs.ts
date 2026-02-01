/**
 * BaseExchangeWs
 *
 * WebSocket 客戶端抽象基底類別
 * Feature: 054-native-websocket-clients
 * Task: T008
 *
 * 提供各交易所 WebSocket 客戶端的共用功能：
 * - 連線狀態管理
 * - 重連機制（指數退避）
 * - 健康檢查（60 秒無訊息觸發重連）
 * - 訊息統計和延遲追蹤
 */

import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { ReconnectionManager } from '@/lib/websocket/ReconnectionManager';
import { HealthChecker } from '@/lib/websocket/HealthChecker';
import { logger } from '@/lib/logger';
import type { ExchangeName } from '@/connectors/types';
import type { FundingRateReceived } from '@/types/websocket-events';

// =============================================================================
// 1. 類型定義
// =============================================================================

/** WebSocket 客戶端基礎配置 */
export interface BaseExchangeWsConfig {
  /** 是否自動重連 */
  autoReconnect?: boolean;
  /** 是否啟用健康檢查 */
  enableHealthCheck?: boolean;
  /** 連線逾時時間（毫秒）*/
  connectionTimeoutMs?: number;
  /** 健康檢查逾時時間（毫秒）*/
  healthCheckTimeoutMs?: number;
  /** 重連初始延遲（毫秒）*/
  reconnectInitialDelayMs?: number;
  /** 重連最大延遲（毫秒）*/
  reconnectMaxDelayMs?: number;
  /** 最大重試次數 */
  maxRetries?: number;
}

/** WebSocket 客戶端狀態 */
export interface WebSocketClientState {
  /** 連線 ID */
  connectionId: string;
  /** 交易所 */
  exchange: ExchangeName;
  /** 是否已連線 */
  isConnected: boolean;
  /** 是否已銷毀 */
  isDestroyed: boolean;
  /** 已訂閱的交易對 */
  subscribedSymbols: Set<string>;
  /** 訊息計數 */
  messageCount: number;
  /** 最後訊息時間 */
  lastMessageTime: Date | null;
  /** 連線開始時間 */
  connectionStartTime: Date | null;
  /** 重連次數 */
  reconnectCount: number;
}

/** 延遲統計（P50/P95/P99）*/
export interface LatencyStats {
  /** 平均延遲（毫秒）*/
  avg: number;
  /** P50 延遲（毫秒）*/
  p50: number;
  /** P95 延遲（毫秒）*/
  p95: number;
  /** P99 延遲（毫秒）*/
  p99: number;
  /** 最小延遲（毫秒）*/
  min: number;
  /** 最大延遲（毫秒）*/
  max: number;
  /** 樣本數 */
  sampleCount: number;
}

/** WebSocket 客戶端統計 */
export interface WebSocketClientStats {
  /** 交易所名稱 */
  exchange: ExchangeName;
  /** 連線 ID */
  connectionId: string;
  /** 是否已連線 */
  isConnected: boolean;
  /** 訊息計數 */
  messageCount: number;
  /** 最後訊息時間 */
  lastMessageTime: Date | null;
  /** 連線運行時間（秒）*/
  connectionUptime: number;
  /** 已訂閱交易對數量 */
  subscribedSymbolCount: number;
  /** 重連次數 */
  reconnectCount: number;
  /** 延遲統計 */
  latencyStats: LatencyStats;
}

/** WebSocket 客戶端事件 */
export interface BaseExchangeWsEvents {
  /** 資金費率更新 */
  'fundingRate': (data: FundingRateReceived) => void;
  /** 批量資金費率更新 */
  'fundingRateBatch': (data: FundingRateReceived[]) => void;
  /** 連線成功 */
  'connected': () => void;
  /** 斷線 */
  'disconnected': () => void;
  /** 錯誤 */
  'error': (error: Error) => void;
  /** 重連中 */
  'reconnecting': (attempt: number) => void;
  /** 重新訂閱完成 */
  'resubscribed': (count: number) => void;
  /** 達到最大重試次數 */
  'maxRetriesReached': () => void;
}

// =============================================================================
// 2. 抽象基底類別
// =============================================================================

/**
 * BaseExchangeWs - WebSocket 客戶端抽象基底類別
 *
 * 子類別需要實作：
 * - getWsUrl(): 取得 WebSocket URL
 * - buildSubscribeMessage(): 建構訂閱訊息
 * - buildUnsubscribeMessage(): 建構取消訂閱訊息
 * - handleMessage(): 處理接收到的訊息
 * - handlePing(): 處理心跳（可選）
 */
export abstract class BaseExchangeWs extends EventEmitter {
  /** 交易所名稱 */
  protected abstract readonly exchangeName: ExchangeName;

  /** 配置 */
  protected config: Required<BaseExchangeWsConfig>;

  /** WebSocket 實例 */
  protected ws: WebSocket | null = null;

  /** 重連管理器 */
  protected reconnectionManager: ReconnectionManager;

  /** 健康檢查器 */
  protected healthChecker: HealthChecker;

  /** 已訂閱的交易對 */
  protected subscribedSymbols: Set<string> = new Set();

  /** 連線狀態 */
  protected isConnected = false;

  /** 是否已銷毀 */
  protected isDestroyed = false;

  /** 連線 ID（用於追蹤）*/
  protected connectionId: string;

  // 統計資訊
  protected messageCount = 0;
  protected lastMessageTime: Date | null = null;
  protected connectionStartTime: Date | null = null;
  protected reconnectCount = 0;

  // 延遲追蹤（保留最近 1000 個樣本）
  protected latencySamples: number[] = [];
  protected readonly maxLatencySamples = 1000;

  constructor(config: BaseExchangeWsConfig = {}) {
    super();

    this.connectionId = this.generateConnectionId();

    this.config = {
      autoReconnect: config.autoReconnect ?? true,
      enableHealthCheck: config.enableHealthCheck ?? true,
      connectionTimeoutMs: config.connectionTimeoutMs ?? 10000,
      healthCheckTimeoutMs: config.healthCheckTimeoutMs ?? 60000,
      reconnectInitialDelayMs: config.reconnectInitialDelayMs ?? 1000,
      reconnectMaxDelayMs: config.reconnectMaxDelayMs ?? 30000,
      maxRetries: config.maxRetries ?? 10,
    };

    // 初始化重連管理器
    this.reconnectionManager = new ReconnectionManager({
      initialDelayMs: this.config.reconnectInitialDelayMs,
      maxDelayMs: this.config.reconnectMaxDelayMs,
      maxRetries: this.config.maxRetries,
    });

    // 初始化健康檢查器
    this.healthChecker = new HealthChecker({
      timeoutMs: this.config.healthCheckTimeoutMs,
      onUnhealthy: () => {
        if (this.config.enableHealthCheck && this.config.autoReconnect) {
          logger.warn(
            { service: this.getLogPrefix(), connectionId: this.connectionId },
            'WebSocket unhealthy, triggering reconnect'
          );
          this.reconnect();
        }
      },
    });
  }

  // =============================================================================
  // 3. 抽象方法（子類別必須實作）
  // =============================================================================

  /** 取得 WebSocket URL */
  protected abstract getWsUrl(): string;

  /**
   * 建構訂閱訊息
   * @param symbols 內部格式的交易對符號
   */
  protected abstract buildSubscribeMessage(symbols: string[]): unknown;

  /**
   * 建構取消訂閱訊息
   * @param symbols 內部格式的交易對符號
   */
  protected abstract buildUnsubscribeMessage(symbols: string[]): unknown;

  /**
   * 處理接收到的訊息
   * @param data 原始訊息數據
   */
  protected abstract handleMessage(data: Buffer | string): void;

  // =============================================================================
  // 4. 可覆寫的方法
  // =============================================================================

  /** 處理心跳（ping）- 預設自動回覆 pong */
  protected handlePing(): void {
    // 預設不需要額外處理，ws 庫會自動回覆 pong
    logger.debug({ service: this.getLogPrefix() }, 'Received ping');
  }

  /** 取得日誌前綴 */
  protected getLogPrefix(): string {
    return `${this.exchangeName.charAt(0).toUpperCase()}${this.exchangeName.slice(1)}FundingWs`;
  }

  /** 生成連線 ID */
  protected generateConnectionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  // =============================================================================
  // 5. 連線管理
  // =============================================================================

  /**
   * 連接到 WebSocket
   */
  async connect(): Promise<void> {
    if (this.isDestroyed) {
      throw new Error('Client has been destroyed');
    }

    if (this.isConnected || this.ws) {
      logger.warn(
        { service: this.getLogPrefix(), connectionId: this.connectionId },
        'Already connected or connecting'
      );
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        const url = this.getWsUrl();
        logger.info(
          { service: this.getLogPrefix(), url, connectionId: this.connectionId },
          'Connecting to WebSocket'
        );

        this.ws = new WebSocket(url);

        const connectionTimeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
          // 安全終止：使用 terminate() 並加入臨時錯誤處理器
          try {
            if (this.ws) {
              this.ws.removeAllListeners();
              this.ws.on('error', () => {});
              this.ws.terminate();
            }
          } catch {
            // 忽略終止時的錯誤
          }
        }, this.config.connectionTimeoutMs);

        this.ws.on('open', () => {
          clearTimeout(connectionTimeout);
          this.isConnected = true;
          this.connectionStartTime = new Date();
          this.messageCount = 0;
          this.connectionId = this.generateConnectionId();
          this.reconnectionManager.reset();

          logger.info(
            { service: this.getLogPrefix(), connectionId: this.connectionId },
            'WebSocket connected'
          );
          this.emit('connected');

          // 啟動健康檢查
          if (this.config.enableHealthCheck) {
            this.healthChecker.start();
          }

          resolve();
        });

        this.ws.on('message', (data: Buffer) => {
          this.onMessage(data);
        });

        this.ws.on('ping', () => {
          this.handlePing();
        });

        this.ws.on('error', (error: Error) => {
          logger.error(
            { service: this.getLogPrefix(), error: error.message, connectionId: this.connectionId },
            'WebSocket error'
          );
          this.emit('error', error);
        });

        this.ws.on('close', () => {
          logger.info(
            { service: this.getLogPrefix(), connectionId: this.connectionId },
            'WebSocket closed'
          );
          this.isConnected = false;
          this.emit('disconnected');

          this.healthChecker.stop();

          if (this.config.autoReconnect && !this.isDestroyed) {
            this.scheduleReconnect();
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 斷開連接
   */
  async disconnect(): Promise<void> {
    const stats = this.getStats();
    logger.info(
      {
        service: this.getLogPrefix(),
        connectionId: this.connectionId,
        messageCount: stats.messageCount,
        uptime: stats.connectionUptime,
      },
      'Disconnecting from WebSocket'
    );

    this.config.autoReconnect = false;
    this.healthChecker.stop();
    this.reconnectionManager.clearTimer();

    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // 忽略 WebSocket 關閉錯誤（例如連線尚未建立）
        // ws 套件在 CONNECTING 狀態呼叫 close() 會拋出錯誤
      }
      this.ws = null;
    }

    this.isConnected = false;
    this.connectionStartTime = null;
  }

  /**
   * 銷毀客戶端
   *
   * 注意：使用同步清理，避免 async disconnect() 無法 await 的問題
   */
  destroy(): void {
    this.isDestroyed = true;

    // 同步清理 WebSocket（不等待 disconnect）
    if (this.ws) {
      try {
        this.ws.removeAllListeners();
        this.ws.on('error', () => {}); // 防止未捕獲錯誤
        this.ws.terminate(); // 同步強制關閉
      } catch {
        // 忽略終止時的錯誤
      }
      this.ws = null;
    }

    this.isConnected = false;
    this.connectionStartTime = null;
    this.reconnectionManager.destroy();
    this.healthChecker.destroy();
    this.removeAllListeners();

    logger.debug(
      { service: this.getLogPrefix(), connectionId: this.connectionId },
      'Client destroyed'
    );
  }

  // =============================================================================
  // 6. 訂閱管理
  // =============================================================================

  /**
   * 訂閱指定交易對
   * @param symbols 內部格式的交易對符號陣列，如 ['BTCUSDT', 'ETHUSDT']
   */
  async subscribe(symbols: string[]): Promise<void> {
    if (!this.isConnected || !this.ws) {
      throw new Error('Not connected');
    }

    const message = this.buildSubscribeMessage(symbols);
    logger.info(
      { service: this.getLogPrefix(), symbols, connectionId: this.connectionId },
      'Subscribing to symbols'
    );

    this.ws.send(JSON.stringify(message));

    // 記錄已訂閱的交易對
    symbols.forEach((symbol) => this.subscribedSymbols.add(symbol.toUpperCase()));
  }

  /**
   * 取消訂閱交易對
   * @param symbols 內部格式的交易對符號陣列
   */
  async unsubscribe(symbols: string[]): Promise<void> {
    if (!this.isConnected || !this.ws) {
      throw new Error('Not connected');
    }

    const message = this.buildUnsubscribeMessage(symbols);
    logger.info(
      { service: this.getLogPrefix(), symbols, connectionId: this.connectionId },
      'Unsubscribing from symbols'
    );

    this.ws.send(JSON.stringify(message));

    symbols.forEach((symbol) => this.subscribedSymbols.delete(symbol.toUpperCase()));
  }

  // =============================================================================
  // 7. 訊息處理
  // =============================================================================

  /**
   * 處理接收到的訊息（內部方法）
   */
  private onMessage(data: Buffer | string): void {
    const receiveTime = Date.now();

    // 更新統計
    this.messageCount++;
    this.lastMessageTime = new Date();

    // 更新健康檢查
    if (this.config.enableHealthCheck) {
      this.healthChecker.recordMessage();
    }

    // 嘗試解析訊息時間戳以計算延遲
    // 注意：跳過 GZIP 壓縮的訊息（如 BingX），避免對二進制數據呼叫 toString() 產生記憶體垃圾
    if (!this.isGzipCompressed(data)) {
      try {
        const message =
          typeof data === 'string' ? JSON.parse(data) : JSON.parse(data.toString());

        // 嘗試從訊息中提取時間戳
        const messageTime = this.extractMessageTimestamp(message);
        if (messageTime) {
          const latency = receiveTime - messageTime;
          this.recordLatency(latency);
        }
      } catch {
        // 忽略解析錯誤，讓子類別處理
      }
    }

    // 呼叫子類別的訊息處理器
    this.handleMessage(data);
  }

  /**
   * 檢測數據是否為 GZIP 壓縮格式
   * GZIP 的 magic number 是 0x1f 0x8b
   *
   * @param data 原始數據
   * @returns 是否為 GZIP 壓縮
   */
  private isGzipCompressed(data: Buffer | string): boolean {
    if (typeof data === 'string') {
      return false; // 字串不可能是 GZIP
    }
    // Buffer: 檢查 magic number
    return data.length >= 2 && data[0] === 0x1f && data[1] === 0x8b;
  }

  /**
   * 嘗試從訊息中提取時間戳
   */
  protected extractMessageTimestamp(message: unknown): number | null {
    if (typeof message !== 'object' || message === null) {
      return null;
    }

    const msg = message as Record<string, unknown>;

    // 常見的時間戳欄位
    if (typeof msg['E'] === 'number') return msg['E'];
    if (typeof msg['time'] === 'number') return msg['time'] * 1000; // Gate.io 使用秒
    if (typeof msg['ts'] === 'string') return parseInt(msg['ts'], 10);

    // 巢狀結構
    if (msg['data'] && typeof msg['data'] === 'object') {
      const data = msg['data'] as Record<string, unknown>;
      if (typeof data['E'] === 'number') return data['E'];
    }

    return null;
  }

  /**
   * 記錄延遲樣本
   */
  protected recordLatency(latencyMs: number): void {
    if (latencyMs >= 0 && latencyMs < 60000) {
      // 合理範圍：0-60 秒
      this.latencySamples.push(latencyMs);
      if (this.latencySamples.length > this.maxLatencySamples) {
        this.latencySamples.shift();
      }
    }
  }

  // =============================================================================
  // 8. 重連機制
  // =============================================================================

  /**
   * 排程重連
   */
  protected scheduleReconnect(): void {
    const delay = this.reconnectionManager.scheduleReconnect(() => {
      this.reconnect();
    });

    const state = this.reconnectionManager.getState();
    logger.info(
      {
        service: this.getLogPrefix(),
        delay,
        retryCount: state.retryCount,
        connectionId: this.connectionId,
      },
      'Scheduled reconnect'
    );

    this.emit('reconnecting', state.retryCount);
  }

  /**
   * 嘗試重新連接（公開方法供外部調用）
   */
  async tryReconnect(): Promise<boolean> {
    if (this.isDestroyed) {
      return false;
    }
    try {
      await this.reconnect();
      return this.isConnected;
    } catch {
      return false;
    }
  }

  /**
   * 清理現有連線（helper 方法）
   */
  private cleanupExistingConnection(): void {
    if (!this.ws) return;

    this.ws.removeAllListeners();
    this.ws.on('error', () => {}); // 防止未捕獲錯誤
    try {
      this.ws.terminate();
    } catch {
      // 忽略終止錯誤
    }
    this.ws = null;
    this.isConnected = false;
  }

  /**
   * 重連（內部方法）
   *
   * 注意：會檢查 canRetry() 和發出 maxRetriesReached 事件
   */
  protected async reconnect(): Promise<void> {
    // 檢查是否還能重試
    if (!this.reconnectionManager.canRetry()) {
      logger.warn(
        { service: this.getLogPrefix(), connectionId: this.connectionId },
        'Max reconnect attempts reached'
      );
      this.emit('maxRetriesReached');
      return;
    }

    logger.info(
      { service: this.getLogPrefix(), connectionId: this.connectionId },
      'Reconnecting to WebSocket'
    );

    this.reconnectCount++;
    this.cleanupExistingConnection();

    try {
      await this.connect();

      // 重新訂閱
      if (this.subscribedSymbols.size > 0) {
        const symbols = Array.from(this.subscribedSymbols);
        await this.subscribe(symbols);
        logger.info(
          { service: this.getLogPrefix(), count: symbols.length, connectionId: this.connectionId },
          'Resubscribed to symbols'
        );
        this.emit('resubscribed', symbols.length);
      }
    } catch (error) {
      logger.error(
        {
          service: this.getLogPrefix(),
          error: error instanceof Error ? error.message : String(error),
          connectionId: this.connectionId,
        },
        'Reconnection failed'
      );

      // 再次檢查是否能重試（connect 失敗後 retryCount 可能已更新）
      if (this.config.autoReconnect && !this.isDestroyed && this.reconnectionManager.canRetry()) {
        this.scheduleReconnect();
      }
    }
  }

  // =============================================================================
  // 9. 統計和狀態
  // =============================================================================

  /**
   * 計算延遲統計
   */
  protected calculateLatencyStats(): LatencyStats {
    if (this.latencySamples.length === 0) {
      return { avg: 0, p50: 0, p95: 0, p99: 0, min: 0, max: 0, sampleCount: 0 };
    }

    const sorted = [...this.latencySamples].sort((a, b) => a - b);
    const len = sorted.length;

    const sum = sorted.reduce((acc, val) => acc + val, 0);
    const avg = sum / len;

    const p50Index = Math.floor(len * 0.5);
    const p95Index = Math.floor(len * 0.95);
    const p99Index = Math.floor(len * 0.99);

    return {
      avg: Math.round(avg * 100) / 100,
      p50: sorted[p50Index] ?? 0,
      p95: sorted[p95Index] ?? 0,
      p99: sorted[p99Index] ?? 0,
      min: sorted[0] ?? 0,
      max: sorted[len - 1] ?? 0,
      sampleCount: len,
    };
  }

  /**
   * 取得連線統計
   */
  getStats(): WebSocketClientStats {
    const now = Date.now();
    const connectionUptime = this.connectionStartTime
      ? Math.floor((now - this.connectionStartTime.getTime()) / 1000)
      : 0;

    return {
      exchange: this.exchangeName,
      connectionId: this.connectionId,
      isConnected: this.isConnected,
      messageCount: this.messageCount,
      lastMessageTime: this.lastMessageTime,
      connectionUptime,
      subscribedSymbolCount: this.subscribedSymbols.size,
      reconnectCount: this.reconnectCount,
      latencyStats: this.calculateLatencyStats(),
    };
  }

  /**
   * 記錄連線統計日誌
   */
  logStats(): void {
    const stats = this.getStats();
    logger.info(
      {
        service: this.getLogPrefix(),
        ...stats,
        messagesPerSecond:
          stats.connectionUptime > 0
            ? (stats.messageCount / stats.connectionUptime).toFixed(2)
            : 0,
      },
      'WebSocket connection stats'
    );
  }

  /**
   * 取得連接狀態
   */
  isReady(): boolean {
    return this.isConnected;
  }

  /**
   * 取得已訂閱的交易對
   */
  getSubscribedSymbols(): string[] {
    return Array.from(this.subscribedSymbols);
  }

  /**
   * 取得客戶端狀態
   */
  getState(): WebSocketClientState {
    return {
      connectionId: this.connectionId,
      exchange: this.exchangeName,
      isConnected: this.isConnected,
      isDestroyed: this.isDestroyed,
      subscribedSymbols: new Set(this.subscribedSymbols),
      messageCount: this.messageCount,
      lastMessageTime: this.lastMessageTime,
      connectionStartTime: this.connectionStartTime,
      reconnectCount: this.reconnectCount,
    };
  }
}
