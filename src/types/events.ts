/**
 * 事件型別定義
 * 用於事件驅動架構中的套利機會偵測與通知系統
 */

import type { Decimal } from '@prisma/client/runtime/library'

/**
 * 套利機會偵測事件
 * 當偵測到新的套利機會時觸發
 */
export interface OpportunityDetectedEvent {
  /** 事件類型 */
  type: 'OPPORTUNITY_DETECTED'
  /** 機會 ID */
  opportunityId: string
  /** 幣別符號 */
  symbol: string
  /** 做多交易所 */
  longExchange: string
  /** 做空交易所 */
  shortExchange: string
  /** 做多資金費率 */
  longFundingRate: Decimal
  /** 做空資金費率 */
  shortFundingRate: Decimal
  /** 費率差異 */
  rateDifference: Decimal
  /** 預期收益率 */
  expectedReturnRate: Decimal
  /** 偵測時間 */
  detectedAt: Date
}

/**
 * 套利機會更新事件
 * 當現有機會的費率差異有顯著變化時觸發
 */
export interface OpportunityUpdatedEvent {
  /** 事件類型 */
  type: 'OPPORTUNITY_UPDATED'
  /** 機會 ID */
  opportunityId: string
  /** 幣別符號 */
  symbol: string
  /** 新的費率差異 */
  newRateDifference: Decimal
  /** 舊的費率差異 */
  oldRateDifference: Decimal
  /** 變化百分比 */
  changePercentage: number
  /** 更新時間 */
  updatedAt: Date
}

/**
 * 套利機會消失事件
 * 當機會費率差異低於閾值或資料不可用時觸發
 */
export interface OpportunityDisappearedEvent {
  /** 事件類型 */
  type: 'OPPORTUNITY_DISAPPEARED'
  /** 機會 ID */
  opportunityId: string
  /** 幣別符號 */
  symbol: string
  /** 消失原因 */
  reason: 'RATE_DROPPED' | 'DATA_UNAVAILABLE' | 'MANUAL_CLOSE' | 'SYSTEM_ERROR'
  /** 持續時間（毫秒） */
  durationMs: number
  /** 最大費率差異 */
  maxRateDifference: Decimal
  /** 平均費率差異 */
  avgRateDifference: Decimal
  /** 消失時間 */
  disappearedAt: Date
}

/**
 * 資金費率更新事件
 * 當資金費率資料更新時觸發（來自 FundingRateMonitor）
 */
export interface FundingRateUpdatedEvent {
  /** 事件類型 */
  type: 'FUNDING_RATE_UPDATED'
  /** 交易所名稱 */
  exchange: string
  /** 幣別符號 */
  symbol: string
  /** 資金費率 */
  fundingRate: Decimal
  /** 下次結算時間 */
  nextFundingTime: Date
  /** 標記價格 */
  markPrice?: Decimal
  /** 指數價格 */
  indexPrice?: Decimal
  /** 記錄時間 */
  recordedAt: Date
}

/**
 * 通知發送事件
 * 當通知被發送時觸發（用於記錄和統計）
 */
export interface NotificationSentEvent {
  /** 事件類型 */
  type: 'NOTIFICATION_SENT'
  /** 機會 ID */
  opportunityId: string
  /** 通知類型 */
  notificationType: 'OPPORTUNITY_APPEARED' | 'OPPORTUNITY_DISAPPEARED' | 'OPPORTUNITY_UPDATED'
  /** 通知渠道 */
  channel: 'TERMINAL' | 'LOG' | 'WEBHOOK' | 'TELEGRAM'
  /** 嚴重性 */
  severity: 'INFO' | 'WARNING' | 'CRITICAL'
  /** 是否被防抖動 */
  isDebounced: boolean
  /** 發送時間 */
  sentAt: Date
}

/**
 * 所有事件的聯合型別
 */
export type AppEvent =
  | OpportunityDetectedEvent
  | OpportunityUpdatedEvent
  | OpportunityDisappearedEvent
  | FundingRateUpdatedEvent
  | NotificationSentEvent

/**
 * 事件處理器型別
 */
export type EventHandler<T extends AppEvent = AppEvent> = (event: T) => void | Promise<void>

/**
 * 事件發射器介面
 */
export interface EventEmitter {
  /**
   * 註冊事件監聽器
   * @param eventType 事件類型
   * @param handler 事件處理器
   */
  on<T extends AppEvent['type']>(
    eventType: T,
    handler: EventHandler<Extract<AppEvent, { type: T }>>
  ): void

  /**
   * 移除事件監聽器
   * @param eventType 事件類型
   * @param handler 事件處理器
   */
  off<T extends AppEvent['type']>(
    eventType: T,
    handler: EventHandler<Extract<AppEvent, { type: T }>>
  ): void

  /**
   * 發送事件
   * @param event 事件物件
   */
  emit<T extends AppEvent>(event: T): void

  /**
   * 註冊一次性事件監聽器
   * @param eventType 事件類型
   * @param handler 事件處理器
   */
  once<T extends AppEvent['type']>(
    eventType: T,
    handler: EventHandler<Extract<AppEvent, { type: T }>>
  ): void
}
