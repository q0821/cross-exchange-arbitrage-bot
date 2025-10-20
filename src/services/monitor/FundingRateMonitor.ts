import { EventEmitter } from 'events';
import { createExchange } from '../../connectors/factory.js';
import type { IExchangeConnector } from '../../connectors/types.js';
import { FundingRateRecord, FundingRateStore, FundingRatePair } from '../../models/FundingRate.js';
import { RateDifferenceCalculator } from './RateDifferenceCalculator.js';
import { logger } from '../../lib/logger.js';

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
  'error': (error: Error) => void;
  'status-changed': (status: MonitorStatus) => void;
}

/**
 * 資金費率監控服務
 * 負責定期從交易所獲取資金費率並計算差異
 */
export class FundingRateMonitor extends EventEmitter {
  private binance: IExchangeConnector;
  private okx: IExchangeConnector;
  private store: FundingRateStore;
  private calculator: RateDifferenceCalculator;

  private symbols: string[];
  private updateInterval: number; // 毫秒
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;

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
    minSpreadThreshold = 0.0005,
    isTestnet = false
  ) {
    super();

    this.symbols = symbols;
    this.updateInterval = updateInterval;

    this.binance = createExchange('binance', isTestnet);
    this.okx = createExchange('okx', isTestnet);
    this.store = new FundingRateStore();
    this.calculator = new RateDifferenceCalculator(minSpreadThreshold);

    this.status.symbols = symbols;
    this.status.updateInterval = updateInterval;

    logger.info({
      symbols,
      updateInterval,
      minSpreadThreshold,
      isTestnet,
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

      // 連接交易所
      await this.binance.connect();
      await this.okx.connect();

      this.status.connectedExchanges = ['binance', 'okx'];
      this.isRunning = true;
      this.status.isRunning = true;

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

    // 斷開交易所連線
    await this.binance.disconnect();
    await this.okx.disconnect();

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
      logger.error({
        error: error instanceof Error ? error.message : String(error),
      }, 'Failed to update rates');
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * 更新單一交易對的資金費率
   */
  private async updateRateForSymbol(symbol: string): Promise<void> {
    // 並行獲取兩個交易所的資金費率
    const [binanceData, okxData] = await Promise.all([
      this.binance.getFundingRate(symbol),
      this.okx.getFundingRate(symbol),
    ]);

    // 建立記錄
    const binanceRate = new FundingRateRecord(binanceData);
    const okxRate = new FundingRateRecord(okxData);

    // 儲存到記憶體
    this.store.save(binanceRate);
    this.store.save(okxRate);

    // 計算差異
    const pair = this.calculator.calculateDifference(binanceRate, okxRate);

    // 發送事件
    this.emit('rate-updated', pair);

    // 檢查是否有套利機會
    if (this.calculator.isArbitrageOpportunity(pair)) {
      logger.info({
        symbol,
        spread: pair.spreadPercent,
      }, 'Arbitrage opportunity detected');
      this.emit('opportunity-detected', pair);
    }
  }

  /**
   * 取得監控狀態
   */
  getStatus(): MonitorStatus {
    return { ...this.status };
  }

  /**
   * 取得最新的資金費率配對
   */
  getLatestRates(): FundingRatePair[] {
    const pairs: FundingRatePair[] = [];

    for (const symbol of this.symbols) {
      const binanceRate = this.store.getLatest('binance', symbol);
      const okxRate = this.store.getLatest('okx', symbol);

      if (binanceRate && okxRate) {
        try {
          const pair = this.calculator.calculateDifference(binanceRate, okxRate);
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
  getHistory(symbol: string, exchange: 'binance' | 'okx', limit = 10): FundingRateRecord[] {
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
