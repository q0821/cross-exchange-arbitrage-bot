/**
 * BingxUserDataWs
 * Feature: 052-specify-scripts-bash
 * Task: T043
 *
 * BingX 用戶數據 WebSocket 客戶端
 * - 連接私有頻道接收帳戶和訂單更新
 * - 使用 HMAC-SHA256 簽名認證
 * - 自動重連和心跳維持
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';
import WebSocket from 'ws';
import Decimal from 'decimal.js';
import { logger } from '../../lib/logger.js';
import type { ExchangeName } from '../../connectors/types.js';
import type {
  PositionChanged,
  BalanceChanged,
  OrderStatusChanged,
  OrderStatus,
} from '../../types/internal-events.js';
import type { ExchangeWsAdapter } from './PrivateWsManager.js';

// ==================== 類型定義 ====================

/**
 * BingX WebSocket 訊息類型
 */
interface BingxWsMessage {
  e?: string;        // 事件類型
  E?: number;        // 事件時間
  s?: string;        // 交易對
  data?: unknown;    // 數據
  code?: number;     // 錯誤碼
  msg?: string;      // 錯誤訊息
}

/**
 * BingX 帳戶更新事件
 */
interface BingxAccountUpdate {
  e: 'ACCOUNT_UPDATE';
  E: number;
  T: number;
  a: {
    B: Array<{
      a: string;   // 資產
      cw: string;  // 跨倉餘額
      bc: string;  // 餘額變動
    }>;
    P: Array<{
      s: string;   // 交易對
      pa: string;  // 持倉數量
      ep: string;  // 入場價格
      up: string;  // 未實現盈虧
      mt: string;  // 保證金類型
      iw: string;  // 隔離錢包
      ps: string;  // 持倉方向 (LONG/SHORT)
    }>;
    m: string;     // 事件原因
  };
}

/**
 * BingX 訂單更新事件
 */
interface BingxOrderUpdate {
  e: 'ORDER_TRADE_UPDATE';
  E: number;
  T: number;
  o: {
    s: string;   // 交易對
    c: string;   // 客戶端訂單ID
    S: string;   // 買賣方向 (BUY/SELL)
    o: string;   // 訂單類型
    f: string;   // 有效方式
    q: string;   // 原始數量
    p: string;   // 原始價格
    ap: string;  // 平均成交價
    sp: string;  // 止損價
    x: string;   // 執行類型
    X: string;   // 訂單狀態
    i: number;   // 訂單ID
    l: string;   // 最後成交數量
    z: string;   // 累計成交數量
    L: string;   // 最後成交價格
    N: string;   // 手續費幣種
    n: string;   // 手續費
    T: number;   // 成交時間
    t: number;   // 成交ID
    rp: string;  // 實現盈虧
    ps: string;  // 持倉方向
  };
}

/**
 * BingxUserDataWs 選項
 */
export interface BingxUserDataWsOptions {
  /** WebSocket URL */
  wsUrl?: string;
  /** 心跳間隔 (毫秒) */
  pingIntervalMs?: number;
  /** 連線超時 (毫秒) */
  connectTimeoutMs?: number;
  /** 自動重連 */
  autoReconnect?: boolean;
  /** 最大重連次數 */
  maxReconnectAttempts?: number;
}

// ==================== BingxUserDataWs 類別 ====================

/**
 * BingxUserDataWs
 *
 * BingX 用戶數據 WebSocket 客戶端
 */
export class BingxUserDataWs extends EventEmitter implements ExchangeWsAdapter {
  readonly exchange: ExchangeName = 'bingx';

  private ws: WebSocket | null = null;
  private apiKey: string = '';
  private apiSecret: string = '';
  private isDestroyedFlag = false;
  private connectionActive = false;
  private pingInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private options: Required<BingxUserDataWsOptions>;

  constructor(options?: BingxUserDataWsOptions) {
    super();
    this.options = {
      wsUrl: options?.wsUrl ?? 'wss://open-api-swap.bingx.com/swap-market',
      pingIntervalMs: options?.pingIntervalMs ?? 30000, // 30 秒
      connectTimeoutMs: options?.connectTimeoutMs ?? 10000,
      autoReconnect: options?.autoReconnect ?? true,
      maxReconnectAttempts: options?.maxReconnectAttempts ?? 10,
    };
  }

  /**
   * 連接到 BingX 私有 WebSocket
   */
  async connect(apiKey: string, apiSecret: string): Promise<void> {
    if (this.isDestroyedFlag) {
      throw new Error('BingxUserDataWs has been destroyed');
    }

    if (this.connectionActive && this.ws) {
      logger.warn('BingxUserDataWs already connected');
      return;
    }

    this.apiKey = apiKey;
    this.apiSecret = apiSecret;

    await this.createConnection();
  }

  /**
   * 創建 WebSocket 連接
   */
  private async createConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('BingX WebSocket connection timeout'));
      }, this.options.connectTimeoutMs);

      try {
        // BingX 需要在 URL 中加入簽名參數
        const timestamp = Date.now();
        const signature = this.generateSignature(timestamp);
        const wsUrl = `${this.options.wsUrl}?apiKey=${this.apiKey}&timestamp=${timestamp}&signature=${signature}`;

        this.ws = new WebSocket(wsUrl);

        this.ws.on('open', () => {
          clearTimeout(timeout);
          this.connectionActive = true;
          this.reconnectAttempts = 0;
          this.startHeartbeat();

          logger.info('BingX User Data WebSocket connected');
          this.emit('connected');

          // 訂閱帳戶更新
          this.subscribeAccountUpdates();

          resolve();
        });

        this.ws.on('message', (data: Buffer) => {
          this.handleMessage(data);
        });

        this.ws.on('error', (error: Error) => {
          logger.error({ error: error.message }, 'BingX WebSocket error');
          this.emit('error', error);
        });

        this.ws.on('close', (code: number, reason: Buffer) => {
          clearTimeout(timeout);
          this.connectionActive = false;
          this.stopHeartbeat();

          logger.info({ code, reason: reason.toString() }, 'BingX WebSocket closed');
          this.emit('disconnected');

          // 自動重連
          if (!this.isDestroyedFlag && this.options.autoReconnect) {
            this.attemptReconnect();
          }
        });

        this.ws.on('pong', () => {
          logger.debug('BingX WebSocket pong received');
        });

      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  /**
   * 生成簽名
   */
  private generateSignature(timestamp: number): string {
    const message = `timestamp=${timestamp}`;
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(message)
      .digest('hex');
  }

  /**
   * 訂閱帳戶更新
   */
  private subscribeAccountUpdates(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    // BingX 帳戶更新訂閱
    const subscribeMsg = {
      id: Date.now().toString(),
      reqType: 'sub',
      dataType: 'ACCOUNT_UPDATE',
    };

    this.ws.send(JSON.stringify(subscribeMsg));
    logger.debug('Subscribed to BingX ACCOUNT_UPDATE');

    // 訂閱訂單更新
    const orderSubscribeMsg = {
      id: Date.now().toString(),
      reqType: 'sub',
      dataType: 'ORDER_TRADE_UPDATE',
    };

    this.ws.send(JSON.stringify(orderSubscribeMsg));
    logger.debug('Subscribed to BingX ORDER_TRADE_UPDATE');
  }

  /**
   * 處理收到的訊息
   */
  private handleMessage(data: Buffer): void {
    try {
      const message = JSON.parse(data.toString()) as BingxWsMessage;

      // 處理不同類型的事件
      switch (message.e) {
        case 'ACCOUNT_UPDATE':
          this.handleAccountUpdate(message as unknown as BingxAccountUpdate);
          break;

        case 'ORDER_TRADE_UPDATE':
          this.handleOrderUpdate(message as unknown as BingxOrderUpdate);
          break;

        default:
          // 處理訂閱確認等其他訊息
          if (message.code !== undefined) {
            if (message.code !== 0) {
              logger.warn({ code: message.code, msg: message.msg }, 'BingX WebSocket error response');
            }
          }
          break;
      }
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to parse BingX WebSocket message'
      );
    }
  }

  /**
   * 處理帳戶更新事件
   */
  private handleAccountUpdate(event: BingxAccountUpdate): void {
    // 處理餘額變更
    for (const balance of event.a.B) {
      const balanceEvent: BalanceChanged = {
        exchange: 'bingx',
        asset: balance.a,
        walletBalance: new Decimal(balance.cw),
        balanceChange: new Decimal(balance.bc),
        source: 'websocket',
        receivedAt: new Date(),
      };

      this.emit('balanceChanged', balanceEvent);
    }

    // 處理持倉變更
    for (const pos of event.a.P) {
      const positionEvent: PositionChanged = {
        exchange: 'bingx',
        symbol: this.normalizeSymbol(pos.s),
        side: pos.ps === 'LONG' ? 'LONG' : 'SHORT',
        size: new Decimal(pos.pa).abs(),
        entryPrice: new Decimal(pos.ep),
        markPrice: new Decimal(0), // BingX 不在此事件中提供 mark price
        unrealizedPnl: new Decimal(pos.up),
        margin: new Decimal(pos.iw),
        source: 'websocket',
        receivedAt: new Date(),
      };

      this.emit('positionChanged', positionEvent);
    }

    logger.debug(
      {
        balances: event.a.B.length,
        positions: event.a.P.length,
        reason: event.a.m,
      },
      'BingX account update received'
    );
  }

  /**
   * 處理訂單更新事件
   */
  private handleOrderUpdate(event: BingxOrderUpdate): void {
    const order = event.o;

    const orderEvent: OrderStatusChanged = {
      exchange: 'bingx',
      symbol: this.normalizeSymbol(order.s),
      orderId: order.i.toString(),
      clientOrderId: order.c,
      orderType: order.o,
      status: this.mapOrderStatus(order.X),
      side: order.S === 'BUY' ? 'BUY' : 'SELL',
      positionSide: order.ps === 'LONG' ? 'LONG' : 'SHORT',
      filledQty: new Decimal(order.z),
      avgPrice: new Decimal(order.ap),
      stopPrice: order.sp ? new Decimal(order.sp) : undefined,
      realizedPnl: order.rp ? new Decimal(order.rp) : undefined,
      fee: order.n ? new Decimal(order.n) : undefined,
      feeCurrency: order.N || undefined,
      source: 'websocket',
      receivedAt: new Date(),
    };

    this.emit('orderStatusChanged', orderEvent);

    logger.debug(
      {
        orderId: order.i,
        symbol: order.s,
        status: order.X,
        type: order.o,
      },
      'BingX order update received'
    );
  }

  /**
   * 映射訂單狀態
   */
  private mapOrderStatus(status: string): OrderStatus {
    switch (status.toUpperCase()) {
      case 'NEW':
        return 'NEW';
      case 'FILLED':
        return 'FILLED';
      case 'PARTIALLY_FILLED':
        return 'PARTIALLY_FILLED';
      case 'CANCELED':
        return 'CANCELED';
      case 'EXPIRED':
        return 'EXPIRED';
      case 'REJECTED':
        return 'REJECTED';
      default:
        return 'NEW';
    }
  }

  /**
   * 正規化交易對符號
   * BTC-USDT -> BTCUSDT
   */
  private normalizeSymbol(symbol: string): string {
    return symbol.replace(/-/g, '');
  }

  /**
   * 啟動心跳
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
        logger.debug('BingX WebSocket ping sent');
      }
    }, this.options.pingIntervalMs);
  }

  /**
   * 停止心跳
   */
  private stopHeartbeat(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * 嘗試重連
   */
  private async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      logger.error(
        { attempts: this.reconnectAttempts },
        'BingX WebSocket max reconnect attempts reached'
      );
      this.emit('maxReconnectAttemptsReached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);

    logger.info(
      { attempt: this.reconnectAttempts, delay },
      'BingX WebSocket reconnecting...'
    );

    await new Promise((resolve) => setTimeout(resolve, delay));

    if (!this.isDestroyedFlag) {
      try {
        await this.createConnection();
      } catch (error) {
        logger.error(
          { error: error instanceof Error ? error.message : String(error) },
          'BingX WebSocket reconnect failed'
        );
      }
    }
  }

  /**
   * 斷開連接
   */
  async disconnect(): Promise<void> {
    this.stopHeartbeat();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.connectionActive = false;
    logger.info('BingX User Data WebSocket disconnected');
  }

  /**
   * 檢查是否已連接 (ExchangeWsAdapter 介面方法)
   */
  isConnected(): boolean {
    return this.connectionActive && this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * 取得交易所名稱 (ExchangeWsAdapter 介面方法)
   */
  getExchangeName(): ExchangeName {
    return this.exchange;
  }

  /**
   * 銷毀客戶端
   */
  destroy(): void {
    this.isDestroyedFlag = true;
    this.disconnect();
    this.removeAllListeners();
    logger.debug('BingxUserDataWs destroyed');
  }
}

export default BingxUserDataWs;
