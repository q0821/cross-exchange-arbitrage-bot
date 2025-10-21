/**
 * 通知服務實作
 * 負責發送各種通知到不同渠道
 *
 * Feature: 005-arbitrage-opportunity-detection
 * Date: 2025-10-22
 */

import type { PrismaClient, NotificationChannel, NotificationType, DisappearReason } from '@prisma/client'
import type { Decimal } from '@prisma/client/runtime/library'
import type { ArbitrageOpportunity } from '@prisma/client'
import type {
  INotificationService,
  IDebounceManager,
  CreateNotificationData,
} from '../../types/opportunity-detection'
import { NotificationLog } from '@prisma/client'
import { logger } from '../../lib/logger'
import { formatRateDifferencePercent, formatDuration } from '../../lib/opportunity-helpers'
import { createDebounceKey } from '../../lib/debounce'

/**
 * 通知服務實作
 */
export class NotificationService implements INotificationService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly debounceManager: IDebounceManager
  ) {
    logger.info('初始化 NotificationService')
  }

  /**
   * 發送機會出現通知
   */
  async notifyOpportunityAppeared(
    opportunity: ArbitrageOpportunity,
    channels: NotificationChannel[]
  ): Promise<void> {
    try {
      // 檢查防抖動
      const debounceKey = createDebounceKey(opportunity.symbol, 'OPPORTUNITY_APPEARED')
      const shouldNotify = this.debounceManager.shouldTrigger(debounceKey)
      const skipCount = this.debounceManager.getSkipCount(debounceKey)

      // 構建通知訊息
      const message = this.buildAppearedMessage(opportunity)

      // 發送到各渠道
      await Promise.allSettled(
        channels.map(async (channel) => {
          await this.sendToChannel(channel, message, opportunity)

          // 記錄通知到資料庫
          await this.logNotification({
            opportunityId: opportunity.id,
            symbol: opportunity.symbol,
            notificationType: 'OPPORTUNITY_APPEARED',
            channel,
            severity: 'INFO',
            message,
            rateDifference: opportunity.rate_difference,
            isDebounced: !shouldNotify,
            debounceSkippedCount: skipCount,
          })
        })
      )

      logger.info({
        opportunityId: opportunity.id,
        symbol: opportunity.symbol,
        channels,
        isDebounced: !shouldNotify,
      }, '發送機會出現通知')
    } catch (error) {
      logger.error({ error, opportunityId: opportunity.id }, '發送機會出現通知時發生錯誤')
      // 不拋出錯誤，避免影響主流程
    }
  }

  /**
   * 發送機會更新通知
   */
  async notifyOpportunityUpdated(
    opportunity: ArbitrageOpportunity,
    oldRateDifference: Decimal,
    channels: NotificationChannel[]
  ): Promise<void> {
    try {
      // 檢查防抖動
      const debounceKey = createDebounceKey(opportunity.symbol, 'OPPORTUNITY_UPDATED')
      const shouldNotify = this.debounceManager.shouldTrigger(debounceKey)
      const skipCount = this.debounceManager.getSkipCount(debounceKey)

      if (!shouldNotify) {
        logger.debug({
          opportunityId: opportunity.id,
          symbol: opportunity.symbol,
          skipCount,
        }, '機會更新通知被防抖動跳過')
        return
      }

      // 構建通知訊息
      const message = this.buildUpdatedMessage(opportunity, oldRateDifference)

      // 發送到各渠道
      await Promise.allSettled(
        channels.map(async (channel) => {
          await this.sendToChannel(channel, message, opportunity)

          // 記錄通知到資料庫
          await this.logNotification({
            opportunityId: opportunity.id,
            symbol: opportunity.symbol,
            notificationType: 'OPPORTUNITY_UPDATED',
            channel,
            severity: 'INFO',
            message,
            rateDifference: opportunity.rate_difference,
            isDebounced: false,
            debounceSkippedCount: skipCount,
          })
        })
      )

      logger.info({
        opportunityId: opportunity.id,
        symbol: opportunity.symbol,
        channels,
      }, '發送機會更新通知')
    } catch (error) {
      logger.error({ error, opportunityId: opportunity.id }, '發送機會更新通知時發生錯誤')
    }
  }

  /**
   * 發送機會消失通知
   */
  async notifyOpportunityDisappeared(
    opportunity: ArbitrageOpportunity,
    reason: DisappearReason,
    channels: NotificationChannel[]
  ): Promise<void> {
    try {
      // 構建通知訊息
      const message = this.buildDisappearedMessage(opportunity, reason)

      // 發送到各渠道
      await Promise.allSettled(
        channels.map(async (channel) => {
          await this.sendToChannel(channel, message, opportunity)

          // 記錄通知到資料庫
          await this.logNotification({
            opportunityId: opportunity.id,
            symbol: opportunity.symbol,
            notificationType: 'OPPORTUNITY_DISAPPEARED',
            channel,
            severity: reason === 'RATE_DROPPED' ? 'INFO' : 'WARNING',
            message,
            rateDifference: opportunity.rate_difference,
            isDebounced: false,
            debounceSkippedCount: 0,
          })
        })
      )

      logger.info({
        opportunityId: opportunity.id,
        symbol: opportunity.symbol,
        reason,
        channels,
      }, '發送機會消失通知')
    } catch (error) {
      logger.error({ error, opportunityId: opportunity.id }, '發送機會消失通知時發生錯誤')
    }
  }

  /**
   * 記錄通知到資料庫
   */
  async logNotification(data: CreateNotificationData): Promise<NotificationLog> {
    try {
      return await this.prisma.notificationLog.create({
        data: {
          opportunity_id: data.opportunityId,
          symbol: data.symbol,
          notification_type: data.notificationType,
          channel: data.channel,
          severity: data.severity,
          message: data.message,
          rate_difference: data.rateDifference,
          is_debounced: data.isDebounced || false,
          debounce_skipped_count: data.debounceSkippedCount || 0,
        },
      })
    } catch (error) {
      logger.error({ error, data }, '記錄通知到資料庫時發生錯誤')
      throw error
    }
  }

  /**
   * 檢查是否應該發送通知（防抖動）
   */
  async shouldNotify(symbol: string, notificationType: NotificationType): Promise<boolean> {
    const debounceKey = createDebounceKey(symbol, notificationType)
    return this.debounceManager.shouldTrigger(debounceKey)
  }

  // ===== 私有輔助方法 =====

  /**
   * 構建機會出現訊息
   */
  private buildAppearedMessage(opportunity: ArbitrageOpportunity): string {
    const rateDiffPercent = formatRateDifferencePercent(opportunity.rate_difference)
    const expectedReturnPercent = formatRateDifferencePercent(opportunity.expected_return_rate)

    return `🔔 新套利機會！
幣別: ${opportunity.symbol}
做多: ${opportunity.long_exchange} (${formatRateDifferencePercent(opportunity.long_funding_rate)})
做空: ${opportunity.short_exchange} (${formatRateDifferencePercent(opportunity.short_funding_rate)})
費率差異: ${rateDiffPercent}
預期年化收益: ${expectedReturnPercent}`
  }

  /**
   * 構建機會更新訊息
   */
  private buildUpdatedMessage(opportunity: ArbitrageOpportunity, oldRateDifference: Decimal): string {
    const newRateDiffPercent = formatRateDifferencePercent(opportunity.rate_difference)
    const oldRateDiffPercent = formatRateDifferencePercent(oldRateDifference)

    return `📊 機會更新
幣別: ${opportunity.symbol}
費率差異: ${oldRateDiffPercent} → ${newRateDiffPercent}
最大差異: ${formatRateDifferencePercent(opportunity.max_rate_difference || opportunity.rate_difference)}`
  }

  /**
   * 構建機會消失訊息
   */
  private buildDisappearedMessage(opportunity: ArbitrageOpportunity, reason: DisappearReason): string {
    const durationMs = opportunity.expired_at
      ? opportunity.expired_at.getTime() - opportunity.detected_at.getTime()
      : 0
    const durationStr = formatDuration(durationMs)

    const reasonText = {
      RATE_DROPPED: '費率差異低於閾值',
      DATA_UNAVAILABLE: '資料不可用',
      MANUAL_CLOSE: '手動關閉',
      SYSTEM_ERROR: '系統錯誤',
    }[reason]

    return `❌ 機會消失
幣別: ${opportunity.symbol}
原因: ${reasonText}
持續時間: ${durationStr}
最大差異: ${formatRateDifferencePercent(opportunity.max_rate_difference || opportunity.rate_difference)}
通知次數: ${opportunity.notification_count}`
  }

  /**
   * 發送通知到指定渠道
   */
  private async sendToChannel(
    channel: NotificationChannel,
    message: string,
    opportunity: ArbitrageOpportunity
  ): Promise<void> {
    switch (channel) {
      case 'TERMINAL':
        this.sendToTerminal(message)
        break

      case 'LOG':
        this.sendToLog(message, opportunity)
        break

      case 'WEBHOOK':
        // TODO: 實作 Webhook 通知
        logger.debug({ opportunityId: opportunity.id }, 'Webhook 通知尚未實作')
        break

      case 'TELEGRAM':
        // TODO: 實作 Telegram 通知
        logger.debug({ opportunityId: opportunity.id }, 'Telegram 通知尚未實作')
        break

      default:
        logger.warn({ channel }, '未知的通知渠道')
    }
  }

  /**
   * 發送到終端機
   */
  private sendToTerminal(message: string): void {
    console.log('\n' + message + '\n')
  }

  /**
   * 發送到日誌
   */
  private sendToLog(message: string, opportunity: ArbitrageOpportunity): void {
    logger.info({
      opportunityId: opportunity.id,
      symbol: opportunity.symbol,
      message,
    }, '套利機會通知')
  }
}
