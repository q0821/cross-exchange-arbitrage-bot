# Research: ArbitrageOpportunity 即時追蹤記錄

**Feature**: 065-arbitrage-opportunity-tracking
**Date**: 2026-01-18
**Status**: Complete

## 研究目標

分析現有程式碼架構，確定最佳的套利機會記錄注入點和資料模型設計。

## 現有架構分析

### 1. FundingRateMonitor 事件流程

```
src/services/monitor/FundingRateMonitor.ts
```

**關鍵發現：**

1. **事件系統** (Line 39-46)
   ```typescript
   export interface MonitorEvents {
     'rate-updated': (pair: FundingRatePair) => void;
     'opportunity-detected': (pair: FundingRatePair) => void;
     'opportunity-disappeared': (symbol: string) => void;
     'arbitrage-feasible': (assessment: ArbitrageAssessment) => void;
     'error': (error: Error) => void;
     'status-changed': (status: MonitorStatus) => void;
   }
   ```

2. **活躍機會追蹤** (Line 67)
   ```typescript
   private activeOpportunities = new Set<string>(); // 追蹤當前活躍的套利機會
   ```

3. **機會檢測邏輯** (Line 527-595)
   - 使用 `calculator.isArbitrageOpportunity(pair)` 判斷
   - 新機會 → `emit('opportunity-detected', pair)`
   - 機會消失 → `emit('opportunity-disappeared', symbol)`

**結論**: 可以透過監聽 `opportunity-detected` 和 `opportunity-disappeared` 事件來記錄機會，無需修改核心邏輯。

### 2. RateDifferenceCalculator 判斷條件

```
src/services/monitor/RateDifferenceCalculator.ts
```

**套利機會判斷條件：**
- `spreadPercent >= 0.5%` (費差閾值)
- `priceDiffPercent >= -0.05%` (價差閾值)

### 3. OpportunityEndHistory 限制

```
prisma/schema.prisma (Line 377-426)
```

**問題：**
1. `userId` 是必填欄位 → 無法記錄系統級資料
2. 僅在 Webhook 通知成功時創建 → 遺漏未設定 Webhook 的機會
3. 記錄結束時機會的狀態 → 無法追蹤進行中的機會

**結論**: 需要全新的獨立資料模型。

### 4. 公開 API 現況

```
app/api/public/opportunities/route.ts
```

**目前實作：**
- 使用 `OpportunityEndHistoryRepository.getPublicOpportunities()`
- 無法顯示系統級資料（依賴 userId）

### 5. FundingRatePair 資料結構

```typescript
interface FundingRatePair {
  symbol: string;
  timestamp: Date;
  bestPair?: {
    longExchange: ExchangeName;
    shortExchange: ExchangeName;
    longRate: number;
    shortRate: number;
    spreadPercent: number;
    priceDiffPercent: number;
    annualizedReturn: number;
    longIntervalHours: number;
    shortIntervalHours: number;
  };
  // ... 其他欄位
}
```

## 技術方案設計

### ArbitrageOpportunity 資料模型

```prisma
model ArbitrageOpportunity {
  id                String   @id @default(cuid())

  // 識別資訊
  symbol            String   @db.VarChar(20)
  longExchange      String   @db.VarChar(20)
  shortExchange     String   @db.VarChar(20)

  // 狀態
  status            OpportunityStatus @default(ACTIVE)

  // 時間資訊
  detectedAt        DateTime @default(now()) @db.Timestamptz
  endedAt           DateTime? @db.Timestamptz
  durationMs        BigInt?

  // 費差統計
  initialSpread     Decimal  @db.Decimal(10, 6)
  maxSpread         Decimal  @db.Decimal(10, 6)
  maxSpreadAt       DateTime @db.Timestamptz
  currentSpread     Decimal  @db.Decimal(10, 6)  // 進行中時更新，結束時為最終費差

  // 年化報酬
  initialAPY        Decimal  @db.Decimal(10, 2)
  maxAPY            Decimal  @db.Decimal(10, 2)
  currentAPY        Decimal  @db.Decimal(10, 2)

  // 費率結算週期
  longIntervalHours   Int    @db.SmallInt
  shortIntervalHours  Int    @db.SmallInt

  createdAt         DateTime @default(now()) @db.Timestamptz
  updatedAt         DateTime @updatedAt @db.Timestamptz

  @@unique([symbol, longExchange, shortExchange, status])
  @@index([status])
  @@index([detectedAt(sort: Desc)])
  @@index([endedAt(sort: Desc)])
  @@map("arbitrage_opportunities")
}

enum OpportunityStatus {
  ACTIVE  // 進行中
  ENDED   // 已結束

  @@map("opportunity_status")
}
```

### 唯一性約束設計

`@@unique([symbol, longExchange, shortExchange, status])` 確保：
- 同一組合（symbol + longExchange + shortExchange）只能有一個 ACTIVE 記錄
- 結束後可以創建新的 ACTIVE 記錄
- 歷史 ENDED 記錄可以有多筆

### 整合架構

```
┌─────────────────────────────────────────────────────────────────┐
│                     FundingRateMonitor                          │
│                                                                 │
│  updateRateForSymbol()                                          │
│       │                                                         │
│       ▼                                                         │
│  isArbitrageOpportunity(pair)                                   │
│       │                                                         │
│       ├── true (新機會) ─► emit('opportunity-detected', pair)   │
│       │                                                         │
│       └── false (機會消失) ─► emit('opportunity-disappeared')   │
└─────────────────────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  ArbitrageOpportunityTracker                    │
│                                                                 │
│  on('opportunity-detected')                                     │
│       └── createOrUpdate() ─► ArbitrageOpportunityRepository    │
│                                                                 │
│  on('opportunity-disappeared')                                  │
│       └── markAsEnded() ─► ArbitrageOpportunityRepository       │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                  ArbitrageOpportunityRepository                 │
│                                                                 │
│  - createOpportunity(data)                                      │
│  - updateOpportunity(id, data)                                  │
│  - markAsEnded(symbol, longExchange, shortExchange)             │
│  - findActiveByKey(symbol, longExchange, shortExchange)         │
│  - getPublicOpportunities(options)                              │
└─────────────────────────────────────────────────────────────────┘
```

## 效能考量

1. **寫入頻率**: 每 5 秒一輪更新，預估 50-100 個交易對
   - 新機會: 低頻（每日數十筆）
   - 更新: 中頻（進行中機會每輪更新）
   - 結束: 低頻（機會消失時）

2. **索引策略**:
   - `status` 索引用於查詢 ACTIVE 機會
   - `detectedAt` 降序索引用於時間排序
   - `endedAt` 降序索引用於歷史查詢

3. **批次更新**: 考慮將多個機會的更新合併為一次資料庫操作

## 測試策略

1. **單元測試**:
   - ArbitrageOpportunity domain model
   - ArbitrageOpportunityRepository CRUD 操作
   - ArbitrageOpportunityTracker 事件處理

2. **整合測試**:
   - FundingRateMonitor → Tracker → Repository 完整流程
   - 公開 API 回應格式

3. **邊界案例**:
   - 極短機會（< 1 分鐘）
   - 重複事件處理
   - 資料庫連線失敗

## 結論

1. 使用 EventEmitter 監聽模式整合，不侵入現有核心邏輯
2. 新建獨立的 `ArbitrageOpportunity` model，不依賴用戶
3. 透過唯一性約束防止重複記錄
4. 公開 API 改為讀取新 model
