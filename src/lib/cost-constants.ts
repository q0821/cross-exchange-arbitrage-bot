/**
 * Cost Calculation Constants
 *
 * Defines the cost structure for arbitrage opportunity evaluation
 * Based on conservative estimates for general user tier (Taker fees)
 *
 * Total Cost: 0.5%
 * - Trading Fees: 0.2% (Taker 0.05% × 4 operations)
 * - Slippage: 0.1% (market order execution variance)
 * - Price Difference: 0.15% (inter-exchange mark price variance)
 * - Safety Margin: 0.05% (buffer for unexpected costs)
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
 * Price difference rate (0.15%)
 * Cost due to mark price variance between exchanges
 * Represents the cost of price convergence
 */
export const PRICE_DIFF_RATE = 0.0015;

/**
 * Safety margin rate (0.05%)
 * Buffer to account for:
 * - Unexpected market movements
 * - Network latency
 * - Exchange-specific fees (funding, withdrawal)
 */
export const SAFETY_MARGIN_RATE = 0.0005;

/**
 * Total cost rate (0.5%)
 * Sum of all cost components
 */
export const TOTAL_COST_RATE =
  TRADING_FEES_RATE + SLIPPAGE_RATE + PRICE_DIFF_RATE + SAFETY_MARGIN_RATE; // 0.005

/**
 * Number of funding rate settlements per year
 * 3 settlements per day × 365 days = 1095
 */
export const FUNDING_SETTLEMENTS_PER_YEAR = 3 * 365; // 1095

/**
 * Minimum funding rate difference for valid opportunity (0.5%)
 * Opportunities below this threshold will result in losses
 */
export const MIN_FUNDING_RATE_DIFF = TOTAL_COST_RATE;

/**
 * Maximum acceptable adverse price difference (0.05%)
 * If price difference is in the opposite direction of the arbitrage,
 * we allow up to this amount before rejecting the opportunity
 */
export const MAX_ACCEPTABLE_ADVERSE_PRICE_DIFF = 0.0005;

/**
 * Total trading cost rate for Web UI net return calculation (0.3%)
 * Simplified cost estimate for user-facing displays:
 * - Trading Fees: ~0.14% (Maker 0.02% + Taker 0.05% × 2 operations)
 * - Slippage: ~0.15% (conservative market order execution variance)
 * - Safety Margin: ~0.01% (buffer for unexpected costs)
 *
 * Note: This is lower than TOTAL_COST_RATE (0.5%) used for opportunity
 * validation, as Web UI shows net return for informational purposes,
 * while opportunity validation requires more conservative thresholds.
 */
export const TOTAL_TRADING_COST_RATE = 0.003; // 0.3%
