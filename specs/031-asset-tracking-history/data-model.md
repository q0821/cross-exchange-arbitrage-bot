# Data Model: 交易所資產追蹤和歷史曲線

**Feature**: `031-asset-tracking-history` | **Date**: 2025-12-11

## Overview

本功能新增一個 Prisma 模型 `AssetSnapshot`，用於記錄用戶在各交易所的資產快照。設計採用扁平化結構（各交易所餘額作為欄位），而非正規化設計，以簡化查詢和曲線圖資料處理。

## New Models

### AssetSnapshot

記錄用戶在特定時間點的各交易所總資產（USD）。

```prisma
// ===== 資產快照 (Feature 031) =====
model AssetSnapshot {
  id                String   @id @default(cuid())
  userId            String

  // 各交易所餘額（USD）- 可為 null 表示該交易所未設定 API Key 或查詢失敗
  binanceBalanceUSD Decimal? @db.Decimal(18, 8)
  okxBalanceUSD     Decimal? @db.Decimal(18, 8)
  mexcBalanceUSD    Decimal? @db.Decimal(18, 8)
  gateioBalanceUSD  Decimal? @db.Decimal(18, 8)

  // 總資產（已設定交易所的加總）
  totalBalanceUSD   Decimal  @db.Decimal(18, 8)

  // 各交易所連線狀態
  binanceStatus     String?  @db.VarChar(50) // 'success' | 'no_api_key' | 'api_error' | 'rate_limited'
  okxStatus         String?  @db.VarChar(50)
  mexcStatus        String?  @db.VarChar(50)
  gateioStatus      String?  @db.VarChar(50)

  // 時間資訊
  recordedAt        DateTime @db.Timestamptz
  createdAt         DateTime @default(now()) @db.Timestamptz

  // Relations
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, recordedAt(sort: Desc)])
  @@index([recordedAt(sort: Desc)])
  @@map("asset_snapshots")
}
```

### User Model Update

需要在 `User` 模型中新增 relation：

```prisma
model User {
  // ... existing fields ...

  // Relations
  // ... existing relations ...
  assetSnapshots       AssetSnapshot[]  // NEW: Feature 031
}
```

## Field Specifications

### Exchange Balance Fields

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `binanceBalanceUSD` | Decimal(18,8) | Yes | Binance 帳戶總資產（USD） |
| `okxBalanceUSD` | Decimal(18,8) | Yes | OKX 帳戶總資產（USD） |
| `mexcBalanceUSD` | Decimal(18,8) | Yes | MEXC 帳戶總資產（USD） |
| `gateioBalanceUSD` | Decimal(18,8) | Yes | Gate.io 帳戶總資產（USD） |
| `totalBalanceUSD` | Decimal(18,8) | No | 所有交易所加總（排除 null 值） |

**Nullable 意義**:
- `null`: 該交易所未設定 API Key 或查詢失敗
- `0`: 該交易所已設定但餘額為零

### Status Fields

| Status Value | Description |
|--------------|-------------|
| `success` | API 查詢成功 |
| `no_api_key` | 用戶未設定該交易所的 API Key |
| `api_error` | API 呼叫失敗（認證錯誤、網路問題等） |
| `rate_limited` | 超出 API Rate Limit |

### Indexes

| Index | Purpose |
|-------|---------|
| `[userId, recordedAt DESC]` | 查詢用戶歷史快照（主要查詢模式） |
| `[recordedAt DESC]` | 清理過期資料 |

## Validation Rules

### Business Rules

1. **recordedAt**: 必須是過去或現在的時間，不能是未來
2. **totalBalanceUSD**: 必須等於所有非 null 交易所餘額的加總
3. **Status 一致性**: 當 `*BalanceUSD` 為 null 時，對應的 `*Status` 不能是 'success'

### Constraints

```typescript
// Zod Schema for validation
const assetSnapshotSchema = z.object({
  userId: z.string().cuid(),
  binanceBalanceUSD: z.number().nonnegative().nullable(),
  okxBalanceUSD: z.number().nonnegative().nullable(),
  mexcBalanceUSD: z.number().nonnegative().nullable(),
  gateioBalanceUSD: z.number().nonnegative().nullable(),
  totalBalanceUSD: z.number().nonnegative(),
  binanceStatus: z.enum(['success', 'no_api_key', 'api_error', 'rate_limited']).nullable(),
  okxStatus: z.enum(['success', 'no_api_key', 'api_error', 'rate_limited']).nullable(),
  mexcStatus: z.enum(['success', 'no_api_key', 'api_error', 'rate_limited']).nullable(),
  gateioStatus: z.enum(['success', 'no_api_key', 'api_error', 'rate_limited']).nullable(),
  recordedAt: z.date(),
});
```

## Query Patterns

### 1. 查詢用戶最近 N 天的快照（曲線圖資料）

```typescript
const snapshots = await prisma.assetSnapshot.findMany({
  where: {
    userId,
    recordedAt: {
      gte: subDays(new Date(), days), // date-fns
    },
  },
  orderBy: {
    recordedAt: 'asc',
  },
  select: {
    recordedAt: true,
    binanceBalanceUSD: true,
    okxBalanceUSD: true,
    mexcBalanceUSD: true,
    gateioBalanceUSD: true,
    totalBalanceUSD: true,
  },
});
```

### 2. 查詢用戶最新快照（即時餘額卡片）

```typescript
const latestSnapshot = await prisma.assetSnapshot.findFirst({
  where: { userId },
  orderBy: { recordedAt: 'desc' },
});
```

### 3. 清理過期資料（30 天以前）

```typescript
const deleted = await prisma.assetSnapshot.deleteMany({
  where: {
    recordedAt: {
      lt: subDays(new Date(), 30),
    },
  },
});
```

### 4. 查詢需要建立快照的用戶（有任何有效 API Key）

```typescript
const usersWithApiKeys = await prisma.user.findMany({
  where: {
    apiKeys: {
      some: {
        isActive: true,
      },
    },
  },
  select: {
    id: true,
    apiKeys: {
      where: { isActive: true },
      select: {
        exchange: true,
      },
    },
  },
});
```

## Migration

### Migration SQL

```sql
-- CreateTable
CREATE TABLE "asset_snapshots" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "binanceBalanceUSD" DECIMAL(18,8),
    "okxBalanceUSD" DECIMAL(18,8),
    "mexcBalanceUSD" DECIMAL(18,8),
    "gateioBalanceUSD" DECIMAL(18,8),
    "totalBalanceUSD" DECIMAL(18,8) NOT NULL,
    "binanceStatus" VARCHAR(50),
    "okxStatus" VARCHAR(50),
    "mexcStatus" VARCHAR(50),
    "gateioStatus" VARCHAR(50),
    "recordedAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "asset_snapshots_userId_recordedAt_idx" ON "asset_snapshots"("userId", "recordedAt" DESC);

-- CreateIndex
CREATE INDEX "asset_snapshots_recordedAt_idx" ON "asset_snapshots"("recordedAt" DESC);

-- AddForeignKey
ALTER TABLE "asset_snapshots" ADD CONSTRAINT "asset_snapshots_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

## Storage Estimation

### Per-Record Size

| Component | Size |
|-----------|------|
| id (cuid) | ~25 bytes |
| userId (cuid) | ~25 bytes |
| 4x Decimal(18,8) | ~40 bytes |
| 1x Decimal(18,8) | ~10 bytes |
| 4x VARCHAR(50) | ~80 bytes |
| 2x TIMESTAMPTZ | ~16 bytes |
| Index overhead | ~50 bytes |
| **Total** | **~250 bytes** |

### Monthly Storage

- 100 users × 24 snapshots/day × 30 days = 72,000 records/month
- 72,000 × 250 bytes ≈ **18 MB/month**
- 30 天保留：最大約 **18 MB**

## Related Models

### ApiKey (Existing)

用於獲取用戶已綁定的交易所和 API 憑證：

```prisma
model ApiKey {
  id                  String         @id @default(cuid())
  userId              String
  exchange            String         @db.VarChar(50) // "binance" | "okx" | "mexc" | "gate"
  isActive            Boolean        @default(true)
  // ... encryption fields
}
```

### Position (Existing, Reference Only)

持倉資訊從交易所 API 即時查詢，不在本功能的資料模型範圍內。

## Design Decisions

### 為什麼選擇扁平化設計而非正規化？

**扁平化（選用）**:
```prisma
model AssetSnapshot {
  binanceBalanceUSD Decimal?
  okxBalanceUSD     Decimal?
  // ... 每個交易所一個欄位
}
```

**正規化（未選用）**:
```prisma
model AssetSnapshot {
  id String @id
  balances ExchangeBalance[]
}

model ExchangeBalance {
  snapshotId String
  exchange   String
  balanceUSD Decimal
}
```

**選擇扁平化的理由**:
1. **查詢簡單**: 曲線圖 API 可直接返回資料，無需 JOIN
2. **交易所數量固定**: 只有 4 個交易所，欄位數量可控
3. **效能更好**: 避免多表 JOIN，索引更高效
4. **程式碼簡潔**: 前端可直接使用欄位名稱作為系列名
