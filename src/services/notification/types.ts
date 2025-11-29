/**
 * Notification Service Types
 * Feature 026: Discord/Slack 套利機會即時推送通知
 */

import type { ExchangeName } from '../../models/FundingRate';

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
}

/**
 * 建立 Webhook 請求
 */
export interface CreateWebhookRequest {
  platform: NotificationPlatform;
  webhookUrl: string;
  name: string;
  threshold?: number;
}

/**
 * 更新 Webhook 請求
 */
export interface UpdateWebhookRequest {
  webhookUrl?: string;
  name?: string;
  isEnabled?: boolean;
  threshold?: number;
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
  createdAt: string;
  updatedAt: string;
}
