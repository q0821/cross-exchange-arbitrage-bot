/**
 * Net Return Calculator
 *
 * Calculates the true net return of an arbitrage opportunity
 * by deducting price spread and trading costs from funding rate spread.
 *
 * Formula: netReturn = spreadPercent - |priceDiffPercent| - tradingCostRate
 *
 * @module net-return-calculator
 */

import { TOTAL_TRADING_COST_RATE } from './cost-constants.js';

/**
 * Calculate net return percentage
 *
 * @param spreadPercent - Funding rate spread percentage (e.g., 0.5 for 0.5%)
 * @param priceDiffPercent - Price difference percentage (can be positive or negative, e.g., 0.15 for +0.15%)
 * @param tradingCostRate - Trading cost rate (default: TOTAL_TRADING_COST_RATE = 0.003 = 0.3%)
 * @returns Net return percentage, or null if inputs are invalid
 *
 * @example
 * // Favorable scenario: positive price spread
 * calculateNetReturn(0.5, 0.15, 0.003) // Returns 0.05 (0.05%)
 * // Calculation: 0.5 - 0.15 - 0.3 = 0.05
 *
 * @example
 * // Unfavorable scenario: negative price spread
 * calculateNetReturn(0.5, -0.15, 0.003) // Returns 0.05 (0.05%)
 * // Calculation: 0.5 - |-0.15| - 0.3 = 0.05 (absolute value is used)
 *
 * @example
 * // Losing scenario: high price spread
 * calculateNetReturn(0.3, 0.2, 0.003) // Returns -0.2 (-0.2%)
 * // Calculation: 0.3 - 0.2 - 0.3 = -0.2
 *
 * @example
 * // Missing price data
 * calculateNetReturn(0.5, null, 0.003) // Returns null
 */
export function calculateNetReturn(
  spreadPercent: number,
  priceDiffPercent: number | null | undefined,
  tradingCostRate: number = TOTAL_TRADING_COST_RATE,
): number | null {
  // Validate inputs
  if (
    typeof spreadPercent !== 'number' ||
    !Number.isFinite(spreadPercent) ||
    Number.isNaN(spreadPercent)
  ) {
    return null;
  }

  if (
    priceDiffPercent === null ||
    priceDiffPercent === undefined ||
    !Number.isFinite(priceDiffPercent) ||
    Number.isNaN(priceDiffPercent)
  ) {
    return null;
  }

  if (
    typeof tradingCostRate !== 'number' ||
    !Number.isFinite(tradingCostRate) ||
    Number.isNaN(tradingCostRate)
  ) {
    return null;
  }

  // Calculate net return
  // Use Math.abs() to ensure price spread is always deducted as a cost
  // regardless of whether it's favorable (positive) or unfavorable (negative)
  const netReturn =
    spreadPercent - Math.abs(priceDiffPercent) - tradingCostRate * 100;

  // Ensure result is finite
  if (!Number.isFinite(netReturn) || Number.isNaN(netReturn)) {
    return null;
  }

  return netReturn;
}

/**
 * Calculate net return percentage (convenience function with percent conversion)
 *
 * This function automatically converts the trading cost rate from decimal to percentage.
 *
 * @param spreadPercent - Funding rate spread percentage (e.g., 0.5 for 0.5%)
 * @param priceDiffPercent - Price difference percentage (e.g., 0.15 for +0.15%)
 * @returns Net return percentage, or null if inputs are invalid
 *
 * @example
 * calculateNetReturnPercent(0.5, 0.15) // Returns 0.05 (0.05%)
 * // Uses TOTAL_TRADING_COST_RATE (0.003) automatically converted to 0.3%
 */
export function calculateNetReturnPercent(
  spreadPercent: number,
  priceDiffPercent: number | null | undefined,
): number | null {
  return calculateNetReturn(spreadPercent, priceDiffPercent);
}
