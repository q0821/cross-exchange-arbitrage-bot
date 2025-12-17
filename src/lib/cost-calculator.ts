/**
 * Cost Calculator Module
 *
 * Provides cost calculation functions for arbitrage opportunity evaluation
 * Implements conservative cost estimates to ensure profitability
 *
 * Strategy: Single-settlement profitability
 * - Assumes only 1 funding rate settlement (8 hours)
 * - All costs must be covered by the funding rate difference
 * - Provides safety margin for unexpected costs
 */

import {
  TRADING_FEES_RATE,
  SLIPPAGE_RATE,
  PRICE_DIFF_RATE,
  SAFETY_MARGIN_RATE,
  TOTAL_COST_RATE,
  FUNDING_SETTLEMENTS_PER_YEAR,
} from './cost-constants';

/**
 * Cost breakdown structure
 */
export interface CostBreakdown {
  /** Trading fees (0.2%) - Taker fee × 4 operations */
  tradingFees: number;

  /** Slippage (0.1%) - Market order execution variance */
  slippage: number;

  /** Price difference (0.15%) - Inter-exchange mark price variance */
  priceDiff: number;

  /** Safety margin (0.05%) - Buffer for unexpected costs */
  safetyMargin: number;

  /** Total cost (0.5%) - Sum of all components */
  totalCost: number;
}

/**
 * Calculate total cost breakdown
 *
 * @param positionSize Position size in USDT (default: 100000 for percentage calculation)
 * @returns Cost breakdown with detailed components
 *
 * @example
 * ```typescript
 * const costs = calculateTotalCost(100000);
 * console.log(costs.totalCost); // 500 (0.5% of 100000)
 * ```
 */
export function calculateTotalCost(positionSize: number = 100000): CostBreakdown {
  return {
    tradingFees: positionSize * TRADING_FEES_RATE,
    slippage: positionSize * SLIPPAGE_RATE,
    priceDiff: positionSize * PRICE_DIFF_RATE,
    safetyMargin: positionSize * SAFETY_MARGIN_RATE,
    totalCost: positionSize * TOTAL_COST_RATE,
  };
}

/**
 * Calculate net profit from funding rate difference
 *
 * @param fundingRateDiff Funding rate difference (as decimal, e.g., 0.004 for 0.4%)
 * @param positionSize Position size in USDT (default: 100000)
 * @returns Net profit in USDT
 *
 * @example
 * ```typescript
 * const netProfit = calculateNetProfit(0.006, 100000);
 * // fundingRateDiff: 0.6%
 * // totalCost: 0.5%
 * // netProfit: 0.1% of 100000 = 100 USDT
 * ```
 */
export function calculateNetProfit(
  fundingRateDiff: number,
  positionSize: number = 100000,
): number {
  const grossProfit = fundingRateDiff * positionSize;
  const costs = calculateTotalCost(positionSize);
  return grossProfit - costs.totalCost;
}

/**
 * Calculate net profit rate (as percentage)
 *
 * @param fundingRateDiff Funding rate difference (as decimal, e.g., 0.004 for 0.4%)
 * @returns Net profit rate (as decimal, e.g., 0.0003 for 0.03%)
 *
 * @example
 * ```typescript
 * const netProfitRate = calculateNetProfitRate(0.006);
 * // 0.006 - 0.005 = 0.001 (0.1%)
 * ```
 */
export function calculateNetProfitRate(fundingRateDiff: number): number {
  return fundingRateDiff - TOTAL_COST_RATE;
}

/**
 * Calculate net annualized return
 *
 * Assumes 3 funding rate settlements per day (every 8 hours)
 * Annual return = net profit rate × 1095 (3 × 365)
 *
 * @param fundingRateDiff Funding rate difference (as decimal, e.g., 0.004 for 0.4%)
 * @returns Net annualized return (as decimal, e.g., 0.3285 for 32.85%)
 *
 * @example
 * ```typescript
 * const annualReturn = calculateNetAnnualizedReturn(0.006);
 * // netProfit: 0.1%
 * // annualReturn: 0.1% × 1095 = 109.5%
 * ```
 */
export function calculateNetAnnualizedReturn(fundingRateDiff: number): number {
  const netProfitRate = calculateNetProfitRate(fundingRateDiff);
  return netProfitRate * FUNDING_SETTLEMENTS_PER_YEAR;
}

/**
 * Check if an opportunity is valid (has positive net profit)
 *
 * @param fundingRateDiff Funding rate difference (as decimal, e.g., 0.004 for 0.4%)
 * @returns true if net profit > 0, false otherwise
 *
 * @example
 * ```typescript
 * isValidOpportunity(0.006); // true (0.6% > 0.5%)
 * isValidOpportunity(0.004); // false (0.4% < 0.5%)
 * ```
 */
export function isValidOpportunity(fundingRateDiff: number): boolean {
  return fundingRateDiff > TOTAL_COST_RATE;
}

/**
 * Calculate break-even funding rate difference
 *
 * @returns Break-even rate (0.5%)
 */
export function getBreakEvenRate(): number {
  return TOTAL_COST_RATE;
}

/**
 * Format percentage for display
 *
 * @param value Decimal value (e.g., 0.004 for 0.4%)
 * @param decimals Number of decimal places (default: 2)
 * @returns Formatted percentage string (e.g., "0.40%")
 */
export function formatPercentage(value: number, decimals: number = 2): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Example usage demonstrating the cost calculation
 */
export const EXAMPLES = {
  // Example 1: Break-even scenario
  breakEven: {
    fundingRateDiff: 0.005,
    netProfit: calculateNetProfit(0.005, 100000), // 0 USDT
    netProfitRate: calculateNetProfitRate(0.005), // 0%
    annualReturn: calculateNetAnnualizedReturn(0.005), // 0%
    isValid: isValidOpportunity(0.005), // false (equal to threshold)
  },

  // Example 2: Small profitable opportunity
  smallProfit: {
    fundingRateDiff: 0.006,
    netProfit: calculateNetProfit(0.006, 100000), // 100 USDT
    netProfitRate: calculateNetProfitRate(0.006), // 0.1%
    annualReturn: calculateNetAnnualizedReturn(0.006), // 109.5%
    isValid: isValidOpportunity(0.006), // true
  },

  // Example 3: Strong opportunity
  strongProfit: {
    fundingRateDiff: 0.007,
    netProfit: calculateNetProfit(0.007, 100000), // 200 USDT
    netProfitRate: calculateNetProfitRate(0.007), // 0.2%
    annualReturn: calculateNetAnnualizedReturn(0.007), // 219.0%
    isValid: isValidOpportunity(0.007), // true
  },

  // Example 4: Loss scenario (below threshold)
  loss: {
    fundingRateDiff: 0.004,
    netProfit: calculateNetProfit(0.004, 100000), // -100 USDT
    netProfitRate: calculateNetProfitRate(0.004), // -0.1%
    annualReturn: calculateNetAnnualizedReturn(0.004), // -109.5%
    isValid: isValidOpportunity(0.004), // false
  },
};
