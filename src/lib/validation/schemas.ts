/**
 * Zod Validation Schemas
 *
 * API 回應資料驗證
 * Feature: 004-fix-okx-add-price-display
 */

import { z } from 'zod';

// ============================================================================
// Exchange API Response Schemas
// ============================================================================

/**
 * Binance Ticker Response Schema
 * WebSocket: @ticker stream
 */
export const BinanceTickerSchema = z.object({
  e: z.string(), // Event type
  E: z.number(), // Event time
  s: z.string(), // Symbol
  p: z.string(), // Price change
  P: z.string(), // Price change percent
  w: z.string(), // Weighted average price
  c: z.string(), // Last price
  Q: z.string(), // Last quantity
  b: z.string(), // Best bid price
  B: z.string(), // Best bid quantity
  a: z.string(), // Best ask price
  A: z.string(), // Best ask quantity
  o: z.string(), // Open price
  h: z.string(), // High price
  l: z.string(), // Low price
  v: z.string(), // Total traded base asset volume
  q: z.string(), // Total traded quote asset volume
  O: z.number(), // Statistics open time
  C: z.number(), // Statistics close time
  F: z.number(), // First trade ID
  L: z.number(), // Last trade ID
  n: z.number(), // Total number of trades
});

/**
 * Binance REST API Ticker Price Response Schema
 */
export const BinanceTickerPriceSchema = z.object({
  symbol: z.string(),
  price: z.string(),
});

/**
 * OKX Public Ticker Response Schema
 * WebSocket: tickers channel
 */
export const OkxTickerSchema = z.object({
  arg: z.object({
    channel: z.string(),
    instId: z.string(),
  }),
  data: z.array(
    z.object({
      instType: z.string(), // Instrument type
      instId: z.string(), // Instrument ID
      last: z.string(), // Last traded price
      lastSz: z.string(), // Last traded size
      askPx: z.string(), // Best ask price
      askSz: z.string(), // Best ask size
      bidPx: z.string(), // Best bid price
      bidSz: z.string(), // Best bid size
      open24h: z.string(), // Open price in the past 24 hours
      high24h: z.string(), // Highest price in the past 24 hours
      low24h: z.string(), // Lowest price in the past 24 hours
      vol24h: z.string().optional(), // 24h trading volume (base currency)
      volCcy24h: z.string().optional(), // 24h trading volume (quote currency)
      ts: z.string(), // Ticker data generation time (Unix timestamp ms)
    })
  ),
});

/**
 * OKX REST API Ticker Response Schema
 */
export const OkxRestTickerSchema = z.object({
  code: z.string(),
  msg: z.string().optional(),
  data: z.array(
    z.object({
      instType: z.string(),
      instId: z.string(),
      last: z.string(),
      lastSz: z.string().optional(),
      askPx: z.string(),
      askSz: z.string().optional(),
      bidPx: z.string(),
      bidSz: z.string().optional(),
      open24h: z.string().optional(),
      high24h: z.string().optional(),
      low24h: z.string().optional(),
      vol24h: z.string().optional(),
      volCcy24h: z.string().optional(),
      ts: z.string(),
    })
  ),
});

/**
 * OKX Funding Rate Response Schema
 * API: /api/v5/public/funding-rate
 */
export const OkxFundingRateSchema = z.object({
  code: z.string(),
  msg: z.string().optional(),
  data: z.array(
    z.object({
      instType: z.string(),
      instId: z.string(),
      fundingRate: z.string(),
      nextFundingRate: z.string().optional(),
      fundingTime: z.string(),
      nextFundingTime: z.string().optional(),
    })
  ),
});

/**
 * CCXT Funding Rate Response Schema
 */
export const CcxtFundingRateSchema = z.object({
  symbol: z.string(),
  fundingRate: z.number().nullable(),
  fundingTimestamp: z.number().nullable(),
  nextFundingTimestamp: z.number().nullable().optional(),
  info: z.any().optional(),
});

// ============================================================================
// Internal Data Validation Schemas
// ============================================================================

/**
 * Price Data Schema
 */
export const PriceDataSchema = z.object({
  id: z.string(),
  timestamp: z.date(),
  symbol: z.string(),
  exchange: z.enum(['binance', 'okx']),
  lastPrice: z.number().positive(),
  bidPrice: z.number().positive(),
  askPrice: z.number().positive(),
  volume24h: z.number().nonnegative().optional(),
  source: z.enum(['websocket', 'rest']),
  latencyMs: z.number().nonnegative().optional(),
});

/**
 * Funding Rate Validation Result Schema
 */
export const FundingRateValidationResultSchema = z.object({
  symbol: z.string(),
  timestamp: z.date(),
  okxRate: z.number(),
  okxNextRate: z.number().optional(),
  okxFundingTime: z.date().optional(),
  ccxtRate: z.number().optional(),
  ccxtFundingTime: z.date().optional(),
  discrepancyPercent: z.number().optional(),
  validationStatus: z.enum(['PASS', 'FAIL', 'ERROR', 'N/A']),
  errorMessage: z.string().optional(),
});

/**
 * Arbitrage Assessment Schema
 */
export const ArbitrageAssessmentSchema = z.object({
  symbol: z.string(),
  timestamp: z.date(),
  binanceFundingRate: z.number(),
  okxFundingRate: z.number(),
  binancePrice: z.number().positive(),
  okxPrice: z.number().positive(),
  fundingRateSpread: z.number().nonnegative(),
  priceSpread: z.number().nonnegative(),
  totalFees: z.number().nonnegative(),
  netProfit: z.number(),
  netProfitPercent: z.number(),
  direction: z.string(),
  feasibility: z.enum(['VIABLE', 'NOT_VIABLE', 'HIGH_RISK']),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  extremeSpreadDetected: z.boolean(),
  warningMessage: z.string().optional(),
});

// ============================================================================
// Configuration Schemas
// ============================================================================

/**
 * Price Monitor Config Schema
 */
export const PriceMonitorConfigSchema = z.object({
  enableWebSocket: z.boolean().default(true),
  maxReconnectAttempts: z.number().int().positive().default(10),
  reconnectBaseDelay: z.number().positive().default(1000),
  reconnectMaxDelay: z.number().positive().default(30000),
  restPollInterval: z.number().positive().default(5000),
  priceStaleThreshold: z.number().positive().default(10000),
  delayWarningThreshold: z.number().positive().default(10000),
});

/**
 * Arbitrage Config Schema
 */
export const ArbitrageConfigSchema = z.object({
  makerFee: z.number().nonnegative().default(0.001),
  takerFee: z.number().nonnegative().default(0.001),
  extremeSpreadThreshold: z.number().nonnegative().default(0.05),
});

/**
 * Funding Rate Validator Config Schema
 */
export const FundingRateValidatorConfigSchema = z.object({
  acceptableDiscrepancy: z.number().nonnegative().default(0.000001),
  maxRetries: z.number().int().positive().default(3),
  timeoutMs: z.number().positive().default(5000),
  enableCCXT: z.boolean().default(true),
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 驗證 Binance Ticker 數據
 */
export function validateBinanceTicker(data: unknown) {
  return BinanceTickerSchema.parse(data);
}

/**
 * 驗證 OKX Ticker 數據
 */
export function validateOkxTicker(data: unknown) {
  return OkxTickerSchema.parse(data);
}

/**
 * 驗證 OKX Funding Rate 數據
 */
export function validateOkxFundingRate(data: unknown) {
  return OkxFundingRateSchema.parse(data);
}

/**
 * 驗證 CCXT Funding Rate 數據
 */
export function validateCcxtFundingRate(data: unknown) {
  return CcxtFundingRateSchema.parse(data);
}
