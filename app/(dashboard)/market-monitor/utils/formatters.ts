/**
 * Formatting Utilities for Market Monitor
 *
 * Provides formatting functions for rates, percentages, and numbers.
 *
 * Feature: 012-specify-scripts-bash (User Story 2)
 */

/**
 * Format rate as percentage string
 *
 * @param rate - Rate as decimal (e.g., 0.0008 for 0.08%)
 * @param precision - Decimal places (default: 4)
 * @returns Formatted percentage string (e.g., "0.0800%")
 */
export function formatRateAsPercentage(
  rate: number,
  precision: number = 4
): string {
  return `${(rate * 100).toFixed(precision)}%`;
}

/**
 * Format net profit with color coding class
 *
 * @param netProfit - Net profit as decimal
 * @returns Object with formatted value and color class
 */
export function formatNetProfit(netProfit: number): {
  value: string;
  colorClass: string;
} {
  const isPositive = netProfit >= 0;
  const value = formatRateAsPercentage(netProfit);

  return {
    value: isPositive ? `+${value}` : value,
    colorClass: isPositive
      ? 'text-green-600 dark:text-green-400'
      : 'text-red-600 dark:text-red-400',
  };
}

/**
 * Format funding interval hours to human-readable string
 *
 * @param hours - Interval in hours (1, 4, 8, or 24)
 * @returns Formatted string (e.g., "1 小時", "8 小時")
 */
export function formatFundingInterval(hours: number): string {
  return `${hours} 小時`;
}

/**
 * Format timestamp to local time string
 *
 * @param timestamp - ISO timestamp string or Date object
 * @returns Formatted local time string
 */
export function formatTimestamp(timestamp: string | Date): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  return date.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/**
 * Format number with thousand separators
 *
 * @param value - Number to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string (e.g., "1,234.56")
 */
export function formatNumber(value: number, decimals: number = 2): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format price with appropriate precision
 *
 * @param price - Price value
 * @returns Formatted price string
 */
export function formatPrice(price: number): string {
  if (price >= 1000) {
    return formatNumber(price, 2);
  } else if (price >= 1) {
    return formatNumber(price, 4);
  } else {
    return formatNumber(price, 6);
  }
}
