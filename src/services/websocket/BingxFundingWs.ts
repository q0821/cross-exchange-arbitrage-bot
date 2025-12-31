/**
 * BingxFundingWs
 *
 * BingX WebSocket 客戶端 - 訂閱即時資金費率和標記價格
 * Feature: 054-native-websocket-clients
 * Task: T018
 *
 * WebSocket URL: wss://open-api-swap.bingx.com/swap-market
 * 頻道：@markPrice（包含標記價格和資金費率）
 *
 * Symbol 轉換：BTCUSDT → BTC-USDT
 * 連線限制：每連線最多 50 個訂閱頻道
 *
 * 注意：BingX WebSocket 訊息使用 GZIP 壓縮
 */

import crypto from 'crypto';
import { gunzipSync } from 'zlib';
import Decimal from 'decimal.js';
import { BaseExchangeWs, type BaseExchangeWsConfig } from './BaseExchangeWs';
import { parseBingxMarkPriceEvent, parseBingxUserDataEvent } from '@/lib/schemas/websocket-messages';
import { toBingxSymbol, fromBingxSymbol } from '@/lib/symbol-converter';
import { logger } from '@/lib/logger';
import type { ExchangeName } from '@/connectors/types';
import type { FundingRateReceived, OrderStatusChanged } from '@/types/websocket-events';

// =============================================================================
// 1. 類型定義
// =============================================================================

/** BingX API 憑證 */
export interface BingxCredentials {
  apiKey: string;
  secretKey: string;
}

/** BingX WebSocket 配置 */
export interface BingxFundingWsConfig extends BaseExchangeWsConfig {
  /** WebSocket URL */
  wsUrl?: string;
  /** 私有頻道 REST API URL */
  restApiUrl?: string;
  /** API 憑證（私有頻道需要） */
  credentials?: BingxCredentials;
}

/** BingX 訂閱請求 */
interface BingxSubscribeRequest {
  id: string;
  reqType: 'sub' | 'unsub';
  dataType: string;
}

/** BingX listenKey 回應 */
interface BingxListenKeyResponse {
  code: number;
  msg: string;
  data?: {
    listenKey: string;
  };
}

// =============================================================================
// 2. BingxFundingWs 類別
// =============================================================================

/**
 * BingxFundingWs - BingX 資金費率 WebSocket 客戶端
 *
 * 功能：
 * - 訂閱 @markPrice 頻道獲取標記價格和資金費率
 * - 自動解壓 GZIP 壓縮的訊息
 * - 自動重連（指數退避）
 * - 健康檢查（60 秒無訊息觸發重連）
 * - 自動處理 ping/pong 心跳
 *
 * 注意：BingX 每連線最多 50 個訂閱
 */
export class BingxFundingWs extends BaseExchangeWs {
  protected readonly exchangeName: ExchangeName = 'bingx';
  private wsUrl: string;
  private restApiUrl: string;
  private credentials?: BingxCredentials;
  private requestId = 0;

  // 私有頻道狀態
  private listenKey: string | null = null;
  private listenKeyRefreshInterval: NodeJS.Timeout | null = null;
  private isOrdersSubscribed = false;

  constructor(config: BingxFundingWsConfig = {}) {
    super(config);

    this.wsUrl = config.wsUrl ?? 'wss://open-api-swap.bingx.com/swap-market';
    this.restApiUrl = config.restApiUrl ?? 'https://open-api.bingx.com';
    this.credentials = config.credentials;

    logger.debug(
      {
        service: this.getLogPrefix(),
        wsUrl: this.wsUrl,
        restApiUrl: this.restApiUrl,
        hasCredentials: !!this.credentials,
      },
      'BingxFundingWs initialized'
    );
  }

  // =============================================================================
  // 3. 抽象方法實作
  // =============================================================================

  protected getWsUrl(): string {
    return this.wsUrl;
  }

  protected buildSubscribeMessage(symbols: string[]): BingxSubscribeRequest[] {
    // BingX 需要為每個符號發送單獨的訂閱請求
    // 但我們可以批量發送，返回多個請求
    return symbols.map((symbol) => {
      const bingxSymbol = toBingxSymbol(symbol);
      return {
        id: `sub-${++this.requestId}`,
        reqType: 'sub' as const,
        dataType: `${bingxSymbol}@markPrice`,
      };
    });
  }

  protected buildUnsubscribeMessage(symbols: string[]): BingxSubscribeRequest[] {
    return symbols.map((symbol) => {
      const bingxSymbol = toBingxSymbol(symbol);
      return {
        id: `unsub-${++this.requestId}`,
        reqType: 'unsub' as const,
        dataType: `${bingxSymbol}@markPrice`,
      };
    });
  }

  /**
   * 覆寫訂閱方法以支援批量發送
   */
  override async subscribe(symbols: string[]): Promise<void> {
    if (!this.isConnected || !this.ws) {
      throw new Error('Not connected');
    }

    const messages = this.buildSubscribeMessage(symbols);

    logger.info(
      { service: this.getLogPrefix(), symbols, count: messages.length },
      'Subscribing to symbols'
    );

    // 逐一發送訂閱請求
    for (const message of messages) {
      this.ws.send(JSON.stringify(message));
    }

    // 記錄已訂閱的交易對
    symbols.forEach((symbol) => this.subscribedSymbols.add(symbol.toUpperCase()));
  }

  /**
   * 覆寫取消訂閱方法
   */
  override async unsubscribe(symbols: string[]): Promise<void> {
    if (!this.isConnected || !this.ws) {
      throw new Error('Not connected');
    }

    const messages = this.buildUnsubscribeMessage(symbols);

    logger.info(
      { service: this.getLogPrefix(), symbols },
      'Unsubscribing from symbols'
    );

    for (const message of messages) {
      this.ws.send(JSON.stringify(message));
    }

    symbols.forEach((symbol) => this.subscribedSymbols.delete(symbol.toUpperCase()));
  }

  protected handleMessage(data: Buffer | string): void {
    try {
      // BingX 訊息可能是 GZIP 壓縮的
      let message: unknown;

      if (Buffer.isBuffer(data)) {
        try {
          // 嘗試解壓 GZIP
          const decompressed = gunzipSync(data);
          message = JSON.parse(decompressed.toString());
        } catch {
          // 如果解壓失敗，嘗試直接解析
          message = JSON.parse(data.toString());
        }
      } else {
        message = JSON.parse(data);
      }

      // 處理 ping（BingX 客戶端需要主動發送 ping）
      if (typeof message === 'object' && message !== null && 'ping' in message) {
        this.handleBingxPing(message as { ping: number });
        return;
      }

      // 處理 pong 回應
      if (typeof message === 'object' && message !== null && 'pong' in message) {
        logger.debug({ service: this.getLogPrefix() }, 'Received pong');
        return;
      }

      // 處理訂閱回應
      if (
        typeof message === 'object' &&
        message !== null &&
        'id' in message &&
        'code' in message
      ) {
        const resp = message as { id: string; code: number; msg?: string };
        if (resp.code !== 0) {
          logger.warn(
            {
              service: this.getLogPrefix(),
              id: resp.id,
              code: resp.code,
              msg: resp.msg,
            },
            'BingX subscription error'
          );
        } else {
          logger.debug(
            { service: this.getLogPrefix(), id: resp.id },
            'Subscription confirmed'
          );
        }
        return;
      }

      // 處理 markPrice 更新
      if (
        typeof message === 'object' &&
        message !== null &&
        'data' in message &&
        typeof (message as { data: unknown }).data === 'object'
      ) {
        const dataObj = (message as { data: { e?: string } }).data;
        if (dataObj && dataObj.e === 'markPriceUpdate') {
          this.handleMarkPriceMessage(message);
          return;
        }
      }

      // 處理 ORDER_TRADE_UPDATE 事件（私有頻道）
      if (
        typeof message === 'object' &&
        message !== null &&
        'e' in message &&
        (message as { e: string }).e === 'ORDER_TRADE_UPDATE'
      ) {
        this.handleOrderTradeUpdate(message);
        return;
      }

      // 處理 ACCOUNT_UPDATE 事件（私有頻道 - 可選處理）
      if (
        typeof message === 'object' &&
        message !== null &&
        'e' in message &&
        (message as { e: string }).e === 'ACCOUNT_UPDATE'
      ) {
        logger.debug({ service: this.getLogPrefix() }, 'Received ACCOUNT_UPDATE event');
        return;
      }

      // 未知訊息類型
      logger.debug(
        { service: this.getLogPrefix(), messageType: typeof message },
        'Unknown message type'
      );
    } catch (error) {
      logger.error(
        {
          service: this.getLogPrefix(),
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to parse BingX WebSocket message'
      );
    }
  }

  // =============================================================================
  // 4. 訊息處理
  // =============================================================================

  /**
   * 處理 BingX ping
   */
  private handleBingxPing(message: { ping: number }): void {
    // BingX 要求回覆 pong
    if (this.ws) {
      const pong = { pong: message.ping };
      this.ws.send(JSON.stringify(pong));
      logger.debug({ service: this.getLogPrefix() }, 'Sent pong response');
    }
  }

  /**
   * 處理 markPrice 訊息
   */
  private handleMarkPriceMessage(message: unknown): void {
    const result = parseBingxMarkPriceEvent(message);

    if (!result.success) {
      logger.warn(
        { service: this.getLogPrefix(), error: result.error.message },
        'Invalid markPrice message'
      );
      return;
    }

    const { code, data } = result.data;

    // 檢查是否成功
    if (code !== 0) {
      logger.warn(
        { service: this.getLogPrefix(), code },
        'BingX markPrice error code'
      );
      return;
    }

    const symbol = fromBingxSymbol(data.s);

    // 某些幣種可能沒有資金費率資料（如新上架幣種）
    // 仍然發送事件，但 fundingRate 和 nextFundingTime 為 undefined
    const fundingRateReceived: FundingRateReceived = {
      exchange: 'bingx',
      symbol,
      fundingRate: data.r ? new Decimal(data.r) : undefined,
      nextFundingTime: data.T ? new Date(data.T) : undefined,
      markPrice: new Decimal(data.p),
      source: 'websocket',
      receivedAt: new Date(),
    };

    this.emit('fundingRate', fundingRateReceived);
  }

  /**
   * 處理 ORDER_TRADE_UPDATE 訊息
   */
  private handleOrderTradeUpdate(message: unknown): void {
    const result = parseBingxUserDataEvent(message);

    if (!result.success) {
      logger.warn(
        { service: this.getLogPrefix(), error: result.error.message },
        'Invalid ORDER_TRADE_UPDATE message'
      );
      return;
    }

    const event = result.data;

    // 確認是 ORDER_TRADE_UPDATE 事件
    if (event.e !== 'ORDER_TRADE_UPDATE') {
      return;
    }

    const order = event.o;
    const symbol = fromBingxSymbol(order.s);

    // 映射 BingX 狀態到通用狀態
    let status: OrderStatusChanged['status'];
    switch (order.X) {
      case 'NEW':
        status = 'NEW';
        break;
      case 'PARTIALLY_FILLED':
        status = 'PARTIALLY_FILLED';
        break;
      case 'FILLED':
        status = 'FILLED';
        break;
      case 'CANCELED':
      case 'CANCELLED':
        status = 'CANCELED';
        break;
      case 'EXPIRED':
        status = 'CANCELED';
        break;
      default:
        status = 'NEW';
    }

    // 映射訂單類型
    let orderType: OrderStatusChanged['orderType'] = 'MARKET';
    if (order.o === 'LIMIT') {
      orderType = 'LIMIT';
    } else if (order.o === 'STOP_MARKET' || order.o === 'TAKE_PROFIT_MARKET') {
      orderType = 'STOP_MARKET';
    }

    const orderStatusChanged: OrderStatusChanged = {
      exchange: 'bingx',
      symbol,
      orderId: order.i,
      clientOrderId: order.c || undefined,
      status,
      side: order.S,
      positionSide: order.ps,
      orderType,
      price: undefined, // BingX 不直接提供限價
      avgPrice: order.ap ? new Decimal(order.ap) : new Decimal(0),
      quantity: new Decimal(order.z).plus(new Decimal(order.z)), // 無法從此 schema 取得原始數量
      filledQuantity: new Decimal(order.z),
      reduceOnly: false, // BingX WebSocket 不提供此欄位
      updateTime: new Date(event.E),
      source: 'websocket',
      receivedAt: new Date(),
    };

    this.emit('orderUpdate', orderStatusChanged);

    logger.debug(
      {
        service: this.getLogPrefix(),
        symbol,
        orderId: order.i,
        status,
        side: order.S,
      },
      'Order update received'
    );
  }

  // =============================================================================
  // 5. 私有頻道認證 (listenKey 機制)
  // =============================================================================

  /**
   * 生成 BingX 簽名
   */
  private generateSignature(queryString: string): string {
    return crypto
      .createHmac('sha256', this.credentials!.secretKey)
      .update(queryString)
      .digest('hex');
  }

  /**
   * 建立 listenKey
   * 透過 REST API 獲取用於 WebSocket 認證的 listenKey
   */
  async createListenKey(): Promise<string | null> {
    if (!this.credentials) {
      logger.warn({ service: this.getLogPrefix() }, 'Cannot create listenKey: no credentials');
      return null;
    }

    try {
      const timestamp = Date.now().toString();
      const queryString = `timestamp=${timestamp}`;
      const signature = this.generateSignature(queryString);

      const response = await fetch(
        `${this.restApiUrl}/openApi/user/auth/userDataStream?${queryString}&signature=${signature}`,
        {
          method: 'POST',
          headers: {
            'X-BX-APIKEY': this.credentials.apiKey,
          },
        }
      );

      const data = (await response.json()) as BingxListenKeyResponse;

      if (data.code === 0 && data.data?.listenKey) {
        this.listenKey = data.data.listenKey;
        logger.info({ service: this.getLogPrefix() }, 'listenKey created successfully');
        return this.listenKey;
      } else {
        logger.error(
          { service: this.getLogPrefix(), code: data.code, msg: data.msg },
          'Failed to create listenKey'
        );
        return null;
      }
    } catch (error) {
      logger.error(
        {
          service: this.getLogPrefix(),
          error: error instanceof Error ? error.message : String(error),
        },
        'Error creating listenKey'
      );
      return null;
    }
  }

  /**
   * 刷新 listenKey
   * 每 30 分鐘需要刷新一次以保持有效
   */
  async refreshListenKey(): Promise<boolean> {
    if (!this.credentials || !this.listenKey) {
      return false;
    }

    try {
      const timestamp = Date.now().toString();
      const queryString = `listenKey=${this.listenKey}&timestamp=${timestamp}`;
      const signature = this.generateSignature(queryString);

      const response = await fetch(
        `${this.restApiUrl}/openApi/user/auth/userDataStream?${queryString}&signature=${signature}`,
        {
          method: 'PUT',
          headers: {
            'X-BX-APIKEY': this.credentials.apiKey,
          },
        }
      );

      const data = (await response.json()) as BingxListenKeyResponse;

      if (data.code === 0) {
        logger.debug({ service: this.getLogPrefix() }, 'listenKey refreshed');
        return true;
      } else {
        logger.warn(
          { service: this.getLogPrefix(), code: data.code, msg: data.msg },
          'Failed to refresh listenKey'
        );
        return false;
      }
    } catch (error) {
      logger.error(
        {
          service: this.getLogPrefix(),
          error: error instanceof Error ? error.message : String(error),
        },
        'Error refreshing listenKey'
      );
      return false;
    }
  }

  /**
   * 刪除 listenKey
   */
  async deleteListenKey(): Promise<void> {
    if (!this.credentials || !this.listenKey) {
      return;
    }

    try {
      const timestamp = Date.now().toString();
      const queryString = `listenKey=${this.listenKey}&timestamp=${timestamp}`;
      const signature = this.generateSignature(queryString);

      await fetch(
        `${this.restApiUrl}/openApi/user/auth/userDataStream?${queryString}&signature=${signature}`,
        {
          method: 'DELETE',
          headers: {
            'X-BX-APIKEY': this.credentials.apiKey,
          },
        }
      );

      this.listenKey = null;
      logger.info({ service: this.getLogPrefix() }, 'listenKey deleted');
    } catch (error) {
      logger.error(
        {
          service: this.getLogPrefix(),
          error: error instanceof Error ? error.message : String(error),
        },
        'Error deleting listenKey'
      );
    }
  }

  /**
   * 開始自動刷新 listenKey
   * 每 25 分鐘刷新一次（有效期 60 分鐘，提前刷新以避免過期）
   */
  private startListenKeyRefresh(): void {
    this.stopListenKeyRefresh();

    this.listenKeyRefreshInterval = setInterval(
      async () => {
        const success = await this.refreshListenKey();
        if (!success) {
          // 刷新失敗，嘗試重新建立
          const newKey = await this.createListenKey();
          if (!newKey) {
            logger.error({ service: this.getLogPrefix() }, 'Failed to recreate listenKey');
          }
        }
      },
      25 * 60 * 1000
    ); // 25 分鐘
  }

  /**
   * 停止自動刷新 listenKey
   */
  private stopListenKeyRefresh(): void {
    if (this.listenKeyRefreshInterval) {
      clearInterval(this.listenKeyRefreshInterval);
      this.listenKeyRefreshInterval = null;
    }
  }

  /**
   * 取得帶有 listenKey 的 WebSocket URL
   */
  getPrivateWsUrl(): string | null {
    if (!this.listenKey) {
      return null;
    }
    return `${this.wsUrl}?listenKey=${this.listenKey}`;
  }

  /**
   * 訂閱訂單更新
   * BingX 使用 listenKey 機制，建立 listenKey 後自動接收所有帳戶事件
   */
  async subscribeOrders(): Promise<boolean> {
    if (!this.credentials) {
      logger.warn({ service: this.getLogPrefix() }, 'Cannot subscribe orders: no credentials');
      return false;
    }

    // 建立 listenKey
    const listenKey = await this.createListenKey();
    if (!listenKey) {
      return false;
    }

    // 啟動自動刷新
    this.startListenKeyRefresh();
    this.isOrdersSubscribed = true;

    logger.info(
      { service: this.getLogPrefix() },
      'Orders subscription enabled. Connect to private WebSocket URL to receive events.'
    );

    return true;
  }

  /**
   * 取消訂閱訂單更新
   */
  async unsubscribeOrders(): Promise<void> {
    this.stopListenKeyRefresh();
    await this.deleteListenKey();
    this.isOrdersSubscribed = false;

    logger.info({ service: this.getLogPrefix() }, 'Orders subscription disabled');
  }

  /**
   * 檢查是否已訂閱訂單頻道
   */
  isOrdersChannelSubscribed(): boolean {
    return this.isOrdersSubscribed;
  }

  /**
   * 取得目前的 listenKey
   */
  getListenKey(): string | null {
    return this.listenKey;
  }

  // =============================================================================
  // 6. 覆寫方法
  // =============================================================================

  /**
   * 覆寫日誌前綴
   */
  protected override getLogPrefix(): string {
    return 'BingxFundingWs';
  }

  /**
   * 覆寫 handlePing 以支援 BingX 的心跳機制
   * BingX 需要客戶端主動發送 ping
   */
  protected override handlePing(): void {
    // WebSocket 標準 ping 由 ws 庫自動處理
    // BingX 應用層 ping 在 handleMessage 中處理
    logger.debug({ service: this.getLogPrefix() }, 'Received WebSocket ping');
  }

  /**
   * 啟動主動心跳
   * BingX 建議每 20 秒發送一次 ping
   */
  private heartbeatInterval: NodeJS.Timeout | null = null;

  override async connect(): Promise<void> {
    await super.connect();

    // 啟動主動心跳
    this.startHeartbeat();
  }

  override async disconnect(): Promise<void> {
    this.stopHeartbeat();
    this.stopListenKeyRefresh();
    await super.disconnect();
  }

  override destroy(): void {
    this.stopHeartbeat();
    this.stopListenKeyRefresh();
    super.destroy();
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();

    // 每 20 秒發送一次 ping
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected && this.ws) {
        const ping = { ping: Date.now() };
        this.ws.send(JSON.stringify(ping));
        logger.debug({ service: this.getLogPrefix() }, 'Sent heartbeat ping');
      }
    }, 20000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}
