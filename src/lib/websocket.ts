import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { wsLogger as logger } from './logger';
import { ExchangeConnectionError } from './errors';

export interface WSConfig {
  url: string;
  pingInterval?: number;
  pongTimeout?: number;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
  /** 重連延遲倍數 (指數退避) */
  reconnectBackoffMultiplier?: number;
  /** 最大重連延遲 (ms) */
  maxReconnectDelay?: number;
  /** 連線超時 (ms) */
  connectionTimeout?: number;
  /** 是否自動重新訂閱 */
  autoResubscribe?: boolean;
}

export type WSState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

/** 訂閱資訊 */
export interface SubscriptionInfo {
  /** 頻道名稱 */
  channel: string;
  /** 訂閱參數 */
  params?: Record<string, unknown>;
  /** 訂閱時間 */
  subscribedAt: Date;
  /** 是否活躍 */
  active: boolean;
}

export class WebSocketManager extends EventEmitter {
  private ws: WebSocket | null = null;
  private state: WSState = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingTimer: NodeJS.Timeout | null = null;
  private pongTimer: NodeJS.Timeout | null = null;
  private resubscribeTimer: NodeJS.Timeout | null = null;
  private lastPingTime: number = 0;
  /** 訂閱追蹤 Map<channel, SubscriptionInfo> */
  private subscriptions: Map<string, SubscriptionInfo> = new Map();
  /** 連線建立時間 */
  private connectedAt: Date | null = null;
  /** 最後心跳接收時間 */
  private lastHeartbeatAt: Date | null = null;

  constructor(
    private readonly config: WSConfig,
    private readonly name: string
  ) {
    super();
    this.setMaxListeners(50); // 增加監聯器限制
  }

  /** 取得所有訂閱 */
  getSubscriptions(): Map<string, SubscriptionInfo> {
    return new Map(this.subscriptions);
  }

  /** 取得訂閱數量 */
  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  /** 檢查是否已訂閱指定頻道 */
  hasSubscription(channel: string): boolean {
    return this.subscriptions.has(channel);
  }

  /** 取得連線建立時間 */
  getConnectedAt(): Date | null {
    return this.connectedAt;
  }

  /** 取得最後心跳時間 */
  getLastHeartbeatAt(): Date | null {
    return this.lastHeartbeatAt;
  }

  /** 取得重連嘗試次數 */
  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  // 連線
  async connect(): Promise<void> {
    if (this.state === 'connected' || this.state === 'connecting') {
      logger.debug({ name: this.name, state: this.state }, `WebSocket already ${this.state}`);
      return;
    }

    this.state = 'connecting';
    logger.info({ name: this.name, url: this.config.url }, 'Connecting WebSocket');

    try {
      this.ws = new WebSocket(this.config.url);

      this.ws.on('open', () => this.handleOpen());
      this.ws.on('message', (data) => this.handleMessage(data));
      this.ws.on('close', (code, reason) => this.handleClose(code, reason));
      this.ws.on('error', (error) => this.handleError(error));
      this.ws.on('pong', () => this.handlePong());

      // 等待連線建立
      await this.waitForConnection();
    } catch (error) {
      this.state = 'error';
      throw new ExchangeConnectionError(this.name, {
        message: 'Failed to establish WebSocket connection',
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // 斷線
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // 清理重新訂閱定時器以防止記憶體泄漏
    if (this.resubscribeTimer) {
      clearTimeout(this.resubscribeTimer);
      this.resubscribeTimer = null;
    }

    this.stopPing();

    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }

    this.state = 'disconnected';
    logger.info({ name: this.name }, 'WebSocket disconnected');
    this.emit('disconnected');
  }

  // 發送訊息
  send(data: string | object): void {
    if (this.state !== 'connected' || !this.ws) {
      throw new Error('WebSocket is not connected');
    }

    const message = typeof data === 'string' ? data : JSON.stringify(data);
    this.ws.send(message);

    logger.debug({
      name: this.name,
      message: message.substring(0, 200),
    }, 'WebSocket message sent');
  }

  // 訂閱 (發送訂閱訊息)
  subscribe(channel: string, params?: Record<string, unknown>): void {
    const subscribeMsg = {
      op: 'subscribe',
      channel,
      ...params,
    };

    this.send(subscribeMsg);

    // 追蹤訂閱
    this.subscriptions.set(channel, {
      channel,
      params,
      subscribedAt: new Date(),
      active: true,
    });

    logger.info({ name: this.name, channel, totalSubscriptions: this.subscriptions.size }, 'WebSocket subscribed');
  }

  // 取消訂閱
  unsubscribe(channel: string, params?: Record<string, unknown>): void {
    const unsubscribeMsg = {
      op: 'unsubscribe',
      channel,
      ...params,
    };

    this.send(unsubscribeMsg);

    // 移除訂閱追蹤
    this.subscriptions.delete(channel);

    logger.info({ name: this.name, channel, totalSubscriptions: this.subscriptions.size }, 'WebSocket unsubscribed');
  }

  // 批量訂閱
  subscribeMany(channels: Array<{ channel: string; params?: Record<string, unknown> }>): void {
    for (const { channel, params } of channels) {
      this.subscribe(channel, params);
    }
  }

  // 批量取消訂閱
  unsubscribeMany(channels: string[]): void {
    for (const channel of channels) {
      this.unsubscribe(channel);
    }
  }

  // 取消所有訂閱
  unsubscribeAll(): void {
    const channels = Array.from(this.subscriptions.keys());
    this.unsubscribeMany(channels);
  }

  // 重新訂閱所有頻道 (斷線重連後使用)
  private async resubscribeAll(): Promise<void> {
    if (!this.config.autoResubscribe) {
      logger.debug({ name: this.name }, 'Auto-resubscribe disabled, skipping');
      return;
    }

    const subscriptions = Array.from(this.subscriptions.entries());
    if (subscriptions.length === 0) {
      logger.debug({ name: this.name }, 'No subscriptions to restore');
      return;
    }

    logger.info({ name: this.name, count: subscriptions.length }, 'Restoring subscriptions after reconnect');

    for (const [channel, info] of subscriptions) {
      try {
        const subscribeMsg = {
          op: 'subscribe',
          channel,
          ...info.params,
        };
        this.send(subscribeMsg);

        // 更新訂閱時間
        info.subscribedAt = new Date();
        info.active = true;

        logger.debug({ name: this.name, channel }, 'Subscription restored');
      } catch (error) {
        logger.error({
          name: this.name,
          channel,
          error: error instanceof Error ? error.message : String(error),
        }, 'Failed to restore subscription');

        info.active = false;
      }
    }

    this.emit('resubscribed', subscriptions.length);
  }

  // 取得連線狀態
  getState(): WSState {
    return this.state;
  }

  isConnected(): boolean {
    return this.state === 'connected';
  }

  // 私有方法
  private handleOpen(): void {
    const wasReconnecting = this.state === 'reconnecting';
    this.state = 'connected';
    this.reconnectAttempts = 0;
    this.connectedAt = new Date();

    logger.info({ name: this.name, wasReconnecting }, 'WebSocket connected');
    this.emit('connected');

    // 啟動心跳
    this.startPing();

    // 斷線重連後自動重新訂閱
    if (wasReconnecting && this.subscriptions.size > 0) {
      // 延遲執行以確保連線穩定
      this.resubscribeTimer = setTimeout(() => {
        this.resubscribeTimer = null;
        this.resubscribeAll().catch((error) => {
          logger.error({
            name: this.name,
            error: error instanceof Error ? error.message : String(error),
          }, 'Failed to resubscribe after reconnect');
        });
      }, 100);
    }
  }

  private handleMessage(data: WebSocket.Data): void {
    try {
      const message = data.toString();

      // 解析 JSON
      let parsed: unknown;
      try {
        parsed = JSON.parse(message);
      } catch {
        // 非 JSON 訊息，直接回傳原始資料
        this.emit('message', message);
        return;
      }

      // 處理 ping/pong
      if (this.isPingMessage(parsed)) {
        this.handlePingMessage(parsed);
        return;
      }

      // 發送解析後的訊息
      this.emit('message', parsed);

      logger.debug({
        name: this.name,
        message: message.substring(0, 200),
      }, 'WebSocket message received');
    } catch (error) {
      logger.error({
        name: this.name,
        error: error instanceof Error ? error.message : String(error),
      }, 'Failed to handle WebSocket message');
    }
  }

  private handleClose(code: number, reason: Buffer): void {
    const reasonStr = reason.toString();

    logger.warn({
      name: this.name,
      code,
      reason: reasonStr,
    }, 'WebSocket closed');

    this.stopPing();

    if (this.state !== 'disconnected') {
      this.emit('close', code, reasonStr);
      this.attemptReconnect();
    }
  }

  private handleError(error: Error): void {
    logger.error({
      name: this.name,
      error: error.message,
    }, 'WebSocket error');

    this.emit('error', error);
  }

  private handlePong(): void {
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }

    const latency = Date.now() - this.lastPingTime;
    this.lastHeartbeatAt = new Date();

    logger.debug({ name: this.name, latency }, 'WebSocket pong received');
    this.emit('heartbeat', { latency, timestamp: this.lastHeartbeatAt });
  }

  // 重新連線
  private attemptReconnect(): void {
    const maxAttempts = this.config.maxReconnectAttempts || 10;
    const baseDelay = this.config.reconnectDelay || 1000;
    const backoffMultiplier = this.config.reconnectBackoffMultiplier || 2;
    const maxDelay = this.config.maxReconnectDelay || 30000;

    if (this.reconnectAttempts >= maxAttempts) {
      logger.error({
        name: this.name,
        attempts: this.reconnectAttempts,
      }, 'Max reconnect attempts reached');
      this.state = 'error';
      this.emit('maxReconnectAttemptsReached');
      return;
    }

    this.reconnectAttempts++;
    this.state = 'reconnecting';

    // 計算指數退避延遲
    const delay = Math.min(
      baseDelay * Math.pow(backoffMultiplier, this.reconnectAttempts - 1),
      maxDelay
    );

    logger.info({
      name: this.name,
      attempt: this.reconnectAttempts,
      maxAttempts,
      delay,
    }, 'Attempting to reconnect with exponential backoff');

    this.emit('reconnecting', { attempt: this.reconnectAttempts, delay });

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch((error) => {
        logger.error({
          name: this.name,
          error: error instanceof Error ? error.message : String(error),
        }, 'Reconnect failed');
      });
    }, delay);
  }

  // 心跳機制
  private startPing(): void {
    const interval = this.config.pingInterval || 30000;

    this.pingTimer = setInterval(() => {
      if (this.ws && this.state === 'connected') {
        this.lastPingTime = Date.now();
        this.ws.ping();

        // 設定 pong 超時
        const timeout = this.config.pongTimeout || 10000;
        this.pongTimer = setTimeout(() => {
          logger.warn({ name: this.name }, 'Pong timeout, closing connection');
          this.ws?.close();
        }, timeout);
      }
    }, interval);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }

    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
  }

  // 等待連線建立
  private waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, 10000);

      const onConnected = () => {
        clearTimeout(timeout);
        this.off('error', onError);
        resolve();
      };

      const onError = (error: Error) => {
        clearTimeout(timeout);
        this.off('connected', onConnected);
        reject(error);
      };

      this.once('connected', onConnected);
      this.once('error', onError);
    });
  }

  // 判斷是否為 ping 訊息 (不同交易所格式不同)
  private isPingMessage(message: unknown): boolean {
    if (typeof message === 'object' && message !== null) {
      const msg = message as Record<string, unknown>;
      return msg.ping !== undefined || msg.op === 'ping' || msg.event === 'ping';
    }
    return false;
  }

  // 處理 ping 訊息並回應 pong
  private handlePingMessage(message: unknown): void {
    if (typeof message === 'object' && message !== null) {
      const msg = message as Record<string, unknown>;

      // 不同交易所的 pong 格式
      let pongMsg: object;

      if (msg.ping !== undefined) {
        // Binance 格式
        pongMsg = { pong: msg.ping };
      } else if (msg.op === 'ping') {
        // OKX 格式
        pongMsg = { op: 'pong' };
      } else {
        // 通用格式
        pongMsg = { pong: Date.now() };
      }

      this.send(pongMsg);
      logger.debug({ name: this.name }, 'WebSocket pong sent');
    }
  }
}

// 工廠函式
export function createWebSocket(url: string, name: string, config?: Partial<WSConfig>): WebSocketManager {
  return new WebSocketManager(
    {
      url,
      pingInterval: 20000,                // 20 秒 ping 間隔
      pongTimeout: 60000,                 // 60 秒 pong 超時
      reconnectDelay: 1000,               // 1 秒初始重連延遲
      maxReconnectAttempts: 10,           // 最多 10 次重連
      reconnectBackoffMultiplier: 2,      // 指數退避倍數
      maxReconnectDelay: 30000,           // 最大 30 秒重連延遲
      connectionTimeout: 10000,           // 10 秒連線超時
      autoResubscribe: true,              // 自動重新訂閱
      ...config,
    },
    name
  );
}
