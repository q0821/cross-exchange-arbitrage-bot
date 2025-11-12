/**
 * PriceMonitor Service
 *
 * 價格監控服務 - 管理 WebSocket 和 REST 備援
 * Feature: 004-fix-okx-add-price-display
 * Task: T033
 */

import { EventEmitter } from 'events';
import type { IExchangeConnector } from '../../connectors/types.js';
import type { PriceData, PriceSource } from '../../types/service-interfaces.js';
import { RestPoller } from '../../lib/rest/RestPoller.js';
import { PriceCache } from '../../lib/cache/PriceCache.js';
import { logger } from '../../lib/logger.js';

/**
 * 價格監控配置
 */
export interface PriceMonitorConfig {
  /** 是否啟用 WebSocket（預設 false，先用 REST）*/
  enableWebSocket?: boolean;
  /** REST 輪詢間隔（毫秒）*/
  restPollingIntervalMs?: number;
  /** 快取配置 */
  cacheConfig?: {
    maxSize?: number;
    staleTresholdMs?: number;
  };
}

/**
 * PriceMonitor 事件
 */
export interface PriceMonitorEvents {
  /** 價格更新事件 */
  'price': (priceData: PriceData) => void;
  /** 數據來源切換事件 */
  'sourceChanged': (exchange: string, oldSource: PriceSource, newSource: PriceSource) => void;
  /** 價格延遲警告 */
  'priceDelay': (exchange: string, symbol: string, delayMs: number) => void;
  /** 錯誤事件 */
  'error': (error: Error) => void;
}

/**
 * PriceMonitor
 *
 * 管理價格數據的監控和快取：
 * - 使用 REST 輪詢獲取價格（WebSocket 可選）
 * - 維護價格快取
 * - 自動檢測數據延遲
 * - 發出價格更新事件
 */
export class PriceMonitor extends EventEmitter {
  private config: Required<Omit<PriceMonitorConfig, 'cacheConfig'>> & {
    cacheConfig: PriceMonitorConfig['cacheConfig'];
  };
  private connectors: Map<string, IExchangeConnector> = new Map();
  private restPollers: Map<string, RestPoller> = new Map();
  private cache: PriceCache;
  private symbols: string[] = [];
  private isRunning = false;

  constructor(
    connectors: IExchangeConnector[],
    symbols: string[],
    config: PriceMonitorConfig = {}
  ) {
    super();

    this.config = {
      enableWebSocket: config.enableWebSocket ?? false, // 先用 REST
      restPollingIntervalMs: config.restPollingIntervalMs ?? 5000, // 5 秒
      cacheConfig: config.cacheConfig,
    };

    this.symbols = symbols;

    // 建立 connector 映射
    for (const connector of connectors) {
      this.connectors.set(connector.name, connector);
    }

    // 初始化快取
    this.cache = new PriceCache(this.config.cacheConfig);

    logger.info({
      exchanges: Array.from(this.connectors.keys()),
      symbols: symbols.length,
      enableWebSocket: this.config.enableWebSocket,
      restPollingIntervalMs: this.config.restPollingIntervalMs,
    }, 'PriceMonitor initialized');
  }

  /**
   * 啟動價格監控
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('PriceMonitor already running');
      return;
    }

    this.isRunning = true;

    logger.info('Starting PriceMonitor');

    // 啟動 REST 輪詢器（備援或主要數據源）
    if (!this.config.enableWebSocket || true) { // 目前先強制使用 REST
      await this.startRestPolling();
    }

    // TODO: 啟動 WebSocket 客戶端（未來實作）
    if (this.config.enableWebSocket) {
      logger.info('WebSocket not yet implemented, using REST polling');
    }

    logger.info('PriceMonitor started');
  }

  /**
   * 停止價格監控
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    logger.info('Stopping PriceMonitor');

    // 停止所有 REST 輪詢器
    for (const [exchange, poller] of this.restPollers.entries()) {
      poller.stop();
      logger.debug({ exchange }, 'REST poller stopped');
    }

    this.restPollers.clear();

    // TODO: 停止 WebSocket 客戶端

    logger.info('PriceMonitor stopped');
  }

  /**
   * 啟動 REST 輪詢
   */
  private async startRestPolling(): Promise<void> {
    for (const [exchangeName, connector] of this.connectors.entries()) {
      try {
        logger.info({
          exchange: exchangeName,
          symbols: this.symbols.length,
        }, 'Starting REST poller');

        const poller = new RestPoller(connector, this.symbols, {
          intervalMs: this.config.restPollingIntervalMs,
          immediate: true,
        });

        // 監聽價格更新
        poller.on('ticker', (priceData: PriceData) => {
          this.handlePriceUpdate(priceData);
        });

        // 監聽錯誤
        poller.on('error', (error: Error) => {
          logger.error({
            exchange: exchangeName,
            error: error.message,
          }, 'REST poller error');
          this.emit('error', error);
        });

        poller.start();
        this.restPollers.set(exchangeName, poller);

        logger.info({
          exchange: exchangeName,
        }, 'REST poller started');
      } catch (error) {
        logger.error({
          exchange: exchangeName,
          error: error instanceof Error ? error.message : String(error),
        }, 'Failed to start REST poller');
      }
    }
  }

  /**
   * 處理價格更新
   */
  private handlePriceUpdate(priceData: PriceData): void {
    // 儲存到快取
    this.cache.set(priceData);

    // 檢查數據延遲
    const now = Date.now();
    const dataAge = now - priceData.timestamp.getTime();

    if (dataAge > 10000) {
      // 超過 10 秒視為延遲
      logger.warn({
        exchange: priceData.exchange,
        symbol: priceData.symbol,
        delayMs: dataAge,
      }, 'Price data delayed');

      this.emit('priceDelay', priceData.exchange, priceData.symbol, dataAge);
    }

    // 發出價格更新事件
    this.emit('price', priceData);

    logger.debug({
      exchange: priceData.exchange,
      symbol: priceData.symbol,
      lastPrice: priceData.lastPrice,
      source: priceData.source,
    }, 'Price updated');
  }

  /**
   * 取得價格數據
   */
  getPrice(exchange: string, symbol: string): PriceData | null {
    return this.cache.get(exchange, symbol);
  }

  /**
   * 取得所有價格數據
   */
  getAllPrices(): PriceData[] {
    return this.cache.getAll();
  }

  /**
   * 取得特定交易所的價格數據
   */
  getPricesByExchange(exchange: string): PriceData[] {
    return this.cache.getByExchange(exchange);
  }

  /**
   * 取得特定交易對的所有交易所價格
   */
  getPricesBySymbol(symbol: string): PriceData[] {
    return this.cache.getBySymbol(symbol);
  }

  /**
   * 檢查數據是否過期
   */
  isPriceStale(exchange: string, symbol: string): boolean {
    return this.cache.isStale(exchange, symbol);
  }

  /**
   * 更新監控的交易對列表
   */
  updateSymbols(symbols: string[]): void {
    this.symbols = symbols;

    // 更新所有 REST 輪詢器的交易對
    for (const [exchange, poller] of this.restPollers.entries()) {
      poller.updateSymbols(symbols);
      logger.debug({
        exchange,
        symbols: symbols.length,
      }, 'Updated poller symbols');
    }

    logger.info({
      symbols: symbols.length,
    }, 'Symbols updated');
  }

  /**
   * 取得快取統計
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  /**
   * 清除過期的快取項目
   */
  evictStaleCache(): number {
    return this.cache.evictStale();
  }

  /**
   * 取得運行狀態
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * 銷毀監控器
   */
  destroy(): void {
    this.stop();
    this.cache.clear();
    this.removeAllListeners();
    logger.info('PriceMonitor destroyed');
  }
}
