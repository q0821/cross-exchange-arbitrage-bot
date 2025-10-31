/**
 * 套利機會偵測器服務
 * 負責偵測和追蹤套利機會
 *
 * Feature: 005-arbitrage-opportunity-detection
 * Date: 2025-10-22
 *
 * 成本計算：
 * - 預設閾值 0.5% 涵蓋所有交易成本（手續費、滑點、價差、安全邊際）
 * - 詳細成本結構見 src/lib/cost-calculator.ts 和 cost-constants.ts
 * - 同時檢查價差方向，確保不會因反向價差而虧損
 */

import type { Decimal } from '@prisma/client/runtime/library'
import type { DisappearReason, ArbitrageOpportunity as PrismaArbitrageOpportunity } from '@prisma/client'
import type {
  IOpportunityDetector,
  IOpportunityRepository,
  FundingRateData,
  DetectedOpportunity,
} from '../../types/opportunity-detection'
import { ArbitrageOpportunity } from '../../models/ArbitrageOpportunity'
import { logger } from '../../lib/logger'
import {
  calculateAnnualizedReturn,
  meetsThreshold,
  subtractDecimal,
  compareDecimal,
} from '../../lib/opportunity-helpers'
import { Decimal as DecimalJS } from 'decimal.js'

/**
 * 偵測器配置
 */
export interface OpportunityDetectorConfig {
  /** 最小費率差異閾值（預設 0.005 = 0.5%，包含所有交易成本）*/
  minRateDifference: Decimal
  /** 資金費率結算間隔（小時，預設 8 小時）*/
  fundingInterval: number
}

/**
 * 套利機會偵測器實作
 */
export class OpportunityDetector implements IOpportunityDetector {
  constructor(
    private readonly repository: IOpportunityRepository,
    private readonly config: OpportunityDetectorConfig
  ) {
    logger.info({
      minRateDifference: config.minRateDifference.toString(),
      fundingInterval: config.fundingInterval,
    }, '初始化 OpportunityDetector')
  }

  /**
   * 偵測套利機會
   */
  async detectOpportunities(
    symbol: string,
    fundingRates: Map<string, FundingRateData>
  ): Promise<DetectedOpportunity[]> {
    try {
      const opportunities: DetectedOpportunity[] = []

      // 將所有交易所組合成對進行比較
      const exchanges = Array.from(fundingRates.keys())

      for (let i = 0; i < exchanges.length; i++) {
        for (let j = i + 1; j < exchanges.length; j++) {
          const exchange1 = exchanges[i]
          const exchange2 = exchanges[j]

          if (!exchange1 || !exchange2) continue

          const rate1 = fundingRates.get(exchange1)
          const rate2 = fundingRates.get(exchange2)

          if (!rate1 || !rate2) continue

          // 計算費率差異（絕對值）
          const rateDiff = subtractDecimal(rate1.fundingRate, rate2.fundingRate)
          const absRateDiff = new DecimalJS(rateDiff.toString()).abs() as unknown as Decimal

          // 檢查是否達到閾值
          if (!meetsThreshold(absRateDiff, this.config.minRateDifference)) {
            continue
          }

          // 判斷做多和做空交易所
          const shouldLongExchange1 = compareDecimal(rate1.fundingRate, rate2.fundingRate) < 0
          const longExchange = shouldLongExchange1 ? exchange1 : exchange2
          const shortExchange = shouldLongExchange1 ? exchange2 : exchange1
          const longRate = shouldLongExchange1 ? rate1.fundingRate : rate2.fundingRate
          const shortRate = shouldLongExchange1 ? rate2.fundingRate : rate1.fundingRate

          // 計算預期年化收益率
          const expectedReturn = calculateAnnualizedReturn(absRateDiff, this.config.fundingInterval)

          opportunities.push({
            symbol,
            longExchange,
            shortExchange,
            longFundingRate: longRate,
            shortFundingRate: shortRate,
            rateDifference: absRateDiff,
            expectedReturnRate: expectedReturn,
          })

          logger.debug({
            symbol,
            longExchange,
            shortExchange,
            rateDifference: absRateDiff.toString(),
            expectedReturn: expectedReturn.toString(),
          }, '偵測到套利機會')
        }
      }

      return opportunities
    } catch (error) {
      logger.error({ error, symbol }, '偵測套利機會時發生錯誤')
      throw error
    }
  }

  /**
   * 更新現有機會狀態
   */
  async updateOpportunity(
    opportunityId: string,
    fundingRates: Map<string, FundingRateData>
  ): Promise<import('@prisma/client').ArbitrageOpportunity | null> {
    try {
      // 查詢現有機會
      const existingOpp = await this.repository.findById(opportunityId)
      if (!existingOpp) {
        logger.warn({ opportunityId }, '機會不存在')
        return null
      }

      const opportunity = ArbitrageOpportunity.fromPrisma(existingOpp)

      // 檢查機會是否還活躍
      if (!opportunity.isActive()) {
        logger.debug({ opportunityId, status: opportunity.status }, '機會已不活躍，跳過更新')
        return existingOpp
      }

      // 獲取最新費率
      const longRate = fundingRates.get(opportunity.longExchange)
      const shortRate = fundingRates.get(opportunity.shortExchange)

      // 如果任一交易所費率不可用，標記為資料不可用
      if (!longRate || !shortRate) {
        logger.warn({
          opportunityId,
          longExchange: opportunity.longExchange,
          shortExchange: opportunity.shortExchange,
          hasLongRate: !!longRate,
          hasShortRate: !!shortRate,
        }, '資金費率資料不可用，關閉機會')

        opportunity.close('DATA_UNAVAILABLE')
        return await this.repository.update(opportunityId, opportunity.toPrismaUpdateData())
      }

      // 計算新的費率差異
      const newRateDiff = subtractDecimal(shortRate.fundingRate, longRate.fundingRate)
      const absNewRateDiff = new DecimalJS(newRateDiff.toString()).abs() as unknown as Decimal

      // 檢查是否仍達到閾值
      if (!meetsThreshold(absNewRateDiff, this.config.minRateDifference)) {
        logger.info({
          opportunityId,
          oldRateDifference: opportunity.rateDifference.toString(),
          newRateDifference: absNewRateDiff.toString(),
          threshold: this.config.minRateDifference.toString(),
        }, '費率差異低於閾值，標記為過期')

        opportunity.markAsExpired()
        return await this.repository.update(opportunityId, opportunity.toPrismaUpdateData())
      }

      // 更新費率差異
      opportunity.updateRateDifference(
        longRate.fundingRate,
        shortRate.fundingRate,
        absNewRateDiff
      )

      logger.debug({
        opportunityId,
        newRateDifference: absNewRateDiff.toString(),
        maxRateDifference: opportunity.maxRateDifference?.toString(),
      }, '更新機會狀態')

      return await this.repository.update(opportunityId, opportunity.toPrismaUpdateData())
    } catch (error) {
      logger.error({ error, opportunityId }, '更新機會狀態時發生錯誤')
      throw error
    }
  }

  /**
   * 檢查機會是否過期
   */
  async checkExpiration(opportunityId: string): Promise<boolean> {
    try {
      const existingOpp = await this.repository.findById(opportunityId)
      if (!existingOpp) {
        logger.warn({ opportunityId }, '機會不存在')
        return true
      }

      const opportunity = ArbitrageOpportunity.fromPrisma(existingOpp)
      return opportunity.isExpired() || opportunity.isClosed()
    } catch (error) {
      logger.error({ error, opportunityId }, '檢查機會過期狀態時發生錯誤')
      throw error
    }
  }

  /**
   * 關閉機會
   */
  async closeOpportunity(opportunityId: string, reason: DisappearReason): Promise<void> {
    try {
      const existingOpp = await this.repository.findById(opportunityId)
      if (!existingOpp) {
        logger.warn({ opportunityId }, '機會不存在，無法關閉')
        return
      }

      const opportunity = ArbitrageOpportunity.fromPrisma(existingOpp)

      if (opportunity.isClosed()) {
        logger.debug({ opportunityId }, '機會已關閉，跳過')
        return
      }

      opportunity.close(reason)

      await this.repository.update(opportunityId, opportunity.toPrismaUpdateData())

      logger.info({
        opportunityId,
        reason,
        durationMinutes: opportunity.getDurationMinutes(),
      }, '機會已關閉')
    } catch (error) {
      logger.error({ error, opportunityId, reason }, '關閉機會時發生錯誤')
      throw error
    }
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<OpportunityDetectorConfig>): void {
    if (newConfig.minRateDifference !== undefined) {
      this.config.minRateDifference = newConfig.minRateDifference
      logger.info({
        newThreshold: newConfig.minRateDifference.toString(),
      }, '更新最小費率差異閾值')
    }

    if (newConfig.fundingInterval !== undefined) {
      this.config.fundingInterval = newConfig.fundingInterval
      logger.info({
        newInterval: newConfig.fundingInterval,
      }, '更新資金費率結算間隔')
    }
  }

  /**
   * 獲取當前配置
   */
  getConfig(): OpportunityDetectorConfig {
    return { ...this.config }
  }

  /**
   * 獲取排序後的活躍機會列表
   * 按照費率差異由高到低排序
   */
  async getActiveOpportunitiesSorted(limit?: number): Promise<PrismaArbitrageOpportunity[]> {
    try {
      const opportunities = await this.repository.findAllActive(limit)

      logger.debug({
        count: opportunities.length,
        limit,
      }, '獲取排序後的活躍機會列表')

      return opportunities
    } catch (error) {
      logger.error({ error, limit }, '獲取排序機會列表時發生錯誤')
      throw error
    }
  }
}
