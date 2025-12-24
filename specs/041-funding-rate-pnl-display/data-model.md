# Data Model: 交易歷史資金費率損益顯示

**Feature**: 041-funding-rate-pnl-display
**Created**: 2025-12-24

## Overview

本功能**不需要修改資料庫 schema**。現有的 `Trade` 模型已有 `fundingRatePnL` 欄位，目前被硬編碼為 0，本功能將填入實際查詢的資金費率損益數據。

## Existing Models (No Changes Required)

### Trade Model

```prisma
model Trade {
  id                  String       @id @default(cuid())
  userId              String
  positionId          String       @unique
  symbol              String       @db.VarChar(20)

  // Long Side
  longExchange        String       @db.VarChar(50)
  longEntryPrice      Decimal      @db.Decimal(18, 8)
  longExitPrice       Decimal      @db.Decimal(18, 8)
  longPositionSize    Decimal      @db.Decimal(18, 8)
  longFee             Decimal      @default(0) @db.Decimal(18, 8)

  // Short Side
  shortExchange       String       @db.VarChar(50)
  shortEntryPrice     Decimal      @db.Decimal(18, 8)
  shortExitPrice      Decimal      @db.Decimal(18, 8)
  shortPositionSize   Decimal      @db.Decimal(18, 8)
  shortFee            Decimal      @default(0) @db.Decimal(18, 8)

  // Timing
  openedAt            DateTime     @db.Timestamptz
  closedAt            DateTime     @db.Timestamptz
  holdingDuration     Int          // seconds

  // PnL (本功能重點欄位)
  priceDiffPnL        Decimal      @db.Decimal(18, 8)  // 價差損益
  fundingRatePnL      Decimal      @db.Decimal(18, 8)  // 資金費率損益 ← 本功能填入實際值
  totalFees           Decimal      @default(0) @db.Decimal(18, 8)
  totalPnL            Decimal      @db.Decimal(18, 8)  // = priceDiffPnL + fundingRatePnL - totalFees
  roi                 Decimal      @db.Decimal(10, 4)

  status              TradeWebStatus @default(SUCCESS)
  createdAt           DateTime     @default(now()) @db.Timestamptz

  // Relations
  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  position Position @relation(fields: [positionId], references: [id], onDelete: Restrict)
}
```

### Position Model (Reference Only)

Position 模型提供查詢資金費率所需的時間範圍和交易所資訊：

| Field | Type | Usage |
|-------|------|-------|
| `openedAt` | DateTime | 查詢起始時間 |
| `closedAt` | DateTime | 查詢結束時間 |
| `longExchange` | String | Long 邊交易所 |
| `shortExchange` | String | Short 邊交易所 |
| `symbol` | String | 交易對 |
| `userId` | String | 用於獲取 API Key |

## Runtime Types (New)

### FundingFeeQueryResult

```typescript
/**
 * 單邊資金費率查詢結果
 */
interface FundingFeeQueryResult {
  exchange: SupportedExchange;
  symbol: string;
  startTime: Date;
  endTime: Date;
  entries: FundingFeeEntry[];
  totalAmount: Decimal;
  success: boolean;
  error?: string;
}

/**
 * 單筆資金費率結算記錄
 */
interface FundingFeeEntry {
  timestamp: number;      // 結算時間（毫秒）
  datetime: string;       // ISO 8601 格式
  amount: Decimal;        // 金額：正=收到，負=支付
  symbol: string;         // 統一市場符號
  id: string;             // 交易所記錄 ID
}
```

### BilateralFundingFeeResult

```typescript
/**
 * 雙邊資金費率查詢結果
 */
interface BilateralFundingFeeResult {
  longResult: FundingFeeQueryResult;
  shortResult: FundingFeeQueryResult;
  totalFundingFee: Decimal;
}
```

## Data Flow

```
┌─────────────────┐       ┌──────────────────────┐       ┌─────────────┐
│   Position      │──────▶│ FundingFeeQueryService│──────▶│   Trade     │
│                 │       │                      │       │             │
│ - openedAt      │       │ 1. Query Long Side   │       │ - fundingRatePnL ← 填入實際值
│ - closedAt      │       │ 2. Query Short Side  │       │ - totalPnL ← 重新計算
│ - longExchange  │       │ 3. Sum Both Sides    │       │             │
│ - shortExchange │       │                      │       │             │
└─────────────────┘       └──────────────────────┘       └─────────────┘
                                    │
                                    ▼
                          ┌──────────────────┐
                          │ Exchange APIs    │
                          │                  │
                          │ - Binance        │
                          │ - OKX            │
                          │ - Gate.io        │
                          │ - MEXC           │
                          └──────────────────┘
```

## Calculation Formula

```typescript
// 現有公式（不變）
totalPnL = priceDiffPnL + fundingRatePnL - totalFees

// 本功能變更：fundingRatePnL 從硬編碼 0 改為實際查詢結果
fundingRatePnL = longFundingFee + shortFundingFee

// 其中
longFundingFee = Σ(Long 邊所有結算記錄的 amount)
shortFundingFee = Σ(Short 邊所有結算記錄的 amount)
```

## Validation Rules

| Rule | Description |
|------|-------------|
| 時間範圍 | `startTime < endTime` |
| 金額類型 | 使用 `Decimal` 精確計算 |
| 空結果處理 | 無結算記錄時 `fundingRatePnL = 0` |
| 失敗降級 | API 失敗時 `fundingRatePnL = 0` |

## Migration

**不需要資料庫遷移**。現有 `Trade.fundingRatePnL` 欄位已存在，只需修改程式碼填入實際值。

### Backward Compatibility

- 歷史 Trade 記錄的 `fundingRatePnL` 保持為 0（無法回溯查詢）
- 新的 Trade 記錄將包含實際資金費率損益
- UI 顯示邏輯不需修改（已有顯示 fundingRatePnL 的程式碼）
