/**
 * Funding Rate Normalization Utilities
 *
 * Provides utilities for normalizing funding rates across different
 * settlement intervals to a common time basis.
 */

import Decimal from 'decimal.js';
import { logger } from './logger';

/**
 * Normalize funding rate from one time period to another
 *
 * @param originalRate - The original funding rate as Decimal
 * @param originalPeriodHours - Original settlement period in hours (1, 4, 8, or 24)
 * @param targetPeriodHours - Target time basis in hours (1, 8, or 24)
 * @returns Normalized funding rate
 *
 * @example
 * // Convert 0.01% per hour to 8-hour basis
 * normalizeRate(new Decimal(0.0001), 1, 8) // returns 0.0008 (0.08%)
 */
export function normalizeRate(
  originalRate: Decimal,
  originalPeriodHours: number,
  targetPeriodHours: number
): Decimal {
  // If periods are the same, no conversion needed
  if (originalPeriodHours === targetPeriodHours) {
    return originalRate;
  }

  // Validate periods
  if (originalPeriodHours === 0) {
    logger.error({ originalPeriodHours }, 'Invalid original period: cannot be zero');
    throw new Error('Original period cannot be zero');
  }

  const factor = new Decimal(targetPeriodHours).div(originalPeriodHours);
  const normalizedRate = originalRate.mul(factor);

  logger.debug({
    originalRate: originalRate.toString(),
    originalPeriodHours,
    targetPeriodHours,
    factor: factor.toString(),
    normalizedRate: normalizedRate.toString()
  }, 'Normalized funding rate');

  return normalizedRate;
}

/**
 * Parse funding interval string to hours
 *
 * @param intervalString - Interval string like "1H", "8H", "24H"
 * @returns Number of hours
 *
 * @example
 * parseFundingInterval("8H") // returns 8
 */
export function parseFundingInterval(intervalString: string): number {
  const match = intervalString.match(/^(\d+)H$/i);
  if (!match) {
    logger.warn({ intervalString }, 'Invalid funding interval format');
    throw new Error(`Invalid funding interval format: ${intervalString}`);
  }

  const hours = parseInt(match[1], 10);

  // Validate common intervals
  const validIntervals = [1, 4, 8, 24];
  if (!validIntervals.includes(hours)) {
    logger.warn({ hours, intervalString }, 'Uncommon funding interval detected');
  }

  return hours;
}

/**
 * Calculate time until next funding based on interval
 *
 * @param nextFundingTime - ISO timestamp of next funding
 * @returns Hours until next funding
 */
export function getHoursUntilNextFunding(nextFundingTime: string): number {
  const now = Date.now();
  const next = new Date(nextFundingTime).getTime();
  const diffMs = next - now;

  if (diffMs < 0) {
    logger.warn({ nextFundingTime }, 'Next funding time is in the past');
    return 0;
  }

  return diffMs / (1000 * 60 * 60);
}

/**
 * Detect funding interval from consecutive funding times
 *
 * @param fundingTimes - Array of ISO timestamp strings
 * @returns Detected interval in hours, or null if cannot determine
 */
export function detectFundingInterval(fundingTimes: string[]): number | null {
  if (fundingTimes.length < 2) {
    logger.warn({ count: fundingTimes.length }, 'Not enough funding times to detect interval');
    return null;
  }

  const intervals: number[] = [];

  for (let i = 1; i < fundingTimes.length; i++) {
    const prev = new Date(fundingTimes[i - 1]).getTime();
    const curr = new Date(fundingTimes[i]).getTime();
    const diffHours = (curr - prev) / (1000 * 60 * 60);
    intervals.push(Math.round(diffHours));
  }

  // Use most common interval
  const mode = intervals.sort((a, b) =>
    intervals.filter(v => v === a).length - intervals.filter(v => v === b).length
  ).pop();

  if (!mode) {
    logger.warn({ intervals }, 'Could not determine funding interval mode');
    return null;
  }

  logger.debug({ detectedInterval: mode, fundingTimes }, 'Detected funding interval');

  return mode;
}

/**
 * Format rate as percentage string
 *
 * @param rate - Rate as Decimal
 * @param precision - Decimal places (default: 4)
 * @returns Formatted percentage string
 *
 * @example
 * formatRateAsPercentage(new Decimal(0.0008)) // returns "0.0800%"
 */
export function formatRateAsPercentage(rate: Decimal, precision: number = 4): string {
  return `${rate.mul(100).toFixed(precision)}%`;
}
