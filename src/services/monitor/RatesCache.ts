/**
 * RatesCache - 全局資金費率快取服務
 *
 * 用於在 Web API 和 FundingRateMonitor 之間共享數據
 * 提供 in-memory 快取層，支援數據過期機制
 *
 * Feature: 006-web-trading-platform (User Story 2.5)
 * Feature: 022-annualized-return-threshold
 * Feature: 026-discord-slack-notification
 */

import type { FundingRatePair, ExchangeRateData } from '../../models/FundingRate';
import { FundingRateRecord } from '../../models/FundingRate';
import type { FundingRateReceived } from '../../types/websocket-events';
import type { ExchangeName } from '../../connectors/types';
import type { DataStructureStats, Monitorable } from '../../types/memory-stats';
import { logger } from '../../lib/logger';
import {
  DEFAULT_OPPORTUNITY_THRESHOLD_ANNUALIZED,
  APPROACHING_THRESHOLD_RATIO,
} from '../../lib/constants';
import { PrismaClient } from '@/generated/prisma/client';
import { NotificationService } from '../notification/NotificationService';
import { SimulatedTrackingService } from '../tracking/SimulatedTrackingService';

/**
 * 快取的費率數據（包含時間戳）
 */
interface CachedRatePair extends FundingRatePair {
  cachedAt: Date;
}

/**
 * 市場統計資訊
 */
export interface MarketStats {
  /** 正在監控的交易對總數 */
  totalSymbols: number;
  /** 當前機會數量（年化收益 ≥ 800%）*/
  opportunityCount: number;
  /** 接近閾值數量（年化收益 600%-799%）*/
  approachingCount: number;
  /** 最高費率差異 */
  maxSpread: {
    symbol: string;
    spread: number;
    annualizedReturn?: number;
  } | null;
  /** 系統運行時長（秒）*/
  uptime: number;
  /** 最後更新時間 */
  lastUpdate: Date | null;
}

// 使用 globalThis 確保在 Next.js 開發模式下單例跨模組上下文共享
declare global {
   
  var __ratesCacheInstance: RatesCache | undefined;
}

/**
 * 全局資金費率快取服務
 *
 * 單例模式，確保全局只有一個實例
 * 使用 globalThis 解決 Next.js HMR 模組隔離問題
 */
export class RatesCache implements Monitorable {
  private static instance: RatesCache | null = null;

  private cache = new Map<string, CachedRatePair>();
  private readonly staleThresholdMs = 600000; // 10 分鐘未更新視為過期（配合 5 分鐘更新間隔）
  private startTime: Date | null = null;

  // Feature 026: 通知服務
  private notificationService: NotificationService | null = null;

  // Feature 029: 模擬追蹤服務
  private trackingService: SimulatedTrackingService | null = null;

  // 定期清理機制
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly DEFAULT_CLEANUP_INTERVAL_MS = 60000; // 預設每 60 秒清理一次

  private constructor() {
    logger.info('RatesCache initialized');
  }

  /**
   * 初始化通知服務
   * Feature 026: Discord/Slack 套利機會即時推送通知
   */
  initializeNotificationService(prisma: PrismaClient): void {
    this.notificationService = NotificationService.getInstance(prisma);
    logger.info('NotificationService initialized in RatesCache');
  }

  /**
   * 初始化模擬追蹤服務
   * Feature 029: Simulated APY Tracking
   */
  initializeTrackingService(prisma: PrismaClient): void {
    this.trackingService = SimulatedTrackingService.getInstance(prisma);
    logger.info('SimulatedTrackingService initialized in RatesCache');
  }

  /**
   * 獲取單例實例
   * 使用 globalThis 確保在 Next.js 開發模式下跨模組共享
   */
  static getInstance(): RatesCache {
    // 優先使用 globalThis 存儲的實例（解決 Next.js HMR 問題）
    if (globalThis.__ratesCacheInstance) {
      return globalThis.__ratesCacheInstance;
    }

    if (!RatesCache.instance) {
      RatesCache.instance = new RatesCache();
      // 同時存儲到 globalThis
      globalThis.__ratesCacheInstance = RatesCache.instance;
    }
    return RatesCache.instance;
  }

  /**
   * 設定費率數據
   */
  set(symbol: string, rate: FundingRatePair): void {
    this.cache.set(symbol, {
      ...rate,
      cachedAt: new Date(),
    });

    logger.debug({
      symbol,
      spread: rate.bestPair?.spreadPercent ?? rate.spreadPercent ?? 0,
      longExchange: rate.bestPair?.longExchange,
      shortExchange: rate.bestPair?.shortExchange,
    }, 'Rate cached');
  }

  /**
   * 批量設定費率數據
   * Feature 026: 同時觸發通知服務檢查
   */
  setAll(rates: FundingRatePair[]): void {
    const now = new Date();
    rates.forEach((rate) => {
      this.cache.set(rate.symbol, {
        ...rate,
        cachedAt: now,
      });
    });

    logger.debug({
      count: rates.length,
    }, 'Rates cached in batch');

    // Feature 026: 觸發通知檢查（非同步，不阻塞主流程）
    if (this.notificationService) {
      this.notificationService.checkAndNotify(rates).catch((error) => {
        logger.error({ error }, 'Failed to check and notify');
      });
    }

    // Feature 029: 觸發模擬追蹤快照記錄（非同步，不阻塞主流程）
    if (this.trackingService) {
      this.trackingService.recordSettlementSnapshots(rates).catch((error) => {
        logger.error({ error }, 'Failed to record settlement snapshots');
      });

      // T041: 同時檢查自動過期
      this.trackingService.checkAndExpireTrackings(rates).catch((error) => {
        logger.error({ error }, 'Failed to check and expire trackings');
      });
    }
  }

  /**
   * 從 WebSocket 更新資金費率數據 (Feature 052: T020)
   *
   * 此方法接收 FundingRateReceived 事件並更新快取中相應交易對的數據
   * 如果交易對不存在於快取中，會建立新的 FundingRatePair
   *
   * @param data WebSocket 接收的資金費率數據
   */
  updateFromWebSocket(data: FundingRateReceived): void {
    const { exchange, symbol, fundingRate } = data;

    // 跳過沒有資金費率的數據（某些新上架幣種可能沒有）
    if (!fundingRate) {
      logger.debug({
        symbol,
        exchange,
        source: 'websocket',
      }, 'Skipping rate update - no funding rate');
      return;
    }

    // 取得現有的快取數據
    const existing = this.cache.get(symbol);

    if (existing) {
      // 更新現有的 FundingRatePair 中對應交易所的數據
      const updatedPair = this.updateExchangeInPair(existing, data);
      this.cache.set(symbol, {
        ...updatedPair,
        cachedAt: new Date(),
      });

      logger.debug({
        symbol,
        exchange,
        fundingRate: fundingRate.toString(),
        source: 'websocket',
      }, 'Rate updated from WebSocket');
    } else {
      // 建立新的 FundingRatePair（只有單一交易所數據）
      const newPair = this.createPairFromWebSocket(data);
      this.cache.set(symbol, {
        ...newPair,
        cachedAt: new Date(),
      });

      logger.debug({
        symbol,
        exchange,
        fundingRate: fundingRate.toString(),
        source: 'websocket',
        isNew: true,
      }, 'New rate created from WebSocket');
    }
  }

  /**
   * 批量從 WebSocket 更新資金費率數據 (Feature 052: T020)
   *
   * @param dataArray WebSocket 接收的資金費率數據陣列
   */
  updateBatchFromWebSocket(dataArray: FundingRateReceived[]): void {
    for (const data of dataArray) {
      this.updateFromWebSocket(data);
    }

    logger.debug({
      count: dataArray.length,
    }, 'Batch rates updated from WebSocket');
  }

  /**
   * 更新 FundingRatePair 中特定交易所的數據 (Feature 052: T020)
   */
  private updateExchangeInPair(
    pair: CachedRatePair,
    data: FundingRateReceived
  ): FundingRatePair {
    const { exchange, fundingRate, nextFundingTime, markPrice } = data;
    const exchangeName = exchange as ExchangeName;

    // 創建新的 FundingRateRecord
    // fundingRate 已在 updateFromWebSocket 檢查，這裡使用 ! 斷言
    const newRate = new FundingRateRecord({
      exchange: exchangeName,
      symbol: data.symbol,
      fundingRate: fundingRate!.toNumber(),
      nextFundingTime: nextFundingTime ?? new Date(), // 若無結算時間則使用當前時間
      recordedAt: data.receivedAt,
    });

    // 獲取已有的 originalFundingInterval（如果存在）
    const existingData = pair.exchanges?.get(exchangeName);
    const fundingInterval = data.fundingInterval ?? existingData?.originalFundingInterval ?? 8;

    // 創建 ExchangeRateData
    const newExchangeData: ExchangeRateData = {
      rate: newRate,
      price: markPrice?.toNumber(),
      originalFundingInterval: fundingInterval,
    };

    // 更新交易所數據
    const updatedExchanges = new Map(pair.exchanges || new Map<ExchangeName, ExchangeRateData>());
    updatedExchanges.set(exchangeName, newExchangeData);

    // 重新計算最佳配對（保持現有邏輯）
    // 注意：完整的最佳配對計算在 RateDifferenceCalculator 中
    // 這裡只更新單一交易所數據，不重新計算 bestPair
    return {
      ...pair,
      exchanges: updatedExchanges,
      recordedAt: data.receivedAt,
    };
  }

  /**
   * 從 WebSocket 數據創建新的 FundingRatePair (Feature 052: T020)
   */
  private createPairFromWebSocket(data: FundingRateReceived): FundingRatePair {
    const { exchange, symbol, fundingRate, nextFundingTime, markPrice } = data;
    const exchangeName = exchange as ExchangeName;

    // 創建 FundingRateRecord
    // fundingRate 已在 updateFromWebSocket 檢查，這裡使用 ! 斷言
    const rate = new FundingRateRecord({
      exchange: exchangeName,
      symbol,
      fundingRate: fundingRate!.toNumber(),
      nextFundingTime: nextFundingTime ?? new Date(), // 若無結算時間則使用當前時間
      recordedAt: data.receivedAt,
    });

    // 創建交易所數據 Map（使用傳入的 fundingInterval 或預設 8h）
    const fundingInterval = data.fundingInterval ?? 8;
    const exchanges = new Map<ExchangeName, ExchangeRateData>();
    exchanges.set(exchangeName, {
      rate,
      price: markPrice?.toNumber(),
      originalFundingInterval: fundingInterval,
    });

    return {
      symbol,
      exchanges,
      recordedAt: data.receivedAt,
      // 單一交易所無法計算 spread，設為 0
      spreadPercent: 0,
    };
  }

  /**
   * 獲取單一交易對的費率
   * Feature 066: 過期項目會從快取中移除以防止記憶體洩漏
   */
  get(symbol: string): FundingRatePair | null {
    const cached = this.cache.get(symbol);
    if (!cached) {
      return null;
    }

    // 檢查是否過期
    if (this.isStale(cached.cachedAt)) {
      // Feature 066: 主動從快取中刪除過期項目
      this.cache.delete(symbol);
      logger.warn({ symbol }, 'Cached rate is stale, removed from cache');
      return null;
    }

    // 移除 cachedAt 欄位
    const { cachedAt: _cachedAt, ...rate } = cached;
    return rate;
  }

  /**
   * 獲取所有費率數據（過濾掉過期數據）
   * Feature 066: 過期項目會從快取中移除以防止記憶體洩漏
   */
  getAll(): FundingRatePair[] {
    const rates: FundingRatePair[] = [];
    const staleSymbols: string[] = [];

    for (const [symbol, cached] of this.cache.entries()) {
      if (!this.isStale(cached.cachedAt)) {
        const { cachedAt: _cachedAt, ...rate } = cached;
        rates.push(rate);
      } else {
        // Feature 066: 收集過期的 symbol 以便稍後刪除
        staleSymbols.push(symbol);
        logger.debug({ symbol }, 'Skipping stale rate');
      }
    }

    // Feature 066: 主動從快取中刪除過期項目
    if (staleSymbols.length > 0) {
      for (const symbol of staleSymbols) {
        this.cache.delete(symbol);
      }
      logger.debug({ count: staleSymbols.length }, 'Removed stale rates from cache');
    }

    return rates;
  }

  /**
   * 獲取市場統計資訊
   *
   * Feature 022: 使用年化收益門檻判定
   * - opportunity: 年化收益 >= 800%
   * - approaching: 年化收益 600%-799%
   *
   * @param rates 可選的費率資料，若提供則直接使用，避免重複呼叫 getAll()
   * @param opportunityThreshold 機會門檻（年化收益百分比）
   */
  getStats(
    rates?: FundingRatePair[],
    opportunityThreshold = DEFAULT_OPPORTUNITY_THRESHOLD_ANNUALIZED
  ): MarketStats {
    // 若未提供 rates，則從快取中取得
    const ratesData = rates ?? this.getAll();
    let opportunityCount = 0;
    let approachingCount = 0;
    let maxSpread: {
      symbol: string;
      spread: number;
      annualizedReturn?: number;
    } | null = null;

    // 計算接近門檻 (主門檻的 75%)
    const approachingThreshold = opportunityThreshold * APPROACHING_THRESHOLD_RATIO;

    ratesData.forEach((rate) => {
      // 使用 bestPair 的年化收益數據
      const annualizedReturn = rate.bestPair?.spreadAnnualized ?? 0;
      const spreadPercent = rate.bestPair?.spreadPercent ?? rate.spreadPercent ?? 0;

      // 統計機會和接近閾值的數量（使用年化收益判定）
      if (annualizedReturn >= opportunityThreshold) {
        opportunityCount++;
      } else if (
        annualizedReturn >= approachingThreshold &&
        annualizedReturn < opportunityThreshold
      ) {
        approachingCount++;
      }

      // 追蹤最高費率差異（保持 spreadPercent 用於顯示，同時記錄年化收益）
      if (!maxSpread || spreadPercent > maxSpread.spread) {
        maxSpread = {
          symbol: rate.symbol,
          spread: spreadPercent,
          annualizedReturn,
        };
      }
    });

    return {
      totalSymbols: ratesData.length,
      opportunityCount,
      approachingCount,
      maxSpread,
      uptime: this.getUptime(),
      lastUpdate: this.getLastUpdate(),
    };
  }

  /**
   * 檢查數據是否過期
   */
  private isStale(cachedAt: Date): boolean {
    return Date.now() - cachedAt.getTime() > this.staleThresholdMs;
  }

  /**
   * 標記系統啟動時間並啟動定期清理
   */
  markStart(): void {
    this.startTime = new Date();
    this.startCleanup();
    logger.info('RatesCache marked as started');
  }

  /**
   * 獲取系統運行時長（秒）
   */
  getUptime(): number {
    if (!this.startTime) {
      return 0;
    }
    return Math.floor((Date.now() - this.startTime.getTime()) / 1000);
  }

  /**
   * 獲取最後更新時間
   */
  getLastUpdate(): Date | null {
    let latest: Date | null = null;

    for (const cached of this.cache.values()) {
      if (!latest || cached.cachedAt > latest) {
        latest = cached.cachedAt;
      }
    }

    return latest;
  }

  /**
   * 清除所有快取
   */
  clear(): void {
    this.cache.clear();
    logger.info('RatesCache cleared');
  }

  /**
   * 獲取快取大小
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * 取得資料結構統計資訊
   * Feature: 066-memory-monitoring
   */
  getDataStructureStats(): DataStructureStats {
    // 計算深層資料：每個 FundingRatePair 內的 exchanges Map 大小
    let totalExchangeEntries = 0;
    for (const cached of this.cache.values()) {
      if (cached.exchanges) {
        totalExchangeEntries += cached.exchanges.size;
      }
    }

    return {
      name: 'RatesCache',
      sizes: {
        cache: this.cache.size,
        exchangeEntries: totalExchangeEntries,
      },
      totalItems: this.cache.size,
      details: {
        averageExchangesPerPair: this.cache.size > 0
          ? Math.round((totalExchangeEntries / this.cache.size) * 100) / 100
          : 0,
        staleThresholdMs: this.staleThresholdMs,
      },
    };
  }

  /**
   * 啟動定期清理機制
   * 主動清理過期項目，避免依賴 getAll() 的被動清理
   *
   * @param intervalMs 清理間隔（毫秒），預設 60 秒
   */
  startCleanup(intervalMs = this.DEFAULT_CLEANUP_INTERVAL_MS): void {
    if (this.cleanupInterval) {
      logger.warn('Cleanup interval already running');
      return;
    }

    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, intervalMs);

    logger.info({ intervalMs }, 'RatesCache cleanup started');
  }

  /**
   * 停止定期清理機制
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.info('RatesCache cleanup stopped');
    }
  }

  /**
   * 執行清理操作：移除過期項目
   */
  private performCleanup(): void {
    const now = Date.now();
    const staleSymbols: string[] = [];

    for (const [symbol, cached] of this.cache.entries()) {
      if (now - cached.cachedAt.getTime() > this.staleThresholdMs) {
        staleSymbols.push(symbol);
      }
    }

    if (staleSymbols.length > 0) {
      for (const symbol of staleSymbols) {
        this.cache.delete(symbol);
      }
      logger.info(
        {
          removedCount: staleSymbols.length,
          remainingCount: this.cache.size,
        },
        'RatesCache cleanup completed'
      );
    }
  }

  /**
   * 銷毀實例並清理 globalThis 引用
   * 用於防止 Next.js HMR 模式下的記憶體泄漏
   */
  destroy(): void {
    this.stopCleanup();
    this.cache.clear();
    this.notificationService = null;
    this.trackingService = null;
    this.startTime = null;
    logger.debug('RatesCache destroyed');
  }

  /**
   * 重置單例實例（僅用於測試）
   * 同時清理 globalThis 引用以防止記憶體泄漏
   */
  static resetInstance(): void {
    if (RatesCache.instance) {
      RatesCache.instance.destroy();
      RatesCache.instance = null;
    }
    // 清理 globalThis 引用
    if (globalThis.__ratesCacheInstance) {
      delete globalThis.__ratesCacheInstance;
    }
    logger.debug('RatesCache instance reset');
  }
}

/**
 * 導出單例實例
 */
export const ratesCache = RatesCache.getInstance();
