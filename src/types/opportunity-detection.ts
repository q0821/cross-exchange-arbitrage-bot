/**
 * 套利機會偵測系統介面型別定義
 * 定義核心服務的契約，確保實作一致性
 *
 * Feature: 005-arbitrage-opportunity-detection
 * Date: 2025-10-22
 */

import type { Decimal } from '@prisma/client/runtime/library'
import type {
  ArbitrageOpportunity,
  OpportunityHistory,
  NotificationLog,
  OpportunityStatus,
  DisappearReason,
  NotificationType,
  NotificationChannel,
  Severity,
} from '@prisma/client'

// ===== 服務介面 =====

/**
 * 套利機會偵測器介面
 * 負責偵測和追蹤套利機會
 */
export interface IOpportunityDetector {
  /**
   * 偵測套利機會
   * @param symbol 幣別符號
   * @param fundingRates 各交易所的資金費率
   * @returns 偵測到的機會列表
   */
  detectOpportunities(
    symbol: string,
    fundingRates: Map<string, FundingRateData>
  ): Promise<DetectedOpportunity[]>

  /**
   * 更新現有機會狀態
   * @param opportunityId 機會 ID
   * @param fundingRates 最新資金費率
   * @returns 更新後的機會，如果機會已消失則返回 null
   */
  updateOpportunity(
    opportunityId: string,
    fundingRates: Map<string, FundingRateData>
  ): Promise<ArbitrageOpportunity | null>

  /**
   * 檢查機會是否過期
   * @param opportunityId 機會 ID
   * @returns 是否過期
   */
  checkExpiration(opportunityId: string): Promise<boolean>

  /**
   * 關閉機會
   * @param opportunityId 機會 ID
   * @param reason 關閉原因
   */
  closeOpportunity(opportunityId: string, reason: DisappearReason): Promise<void>
}

/**
 * 套利機會儲存庫介面
 * 負責機會資料的持久化
 */
export interface IOpportunityRepository {
  /**
   * 建立新機會
   * @param data 機會資料
   * @returns 建立的機會
   */
  create(data: CreateOpportunityData): Promise<ArbitrageOpportunity>

  /**
   * 根據 ID 查詢機會
   * @param id 機會 ID
   * @returns 機會物件，不存在則返回 null
   */
  findById(id: string): Promise<ArbitrageOpportunity | null>

  /**
   * 根據幣別查詢活躍機會
   * @param symbol 幣別符號
   * @returns 活躍機會列表
   */
  findActiveBySymbol(symbol: string): Promise<ArbitrageOpportunity[]>

  /**
   * 查詢所有活躍機會
   * @param limit 限制數量
   * @returns 活躍機會列表
   */
  findAllActive(limit?: number): Promise<ArbitrageOpportunity[]>

  /**
   * 更新機會
   * @param id 機會 ID
   * @param data 更新資料
   * @returns 更新後的機會
   */
  update(id: string, data: UpdateOpportunityData): Promise<ArbitrageOpportunity>

  /**
   * 更新機會狀態
   * @param id 機會 ID
   * @param status 新狀態
   * @returns 更新後的機會
   */
  updateStatus(id: string, status: OpportunityStatus): Promise<ArbitrageOpportunity>

  /**
   * 記錄通知
   * @param opportunityId 機會 ID
   */
  incrementNotificationCount(opportunityId: string): Promise<void>

  /**
   * 獲取統計資料
   * @param filters 過濾條件
   * @returns 統計資料
   */
  getStatistics(filters?: OpportunityFilters): Promise<OpportunityStatistics>
}

/**
 * 機會歷史儲存庫介面
 * 負責機會歷史資料的持久化
 */
export interface IOpportunityHistoryRepository {
  /**
   * 建立歷史記錄
   * @param data 歷史資料
   * @returns 建立的歷史記錄
   */
  create(data: CreateHistoryData): Promise<OpportunityHistory>

  /**
   * 根據機會 ID 查詢歷史
   * @param opportunityId 機會 ID
   * @returns 歷史記錄，不存在則返回 null
   */
  findByOpportunityId(opportunityId: string): Promise<OpportunityHistory | null>

  /**
   * 查詢歷史記錄
   * @param filters 過濾條件
   * @param limit 限制數量
   * @returns 歷史記錄列表
   */
  findMany(filters: HistoryFilters, limit?: number): Promise<OpportunityHistory[]>

  /**
   * 獲取歷史統計
   * @param filters 過濾條件
   * @returns 歷史統計資料
   */
  getStatistics(filters?: HistoryFilters): Promise<HistoryStatistics>
}

/**
 * 通知服務介面
 * 負責發送各種通知
 */
export interface INotificationService {
  /**
   * 發送機會出現通知
   * @param opportunity 機會物件
   * @param channels 通知渠道列表
   */
  notifyOpportunityAppeared(
    opportunity: ArbitrageOpportunity,
    channels: NotificationChannel[]
  ): Promise<void>

  /**
   * 發送機會更新通知
   * @param opportunity 機會物件
   * @param oldRateDifference 舊的費率差異
   * @param channels 通知渠道列表
   */
  notifyOpportunityUpdated(
    opportunity: ArbitrageOpportunity,
    oldRateDifference: Decimal,
    channels: NotificationChannel[]
  ): Promise<void>

  /**
   * 發送機會消失通知
   * @param opportunity 機會物件
   * @param reason 消失原因
   * @param channels 通知渠道列表
   */
  notifyOpportunityDisappeared(
    opportunity: ArbitrageOpportunity,
    reason: DisappearReason,
    channels: NotificationChannel[]
  ): Promise<void>

  /**
   * 記錄通知到資料庫
   * @param data 通知資料
   * @returns 建立的通知記錄
   */
  logNotification(data: CreateNotificationData): Promise<NotificationLog>

  /**
   * 檢查是否應該發送通知（防抖動）
   * @param symbol 幣別符號
   * @param notificationType 通知類型
   * @returns 是否應該發送
   */
  shouldNotify(symbol: string, notificationType: NotificationType): Promise<boolean>
}

/**
 * 防抖動管理器介面
 * 負責防止通知轟炸
 */
export interface IDebounceManager {
  /**
   * 檢查是否應該觸發
   * @param key 防抖動鍵值
   * @returns 是否應該觸發
   */
  shouldTrigger(key: string): boolean

  /**
   * 重置防抖動狀態
   * @param key 防抖動鍵值
   */
  reset(key: string): void

  /**
   * 清除所有防抖動狀態
   */
  clear(): void

  /**
   * 獲取跳過次數
   * @param key 防抖動鍵值
   * @returns 跳過次數
   */
  getSkipCount(key: string): number
}

// ===== 資料傳輸物件 (DTOs) =====

/**
 * 資金費率資料
 */
export interface FundingRateData {
  exchange: string
  symbol: string
  fundingRate: Decimal
  nextFundingTime: Date
  markPrice?: Decimal
  indexPrice?: Decimal
  recordedAt: Date
}

/**
 * 偵測到的機會
 */
export interface DetectedOpportunity {
  symbol: string
  longExchange: string
  shortExchange: string
  longFundingRate: Decimal
  shortFundingRate: Decimal
  rateDifference: Decimal
  expectedReturnRate: Decimal
}

/**
 * 建立機會資料
 */
export interface CreateOpportunityData {
  symbol: string
  longExchange: string
  shortExchange: string
  longFundingRate: Decimal
  shortFundingRate: Decimal
  rateDifference: Decimal
  expectedReturnRate: Decimal
  detectedAt?: Date
}

/**
 * 更新機會資料
 */
export interface UpdateOpportunityData {
  longFundingRate?: Decimal
  shortFundingRate?: Decimal
  rateDifference?: Decimal
  expectedReturnRate?: Decimal
  maxRateDifference?: Decimal
  maxRateDifferenceAt?: Date
  expiredAt?: Date
  closedAt?: Date
  status?: OpportunityStatus
}

/**
 * 建立歷史資料
 */
export interface CreateHistoryData {
  opportunityId: string
  symbol: string
  longExchange: string
  shortExchange: string
  initialRateDifference: Decimal
  maxRateDifference: Decimal
  avgRateDifference: Decimal
  durationMs: bigint
  durationMinutes: Decimal
  totalNotifications: number
  detectedAt: Date
  expiredAt: Date
  disappearReason: DisappearReason
}

/**
 * 建立通知資料
 */
export interface CreateNotificationData {
  opportunityId: string
  symbol: string
  notificationType: NotificationType
  channel: NotificationChannel
  severity: Severity
  message: string
  rateDifference: Decimal
  isDebounced?: boolean
  debounceSkippedCount?: number
}

/**
 * 機會過濾條件
 */
export interface OpportunityFilters {
  symbol?: string
  status?: OpportunityStatus
  minRateDifference?: Decimal
  detectedAfter?: Date
  detectedBefore?: Date
}

/**
 * 歷史過濾條件
 */
export interface HistoryFilters {
  symbol?: string
  disappearReason?: DisappearReason
  minDurationMs?: bigint
  maxDurationMs?: bigint
  detectedAfter?: Date
  detectedBefore?: Date
}

/**
 * 機會統計資料
 */
export interface OpportunityStatistics {
  totalCount: number
  activeCount: number
  expiredCount: number
  closedCount: number
  avgRateDifference: Decimal
  maxRateDifference: Decimal
  avgDurationMinutes?: number
}

/**
 * 歷史統計資料
 */
export interface HistoryStatistics {
  totalCount: number
  avgDurationMinutes: number
  maxDurationMinutes: number
  minDurationMinutes: number
  avgMaxRateDifference: Decimal
  mostCommonReason: DisappearReason
  totalNotifications: number
}
