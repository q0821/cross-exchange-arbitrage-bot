/**
 * ArbitrageOpportunityTracker
 *
 * Feature: 065-arbitrage-opportunity-tracking
 *
 * 獨立的套利機會追蹤器，擁有自己的生命週期邏輯
 * 不依賴 FundingRateMonitor 的 opportunity-detected/disappeared 事件
 * 而是監聽 rate-updated 事件並自行判斷機會狀態
 */

import type { EventEmitter } from 'events';
import type { FundingRatePair } from '@/models/FundingRate';
import type { ArbitrageOpportunityRepository } from '@/repositories/ArbitrageOpportunityRepository';
import type { DataStructureStats, Monitorable } from '@/types/memory-stats';
import { logger } from '@/lib/logger';
import { TRACKER_OPPORTUNITY_THRESHOLD, TRACKER_OPPORTUNITY_END_THRESHOLD } from '@/lib/constants';

/**
 * 追蹤器統計資料
 */
export interface TrackerStats {
  opportunitiesRecorded: number;
  opportunitiesEnded: number;
  lastRecordedAt: Date | null;
  errors: number;
}

/**
 * 活躍機會的識別 key
 * 格式: symbol:longExchange:shortExchange
 */
type OpportunityKey = string;

/**
 * 活躍機會的追蹤資訊
 */
interface ActiveOpportunity {
  symbol: string;
  longExchange: string;
  shortExchange: string;
  lastSpread: number;
  lastAPY: number;
  detectedAt: Date;
}

/**
 * 套利機會追蹤器
 *
 * 監聽 FundingRateMonitor 的 rate-updated 事件
 * 使用獨立的閾值邏輯判斷機會發現與結束
 */
export class ArbitrageOpportunityTracker implements Monitorable {
  private monitor: EventEmitter | null = null;
  private stats: TrackerStats = {
    opportunitiesRecorded: 0,
    opportunitiesEnded: 0,
    lastRecordedAt: null,
    errors: 0,
  };

  // Feature 065 專用閾值（發現與結束使用不同閾值）
  private readonly opportunityThreshold = TRACKER_OPPORTUNITY_THRESHOLD;
  private readonly opportunityEndThreshold = TRACKER_OPPORTUNITY_END_THRESHOLD;

  // 追蹤中的活躍機會
  private activeOpportunities: Map<OpportunityKey, ActiveOpportunity> = new Map();

  // 綁定的事件處理函數
  private boundHandleRateUpdated: ((pair: FundingRatePair) => Promise<void>) | null = null;

  constructor(private readonly repository: ArbitrageOpportunityRepository) {}

  /**
   * 生成機會識別 key
   */
  private getOpportunityKey(symbol: string, longExchange: string, shortExchange: string): OpportunityKey {
    return `${symbol}:${longExchange}:${shortExchange}`;
  }

  /**
   * Feature 065 獨立判斷邏輯：是否為新的套利機會
   *
   * @param apy - 年化報酬率（百分比）
   * @returns 是否達到機會發現閾值（>= 800%）
   */
  private isOpportunityForTracking(apy: number): boolean {
    return apy >= this.opportunityThreshold;
  }

  /**
   * Feature 065 獨立判斷邏輯：機會是否應該結束
   *
   * @param apy - 年化報酬率（百分比）
   * @returns 是否低於機會結束閾值（< 0%）
   */
  private shouldEndOpportunity(apy: number): boolean {
    return apy < this.opportunityEndThreshold;
  }

  /**
   * 綁定到 FundingRateMonitor 實例
   *
   * @param monitor - FundingRateMonitor 實例
   */
  attach(monitor: EventEmitter): void {
    this.monitor = monitor;

    // 建立綁定的處理函數
    this.boundHandleRateUpdated = this.handleRateUpdated.bind(this);

    // 監聽 rate-updated 事件（而非 opportunity-detected）
    this.monitor.on('rate-updated', this.boundHandleRateUpdated);

    logger.info(
      { threshold: this.opportunityThreshold },
      'ArbitrageOpportunityTracker attached with independent lifecycle logic'
    );
  }

  /**
   * 解除綁定
   */
  detach(): void {
    if (!this.monitor) {
      return;
    }

    // 移除事件監聽器
    if (this.boundHandleRateUpdated) {
      this.monitor.off('rate-updated', this.boundHandleRateUpdated);
    }

    this.monitor = null;
    this.boundHandleRateUpdated = null;

    logger.info('ArbitrageOpportunityTracker detached from monitor');
  }

  /**
   * 處理費率更新事件
   *
   * 獨立判斷邏輯（發現與結束使用不同閾值）：
   * 1. 計算當前 APY
   * 2. 如果 APY >= 800% 且 尚未追蹤 → 記錄新機會
   * 3. 如果已在追蹤 且 APY >= 0% → 更新機會（維持追蹤）
   * 4. 如果已在追蹤 且 APY < 0% → 結束機會
   * 5. 如果 APY 在 0% ~ 800% 之間 且 尚未追蹤 → 不觸發
   *
   * @param pair - 資金費率配對
   */
  async handleRateUpdated(pair: FundingRatePair): Promise<void> {
    // 沒有 bestPair 無法判斷
    if (!pair.bestPair) {
      return;
    }

    const { symbol, bestPair } = pair;
    const { longExchange, shortExchange, spreadAnnualized: apy, spreadPercent: spread } = bestPair;

    const key = this.getOpportunityKey(symbol, longExchange, shortExchange);
    const isCurrentlyTracked = this.activeOpportunities.has(key);
    const isNewOpportunity = this.isOpportunityForTracking(apy);
    const shouldEnd = this.shouldEndOpportunity(apy);

    try {
      // 從 exchanges Map 取得 interval 資訊
      const longData = pair.exchanges.get(longExchange);
      const shortData = pair.exchanges.get(shortExchange);
      const longIntervalHours = longData?.originalFundingInterval ?? 8;
      const shortIntervalHours = shortData?.originalFundingInterval ?? 8;

      if (isNewOpportunity && !isCurrentlyTracked) {
        // 情況 1：新機會發現（APY >= 800% 且尚未追蹤）
        await this.recordNewOpportunity({
          symbol,
          longExchange,
          shortExchange,
          spread,
          apy,
          longIntervalHours,
          shortIntervalHours,
        });

        // 加入追蹤
        this.activeOpportunities.set(key, {
          symbol,
          longExchange,
          shortExchange,
          lastSpread: spread,
          lastAPY: apy,
          detectedAt: new Date(),
        });

        logger.info(
          {
            symbol,
            longExchange,
            shortExchange,
            apy,
            spread,
            threshold: this.opportunityThreshold,
          },
          '[Feature 065] New opportunity detected'
        );
      } else if (isCurrentlyTracked && shouldEnd) {
        // 情況 2：機會結束（已追蹤 且 APY < 0%）
        const tracked = this.activeOpportunities.get(key)!;

        await this.endOpportunity(symbol, longExchange, shortExchange, tracked.lastSpread, tracked.lastAPY);

        // 從追蹤移除
        this.activeOpportunities.delete(key);

        const durationMs = Date.now() - tracked.detectedAt.getTime();

        logger.info(
          {
            symbol,
            longExchange,
            shortExchange,
            lastAPY: tracked.lastAPY,
            currentAPY: apy,
            endThreshold: this.opportunityEndThreshold,
            durationMs,
          },
          '[Feature 065] Opportunity ended (APY below end threshold)'
        );
      } else if (isCurrentlyTracked) {
        // 情況 3：更新現有機會（已追蹤 且 APY >= 0%）
        await this.updateOpportunity({
          symbol,
          longExchange,
          shortExchange,
          spread,
          apy,
          longIntervalHours,
          shortIntervalHours,
        });

        // 更新追蹤資訊
        const tracked = this.activeOpportunities.get(key)!;
        tracked.lastSpread = spread;
        tracked.lastAPY = apy;
      }
      // 如果 !isOpportunity && !isCurrentlyTracked，不做任何事
    } catch (error) {
      this.stats.errors++;
      logger.error(
        {
          symbol,
          longExchange,
          shortExchange,
          error: error instanceof Error ? error.message : String(error),
        },
        '[Feature 065] Failed to process rate update'
      );
    }
  }

  /**
   * 記錄新機會
   */
  private async recordNewOpportunity(data: {
    symbol: string;
    longExchange: string;
    shortExchange: string;
    spread: number;
    apy: number;
    longIntervalHours: number;
    shortIntervalHours: number;
  }): Promise<void> {
    await this.repository.upsert(data);
    this.stats.opportunitiesRecorded++;
    this.stats.lastRecordedAt = new Date();
  }

  /**
   * 更新現有機會
   */
  private async updateOpportunity(data: {
    symbol: string;
    longExchange: string;
    shortExchange: string;
    spread: number;
    apy: number;
    longIntervalHours: number;
    shortIntervalHours: number;
  }): Promise<void> {
    await this.repository.upsert(data);
  }

  /**
   * 結束機會
   */
  private async endOpportunity(
    symbol: string,
    longExchange: string,
    shortExchange: string,
    finalSpread: number,
    finalAPY: number
  ): Promise<void> {
    await this.repository.markAsEnded(symbol, longExchange, shortExchange, finalSpread, finalAPY);
    this.stats.opportunitiesEnded++;
  }

  /**
   * 處理機會偵測事件（保留向後相容，但不再使用）
   *
   * @deprecated 改用 handleRateUpdated 實作獨立邏輯
   */
  async handleOpportunityDetected(pair: FundingRatePair): Promise<void> {
    // 轉發到新的處理邏輯
    await this.handleRateUpdated(pair);
  }

  /**
   * 處理機會消失事件（保留向後相容，但不再使用）
   *
   * @deprecated 改用 handleRateUpdated 實作獨立邏輯
   */
  async handleOpportunityDisappeared(symbol: string): Promise<void> {
    // 找出該 symbol 所有活躍機會並結束
    const keysToEnd: OpportunityKey[] = [];

    for (const [key, tracked] of this.activeOpportunities.entries()) {
      if (tracked.symbol === symbol) {
        keysToEnd.push(key);
      }
    }

    for (const key of keysToEnd) {
      const tracked = this.activeOpportunities.get(key)!;

      try {
        await this.endOpportunity(
          tracked.symbol,
          tracked.longExchange,
          tracked.shortExchange,
          tracked.lastSpread,
          tracked.lastAPY
        );
        this.activeOpportunities.delete(key);

        logger.info(
          {
            symbol: tracked.symbol,
            longExchange: tracked.longExchange,
            shortExchange: tracked.shortExchange,
          },
          '[Feature 065] Opportunity ended via legacy event'
        );
      } catch (error) {
        this.stats.errors++;
        logger.error(
          {
            symbol: tracked.symbol,
            error: error instanceof Error ? error.message : String(error),
          },
          '[Feature 065] Failed to end opportunity via legacy event'
        );
      }
    }
  }

  /**
   * 取得追蹤器統計
   *
   * @returns 統計資料
   */
  getStats(): TrackerStats {
    return { ...this.stats };
  }

  /**
   * 取得目前活躍機會數量
   */
  getActiveOpportunitiesCount(): number {
    return this.activeOpportunities.size;
  }

  /**
   * 取得機會發現閾值
   */
  getThreshold(): number {
    return this.opportunityThreshold;
  }

  /**
   * 取得機會結束閾值
   */
  getEndThreshold(): number {
    return this.opportunityEndThreshold;
  }

  /**
   * 取得目前活躍機會中的最高年化報酬率
   * @returns 最高 APY（百分比），若無活躍機會則回傳 null
   */
  getTopAPY(): number | null {
    if (this.activeOpportunities.size === 0) {
      return null;
    }

    let maxAPY = -Infinity;
    for (const opportunity of this.activeOpportunities.values()) {
      if (opportunity.lastAPY > maxAPY) {
        maxAPY = opportunity.lastAPY;
      }
    }

    return maxAPY === -Infinity ? null : maxAPY;
  }

  /**
   * 取得資料結構統計資訊
   * Feature: 066-memory-monitoring
   */
  getDataStructureStats(): DataStructureStats {
    return {
      name: 'ArbitrageOpportunityTracker',
      sizes: {
        activeOpportunities: this.activeOpportunities.size,
      },
      totalItems: this.activeOpportunities.size,
    };
  }
}
