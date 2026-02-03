/**
 * Trading Types
 *
 * 交易相關類型定義
 * Feature: 033-manual-open-position
 */

import { z } from 'zod';
import { Decimal } from 'decimal.js';
import { CloseReason } from '@/generated/prisma/client';

// ============================================================================
// Enums & Constants
// ============================================================================

export const SUPPORTED_EXCHANGES = ['binance', 'okx', 'mexc', 'gateio', 'bingx'] as const;
export type SupportedExchange = (typeof SUPPORTED_EXCHANGES)[number];

export const POSITION_STATUSES = [
  'PENDING',
  'OPENING',
  'OPEN',
  'CLOSING',
  'CLOSED',
  'FAILED',
  'PARTIAL',
] as const;
export type PositionStatus = (typeof POSITION_STATUSES)[number];

export const TRADE_SIDES = ['LONG', 'SHORT'] as const;
export type TradeSide = (typeof TRADE_SIDES)[number];

export const TRADE_ACTIONS = ['OPEN', 'CLOSE'] as const;
export type TradeAction = (typeof TRADE_ACTIONS)[number];

export const TRADE_STATUSES = ['PENDING', 'FILLED', 'FAILED'] as const;
export type TradeStatus = (typeof TRADE_STATUSES)[number];

export const LEVERAGE_OPTIONS = [1, 2] as const;
export type LeverageOption = (typeof LEVERAGE_OPTIONS)[number];

// ============================================================================
// Zod Schemas (Input Validation)
// ============================================================================

/**
 * 開倉請求驗證 schema
 * 注意：使用幣本位數量輸入（如 0.1 BTC）
 */
export const OpenPositionRequestSchema = z.object({
  symbol: z.string().min(1, '交易對不能為空'),
  longExchange: z.enum(SUPPORTED_EXCHANGES, { message: '不支援的做多交易所' }),
  shortExchange: z.enum(SUPPORTED_EXCHANGES, { message: '不支援的做空交易所' }),
  quantity: z.number().positive('數量必須大於 0'),
  leverage: z.union([z.literal(1), z.literal(2)]).default(1),
  // Feature 069: 分單開倉組別 ID
  groupId: z.string().uuid().optional(),
}).refine(
  (data) => data.longExchange !== data.shortExchange,
  { message: '做多和做空交易所不能相同' },
);

export type OpenPositionRequest = z.infer<typeof OpenPositionRequestSchema>;

/**
 * 餘額查詢請求 schema
 */
export const GetBalancesRequestSchema = z.object({
  exchanges: z.string().min(1, '交易所列表不能為空'),
});

export type GetBalancesRequest = z.infer<typeof GetBalancesRequestSchema>;

/**
 * 市場數據刷新請求 schema
 */
export const RefreshMarketDataRequestSchema = z.object({
  symbol: z.string().min(1, '交易對不能為空'),
  exchanges: z.array(z.enum(SUPPORTED_EXCHANGES)).min(1, '至少選擇一個交易所'),
});

export type RefreshMarketDataRequest = z.infer<typeof RefreshMarketDataRequestSchema>;

// ============================================================================
// API Types
// ============================================================================

/**
 * 開倉請求 (API)
 */
export interface OpenPositionApiRequest {
  symbol: string;
  longExchange: SupportedExchange;
  shortExchange: SupportedExchange;
  quantity: number;
  leverage: LeverageOption;
}

/**
 * 開倉回應
 */
export interface OpenPositionResponse {
  success: boolean;
  position: PositionInfo;
  trades: TradeInfo[];
  message: string;
}

/**
 * 持倉資訊
 */
export interface PositionInfo {
  id: string;
  userId: string;
  symbol: string;
  longExchange: SupportedExchange;
  shortExchange: SupportedExchange;
  leverage: number;
  status: PositionStatus;
  createdAt: string;
  updatedAt: string;
  trades?: TradeInfo[];
  // 停損停利資訊 (Feature 038)
  stopLossEnabled?: boolean;
  stopLossPercent?: number;
  takeProfitEnabled?: boolean;
  takeProfitPercent?: number;
  conditionalOrderStatus?: ConditionalOrderStatus;
  conditionalOrderError?: string | null;
  longStopLossPrice?: number | null;
  shortStopLossPrice?: number | null;
  longTakeProfitPrice?: number | null;
  shortTakeProfitPrice?: number | null;
  // 持倉組別 (Feature 069/070: 所有持倉必須有 groupId)
  groupId: string;
}

/**
 * 交易記錄資訊
 */
export interface TradeInfo {
  id: string;
  positionId: string;
  exchange: SupportedExchange;
  side: TradeSide;
  action: TradeAction;
  orderId: string | null;
  quantity: string;
  price: string;
  fee: string;
  status: TradeStatus;
  executedAt: string | null;
}

/**
 * 餘額資訊
 */
export interface BalanceInfo {
  exchange: SupportedExchange;
  available: number;  // 可用餘額（用於開倉驗證）
  total: number;      // 總權益（用於資產總覽）
  status: 'success' | 'error' | 'no_api_key' | 'api_error' | 'rate_limited';
  errorMessage?: string;
}

/**
 * 餘額回應
 */
export interface BalancesResponse {
  balances: BalanceInfo[];
}

/**
 * 市場數據回應
 */
export interface MarketDataResponse {
  symbol: string;
  exchanges: ExchangeMarketData[];
  updatedAt: string;
}

/**
 * 單一交易所的市場數據
 */
export interface ExchangeMarketData {
  exchange: SupportedExchange;
  price: number;
  fundingRate: number;
  nextFundingTime: string;
  status: 'success' | 'error';
  error?: string;
}

// ============================================================================
// Service Types
// ============================================================================

/**
 * 開倉參數 (內部使用)
 */
export interface OpenPositionParams {
  userId: string;
  symbol: string;
  longExchange: SupportedExchange;
  shortExchange: SupportedExchange;
  quantity: Decimal;
  leverage: LeverageOption;
  // 停損停利參數 (Feature 038)
  stopLossEnabled?: boolean;
  stopLossPercent?: number;
  takeProfitEnabled?: boolean;
  takeProfitPercent?: number;
  // 分單開倉組別 ID (Feature 069)
  groupId?: string;
}

/**
 * 執行開倉結果
 */
export interface ExecuteOpenResult {
  success: boolean;
  orderId?: string;
  price?: Decimal;
  quantity?: Decimal;
  fee?: Decimal;
  error?: Error;
}

/**
 * 雙邊開倉結果
 */
export interface BilateralOpenResult {
  longResult: ExecuteOpenResult;
  shortResult: ExecuteOpenResult;
}

/**
 * 回滾結果
 */
export interface RollbackResult {
  success: boolean;
  attempts: number;
  error?: Error;
  requiresManualIntervention: boolean;
}

/**
 * 餘額驗證選項
 */
export interface BalanceValidationOptions {
  /** 是否使用 WebSocket 快取餘額 */
  useCachedBalance?: boolean;
  /** 快取最大有效期（毫秒），預設 30000 */
  maxCacheAgeMs?: number;
}

/**
 * 餘額驗證結果
 */
export interface BalanceValidationResult {
  isValid: boolean;
  longExchangeBalance: number;
  shortExchangeBalance: number;
  requiredMarginLong: number;
  requiredMarginShort: number;
  insufficientExchange?: SupportedExchange;
  insufficientAmount?: number;
}

// ============================================================================
// WebSocket Event Types
// ============================================================================

/**
 * 開倉進度步驟
 */
export type OpenPositionStep =
  | 'validating'
  | 'executing_long'
  | 'executing_short'
  | 'completing'
  | 'rolling_back';

/**
 * 開倉進度事件
 */
export interface PositionProgressEvent {
  positionId: string;
  step: OpenPositionStep;
  progress: number; // 0-100
  message: string;
  exchange?: SupportedExchange;
}

/**
 * 開倉成功事件
 */
export interface PositionSuccessEvent {
  positionId: string;
  longTrade: {
    exchange: SupportedExchange;
    orderId: string;
    price: string;
    quantity: string;
    fee: string;
  };
  shortTrade: {
    exchange: SupportedExchange;
    orderId: string;
    price: string;
    quantity: string;
    fee: string;
  };
}

/**
 * 開倉失敗事件
 */
export interface PositionFailedEvent {
  positionId: string;
  error: string;
  errorCode: string;
  details?: {
    exchange?: SupportedExchange;
    rolledBack?: boolean;
    requiresManualIntervention?: boolean;
  };
}

/**
 * 回滾失敗事件
 */
export interface RollbackFailedEvent {
  positionId: string;
  exchange: SupportedExchange;
  orderId: string;
  side: TradeSide;
  quantity: string;
  message: string;
}

// ============================================================================
// Audit Log Types
// ============================================================================

export const AUDIT_ACTIONS = [
  'POSITION_OPEN_STARTED',
  'POSITION_OPEN_SUCCESS',
  'POSITION_OPEN_FAILED',
  'POSITION_ROLLBACK_STARTED',
  'POSITION_ROLLBACK_SUCCESS',
  'POSITION_ROLLBACK_FAILED',
  'POSITION_CLOSE_STARTED',
  'POSITION_CLOSE_SUCCESS',
  'POSITION_CLOSE_FAILED',
  'POSITION_CLOSE_PARTIAL',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/**
 * 審計日誌詳情
 */
export interface AuditLogDetails {
  positionId?: string;
  symbol?: string;
  longExchange?: SupportedExchange;
  shortExchange?: SupportedExchange;
  quantity?: string;
  leverage?: number;
  longOrderId?: string;
  shortOrderId?: string;
  longPrice?: string;
  shortPrice?: string;
  longFee?: string;
  shortFee?: string;
  errorCode?: string;
  errorMessage?: string;
  rollbackAttempts?: number;
  longExitPrice?: string;
  shortExitPrice?: string;
  priceDiffPnL?: string;
  fundingRatePnL?: string;
  totalPnL?: string;
  roi?: string;
  holdingDuration?: number;
  closedSide?: TradeSide;
  failedSide?: TradeSide;
  [key: string]: unknown;
}

// ============================================================================
// Close Position Types (Feature: 035-close-position)
// ============================================================================

/**
 * 平倉請求
 */
export interface ClosePositionRequest {
  positionId: string;
}

/**
 * 平倉響應
 */
export interface ClosePositionResponse {
  success: boolean;
  position: PositionInfo;
  trade?: TradePerformanceInfo;
  message: string;
}

/**
 * 部分平倉響應
 */
export interface PartialCloseResponse {
  success: false;
  error: 'PARTIAL_CLOSE';
  message: string;
  position: PositionInfo;
  partialClosed: {
    exchange: SupportedExchange;
    orderId: string;
    side: TradeSide;
    price: string;
    quantity: string;
    fee: string;
  };
  failedSide: {
    exchange: SupportedExchange;
    error: string;
    errorCode: string;
  };
}

/**
 * 平倉參數 (內部使用)
 */
export interface ClosePositionParams {
  userId: string;
  positionId: string;
  /** 可選：平倉原因（預設為 MANUAL） */
  closeReason?: CloseReason;
}

/**
 * 平倉執行結果
 */
export interface ExecuteCloseResult {
  success: boolean;
  orderId?: string;
  price?: Decimal;
  quantity?: Decimal;
  fee?: Decimal;
  error?: Error;
}

/**
 * 雙邊平倉結果
 */
export interface BilateralCloseResult {
  longResult: ExecuteCloseResult;
  shortResult: ExecuteCloseResult;
}

/**
 * 績效記錄資訊
 */
export interface TradePerformanceInfo {
  id: string;
  positionId: string;
  symbol: string;
  longExchange: string;
  shortExchange: string;
  longEntryPrice: string;
  longExitPrice: string;
  shortEntryPrice: string;
  shortExitPrice: string;
  longPositionSize: string;
  shortPositionSize: string;
  openedAt: string;
  closedAt: string;
  holdingDuration: number;
  priceDiffPnL: string;
  fundingRatePnL: string;
  totalPnL: string;
  roi: string;
  status: 'SUCCESS' | 'PARTIAL';
  createdAt: string;
}

/**
 * 持倉市場數據響應
 */
export interface PositionMarketDataResponse {
  success: boolean;
  data: {
    positionId: string;
    symbol: string;
    longExchange: {
      name: string;
      currentPrice: number;
      entryPrice: string;
      unrealizedPnL: number;
    };
    shortExchange: {
      name: string;
      currentPrice: number;
      entryPrice: string;
      unrealizedPnL: number;
    };
    estimatedPnL: {
      priceDiffPnL: number;
      fees: number;
      netPnL: number;
    };
    updatedAt: string;
  };
}

// ============================================================================
// Close Position WebSocket Event Types
// ============================================================================

/**
 * 平倉進度步驟
 */
export type ClosePositionStep =
  | 'validating'
  | 'closing_long'
  | 'closing_short'
  | 'calculating_pnl'
  | 'completing';

/**
 * 平倉進度事件
 */
export interface CloseProgressEvent {
  positionId: string;
  step: ClosePositionStep;
  progress: number;
  message: string;
  exchange?: SupportedExchange;
}

/**
 * 平倉成功事件
 */
export interface CloseSuccessEvent {
  positionId: string;
  trade: {
    id: string;
    priceDiffPnL: string;
    fundingRatePnL: string;
    totalPnL: string;
    roi: string;
    holdingDuration: number;
  };
  longClose: {
    exchange: SupportedExchange;
    orderId: string;
    price: string;
    quantity: string;
    fee: string;
  };
  shortClose: {
    exchange: SupportedExchange;
    orderId: string;
    price: string;
    quantity: string;
    fee: string;
  };
}

/**
 * 平倉失敗事件
 */
export interface CloseFailedEvent {
  positionId: string;
  error: string;
  errorCode: string;
  details?: {
    exchange?: SupportedExchange;
  };
}

/**
 * 部分平倉事件
 */
export interface ClosePartialEvent {
  positionId: string;
  message: string;
  closedSide: {
    exchange: SupportedExchange;
    side: TradeSide;
    orderId: string;
    price: string;
    quantity: string;
    fee: string;
  };
  failedSide: {
    exchange: SupportedExchange;
    side: TradeSide;
    error: string;
    errorCode: string;
  };
}

// ============================================================================
// Conditional Order Types (Feature 038: Stop Loss / Take Profit)
// ============================================================================

/**
 * 條件單狀態
 */
export const CONDITIONAL_ORDER_STATUSES = [
  'PENDING',
  'SETTING',
  'SET',
  'PARTIAL',
  'FAILED',
] as const;
export type ConditionalOrderStatus = (typeof CONDITIONAL_ORDER_STATUSES)[number];

/**
 * 停損停利百分比限制
 */
export const STOP_LOSS_PERCENT_MIN = 0.5;
export const STOP_LOSS_PERCENT_MAX = 50;
export const TAKE_PROFIT_PERCENT_MIN = 0.5;
export const TAKE_PROFIT_PERCENT_MAX = 100;

/**
 * 停損停利參數驗證 schema
 */
export const StopLossTakeProfitSchema = z.object({
  stopLossEnabled: z.boolean().default(false),
  stopLossPercent: z
    .number()
    .min(STOP_LOSS_PERCENT_MIN, `停損百分比最小為 ${STOP_LOSS_PERCENT_MIN}%`)
    .max(STOP_LOSS_PERCENT_MAX, `停損百分比最大為 ${STOP_LOSS_PERCENT_MAX}%`)
    .optional(),
  takeProfitEnabled: z.boolean().default(false),
  takeProfitPercent: z
    .number()
    .min(TAKE_PROFIT_PERCENT_MIN, `停利百分比最小為 ${TAKE_PROFIT_PERCENT_MIN}%`)
    .max(TAKE_PROFIT_PERCENT_MAX, `停利百分比最大為 ${TAKE_PROFIT_PERCENT_MAX}%`)
    .optional(),
}).refine(
  (data) => !data.stopLossEnabled || (data.stopLossEnabled && data.stopLossPercent !== undefined),
  { message: '啟用停損時必須設定停損百分比', path: ['stopLossPercent'] },
).refine(
  (data) => !data.takeProfitEnabled || (data.takeProfitEnabled && data.takeProfitPercent !== undefined),
  { message: '啟用停利時必須設定停利百分比', path: ['takeProfitPercent'] },
);

export type StopLossTakeProfitParams = z.infer<typeof StopLossTakeProfitSchema>;

/**
 * 條件單設定請求參數
 */
export interface ConditionalOrderParams {
  positionId: string;
  symbol: string;
  side: TradeSide;
  quantity: Decimal;
  entryPrice: Decimal;
  exchange: SupportedExchange;
  stopLossPercent?: number;
  takeProfitPercent?: number;
}

/**
 * 單一條件單設定結果
 */
export interface SingleConditionalOrderResult {
  success: boolean;
  orderId?: string;
  triggerPrice?: Decimal;
  error?: string;
}

/**
 * 條件單設定結果 (單一交易所)
 */
export interface ConditionalOrderResult {
  exchange: SupportedExchange;
  side: TradeSide;
  stopLoss?: SingleConditionalOrderResult;
  takeProfit?: SingleConditionalOrderResult;
}

/**
 * 雙邊條件單設定結果
 */
export interface BilateralConditionalOrderResult {
  longResult: ConditionalOrderResult;
  shortResult: ConditionalOrderResult;
  overallStatus: ConditionalOrderStatus;
  errors: string[];
}

/**
 * 交易設定
 */
export interface TradingSettings {
  defaultStopLossEnabled: boolean;
  defaultStopLossPercent: number;
  defaultTakeProfitEnabled: boolean;
  defaultTakeProfitPercent: number;
  defaultLeverage: number;
  maxPositionSizeUSD: number;
  // Feature 067: 平倉建議設定
  exitSuggestionEnabled: boolean;
  exitSuggestionThreshold: number;
  exitNotificationEnabled: boolean;
}

/**
 * 更新交易設定請求
 */
export const UpdateTradingSettingsSchema = z.object({
  defaultStopLossEnabled: z.boolean().optional(),
  defaultStopLossPercent: z
    .number()
    .min(STOP_LOSS_PERCENT_MIN)
    .max(STOP_LOSS_PERCENT_MAX)
    .optional(),
  defaultTakeProfitEnabled: z.boolean().optional(),
  defaultTakeProfitPercent: z
    .number()
    .min(TAKE_PROFIT_PERCENT_MIN)
    .max(TAKE_PROFIT_PERCENT_MAX)
    .optional(),
  defaultLeverage: z.number().int().min(1).max(125).optional(),
  maxPositionSizeUSD: z.number().min(100).optional(),
  // Feature 067: 平倉建議設定
  exitSuggestionEnabled: z.boolean().optional(),
  exitSuggestionThreshold: z.number().min(0).max(1000).optional(),
  exitNotificationEnabled: z.boolean().optional(),
});

export type UpdateTradingSettingsRequest = z.infer<typeof UpdateTradingSettingsSchema>;

// ============================================================================
// Conditional Order WebSocket Event Types
// ============================================================================

/**
 * 條件單進度步驟
 */
export type ConditionalOrderStep =
  | 'setting_long_stop_loss'
  | 'setting_long_take_profit'
  | 'setting_short_stop_loss'
  | 'setting_short_take_profit'
  | 'completing';

/**
 * 條件單進度事件
 */
export interface ConditionalOrderProgressEvent {
  positionId: string;
  step: ConditionalOrderStep;
  progress: number;
  message: string;
  exchange?: SupportedExchange;
}

/**
 * 條件單設定成功事件
 */
export interface ConditionalOrderSuccessEvent {
  positionId: string;
  stopLoss?: {
    longOrderId?: string;
    longTriggerPrice?: string;
    shortOrderId?: string;
    shortTriggerPrice?: string;
  };
  takeProfit?: {
    longOrderId?: string;
    longTriggerPrice?: string;
    shortOrderId?: string;
    shortTriggerPrice?: string;
  };
}

/**
 * 條件單設定部分成功事件
 */
export interface ConditionalOrderPartialEvent {
  positionId: string;
  message: string;
  succeeded: Array<{
    exchange: SupportedExchange;
    type: 'stopLoss' | 'takeProfit';
    orderId: string;
    triggerPrice: string;
  }>;
  failed: Array<{
    exchange: SupportedExchange;
    type: 'stopLoss' | 'takeProfit';
    error: string;
  }>;
}

/**
 * 條件單設定失敗事件
 */
export interface ConditionalOrderFailedEvent {
  positionId: string;
  error: string;
  details?: {
    exchange?: SupportedExchange;
    type?: 'stopLoss' | 'takeProfit';
  };
}

// ============================================================================
// Funding Fee Types (Feature: 041-funding-rate-pnl-display)
// ============================================================================

/**
 * 單筆資金費率結算記錄
 */
export interface FundingFeeEntry {
  timestamp: number; // 結算時間（毫秒）
  datetime: string; // ISO 8601 格式
  amount: Decimal; // 金額：正=收到，負=支付
  symbol: string; // 統一市場符號
  id: string; // 交易所記錄 ID
}

/**
 * 單邊資金費率查詢結果
 */
export interface FundingFeeQueryResult {
  exchange: SupportedExchange;
  symbol: string;
  startTime: Date;
  endTime: Date;
  entries: FundingFeeEntry[];
  totalAmount: Decimal;
  success: boolean;
  error?: string;
}

/**
 * 雙邊資金費率查詢結果
 */
export interface BilateralFundingFeeResult {
  longResult: FundingFeeQueryResult;
  shortResult: FundingFeeQueryResult;
  totalFundingFee: Decimal;
}

// ============================================================================
// Position Details Types (Feature: 045-position-details-view)
// ============================================================================

/**
 * 資金費率明細（用於前端顯示）
 */
export interface FundingFeeDetailsInfo {
  longEntries: Array<{
    timestamp: number;
    datetime: string;
    amount: string;
    symbol: string;
    id: string;
  }>;
  shortEntries: Array<{
    timestamp: number;
    datetime: string;
    amount: string;
    symbol: string;
    id: string;
  }>;
  longTotal: string;
  shortTotal: string;
  netTotal: string;
}

/**
 * 手續費資訊
 */
export interface FeeDetailsInfo {
  longOpenFee?: string;
  shortOpenFee?: string;
  totalFees?: string;
}

/**
 * 年化報酬率資訊
 */
export interface AnnualizedReturnInfo {
  value: number;          // 百分比
  totalPnL: number;       // 總損益
  margin: number;         // 保證金
  holdingHours: number;   // 持倉小時數
}

/**
 * 持倉詳情資訊（即時查詢結果）
 * Feature: 045-position-details-view
 */
export interface PositionDetailsInfo {
  positionId: string;
  symbol: string;

  // 開倉資訊 (from Position)
  longExchange: string;
  shortExchange: string;
  longEntryPrice: string;
  shortEntryPrice: string;
  longPositionSize: string;
  shortPositionSize: string;
  leverage: number;
  openedAt: string;

  // 當前價格 (from Exchange API)
  longCurrentPrice?: number;
  shortCurrentPrice?: number;
  priceQuerySuccess: boolean;
  priceQueryError?: string;

  // 未實現損益 (calculated)
  longUnrealizedPnL?: number;
  shortUnrealizedPnL?: number;
  totalUnrealizedPnL?: number;

  // 資金費率明細 (from Exchange API)
  fundingFees?: FundingFeeDetailsInfo;
  fundingFeeQuerySuccess: boolean;
  fundingFeeQueryError?: string;

  // 手續費資訊 (from Trade, SHOULD)
  fees?: FeeDetailsInfo;

  // 年化報酬率 (calculated)
  annualizedReturn?: AnnualizedReturnInfo;
  annualizedReturnError?: string;

  // Metadata
  queriedAt: string;
}

/**
 * 持倉詳情 API 回應
 */
export interface PositionDetailsResponse {
  success: boolean;
  data?: PositionDetailsInfo;
  error?: {
    code: string;
    message: string;
  };
}

// ============================================================================
// Refactored Trading Services Types (Feature: 062-refactor-trading-srp)
// ============================================================================

/**
 * Binance 帳戶資訊
 */
export interface BinanceAccountInfo {
  /** 是否為 Portfolio Margin 帳戶 */
  isPortfolioMargin: boolean;
  /** 是否為 Hedge Mode（雙向持倉模式） */
  isHedgeMode: boolean;
  /** 偵測是否失敗（使用預設值） */
  detectionFailed?: boolean;
}

// ============================================================================
// CCXT Exchange Types (類型安全定義)
// ============================================================================

/**
 * CCXT 訂單回應
 */
export interface CcxtOrder {
  id: string;
  status: string;
  average?: number;
  price?: number;
  filled?: number;
  amount?: number;
  cost?: number;
  fee?: {
    cost?: number;
    currency?: string;
  };
  info?: unknown;
  order?: string;
}

/**
 * CCXT 成交記錄
 */
export interface CcxtTrade {
  order?: string;
  price?: number;
  amount?: number;
}

/**
 * CCXT 市場資料
 */
export interface CcxtMarket {
  symbol: string;
  contractSize?: number;
  precision?: {
    amount?: number;
    price?: number;
  };
}

/**
 * CCXT 交易所基礎介面
 *
 * 定義所有交易所共用的方法
 */
export interface CcxtExchangeBase {
  /** 已載入的市場資料 */
  markets?: Record<string, CcxtMarket>;

  /** 載入市場資料 */
  loadMarkets(): Promise<Record<string, CcxtMarket>>;

  /** 建立市價單 */
  createMarketOrder(
    symbol: string,
    side: 'buy' | 'sell',
    amount: number,
    price?: number,
    params?: Record<string, unknown>
  ): Promise<CcxtOrder>;

  /** 查詢訂單 */
  fetchOrder(orderId: string, symbol: string): Promise<CcxtOrder>;

  /** 查詢我的成交記錄 */
  fetchMyTrades(symbol: string, since?: number, limit?: number): Promise<CcxtTrade[]>;
}

/**
 * Binance 標準合約帳戶 API
 */
export interface BinanceFuturesApi {
  fapiPrivateGetPositionSideDual(): Promise<{ dualSidePosition: boolean | string }>;
}

/**
 * Binance Portfolio Margin 帳戶 API
 */
export interface BinancePortfolioMarginApi {
  papiGetUmPositionSideDual(): Promise<{ dualSidePosition: boolean | string }>;
}

/**
 * Binance 交易所介面（包含特有 API）
 */
export interface CcxtBinanceExchange extends CcxtExchangeBase, Partial<BinanceFuturesApi>, Partial<BinancePortfolioMarginApi> {}

/**
 * 通用 CCXT 交易所介面
 */
export type CcxtExchange = CcxtExchangeBase & Partial<BinanceFuturesApi> & Partial<BinancePortfolioMarginApi>;

// ============================================================================
// Service Interfaces (服務介面)
// ============================================================================

/**
 * Binance 帳戶偵測器介面
 *
 * 負責偵測 Binance 帳戶類型（標準 vs Portfolio Margin）
 * 和持倉模式（One-way vs Hedge Mode）
 */
export interface IBinanceAccountDetector {
  /**
   * 偵測 Binance 帳戶類型和持倉模式
   *
   * @param ccxtExchange - CCXT 交易所實例
   * @returns 帳戶資訊（Portfolio Margin 和 Hedge Mode 狀態）
   * @throws 當 API 呼叫失敗時，回傳預設值（標準帳戶 + One-way Mode）
   */
  detect(ccxtExchange: CcxtExchange): Promise<BinanceAccountInfo>;
}

/**
 * 交易所配置
 */
export interface ExchangeConfig {
  /** API Key */
  apiKey: string;
  /** API Secret */
  apiSecret: string;
  /** Passphrase（OKX 專用） */
  passphrase?: string;
  /** 是否為測試網 */
  isTestnet: boolean;
}

/**
 * 交易所實例（包含 CCXT 實例和偵測結果）
 */
export interface ExchangeInstance {
  /** CCXT 交易所實例 */
  ccxt: CcxtExchange;
  /** 是否為 Portfolio Margin 帳戶（Binance 專用） */
  isPortfolioMargin: boolean;
  /** 是否為 Hedge Mode */
  isHedgeMode: boolean;
  /** 已載入的市場資料 */
  markets: Record<string, CcxtMarket>;
}

/**
 * CCXT 交易所工廠介面
 *
 * 負責創建和配置 CCXT 交易所實例，
 * 包含不同交易所的特殊設定處理
 */
export interface ICcxtExchangeFactory {
  /**
   * 創建交易所實例
   *
   * @param exchange - 交易所類型
   * @param config - 交易所配置
   * @returns 完整的交易所實例（含偵測結果和市場資料）
   */
  create(
    exchange: SupportedExchange,
    config: ExchangeConfig
  ): Promise<ExchangeInstance>;
}

/**
 * 合約數量轉換器介面
 *
 * 負責將用戶輸入的數量轉換為交易所的合約數量
 */
export interface IContractQuantityConverter {
  /**
   * 將數量轉換為合約數量
   *
   * @param ccxtExchange - CCXT 交易所實例
   * @param symbol - 交易對符號（如 'BTC/USDT:USDT'）
   * @param amount - 用戶輸入的數量
   * @returns 轉換後的合約數量
   * @throws 當 contractSize 為 0 或 undefined 時，使用 1 作為預設值
   */
  convert(
    ccxtExchange: CcxtExchange,
    symbol: string,
    amount: number
  ): number;
}

/**
 * 合約數量轉換純函數類型
 */
export type ContractQuantityConverterFn = (
  ccxtExchange: CcxtExchange,
  symbol: string,
  amount: number
) => number;

/**
 * Hedge Mode 配置
 */
export interface HedgeModeConfig {
  /** 是否為 Hedge Mode */
  enabled: boolean;
  /** 是否為 Portfolio Margin（Binance 專用） */
  isPortfolioMargin?: boolean;
}

/**
 * 訂單參數（不同交易所格式）
 *
 * 支援雙向持倉模式（Hedge Mode）和單向持倉模式（One-way Mode）：
 * - 雙向模式：positionSide = 'LONG' | 'SHORT', posSide = 'long' | 'short'
 * - 單向模式：positionSide = 'BOTH', posSide = 'net'
 */
export interface OrderParams {
  /** Binance/BingX positionSide 參數（雙向: LONG/SHORT, 單向: BOTH） */
  positionSide?: 'LONG' | 'SHORT' | 'BOTH';
  /** OKX posSide 參數（雙向: long/short, 單向: net） */
  posSide?: 'long' | 'short' | 'net';
  /** OKX tdMode 參數 */
  tdMode?: 'cross';
  /** reduceOnly 參數（單向模式平倉時使用） */
  reduceOnly?: boolean;
}

/**
 * 訂單參數建構器介面
 *
 * 負責根據交易所和持倉模式建構訂單參數
 */
export interface IOrderParamsBuilder {
  /**
   * 建構開倉參數
   *
   * @param exchange - 交易所類型
   * @param side - 買賣方向
   * @param hedgeMode - Hedge Mode 配置
   * @returns 訂單參數
   */
  buildOpenParams(
    exchange: SupportedExchange,
    side: 'buy' | 'sell',
    hedgeMode: HedgeModeConfig
  ): OrderParams;

  /**
   * 建構平倉參數
   *
   * @param exchange - 交易所類型
   * @param side - 買賣方向（與原始持倉相反）
   * @param hedgeMode - Hedge Mode 配置
   * @returns 訂單參數
   */
  buildCloseParams(
    exchange: SupportedExchange,
    side: 'buy' | 'sell',
    hedgeMode: HedgeModeConfig
  ): OrderParams;
}

/**
 * 價格獲取結果
 */
export interface FetchPriceResult {
  /** 成交價格 */
  price: number;
  /** 價格來源 */
  source: 'order' | 'fetchOrder' | 'fetchMyTrades';
}

/**
 * 訂單價格獲取器介面
 *
 * 負責獲取訂單成交價格，包含多層 fallback 機制：
 * 1. order.average || order.price
 * 2. fetchOrder API
 * 3. fetchMyTrades API
 */
export interface IOrderPriceFetcher {
  /**
   * 獲取訂單成交價格
   *
   * @param ccxtExchange - CCXT 交易所實例
   * @param orderId - 訂單 ID
   * @param symbol - 交易對符號
   * @param initialPrice - 初始價格（來自 order.average || order.price）
   * @returns 價格獲取結果（含來源）
   * @throws TradingError 當所有重試都失敗時拋出錯誤
   */
  fetch(
    ccxtExchange: CcxtExchange,
    orderId: string,
    symbol: string,
    initialPrice?: number
  ): Promise<FetchPriceResult>;
}

/**
 * 交易服務依賴注入容器
 *
 * 用於 PositionOrchestrator 和 PositionCloser 的依賴注入
 */
export interface TradingServiceDependencies {
  binanceAccountDetector: IBinanceAccountDetector;
  exchangeFactory: ICcxtExchangeFactory;
  quantityConverter: IContractQuantityConverter;
  paramsBuilder: IOrderParamsBuilder;
  priceFetcher: IOrderPriceFetcher;
}
