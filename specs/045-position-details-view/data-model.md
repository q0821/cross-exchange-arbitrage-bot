# Data Model: 持倉詳情查看功能

**Feature**: 045-position-details-view
**Date**: 2025-12-28

## Overview

本功能 **不新增任何資料庫欄位**（依據用戶需求）。所有資料來自：
1. 現有 Position 模型（開倉資訊）
2. 交易所 API 即時查詢（當前價格、資金費率歷史）
3. 運算時計算（未實現損益、年化報酬率）

## Existing Models (Referenced)

### Position Model

```prisma
model Position {
  id                   String           @id @default(cuid())
  userId               String
  symbol               String           @db.VarChar(20)

  // Long Side
  longExchange         String           @db.VarChar(50)
  longOrderId          String?          @db.VarChar(100)
  longEntryPrice       Decimal          @db.Decimal(18, 8)
  longPositionSize     Decimal          @db.Decimal(18, 8)
  longLeverage         Int              @default(3)

  // Short Side
  shortExchange        String           @db.VarChar(50)
  shortOrderId         String?          @db.VarChar(100)
  shortEntryPrice      Decimal          @db.Decimal(18, 8)
  shortPositionSize    Decimal          @db.Decimal(18, 8)
  shortLeverage        Int              @default(3)

  // Timing
  openedAt             DateTime?        @db.Timestamptz
  closedAt             DateTime?        @db.Timestamptz
  createdAt            DateTime         @default(now()) @db.Timestamptz

  // Status
  status               PositionWebStatus @default(PENDING)

  // Relations
  user                 User             @relation(...)
  trade                Trade?
}
```

### Trade Model (for fees)

```prisma
model Trade {
  id                   String           @id @default(cuid())
  positionId           String           @unique

  // Fee information
  longOpenFee          Decimal?         @db.Decimal(18, 8)
  shortOpenFee         Decimal?         @db.Decimal(18, 8)
  longCloseFee         Decimal?         @db.Decimal(18, 8)
  shortCloseFee        Decimal?         @db.Decimal(18, 8)

  // P&L
  fundingRatePnL       Decimal?         @db.Decimal(18, 8)

  // Relations
  position             Position         @relation(...)
}
```

## Runtime Data Structures

### PositionDetailsInfo (TypeScript)

新增至 `src/types/trading.ts`：

```typescript
/**
 * 持倉詳情資訊（即時查詢結果）
 * Feature: 045-position-details-view
 */
export interface PositionDetailsInfo {
  positionId: string;
  symbol: string;

  // 開倉資訊 (from Position)
  longExchange: string;
  shortExchange: string;
  longEntryPrice: string;
  shortEntryPrice: string;
  longPositionSize: string;
  shortPositionSize: string;
  leverage: number;
  openedAt: string;

  // 當前價格 (from Exchange API)
  longCurrentPrice?: number;
  shortCurrentPrice?: number;
  priceQuerySuccess: boolean;
  priceQueryError?: string;

  // 未實現損益 (calculated)
  longUnrealizedPnL?: number;
  shortUnrealizedPnL?: number;
  totalUnrealizedPnL?: number;

  // 資金費率明細 (from Exchange API)
  fundingFees?: {
    longEntries: FundingFeeEntry[];
    shortEntries: FundingFeeEntry[];
    longTotal: string;
    shortTotal: string;
    netTotal: string;
  };
  fundingFeeQuerySuccess: boolean;
  fundingFeeQueryError?: string;

  // 手續費資訊 (from Trade, SHOULD)
  fees?: {
    longOpenFee?: string;
    shortOpenFee?: string;
    totalFees?: string;
  };

  // 年化報酬率 (calculated)
  annualizedReturn?: {
    value: number;          // 百分比
    totalPnL: number;       // 總損益
    margin: number;         // 保證金
    holdingHours: number;   // 持倉小時數
  };
  annualizedReturnError?: string;

  // Metadata
  queriedAt: string;
}
```

### FundingFeeEntry (Existing)

```typescript
/**
 * 單筆資金費率結算記錄 (already in trading.ts)
 */
export interface FundingFeeEntry {
  timestamp: number;    // 結算時間（毫秒）
  datetime: string;     // ISO 8601 格式
  amount: Decimal;      // 金額：正=收到，負=支付
  symbol: string;       // 統一市場符號
  id: string;           // 交易所記錄 ID
}
```

## API Response Structure

### GET /api/positions/[id]/details

```typescript
interface PositionDetailsResponse {
  success: boolean;
  data?: PositionDetailsInfo;
  error?: {
    code: string;
    message: string;
  };
}
```

## State Transitions

本功能無狀態轉換（唯讀查詢）。

## Validation Rules

| Field | Rule | Error Message |
|-------|------|---------------|
| positionId | 必須存在且屬於當前用戶 | Position not found |
| position.status | 必須為 OPEN | Position is not open |
| holding time | >= 1 分鐘才計算年化 | 資料不足，無法計算年化 |
| margin | > 0 才計算年化 | 保證金無效 |

## Calculations

### 未實現損益

```typescript
// Long P&L
const longPnL = (longCurrentPrice - longEntryPrice) * longPositionSize;

// Short P&L
const shortPnL = (shortEntryPrice - shortCurrentPrice) * shortPositionSize;

// Total
const totalUnrealizedPnL = longPnL + shortPnL;
```

### 年化報酬率

```typescript
// 總損益
const totalPnL = totalUnrealizedPnL + netFundingFee;

// 保證金 (使用開倉價格計算)
const longMargin = (longEntryPrice * longPositionSize) / leverage;
const shortMargin = (shortEntryPrice * shortPositionSize) / leverage;
const totalMargin = longMargin + shortMargin;

// 持倉小時數
const holdingMs = now - openedAt;
const holdingHours = holdingMs / 3600000;

// 年化報酬率
const annualizedReturn = (totalPnL / totalMargin) * (365 * 24 / holdingHours) * 100;
```

## Migration

**無需 Migration** - 本功能不新增資料庫欄位。
