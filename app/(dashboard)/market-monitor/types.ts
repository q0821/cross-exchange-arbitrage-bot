/**
 * WebSocket Market Rates Types
 *
 * Feature 012: 支援多版本標準化費率
 */

export type ExchangeName = 'binance' | 'okx' | 'mexc' | 'gateio' | 'bingx';

/**
 * 目前啟用的交易所列表（前端顯示用）
 * BingX 暫時停用 - 資金費率數據不正確
 * 停用日期：2026-01-15
 */
export const ACTIVE_EXCHANGE_LIST: ExchangeName[] = [
  'binance',
  'okx',
  'mexc',
  'gateio',
  // 'bingx', // 暫時停用 - 資金費率數據不正確
];

export type TimeBasis = 1 | 4 | 8 | 24;

export interface ExchangeRateData {
  rate: number;
  price: number | null;
  // Feature 012: 多版本標準化費率（前端根據 timeBasis 選擇顯示）
  normalized?: {
    '1h'?: number;   // 標準化為 1 小時基準的費率
    '4h'?: number;   // 標準化為 4 小時基準的費率
    '8h'?: number;   // 標準化為 8 小時基準的費率
    '24h'?: number;  // 標準化為 24 小時基準的費率
  };
  originalInterval?: number; // 原始資金費率週期（小時數）
}

export interface BestArbitragePair {
  longExchange: ExchangeName;
  shortExchange: ExchangeName;
  spread: number;
  spreadPercent: number;
  annualizedReturn: number;
  priceDiffPercent: number | null;
  // netReturn field removed - Feature 014: 移除淨收益欄位
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

export type SortField = 'symbol' | 'spread' | 'annualizedReturn' | 'priceDiff';
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
