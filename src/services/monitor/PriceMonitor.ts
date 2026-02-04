/**
 * PriceMonitor Service
 *
 * 價格監控服務 - 管理 WebSocket 和 REST 備援
 * Feature: 004-fix-okx-add-price-display
 * Feature: 052-specify-scripts-bash (T019: WebSocket 整合, T054: DataSourceManager 整合)
 */

import { EventEmitter } from 'events';
import Decimal from 'decimal.js';
import type { IExchangeConnector, ExchangeName } from '../../connectors/types.js';
import type { PriceData, PriceSource } from '../../types/service-interfaces.js';
import type { FundingRateReceived } from '../../types/websocket-events.js';
import type { DataSourceSwitchEvent } from '../../types/data-source.js';
import { RestPoller } from '../../lib/rest/RestPoller.js';
import { PriceCache } from '../../lib/cache/PriceCache.js';
import { logger } from '../../lib/logger.js';
import { BinanceFundingWs } from '../websocket/BinanceFundingWs.js';
// Feature 054: 原生 WebSocket 客戶端
import { OkxFundingWs } from '../websocket/OkxFundingWs.js';
import { GateioFundingWs } from '../websocket/GateioFundingWs.js';
import { BingxFundingWs } from '../websocket/BingxFundingWs.js';
import { DataSourceManager } from './DataSourceManager.js';
import { FundingIntervalCache } from '../../lib/FundingIntervalCache.js';
import type { DataStructureStats, Monitorable } from '../../types/memory-stats.js';
import { getEventEmitterStats } from '../../lib/event-emitter-stats.js';
import { DataStructureRegistry } from '../../lib/data-structure-registry.js';

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
export class PriceMonitor extends EventEmitter implements Monitorable {
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
  // Feature 054: 原生 WebSocket 客戶端
  private okxFundingWs: OkxFundingWs | null = null;
  private gateioFundingWs: GateioFundingWs | null = null;
  private bingxFundingWs: BingxFundingWs | null = null;
  private wsConnected = new Map<ExchangeName, boolean>();

  // 數據源管理器 (Feature 052: T054)
  private dataSourceManager: DataSourceManager;

  // BingX REST fallback (Issue #25: 超出 WebSocket 訂閱限制的 symbols)
  private bingxRestFallbackInterval: NodeJS.Timeout | null = null;
  private bingxRestFallbackSymbols: string[] = [];

  // T012-T014 (Feature 066): 儲存 handler 參考以便在 stop() 時移除
  private restPollerHandlers: Map<string, { onTicker: (data: PriceData) => void; onError: (error: Error) => void }> = new Map();
  // 注意: WebSocket handlers 透過 destroy() 自動清理，不需要手動移除
  private dataSourceManagerHandlers: {
    onSwitch?: (event: DataSourceSwitchEvent) => void;
    onRecoveryAttempt?: (event: { exchange: ExchangeName; dataType: string }) => void;
  } = {};

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

    // Feature 066: 註冊到 DataStructureRegistry
    DataStructureRegistry.register('PriceMonitor', this);
  }

  /**
   * 取得資料結構統計資訊
   * Feature: 066-memory-monitoring
   */
  getDataStructureStats(): DataStructureStats {
    const emitterStats = getEventEmitterStats(this);

    // 計算連線數量
    let wsClientCount = 0;
    if (this.binanceFundingWs) wsClientCount++;
    if (this.okxFundingWs) wsClientCount++;
    if (this.gateioFundingWs) wsClientCount++;
    if (this.bingxFundingWs) wsClientCount++;

    // 統計 WebSocket 連線狀態
    const wsConnectedCount = Array.from(this.wsConnected.values()).filter(v => v).length;

    return {
      name: 'PriceMonitor',
      sizes: {
        connectors: this.connectors.size,
        restPollers: this.restPollers.size,
        wsClients: wsClientCount,
        wsConnected: wsConnectedCount,
        symbols: this.symbols.length,
      },
      totalItems: this.connectors.size + this.restPollers.size + wsClientCount + this.symbols.length,
      eventListenerCount: emitterStats.totalListeners,
      details: {
        listenersByEvent: emitterStats.listenersByEvent,
        isRunning: this.isRunning,
        enableWebSocket: this.config.enableWebSocket,
        cacheSize: this.cache.size(),
        restPollerHandlersCount: this.restPollerHandlers.size,
      },
    };
  }

  /**
   * 設定 DataSourceManager 事件監聯 (Feature 052: T054)
   * T012-T014 (Feature 066): 使用命名 handler 以便在 stop() 時移除
   */
  private setupDataSourceManagerListeners(): void {
    // T012-T014: 建立命名 handler 並儲存參考
    this.dataSourceManagerHandlers.onSwitch = (event: DataSourceSwitchEvent) => {
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
    };

    this.dataSourceManagerHandlers.onRecoveryAttempt = async (event: { exchange: ExchangeName; dataType: string }) => {
      if (event.dataType === 'fundingRate') {
        logger.info(
          { exchange: event.exchange },
          '[PriceMonitor] Attempting to recover WebSocket connection'
        );
        await this.tryRecoverWebSocket(event.exchange);
      }
    };

    // 註冊監聽器
    this.dataSourceManager.onSwitch(this.dataSourceManagerHandlers.onSwitch);
    this.dataSourceManager.on('recoveryAttempt', this.dataSourceManagerHandlers.onRecoveryAttempt);
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
   * 嘗試恢復 WebSocket 連線 (Feature 054: 使用原生客戶端)
   */
  private async tryRecoverWebSocket(exchange: ExchangeName): Promise<void> {
    try {
      switch (exchange) {
        case 'binance':
          if (this.binanceFundingWs && !this.binanceFundingWs.isReady()) {
            const success = await this.binanceFundingWs.tryReconnect();
            if (success) {
              this.dataSourceManager.enableWebSocket(exchange, 'fundingRate');
              logger.info({ exchange }, '[PriceMonitor] Binance WebSocket recovered');
            }
          }
          break;

        case 'okx':
          if (this.okxFundingWs && !this.okxFundingWs.isReady()) {
            const success = await this.okxFundingWs.tryReconnect();
            if (success) {
              this.dataSourceManager.enableWebSocket(exchange, 'fundingRate');
              logger.info({ exchange }, '[PriceMonitor] OKX WebSocket recovered');
            }
          }
          break;

        case 'gateio':
          if (this.gateioFundingWs && !this.gateioFundingWs.isReady()) {
            const success = await this.gateioFundingWs.tryReconnect();
            if (success) {
              this.dataSourceManager.enableWebSocket(exchange, 'fundingRate');
              logger.info({ exchange }, '[PriceMonitor] Gate.io WebSocket recovered');
            }
          }
          break;

        case 'bingx':
          if (this.bingxFundingWs && !this.bingxFundingWs.isReady()) {
            const success = await this.bingxFundingWs.tryReconnect();
            if (success) {
              this.dataSourceManager.enableWebSocket(exchange, 'fundingRate');
              logger.info({ exchange }, '[PriceMonitor] BingX WebSocket recovered');
            }
          }
          break;

        case 'mexc': {
          // MEXC 仍使用 CCXT connector
          const connector = this.connectors.get('mexc');
          if (!connector) {
            logger.warn({ exchange }, '[PriceMonitor] MEXC connector not available for recovery');
            return;
          }
          for (const symbol of this.symbols) {
            await connector.subscribeWS({
              type: 'fundingRate',
              symbol,
              callback: (data: unknown) => {
                this.handleConnectorWebSocketUpdate('mexc', data as FundingRateReceived);
              },
              onError: (error: Error) => {
                logger.error({ exchange: 'mexc', error: error.message }, 'MEXC WebSocket recovery error');
                this.emit('error', error);
              },
            });
          }
          logger.info({ exchange }, '[PriceMonitor] MEXC WebSocket recovered');
          break;
        }

        default:
          logger.warn({ exchange }, '[PriceMonitor] Unknown exchange for WebSocket recovery');
      }
    } catch (error) {
      logger.error(
        { exchange, error: error instanceof Error ? error.message : String(error) },
        '[PriceMonitor] Failed to recover WebSocket'
      );
    }
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
   * T012-T014 (Feature 066): 在停止時移除所有監聽器
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      // T012-T014: 即使未運行，仍需清理監聽器（冪等操作）
      this.cleanupListeners();
      return;
    }

    this.isRunning = false;

    logger.info('Stopping PriceMonitor');

    // T012-T014: 先移除 REST poller 監聯器再停止
    for (const [exchange, poller] of this.restPollers.entries()) {
      const handlers = this.restPollerHandlers.get(exchange);
      if (handlers) {
        poller.off('ticker', handlers.onTicker);
        poller.off('error', handlers.onError);
      }
      poller.stop();
      logger.debug({ exchange }, 'REST poller stopped with listeners removed');
    }

    this.restPollers.clear();
    this.restPollerHandlers.clear();

    // 停止 WebSocket 客戶端 (Feature 052: T019)
    await this.stopWebSocket();

    // 停止 BingX REST fallback (Issue #25)
    this.stopBingxRestFallback();

    // T012-T014: 清理 DataSourceManager 監聯器
    this.cleanupListeners();

    logger.info('PriceMonitor stopped');
  }

  /**
   * T012-T014 (Feature 066): 清理所有監聽器
   */
  private cleanupListeners(): void {
    // 移除 DataSourceManager 監聯器
    if (this.dataSourceManagerHandlers.onSwitch) {
      this.dataSourceManager.offSwitch(this.dataSourceManagerHandlers.onSwitch);
      this.dataSourceManagerHandlers.onSwitch = undefined;
    }
    if (this.dataSourceManagerHandlers.onRecoveryAttempt) {
      this.dataSourceManager.off('recoveryAttempt', this.dataSourceManagerHandlers.onRecoveryAttempt);
      this.dataSourceManagerHandlers.onRecoveryAttempt = undefined;
    }

    logger.debug('[PriceMonitor] DataSourceManager listeners removed');
  }

  /**
   * 啟動 REST 輪詢
   */
  /**
   * T012-T014 (Feature 066): 使用命名 handler 以便在 stop() 時移除
   */
  private async startRestPolling(): Promise<void> {
    for (const [exchangeName, connector] of this.connectors.entries()) {
      try {
        // MEXC 有嚴格的 rate limit，需要使用較長的輪詢間隔
        const pollingInterval = exchangeName === 'mexc'
          ? Math.max(this.config.restPollingIntervalMs, 30000) // MEXC 至少 30 秒
          : this.config.restPollingIntervalMs;

        logger.info({
          exchange: exchangeName,
          symbols: this.symbols.length,
          intervalMs: pollingInterval,
        }, 'Starting REST poller');

        const poller = new RestPoller(connector, this.symbols, {
          intervalMs: pollingInterval,
          immediate: true,
        });

        // T012-T014: 建立命名 handler 並儲存參考
        const onTicker = (priceData: PriceData) => {
          this.handlePriceUpdate(priceData);
        };

        const onError = (error: Error) => {
          // 交易對不存在的錯誤降級為 debug
          const isSymbolNotFound = error.message.includes('does not have market symbol') ||
            error.message.includes("doesn't exist") ||
            error.message.includes('symbol not found');
          const isRateLimit = error.message.includes('too frequent') ||
            error.message.includes('rate limit') ||
            error.message.includes('429') ||
            error.message.includes('Too Many') ||
            error.message.includes('code":510');

          if (isSymbolNotFound) {
            logger.debug({
              exchange: exchangeName,
              error: error.message,
            }, 'Symbol not available on exchange');
          } else if (isRateLimit) {
            logger.warn({ exchange: exchangeName }, 'REST poller rate limited');
          } else {
            logger.error({
              exchange: exchangeName,
              error: error.message,
            }, 'REST poller error');
          }
          this.emit('error', error);
        };

        // 儲存 handler 參考
        this.restPollerHandlers.set(exchangeName, { onTicker, onError });

        // 註冊監聽器
        poller.on('ticker', onTicker);
        poller.on('error', onError);

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
        // 更新 DataSourceManager 數據接收時間
        this.dataSourceManager.updateLastDataReceived('binance', 'fundingRate');
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

    // 啟動 OKX WebSocket (Feature 054: 原生客戶端)
    await this.startOkxWebSocket();

    // 啟動 Gate.io WebSocket (Feature 054: 原生客戶端)
    await this.startGateioWebSocket();

    // 啟動 BingX WebSocket (Feature 054: 原生客戶端)
    // 只有當 bingx 在 connectors 中時才啟動
    if (this.connectors.has('bingx')) {
      await this.startBingxWebSocket();
    }

    // 啟動 MEXC WebSocket (Feature 052: T019 - 仍使用 CCXT)
    await this.startMexcWebSocket();
  }

  /**
   * 啟動 OKX WebSocket (Feature 054: 使用原生 WebSocket 客戶端)
   */
  private async startOkxWebSocket(): Promise<void> {
    try {
      this.okxFundingWs = new OkxFundingWs({
        autoReconnect: true,
        enableHealthCheck: true,
      });

      // 監聽資金費率事件
      this.okxFundingWs.on('fundingRate', (data: FundingRateReceived) => {
        this.handleWebSocketPriceUpdate(data);
        // 更新 DataSourceManager 數據接收時間
        this.dataSourceManager.updateLastDataReceived('okx', 'fundingRate');
      });

      // 監聽標記價格事件（用於保持連線活躍狀態）
      // OKX funding-rate 推送頻率很低（每 8 小時結算前），但 mark-price 每秒推送
      // 透過監聽 markPrice 來更新 lastDataReceivedAt，避免誤判為 stale
      this.okxFundingWs.on('markPrice', () => {
        this.dataSourceManager.updateLastDataReceived('okx', 'fundingRate');
      });

      // 監聽連線事件
      this.okxFundingWs.on('connected', () => {
        this.wsConnected.set('okx', true);
        logger.info({ exchange: 'okx' }, 'OKX WebSocket connected');
        this.dataSourceManager.enableWebSocket('okx', 'fundingRate');
      });

      this.okxFundingWs.on('disconnected', () => {
        this.wsConnected.set('okx', false);
        logger.warn({ exchange: 'okx' }, 'OKX WebSocket disconnected');
        this.dataSourceManager.disableWebSocket('okx', 'fundingRate', 'disconnected');
      });

      this.okxFundingWs.on('error', (error: Error) => {
        // 交易對不存在的錯誤降級為 debug
        const isSymbolNotFound = error.message.includes('60018') ||
          error.message.includes("doesn't exist") ||
          error.message.includes('does not have market symbol');

        if (isSymbolNotFound) {
          logger.debug({ exchange: 'okx', error: error.message }, 'OKX symbol not available');
        } else {
          logger.error({ exchange: 'okx', error: error.message }, 'OKX WebSocket error');
          this.dataSourceManager.disableWebSocket('okx', 'fundingRate', `error: ${error.message}`);
        }
        this.emit('error', error);
      });

      // 連接並訂閱
      await this.okxFundingWs.connect();
      await this.okxFundingWs.subscribe(this.symbols);

      logger.info({ exchange: 'okx', symbols: this.symbols.length }, 'OKX WebSocket started');
    } catch (error) {
      logger.error({
        exchange: 'okx',
        error: error instanceof Error ? error.message : String(error),
      }, 'Failed to start OKX WebSocket');
    }
  }

  /**
   * 啟動 Gate.io WebSocket (Feature 054: 使用原生 WebSocket 客戶端)
   *
   * 注意：傳遞共享的 FundingIntervalCache 單例，讓 WebSocket 能查詢
   * GateioConnector 透過 REST API 取得的動態結算週期（1h, 4h, 8h）
   */
  private async startGateioWebSocket(): Promise<void> {
    try {
      this.gateioFundingWs = new GateioFundingWs({
        autoReconnect: true,
        enableHealthCheck: true,
        // 使用共享的 FundingIntervalCache 單例
        intervalCache: FundingIntervalCache.getInstance(),
      });

      // 監聽資金費率事件
      this.gateioFundingWs.on('fundingRate', (data: FundingRateReceived) => {
        this.handleWebSocketPriceUpdate(data);
        // 更新 DataSourceManager 數據接收時間
        this.dataSourceManager.updateLastDataReceived('gateio', 'fundingRate');
      });

      // 監聽連線事件
      this.gateioFundingWs.on('connected', () => {
        this.wsConnected.set('gateio', true);
        logger.info({ exchange: 'gateio' }, 'Gate.io WebSocket connected');
        this.dataSourceManager.enableWebSocket('gateio', 'fundingRate');
      });

      this.gateioFundingWs.on('disconnected', () => {
        this.wsConnected.set('gateio', false);
        logger.warn({ exchange: 'gateio' }, 'Gate.io WebSocket disconnected');
        this.dataSourceManager.disableWebSocket('gateio', 'fundingRate', 'disconnected');
      });

      this.gateioFundingWs.on('error', (error: Error) => {
        logger.error({ exchange: 'gateio', error: error.message }, 'Gate.io WebSocket error');
        this.emit('error', error);
        this.dataSourceManager.disableWebSocket('gateio', 'fundingRate', `error: ${error.message}`);
      });

      // 連接並訂閱
      await this.gateioFundingWs.connect();
      await this.gateioFundingWs.subscribe(this.symbols);

      logger.info({ exchange: 'gateio', symbols: this.symbols.length }, 'Gate.io WebSocket started');
    } catch (error) {
      logger.error({
        exchange: 'gateio',
        error: error instanceof Error ? error.message : String(error),
      }, 'Failed to start Gate.io WebSocket');
    }
  }

  /**
   * 啟動 BingX WebSocket (Feature 054: 使用原生 WebSocket 客戶端)
   */
  private async startBingxWebSocket(): Promise<void> {
    try {
      this.bingxFundingWs = new BingxFundingWs({
        autoReconnect: true,
        enableHealthCheck: true,
      });

      // 監聽資金費率事件
      this.bingxFundingWs.on('fundingRate', (data: FundingRateReceived) => {
        this.handleWebSocketPriceUpdate(data);
        // 更新 DataSourceManager 數據接收時間
        this.dataSourceManager.updateLastDataReceived('bingx', 'fundingRate');
      });

      // 監聽連線事件
      this.bingxFundingWs.on('connected', () => {
        this.wsConnected.set('bingx', true);
        logger.info({ exchange: 'bingx' }, 'BingX WebSocket connected');
        this.dataSourceManager.enableWebSocket('bingx', 'fundingRate');
      });

      this.bingxFundingWs.on('disconnected', () => {
        this.wsConnected.set('bingx', false);
        logger.warn({ exchange: 'bingx' }, 'BingX WebSocket disconnected');
        this.dataSourceManager.disableWebSocket('bingx', 'fundingRate', 'disconnected');
      });

      this.bingxFundingWs.on('error', (error: Error) => {
        logger.error({ exchange: 'bingx', error: error.message }, 'BingX WebSocket error');
        this.emit('error', error);
        this.dataSourceManager.disableWebSocket('bingx', 'fundingRate', `error: ${error.message}`);
      });

      // 監聽被跳過的 symbols 事件（Issue #25: WebSocket 訂閱限制）
      this.bingxFundingWs.on('skippedSymbols', (skippedSymbols: string[]) => {
        logger.info(
          { exchange: 'bingx', skippedCount: skippedSymbols.length },
          'Starting REST API fallback for skipped BingX symbols'
        );
        this.startBingxRestFallback(skippedSymbols);
      });

      // 連接並訂閱
      await this.bingxFundingWs.connect();
      await this.bingxFundingWs.subscribe(this.symbols);

      logger.info({ exchange: 'bingx', symbols: this.symbols.length }, 'BingX WebSocket started');
    } catch (error) {
      logger.error({
        exchange: 'bingx',
        error: error instanceof Error ? error.message : String(error),
      }, 'Failed to start BingX WebSocket');
    }
  }

  /**
   * 啟動 BingX REST API fallback（用於超出 WebSocket 訂閱限制的 symbols）
   * Issue #25: BingX WebSocket 最多 50 個訂閱，超出部分使用 REST API 輪詢
   */
  private startBingxRestFallback(symbols: string[]): void {
    const connector = this.connectors.get('bingx');
    if (!connector) {
      logger.warn('BingX connector not available for REST fallback');
      return;
    }

    this.bingxRestFallbackSymbols = symbols;

    // 每 30 秒輪詢一次（避免過於頻繁）
    const POLLING_INTERVAL = 30000;

    const pollFundingRates = async () => {
      for (const symbol of this.bingxRestFallbackSymbols) {
        try {
          const rate = await connector.getFundingRate(symbol);
          if (rate) {
            const data: FundingRateReceived = {
              exchange: 'bingx',
              symbol,
              fundingRate: new Decimal(rate.fundingRate),
              nextFundingTime: rate.nextFundingTime,
              markPrice: rate.markPrice !== undefined ? new Decimal(rate.markPrice) : undefined,
              indexPrice: rate.indexPrice !== undefined ? new Decimal(rate.indexPrice) : undefined,
              fundingInterval: rate.fundingInterval,
              source: 'rest',
              receivedAt: new Date(),
            };
            this.handleWebSocketPriceUpdate(data);
          }
        } catch (error) {
          logger.debug(
            { exchange: 'bingx', symbol, error: error instanceof Error ? error.message : String(error) },
            'BingX REST fallback failed for symbol'
          );
        }
      }
    };

    // 立即執行一次
    pollFundingRates();

    // 設定定時輪詢
    this.bingxRestFallbackInterval = setInterval(pollFundingRates, POLLING_INTERVAL);

    logger.info(
      { exchange: 'bingx', symbolCount: symbols.length, intervalMs: POLLING_INTERVAL },
      'BingX REST fallback started'
    );
  }

  /**
   * 停止 BingX REST API fallback
   */
  private stopBingxRestFallback(): void {
    if (this.bingxRestFallbackInterval) {
      clearInterval(this.bingxRestFallbackInterval);
      this.bingxRestFallbackInterval = null;
      this.bingxRestFallbackSymbols = [];
      logger.info({ exchange: 'bingx' }, 'BingX REST fallback stopped');
    }
  }

  /**
   * 啟動 MEXC WebSocket (Feature 052: T019 - 仍使用 CCXT)
   */
  private async startMexcWebSocket(): Promise<void> {
    const connector = this.connectors.get('mexc');
    if (!connector) {
      logger.debug('MEXC connector not available, skipping WebSocket');
      return;
    }

    try {
      // 為每個交易對訂閱資金費率
      for (const symbol of this.symbols) {
        await connector.subscribeWS({
          type: 'fundingRate',
          symbol,
          callback: (data: unknown) => {
            this.handleConnectorWebSocketUpdate('mexc', data as FundingRateReceived);
          },
          onError: (error: Error) => {
            logger.error({ exchange: 'mexc', error: error.message }, 'MEXC WebSocket error');
            this.emit('error', error);
          },
        });
      }

      // 監聽連線事件 (使用 EventEmitter 介面)
      const mexcEmitter = connector as unknown as NodeJS.EventEmitter;
      mexcEmitter.on('wsConnected', () => {
        this.wsConnected.set('mexc', true);
        logger.info({ exchange: 'mexc' }, 'MEXC WebSocket connected');
        this.dataSourceManager.enableWebSocket('mexc', 'fundingRate');
      });

      mexcEmitter.on('wsDisconnected', () => {
        this.wsConnected.set('mexc', false);
        logger.warn({ exchange: 'mexc' }, 'MEXC WebSocket disconnected');
        this.dataSourceManager.disableWebSocket('mexc', 'fundingRate', 'disconnected');
      });

      logger.info({ exchange: 'mexc', symbols: this.symbols.length }, 'MEXC WebSocket started');
    } catch (error) {
      logger.error({
        exchange: 'mexc',
        error: error instanceof Error ? error.message : String(error),
      }, 'Failed to start MEXC WebSocket');
    }
  }

  /**
   * 處理來自 Connector 的 WebSocket 更新 (Feature 052: T019)
   */
  private handleConnectorWebSocketUpdate(exchange: ExchangeName, data: FundingRateReceived): void {
    // 只有當 markPrice 存在時才更新價格
    if (!data.markPrice) {
      return;
    }

    const priceData: PriceData = {
      exchange,
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

    // 更新 DataSourceManager 數據接收時間
    this.dataSourceManager.updateLastDataReceived(exchange, 'fundingRate');

    logger.debug({
      exchange,
      symbol: data.symbol,
      markPrice: priceData.markPrice,
      source: 'websocket',
    }, 'Connector WebSocket price updated');
  }

  /**
   * 停止 WebSocket 客戶端 (Feature 054: 使用原生客戶端)
   */
  private async stopWebSocket(): Promise<void> {
    // 停止 Binance WebSocket
    if (this.binanceFundingWs) {
      this.binanceFundingWs.destroy();
      this.binanceFundingWs = null;
      this.wsConnected.set('binance', false);
      logger.info({ exchange: 'binance' }, 'Binance WebSocket stopped');
    }

    // 停止 OKX WebSocket (Feature 054: 原生客戶端)
    if (this.okxFundingWs) {
      this.okxFundingWs.destroy();
      this.okxFundingWs = null;
      this.wsConnected.set('okx', false);
      logger.info({ exchange: 'okx' }, 'OKX WebSocket stopped');
    }

    // 停止 Gate.io WebSocket (Feature 054: 原生客戶端)
    if (this.gateioFundingWs) {
      this.gateioFundingWs.destroy();
      this.gateioFundingWs = null;
      this.wsConnected.set('gateio', false);
      logger.info({ exchange: 'gateio' }, 'Gate.io WebSocket stopped');
    }

    // 停止 BingX WebSocket (Feature 054: 原生客戶端)
    if (this.bingxFundingWs) {
      this.bingxFundingWs.destroy();
      this.bingxFundingWs = null;
      this.wsConnected.set('bingx', false);
      logger.info({ exchange: 'bingx' }, 'BingX WebSocket stopped');
    }

    // 停止 MEXC WebSocket (Feature 052: T019 - 仍使用 CCXT)
    const mexcConnector = this.connectors.get('mexc');
    if (mexcConnector && this.wsConnected.get('mexc')) {
      try {
        await mexcConnector.unsubscribeWS('fundingRate');
        this.wsConnected.set('mexc', false);
        logger.info({ exchange: 'mexc' }, 'MEXC WebSocket stopped');
      } catch (error) {
        logger.error({ exchange: 'mexc', error: error instanceof Error ? error.message : String(error) }, 'Failed to stop MEXC WebSocket');
      }
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
    // Feature 066: 從 DataStructureRegistry 取消註冊
    DataStructureRegistry.unregister('PriceMonitor');

    this.stop();
    this.cache.clear();
    this.removeAllListeners();
    logger.info('PriceMonitor destroyed');
  }
}
