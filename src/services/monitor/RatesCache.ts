/**
 * RatesCache - 全局資金費率快取服務
 *
 * 用於在 Web API 和 FundingRateMonitor 之間共享數據
 * 提供 in-memory 快取層，支援數據過期機制
 *
 * Feature: 006-web-trading-platform (User Story 2.5)
 * Feature: 022-annualized-return-threshold
 */

import type { FundingRatePair } from '../../models/FundingRate';
import { logger } from '../../lib/logger';
import {
  DEFAULT_OPPORTUNITY_THRESHOLD_ANNUALIZED,
  APPROACHING_THRESHOLD_RATIO,
} from '../../lib/constants';

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

/**
 * 全局資金費率快取服務
 *
 * 單例模式，確保全局只有一個實例
 */
export class RatesCache {
  private static instance: RatesCache | null = null;

  private cache = new Map<string, CachedRatePair>();
  private readonly staleThresholdMs = 600000; // 10 分鐘未更新視為過期（配合 5 分鐘更新間隔）
  private startTime: Date | null = null;

  private constructor() {
    logger.info('RatesCache initialized');
  }

  /**
   * 獲取單例實例
   */
  static getInstance(): RatesCache {
    if (!RatesCache.instance) {
      RatesCache.instance = new RatesCache();
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
  }

  /**
   * 獲取單一交易對的費率
   */
  get(symbol: string): FundingRatePair | null {
    const cached = this.cache.get(symbol);
    if (!cached) {
      return null;
    }

    // 檢查是否過期
    if (this.isStale(cached.cachedAt)) {
      logger.warn({ symbol }, 'Cached rate is stale');
      return null;
    }

    // 移除 cachedAt 欄位
    const { cachedAt, ...rate } = cached;
    return rate;
  }

  /**
   * 獲取所有費率數據（過濾掉過期數據）
   */
  getAll(): FundingRatePair[] {
    const rates: FundingRatePair[] = [];

    for (const [symbol, cached] of this.cache.entries()) {
      if (!this.isStale(cached.cachedAt)) {
        const { cachedAt, ...rate } = cached;
        rates.push(rate);
      } else {
        logger.debug({ symbol }, 'Skipping stale rate');
      }
    }

    return rates;
  }

  /**
   * 獲取市場統計資訊
   *
   * Feature 022: 使用年化收益門檻判定
   * - opportunity: 年化收益 >= 800%
   * - approaching: 年化收益 600%-799%
   */
  getStats(
    opportunityThreshold = DEFAULT_OPPORTUNITY_THRESHOLD_ANNUALIZED
  ): MarketStats {
    const rates = this.getAll();
    let opportunityCount = 0;
    let approachingCount = 0;
    let maxSpread: {
      symbol: string;
      spread: number;
      annualizedReturn?: number;
    } | null = null;

    // 計算接近門檻 (主門檻的 75%)
    const approachingThreshold = opportunityThreshold * APPROACHING_THRESHOLD_RATIO;

    rates.forEach((rate) => {
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
      totalSymbols: rates.length,
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
   * 標記系統啟動時間
   */
  markStart(): void {
    this.startTime = new Date();
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
}

/**
 * 導出單例實例
 */
export const ratesCache = RatesCache.getInstance();
