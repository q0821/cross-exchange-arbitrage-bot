/**
 * NotificationService - 套利機會通知服務
 *
 * 負責：
 * 1. 監控套利機會並判斷是否超過用戶閾值
 * 2. 發送通知到所有啟用的 Webhooks
 * 3. 重複過濾（5 分鐘內不重複發送同一機會）
 * 4. 追蹤機會生命週期並發送結束通知 (Feature 027)
 *
 * Feature 026: Discord/Slack 套利機會即時推送通知
 * Feature 027: 套利機會結束監測和通知
 */

import { PrismaClient } from '@prisma/client';
import { NotificationWebhookRepository } from '../../repositories/NotificationWebhookRepository';
import { OpportunityEndHistoryRepository } from '../../repositories/OpportunityEndHistoryRepository';
import { DiscordNotifier } from './DiscordNotifier';
import { SlackNotifier } from './SlackNotifier';
import { logger } from '../../lib/logger';
import type {
  WebhookConfig,
  ArbitrageNotificationMessage,
  NotificationResult,
  INotifier,
  TrackedOpportunity,
  NotifiedWebhookInfo,
  OpportunityDisappearedMessage,
} from './types';
import type { FundingRatePair, ExchangeName, ExchangeRateData } from '../../models/FundingRate';
import { formatDuration } from './utils';
import { TRADING_FEES_RATE } from '../../lib/cost-constants';

/**
 * 已通知的機會記錄（用於重複過濾）
 */
interface NotifiedOpportunity {
  key: string;
  notifiedAt: Date;
}

/**
 * NotificationService 類別
 */
export class NotificationService {
  private static instance: NotificationService | null = null;

  private readonly webhookRepository: NotificationWebhookRepository;
  private readonly historyRepository: OpportunityEndHistoryRepository;
  private readonly discordNotifier: DiscordNotifier;
  private readonly slackNotifier: SlackNotifier;

  // 重複過濾：記錄已通知的機會 (key -> timestamp)
  private readonly notifiedOpportunities = new Map<string, NotifiedOpportunity>();
  private readonly deduplicationWindowMs = 5 * 60 * 1000; // 5 分鐘

  // 通知時間窗口容錯範圍（±2 分鐘）
  private readonly notificationWindowRange = 2;

  // Feature 027: 追蹤中的套利機會 (key: symbol:longExchange:shortExchange)
  private readonly trackedOpportunities = new Map<string, TrackedOpportunity>();
  private readonly disappearDebounceMs = 60 * 1000; // 1 分鐘防抖動
  private readonly staleTrackingWindowMs = 30 * 60 * 1000; // 30 分鐘後清理未更新的追蹤

  private constructor(prisma: PrismaClient) {
    this.webhookRepository = new NotificationWebhookRepository(prisma);
    this.historyRepository = new OpportunityEndHistoryRepository(prisma);
    this.discordNotifier = new DiscordNotifier();
    this.slackNotifier = new SlackNotifier();

    logger.info('NotificationService initialized');
  }

  /**
   * 獲取單例實例
   */
  static getInstance(prisma: PrismaClient): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService(prisma);
    }
    return NotificationService.instance;
  }

  /**
   * 檢查套利機會並發送通知
   *
   * @param rates 所有費率對數據
   */
  async checkAndNotify(rates: FundingRatePair[]): Promise<void> {
    // 清理過期的已通知記錄
    this.cleanupStaleNotifications();

    // 獲取所有啟用的 Webhooks（按用戶分組）
    const webhooksByUser = await this.getWebhooksByUser();

    if (webhooksByUser.size === 0) {
      logger.debug('No enabled webhooks found, skipping notification check');
      return;
    }

    // 對每個用戶檢查機會
    for (const [userId, webhooks] of webhooksByUser) {
      await this.checkOpportunitiesForUser(userId, webhooks, rates);
    }

    // Feature 027: 更新追蹤中的機會並檢查是否有結束的機會
    await this.updateAndCheckTrackedOpportunities(rates, webhooksByUser);
  }

  /**
   * 獲取所有啟用的 Webhooks，按用戶分組
   */
  private async getWebhooksByUser(): Promise<Map<string, WebhookConfig[]>> {
    const webhooksByUser = new Map<string, WebhookConfig[]>();

    try {
      const allWebhooks = await this.webhookRepository.findAllEnabled();

      for (const webhook of allWebhooks) {
        const userWebhooks = webhooksByUser.get(webhook.userId) || [];
        userWebhooks.push(webhook);
        webhooksByUser.set(webhook.userId, userWebhooks);
      }
    } catch (error) {
      logger.error({ error }, 'Failed to fetch enabled webhooks');
    }

    return webhooksByUser;
  }

  /**
   * 檢查用戶的套利機會
   */
  private async checkOpportunitiesForUser(
    userId: string,
    webhooks: WebhookConfig[],
    rates: FundingRatePair[]
  ): Promise<void> {
    // 通知時間窗口檢查已移至 sendNotificationForOpportunity（按 webhook 個別檢查）

    // 找出最低閾值（任一 webhook 的閾值）
    const minThreshold = Math.min(...webhooks.map((w) => w.threshold));

    // 篩選出超過最低閾值的機會
    const opportunities = rates.filter((rate) => {
      const annualized = rate.bestPair?.spreadAnnualized ?? 0;
      return annualized >= minThreshold;
    });

    if (opportunities.length === 0) {
      return;
    }

    logger.debug(
      {
        userId,
        opportunityCount: opportunities.length,
        minThreshold,
      },
      'Found opportunities for user'
    );

    // 發送通知
    for (const opportunity of opportunities) {
      await this.sendNotificationForOpportunity(userId, webhooks, opportunity);
    }
  }

  /**
   * 發送單一機會的通知
   */
  private async sendNotificationForOpportunity(
    userId: string,
    webhooks: WebhookConfig[],
    rate: FundingRatePair
  ): Promise<void> {
    const bestPair = rate.bestPair;
    if (!bestPair) {
      return;
    }

    const annualized = bestPair.spreadAnnualized;

    // 為每個 webhook 檢查並發送
    for (const webhook of webhooks) {
      // 檢查是否超過此 webhook 的閾值
      if (annualized < webhook.threshold) {
        continue;
      }

      // 檢查此 webhook 的通知時間窗口
      if (!this.isWithinWebhookNotificationWindow(webhook.notificationMinutes)) {
        continue;
      }

      // 檢查重複過濾
      const key = this.generateOpportunityKey(
        userId,
        rate.symbol,
        bestPair.longExchange,
        bestPair.shortExchange,
        webhook.id
      );

      if (this.isRecentlyNotified(key)) {
        logger.debug(
          { key, symbol: rate.symbol },
          'Skipping duplicate notification'
        );
        continue;
      }

      // 構建通知訊息
      const message = this.buildNotificationMessage(rate);
      if (!message) {
        continue;
      }

      // 發送通知
      const result = await this.sendToWebhook(webhook, message);

      if (result.success) {
        // 記錄已通知
        this.markAsNotified(key);

        // Feature 027: 開始追蹤此機會
        this.startTracking(rate, webhook);

        logger.info(
          {
            userId,
            webhookId: webhook.id,
            symbol: rate.symbol,
            annualized,
          },
          'Notification sent successfully'
        );
      }
    }
  }

  // ===== Feature 027: 機會追蹤方法 =====

  /**
   * 開始追蹤新機會或更新已追蹤機會的 Webhook 資訊
   */
  private startTracking(rate: FundingRatePair, webhook: WebhookConfig): void {
    const bestPair = rate.bestPair;
    if (!bestPair) return;

    const trackingKey = this.generateTrackingKey(
      rate.symbol,
      bestPair.longExchange,
      bestPair.shortExchange
    );

    const longData = rate.exchanges.get(bestPair.longExchange);
    const shortData = rate.exchanges.get(bestPair.shortExchange);

    // Feature 030: 記錄警告日誌當使用 fallback 8h 時
    if (!longData?.originalFundingInterval) {
      logger.warn(
        { symbol: rate.symbol, exchange: bestPair.longExchange },
        'Using default 8h interval for long side (originalFundingInterval missing)'
      );
    }
    if (!shortData?.originalFundingInterval) {
      logger.warn(
        { symbol: rate.symbol, exchange: bestPair.shortExchange },
        'Using default 8h interval for short side (originalFundingInterval missing)'
      );
    }

    let tracked = this.trackedOpportunities.get(trackingKey);

    if (!tracked) {
      // 建立新的追蹤記錄
      const now = new Date();
      tracked = {
        symbol: rate.symbol,
        longExchange: bestPair.longExchange,
        shortExchange: bestPair.shortExchange,
        detectedAt: now,
        lastUpdatedAt: now,
        initialSpread: bestPair.spreadPercent / 100, // 轉為小數
        maxSpread: bestPair.spreadPercent / 100,
        maxSpreadAt: now,
        currentSpread: bestPair.spreadPercent / 100,
        longSettlements: [],
        shortSettlements: [],
        longIntervalHours: longData?.originalFundingInterval ?? 8,
        shortIntervalHours: shortData?.originalFundingInterval ?? 8,
        notifiedWebhooks: new Map(),
        notificationCount: 0,
        disappearingAt: new Map(),
      };

      this.trackedOpportunities.set(trackingKey, tracked);

      logger.info(
        {
          trackingKey,
          symbol: rate.symbol,
          initialSpread: tracked.initialSpread,
        },
        'Started tracking new opportunity'
      );
    }

    // 更新已通知的 Webhook 資訊
    const webhookInfo: NotifiedWebhookInfo = {
      webhookId: webhook.id,
      userId: webhook.userId,
      threshold: webhook.threshold,
      notifyOnDisappear: webhook.notifyOnDisappear,
    };
    tracked.notifiedWebhooks.set(webhook.id, webhookInfo);
    tracked.notificationCount++;
  }

  /**
   * 生成追蹤 key
   */
  private generateTrackingKey(
    symbol: string,
    longExchange: string,
    shortExchange: string
  ): string {
    return `${symbol}:${longExchange}:${shortExchange}`;
  }

  /**
   * 更新追蹤中的機會並檢查是否有結束的機會
   */
  private async updateAndCheckTrackedOpportunities(
    rates: FundingRatePair[],
    webhooksByUser: Map<string, WebhookConfig[]>
  ): Promise<void> {
    const now = new Date();

    // 建立當前費率的快速查找表
    const currentRates = new Map<string, FundingRatePair>();
    for (const rate of rates) {
      if (rate.bestPair) {
        const key = this.generateTrackingKey(
          rate.symbol,
          rate.bestPair.longExchange,
          rate.bestPair.shortExchange
        );
        currentRates.set(key, rate);
      }
    }

    // 先收集所有追蹤中的機會（避免在迴圈中修改 Map）
    const trackedEntries = Array.from(this.trackedOpportunities.entries());

    // 遍歷所有追蹤中的機會
    for (const [trackingKey, tracked] of trackedEntries) {
      const currentRate = currentRates.get(trackingKey);

      if (currentRate && currentRate.bestPair) {
        // 更新追蹤資訊
        this.updateTrackedOpportunity(tracked, currentRate, now);
      }

      // 檢查每個已通知的 Webhook 是否該機會已結束
      await this.checkDisappearedOpportunities(tracked, currentRate, webhooksByUser, now);
    }
  }

  /**
   * 更新追蹤中機會的統計資訊
   */
  private updateTrackedOpportunity(
    tracked: TrackedOpportunity,
    currentRate: FundingRatePair,
    now: Date
  ): void {
    const bestPair = currentRate.bestPair;
    if (!bestPair) return;

    const currentSpread = bestPair.spreadPercent / 100; // 轉為小數

    // 更新當前費差
    tracked.currentSpread = currentSpread;
    tracked.lastUpdatedAt = now;

    // 更新最高費差
    if (currentSpread > tracked.maxSpread) {
      tracked.maxSpread = currentSpread;
      tracked.maxSpreadAt = now;
    }

    // Phase 4 (US3): 檢查並記錄費率結算
    const longData = currentRate.exchanges.get(bestPair.longExchange as ExchangeName);
    const shortData = currentRate.exchanges.get(bestPair.shortExchange as ExchangeName);

    if (longData) {
      this.recordSettlementIfNeeded(tracked, 'long', longData, now);
    }
    if (shortData) {
      this.recordSettlementIfNeeded(tracked, 'short', shortData, now);
    }
  }

  /**
   * Phase 4 (US3): 如果當前時間接近結算時間，記錄費率
   * 注意：只記錄在機會追蹤開始後發生的結算
   */
  private recordSettlementIfNeeded(
    tracked: TrackedOpportunity,
    side: 'long' | 'short',
    data: ExchangeRateData,
    now: Date
  ): void {
    const intervalHours = side === 'long'
      ? tracked.longIntervalHours
      : tracked.shortIntervalHours;

    const settlements = side === 'long'
      ? tracked.longSettlements
      : tracked.shortSettlements;

    // 檢查是否接近結算時間（結算時間前後 5 分鐘內）
    const settlementWindow = 5 * 60 * 1000; // 5 分鐘

    // 計算最近的結算時間點
    const nearestSettlement = this.getNearestSettlementTime(now, intervalHours);
    const timeDiff = Math.abs(now.getTime() - nearestSettlement.getTime());

    if (timeDiff <= settlementWindow) {
      // 重要：只記錄在機會追蹤開始後發生的結算
      // 如果結算時間早於機會偵測時間，則不記錄
      if (nearestSettlement.getTime() < tracked.detectedAt.getTime()) {
        return;
      }

      // 檢查是否已經記錄過這個結算時間
      const alreadyRecorded = settlements.some(
        (s) => Math.abs(s.timestamp.getTime() - nearestSettlement.getTime()) < settlementWindow
      );

      if (!alreadyRecorded) {
        // 記錄結算
        settlements.push({
          timestamp: nearestSettlement,
          rate: data.rate.fundingRate,
        });

        logger.debug(
          {
            symbol: tracked.symbol,
            side,
            settlementTime: nearestSettlement.toISOString(),
            detectedAt: tracked.detectedAt.toISOString(),
            rate: data.rate.fundingRate,
          },
          'Recorded funding settlement'
        );
      }
    }
  }

  /**
   * Phase 4 (US3): 計算最近的結算時間點
   * 結算時間：每天 00:00, 01:00, ... (取決於 intervalHours)
   */
  private getNearestSettlementTime(now: Date, intervalHours: number): Date {
    const utcHours = now.getUTCHours();
    const utcMinutes = now.getUTCMinutes();

    // 計算當前小時在結算週期中的位置
    const periodIndex = Math.floor(utcHours / intervalHours);
    const currentPeriodStart = periodIndex * intervalHours;
    const nextPeriodStart = (periodIndex + 1) * intervalHours;

    // 判斷是更接近當前週期開始還是下一週期開始
    const currentPeriodDistance = utcHours - currentPeriodStart + utcMinutes / 60;
    const nextPeriodDistance = nextPeriodStart - utcHours - utcMinutes / 60;

    // 選擇最近的結算時間
    const nearestHour = currentPeriodDistance <= nextPeriodDistance
      ? currentPeriodStart
      : nextPeriodStart;

    const result = new Date(now);
    result.setUTCHours(nearestHour % 24, 0, 0, 0);

    // 如果是 24:00，則是第二天 00:00
    if (nearestHour >= 24) {
      result.setUTCDate(result.getUTCDate() + 1);
      result.setUTCHours(0, 0, 0, 0);
    }

    return result;
  }

  /**
   * 檢查機會是否對某些 Webhook 已結束
   */
  private async checkDisappearedOpportunities(
    tracked: TrackedOpportunity,
    currentRate: FundingRatePair | undefined,
    webhooksByUser: Map<string, WebhookConfig[]>,
    now: Date
  ): Promise<void> {
    // 收集需要發送結束通知的 Webhook（避免在迴圈中修改 Map）
    const webhooksToNotify: Array<{ webhookId: string; webhook: WebhookConfig }> = [];

    // 對每個已通知的 Webhook 檢查是否低於閾值
    for (const [webhookId, webhookInfo] of tracked.notifiedWebhooks.entries()) {
      // 跳過不需要結束通知的 Webhook
      if (!webhookInfo.notifyOnDisappear) {
        continue;
      }

      // 取得對應的 Webhook 設定（需要 webhookUrl）
      const userWebhooks = webhooksByUser.get(webhookInfo.userId);
      const webhook = userWebhooks?.find((w) => w.id === webhookId);
      if (!webhook) {
        continue;
      }

      // 計算當前年化收益
      const currentAnnualized = currentRate?.bestPair
        ? currentRate.bestPair.spreadAnnualized
        : 0;

      // 檢查是否低於閾值
      if (currentAnnualized < webhookInfo.threshold) {
        // 開始或繼續防抖動計時
        if (!tracked.disappearingAt.has(webhookId)) {
          tracked.disappearingAt.set(webhookId, now);
          logger.debug(
            {
              trackingKey: `${tracked.symbol}:${tracked.longExchange}:${tracked.shortExchange}`,
              webhookId,
              currentAnnualized,
              threshold: webhookInfo.threshold,
            },
            'Opportunity dropping below threshold, starting debounce'
          );
        } else {
          // 檢查是否超過防抖動時間
          const disappearingStart = tracked.disappearingAt.get(webhookId)!;
          const elapsed = now.getTime() - disappearingStart.getTime();

          if (elapsed >= this.disappearDebounceMs) {
            // 標記為需要發送通知
            webhooksToNotify.push({ webhookId, webhook });
          }
        }
      } else {
        // 費差回升，重置防抖動計時
        if (tracked.disappearingAt.has(webhookId)) {
          tracked.disappearingAt.delete(webhookId);
          logger.debug(
            {
              trackingKey: `${tracked.symbol}:${tracked.longExchange}:${tracked.shortExchange}`,
              webhookId,
              currentAnnualized,
            },
            'Opportunity spread recovered, reset debounce'
          );
        }
      }
    }

    // 在迴圈外發送通知並清理
    for (const { webhookId, webhook } of webhooksToNotify) {
      // 確認結束，發送通知
      await this.sendDisappearedNotification(tracked, webhook, now);

      // 從已通知 Webhook 中移除
      tracked.notifiedWebhooks.delete(webhookId);
      tracked.disappearingAt.delete(webhookId);
    }

    // 如果沒有任何 Webhook 在追蹤，移除整個機會
    if (tracked.notifiedWebhooks.size === 0 && webhooksToNotify.length > 0) {
      this.trackedOpportunities.delete(
        this.generateTrackingKey(
          tracked.symbol,
          tracked.longExchange,
          tracked.shortExchange
        )
      );
      logger.info(
        {
          symbol: tracked.symbol,
          longExchange: tracked.longExchange,
          shortExchange: tracked.shortExchange,
        },
        'Removed fully ended opportunity from tracking'
      );
    }
  }

  /**
   * 發送機會結束通知
   */
  private async sendDisappearedNotification(
    tracked: TrackedOpportunity,
    webhook: WebhookConfig,
    disappearedAt: Date
  ): Promise<void> {
    // 構建結束通知訊息
    const message = this.buildDisappearedMessage(tracked, disappearedAt);

    // 選擇對應的 Notifier 發送
    const notifier = this.getNotifier(webhook.platform);

    try {
      const result = await notifier.sendDisappearedNotification(
        webhook.webhookUrl,
        message
      );

      if (result.success) {
        logger.info(
          {
            symbol: tracked.symbol,
            webhookId: webhook.id,
            duration: message.durationFormatted,
            netProfit: message.netProfit,
          },
          'Opportunity disappeared notification sent'
        );

        // Phase 6 (US5): 儲存歷史記錄到資料庫
        await this.saveOpportunityHistory(tracked, webhook.userId, disappearedAt, message);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        {
          webhookId: webhook.id,
          symbol: tracked.symbol,
          error: errorMessage,
        },
        'Failed to send disappeared notification'
      );
    }
  }

  /**
   * Phase 6 (US5): 儲存機會歷史記錄到資料庫
   */
  private async saveOpportunityHistory(
    tracked: TrackedOpportunity,
    userId: string,
    disappearedAt: Date,
    message: OpportunityDisappearedMessage
  ): Promise<void> {
    try {
      const durationMs = BigInt(disappearedAt.getTime() - tracked.detectedAt.getTime());

      await this.historyRepository.create({
        symbol: tracked.symbol,
        longExchange: tracked.longExchange,
        shortExchange: tracked.shortExchange,
        detectedAt: tracked.detectedAt,
        disappearedAt,
        durationMs,
        initialSpread: tracked.initialSpread,
        maxSpread: tracked.maxSpread,
        maxSpreadAt: tracked.maxSpreadAt,
        finalSpread: tracked.currentSpread,
        longIntervalHours: tracked.longIntervalHours,
        shortIntervalHours: tracked.shortIntervalHours,
        settlementRecords: message.settlementRecords.map((s) => ({
          side: s.side,
          timestamp: s.timestamp.toISOString(),
          rate: s.rate,
        })),
        longSettlementCount: message.longSettlementCount,
        shortSettlementCount: message.shortSettlementCount,
        totalFundingProfit: message.totalFundingProfit,
        totalCost: message.totalCost,
        netProfit: message.netProfit,
        realizedAPY: message.realizedAPY,
        notificationCount: tracked.notificationCount,
        userId,
      });

      logger.info(
        {
          symbol: tracked.symbol,
          userId,
          duration: message.durationFormatted,
        },
        'Opportunity history saved to database'
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        {
          symbol: tracked.symbol,
          userId,
          error: errorMessage,
        },
        'Failed to save opportunity history'
      );
      // 不拋出錯誤，歷史記錄儲存失敗不應影響通知流程
    }
  }

  /**
   * 構建機會結束通知訊息
   */
  private buildDisappearedMessage(
    tracked: TrackedOpportunity,
    disappearedAt: Date
  ): OpportunityDisappearedMessage {
    const durationMs = disappearedAt.getTime() - tracked.detectedAt.getTime();

    // 計算模擬收益（目前 Phase 3 簡化版本，不計算實際結算）
    // Phase 4 會添加實際結算記錄功能
    const longSettlementCount = tracked.longSettlements.length;
    const shortSettlementCount = tracked.shortSettlements.length;

    // 計算總費率收益
    // 做多方收益（負費率 = 賺錢，所以取反）
    const longProfit = tracked.longSettlements.reduce(
      (sum, s) => sum + (-s.rate),
      0
    );
    // 做空方收益（正費率 = 賺錢）
    const shortProfit = tracked.shortSettlements.reduce(
      (sum, s) => sum + s.rate,
      0
    );
    const totalFundingProfit = longProfit + shortProfit;

    // 開平倉成本（使用統一常數 TRADING_FEES_RATE = 0.2%）
    const totalCost = TRADING_FEES_RATE;
    const netProfit = totalFundingProfit - totalCost;

    // 計算實際 APY
    const durationHours = durationMs / (1000 * 60 * 60);
    const realizedAPY = durationHours > 0
      ? (netProfit * (8760 / durationHours) * 100)
      : 0;

    // 合併結算記錄
    const settlementRecords = [
      ...tracked.longSettlements.map((s) => ({
        side: 'long' as const,
        timestamp: s.timestamp,
        rate: s.rate,
      })),
      ...tracked.shortSettlements.map((s) => ({
        side: 'short' as const,
        timestamp: s.timestamp,
        rate: s.rate,
      })),
    ].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return {
      symbol: tracked.symbol,
      longExchange: tracked.longExchange,
      shortExchange: tracked.shortExchange,

      detectedAt: tracked.detectedAt,
      disappearedAt,
      durationFormatted: formatDuration(durationMs),

      initialSpread: tracked.initialSpread,
      maxSpread: tracked.maxSpread,
      maxSpreadAt: tracked.maxSpreadAt,
      finalSpread: tracked.currentSpread,

      longIntervalHours: tracked.longIntervalHours,
      shortIntervalHours: tracked.shortIntervalHours,
      settlementRecords,

      longSettlementCount,
      shortSettlementCount,
      totalFundingProfit,
      totalCost,
      netProfit,
      realizedAPY,

      notificationCount: tracked.notificationCount,

      timestamp: new Date(),
    };
  }

  /**
   * 構建通知訊息
   */
  private buildNotificationMessage(
    rate: FundingRatePair
  ): ArbitrageNotificationMessage | null {
    const bestPair = rate.bestPair;
    if (!bestPair) {
      return null;
    }

    const longData = rate.exchanges.get(bestPair.longExchange);
    const shortData = rate.exchanges.get(bestPair.shortExchange);

    if (!longData || !shortData) {
      return null;
    }

    // 取得原始費率和時間基準
    const longOriginalRate = longData.rate.fundingRate;
    const longTimeBasis = longData.originalFundingInterval ?? 8;
    const shortOriginalRate = shortData.rate.fundingRate;
    const shortTimeBasis = shortData.originalFundingInterval ?? 8;

    // 取得標準化 8h 費率
    const longNormalizedRate = this.getNormalizedRate(longData, 8) ?? longOriginalRate;
    const shortNormalizedRate = this.getNormalizedRate(shortData, 8) ?? shortOriginalRate;

    // 計算回本週期
    const spreadPercent = bestPair.spreadPercent;
    const fundingPaybackPeriods = this.calculateFundingPaybackPeriods(spreadPercent);

    // 價差分析
    const priceDiffPercent = bestPair.priceDiffPercent;
    const isPriceDirectionCorrect = this.isPriceDirectionCorrect(
      longData.price,
      shortData.price
    );
    const paybackPeriods = !isPriceDirectionCorrect && priceDiffPercent !== undefined
      ? this.calculatePricePaybackPeriods(priceDiffPercent, spreadPercent)
      : undefined;

    return {
      symbol: rate.symbol,

      longExchange: bestPair.longExchange,
      longOriginalRate,
      longTimeBasis,
      longNormalizedRate,
      longPrice: longData.price,

      shortExchange: bestPair.shortExchange,
      shortOriginalRate,
      shortTimeBasis,
      shortNormalizedRate,
      shortPrice: shortData.price,

      spreadPercent,
      annualizedReturn: bestPair.spreadAnnualized,

      priceDiffPercent,
      isPriceDirectionCorrect,
      paybackPeriods,

      fundingPaybackPeriods,

      timestamp: rate.recordedAt,
    };
  }

  /**
   * 發送到單一 Webhook
   */
  private async sendToWebhook(
    webhook: WebhookConfig,
    message: ArbitrageNotificationMessage
  ): Promise<NotificationResult> {
    const notifier = this.getNotifier(webhook.platform);

    try {
      const result = await notifier.sendArbitrageNotification(
        webhook.webhookUrl,
        message
      );

      return {
        ...result,
        webhookId: webhook.id,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        {
          webhookId: webhook.id,
          platform: webhook.platform,
          error: errorMessage,
        },
        'Failed to send notification'
      );

      return {
        webhookId: webhook.id,
        success: false,
        error: errorMessage,
        timestamp: new Date(),
      };
    }
  }

  /**
   * 取得對應平台的 Notifier
   */
  private getNotifier(platform: string): INotifier {
    switch (platform) {
      case 'discord':
        return this.discordNotifier;
      case 'slack':
        return this.slackNotifier;
      default:
        throw new Error(`Unknown platform: ${platform}`);
    }
  }

  /**
   * 生成機會唯一 key（用於重複過濾）
   */
  private generateOpportunityKey(
    userId: string,
    symbol: string,
    longExchange: ExchangeName,
    shortExchange: ExchangeName,
    webhookId: string
  ): string {
    return `${userId}-${symbol}-${longExchange}-${shortExchange}-${webhookId}`;
  }

  /**
   * 檢查是否最近已通知
   */
  private isRecentlyNotified(key: string): boolean {
    const record = this.notifiedOpportunities.get(key);
    if (!record) {
      return false;
    }

    const elapsed = Date.now() - record.notifiedAt.getTime();
    return elapsed < this.deduplicationWindowMs;
  }

  /**
   * 標記為已通知
   */
  private markAsNotified(key: string): void {
    this.notifiedOpportunities.set(key, {
      key,
      notifiedAt: new Date(),
    });
  }

  /**
   * 清理過期的已通知記錄
   */
  private cleanupStaleNotifications(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, record] of this.notifiedOpportunities.entries()) {
      if (now - record.notifiedAt.getTime() > this.deduplicationWindowMs) {
        this.notifiedOpportunities.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug({ cleanedCount }, 'Cleaned up stale notification records');
    }

    // T046: 清理過期的追蹤記錄以防止記憶體洩漏
    this.cleanupStaleTrackedOpportunities();
  }

  /**
   * 清理過期的追蹤機會記錄
   * Feature 027: 防止記憶體洩漏
   */
  private cleanupStaleTrackedOpportunities(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, tracked] of this.trackedOpportunities.entries()) {
      const elapsed = now - tracked.lastUpdatedAt.getTime();

      // 如果追蹤記錄超過 30 分鐘沒有更新，移除它
      if (elapsed > this.staleTrackingWindowMs) {
        this.trackedOpportunities.delete(key);
        cleanedCount++;

        logger.info(
          {
            trackingKey: key,
            symbol: tracked.symbol,
            lastUpdatedAt: tracked.lastUpdatedAt.toISOString(),
            elapsedMinutes: Math.floor(elapsed / 60000),
          },
          'Removed stale tracked opportunity due to inactivity'
        );
      }
    }

    if (cleanedCount > 0) {
      logger.debug(
        { cleanedCount, remainingTracked: this.trackedOpportunities.size },
        'Cleaned up stale tracked opportunities'
      );
    }
  }

  /**
   * 檢查當前時間是否在 webhook 設定的任一通知時間窗口內
   * 支援多個通知時間點（例如 [40, 50] 表示 :40 和 :50 都會通知）
   *
   * @param notificationMinutes 用戶設定的通知分鐘陣列
   * @returns true 如果在任一通知時間窗口內
   */
  private isWithinWebhookNotificationWindow(notificationMinutes: number[]): boolean {
    const now = new Date();
    const currentMinute = now.getMinutes();

    // 檢查是否符合任一設定的時間點
    const isInWindow = notificationMinutes.some((targetMinute) => {
      const minWindow = targetMinute - this.notificationWindowRange;
      const maxWindow = targetMinute + this.notificationWindowRange;

      // 處理跨時邊界（例如設定 58 分時，窗口為 56-60，需要處理 00-02）
      if (minWindow < 0) {
        return currentMinute >= (60 + minWindow) || currentMinute <= maxWindow;
      }
      if (maxWindow >= 60) {
        return currentMinute >= minWindow || currentMinute <= (maxWindow - 60);
      }

      return currentMinute >= minWindow && currentMinute <= maxWindow;
    });

    if (!isInWindow) {
      logger.debug(
        {
          currentMinute,
          notificationMinutes,
          windowRange: this.notificationWindowRange,
        },
        'Outside notification window for this webhook'
      );
    }

    return isInWindow;
  }

  /**
   * 計算回本週期（費率收取次數）
   * Feature 025: 價差回本週期
   */
  private calculateFundingPaybackPeriods(spreadPercent: number): number {
    if (spreadPercent <= 0) {
      return Infinity;
    }
    // 假設標準開倉成本約 0.05% (做多 + 做空各 0.025%)
    const openingCost = 0.05;
    return Math.ceil(openingCost / spreadPercent);
  }

  /**
   * 計算價差打平週期
   */
  private calculatePricePaybackPeriods(
    priceDiffPercent: number,
    spreadPercent: number
  ): number {
    if (spreadPercent <= 0) {
      return Infinity;
    }
    return Math.ceil(Math.abs(priceDiffPercent) / spreadPercent);
  }

  /**
   * 判斷價差方向是否正確
   * 正確：做多交易所價格 <= 做空交易所價格
   */
  private isPriceDirectionCorrect(
    longPrice?: number,
    shortPrice?: number
  ): boolean {
    if (longPrice === undefined || shortPrice === undefined) {
      return true; // 無價格資料時預設為正確
    }
    return longPrice <= shortPrice;
  }

  /**
   * 取得基於時間基準的標準化費率
   *
   * @param data 交易所費率資料
   * @param timeBasis 目標時間基準（1, 4, 8, 24 小時）
   * @returns 標準化後的費率或 undefined
   */
  private getNormalizedRate(
    data: ExchangeRateData,
    timeBasis: number
  ): number | undefined {
    const timeBasisKey = `${timeBasis}h` as '1h' | '4h' | '8h' | '24h';
    const normalized = data.normalized?.[timeBasisKey];
    const originalInterval = data.originalFundingInterval;

    // 優先使用標準化值
    if (normalized !== undefined && normalized !== null) {
      return normalized;
    }

    // 如果原始週期等於目標時間基準，直接使用原始費率
    if (originalInterval === timeBasis) {
      return data.rate.fundingRate;
    }

    // 即時計算標準化值
    if (originalInterval && originalInterval !== timeBasis) {
      const originalRate = data.rate.fundingRate;
      return originalRate * (timeBasis / originalInterval);
    }

    return undefined;
  }
}
