# Data Model: ArbitrageOpportunity 即時追蹤記錄

**Feature**: 065-arbitrage-opportunity-tracking
**Date**: 2026-01-18
**Status**: Design Complete

## Entity Relationship Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                      ArbitrageOpportunity                        │
├──────────────────────────────────────────────────────────────────┤
│  id                    String        PK, CUID                    │
│  ─────────────────────────────────────────────────────────────── │
│  symbol                String(20)    交易對符號                   │
│  longExchange          String(20)    做多交易所                   │
│  shortExchange         String(20)    做空交易所                   │
│  ─────────────────────────────────────────────────────────────── │
│  status                Enum          ACTIVE | ENDED              │
│  ─────────────────────────────────────────────────────────────── │
│  detectedAt            DateTime      發現時間                     │
│  endedAt               DateTime?     結束時間                     │
│  durationMs            BigInt?       持續時間（毫秒）             │
│  ─────────────────────────────────────────────────────────────── │
│  initialSpread         Decimal(10,6) 初始費差 %                   │
│  maxSpread             Decimal(10,6) 最大費差 %                   │
│  maxSpreadAt           DateTime      最大費差時間                 │
│  currentSpread         Decimal(10,6) 當前/最終費差 %              │
│  ─────────────────────────────────────────────────────────────── │
│  initialAPY            Decimal(10,2) 初始年化報酬 %               │
│  maxAPY                Decimal(10,2) 最大年化報酬 %               │
│  currentAPY            Decimal(10,2) 當前/最終年化報酬 %          │
│  ─────────────────────────────────────────────────────────────── │
│  longIntervalHours     SmallInt      做多交易所結算週期（小時）   │
│  shortIntervalHours    SmallInt      做空交易所結算週期（小時）   │
│  ─────────────────────────────────────────────────────────────── │
│  createdAt             DateTime      建立時間                     │
│  updatedAt             DateTime      更新時間                     │
├──────────────────────────────────────────────────────────────────┤
│  UNIQUE(symbol, longExchange, shortExchange, status)             │
│  INDEX(status)                                                   │
│  INDEX(detectedAt DESC)                                          │
│  INDEX(endedAt DESC)                                             │
└──────────────────────────────────────────────────────────────────┘
```

## Prisma Schema

```prisma
// ===== 套利機會即時追蹤 (Feature 065) =====
model ArbitrageOpportunity {
  id                String            @id @default(cuid())

  // 識別資訊
  symbol            String            @db.VarChar(20)
  longExchange      String            @db.VarChar(20)
  shortExchange     String            @db.VarChar(20)

  // 狀態
  status            OpportunityStatus @default(ACTIVE)

  // 時間資訊
  detectedAt        DateTime          @default(now()) @db.Timestamptz
  endedAt           DateTime?         @db.Timestamptz
  durationMs        BigInt?

  // 費差統計
  initialSpread     Decimal           @db.Decimal(10, 6)
  maxSpread         Decimal           @db.Decimal(10, 6)
  maxSpreadAt       DateTime          @db.Timestamptz
  currentSpread     Decimal           @db.Decimal(10, 6)

  // 年化報酬
  initialAPY        Decimal           @db.Decimal(10, 2)
  maxAPY            Decimal           @db.Decimal(10, 2)
  currentAPY        Decimal           @db.Decimal(10, 2)

  // 費率結算週期
  longIntervalHours   Int             @db.SmallInt
  shortIntervalHours  Int             @db.SmallInt

  createdAt         DateTime          @default(now()) @db.Timestamptz
  updatedAt         DateTime          @updatedAt @db.Timestamptz

  @@unique([symbol, longExchange, shortExchange, status])
  @@index([status])
  @@index([detectedAt(sort: Desc)])
  @@index([endedAt(sort: Desc)])
  @@map("arbitrage_opportunities")
}

enum OpportunityStatus {
  ACTIVE  // 進行中
  ENDED   // 已結束

  @@map("opportunity_status")
}
```

## 欄位說明

### 識別欄位

| 欄位 | 類型 | 說明 |
|------|------|------|
| `id` | String (CUID) | 主鍵，自動生成 |
| `symbol` | String(20) | 交易對符號，如 `BTCUSDT` |
| `longExchange` | String(20) | 做多（收取資金費率）交易所 |
| `shortExchange` | String(20) | 做空（支付資金費率）交易所 |

### 狀態欄位

| 欄位 | 類型 | 說明 |
|------|------|------|
| `status` | Enum | `ACTIVE`（進行中）或 `ENDED`（已結束） |

### 時間欄位

| 欄位 | 類型 | 說明 |
|------|------|------|
| `detectedAt` | DateTime | 機會被偵測到的時間 |
| `endedAt` | DateTime? | 機會結束的時間（進行中為 null） |
| `durationMs` | BigInt? | 持續時間，毫秒（結束時計算） |

### 費差統計欄位

| 欄位 | 類型 | 說明 |
|------|------|------|
| `initialSpread` | Decimal(10,6) | 初始費差百分比 |
| `maxSpread` | Decimal(10,6) | 最大費差百分比 |
| `maxSpreadAt` | DateTime | 達到最大費差的時間 |
| `currentSpread` | Decimal(10,6) | 當前費差（進行中）或最終費差（已結束） |

### 年化報酬欄位

| 欄位 | 類型 | 說明 |
|------|------|------|
| `initialAPY` | Decimal(10,2) | 初始年化報酬百分比 |
| `maxAPY` | Decimal(10,2) | 最大年化報酬百分比 |
| `currentAPY` | Decimal(10,2) | 當前/最終年化報酬百分比 |

### 費率週期欄位

| 欄位 | 類型 | 說明 |
|------|------|------|
| `longIntervalHours` | SmallInt | 做多交易所的費率結算週期（小時） |
| `shortIntervalHours` | SmallInt | 做空交易所的費率結算週期（小時） |

## 約束與索引

### 唯一性約束

```sql
UNIQUE(symbol, longExchange, shortExchange, status)
```

確保同一組合只有一個 `ACTIVE` 狀態的記錄。

### 索引

| 索引 | 用途 |
|------|------|
| `status` | 快速篩選進行中/已結束的機會 |
| `detectedAt DESC` | 按發現時間排序 |
| `endedAt DESC` | 按結束時間排序歷史記錄 |

## 狀態轉換

```
┌─────────┐     偵測到機會      ┌─────────┐
│  NULL   │ ─────────────────► │  ACTIVE │
└─────────┘                    └────┬────┘
                                    │
                               機會消失
                                    │
                                    ▼
                               ┌─────────┐
                               │  ENDED  │
                               └─────────┘
```

## 與現有 Model 的關係

- **獨立於 `OpportunityEndHistory`**: 不依賴用戶，不需要 Webhook
- **獨立於 `User`**: 無 userId 欄位，為系統級資料
- **資料來源**: `FundingRateMonitor` 事件

## Migration 考量

1. 新增 `OpportunityStatus` enum
2. 新增 `arbitrage_opportunities` 資料表
3. 不影響現有資料表

## 查詢範例

### 查詢進行中的機會

```typescript
const activeOpportunities = await prisma.arbitrageOpportunity.findMany({
  where: { status: 'ACTIVE' },
  orderBy: { currentAPY: 'desc' },
});
```

### 查詢歷史記錄（分頁）

```typescript
const history = await prisma.arbitrageOpportunity.findMany({
  where: {
    status: 'ENDED',
    endedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // 最近 7 天
  },
  orderBy: { endedAt: 'desc' },
  take: 20,
  skip: 0,
});
```

### 查詢或建立（Upsert）

```typescript
const opportunity = await prisma.arbitrageOpportunity.upsert({
  where: {
    symbol_longExchange_shortExchange_status: {
      symbol: 'BTCUSDT',
      longExchange: 'binance',
      shortExchange: 'okx',
      status: 'ACTIVE',
    },
  },
  update: {
    currentSpread: newSpread,
    currentAPY: newAPY,
    maxSpread: Math.max(existing.maxSpread, newSpread),
  },
  create: {
    symbol: 'BTCUSDT',
    longExchange: 'binance',
    shortExchange: 'okx',
    initialSpread: spread,
    maxSpread: spread,
    maxSpreadAt: new Date(),
    currentSpread: spread,
    initialAPY: apy,
    maxAPY: apy,
    currentAPY: apy,
    longIntervalHours: 8,
    shortIntervalHours: 8,
  },
});
```
