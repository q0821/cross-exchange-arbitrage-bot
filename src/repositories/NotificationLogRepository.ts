/**
 * 通知日誌儲存庫實作
 * 負責通知記錄的持久化操作
 *
 * Feature: 005-arbitrage-opportunity-detection
 * Date: 2025-10-23
 */

import { PrismaClient, type NotificationLog } from '@prisma/client'
import type {
  CreateNotificationData,
} from '../types/opportunity-detection'
import { logger } from '../lib/logger'

/**
 * 通知日誌儲存庫實作
 */
export class NotificationLogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * 建立通知記錄
   */
  async create(data: CreateNotificationData): Promise<NotificationLog> {
    try {
      const log = await this.prisma.notificationLog.create({
        data: {
          opportunity_id: data.opportunityId,
          symbol: data.symbol,
          notification_type: data.notificationType,
          channel: data.channel,
          severity: data.severity,
          message: data.message,
          rate_difference: data.rateDifference,
          is_debounced: data.isDebounced ?? false,
          debounce_skipped_count: data.debounceSkippedCount ?? 0,
        },
      })

      logger.debug({
        opportunityId: data.opportunityId,
        symbol: data.symbol,
        notificationType: data.notificationType,
        channel: data.channel,
      }, '建立通知記錄')

      return log
    } catch (error) {
      logger.error({ error, data }, '建立通知記錄失敗')
      throw error
    }
  }

  /**
   * 根據機會 ID 查詢通知記錄
   */
  async findByOpportunityId(opportunityId: string, limit?: number): Promise<NotificationLog[]> {
    try {
      return await this.prisma.notificationLog.findMany({
        where: {
          opportunity_id: opportunityId,
        },
        orderBy: {
          sent_at: 'desc',
        },
        take: limit,
      })
    } catch (error) {
      logger.error({ error, opportunityId }, '查詢機會通知記錄失敗')
      throw error
    }
  }

  /**
   * 根據幣別查詢最近的通知記錄
   */
  async findRecentBySymbol(symbol: string, limit: number = 10): Promise<NotificationLog[]> {
    try {
      return await this.prisma.notificationLog.findMany({
        where: {
          symbol,
        },
        orderBy: {
          sent_at: 'desc',
        },
        take: limit,
      })
    } catch (error) {
      logger.error({ error, symbol }, '查詢幣別通知記錄失敗')
      throw error
    }
  }

  /**
   * 獲取防抖動統計
   * 返回指定時間範圍內被防抖動跳過的通知數量
   */
  async getDebounceStats(
    symbol?: string,
    hoursBack: number = 24
  ): Promise<{
    totalNotifications: number
    debouncedCount: number
    totalSkipped: number
    debounceRate: number
  }> {
    try {
      const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000)

      const where: any = {
        sent_at: {
          gte: since,
        },
      }

      if (symbol) {
        where.symbol = symbol
      }

      const [totalNotifications, debouncedLogs] = await Promise.all([
        this.prisma.notificationLog.count({ where }),
        this.prisma.notificationLog.findMany({
          where: {
            ...where,
            is_debounced: true,
          },
          select: {
            debounce_skipped_count: true,
          },
        }),
      ])

      const debouncedCount = debouncedLogs.length
      const totalSkipped = debouncedLogs.reduce((sum, log) => sum + log.debounce_skipped_count, 0)
      const debounceRate = totalNotifications > 0 ? (debouncedCount / totalNotifications) * 100 : 0

      logger.debug({
        symbol,
        hoursBack,
        totalNotifications,
        debouncedCount,
        totalSkipped,
        debounceRate: debounceRate.toFixed(2),
      }, '獲取防抖動統計')

      return {
        totalNotifications,
        debouncedCount,
        totalSkipped,
        debounceRate,
      }
    } catch (error) {
      logger.error({ error, symbol, hoursBack }, '獲取防抖動統計失敗')
      throw error
    }
  }

  /**
   * 獲取通知頻率統計
   * 返回每個幣別的通知頻率（次數/小時）
   */
  async getNotificationFrequency(
    hoursBack: number = 24,
    limit: number = 10
  ): Promise<Array<{
    symbol: string
    count: number
    frequency: number
  }>> {
    try {
      const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000)

      const symbolCounts = await this.prisma.notificationLog.groupBy({
        by: ['symbol'],
        where: {
          sent_at: {
            gte: since,
          },
        },
        _count: {
          symbol: true,
        },
        orderBy: {
          _count: {
            symbol: 'desc',
          },
        },
        take: limit,
      })

      const result = symbolCounts.map(item => ({
        symbol: item.symbol,
        count: item._count.symbol,
        frequency: item._count.symbol / hoursBack,
      }))

      logger.debug({
        hoursBack,
        topSymbols: result.slice(0, 3).map(r => r.symbol),
      }, '獲取通知頻率統計')

      return result
    } catch (error) {
      logger.error({ error, hoursBack }, '獲取通知頻率統計失敗')
      throw error
    }
  }
}
