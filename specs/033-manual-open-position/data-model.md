# Data Model: 手動開倉功能

**Date**: 2025-12-17
**Feature**: 033-manual-open-position

## Overview

此功能主要使用現有的 Prisma 數據模型，無需新增 schema。以下文檔說明如何使用現有模型以及欄位的使用方式。

## 使用的現有模型

### 1. Position（持倉）

現有模型路徑：`prisma/schema.prisma` 中的 `Position` model

```prisma
model Position {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id])
  symbol        String   // 交易對，如 "BTCUSDT"
  longExchange  String   // Long 倉位的交易所
  shortExchange String   // Short 倉位的交易所
  leverage      Int      @default(3) // 槓桿倍數
  status        String   // PENDING, OPENING, OPEN, CLOSING, CLOSED, FAILED, PARTIAL
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  trades        Trade[]
}
```

**欄位使用說明**：

| 欄位 | 用途 | 本功能使用 |
|------|------|-----------|
| id | 唯一識別碼 | 開倉請求時生成 |
| userId | 用戶 ID | 從 session 獲取 |
| symbol | 交易對 | 從開倉對話框獲取 |
| longExchange | Long 交易所 | 費率較低的交易所 |
| shortExchange | Short 交易所 | 費率較高的交易所 |
| leverage | 槓桿倍數 | 1 或 2（用戶選擇） |
| status | 狀態 | 狀態轉換見下方 |

**狀態轉換圖**：

```
PENDING ─────► OPENING ─────► OPEN
    │              │            │
    │              │            │
    ▼              ▼            ▼
  FAILED        FAILED       CLOSING ─────► CLOSED
                   │                          │
                   ▼                          ▼
               PARTIAL                      PARTIAL
               (需手動處理)                 (需手動處理)
```

---

### 2. Trade（交易記錄）

現有模型路徑：`prisma/schema.prisma` 中的 `Trade` model

```prisma
model Trade {
  id              String   @id @default(cuid())
  positionId      String
  position        Position @relation(fields: [positionId], references: [id])
  exchange        String   // 交易所名稱
  side            String   // LONG 或 SHORT
  action          String   // OPEN 或 CLOSE
  orderId         String?  // 交易所返回的訂單 ID
  quantity        Decimal  // 倉位數量
  price           Decimal  // 成交價格
  fee             Decimal  // 手續費
  status          String   // PENDING, FILLED, FAILED
  executedAt      DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

**欄位使用說明**：

| 欄位 | 用途 | 本功能使用 |
|------|------|-----------|
| positionId | 關聯的持倉 ID | 開倉時創建 |
| exchange | 交易所 | binance / okx / mexc / gateio |
| side | 方向 | LONG 或 SHORT |
| action | 動作 | 本功能使用 OPEN |
| orderId | 訂單 ID | 交易所返回值 |
| quantity | 數量 | 開倉數量（幣本位） |
| price | 價格 | 實際成交價格 |
| fee | 手續費 | 實際扣除的手續費 |
| status | 狀態 | PENDING → FILLED / FAILED |

---

### 3. AuditLog（審計日誌）

需要確認是否存在，如不存在則需要新增。

```prisma
model AuditLog {
  id        String   @id @default(cuid())
  userId    String?
  action    String   // POSITION_OPEN, POSITION_ROLLBACK, POSITION_FAILED
  target    String   // Position ID
  details   Json     // 詳細資訊
  ipAddress String?
  createdAt DateTime @default(now())
}
```

**Action 類型**：

| Action | 說明 |
|--------|------|
| POSITION_OPEN_STARTED | 開始開倉 |
| POSITION_OPEN_SUCCESS | 開倉成功 |
| POSITION_OPEN_FAILED | 開倉失敗 |
| POSITION_ROLLBACK_STARTED | 開始回滾 |
| POSITION_ROLLBACK_SUCCESS | 回滾成功 |
| POSITION_ROLLBACK_FAILED | 回滾失敗 |

---

### 4. ApiKey（API 金鑰）

已存在，用於獲取用戶的交易所 API Key。

```prisma
model ApiKey {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  exchange        String   // binance, okx, mexc, gateio
  encryptedKey    String   // 加密後的 API Key
  encryptedSecret String   // 加密後的 Secret
  passphrase      String?  // OKX 需要
  environment     String   @default("mainnet") // mainnet, testnet
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

---

## 數據流程

### 開倉流程的數據操作

```
1. 創建 Position（PENDING 狀態）
   ↓
2. 創建兩個 Trade 記錄（PENDING 狀態）
   - Trade 1: exchange=longExchange, side=LONG, action=OPEN
   - Trade 2: exchange=shortExchange, side=SHORT, action=OPEN
   ↓
3. 更新 Position 狀態（OPENING）
   ↓
4. 執行交易所 API 調用
   ↓
5. 更新 Trade 記錄
   - 成功: status=FILLED, orderId=xxx, price=xxx, fee=xxx
   - 失敗: status=FAILED
   ↓
6. 更新 Position 狀態
   - 兩邊成功: OPEN
   - 兩邊失敗: FAILED
   - 一邊成功: 執行回滾
     - 回滾成功: FAILED
     - 回滾失敗: PARTIAL
   ↓
7. 創建 AuditLog 記錄
```

---

## 查詢模式

### 查詢用戶的持倉列表

```typescript
const positions = await prisma.position.findMany({
  where: {
    userId,
    status: { in: ['OPEN', 'OPENING', 'PARTIAL'] },
  },
  include: {
    trades: true,
  },
  orderBy: { createdAt: 'desc' },
});
```

### 檢查是否有進行中的開倉操作

```typescript
const pendingPosition = await prisma.position.findFirst({
  where: {
    userId,
    symbol,
    status: { in: ['PENDING', 'OPENING'] },
  },
});
```

---

## 索引建議

現有索引應該已足夠，但建議確認以下索引存在：

```prisma
@@index([userId, status])
@@index([userId, symbol, status])
```

---

## 驗證規則

### Position 創建驗證

```typescript
const OpenPositionSchema = z.object({
  symbol: z.string().min(1),
  longExchange: z.enum(['binance', 'okx', 'mexc', 'gateio']),
  shortExchange: z.enum(['binance', 'okx', 'mexc', 'gateio']),
  positionSizeUsdt: z.number().positive().max(100000),
  leverage: z.enum([1, 2]).default(1),
});
```

### 業務規則驗證

1. `longExchange !== shortExchange`（不能在同一交易所開對沖倉位）
2. 用戶必須有兩個交易所的有效 API Key
3. 餘額必須充足（含 10% 緩衝）
4. 不能對同一交易對有進行中的開倉操作
