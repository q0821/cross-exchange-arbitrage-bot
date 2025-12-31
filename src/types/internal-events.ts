/**
 * 內部事件類型定義 (服務間通訊)
 * Feature 052: 交易所 WebSocket 即時數據訂閱
 */

import type { Decimal } from 'decimal.js';
import type { ExchangeName } from '@/connectors/types';

/** 數據來源 */
export type DataSource = 'websocket' | 'rest';

/** 觸發類型 */
export type TriggerType = 'LONG_SL' | 'LONG_TP' | 'SHORT_SL' | 'SHORT_TP';

// =============================================================================
// 資金費率事件
// =============================================================================

/** 資金費率接收事件 */
export interface FundingRateReceived {
  /** 交易所 */
  exchange: ExchangeName;
  /** 交易對符號 */
  symbol: string;
  /** 資金費率（某些幣種可能沒有，如新上架） */
  fundingRate?: Decimal;
  /** 下次結算時間（某些幣種可能沒有） */
  nextFundingTime?: Date;
  /** 標記價格 */
  markPrice?: Decimal;
  /** 指數價格 */
  indexPrice?: Decimal;
  /** 資金費率間隔 (小時) */
  fundingInterval?: number;
  /** 數據來源 */
  source: DataSource;
  /** 接收時間 */
  receivedAt: Date;
}

/** 資金費率批次更新事件 */
export interface FundingRatesBatchReceived {
  /** 交易所 */
  exchange: ExchangeName;
  /** 資金費率列表 */
  rates: FundingRateReceived[];
  /** 數據來源 */
  source: DataSource;
  /** 接收時間 */
  receivedAt: Date;
}

// =============================================================================
// 持倉事件
// =============================================================================

/** 持倉變更事件 */
export interface PositionChanged {
  /** 交易所 */
  exchange: ExchangeName;
  /** 交易對符號 */
  symbol: string;
  /** 持倉方向 */
  side: 'LONG' | 'SHORT';
  /** 持倉數量 */
  size: Decimal;
  /** 入場價格 */
  entryPrice: Decimal;
  /** 標記價格 */
  markPrice: Decimal;
  /** 未實現損益 */
  unrealizedPnl: Decimal;
  /** 槓桿倍數 */
  leverage?: number;
  /** 強平價格 */
  liquidationPrice?: Decimal;
  /** 保證金 */
  margin?: Decimal;
  /** 數據來源 */
  source: DataSource;
  /** 接收時間 */
  receivedAt: Date;
}

/** 持倉關閉事件 */
export interface PositionClosed {
  /** 交易所 */
  exchange: ExchangeName;
  /** 交易對符號 */
  symbol: string;
  /** 持倉方向 */
  side: 'LONG' | 'SHORT';
  /** 關閉數量 */
  closedSize: Decimal;
  /** 入場價格 */
  entryPrice: Decimal;
  /** 出場價格 */
  exitPrice: Decimal;
  /** 實現損益 */
  realizedPnl: Decimal;
  /** 關閉原因 */
  reason: 'MANUAL' | 'TRIGGER' | 'LIQUIDATION';
  /** 數據來源 */
  source: DataSource;
  /** 接收時間 */
  receivedAt: Date;
}

// =============================================================================
// 訂單事件
// =============================================================================

/** 訂單狀態 */
export type OrderStatus = 'NEW' | 'FILLED' | 'PARTIALLY_FILLED' | 'CANCELED' | 'EXPIRED' | 'REJECTED';

/** 訂單狀態變更事件 */
export interface OrderStatusChanged {
  /** 交易所 */
  exchange: ExchangeName;
  /** 交易對符號 */
  symbol: string;
  /** 訂單 ID */
  orderId: string;
  /** 客戶端訂單 ID */
  clientOrderId?: string;
  /** 訂單類型 */
  orderType: string;
  /** 訂單狀態 */
  status: OrderStatus;
  /** 買賣方向 */
  side: 'BUY' | 'SELL';
  /** 持倉方向 */
  positionSide: 'LONG' | 'SHORT';
  /** 已成交數量 */
  filledQty: Decimal;
  /** 平均成交價格 */
  avgPrice: Decimal;
  /** 止損/止盈觸發價格 */
  stopPrice?: Decimal;
  /** 實現損益 */
  realizedPnl?: Decimal;
  /** 手續費 */
  fee?: Decimal;
  /** 手續費幣種 */
  feeCurrency?: string;
  /** 數據來源 */
  source: DataSource;
  /** 接收時間 */
  receivedAt: Date;
}

/** 條件單觸發事件 */
export interface ConditionalOrderTriggered {
  /** 交易所 */
  exchange: ExchangeName;
  /** 交易對符號 */
  symbol: string;
  /** 條件單 ID */
  orderId: string;
  /** 觸發類型 */
  triggerType: TriggerType;
  /** 觸發價格 */
  triggerPrice: Decimal;
  /** 訂單狀態 */
  status: 'TRIGGERED' | 'FILLED' | 'CANCELED';
  /** 數據來源 */
  source: DataSource;
  /** 接收時間 */
  receivedAt: Date;
}

// =============================================================================
// 餘額事件
// =============================================================================

/** 餘額變更事件 */
export interface BalanceChanged {
  /** 交易所 */
  exchange: ExchangeName;
  /** 資產 */
  asset: string;
  /** 錢包餘額 */
  walletBalance: Decimal;
  /** 全倉錢包餘額 */
  crossWalletBalance?: Decimal;
  /** 可用餘額 */
  availableBalance?: Decimal;
  /** 餘額變更量 */
  balanceChange: Decimal;
  /** 變更原因 */
  changeReason?: BalanceChangeReason;
  /** 數據來源 */
  source: DataSource;
  /** 接收時間 */
  receivedAt: Date;
}

/** 餘額變更原因 */
export type BalanceChangeReason =
  | 'ORDER'           // 訂單成交
  | 'FUNDING_FEE'     // 資金費用
  | 'DEPOSIT'         // 充值
  | 'WITHDRAW'        // 提現
  | 'TRANSFER'        // 劃轉
  | 'FEE'             // 手續費
  | 'REALIZED_PNL'    // 實現損益
  | 'UNKNOWN';        // 未知

/** 帳戶餘額快照事件 */
export interface AccountBalanceSnapshot {
  /** 交易所 */
  exchange: ExchangeName;
  /** 總權益 (USD) */
  totalEquityUSD: Decimal;
  /** 可用餘額 (USD) */
  availableBalanceUSD: Decimal;
  /** 已用保證金 (USD) */
  usedMarginUSD: Decimal;
  /** 各資產餘額 */
  balances: Array<{
    asset: string;
    free: Decimal;
    locked: Decimal;
    total: Decimal;
  }>;
  /** 數據來源 */
  source: DataSource;
  /** 接收時間 */
  receivedAt: Date;
}

// =============================================================================
// 觸發偵測事件
// =============================================================================

/** 觸發偵測事件 */
export interface TriggerDetected {
  /** 持倉 ID (資料庫) */
  positionId: string;
  /** 交易所 */
  exchange: ExchangeName;
  /** 交易對符號 */
  symbol: string;
  /** 觸發類型 */
  triggerType: TriggerType;
  /** 觸發價格 */
  triggerPrice: Decimal;
  /** 當前標記價格 */
  currentMarkPrice: Decimal;
  /** 偵測時間 */
  detectedAt: Date;
  /** 數據來源 */
  source: DataSource;
}

/** 觸發平倉進度事件 */
export interface TriggerCloseProgress {
  /** 持倉 ID */
  positionId: string;
  /** 進度步驟 */
  step: 'detecting' | 'closing_triggered_leg' | 'closing_hedge_leg' | 'completed' | 'failed';
  /** 進度百分比 (0-100) */
  progress: number;
  /** 訊息 */
  message: string;
  /** 詳細資訊 */
  details?: {
    triggeredLeg?: {
      exchange: ExchangeName;
      symbol: string;
      side: string;
      status: string;
    };
    hedgeLeg?: {
      exchange: ExchangeName;
      symbol: string;
      side: string;
      status: string;
    };
    error?: string;
  };
  /** 時間戳 */
  timestamp: Date;
}

// =============================================================================
// 聯合類型
// =============================================================================

/** 所有內部事件類型 */
export type InternalEvent =
  | FundingRateReceived
  | FundingRatesBatchReceived
  | PositionChanged
  | PositionClosed
  | OrderStatusChanged
  | ConditionalOrderTriggered
  | BalanceChanged
  | AccountBalanceSnapshot
  | TriggerDetected
  | TriggerCloseProgress;

/** 內部事件處理器 */
export type InternalEventHandler<T extends InternalEvent = InternalEvent> = (event: T) => void | Promise<void>;

// =============================================================================
// 工具函式
// =============================================================================

/** 建立 FundingRateReceived 事件 */
export function createFundingRateReceived(
  exchange: ExchangeName,
  symbol: string,
  fundingRate: Decimal,
  nextFundingTime: Date,
  source: DataSource,
  options?: Partial<Omit<FundingRateReceived, 'exchange' | 'symbol' | 'fundingRate' | 'nextFundingTime' | 'source' | 'receivedAt'>>
): FundingRateReceived {
  return {
    exchange,
    symbol,
    fundingRate,
    nextFundingTime,
    source,
    receivedAt: new Date(),
    ...options,
  };
}

/** 建立 PositionChanged 事件 */
export function createPositionChanged(
  exchange: ExchangeName,
  symbol: string,
  side: 'LONG' | 'SHORT',
  size: Decimal,
  entryPrice: Decimal,
  markPrice: Decimal,
  unrealizedPnl: Decimal,
  source: DataSource,
  options?: Partial<Omit<PositionChanged, 'exchange' | 'symbol' | 'side' | 'size' | 'entryPrice' | 'markPrice' | 'unrealizedPnl' | 'source' | 'receivedAt'>>
): PositionChanged {
  return {
    exchange,
    symbol,
    side,
    size,
    entryPrice,
    markPrice,
    unrealizedPnl,
    source,
    receivedAt: new Date(),
    ...options,
  };
}

/** 建立 BalanceChanged 事件 */
export function createBalanceChanged(
  exchange: ExchangeName,
  asset: string,
  walletBalance: Decimal,
  balanceChange: Decimal,
  source: DataSource,
  options?: Partial<Omit<BalanceChanged, 'exchange' | 'asset' | 'walletBalance' | 'balanceChange' | 'source' | 'receivedAt'>>
): BalanceChanged {
  return {
    exchange,
    asset,
    walletBalance,
    balanceChange,
    source,
    receivedAt: new Date(),
    ...options,
  };
}

/** 建立 TriggerDetected 事件 */
export function createTriggerDetected(
  positionId: string,
  exchange: ExchangeName,
  symbol: string,
  triggerType: TriggerType,
  triggerPrice: Decimal,
  currentMarkPrice: Decimal,
  source: DataSource
): TriggerDetected {
  return {
    positionId,
    exchange,
    symbol,
    triggerType,
    triggerPrice,
    currentMarkPrice,
    detectedAt: new Date(),
    source,
  };
}
