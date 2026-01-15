/**
 * Query Hooks Contracts
 *
 * Feature: 063-frontend-data-caching
 * Date: 2026-01-14
 *
 * This file defines the TypeScript interfaces for all query and mutation hooks.
 * These contracts serve as the API specification for frontend data fetching.
 */

import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query';

// ============================================================================
// Query Keys Factory
// ============================================================================

export interface QueryKeys {
  assets: {
    all: readonly ['assets'];
    balances: () => readonly ['assets', 'balances'];
    history: (days: number) => readonly ['assets', 'history', number];
    positions: () => readonly ['assets', 'positions'];
  };
  trading: {
    all: readonly ['trading'];
    positions: () => readonly ['trading', 'positions'];
    position: (id: string) => readonly ['trading', 'position', string];
    trades: () => readonly ['trading', 'trades'];
    settings: () => readonly ['trading', 'settings'];
  };
  market: {
    all: readonly ['market'];
    rates: () => readonly ['market', 'rates'];
    symbolGroups: () => readonly ['market', 'symbol-groups'];
  };
  user: {
    all: readonly ['user'];
    balances: (exchanges: string[]) => readonly ['user', 'balances', string];
    apiKeys: () => readonly ['user', 'api-keys'];
  };
}

// ============================================================================
// Data Types
// ============================================================================

export interface ExchangeBalance {
  name: string;
  balanceUSD: number;
  status: 'connected' | 'disconnected' | 'error';
}

export interface AssetsData {
  totalUSD: number;
  exchanges: ExchangeBalance[];
  lastUpdate: string;
}

export interface AssetSnapshot {
  timestamp: string;
  totalUSD: number;
  breakdown: Record<string, number>;
}

export interface AssetHistoryData {
  days: number;
  snapshots: AssetSnapshot[];
}

export interface Position {
  id: string;
  symbol: string;
  longExchange: string;
  shortExchange: string;
  quantity: number;
  entrySpread: number;
  currentSpread: number;
  unrealizedPnL: number;
  status: 'OPEN' | 'CLOSING' | 'CLOSED';
  createdAt: string;
}

export interface PositionsData {
  positions: Position[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Trade {
  id: string;
  positionId: string;
  symbol: string;
  pnl: number;
  holdDuration: number;
  closedAt: string;
}

export interface TradesData {
  trades: Trade[];
  total: number;
}

export interface ExchangeRate {
  fundingRate: number;
  nextFundingTime: string;
  markPrice: number;
  indexPrice: number;
}

export interface SymbolRate {
  symbol: string;
  exchanges: Record<string, ExchangeRate>;
  bestSpread: number;
  bestPair: {
    long: string;
    short: string;
  };
}

export interface MarketRatesData {
  rates: Map<string, SymbolRate>;
  lastUpdate: string;
}

export interface TradingSettingsData {
  defaultStopLossEnabled: boolean;
  defaultStopLossPercent: number;
  defaultTakeProfitEnabled: boolean;
  defaultTakeProfitPercent: number;
  defaultLeverage: number;
  maxPositionSizeUSD: number;
}

// ============================================================================
// Query Hook Interfaces
// ============================================================================

/**
 * useAssetsQuery - Fetch user assets summary
 *
 * Endpoint: GET /api/assets
 * Cache: staleTime=30s, gcTime=10m
 * Real-time: WebSocket balance:update
 */
export type UseAssetsQueryResult = UseQueryResult<AssetsData, Error>;

/**
 * useAssetHistoryQuery - Fetch asset history snapshots
 *
 * Endpoint: GET /api/assets/history?days={days}
 * Cache: staleTime=5m, gcTime=30m
 */
export type UseAssetHistoryQueryResult = UseQueryResult<AssetHistoryData, Error>;

/**
 * usePositionsQuery - Fetch open positions list
 *
 * Endpoint: GET /api/positions
 * Cache: staleTime=10s, gcTime=5m
 */
export type UsePositionsQueryResult = UseQueryResult<PositionsData, Error>;

/**
 * useTradesQuery - Fetch trade history
 *
 * Endpoint: GET /api/trades
 * Cache: staleTime=5m, gcTime=30m
 */
export type UseTradesQueryResult = UseQueryResult<TradesData, Error>;

/**
 * useMarketRatesQuery - Fetch market funding rates
 *
 * Endpoint: GET /api/market-rates
 * Cache: staleTime=0, gcTime=5m
 * Real-time: WebSocket rates:update via setQueryData
 */
export interface UseMarketRatesQueryResult extends UseQueryResult<MarketRatesData, Error> {
  isConnected: boolean; // WebSocket connection status
}

/**
 * useTradingSettingsQuery - Fetch user trading settings
 *
 * Endpoint: GET /api/settings/trading
 * Cache: staleTime=5m, gcTime=30m
 */
export type UseTradingSettingsQueryResult = UseQueryResult<TradingSettingsData, Error>;

// ============================================================================
// Mutation Interfaces
// ============================================================================

export interface OpenPositionInput {
  symbol: string;
  longExchange: string;
  shortExchange: string;
  quantity: number;
  stopLossEnabled?: boolean;
  stopLossPercent?: number;
  takeProfitEnabled?: boolean;
  takeProfitPercent?: number;
}

export interface OpenPositionResult {
  positionId: string;
  status: 'success' | 'partial' | 'failed';
  longOrderId?: string;
  shortOrderId?: string;
  error?: string;
}

/**
 * useOpenPositionMutation - Open a new arbitrage position
 *
 * Endpoint: POST /api/positions/open
 * Invalidates: trading.positions, assets.all
 */
export type UseOpenPositionMutationResult = UseMutationResult<
  OpenPositionResult,
  Error,
  OpenPositionInput
>;

export interface ClosePositionInput {
  positionId: string;
}

export interface ClosePositionResult {
  positionId: string;
  status: 'success' | 'partial' | 'failed';
  pnl?: number;
  error?: string;
}

/**
 * useClosePositionMutation - Close an existing position
 *
 * Endpoint: POST /api/positions/{id}/close
 * Invalidates: trading.positions, trading.trades, assets.all
 */
export type UseClosePositionMutationResult = UseMutationResult<
  ClosePositionResult,
  Error,
  ClosePositionInput
>;

// ============================================================================
// Hook Function Signatures
// ============================================================================

export interface QueryHooks {
  // Queries
  useAssetsQuery: () => UseAssetsQueryResult;
  useAssetHistoryQuery: (days: number) => UseAssetHistoryQueryResult;
  usePositionsQuery: () => UsePositionsQueryResult;
  useTradesQuery: () => UseTradesQueryResult;
  useMarketRatesQuery: () => UseMarketRatesQueryResult;
  useTradingSettingsQuery: () => UseTradingSettingsQueryResult;

  // Mutations
  useOpenPositionMutation: () => UseOpenPositionMutationResult;
  useClosePositionMutation: () => UseClosePositionMutationResult;
}
