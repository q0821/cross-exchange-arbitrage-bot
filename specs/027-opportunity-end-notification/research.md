# Research: 套利機會結束監測和通知

**Feature**: 027-opportunity-end-notification
**Date**: 2025-12-01

## 研究主題

### 1. 費率結算時間檢測機制

**問題**: 如何準確檢測費率結算時間點，以記錄實際收取的費率？

**研究結果**:

現有系統已在 `FundingRate.ts` 中定義 `ExchangeRateData.originalFundingInterval`，記錄各幣種的結算週期（1h/4h/8h）。

**Decision**: 使用 `originalFundingInterval` 配合當前時間判斷是否為結算時間點

**Rationale**:
- 現有資料結構已包含結算週期資訊
- 可透過 `nextFundingTime` 倒推最近結算時間
- 無需額外 API 調用

**Alternatives Considered**:
1. 從交易所 API 即時查詢結算狀態 - 增加 API 調用次數，可能觸發限流
2. 固定假設 8h 結算 - 對於 1h/4h 結算的幣種計算不準確

**實現方式**:
```typescript
function getSettlementTimes(
  startTime: Date,
  endTime: Date,
  intervalHours: number
): Date[] {
  const settlements: Date[] = [];
  // 從 00:00 UTC 開始，按 intervalHours 計算所有結算時間
  const baseTime = new Date(startTime);
  baseTime.setUTCHours(0, 0, 0, 0);

  while (baseTime <= endTime) {
    if (baseTime >= startTime) {
      settlements.push(new Date(baseTime));
    }
    baseTime.setTime(baseTime.getTime() + intervalHours * 60 * 60 * 1000);
  }
  return settlements;
}
```

---

### 2. 機會生命週期追蹤模式

**問題**: 如何追蹤套利機會從開始到結束的完整生命週期？

**Research Results**:

現有 `NotificationService` 使用 `notifiedOpportunities` Map 進行去重（5 分鐘窗口），但不追蹤機會生命週期。

**Decision**: 新增 `trackedOpportunities` Map 追蹤活躍機會

**Rationale**:
- 需要記錄開始時間、初始費差、最高費差等統計資訊
- 需要關聯已通知的 Webhook IDs
- 需要記錄費率結算時間點的費差

**Data Structure**:
```typescript
interface TrackedOpportunity {
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

  // 已通知的 Webhook
  notifiedWebhooks: Map<string, {
    webhookId: string;
    userId: string;
    threshold: number;
    notifyOnDisappear: boolean;
  }>;

  // 通知計數
  notificationCount: number;
}

interface FundingSettlement {
  timestamp: Date;
  rate: number;  // 該方的費率（正=收取，負=支付）
}
```

**Alternatives Considered**:
1. 使用資料庫追蹤 - 增加 DB 寫入頻率，每次更新都需要持久化
2. 使用 Redis - 增加基礎設施複雜度，對於此功能過度設計

---

### 3. 多結算週期收益計算

**問題**: 當多空雙方結算週期不同時，如何準確計算模擬收益？

**Research Results**:

套利收益 = 做多方收益 + 做空方收益 - 開平倉成本

- 做多方收益 = Σ(做多方支付的負費率) = 正值時賺錢
- 做空方收益 = Σ(做空方收取的正費率) = 正值時賺錢

**Decision**: 分別追蹤多空雙方的結算記錄，獨立計算後加總

**Rationale**:
- 多空雙方結算時間點可能不同
- 各方費率需要獨立記錄
- 最終收益是兩方收益的總和

**計算公式**:
```typescript
function calculateRealizedProfit(tracked: TrackedOpportunity): RealizedProfit {
  // 做多方收益（負費率 = 賺錢，所以取反）
  const longProfit = tracked.longSettlements
    .reduce((sum, s) => sum + (-s.rate), 0);

  // 做空方收益（正費率 = 賺錢）
  const shortProfit = tracked.shortSettlements
    .reduce((sum, s) => sum + s.rate, 0);

  const totalFundingProfit = longProfit + shortProfit;
  const totalCost = 0.20;  // 0.2% (多空各 0.1%)
  const netProfit = totalFundingProfit - totalCost;

  const durationHours = (disappearedAt - detectedAt) / (1000 * 60 * 60);
  const realizedAPY = (netProfit / 100) * (8760 / durationHours) * 100;

  return {
    longSettlementCount: tracked.longSettlements.length,
    shortSettlementCount: tracked.shortSettlements.length,
    totalSettlementCount: tracked.longSettlements.length + tracked.shortSettlements.length,
    longProfit,
    shortProfit,
    totalFundingProfit,
    totalCost,
    netProfit,
    realizedAPY,
  };
}
```

---

### 4. 防抖動機制設計

**問題**: 費差在閾值附近波動時，如何避免頻繁發送結束/重新開始通知？

**Decision**: 費差需持續低於閾值 1 分鐘才觸發結束通知

**Rationale**:
- 費率更新週期約 5 分鐘
- 1 分鐘防抖動可過濾瞬間波動
- 不會延遲太久影響用戶體驗

**實現方式**:
```typescript
interface TrackedOpportunity {
  // ... 其他欄位
  disappearingAt?: Date;  // 首次低於閾值的時間
}

// 在 checkDisappearedOpportunities 中
if (currentSpread < threshold) {
  if (!tracked.disappearingAt) {
    // 首次低於閾值，開始計時
    tracked.disappearingAt = new Date();
  } else if (Date.now() - tracked.disappearingAt.getTime() >= 60000) {
    // 持續 1 分鐘，確認結束
    await this.notifyOpportunityDisappeared(tracked, webhook);
  }
} else {
  // 費差回升，重置計時
  tracked.disappearingAt = undefined;
}
```

---

### 5. 資料庫模型設計

**問題**: OpportunityEndHistory 表應該儲存什麼資訊？

**Decision**: 儲存完整統計資訊和結算記錄（JSON）

**Rationale**:
- 歷史記錄需要完整資訊供未來分析
- 結算記錄使用 JSON 欄位，保持彈性
- 關聯用戶以支援個人化查詢

**Schema 設計**:
```prisma
model OpportunityEndHistory {
  id                  String   @id @default(cuid())

  // 基本資訊
  symbol              String
  longExchange        String
  shortExchange       String

  // 時間資訊
  detectedAt          DateTime
  disappearedAt       DateTime
  durationMs          BigInt

  // 費差統計
  initialSpread       Decimal  @db.Decimal(10, 6)
  maxSpread           Decimal  @db.Decimal(10, 6)
  maxSpreadAt         DateTime
  finalSpread         Decimal  @db.Decimal(10, 6)

  // 費率結算記錄
  longIntervalHours   Int
  shortIntervalHours  Int
  settlementRecords   Json     // [{side, timestamp, rate}]

  // 模擬收益
  longSettlementCount   Int
  shortSettlementCount  Int
  totalFundingProfit    Decimal  @db.Decimal(10, 6)
  totalCost             Decimal  @db.Decimal(10, 6)
  netProfit             Decimal  @db.Decimal(10, 6)
  realizedAPY           Decimal  @db.Decimal(10, 2)

  // 通知統計
  notificationCount   Int      @default(1)

  // 關聯
  userId              String
  user                User     @relation(fields: [userId], references: [id])

  createdAt           DateTime @default(now())

  @@index([userId])
  @@index([symbol])
  @@index([disappearedAt])
  @@map("opportunity_histories")
}
```

---

## 技術決策總結

| 決策項目 | 選擇 | 理由 |
|---------|------|------|
| 結算時間檢測 | 使用 originalFundingInterval 計算 | 無需額外 API，資料已存在 |
| 機會追蹤 | 記憶體 Map | 低延遲，適合即時追蹤 |
| 收益計算 | 多空分開計算後加總 | 支援不同結算週期 |
| 防抖動 | 1 分鐘持續低於閾值 | 過濾波動，不過度延遲 |
| 歷史記錄 | PostgreSQL + JSON | 完整記錄，查詢靈活 |
