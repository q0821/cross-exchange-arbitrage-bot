/**
 * PriceMonitor Service
 *
 * 價格監控服務 - 管理 WebSocket 和 REST 備援
 * Feature: 004-fix-okx-add-price-display
 * Feature: 052-specify-scripts-bash (T019: WebSocket 整合, T054: DataSourceManager 整合)
 */

import { EventEmitter } from 'events';
import type { IExchangeConnector, ExchangeName } from '../../connectors/types.js';
import type { PriceData, PriceSource } from '../../types/service-interfaces.js';
import type { FundingRateReceived } from '../../types/websocket-events.js';
import type { DataSourceSwitchEvent } from '../../types/data-source.js';
import { RestPoller } from '../../lib/rest/RestPoller.js';
import { PriceCache } from '../../lib/cache/PriceCache.js';
import { logger } from '../../lib/logger.js';
import { BinanceFundingWs } from '../websocket/BinanceFundingWs.js';
import { DataSourceManager } from './DataSourceManager.js';

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
  /** WebSocket 數據更新回調（來自 BinanceFundingWs 等） */
  onWebSocketPrice?: (priceData: PriceData) => void;
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
  private config: Required<Omit<PriceMonitorConfig, 'cacheConfig' | 'onWebSocketPrice'>> & {
    cacheConfig: PriceMonitorConfig['cacheConfig'];
    onWebSocketPrice?: PriceMonitorConfig['onWebSocketPrice'];
  };
  private connectors: Map<string, IExchangeConnector> = new Map();
  private restPollers: Map<string, RestPoller> = new Map();
  private cache: PriceCache;
  private symbols: string[] = [];
  private isRunning = false;

  // WebSocket 客戶端 (Feature 052: T019)
  private binanceFundingWs: BinanceFundingWs | null = null;
  private wsConnected = new Map<ExchangeName, boolean>();

  // 數據源管理器 (Feature 052: T054)
  private dataSourceManager: DataSourceManager;

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
      onWebSocketPrice: config.onWebSocketPrice,
    };

    this.symbols = symbols;

    // 建立 connector 映射
    for (const connector of connectors) {
      this.connectors.set(connector.name, connector);
    }

    // 初始化快取
    this.cache = new PriceCache(this.config.cacheConfig);

    // 初始化 DataSourceManager (Feature 052: T054)
    this.dataSourceManager = DataSourceManager.getInstance({
      config: {
        restPollingInterval: this.config.restPollingIntervalMs,
      },
    });

    // 監聽數據源切換事件
    this.setupDataSourceManagerListeners();

    logger.info({
      exchanges: Array.from(this.connectors.keys()),
      symbols: symbols.length,
      enableWebSocket: this.config.enableWebSocket,
      restPollingIntervalMs: this.config.restPollingIntervalMs,
    }, 'PriceMonitor initialized');
  }

  /**
   * 設定 DataSourceManager 事件監聽 (Feature 052: T054)
   */
  private setupDataSourceManagerListeners(): void {
    // 監聽數據源切換事件
    this.dataSourceManager.onSwitch((event: DataSourceSwitchEvent) => {
      logger.info(
        {
          exchange: event.exchange,
          dataType: event.dataType,
          fromMode: event.fromMode,
          toMode: event.toMode,
          reason: event.reason,
        },
        '[PriceMonitor] Data source mode changed'
      );

      // 發送 sourceChanged 事件
      this.emit('sourceChanged', event.exchange, event.fromMode as PriceSource, event.toMode as PriceSource);

      // 處理 WebSocket 恢復嘗試
      if (event.toMode === 'rest' && event.dataType === 'fundingRate') {
        // 如果切換到 REST，可能需要確保 REST poller 正在運行
        this.ensureRestPollerRunning(event.exchange as ExchangeName);
      }
    });

    // 監聯恢復嘗試事件
    this.dataSourceManager.on('recoveryAttempt', async (event: { exchange: ExchangeName; dataType: string }) => {
      if (event.dataType === 'fundingRate') {
        logger.info(
          { exchange: event.exchange },
          '[PriceMonitor] Attempting to recover WebSocket connection'
        );
        await this.tryRecoverWebSocket(event.exchange);
      }
    });
  }

  /**
   * 確保 REST 輪詢器正在運行 (Feature 052: T054)
   */
  private ensureRestPollerRunning(exchange: ExchangeName): void {
    if (!this.restPollers.has(exchange)) {
      const connector = this.connectors.get(exchange);
      if (connector) {
        logger.info({ exchange }, '[PriceMonitor] Starting REST poller as fallback');
        // REST poller 應該在 start() 時就啟動了
      }
    }
  }

  /**
   * 嘗試恢復 WebSocket 連線 (Feature 052: T054)
   */
  private async tryRecoverWebSocket(exchange: ExchangeName): Promise<void> {
    if (exchange === 'binance' && !this.binanceFundingWs?.isReady()) {
      try {
        const success = await this.binanceFundingWs?.tryReconnect();
        if (success) {
          this.dataSourceManager.enableWebSocket(exchange, 'fundingRate');
        }
      } catch (error) {
        logger.error(
          { exchange, error: error instanceof Error ? error.message : String(error) },
          '[PriceMonitor] Failed to recover WebSocket'
        );
      }
    }
    // TODO: 其他交易所的恢復邏輯
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
    // 無論是否啟用 WebSocket，REST 都作為備援
    await this.startRestPolling();

    // 啟動 WebSocket 客戶端 (Feature 052: T019)
    if (this.config.enableWebSocket) {
      await this.startWebSocket();
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

    // 停止 WebSocket 客戶端 (Feature 052: T019)
    await this.stopWebSocket();

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
   * 啟動 WebSocket 客戶端 (Feature 052: T019)
   */
  private async startWebSocket(): Promise<void> {
    logger.info('Starting WebSocket clients for PriceMonitor');

    // 啟動 Binance Funding WebSocket（包含 markPrice）
    try {
      this.binanceFundingWs = new BinanceFundingWs({
        autoReconnect: true,
        enableHealthCheck: true,
        updateSpeed: '1s',
      });

      // 監聽資金費率事件（包含 markPrice）
      this.binanceFundingWs.on('fundingRate', (data: FundingRateReceived) => {
        this.handleWebSocketPriceUpdate(data);
      });

      // 監聯連線事件 (Feature 052: T054 整合 DataSourceManager)
      this.binanceFundingWs.on('connected', () => {
        this.wsConnected.set('binance', true);
        logger.info({ exchange: 'binance' }, 'WebSocket connected');
        // 通知 DataSourceManager WebSocket 已連線
        this.dataSourceManager.enableWebSocket('binance', 'fundingRate');
      });

      this.binanceFundingWs.on('disconnected', () => {
        this.wsConnected.set('binance', false);
        logger.warn({ exchange: 'binance' }, 'WebSocket disconnected');
        // 通知 DataSourceManager WebSocket 已斷線，切換到 REST
        this.dataSourceManager.disableWebSocket('binance', 'fundingRate', 'disconnected');
      });

      this.binanceFundingWs.on('error', (error: Error) => {
        logger.error({
          exchange: 'binance',
          error: error.message,
        }, 'WebSocket error');
        this.emit('error', error);
        // 通知 DataSourceManager WebSocket 錯誤
        this.dataSourceManager.disableWebSocket('binance', 'fundingRate', `error: ${error.message}`);
      });

      // 連接並訂閱
      await this.binanceFundingWs.connect();
      await this.binanceFundingWs.subscribe(this.symbols);

      logger.info({
        exchange: 'binance',
        symbols: this.symbols.length,
      }, 'Binance WebSocket started');
    } catch (error) {
      logger.error({
        exchange: 'binance',
        error: error instanceof Error ? error.message : String(error),
      }, 'Failed to start Binance WebSocket');
    }

    // 其他交易所的 WebSocket 在 Phase 5 (US5) 實作
  }

  /**
   * 停止 WebSocket 客戶端 (Feature 052: T019)
   */
  private async stopWebSocket(): Promise<void> {
    // 停止 Binance WebSocket
    if (this.binanceFundingWs) {
      this.binanceFundingWs.destroy();
      this.binanceFundingWs = null;
      this.wsConnected.set('binance', false);
      logger.info({ exchange: 'binance' }, 'Binance WebSocket stopped');
    }

    this.wsConnected.clear();
  }

  /**
   * 處理 WebSocket 價格更新 (Feature 052: T019)
   *
   * 從 BinanceFundingWs 接收 markPrice 數據
   */
  private handleWebSocketPriceUpdate(data: FundingRateReceived): void {
    // 只有當 markPrice 存在時才更新價格
    if (!data.markPrice) {
      return;
    }

    const priceData: PriceData = {
      exchange: data.exchange,
      symbol: data.symbol,
      lastPrice: data.markPrice.toNumber(),
      markPrice: data.markPrice.toNumber(),
      indexPrice: data.indexPrice?.toNumber(),
      timestamp: data.receivedAt,
      source: 'websocket' as PriceSource,
    };

    // 儲存到快取
    this.cache.set(priceData);

    // 發出價格更新事件
    this.emit('price', priceData);

    // 呼叫回調（如果設定）
    if (this.config.onWebSocketPrice) {
      this.config.onWebSocketPrice(priceData);
    }

    logger.debug({
      exchange: data.exchange,
      symbol: data.symbol,
      markPrice: priceData.markPrice,
      source: 'websocket',
    }, 'WebSocket price updated');
  }

  /**
   * 取得 WebSocket 連線狀態 (Feature 052: T019)
   */
  getWebSocketStatus(): Map<ExchangeName, boolean> {
    return new Map(this.wsConnected);
  }

  /**
   * 檢查 WebSocket 是否已連線 (Feature 052: T019)
   */
  isWebSocketConnected(exchange: ExchangeName): boolean {
    return this.wsConnected.get(exchange) ?? false;
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
