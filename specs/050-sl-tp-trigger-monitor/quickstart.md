# Quickstart: 停損停利觸發偵測與自動平倉

**Feature**: 050-sl-tp-trigger-monitor
**Created**: 2025-12-29

---

## 功能概述

當用戶開倉並設定停損停利後，如果交易所的條件單被觸發：
1. 系統每 30 秒偵測一次觸發事件
2. 自動平倉另一邊的對沖倉位
3. 發送 Discord/Slack 通知
4. 更新持倉狀態為 CLOSED，記錄平倉原因

---

## 快速驗證測試

### 前提條件

1. 有一個 ACTIVE 狀態的持倉，已設定停損停利
2. 用戶已設定 Discord 或 Slack 通知（可選）
3. 系統監控服務正在運行

### 測試步驟

#### 測試 1: 手動觸發停損

1. 在交易所 App 手動修改停損價格，使其接近當前價格
2. 等待價格觸及停損價
3. 觀察系統是否在 30 秒內偵測到觸發
4. 驗證另一邊倉位是否自動平倉
5. 檢查持倉狀態是否更新為 CLOSED
6. 檢查 closeReason 是否正確記錄

#### 測試 2: 驗證通知

1. 確保用戶已設定 Discord/Slack webhook
2. 執行測試 1
3. 檢查通知頻道是否收到觸發通知
4. 驗證通知內容包含：交易對、觸發類型、損益資訊

#### 測試 3: 雙邊同時觸發

1. 開一個新倉位，設定極端的停損停利價格（接近當前價格）
2. 等待市場波動同時觸發雙邊
3. 驗證系統正確識別為 BOTH_TRIGGERED
4. 確認系統不會嘗試平倉（已被交易所平倉）

---

## 監控服務狀態

### 檢查監控服務是否運行

```typescript
// GET /api/monitor/status
{
  "isRunning": true,
  "lastCheckAt": "2025-12-29T10:30:00.000Z",
  "activePositionsCount": 5,
  "checksPerformed": 120
}
```

### 手動觸發檢查（測試用）

```typescript
// POST /api/monitor/check-now
// Response
{
  "success": true,
  "positionsChecked": 5,
  "triggersDetected": 0
}
```

---

## 日誌觀察

### 正常運行日誌

```
INFO  ConditionalOrderMonitor started, interval: 30000ms
INFO  Checking 5 active positions for trigger events
INFO  Position cm123abc: All conditional orders still pending
INFO  Position cm456def: Trigger detected! Type: LONG_SL, Exchange: binance
INFO  Starting auto-close for position cm456def
INFO  Closing short side on OKX...
INFO  Short side closed successfully, orderId: xxx
INFO  Canceling remaining conditional orders...
INFO  Position cm456def closed, reason: LONG_SL_TRIGGERED, PnL: -4.28 USDT
INFO  Sending trigger notification to Discord...
INFO  Notification sent successfully
```

### 錯誤情況日誌

```
ERROR Failed to close short side on OKX: API timeout
WARN  Position cm456def: Auto-close failed, requires manual intervention
INFO  Sending failure notification to user...
```

---

## 預期行為

| 情境 | 系統行為 |
|------|---------|
| 多方停損觸發 | 平倉空方 → 取消空方條件單 → 通知 → 更新狀態 |
| 多方停利觸發 | 平倉空方 → 取消空方條件單 → 通知 → 更新狀態 |
| 空方停損觸發 | 平倉多方 → 取消多方條件單 → 通知 → 更新狀態 |
| 空方停利觸發 | 平倉多方 → 取消多方條件單 → 通知 → 更新狀態 |
| 雙邊同時觸發 | 識別為 BOTH_TRIGGERED → 通知 → 更新狀態（不平倉） |
| 條件單被用戶取消 | 忽略（透過訂單歷史確認非觸發） |
| 平倉失敗 | 記錄錯誤 → 通知用戶手動處理 |
| 網路異常 | 記錄錯誤 → 下次檢查重試 |

---

## 資料驗證

### 檢查持倉狀態

```sql
SELECT id, symbol, status, closeReason, closedAt
FROM positions
WHERE status = 'CLOSED'
ORDER BY closedAt DESC
LIMIT 10;
```

### 檢查觸發歷史

```sql
SELECT
  symbol,
  closeReason,
  closedAt,
  longExchange,
  shortExchange
FROM positions
WHERE closeReason IS NOT NULL
  AND closeReason != 'MANUAL'
ORDER BY closedAt DESC;
```

---

## 常見問題

### Q: 為什麼觸發偵測有延遲？

A: 系統使用 30 秒輪詢間隔，最大延遲為 30 秒。這是 Phase 1 的設計限制，Phase 2 將升級為 WebSocket 即時監聽。

### Q: 如果自動平倉失敗怎麼辦？

A: 系統會發送通知給用戶，提醒手動處理。持倉狀態會保持為 PARTIAL 或 OPEN，用戶可以在 Web 界面手動平倉。

### Q: 如何區分「觸發成交」和「用戶取消」？

A: 系統會查詢交易所的訂單歷史 API，根據訂單最終狀態判斷：
- `TRIGGERED`/`FILLED` = 觸發成交
- `CANCELED` = 用戶取消

### Q: 監控服務重啟後會遺失觸發事件嗎？

A: 不會。監控服務重啟後會立即檢查所有 ACTIVE 持倉的條件單狀態，處理任何未完成的觸發事件。
