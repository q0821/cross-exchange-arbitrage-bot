# Data Model: 停損停利觸發偵測與自動平倉

**Feature**: 050-sl-tp-trigger-monitor
**Created**: 2025-12-29

---

## 資料模型變更

### 1. Position 模型擴展

**現有欄位（重用）**：
```prisma
model Position {
  // 條件單 ID（已存在）
  longStopLossOrderId      String?   @db.VarChar(100)
  longTakeProfitOrderId    String?   @db.VarChar(100)
  shortStopLossOrderId     String?   @db.VarChar(100)
  shortTakeProfitOrderId   String?   @db.VarChar(100)

  // 狀態（已存在）
  status                   PositionWebStatus @default(PENDING)
  closedAt                 DateTime? @db.Timestamptz
}
```

**新增欄位**：
```prisma
model Position {
  // ... 現有欄位

  // Feature 050: 平倉原因
  closeReason  CloseReason?
}
```

### 2. 新增 CloseReason Enum

```prisma
enum CloseReason {
  MANUAL              // 手動平倉
  LONG_SL_TRIGGERED   // 多方停損觸發
  LONG_TP_TRIGGERED   // 多方停利觸發
  SHORT_SL_TRIGGERED  // 空方停損觸發
  SHORT_TP_TRIGGERED  // 空方停利觸發
  BOTH_TRIGGERED      // 雙邊同時觸發

  @@map("close_reason")
}
```

---

## 實體關係圖

```
┌─────────────────────────────────────────────────────────────┐
│                        Position                              │
├─────────────────────────────────────────────────────────────┤
│ id                      String       @id @default(cuid())   │
│ userId                  String                              │
│ symbol                  String                              │
│ longExchange            String                              │
│ shortExchange           String                              │
│ status                  PositionWebStatus                   │
│                                                             │
│ // 條件單 ID（用於偵測觸發）                                  │
│ longStopLossOrderId     String?                             │
│ longTakeProfitOrderId   String?                             │
│ shortStopLossOrderId    String?                             │
│ shortTakeProfitOrderId  String?                             │
│                                                             │
│ // 新增：平倉原因                                            │
│ closeReason             CloseReason?  ← NEW                 │
│                                                             │
│ closedAt                DateTime?                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ 1:1
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                         Trade                                │
├─────────────────────────────────────────────────────────────┤
│ id                      String       @id @default(cuid())   │
│ positionId              String       @unique                │
│ totalPnL                Decimal                             │
│ roi                     Decimal                             │
│ status                  TradeWebStatus                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 狀態轉換

### Position.status 狀態機

```
                        ┌──────────────────────────────────────────┐
                        │                                          │
                        ▼                                          │
  ┌─────────┐      ┌─────────┐      ┌─────────┐      ┌─────────┐  │
  │ PENDING │ ──→  │ OPENING │ ──→  │  OPEN   │ ──→  │ CLOSING │  │
  └─────────┘      └─────────┘      └─────────┘      └─────────┘  │
       │                │                │                │        │
       │                │                │                │        │
       ▼                ▼                │                ▼        │
  ┌─────────┐      ┌─────────┐          │           ┌─────────┐   │
  │ FAILED  │      │ PARTIAL │          │           │ CLOSED  │   │
  └─────────┘      └─────────┘          │           └─────────┘   │
                                        │                │        │
                                        │                │        │
                                        └────────────────┴────────┘
                                              觸發偵測後
                                              自動平倉
```

### CloseReason 設定時機

| 情境 | closeReason | 說明 |
|------|-------------|------|
| 手動平倉 | `MANUAL` | 用戶主動點擊平倉按鈕 |
| 多方停損觸發 | `LONG_SL_TRIGGERED` | 多方價格跌破停損價 |
| 多方停利觸發 | `LONG_TP_TRIGGERED` | 多方價格漲破停利價 |
| 空方停損觸發 | `SHORT_SL_TRIGGERED` | 空方價格漲破停損價 |
| 空方停利觸發 | `SHORT_TP_TRIGGERED` | 空方價格跌破停利價 |
| 雙邊同時觸發 | `BOTH_TRIGGERED` | 多空雙方在同一檢查週期內都觸發 |

---

## 資料查詢模式

### 1. 查詢需要監控的持倉

```sql
SELECT * FROM positions
WHERE status IN ('OPEN', 'OPENING')
  AND (
    longStopLossOrderId IS NOT NULL
    OR longTakeProfitOrderId IS NOT NULL
    OR shortStopLossOrderId IS NOT NULL
    OR shortTakeProfitOrderId IS NOT NULL
  );
```

### 2. 依用戶分組持倉

監控服務需要依用戶分組，以便重用 API Key 連接：

```sql
SELECT userId, array_agg(id) as positionIds
FROM positions
WHERE status IN ('OPEN', 'OPENING')
GROUP BY userId;
```

### 3. 查詢觸發歷史

```sql
SELECT * FROM positions
WHERE closeReason IS NOT NULL
  AND closeReason != 'MANUAL'
ORDER BY closedAt DESC
LIMIT 100;
```

---

## 索引建議

現有索引已足夠支援此功能：

```prisma
@@index([userId, status])       // 依用戶和狀態查詢
@@index([symbol, status])       // 依交易對和狀態查詢
@@index([createdAt(sort: Desc)]) // 時間排序
```

---

## Migration Script

```sql
-- Feature 050: 新增平倉原因欄位

-- 1. 建立 CloseReason enum
CREATE TYPE close_reason AS ENUM (
  'MANUAL',
  'LONG_SL_TRIGGERED',
  'LONG_TP_TRIGGERED',
  'SHORT_SL_TRIGGERED',
  'SHORT_TP_TRIGGERED',
  'BOTH_TRIGGERED'
);

-- 2. 新增 closeReason 欄位到 positions 表
ALTER TABLE positions
ADD COLUMN close_reason close_reason;

-- 3. 更新現有已關閉的持倉為 MANUAL（可選）
UPDATE positions
SET close_reason = 'MANUAL'
WHERE status = 'CLOSED'
  AND close_reason IS NULL;
```

---

## 資料完整性

### 約束條件

1. **closeReason 只在 CLOSED 狀態時有值**
   - 當 `status = 'CLOSED'` 時，`closeReason` 應有值
   - 當 `status != 'CLOSED'` 時，`closeReason` 應為 NULL

2. **觸發類型與條件單 ID 一致性**
   - 如果 `closeReason = 'LONG_SL_TRIGGERED'`，則 `longStopLossOrderId` 應有值
   - 如果 `closeReason = 'LONG_TP_TRIGGERED'`，則 `longTakeProfitOrderId` 應有值
   - 以此類推

### 驗證邏輯（應用層）

```typescript
function validateCloseReason(position: Position): boolean {
  if (position.status !== 'CLOSED') {
    return position.closeReason === null;
  }

  // CLOSED 狀態應有 closeReason
  if (!position.closeReason) {
    return false;
  }

  // 驗證觸發類型與訂單 ID 一致性
  switch (position.closeReason) {
    case 'LONG_SL_TRIGGERED':
      return !!position.longStopLossOrderId;
    case 'LONG_TP_TRIGGERED':
      return !!position.longTakeProfitOrderId;
    case 'SHORT_SL_TRIGGERED':
      return !!position.shortStopLossOrderId;
    case 'SHORT_TP_TRIGGERED':
      return !!position.shortTakeProfitOrderId;
    case 'BOTH_TRIGGERED':
      return true; // 可能是多種組合
    case 'MANUAL':
      return true;
    default:
      return false;
  }
}
```
