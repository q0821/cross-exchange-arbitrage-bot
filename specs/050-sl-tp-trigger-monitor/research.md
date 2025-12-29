# Technical Research: 停損停利觸發偵測與自動平倉

**Feature**: 050-sl-tp-trigger-monitor
**Created**: 2025-12-29

## 研究摘要

本功能需要偵測交易所停損/停利條件單的觸發事件，並自動平倉另一邊的對沖倉位。研究重點在於各交易所的條件單狀態查詢 API 和訂單歷史查詢 API。

---

## 決策 1: 條件單狀態查詢方法

### Decision: 重用並擴展 ExchangeQueryService

**Rationale**:
- 現有 `src/scripts/trading-validation/ExchangeQueryService.ts` 已實作四個交易所的條件單查詢
- 條件單查詢邏輯可直接重用：
  - Binance PM: `papiGetUmConditionalOpenOrders`
  - OKX: `privateGetTradeOrdersAlgoPending` (ordType: 'trigger')
  - Gate.io: `privateFuturesGetSettlePriceOrders` (status: 'open')
  - BingX: `swapV2PrivateGetTradeOpenOrders`

**Alternatives Considered**:
1. **重新實作查詢邏輯** - 拒絕，會造成程式碼重複
2. **使用 WebSocket 即時監聽** - Phase 2 規劃，本次使用 REST 輪詢

---

## 決策 2: 觸發偵測邏輯

### Decision: 比對資料庫記錄與交易所待執行訂單列表

**Rationale**:
- Position 模型已存儲條件單 ID：
  - `longStopLossOrderId`, `longTakeProfitOrderId`
  - `shortStopLossOrderId`, `shortTakeProfitOrderId`
- 偵測邏輯：
  1. 查詢交易所待執行條件單
  2. 如果資料庫記錄的 orderId 不在列表中 → 可能已觸發
  3. 查詢訂單歷史確認是「觸發成交」還是「用戶取消」

**Alternatives Considered**:
1. **只檢查訂單是否存在** - 拒絕，無法區分「觸發」和「取消」
2. **輪詢倉位變化** - 拒絕，延遲較高且無法確定觸發原因

---

## 決策 3: 訂單歷史查詢 API

### Decision: 各交易所使用對應的歷史查詢 API

| 交易所 | API 方法 | 回應欄位 |
|--------|---------|---------|
| Binance PM | `papiGetUmConditionalOrderHistory` | `strategyStatus`: 'TRIGGERED' / 'EXPIRED' / 'NEW' |
| OKX | `privateGetTradeOrdersAlgoHistory` | `state`: 'effective' / 'canceled' / 'order_failed' |
| Gate.io | `privateFuturesGetSettlePriceOrders` (帶 orderId) | `finish_as`: 'filled' / 'cancelled' |
| BingX | `swapV2PrivateGetTradeOrderHistory` | `status`: 'FILLED' / 'CANCELED' |

**Rationale**:
- 各交易所的歷史查詢 API 可以確認條件單的最終狀態
- 用於區分「觸發成交」vs「用戶取消」vs「系統取消」

---

## 決策 4: 單邊平倉實作

### Decision: 擴展 PositionCloser 新增 closeSingleSide() 方法

**Rationale**:
- 現有 `PositionCloser.closePosition()` 執行雙邊平倉
- 需要新增 `closeSingleSide()` 方法：
  - 只平倉指定的單邊（多方或空方）
  - 取消該邊剩餘的條件單
- 重用現有的：
  - `createUserTrader()` - 創建交易所連接器
  - `executeCloseOrder()` - 執行平倉訂單
  - `cancelConditionalOrders()` - 取消條件單（需修改為支援單邊）

**Alternatives Considered**:
1. **創建新的 SingleSideCloser 服務** - 拒絕，會造成程式碼重複
2. **直接呼叫 CCXT API** - 拒絕，應重用現有封裝

---

## 決策 5: 監控服務架構

### Decision: 創建獨立的 ConditionalOrderMonitor 服務

**Rationale**:
- 參考現有 `FundingRateMonitor` 的架構
- 職責：
  1. 定時輪詢（30 秒間隔）
  2. 查詢所有 ACTIVE/OPEN 狀態持倉
  3. 檢查條件單狀態
  4. 處理觸發事件

**Implementation Pattern**:
```typescript
class ConditionalOrderMonitor {
  private intervalMs = 30000;
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;

  async start(): Promise<void>;
  async stop(): Promise<void>;
  private async checkAllPositions(): Promise<void>;
  private async checkPosition(position: Position): Promise<TriggerResult | null>;
  private async handleTrigger(position: Position, trigger: TriggerResult): Promise<void>;
}
```

---

## 決策 6: 觸發事件通知

### Decision: 重用 NotificationService，新增觸發通知模板

**Rationale**:
- 現有 `NotificationService` 支援 Discord 和 Slack 通知
- 需要新增：
  - `sendTriggerNotification()` 方法
  - `buildTriggerMessage()` 訊息模板
- 通知內容：
  - 交易對、觸發類型（SL/TP）
  - 觸發交易所、觸發價格
  - 自動處理結果（成功/失敗）
  - 損益資訊

---

## 決策 7: Position 資料模型變更

### Decision: 新增 closeReason 欄位

**Rationale**:
- 現有 Position 模型缺少平倉原因記錄
- 新增 `CloseReason` enum：
  ```prisma
  enum CloseReason {
    MANUAL              // 手動平倉
    LONG_SL_TRIGGERED   // 多方停損觸發
    LONG_TP_TRIGGERED   // 多方停利觸發
    SHORT_SL_TRIGGERED  // 空方停損觸發
    SHORT_TP_TRIGGERED  // 空方停利觸發
    BOTH_TRIGGERED      // 雙邊同時觸發
  }
  ```
- Position 新增欄位：
  ```prisma
  closeReason CloseReason?
  ```

---

## 決策 8: 雙邊同時觸發處理

### Decision: 查詢雙邊訂單歷史，正確識別觸發情況

**Rationale**:
- 市場劇烈波動時，多方和空方條件單可能同時觸發
- 偵測邏輯：
  1. 檢查雙邊條件單是否都不存在於待執行列表
  2. 如果是，查詢雙邊訂單歷史
  3. 根據歷史狀態判斷：
     - 雙邊都是「觸發成交」→ BOTH_TRIGGERED，不需平倉
     - 單邊「觸發成交」→ 對應的 SL/TP_TRIGGERED，平倉另一邊
     - 雙邊都是「取消」→ 可能是系統取消（如手動平倉），不處理

---

## 決策 9: 應用程式啟動整合

### Decision: 在 Next.js API 層初始化監控服務

**Rationale**:
- 現有 Web 應用使用 Next.js App Router
- 監控服務應在 Web 伺服器啟動時初始化
- 使用 singleton pattern 確保只有一個監控實例
- 位置：`app/api/init.ts` 或 `src/lib/monitor-init.ts`

**Graceful Shutdown**:
- 監聽 SIGINT/SIGTERM 信號
- 停止監控並等待進行中的操作完成

---

## 技術風險

### 風險 1: API Rate Limit
- **風險**: 每 30 秒查詢多個用戶的條件單可能觸發 rate limit
- **緩解**:
  - 批次查詢同一交易所的所有持倉
  - 使用現有的 retry 機制（指數退避）

### 風險 2: 網路延遲
- **風險**: 輪詢間隔可能錯過快速觸發
- **緩解**:
  - 30 秒間隔是可接受的最大延遲
  - Phase 2 升級為 WebSocket 即時監聽

### 風險 3: 服務重啟遺失狀態
- **風險**: 監控服務重啟時可能遺失進行中的觸發處理
- **緩解**:
  - 重啟後重新檢查所有 ACTIVE 持倉
  - 觸發處理是冪等的（可重複執行）

---

## 相關檔案參考

| 用途 | 路徑 |
|------|------|
| 條件單查詢 | `src/scripts/trading-validation/ExchangeQueryService.ts` |
| 平倉服務 | `src/services/trading/PositionCloser.ts` |
| 通知服務 | `src/services/notification/NotificationService.ts` |
| 監控範例 | `src/services/monitor/FundingRateMonitor.ts` |
| 資料模型 | `prisma/schema.prisma` |
| 條件單適配器 | `src/services/trading/adapters/*ConditionalOrderAdapter.ts` |
