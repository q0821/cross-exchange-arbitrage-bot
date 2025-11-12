import { EventEmitter } from 'events';
import { createExchange } from '../../connectors/factory';
import type { IExchangeConnector, ExchangeName } from '../../connectors/types';
import {
  FundingRateRecord,
  FundingRateStore,
  FundingRatePair,
  ExchangeRateData,
} from '../../models/FundingRate';
import { RateDifferenceCalculator } from './RateDifferenceCalculator';
import { MonitorStatsTracker } from './MonitorStats';
import type { MonitorStats } from './MonitorStats';
import { logger } from '../../lib/logger';
import type { IFundingRateValidator, PriceData } from '../../types/service-interfaces';
import { ratesCache } from './RatesCache';
import { PriceMonitor } from './PriceMonitor.js';
import { ArbitrageAssessor, type ArbitrageConfig, type ArbitrageAssessment } from '../assessment/ArbitrageAssessor.js';

/**
 * 監控狀態
 */
export interface MonitorStatus {
  isRunning: boolean;
  symbols: string[];
  updateInterval: number;
  lastUpdate: Date | null;
  totalUpdates: number;
  errors: number;
  connectedExchanges: string[];
}

/**
 * 監控事件
 */
export interface MonitorEvents {
  'rate-updated': (pair: FundingRatePair) => void;
  'opportunity-detected': (pair: FundingRatePair) => void;
  'opportunity-disappeared': (symbol: string) => void;
  'arbitrage-feasible': (assessment: ArbitrageAssessment) => void;
  'error': (error: Error) => void;
  'status-changed': (status: MonitorStatus) => void;
}

/**
 * 資金費率監控服務
 * 負責定期從多個交易所獲取資金費率並計算差異
 */
export class FundingRateMonitor extends EventEmitter {
  private exchanges: Map<ExchangeName, IExchangeConnector> = new Map();
  private exchangeNames: ExchangeName[];
  private store: FundingRateStore;
  private calculator: RateDifferenceCalculator;
  private statsTracker: MonitorStatsTracker;
  private validator?: IFundingRateValidator; // 可選的資金費率驗證器
  private priceMonitor?: PriceMonitor; // 可選的價格監控器
  private arbitrageAssessor?: ArbitrageAssessor; // 可選的套利評估器

  private symbols: string[];
  private updateInterval: number; // 毫秒
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private activeOpportunities = new Set<string>(); // 追蹤當前活躍的套利機會
  private enableValidation = false; // 驗證功能開關
  private enablePriceMonitor = false; // 價格監控開關
  private enableArbitrageAssessment = false; // 套利評估開關
  private arbitrageCapital = 10000; // 預設資金量（USDT）

  private status: MonitorStatus = {
    isRunning: false,
    symbols: [],
    updateInterval: 0,
    lastUpdate: null,
    totalUpdates: 0,
    errors: 0,
    connectedExchanges: [],
  };

  constructor(
    symbols: string[] = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
    updateInterval = 5000,
    minSpreadThreshold = 0.005,
    isTestnet = false,
    options?: {
      validator?: IFundingRateValidator;
      enableValidation?: boolean;
      enablePriceMonitor?: boolean; // 啟用價格監控
      enableArbitrageAssessment?: boolean; // 啟用套利評估
      arbitrageCapital?: number; // 套利資金量（USDT）
      arbitrageConfig?: Partial<ArbitrageConfig>; // 套利配置
      exchanges?: ExchangeName[]; // 支持自定義交易所列表
    }
  ) {
    super();

    this.symbols = symbols;
    this.updateInterval = updateInterval;

    // 從選項中獲取交易所列表，預設為 binance, okx, mexc, gateio
    this.exchangeNames = options?.exchanges || ['binance', 'okx', 'mexc', 'gateio'];

    // 創建所有交易所的連接器
    for (const exchangeName of this.exchangeNames) {
      const connector = createExchange(exchangeName, isTestnet);
      this.exchanges.set(exchangeName, connector);
    }

    this.store = new FundingRateStore();
    this.calculator = new RateDifferenceCalculator(minSpreadThreshold);
    this.statsTracker = new MonitorStatsTracker();

    // 設定驗證器
    this.validator = options?.validator;
    this.enableValidation = options?.enableValidation ?? false;

    // 設定價格監控器
    this.enablePriceMonitor = options?.enablePriceMonitor ?? false;
    if (this.enablePriceMonitor) {
      const connectors = Array.from(this.exchanges.values());
      this.priceMonitor = new PriceMonitor(connectors, symbols, {
        enableWebSocket: false, // 目前只使用 REST
        restPollingIntervalMs: updateInterval,
      });

      // 監聽價格更新事件
      this.priceMonitor.on('price', (priceData: PriceData) => {
        logger.debug({
          exchange: priceData.exchange,
          symbol: priceData.symbol,
          lastPrice: priceData.lastPrice,
        }, 'Price updated from PriceMonitor');
      });

      this.priceMonitor.on('error', (error: Error) => {
        logger.error({
          error: error.message,
        }, 'PriceMonitor error');
      });
    }

    // 設定套利評估器
    this.enableArbitrageAssessment = options?.enableArbitrageAssessment ?? false;
    this.arbitrageCapital = options?.arbitrageCapital ?? 10000;
    if (this.enableArbitrageAssessment) {
      this.arbitrageAssessor = new ArbitrageAssessor(options?.arbitrageConfig);
      logger.info({
        arbitrageCapital: this.arbitrageCapital,
      }, 'Arbitrage assessment enabled');
    }

    this.status.symbols = symbols;
    this.status.updateInterval = updateInterval;

    logger.info({
      symbols,
      updateInterval,
      minSpreadThreshold,
      isTestnet,
      exchanges: this.exchangeNames,
      enableValidation: this.enableValidation,
      enablePriceMonitor: this.enablePriceMonitor,
      enableArbitrageAssessment: this.enableArbitrageAssessment,
    }, 'FundingRateMonitor initialized');
  }

  /**
   * 啟動監控
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Monitor is already running');
      return;
    }

    try {
      logger.info('Starting funding rate monitor...');

      // 並行連接所有交易所
      const connectionPromises = Array.from(this.exchanges.entries()).map(
        async ([name, connector]) => {
          try {
            await connector.connect();
            logger.info({ exchange: name }, 'Exchange connected');
            return name;
          } catch (error) {
            logger.error({
              exchange: name,
              error: error instanceof Error ? error.message : String(error),
            }, 'Failed to connect exchange');
            throw error;
          }
        }
      );

      await Promise.all(connectionPromises);

      this.status.connectedExchanges = this.exchangeNames;
      this.isRunning = true;
      this.status.isRunning = true;

      // 標記 RatesCache 啟動時間
      ratesCache.markStart();

      // 啟動價格監控器（如果啟用）
      if (this.enablePriceMonitor && this.priceMonitor) {
        await this.priceMonitor.start();
        logger.info('PriceMonitor started');
      }

      // 立即執行一次更新
      await this.updateRates();

      // 設定定期更新
      this.intervalId = setInterval(() => {
        this.updateRates().catch((error) => {
          logger.error({
            error: error instanceof Error ? error.message : String(error),
          }, 'Failed to update rates in interval');
          this.emit('error', error);
        });
      }, this.updateInterval);

      logger.info({
        symbols: this.symbols,
        interval: this.updateInterval,
        exchanges: this.exchangeNames,
      }, 'Funding rate monitor started');

      this.emit('status-changed', this.getStatus());
    } catch (error) {
      this.isRunning = false;
      this.status.isRunning = false;
      logger.error({
        error: error instanceof Error ? error.message : String(error),
      }, 'Failed to start monitor');
      throw error;
    }
  }

  /**
   * 停止監控
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Monitor is not running');
      return;
    }

    logger.info('Stopping funding rate monitor...');

    // 清除定時器
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // 停止價格監控器（如果啟用）
    if (this.enablePriceMonitor && this.priceMonitor) {
      await this.priceMonitor.stop();
      logger.info('PriceMonitor stopped');
    }

    // 並行斷開所有交易所連線
    const disconnectionPromises = Array.from(this.exchanges.entries()).map(
      async ([name, connector]) => {
        try {
          await connector.disconnect();
          logger.info({ exchange: name }, 'Exchange disconnected');
        } catch (error) {
          logger.error({
            exchange: name,
            error: error instanceof Error ? error.message : String(error),
          }, 'Failed to disconnect exchange');
        }
      }
    );

    await Promise.allSettled(disconnectionPromises);

    this.isRunning = false;
    this.status.isRunning = false;
    this.status.connectedExchanges = [];

    logger.info('Funding rate monitor stopped');
    this.emit('status-changed', this.getStatus());
  }

  /**
   * 更新資金費率
   */
  private async updateRates(): Promise<void> {
    try {
      logger.debug({ symbols: this.symbols }, 'Updating funding rates');

      // 並行獲取所有交易對的資金費率
      const results = await Promise.allSettled(
        this.symbols.map((symbol) => this.updateRateForSymbol(symbol))
      );

      // 統計成功和失敗的數量
      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      // 更新統計追蹤器
      this.statsTracker.increment('totalUpdates')
      if (failed > 0) {
        this.statsTracker.increment('errorCount', failed)
      }

      // 保持舊的 status 物件同步（向後相容）
      this.status.totalUpdates++;
      this.status.errors += failed;
      this.status.lastUpdate = new Date();

      logger.info({
        succeeded,
        failed,
        total: this.symbols.length,
      }, 'Funding rates updated');

      // 記錄失敗的更新
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          logger.error({
            symbol: this.symbols[index],
            error: result.reason,
          }, 'Failed to update rate for symbol');
        }
      });
    } catch (error) {
      this.status.errors++;
      this.statsTracker.increment('errorCount')
      logger.error({
        error: error instanceof Error ? error.message : String(error),
      }, 'Failed to update rates');
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * 更新單一交易對的資金費率（多交易所版本）
   */
  private async updateRateForSymbol(symbol: string): Promise<void> {
    // 並行獲取所有交易所的資金費率和價格
    const dataPromises = Array.from(this.exchanges.entries()).map(
      async ([exchangeName, connector]) => {
        try {
          const [rateData, priceData] = await Promise.all([
            connector.getFundingRate(symbol),
            connector.getPrice(symbol).catch(() => null), // 價格獲取失敗不影響主流程
          ]);

          const rate = new FundingRateRecord(rateData);
          const price = priceData?.price;

          // 儲存到記憶體
          this.store.save(rate);

          return {
            exchangeName,
            data: { rate, price } as ExchangeRateData,
          };
        } catch (error) {
          logger.warn({
            exchange: exchangeName,
            symbol,
            error: error instanceof Error ? error.message : String(error),
          }, 'Failed to fetch rate for exchange');
          return null;
        }
      }
    );

    const results = await Promise.all(dataPromises);

    // 過濾掉失敗的請求，建立 exchangesData Map
    const exchangesData = new Map<ExchangeName, ExchangeRateData>();
    for (const result of results) {
      if (result) {
        exchangesData.set(result.exchangeName, result.data);
      }
    }

    // 至少需要 2 個交易所的數據才能計算套利
    if (exchangesData.size < 2) {
      logger.warn({
        symbol,
        availableExchanges: exchangesData.size,
      }, 'Not enough exchanges data to calculate arbitrage');
      return;
    }

    // 執行 OKX 資金費率驗證（如果啟用且 OKX 數據可用）
    if (this.enableValidation && this.validator && exchangesData.has('okx')) {
      try {
        // 轉換符號格式：BTCUSDT -> BTC-USDT-SWAP
        const okxSymbol = this.toOKXSymbol(symbol);
        await this.validator.validate(okxSymbol);
        logger.debug({
          symbol,
          okxSymbol,
        }, 'OKX funding rate validation completed');
      } catch (error) {
        logger.warn({
          symbol,
          error: error instanceof Error ? error.message : String(error),
        }, 'OKX funding rate validation failed (non-blocking)');
        // 驗證失敗不影響監控主流程
      }
    }

    // 使用新的多交易所計算方法
    const pair = this.calculator.calculateMultiExchangeDifference(symbol, exchangesData);

    // 更新全局快取（用於 Web API）
    ratesCache.set(symbol, pair);

    // 發送事件
    this.emit('rate-updated', pair);

    // 檢查是否有套利機會
    const isOpportunity = this.calculator.isArbitrageOpportunity(pair);
    const wasOpportunity = this.activeOpportunities.has(symbol);

    if (isOpportunity && pair.bestPair) {
      if (!wasOpportunity) {
        // 新機會出現
        this.activeOpportunities.add(symbol);
        this.statsTracker.setActiveOpportunities(this.activeOpportunities.size);
      }
      logger.info({
        symbol,
        longExchange: pair.bestPair.longExchange,
        shortExchange: pair.bestPair.shortExchange,
        spread: pair.bestPair.spreadPercent,
        priceDiff: pair.bestPair.priceDiffPercent,
      }, 'Arbitrage opportunity detected');
      this.emit('opportunity-detected', pair);

      // 執行套利評估（如果啟用）
      if (this.enableArbitrageAssessment && this.arbitrageAssessor) {
        try {
          const assessment = this.arbitrageAssessor.assess(
            pair,
            this.arbitrageCapital,
            'maker' // 預設使用 Maker 費率
          );

          logger.debug({
            symbol: assessment.symbol,
            isFeasible: assessment.isFeasible,
            netProfit: assessment.netProfit,
            netProfitPercent: assessment.netProfitPercent,
            warnings: assessment.warnings,
          }, 'Arbitrage assessment completed');

          // 發出可行套利事件
          if (assessment.isFeasible) {
            logger.info({
              symbol: assessment.symbol,
              longExchange: assessment.longExchange,
              shortExchange: assessment.shortExchange,
              netProfit: assessment.netProfit,
              netProfitPercent: (assessment.netProfitPercent * 100).toFixed(3) + '%',
            }, 'Feasible arbitrage opportunity detected');
            this.emit('arbitrage-feasible', assessment);
          } else {
            logger.debug({
              symbol: assessment.symbol,
              reason: assessment.reason,
            }, 'Arbitrage not feasible');
          }
        } catch (error) {
          logger.error({
            symbol,
            error: error instanceof Error ? error.message : String(error),
          }, 'Failed to assess arbitrage opportunity');
        }
      }
    } else if (wasOpportunity) {
      // 機會消失
      this.activeOpportunities.delete(symbol);
      this.statsTracker.setActiveOpportunities(this.activeOpportunities.size);

      logger.info({
        symbol,
        spread: pair.bestPair?.spreadPercent,
      }, 'Arbitrage opportunity disappeared');
      this.emit('opportunity-disappeared', symbol);
    }
  }

  /**
   * 轉換符號格式：BTCUSDT -> BTC-USDT-SWAP
   */
  private toOKXSymbol(symbol: string): string {
    // 移除 USDT 後綴，然後重組為 OKX 格式
    const base = symbol.replace('USDT', '');
    return `${base}-USDT-SWAP`;
  }

  /**
   * 取得監控狀態
   */
  getStatus(): MonitorStatus {
    return { ...this.status };
  }

  /**
   * 取得統計資訊
   */
  getStats(): MonitorStats {
    return this.statsTracker.getStats();
  }

  /**
   * 取得運行時長（秒）
   */
  getUptime(): number {
    return this.statsTracker.getUptime();
  }

  /**
   * 取得格式化的運行時長
   */
  getFormattedUptime(): string {
    return this.statsTracker.getFormattedUptime();
  }

  /**
   * 取得最新的資金費率配對
   */
  getLatestRates(): FundingRatePair[] {
    const pairs: FundingRatePair[] = [];

    for (const symbol of this.symbols) {
      // 收集所有交易所的最新資料
      const exchangesData = new Map<ExchangeName, ExchangeRateData>();

      for (const exchangeName of this.exchangeNames) {
        const rate = this.store.getLatest(exchangeName, symbol);
        if (rate) {
          exchangesData.set(exchangeName, { rate });
        }
      }

      // 至少需要 2 個交易所的數據
      if (exchangesData.size >= 2) {
        try {
          const pair = this.calculator.calculateMultiExchangeDifference(symbol, exchangesData);
          pairs.push(pair);
        } catch (error) {
          logger.error({
            symbol,
            error: error instanceof Error ? error.message : String(error),
          }, 'Failed to create rate pair');
        }
      }
    }

    return pairs;
  }

  /**
   * 取得歷史記錄
   */
  getHistory(symbol: string, exchange: ExchangeName, limit = 10): FundingRateRecord[] {
    return this.store.getHistory(exchange, symbol, limit);
  }

  /**
   * 手動觸發更新
   */
  async forceUpdate(): Promise<void> {
    if (!this.isRunning) {
      throw new Error('Monitor is not running');
    }
    await this.updateRates();
  }

  /**
   * 更新閾值
   */
  setThreshold(threshold: number): void {
    this.calculator.setThreshold(threshold);
  }

  /**
   * 取得閾值
   */
  getThreshold(): number {
    return this.calculator.getThreshold();
  }

  /**
   * 清除歷史記錄
   */
  clearHistory(): void {
    this.store.clear();
    logger.info('History cleared');
  }
}
