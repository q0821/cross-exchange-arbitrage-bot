# Data Model: 套利機會結束監測和通知

**Feature**: 027-opportunity-end-notification
**Date**: 2025-12-01

## 概述

本功能涉及以下資料模型變更：
1. **NotificationWebhook** - 新增 `notifyOnDisappear` 欄位
2. **OpportunityHistory** - 新增資料表（取代已棄用的舊模型）
3. **TrackedOpportunity** - 記憶體資料結構（非持久化）

---

## 1. NotificationWebhook 擴展

### Schema 變更

```prisma
model NotificationWebhook {
  id              String   @id @default(cuid())
  userId          String
  platform        String   @db.VarChar(20)
  webhookUrl      String   @db.Text
  name            String   @db.VarChar(100)
  isEnabled       Boolean  @default(true)
  threshold       Decimal  @default(800) @db.Decimal(10, 4)
  notifyOnDisappear Boolean @default(true)  // 新增欄位
  createdAt       DateTime @default(now()) @db.Timestamptz
  updatedAt       DateTime @updatedAt @db.Timestamptz

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, isEnabled])
  @@index([platform])
  @@map("notification_webhooks")
}
```

### 欄位說明

| 欄位 | 類型 | 說明 |
|------|------|------|
| notifyOnDisappear | Boolean | 是否接收機會結束通知，預設 true |

### Migration

```sql
ALTER TABLE notification_webhooks
ADD COLUMN notify_on_disappear BOOLEAN NOT NULL DEFAULT true;
```

---

## 2. OpportunityHistory 新增

### Schema

```prisma
model OpportunityHistory {
  id                    String   @id @default(cuid())

  // 基本資訊
  symbol                String   @db.VarChar(20)
  longExchange          String   @db.VarChar(20)
  shortExchange         String   @db.VarChar(20)

  // 時間資訊
  detectedAt            DateTime @db.Timestamptz
  disappearedAt         DateTime @db.Timestamptz
  durationMs            BigInt

  // 費差統計
  initialSpread         Decimal  @db.Decimal(10, 6)
  maxSpread             Decimal  @db.Decimal(10, 6)
  maxSpreadAt           DateTime @db.Timestamptz
  finalSpread           Decimal  @db.Decimal(10, 6)

  // 費率結算週期
  longIntervalHours     Int      @db.SmallInt
  shortIntervalHours    Int      @db.SmallInt

  // 費率結算記錄 (JSON)
  settlementRecords     Json     @default("[]")
  // 格式: [{ side: "long"|"short", timestamp: ISO8601, rate: number }]

  // 模擬收益計算結果
  longSettlementCount   Int      @db.SmallInt
  shortSettlementCount  Int      @db.SmallInt
  totalFundingProfit    Decimal  @db.Decimal(10, 6)
  totalCost             Decimal  @db.Decimal(10, 6)  // 固定 0.002 (0.2%)
  netProfit             Decimal  @db.Decimal(10, 6)
  realizedAPY           Decimal  @db.Decimal(10, 2)

  // 通知統計
  notificationCount     Int      @default(1)

  // 關聯用戶
  userId                String
  user                  User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  createdAt             DateTime @default(now()) @db.Timestamptz

  @@index([userId])
  @@index([symbol])
  @@index([disappearedAt])
  @@map("opportunity_histories")
}
```

### 欄位說明

| 欄位 | 類型 | 說明 |
|------|------|------|
| symbol | String | 交易對符號（如 BTCUSDT） |
| longExchange | String | 做多交易所名稱 |
| shortExchange | String | 做空交易所名稱 |
| detectedAt | DateTime | 機會首次偵測時間 |
| disappearedAt | DateTime | 機會結束時間 |
| durationMs | BigInt | 持續時間（毫秒） |
| initialSpread | Decimal | 初始費差（百分比，如 0.012 = 1.2%） |
| maxSpread | Decimal | 最高費差 |
| maxSpreadAt | DateTime | 最高費差發生時間 |
| finalSpread | Decimal | 結束時費差 |
| longIntervalHours | Int | 做多方結算週期（小時） |
| shortIntervalHours | Int | 做空方結算週期（小時） |
| settlementRecords | Json | 費率結算記錄陣列 |
| longSettlementCount | Int | 做多方結算次數 |
| shortSettlementCount | Int | 做空方結算次數 |
| totalFundingProfit | Decimal | 總費率收益 |
| totalCost | Decimal | 開平倉成本（固定 0.2%） |
| netProfit | Decimal | 淨收益 |
| realizedAPY | Decimal | 實際年化收益率 |
| notificationCount | Int | 通知次數 |
| userId | String | 關聯用戶 ID |

### settlementRecords JSON 結構

```typescript
interface SettlementRecord {
  side: 'long' | 'short';
  timestamp: string;  // ISO8601 format
  rate: number;       // 費率（正數=收取，負數=支付）
}

// 範例
[
  { "side": "long", "timestamp": "2025-12-01T08:00:00Z", "rate": -0.0012 },
  { "side": "short", "timestamp": "2025-12-01T08:00:00Z", "rate": 0.0015 },
  { "side": "long", "timestamp": "2025-12-01T16:00:00Z", "rate": -0.0010 },
  { "side": "short", "timestamp": "2025-12-01T09:00:00Z", "rate": 0.0008 },
  { "side": "short", "timestamp": "2025-12-01T10:00:00Z", "rate": 0.0009 }
]
```

### Migration

```sql
CREATE TABLE opportunity_histories (
  id                      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  symbol                  VARCHAR(20) NOT NULL,
  long_exchange           VARCHAR(20) NOT NULL,
  short_exchange          VARCHAR(20) NOT NULL,
  detected_at             TIMESTAMPTZ NOT NULL,
  disappeared_at          TIMESTAMPTZ NOT NULL,
  duration_ms             BIGINT NOT NULL,
  initial_spread          DECIMAL(10,6) NOT NULL,
  max_spread              DECIMAL(10,6) NOT NULL,
  max_spread_at           TIMESTAMPTZ NOT NULL,
  final_spread            DECIMAL(10,6) NOT NULL,
  long_interval_hours     SMALLINT NOT NULL,
  short_interval_hours    SMALLINT NOT NULL,
  settlement_records      JSONB NOT NULL DEFAULT '[]',
  long_settlement_count   SMALLINT NOT NULL,
  short_settlement_count  SMALLINT NOT NULL,
  total_funding_profit    DECIMAL(10,6) NOT NULL,
  total_cost              DECIMAL(10,6) NOT NULL,
  net_profit              DECIMAL(10,6) NOT NULL,
  realized_apy            DECIMAL(10,2) NOT NULL,
  notification_count      INTEGER NOT NULL DEFAULT 1,
  user_id                 TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_opportunity_histories_user_id ON opportunity_histories(user_id);
CREATE INDEX idx_opportunity_histories_symbol ON opportunity_histories(symbol);
CREATE INDEX idx_opportunity_histories_disappeared_at ON opportunity_histories(disappeared_at);
```

---

## 3. TrackedOpportunity（記憶體結構）

此結構僅存在於記憶體中，用於追蹤活躍機會。

### TypeScript 定義

```typescript
// src/services/notification/types.ts

export interface FundingSettlement {
  timestamp: Date;
  rate: number;  // 正數=收取，負數=支付
}

export interface NotifiedWebhookInfo {
  webhookId: string;
  userId: string;
  threshold: number;
  notifyOnDisappear: boolean;
}

export interface TrackedOpportunity {
  // 識別資訊
  symbol: string;
  longExchange: string;
  shortExchange: string;

  // 時間資訊
  detectedAt: Date;
  lastUpdatedAt: Date;

  // 費差統計
  initialSpread: number;
  maxSpread: number;
  maxSpreadAt: Date;
  currentSpread: number;

  // 費率結算記錄（多空分開）
  longSettlements: FundingSettlement[];
  shortSettlements: FundingSettlement[];
  longIntervalHours: number;
  shortIntervalHours: number;

  // 下次結算時間（用於判斷是否該記錄）
  longNextSettlement?: Date;
  shortNextSettlement?: Date;

  // 已通知的 Webhook（key: webhookId）
  notifiedWebhooks: Map<string, NotifiedWebhookInfo>;

  // 通知計數
  notificationCount: number;

  // 防抖動：首次低於某 Webhook 閾值的時間（key: webhookId）
  disappearingAt: Map<string, Date>;
}
```

### Map Key 格式

```typescript
// TrackedOpportunity 的 Map key
const key = `${symbol}:${longExchange}:${shortExchange}`;
// 範例: "BTCUSDT:binance:okx"
```

---

## 4. 通知訊息結構

### OpportunityDisappearedMessage

```typescript
export interface OpportunityDisappearedMessage {
  // 基本資訊
  symbol: string;
  longExchange: string;
  shortExchange: string;

  // 時間資訊
  detectedAt: Date;
  disappearedAt: Date;
  durationFormatted: string;  // "2 小時 30 分鐘"

  // 費差統計
  initialSpread: number;
  maxSpread: number;
  maxSpreadAt: Date;
  finalSpread: number;

  // 費率結算記錄
  longIntervalHours: number;
  shortIntervalHours: number;
  settlementRecords: Array<{
    side: 'long' | 'short';
    timestamp: Date;
    rate: number;
  }>;

  // 模擬收益
  longSettlementCount: number;
  shortSettlementCount: number;
  totalFundingProfit: number;
  totalCost: number;
  netProfit: number;
  realizedAPY: number;

  // 通知統計
  notificationCount: number;

  // 時間戳
  timestamp: Date;
}
```

---

## 5. 實體關係圖

```
┌─────────────────────┐
│        User         │
├─────────────────────┤
│ id                  │
│ email               │
│ ...                 │
└─────────┬───────────┘
          │
          │ 1:N
          ▼
┌─────────────────────┐       ┌─────────────────────┐
│ NotificationWebhook │       │  OpportunityHistory │
├─────────────────────┤       ├─────────────────────┤
│ id                  │       │ id                  │
│ userId (FK)         │       │ userId (FK)         │
│ platform            │       │ symbol              │
│ webhookUrl          │       │ longExchange        │
│ name                │       │ shortExchange       │
│ isEnabled           │       │ detectedAt          │
│ threshold           │       │ disappearedAt       │
│ notifyOnDisappear ◀─┼─NEW   │ durationMs          │
│ createdAt           │       │ initialSpread       │
│ updatedAt           │       │ maxSpread           │
└─────────────────────┘       │ ...                 │
                              │ settlementRecords   │
                              │ netProfit           │
                              │ realizedAPY         │
                              └─────────────────────┘
                                       ▲
                                       │ NEW
```

---

## 6. 驗證規則

### NotificationWebhook

| 欄位 | 驗證規則 |
|------|----------|
| notifyOnDisappear | Boolean，預設 true |

### OpportunityHistory

| 欄位 | 驗證規則 |
|------|----------|
| symbol | 非空字串，最大 20 字元 |
| longExchange | 非空字串，最大 20 字元 |
| shortExchange | 非空字串，最大 20 字元 |
| durationMs | 正整數 |
| initialSpread | 0 ~ 1 之間的小數 |
| maxSpread | >= initialSpread |
| finalSpread | 0 ~ 1 之間的小數 |
| longIntervalHours | 1, 4, 或 8 |
| shortIntervalHours | 1, 4, 或 8 |
| settlementRecords | 有效 JSON 陣列 |
| totalCost | 固定 0.002 (0.2%) |
| notificationCount | >= 1 |

---

## 7. 狀態轉換

### TrackedOpportunity 生命週期

```
[未追蹤] ──(機會通知發送)──> [追蹤中]
                               │
                               ├──(費率更新)──> [追蹤中] (更新統計)
                               │
                               ├──(結算時間點)──> [追蹤中] (記錄結算)
                               │
                               └──(費差 < 閾值 持續 1 分鐘)──> [結束]
                                                                 │
                                                                 ├──> 發送結束通知
                                                                 ├──> 寫入 OpportunityHistory
                                                                 └──> 從 Map 移除
```
