/**
 * WebSocket 訊息 Zod Schema 驗證
 * Feature 052: 交易所 WebSocket 即時數據訂閱
 */

import { z } from 'zod';

// =============================================================================
// 1. Binance Schemas
// =============================================================================

/** Binance markPriceUpdate schema */
export const BinanceMarkPriceUpdateSchema = z.object({
  e: z.literal('markPriceUpdate'),
  E: z.number(),              // Event time (ms)
  s: z.string(),              // Symbol
  p: z.string(),              // Mark price
  i: z.string(),              // Index price
  P: z.string(),              // Estimated settle price
  r: z.string(),              // Funding rate
  T: z.number(),              // Next funding time (ms)
});

/** Binance ACCOUNT_UPDATE balance item schema */
const BinanceBalanceItemSchema = z.object({
  a: z.string(),              // Asset
  wb: z.string(),             // Wallet balance
  cw: z.string(),             // Cross wallet balance
  bc: z.string(),             // Balance change
});

/** Binance ACCOUNT_UPDATE position item schema */
const BinancePositionItemSchema = z.object({
  s: z.string(),              // Symbol
  pa: z.string(),             // Position amount
  ep: z.string(),             // Entry price
  cr: z.string(),             // Accumulated realized
  up: z.string(),             // Unrealized PnL
  ps: z.enum(['LONG', 'SHORT', 'BOTH']),
  bep: z.string(),            // Break-even price
});

/** Binance ACCOUNT_UPDATE schema */
export const BinanceAccountUpdateSchema = z.object({
  e: z.literal('ACCOUNT_UPDATE'),
  E: z.number(),              // Event time (ms)
  T: z.number(),              // Transaction time (ms)
  a: z.object({
    m: z.string(),            // Event reason
    B: z.array(BinanceBalanceItemSchema),
    P: z.array(BinancePositionItemSchema),
  }),
});

/** Binance ORDER_TRADE_UPDATE order info schema */
const BinanceOrderInfoSchema = z.object({
  s: z.string(),              // Symbol
  c: z.string(),              // Client order ID
  S: z.enum(['BUY', 'SELL']),
  o: z.string(),              // Order type
  x: z.string(),              // Execution type
  X: z.string(),              // Order status
  i: z.number(),              // Order ID
  l: z.string(),              // Last filled quantity
  z: z.string(),              // Cumulative filled quantity
  L: z.string(),              // Last filled price
  ap: z.string(),             // Average price
  sp: z.string(),             // Stop price
  ps: z.enum(['LONG', 'SHORT', 'BOTH']),
  rp: z.string(),             // Realized profit
});

/** Binance ORDER_TRADE_UPDATE schema */
export const BinanceOrderTradeUpdateSchema = z.object({
  e: z.literal('ORDER_TRADE_UPDATE'),
  E: z.number(),              // Event time (ms)
  T: z.number(),              // Transaction time (ms)
  o: BinanceOrderInfoSchema,
});

/** Binance listenKeyExpired schema */
export const BinanceListenKeyExpiredSchema = z.object({
  e: z.literal('listenKeyExpired'),
  E: z.number(),              // Event time (ms)
});

/** Binance User Data Event union schema */
export const BinanceUserDataEventSchema = z.discriminatedUnion('e', [
  BinanceAccountUpdateSchema,
  BinanceOrderTradeUpdateSchema,
  BinanceListenKeyExpiredSchema,
]);

// =============================================================================
// 2. OKX Schemas
// =============================================================================

/** OKX funding-rate data item schema */
const OkxFundingRateDataItemSchema = z.object({
  instId: z.string(),
  fundingRate: z.string(),
  fundingTime: z.string(),
  nextFundingRate: z.string(),
  nextFundingTime: z.string(),
});

/** OKX funding-rate event schema */
export const OkxFundingRateEventSchema = z.object({
  arg: z.object({
    channel: z.literal('funding-rate'),
    instId: z.string(),
  }),
  data: z.array(OkxFundingRateDataItemSchema),
});

/** OKX mark-price data item schema */
const OkxMarkPriceDataItemSchema = z.object({
  instId: z.string(),
  markPx: z.string(),
  ts: z.string(),
});

/** OKX mark-price event schema */
export const OkxMarkPriceEventSchema = z.object({
  arg: z.object({
    channel: z.literal('mark-price'),
    instId: z.string(),
  }),
  data: z.array(OkxMarkPriceDataItemSchema),
});

/** OKX position data item schema */
const OkxPositionDataItemSchema = z.object({
  posId: z.string(),
  instId: z.string(),
  posSide: z.enum(['long', 'short', 'net']),
  pos: z.string(),
  avgPx: z.string(),
  markPx: z.string(),
  lever: z.string(),
  liquidPx: z.string(),
  upl: z.string(),
  uplRatio: z.string(),
  mgnRatio: z.string(),
  mmr: z.string(),
  imr: z.string(),
  cTime: z.string().optional(),
  uTime: z.string().optional(),
  pTime: z.string().optional(),
});

/** OKX positions event schema */
export const OkxPositionEventSchema = z.object({
  arg: z.object({
    channel: z.literal('positions'),
    instType: z.literal('SWAP'),
  }),
  data: z.array(OkxPositionDataItemSchema),
});

/** OKX order data item schema */
const OkxOrderDataItemSchema = z.object({
  instId: z.string(),
  ordId: z.string(),
  clOrdId: z.string(),
  px: z.string(),
  sz: z.string(),
  ordType: z.enum(['limit', 'market', 'trigger', 'stop_loss', 'take_profit']),
  side: z.enum(['buy', 'sell']),
  posSide: z.enum(['long', 'short', 'net']),
  state: z.enum(['live', 'filled', 'canceled', 'partially_filled']),
  fillSz: z.string(),
  fillPx: z.string(),
  pnl: z.string(),
  fee: z.string(),
  feeCcy: z.string(),
  cTime: z.string(),
  uTime: z.string(),
});

/** OKX orders event schema */
export const OkxOrderEventSchema = z.object({
  arg: z.object({
    channel: z.literal('orders'),
    instType: z.literal('SWAP'),
  }),
  data: z.array(OkxOrderDataItemSchema),
});

/** OKX account detail item schema */
const OkxAccountDetailItemSchema = z.object({
  ccy: z.string(),
  eq: z.string(),
  cashBal: z.string(),
  uTime: z.string(),
  isoEq: z.string(),
  availEq: z.string(),
  disEq: z.string(),
  fixedBal: z.string().optional(),
  availBal: z.string(),
  frozenBal: z.string(),
  ordFrozen: z.string(),
  liab: z.string().optional(),
  upl: z.string(),
  uplLiab: z.string().optional(),
  crossLiab: z.string().optional(),
  isoLiab: z.string().optional(),
  mgnRatio: z.string(),
  interest: z.string().optional(),
  twap: z.string().optional(),
  maxLoan: z.string().optional(),
  eqUsd: z.string(),
  borrowFroz: z.string().optional(),
  notionalLever: z.string().optional(),
});

/** OKX account data item schema */
const OkxAccountDataItemSchema = z.object({
  uTime: z.string(),
  totalEq: z.string(),
  isoEq: z.string().optional(),
  adjEq: z.string().optional(),
  ordFroz: z.string().optional(),
  imr: z.string().optional(),
  mmr: z.string().optional(),
  notionalUsd: z.string().optional(),
  mgnRatio: z.string().optional(),
  details: z.array(OkxAccountDetailItemSchema),
});

/** OKX account event schema */
export const OkxAccountEventSchema = z.object({
  arg: z.object({
    channel: z.literal('account'),
    ccy: z.string().optional(),
  }),
  data: z.array(OkxAccountDataItemSchema),
});

// =============================================================================
// 3. Gate.io Schemas
// =============================================================================

/** Gate.io futures.tickers result schema */
const GateioTickerResultSchema = z.object({
  contract: z.string(),
  last: z.string(),
  mark_price: z.string(),
  index_price: z.string(),
  funding_rate: z.string(),
  funding_rate_indicative: z.string(),
  volume_24h: z.string(),
  volume_24h_usd: z.string(),
});

/** Gate.io futures.tickers event schema (result 為陣列) */
export const GateioTickerEventSchema = z.object({
  time: z.number(),
  channel: z.literal('futures.tickers'),
  event: z.literal('update'),
  result: z.array(GateioTickerResultSchema),
});

/** Gate.io futures.positions result item schema */
const GateioPositionResultItemSchema = z.object({
  contract: z.string(),
  size: z.number(),
  entry_price: z.string(),
  mark_price: z.string(),
  realised_pnl: z.string(),
  unrealised_pnl: z.string(),
  leverage: z.number(),
  margin: z.string(),
  liq_price: z.string(),
  user: z.string(),
});

/** Gate.io futures.positions event schema */
export const GateioPositionEventSchema = z.object({
  time: z.number(),
  channel: z.literal('futures.positions'),
  event: z.literal('update'),
  result: z.array(GateioPositionResultItemSchema),
});

/** Gate.io futures.orders result item schema */
const GateioOrderResultItemSchema = z.object({
  id: z.number(),
  contract: z.string(),
  size: z.number(),
  price: z.string(),
  status: z.enum(['open', 'finished']),
  finish_as: z.enum(['filled', 'cancelled', 'liquidated', 'ioc', 'auto_deleveraged', 'reduce_only']).optional(),
  fill_price: z.string(),
  left: z.number(),
  is_close: z.boolean(),
  is_reduce_only: z.boolean(),
  create_time: z.number(),
  finish_time: z.number().optional(),
});

/** Gate.io futures.orders event schema */
export const GateioOrderEventSchema = z.object({
  time: z.number(),
  channel: z.literal('futures.orders'),
  event: z.literal('update'),
  result: z.array(GateioOrderResultItemSchema),
});

// =============================================================================
// 4. BingX Schemas (GZIP 壓縮後解析)
// =============================================================================

/** BingX markPrice data item schema (公開頻道) */
const BingxMarkPriceDataSchema = z.object({
  e: z.literal('markPriceUpdate'),
  E: z.number(),
  s: z.string(),
  p: z.string(),
  r: z.string().optional(),   // 資金費率（某些幣種可能沒有）
  T: z.number().optional(),   // 下次結算時間（某些幣種可能沒有）
});

/** BingX markPrice event schema (公開頻道) */
export const BingxMarkPriceEventSchema = z.object({
  code: z.number(),
  data: BingxMarkPriceDataSchema,
});

/** BingX balance item schema */
const BingxBalanceItemSchema = z.object({
  a: z.string(),              // Asset
  wb: z.string(),             // Wallet balance
  cw: z.string(),             // Cross wallet balance
});

/** BingX position item schema */
const BingxPositionItemSchema = z.object({
  s: z.string(),              // Symbol
  pa: z.string(),             // Position amount
  ep: z.string(),             // Entry price
  up: z.string(),             // Unrealized PnL
  ps: z.enum(['LONG', 'SHORT']),
  mp: z.string(),             // Mark price
});

/** BingX ACCOUNT_UPDATE schema */
export const BingxAccountUpdateSchema = z.object({
  e: z.literal('ACCOUNT_UPDATE'),
  E: z.number(),
  a: z.object({
    m: z.string(),
    B: z.array(BingxBalanceItemSchema),
    P: z.array(BingxPositionItemSchema),
  }),
});

/** BingX order info schema */
const BingxOrderInfoSchema = z.object({
  s: z.string(),              // Symbol
  c: z.string(),              // Client order ID
  S: z.enum(['BUY', 'SELL']),
  o: z.string(),              // Order type
  X: z.string(),              // Order status
  i: z.string(),              // Order ID
  z: z.string(),              // Filled quantity
  ap: z.string(),             // Average price
  sp: z.string(),             // Stop price
  rp: z.string(),             // Realized profit
  ps: z.enum(['LONG', 'SHORT']),
});

/** BingX ORDER_TRADE_UPDATE schema */
export const BingxOrderTradeUpdateSchema = z.object({
  e: z.literal('ORDER_TRADE_UPDATE'),
  E: z.number(),
  o: BingxOrderInfoSchema,
});

/** BingX User Data Event union schema */
export const BingxUserDataEventSchema = z.discriminatedUnion('e', [
  BingxAccountUpdateSchema,
  BingxOrderTradeUpdateSchema,
]);

// =============================================================================
// 5. MEXC Schemas (透過 CCXT)
// =============================================================================

/** MEXC funding rate data schema (CCXT format) */
export const MexcFundingRateDataSchema = z.object({
  symbol: z.string(),
  fundingRate: z.number(),
  fundingTimestamp: z.number(),
  fundingDatetime: z.string(),
  nextFundingRate: z.number().optional(),
  nextFundingTimestamp: z.number().optional(),
  nextFundingDatetime: z.string().optional(),
});

// =============================================================================
// 6. CCXT Generic Schemas
// =============================================================================

/** CCXT FundingRate schema (from watchFundingRate) */
export const CcxtFundingRateSchema = z.object({
  info: z.unknown(),
  symbol: z.string(),
  markPrice: z.number().optional(),
  indexPrice: z.number().optional(),
  interestRate: z.number().optional(),
  estimatedSettlePrice: z.number().optional(),
  timestamp: z.number().optional(),
  datetime: z.string().optional(),
  fundingRate: z.number(),
  fundingTimestamp: z.number().optional(),
  fundingDatetime: z.string().optional(),
  nextFundingRate: z.number().optional(),
  nextFundingTimestamp: z.number().optional(),
  nextFundingDatetime: z.string().optional(),
  previousFundingRate: z.number().optional(),
  previousFundingTimestamp: z.number().optional(),
  previousFundingDatetime: z.string().optional(),
});

/** CCXT Position schema (from watchPositions) */
export const CcxtPositionSchema = z.object({
  info: z.unknown(),
  id: z.string().optional(),
  symbol: z.string(),
  timestamp: z.number().optional(),
  datetime: z.string().optional(),
  isolated: z.boolean().optional(),
  hedged: z.boolean().optional(),
  side: z.enum(['long', 'short']),
  contracts: z.number().optional(),
  contractSize: z.number().optional(),
  entryPrice: z.number().optional(),
  markPrice: z.number().optional(),
  notional: z.number().optional(),
  leverage: z.number().optional(),
  collateral: z.number().optional(),
  initialMargin: z.number().optional(),
  maintenanceMargin: z.number().optional(),
  initialMarginPercentage: z.number().optional(),
  maintenanceMarginPercentage: z.number().optional(),
  unrealizedPnl: z.number().optional(),
  liquidationPrice: z.number().optional(),
  marginMode: z.enum(['cross', 'isolated']).optional(),
  percentage: z.number().optional(),
});

/** CCXT Balance schema (from watchBalance) */
export const CcxtBalanceSchema = z.object({
  info: z.unknown(),
  timestamp: z.number().optional(),
  datetime: z.string().optional(),
  free: z.record(z.string(), z.number()).optional(),
  used: z.record(z.string(), z.number()).optional(),
  total: z.record(z.string(), z.number()).optional(),
});

/** CCXT Order schema (from watchOrders) */
export const CcxtOrderSchema = z.object({
  info: z.unknown(),
  id: z.string(),
  clientOrderId: z.string().optional(),
  datetime: z.string().optional(),
  timestamp: z.number().optional(),
  lastTradeTimestamp: z.number().optional(),
  status: z.enum(['open', 'closed', 'canceled', 'expired', 'rejected']),
  symbol: z.string(),
  type: z.string(),
  timeInForce: z.string().optional(),
  postOnly: z.boolean().optional(),
  reduceOnly: z.boolean().optional(),
  side: z.enum(['buy', 'sell']),
  price: z.number().optional(),
  stopPrice: z.number().optional(),
  triggerPrice: z.number().optional(),
  amount: z.number().optional(),
  cost: z.number().optional(),
  average: z.number().optional(),
  filled: z.number().optional(),
  remaining: z.number().optional(),
  fee: z.object({
    cost: z.number(),
    currency: z.string(),
    rate: z.number().optional(),
  }).optional(),
  trades: z.array(z.unknown()).optional(),
});

// =============================================================================
// 7. 驗證函式
// =============================================================================

/** 安全解析 Binance markPriceUpdate */
export function parseBinanceMarkPriceUpdate(data: unknown) {
  return BinanceMarkPriceUpdateSchema.safeParse(data);
}

/** 安全解析 Binance User Data Event */
export function parseBinanceUserDataEvent(data: unknown) {
  return BinanceUserDataEventSchema.safeParse(data);
}

/** 安全解析 OKX funding-rate event */
export function parseOkxFundingRateEvent(data: unknown) {
  return OkxFundingRateEventSchema.safeParse(data);
}

/** 安全解析 OKX mark-price event */
export function parseOkxMarkPriceEvent(data: unknown) {
  return OkxMarkPriceEventSchema.safeParse(data);
}

/** 安全解析 OKX position event */
export function parseOkxPositionEvent(data: unknown) {
  return OkxPositionEventSchema.safeParse(data);
}

/** 安全解析 OKX order event */
export function parseOkxOrderEvent(data: unknown) {
  return OkxOrderEventSchema.safeParse(data);
}

/** 安全解析 OKX account event */
export function parseOkxAccountEvent(data: unknown) {
  return OkxAccountEventSchema.safeParse(data);
}

/** 安全解析 Gate.io ticker event */
export function parseGateioTickerEvent(data: unknown) {
  return GateioTickerEventSchema.safeParse(data);
}

/** 安全解析 Gate.io position event */
export function parseGateioPositionEvent(data: unknown) {
  return GateioPositionEventSchema.safeParse(data);
}

/** 安全解析 Gate.io order event */
export function parseGateioOrderEvent(data: unknown) {
  return GateioOrderEventSchema.safeParse(data);
}

/** 安全解析 BingX User Data Event */
export function parseBingxUserDataEvent(data: unknown) {
  return BingxUserDataEventSchema.safeParse(data);
}

/** 安全解析 BingX markPrice event (公開頻道) */
export function parseBingxMarkPriceEvent(data: unknown) {
  return BingxMarkPriceEventSchema.safeParse(data);
}

/** 安全解析 CCXT FundingRate */
export function parseCcxtFundingRate(data: unknown) {
  return CcxtFundingRateSchema.safeParse(data);
}

/** 安全解析 CCXT Position */
export function parseCcxtPosition(data: unknown) {
  return CcxtPositionSchema.safeParse(data);
}

/** 安全解析 CCXT Balance */
export function parseCcxtBalance(data: unknown) {
  return CcxtBalanceSchema.safeParse(data);
}

/** 安全解析 CCXT Order */
export function parseCcxtOrder(data: unknown) {
  return CcxtOrderSchema.safeParse(data);
}

// =============================================================================
// 8. Type exports from schemas
// =============================================================================

export type BinanceMarkPriceUpdateParsed = z.infer<typeof BinanceMarkPriceUpdateSchema>;
export type BinanceAccountUpdateParsed = z.infer<typeof BinanceAccountUpdateSchema>;
export type BinanceOrderTradeUpdateParsed = z.infer<typeof BinanceOrderTradeUpdateSchema>;
export type BinanceUserDataEventParsed = z.infer<typeof BinanceUserDataEventSchema>;

export type OkxFundingRateEventParsed = z.infer<typeof OkxFundingRateEventSchema>;
export type OkxMarkPriceEventParsed = z.infer<typeof OkxMarkPriceEventSchema>;
export type OkxPositionEventParsed = z.infer<typeof OkxPositionEventSchema>;
export type OkxOrderEventParsed = z.infer<typeof OkxOrderEventSchema>;
export type OkxAccountEventParsed = z.infer<typeof OkxAccountEventSchema>;

export type GateioTickerEventParsed = z.infer<typeof GateioTickerEventSchema>;
export type GateioPositionEventParsed = z.infer<typeof GateioPositionEventSchema>;
export type GateioOrderEventParsed = z.infer<typeof GateioOrderEventSchema>;

export type BingxAccountUpdateParsed = z.infer<typeof BingxAccountUpdateSchema>;
export type BingxOrderTradeUpdateParsed = z.infer<typeof BingxOrderTradeUpdateSchema>;
export type BingxUserDataEventParsed = z.infer<typeof BingxUserDataEventSchema>;
export type BingxMarkPriceEventParsed = z.infer<typeof BingxMarkPriceEventSchema>;

export type CcxtFundingRateParsed = z.infer<typeof CcxtFundingRateSchema>;
export type CcxtPositionParsed = z.infer<typeof CcxtPositionSchema>;
export type CcxtBalanceParsed = z.infer<typeof CcxtBalanceSchema>;
export type CcxtOrderParsed = z.infer<typeof CcxtOrderSchema>;
