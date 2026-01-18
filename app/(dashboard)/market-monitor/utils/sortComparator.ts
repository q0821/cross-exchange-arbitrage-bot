import type { SortField, SortDirection } from '../types';

/**
 * Market rate data structure used for sorting
 */
export interface MarketRate {
  symbol: string;
  bestPair?: {
    spreadPercent: number;
    annualizedReturn: number;
    priceDiffPercent?: number | null;
    // netReturn removed - Feature 014: 移除淨收益欄位
  } | null;
}

/**
 * Stable sort comparator with secondary key (symbol name) for tie-breaking
 *
 * @param a First rate to compare
 * @param b Second rate to compare
 * @param sortBy Primary sort field
 * @param sortDirection Sort direction ('asc' or 'desc')
 * @returns Negative if a < b, positive if a > b, 0 if equal
 */
export function stableSortComparator(
  a: MarketRate,
  b: MarketRate,
  sortBy: SortField,
  sortDirection: SortDirection
): number {
  let result = 0;

  // Primary sort field comparison
  switch (sortBy) {
    case 'symbol':
      result = a.symbol.localeCompare(b.symbol);
      break;

    case 'spread': {
      const spreadA = a.bestPair?.spreadPercent ?? 0;
      const spreadB = b.bestPair?.spreadPercent ?? 0;
      result = spreadA - spreadB;
      break;
    }

    case 'annualizedReturn': {
      const returnA = a.bestPair?.annualizedReturn ?? 0;
      const returnB = b.bestPair?.annualizedReturn ?? 0;
      result = returnA - returnB;
      break;
    }

    case 'priceDiff': {
      const priceDiffA = a.bestPair?.priceDiffPercent ?? 0;
      const priceDiffB = b.bestPair?.priceDiffPercent ?? 0;
      result = priceDiffA - priceDiffB;
      break;
    }

    // case 'netReturn' removed - Feature 014: 移除淨收益欄位

    default:
      // Fallback to symbol comparison
      result = a.symbol.localeCompare(b.symbol);
  }

  // Secondary sort: symbol name (ensures stability)
  // When primary values are equal, sort by symbol alphabetically
  if (result === 0) {
    result = a.symbol.localeCompare(b.symbol);
  }

  // Apply sort direction
  return sortDirection === 'asc' ? result : -result;
}

/**
 * Create a comparison function for Array.sort() with bound sort parameters
 *
 * @param sortBy Primary sort field
 * @param sortDirection Sort direction
 * @returns Comparison function for Array.sort()
 */
export function createSortComparator(
  sortBy: SortField,
  sortDirection: SortDirection
): (a: MarketRate, b: MarketRate) => number {
  return (a: MarketRate, b: MarketRate) =>
    stableSortComparator(a, b, sortBy, sortDirection);
}
