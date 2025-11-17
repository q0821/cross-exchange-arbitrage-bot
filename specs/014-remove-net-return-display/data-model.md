# Data Model: 移除淨收益欄位

**Feature**: 014-remove-net-return-display
**Date**: 2025-01-17
**Status**: N/A - No Database Changes

## Overview

本功能為純 UI/UX 重構，**不涉及資料庫 schema 變更**。所有修改僅限於前端顯示邏輯和 API 返回數據格式。

## Database Schema Changes

**Status**: ❌ No Changes Required

**Rationale**:
- 移除的 `netReturn` 欄位僅存在於 API 返回值中，不儲存於資料庫
- 現有資料表（`MarketRate`, `FundingRate`, `PriceData` 等）無需修改
- `ArbitrageResult` 表中的 `net_profit` 欄位保留不變（用於其他功能）

## Existing Data Entities (Reference)

### MarketRate (No Changes)

現有資料模型保持不變，僅供參考：

```prisma
model MarketRate {
  id              String   @id @default(cuid())
  symbol          String   // 交易對符號 (e.g., "BTCUSDT")

  // 資金費率數據（從 FundingRate 表關聯）
  fundingRates    FundingRate[]

  // 價格數據（從 PriceData 表關聯）
  priceData       PriceData[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([symbol])
}
```

**Note**: `MarketRate` 不直接儲存 `netReturn`。淨收益是在查詢時計算並返回給前端的衍生欄位。

### FundingRate (No Changes)

```prisma
model FundingRate {
  id              String   @id @default(cuid())
  symbol          String
  exchange        String   // 交易所名稱 (BINANCE, OKX, MEXC, GATEIO)
  rate            Decimal  @db.Decimal(10, 6)
  timestamp       DateTime

  marketRate      MarketRate @relation(fields: [marketRateId], references: [id])
  marketRateId    String

  @@index([symbol, exchange, timestamp])
}
```

**Note**: 資金費率數據不變，前端仍會顯示費率差異（`spreadPercent`）。

### PriceData (No Changes)

```prisma
model PriceData {
  id              String   @id @default(cuid())
  symbol          String
  exchange        String
  price           Decimal  @db.Decimal(18, 8)
  timestamp       DateTime

  marketRate      MarketRate @relation(fields: [marketRateId], references: [id])
  marketRateId    String

  @@index([symbol, exchange, timestamp])
}
```

**Note**: 價格數據不變，前端仍會顯示價差（`priceDiffPercent`）。

### ArbitrageResult (No Changes - Used by Other Features)

```prisma
model ArbitrageResult {
  id                String   @id @default(cuid())
  symbol            String
  spread_percent    Decimal  @db.Decimal(10, 4)
  price_diff        Decimal  @db.Decimal(10, 4)
  net_profit        Decimal  @db.Decimal(10, 4)  // ⚠️ 保留不變

  // ... 其他欄位

  @@index([symbol, timestamp])
}
```

**Important**: `ArbitrageResult.net_profit` 欄位用於套利交易結果記錄（其他功能），**本次修改不影響此欄位**。僅移除市場監控頁面的 UI 顯示。

## API Response Changes

雖然資料庫 schema 不變，但 API 返回的數據格式會有調整：

### Before (移除前)

```typescript
interface BestArbitragePair {
  symbol: string;
  spreadPercent: number;         // 費率差異
  priceDiffPercent: number;      // 價差
  annualizedReturn: number;      // 年化收益
  netReturn: number;             // ❌ 將被移除
  // ... 其他欄位
}
```

### After (移除後)

```typescript
interface BestArbitragePair {
  symbol: string;
  spreadPercent: number;         // 費率差異（保留）
  priceDiffPercent: number;      // 價差（保留）
  annualizedReturn: number;      // 年化收益（保留）
  // netReturn 欄位移除
  // ... 其他欄位
}
```

## Frontend Data Flow

```
Database (Unchanged)
    ↓
API Query (Return spreadPercent, priceDiffPercent, annualizedReturn)
    ↓
WebSocket (Push same data structure)
    ↓
Frontend State (Remove netReturn from types)
    ↓
UI Display (Show 3 independent metrics + fee estimate)
```

## Migration Strategy

**Status**: ✅ No Migration Required

**Reason**:
- 無資料庫 schema 變更
- 無歷史數據需要遷移
- API 向後兼容（僅移除欄位，不破壞現有數據結構）

## Validation Rules

由於沒有資料模型變更，無新的驗證規則需要實施。現有驗證規則保持不變：

- `spreadPercent`: 數值，可為正負值
- `priceDiffPercent`: 數值，可為正負值
- `annualizedReturn`: 數值，通常為正值

## Summary

- ✅ 無資料庫遷移需求
- ✅ 無 Prisma schema 修改
- ✅ 現有資料表結構完整保留
- ✅ API 數據格式調整（移除 netReturn 欄位）
- ✅ 前端類型定義更新（TypeScript interfaces）

**Conclusion**: 此功能為純應用層修改，對資料持久層無影響。
