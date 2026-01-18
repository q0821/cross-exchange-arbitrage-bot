/**
 * ArbitrageOpportunityTracker
 *
 * Feature: 065-arbitrage-opportunity-tracking
 * Phase: 3 - User Story 2
 * Task: T009 - Tracker 實作 (GREEN Phase)
 *
 * 負責監聽 FundingRateMonitor 事件並記錄套利機會到資料庫
 */

import type { EventEmitter } from 'events';
import type { FundingRatePair } from '@/models/FundingRate';
import type { ArbitrageOpportunityRepository } from '@/repositories/ArbitrageOpportunityRepository';
import { logger } from '@/lib/logger';

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
 * 套利機會追蹤器
 *
 * 監聽 FundingRateMonitor 的事件，自動記錄和更新套利機會到資料庫
 */
export class ArbitrageOpportunityTracker {
  private monitor: EventEmitter | null = null;
  private stats: TrackerStats = {
    opportunitiesRecorded: 0,
    opportunitiesEnded: 0,
    lastRecordedAt: null,
    errors: 0,
  };

  // 綁定的事件處理函數（使用箭頭函數保持 this 綁定）
  private boundHandleOpportunityDetected: ((pair: FundingRatePair) => Promise<void>) | null = null;
  private boundHandleOpportunityDisappeared: ((symbol: string) => Promise<void>) | null = null;

  constructor(private readonly repository: ArbitrageOpportunityRepository) {}

  /**
   * 綁定到 FundingRateMonitor 實例
   *
   * @param monitor - FundingRateMonitor 實例
   */
  attach(monitor: EventEmitter): void {
    this.monitor = monitor;

    // 建立綁定的處理函數
    this.boundHandleOpportunityDetected = this.handleOpportunityDetected.bind(this);
    this.boundHandleOpportunityDisappeared = this.handleOpportunityDisappeared.bind(this);

    // 監聽事件
    this.monitor.on('opportunity-detected', this.boundHandleOpportunityDetected);
    this.monitor.on('opportunity-disappeared', this.boundHandleOpportunityDisappeared);

    logger.info('ArbitrageOpportunityTracker attached to monitor');
  }

  /**
   * 解除綁定
   */
  detach(): void {
    if (!this.monitor) {
      return;
    }

    // 移除事件監聽器
    if (this.boundHandleOpportunityDetected) {
      this.monitor.off('opportunity-detected', this.boundHandleOpportunityDetected);
    }
    if (this.boundHandleOpportunityDisappeared) {
      this.monitor.off('opportunity-disappeared', this.boundHandleOpportunityDisappeared);
    }

    this.monitor = null;
    this.boundHandleOpportunityDetected = null;
    this.boundHandleOpportunityDisappeared = null;

    logger.info('ArbitrageOpportunityTracker detached from monitor');
  }

  /**
   * 處理機會偵測事件
   *
   * @param pair - 資金費率配對
   */
  async handleOpportunityDetected(pair: FundingRatePair): Promise<void> {
    // 驗證 bestPair 存在
    if (!pair.bestPair) {
      logger.warn({ symbol: pair.symbol }, 'Opportunity detected but bestPair is missing');
      return;
    }

    try {
      // 從 exchanges Map 取得 interval 資訊
      const longData = pair.exchanges.get(pair.bestPair.longExchange);
      const shortData = pair.exchanges.get(pair.bestPair.shortExchange);

      const longIntervalHours = longData?.originalFundingInterval ?? 8;
      const shortIntervalHours = shortData?.originalFundingInterval ?? 8;

      // 計算年化報酬（APY）
      // spreadAnnualized 是基於 8 小時週期的年化報酬
      const apy = pair.bestPair.spreadAnnualized;

      // 建立或更新記錄
      await this.repository.upsert({
        symbol: pair.symbol,
        longExchange: pair.bestPair.longExchange,
        shortExchange: pair.bestPair.shortExchange,
        spread: pair.bestPair.spreadPercent,
        apy,
        longIntervalHours,
        shortIntervalHours,
      });

      // 更新統計
      this.stats.opportunitiesRecorded++;
      this.stats.lastRecordedAt = new Date();

      logger.info(
        {
          symbol: pair.symbol,
          longExchange: pair.bestPair.longExchange,
          shortExchange: pair.bestPair.shortExchange,
          spread: pair.bestPair.spreadPercent,
          apy,
        },
        'Opportunity recorded'
      );
    } catch (error) {
      // 資料庫錯誤不應中斷監測服務
      this.stats.errors++;
      logger.error(
        {
          symbol: pair.symbol,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to record opportunity'
      );
      // 不拋出錯誤，允許監測繼續
    }
  }

  /**
   * 處理機會消失事件
   *
   * @param symbol - 交易對符號
   */
  async handleOpportunityDisappeared(symbol: string): Promise<void> {
    try {
      // 查找該 symbol 所有 ACTIVE 機會
      const activeOpportunities = await this.repository.findAllActiveBySymbol(symbol);

      for (const opportunity of activeOpportunities) {
        await this.repository.markAsEnded(
          opportunity.symbol,
          opportunity.longExchange,
          opportunity.shortExchange,
          opportunity.currentSpread.toNumber(),
          opportunity.currentAPY.toNumber()
        );

        this.stats.opportunitiesEnded++;

        logger.info(
          {
            id: opportunity.id,
            symbol: opportunity.symbol,
            longExchange: opportunity.longExchange,
            shortExchange: opportunity.shortExchange,
            durationMs: Date.now() - opportunity.detectedAt.getTime(),
          },
          'Opportunity ended'
        );
      }
    } catch (error) {
      this.stats.errors++;
      logger.error(
        {
          symbol,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to end opportunity'
      );
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
}
