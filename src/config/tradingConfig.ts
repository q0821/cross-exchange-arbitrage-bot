/**
 * Trading Configuration
 *
 * Contains default trading parameters like fee rates, thresholds, etc.
 *
 * Feature: 012-specify-scripts-bash (User Story 2 - T027)
 */

/**
 * Default taker fee rate per trade
 *
 * 0.05% (0.0005) per trade
 * Total cost for arbitrage: 4 trades × 0.0005 = 0.002 (0.2%)
 * - Long open: 1 trade
 * - Long close: 1 trade
 * - Short open: 1 trade
 * - Short close: 1 trade
 */
export const DEFAULT_TAKER_FEE_RATE = 0.0005;

/**
 * Total fee rate for complete arbitrage cycle
 * 4 trades × 0.0005 = 0.002 (0.2%)
 */
export const TOTAL_ARBITRAGE_FEE_RATE = DEFAULT_TAKER_FEE_RATE * 4;

/**
 * Number of trades in a complete arbitrage cycle
 */
export const TRADES_PER_ARBITRAGE = 4;

/**
 * Default opportunity thresholds
 */
export const OPPORTUNITY_THRESHOLDS = {
  /** Minimum spread to consider as opportunity (after fees) */
  minSpread: 0.001, // 0.1%
  /** Spread threshold for "approaching" status */
  approachingSpread: 0.0005, // 0.05%
} as const;

/**
 * Risk limits
 */
export const RISK_LIMITS = {
  /** Maximum position size per trade (USD) */
  maxPositionSize: 10000,
  /** Maximum total exposure across all positions (USD) */
  maxTotalExposure: 50000,
} as const;
