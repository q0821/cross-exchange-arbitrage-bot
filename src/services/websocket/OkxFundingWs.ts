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

import Decimal from 'decimal.js';
import { BaseExchangeWs, type BaseExchangeWsConfig } from './BaseExchangeWs';
import {
  parseOkxFundingRateEvent,
  parseOkxMarkPriceEvent,
} from '@/lib/schemas/websocket-messages';
import { toOkxSymbol, fromOkxSymbol } from '@/lib/symbol-converter';
import { logger } from '@/lib/logger';
import type { ExchangeName } from '@/connectors/types';
import type { FundingRateReceived } from '@/types/websocket-events';

// =============================================================================
// 1. 類型定義
// =============================================================================

/** OKX WebSocket 配置 */
export interface OkxFundingWsConfig extends BaseExchangeWsConfig {
  /** WebSocket URL */
  wsUrl?: string;
  /** 訂閱頻道類型：funding-rate, mark-price, both */
  channelType?: 'funding-rate' | 'mark-price' | 'both';
}

/** OKX 訂閱參數 */
interface OkxSubscriptionArg {
  channel: 'funding-rate' | 'mark-price';
  instId: string;
}

/** OKX 訂閱請求 */
interface OkxSubscribeRequest {
  op: 'subscribe' | 'unsubscribe';
  args: OkxSubscriptionArg[];
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

  // 暫存標記價格，用於與資金費率合併
  private markPriceCache: Map<string, Decimal> = new Map();

  constructor(config: OkxFundingWsConfig = {}) {
    super(config);

    this.wsUrl = config.wsUrl ?? 'wss://ws.okx.com:8443/ws/v5/public';
    this.channelType = config.channelType ?? 'both';

    logger.debug(
      {
        service: this.getLogPrefix(),
        wsUrl: this.wsUrl,
        channelType: this.channelType,
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
        logger.error(
          {
            service: this.getLogPrefix(),
            code: message.code,
            msg: message.msg,
          },
          'OKX WebSocket error response'
        );
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

      // 快取標記價格
      this.markPriceCache.set(symbol, markPrice);

      // 發送價格更新事件（可選）
      // 如果只需要資金費率，可以不發送此事件
      logger.debug(
        { service: this.getLogPrefix(), symbol, markPrice: markPrice.toString() },
        'Mark price updated'
      );
    }
  }

  // =============================================================================
  // 5. 公開方法
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
   * 覆寫 destroy 以清理快取
   */
  override destroy(): void {
    this.markPriceCache.clear();
    super.destroy();
  }
}
