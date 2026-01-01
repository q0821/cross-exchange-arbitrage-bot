/**
 * BinanceWsClient
 *
 * Binance WebSocket 客戶端 - 訂閱即時價格
 * Feature: 004-fix-okx-add-price-display
 * Task: T026
 */

import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { ReconnectionManager } from '../../lib/websocket/ReconnectionManager';
import { HealthChecker } from '../../lib/websocket/HealthChecker';
import type { PriceData } from '../../types/service-interfaces';
import { logger } from '../../lib/logger';

/**
 * Binance WebSocket 配置
 */
export interface BinanceWsConfig {
  /** WebSocket URL（預設使用 Combined Streams）*/
  wsUrl?: string;
  /** 是否自動重連 */
  autoReconnect?: boolean;
  /** 是否啟用健康檢查 */
  enableHealthCheck?: boolean;
}

/**
 * Binance Ticker 訊息格式
 */
interface BinanceTickerMessage {
  e: string; // Event type
  E: number; // Event time
  s: string; // Symbol
  c: string; // Close price (last price)
  b: string; // Best bid price
  a: string; // Best ask price
  v: string; // Total traded base asset volume
}

/**
 * BinanceWsClient 事件
 */
export interface BinanceWsClientEvents {
  'ticker': (priceData: PriceData) => void;
  'connected': () => void;
  'disconnected': () => void;
  'error': (error: Error) => void;
}

/**
 * BinanceWsClient
 *
 * 連接到 Binance Combined Streams 並訂閱 ticker 數據：
 * - 使用 @ticker stream 獲取最新價格
 * - 自動重連機制（指數退避）
 * - 健康檢查（60 秒無訊息觸發重連）
 * - 自動處理 ping/pong 心跳
 */
export class BinanceWsClient extends EventEmitter {
  private config: Required<BinanceWsConfig>;
  private ws: WebSocket | null = null;
  private reconnectionManager: ReconnectionManager;
  private healthChecker: HealthChecker;
  private subscribedSymbols: Set<string> = new Set();
  private isConnected = false;
  private isDestroyed = false;

  constructor(config: BinanceWsConfig = {}) {
    super();

    this.config = {
      wsUrl: config.wsUrl ?? 'wss://fstream.binance.com/stream',
      autoReconnect: config.autoReconnect ?? true,
      enableHealthCheck: config.enableHealthCheck ?? true,
    };

    // 初始化重連管理器
    this.reconnectionManager = new ReconnectionManager({
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      maxRetries: 0, // 無限重試
    });

    // 初始化健康檢查器
    this.healthChecker = new HealthChecker({
      timeoutMs: 60000, // 60 秒無訊息視為不健康
      onUnhealthy: () => {
        if (this.config.enableHealthCheck && this.config.autoReconnect) {
          logger.warn('Binance WebSocket unhealthy, triggering reconnect');
          this.reconnect();
        }
      },
    });

    logger.debug({
      wsUrl: this.config.wsUrl,
    }, 'BinanceWsClient initialized');
  }

  /**
   * 連接到 Binance WebSocket
   */
  async connect(): Promise<void> {
    if (this.isDestroyed) {
      throw new Error('Client has been destroyed');
    }

    if (this.isConnected || this.ws) {
      logger.warn('Already connected or connecting');
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        logger.info({
          url: this.config.wsUrl,
        }, 'Connecting to Binance WebSocket');

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
          this.reconnectionManager.reset();

          logger.info('Binance WebSocket connected');
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
          // Binance 伺服器會自動發送 ping，ws 庫自動回覆 pong
          logger.debug('Received ping from Binance');
        });

        this.ws.on('error', (error: Error) => {
          logger.error({
            error: error.message,
          }, 'Binance WebSocket error');
          this.emit('error', error);
        });

        this.ws.on('close', () => {
          logger.info('Binance WebSocket closed');
          this.isConnected = false;
          this.emit('disconnected');

          // 停止健康檢查
          this.healthChecker.stop();

          // 自動重連
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
   * 訂閱交易對 ticker
   */
  async subscribe(symbols: string[]): Promise<void> {
    if (!this.isConnected || !this.ws) {
      throw new Error('Not connected');
    }

    // 轉換符號格式：BTCUSDT -> btcusdt@ticker
    const streams = symbols.map((symbol) => `${symbol.toLowerCase()}@ticker`);

    const subscribeMessage = {
      method: 'SUBSCRIBE',
      params: streams,
      id: Date.now(),
    };

    logger.info({
      symbols,
    }, 'Subscribing to Binance ticker streams');

    this.ws.send(JSON.stringify(subscribeMessage));

    // 記錄已訂閱的交易對
    symbols.forEach((symbol) => this.subscribedSymbols.add(symbol));
  }

  /**
   * 取消訂閱交易對
   */
  async unsubscribe(symbols: string[]): Promise<void> {
    if (!this.isConnected || !this.ws) {
      throw new Error('Not connected');
    }

    const streams = symbols.map((symbol) => `${symbol.toLowerCase()}@ticker`);

    const unsubscribeMessage = {
      method: 'UNSUBSCRIBE',
      params: streams,
      id: Date.now(),
    };

    logger.info({
      symbols,
    }, 'Unsubscribing from Binance ticker streams');

    this.ws.send(JSON.stringify(unsubscribeMessage));

    symbols.forEach((symbol) => this.subscribedSymbols.delete(symbol));
  }

  /**
   * 處理接收到的訊息
   */
  private handleMessage(data: Buffer): void {
    try {
      const message = JSON.parse(data.toString());

      // 更新健康檢查
      if (this.config.enableHealthCheck) {
        this.healthChecker.recordMessage();
      }

      // 處理訂閱回應
      if (message.result === null && message.id) {
        logger.debug({
          id: message.id,
        }, 'Subscription confirmed');
        return;
      }

      // 處理 ticker 數據
      if (message.data && message.data.e === '24hrTicker') {
        const tickerData: BinanceTickerMessage = message.data;
        const priceData: PriceData = {
          id: `binance-${tickerData.s}-${Date.now()}`,
          timestamp: new Date(tickerData.E),
          symbol: tickerData.s,
          exchange: 'binance',
          lastPrice: parseFloat(tickerData.c),
          bidPrice: parseFloat(tickerData.b),
          askPrice: parseFloat(tickerData.a),
          volume24h: parseFloat(tickerData.v),
          source: 'websocket',
        };

        this.emit('ticker', priceData);
      }
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
      }, 'Failed to parse Binance WebSocket message');
    }
  }

  /**
   * 排程重連
   */
  private scheduleReconnect(): void {
    const delay = this.reconnectionManager.scheduleReconnect(() => {
      this.reconnect();
    });

    logger.info({
      delay,
      retryCount: this.reconnectionManager.getState().retryCount,
    }, 'Scheduled Binance WebSocket reconnect');
  }

  /**
   * 重連
   */
  private async reconnect(): Promise<void> {
    logger.info('Reconnecting to Binance WebSocket');

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
      }
      this.ws = null;
      this.isConnected = false;
    }

    try {
      await this.connect();

      // 重新訂閱之前的交易對
      if (this.subscribedSymbols.size > 0) {
        const symbols = Array.from(this.subscribedSymbols);
        await this.subscribe(symbols);
      }
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
      }, 'Reconnection failed');

      // 如果重連失敗，繼續排程下一次重連
      if (this.config.autoReconnect && !this.isDestroyed) {
        this.scheduleReconnect();
      }
    }
  }

  /**
   * 斷開連接
   */
  async disconnect(): Promise<void> {
    logger.info('Disconnecting from Binance WebSocket');

    this.config.autoReconnect = false; // 停止自動重連
    this.healthChecker.stop();
    this.reconnectionManager.clearTimer();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
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
    logger.debug('BinanceWsClient destroyed');
  }

  /**
   * 取得連接狀態
   */
  getConnectionStatus(): boolean {
    return this.isConnected;
  }
}
