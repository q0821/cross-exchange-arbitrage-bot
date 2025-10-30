/**
 * Cost Calculation Constants
 *
 * Defines the cost structure for arbitrage opportunity evaluation
 * Based on conservative estimates for general user tier (Taker fees)
 *
 * Total Cost: 0.37%
 * - Trading Fees: 0.2% (Taker 0.05% × 4 operations)
 * - Slippage: 0.1% (market order execution variance)
 * - Price Difference: 0.05% (inter-exchange mark price variance)
 * - Safety Margin: 0.02% (buffer for unexpected costs)
 */

/**
 * Taker fee rate (0.05%)
 * Applies to both Binance and OKX for general user tier
 */
export const TAKER_FEE_RATE = 0.0005;

/**
 * Total trading fees (0.2%)
 * 4 operations: Open Long + Open Short + Close Long + Close Short
 * Each operation incurs Taker fee
 */
export const TRADING_FEES_RATE = TAKER_FEE_RATE * 4; // 0.002

/**
 * Slippage rate (0.1%)
 * Conservative estimate for market order execution
 * May be higher during low liquidity periods
 */
export const SLIPPAGE_RATE = 0.001;

/**
 * Price difference rate (0.05%)
 * Cost due to mark price variance between exchanges
 * Represents the cost of price convergence
 */
export const PRICE_DIFF_RATE = 0.0005;

/**
 * Safety margin rate (0.02%)
 * Buffer to account for:
 * - Unexpected market movements
 * - Network latency
 * - Exchange-specific fees (funding, withdrawal)
 */
export const SAFETY_MARGIN_RATE = 0.0002;

/**
 * Total cost rate (0.37%)
 * Sum of all cost components
 */
export const TOTAL_COST_RATE =
  TRADING_FEES_RATE + SLIPPAGE_RATE + PRICE_DIFF_RATE + SAFETY_MARGIN_RATE; // 0.0037

/**
 * Number of funding rate settlements per year
 * 3 settlements per day × 365 days = 1095
 */
export const FUNDING_SETTLEMENTS_PER_YEAR = 3 * 365; // 1095

/**
 * Minimum funding rate difference for valid opportunity (0.37%)
 * Opportunities below this threshold will result in losses
 */
export const MIN_FUNDING_RATE_DIFF = TOTAL_COST_RATE;
