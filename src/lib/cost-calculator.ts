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
} from './cost-constants.js';

/**
 * Cost breakdown structure
 */
export interface CostBreakdown {
  /** Trading fees (0.2%) - Taker fee × 4 operations */
  tradingFees: number;

  /** Slippage (0.1%) - Market order execution variance */
  slippage: number;

  /** Price difference (0.05%) - Inter-exchange mark price variance */
  priceDiff: number;

  /** Safety margin (0.02%) - Buffer for unexpected costs */
  safetyMargin: number;

  /** Total cost (0.37%) - Sum of all components */
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
 * console.log(costs.totalCost); // 370 (0.37% of 100000)
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
 * const netProfit = calculateNetProfit(0.004, 100000);
 * // fundingRateDiff: 0.4%
 * // totalCost: 0.37%
 * // netProfit: 0.03% of 100000 = 30 USDT
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
 * const netProfitRate = calculateNetProfitRate(0.004);
 * // 0.004 - 0.0037 = 0.0003 (0.03%)
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
 * const annualReturn = calculateNetAnnualizedReturn(0.004);
 * // netProfit: 0.03%
 * // annualReturn: 0.03% × 1095 = 32.85%
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
 * isValidOpportunity(0.004); // true (0.4% > 0.37%)
 * isValidOpportunity(0.003); // false (0.3% < 0.37%)
 * ```
 */
export function isValidOpportunity(fundingRateDiff: number): boolean {
  return fundingRateDiff > TOTAL_COST_RATE;
}

/**
 * Calculate break-even funding rate difference
 *
 * @returns Break-even rate (0.37%)
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
    fundingRateDiff: 0.0037,
    netProfit: calculateNetProfit(0.0037, 100000), // 0 USDT
    netProfitRate: calculateNetProfitRate(0.0037), // 0%
    annualReturn: calculateNetAnnualizedReturn(0.0037), // 0%
    isValid: isValidOpportunity(0.0037), // false (equal to threshold)
  },

  // Example 2: Small profitable opportunity
  smallProfit: {
    fundingRateDiff: 0.004,
    netProfit: calculateNetProfit(0.004, 100000), // 30 USDT
    netProfitRate: calculateNetProfitRate(0.004), // 0.03%
    annualReturn: calculateNetAnnualizedReturn(0.004), // 32.85%
    isValid: isValidOpportunity(0.004), // true
  },

  // Example 3: Strong opportunity
  strongProfit: {
    fundingRateDiff: 0.005,
    netProfit: calculateNetProfit(0.005, 100000), // 130 USDT
    netProfitRate: calculateNetProfitRate(0.005), // 0.13%
    annualReturn: calculateNetAnnualizedReturn(0.005), // 142.35%
    isValid: isValidOpportunity(0.005), // true
  },

  // Example 4: Loss scenario (below threshold)
  loss: {
    fundingRateDiff: 0.003,
    netProfit: calculateNetProfit(0.003, 100000), // -70 USDT
    netProfitRate: calculateNetProfitRate(0.003), // -0.07%
    annualReturn: calculateNetAnnualizedReturn(0.003), // -76.65%
    isValid: isValidOpportunity(0.003), // false
  },
};
