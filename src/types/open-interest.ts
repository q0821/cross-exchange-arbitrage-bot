import { z } from 'zod';

/**
 * Raw Open Interest data from Binance API
 * @see https://binance-docs.github.io/apidocs/futures/en/#open-interest
 */
export interface OpenInterestRecord {
  symbol: string;              // Trading pair (e.g., "BTCUSDT")
  openInterest: string;        // Contract quantity (string format from API)
  time: number;                // Unix timestamp (ms)
}

/**
 * Open Interest converted to USD value
 * Calculated as: contracts × mark price
 */
export interface OpenInterestUSD {
  symbol: string;                  // Trading pair
  openInterestUSD: number;         // OI in USD (contracts × mark price)
  openInterestContracts: number;   // Raw contract quantity
  markPrice: number;               // Mark price used for calculation
  timestamp: number;               // Data timestamp (Unix ms)
}

/**
 * Trading pair ranking based on Open Interest
 */
export interface TradingPairRanking {
  rankings: OpenInterestUSD[];     // Sorted OI data (descending order)
  totalSymbols: number;            // Total number of symbols
  topN: number;                    // Number of top symbols to select
  generatedAt: number;             // Generation timestamp (Unix ms)
}

/**
 * Cache entry structure
 */
export interface CacheEntry<T> {
  data: T;                // Cached data
  expiresAt: number;      // Expiration time (Unix ms)
}

// ============================================================================
// Zod Schemas for Validation
// ============================================================================

/**
 * Zod schema for OpenInterestRecord
 * Validates raw API response data
 */
export const OpenInterestRecordSchema = z.object({
  symbol: z.string().regex(/^[A-Z]+USDT$/, 'Symbol must be uppercase + USDT'),
  openInterest: z.string().regex(/^\d+(\.\d+)?$/, 'Open interest must be a valid number string'),
  time: z.number().int().positive('Time must be a positive integer'),
});

/**
 * Zod schema for OpenInterestUSD
 * Validates calculated OI in USD
 */
export const OpenInterestUSDSchema = z.object({
  symbol: z.string().regex(/^[A-Z]+USDT$/),
  openInterestUSD: z.number().positive().max(50_000_000_000, 'OI USD exceeds reasonable max'),
  openInterestContracts: z.number().positive(),
  markPrice: z.number().positive(),
  timestamp: z.number().int().positive(),
});

/**
 * Zod schema for TradingPairRanking
 */
export const TradingPairRankingSchema = z.object({
  rankings: z.array(OpenInterestUSDSchema),
  totalSymbols: z.number().int().positive(),
  topN: z.number().int().positive(),
  generatedAt: z.number().int().positive(),
});

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for OpenInterestRecord
 */
export function isOpenInterestRecord(obj: unknown): obj is OpenInterestRecord {
  return OpenInterestRecordSchema.safeParse(obj).success;
}

/**
 * Type guard for OpenInterestUSD
 */
export function isOpenInterestUSD(obj: unknown): obj is OpenInterestUSD {
  return OpenInterestUSDSchema.safeParse(obj).success;
}

/**
 * Validate array of OpenInterestRecord
 * @throws {z.ZodError} if validation fails
 */
export function validateOpenInterestRecords(data: unknown): OpenInterestRecord[] {
  return z.array(OpenInterestRecordSchema).parse(data);
}

/**
 * Validate array of OpenInterestUSD
 * @throws {z.ZodError} if validation fails
 */
export function validateOpenInterestUSD(data: unknown): OpenInterestUSD[] {
  return z.array(OpenInterestUSDSchema).parse(data);
}
