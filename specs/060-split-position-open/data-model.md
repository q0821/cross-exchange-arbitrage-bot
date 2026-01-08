# Data Model: 分單開倉（獨立持倉）

**Feature**: 060-split-position-open
**Date**: 2026-01-07

## 概述

此功能完全複用現有的 `Position` 模型，無需新增資料庫表或欄位。

每組分單開倉產生的持倉都是獨立的 `Position` 記錄，與單一開倉建立的持倉完全相同。

## 現有模型（無修改）

### Position

```prisma
model Position {
  id                    String            @id @default(cuid())
  userId                String
  symbol                String
  longExchange          String
  shortExchange         String
  quantity              Decimal           @db.Decimal(18, 8)
  leverage              Int               @default(1)

  // 開倉資訊
  longEntryPrice        Decimal?          @db.Decimal(18, 8)
  shortEntryPrice       Decimal?          @db.Decimal(18, 8)
  longOrderId           String?
  shortOrderId          String?

  // 停損停利
  stopLossEnabled       Boolean           @default(false)
  stopLossPercent       Decimal?          @db.Decimal(5, 2)
  takeProfitEnabled     Boolean           @default(false)
  takeProfitPercent     Decimal?          @db.Decimal(5, 2)

  // 狀態
  status                PositionStatus    @default(PENDING)
  webStatus             PositionWebStatus @default(PENDING)

  // 時間戳
  openedAt              DateTime?
  closedAt              DateTime?
  createdAt             DateTime          @default(now())
  updatedAt             DateTime          @updatedAt
}
```

## 分單開倉資料流

```
用戶輸入:
  - symbol: BTCUSDT
  - quantity: 600
  - positionCount: 2
  - leverage: 2
  - stopLossEnabled: true
  - stopLossPercent: 5

↓ 前端計算

分組資訊:
  - 組 1: 300 BTCUSDT
  - 組 2: 300 BTCUSDT

↓ 串行執行

API 調用 1:
  POST /api/positions/open
  {
    symbol: "BTCUSDT",
    quantity: 300,
    leverage: 2,
    stopLossEnabled: true,
    stopLossPercent: 5
  }
  → 建立 Position #1

API 調用 2:
  POST /api/positions/open
  {
    symbol: "BTCUSDT",
    quantity: 300,
    leverage: 2,
    stopLossEnabled: true,
    stopLossPercent: 5
  }
  → 建立 Position #2
```

## 可選擴展（未來）

如果需要追蹤同一批次的持倉，可以新增以下欄位：

```prisma
model Position {
  // ... 現有欄位 ...

  // 批次識別（可選）
  batchId    String?   // 同一次分單開倉的批次 ID
  batchIndex Int?      // 在批次中的序號（1, 2, 3...）
}
```

**注意**: 此擴展不在 Feature 060 範圍內，僅作為未來參考。
