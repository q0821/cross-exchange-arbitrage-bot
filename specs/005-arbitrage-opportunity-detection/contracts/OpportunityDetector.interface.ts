/**
 * OpportunityDetector Service Interface
 *
 * Feature: 005-arbitrage-opportunity-detection
 * Purpose: 定義套利機會偵測服務的介面合約
 */

import type { EventEmitter } from 'events';
import type { FundingRatePair } from '../../../src/models/FundingRate.js';

/**
 * 機會偵測器配置
 */
export interface OpportunityDetectorConfig {
  /**
   * 最小套利閾值（預設 0.0005，即 0.05%）
   */
  minimumThreshold: number;

  /**
   * 警告等級閾值（預設 0.002，即 0.2%）
   */
  warningThreshold: number;

  /**
   * 嚴重等級閾值（預設 0.005，即 0.5%）
   */
  criticalThreshold: number;

  /**
   * 是否啟用自動通知（預設 true）
   */
  enableNotifications: boolean;

  /**
   * 防抖動時間（毫秒，預設 30000）
   */
  debounceMs: number;
}

/**
 * 機會出現事件 Payload
 */
export interface OpportunityAppearedEvent {
  /** 交易對 */
  symbol: string;

  /** 資金費率配對資料 */
  pair: FundingRatePair;

  /** 檢測時間 */
  detectedAt: Date;

  /** 嚴重程度 */
  severity: 'INFO' | 'WARNING' | 'CRITICAL';

  /** 預期年化收益率 */
  expectedAnnualizedReturn: number;
}

/**
 * 機會消失事件 Payload
 */
export interface OpportunityDisappearedEvent {
  /** 交易對 */
  symbol: string;

  /** 最後一次的資金費率配對資料 */
  lastPair: FundingRatePair;

  /** 機會持續時間（毫秒）*/
  durationMs: number;

  /** 消失時間 */
  disappearedAt: Date;

  /** 最大費率差異 */
  maxRateDifference: number;

  /** 總通知次數 */
  totalNotifications: number;
}

/**
 * 機會更新事件 Payload
 */
export interface OpportunityUpdatedEvent {
  /** 交易對 */
  symbol: string;

  /** 當前資金費率配對資料 */
  currentPair: FundingRatePair;

  /** 前一次的價差百分比 */
  previousSpread: number;

  /** 價差變化（正值表示增加，負值表示減少）*/
  spreadChange: number;

  /** 更新時間 */
  updatedAt: Date;
}

/**
 * 機會偵測器事件定義
 */
export interface OpportunityDetectorEvents {
  /**
   * 機會出現事件
   * 當價差超過閾值時觸發
   */
  'opportunity:appeared': (event: OpportunityAppearedEvent) => void;

  /**
   * 機會消失事件
   * 當價差降到閾值以下時觸發
   */
  'opportunity:disappeared': (event: OpportunityDisappearedEvent) => void;

  /**
   * 機會更新事件
   * 現有機會的價差變化
   */
  'opportunity:updated': (event: OpportunityUpdatedEvent) => void;

  /**
   * 錯誤事件
   */
  'error': (error: Error) => void;
}

/**
 * 活躍機會資訊
 */
export interface ActiveOpportunityInfo {
  /** 交易對 */
  symbol: string;

  /** 首次偵測時間 */
  firstDetectedAt: Date;

  /** 初始價差 */
  initialSpread: number;

  /** 當前價差 */
  currentSpread: number;

  /** 最大價差 */
  maxSpread: number;

  /** 最大價差發生時間 */
  maxSpreadAt: Date;

  /** 持續時間（毫秒）*/
  durationMs: number;

  /** 通知次數 */
  notificationCount: number;

  /** 最後一次資金費率資料 */
  lastPair: FundingRatePair;
}

/**
 * 機會偵測器服務介面
 *
 * 職責：
 * - 接收資金費率更新並判斷是否達到套利閾值
 * - 追蹤機會生命週期（出現、持續、消失）
 * - 發出型別安全的事件通知
 * - 管理活躍機會狀態
 */
export interface IOpportunityDetector extends EventEmitter {
  /**
   * 處理資金費率更新
   * 此方法由 FundingRateMonitor 的 'rate-updated' 事件觸發
   *
   * @param pair 資金費率配對資料
   */
  handleRateUpdate(pair: FundingRatePair): void;

  /**
   * 取得當前活躍機會數量
   *
   * @returns 活躍機會數量
   */
  getActiveOpportunitiesCount(): number;

  /**
   * 取得所有活躍機會
   *
   * @returns 活躍機會的 Map，key 為 symbol
   */
  getActiveOpportunities(): Map<string, ActiveOpportunityInfo>;

  /**
   * 取得特定交易對的活躍機會
   *
   * @param symbol 交易對符號
   * @returns 活躍機會資訊，如果不存在則返回 null
   */
  getActiveOpportunity(symbol: string): ActiveOpportunityInfo | null;

  /**
   * 動態更新閾值
   *
   * @param thresholds 新的閾值配置
   */
  updateThresholds(thresholds: Partial<Pick<OpportunityDetectorConfig, 'minimumThreshold' | 'warningThreshold' | 'criticalThreshold'>>): void;

  /**
   * 取得當前配置
   *
   * @returns 偵測器配置
   */
  getConfig(): OpportunityDetectorConfig;

  /**
   * 手動關閉特定機會
   *
   * @param symbol 交易對符號
   * @returns 是否成功關閉
   */
  closeOpportunity(symbol: string): boolean;

  /**
   * 清除所有活躍機會（用於測試或重置）
   */
  clearAllOpportunities(): void;
}

/**
 * 型別安全的 EventEmitter
 * 利用 TypeScript 泛型約束事件類型
 */
export interface TypedEventEmitter<T> {
  on<K extends keyof T>(event: K, listener: T[K] extends (...args: any[]) => any ? T[K] : never): this;
  emit<K extends keyof T>(event: K, ...args: T[K] extends (...args: infer P) => any ? P : never[]): boolean;
  off<K extends keyof T>(event: K, listener: T[K] extends (...args: any[]) => any ? T[K] : never): this;
  once<K extends keyof T>(event: K, listener: T[K] extends (...args: any[]) => any ? T[K] : never): this;
  removeAllListeners<K extends keyof T>(event?: K): this;
}

/**
 * 型別安全的機會偵測器介面
 * 結合 IOpportunityDetector 和 TypedEventEmitter
 */
export type TypedOpportunityDetector = IOpportunityDetector & TypedEventEmitter<OpportunityDetectorEvents>;
