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
