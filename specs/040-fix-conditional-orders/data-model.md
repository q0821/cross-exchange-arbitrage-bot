# Data Model: 修復開倉停損停利條件單設定

**Date**: 2025-12-23
**Feature**: 040-fix-conditional-orders

## 概述

本次修復不新增資料模型，僅使用現有模型。以下為相關模型說明。

## 現有模型

### Position（持倉）

已存在於 `prisma/schema.prisma`，包含條件單相關欄位：

```prisma
model Position {
  id                      String   @id @default(cuid())

  // 條件單設定
  stopLossEnabled         Boolean  @default(false)
  stopLossPercent         Decimal? @db.Decimal(5, 2)
  longStopLossPrice       Decimal? @db.Decimal(20, 8)
  longStopLossOrderId     String?  @db.VarChar(100)
  shortStopLossPrice      Decimal? @db.Decimal(20, 8)
  shortStopLossOrderId    String?  @db.VarChar(100)

  takeProfitEnabled       Boolean  @default(false)
  takeProfitPercent       Decimal? @db.Decimal(5, 2)
  longTakeProfitPrice     Decimal? @db.Decimal(20, 8)
  longTakeProfitOrderId   String?  @db.VarChar(100)
  shortTakeProfitPrice    Decimal? @db.Decimal(20, 8)
  shortTakeProfitOrderId  String?  @db.VarChar(100)

  conditionalOrderStatus  ConditionalOrderStatus @default(PENDING)
  conditionalOrderError   String?

  // ... other fields
}

enum ConditionalOrderStatus {
  PENDING   // 尚未設定
  SETTING   // 設定中
  SET       // 設定完成
  PARTIAL   // 部分設定成功
  FAILED    // 設定失敗
}
```

## 服務層介面

### ConditionalOrderAdapter（條件單適配器介面）

```typescript
interface ConditionalOrderAdapter {
  readonly exchangeName: string;

  setStopLossOrder(params: SetStopLossOrderParams): Promise<SingleConditionalOrderResult>;
  setTakeProfitOrder(params: SetTakeProfitOrderParams): Promise<SingleConditionalOrderResult>;
  cancelConditionalOrder(symbol: string, orderId: string): Promise<boolean>;
}

interface SetStopLossOrderParams {
  symbol: string;
  side: TradeSide;        // 'LONG' | 'SHORT'
  quantity: Decimal;
  triggerPrice: Decimal;
}

interface SingleConditionalOrderResult {
  success: boolean;
  orderId?: string;
  triggerPrice?: Decimal;
  error?: string;
}
```

### OKX 帳戶模式（新增偵測）

```typescript
type OkxPositionMode = 'long_short_mode' | 'net_mode';

interface OkxAdapterOptions {
  positionMode: OkxPositionMode;
}
```

### Gate.io 合約數量轉換（修復邏輯）

```typescript
// 修復前（錯誤）
const sizeInt = Math.abs(parseInt(sizeValue.toString(), 10));

// 修復後（正確）
const sizeAbs = Math.abs(parseFloat(sizeValue.toString()));
const sizeInt = Math.max(1, Math.round(sizeAbs));
const finalSize = side === 'LONG' ? -sizeInt : sizeInt;
```

## 無 Schema 變更

本次修復不涉及資料庫 schema 變更，僅修改服務層邏輯。
