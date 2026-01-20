# Research: 持倉平倉建議監控

## 概述

本文件記錄 Feature 067 的技術研究結果。

---

## 1. 事件監聽機制

### 研究問題
如何監聽費率更新事件？

### 決策
監聽 FundingRateMonitor 的 `rate-updated` 事件

### 理由
- ArbitrageOpportunityTracker (Feature 065) 已驗證此模式可行
- FundingRateMonitor 每 5 秒發出一次 rate-updated 事件
- 事件包含完整的 FundingRatePair 資料（含 bestPair、APY、spread 等）

### 替代方案
1. ~~監聽 opportunity-detected/disappeared~~ - 這些事件使用不同的閾值邏輯，不適合持倉監控
2. ~~獨立輪詢~~ - 增加不必要的 API 呼叫

### 參考檔案
- `src/services/monitor/ArbitrageOpportunityTracker.ts:104-136`

---

## 2. 累計資金費率收益計算

### 研究問題
如何計算持倉的累計資金費率收益？

### 決策
使用 CCXT 的 `fetchFundingHistory` 方法查詢開倉至今的結算記錄，並使用 5 分鐘 TTL 快取

### 理由
- CCXT 4.x 的 unified API 支援 fetchFundingHistory
- 各交易所都支援查詢指定時間範圍的結算記錄
- 快取可減少 API 呼叫，避免 rate limit

### 計算公式
```
累計收益 = Σ(多方結算收益) + Σ(空方結算收益)
多方結算收益 = -fundingRate × positionSize × markPrice（負費率賺錢）
空方結算收益 = +fundingRate × positionSize × markPrice（正費率賺錢）
```

### 替代方案
1. ~~即時查詢不快取~~ - 會導致頻繁的 API 呼叫
2. ~~使用交易所 WebSocket~~ - 不是所有交易所都支援結算推送

---

## 3. 價差損失計算

### 研究問題
如何計算當前平倉的價差損失？

### 決策
使用 PriceMonitor 提供的即時價格計算

### 理由
- PriceMonitor 已整合 WebSocket 即時價格
- FundingRateMonitor 在 enablePriceMonitor=true 時會啟動 PriceMonitor

### 計算公式
```
價差損失 = (多頭平倉價 - 多頭開倉價) × 倉位數量
         - (空頭開倉價 - 空頭平倉價) × 倉位數量

簡化為（假設倉位數量相同）：
價差損失 = (currentLongPrice - longEntryPrice) - (shortEntryPrice - currentShortPrice)
```

### 注意事項
- 使用 Decimal.js 確保精度
- 當價格不可用時，標記為 stalePrice=true

---

## 4. WebSocket 推送模式

### 研究問題
如何設計 WebSocket 事件？

### 決策
參照 TriggerProgressEmitter 的模式，建立 PositionExitEmitter

### 事件設計
| 事件名稱 | 說明 | 資料 |
|----------|------|------|
| `position:exit:suggested` | 平倉建議 | positionId, symbol, reason, apy, fundingPnL, priceDiffLoss, netProfit |
| `position:exit:canceled` | 建議取消 | positionId, symbol, currentAPY |

### 參考檔案
- `src/services/websocket/TriggerProgressEmitter.ts`

---

## 5. 通知服務整合

### 研究問題
如何整合 Discord/Slack 通知？

### 決策
擴展現有的 DiscordNotifier 和 SlackNotifier

### 理由
- 現有通知服務已有完整的 webhook 發送邏輯
- 可復用 utils.ts 中的格式化函數

### 新增方法
```typescript
interface INotifier {
  sendExitSuggestionNotification(webhookUrl: string, message: ExitSuggestionMessage): Promise<NotificationResult>;
}
```

### 參考檔案
- `src/services/notification/DiscordNotifier.ts`
- `src/services/notification/SlackNotifier.ts`
- `src/services/notification/utils.ts`

---

## 6. Position 模型擴展

### 研究問題
需要在 Position 模型新增哪些欄位？

### 決策
新增以下欄位：

```prisma
model Position {
  // ... 現有欄位

  // Feature 067: 平倉建議
  cachedFundingPnL            Decimal?  @db.Decimal(18, 8)  // 累計費率收益快取
  cachedFundingPnLUpdatedAt   DateTime? @db.Timestamptz      // 快取更新時間
  exitSuggested               Boolean   @default(false)      // 是否被建議平倉
  exitSuggestedAt             DateTime? @db.Timestamptz      // 建議時間
  exitSuggestedReason         String?   @db.VarChar(50)      // 建議原因
}
```

### 理由
- 快取累計收益避免頻繁 API 查詢
- exitSuggested 用於前端顯示警告
- exitSuggestedReason 記錄原因（APY_NEGATIVE / PROFIT_LOCKABLE）

---

## 7. TradingSettings 模型擴展

### 研究問題
需要在 TradingSettings 模型新增哪些欄位？

### 決策
新增以下欄位：

```prisma
model TradingSettings {
  // ... 現有欄位

  // Feature 067: 平倉建議設定
  exitSuggestionEnabled       Boolean  @default(true)        // 是否啟用平倉建議
  exitSuggestionThreshold     Decimal  @default(100) @db.Decimal(10, 2)  // APY 閾值 (%)
  exitNotificationEnabled     Boolean  @default(true)        // 是否啟用 Discord/Slack 通知
}
```

### 理由
- 與現有設定欄位命名風格一致
- 預設值符合功能需求（預設啟用，100% 閾值）

---

## 8. 服務初始化

### 研究問題
如何初始化 PositionExitMonitor？

### 決策
參照 monitor-init.ts 的模式，建立獨立的初始化函數

### 理由
- 單例模式避免重複初始化
- globalThis 避免 Next.js hot reload 問題
- 整合到 gracefulShutdown 流程

### 參考檔案
- `src/lib/monitor-init.ts`

---

## 9. 防抖動機制

### 研究問題
如何防止頻繁發送相同的平倉建議？

### 決策
使用 1 分鐘的防抖動窗口

### 實作方式
```typescript
// 記錄最後通知時間
private lastNotifiedAt: Map<string, Date> = new Map();
private readonly debounceMs = 60 * 1000; // 1 分鐘

private shouldNotify(positionId: string): boolean {
  const lastNotified = this.lastNotifiedAt.get(positionId);
  if (!lastNotified) return true;

  return Date.now() - lastNotified.getTime() > this.debounceMs;
}
```

### 理由
- 避免費率波動導致頻繁通知
- 1 分鐘的窗口足夠讓用戶處理

---

## 10. 觸發條件邏輯

### 研究問題
如何實作兩種觸發條件？

### 決策

```typescript
function shouldSuggestClose(
  currentAPY: number,
  threshold: number,
  fundingPnL: Decimal,
  priceDiffLoss: Decimal
): { suggest: boolean; reason: 'APY_NEGATIVE' | 'PROFIT_LOCKABLE' | null } {
  // 條件 A：APY < 0%（強制建議）
  if (currentAPY < 0) {
    return { suggest: true, reason: 'APY_NEGATIVE' };
  }

  // 條件 B：APY < threshold% 且 累計收益 > 價差損失
  if (currentAPY < threshold && fundingPnL.gt(priceDiffLoss)) {
    return { suggest: true, reason: 'PROFIT_LOCKABLE' };
  }

  return { suggest: false, reason: null };
}
```

### 理由
- 明確的優先順序（APY < 0 優先於閾值條件）
- 返回原因以便通知時顯示

---

## 結論

所有技術問題已研究完成，無待釐清事項。
