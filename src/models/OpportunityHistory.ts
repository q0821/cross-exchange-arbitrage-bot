/**
 * 機會歷史領域模型
 * 封裝套利機會生命週期摘要的業務邏輯
 *
 * Feature: 005-arbitrage-opportunity-detection
 * Date: 2025-10-22
 */

import type { Decimal } from '@prisma/client/runtime/library'
import type {
  OpportunityHistory as PrismaOpportunityHistory,
  DisappearReason,
} from '@prisma/client'
import { z } from 'zod'
import { ArbitrageOpportunity } from './ArbitrageOpportunity'

/**
 * 機會歷史 Zod Schema（用於執行時驗證）
 */
export const OpportunityHistorySchema = z.object({
  id: z.string().uuid(),
  opportunityId: z.string().uuid(),
  symbol: z.string().min(1).max(20),
  longExchange: z.string().min(1).max(50),
  shortExchange: z.string().min(1).max(50),
  initialRateDifference: z.custom<Decimal>((val) => val !== null && val !== undefined),
  maxRateDifference: z.custom<Decimal>((val) => val !== null && val !== undefined),
  avgRateDifference: z.custom<Decimal>((val) => val !== null && val !== undefined),
  durationMs: z.bigint(),
  durationMinutes: z.custom<Decimal>((val) => val !== null && val !== undefined),
  totalNotifications: z.number().int().min(0),
  detectedAt: z.date(),
  expiredAt: z.date(),
  disappearReason: z.enum(['RATE_DROPPED', 'DATA_UNAVAILABLE', 'MANUAL_CLOSE', 'SYSTEM_ERROR']),
  createdAt: z.date(),
})

/**
 * 機會歷史領域模型類別
 */
export class OpportunityHistory {
  private constructor(private readonly data: PrismaOpportunityHistory) {
    // 驗證資料
    OpportunityHistorySchema.parse({
      id: data.id,
      opportunityId: data.opportunity_id,
      symbol: data.symbol,
      longExchange: data.long_exchange,
      shortExchange: data.short_exchange,
      initialRateDifference: data.initial_rate_difference,
      maxRateDifference: data.max_rate_difference,
      avgRateDifference: data.avg_rate_difference,
      durationMs: data.duration_ms,
      durationMinutes: data.duration_minutes,
      totalNotifications: data.total_notifications,
      detectedAt: data.detected_at,
      expiredAt: data.expired_at,
      disappearReason: data.disappear_reason,
      createdAt: data.created_at,
    })
  }

  /**
   * 從 Prisma 物件建立領域模型
   */
  static fromPrisma(data: PrismaOpportunityHistory): OpportunityHistory {
    return new OpportunityHistory(data)
  }

  /**
   * 從套利機會建立歷史記錄
   */
  static fromOpportunity(
    historyId: string,
    opportunity: ArbitrageOpportunity,
    avgRateDifference: Decimal,
    reason: DisappearReason
  ): OpportunityHistory {
    const durationMs = BigInt(opportunity.getDurationMs())
    const durationMinutes = opportunity.getDurationMinutes()

    return new OpportunityHistory({
      id: historyId,
      opportunity_id: opportunity.id,
      symbol: opportunity.symbol,
      long_exchange: opportunity.longExchange,
      short_exchange: opportunity.shortExchange,
      initial_rate_difference: opportunity.rateDifference, // 使用當前差異作為初始差異
      max_rate_difference: opportunity.maxRateDifference || opportunity.rateDifference,
      avg_rate_difference: avgRateDifference,
      duration_ms: durationMs,
      duration_minutes: durationMinutes as unknown as Decimal, // 轉換為 Decimal
      total_notifications: opportunity.notificationCount,
      detected_at: opportunity.detectedAt,
      expired_at: opportunity.expiredAt || opportunity.closedAt || new Date(),
      disappear_reason: reason,
      created_at: new Date(),
    })
  }

  // ===== Getters =====

  get id(): string {
    return this.data.id
  }

  get opportunityId(): string {
    return this.data.opportunity_id
  }

  get symbol(): string {
    return this.data.symbol
  }

  get longExchange(): string {
    return this.data.long_exchange
  }

  get shortExchange(): string {
    return this.data.short_exchange
  }

  get initialRateDifference(): Decimal {
    return this.data.initial_rate_difference
  }

  get maxRateDifference(): Decimal {
    return this.data.max_rate_difference
  }

  get avgRateDifference(): Decimal {
    return this.data.avg_rate_difference
  }

  get durationMs(): bigint {
    return this.data.duration_ms
  }

  get durationMinutes(): Decimal {
    return this.data.duration_minutes
  }

  get totalNotifications(): number {
    return this.data.total_notifications
  }

  get detectedAt(): Date {
    return this.data.detected_at
  }

  get expiredAt(): Date {
    return this.data.expired_at
  }

  get disappearReason(): DisappearReason {
    return this.data.disappear_reason
  }

  get createdAt(): Date {
    return this.data.created_at
  }

  // ===== 業務邏輯方法 =====

  /**
   * 計算費率差異波動率
   * @returns 波動率百分比
   */
  calculateVolatility(): number {
    const max = Number(this.maxRateDifference)
    const avg = Number(this.avgRateDifference)

    if (avg === 0) return 0

    // 使用標準差的簡化估算：(最大值 - 平均值) / 平均值
    return ((max - avg) / avg) * 100
  }

  /**
   * 判斷是否為短期機會（小於 5 分鐘）
   */
  isShortTerm(): boolean {
    return Number(this.durationMinutes) < 5
  }

  /**
   * 判斷是否為中期機會（5-30 分鐘）
   */
  isMediumTerm(): boolean {
    const minutes = Number(this.durationMinutes)
    return minutes >= 5 && minutes <= 30
  }

  /**
   * 判斷是否為長期機會（超過 30 分鐘）
   */
  isLongTerm(): boolean {
    return Number(this.durationMinutes) > 30
  }

  /**
   * 計算通知頻率（次/分鐘）
   */
  getNotificationFrequency(): number {
    const minutes = Number(this.durationMinutes)
    if (minutes === 0) return 0
    return this.totalNotifications / minutes
  }

  /**
   * 判斷消失原因是否為正常情況
   */
  isNormalDisappearance(): boolean {
    return this.disappearReason === 'RATE_DROPPED'
  }

  /**
   * 判斷消失原因是否為異常情況
   */
  isAbnormalDisappearance(): boolean {
    return (
      this.disappearReason === 'DATA_UNAVAILABLE' ||
      this.disappearReason === 'SYSTEM_ERROR'
    )
  }

  /**
   * 轉換為簡單物件（用於日誌或序列化）
   */
  toPlainObject(): {
    id: string
    opportunityId: string
    symbol: string
    longExchange: string
    shortExchange: string
    initialRateDifference: string
    maxRateDifference: string
    avgRateDifference: string
    durationMs: string
    durationMinutes: string
    totalNotifications: number
    notificationFrequency: number
    detectedAt: string
    expiredAt: string
    disappearReason: DisappearReason
    isShortTerm: boolean
    isMediumTerm: boolean
    isLongTerm: boolean
    volatility: number
    createdAt: string
  } {
    return {
      id: this.id,
      opportunityId: this.opportunityId,
      symbol: this.symbol,
      longExchange: this.longExchange,
      shortExchange: this.shortExchange,
      initialRateDifference: this.initialRateDifference.toString(),
      maxRateDifference: this.maxRateDifference.toString(),
      avgRateDifference: this.avgRateDifference.toString(),
      durationMs: this.durationMs.toString(),
      durationMinutes: this.durationMinutes.toString(),
      totalNotifications: this.totalNotifications,
      notificationFrequency: this.getNotificationFrequency(),
      detectedAt: this.detectedAt.toISOString(),
      expiredAt: this.expiredAt.toISOString(),
      disappearReason: this.disappearReason,
      isShortTerm: this.isShortTerm(),
      isMediumTerm: this.isMediumTerm(),
      isLongTerm: this.isLongTerm(),
      volatility: this.calculateVolatility(),
      createdAt: this.createdAt.toISOString(),
    }
  }
}
