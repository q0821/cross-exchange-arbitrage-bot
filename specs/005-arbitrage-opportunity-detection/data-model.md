# Data Model: 套利機會自動偵測系統

**Feature**: 005-arbitrage-opportunity-detection
**Date**: 2025-10-21
**Phase**: Phase 1 - Design

## 概述

本文件定義套利機會自動偵測系統的資料模型，包含實體、欄位、關聯、驗證規則和狀態轉換。

## 實體定義

### E1: ArbitrageOpportunity（套利機會）

**用途**: 記錄偵測到的套利機會，包含費率差異、預期收益和生命週期狀態。

#### 欄位

| 欄位名稱 | 型別 | 必填 | 預設值 | 說明 |
|---------|------|------|--------|------|
| `id` | UUID | ✓ | uuid_generate_v4() | 主鍵 |
| `symbol` | String(20) | ✓ | - | 交易對符號（例如：BTCUSDT） |
| `long_exchange` | String(50) | ✓ | - | 做多交易所（費率較低的一方） |
| `short_exchange` | String(50) | ✓ | - | 做空交易所（費率較高的一方） |
| `long_funding_rate` | Decimal(10,8) | ✓ | - | 做多交易所資金費率 |
| `short_funding_rate` | Decimal(10,8) | ✓ | - | 做空交易所資金費率 |
| `rate_difference` | Decimal(10,8) | ✓ | - | 費率差異（short - long） |
| `expected_return_rate` | Decimal(10,8) | ✓ | - | 預期年化收益率 |
| `status` | Enum | ✓ | ACTIVE | 機會狀態（ACTIVE, EXPIRED, CLOSED） |
| `detected_at` | Timestamptz | ✓ | now() | 首次偵測時間 |
| `expired_at` | Timestamptz | ✓ | - | 機會過期時間（由閾值決定） |
| `closed_at` | Timestamptz | ✗ | null | 機會關閉時間（消失或手動關閉） |
| `max_rate_difference` | Decimal(10,8) | ✗ | null | 生命週期內最大費率差異 |
| `max_rate_difference_at` | Timestamptz | ✗ | null | 最大費率差異發生時間 |
| `notification_count` | Integer | ✓ | 0 | 總通知次數 |
| `last_notification_at` | Timestamptz | ✗ | null | 最後一次通知時間 |
| `created_at` | Timestamptz | ✓ | now() | 記錄建立時間 |
| `updated_at` | Timestamptz | ✓ | now() | 記錄更新時間 |

#### 狀態列舉（OpportunityStatus）

```typescript
enum OpportunityStatus {
  ACTIVE   = 'ACTIVE',    // 機會活躍中（費率差異仍超過閾值）
  EXPIRED  = 'EXPIRED',   // 機會已過期（費率差異回落至閾值以下）
  CLOSED   = 'CLOSED',    // 機會已關閉（手動關閉或系統清理）
}
```

#### 驗證規則

- `rate_difference` 必須 > 0（short 費率應高於 long 費率）
- `expected_return_rate` = `rate_difference` × 3（每天 3 次結算）× 365（天）
- `expired_at` 必須 > `detected_at`
- `closed_at` 如果存在，必須 >= `detected_at`
- `max_rate_difference` 如果存在，必須 >= `rate_difference`
- `notification_count` 必須 >= 0

#### 索引

```sql
CREATE INDEX idx_opportunity_status ON arbitrage_opportunities(status);
CREATE INDEX idx_opportunity_detected ON arbitrage_opportunities(detected_at DESC);
CREATE INDEX idx_opportunity_symbol_detected ON arbitrage_opportunities(symbol, detected_at DESC);
CREATE INDEX idx_opportunity_expired ON arbitrage_opportunities(expired_at);
CREATE INDEX idx_opportunity_active ON arbitrage_opportunities(status) WHERE status = 'ACTIVE';
```

#### 狀態轉換

```
[初始狀態] → ACTIVE
    ↓
    ├─ [費率回落] → EXPIRED → [手動關閉] → CLOSED
    ├─ [時間過期] → EXPIRED → [自動清理] → CLOSED
    └─ [手動關閉] → CLOSED
```

**轉換規則**:

1. **ACTIVE → EXPIRED**: 當 `rate_difference` < 閾值時，自動設定 `expired_at = now()`, `status = EXPIRED`
2. **EXPIRED → CLOSED**: 當機會過期超過 24 小時，自動設定 `closed_at = now()`, `status = CLOSED`
3. **ACTIVE → CLOSED**: 手動關閉機會（未來功能）

---

### E2: OpportunityHistory（機會歷史摘要）

**用途**: 記錄已消失機會的摘要統計，用於歷史分析和趨勢查詢。

#### 欄位

| 欄位名稱 | 型別 | 必填 | 預設值 | 說明 |
|---------|------|------|--------|------|
| `id` | UUID | ✓ | uuid_generate_v4() | 主鍵 |
| `opportunity_id` | UUID | ✓ | - | 關聯的 ArbitrageOpportunity ID |
| `symbol` | String(20) | ✓ | - | 交易對符號（冗餘以加速查詢） |
| `long_exchange` | String(50) | ✓ | - | 做多交易所 |
| `short_exchange` | String(50) | ✓ | - | 做空交易所 |
| `initial_rate_difference` | Decimal(10,8) | ✓ | - | 初始費率差異 |
| `max_rate_difference` | Decimal(10,8) | ✓ | - | 最大費率差異 |
| `avg_rate_difference` | Decimal(10,8) | ✓ | - | 平均費率差異 |
| `duration_ms` | BigInt | ✓ | - | 持續時間（毫秒） |
| `duration_minutes` | Decimal(10,2) | ✓ | - | 持續時間（分鐘，方便閱讀） |
| `total_notifications` | Integer | ✓ | - | 總通知次數 |
| `detected_at` | Timestamptz | ✓ | - | 首次偵測時間 |
| `expired_at` | Timestamptz | ✓ | - | 過期時間 |
| `disappear_reason` | Enum | ✓ | - | 消失原因 |
| `created_at` | Timestamptz | ✓ | now() | 記錄建立時間 |

#### 消失原因列舉（DisappearReason）

```typescript
enum DisappearReason {
  RATE_DROPPED   = 'RATE_DROPPED',   // 費率回落至閾值以下
  DATA_UNAVAILABLE = 'DATA_UNAVAILABLE', // 交易所資料無法取得
  MANUAL_CLOSE   = 'MANUAL_CLOSE',   // 手動關閉
  SYSTEM_ERROR   = 'SYSTEM_ERROR',   // 系統錯誤
}
```

#### 驗證規則

- `duration_ms` 必須 > 0
- `duration_minutes` = `duration_ms` / 60000
- `max_rate_difference` >= `initial_rate_difference`
- `avg_rate_difference` 應在 `initial_rate_difference` 和 `max_rate_difference` 之間
- `total_notifications` >= 0
- `expired_at` > `detected_at`

#### 索引

```sql
CREATE INDEX idx_history_symbol ON opportunity_history(symbol);
CREATE INDEX idx_history_detected ON opportunity_history(detected_at DESC);
CREATE INDEX idx_history_duration ON opportunity_history(duration_ms DESC);
CREATE INDEX idx_history_max_diff ON opportunity_history(max_rate_difference DESC);
```

#### 觸發器

當 `ArbitrageOpportunity.status` 變更為 `EXPIRED` 時，自動建立 `OpportunityHistory` 記錄。

---

### E3: NotificationLog（通知日誌）

**用途**: 記錄每次發送的通知，用於追蹤、除錯和防抖動機制。

#### 欄位

| 欄位名稱 | 型別 | 必填 | 預設值 | 說明 |
|---------|------|------|--------|------|
| `id` | UUID | ✓ | uuid_generate_v4() | 主鍵 |
| `opportunity_id` | UUID | ✓ | - | 關聯的 ArbitrageOpportunity ID |
| `symbol` | String(20) | ✓ | - | 交易對符號 |
| `notification_type` | Enum | ✓ | - | 通知類型 |
| `channel` | Enum | ✓ | - | 通知渠道 |
| `severity` | Enum | ✓ | INFO | 嚴重程度 |
| `message` | Text | ✓ | - | 通知訊息內容 |
| `rate_difference` | Decimal(10,8) | ✓ | - | 當時的費率差異 |
| `sent_at` | Timestamptz | ✓ | now() | 發送時間 |
| `is_debounced` | Boolean | ✓ | false | 是否經過防抖動 |
| `debounce_skipped_count` | Integer | ✓ | 0 | 防抖動期間跳過的通知次數 |

#### 通知類型列舉（NotificationType）

```typescript
enum NotificationType {
  OPPORTUNITY_APPEARED   = 'OPPORTUNITY_APPEARED',   // 機會出現
  OPPORTUNITY_DISAPPEARED = 'OPPORTUNITY_DISAPPEARED', // 機會消失
  OPPORTUNITY_UPDATED    = 'OPPORTUNITY_UPDATED',    // 機會更新
}
```

#### 通知渠道列舉（NotificationChannel）

```typescript
enum NotificationChannel {
  TERMINAL = 'TERMINAL', // 終端輸出
  LOG      = 'LOG',      // 日誌檔案
  WEBHOOK  = 'WEBHOOK',  // Webhook（未來功能）
  TELEGRAM = 'TELEGRAM', // Telegram（未來功能）
}
```

#### 嚴重程度列舉（Severity）

```typescript
enum Severity {
  INFO     = 'INFO',     // 資訊：超過閾值
  WARNING  = 'WARNING',  // 警告：高價差（>0.2%）
  CRITICAL = 'CRITICAL', // 嚴重：極高價差（>0.5%）
}
```

#### 驗證規則

- `rate_difference` 必須 > 0
- `debounce_skipped_count` >= 0
- 如果 `is_debounced = true`，則 `debounce_skipped_count` 應 > 0

#### 索引

```sql
CREATE INDEX idx_notification_opportunity ON notification_logs(opportunity_id);
CREATE INDEX idx_notification_symbol ON notification_logs(symbol);
CREATE INDEX idx_notification_sent ON notification_logs(sent_at DESC);
CREATE INDEX idx_notification_type ON notification_logs(notification_type);
```

#### 保留策略

使用 TimescaleDB 自動清理 90 天前的通知日誌（可配置）。

---

## 實體關聯圖

```
ArbitrageOpportunity (1) ──< (N) NotificationLog
        │
        │ (1:1)
        ↓
OpportunityHistory
```

### 關聯說明

1. **ArbitrageOpportunity ↔ NotificationLog** (1:N)
   - 一個機會可以有多個通知日誌
   - 外鍵：`NotificationLog.opportunity_id` → `ArbitrageOpportunity.id`
   - 刪除行為：CASCADE（刪除機會時一併刪除通知日誌）

2. **ArbitrageOpportunity ↔ OpportunityHistory** (1:1)
   - 一個機會最多對應一個歷史摘要
   - 外鍵：`OpportunityHistory.opportunity_id` → `ArbitrageOpportunity.id` (UNIQUE)
   - 刪除行為：RESTRICT（有歷史記錄的機會不能刪除）

---

## Prisma Schema 定義

```prisma
// src/prisma/schema.prisma

enum OpportunityStatus {
  ACTIVE
  EXPIRED
  CLOSED
}

enum DisappearReason {
  RATE_DROPPED
  DATA_UNAVAILABLE
  MANUAL_CLOSE
  SYSTEM_ERROR
}

enum NotificationType {
  OPPORTUNITY_APPEARED
  OPPORTUNITY_DISAPPEARED
  OPPORTUNITY_UPDATED
}

enum NotificationChannel {
  TERMINAL
  LOG
  WEBHOOK
  TELEGRAM
}

enum Severity {
  INFO
  WARNING
  CRITICAL
}

model ArbitrageOpportunity {
  id                      String              @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  symbol                  String              @db.VarChar(20)
  long_exchange           String              @db.VarChar(50)
  short_exchange          String              @db.VarChar(50)
  long_funding_rate       Decimal             @db.Decimal(10, 8)
  short_funding_rate      Decimal             @db.Decimal(10, 8)
  rate_difference         Decimal             @db.Decimal(10, 8)
  expected_return_rate    Decimal             @db.Decimal(10, 8)
  status                  OpportunityStatus   @default(ACTIVE)
  detected_at             DateTime            @default(now()) @db.Timestamptz
  expired_at              DateTime?           @db.Timestamptz
  closed_at               DateTime?           @db.Timestamptz
  max_rate_difference     Decimal?            @db.Decimal(10, 8)
  max_rate_difference_at  DateTime?           @db.Timestamptz
  notification_count      Int                 @default(0)
  last_notification_at    DateTime?           @db.Timestamptz
  created_at              DateTime            @default(now()) @db.Timestamptz
  updated_at              DateTime            @updatedAt @db.Timestamptz

  // 關聯
  history                 OpportunityHistory?
  notifications           NotificationLog[]

  @@index([status], map: "idx_opportunity_status")
  @@index([detected_at(sort: Desc)], map: "idx_opportunity_detected")
  @@index([symbol, detected_at(sort: Desc)], map: "idx_opportunity_symbol_detected")
  @@index([expired_at], map: "idx_opportunity_expired")
  @@index([status], map: "idx_opportunity_active", where: status == ACTIVE)
  @@map("arbitrage_opportunities")
}

model OpportunityHistory {
  id                        String            @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  opportunity_id            String            @unique @db.Uuid
  symbol                    String            @db.VarChar(20)
  long_exchange             String            @db.VarChar(50)
  short_exchange            String            @db.VarChar(50)
  initial_rate_difference   Decimal           @db.Decimal(10, 8)
  max_rate_difference       Decimal           @db.Decimal(10, 8)
  avg_rate_difference       Decimal           @db.Decimal(10, 8)
  duration_ms               BigInt
  duration_minutes          Decimal           @db.Decimal(10, 2)
  total_notifications       Int
  detected_at               DateTime          @db.Timestamptz
  expired_at                DateTime          @db.Timestamptz
  disappear_reason          DisappearReason
  created_at                DateTime          @default(now()) @db.Timestamptz

  // 關聯
  opportunity               ArbitrageOpportunity @relation(fields: [opportunity_id], references: [id], onDelete: Restrict)

  @@index([symbol], map: "idx_history_symbol")
  @@index([detected_at(sort: Desc)], map: "idx_history_detected")
  @@index([duration_ms(sort: Desc)], map: "idx_history_duration")
  @@index([max_rate_difference(sort: Desc)], map: "idx_history_max_diff")
  @@map("opportunity_history")
}

model NotificationLog {
  id                       String              @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  opportunity_id           String              @db.Uuid
  symbol                   String              @db.VarChar(20)
  notification_type        NotificationType
  channel                  NotificationChannel
  severity                 Severity            @default(INFO)
  message                  String              @db.Text
  rate_difference          Decimal             @db.Decimal(10, 8)
  sent_at                  DateTime            @default(now()) @db.Timestamptz
  is_debounced             Boolean             @default(false)
  debounce_skipped_count   Int                 @default(0)

  // 關聯
  opportunity              ArbitrageOpportunity @relation(fields: [opportunity_id], references: [id], onDelete: Cascade)

  @@index([opportunity_id], map: "idx_notification_opportunity")
  @@index([symbol], map: "idx_notification_symbol")
  @@index([sent_at(sort: Desc)], map: "idx_notification_sent")
  @@index([notification_type], map: "idx_notification_type")
  @@map("notification_logs")
}
```

---

## 資料流程

### 1. 機會偵測流程

```
1. FundingRateMonitor 發出 'rate-updated' 事件
   ↓
2. OpportunityDetector.handleRateUpdate(pair)
   ↓
3. 判斷 rate_difference >= threshold
   ↓
4. 建立 ArbitrageOpportunity 記錄（status = ACTIVE）
   ↓
5. 發出 'opportunity:appeared' 事件
   ↓
6. NotificationService.notifyOpportunityAppeared()
   ↓
7. 建立 NotificationLog 記錄
   ↓
8. 更新 ArbitrageOpportunity.notification_count++
```

### 2. 機會消失流程

```
1. FundingRateMonitor 發出 'rate-updated' 事件
   ↓
2. OpportunityDetector.handleRateUpdate(pair)
   ↓
3. 判斷 rate_difference < threshold (已存在 ACTIVE 機會)
   ↓
4. 更新 ArbitrageOpportunity (status = EXPIRED, expired_at = now())
   ↓
5. 建立 OpportunityHistory 記錄（計算平均費率、持續時間等）
   ↓
6. 發出 'opportunity:disappeared' 事件
   ↓
7. NotificationService.notifyOpportunityDisappeared()
   ↓
8. 建立 NotificationLog 記錄
```

### 3. 防抖動流程

```
1. OpportunityDetector 準備發送通知
   ↓
2. NotificationDebouncer.notify(symbol, data)
   ↓
3. 檢查該 symbol 的上次通知時間
   ↓
4. 如果 < 30 秒 → 取消計時器，重新設定 30 秒計時器
   ↓
5. 如果 >= 30 秒 → 立即發送通知
   ↓
6. 記錄 NotificationLog (is_debounced = true, debounce_skipped_count = N)
```

---

## 查詢模式

### Q1: 取得當前活躍機會

```typescript
const activeOpportunities = await prisma.arbitrageOpportunity.findMany({
  where: {
    status: 'ACTIVE',
  },
  orderBy: {
    rate_difference: 'desc',
  },
  include: {
    notifications: {
      take: 5,
      orderBy: {
        sent_at: 'desc',
      },
    },
  },
});
```

### Q2: 取得最近 24 小時歷史記錄

```typescript
const recentHistory = await prisma.opportunityHistory.findMany({
  where: {
    detected_at: {
      gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
    },
  },
  orderBy: {
    detected_at: 'desc',
  },
});
```

### Q3: 計算特定交易對的通過率（最近 7 天）

```typescript
const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

const [totalOpportunities, expiredOpportunities] = await Promise.all([
  prisma.arbitrageOpportunity.count({
    where: {
      symbol: 'BTCUSDT',
      detected_at: { gte: startDate },
    },
  }),
  prisma.arbitrageOpportunity.count({
    where: {
      symbol: 'BTCUSDT',
      detected_at: { gte: startDate },
      status: 'EXPIRED',
    },
  }),
]);

const passRate = totalOpportunities > 0
  ? (expiredOpportunities / totalOpportunities) * 100
  : 0;
```

### Q4: 取得防抖動統計

```typescript
const debounceStats = await prisma.notificationLog.aggregate({
  where: {
    symbol: 'BTCUSDT',
    sent_at: {
      gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
    },
  },
  _sum: {
    debounce_skipped_count: true,
  },
  _count: {
    id: true,
  },
});

const totalNotifications = debounceStats._count.id || 0;
const skippedNotifications = debounceStats._sum.debounce_skipped_count || 0;
const reductionRate = totalNotifications > 0
  ? (skippedNotifications / (totalNotifications + skippedNotifications)) * 100
  : 0;
```

---

## 資料遷移策略

### Migration 1: 建立基礎資料表

```sql
-- 建立 Enum 型別
CREATE TYPE opportunity_status AS ENUM ('ACTIVE', 'EXPIRED', 'CLOSED');
CREATE TYPE disappear_reason AS ENUM ('RATE_DROPPED', 'DATA_UNAVAILABLE', 'MANUAL_CLOSE', 'SYSTEM_ERROR');
CREATE TYPE notification_type AS ENUM ('OPPORTUNITY_APPEARED', 'OPPORTUNITY_DISAPPEARED', 'OPPORTUNITY_UPDATED');
CREATE TYPE notification_channel AS ENUM ('TERMINAL', 'LOG', 'WEBHOOK', 'TELEGRAM');
CREATE TYPE severity AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- 建立資料表（Prisma 自動生成）
CREATE TABLE arbitrage_opportunities (...);
CREATE TABLE opportunity_history (...);
CREATE TABLE notification_logs (...);
```

### Migration 2: 設定 TimescaleDB（僅 NotificationLog）

```sql
-- 將 notification_logs 轉換為 hypertable（高頻寫入、時序資料）
SELECT create_hypertable(
  'notification_logs',
  'sent_at',
  chunk_time_interval => INTERVAL '7 days',
  if_not_exists => TRUE
);

-- 設定 90 天自動保留策略
SELECT add_retention_policy('notification_logs', INTERVAL '90 days');
```

### Migration 3: 建立觸發器（自動建立歷史記錄）

```sql
CREATE OR REPLACE FUNCTION create_opportunity_history()
RETURNS TRIGGER AS $$
BEGIN
  -- 當機會狀態變更為 EXPIRED 時，自動建立歷史記錄
  IF NEW.status = 'EXPIRED' AND OLD.status = 'ACTIVE' THEN
    INSERT INTO opportunity_history (
      opportunity_id,
      symbol,
      long_exchange,
      short_exchange,
      initial_rate_difference,
      max_rate_difference,
      avg_rate_difference,
      duration_ms,
      duration_minutes,
      total_notifications,
      detected_at,
      expired_at,
      disappear_reason
    ) VALUES (
      NEW.id,
      NEW.symbol,
      NEW.long_exchange,
      NEW.short_exchange,
      NEW.rate_difference,
      COALESCE(NEW.max_rate_difference, NEW.rate_difference),
      NEW.rate_difference, -- 暫時使用初始值，實際應由應用層計算平均值
      EXTRACT(EPOCH FROM (NEW.expired_at - NEW.detected_at)) * 1000,
      EXTRACT(EPOCH FROM (NEW.expired_at - NEW.detected_at)) / 60,
      NEW.notification_count,
      NEW.detected_at,
      NEW.expired_at,
      'RATE_DROPPED' -- 預設原因，實際應由應用層指定
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_create_opportunity_history
  AFTER UPDATE ON arbitrage_opportunities
  FOR EACH ROW
  EXECUTE FUNCTION create_opportunity_history();
```

---

## 資料完整性約束

### 應用層驗證（Zod Schema）

```typescript
// src/lib/validation/opportunity-schemas.ts

import { z } from 'zod';

export const ArbitrageOpportunitySchema = z.object({
  symbol: z.string().min(1).max(20),
  long_exchange: z.string().min(1).max(50),
  short_exchange: z.string().min(1).max(50),
  long_funding_rate: z.number(),
  short_funding_rate: z.number(),
  rate_difference: z.number().positive(),
  expected_return_rate: z.number().positive(),
  status: z.enum(['ACTIVE', 'EXPIRED', 'CLOSED']),
}).refine(
  (data) => data.rate_difference === data.short_funding_rate - data.long_funding_rate,
  { message: 'rate_difference must equal short_funding_rate - long_funding_rate' }
).refine(
  (data) => Math.abs(data.expected_return_rate - (data.rate_difference * 3 * 365)) < 0.0001,
  { message: 'expected_return_rate must equal rate_difference × 3 × 365' }
);
```

---

## 效能考量

### 索引策略

1. **ArbitrageOpportunity**: 主要查詢為「取得活躍機會」、「按時間排序」、「按符號+時間查詢」
   - `idx_opportunity_active` (partial index on status = 'ACTIVE') - 加速活躍機會查詢
   - `idx_opportunity_symbol_detected` (composite index) - 加速符號+時間範圍查詢

2. **OpportunityHistory**: 主要查詢為「歷史記錄按時間」、「按符號查詢」、「按持續時間排序」
   - `idx_history_detected` - 時間範圍查詢
   - `idx_history_duration` - 找出持續時間最長的機會

3. **NotificationLog**: 主要查詢為「按機會 ID」、「按時間」、「防抖動統計」
   - `idx_notification_sent` - 時間範圍查詢
   - `idx_notification_opportunity` - 查詢特定機會的所有通知

### 資料庫設定

```sql
-- 提升 work_mem 以加速排序和聚合查詢
SET work_mem = '256MB';

-- 啟用查詢並行執行
SET max_parallel_workers_per_gather = 4;
```

---

## 總結

本資料模型設計涵蓋：

- ✅ 3 個核心實體（ArbitrageOpportunity, OpportunityHistory, NotificationLog）
- ✅ 完整的欄位定義、型別和驗證規則
- ✅ 狀態轉換邏輯（ACTIVE → EXPIRED → CLOSED）
- ✅ 實體關聯（1:N 和 1:1）
- ✅ Prisma Schema 定義
- ✅ 索引策略和效能優化
- ✅ 資料遷移計畫
- ✅ 查詢模式範例

下一步：建立服務介面合約（contracts/）
