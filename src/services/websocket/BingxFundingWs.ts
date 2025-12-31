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

import { gunzipSync } from 'zlib';
import Decimal from 'decimal.js';
import { BaseExchangeWs, type BaseExchangeWsConfig } from './BaseExchangeWs';
import { parseBingxMarkPriceEvent } from '@/lib/schemas/websocket-messages';
import { toBingxSymbol, fromBingxSymbol } from '@/lib/symbol-converter';
import { logger } from '@/lib/logger';
import type { ExchangeName } from '@/connectors/types';
import type { FundingRateReceived } from '@/types/websocket-events';

// =============================================================================
// 1. 類型定義
// =============================================================================

/** BingX WebSocket 配置 */
export interface BingxFundingWsConfig extends BaseExchangeWsConfig {
  /** WebSocket URL */
  wsUrl?: string;
}

/** BingX 訂閱請求 */
interface BingxSubscribeRequest {
  id: string;
  reqType: 'sub' | 'unsub';
  dataType: string;
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
  private requestId = 0;

  constructor(config: BingxFundingWsConfig = {}) {
    super(config);

    this.wsUrl = config.wsUrl ?? 'wss://open-api-swap.bingx.com/swap-market';

    logger.debug(
      {
        service: this.getLogPrefix(),
        wsUrl: this.wsUrl,
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

    const fundingRateReceived: FundingRateReceived = {
      exchange: 'bingx',
      symbol,
      fundingRate: new Decimal(data.r),
      nextFundingTime: new Date(data.T),
      markPrice: new Decimal(data.p),
      source: 'websocket',
      receivedAt: new Date(),
    };

    this.emit('fundingRate', fundingRateReceived);
  }

  // =============================================================================
  // 5. 覆寫方法
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
    await super.disconnect();
  }

  override destroy(): void {
    this.stopHeartbeat();
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
