/**
 * OpportunityRepository Interface
 *
 * Feature: 005-arbitrage-opportunity-detection
 * Purpose: 定義套利機會資料存取層的介面合約
 */

import type {
  ArbitrageOpportunity,
  OpportunityHistory,
  OpportunityStatus,
  DisappearReason
} from '@/generated/prisma/client';

/**
 * 建立機會的輸入資料
 */
export interface CreateOpportunityInput {
  symbol: string;
  longExchange: string;
  shortExchange: string;
  longFundingRate: number;
  shortFundingRate: number;
  rateDifference: number;
  expectedReturnRate: number;
  detectedAt?: Date;
}

/**
 * 更新機會的輸入資料
 */
export interface UpdateOpportunityInput {
  status?: OpportunityStatus;
  expiredAt?: Date;
  closedAt?: Date;
  maxRateDifference?: number;
  maxRateDifferenceAt?: Date;
  notificationCount?: number;
  lastNotificationAt?: Date;
}

/**
 * 查詢機會的篩選條件
 */
export interface OpportunityQueryFilter {
  symbol?: string;
  status?: OpportunityStatus | OpportunityStatus[];
  detectedAfter?: Date;
  detectedBefore?: Date;
  minRateDifference?: number;
  maxRateDifference?: number;
}

/**
 * 查詢機會的排序選項
 */
export interface OpportunityQuerySort {
  field: 'detected_at' | 'rate_difference' | 'expected_return_rate' | 'notification_count';
  order: 'asc' | 'desc';
}

/**
 * 建立歷史記錄的輸入資料
 */
export interface CreateHistoryInput {
  opportunityId: string;
  symbol: string;
  longExchange: string;
  shortExchange: string;
  initialRateDifference: number;
  maxRateDifference: number;
  avgRateDifference: number;
  durationMs: number;
  totalNotifications: number;
  detectedAt: Date;
  expiredAt: Date;
  disappearReason: DisappearReason;
}

/**
 * 歷史記錄查詢篩選條件
 */
export interface HistoryQueryFilter {
  symbol?: string;
  detectedAfter?: Date;
  detectedBefore?: Date;
  minDurationMs?: number;
  maxDurationMs?: number;
  disappearReason?: DisappearReason;
}

/**
 * 歷史統計資料
 */
export interface OpportunityStatistics {
  /** 總機會數 */
  totalOpportunities: number;

  /** 活躍機會數 */
  activeOpportunities: number;

  /** 已過期機會數 */
  expiredOpportunities: number;

  /** 平均持續時間（分鐘）*/
  avgDurationMinutes: number;

  /** 最大持續時間（分鐘）*/
  maxDurationMinutes: number;

  /** 平均費率差異 */
  avgRateDifference: number;

  /** 最大費率差異 */
  maxRateDifference: number;

  /** 平均通知次數 */
  avgNotifications: number;
}

/**
 * 套利機會儲存庫介面
 *
 * 職責：
 * - 管理 ArbitrageOpportunity 記錄的 CRUD 操作
 * - 提供查詢和統計功能
 * - 處理機會狀態轉換
 */
export interface IArbitrageOpportunityRepository {
  /**
   * 建立新的套利機會記錄
   *
   * @param input 機會資料
   * @returns 建立的機會記錄
   */
  create(input: CreateOpportunityInput): Promise<ArbitrageOpportunity>;

  /**
   * 根據 ID 查詢機會
   *
   * @param id 機會 ID
   * @returns 機會記錄，如果不存在則返回 null
   */
  findById(id: string): Promise<ArbitrageOpportunity | null>;

  /**
   * 根據交易對和狀態查詢機會
   *
   * @param symbol 交易對符號
   * @param status 機會狀態（可選）
   * @returns 機會記錄，如果不存在則返回 null
   */
  findBySymbol(symbol: string, status?: OpportunityStatus): Promise<ArbitrageOpportunity | null>;

  /**
   * 查詢多個機會
   *
   * @param filter 篩選條件
   * @param sort 排序選項
   * @param limit 限制數量
   * @returns 機會記錄陣列
   */
  findMany(filter: OpportunityQueryFilter, sort?: OpportunityQuerySort, limit?: number): Promise<ArbitrageOpportunity[]>;

  /**
   * 查詢所有活躍機會
   *
   * @param sort 排序選項
   * @returns 活躍機會陣列
   */
  findActive(sort?: OpportunityQuerySort): Promise<ArbitrageOpportunity[]>;

  /**
   * 更新機會記錄
   *
   * @param id 機會 ID
   * @param input 更新資料
   * @returns 更新後的機會記錄
   */
  update(id: string, input: UpdateOpportunityInput): Promise<ArbitrageOpportunity>;

  /**
   * 標記機會為已過期
   *
   * @param id 機會 ID
   * @returns 更新後的機會記錄
   */
  markAsExpired(id: string): Promise<ArbitrageOpportunity>;

  /**
   * 關閉機會
   *
   * @param id 機會 ID
   * @returns 更新後的機會記錄
   */
  close(id: string): Promise<ArbitrageOpportunity>;

  /**
   * 增加通知計數
   *
   * @param id 機會 ID
   * @returns 更新後的機會記錄
   */
  incrementNotificationCount(id: string): Promise<ArbitrageOpportunity>;

  /**
   * 更新最大費率差異
   *
   * @param id 機會 ID
   * @param rateDifference 新的費率差異
   * @returns 更新後的機會記錄
   */
  updateMaxRateDifference(id: string, rateDifference: number): Promise<ArbitrageOpportunity>;

  /**
   * 刪除機會記錄
   *
   * @param id 機會 ID
   */
  delete(id: string): Promise<void>;

  /**
   * 刪除過期的機會記錄（用於清理）
   *
   * @param daysAgo 多少天前的記錄
   * @returns 刪除的記錄數量
   */
  deleteExpired(daysAgo: number): Promise<number>;

  /**
   * 計算統計資料
   *
   * @param symbol 交易對符號（可選，如果提供則計算該交易對的統計）
   * @param startDate 開始日期（可選）
   * @param endDate 結束日期（可選）
   * @returns 統計資料
   */
  getStatistics(symbol?: string, startDate?: Date, endDate?: Date): Promise<OpportunityStatistics>;
}

/**
 * 機會歷史儲存庫介面
 *
 * 職責：
 * - 管理 OpportunityHistory 記錄的建立和查詢
 * - 提供歷史分析功能
 */
export interface IOpportunityHistoryRepository {
  /**
   * 建立歷史記錄
   *
   * @param input 歷史資料
   * @returns 建立的歷史記錄
   */
  create(input: CreateHistoryInput): Promise<OpportunityHistory>;

  /**
   * 根據機會 ID 查詢歷史記錄
   *
   * @param opportunityId 機會 ID
   * @returns 歷史記錄，如果不存在則返回 null
   */
  findByOpportunityId(opportunityId: string): Promise<OpportunityHistory | null>;

  /**
   * 查詢多個歷史記錄
   *
   * @param filter 篩選條件
   * @param limit 限制數量
   * @returns 歷史記錄陣列
   */
  findMany(filter: HistoryQueryFilter, limit?: number): Promise<OpportunityHistory[]>;

  /**
   * 查詢最近的歷史記錄
   *
   * @param hours 最近多少小時
   * @param symbol 交易對符號（可選）
   * @returns 歷史記錄陣列
   */
  findRecent(hours: number, symbol?: string): Promise<OpportunityHistory[]>;

  /**
   * 計算通過率（機會消失的比例）
   *
   * @param symbol 交易對符號
   * @param daysBack 往回查詢多少天
   * @returns 通過率（0-100）
   */
  calculatePassRate(symbol: string, daysBack: number): Promise<number>;

  /**
   * 取得持續時間統計
   *
   * @param symbol 交易對符號（可選）
   * @param daysBack 往回查詢多少天
   * @returns 持續時間統計（平均、最大、最小）
   */
  getDurationStats(symbol?: string, daysBack?: number): Promise<{
    avgMinutes: number;
    maxMinutes: number;
    minMinutes: number;
    totalOpportunities: number;
  }>;

  /**
   * 刪除舊的歷史記錄
   *
   * @param daysAgo 多少天前的記錄
   * @returns 刪除的記錄數量
   */
  deleteOld(daysAgo: number): Promise<number>;
}
