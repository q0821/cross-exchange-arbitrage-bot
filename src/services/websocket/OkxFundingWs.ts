/**
 * OkxFundingWs
 *
 * OKX WebSocket 客戶端 - 訂閱即時資金費率和標記價格
 * Feature: 054-native-websocket-clients
 * Task: T016
 *
 * WebSocket URL: wss://ws.okx.com:8443/ws/v5/public
 * 頻道：
 * - funding-rate: 資金費率推送
 * - mark-price: 標記價格推送
 *
 * Symbol 轉換：BTCUSDT → BTC-USDT-SWAP
 * 連線限制：每連線最多 100 個訂閱頻道
 */

import crypto from 'crypto';
import Decimal from 'decimal.js';
import { BaseExchangeWs, type BaseExchangeWsConfig } from './BaseExchangeWs';
import {
  parseOkxFundingRateEvent,
  parseOkxMarkPriceEvent,
  parseOkxOrderEvent,
} from '@/lib/schemas/websocket-messages';
import { toOkxSymbol, fromOkxSymbol } from '@/lib/symbol-converter';
import { logger } from '@/lib/logger';
import type { ExchangeName } from '@/connectors/types';
import type { FundingRateReceived, OrderStatusChanged } from '@/types/websocket-events';

// =============================================================================
// 1. 類型定義
// =============================================================================

/** OKX API 憑證 */
export interface OkxCredentials {
  apiKey: string;
  secretKey: string;
  passphrase: string;
}

/** OKX WebSocket 配置 */
export interface OkxFundingWsConfig extends BaseExchangeWsConfig {
  /** WebSocket URL (public) */
  wsUrl?: string;
  /** Private WebSocket URL */
  privateWsUrl?: string;
  /** 訂閱頻道類型：funding-rate, mark-price, both */
  channelType?: 'funding-rate' | 'mark-price' | 'both';
  /** API 憑證（私有頻道需要） */
  credentials?: OkxCredentials;
}

/** OKX 訂閱參數 */
interface OkxSubscriptionArg {
  channel: 'funding-rate' | 'mark-price' | 'orders';
  instId?: string;
  instType?: 'SWAP';
}

/** OKX 訂閱請求 */
interface OkxSubscribeRequest {
  op: 'subscribe' | 'unsubscribe';
  args: OkxSubscriptionArg[];
}

/** OKX 登入請求 */
interface OkxLoginRequest {
  op: 'login';
  args: Array<{
    apiKey: string;
    passphrase: string;
    timestamp: string;
    sign: string;
  }>;
}

// =============================================================================
// 2. OkxFundingWs 類別
// =============================================================================

/**
 * OkxFundingWs - OKX 資金費率 WebSocket 客戶端
 *
 * 功能：
 * - 訂閱 funding-rate 頻道獲取資金費率
 * - 訂閱 mark-price 頻道獲取標記價格
 * - 自動重連（指數退避）
 * - 健康檢查（60 秒無訊息觸發重連）
 * - 自動處理 ping/pong 心跳
 */
export class OkxFundingWs extends BaseExchangeWs {
  protected readonly exchangeName: ExchangeName = 'okx';
  private channelType: 'funding-rate' | 'mark-price' | 'both';
  private wsUrl: string;
  private privateWsUrl: string;
  private credentials?: OkxCredentials;

  // 暫存標記價格，用於與資金費率合併
  private markPriceCache: Map<string, Decimal> = new Map();

  /** 標記價格快取大小限制（防止記憶體無限增長） */
  private readonly MAX_MARK_PRICE_CACHE_SIZE = 500;

  // 私有頻道狀態
  private isPrivateAuthenticated = false;
  private pendingOrderSubscription = false;

  constructor(config: OkxFundingWsConfig = {}) {
    super(config);

    this.wsUrl = config.wsUrl ?? 'wss://ws.okx.com:8443/ws/v5/public';
    this.privateWsUrl = config.privateWsUrl ?? 'wss://ws.okx.com:8443/ws/v5/private';
    this.channelType = config.channelType ?? 'both';
    this.credentials = config.credentials;

    logger.debug(
      {
        service: this.getLogPrefix(),
        wsUrl: this.wsUrl,
        privateWsUrl: this.privateWsUrl,
        channelType: this.channelType,
        hasCredentials: !!this.credentials,
      },
      'OkxFundingWs initialized'
    );
  }

  // =============================================================================
  // 3. 抽象方法實作
  // =============================================================================

  protected getWsUrl(): string {
    return this.wsUrl;
  }

  protected buildSubscribeMessage(symbols: string[]): OkxSubscribeRequest {
    const args: OkxSubscriptionArg[] = [];

    for (const symbol of symbols) {
      const instId = toOkxSymbol(symbol);

      if (this.channelType === 'funding-rate' || this.channelType === 'both') {
        args.push({ channel: 'funding-rate', instId });
      }

      if (this.channelType === 'mark-price' || this.channelType === 'both') {
        args.push({ channel: 'mark-price', instId });
      }
    }

    return { op: 'subscribe', args };
  }

  protected buildUnsubscribeMessage(symbols: string[]): OkxSubscribeRequest {
    const args: OkxSubscriptionArg[] = [];

    for (const symbol of symbols) {
      const instId = toOkxSymbol(symbol);

      if (this.channelType === 'funding-rate' || this.channelType === 'both') {
        args.push({ channel: 'funding-rate', instId });
      }

      if (this.channelType === 'mark-price' || this.channelType === 'both') {
        args.push({ channel: 'mark-price', instId });
      }
    }

    return { op: 'unsubscribe', args };
  }

  protected handleMessage(data: Buffer | string): void {
    try {
      const message = typeof data === 'string' ? JSON.parse(data) : JSON.parse(data.toString());

      // 處理登入回應
      if (message.event === 'login') {
        this.handleLoginResponse(message);
        return;
      }

      // 處理訂閱回應
      if (message.event === 'subscribe' || message.event === 'unsubscribe') {
        logger.debug(
          { service: this.getLogPrefix(), event: message.event, arg: message.arg },
          'Subscription response received'
        );
        return;
      }

      // 處理錯誤回應
      if (message.event === 'error') {
        // 60018: 交易對不存在 - 降級為 debug（不是所有交易對都在 OKX 上市）
        const isSymbolNotFound = message.code === '60018' ||
          (message.msg && message.msg.includes("doesn't exist"));

        if (isSymbolNotFound) {
          logger.debug(
            {
              service: this.getLogPrefix(),
              code: message.code,
              msg: message.msg,
            },
            'OKX symbol not available (expected for some pairs)'
          );
        } else {
          logger.error(
            {
              service: this.getLogPrefix(),
              code: message.code,
              msg: message.msg,
            },
            'OKX WebSocket error response'
          );
        }
        this.emit('error', new Error(`OKX error ${message.code}: ${message.msg}`));
        return;
      }

      // 處理 funding-rate 事件
      if (message.arg?.channel === 'funding-rate') {
        this.handleFundingRateMessage(message);
        return;
      }

      // 處理 mark-price 事件
      if (message.arg?.channel === 'mark-price') {
        this.handleMarkPriceMessage(message);
        return;
      }

      // 處理 orders 事件（私有頻道）
      if (message.arg?.channel === 'orders') {
        this.handleOrderMessage(message);
        return;
      }

      // 未知訊息類型
      if (message.arg?.channel) {
        logger.debug(
          { service: this.getLogPrefix(), channel: message.arg.channel },
          'Unknown channel message'
        );
      }
    } catch (error) {
      logger.error(
        {
          service: this.getLogPrefix(),
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to parse OKX WebSocket message'
      );
    }
  }

  // =============================================================================
  // 4. 訊息處理
  // =============================================================================

  /**
   * 處理 funding-rate 訊息
   */
  private handleFundingRateMessage(message: unknown): void {
    const result = parseOkxFundingRateEvent(message);

    if (!result.success) {
      logger.warn(
        { service: this.getLogPrefix(), error: result.error.message },
        'Invalid funding-rate message'
      );
      return;
    }

    const { data } = result.data;

    for (const item of data) {
      const symbol = fromOkxSymbol(item.instId);
      const cachedMarkPrice = this.markPriceCache.get(symbol);

      const fundingRateReceived: FundingRateReceived = {
        exchange: 'okx',
        symbol,
        fundingRate: new Decimal(item.fundingRate),
        nextFundingTime: new Date(parseInt(item.nextFundingTime, 10)),
        nextFundingRate: item.nextFundingRate ? new Decimal(item.nextFundingRate) : undefined,
        markPrice: cachedMarkPrice,
        source: 'websocket',
        receivedAt: new Date(),
      };

      this.emit('fundingRate', fundingRateReceived);
    }
  }

  /**
   * 處理 mark-price 訊息
   */
  private handleMarkPriceMessage(message: unknown): void {
    const result = parseOkxMarkPriceEvent(message);

    if (!result.success) {
      logger.warn(
        { service: this.getLogPrefix(), error: result.error.message },
        'Invalid mark-price message'
      );
      return;
    }

    const { data } = result.data;

    for (const item of data) {
      const symbol = fromOkxSymbol(item.instId);
      const markPrice = new Decimal(item.markPx);

      // LRU 快取標記價格：刪除再插入確保順序
      this.markPriceCache.delete(symbol);
      this.markPriceCache.set(symbol, markPrice);

      // LRU 淘汰：超過限制時移除最舊的項目
      if (this.markPriceCache.size > this.MAX_MARK_PRICE_CACHE_SIZE) {
        const firstKey = this.markPriceCache.keys().next().value;
        if (firstKey) {
          this.markPriceCache.delete(firstKey);
        }
      }

      // 發送 markPrice 事件，讓訂閱者知道連線是活躍的
      // 這對於 DataSourceManager 的 stale 檢測很重要
      // 因為 funding-rate 推送頻率很低（每 8 小時結算前），但 mark-price 每秒推送
      this.emit('markPrice', { exchange: 'okx', symbol, markPrice });
    }
  }

  /**
   * 處理登入回應
   */
  private handleLoginResponse(message: { event: 'login'; code: string; msg: string }): void {
    if (message.code === '0') {
      this.isPrivateAuthenticated = true;
      logger.info({ service: this.getLogPrefix() }, 'OKX private channel authenticated');
      this.emit('authenticated');

      // 如果有待處理的訂單訂閱，執行訂閱
      if (this.pendingOrderSubscription) {
        this.pendingOrderSubscription = false;
        this.doSubscribeOrders();
      }
    } else {
      this.isPrivateAuthenticated = false;
      logger.error(
        { service: this.getLogPrefix(), code: message.code, msg: message.msg },
        'OKX private channel authentication failed'
      );
      this.emit('authError', new Error(`Login failed: ${message.code} - ${message.msg}`));
    }
  }

  /**
   * 處理訂單更新訊息
   */
  private handleOrderMessage(message: unknown): void {
    const result = parseOkxOrderEvent(message);

    if (!result.success) {
      logger.warn(
        { service: this.getLogPrefix(), error: result.error.message },
        'Invalid order message'
      );
      return;
    }

    const { data } = result.data;

    for (const order of data) {
      const symbol = fromOkxSymbol(order.instId);

      // 映射 OKX 狀態到通用狀態
      let status: OrderStatusChanged['status'];
      switch (order.state) {
        case 'live':
          status = 'NEW';
          break;
        case 'partially_filled':
          status = 'PARTIALLY_FILLED';
          break;
        case 'filled':
          status = 'FILLED';
          break;
        case 'canceled':
          status = 'CANCELED';
          break;
        default:
          status = 'NEW';
      }

      // 映射訂單類型
      let orderType: OrderStatusChanged['orderType'] = 'MARKET';
      if (order.ordType === 'limit') {
        orderType = 'LIMIT';
      } else if (order.ordType === 'trigger' || order.ordType === 'stop_loss' || order.ordType === 'take_profit') {
        orderType = 'STOP_MARKET';
      }

      // OKX posSide 'net' 表示淨倉模式，需要根據 side 推斷持倉方向
      let positionSide: 'LONG' | 'SHORT' = 'LONG';
      if (order.posSide === 'long') {
        positionSide = 'LONG';
      } else if (order.posSide === 'short') {
        positionSide = 'SHORT';
      } else {
        // net 模式下根據 side 推斷
        positionSide = order.side === 'buy' ? 'LONG' : 'SHORT';
      }

      const orderStatusChanged: OrderStatusChanged = {
        exchange: 'okx',
        symbol,
        orderId: order.ordId,
        clientOrderId: order.clOrdId || undefined,
        status,
        side: order.side === 'buy' ? 'BUY' : 'SELL',
        positionSide,
        orderType,
        price: order.px ? new Decimal(order.px) : undefined,
        avgPrice: order.fillPx ? new Decimal(order.fillPx) : new Decimal(0),
        quantity: new Decimal(order.sz),
        filledQuantity: order.fillSz ? new Decimal(order.fillSz) : new Decimal(0),
        reduceOnly: false, // OKX WebSocket 不提供此欄位
        updateTime: new Date(parseInt(order.uTime, 10)),
        source: 'websocket',
        receivedAt: new Date(),
      };

      this.emit('orderUpdate', orderStatusChanged);

      logger.debug(
        {
          service: this.getLogPrefix(),
          symbol,
          orderId: order.ordId,
          status,
          side: order.side,
        },
        'Order update received'
      );
    }
  }

  // =============================================================================
  // 5. 私有頻道認證
  // =============================================================================

  /**
   * 生成 OKX 登入簽名
   * 簽名格式: HMAC-SHA256(timestamp + 'GET' + '/users/self/verify')
   */
  private generateLoginSignature(timestamp: string, secretKey: string): string {
    const signatureString = `${timestamp}GET/users/self/verify`;
    return crypto.createHmac('sha256', secretKey).update(signatureString).digest('base64');
  }

  /**
   * 建立登入訊息
   */
  private buildLoginMessage(): OkxLoginRequest | null {
    if (!this.credentials) {
      logger.warn({ service: this.getLogPrefix() }, 'Cannot login: no credentials provided');
      return null;
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const sign = this.generateLoginSignature(timestamp, this.credentials.secretKey);

    return {
      op: 'login',
      args: [
        {
          apiKey: this.credentials.apiKey,
          passphrase: this.credentials.passphrase,
          timestamp,
          sign,
        },
      ],
    };
  }

  /**
   * 執行登入認證
   * 需要在私有頻道訂閱前調用
   */
  login(): boolean {
    const loginMessage = this.buildLoginMessage();
    if (!loginMessage) {
      return false;
    }

    if (!this.ws || this.ws.readyState !== 1) {
      logger.warn({ service: this.getLogPrefix() }, 'Cannot login: WebSocket not connected');
      return false;
    }

    this.ws.send(JSON.stringify(loginMessage));
    logger.debug({ service: this.getLogPrefix() }, 'Login message sent');
    return true;
  }

  /**
   * 訂閱訂單更新頻道
   * 如果尚未認證，會先登入再訂閱
   */
  subscribeOrders(): void {
    if (!this.credentials) {
      logger.warn({ service: this.getLogPrefix() }, 'Cannot subscribe orders: no credentials');
      return;
    }

    if (!this.isPrivateAuthenticated) {
      // 尚未認證，先登入
      this.pendingOrderSubscription = true;
      this.login();
      return;
    }

    this.doSubscribeOrders();
  }

  /**
   * 實際執行訂單訂閱
   */
  private doSubscribeOrders(): void {
    if (!this.ws || this.ws.readyState !== 1) {
      logger.warn({ service: this.getLogPrefix() }, 'Cannot subscribe orders: WebSocket not connected');
      return;
    }

    const subscribeMessage = {
      op: 'subscribe',
      args: [
        {
          channel: 'orders',
          instType: 'SWAP',
        },
      ],
    };

    this.ws.send(JSON.stringify(subscribeMessage));
    logger.info({ service: this.getLogPrefix() }, 'Subscribed to orders channel');
  }

  /**
   * 取消訂閱訂單更新頻道
   */
  unsubscribeOrders(): void {
    if (!this.ws || this.ws.readyState !== 1) {
      return;
    }

    const unsubscribeMessage = {
      op: 'unsubscribe',
      args: [
        {
          channel: 'orders',
          instType: 'SWAP',
        },
      ],
    };

    this.ws.send(JSON.stringify(unsubscribeMessage));
    logger.info({ service: this.getLogPrefix() }, 'Unsubscribed from orders channel');
  }

  /**
   * 檢查是否已認證
   */
  isAuthenticated(): boolean {
    return this.isPrivateAuthenticated;
  }

  // =============================================================================
  // 6. 公開方法
  // =============================================================================

  /**
   * 取得快取的標記價格
   */
  getMarkPrice(symbol: string): Decimal | undefined {
    return this.markPriceCache.get(symbol.toUpperCase());
  }

  /**
   * 取得所有快取的標記價格
   */
  getAllMarkPrices(): Map<string, Decimal> {
    return new Map(this.markPriceCache);
  }

  /**
   * 清除標記價格快取
   */
  clearMarkPriceCache(): void {
    this.markPriceCache.clear();
  }

  /**
   * 取得標記價格快取統計資訊（用於監控）
   */
  getMarkPriceCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.markPriceCache.size,
      maxSize: this.MAX_MARK_PRICE_CACHE_SIZE,
    };
  }

  /**
   * 覆寫 destroy 以清理快取
   */
  override destroy(): void {
    this.markPriceCache.clear();
    super.destroy();
  }
}
