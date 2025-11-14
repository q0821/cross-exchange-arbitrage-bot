# Quick Start Guide: 標準化資金費率時間與淨收益計算

**Feature**: 012-specify-scripts-bash
**Date**: 2025-01-15
**For**: 開發者實作此功能的快速入門指南

## Overview

本指南提供實作標準化資金費率和淨收益計算功能的步驟式說明，包含開發環境設定、關鍵檔案修改、測試和部署。

---

## Prerequisites

### Required Knowledge
- TypeScript 5.6+
- Next.js 14 App Router
- Socket.io WebSocket
- Decimal.js (financial calculations)
- React Hooks (useState, useMemo)

### Tools & Environment
- Node.js 20.x LTS
- pnpm 8+
- PostgreSQL 15+ (running via Docker Compose)
- Git

---

## Architecture Overview

```
┌───────────────────────────────────────────────────────────┐
│                CLI Monitor Process (src/services/monitor)  │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ 1. FundingRateMonitor (existing)                    │  │
│  │    - Fetch raw rates from exchanges                 │  │
│  │    ↓                                                 │  │
│  │ 2. FundingRateNormalizer (NEW)                      │  │
│  │    - Detect funding interval                        │  │
│  │    - Normalize to target time basis                 │  │
│  │    ↓                                                 │  │
│  │ 3. NetProfitCalculator (NEW)                        │  │
│  │    - Calculate rate difference                      │  │
│  │    - Subtract fees (0.2%)                           │  │
│  │    ↓                                                 │  │
│  │ 4. RatesCache.set() (existing)                      │  │
│  └─────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
                            ↓
┌───────────────────────────────────────────────────────────┐
│           WebSocket Server (src/services/websocket)       │
│  MarketRatesHandler.broadcastRates()                      │
│  - Emit "market-rates-update" with normalized data        │
└───────────────────────────────────────────────────────────┘
                            ↓ WebSocket
┌───────────────────────────────────────────────────────────┐
│               Browser Client (app/market-monitor)         │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ 1. useMarketRates hook (MODIFY)                     │  │
│  │    - Receive WebSocket updates                      │  │
│  │    - Store in ratesMap                              │  │
│  │    ↓                                                 │  │
│  │ 2. RatesTable (MODIFY)                              │  │
│  │    - Display normalizedRate with time basis label   │  │
│  │    - Show netProfit with color coding               │  │
│  │    - Support sorting by netProfit                   │  │
│  └─────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
```

---

## Step-by-Step Implementation

### Phase 1: Backend Services (CLI Monitor)

#### Step 1.1: Create `FundingRateNormalizer` Service

**File**: `src/services/monitor/FundingRateNormalizer.ts`

```typescript
import Decimal from 'decimal.js';
import { logger } from '@/lib/logger';

export interface NormalizedRate {
  originalRate: Decimal;
  originalFundingInterval: number; // hours
  targetTimeBasis: number; // hours
  normalizedRate: Decimal;
}

export class FundingRateNormalizer {
  /**
   * Normalize funding rate to target time basis
   */
  normalize(
    originalRate: Decimal,
    originalFundingInterval: number,
    targetTimeBasis: number = 8
  ): NormalizedRate {
    // Validate inputs
    if (originalFundingInterval <= 0) {
      logger.error({ originalFundingInterval }, 'Invalid funding interval');
      throw new Error('Invalid funding interval');
    }

    // If already at target basis, no conversion needed
    if (originalFundingInterval === targetTimeBasis) {
      return {
        originalRate,
        originalFundingInterval,
        targetTimeBasis,
        normalizedRate: originalRate,
      };
    }

    // Calculate normalization factor
    const factor = new Decimal(targetTimeBasis).div(originalFundingInterval);
    const normalizedRate = originalRate.mul(factor);

    logger.debug({
      originalRate: originalRate.toString(),
      originalFundingInterval,
      targetTimeBasis,
      normalizedRate: normalizedRate.toString(),
    }, 'Normalized funding rate');

    return {
      originalRate,
      originalFundingInterval,
      targetTimeBasis,
      normalizedRate,
    };
  }

  /**
   * Detect funding interval from exchange API response
   */
  detectInterval(exchange: string, data: any): number {
    if (exchange === 'binance') {
      // TODO: Calculate from nextFundingTime
      return 8; // Default for Binance
    } else if (exchange === 'okx') {
      // OKX provides fundingInterval field
      return this.parseFundingInterval(data.fundingInterval);
    }
    return 8; // Default fallback
  }

  private parseFundingInterval(interval: string): number {
    // Parse "8H" → 8, "1H" → 1, etc.
    const match = interval.match(/^(\d+)H$/);
    return match ? parseInt(match[1], 10) : 8;
  }
}
```

**Unit Test**: `tests/unit/FundingRateNormalizer.test.ts`

```typescript
import { FundingRateNormalizer } from '@/services/monitor/FundingRateNormalizer';
import Decimal from 'decimal.js';

describe('FundingRateNormalizer', () => {
  const normalizer = new FundingRateNormalizer();

  it('should normalize 1h rate to 8h basis', () => {
    const result = normalizer.normalize(
      new Decimal(0.0001), // 0.01% / hour
      1, // original interval
      8  // target basis
    );

    expect(result.normalizedRate.toString()).toBe('0.0008'); // 0.08% / 8h
  });

  it('should return original rate if already at target basis', () => {
    const result = normalizer.normalize(
      new Decimal(0.0008),
      8,
      8
    );

    expect(result.normalizedRate.toString()).toBe('0.0008');
  });
});
```

---

#### Step 1.2: Create `NetProfitCalculator` Service

**File**: `src/services/calculation/NetProfitCalculator.ts`

```typescript
import Decimal from 'decimal.js';
import { logger } from '@/lib/logger';

export interface NetProfitResult {
  symbol: string;
  longExchange: string;
  shortExchange: string;
  longRate: Decimal;
  shortRate: Decimal;
  rateDifference: Decimal;
  totalFees: Decimal;
  netProfit: Decimal;
}

export class NetProfitCalculator {
  private readonly DEFAULT_TAKER_FEE = new Decimal(0.0005); // 0.05%

  /**
   * Calculate net profit for an arbitrage pair
   */
  calculate(
    symbol: string,
    longExchange: string,
    shortExchange: string,
    longRate: Decimal,
    shortRate: Decimal,
    takerFeeRate: Decimal = this.DEFAULT_TAKER_FEE
  ): NetProfitResult {
    // Calculate rate difference (long - short)
    const rateDifference = longRate.sub(shortRate);

    // Calculate total fees (4 trades)
    const totalFees = takerFeeRate.mul(4);

    // Calculate net profit
    const netProfit = rateDifference.sub(totalFees);

    logger.debug({
      symbol,
      longExchange,
      shortExchange,
      rateDifference: rateDifference.toString(),
      totalFees: totalFees.toString(),
      netProfit: netProfit.toString(),
    }, 'Calculated net profit');

    return {
      symbol,
      longExchange,
      shortExchange,
      longRate,
      shortRate,
      rateDifference,
      totalFees,
      netProfit,
    };
  }

  /**
   * Find best arbitrage pair (highest net profit) for a symbol
   */
  findBestPair(
    symbol: string,
    rates: Map<string, Decimal> // key: exchange, value: normalized rate
  ): NetProfitResult | null {
    const exchanges = Array.from(rates.keys());
    let bestPair: NetProfitResult | null = null;
    let maxNetProfit = new Decimal(-Infinity);

    for (const longEx of exchanges) {
      for (const shortEx of exchanges) {
        if (longEx === shortEx) continue;

        const longRate = rates.get(longEx)!;
        const shortRate = rates.get(shortEx)!;

        const result = this.calculate(symbol, longEx, shortEx, longRate, shortRate);

        if (result.netProfit.greaterThan(maxNetProfit)) {
          maxNetProfit = result.netProfit;
          bestPair = result;
        }
      }
    }

    return bestPair;
  }
}
```

**Unit Test**: `tests/unit/NetProfitCalculator.test.ts`

```typescript
import { NetProfitCalculator } from '@/services/calculation/NetProfitCalculator';
import Decimal from 'decimal.js';

describe('NetProfitCalculator', () => {
  const calculator = new NetProfitCalculator();

  it('should calculate positive net profit', () => {
    const result = calculator.calculate(
      'BTCUSDT',
      'binance',
      'okx',
      new Decimal(0.0008), // long rate: 0.08% / 8h
      new Decimal(-0.0004), // short rate: -0.04% / 8h
      new Decimal(0.0005) // fee: 0.05%
    );

    expect(result.rateDifference.toString()).toBe('0.0012'); // 0.12%
    expect(result.totalFees.toString()).toBe('0.002'); // 0.2%
    expect(result.netProfit.toString()).toBe('0.001'); // 0.1% (profitable!)
  });

  it('should calculate negative net profit (unprofitable)', () => {
    const result = calculator.calculate(
      'ETHUSDT',
      'binance',
      'okx',
      new Decimal(0.0001),
      new Decimal(0.0001),
      new Decimal(0.0005)
    );

    expect(result.netProfit.toString()).toBe('-0.002'); // Negative (unprofitable)
  });
});
```

---

#### Step 1.3: Integrate into `FundingRateMonitor`

**File**: `src/services/monitor/FundingRateMonitor.ts` (MODIFY)

```typescript
import { FundingRateNormalizer } from './FundingRateNormalizer';
import { NetProfitCalculator } from '../calculation/NetProfitCalculator';

export class FundingRateMonitor {
  private normalizer: FundingRateNormalizer;
  private profitCalculator: NetProfitCalculator;

  constructor() {
    this.normalizer = new FundingRateNormalizer();
    this.profitCalculator = new NetProfitCalculator();
  }

  async fetchAndProcess() {
    // 1. Fetch raw rates (existing logic)
    const rawRates = await this.fetchRates();

    // 2. Normalize rates
    const normalizedRates = new Map<string, Decimal>();
    for (const [exchange, rate] of rawRates.entries()) {
      const interval = this.normalizer.detectInterval(exchange, rate);
      const normalized = this.normalizer.normalize(
        new Decimal(rate.fundingRate),
        interval,
        8 // Default target basis
      );
      normalizedRates.set(exchange, normalized.normalizedRate);
    }

    // 3. Calculate best arbitrage pair
    const bestPair = this.profitCalculator.findBestPair('BTCUSDT', normalizedRates);

    // 4. Store in cache for WebSocket broadcast
    this.ratesCache.set('BTCUSDT', {
      ...rawRates,
      normalizedRates,
      bestPair,
    });
  }
}
```

---

### Phase 2: WebSocket Server Extension

#### Step 2.1: Extend `MarketRatesHandler`

**File**: `src/services/websocket/MarketRatesHandler.ts` (MODIFY)

```typescript
export class MarketRatesHandler {
  broadcastRates(symbol: string) {
    const data = this.ratesCache.get(symbol);
    if (!data) return;

    const payload: MarketRatesUpdatePayload = {
      // Existing fields
      exchange: data.exchange,
      symbol: data.symbol,
      fundingRate: data.fundingRate.toString(),
      nextFundingTime: data.nextFundingTime.toISOString(),

      // NEW fields
      normalizedRate: data.normalizedRate?.toString(),
      originalFundingInterval: data.originalFundingInterval,
      targetTimeBasis: 8,

      bestArbitragePair: data.bestPair ? {
        longExchange: data.bestPair.longExchange,
        shortExchange: data.bestPair.shortExchange,
        longRate: data.bestPair.longRate.toString(),
        shortRate: data.bestPair.shortRate.toString(),
        rateDifference: data.bestPair.rateDifference.toString(),
        netProfit: data.bestPair.netProfit.toString(),
        netProfitDetails: {
          rateDifference: data.bestPair.rateDifference.toString(),
          totalFees: data.bestPair.totalFees.toString(),
          netProfit: data.bestPair.netProfit.toString(),
        },
      } : undefined,
    };

    this.io.emit('market-rates-update', payload);
  }
}
```

---

### Phase 3: Frontend Changes

#### Step 3.1: Update `useMarketRates` Hook

**File**: `app/(dashboard)/market-monitor/useMarketRates.ts` (MODIFY)

```typescript
// Add new fields to MarketRate type
export interface MarketRate {
  exchange: string;
  symbol: string;
  fundingRate: string;
  normalizedRate?: string; // NEW
  originalFundingInterval?: number; // NEW
  bestArbitragePair?: { // NEW
    longExchange: string;
    shortExchange: string;
    netProfit: string;
    netProfitDetails: {
      rateDifference: string;
      totalFees: string;
      netProfit: string;
    };
  };
}

export function useMarketRates() {
  // Handle new fields in WebSocket update
  useEffect(() => {
    socket.on('market-rates-update', (data: MarketRate) => {
      setRatesMap(prev => {
        const updated = new Map(prev);
        const key = `${data.exchange}:${data.symbol}`;
        updated.set(key, data); // Store entire payload including new fields
        return updated;
      });
    });
  }, []);

  return { ratesMap, /* ... */ };
}
```

#### Step 3.2: Update `RatesTable` Component

**File**: `app/(dashboard)/market-monitor/components/RatesTable.tsx` (MODIFY)

```tsx
export function RatesTable({ rates }: { rates: MarketRate[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Symbol</th>
          <th>Exchange</th>
          <th>Funding Rate (per 8h)</th> {/* Updated label */}
          <th>Net Profit</th> {/* NEW column */}
        </tr>
      </thead>
      <tbody>
        {rates.map(rate => (
          <RateRow key={`${rate.exchange}:${rate.symbol}`} rate={rate} />
        ))}
      </tbody>
    </table>
  );
}
```

#### Step 3.3: Update `RateRow` Component

**File**: `app/(dashboard)/market-monitor/components/RateRow.tsx` (MODIFY)

```tsx
import { Tooltip } from '@radix-ui/react-tooltip';

export function RateRow({ rate }: { rate: MarketRate }) {
  const displayRate = rate.normalizedRate ?? rate.fundingRate;
  const netProfit = rate.bestArbitragePair?.netProfit;
  const isNegative = netProfit && parseFloat(netProfit) < 0;

  return (
    <tr>
      <td>{rate.symbol}</td>
      <td>{rate.exchange}</td>
      <td>
        <Tooltip content={`Original: ${rate.fundingRate} (${rate.originalFundingInterval}h)`}>
          {displayRate} (8h)
        </Tooltip>
      </td>
      <td className={isNegative ? 'text-red-500' : 'text-green-500'}>
        {netProfit ?? '—'}
      </td>
    </tr>
  );
}
```

---

## Running & Testing

### Development

```bash
# 1. Start PostgreSQL + Redis
pnpm docker:up

# 2. Run migrations (if any schema changes)
pnpm db:migrate

# 3. Start development server
pnpm dev
```

### Unit Tests

```bash
pnpm test src/services/monitor/FundingRateNormalizer.test.ts
pnpm test src/services/calculation/NetProfitCalculator.test.ts
```

### Integration Tests

```bash
pnpm test tests/integration/normalized-rates-websocket.test.ts
```

### E2E Tests

```bash
pnpm test:e2e tests/e2e/market-monitor-sorting.spec.ts
```

---

## Deployment Checklist

- [ ] All unit tests passing
- [ ] Integration tests passing
- [ ] E2E tests passing
- [ ] TypeScript no errors
- [ ] ESLint passing
- [ ] Manual testing: Verify normalized rates display correctly
- [ ] Manual testing: Verify net profit calculations are accurate
- [ ] Manual testing: Verify sorting by net profit works
- [ ] Constitution Check: Re-evaluated and passing
- [ ] Performance: WebSocket updates < 5s delay
- [ ] Backward compatibility: OLD clients still work

---

## Troubleshooting

### Issue: Normalized rate shows "NaN"
**Cause**: Division by zero (originalFundingInterval = 0)
**Solution**: Add validation in `FundingRateNormalizer.normalize()`

### Issue: Net profit always negative
**Cause**: Fee rate too high or rate difference too small
**Solution**: Check takerFeeRate (should be 0.0005, not 0.05)

### Issue: WebSocket not receiving new fields
**Cause**: Server not emitting extended payload
**Solution**: Verify `MarketRatesHandler.broadcastRates()` includes new fields

---

## Next Steps

After completing this feature:

1. Run `/speckit.tasks` to generate implementation tasks
2. Implement tasks in priority order (User Story 1 → 2 → 3)
3. Monitor production logs for calculation errors
4. Gather user feedback on net profit accuracy

---

## References

- [Feature Spec](./spec.md)
- [Data Model](./data-model.md)
- [WebSocket Contract](./contracts/websocket.md)
- [Research Document](./research.md)
- Constitution: Principle VI (Architecture Boundaries)

