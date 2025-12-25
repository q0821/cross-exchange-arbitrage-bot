/**
 * Trading Types
 *
 * 交易相關類型定義
 * Feature: 033-manual-open-position
 */

import { z } from 'zod';
import { Decimal } from 'decimal.js';

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
  longExchange: z.enum(SUPPORTED_EXCHANGES, { errorMap: () => ({ message: '不支援的做多交易所' }) }),
  shortExchange: z.enum(SUPPORTED_EXCHANGES, { errorMap: () => ({ message: '不支援的做空交易所' }) }),
  quantity: z.number().positive('數量必須大於 0'),
  leverage: z.union([z.literal(1), z.literal(2)]).default(1),
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
  available: number;
  total: number;
  status: 'success' | 'error';
  error?: string;
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
