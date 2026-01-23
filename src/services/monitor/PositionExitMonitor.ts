/**
 * PositionExitMonitor
 *
 * Feature: 067-position-exit-monitor
 *
 * 持倉平倉建議監控服務
 * - 監聽 rate-updated 事件
 * - 當符合條件時發送平倉建議通知
 * - 當 APY 回升時取消建議
 *
 * 觸發條件：
 * - 條件 1: APY < 0% → APY_NEGATIVE（繼續持有會虧損）
 * - 條件 2: (APY < X%) AND (累計費率收益 > 價差損失) → PROFIT_LOCKABLE（可鎖定獲利）
 */

import type { EventEmitter } from 'events';
import { Decimal } from 'decimal.js';
import type { Position } from '@/generated/prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { decrypt } from '@/lib/encryption';
import { getCumulativeFundingPnL } from '@/lib/funding-pnl-calculator';
import { positionExitEmitter } from '@/services/websocket/PositionExitEmitter';
import { NotificationWebhookRepository } from '@/repositories/NotificationWebhookRepository';
import { DiscordNotifier } from '@/services/notification/DiscordNotifier';
import { SlackNotifier } from '@/services/notification/SlackNotifier';
import type { FundingRatePair, ExchangeName } from '@/models/FundingRate';
import {
  ExitSuggestionReason,
  type ExitSuggestedEvent,
  type ExitCanceledEvent,
  type ExitSuggestionMessage,
} from './types';

/**
 * API Key 資訊（用於 getCumulativeFundingPnL）
 */
interface ApiKeyInfo {
  exchange: string;
  apiKey: string;
  apiSecret: string;
  passphrase?: string;
  isTestnet: boolean;
}

/**
 * shouldSuggestClose 的輸入參數
 */
export interface ShouldSuggestCloseParams {
  currentAPY: number;
  threshold: number;
  fundingPnL: Decimal;
  priceDiffLoss: Decimal;
}

/**
 * shouldSuggestClose 的返回結果
 */
export interface ShouldSuggestCloseResult {
  suggest: boolean;
  reason: ExitSuggestionReason | null;
}

/**
 * 監控統計資料
 */
export interface PositionExitMonitorStats {
  suggestionsEmitted: number;
  suggestionsCanceled: number;
  lastCheckAt: Date | null;
  errors: number;
}

/**
 * 防抖動時間（毫秒）
 */
const DEBOUNCE_MS = 60_000; // 1 分鐘

/**
 * 持倉平倉建議監控服務
 */
export class PositionExitMonitor {
  private eventEmitter: EventEmitter | null = null;
  private boundHandler: ((pair: FundingRatePair) => Promise<void>) | null = null;

  // 防抖動：記錄每個持倉最後通知時間
  private lastNotifiedMap: Map<string, number> = new Map();

  // 通知服務
  private readonly webhookRepository = new NotificationWebhookRepository(prisma);
  private readonly discordNotifier = new DiscordNotifier();
  private readonly slackNotifier = new SlackNotifier();

  // 統計資料
  private stats: PositionExitMonitorStats = {
    suggestionsEmitted: 0,
    suggestionsCanceled: 0,
    lastCheckAt: null,
    errors: 0,
  };

  /**
   * 綁定到 FundingRateMonitor
   *
   * @param eventEmitter - FundingRateMonitor 實例
   */
  attach(eventEmitter: EventEmitter): void {
    // 防止重複綁定
    if (this.eventEmitter) {
      this.detach();
    }

    this.eventEmitter = eventEmitter;
    this.boundHandler = this.handleRateUpdated.bind(this);
    this.eventEmitter.on('rate-updated', this.boundHandler);

    logger.info('[Feature 067] PositionExitMonitor attached to FundingRateMonitor');
  }

  /**
   * 解除綁定
   */
  detach(): void {
    if (this.eventEmitter && this.boundHandler) {
      this.eventEmitter.off('rate-updated', this.boundHandler);
      this.eventEmitter = null;
      this.boundHandler = null;

      logger.info('[Feature 067] PositionExitMonitor detached');
    }
  }

  /**
   * 判斷是否應該建議平倉
   *
   * 條件 1: APY < 0% → APY_NEGATIVE
   * 條件 2: (APY < threshold) AND (fundingPnL > priceDiffLoss) → PROFIT_LOCKABLE
   *
   * @param params - 判斷參數
   * @returns 判斷結果
   */
  shouldSuggestClose(params: ShouldSuggestCloseParams): ShouldSuggestCloseResult {
    const { currentAPY, threshold, fundingPnL, priceDiffLoss } = params;

    // 條件 1: APY < 0%
    if (currentAPY < 0) {
      return {
        suggest: true,
        reason: ExitSuggestionReason.APY_NEGATIVE,
      };
    }

    // 條件 2: (APY < threshold) AND (fundingPnL > priceDiffLoss)
    if (currentAPY < threshold && fundingPnL.gt(priceDiffLoss)) {
      return {
        suggest: true,
        reason: ExitSuggestionReason.PROFIT_LOCKABLE,
      };
    }

    return {
      suggest: false,
      reason: null,
    };
  }

  /**
   * 處理 rate-updated 事件
   *
   * @param pair - 費率對資料
   */
  async handleRateUpdated(pair: FundingRatePair): Promise<void> {
    try {
      this.stats.lastCheckAt = new Date();

      // 沒有 bestPair 時跳過
      if (!pair.bestPair) {
        return;
      }

      const { symbol } = pair;
      const currentAPY = pair.bestPair.spreadAnnualized;

      // 查詢該 symbol 的 OPEN 持倉
      const positions = await prisma.position.findMany({
        where: {
          symbol,
          status: 'OPEN',
        },
      });

      if (positions.length === 0) {
        return;
      }

      logger.debug(
        { symbol, positionCount: positions.length, currentAPY },
        '[Feature 067] Processing positions for exit suggestion'
      );

      // 處理每個持倉
      for (const position of positions) {
        try {
          await this.processPosition(position, pair, currentAPY);
        } catch (error) {
          this.stats.errors++;
          logger.error(
            { positionId: position.id, error },
            '[Feature 067] Error processing position'
          );
        }
      }
    } catch (error) {
      this.stats.errors++;
      logger.error({ error }, '[Feature 067] Error in handleRateUpdated');
    }
  }

  /**
   * 獲取用戶的 API Keys（按交易所名稱索引）
   *
   * @param userId - 用戶 ID
   * @param exchanges - 需要的交易所列表
   * @returns API Keys 記錄
   */
  private async getUserApiKeys(
    userId: string,
    exchanges: string[]
  ): Promise<Record<string, ApiKeyInfo>> {
    const apiKeys = await prisma.apiKey.findMany({
      where: {
        userId,
        exchange: { in: exchanges.map((e) => e.toLowerCase()) },
        isActive: true,
      },
    });

    const result: Record<string, ApiKeyInfo> = {};

    for (const apiKey of apiKeys) {
      // 避免重複（同一交易所取第一個）
      if (result[apiKey.exchange]) continue;

      try {
        result[apiKey.exchange] = {
          exchange: apiKey.exchange,
          apiKey: decrypt(apiKey.encryptedKey),
          apiSecret: decrypt(apiKey.encryptedSecret),
          passphrase: apiKey.encryptedPassphrase
            ? decrypt(apiKey.encryptedPassphrase)
            : undefined,
          isTestnet: apiKey.environment === 'TESTNET',
        };
      } catch (decryptError) {
        logger.warn(
          { userId, exchange: apiKey.exchange, error: decryptError },
          '[Feature 067] Failed to decrypt API key'
        );
      }
    }

    return result;
  }

  /**
   * 處理單一持倉
   */
  private async processPosition(
    position: Position,
    pair: FundingRatePair,
    currentAPY: number
  ): Promise<void> {
    // 取得用戶設定
    const settings = await prisma.tradingSettings.findUnique({
      where: { userId: position.userId },
    });

    // 用戶停用平倉建議時跳過
    if (!settings?.exitSuggestionEnabled) {
      return;
    }

    // 取得用戶的 API Keys
    const apiKeys = await this.getUserApiKeys(position.userId, [
      position.longExchange,
      position.shortExchange,
    ]);

    // 驗證是否有所需的 API Keys
    const hasLongKey = !!apiKeys[position.longExchange.toLowerCase()];
    const hasShortKey = !!apiKeys[position.shortExchange.toLowerCase()];

    if (!hasLongKey || !hasShortKey) {
      logger.debug(
        {
          positionId: position.id,
          hasLongKey,
          hasShortKey,
          longExchange: position.longExchange,
          shortExchange: position.shortExchange,
        },
        '[Feature 067] Missing API keys for position, using cached funding PnL'
      );
    }

    // 取得累計費率收益
    let fundingPnL: Decimal;
    try {
      // 只有在有完整 API Keys 時才查詢交易所
      if (hasLongKey && hasShortKey) {
        fundingPnL = await getCumulativeFundingPnL(position, apiKeys);
      } else {
        // 沒有 API Keys 時使用快取值
        fundingPnL = position.cachedFundingPnL
          ? new Decimal(position.cachedFundingPnL.toString())
          : new Decimal(0);
      }
    } catch (error) {
      // 如果無法取得累計收益，使用快取值或 0
      fundingPnL = position.cachedFundingPnL
        ? new Decimal(position.cachedFundingPnL.toString())
        : new Decimal(0);

      logger.warn(
        { positionId: position.id, error },
        '[Feature 067] Failed to get funding PnL, using cached value'
      );
    }

    // 計算價差損失（簡化版：使用當前價格差）
    const priceDiffLoss = this.calculatePriceDiffLoss(position, pair);

    // 判斷是否應該建議平倉
    const threshold = settings.exitSuggestionThreshold
      ? new Decimal(settings.exitSuggestionThreshold.toString()).toNumber()
      : 100;

    const result = this.shouldSuggestClose({
      currentAPY,
      threshold,
      fundingPnL,
      priceDiffLoss,
    });

    // 處理結果
    if (result.suggest && !position.exitSuggested) {
      // 新建議：更新 Position 並發送通知
      await this.emitSuggestion(position, pair, currentAPY, fundingPnL, priceDiffLoss, result.reason!, settings);
    } else if (!result.suggest && position.exitSuggested) {
      // 取消建議：APY 回升
      await this.cancelSuggestion(position, currentAPY);
    }
  }

  /**
   * 計算價差損失
   */
  private calculatePriceDiffLoss(position: Position, pair: FundingRatePair): Decimal {
    // 從 pair 取得當前價格
    const longExchangeData = pair.exchanges.get(position.longExchange as ExchangeName);
    const shortExchangeData = pair.exchanges.get(position.shortExchange as ExchangeName);

    if (!longExchangeData?.rate?.markPrice || !shortExchangeData?.rate?.markPrice) {
      return new Decimal(0);
    }

    const currentLongPrice = longExchangeData.rate.markPrice;
    const currentShortPrice = shortExchangeData.rate.markPrice;

    // 計算價差損失
    // 做多方：(entryPrice - currentPrice) * size
    // 做空方：(currentPrice - entryPrice) * size
    const longEntryPrice = new Decimal(position.longEntryPrice.toString());
    const shortEntryPrice = new Decimal(position.shortEntryPrice.toString());
    const longSize = new Decimal(position.longPositionSize.toString());
    const shortSize = new Decimal(position.shortPositionSize.toString());

    const longPnL = new Decimal(currentLongPrice).minus(longEntryPrice).times(longSize);
    const shortPnL = shortEntryPrice.minus(new Decimal(currentShortPrice)).times(shortSize);

    // 總價差 PnL（如果為負，表示損失）
    const totalPricePnL = longPnL.plus(shortPnL);

    // 返回損失（如果有獲利則為 0）
    return totalPricePnL.lt(0) ? totalPricePnL.abs() : new Decimal(0);
  }

  /**
   * 發送平倉建議
   */
  private async emitSuggestion(
    position: Position,
    pair: FundingRatePair,
    currentAPY: number,
    fundingPnL: Decimal,
    priceDiffLoss: Decimal,
    reason: ExitSuggestionReason,
    settings: { exitNotificationEnabled?: boolean } | null
  ): Promise<void> {
    // 檢查防抖動
    const lastNotified = this.lastNotifiedMap.get(position.id);
    const now = Date.now();

    if (lastNotified && now - lastNotified < DEBOUNCE_MS) {
      logger.debug(
        { positionId: position.id, timeSinceLastNotification: now - lastNotified },
        '[Feature 067] Debounce: skipping notification'
      );
      return;
    }

    // 更新 Position
    await prisma.position.update({
      where: { id: position.id },
      data: {
        exitSuggested: true,
        exitSuggestedAt: new Date(),
        exitSuggestedReason: reason,
      },
    });

    // 取得價格資訊
    const longExchangeData = pair.exchanges.get(position.longExchange as ExchangeName);
    const shortExchangeData = pair.exchanges.get(position.shortExchange as ExchangeName);
    const currentLongPrice = longExchangeData?.rate?.markPrice || 0;
    const currentShortPrice = shortExchangeData?.rate?.markPrice || 0;

    // 建立事件資料
    const event: ExitSuggestedEvent = {
      positionId: position.id,
      symbol: position.symbol,
      reason,
      reasonDescription: this.getReasonDescription(reason),
      currentAPY,
      fundingPnL: fundingPnL.toNumber(),
      priceDiffLoss: priceDiffLoss.toNumber(),
      netProfit: fundingPnL.minus(priceDiffLoss).toNumber(),
      longExchange: position.longExchange,
      shortExchange: position.shortExchange,
      currentLongPrice,
      currentShortPrice,
      stalePrice: false,
      suggestedAt: new Date().toISOString(),
    };

    // 發送 WebSocket 事件
    positionExitEmitter.emitExitSuggested(position.userId, event);

    // 發送 Discord/Slack 通知（如果用戶啟用通知）
    if (settings?.exitNotificationEnabled !== false) {
      await this.sendExitSuggestionNotifications(position.userId, {
        symbol: position.symbol,
        positionId: position.id,
        reason,
        reasonDescription: this.getReasonDescription(reason),
        currentAPY,
        fundingPnL: fundingPnL.toNumber(),
        priceDiffLoss: priceDiffLoss.toNumber(),
        netProfit: fundingPnL.minus(priceDiffLoss).toNumber(),
        longExchange: position.longExchange,
        shortExchange: position.shortExchange,
        timestamp: new Date(),
      });
    }

    // 更新防抖動記錄
    this.lastNotifiedMap.set(position.id, now);

    // 更新統計
    this.stats.suggestionsEmitted++;

    logger.info(
      {
        positionId: position.id,
        symbol: position.symbol,
        reason,
        currentAPY,
      },
      '[Feature 067] Exit suggestion emitted'
    );
  }

  /**
   * 取消平倉建議
   */
  private async cancelSuggestion(position: Position, currentAPY: number): Promise<void> {
    // 更新 Position
    await prisma.position.update({
      where: { id: position.id },
      data: {
        exitSuggested: false,
        exitSuggestedAt: null,
        exitSuggestedReason: null,
      },
    });

    // 建立事件資料
    const event: ExitCanceledEvent = {
      positionId: position.id,
      symbol: position.symbol,
      currentAPY,
      canceledAt: new Date().toISOString(),
    };

    // 發送 WebSocket 事件
    positionExitEmitter.emitExitCanceled(position.userId, event);

    // 清除防抖動記錄（允許下次立即通知）
    this.lastNotifiedMap.delete(position.id);

    // 更新統計
    this.stats.suggestionsCanceled++;

    logger.info(
      {
        positionId: position.id,
        symbol: position.symbol,
        currentAPY,
      },
      '[Feature 067] Exit suggestion canceled'
    );
  }

  /**
   * 發送 Discord/Slack 平倉建議通知
   */
  private async sendExitSuggestionNotifications(
    userId: string,
    message: ExitSuggestionMessage
  ): Promise<void> {
    try {
      // 查詢用戶啟用的 webhooks
      const webhooks = await this.webhookRepository.findEnabledByUserId(userId);

      if (webhooks.length === 0) {
        logger.debug(
          { userId },
          '[Feature 067] No enabled webhooks found for user'
        );
        return;
      }

      // 並行發送通知到所有 webhooks
      const results = await Promise.allSettled(
        webhooks.map(async (webhook) => {
          if (webhook.platform === 'discord') {
            return this.discordNotifier.sendExitSuggestionNotification(
              webhook.webhookUrl,
              message
            );
          } else if (webhook.platform === 'slack') {
            return this.slackNotifier.sendExitSuggestionNotification(
              webhook.webhookUrl,
              message
            );
          }
          return { success: false, error: `Unknown platform: ${webhook.platform}` };
        })
      );

      // 記錄發送結果
      const successCount = results.filter(
        (r) => r.status === 'fulfilled' && r.value.success
      ).length;
      const failCount = results.length - successCount;

      if (failCount > 0) {
        logger.warn(
          { userId, successCount, failCount },
          '[Feature 067] Some exit suggestion notifications failed'
        );
      } else {
        logger.debug(
          { userId, count: successCount },
          '[Feature 067] Exit suggestion notifications sent successfully'
        );
      }
    } catch (error) {
      logger.error(
        { userId, error },
        '[Feature 067] Error sending exit suggestion notifications'
      );
    }
  }

  /**
   * 取得建議原因描述
   */
  private getReasonDescription(reason: ExitSuggestionReason): string {
    switch (reason) {
      case ExitSuggestionReason.APY_NEGATIVE:
        return 'APY 已轉負，繼續持有會虧損';
      case ExitSuggestionReason.PROFIT_LOCKABLE:
        return 'APY 低於閾值但整體有獲利可鎖定';
      default:
        return '建議平倉';
    }
  }

  /**
   * 取得統計資料
   */
  getStats(): PositionExitMonitorStats {
    return { ...this.stats };
  }
}
