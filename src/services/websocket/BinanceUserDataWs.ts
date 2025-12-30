/**
 * BinanceUserDataWs
 * Feature: 052-specify-scripts-bash
 * Tasks: T038, T039, T040
 *
 * Binance Futures User Data Stream WebSocket 客戶端
 * - T038: 連接私有頻道
 * - T039: 解析 ACCOUNT_UPDATE 事件
 * - T040: 解析 ORDER_TRADE_UPDATE 事件
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import Decimal from 'decimal.js';
import { z } from 'zod';
import { logger } from '../../lib/logger';
import { BinanceListenKeyManager } from './BinanceListenKeyManager';
import { ReconnectionManager } from '../../lib/websocket/ReconnectionManager';
import { HealthChecker } from '../../lib/websocket/HealthChecker';
import type { ExchangeWsAdapter } from './PrivateWsManager';
import type {
  PositionChanged,
  BalanceChanged,
  OrderStatusChanged,
  OrderStatus,
  BalanceChangeReason,
} from '../../types/internal-events';

// ==================== Zod Schemas ====================

/**
 * ACCOUNT_UPDATE 事件 Schema
 */
const AccountUpdateSchema = z.object({
  e: z.literal('ACCOUNT_UPDATE'),
  E: z.number(), // Event time
  T: z.number(), // Transaction time
  a: z.object({
    m: z.string(), // Event reason
    B: z.array(
      z.object({
        a: z.string(), // Asset
        wb: z.string(), // Wallet balance
        cw: z.string(), // Cross wallet balance
        bc: z.string(), // Balance change
      })
    ),
    P: z.array(
      z.object({
        s: z.string(), // Symbol
        pa: z.string(), // Position amount
        ep: z.string(), // Entry price
        cr: z.string(), // Accumulated realized
        up: z.string(), // Unrealized PnL
        ps: z.enum(['LONG', 'SHORT', 'BOTH']),
        bep: z.string(), // Break-even price
      })
    ),
  }),
});

/**
 * ORDER_TRADE_UPDATE 事件 Schema
 */
const OrderTradeUpdateSchema = z.object({
  e: z.literal('ORDER_TRADE_UPDATE'),
  E: z.number(), // Event time
  T: z.number(), // Transaction time
  o: z.object({
    s: z.string(), // Symbol
    c: z.string(), // Client order ID
    S: z.enum(['BUY', 'SELL']),
    o: z.string(), // Order type
    x: z.string(), // Execution type
    X: z.string(), // Order status
    i: z.number(), // Order ID
    l: z.string(), // Last filled quantity
    z: z.string(), // Cumulative filled quantity
    L: z.string(), // Last filled price
    ap: z.string(), // Average price
    sp: z.string(), // Stop price
    ps: z.enum(['LONG', 'SHORT', 'BOTH']),
    rp: z.string(), // Realized profit
    n: z.string().optional(), // Commission
    N: z.string().optional(), // Commission asset
  }),
});

/**
 * listenKey 過期事件 Schema
 */
const ListenKeyExpiredSchema = z.object({
  e: z.literal('listenKeyExpired'),
  E: z.number(),
});

// Types inferred from Zod schemas (exported for external use)
export type AccountUpdateEvent = z.infer<typeof AccountUpdateSchema>;
export type OrderTradeUpdateEvent = z.infer<typeof OrderTradeUpdateSchema>;

// ==================== 類型定義 ====================

/**
 * BinanceUserDataWs 選項
 */
export interface BinanceUserDataWsOptions {
  /** 自動重連 */
  autoReconnect?: boolean;
  /** 健康檢查 */
  enableHealthCheck?: boolean;
  /** 心跳間隔 (毫秒) */
  heartbeatIntervalMs?: number;
  /** 心跳超時 (毫秒) */
  heartbeatTimeoutMs?: number;
  /** 測試網 */
  testnet?: boolean;
}

/**
 * Binance Futures WebSocket URL
 */
const WS_ENDPOINTS = {
  production: 'wss://fstream.binance.com/ws',
  testnet: 'wss://stream.binancefuture.com/ws',
};

// ==================== BinanceUserDataWs 類別 ====================

/**
 * BinanceUserDataWs
 *
 * Binance Futures User Data Stream WebSocket 客戶端
 */
export class BinanceUserDataWs extends EventEmitter implements ExchangeWsAdapter {
  private ws: WebSocket | null = null;
  private listenKeyManager: BinanceListenKeyManager | null = null;
  private reconnectionManager: ReconnectionManager;
  private healthChecker: HealthChecker;
  private options: Required<BinanceUserDataWsOptions>;

  private isConnectedState = false;
  private isDestroyed = false;
  private messageCount = 0;
  private lastMessageTime: Date | null = null;
  private connectionStartTime: Date | null = null;

  // API credentials (stored temporarily for reconnection)
  private apiKey: string | null = null;
  private apiSecret: string | null = null;

  constructor(options?: BinanceUserDataWsOptions) {
    super();

    this.options = {
      autoReconnect: options?.autoReconnect ?? true,
      enableHealthCheck: options?.enableHealthCheck ?? true,
      heartbeatIntervalMs: options?.heartbeatIntervalMs ?? 20000,
      heartbeatTimeoutMs: options?.heartbeatTimeoutMs ?? 60000,
      testnet: options?.testnet ?? false,
    };

    // 初始化重連管理器
    this.reconnectionManager = new ReconnectionManager({
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      maxRetries: 10,
      backoffFactor: 2,
    });

    // 初始化健康檢查器
    this.healthChecker = new HealthChecker({
      checkIntervalMs: this.options.heartbeatIntervalMs,
      timeoutMs: this.options.heartbeatTimeoutMs,
      onUnhealthy: () => this.handleUnhealthy(),
    });
  }

  /**
   * 連接到 Binance User Data Stream
   */
  async connect(apiKey: string, apiSecret: string): Promise<void> {
    if (this.isDestroyed) {
      throw new Error('BinanceUserDataWs has been destroyed');
    }

    if (this.isConnectedState) {
      logger.debug('Already connected to Binance User Data Stream');
      return;
    }

    // 儲存憑證供重連使用
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;

    // 建立 listenKey 管理器
    this.listenKeyManager = new BinanceListenKeyManager(
      {
        createListenKey: () => this.createListenKeyApi(apiKey, apiSecret),
        renewListenKey: (listenKey) => this.renewListenKeyApi(apiKey, apiSecret, listenKey),
        closeListenKey: (listenKey) => this.closeListenKeyApi(apiKey, apiSecret, listenKey),
      },
      {
        renewalIntervalMs: 30 * 60 * 1000, // 30 分鐘
      }
    );

    // 監聽 listenKey 事件
    this.setupListenKeyManagerEvents();

    // 建立 listenKey
    const listenKey = await this.listenKeyManager.create();

    // 連接 WebSocket
    await this.connectWebSocket(listenKey);
  }

  /**
   * 斷開連線
   */
  async disconnect(): Promise<void> {
    this.isConnectedState = false;
    this.healthChecker.stop();
    this.reconnectionManager.clearTimer();

    if (this.ws) {
      try {
        this.ws.close(1000, 'Normal closure');
      } catch (error) {
        logger.warn({ error }, 'Error closing WebSocket');
      }
      this.ws = null;
    }

    if (this.listenKeyManager) {
      await this.listenKeyManager.close();
      this.listenKeyManager.destroy();
      this.listenKeyManager = null;
    }

    this.apiKey = null;
    this.apiSecret = null;

    this.emit('disconnected');
    logger.info('Disconnected from Binance User Data Stream');
  }

  /**
   * 檢查是否已連接
   */
  isConnected(): boolean {
    return this.isConnectedState && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * 取得交易所名稱
   */
  getExchangeName(): 'binance' {
    return 'binance';
  }

  /**
   * 取得統計資訊
   */
  getStats(): {
    isConnected: boolean;
    messageCount: number;
    lastMessageTime: Date | null;
    uptime: number;
    listenKeyStats: ReturnType<BinanceListenKeyManager['getStats']> | null;
  } {
    return {
      isConnected: this.isConnected(),
      messageCount: this.messageCount,
      lastMessageTime: this.lastMessageTime,
      uptime: this.connectionStartTime ? Date.now() - this.connectionStartTime.getTime() : 0,
      listenKeyStats: this.listenKeyManager?.getStats() ?? null,
    };
  }

  /**
   * 銷毀客戶端
   */
  async destroy(): Promise<void> {
    this.isDestroyed = true;
    await this.disconnect();
    this.reconnectionManager.destroy();
    this.healthChecker.destroy();
    this.removeAllListeners();
    logger.debug('BinanceUserDataWs destroyed');
  }

  // ==================== 私有方法 - WebSocket 連線 ====================

  /**
   * 連接 WebSocket
   */
  private async connectWebSocket(listenKey: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const baseUrl = this.options.testnet ? WS_ENDPOINTS.testnet : WS_ENDPOINTS.production;
      const url = `${baseUrl}/${listenKey}`;

      logger.debug({ url: url.substring(0, 50) + '...' }, 'Connecting to Binance User Data Stream');

      this.ws = new WebSocket(url);

      this.ws.on('open', () => {
        this.isConnectedState = true;
        this.connectionStartTime = new Date();
        this.reconnectionManager.reset();

        if (this.options.enableHealthCheck) {
          this.healthChecker.start();
        }

        logger.info('Connected to Binance User Data Stream');
        this.emit('connected');
        resolve();
      });

      this.ws.on('message', (data) => {
        this.handleMessage(data);
      });

      this.ws.on('close', (code, reason) => {
        logger.info({ code, reason: reason.toString() }, 'WebSocket closed');
        this.handleDisconnect();
      });

      this.ws.on('error', (error) => {
        logger.error({ error }, 'WebSocket error');
        this.emit('error', error);
        if (!this.isConnectedState) {
          reject(error);
        }
      });

      this.ws.on('ping', () => {
        this.ws?.pong();
        this.healthChecker.recordMessage();
      });

      this.ws.on('pong', () => {
        this.healthChecker.recordMessage();
      });
    });
  }

  /**
   * 處理斷線
   */
  private handleDisconnect(): void {
    this.isConnectedState = false;
    this.healthChecker.stop();
    this.emit('disconnected');

    if (this.options.autoReconnect && !this.isDestroyed) {
      this.attemptReconnect();
    }
  }

  /**
   * 嘗試重連
   */
  private attemptReconnect(): void {
    if (!this.reconnectionManager.canRetry()) {
      logger.error('Max reconnection attempts reached');
      this.emit('reconnectFailed');
      return;
    }

    const delay = this.reconnectionManager.scheduleReconnect(async () => {
      const attempt = this.reconnectionManager.getState().retryCount;
      logger.info({ attempt }, 'Attempting to reconnect...');
      this.emit('reconnecting', attempt);

      try {
        if (this.apiKey && this.apiSecret) {
          // 重建 listenKey 並重連
          if (this.listenKeyManager) {
            const listenKey = await this.listenKeyManager.recreate();
            await this.connectWebSocket(listenKey);
          }
        }
      } catch (error) {
        logger.error({ error }, 'Reconnection attempt failed');
        this.attemptReconnect();
      }
    });

    logger.debug({ delay }, 'Reconnection scheduled');
  }

  /**
   * 處理健康檢查失敗
   */
  private handleUnhealthy(): void {
    logger.warn('WebSocket connection unhealthy, attempting reconnect');
    if (this.ws) {
      this.ws.close(1000, 'Health check failed');
    }
  }

  // ==================== 私有方法 - 訊息處理 ====================

  /**
   * 處理 WebSocket 訊息
   */
  private handleMessage(data: WebSocket.Data): void {
    this.messageCount++;
    this.lastMessageTime = new Date();
    this.healthChecker.recordMessage();

    try {
      const message = JSON.parse(data.toString());

      // 檢查事件類型
      switch (message.e) {
        case 'ACCOUNT_UPDATE':
          this.handleAccountUpdate(message);
          break;

        case 'ORDER_TRADE_UPDATE':
          this.handleOrderTradeUpdate(message);
          break;

        case 'listenKeyExpired':
          this.handleListenKeyExpired(message);
          break;

        default:
          logger.debug({ eventType: message.e }, 'Unknown event type');
      }
    } catch (error) {
      logger.error({ error, data: data.toString().substring(0, 200) }, 'Failed to parse message');
      this.emit('parseError', error);
    }
  }

  /**
   * T039: 處理 ACCOUNT_UPDATE 事件
   */
  private handleAccountUpdate(raw: unknown): void {
    const parseResult = AccountUpdateSchema.safeParse(raw);
    if (!parseResult.success) {
      logger.warn({ error: parseResult.error }, 'Invalid ACCOUNT_UPDATE format');
      return;
    }

    const event = parseResult.data;
    const eventTime = new Date(event.E);
    const reason = this.mapBalanceReason(event.a.m);

    // 解析餘額變更
    for (const balance of event.a.B) {
      const balanceEvent: BalanceChanged = {
        exchange: 'binance',
        asset: balance.a,
        walletBalance: new Decimal(balance.wb),
        crossWalletBalance: new Decimal(balance.cw),
        balanceChange: new Decimal(balance.bc),
        changeReason: reason,
        source: 'websocket',
        receivedAt: eventTime,
      };

      this.emit('balanceChanged', balanceEvent);
    }

    // 解析持倉變更
    for (const position of event.a.P) {
      // 跳過 BOTH 模式和零倉位
      if (position.ps === 'BOTH') continue;

      const size = new Decimal(position.pa).abs();

      const positionEvent: PositionChanged = {
        exchange: 'binance',
        symbol: position.s,
        side: position.ps as 'LONG' | 'SHORT',
        size,
        entryPrice: new Decimal(position.ep),
        markPrice: new Decimal(position.bep), // 使用 break-even price 作為近似
        unrealizedPnl: new Decimal(position.up),
        source: 'websocket',
        receivedAt: eventTime,
      };

      this.emit('positionChanged', positionEvent);
    }

    logger.debug(
      {
        reason: event.a.m,
        balanceCount: event.a.B.length,
        positionCount: event.a.P.length,
      },
      'ACCOUNT_UPDATE processed'
    );
  }

  /**
   * T040: 處理 ORDER_TRADE_UPDATE 事件
   */
  private handleOrderTradeUpdate(raw: unknown): void {
    const parseResult = OrderTradeUpdateSchema.safeParse(raw);
    if (!parseResult.success) {
      logger.warn({ error: parseResult.error }, 'Invalid ORDER_TRADE_UPDATE format');
      return;
    }

    const event = parseResult.data;
    const order = event.o;

    const orderEvent: OrderStatusChanged = {
      exchange: 'binance',
      symbol: order.s,
      orderId: String(order.i),
      clientOrderId: order.c,
      orderType: order.o,
      status: this.mapOrderStatus(order.X),
      side: order.S,
      positionSide: order.ps === 'BOTH' ? 'LONG' : order.ps,
      filledQty: new Decimal(order.z),
      avgPrice: new Decimal(order.ap),
      stopPrice: order.sp && order.sp !== '0' ? new Decimal(order.sp) : undefined,
      realizedPnl: order.rp ? new Decimal(order.rp) : undefined,
      fee: order.n ? new Decimal(order.n) : undefined,
      feeCurrency: order.N,
      source: 'websocket',
      receivedAt: new Date(event.E),
    };

    this.emit('orderStatusChanged', orderEvent);

    logger.debug(
      {
        symbol: order.s,
        orderId: order.i,
        status: order.X,
        type: order.o,
      },
      'ORDER_TRADE_UPDATE processed'
    );
  }

  /**
   * 處理 listenKey 過期
   */
  private handleListenKeyExpired(raw: unknown): void {
    const parseResult = ListenKeyExpiredSchema.safeParse(raw);
    if (!parseResult.success) {
      return;
    }

    logger.warn('listenKey expired, recreating...');
    this.emit('listenKeyExpired');

    // 重建 listenKey
    if (this.listenKeyManager) {
      this.listenKeyManager.recreate().catch((error) => {
        logger.error({ error }, 'Failed to recreate listenKey');
      });
    }
  }

  // ==================== 私有方法 - 輔助函式 ====================

  /**
   * 設定 listenKey 管理器事件
   */
  private setupListenKeyManagerEvents(): void {
    if (!this.listenKeyManager) return;

    this.listenKeyManager.on('renewed', (listenKey) => {
      logger.debug({ listenKey: listenKey.substring(0, 10) + '...' }, 'listenKey renewed');
    });

    this.listenKeyManager.on('renewalFailed', (error) => {
      logger.error({ error }, 'listenKey renewal failed');
    });

    this.listenKeyManager.on('recreated', () => {
      logger.info('listenKey recreated');
    });
  }

  /**
   * 映射餘額變更原因
   */
  private mapBalanceReason(reason: string): BalanceChangeReason {
    switch (reason) {
      case 'ORDER':
        return 'ORDER';
      case 'FUNDING_FEE':
        return 'FUNDING_FEE';
      case 'DEPOSIT':
        return 'DEPOSIT';
      case 'WITHDRAW':
        return 'WITHDRAW';
      case 'TRANSFER':
        return 'TRANSFER';
      default:
        return 'UNKNOWN';
    }
  }

  /**
   * 映射訂單狀態
   */
  private mapOrderStatus(status: string): OrderStatus {
    switch (status) {
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

  // ==================== 私有方法 - API 呼叫 ====================

  /**
   * 建立 listenKey API
   */
  private async createListenKeyApi(apiKey: string, apiSecret: string): Promise<{ listenKey: string }> {
    const { Futures } = await import('@binance/connector');
    const client = new Futures(apiKey, apiSecret, {
      baseURL: this.options.testnet ? 'https://testnet.binancefuture.com' : undefined,
    });

    const response = await client.createListenKey();
    return { listenKey: response.data.listenKey };
  }

  /**
   * 續期 listenKey API
   */
  private async renewListenKeyApi(_apiKey: string, _apiSecret: string, _listenKey: string): Promise<void> {
    const { Futures } = await import('@binance/connector');
    const client = new Futures(_apiKey, _apiSecret, {
      baseURL: this.options.testnet ? 'https://testnet.binancefuture.com' : undefined,
    });

    await client.renewListenKey();
  }

  /**
   * 關閉 listenKey API
   */
  private async closeListenKeyApi(_apiKey: string, _apiSecret: string, _listenKey: string): Promise<void> {
    const { Futures } = await import('@binance/connector');
    const client = new Futures(_apiKey, _apiSecret, {
      baseURL: this.options.testnet ? 'https://testnet.binancefuture.com' : undefined,
    });

    await client.closeListenKey();
  }
}

export default BinanceUserDataWs;
