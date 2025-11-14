/**
 * Net Profit Calculator Service
 *
 * Calculates net profit for arbitrage opportunities considering:
 * - Funding rate difference between long and short positions
 * - Trading fees (4 trades: long open/close + short open/close)
 *
 * Formula: Net Profit = Rate Difference - Total Fees (takerFeeRate × 4)
 */

import Decimal from 'decimal.js';
import { logger } from '../../lib/logger';
import {
  validateNetProfitInput,
  type NetProfitInput
} from '../../lib/validation/fundingRateSchemas';

export interface NetProfitResult {
  symbol: string;
  longExchange: string;
  shortExchange: string;
  longRate: Decimal;
  shortRate: Decimal;
  rateDifference: Decimal;
  takerFeeRate: Decimal;
  totalFees: Decimal;
  netProfit: Decimal;
  timestamp: Date;
}

export interface ArbitrageOpportunity {
  symbol: string;
  opportunities: Array<{
    longExchange: string;
    shortExchange: string;
    longRate: Decimal;
    shortRate: Decimal;
    rateDifference: Decimal;
    netProfit: Decimal;
  }>;
}

export class NetProfitCalculator {
  private readonly defaultTakerFeeRate: Decimal = new Decimal('0.0005'); // 0.05% per trade

  /**
   * Calculate net profit for a single arbitrage pair
   *
   * @param symbol - Trading symbol
   * @param longExchange - Exchange to go long
   * @param shortExchange - Exchange to go short
   * @param longRate - Normalized funding rate for long position
   * @param shortRate - Normalized funding rate for short position
   * @param takerFeeRate - Taker fee rate per trade (optional)
   * @returns Net profit calculation result
   */
  calculate(
    symbol: string,
    longExchange: string,
    shortExchange: string,
    longRate: string,
    shortRate: string,
    takerFeeRate?: string
  ): NetProfitResult {
    // Validate inputs
    const input: NetProfitInput = {
      longRate,
      shortRate,
      takerFeeRate: takerFeeRate ?? this.defaultTakerFeeRate.toString()
    };

    try {
      validateNetProfitInput(input);
    } catch (error) {
      logger.error(
        { symbol, longExchange, shortExchange, input, error },
        'Net profit input validation failed'
      );
      throw error;
    }

    const longRateDecimal = new Decimal(longRate);
    const shortRateDecimal = new Decimal(shortRate);
    const feeRateDecimal = new Decimal(input.takerFeeRate);

    // Calculate rate difference: long rate - short rate
    const rateDifference = longRateDecimal.sub(shortRateDecimal);

    // Calculate total fees: 4 trades × taker fee rate
    // 4 trades = long open + long close + short open + short close
    const totalFees = feeRateDecimal.mul(4);

    // Calculate net profit: rate difference - total fees
    const netProfit = rateDifference.sub(totalFees);

    const result: NetProfitResult = {
      symbol,
      longExchange,
      shortExchange,
      longRate: longRateDecimal,
      shortRate: shortRateDecimal,
      rateDifference,
      takerFeeRate: feeRateDecimal,
      totalFees,
      netProfit,
      timestamp: new Date()
    };

    logger.debug(
      {
        symbol,
        longExchange,
        shortExchange,
        longRate: longRateDecimal.toString(),
        shortRate: shortRateDecimal.toString(),
        rateDifference: rateDifference.toString(),
        totalFees: totalFees.toString(),
        netProfit: netProfit.toString(),
        isProfitable: netProfit.greaterThan(0)
      },
      'Net profit calculated'
    );

    // Warn if net profit is negative
    if (netProfit.lessThan(0)) {
      logger.warn(
        {
          symbol,
          longExchange,
          shortExchange,
          netProfit: netProfit.toString()
        },
        'Negative net profit detected - arbitrage opportunity not profitable'
      );
    }

    return result;
  }

  /**
   * Find best arbitrage pair (highest net profit) for a symbol across multiple exchanges
   *
   * @param symbol - Trading symbol
   * @param rates - Map of exchange → normalized rate
   * @param takerFeeRate - Taker fee rate (optional)
   * @returns Best arbitrage pair with highest net profit, or null if no profitable pair
   */
  findBestArbitragePair(
    symbol: string,
    rates: Map<string, string>,
    takerFeeRate?: string
  ): NetProfitResult | null {
    if (rates.size < 2) {
      logger.warn(
        { symbol, exchangeCount: rates.size },
        'Not enough exchanges to find arbitrage pair'
      );
      return null;
    }

    const exchanges = Array.from(rates.keys());
    let bestPair: NetProfitResult | null = null;

    // Compare all possible exchange pairs
    for (let i = 0; i < exchanges.length; i++) {
      for (let j = 0; j < exchanges.length; j++) {
        if (i === j) continue;

        const longExchange = exchanges[i];
        const shortExchange = exchanges[j];
        const longRate = rates.get(longExchange)!;
        const shortRate = rates.get(shortExchange)!;

        try {
          const result = this.calculate(
            symbol,
            longExchange,
            shortExchange,
            longRate,
            shortRate,
            takerFeeRate
          );

          // Update best pair if this one has higher net profit
          if (!bestPair || result.netProfit.greaterThan(bestPair.netProfit)) {
            bestPair = result;
          }
        } catch (error) {
          logger.error(
            { symbol, longExchange, shortExchange, error },
            'Failed to calculate net profit for pair'
          );
          continue;
        }
      }
    }

    if (bestPair) {
      logger.info(
        {
          symbol,
          longExchange: bestPair.longExchange,
          shortExchange: bestPair.shortExchange,
          netProfit: bestPair.netProfit.toString(),
          isProfitable: bestPair.netProfit.greaterThan(0)
        },
        'Best arbitrage pair found'
      );
    }

    return bestPair;
  }

  /**
   * Calculate all arbitrage opportunities for a symbol across exchanges
   *
   * @param symbol - Trading symbol
   * @param rates - Map of exchange → normalized rate
   * @param takerFeeRate - Taker fee rate (optional)
   * @param minNetProfit - Minimum net profit threshold (optional)
   * @returns All arbitrage opportunities sorted by net profit (descending)
   */
  findAllOpportunities(
    symbol: string,
    rates: Map<string, string>,
    takerFeeRate?: string,
    minNetProfit?: Decimal
  ): ArbitrageOpportunity {
    const exchanges = Array.from(rates.keys());
    const opportunities: ArbitrageOpportunity['opportunities'] = [];

    for (let i = 0; i < exchanges.length; i++) {
      for (let j = 0; j < exchanges.length; j++) {
        if (i === j) continue;

        const longExchange = exchanges[i];
        const shortExchange = exchanges[j];
        const longRate = rates.get(longExchange)!;
        const shortRate = rates.get(shortExchange)!;

        try {
          const result = this.calculate(
            symbol,
            longExchange,
            shortExchange,
            longRate,
            shortRate,
            takerFeeRate
          );

          // Filter by minimum net profit if specified
          if (minNetProfit && result.netProfit.lessThan(minNetProfit)) {
            continue;
          }

          opportunities.push({
            longExchange: result.longExchange,
            shortExchange: result.shortExchange,
            longRate: result.longRate,
            shortRate: result.shortRate,
            rateDifference: result.rateDifference,
            netProfit: result.netProfit
          });
        } catch (error) {
          logger.error(
            { symbol, longExchange, shortExchange, error },
            'Failed to calculate opportunity'
          );
          continue;
        }
      }
    }

    // Sort by net profit (descending)
    opportunities.sort((a, b) => b.netProfit.sub(a.netProfit).toNumber());

    return { symbol, opportunities };
  }

  /**
   * Get default taker fee rate
   */
  getDefaultTakerFeeRate(): Decimal {
    return this.defaultTakerFeeRate;
  }
}

// Export singleton instance
export const netProfitCalculator = new NetProfitCalculator();
