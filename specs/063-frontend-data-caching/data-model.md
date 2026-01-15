# Data Model: Frontend Data Caching

**Feature**: 063-frontend-data-caching
**Date**: 2026-01-14

## Overview

此功能不涉及資料庫 schema 變更。資料模型定義的是**客戶端快取結構**和**快取策略**。

## Cache Key Architecture

### Query Key Hierarchy

```
root
├── assets
│   ├── balances      → useAssetsQuery
│   ├── history       → useAssetHistoryQuery(days)
│   └── positions     → useAssetPositionsQuery
├── trading
│   ├── positions     → usePositionsQuery
│   ├── position      → usePositionQuery(id)
│   ├── trades        → useTradesQuery
│   └── settings      → useTradingSettingsQuery
├── market
│   └── rates         → useMarketRatesQuery
└── user
    ├── balances      → useBalancesQuery(exchanges)
    └── api-keys      → useApiKeysQuery
```

## Cached Data Types

### 1. AssetsData

```typescript
interface AssetsData {
  totalUSD: number;
  exchanges: {
    name: string;
    balanceUSD: number;
    status: 'connected' | 'disconnected' | 'error';
  }[];
  lastUpdate: string;
}
```

**Cache Policy**:
- staleTime: 30 seconds
- gcTime: 10 minutes
- Invalidation: WebSocket `balance:update`, mutation success

---

### 2. AssetHistoryData

```typescript
interface AssetHistoryData {
  days: number;
  snapshots: {
    timestamp: string;
    totalUSD: number;
    breakdown: Record<string, number>;
  }[];
}
```

**Cache Policy**:
- staleTime: 5 minutes
- gcTime: 30 minutes
- Invalidation: Time range change

---

### 3. PositionsData

```typescript
interface PositionsData {
  positions: Position[];
  total: number;
  page: number;
  pageSize: number;
}

interface Position {
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
```

**Cache Policy**:
- staleTime: 10 seconds
- gcTime: 5 minutes
- Invalidation: Open/close mutation success

---

### 4. TradesData

```typescript
interface TradesData {
  trades: Trade[];
  total: number;
}

interface Trade {
  id: string;
  positionId: string;
  symbol: string;
  pnl: number;
  holdDuration: number;
  closedAt: string;
}
```

**Cache Policy**:
- staleTime: 5 minutes
- gcTime: 30 minutes
- Invalidation: Close position mutation success

---

### 5. MarketRatesData

```typescript
interface MarketRatesData {
  rates: Map<string, SymbolRate>;
  lastUpdate: string;
}

interface SymbolRate {
  symbol: string;
  exchanges: Record<string, ExchangeRate>;
  bestSpread: number;
  bestPair: {
    long: string;
    short: string;
  };
}

interface ExchangeRate {
  fundingRate: number;
  nextFundingTime: string;
  markPrice: number;
  indexPrice: number;
}
```

**Cache Policy**:
- staleTime: 0 (always stale, WebSocket provides real-time)
- gcTime: 5 minutes
- Update: WebSocket `rates:update` via setQueryData

---

### 6. TradingSettingsData

```typescript
interface TradingSettingsData {
  defaultStopLossEnabled: boolean;
  defaultStopLossPercent: number;
  defaultTakeProfitEnabled: boolean;
  defaultTakeProfitPercent: number;
  defaultLeverage: number;
  maxPositionSizeUSD: number;
}
```

**Cache Policy**:
- staleTime: 5 minutes
- gcTime: 30 minutes
- Invalidation: Settings mutation success

---

## Cache Strategy Summary

| Query Key | staleTime | gcTime | Real-time | Invalidation Triggers |
|-----------|-----------|--------|-----------|----------------------|
| assets.balances | 30s | 10m | WebSocket | balance:update, mutations |
| assets.history | 5m | 30m | No | time range change |
| assets.positions | 30s | 10m | No | position mutations |
| trading.positions | 10s | 5m | No | open/close mutations |
| trading.trades | 5m | 30m | No | close mutation |
| trading.settings | 5m | 30m | No | settings mutation |
| market.rates | 0 | 5m | WebSocket | - |
| user.balances | 30s | 10m | WebSocket | balance:update |

## State Transitions

### Position Lifecycle

```
[No Position]
    ↓ openPositionMutation.mutate()
[PENDING]
    ↓ success
[OPEN] → invalidateQueries(['trading', 'positions'])
       → invalidateQueries(['assets'])
    ↓ closePositionMutation.mutate()
[CLOSING]
    ↓ success
[CLOSED] → invalidateQueries(['trading', 'positions'])
         → invalidateQueries(['trading', 'trades'])
         → invalidateQueries(['assets'])
```

## Memory Management

### Garbage Collection Strategy

- **Default gcTime**: 10 minutes for active data
- **Long-term data**: 30 minutes (history, trades)
- **Real-time data**: 5 minutes (rates, refreshed via WebSocket)

### Memory Budget

- Target: < 50MB browser memory for cache
- Estimated per-page data: 500KB - 2MB
- Maximum cached queries: ~20 unique keys
