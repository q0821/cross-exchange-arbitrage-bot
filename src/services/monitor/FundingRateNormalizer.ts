/**
 * Funding Rate Normalizer Service
 *
 * Normalizes funding rates from different exchanges with varying settlement
 * intervals (1h, 4h, 8h, 24h) to a common time basis for consistent comparison.
 */

import Decimal from 'decimal.js';
import { logger } from '../../lib/logger';
import { normalizeRate } from '../../lib/fundingRateUtils';
import {
  validateFundingRateInput,
  type FundingRateInput,
  type TimeBasis
} from '../../lib/validation/fundingRateSchemas';

export interface NormalizedRateResult {
  originalRate: Decimal;
  originalFundingInterval: number;
  targetTimeBasis: number;
  normalizedRate: Decimal;
  timestamp: Date;
}

export class FundingRateNormalizer {
  private readonly defaultTimeBasis: TimeBasis = 8; // Default to 8-hour basis

  /**
   * Normalize a funding rate to a target time basis
   *
   * @param exchange - Exchange name
   * @param symbol - Trading symbol
   * @param originalRate - Original funding rate
   * @param originalInterval - Original settlement interval in hours
   * @param targetBasis - Target time basis (optional, uses default if not provided)
   * @returns Normalized rate result
   */
  normalize(
    exchange: string,
    symbol: string,
    originalRate: string,
    originalInterval: number,
    targetBasis?: TimeBasis
  ): NormalizedRateResult {
    const target = targetBasis ?? this.defaultTimeBasis;

    // Validate inputs
    const input: FundingRateInput = {
      originalRate,
      originalFundingInterval: originalInterval as 1 | 4 | 8 | 24,
      targetTimeBasis: target
    };

    try {
      validateFundingRateInput(input);
    } catch (error) {
      logger.error(
        { exchange, symbol, input, error },
        'Funding rate input validation failed'
      );
      throw error;
    }

    const originalRateDecimal = new Decimal(originalRate);

    // Perform normalization
    const normalizedRate = normalizeRate(
      originalRateDecimal,
      originalInterval,
      target
    );

    const result: NormalizedRateResult = {
      originalRate: originalRateDecimal,
      originalFundingInterval: originalInterval,
      targetTimeBasis: target,
      normalizedRate,
      timestamp: new Date()
    };

    logger.debug(
      {
        exchange,
        symbol,
        originalRate: originalRateDecimal.toString(),
        originalInterval,
        targetTimeBasis: target,
        normalizedRate: normalizedRate.toString()
      },
      'Funding rate normalized successfully'
    );

    return result;
  }

  /**
   * Normalize multiple funding rates in batch
   *
   * @param rates - Array of rate data with exchange, symbol, rate, and interval
   * @param targetBasis - Target time basis
   * @returns Array of normalized results
   */
  normalizeBatch(
    rates: Array<{
      exchange: string;
      symbol: string;
      rate: string;
      interval: number;
    }>,
    targetBasis?: TimeBasis
  ): Array<{ exchange: string; symbol: string; result: NormalizedRateResult }> {
    const target = targetBasis ?? this.defaultTimeBasis;

    return rates.map(({ exchange, symbol, rate, interval }) => {
      try {
        const result = this.normalize(exchange, symbol, rate, interval, target);
        return { exchange, symbol, result };
      } catch (error) {
        logger.error(
          { exchange, symbol, rate, interval, error },
          'Failed to normalize rate in batch'
        );
        throw error;
      }
    });
  }

  /**
   * Calculate normalized rate with fallback handling
   *
   * @param exchange - Exchange name
   * @param symbol - Trading symbol
   * @param originalRate - Original funding rate
   * @param originalInterval - Original settlement interval (can be null/undefined)
   * @param targetBasis - Target time basis
   * @returns Normalized rate result, or null if normalization fails
   */
  normalizeWithFallback(
    exchange: string,
    symbol: string,
    originalRate: string,
    originalInterval: number | null | undefined,
    targetBasis?: TimeBasis
  ): NormalizedRateResult | null {
    // If interval is missing or invalid, return null
    if (!originalInterval || ![1, 4, 8, 24].includes(originalInterval)) {
      logger.warn(
        {
          exchange,
          symbol,
          originalRate,
          originalInterval
        },
        'Cannot normalize rate: invalid or missing funding interval'
      );
      return null;
    }

    try {
      return this.normalize(exchange, symbol, originalRate, originalInterval, targetBasis);
    } catch (error) {
      logger.error(
        {
          exchange,
          symbol,
          originalRate,
          originalInterval,
          error
        },
        'Normalization failed with error'
      );
      return null;
    }
  }

  /**
   * Get default time basis
   */
  getDefaultTimeBasis(): TimeBasis {
    return this.defaultTimeBasis;
  }
}

// Export singleton instance
export const fundingRateNormalizer = new FundingRateNormalizer();
