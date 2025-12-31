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

import Decimal from 'decimal.js';
import { BaseExchangeWs, type BaseExchangeWsConfig } from './BaseExchangeWs';
import { parseGateioTickerEvent } from '@/lib/schemas/websocket-messages';
import { toGateioSymbol, fromGateioSymbol } from '@/lib/symbol-converter';
import { logger } from '@/lib/logger';
import type { ExchangeName } from '@/connectors/types';
import type { FundingRateReceived } from '@/types/websocket-events';

// =============================================================================
// 1. 類型定義
// =============================================================================

/** Gate.io WebSocket 配置 */
export interface GateioFundingWsConfig extends BaseExchangeWsConfig {
  /** WebSocket URL */
  wsUrl?: string;
}

/** Gate.io 訂閱請求 */
interface GateioSubscribeRequest {
  time: number;
  channel: string;
  event: 'subscribe' | 'unsubscribe';
  payload: string[];
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

  constructor(config: GateioFundingWsConfig = {}) {
    super(config);

    this.wsUrl = config.wsUrl ?? 'wss://fx-ws.gateio.ws/v4/ws/usdt';

    logger.debug(
      {
        service: this.getLogPrefix(),
        wsUrl: this.wsUrl,
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

  // =============================================================================
  // 5. 覆寫方法
  // =============================================================================

  /**
   * 覆寫日誌前綴
   */
  protected override getLogPrefix(): string {
    return 'GateioFundingWs';
  }
}
