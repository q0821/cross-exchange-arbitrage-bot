/**
 * 套利機會儲存庫實作
 * 負責機會資料的持久化操作
 *
 * Feature: 005-arbitrage-opportunity-detection
 * Date: 2025-10-22
 */

import { PrismaClient, type OpportunityStatus } from '@prisma/client'
import type { Decimal } from '@prisma/client/runtime/library'
import type {
  IOpportunityRepository,
  CreateOpportunityData,
  UpdateOpportunityData,
  OpportunityFilters,
  OpportunityStatistics,
} from '../types/opportunity-detection'
import { ArbitrageOpportunity as PrismaArbitrageOpportunity } from '@prisma/client'
import { logger } from '../lib/logger'

/**
 * 套利機會儲存庫實作
 */
export class ArbitrageOpportunityRepository implements IOpportunityRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * 建立新機會
   */
  async create(data: CreateOpportunityData): Promise<PrismaArbitrageOpportunity> {
    try {
      const opportunity = await this.prisma.arbitrageOpportunity.create({
        data: {
          symbol: data.symbol,
          long_exchange: data.longExchange,
          short_exchange: data.shortExchange,
          long_funding_rate: data.longFundingRate,
          short_funding_rate: data.shortFundingRate,
          rate_difference: data.rateDifference,
          expected_return_rate: data.expectedReturnRate,
          status: 'ACTIVE',
          detected_at: data.detectedAt || new Date(),
          max_rate_difference: data.rateDifference,
          max_rate_difference_at: data.detectedAt || new Date(),
        },
      })

      logger.info({
        opportunityId: opportunity.id,
        symbol: data.symbol,
        rateDifference: data.rateDifference.toString(),
      }, '建立新的套利機會')

      return opportunity
    } catch (error) {
      logger.error({ error, data }, '建立套利機會失敗')
      throw error
    }
  }

  /**
   * 根據 ID 查詢機會
   */
  async findById(id: string): Promise<PrismaArbitrageOpportunity | null> {
    try {
      return await this.prisma.arbitrageOpportunity.findUnique({
        where: { id },
      })
    } catch (error) {
      logger.error({ error, id }, '查詢套利機會失敗')
      throw error
    }
  }

  /**
   * 根據幣別查詢活躍機會
   */
  async findActiveBySymbol(symbol: string): Promise<PrismaArbitrageOpportunity[]> {
    try {
      return await this.prisma.arbitrageOpportunity.findMany({
        where: {
          symbol,
          status: 'ACTIVE',
        },
        orderBy: {
          detected_at: 'desc',
        },
      })
    } catch (error) {
      logger.error({ error, symbol }, '查詢幣別活躍機會失敗')
      throw error
    }
  }

  /**
   * 查詢所有活躍機會
   */
  async findAllActive(limit?: number): Promise<PrismaArbitrageOpportunity[]> {
    try {
      return await this.prisma.arbitrageOpportunity.findMany({
        where: {
          status: 'ACTIVE',
        },
        orderBy: {
          rate_difference: 'desc', // 按費率差異降序排序
        },
        take: limit,
      })
    } catch (error) {
      logger.error({ error, limit }, '查詢所有活躍機會失敗')
      throw error
    }
  }

  /**
   * 更新機會
   */
  async update(
    id: string,
    data: UpdateOpportunityData
  ): Promise<PrismaArbitrageOpportunity> {
    try {
      const updateData: any = {
        updated_at: new Date(),
      }

      if (data.longFundingRate !== undefined) {
        updateData.long_funding_rate = data.longFundingRate
      }
      if (data.shortFundingRate !== undefined) {
        updateData.short_funding_rate = data.shortFundingRate
      }
      if (data.rateDifference !== undefined) {
        updateData.rate_difference = data.rateDifference
      }
      if (data.expectedReturnRate !== undefined) {
        updateData.expected_return_rate = data.expectedReturnRate
      }
      if (data.maxRateDifference !== undefined) {
        updateData.max_rate_difference = data.maxRateDifference
      }
      if (data.maxRateDifferenceAt !== undefined) {
        updateData.max_rate_difference_at = data.maxRateDifferenceAt
      }
      if (data.expiredAt !== undefined) {
        updateData.expired_at = data.expiredAt
      }
      if (data.closedAt !== undefined) {
        updateData.closed_at = data.closedAt
      }
      if (data.status !== undefined) {
        updateData.status = data.status
      }

      const opportunity = await this.prisma.arbitrageOpportunity.update({
        where: { id },
        data: updateData,
      })

      logger.debug({
        opportunityId: id,
        updatedFields: Object.keys(data),
      }, '更新套利機會')

      return opportunity
    } catch (error) {
      logger.error({ error, id, data }, '更新套利機會失敗')
      throw error
    }
  }

  /**
   * 更新機會狀態
   */
  async updateStatus(
    id: string,
    status: OpportunityStatus
  ): Promise<PrismaArbitrageOpportunity> {
    try {
      const updateData: any = {
        status,
        updated_at: new Date(),
      }

      // 根據狀態自動設定時間戳
      if (status === 'EXPIRED' || status === 'CLOSED') {
        updateData.expired_at = new Date()
      }
      if (status === 'CLOSED') {
        updateData.closed_at = new Date()
      }

      const opportunity = await this.prisma.arbitrageOpportunity.update({
        where: { id },
        data: updateData,
      })

      logger.info({
        opportunityId: id,
        newStatus: status,
      }, '更新機會狀態')

      return opportunity
    } catch (error) {
      logger.error({ error, id, status }, '更新機會狀態失敗')
      throw error
    }
  }

  /**
   * 增加通知計數
   */
  async incrementNotificationCount(opportunityId: string): Promise<void> {
    try {
      await this.prisma.arbitrageOpportunity.update({
        where: { id: opportunityId },
        data: {
          notification_count: {
            increment: 1,
          },
          last_notification_at: new Date(),
          updated_at: new Date(),
        },
      })

      logger.debug({ opportunityId }, '增加通知計數')
    } catch (error) {
      logger.error({ error, opportunityId }, '增加通知計數失敗')
      throw error
    }
  }

  /**
   * 獲取統計資料
   */
  async getStatistics(filters?: OpportunityFilters): Promise<OpportunityStatistics> {
    try {
      const where: any = {}

      if (filters?.symbol) {
        where.symbol = filters.symbol
      }
      if (filters?.status) {
        where.status = filters.status
      }
      if (filters?.minRateDifference) {
        where.rate_difference = {
          gte: filters.minRateDifference,
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

      const [total, active, expired, closed, aggregations] = await Promise.all([
        this.prisma.arbitrageOpportunity.count({ where }),
        this.prisma.arbitrageOpportunity.count({
          where: { ...where, status: 'ACTIVE' },
        }),
        this.prisma.arbitrageOpportunity.count({
          where: { ...where, status: 'EXPIRED' },
        }),
        this.prisma.arbitrageOpportunity.count({
          where: { ...where, status: 'CLOSED' },
        }),
        this.prisma.arbitrageOpportunity.aggregate({
          where,
          _avg: {
            rate_difference: true,
          },
          _max: {
            rate_difference: true,
          },
        }),
      ])

      return {
        totalCount: total,
        activeCount: active,
        expiredCount: expired,
        closedCount: closed,
        avgRateDifference: (aggregations._avg.rate_difference as Decimal) || ('0' as unknown as Decimal),
        maxRateDifference: (aggregations._max.rate_difference as Decimal) || ('0' as unknown as Decimal),
      }
    } catch (error) {
      logger.error({ error, filters }, '獲取統計資料失敗')
      throw error
    }
  }

  /**
   * 查詢活躍機會並包含統計資訊
   * 包含年化收益率、持續時間等計算欄位
   */
  async findActiveWithStats(filters?: OpportunityFilters): Promise<PrismaArbitrageOpportunity[]> {
    try {
      const where: any = {
        status: 'ACTIVE',
      }

      if (filters?.symbol) {
        where.symbol = filters.symbol
      }
      if (filters?.minRateDifference) {
        where.rate_difference = {
          gte: filters.minRateDifference,
        }
      }

      const opportunities = await this.prisma.arbitrageOpportunity.findMany({
        where,
        orderBy: {
          rate_difference: 'desc', // 按費率差異降序排序
        },
        take: filters?.limit,
      })

      logger.debug({
        count: opportunities.length,
        filters,
      }, '查詢活躍機會（含統計）')

      return opportunities
    } catch (error) {
      logger.error({ error, filters }, '查詢活躍機會（含統計）失敗')
      throw error
    }
  }

  /**
   * 根據多種條件查詢機會
   */
  async findMany(filters: OpportunityFilters): Promise<PrismaArbitrageOpportunity[]> {
    try {
      const where: any = {}

      if (filters.symbol) {
        where.symbol = filters.symbol
      }
      if (filters.status) {
        where.status = filters.status
      }
      if (filters.minRateDifference) {
        where.rate_difference = {
          gte: filters.minRateDifference,
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

      const opportunities = await this.prisma.arbitrageOpportunity.findMany({
        where,
        orderBy: {
          rate_difference: 'desc',
        },
        take: filters.limit,
      })

      logger.debug({
        count: opportunities.length,
        filters,
      }, '根據條件查詢機會')

      return opportunities
    } catch (error) {
      logger.error({ error, filters }, '根據條件查詢機會失敗')
      throw error
    }
  }
}
