# Data Model: 開倉停損停利設定

**Date**: 2025-12-20
**Feature**: 038-specify-scripts-bash

## Overview

擴展現有 `Position` 模型以支援停損停利設定，並新增用戶交易設定模型。

---

## 1. Position 模型擴展

### 新增欄位

在現有 `Position` 模型中新增以下欄位：

```prisma
model Position {
  // ... 現有欄位 ...

  // 停損設定
  stopLossEnabled       Boolean   @default(false)
  stopLossPercent       Decimal?  @db.Decimal(5, 2)  // 0.50 - 50.00
  longStopLossPrice     Decimal?  @db.Decimal(20, 8)
  longStopLossOrderId   String?
  shortStopLossPrice    Decimal?  @db.Decimal(20, 8)
  shortStopLossOrderId  String?

  // 停利設定
  takeProfitEnabled       Boolean   @default(false)
  takeProfitPercent       Decimal?  @db.Decimal(5, 2)  // 0.50 - 100.00
  longTakeProfitPrice     Decimal?  @db.Decimal(20, 8)
  longTakeProfitOrderId   String?
  shortTakeProfitPrice    Decimal?  @db.Decimal(20, 8)
  shortTakeProfitOrderId  String?

  // 條件單設定狀態
  conditionalOrderStatus  ConditionalOrderStatus @default(PENDING)
  conditionalOrderError   String?
}

enum ConditionalOrderStatus {
  PENDING      // 尚未設定
  SETTING      // 設定中
  SET          // 設定成功
  PARTIAL      // 部分成功
  FAILED       // 設定失敗
}
```

### 欄位說明

| 欄位 | 類型 | 說明 |
|------|------|------|
| `stopLossEnabled` | Boolean | 是否啟用停損 |
| `stopLossPercent` | Decimal | 停損百分比 (0.5-50%) |
| `longStopLossPrice` | Decimal | Long 倉位停損觸發價 |
| `longStopLossOrderId` | String | Long 倉位停損單 ID |
| `shortStopLossPrice` | Decimal | Short 倉位停損觸發價 |
| `shortStopLossOrderId` | String | Short 倉位停損單 ID |
| `takeProfitEnabled` | Boolean | 是否啟用停利 |
| `takeProfitPercent` | Decimal | 停利百分比 (0.5-100%) |
| `longTakeProfitPrice` | Decimal | Long 倉位停利觸發價 |
| `longTakeProfitOrderId` | String | Long 倉位停利單 ID |
| `shortTakeProfitPrice` | Decimal | Short 倉位停利觸發價 |
| `shortTakeProfitOrderId` | String | Short 倉位停利單 ID |
| `conditionalOrderStatus` | Enum | 條件單設定狀態 |
| `conditionalOrderError` | String | 條件單設定錯誤訊息 |

---

## 2. TradingSettings 模型

### 新模型定義

用戶層級的交易設定，包含停損停利預設值：

```prisma
model TradingSettings {
  id                        String   @id @default(cuid())
  userId                    String   @unique
  user                      User     @relation(fields: [userId], references: [id])

  // 停損預設值
  defaultStopLossEnabled    Boolean  @default(true)
  defaultStopLossPercent    Decimal  @default(5.00) @db.Decimal(5, 2)

  // 停利預設值
  defaultTakeProfitEnabled  Boolean  @default(false)
  defaultTakeProfitPercent  Decimal  @default(3.00) @db.Decimal(5, 2)

  // 其他交易設定
  defaultLeverage           Int      @default(1)
  maxPositionSizeUSD        Decimal  @default(10000) @db.Decimal(20, 2)

  createdAt                 DateTime @default(now())
  updatedAt                 DateTime @updatedAt

  @@map("trading_settings")
}
```

### 欄位說明

| 欄位 | 類型 | 預設值 | 說明 |
|------|------|--------|------|
| `defaultStopLossEnabled` | Boolean | true | 預設啟用停損 |
| `defaultStopLossPercent` | Decimal | 5.00 | 預設停損百分比 |
| `defaultTakeProfitEnabled` | Boolean | false | 預設啟用停利 |
| `defaultTakeProfitPercent` | Decimal | 3.00 | 預設停利百分比 |
| `defaultLeverage` | Int | 1 | 預設槓桿倍數 |
| `maxPositionSizeUSD` | Decimal | 10000 | 最大倉位金額 |

---

## 3. 關聯關係

```
User (1) ──────── (1) TradingSettings
  │
  └──── (1:N) ──── Position
                      │
                      ├── stopLossEnabled
                      ├── stopLossPercent
                      ├── longStopLossPrice
                      ├── longStopLossOrderId
                      ├── shortStopLossPrice
                      ├── shortStopLossOrderId
                      ├── takeProfitEnabled
                      ├── takeProfitPercent
                      ├── longTakeProfitPrice
                      ├── longTakeProfitOrderId
                      ├── shortTakeProfitPrice
                      ├── shortTakeProfitOrderId
                      ├── conditionalOrderStatus
                      └── conditionalOrderError
```

---

## 4. 狀態轉換

### ConditionalOrderStatus 狀態機

```
                    ┌─────────────┐
                    │   PENDING   │ ◄── 初始狀態
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   SETTING   │ ◄── 開始設定條件單
                    └──────┬──────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │     SET     │ │   PARTIAL   │ │   FAILED    │
    │  (全部成功) │ │ (部分成功)  │ │  (全部失敗) │
    └─────────────┘ └─────────────┘ └─────────────┘
```

### 狀態說明

| 狀態 | 說明 |
|------|------|
| `PENDING` | 初始狀態，尚未嘗試設定條件單 |
| `SETTING` | 正在設定條件單 |
| `SET` | 所有條件單設定成功 |
| `PARTIAL` | 部分條件單設定成功（例如：停損成功但停利失敗） |
| `FAILED` | 所有條件單設定失敗 |

---

## 5. 驗證規則

### 停損百分比
- 最小值: 0.5%
- 最大值: 50%
- 精度: 2 位小數

### 停利百分比
- 最小值: 0.5%
- 最大值: 100%
- 精度: 2 位小數

### 觸發價格計算

```typescript
// Long 倉位
longStopLossPrice = entryPrice * (1 - stopLossPercent / 100)
longTakeProfitPrice = entryPrice * (1 + takeProfitPercent / 100)

// Short 倉位
shortStopLossPrice = entryPrice * (1 + stopLossPercent / 100)
shortTakeProfitPrice = entryPrice * (1 - takeProfitPercent / 100)
```

---

## 6. Migration Script

```sql
-- Add conditional order fields to Position
ALTER TABLE "Position" ADD COLUMN "stopLossEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Position" ADD COLUMN "stopLossPercent" DECIMAL(5,2);
ALTER TABLE "Position" ADD COLUMN "longStopLossPrice" DECIMAL(20,8);
ALTER TABLE "Position" ADD COLUMN "longStopLossOrderId" TEXT;
ALTER TABLE "Position" ADD COLUMN "shortStopLossPrice" DECIMAL(20,8);
ALTER TABLE "Position" ADD COLUMN "shortStopLossOrderId" TEXT;
ALTER TABLE "Position" ADD COLUMN "takeProfitEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Position" ADD COLUMN "takeProfitPercent" DECIMAL(5,2);
ALTER TABLE "Position" ADD COLUMN "longTakeProfitPrice" DECIMAL(20,8);
ALTER TABLE "Position" ADD COLUMN "longTakeProfitOrderId" TEXT;
ALTER TABLE "Position" ADD COLUMN "shortTakeProfitPrice" DECIMAL(20,8);
ALTER TABLE "Position" ADD COLUMN "shortTakeProfitOrderId" TEXT;
ALTER TABLE "Position" ADD COLUMN "conditionalOrderStatus" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Position" ADD COLUMN "conditionalOrderError" TEXT;

-- Create TradingSettings table
CREATE TABLE "trading_settings" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "defaultStopLossEnabled" BOOLEAN NOT NULL DEFAULT true,
  "defaultStopLossPercent" DECIMAL(5,2) NOT NULL DEFAULT 5.00,
  "defaultTakeProfitEnabled" BOOLEAN NOT NULL DEFAULT false,
  "defaultTakeProfitPercent" DECIMAL(5,2) NOT NULL DEFAULT 3.00,
  "defaultLeverage" INTEGER NOT NULL DEFAULT 1,
  "maxPositionSizeUSD" DECIMAL(20,2) NOT NULL DEFAULT 10000,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "trading_settings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "trading_settings_userId_key" UNIQUE ("userId")
);

-- Add foreign key
ALTER TABLE "trading_settings" ADD CONSTRAINT "trading_settings_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```
