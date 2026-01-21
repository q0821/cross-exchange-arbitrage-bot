# Data Model: 持倉平倉建議監控

## 概述

本文件定義 Feature 067 的資料模型設計。

---

## 實體擴展

### TradingSettings（擴展）

現有模型位於 `prisma/schema.prisma:578-600`

#### 新增欄位

| 欄位 | 類型 | 預設值 | 說明 |
|------|------|--------|------|
| `exitSuggestionEnabled` | Boolean | true | 是否啟用平倉建議功能 |
| `exitSuggestionThreshold` | Decimal(10,2) | 100.00 | APY 閾值（%），低於此值時觸發條件 B |
| `exitNotificationEnabled` | Boolean | true | 是否啟用 Discord/Slack 平倉建議通知 |

#### Prisma Schema 變更

```prisma
model TradingSettings {
  // ... 現有欄位

  // Feature 067: 平倉建議設定
  exitSuggestionEnabled       Boolean  @default(true)
  exitSuggestionThreshold     Decimal  @default(100) @db.Decimal(10, 2)
  exitNotificationEnabled     Boolean  @default(true)
}
```

---

### Position（擴展）

現有模型位於 `prisma/schema.prisma:193-252`

#### 新增欄位

| 欄位 | 類型 | 預設值 | 說明 |
|------|------|--------|------|
| `cachedFundingPnL` | Decimal(18,8)? | null | 累計費率收益快取（USDT） |
| `cachedFundingPnLUpdatedAt` | DateTime? | null | 快取更新時間 |
| `exitSuggested` | Boolean | false | 是否被建議平倉 |
| `exitSuggestedAt` | DateTime? | null | 建議時間 |
| `exitSuggestedReason` | String(50)? | null | 建議原因 |

#### 建議原因值

| 值 | 說明 |
|----|------|
| `APY_NEGATIVE` | APY 轉負，繼續持有會虧損 |
| `PROFIT_LOCKABLE` | APY 低於閾值但整體有獲利可鎖定 |

#### Prisma Schema 變更

```prisma
model Position {
  // ... 現有欄位

  // Feature 067: 平倉建議
  cachedFundingPnL            Decimal?  @db.Decimal(18, 8)
  cachedFundingPnLUpdatedAt   DateTime? @db.Timestamptz
  exitSuggested               Boolean   @default(false)
  exitSuggestedAt             DateTime? @db.Timestamptz
  exitSuggestedReason         String?   @db.VarChar(50)
}
```

---

## 計算結果型別（不持久化）

### ExitSuggestion

用於表示平倉建議的計算結果，不儲存到資料庫。

```typescript
interface ExitSuggestion {
  positionId: string;
  symbol: string;
  userId: string;

  // 建議資訊
  suggested: boolean;
  reason: 'APY_NEGATIVE' | 'PROFIT_LOCKABLE' | null;
  suggestedAt: Date;

  // 計算數據
  currentAPY: number;              // 當前 APY (%)
  fundingPnL: Decimal;             // 累計費率收益 (USDT)
  priceDiffLoss: Decimal;          // 價差損失 (USDT)
  netProfit: Decimal;              // 淨收益 = fundingPnL - priceDiffLoss

  // 價格資訊
  currentLongPrice: number;
  currentShortPrice: number;
  stalePrice: boolean;             // 價格是否過時

  // 交易所資訊
  longExchange: string;
  shortExchange: string;
}
```

### ExitSuggestionMessage

用於通知訊息的資料結構。

```typescript
interface ExitSuggestionMessage {
  symbol: string;
  positionId: string;

  // 建議資訊
  reason: 'APY_NEGATIVE' | 'PROFIT_LOCKABLE';
  reasonDescription: string;

  // 數據
  currentAPY: number;
  fundingPnL: number;
  priceDiffLoss: number;
  netProfit: number;

  // 交易所
  longExchange: string;
  shortExchange: string;

  timestamp: Date;
}
```

---

## 索引設計

### Position 索引

無需新增索引，現有的 `[userId, status]` 索引已足夠支援查詢 OPEN 狀態的持倉。

---

## 資料流

```
FundingRateMonitor.emit('rate-updated')
        │
        ▼
PositionExitMonitor.handleRateUpdated()
        │
        ├── 查詢 OPEN 狀態的 Position
        │
        ├── 計算 ExitSuggestion
        │   ├── 查詢/更新 cachedFundingPnL
        │   └── 計算 priceDiffLoss
        │
        ├── 更新 Position（如果建議狀態改變）
        │   ├── exitSuggested = true/false
        │   ├── exitSuggestedAt
        │   └── exitSuggestedReason
        │
        ├── 發送 WebSocket 事件
        │   └── position:exit:suggested / position:exit:canceled
        │
        └── 發送 Discord/Slack 通知（如果啟用）
```

---

## Migration 注意事項

1. 所有新欄位都有預設值或允許 null，不影響現有資料
2. 不需要資料遷移腳本
3. Migration 檔案命名：`YYYYMMDDHHMMSS_add_exit_suggestion_fields`
