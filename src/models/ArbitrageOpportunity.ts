/**
 * 套利機會領域模型
 * 封裝套利機會的業務邏輯和狀態轉換規則
 *
 * Feature: 005-arbitrage-opportunity-detection
 * Date: 2025-10-22
 */

import type { Decimal } from '@prisma/client/runtime/library'
import type {
  ArbitrageOpportunity as PrismaArbitrageOpportunity,
  OpportunityStatus,
  DisappearReason,
} from '@prisma/client'
import { z } from 'zod'

/**
 * 套利機會 Zod Schema（用於執行時驗證）
 */
export const ArbitrageOpportunitySchema = z.object({
  id: z.string().uuid(),
  symbol: z.string().min(1).max(20),
  longExchange: z.string().min(1).max(50),
  shortExchange: z.string().min(1).max(50),
  longFundingRate: z.custom<Decimal>((val) => val !== null && val !== undefined),
  shortFundingRate: z.custom<Decimal>((val) => val !== null && val !== undefined),
  rateDifference: z.custom<Decimal>((val) => val !== null && val !== undefined),
  expectedReturnRate: z.custom<Decimal>((val) => val !== null && val !== undefined),
  status: z.enum(['ACTIVE', 'EXPIRED', 'CLOSED']),
  detectedAt: z.date(),
  expiredAt: z.date().nullable(),
  closedAt: z.date().nullable(),
  maxRateDifference: z.custom<Decimal>((val) => val === null || val !== undefined).nullable(),
  maxRateDifferenceAt: z.date().nullable(),
  notificationCount: z.number().int().min(0),
  lastNotificationAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

/**
 * 套利機會領域模型類別
 */
export class ArbitrageOpportunity {
  private constructor(private readonly data: PrismaArbitrageOpportunity) {
    // 驗證資料
    ArbitrageOpportunitySchema.parse({
      id: data.id,
      symbol: data.symbol,
      longExchange: data.long_exchange,
      shortExchange: data.short_exchange,
      longFundingRate: data.long_funding_rate,
      shortFundingRate: data.short_funding_rate,
      rateDifference: data.rate_difference,
      expectedReturnRate: data.expected_return_rate,
      status: data.status,
      detectedAt: data.detected_at,
      expiredAt: data.expired_at,
      closedAt: data.closed_at,
      maxRateDifference: data.max_rate_difference,
      maxRateDifferenceAt: data.max_rate_difference_at,
      notificationCount: data.notification_count,
      lastNotificationAt: data.last_notification_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    })
  }

  /**
   * 從 Prisma 物件建立領域模型
   */
  static fromPrisma(data: PrismaArbitrageOpportunity): ArbitrageOpportunity {
    return new ArbitrageOpportunity(data)
  }

  /**
   * 建立新的套利機會
   */
  static create(params: {
    id: string
    symbol: string
    longExchange: string
    shortExchange: string
    longFundingRate: Decimal
    shortFundingRate: Decimal
    rateDifference: Decimal
    expectedReturnRate: Decimal
    detectedAt?: Date
  }): ArbitrageOpportunity {
    const now = new Date()
    return new ArbitrageOpportunity({
      id: params.id,
      symbol: params.symbol,
      long_exchange: params.longExchange,
      short_exchange: params.shortExchange,
      long_funding_rate: params.longFundingRate,
      short_funding_rate: params.shortFundingRate,
      rate_difference: params.rateDifference,
      expected_return_rate: params.expectedReturnRate,
      status: 'ACTIVE',
      detected_at: params.detectedAt || now,
      expired_at: null,
      closed_at: null,
      max_rate_difference: params.rateDifference, // 初始最大差異即為當前差異
      max_rate_difference_at: params.detectedAt || now,
      notification_count: 0,
      last_notification_at: null,
      created_at: now,
      updated_at: now,
    })
  }

  // ===== Getters =====

  get id(): string {
    return this.data.id
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

  get longFundingRate(): Decimal {
    return this.data.long_funding_rate
  }

  get shortFundingRate(): Decimal {
    return this.data.short_funding_rate
  }

  get rateDifference(): Decimal {
    return this.data.rate_difference
  }

  get expectedReturnRate(): Decimal {
    return this.data.expected_return_rate
  }

  get status(): OpportunityStatus {
    return this.data.status
  }

  get detectedAt(): Date {
    return this.data.detected_at
  }

  get expiredAt(): Date | null {
    return this.data.expired_at
  }

  get closedAt(): Date | null {
    return this.data.closed_at
  }

  get maxRateDifference(): Decimal | null {
    return this.data.max_rate_difference
  }

  get maxRateDifferenceAt(): Date | null {
    return this.data.max_rate_difference_at
  }

  get notificationCount(): number {
    return this.data.notification_count
  }

  get lastNotificationAt(): Date | null {
    return this.data.last_notification_at
  }

  get createdAt(): Date {
    return this.data.created_at
  }

  get updatedAt(): Date {
    return this.data.updated_at
  }

  // ===== 業務邏輯方法 =====

  /**
   * 檢查機會是否為活躍狀態
   */
  isActive(): boolean {
    return this.data.status === 'ACTIVE'
  }

  /**
   * 檢查機會是否已過期
   */
  isExpired(): boolean {
    return this.data.status === 'EXPIRED'
  }

  /**
   * 檢查機會是否已關閉
   */
  isClosed(): boolean {
    return this.data.status === 'CLOSED'
  }

  /**
   * 更新費率差異
   * 如果新的差異大於歷史最大值，則更新最大值記錄
   */
  updateRateDifference(
    newLongRate: Decimal,
    newShortRate: Decimal,
    newRateDifference: Decimal
  ): void {
    if (!this.isActive()) {
      throw new Error(`無法更新非活躍機會的費率差異（目前狀態：${this.data.status}）`)
    }

    this.data.long_funding_rate = newLongRate
    this.data.short_funding_rate = newShortRate
    this.data.rate_difference = newRateDifference
    this.data.updated_at = new Date()

    // 更新最大費率差異記錄
    if (
      this.data.max_rate_difference === null ||
      Number(newRateDifference) > Number(this.data.max_rate_difference)
    ) {
      this.data.max_rate_difference = newRateDifference
      this.data.max_rate_difference_at = new Date()
    }
  }

  /**
   * 標記機會為過期
   */
  markAsExpired(): void {
    if (!this.isActive()) {
      throw new Error(`無法將非活躍機會標記為過期（目前狀態：${this.data.status}）`)
    }

    this.data.status = 'EXPIRED'
    this.data.expired_at = new Date()
    this.data.updated_at = new Date()
  }

  /**
   * 關閉機會
   * @param _reason 關閉原因（用於記錄到歷史）
   */
  close(_reason: DisappearReason): void {
    if (this.isClosed()) {
      return // 已經關閉，不需要重複操作
    }

    const now = new Date()
    this.data.status = 'CLOSED'
    this.data.closed_at = now
    this.data.updated_at = now

    // 如果還沒有過期時間，設定為關閉時間
    if (!this.data.expired_at) {
      this.data.expired_at = now
    }
  }

  /**
   * 記錄通知發送
   */
  recordNotification(): void {
    this.data.notification_count += 1
    this.data.last_notification_at = new Date()
    this.data.updated_at = new Date()
  }

  /**
   * 計算機會持續時間（毫秒）
   */
  getDurationMs(): number {
    const endTime = this.data.expired_at || this.data.closed_at || new Date()
    return endTime.getTime() - this.data.detected_at.getTime()
  }

  /**
   * 計算機會持續時間（分鐘）
   */
  getDurationMinutes(): number {
    return this.getDurationMs() / (1000 * 60)
  }

  /**
   * 轉換為 Prisma 更新資料
   */
  toPrismaUpdateData(): Partial<PrismaArbitrageOpportunity> {
    return {
      long_funding_rate: this.data.long_funding_rate,
      short_funding_rate: this.data.short_funding_rate,
      rate_difference: this.data.rate_difference,
      expected_return_rate: this.data.expected_return_rate,
      status: this.data.status,
      expired_at: this.data.expired_at,
      closed_at: this.data.closed_at,
      max_rate_difference: this.data.max_rate_difference,
      max_rate_difference_at: this.data.max_rate_difference_at,
      notification_count: this.data.notification_count,
      last_notification_at: this.data.last_notification_at,
      updated_at: this.data.updated_at,
    }
  }

  /**
   * 轉換為簡單物件（用於日誌或序列化）
   */
  toPlainObject(): {
    id: string
    symbol: string
    longExchange: string
    shortExchange: string
    longFundingRate: string
    shortFundingRate: string
    rateDifference: string
    expectedReturnRate: string
    status: OpportunityStatus
    detectedAt: string
    expiredAt: string | null
    closedAt: string | null
    maxRateDifference: string | null
    maxRateDifferenceAt: string | null
    notificationCount: number
    lastNotificationAt: string | null
    durationMinutes: number
  } {
    return {
      id: this.id,
      symbol: this.symbol,
      longExchange: this.longExchange,
      shortExchange: this.shortExchange,
      longFundingRate: this.longFundingRate.toString(),
      shortFundingRate: this.shortFundingRate.toString(),
      rateDifference: this.rateDifference.toString(),
      expectedReturnRate: this.expectedReturnRate.toString(),
      status: this.status,
      detectedAt: this.detectedAt.toISOString(),
      expiredAt: this.expiredAt?.toISOString() || null,
      closedAt: this.closedAt?.toISOString() || null,
      maxRateDifference: this.maxRateDifference?.toString() || null,
      maxRateDifferenceAt: this.maxRateDifferenceAt?.toISOString() || null,
      notificationCount: this.notificationCount,
      lastNotificationAt: this.lastNotificationAt?.toISOString() || null,
      durationMinutes: this.getDurationMinutes(),
    }
  }
}
