/**
 * GateioFundingWs
 *
 * Gate.io WebSocket 客戶端 - 訂閱即時資金費率和標記價格
 * Feature: 054-native-websocket-clients
 * Task: T017
 *
 * WebSocket URL: wss://fx-ws.gateio.ws/v4/ws/usdt
 * 頻道：futures.tickers（包含資金費率、標記價格、指數價格）
 *
 * Symbol 轉換：BTCUSDT → BTC_USDT
 * 連線限制：每連線最多 20 個訂閱頻道
 */

import crypto from 'crypto';
import Decimal from 'decimal.js';
import { BaseExchangeWs, type BaseExchangeWsConfig } from './BaseExchangeWs';
import { parseGateioTickerEvent, parseGateioOrderEvent } from '@/lib/schemas/websocket-messages';
import { toGateioSymbol, fromGateioSymbol } from '@/lib/symbol-converter';
import { logger } from '@/lib/logger';
import type { ExchangeName } from '@/connectors/types';
import type { FundingRateReceived, OrderStatusChanged } from '@/types/websocket-events';

// =============================================================================
// 1. 類型定義
// =============================================================================

/** Gate.io API 憑證 */
export interface GateioCredentials {
  apiKey: string;
  secretKey: string;
}

/** Gate.io WebSocket 配置 */
export interface GateioFundingWsConfig extends BaseExchangeWsConfig {
  /** WebSocket URL */
  wsUrl?: string;
  /** API 憑證（私有頻道需要） */
  credentials?: GateioCredentials;
}

/** Gate.io 訂閱請求 */
interface GateioSubscribeRequest {
  time: number;
  channel: string;
  event: 'subscribe' | 'unsubscribe';
  payload: string[];
}

/** Gate.io 私有頻道訂閱請求（含認證） */
interface GateioAuthSubscribeRequest {
  time: number;
  channel: string;
  event: 'subscribe' | 'unsubscribe';
  payload: string[];
  auth: {
    method: 'api_key';
    KEY: string;
    SIGN: string;
  };
}

// =============================================================================
// 2. GateioFundingWs 類別
// =============================================================================

/**
 * GateioFundingWs - Gate.io 資金費率 WebSocket 客戶端
 *
 * 功能：
 * - 訂閱 futures.tickers 頻道獲取資金費率、標記價格、指數價格
 * - 一次訂閱獲取多種數據
 * - 自動重連（指數退避）
 * - 健康檢查（60 秒無訊息觸發重連）
 * - 自動處理 ping/pong 心跳
 *
 * 注意：Gate.io 每連線最多 20 個訂閱，超過需使用 ConnectionPool
 */
export class GateioFundingWs extends BaseExchangeWs {
  protected readonly exchangeName: ExchangeName = 'gateio';
  private wsUrl: string;
  private credentials?: GateioCredentials;

  // 私有頻道狀態
  private isOrdersSubscribed = false;

  constructor(config: GateioFundingWsConfig = {}) {
    super(config);

    this.wsUrl = config.wsUrl ?? 'wss://fx-ws.gateio.ws/v4/ws/usdt';
    this.credentials = config.credentials;

    logger.debug(
      {
        service: this.getLogPrefix(),
        wsUrl: this.wsUrl,
        hasCredentials: !!this.credentials,
      },
      'GateioFundingWs initialized'
    );
  }

  // =============================================================================
  // 3. 抽象方法實作
  // =============================================================================

  protected getWsUrl(): string {
    return this.wsUrl;
  }

  protected buildSubscribeMessage(symbols: string[]): GateioSubscribeRequest {
    // Gate.io 的 futures.tickers 訂閱格式
    // 將內部符號轉換為 Gate.io 格式
    const payload = symbols.map((symbol) => toGateioSymbol(symbol));

    return {
      time: Math.floor(Date.now() / 1000),
      channel: 'futures.tickers',
      event: 'subscribe',
      payload,
    };
  }

  protected buildUnsubscribeMessage(symbols: string[]): GateioSubscribeRequest {
    const payload = symbols.map((symbol) => toGateioSymbol(symbol));

    return {
      time: Math.floor(Date.now() / 1000),
      channel: 'futures.tickers',
      event: 'unsubscribe',
      payload,
    };
  }

  protected handleMessage(data: Buffer | string): void {
    try {
      const message = typeof data === 'string' ? JSON.parse(data) : JSON.parse(data.toString());

      // 處理訂閱回應
      if (message.event === 'subscribe' || message.event === 'unsubscribe') {
        const status = message.error ? 'failed' : 'success';
        logger.debug(
          {
            service: this.getLogPrefix(),
            event: message.event,
            channel: message.channel,
            status,
            error: message.error,
          },
          'Subscription response received'
        );

        if (message.error) {
          this.emit('error', new Error(`Gate.io subscription error: ${JSON.stringify(message.error)}`));
        }
        return;
      }

      // 處理 ping（Gate.io 服務器會發送 ping）
      if (message.channel === 'futures.ping') {
        this.handleGateioPing(message);
        return;
      }

      // 處理 futures.tickers 更新
      if (message.channel === 'futures.tickers' && message.event === 'update') {
        this.handleTickerMessage(message);
        return;
      }

      // 處理 futures.orders 更新（私有頻道）
      if (message.channel === 'futures.orders' && message.event === 'update') {
        this.handleOrderMessage(message);
        return;
      }

      // 未知訊息類型
      if (message.channel) {
        logger.debug(
          { service: this.getLogPrefix(), channel: message.channel, event: message.event },
          'Unknown channel message'
        );
      }
    } catch (error) {
      logger.error(
        {
          service: this.getLogPrefix(),
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to parse Gate.io WebSocket message'
      );
    }
  }

  // =============================================================================
  // 4. 訊息處理
  // =============================================================================

  /**
   * 處理 Gate.io ping
   */
  private handleGateioPing(message: { time: number }): void {
    // Gate.io 要求回覆 pong
    if (this.ws) {
      const pong = {
        time: message.time,
        channel: 'futures.pong',
      };
      this.ws.send(JSON.stringify(pong));
      logger.debug({ service: this.getLogPrefix() }, 'Sent pong response');
    }
  }

  /**
   * 處理 futures.tickers 訊息
   */
  private handleTickerMessage(message: unknown): void {
    const result = parseGateioTickerEvent(message);

    if (!result.success) {
      logger.warn(
        { service: this.getLogPrefix(), error: result.error.message },
        'Invalid ticker message'
      );
      return;
    }

    // Gate.io result 為陣列，處理所有項目
    const tickerItems = result.data.result;

    for (const tickerData of tickerItems) {
      const symbol = fromGateioSymbol(tickerData.contract);

      // 計算下次結算時間（Gate.io 不直接提供，需要根據當前時間計算）
      const nextFundingTime = this.calculateNextFundingTime();

      const fundingRateReceived: FundingRateReceived = {
        exchange: 'gateio',
        symbol,
        fundingRate: new Decimal(tickerData.funding_rate),
        nextFundingTime,
        nextFundingRate: tickerData.funding_rate_indicative
          ? new Decimal(tickerData.funding_rate_indicative)
          : undefined,
        markPrice: new Decimal(tickerData.mark_price),
        indexPrice: new Decimal(tickerData.index_price),
        source: 'websocket',
        receivedAt: new Date(),
      };

      this.emit('fundingRate', fundingRateReceived);
    }
  }

  /**
   * 計算下次結算時間
   * Gate.io 資金費率結算時間：UTC 00:00, 08:00, 16:00
   */
  private calculateNextFundingTime(): Date {
    const now = new Date();
    const utcHours = now.getUTCHours();

    let nextHour: number;
    if (utcHours < 8) {
      nextHour = 8;
    } else if (utcHours < 16) {
      nextHour = 16;
    } else {
      nextHour = 24; // 次日 00:00
    }

    const nextFunding = new Date(now);
    nextFunding.setUTCHours(nextHour % 24, 0, 0, 0);

    if (nextHour === 24) {
      nextFunding.setUTCDate(nextFunding.getUTCDate() + 1);
    }

    return nextFunding;
  }

  /**
   * 處理訂單更新訊息
   */
  private handleOrderMessage(message: unknown): void {
    const result = parseGateioOrderEvent(message);

    if (!result.success) {
      logger.warn(
        { service: this.getLogPrefix(), error: result.error.message },
        'Invalid order message'
      );
      return;
    }

    const { result: orders } = result.data;

    for (const order of orders) {
      const symbol = fromGateioSymbol(order.contract);

      // 映射 Gate.io 狀態到通用狀態
      let status: OrderStatusChanged['status'];
      if (order.status === 'finished') {
        status = order.finish_as === 'filled' ? 'FILLED' : 'CANCELED';
      } else if (order.status === 'open' && order.left < Math.abs(order.size)) {
        status = 'PARTIALLY_FILLED';
      } else {
        status = 'NEW';
      }

      // Gate.io size: 正數為多，負數為空
      const side = order.size > 0 ? 'BUY' : 'SELL';
      const positionSide = order.size > 0 ? 'LONG' : 'SHORT';

      const orderStatusChanged: OrderStatusChanged = {
        exchange: 'gateio',
        symbol,
        orderId: order.id.toString(),
        clientOrderId: undefined,
        status,
        side,
        positionSide,
        orderType: 'MARKET', // Gate.io WebSocket 不區分訂單類型
        price: order.price ? new Decimal(order.price) : undefined,
        avgPrice: order.fill_price ? new Decimal(order.fill_price) : new Decimal(0),
        quantity: new Decimal(Math.abs(order.size)),
        filledQuantity: new Decimal(Math.abs(order.size) - order.left),
        reduceOnly: order.is_reduce_only,
        updateTime: new Date(order.finish_time ? order.finish_time * 1000 : order.create_time * 1000),
        source: 'websocket',
        receivedAt: new Date(),
      };

      this.emit('orderUpdate', orderStatusChanged);

      logger.debug(
        {
          service: this.getLogPrefix(),
          symbol,
          orderId: order.id,
          status,
          side,
        },
        'Order update received'
      );
    }
  }

  // =============================================================================
  // 5. 私有頻道認證
  // =============================================================================

  /**
   * 生成 Gate.io 認證簽名
   * 簽名格式: HMAC-SHA512(channel=futures.orders&event=subscribe&time={timestamp})
   */
  private generateAuthSignature(channel: string, event: string, timestamp: number): string {
    const signatureString = `channel=${channel}&event=${event}&time=${timestamp}`;
    return crypto.createHmac('sha512', this.credentials!.secretKey).update(signatureString).digest('hex');
  }

  /**
   * 建立認證訂閱訊息
   */
  private buildAuthSubscribeMessage(channel: string): GateioAuthSubscribeRequest | null {
    if (!this.credentials) {
      logger.warn({ service: this.getLogPrefix() }, 'Cannot subscribe to private channel: no credentials');
      return null;
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const sign = this.generateAuthSignature(channel, 'subscribe', timestamp);

    return {
      time: timestamp,
      channel,
      event: 'subscribe',
      payload: ['!all'], // 訂閱所有合約的訂單
      auth: {
        method: 'api_key',
        KEY: this.credentials.apiKey,
        SIGN: sign,
      },
    };
  }

  /**
   * 訂閱訂單更新頻道
   * Gate.io 認證和訂閱合併在同一個訊息中
   */
  subscribeOrders(): void {
    if (!this.credentials) {
      logger.warn({ service: this.getLogPrefix() }, 'Cannot subscribe orders: no credentials');
      return;
    }

    if (!this.ws || this.ws.readyState !== 1) {
      logger.warn({ service: this.getLogPrefix() }, 'Cannot subscribe orders: WebSocket not connected');
      return;
    }

    const subscribeMessage = this.buildAuthSubscribeMessage('futures.orders');
    if (!subscribeMessage) {
      return;
    }

    this.ws.send(JSON.stringify(subscribeMessage));
    this.isOrdersSubscribed = true;
    logger.info({ service: this.getLogPrefix() }, 'Subscribed to futures.orders channel');
  }

  /**
   * 取消訂閱訂單更新頻道
   */
  unsubscribeOrders(): void {
    if (!this.ws || this.ws.readyState !== 1) {
      return;
    }

    if (!this.credentials) {
      return;
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const sign = this.generateAuthSignature('futures.orders', 'unsubscribe', timestamp);

    const unsubscribeMessage: GateioAuthSubscribeRequest = {
      time: timestamp,
      channel: 'futures.orders',
      event: 'unsubscribe',
      payload: ['!all'],
      auth: {
        method: 'api_key',
        KEY: this.credentials.apiKey,
        SIGN: sign,
      },
    };

    this.ws.send(JSON.stringify(unsubscribeMessage));
    this.isOrdersSubscribed = false;
    logger.info({ service: this.getLogPrefix() }, 'Unsubscribed from futures.orders channel');
  }

  /**
   * 檢查是否已訂閱訂單頻道
   */
  isOrdersChannelSubscribed(): boolean {
    return this.isOrdersSubscribed;
  }

  // =============================================================================
  // 6. 覆寫方法
  // =============================================================================

  /**
   * 覆寫日誌前綴
   */
  protected override getLogPrefix(): string {
    return 'GateioFundingWs';
  }
}
