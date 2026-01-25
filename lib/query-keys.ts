/**
 * Centralized Query Key Factory
 *
 * This module provides type-safe query keys for TanStack Query.
 * Using a factory pattern ensures:
 * 1. Consistent key structure across the application
 * 2. Easy bulk invalidation (e.g., invalidate all 'trading' queries)
 * 3. TypeScript autocompletion support
 */
export const queryKeys = {
  /**
   * Asset-related queries
   */
  assets: {
    all: ['assets'] as const,
    balances: () => [...queryKeys.assets.all, 'balances'] as const,
    history: (days: number) => [...queryKeys.assets.all, 'history', days] as const,
    positions: () => [...queryKeys.assets.all, 'positions'] as const,
  },

  /**
   * Trading-related queries
   */
  trading: {
    all: ['trading'] as const,
    positions: () => [...queryKeys.trading.all, 'positions'] as const,
    // Feature 069: 分組後的持倉查詢鍵
    groupedPositions: () => [...queryKeys.trading.all, 'groupedPositions'] as const,
    position: (id: string) => [...queryKeys.trading.all, 'position', id] as const,
    positionDetails: (id: string) => [...queryKeys.trading.all, 'position', id, 'details'] as const,
    trades: () => [...queryKeys.trading.all, 'trades'] as const,
    settings: () => [...queryKeys.trading.all, 'settings'] as const,
  },

  /**
   * Market data queries
   */
  market: {
    all: ['market'] as const,
    rates: () => [...queryKeys.market.all, 'rates'] as const,
    symbolGroups: () => [...queryKeys.market.all, 'symbol-groups'] as const,
  },

  /**
   * User-specific queries
   */
  user: {
    all: ['user'] as const,
    balances: (exchanges: string[]) =>
      [...queryKeys.user.all, 'balances', exchanges.sort().join(',')] as const,
    apiKeys: () => [...queryKeys.user.all, 'api-keys'] as const,
  },
} as const;

/**
 * Type helper for extracting query key types
 */
export type QueryKeys = typeof queryKeys;
