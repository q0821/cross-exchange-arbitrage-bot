# Data Model: BingX 交易所整合

**Feature**: 043-bingx-integration
**Date**: 2025-12-25
**Status**: Complete

## Overview

BingX 整合不需要新增 Prisma 模型，只需擴展現有的類型定義。所有資料模型（ApiKey、Position、Trade）已支援多交易所架構。

## Type Extensions

### 1. ExchangeName 擴展

**檔案**: `src/connectors/types.ts`

```typescript
// 現有定義
export type ExchangeName = 'binance' | 'okx' | 'mexc' | 'gateio';

// 擴展為
export type ExchangeName = 'binance' | 'okx' | 'mexc' | 'gateio' | 'bingx';
```

### 2. SupportedExchange 擴展

**檔案**: `src/types/trading.ts`

```typescript
// 擴展 SupportedExchange 類型
export type SupportedExchange = 'binance' | 'okx' | 'gateio' | 'mexc' | 'bingx';
```

## Existing Models Used

### ApiKey Model

BingX API Key 使用現有的 `ApiKey` 模型儲存：

```prisma
model ApiKey {
  id                  String         @id @default(cuid())
  userId              String
  exchange            String         @db.VarChar(50) // 支援 "bingx"
  environment         ApiEnvironment @default(MAINNET)
  label               String         @db.VarChar(100)
  encryptedKey        String         @db.Text
  encryptedSecret     String         @db.Text
  encryptedPassphrase String?        @db.Text // BingX 不需要
  isActive            Boolean        @default(true)
  lastValidatedAt     DateTime?      @db.Timestamptz
  createdAt           DateTime       @default(now()) @db.Timestamptz
  updatedAt           DateTime       @updatedAt @db.Timestamptz

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

**BingX 特性**:
- `encryptedPassphrase` 為 `null`（BingX 不需要）
- `environment` 支援 `MAINNET` 和 `TESTNET`

### Position Model

BingX 持倉使用現有的 `Position` 模型：

```prisma
model Position {
  id                   String           @id @default(cuid())
  userId               String
  symbol               String           @db.VarChar(20)
  longExchange         String           @db.VarChar(50) // 可為 "bingx"
  shortExchange        String           @db.VarChar(50) // 可為 "bingx"
  // ... 其他欄位不變

  // 停損停利欄位已存在
  stopLossEnabled       Boolean   @default(false)
  stopLossPercent       Decimal?  @db.Decimal(5, 2)
  longStopLossPrice     Decimal?  @db.Decimal(20, 8)
  longStopLossOrderId   String?   @db.VarChar(100)
  shortStopLossPrice    Decimal?  @db.Decimal(20, 8)
  shortStopLossOrderId  String?   @db.VarChar(100)
  takeProfitEnabled       Boolean   @default(false)
  takeProfitPercent       Decimal?  @db.Decimal(5, 2)
  longTakeProfitPrice     Decimal?  @db.Decimal(20, 8)
  longTakeProfitOrderId   String?   @db.VarChar(100)
  shortTakeProfitPrice    Decimal?  @db.Decimal(20, 8)
  shortTakeProfitOrderId  String?   @db.VarChar(100)
}
```

### Trade Model

BingX 交易記錄使用現有的 `Trade` 模型：

```prisma
model Trade {
  id                  String       @id @default(cuid())
  userId              String
  positionId          String       @unique
  symbol              String       @db.VarChar(20)
  longExchange        String       @db.VarChar(50) // 可為 "bingx"
  shortExchange       String       @db.VarChar(50) // 可為 "bingx"
  // ... PnL 計算欄位不變
  priceDiffPnL        Decimal      @db.Decimal(18, 8)
  fundingRatePnL      Decimal      @db.Decimal(18, 8)
  totalFees           Decimal      @default(0) @db.Decimal(18, 8)
  totalPnL            Decimal      @db.Decimal(18, 8)
}
```

### AssetSnapshot Model

BingX 資產快照需擴展 `AssetSnapshot` 模型：

```prisma
model AssetSnapshot {
  id                String   @id @default(cuid())
  userId            String

  // 現有欄位
  binanceBalanceUSD Decimal? @db.Decimal(18, 8)
  okxBalanceUSD     Decimal? @db.Decimal(18, 8)
  mexcBalanceUSD    Decimal? @db.Decimal(18, 8)
  gateioBalanceUSD  Decimal? @db.Decimal(18, 8)

  // 新增 BingX 欄位
  bingxBalanceUSD   Decimal? @db.Decimal(18, 8)

  // 現有狀態欄位
  binanceStatus     String?  @db.VarChar(50)
  okxStatus         String?  @db.VarChar(50)
  mexcStatus        String?  @db.VarChar(50)
  gateioStatus      String?  @db.VarChar(50)

  // 新增 BingX 狀態欄位
  bingxStatus       String?  @db.VarChar(50)

  // ... 其他欄位不變
}
```

## Environment Variables

**檔案**: `.env.example`

```bash
# BingX API (監控用 - 讀取權限)
BINGX_API_KEY=your_bingx_api_key
BINGX_API_SECRET=your_bingx_api_secret
```

## Configuration Extension

**檔案**: `src/lib/config.ts`

```typescript
export const config = {
  // 現有配置
  exchanges: {
    binance: { ... },
    okx: { ... },
    mexc: { ... },
    gateio: { ... },

    // 新增 BingX 配置
    bingx: {
      apiKey: process.env.BINGX_API_KEY || '',
      apiSecret: process.env.BINGX_API_SECRET || '',
      sandbox: process.env.BINGX_SANDBOX === 'true',
    },
  },
};
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        BingX 資料流                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  監控用 API (.env)                                              │
│  ┌──────────────┐                                               │
│  │ BINGX_API_KEY│ ──► FundingRateMonitor ──► RatesCache        │
│  └──────────────┘              │                                │
│                                ▼                                │
│                         PriceData, FundingRateData              │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  交易用 API (Database)                                          │
│  ┌──────────────┐                                               │
│  │ ApiKey Model │ ──► PositionOrchestrator ──► Position Model  │
│  └──────────────┘              │                                │
│                                ▼                                │
│                  TradeRecord, ConditionalOrders                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Migration Required

只需一個 migration 來擴展 `AssetSnapshot` 模型：

```sql
-- 新增 BingX 餘額和狀態欄位
ALTER TABLE "asset_snapshots"
ADD COLUMN "bingxBalanceUSD" DECIMAL(18, 8),
ADD COLUMN "bingxStatus" VARCHAR(50);
```

## Summary

| 項目 | 需要新增 | 說明 |
|------|---------|------|
| Prisma Model | ❌ | 複用現有 ApiKey, Position, Trade |
| Type Extension | ✅ | ExchangeName, SupportedExchange |
| Database Migration | ✅ | AssetSnapshot 新增 bingx 欄位 |
| Environment Variables | ✅ | BINGX_API_KEY, BINGX_API_SECRET |
| Config Extension | ✅ | config.exchanges.bingx |
