/**
 * 機會歷史儲存庫實作
 * 負責機會歷史資料的持久化操作
 *
 * Feature: 005-arbitrage-opportunity-detection
 * Date: 2025-10-22
 */

import { PrismaClient, type DisappearReason } from '@prisma/client'
import type { Decimal } from '@prisma/client/runtime/library'
import type {
  IOpportunityHistoryRepository,
  CreateHistoryData,
  HistoryFilters,
  HistoryStatistics,
} from '../types/opportunity-detection'
import { OpportunityHistory as PrismaOpportunityHistory } from '@prisma/client'
import { logger } from '../lib/logger'

/**
 * 機會歷史儲存庫實作
 */
export class OpportunityHistoryRepository implements IOpportunityHistoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * 建立歷史記錄
   */
  async create(data: CreateHistoryData): Promise<PrismaOpportunityHistory> {
    try {
      const history = await this.prisma.opportunityHistory.create({
        data: {
          opportunity_id: data.opportunityId,
          symbol: data.symbol,
          long_exchange: data.longExchange,
          short_exchange: data.shortExchange,
          initial_rate_difference: data.initialRateDifference,
          max_rate_difference: data.maxRateDifference,
          avg_rate_difference: data.avgRateDifference,
          duration_ms: data.durationMs,
          duration_minutes: data.durationMinutes,
          total_notifications: data.totalNotifications,
          detected_at: data.detectedAt,
          expired_at: data.expiredAt,
          disappear_reason: data.disappearReason,
        },
      })

      logger.info({
        opportunityId: data.opportunityId,
        symbol: data.symbol,
        durationMinutes: data.durationMinutes.toString(),
        disappearReason: data.disappearReason,
      }, '建立機會歷史記錄')

      return history
    } catch (error) {
      logger.error({ error, data }, '建立機會歷史記錄失敗')
      throw error
    }
  }

  /**
   * 根據機會 ID 查詢歷史
   */
  async findByOpportunityId(opportunityId: string): Promise<PrismaOpportunityHistory | null> {
    try {
      return await this.prisma.opportunityHistory.findUnique({
        where: { opportunity_id: opportunityId },
      })
    } catch (error) {
      logger.error({ error, opportunityId }, '查詢機會歷史記錄失敗')
      throw error
    }
  }

  /**
   * 查詢歷史記錄
   */
  async findMany(filters: HistoryFilters, limit?: number): Promise<PrismaOpportunityHistory[]> {
    try {
      const where: any = {}

      if (filters.symbol) {
        where.symbol = filters.symbol
      }
      if (filters.disappearReason) {
        where.disappear_reason = filters.disappearReason
      }
      if (filters.minDurationMs || filters.maxDurationMs) {
        where.duration_ms = {}
        if (filters.minDurationMs) {
          where.duration_ms.gte = filters.minDurationMs
        }
        if (filters.maxDurationMs) {
          where.duration_ms.lte = filters.maxDurationMs
        }
      }
      if (filters.detectedAfter || filters.detectedBefore) {
        where.detected_at = {}
        if (filters.detectedAfter) {
          where.detected_at.gte = filters.detectedAfter
        }
        if (filters.detectedBefore) {
          where.detected_at.lte = filters.detectedBefore
        }
      }

      return await this.prisma.opportunityHistory.findMany({
        where,
        orderBy: {
          detected_at: 'desc',
        },
        take: limit,
      })
    } catch (error) {
      logger.error({ error, filters, limit }, '查詢歷史記錄失敗')
      throw error
    }
  }

  /**
   * 獲取歷史統計
   */
  async getStatistics(filters?: HistoryFilters): Promise<HistoryStatistics> {
    try {
      const where: any = {}

      if (filters?.symbol) {
        where.symbol = filters.symbol
      }
      if (filters?.disappearReason) {
        where.disappear_reason = filters.disappearReason
      }
      if (filters?.minDurationMs || filters?.maxDurationMs) {
        where.duration_ms = {}
        if (filters.minDurationMs) {
          where.duration_ms.gte = filters.minDurationMs
        }
        if (filters.maxDurationMs) {
          where.duration_ms.lte = filters.maxDurationMs
        }
      }
      if (filters?.detectedAfter || filters?.detectedBefore) {
        where.detected_at = {}
        if (filters.detectedAfter) {
          where.detected_at.gte = filters.detectedAfter
        }
        if (filters.detectedBefore) {
          where.detected_at.lte = filters.detectedBefore
        }
      }

      const [count, aggregations, reasonCounts] = await Promise.all([
        this.prisma.opportunityHistory.count({ where }),
        this.prisma.opportunityHistory.aggregate({
          where,
          _avg: {
            duration_minutes: true,
            max_rate_difference: true,
          },
          _max: {
            duration_minutes: true,
          },
          _min: {
            duration_minutes: true,
          },
          _sum: {
            total_notifications: true,
          },
        }),
        this.prisma.opportunityHistory.groupBy({
          by: ['disappear_reason'],
          where,
          _count: {
            disappear_reason: true,
          },
          orderBy: {
            _count: {
              disappear_reason: 'desc',
            },
          },
        }),
      ])

      // 找出最常見的消失原因
      const mostCommonReason: DisappearReason =
        (reasonCounts.length > 0 && reasonCounts[0]?.disappear_reason)
          ? reasonCounts[0].disappear_reason
          : 'RATE_DROPPED'

      return {
        totalCount: count,
        avgDurationMinutes: Number(aggregations._avg.duration_minutes || 0),
        maxDurationMinutes: Number(aggregations._max.duration_minutes || 0),
        minDurationMinutes: Number(aggregations._min.duration_minutes || 0),
        avgMaxRateDifference: (aggregations._avg.max_rate_difference as Decimal) || ('0' as unknown as Decimal),
        mostCommonReason,
        totalNotifications: aggregations._sum.total_notifications || 0,
      }
    } catch (error) {
      logger.error({ error, filters }, '獲取歷史統計資料失敗')
      throw error
    }
  }
}
