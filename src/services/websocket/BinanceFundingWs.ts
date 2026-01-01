/**
 * BinanceFundingWs
 *
 * Binance WebSocket 客戶端 - 訂閱即時資金費率
 * Feature: 052-specify-scripts-bash
 * Task: T014, T021 (結構化日誌)
 *
 * 使用 @markPrice@1s stream 獲取資金費率數據
 */

import { EventEmitter } from 'events';
import WebSocket from 'ws';
import Decimal from 'decimal.js';
import { ReconnectionManager } from '@/lib/websocket/ReconnectionManager';
import { HealthChecker } from '@/lib/websocket/HealthChecker';
import { parseBinanceMarkPriceUpdate } from '@/lib/schemas/websocket-messages';
import type { FundingRateReceived } from '@/types/websocket-events';
import { logger } from '@/lib/logger';

/** Binance Funding WebSocket 配置 */
export interface BinanceFundingWsConfig {
  /** WebSocket URL（預設使用 Combined Streams）*/
  wsUrl?: string;
  /** 是否自動重連 */
  autoReconnect?: boolean;
  /** 是否啟用健康檢查 */
  enableHealthCheck?: boolean;
  /** 更新頻率：'1s' 或 '3s' */
  updateSpeed?: '1s' | '3s';
}

/** BinanceFundingWs 事件 */
export interface BinanceFundingWsEvents {
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
}

/**
 * BinanceFundingWs
 *
 * 連接到 Binance Combined Streams 並訂閱 markPrice 數據：
 * - 使用 @markPrice@1s stream 獲取即時資金費率
 * - 自動重連機制（指數退避）
 * - 健康檢查（60 秒無訊息觸發重連）
 * - 自動處理 ping/pong 心跳
 * - 支援單一符號和批量訂閱 (!markPrice@arr)
 */
export class BinanceFundingWs extends EventEmitter {
  private config: Required<BinanceFundingWsConfig>;
  private ws: WebSocket | null = null;
  private reconnectionManager: ReconnectionManager;
  private healthChecker: HealthChecker;
  private subscribedSymbols: Set<string> = new Set();
  private isConnected = false;
  private isDestroyed = false;
  private subscribeAllSymbols = false;

  // T021: 結構化日誌 - 訊息統計
  private messageCount = 0;
  private lastMessageTime: Date | null = null;
  private connectionStartTime: Date | null = null;

  constructor(config: BinanceFundingWsConfig = {}) {
    super();

    this.config = {
      wsUrl: config.wsUrl ?? 'wss://fstream.binance.com/stream',
      autoReconnect: config.autoReconnect ?? true,
      enableHealthCheck: config.enableHealthCheck ?? true,
      updateSpeed: config.updateSpeed ?? '1s',
    };

    // 初始化重連管理器
    this.reconnectionManager = new ReconnectionManager({
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      maxRetries: 10,
    });

    // 初始化健康檢查器
    this.healthChecker = new HealthChecker({
      timeoutMs: 60000, // 60 秒無訊息視為不健康
      onUnhealthy: () => {
        if (this.config.enableHealthCheck && this.config.autoReconnect) {
          logger.warn({ service: 'BinanceFundingWs' }, 'WebSocket unhealthy, triggering reconnect');
          this.reconnect();
        }
      },
    });

    logger.debug({
      wsUrl: this.config.wsUrl,
      updateSpeed: this.config.updateSpeed,
    }, 'BinanceFundingWs initialized');
  }

  /**
   * 連接到 Binance WebSocket
   */
  async connect(): Promise<void> {
    if (this.isDestroyed) {
      throw new Error('Client has been destroyed');
    }

    if (this.isConnected || this.ws) {
      logger.warn({ service: 'BinanceFundingWs' }, 'Already connected or connecting');
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        logger.info({
          url: this.config.wsUrl,
        }, 'Connecting to Binance Funding WebSocket');

        this.ws = new WebSocket(this.config.wsUrl);

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
        }, 10000);

        this.ws.on('open', () => {
          clearTimeout(connectionTimeout);
          this.isConnected = true;
          this.connectionStartTime = new Date();
          this.messageCount = 0;
          this.reconnectionManager.reset();

          logger.info({
            service: 'BinanceFundingWs',
            url: this.config.wsUrl,
            updateSpeed: this.config.updateSpeed,
          }, 'Binance Funding WebSocket connected');
          this.emit('connected');

          // 啟動健康檢查
          if (this.config.enableHealthCheck) {
            this.healthChecker.start();
          }

          resolve();
        });

        this.ws.on('message', (data: Buffer) => {
          this.handleMessage(data);
        });

        this.ws.on('ping', () => {
          logger.debug({ service: 'BinanceFundingWs' }, 'Received ping from Binance');
        });

        this.ws.on('error', (error: Error) => {
          logger.error({
            service: 'BinanceFundingWs',
            error: error.message,
          }, 'Binance Funding WebSocket error');
          this.emit('error', error);
        });

        this.ws.on('close', () => {
          logger.info({ service: 'BinanceFundingWs' }, 'Binance Funding WebSocket closed');
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
   * 訂閱指定交易對的資金費率
   * @param symbols 交易對符號陣列，如 ['BTCUSDT', 'ETHUSDT']
   */
  async subscribe(symbols: string[]): Promise<void> {
    if (!this.isConnected || !this.ws) {
      throw new Error('Not connected');
    }

    // 轉換符號格式：BTCUSDT -> btcusdt@markPrice@1s
    const streams = symbols.map(
      (symbol) => `${symbol.toLowerCase()}@markPrice@${this.config.updateSpeed}`
    );

    const subscribeMessage = {
      method: 'SUBSCRIBE',
      params: streams,
      id: Date.now(),
    };

    logger.info({
      service: 'BinanceFundingWs',
      symbols,
      streams,
    }, 'Subscribing to Binance funding rate streams');

    this.ws.send(JSON.stringify(subscribeMessage));

    // 記錄已訂閱的交易對
    symbols.forEach((symbol) => this.subscribedSymbols.add(symbol.toUpperCase()));
  }

  /**
   * 訂閱所有交易對的資金費率（使用 !markPrice@arr）
   * 注意：這會推送所有交易對的 markPrice，數據量較大
   */
  async subscribeAll(): Promise<void> {
    if (!this.isConnected || !this.ws) {
      throw new Error('Not connected');
    }

    const stream = `!markPrice@arr@${this.config.updateSpeed}`;

    const subscribeMessage = {
      method: 'SUBSCRIBE',
      params: [stream],
      id: Date.now(),
    };

    logger.info({
      service: 'BinanceFundingWs',
      stream,
    }, 'Subscribing to all Binance funding rate streams');

    this.ws.send(JSON.stringify(subscribeMessage));
    this.subscribeAllSymbols = true;
  }

  /**
   * 取消訂閱交易對
   */
  async unsubscribe(symbols: string[]): Promise<void> {
    if (!this.isConnected || !this.ws) {
      throw new Error('Not connected');
    }

    const streams = symbols.map(
      (symbol) => `${symbol.toLowerCase()}@markPrice@${this.config.updateSpeed}`
    );

    const unsubscribeMessage = {
      method: 'UNSUBSCRIBE',
      params: streams,
      id: Date.now(),
    };

    logger.info({
      service: 'BinanceFundingWs',
      symbols,
    }, 'Unsubscribing from Binance funding rate streams');

    this.ws.send(JSON.stringify(unsubscribeMessage));

    symbols.forEach((symbol) => this.subscribedSymbols.delete(symbol.toUpperCase()));
  }

  /**
   * 取消訂閱所有交易對
   */
  async unsubscribeAll(): Promise<void> {
    if (!this.isConnected || !this.ws) {
      throw new Error('Not connected');
    }

    if (this.subscribeAllSymbols) {
      const stream = `!markPrice@arr@${this.config.updateSpeed}`;
      const unsubscribeMessage = {
        method: 'UNSUBSCRIBE',
        params: [stream],
        id: Date.now(),
      };
      this.ws.send(JSON.stringify(unsubscribeMessage));
      this.subscribeAllSymbols = false;
    } else {
      const symbols = Array.from(this.subscribedSymbols);
      if (symbols.length > 0) {
        await this.unsubscribe(symbols);
      }
    }

    this.subscribedSymbols.clear();
  }

  /**
   * 處理接收到的訊息
   */
  private handleMessage(data: Buffer): void {
    try {
      const message = JSON.parse(data.toString());

      // T021: 更新訊息統計
      this.messageCount++;
      this.lastMessageTime = new Date();

      // 更新健康檢查
      if (this.config.enableHealthCheck) {
        this.healthChecker.recordMessage();
      }

      // 處理訂閱回應
      if (message.result === null && message.id) {
        logger.debug({
          service: 'BinanceFundingWs',
          id: message.id,
        }, 'Subscription confirmed');
        return;
      }

      // 處理批量 markPrice 數據 (!markPrice@arr)
      if (Array.isArray(message)) {
        const fundingRates: FundingRateReceived[] = [];
        for (const item of message) {
          const parsed = this.parseMarkPriceUpdate(item);
          if (parsed) {
            fundingRates.push(parsed);
          }
        }
        if (fundingRates.length > 0) {
          this.emit('fundingRateBatch', fundingRates);
          // 也逐一發送單筆事件
          for (const rate of fundingRates) {
            this.emit('fundingRate', rate);
          }
        }
        return;
      }

      // 處理單一 markPrice 數據
      if (message.data && message.data.e === 'markPriceUpdate') {
        const parsed = this.parseMarkPriceUpdate(message.data);
        if (parsed) {
          this.emit('fundingRate', parsed);
        }
      }

      // 直接是 markPriceUpdate 事件（非 wrapped）
      if (message.e === 'markPriceUpdate') {
        const parsed = this.parseMarkPriceUpdate(message);
        if (parsed) {
          this.emit('fundingRate', parsed);
        }
      }
    } catch (error) {
      logger.error({
        service: 'BinanceFundingWs',
        error: error instanceof Error ? error.message : String(error),
      }, 'Failed to parse Binance WebSocket message');
    }
  }

  /**
   * 解析 markPriceUpdate 訊息
   */
  private parseMarkPriceUpdate(data: unknown): FundingRateReceived | null {
    const result = parseBinanceMarkPriceUpdate(data);
    if (!result.success) {
      logger.warn({
        service: 'BinanceFundingWs',
        error: result.error.message,
      }, 'Invalid markPriceUpdate message');
      return null;
    }

    const msg = result.data;

    return {
      exchange: 'binance',
      symbol: msg.s,
      fundingRate: new Decimal(msg.r),
      nextFundingTime: new Date(msg.T),
      markPrice: new Decimal(msg.p),
      indexPrice: new Decimal(msg.i),
      source: 'websocket',
      receivedAt: new Date(),
    };
  }

  /**
   * 排程重連
   */
  private scheduleReconnect(): void {
    const delay = this.reconnectionManager.scheduleReconnect(() => {
      this.reconnect();
    });

    const state = this.reconnectionManager.getState();
    logger.info({
      service: 'BinanceFundingWs',
      delay,
      retryCount: state.retryCount,
    }, 'Scheduled Binance Funding WebSocket reconnect');

    this.emit('reconnecting', state.retryCount);
  }

  /**
   * 嘗試重新連接 (公開方法供外部調用)
   * @returns 是否重連成功
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
   * 重連 (內部方法)
   */
  private async reconnect(): Promise<void> {
    logger.info({ service: 'BinanceFundingWs' }, 'Reconnecting to Binance Funding WebSocket');

    // 先斷開現有連接
    if (this.ws) {
      this.ws.removeAllListeners();
      // 加入臨時錯誤處理器，避免非同步錯誤成為 uncaught exception
      this.ws.on('error', () => {});
      // 安全終止連接：直接使用 terminate() 強制關閉
      try {
        this.ws.terminate();
      } catch {
        // 忽略終止時的錯誤
        logger.debug({ service: 'BinanceFundingWs' }, 'Ignored error during WebSocket cleanup');
      }
      this.ws = null;
      this.isConnected = false;
    }

    try {
      await this.connect();

      // 重新訂閱
      if (this.subscribeAllSymbols) {
        await this.subscribeAll();
        logger.info({ service: 'BinanceFundingWs' }, 'Resubscribed to all symbols');
        this.emit('resubscribed', -1); // -1 表示全部
      } else if (this.subscribedSymbols.size > 0) {
        const symbols = Array.from(this.subscribedSymbols);
        await this.subscribe(symbols);
        logger.info({
          service: 'BinanceFundingWs',
          count: symbols.length,
        }, 'Resubscribed to symbols');
        this.emit('resubscribed', symbols.length);
      }
    } catch (error) {
      logger.error({
        service: 'BinanceFundingWs',
        error: error instanceof Error ? error.message : String(error),
      }, 'Reconnection failed');

      if (this.config.autoReconnect && !this.isDestroyed) {
        this.scheduleReconnect();
      }
    }
  }

  /**
   * 斷開連接
   */
  async disconnect(): Promise<void> {
    // T021: 記錄斷線前的統計資訊
    const stats = this.getStats();
    logger.info({
      service: 'BinanceFundingWs',
      ...stats,
      messagesPerSecond: stats.connectionUptime > 0
        ? (stats.messageCount / stats.connectionUptime).toFixed(2)
        : 0,
    }, 'Disconnecting from Binance Funding WebSocket');

    this.config.autoReconnect = false;
    this.healthChecker.stop();
    this.reconnectionManager.clearTimer();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
    this.connectionStartTime = null;
  }

  /**
   * 銷毀客戶端
   */
  destroy(): void {
    this.isDestroyed = true;
    this.disconnect();
    this.reconnectionManager.destroy();
    this.healthChecker.destroy();
    this.removeAllListeners();
    logger.debug({ service: 'BinanceFundingWs' }, 'BinanceFundingWs destroyed');
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
   * 檢查是否訂閱了所有交易對
   */
  isSubscribedToAll(): boolean {
    return this.subscribeAllSymbols;
  }

  /**
   * 取得連線統計資訊 (T021: 結構化日誌)
   */
  getStats(): {
    messageCount: number;
    lastMessageTime: Date | null;
    connectionUptime: number;
    subscribedSymbolCount: number;
    isConnected: boolean;
  } {
    const now = Date.now();
    const connectionUptime = this.connectionStartTime
      ? Math.floor((now - this.connectionStartTime.getTime()) / 1000)
      : 0;

    return {
      messageCount: this.messageCount,
      lastMessageTime: this.lastMessageTime,
      connectionUptime,
      subscribedSymbolCount: this.subscribedSymbols.size,
      isConnected: this.isConnected,
    };
  }

  /**
   * 記錄連線統計日誌 (T021: 結構化日誌)
   */
  logStats(): void {
    const stats = this.getStats();
    logger.info({
      service: 'BinanceFundingWs',
      ...stats,
      messagesPerSecond: stats.connectionUptime > 0
        ? (stats.messageCount / stats.connectionUptime).toFixed(2)
        : 0,
    }, 'WebSocket connection stats');
  }
}
