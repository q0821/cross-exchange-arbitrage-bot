/**
 * TypeScript interfaces for net profit calculations
 */

import type Decimal from 'decimal.js';

/**
 * Net Profit Calculation
 *
 * Represents the calculated net profit for an arbitrage opportunity
 * considering funding rate difference and trading fees.
 */
export interface NetProfitCalculation {
  /** Trading symbol (e.g., "BTCUSDT") */
  symbol: string;

  /** Exchange to go long (positive funding rate) */
  longExchange: string;

  /** Exchange to go short (negative funding rate) */
  shortExchange: string;

  /** Normalized funding rate for long position */
  longRate: Decimal;

  /** Normalized funding rate for short position */
  shortRate: Decimal;

  /** Funding rate difference (longRate - shortRate) */
  rateDifference: Decimal;

  /** Taker fee rate per trade (e.g., 0.0005 for 0.05%) */
  takerFeeRate: Decimal;

  /** Total trading fees (takerFeeRate × 4 trades) */
  totalFees: Decimal;

  /** Net profit after fees (rateDifference - totalFees) */
  netProfit: Decimal;

  /** Timestamp when calculation was performed */
  timestamp: Date;
}

/**
 * Net Profit Details (for WebSocket/API transport)
 *
 * String representation of net profit data for JSON serialization
 */
export interface NetProfitDetails {
  /** Funding rate difference as string */
  rateDifference: string;

  /** Total fees as string */
  totalFees: string;

  /** Net profit as string */
  netProfit: string;
}

/**
 * Best Arbitrage Pair (for WebSocket/API transport)
 *
 * Information about the best arbitrage opportunity for a symbol
 */
export interface BestArbitragePair {
  /** Exchange to go long */
  longExchange: string;

  /** Exchange to go short */
  shortExchange: string;

  /** Normalized long rate as string */
  longRate: string;

  /** Normalized short rate as string */
  shortRate: string;

  /** Rate difference as string */
  rateDifference: string;

  /** Net profit after fees as string */
  netProfit: string;

  /** Detailed breakdown of net profit calculation */
  netProfitDetails: NetProfitDetails;
}

/**
 * Arbitrage Opportunity
 *
 * Complete arbitrage opportunity with all possible pairs
 */
export interface ArbitrageOpportunity {
  symbol: string;
  opportunities: ArbitrageOpportunityPair[];
}

/**
 * Single Arbitrage Opportunity Pair
 */
export interface ArbitrageOpportunityPair {
  longExchange: string;
  shortExchange: string;
  longRate: Decimal;
  shortRate: Decimal;
  rateDifference: Decimal;
  netProfit: Decimal;
}

/**
 * Net Profit Calculation Options
 */
export interface NetProfitCalculationOptions {
  /** Taker fee rate per trade (default: 0.0005 for 0.05%) */
  takerFeeRate?: string;

  /** Minimum net profit threshold to consider opportunity */
  minNetProfit?: Decimal;

  /** Whether to include negative net profit opportunities (default: true) */
  includeNegative?: boolean;
}

/**
 * Net Profit Cache Entry
 *
 * Internal cache structure for storing net profit calculations
 */
export interface NetProfitCacheEntry {
  symbol: string;
  longExchange: string;
  shortExchange: string;
  netProfit: Decimal;
  calculatedAt: Date;
  expiresAt: Date;
}
