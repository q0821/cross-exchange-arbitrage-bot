# Data Model: 標準化資金費率時間與淨收益計算

**Feature**: 012-specify-scripts-bash
**Date**: 2025-01-15
**Status**: Completed

## Overview

本文件定義標準化資金費率和淨收益計算功能所需的資料結構。此功能主要在 **runtime** 計算標準化費率和淨收益，不新增資料庫表格，但會擴展現有的 WebSocket 資料結構和前端 state。

## Entity Definitions

### 1. NormalizedFundingRate (Runtime Entity)

**描述**: 標準化後的資金費率，包含原始費率、標準化費率、結算週期等資訊

**欄位**:

| Field | Type | Required | Description | Validation |
|-------|------|----------|-------------|------------|
| exchange | string | ✓ | 交易所名稱 | "binance" \| "okx" \| "mexc" \| "gateio" |
| symbol | string | ✓ | 交易對符號 | 格式: `[BASE][QUOTE]` (例: "BTCUSDT") |
| originalRate | Decimal | ✓ | 原始資金費率 | 任意 decimal 值 |
| originalFundingInterval | number | ✓ | 原始結算週期（小時） | 1 \| 4 \| 8 \| 24 |
| targetTimeBasis | number | ✓ | 目標時間基準（小時） | 1 \| 8 \| 24 |
| normalizedRate | Decimal | ✓ | 標準化後費率 | `originalRate × (targetTimeBasis / originalFundingInterval)` |
| timestamp | Date | ✓ | 費率取得時間 | ISO 8601 timestamp |

**Relationships**:
- 無資料庫持久化（Runtime only）
- 由 `FundingRateNormalizer` 服務計算
- 傳遞給 WebSocket 廣播

**State Transitions**: N/A (無狀態轉換)

---

### 2. NetProfitCalculation (Runtime Entity)

**描述**: 淨收益計算結果，包含費率差、手續費、淨收益等詳細資訊

**欄位**:

| Field | Type | Required | Description | Validation |
|-------|------|----------|-------------|------------|
| symbol | string | ✓ | 交易對符號 | 格式: `[BASE][QUOTE]` |
| longExchange | string | ✓ | 做多交易所 | exchange name |
| shortExchange | string | ✓ | 做空交易所 | exchange name |
| longRate | Decimal | ✓ | 做多方標準化費率 | 已標準化為相同時間基準 |
| shortRate | Decimal | ✓ | 做空方標準化費率 | 已標準化為相同時間基準 |
| rateDifference | Decimal | ✓ | 費率差（long - short） | |
| takerFeeRate | Decimal | ✓ | 單筆交易手續費率 | 預設 0.0005 (0.05%) |
| totalFees | Decimal | ✓ | 總手續費（4筆交易） | `takerFeeRate × 4` |
| netProfit | Decimal | ✓ | 淨收益 | `rateDifference - totalFees` |
| timestamp | Date | ✓ | 計算時間 | ISO 8601 timestamp |

**Relationships**:
- 無資料庫持久化（Runtime only）
- 由 `NetProfitCalculator` 服務計算
- 傳遞給 WebSocket 廣播

**Calculation Formula**:
```
netProfit = (longRate - shortRate) - (takerFeeRate × 4)
```

**State Transitions**: N/A (無狀態轉換)

---

### 3. UserTimeBasisPreference (Frontend State)

**描述**: 用戶選擇的時間基準偏好，儲存在 localStorage

**欄位**:

| Field | Type | Required | Description | Default |
|-------|------|----------|-------------|---------|
| timeBasis | number | ✓ | 用戶選擇的時間基準（小時） | 8 |

**Storage**:
- Frontend: `localStorage` (key: `"market-monitor-time-basis"`)
- Future: `UserPreferences` model in database (Phase 2)

**Validation**:
- Must be one of: 1, 8, 24
- If invalid value in localStorage, fallback to default (8)

---

## Data Structures

### WebSocket Event: `market-rates-update` (Extended)

**現有欄位** (向後相容):
```typescript
interface MarketRateUpdate {
  exchange: string;
  symbol: string;
  fundingRate: string; // Original rate (Decimal as string)
  nextFundingTime: string; // ISO 8601
  markPrice?: string;
  indexPrice?: string;
}
```

**新增欄位** (選填，向後相容):
```typescript
interface MarketRateUpdate {
  // ... existing fields

  // NEW: Normalized rate fields
  normalizedRate?: string; // Decimal as string
  originalFundingInterval?: number; // 1 | 4 | 8 | 24
  targetTimeBasis?: number; // 1 | 8 | 24

  // NEW: Net profit fields
  bestArbitragePair?: {
    longExchange: string;
    shortExchange: string;
    rateDifference: string; // Decimal as string
    netProfit: string; // Decimal as string
    netProfitDetails: {
      rateDifference: string;
      totalFees: string;
      netProfit: string;
    };
  };
}
```

---

### Frontend State: `MarketRatesState`

```typescript
interface MarketRatesState {
  // Existing state
  rates: Map<string, MarketRateUpdate>; // key: `${exchange}:${symbol}`
  connected: boolean;
  lastUpdate: Date | null;

  // NEW: User preferences
  timeBasis: 1 | 8 | 24; // User-selected time basis

  // NEW: Sorting (similar to Feature 009)
  sortBy: 'symbol' | 'rateDiff' | 'netProfit';
  sortDirection: 'asc' | 'desc';
}
```

---

## Validation Rules

### 1. Funding Rate Normalization

**Input Validation**:
```typescript
const FundingRateInputSchema = z.object({
  originalRate: z.string().refine((val) => !isNaN(parseFloat(val))),
  originalFundingInterval: z.union([z.literal(1), z.literal(4), z.literal(8), z.literal(24)]),
  targetTimeBasis: z.union([z.literal(1), z.literal(8), z.literal(24)]),
});
```

**Business Rules**:
- If `originalFundingInterval === targetTimeBasis`, return `originalRate` (no conversion)
- If `originalFundingInterval === 0`, throw error (invalid interval)
- Result precision: keep full Decimal precision, round only for display

---

### 2. Net Profit Calculation

**Input Validation**:
```typescript
const NetProfitInputSchema = z.object({
  longRate: z.string().refine((val) => !isNaN(parseFloat(val))),
  shortRate: z.string().refine((val) => !isNaN(parseFloat(val))),
  takerFeeRate: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num >= 0 && num <= 0.01; // Max 1%
  }),
});
```

**Business Rules**:
- Both rates must be normalized to same time basis before calculation
- `takerFeeRate` default: 0.0005 (0.05%)
- `totalFees = takerFeeRate × 4` (4 trades)
- `netProfit` can be negative (indicates unprofitable opportunity)

---

### 3. Time Basis Selection

**Input Validation**:
```typescript
const TimeBasisSchema = z.union([z.literal(1), z.literal(8), z.literal(24)]);
```

**Business Rules**:
- Must be one of predefined values (1h, 8h, 24h)
- If localStorage contains invalid value, use default (8)
- Changes to time basis trigger re-calculation of all displayed rates

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLI Monitor Process                          │
│                                                                 │
│  1. Fetch raw funding rates from exchanges                     │
│     ↓                                                           │
│  2. Detect funding interval (1h/4h/8h/24h)                    │
│     ↓                                                           │
│  3. FundingRateNormalizer.normalize()                          │
│     - Read targetTimeBasis from default (8h) or user pref      │
│     - Calculate normalizedRate                                  │
│     ↓                                                           │
│  4. NetProfitCalculator.calculate()                            │
│     - Find best arbitrage pair (max rate difference)           │
│     - Calculate netProfit                                       │
│     ↓                                                           │
│  5. Store in memory cache (RatesCache)                         │
│     ↓                                                           │
│  6. WebSocket Server broadcast "market-rates-update"           │
└─────────────────────────────────────────────────────────────────┘
                            ↓ WebSocket
┌─────────────────────────────────────────────────────────────────┐
│                    Browser Client (React)                       │
│                                                                 │
│  1. useMarketRates hook receives update                        │
│     ↓                                                           │
│  2. Update ratesMap state (Map<string, MarketRateUpdate>)     │
│     ↓                                                           │
│  3. useMemo: sort rates by user selection                      │
│     ↓                                                           │
│  4. RatesTable renders with normalized rates                   │
│     - Display normalizedRate with time basis label             │
│     - Display netProfit with color coding (red if negative)    │
│     - Show tooltip with calculation details                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Schema Changes

### Database: 無變更（Phase 1）

- **不新增資料表**：所有計算在 runtime 進行
- **不修改現有 schema**：保持向後相容
- **Future (Phase 2)**：可能新增 `UserPreferences` table

```prisma
// FUTURE: Phase 2 enhancement (NOT in current scope)
model UserPreferences {
  id               String   @id @default(cuid())
  userId           String   @unique
  timeBasisHours   Int      @default(8) // 1 | 8 | 24
  defaultTakerFee  Decimal  @default(0.0005) @db.Decimal(10, 8)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("user_preferences")
}
```

---

## Error Handling

### Funding Rate Normalization Errors

| Error Scenario | Handling | User Impact |
|----------------|----------|-------------|
| Invalid `originalFundingInterval` | Log error, fallback to `originalRate` | Display original rate with warning icon |
| Calculation overflow | Log error, return null | Show "N/A" for normalized rate |
| Exchange API down | Use last known good rate | Display "Stale data" indicator |

### Net Profit Calculation Errors

| Error Scenario | Handling | User Impact |
|----------------|----------|-------------|
| Missing rate data | Skip net profit calculation | Show "—" for net profit |
| Negative net profit | Normal case (unprofitable) | Display in red with warning |
| Calculation error | Log error, return null | Show "N/A" for net profit |

---

## Testing Fixtures

### Example: Normalized Rate
```typescript
const mockNormalizedRate: NormalizedFundingRate = {
  exchange: "binance",
  symbol: "BTCUSDT",
  originalRate: new Decimal(0.0001), // 0.01% per hour
  originalFundingInterval: 1, // 1 hour
  targetTimeBasis: 8, // User wants 8-hour basis
  normalizedRate: new Decimal(0.0008), // 0.08% per 8 hours
  timestamp: new Date("2025-01-15T00:00:00Z"),
};
```

### Example: Net Profit
```typescript
const mockNetProfit: NetProfitCalculation = {
  symbol: "BTCUSDT",
  longExchange: "binance",
  shortExchange: "okx",
  longRate: new Decimal(0.0008), // 0.08% / 8h
  shortRate: new Decimal(-0.0004), // -0.04% / 8h
  rateDifference: new Decimal(0.0012), // 0.12% / 8h
  takerFeeRate: new Decimal(0.0005), // 0.05%
  totalFees: new Decimal(0.002), // 0.2% (4 trades)
  netProfit: new Decimal(0.001), // 0.1% / 8h (profitable!)
  timestamp: new Date("2025-01-15T00:00:00Z"),
};
```

---

## References

- Decimal.js: https://mikemcl.github.io/decimal.js/
- Zod validation: https://zod.dev/
- Feature 009 (sorting pattern): `/specs/009-specify-scripts-bash/data-model.md`
- Constitution Principle IV: Data Integrity

