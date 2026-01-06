/**
 * Notification Service Types
 * Feature 026: Discord/Slack 套利機會即時推送通知
 * Feature 027: 套利機會結束監測和通知
 */

import type { ExchangeName } from '../../models/FundingRate';

// ===== Feature 027: 套利機會結束監測 =====

/**
 * 費率結算記錄
 */
export interface FundingSettlement {
  timestamp: Date;
  rate: number; // 正數=收取，負數=支付
}

/**
 * 已通知的 Webhook 資訊
 */
export interface NotifiedWebhookInfo {
  webhookId: string;
  userId: string;
  threshold: number;
  notifyOnDisappear: boolean;
}

/**
 * 追蹤中的套利機會
 */
export interface TrackedOpportunity {
  // 識別資訊
  symbol: string;
  longExchange: string;
  shortExchange: string;

  // 時間資訊
  detectedAt: Date;
  lastUpdatedAt: Date;

  // 費差統計
  initialSpread: number;
  maxSpread: number;
  maxSpreadAt: Date;
  currentSpread: number;

  // 費率結算記錄（多空分開）
  longSettlements: FundingSettlement[];
  shortSettlements: FundingSettlement[];
  longIntervalHours: number;
  shortIntervalHours: number;

  // 下次結算時間（用於判斷是否該記錄）
  longNextSettlement?: Date;
  shortNextSettlement?: Date;

  // 已通知的 Webhook（key: webhookId）
  notifiedWebhooks: Map<string, NotifiedWebhookInfo>;

  // 通知計數
  notificationCount: number;

  // 防抖動：首次低於某 Webhook 閾值的時間（key: webhookId）
  disappearingAt: Map<string, Date>;
}

/**
 * 機會結束通知訊息
 */
export interface OpportunityDisappearedMessage {
  // 基本資訊
  symbol: string;
  longExchange: string;
  shortExchange: string;

  // 時間資訊
  detectedAt: Date;
  disappearedAt: Date;
  durationFormatted: string; // "2 小時 30 分鐘"

  // 費差統計
  initialSpread: number;
  maxSpread: number;
  maxSpreadAt: Date;
  finalSpread: number;

  // 費率結算記錄
  longIntervalHours: number;
  shortIntervalHours: number;
  settlementRecords: Array<{
    side: 'long' | 'short';
    timestamp: Date;
    rate: number;
  }>;

  // 模擬收益
  longSettlementCount: number;
  shortSettlementCount: number;
  totalFundingProfit: number;
  totalCost: number;
  netProfit: number;
  realizedAPY: number;

  // 通知統計
  notificationCount: number;

  // 時間戳
  timestamp: Date;
}

// ===== Feature 050: 停損停利觸發通知 =====

/**
 * 觸發類型（用於通知）
 */
export type TriggerNotificationType = 'LONG_SL' | 'LONG_TP' | 'SHORT_SL' | 'SHORT_TP' | 'BOTH';

/**
 * 觸發通知訊息
 * Feature 050: 停損停利觸發偵測與自動平倉
 */
export interface TriggerNotificationMessage {
  // 基本資訊
  positionId: string;
  symbol: string;
  triggerType: TriggerNotificationType;

  // 觸發資訊
  triggeredExchange: string;
  triggeredSide: 'LONG' | 'SHORT';
  triggerPrice?: number;

  // 平倉資訊
  closedExchange: string;
  closedSide: 'LONG' | 'SHORT';
  closePrice?: number;

  // 損益資訊
  pnl: {
    priceDiffPnL: number;
    fundingRatePnL: number;
    totalFees: number;
    totalPnL: number;
    roi: number; // percentage
  };

  // 持倉資訊
  positionSize: number;
  leverage: number;
  holdingDuration: string; // e.g., "2 小時 30 分鐘"

  // 時間戳
  triggeredAt: Date;
  closedAt: Date;
}

/**
 * 緊急通知訊息（平倉失敗）
 * Feature 050: 停損停利觸發偵測與自動平倉
 */
export interface EmergencyNotificationMessage {
  positionId: string;
  symbol: string;
  triggerType: TriggerNotificationType;
  triggeredExchange: string;
  error: string;
  requiresManualIntervention: boolean;
  timestamp: Date;
}

// ===== Feature 026: 原有類型定義 =====

/**
 * 通知平台類型
 */
export type NotificationPlatform = 'discord' | 'slack';

/**
 * Webhook 設定
 */
export interface WebhookConfig {
  id: string;
  userId: string;
  platform: NotificationPlatform;
  webhookUrl: string;
  name: string;
  isEnabled: boolean;
  threshold: number; // 年化收益閾值 (%)
  notifyOnDisappear: boolean; // Feature 027: 是否接收機會結束通知
  notificationMinutes: number[]; // 通知時間（每小時的第幾分鐘），最多 2 個
  requireFavorablePrice: boolean; // Feature 057: 是否啟用價差過濾（淨收益 > 0 且價差方向正確時才通知）
}

/**
 * 套利機會通知訊息
 */
export interface ArbitrageNotificationMessage {
  // 基本資訊
  symbol: string;

  // 做多交易所資訊
  longExchange: ExchangeName;
  longOriginalRate: number;      // 原始費率
  longTimeBasis: number;         // 原始時間基準 (小時)
  longNormalizedRate: number;    // 標準化 8h 費率
  longPrice?: number;            // 價格

  // 做空交易所資訊
  shortExchange: ExchangeName;
  shortOriginalRate: number;     // 原始費率
  shortTimeBasis: number;        // 原始時間基準 (小時)
  shortNormalizedRate: number;   // 標準化 8h 費率
  shortPrice?: number;           // 價格

  // 套利分析
  spreadPercent: number;         // 費率差 (%)
  annualizedReturn: number;      // 年化收益 (%)

  // 價差分析
  priceDiffPercent?: number;     // 價差 (%)
  isPriceDirectionCorrect: boolean;  // 價差方向是否正確
  paybackPeriods?: number;       // 打平所需費率收取次數

  // 回本週期
  fundingPaybackPeriods: number; // 回本所需費率收取次數

  // 時間戳
  timestamp: Date;
}

/**
 * 通知發送結果
 */
export interface NotificationResult {
  webhookId: string;
  success: boolean;
  error?: string;
  timestamp: Date;
}

/**
 * Notifier 介面 - 各平台實作此介面
 */
export interface INotifier {
  /**
   * 發送套利機會通知
   */
  sendArbitrageNotification(
    webhookUrl: string,
    message: ArbitrageNotificationMessage
  ): Promise<NotificationResult>;

  /**
   * 發送測試通知
   */
  sendTestNotification(webhookUrl: string): Promise<NotificationResult>;

  /**
   * Feature 027: 發送機會結束通知
   */
  sendDisappearedNotification(
    webhookUrl: string,
    message: OpportunityDisappearedMessage
  ): Promise<NotificationResult>;

  /**
   * Feature 050: 發送觸發通知
   */
  sendTriggerNotification(
    webhookUrl: string,
    message: TriggerNotificationMessage
  ): Promise<NotificationResult>;

  /**
   * Feature 050: 發送緊急通知（平倉失敗）
   */
  sendEmergencyNotification(
    webhookUrl: string,
    message: EmergencyNotificationMessage
  ): Promise<NotificationResult>;
}

/**
 * 建立 Webhook 請求
 */
export interface CreateWebhookRequest {
  platform: NotificationPlatform;
  webhookUrl: string;
  name: string;
  threshold?: number;
  notifyOnDisappear?: boolean; // Feature 027
  notificationMinutes?: number[]; // 通知時間（每小時的第幾分鐘）
  requireFavorablePrice?: boolean; // Feature 057: 是否啟用價差過濾
}

/**
 * 更新 Webhook 請求
 */
export interface UpdateWebhookRequest {
  webhookUrl?: string;
  name?: string;
  isEnabled?: boolean;
  threshold?: number;
  notifyOnDisappear?: boolean; // Feature 027
  notificationMinutes?: number[]; // 通知時間（每小時的第幾分鐘）
  requireFavorablePrice?: boolean; // Feature 057: 是否啟用價差過濾
}

/**
 * Webhook API 回應
 */
export interface WebhookResponse {
  id: string;
  platform: NotificationPlatform;
  name: string;
  isEnabled: boolean;
  threshold: number;
  notifyOnDisappear: boolean; // Feature 027
  notificationMinutes: number[]; // 通知時間（每小時的第幾分鐘）
  requireFavorablePrice: boolean; // Feature 057: 是否啟用價差過濾
  createdAt: string;
  updatedAt: string;
}
