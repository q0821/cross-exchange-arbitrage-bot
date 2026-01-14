# Quickstart: Frontend Data Caching

**Feature**: 063-frontend-data-caching
**Date**: 2026-01-14

## Prerequisites

```bash
# Install TanStack Query
pnpm add @tanstack/react-query @tanstack/react-query-devtools
```

## Step 1: Setup QueryClient

Create `lib/query-client.ts`:

```typescript
import { isServer, QueryClient } from '@tanstack/react-query';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        gcTime: 10 * 60 * 1000,
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

## Step 2: Setup Providers

Update `app/providers.tsx`:

```typescript
'use client';

import { ThemeProvider } from 'next-themes';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { getQueryClient } from '@/lib/query-client';

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system">
        {children}
      </ThemeProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

## Step 3: Create Query Keys

Create `lib/query-keys.ts`:

```typescript
export const queryKeys = {
  assets: {
    all: ['assets'] as const,
    balances: () => [...queryKeys.assets.all, 'balances'] as const,
    history: (days: number) => [...queryKeys.assets.all, 'history', days] as const,
  },
  trading: {
    all: ['trading'] as const,
    positions: () => [...queryKeys.trading.all, 'positions'] as const,
    trades: () => [...queryKeys.trading.all, 'trades'] as const,
  },
  market: {
    all: ['market'] as const,
    rates: () => [...queryKeys.market.all, 'rates'] as const,
  },
} as const;
```

## Step 4: Create Query Hooks

Example `hooks/queries/usePositionsQuery.ts`:

```typescript
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';

async function fetchPositions() {
  const response = await fetch('/api/positions');
  if (!response.ok) throw new Error('Failed to fetch positions');
  return response.json();
}

export function usePositionsQuery() {
  return useQuery({
    queryKey: queryKeys.trading.positions(),
    queryFn: fetchPositions,
    staleTime: 10 * 1000, // 10 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}
```

## Step 5: Create Mutation Hooks

Example `hooks/mutations/useOpenPositionMutation.ts`:

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';

async function openPosition(data: OpenPositionInput) {
  const response = await fetch('/api/positions/open', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to open position');
  return response.json();
}

export function useOpenPositionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: openPosition,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.trading.positions() });
      queryClient.invalidateQueries({ queryKey: queryKeys.assets.all });
    },
  });
}
```

## Step 6: Integrate WebSocket Updates

Example WebSocket integration in `hooks/queries/useMarketRatesQuery.ts`:

```typescript
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { queryKeys } from '@/lib/query-keys';
import { useWebSocket } from '@/hooks/useWebSocket';

export function useMarketRatesQuery() {
  const queryClient = useQueryClient();
  const { on, off, isConnected } = useWebSocket();

  const query = useQuery({
    queryKey: queryKeys.market.rates(),
    queryFn: fetchMarketRates,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!isConnected) return;

    const handleUpdate = (data: MarketRatesUpdate) => {
      queryClient.setQueryData(
        queryKeys.market.rates(),
        (old) => old ? mergeRates(old, data) : data
      );
    };

    on('rates:update', handleUpdate);
    return () => off('rates:update', handleUpdate);
  }, [isConnected, queryClient, on, off]);

  return { ...query, isConnected };
}
```

## Step 7: Use in Page Components

Example usage in `app/(dashboard)/positions/page.tsx`:

```typescript
'use client';

import { usePositionsQuery } from '@/hooks/queries/usePositionsQuery';
import { useClosePositionMutation } from '@/hooks/mutations/useClosePositionMutation';

export default function PositionsPage() {
  const { data, isLoading, error } = usePositionsQuery();
  const closePosition = useClosePositionMutation();

  if (isLoading) return <LoadingSkeleton />;
  if (error) return <ErrorDisplay error={error} />;

  const handleClose = (id: string) => {
    closePosition.mutate({ positionId: id });
  };

  return (
    <div>
      {data?.positions.map((position) => (
        <PositionCard
          key={position.id}
          position={position}
          onClose={() => handleClose(position.id)}
          isClosing={closePosition.isPending}
        />
      ))}
    </div>
  );
}
```

## Verification

After implementation, verify:

1. **DevTools**: Open React Query DevTools to see cached queries
2. **Network Tab**: Confirm reduced API calls on page navigation
3. **Page Transition**: Cached pages should load instantly (< 100ms)
4. **WebSocket**: Real-time updates should appear without refresh

## Troubleshooting

### Query not caching

- Check `queryKey` is consistent across components
- Verify `staleTime` is set appropriately

### WebSocket updates not reflecting

- Ensure `setQueryData` uses the exact same query key
- Check WebSocket connection status

### Memory growing

- Verify `gcTime` is set to clean up unused queries
- Check for infinite loops in useEffect
