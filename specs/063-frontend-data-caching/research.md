# Research: Frontend Data Caching

**Feature**: 063-frontend-data-caching
**Date**: 2026-01-14
**Status**: Complete

## Research Questions

### Q1: TanStack Query vs SWR - Which library to use?

**Decision**: TanStack Query v5

**Rationale**:
1. **Mutation 支援更完整** - 內建 `useMutation` 與 optimistic updates，適合交易操作
2. **DevTools** - 內建優秀的開發工具，可視化快取狀態
3. **TypeScript 型別推導** - 更好的泛型支援
4. **快取控制精細** - `gcTime`, `staleTime`, `invalidateQueries` 提供完整控制

**Alternatives Considered**:
- **SWR**: 更輕量（~4KB vs ~13KB），但 mutation 需手動實現
- **Zustand + fetch**: 完全控制但需重新發明輪子
- **RTK Query**: 過於重量級，且專案未使用 Redux

---

### Q2: Next.js App Router 整合模式

**Decision**: 使用官方推薦的 `getQueryClient()` 模式

**Rationale**:
根據 TanStack Query 官方文件，Next.js App Router 需要特殊處理：
- Server 端每個請求建立新的 QueryClient
- Client 端重複使用同一個 QueryClient
- 避免在初始渲染時使用 `useState` 初始化

**Implementation Pattern**:
```typescript
// lib/query-client.ts
import { isServer, QueryClient } from '@tanstack/react-query';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 minute default
        gcTime: 10 * 60 * 1000, // 10 minutes
        retry: 2,
        refetchOnWindowFocus: true,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient() {
  if (isServer) {
    return makeQueryClient();
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}
```

---

### Q3: WebSocket 即時更新與快取整合

**Decision**: 使用 `setQueryData` 直接更新快取

**Rationale**:
- WebSocket 訊息到達時，直接寫入 Query 快取
- 避免觸發 API 重新請求
- 保持 UI 即時響應

**Implementation Pattern**:
```typescript
// hooks/queries/useMarketRatesQuery.ts
function useMarketRatesQuery() {
  const queryClient = useQueryClient();

  // Initial data from REST
  const query = useQuery({
    queryKey: ['market', 'rates'],
    queryFn: fetchMarketRates,
    staleTime: 0, // Always stale since WS updates
  });

  // WebSocket updates cache directly
  useEffect(() => {
    const handleUpdate = (data: MarketRatesUpdate) => {
      queryClient.setQueryData(['market', 'rates'], (old) =>
        old ? mergeRatesUpdate(old, data) : data
      );
    };

    socket.on('rates:update', handleUpdate);
    return () => socket.off('rates:update', handleUpdate);
  }, [queryClient]);

  return query;
}
```

**Alternatives Considered**:
- **invalidateQueries on update**: 會觸發 API 請求，增加延遲
- **完全取代 REST**: 需要大幅重構，風險高

---

### Q4: 快取失效策略

**Decision**: 分層策略，依資料類型設定不同參數

**Rationale**:
交易平台資料有不同的時效性需求：
- 即時價格：需要最新，但 WebSocket 會更新
- 持倉列表：較穩定，但操作後需刷新
- 歷史資料：很少變動，可長時間快取

**Cache Time Configuration**:

| Data Type | staleTime | gcTime | Invalidation Strategy |
|-----------|-----------|--------|----------------------|
| Market Rates | 0 | 5 min | WebSocket setQueryData |
| Balances | 30 sec | 10 min | WebSocket + mutation onSuccess |
| Positions | 10 sec | 5 min | Mutation onSuccess invalidate |
| Trades | 5 min | 30 min | Mutation onSuccess invalidate |
| Asset History | 5 min | 30 min | Time range change invalidate |
| Settings | 5 min | 30 min | Mutation onSuccess |

---

### Q5: Query Key 架構

**Decision**: 使用工廠函數模式集中管理

**Rationale**:
- 避免 query key 字串散落各處
- TypeScript 自動補全支援
- 便於批次 invalidation

**Implementation Pattern**:
```typescript
// lib/query-keys.ts
export const queryKeys = {
  assets: {
    all: ['assets'] as const,
    balances: () => [...queryKeys.assets.all, 'balances'] as const,
    history: (days: number) => [...queryKeys.assets.all, 'history', days] as const,
  },
  trading: {
    all: ['trading'] as const,
    positions: () => [...queryKeys.trading.all, 'positions'] as const,
    position: (id: string) => [...queryKeys.trading.all, 'position', id] as const,
    trades: () => [...queryKeys.trading.all, 'trades'] as const,
  },
  market: {
    all: ['market'] as const,
    rates: () => [...queryKeys.market.all, 'rates'] as const,
  },
} as const;

// Usage
useQuery({ queryKey: queryKeys.trading.positions() });
queryClient.invalidateQueries({ queryKey: queryKeys.trading.all });
```

---

### Q6: Mutation 後快取同步

**Decision**: 使用 `invalidateQueries` + `setQueryData` 混合策略

**Rationale**:
- 開/平倉操作需要同時更新多個資料：持倉、餘額、交易歷史
- `invalidateQueries` 確保資料一致性
- `setQueryData` 可用於 optimistic updates（可選）

**Implementation Pattern**:
```typescript
// hooks/mutations/useOpenPositionMutation.ts
function useOpenPositionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: openPosition,
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.trading.positions() });
      queryClient.invalidateQueries({ queryKey: queryKeys.assets.all });
    },
    onError: (error) => {
      // Handle error, potentially rollback optimistic updates
    },
  });
}
```

---

## Key Findings Summary

1. **TanStack Query v5** 是最適合的選擇，提供完整的快取控制和 mutation 支援
2. **Next.js App Router** 需要特殊的 QueryClient 初始化模式
3. **WebSocket 更新** 應直接使用 `setQueryData` 寫入快取，避免重複請求
4. **快取策略** 需依資料類型分層設定 staleTime/gcTime
5. **Query Keys** 使用工廠函數模式管理，便於維護和 TypeScript 支援
6. **Mutation 同步** 使用 `invalidateQueries` 確保資料一致性

## Dependencies to Add

```json
{
  "@tanstack/react-query": "^5.60.0",
  "@tanstack/react-query-devtools": "^5.60.0"
}
```

## References

- [TanStack Query - Advanced SSR](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr)
- [TanStack Query - Optimistic Updates](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates)
- [TanStack Query - Updates from Mutation Responses](https://tanstack.com/query/latest/docs/framework/react/guides/updates-from-mutation-responses)
