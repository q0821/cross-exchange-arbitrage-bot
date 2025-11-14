/**
 * WebSocket Market Rates Types
 */

export interface ExchangeRateData {
  rate: number;
  price: number | null;
  // NEW: Normalized rate data (optional)
  normalizedRate?: number;
  originalFundingInterval?: number;
  targetTimeBasis?: number;
}

export interface BestArbitragePair {
  longExchange: string;
  shortExchange: string;
  spread: number;
  spreadPercent: number;
  annualizedReturn: number;
  priceDiffPercent: number | null;
  netReturn: number;
}

export interface MarketRate {
  symbol: string;
  exchanges: Record<string, ExchangeRateData>;
  bestPair: BestArbitragePair | null;
  status: 'opportunity' | 'approaching' | 'normal';
  timestamp: string;
}

export interface MarketRatesUpdatePayload {
  type: 'rates:update';
  data: {
    rates: MarketRate[];
    timestamp: string;
  };
}

export interface MarketStatsPayload {
  type: 'rates:stats';
  data: {
    totalSymbols: number;
    opportunityCount: number;
    approachingCount: number;
    maxSpread: {
      symbol: string;
      spread: number;
    } | null;
    uptime: number;
    lastUpdate: string | null;
  };
}

/**
 * Sorting configuration types for market monitor table
 */

export type SortField = 'symbol' | 'spread' | 'annualizedReturn' | 'priceDiff' | 'netReturn';
export type SortDirection = 'asc' | 'desc';

export interface SortPreference {
  sortBy: SortField;
  sortDirection: SortDirection;
}

/**
 * Validation helpers
 */
export const VALID_SORT_FIELDS: SortField[] = [
  'symbol',
  'spread',
  'annualizedReturn',
  'priceDiff',
  'netReturn',
];

export const VALID_SORT_DIRECTIONS: SortDirection[] = ['asc', 'desc'];

export function isValidSortField(field: unknown): field is SortField {
  return (
    typeof field === 'string' &&
    VALID_SORT_FIELDS.includes(field as SortField)
  );
}

export function isValidSortDirection(
  direction: unknown
): direction is SortDirection {
  return (
    typeof direction === 'string' &&
    VALID_SORT_DIRECTIONS.includes(direction as SortDirection)
  );
}
