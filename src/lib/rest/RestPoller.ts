/**
 * RestPoller
 *
 * REST API 輪詢器 - WebSocket 的備援機制
 * Feature: 004-fix-okx-add-price-display
 * Task: T030
 */

import { EventEmitter } from 'events';
import type { IExchangeConnector } from '../../connectors/types.js';
import type { PriceData } from '../../types/service-interfaces.js';
import { logger } from '../logger.js';

/**
 * 輪詢配置
 */
export interface RestPollerConfig {
  /** 輪詢間隔（毫秒）*/
  intervalMs?: number;
  /** 是否在啟動時立即執行一次 */
  immediate?: boolean;
}

/**
 * RestPoller 事件
 */
export interface RestPollerEvents {
  /** 價格更新事件 */
  'ticker': (priceData: PriceData) => void;
  /** 錯誤事件 */
  'error': (error: Error) => void;
}

/**
 * RestPoller
 *
 * 定期輪詢 REST API 獲取價格數據：
 * - 使用現有 connector 的 getPrices() 方法
 * - 發出 'ticker' 事件（與 WebSocket 相同格式）
 * - 作為 WebSocket 的備援機制
 */
export class RestPoller extends EventEmitter {
  private config: Required<RestPollerConfig>;
  private connector: IExchangeConnector;
  private symbols: string[];
  private pollTimer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    connector: IExchangeConnector,
    symbols: string[],
    config: RestPollerConfig = {}
  ) {
    super();

    this.connector = connector;
    this.symbols = symbols;
    this.config = {
      intervalMs: config.intervalMs ?? 5000, // 預設 5 秒
      immediate: config.immediate ?? true,
    };

    logger.debug({
      exchange: connector.name,
      symbols: symbols.length,
      intervalMs: this.config.intervalMs,
    }, 'RestPoller initialized');
  }

  /**
   * 啟動輪詢
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('RestPoller already running');
      return;
    }

    this.isRunning = true;

    logger.info({
      exchange: this.connector.name,
      symbols: this.symbols.length,
      intervalMs: this.config.intervalMs,
    }, 'RestPoller started');

    // 立即執行一次（如果配置為 immediate）
    if (this.config.immediate) {
      this.poll().catch((error) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isSymbolNotFound = errorMessage.includes('does not have market symbol') ||
          errorMessage.includes("doesn't exist") ||
          errorMessage.includes('symbol not found');
        const isRateLimit = errorMessage.includes('too frequent') ||
          errorMessage.includes('rate limit') ||
          errorMessage.includes('429') ||
          errorMessage.includes('Too Many') ||
          errorMessage.includes('code":510');

        if (isSymbolNotFound) {
          logger.debug({ error: errorMessage }, 'Initial poll - symbol not available');
        } else if (isRateLimit) {
          logger.warn({ exchange: this.connector.name }, 'Initial poll - rate limited');
        } else {
          logger.error({ error: errorMessage }, 'Initial poll failed');
        }
        this.emit('error', error instanceof Error ? error : new Error(String(error)));
      });
    }

    // 設定定期輪詢
    this.pollTimer = setInterval(() => {
      this.poll().catch((error) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isSymbolNotFound = errorMessage.includes('does not have market symbol') ||
          errorMessage.includes("doesn't exist") ||
          errorMessage.includes('symbol not found');
        const isRateLimit = errorMessage.includes('too frequent') ||
          errorMessage.includes('rate limit') ||
          errorMessage.includes('429') ||
          errorMessage.includes('Too Many') ||
          errorMessage.includes('code":510');

        if (isSymbolNotFound) {
          logger.debug({ error: errorMessage }, 'Poll - symbol not available');
        } else if (isRateLimit) {
          logger.warn({ exchange: this.connector.name }, 'Poll - rate limited');
        } else {
          logger.error({ error: errorMessage }, 'Poll failed');
        }
        this.emit('error', error instanceof Error ? error : new Error(String(error)));
      });
    }, this.config.intervalMs);
  }

  /**
   * 停止輪詢
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    logger.info({
      exchange: this.connector.name,
    }, 'RestPoller stopped');
  }

  /**
   * 執行一次輪詢
   */
  private async poll(): Promise<void> {
    try {
      logger.debug({
        exchange: this.connector.name,
        symbols: this.symbols.length,
      }, 'Polling prices');

      // 使用 connector 的 getPrices 方法
      const prices = await this.connector.getPrices(this.symbols);

      logger.debug({
        exchange: this.connector.name,
        count: prices.length,
      }, 'Prices fetched');

      // 發出每個價格的 ticker 事件
      for (const priceData of prices) {
        this.emit('ticker', priceData);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // 交易對不存在的錯誤降級為 debug
      const isSymbolNotFound = errorMessage.includes('does not have market symbol') ||
        errorMessage.includes("doesn't exist") ||
        errorMessage.includes('symbol not found');
      const isRateLimit = errorMessage.includes('too frequent') ||
        errorMessage.includes('rate limit') ||
        errorMessage.includes('429') ||
        errorMessage.includes('Too Many') ||
        errorMessage.includes('code":510');

      if (isSymbolNotFound) {
        logger.debug({
          exchange: this.connector.name,
          error: errorMessage,
        }, 'Symbol not available on exchange');
      } else if (isRateLimit) {
        logger.warn({
          exchange: this.connector.name,
        }, 'Rate limited by exchange');
      } else {
        logger.error({
          exchange: this.connector.name,
          error: errorMessage,
        }, 'Failed to poll prices');
      }
      throw error;
    }
  }

  /**
   * 更新交易對列表
   */
  updateSymbols(symbols: string[]): void {
    this.symbols = symbols;
    logger.debug({
      exchange: this.connector.name,
      symbols: symbols.length,
    }, 'Symbols updated');
  }

  /**
   * 取得運行狀態
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * 銷毀輪詢器
   */
  destroy(): void {
    this.stop();
    this.removeAllListeners();
    logger.debug({
      exchange: this.connector.name,
    }, 'RestPoller destroyed');
  }
}
