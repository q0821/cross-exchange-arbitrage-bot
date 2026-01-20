/**
 * ConditionalOrderMonitor Types
 * Feature: 050-sl-tp-trigger-monitor
 *
 * 停損停利觸發偵測與自動平倉功能的類型定義
 */

/**
 * 觸發類型
 */
export const TriggerType = {
  LONG_SL: 'LONG_SL',   // 多方停損觸發
  LONG_TP: 'LONG_TP',   // 多方停利觸發
  SHORT_SL: 'SHORT_SL', // 空方停損觸發
  SHORT_TP: 'SHORT_TP', // 空方停利觸發
  BOTH: 'BOTH',         // 雙邊同時觸發
} as const;

export type TriggerType = (typeof TriggerType)[keyof typeof TriggerType];

/**
 * 訂單歷史狀態
 * 用於確認條件單是「觸發成交」還是「用戶取消」
 */
export const OrderHistoryStatus = {
  TRIGGERED: 'TRIGGERED', // 觸發成交
  CANCELED: 'CANCELED',   // 用戶取消
  EXPIRED: 'EXPIRED',     // 訂單過期
  UNKNOWN: 'UNKNOWN',     // 未知狀態
} as const;

export type OrderHistoryStatus = (typeof OrderHistoryStatus)[keyof typeof OrderHistoryStatus];

/**
 * 觸發偵測結果
 */
export interface TriggerResult {
  positionId: string;
  triggerType: TriggerType;
  triggeredExchange: string;
  triggeredOrderId: string;
  triggeredAt: Date;
  confirmedByHistory: boolean;
  // 雙邊觸發時的額外資訊
  otherSideTriggeredExchange?: string;
  otherSideTriggeredOrderId?: string;
}

/**
 * 條件單資訊
 */
export interface ConditionalOrderInfo {
  orderId: string;
  exchange: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  orderType: 'STOP_LOSS' | 'TAKE_PROFIT';
  triggerPrice: number;
  status: OrderHistoryStatus;
  existsInPending: boolean;
}

/**
 * 監控服務配置
 */
export interface MonitorConfig {
  intervalMs: number;    // 輪詢間隔（毫秒）
  maxRetries: number;    // 最大重試次數
  retryDelayMs: number;  // 重試延遲（毫秒）
}

/**
 * 預設監控配置
 */
export const DEFAULT_MONITOR_CONFIG: MonitorConfig = {
  intervalMs: 30000,     // 30 秒
  maxRetries: 3,
  retryDelayMs: 1000,    // 1 秒
};

/**
 * 條件單存在狀態映射
 * 用於記錄各個條件單是否存在於交易所待執行列表
 */
export interface OrderStatusMap {
  longStopLossExists: boolean;
  longTakeProfitExists: boolean;
  shortStopLossExists: boolean;
  shortTakeProfitExists: boolean;
}

// ===== WebSocket 事件類型 (對應 contracts/websocket.md) =====

/**
 * 條件單觸發開始處理事件
 */
export interface TriggerDetectedEvent {
  positionId: string;
  symbol: string;
  triggerType: TriggerType;
  triggeredExchange: string;
  triggeredAt: string; // ISO 8601
}

/**
 * 自動平倉進度事件
 */
export interface TriggerCloseProgressEvent {
  positionId: string;
  step: 'CLOSING_OTHER_SIDE' | 'CANCELING_ORDERS' | 'UPDATING_STATUS';
  message: string;
}

/**
 * 自動平倉成功事件
 */
export interface TriggerCloseSuccessEvent {
  positionId: string;
  symbol: string;
  triggerType: TriggerType;
  closeReason: string; // CloseReason enum value
  closedAt: string; // ISO 8601
  pnl: {
    priceDiffPnL: number;
    fundingRatePnL: number;
    totalFees: number;
    totalPnL: number;
    roi: number; // percentage
  };
}

/**
 * 自動平倉失敗事件
 */
export interface TriggerCloseFailedEvent {
  positionId: string;
  symbol: string;
  triggerType: TriggerType;
  error: string;
  requiresManualIntervention: boolean;
  failedSide?: {
    exchange: string;
    side: 'LONG' | 'SHORT';
  };
}

/**
 * 部分平倉事件
 */
export interface TriggerClosePartialEvent {
  positionId: string;
  symbol: string;
  triggerType: TriggerType;
  closedSide: {
    exchange: string;
    side: 'LONG' | 'SHORT';
    price: number;
    quantity: number;
  };
  failedSide: {
    exchange: string;
    side: 'LONG' | 'SHORT';
    error: string;
  };
  requiresManualIntervention: boolean;
}

/**
 * 監控狀態
 */
export interface MonitorStatus {
  isRunning: boolean;
  lastCheckAt: Date | null;
  activePositionsCount: number;
  checksPerformed: number;
  errors: {
    count: number;
    lastError: string | null;
    lastErrorAt: Date | null;
  };
}

// ===== Feature 067: 持倉平倉建議監控 =====

/**
 * 平倉建議原因
 */
export const ExitSuggestionReason = {
  APY_NEGATIVE: 'APY_NEGATIVE',       // APY 轉負，繼續持有會虧損
  PROFIT_LOCKABLE: 'PROFIT_LOCKABLE', // APY 低於閾值但整體有獲利可鎖定
} as const;

export type ExitSuggestionReason = (typeof ExitSuggestionReason)[keyof typeof ExitSuggestionReason];

/**
 * 平倉建議計算結果（不持久化）
 */
export interface ExitSuggestion {
  positionId: string;
  symbol: string;
  userId: string;

  // 建議資訊
  suggested: boolean;
  reason: ExitSuggestionReason | null;
  suggestedAt: Date;

  // 計算數據
  currentAPY: number;              // 當前 APY (%)
  fundingPnL: number;              // 累計費率收益 (USDT)
  priceDiffLoss: number;           // 價差損失 (USDT)
  netProfit: number;               // 淨收益 = fundingPnL - priceDiffLoss

  // 價格資訊
  currentLongPrice: number;
  currentShortPrice: number;
  stalePrice: boolean;             // 價格是否過時

  // 交易所資訊
  longExchange: string;
  shortExchange: string;
}

/**
 * 平倉建議通知訊息
 */
export interface ExitSuggestionMessage {
  symbol: string;
  positionId: string;

  // 建議資訊
  reason: ExitSuggestionReason;
  reasonDescription: string;

  // 數據
  currentAPY: number;
  fundingPnL: number;
  priceDiffLoss: number;
  netProfit: number;

  // 交易所
  longExchange: string;
  shortExchange: string;

  timestamp: Date;
}

/**
 * 平倉建議 WebSocket 事件 - 建議平倉
 */
export interface ExitSuggestedEvent {
  positionId: string;
  symbol: string;
  reason: ExitSuggestionReason;
  reasonDescription: string;
  currentAPY: number;
  fundingPnL: number;
  priceDiffLoss: number;
  netProfit: number;
  longExchange: string;
  shortExchange: string;
  currentLongPrice: number;
  currentShortPrice: number;
  stalePrice: boolean;
  suggestedAt: string; // ISO 8601
}

/**
 * 平倉建議 WebSocket 事件 - 建議取消
 */
export interface ExitCanceledEvent {
  positionId: string;
  symbol: string;
  currentAPY: number;
  canceledAt: string; // ISO 8601
}
