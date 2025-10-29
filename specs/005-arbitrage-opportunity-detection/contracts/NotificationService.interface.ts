/**
 * NotificationService Interface
 *
 * Feature: 005-arbitrage-opportunity-detection
 * Purpose: 定義通知服務和通知渠道的介面合約
 */

import type { EventEmitter } from 'events';
import type {
  OpportunityAppearedEvent,
  OpportunityDisappearedEvent,
  OpportunityUpdatedEvent
} from './OpportunityDetector.interface.js';

/**
 * 通知渠道類型
 */
export type NotificationChannelType = 'terminal' | 'log' | 'webhook' | 'telegram';

/**
 * 通知嚴重程度
 */
export type NotificationSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

/**
 * 通知訊息格式
 */
export interface NotificationMessage {
  /** 訊息標題 */
  title: string;

  /** 訊息內容 */
  body: string;

  /** 嚴重程度 */
  severity: NotificationSeverity;

  /** 時間戳 */
  timestamp: Date;

  /** 附加資料 */
  metadata?: Record<string, any>;
}

/**
 * 通知錯誤
 */
export interface NotificationError {
  /** 渠道名稱 */
  channel: NotificationChannelType;

  /** 錯誤訊息 */
  message: string;

  /** 原始錯誤 */
  originalError?: Error;

  /** 時間戳 */
  timestamp: Date;
}

/**
 * 通知渠道介面
 *
 * 職責：
 * - 實作特定渠道的通知發送邏輯
 * - 處理渠道特定的格式化和配置
 */
export interface INotificationChannel {
  /** 渠道名稱 */
  readonly name: NotificationChannelType;

  /** 渠道是否已啟用 */
  readonly enabled: boolean;

  /**
   * 發送通知
   *
   * @param message 通知訊息
   * @param data 原始事件資料
   * @throws 如果發送失敗則拋出錯誤
   */
  send(message: NotificationMessage, data: unknown): Promise<void>;

  /**
   * 測試渠道連線
   *
   * @returns 是否連線成功
   */
  test(): Promise<boolean>;

  /**
   * 啟用渠道
   */
  enable(): void;

  /**
   * 停用渠道
   */
  disable(): void;
}

/**
 * Terminal 渠道配置
 */
export interface TerminalChannelConfig {
  /** 是否使用顏色 */
  useColor: boolean;

  /** 是否顯示時間戳 */
  showTimestamp: boolean;

  /** 是否顯示詳細資訊 */
  verbose: boolean;
}

/**
 * Log 渠道配置
 */
export interface LogChannelConfig {
  /** 日誌等級 */
  level: 'info' | 'warn' | 'error';

  /** 是否記錄附加資料 */
  includeMetadata: boolean;
}

/**
 * Webhook 渠道配置
 */
export interface WebhookChannelConfig {
  /** Webhook URL */
  url: string;

  /** HTTP 方法 */
  method: 'POST' | 'PUT';

  /** 自訂 Headers */
  headers?: Record<string, string>;

  /** 請求逾時（毫秒）*/
  timeoutMs: number;

  /** 重試次數 */
  retries: number;
}

/**
 * Telegram 渠道配置
 */
export interface TelegramChannelConfig {
  /** Bot Token */
  botToken: string;

  /** Chat ID */
  chatId: string;

  /** 是否使用 Markdown */
  useMarkdown: boolean;

  /** 是否停用通知音效 */
  disableNotification: boolean;
}

/**
 * 通知服務配置
 */
export interface NotificationServiceConfig {
  /** 已註冊的渠道 */
  channels: NotificationChannelType[];

  /** 是否啟用防抖動 */
  enableDebounce: boolean;

  /** 防抖動時間（毫秒）*/
  debounceMs: number;

  /** Per-symbol 防抖動配置 */
  symbolDebounce?: Record<string, number>;

  /** 最小嚴重程度（只通知此等級以上的訊息）*/
  minSeverity: NotificationSeverity;
}

/**
 * 通知服務事件定義
 */
export interface NotificationServiceEvents {
  /**
   * 通知成功事件
   */
  'notification:sent': (channel: NotificationChannelType, message: NotificationMessage) => void;

  /**
   * 通知失敗事件（非致命，允許 graceful degradation）
   */
  'notification:failed': (error: NotificationError) => void;

  /**
   * 防抖動跳過事件
   */
  'notification:debounced': (symbol: string, skipCount: number) => void;

  /**
   * 錯誤事件
   */
  'error': (error: Error) => void;
}

/**
 * 通知統計資料
 */
export interface NotificationStats {
  /** 總發送次數 */
  totalSent: number;

  /** 總失敗次數 */
  totalFailed: number;

  /** 總防抖動跳過次數 */
  totalDebounced: number;

  /** Per-channel 統計 */
  byChannel: Record<NotificationChannelType, {
    sent: number;
    failed: number;
  }>;

  /** Per-symbol 統計 */
  bySymbol: Record<string, {
    sent: number;
    debounced: number;
  }>;
}

/**
 * 通知服務介面
 *
 * 職責：
 * - 管理多個通知渠道
 * - 處理機會偵測事件並發送通知
 * - 實作防抖動機制避免通知轟炸
 * - 提供 graceful degradation（單一渠道失敗不影響其他渠道）
 * - 記錄通知日誌和統計
 */
export interface INotificationService extends EventEmitter {
  /**
   * 註冊通知渠道
   *
   * @param channel 通知渠道實例
   */
  registerChannel(channel: INotificationChannel): void;

  /**
   * 移除通知渠道
   *
   * @param channelName 渠道名稱
   */
  unregisterChannel(channelName: NotificationChannelType): void;

  /**
   * 取得已註冊的渠道
   *
   * @returns 渠道名稱陣列
   */
  getRegisteredChannels(): NotificationChannelType[];

  /**
   * 處理機會出現事件
   *
   * @param event 機會出現事件資料
   */
  notifyOpportunityAppeared(event: OpportunityAppearedEvent): Promise<void>;

  /**
   * 處理機會消失事件
   *
   * @param event 機會消失事件資料
   */
  notifyOpportunityDisappeared(event: OpportunityDisappearedEvent): Promise<void>;

  /**
   * 處理機會更新事件
   *
   * @param event 機會更新事件資料
   */
  notifyOpportunityUpdated(event: OpportunityUpdatedEvent): Promise<void>;

  /**
   * 發送自訂通知
   *
   * @param message 通知訊息
   * @param channels 指定發送的渠道（可選，預設發送到所有渠道）
   */
  sendCustomNotification(message: NotificationMessage, channels?: NotificationChannelType[]): Promise<void>;

  /**
   * 測試所有渠道
   *
   * @returns 測試結果（channel -> 是否成功）
   */
  testAllChannels(): Promise<Record<NotificationChannelType, boolean>>;

  /**
   * 取得通知統計
   *
   * @returns 統計資料
   */
  getStats(): NotificationStats;

  /**
   * 清除統計資料
   */
  clearStats(): void;

  /**
   * 更新配置
   *
   * @param config 新的配置
   */
  updateConfig(config: Partial<NotificationServiceConfig>): void;

  /**
   * 取得當前配置
   *
   * @returns 通知服務配置
   */
  getConfig(): NotificationServiceConfig;
}

/**
 * 型別安全的 EventEmitter
 */
export interface TypedEventEmitter<T> {
  on<K extends keyof T>(event: K, listener: T[K] extends (...args: any[]) => any ? T[K] : never): this;
  emit<K extends keyof T>(event: K, ...args: T[K] extends (...args: infer P) => any ? P : never[]): boolean;
  off<K extends keyof T>(event: K, listener: T[K] extends (...args: any[]) => any ? T[K] : never): this;
  once<K extends keyof T>(event: K, listener: T[K] extends (...args: any[]) => any ? T[K] : never): this;
  removeAllListeners<K extends keyof T>(event?: K): this;
}

/**
 * 型別安全的通知服務介面
 */
export type TypedNotificationService = INotificationService & TypedEventEmitter<NotificationServiceEvents>;
