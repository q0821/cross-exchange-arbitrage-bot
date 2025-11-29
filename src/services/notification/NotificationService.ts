/**
 * NotificationService - 套利機會通知服務
 *
 * 負責：
 * 1. 監控套利機會並判斷是否超過用戶閾值
 * 2. 發送通知到所有啟用的 Webhooks
 * 3. 重複過濾（5 分鐘內不重複發送同一機會）
 *
 * Feature 026: Discord/Slack 套利機會即時推送通知
 */

import { PrismaClient } from '@prisma/client';
import { NotificationWebhookRepository } from '../../repositories/NotificationWebhookRepository';
import { DiscordNotifier } from './DiscordNotifier';
import { SlackNotifier } from './SlackNotifier';
import { logger } from '../../lib/logger';
import type {
  WebhookConfig,
  ArbitrageNotificationMessage,
  NotificationResult,
  INotifier,
} from './types';
import type { FundingRatePair, ExchangeName, ExchangeRateData } from '../../models/FundingRate';

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
  private readonly discordNotifier: DiscordNotifier;
  private readonly slackNotifier: SlackNotifier;

  // 重複過濾：記錄已通知的機會 (key -> timestamp)
  private readonly notifiedOpportunities = new Map<string, NotifiedOpportunity>();
  private readonly deduplicationWindowMs = 5 * 60 * 1000; // 5 分鐘

  private constructor(prisma: PrismaClient) {
    this.webhookRepository = new NotificationWebhookRepository(prisma);
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
