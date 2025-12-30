/**
 * WebSocket 事件類型定義
 * Feature 052: 交易所 WebSocket 即時數據訂閱
 */

import type { Decimal } from 'decimal.js';
import type { ExchangeName } from '@/connectors/types';

// =============================================================================
// 1. 交易所 → 系統（入站事件）
// =============================================================================

// -----------------------------------------------------------------------------
// 1.1 Binance 事件
// -----------------------------------------------------------------------------

/** Binance markPriceUpdate 事件 (資金費率) */
export interface BinanceMarkPriceUpdate {
  e: 'markPriceUpdate';
  E: number;              // Event time (ms)
  s: string;              // Symbol, e.g., 'BTCUSDT'
  p: string;              // Mark price
  i: string;              // Index price
  P: string;              // Estimated settle price
  r: string;              // Funding rate
  T: number;              // Next funding time (ms)
}

/** Binance ACCOUNT_UPDATE 事件 (持倉/餘額變更) */
export interface BinanceAccountUpdate {
  e: 'ACCOUNT_UPDATE';
  E: number;              // Event time (ms)
  T: number;              // Transaction time (ms)
  a: {
    m: string;            // Event reason: 'ORDER' | 'FUNDING_FEE' | 'DEPOSIT' | ...
    B: Array<{
      a: string;          // Asset
      wb: string;         // Wallet balance
      cw: string;         // Cross wallet balance
      bc: string;         // Balance change
    }>;
    P: Array<{
      s: string;          // Symbol
      pa: string;         // Position amount
      ep: string;         // Entry price
      cr: string;         // Accumulated realized
      up: string;         // Unrealized PnL
      ps: 'LONG' | 'SHORT' | 'BOTH';
      bep: string;        // Break-even price
    }>;
  };
}

/** Binance ORDER_TRADE_UPDATE 事件 (訂單狀態) */
export interface BinanceOrderTradeUpdate {
  e: 'ORDER_TRADE_UPDATE';
  E: number;              // Event time (ms)
  T: number;              // Transaction time (ms)
  o: {
    s: string;            // Symbol
    c: string;            // Client order ID
    S: 'BUY' | 'SELL';
    o: string;            // Order type: 'LIMIT' | 'MARKET' | 'STOP_MARKET' | 'TAKE_PROFIT_MARKET'
    x: string;            // Execution type: 'NEW' | 'TRADE' | 'CANCELED' | 'EXPIRED'
    X: string;            // Order status: 'NEW' | 'FILLED' | 'CANCELED' | ...
    i: number;            // Order ID
    l: string;            // Last filled quantity
    z: string;            // Cumulative filled quantity
    L: string;            // Last filled price
    ap: string;           // Average price
    sp: string;           // Stop price
    ps: 'LONG' | 'SHORT' | 'BOTH';
    rp: string;           // Realized profit
  };
}

/** Binance listenKey 到期事件 */
export interface BinanceListenKeyExpired {
  e: 'listenKeyExpired';
  E: number;              // Event time (ms)
}

/** Binance 用戶數據事件聯合類型 */
export type BinanceUserDataEvent =
  | BinanceAccountUpdate
  | BinanceOrderTradeUpdate
  | BinanceListenKeyExpired;

// -----------------------------------------------------------------------------
// 1.2 OKX 事件
// -----------------------------------------------------------------------------

/** OKX funding-rate 事件 */
export interface OkxFundingRateEvent {
  arg: {
    channel: 'funding-rate';
    instId: string;       // e.g., 'BTC-USDT-SWAP'
  };
  data: Array<{
    instId: string;
    fundingRate: string;
    fundingTime: string;  // Unix timestamp (ms)
    nextFundingRate: string;
    nextFundingTime: string;
  }>;
}

/** OKX positions 事件 */
export interface OkxPositionEvent {
  arg: {
    channel: 'positions';
    instType: 'SWAP';
  };
  data: Array<{
    posId: string;
    instId: string;
    posSide: 'long' | 'short' | 'net';
    pos: string;          // Position quantity
    avgPx: string;        // Average price
    markPx: string;
    lever: string;
    liquidPx: string;
    upl: string;          // Unrealized PnL
    uplRatio: string;
    mgnRatio: string;
    mmr: string;          // Maintenance margin
    imr: string;          // Initial margin
    cTime: string;        // Creation time
    uTime: string;        // Update time
    pTime: string;        // Position time
  }>;
}

/** OKX orders 事件 */
export interface OkxOrderEvent {
  arg: {
    channel: 'orders';
    instType: 'SWAP';
  };
  data: Array<{
    instId: string;
    ordId: string;
    clOrdId: string;
    px: string;
    sz: string;
    ordType: 'limit' | 'market' | 'trigger' | 'stop_loss' | 'take_profit';
    side: 'buy' | 'sell';
    posSide: 'long' | 'short' | 'net';
    state: 'live' | 'filled' | 'canceled' | 'partially_filled';
    fillSz: string;
    fillPx: string;
    pnl: string;
    fee: string;
    feeCcy: string;
    cTime: string;
    uTime: string;
  }>;
}

/** OKX account 事件 (餘額) */
export interface OkxAccountEvent {
  arg: {
    channel: 'account';
    ccy?: string;
  };
  data: Array<{
    uTime: string;
    totalEq: string;
    isoEq: string;
    adjEq: string;
    ordFroz: string;
    imr: string;
    mmr: string;
    notionalUsd: string;
    mgnRatio: string;
    details: Array<{
      ccy: string;
      eq: string;
      cashBal: string;
      uTime: string;
      isoEq: string;
      availEq: string;
      disEq: string;
      fixedBal: string;
      availBal: string;
      frozenBal: string;
      ordFrozen: string;
      liab: string;
      upl: string;
      uplLiab: string;
      crossLiab: string;
      isoLiab: string;
      mgnRatio: string;
      interest: string;
      twap: string;
      maxLoan: string;
      eqUsd: string;
      borrowFroz: string;
      notionalLever: string;
    }>;
  }>;
}

// -----------------------------------------------------------------------------
// 1.3 Gate.io 事件
// -----------------------------------------------------------------------------

/** Gate.io futures.tickers 事件 (資金費率) */
export interface GateioTickerEvent {
  time: number;
  channel: 'futures.tickers';
  event: 'update';
  result: {
    contract: string;       // e.g., 'BTC_USDT'
    last: string;
    mark_price: string;
    index_price: string;
    funding_rate: string;
    funding_rate_indicative: string;
    volume_24h: string;
    volume_24h_usd: string;
  };
}

/** Gate.io futures.positions 事件 */
export interface GateioPositionEvent {
  time: number;
  channel: 'futures.positions';
  event: 'update';
  result: Array<{
    contract: string;
    size: number;           // Position size (positive = long, negative = short)
    entry_price: string;
    mark_price: string;
    realised_pnl: string;
    unrealised_pnl: string;
    leverage: number;
    margin: string;
    liq_price: string;      // Liquidation price
    user: string;           // User ID
  }>;
}

/** Gate.io futures.orders 事件 */
export interface GateioOrderEvent {
  time: number;
  channel: 'futures.orders';
  event: 'update';
  result: Array<{
    id: number;
    contract: string;
    size: number;
    price: string;
    status: 'open' | 'finished';
    finish_as: 'filled' | 'cancelled' | 'liquidated' | 'ioc' | 'auto_deleveraged' | 'reduce_only';
    fill_price: string;
    left: number;           // Remaining size
    is_close: boolean;
    is_reduce_only: boolean;
    create_time: number;
    finish_time: number;
  }>;
}

// -----------------------------------------------------------------------------
// 1.4 BingX 事件 (GZIP 壓縮)
// -----------------------------------------------------------------------------

/** BingX ACCOUNT_UPDATE 事件 */
export interface BingxAccountUpdate {
  e: 'ACCOUNT_UPDATE';
  E: number;              // Event time (ms)
  a: {
    m: string;            // Event reason
    B: Array<{
      a: string;          // Asset
      wb: string;         // Wallet balance
      cw: string;         // Cross wallet balance
    }>;
    P: Array<{
      s: string;          // Symbol
      pa: string;         // Position amount
      ep: string;         // Entry price
      up: string;         // Unrealized PnL
      ps: 'LONG' | 'SHORT';
      mp: string;         // Mark price
    }>;
  };
}

/** BingX ORDER_TRADE_UPDATE 事件 */
export interface BingxOrderTradeUpdate {
  e: 'ORDER_TRADE_UPDATE';
  E: number;              // Event time (ms)
  o: {
    s: string;            // Symbol
    c: string;            // Client order ID
    S: 'BUY' | 'SELL';
    o: string;            // Order type
    X: string;            // Order status
    i: string;            // Order ID
    z: string;            // Filled quantity
    ap: string;           // Average price
    sp: string;           // Stop price (for conditional orders)
    rp: string;           // Realized profit
    ps: 'LONG' | 'SHORT';
  };
}

/** BingX 用戶數據事件聯合類型 */
export type BingxUserDataEvent =
  | BingxAccountUpdate
  | BingxOrderTradeUpdate;

// -----------------------------------------------------------------------------
// 1.5 MEXC 事件
// -----------------------------------------------------------------------------

/** MEXC 資金費率事件 (透過 CCXT watchFundingRate) */
export interface MexcFundingRateData {
  symbol: string;
  fundingRate: number;
  fundingTimestamp: number;
  fundingDatetime: string;
  nextFundingRate?: number;
  nextFundingTimestamp?: number;
  nextFundingDatetime?: string;
}

// =============================================================================
// 2. 系統 → 前端（出站事件）
// =============================================================================

/** 費率更新事件 */
export interface RatesUpdateEvent {
  type: 'rates:update';
  data: {
    rates: Array<{
      symbol: string;
      exchanges: Record<string, {
        rate: number;
        price: number | null;
        normalized: Record<string, number>;
        originalInterval: number;
      }>;
      bestPair: {
        longExchange: string;
        shortExchange: string;
        spread: number;
        spreadPercent: number;
        annualizedReturn: number;
        priceDiffPercent: number | null;
      } | null;
      status: 'opportunity' | 'approaching' | 'normal';
      timestamp: string;
    }>;
    timestamp: string;
  };
}

/** 觸發偵測事件 */
export interface TriggerDetectedEvent {
  type: 'position:trigger:detected';
  data: {
    positionId: string;
    symbol: string;
    triggerType: 'LONG_SL' | 'LONG_TP' | 'SHORT_SL' | 'SHORT_TP';
    exchange: string;
    triggerPrice: string;
    detectedAt: string;
    source: 'websocket' | 'rest';
  };
}

/** 平倉進度事件 */
export interface TriggerCloseProgressEvent {
  type: 'position:trigger:close:progress';
  data: {
    positionId: string;
    step: 'detecting' | 'closing_hedge' | 'completed' | 'failed';
    progress: number;       // 0-100
    message: string;
    details?: {
      hedgeLeg: {
        exchange: string;
        symbol: string;
        side: string;
      };
    };
  };
}

/** WebSocket 連線狀態事件 */
export interface WsConnectionStatusEvent {
  type: 'ws:connection:status';
  data: {
    exchange: string;
    channelType: 'public' | 'private';
    status: 'connected' | 'reconnecting' | 'disconnected' | 'fallback_rest';
    lastUpdate: string;
    error?: string;
  };
}

/** WebSocket 錯誤事件 */
export interface WsErrorEvent {
  type: 'ws:error';
  data: {
    exchange: string;
    channelType: 'public' | 'private';
    errorCode: string;
    errorMessage: string;
    recoverable: boolean;
    action: 'reconnecting' | 'fallback_rest' | 'manual_intervention';
    timestamp: string;
  };
}

/** WebSocket 認證錯誤事件 */
export interface WsAuthErrorEvent {
  type: 'ws:auth:error';
  data: {
    exchange: string;
    userId: string;
    errorCode: string;
    errorMessage: string;
    action: 'retry' | 'reauth' | 'check_api_key';
    timestamp: string;
  };
}

// =============================================================================
// 3. 內部事件（服務間通訊）
// =============================================================================

/** 資金費率接收事件 (內部) */
export interface FundingRateReceived {
  exchange: ExchangeName;
  symbol: string;
  fundingRate: Decimal;
  nextFundingTime: Date;
  markPrice?: Decimal;
  indexPrice?: Decimal;
  source: 'websocket' | 'rest';
  receivedAt: Date;
}

/** 持倉變更事件 (內部) */
export interface PositionChanged {
  exchange: ExchangeName;
  symbol: string;
  side: 'LONG' | 'SHORT';
  size: Decimal;
  entryPrice: Decimal;
  markPrice: Decimal;
  unrealizedPnl: Decimal;
  receivedAt: Date;
}

/** 訂單狀態變更事件 (內部) */
export interface OrderStatusChanged {
  exchange: ExchangeName;
  symbol: string;
  orderId: string;
  orderType: string;
  status: 'NEW' | 'FILLED' | 'CANCELED' | 'EXPIRED';
  side: 'BUY' | 'SELL';
  positionSide: 'LONG' | 'SHORT';
  filledQty: Decimal;
  avgPrice: Decimal;
  stopPrice?: Decimal;     // For conditional orders
  realizedPnl?: Decimal;
  receivedAt: Date;
}

/** 餘額變更事件 (內部) */
export interface BalanceChanged {
  exchange: ExchangeName;
  asset: string;
  walletBalance: Decimal;
  crossWalletBalance?: Decimal;
  balanceChange: Decimal;
  changeReason?: string;
  receivedAt: Date;
}

// =============================================================================
// 4. 類型工具
// =============================================================================

/** 所有入站事件類型 */
export type InboundWsEvent =
  | BinanceMarkPriceUpdate
  | BinanceUserDataEvent
  | OkxFundingRateEvent
  | OkxPositionEvent
  | OkxOrderEvent
  | OkxAccountEvent
  | GateioTickerEvent
  | GateioPositionEvent
  | GateioOrderEvent
  | BingxUserDataEvent
  | MexcFundingRateData;

/** 所有出站事件類型 */
export type OutboundWsEvent =
  | RatesUpdateEvent
  | TriggerDetectedEvent
  | TriggerCloseProgressEvent
  | WsConnectionStatusEvent
  | WsErrorEvent
  | WsAuthErrorEvent;

/** 所有內部事件類型 */
export type InternalWsEvent =
  | FundingRateReceived
  | PositionChanged
  | OrderStatusChanged
  | BalanceChanged;

/** WebSocket 訂閱類型 (擴展) */
export type WSSubscriptionTypeExtended =
  | 'fundingRate'     // 資金費率
  | 'position'        // 持倉更新
  | 'order'           // 訂單更新
  | 'balance'         // 餘額更新
  | 'ticker';         // 價格行情

/** WebSocket 訂閱配置 */
export interface WSSubscriptionConfig {
  type: WSSubscriptionTypeExtended;
  exchange: ExchangeName;
  symbols?: string[];           // 可選，公開頻道可訂閱全部
  callback: (data: InternalWsEvent) => void;
  onError?: (error: Error) => void;
  onReconnect?: () => void;
}
