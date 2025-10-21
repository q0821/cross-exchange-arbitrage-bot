/**
 * Service Contracts: 修正 OKX 資金費率與增強價格顯示
 *
 * 本檔案定義所有服務介面、事件和資料傳輸物件 (DTO)。
 * 作為內部 API 契約，確保各服務之間的型別安全。
 *
 * Feature: 004-fix-okx-add-price-display
 * Date: 2025-01-21
 */

import { EventEmitter } from 'events';
import { Decimal } from '@prisma/client/runtime/library';

// ============================================================================
// Core Data Types
// ============================================================================

/**
 * 交易所類型
 */
export type Exchange = 'binance' | 'okx';

/**
 * 價格數據來源類型
 */
export type PriceSource = 'websocket' | 'rest';

/**
 * 資金費率驗證狀態
 */
export type ValidationStatus = 'PASS' | 'FAIL' | 'ERROR' | 'N/A';

/**
 * 套利可行性
 */
export type ArbitrageFeasibility = 'VIABLE' | 'NOT_VIABLE' | 'HIGH_RISK';

/**
 * 風險等級
 */
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

// ============================================================================
// Data Transfer Objects (DTOs)
// ============================================================================

/**
 * 價格數據 DTO
 */
export interface PriceData {
  /** 唯一識別碼 */
  id: string;
  /** 更新時間 */
  timestamp: Date;
  /** 交易對符號（例如: BTCUSDT）*/
  symbol: string;
  /** 交易所 */
  exchange: Exchange;
  /** 最新成交價 */
  lastPrice: number;
  /** 最佳買入價 */
  bidPrice: number;
  /** 最佳賣出價 */
  askPrice: number;
  /** 24 小時成交量 (可選) */
  volume24h?: number;
  /** 數據來源 */
  source: PriceSource;
  /** 數據延遲（毫秒）(可選) */
  latencyMs?: number;
}

/**
 * 價格數據配對（Binance + OKX）
 */
export interface PriceDataPair {
  /** 交易對符號 */
  symbol: string;
  /** Binance 價格數據 */
  binance: PriceData;
  /** OKX 價格數據 */
  okx: PriceData;
  /** 價格價差（絕對值）*/
  priceSpread: number;
  /** 價格價差百分比 */
  priceSpreadPercent: number;
  /** 最新時間戳 */
  timestamp: Date;
}

/**
 * 資金費率驗證結果 DTO
 */
export interface FundingRateValidationResult {
  /** 交易對符號 */
  symbol: string;
  /** 驗證時間 */
  timestamp: Date;
  /** OKX Native API 費率 */
  okxRate: number;
  /** OKX 下期預測費率 (可選) */
  okxNextRate?: number;
  /** OKX 結算時間 (可選) */
  okxFundingTime?: Date;
  /** CCXT 費率 (可選) */
  ccxtRate?: number;
  /** CCXT 時間戳 (可選) */
  ccxtFundingTime?: Date;
  /** 差異百分比 */
  discrepancyPercent?: number;
  /** 驗證狀態 */
  validationStatus: ValidationStatus;
  /** 錯誤訊息 (可選) */
  errorMessage?: string;
}

/**
 * 套利評估配置
 */
export interface ArbitrageConfig {
  /** Maker 手續費率（預設 0.001 = 0.1%）*/
  makerFee: number;
  /** Taker 手續費率（預設 0.001 = 0.1%）*/
  takerFee: number;
  /** 極端價差閾值（預設 0.05 = 5%）*/
  extremeSpreadThreshold: number;
}

/**
 * 套利評估結果 DTO
 */
export interface ArbitrageAssessment {
  /** 交易對符號 */
  symbol: string;
  /** 評估時間 */
  timestamp: Date;

  // 輸入數據
  /** Binance 資金費率 */
  binanceFundingRate: number;
  /** OKX 資金費率 */
  okxFundingRate: number;
  /** Binance 中間價 */
  binancePrice: number;
  /** OKX 中間價 */
  okxPrice: number;

  // 計算結果
  /** 資金費率差異（絕對值）*/
  fundingRateSpread: number;
  /** 價格價差（絕對值）*/
  priceSpread: number;
  /** 總手續費 */
  totalFees: number;
  /** 淨收益（小數形式）*/
  netProfit: number;
  /** 淨收益百分比 */
  netProfitPercent: number;

  // 判斷結果
  /** 套利方向描述 */
  direction: string;
  /** 套利可行性 */
  feasibility: ArbitrageFeasibility;
  /** 風險等級 */
  riskLevel: RiskLevel;
  /** 是否檢測到極端價差 */
  extremeSpreadDetected: boolean;
  /** 警告訊息 (可選) */
  warningMessage?: string;
}

// ============================================================================
// Service Interfaces
// ============================================================================

/**
 * 價格監控服務介面
 *
 * 負責訂閱並管理即時價格數據（WebSocket + REST 備援）
 */
export interface IPriceMonitor extends EventEmitter {
  /**
   * 啟動價格監控
   * @param symbols 要監控的交易對列表
   */
  start(symbols: string[]): Promise<void>;

  /**
   * 停止價格監控
   */
  stop(): Promise<void>;

  /**
   * 獲取指定交易對的最新價格
   * @param symbol 交易對符號
   * @param exchange 交易所
   */
  getLatestPrice(symbol: string, exchange: Exchange): PriceData | null;

  /**
   * 獲取所有交易對的價格配對
   */
  getAllPricePairs(): PriceDataPair[];

  /**
   * 事件: 價格更新
   * @event price
   */
  on(event: 'price', listener: (data: PriceData) => void): this;

  /**
   * 事件: 價格數據延遲警告
   * @event priceDelay
   */
  on(event: 'priceDelay', listener: (data: { symbol: string; exchange: Exchange; delaySeconds: number }) => void): this;

  /**
   * 事件: 數據來源切換（WebSocket <-> REST）
   * @event sourceChanged
   */
  on(event: 'sourceChanged', listener: (data: { exchange: Exchange; newSource: PriceSource }) => void): this;

  /**
   * 事件: 錯誤
   * @event error
   */
  on(event: 'error', listener: (error: Error) => void): this;
}

/**
 * 資金費率驗證服務介面
 *
 * 負責雙重驗證 OKX 資金費率（OKX API + CCXT）並記錄結果
 */
export interface IFundingRateValidator {
  /**
   * 驗證指定交易對的資金費率
   * @param symbol 交易對符號（例如: BTC-USDT-SWAP）
   * @returns 驗證結果
   */
  validate(symbol: string): Promise<FundingRateValidationResult>;

  /**
   * 批量驗證多個交易對
   * @param symbols 交易對列表
   * @returns 驗證結果列表
   */
  validateBatch(symbols: string[]): Promise<FundingRateValidationResult[]>;

  /**
   * 查詢最近的驗證失敗記錄
   * @param limit 返回筆數上限
   * @returns 驗證失敗記錄
   */
  getRecentFailures(limit: number): Promise<FundingRateValidationResult[]>;

  /**
   * 計算指定交易對的驗證通過率
   * @param symbol 交易對符號
   * @param daysBack 回溯天數
   * @returns 通過率（0-100）
   */
  getPassRate(symbol: string, daysBack: number): Promise<number>;
}

/**
 * 套利評估服務介面
 *
 * 負責綜合資金費率和價格數據，計算套利淨收益並判斷可行性
 */
export interface IArbitrageAssessor {
  /**
   * 評估單一交易對的套利機會
   * @param symbol 交易對符號
   * @param binanceFundingRate Binance 資金費率
   * @param okxFundingRate OKX 資金費率
   * @param binancePrice Binance 價格
   * @param okxPrice OKX 價格
   * @returns 套利評估結果
   */
  assess(
    symbol: string,
    binanceFundingRate: number,
    okxFundingRate: number,
    binancePrice: number,
    okxPrice: number
  ): ArbitrageAssessment;

  /**
   * 批量評估多個交易對
   * @param pricePairs 價格配對列表
   * @param fundingRatePairs 資金費率配對列表
   * @returns 評估結果列表
   */
  assessBatch(
    pricePairs: PriceDataPair[],
    fundingRatePairs: Array<{
      symbol: string;
      binanceFundingRate: number;
      okxFundingRate: number;
    }>
  ): ArbitrageAssessment[];

  /**
   * 更新評估配置
   * @param config 新的配置
   */
  updateConfig(config: Partial<ArbitrageConfig>): void;

  /**
   * 獲取當前配置
   * @returns 當前配置
   */
  getConfig(): ArbitrageConfig;
}

/**
 * WebSocket 客戶端介面
 *
 * 負責管理 WebSocket 連線、訂閱和重連邏輯
 */
export interface IWebSocketClient extends EventEmitter {
  /**
   * 連接到 WebSocket 伺服器
   */
  connect(): Promise<void>;

  /**
   * 斷開連線
   */
  disconnect(): void;

  /**
   * 訂閱 ticker 資料流
   * @param symbols 交易對列表
   */
  subscribe(symbols: string[]): void;

  /**
   * 取消訂閱
   * @param symbols 交易對列表
   */
  unsubscribe(symbols: string[]): void;

  /**
   * 檢查連線狀態
   */
  isConnected(): boolean;

  /**
   * 事件: 連線成功
   * @event connected
   */
  on(event: 'connected', listener: () => void): this;

  /**
   * 事件: 連線斷開
   * @event disconnected
   */
  on(event: 'disconnected', listener: () => void): this;

  /**
   * 事件: 收到 ticker 數據
   * @event ticker
   */
  on(event: 'ticker', listener: (data: PriceData) => void): this;

  /**
   * 事件: 錯誤
   * @event error
   */
  on(event: 'error', listener: (error: Error) => void): this;
}

// ============================================================================
// Repository Interfaces
// ============================================================================

/**
 * 資金費率驗證記錄儲存介面
 */
export interface IFundingRateValidationRepository {
  /**
   * 建立驗證記錄
   * @param data 驗證結果
   */
  create(data: FundingRateValidationResult): Promise<void>;

  /**
   * 批量建立驗證記錄
   * @param dataList 驗證結果列表
   */
  createBatch(dataList: FundingRateValidationResult[]): Promise<void>;

  /**
   * 查詢指定時間範圍的驗證記錄
   * @param symbol 交易對符號
   * @param startTime 開始時間
   * @param endTime 結束時間
   */
  findByTimeRange(
    symbol: string,
    startTime: Date,
    endTime: Date
  ): Promise<FundingRateValidationResult[]>;

  /**
   * 查詢驗證失敗記錄
   * @param limit 返回筆數上限
   */
  findFailures(limit: number): Promise<FundingRateValidationResult[]>;

  /**
   * 計算驗證通過率
   * @param symbol 交易對符號
   * @param daysBack 回溯天數
   */
  calculatePassRate(symbol: string, daysBack: number): Promise<number>;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * 價格監控配置
 */
export interface PriceMonitorConfig {
  /** 是否啟用 WebSocket */
  enableWebSocket: boolean;
  /** WebSocket 重連最大嘗試次數 */
  maxReconnectAttempts: number;
  /** WebSocket 重連基礎延遲（毫秒）*/
  reconnectBaseDelay: number;
  /** WebSocket 重連最大延遲（毫秒）*/
  reconnectMaxDelay: number;
  /** REST 輪詢間隔（毫秒）*/
  restPollInterval: number;
  /** 價格數據過期時間（毫秒）*/
  priceStaleThreshold: number;
  /** 延遲警告閾值（毫秒）*/
  delayWarningThreshold: number;
}

/**
 * 資金費率驗證配置
 */
export interface FundingRateValidatorConfig {
  /** 可接受的差異百分比上限 */
  acceptableDiscrepancy: number;
  /** API 重試次數 */
  maxRetries: number;
  /** API 超時時間（毫秒）*/
  timeoutMs: number;
  /** 是否啟用 CCXT 備援 */
  enableCCXT: boolean;
}

// ============================================================================
// Event Payloads
// ============================================================================

/**
 * 價格更新事件 Payload
 */
export interface PriceUpdateEvent {
  price: PriceData;
  previousPrice?: PriceData;
  priceChange: number;
  priceChangePercent: number;
}

/**
 * 套利機會檢測事件 Payload
 */
export interface ArbitrageOpportunityEvent {
  assessment: ArbitrageAssessment;
  alertLevel: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
}

/**
 * 驗證失敗事件 Payload
 */
export interface ValidationFailureEvent {
  result: FundingRateValidationResult;
  severity: 'MINOR' | 'MAJOR' | 'CRITICAL';
  recommendedAction: string;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * API 錯誤類型
 */
export class APIError extends Error {
  constructor(
    message: string,
    public readonly exchange: Exchange,
    public readonly endpoint: string,
    public readonly statusCode?: number,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'APIError';
  }
}

/**
 * WebSocket 錯誤類型
 */
export class WebSocketError extends Error {
  constructor(
    message: string,
    public readonly exchange: Exchange,
    public readonly reconnectAttempt?: number,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'WebSocketError';
  }
}

/**
 * 驗證錯誤類型
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly symbol: string,
    public readonly validationResult: FundingRateValidationResult,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}
