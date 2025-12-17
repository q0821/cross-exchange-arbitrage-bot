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

export const SUPPORTED_EXCHANGES = ['binance', 'okx', 'mexc', 'gateio'] as const;
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
