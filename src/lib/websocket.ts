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
}

export type WSState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export class WebSocketManager extends EventEmitter {
  private ws: WebSocket | null = null;
  private state: WSState = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingTimer: NodeJS.Timeout | null = null;
  private pongTimer: NodeJS.Timeout | null = null;
  private lastPingTime: number = 0;

  constructor(
    private readonly config: WSConfig,
    private readonly name: string
  ) {
    super();
    this.setMaxListeners(50); // 增加監聽器限制
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
  subscribe(channel: string, params?: object): void {
    const subscribeMsg = {
      op: 'subscribe',
      channel,
      ...params,
    };

    this.send(subscribeMsg);
    logger.info({ name: this.name, channel }, 'WebSocket subscribed');
  }

  // 取消訂閱
  unsubscribe(channel: string, params?: object): void {
    const unsubscribeMsg = {
      op: 'unsubscribe',
      channel,
      ...params,
    };

    this.send(unsubscribeMsg);
    logger.info({ name: this.name, channel }, 'WebSocket unsubscribed');
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
    this.state = 'connected';
    this.reconnectAttempts = 0;

    logger.info({ name: this.name }, 'WebSocket connected');
    this.emit('connected');

    // 啟動心跳
    this.startPing();
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
    logger.debug({ name: this.name, latency }, 'WebSocket pong received');
  }

  // 重新連線
  private attemptReconnect(): void {
    const maxAttempts = this.config.maxReconnectAttempts || 10;
    const delay = this.config.reconnectDelay || 5000;

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

    logger.info({
      name: this.name,
      attempt: this.reconnectAttempts,
      maxAttempts,
    }, 'Attempting to reconnect');

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
      pingInterval: 30000,
      pongTimeout: 10000,
      reconnectDelay: 5000,
      maxReconnectAttempts: 10,
      ...config,
    },
    name
  );
}
