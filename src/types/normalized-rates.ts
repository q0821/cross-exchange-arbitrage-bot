/**
 * TypeScript interfaces for normalized funding rates
 */

import type Decimal from 'decimal.js';

/**
 * Normalized Funding Rate
 *
 * Represents a funding rate that has been normalized from its original
 * settlement interval to a target time basis for consistent comparison.
 */
export interface NormalizedFundingRate {
  /** Exchange name (e.g., "binance", "okx", "mexc", "gateio") */
  exchange: string;

  /** Trading symbol (e.g., "BTCUSDT", "ETHUSDT") */
  symbol: string;

  /** Original funding rate before normalization */
  originalRate: Decimal;

  /** Original funding interval in hours (1 | 4 | 8 | 24) */
  originalFundingInterval: 1 | 4 | 8 | 24;

  /** Target time basis in hours (1 | 8 | 24) */
  targetTimeBasis: 1 | 8 | 24;

  /** Normalized funding rate (adjusted to target time basis) */
  normalizedRate: Decimal;

  /** Timestamp when the rate was fetched/calculated */
  timestamp: Date;
}

/**
 * Funding Rate Data (for WebSocket/API transport)
 *
 * String representation of rates for JSON serialization
 */
export interface FundingRateData {
  exchange: string;
  symbol: string;

  /** Original rate as string (for JSON serialization) */
  fundingRate: string;

  /** Next funding time (ISO 8601 timestamp) */
  nextFundingTime: string;

  /** Current mark price (optional) */
  markPrice?: string;

  /** Current index price (optional) */
  indexPrice?: string;

  /** Timestamp of data fetch (ISO 8601) */
  timestamp: string;

  // NEW fields for normalized rates (optional for backward compatibility)

  /** Normalized rate as string */
  normalizedRate?: string;

  /** Original funding interval in hours */
  originalFundingInterval?: number;

  /** Target time basis in hours */
  targetTimeBasis?: number;
}

/**
 * Normalized Rate Cache Entry
 *
 * Internal cache structure for storing normalized rates
 */
export interface NormalizedRateCacheEntry {
  exchange: string;
  symbol: string;
  originalRate: Decimal;
  originalInterval: number;
  normalizedRate: Decimal;
  targetBasis: number;
  fetchedAt: Date;
  expiresAt: Date;
}

/**
 * Rate Normalization Options
 */
export interface RateNormalizationOptions {
  /** Target time basis for normalization (default: 8 hours) */
  targetTimeBasis?: 1 | 8 | 24;

  /** Whether to throw error on invalid interval (default: false) */
  throwOnInvalidInterval?: boolean;

  /** Whether to use cached normalized rates (default: true) */
  useCache?: boolean;

  /** Cache TTL in milliseconds (default: 5 minutes) */
  cacheTTL?: number;
}
