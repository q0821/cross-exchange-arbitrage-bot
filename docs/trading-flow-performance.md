# 交易流程效能優化分析

## 分析日期: 2026-01-23

---

## 一、總覽

本文件記錄對套利機器人核心交易流程的效能分析，包含開倉、平倉、訂單執行、餘額驗證和監控服務等關鍵路徑。

### 分析範圍

| 服務 | 檔案路徑 | 主要職責 |
|------|---------|---------|
| PositionOrchestrator | `src/services/trading/PositionOrchestrator.ts` | Saga Pattern 雙邊開倉協調 |
| PositionCloser | `src/services/trading/PositionCloser.ts` | 雙邊平倉協調 |
| OrderPriceFetcher | `src/services/trading/OrderPriceFetcher.ts` | 訂單成交價格獲取（多層 fallback） |
| BalanceValidator | `src/services/trading/BalanceValidator.ts` | 開倉前餘額驗證 |
| FundingRateMonitor | `src/services/monitor/FundingRateMonitor.ts` | 資金費率監控服務 |

---

## 二、已優化的設計

以下是目前架構中已經做得好的效能設計：

### ✅ 並行執行模式

| 位置 | 說明 |
|------|------|
| `PositionOrchestrator.ts:270-274` | Trader 創建使用 `Promise.all` 並行 |
| `PositionOrchestrator.ts:279-282` | 雙邊開倉訂單使用 `Promise.all` 並行 |
| `PositionCloser.ts:389-392` | 雙邊平倉訂單使用 `Promise.all` 並行 |
| `PositionCloser.ts:1118` | 條件單取消使用 `Promise.allSettled` 並行容錯 |
| `FundingRateMonitor.ts:223-231` | 交易所連接使用 `Promise.allSettled` 允許部分失敗 |

### ✅ 超時保護

```typescript
// PositionOrchestrator.ts:299-302
const result = await Promise.race([
  trader.createMarketOrder(...),
  this.createTimeoutPromise(ORDER_TIMEOUT_MS, exchange) // 30 秒
]);
```

### ✅ 分散式鎖

- 使用 Redis 實現分散式鎖，防止同一持倉的並行操作
- 開倉: `PositionLockService` (TTL 60 秒)
- 平倉: `acquireLock` (TTL 60 秒)

### ✅ 多層 Fallback 機制

`OrderPriceFetcher` 獲取訂單價格的 fallback 流程：
1. `order.average || order.price` (立即)
2. `fetchOrder` API (延遲 500ms 後查詢)
3. `fetchMyTrades` API (計算加權平均)
4. 全部失敗拋出 `TradingError`

---

## 三、效能瓶頸分析

### 🔴 優先級高：PositionCloser 的 Trader 創建是串行的

**位置**: `src/services/trading/PositionCloser.ts:380-382`

**問題程式碼**:
```typescript
// 串行創建 - 效能較差
const longTrader = await this.createUserTrader(userId, longExchange);
const shortTrader = await this.createUserTrader(userId, shortExchange);
```

**對比 PositionOrchestrator 已經是並行的**:
```typescript
// 並行創建 - 效能較好 (PositionOrchestrator.ts:270-274)
const [longTrader, shortTrader] = await Promise.all([
  this.createUserTrader(userId, longExchange),
  this.createUserTrader(userId, shortExchange),
]);
```

**影響分析**:
- `createUserTrader` 內部涉及：
  1. API Key 資料庫查詢
  2. API Key 解密
  3. CCXT 實例創建
  4. `loadMarkets()` 調用（可能需要 1-3 秒）
- 串行執行時總延遲 = Trader1 + Trader2
- 並行執行時總延遲 = max(Trader1, Trader2)

**預估節省時間**: 1-3 秒

**修復建議**:
```typescript
// 修改 PositionCloser.ts:380-382 為：
const [longTrader, shortTrader] = await Promise.all([
  this.createUserTrader(userId, longExchange),
  this.createUserTrader(userId, shortExchange),
]);
```

---

### ✅ 已優化：OrderPriceFetcher 指數退避輪詢策略

**位置**: `src/services/trading/OrderPriceFetcher.ts:99-136`

**原問題**:
- 舊版本使用固定 500ms 延遲，即使訂單已經結算完成仍需等待
- 開倉/平倉時如果 `order.average` 為空，必定觸發這個延遲
- 最壞情況下（雙邊開倉 + 雙邊平倉）可能增加 2 秒總延遲

**優化後程式碼**:
```typescript
private async tryFetchOrder(...): Promise<number> {
  // 指數退避：50ms → 100ms → 200ms → 400ms
  for (const delay of this.RETRY_DELAYS) {
    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      const fetchedOrder = await ccxtExchange.fetchOrder(orderId, symbol);
      const price = fetchedOrder.average || fetchedOrder.price || 0;

      if (price > 0) {
        logger.info(
          { symbol, orderId, price, attemptDelay: delay },
          'Got price from fetched order',
        );
        return price;
      }
      // price 為 0，繼續下一次嘗試
      logger.debug({ symbol, orderId, delay }, 'Price still 0 after fetchOrder, retrying...');
    } catch (fetchError) {
      // 記錄但繼續嘗試下一次
      logger.debug(
        { symbol, orderId, delay, error: fetchError },
        'fetchOrder attempt failed, will retry',
      );
    }
  }

  // 所有嘗試都失敗，返回 0（會觸發 fetchMyTrades fallback）
  logger.warn(
    { symbol, orderId, totalAttempts: this.RETRY_DELAYS.length },
    'All fetchOrder attempts failed to get price',
  );
  return 0;
}
```

**優化效果**:
- **最佳情況**（50ms 即成功）：節省 450ms
- **平均情況**（100-200ms 成功）：節省 300-400ms
- **最壞情況**（所有嘗試都需要）：總延遲為 750ms（50+100+200+400），相比舊版 500ms 增加 250ms，但成功率更高
- **實際表現**：大多數交易所在 50-100ms 內訂單就已結算，預期平均節省 **0.3-0.4 秒**

**實作日期**: 2026-01-23

---

### 🟡 優先級中：BalanceValidator 沒有使用 WebSocket 快取

**位置**: `src/services/trading/BalanceValidator.ts:174`

**問題程式碼**:
```typescript
async validateBalance(...): Promise<BalanceValidationResult> {
  // ...
  // 每次開倉都查詢 API
  const balances = await this.getBalances(userId, [longExchange, shortExchange]);
  // ...
}
```

**現狀**:
- Feature 052 已實作 WebSocket 餘額即時更新（`BinanceUserDataWs`, `BalanceWsHandler`）
- 但 `BalanceValidator` 沒有使用這個快取，每次開倉都重新查詢 API

**影響分析**:
- 每次開倉增加一次雙交易所餘額查詢
- API 調用延遲約 0.5-1 秒

**優化方案：增加快取優先選項**
```typescript
async validateBalance(
  userId: string,
  longExchange: SupportedExchange,
  shortExchange: SupportedExchange,
  // ...
  options?: { useCachedBalance?: boolean; maxCacheAgeMs?: number }
): Promise<BalanceValidationResult> {
  let balances: Map<SupportedExchange, number>;

  if (options?.useCachedBalance) {
    // 嘗試從 WebSocket 快取獲取
    const cached = await this.getCachedBalances(userId, [longExchange, shortExchange]);
    const maxAge = options.maxCacheAgeMs ?? 30000; // 預設 30 秒

    if (cached && cached.timestamp > Date.now() - maxAge) {
      balances = cached.balances;
    } else {
      // 快取過期，重新查詢
      balances = await this.getBalances(userId, [longExchange, shortExchange]);
    }
  } else {
    balances = await this.getBalances(userId, [longExchange, shortExchange]);
  }

  // ...
}
```

**預估節省時間**: 0.5-1 秒

---

### 🟢 優先級低：FundingRateMonitor 並行更新沒有限制併發數

**位置**: `src/services/monitor/FundingRateMonitor.ts:371-373`

**問題程式碼**:
```typescript
// 並行更新所有交易對
const results = await Promise.allSettled(
  this.symbols.map((symbol) => this.updateRateForSymbol(symbol))
);
```

**問題**:
- 當監控的交易對數量較多時（例如 50+ 個），同時發起大量 API 請求
- 可能觸發交易所的 rate limiting
- 目前使用 `Promise.allSettled` 容錯，但沒有限制併發數

**優化方案：使用 p-limit 限制併發**
```typescript
import pLimit from 'p-limit';

// 每交易所最多 5 個並行請求
const limit = pLimit(5);

const results = await Promise.allSettled(
  this.symbols.map((symbol) =>
    limit(() => this.updateRateForSymbol(symbol))
  )
);
```

**影響**: 降低 rate limiting 風險，提升系統穩定性

---

## 四、效能優化總結

| 優化項 | 位置 | 預估節省時間 | 實作難度 | 狀態 |
|--------|------|-------------|---------|------|
| PositionCloser Trader 並行創建 | `PositionCloser.ts:380-382` | **1-3 秒** | ⭐ 低 | ⏳ 待實作 |
| OrderPriceFetcher 輪詢策略 | `OrderPriceFetcher.ts:99-136` | **0.3-0.4 秒** | ⭐⭐ 中 | ✅ 已完成 (2026-01-23) |
| BalanceValidator 使用 WS 快取 | `BalanceValidator.ts:174` | **0.5-1 秒** | ⭐⭐ 中 | ⏳ 待實作 |
| FundingRateMonitor 併發限制 | `FundingRateMonitor.ts:371` | 降低 rate limit | ⭐ 低 | ⏳ 待實作 |

**總計潛在節省**: 約 2-4.5 秒（最佳情況）

---

## 五、交易流程時序圖

### 5.1 開倉流程（當前）

```
Frontend (OpenPositionDialog)
    │
    ▼ POST /api/positions/open
API Handler
    │
    ▼
PositionOrchestrator.openPosition()
    │
    ├─ 1. PositionLockService 獲取鎖 (Redis)
    │
    ├─ 2. createPendingPosition() - DB 寫入
    │
    ├─ 3. getCurrentPrices() - 並行獲取雙交易所價格
    │      └─ Promise.all([fetchTicker(), fetchTicker()])
    │
    ├─ 4. BalanceValidator.validateBalance() - ⚠️ 每次都查詢 API
    │
    ├─ 5. updatePositionStatus('OPENING')
    │
    ├─ 6. executeBilateralOpen()
    │      ├─ ✅ Promise.all 創建兩個 Trader
    │      └─ ✅ Promise.all 執行雙邊訂單
    │           ├─ createMarketOrder() + OrderPriceFetcher ⚠️ 500ms delay
    │           └─ createMarketOrder() + OrderPriceFetcher ⚠️ 500ms delay
    │
    ├─ 7. handleOpenResult() - 更新 DB
    │
    └─ 8. setConditionalOrders() - 設定停損停利
```

### 5.2 平倉流程（當前 - 有優化空間）

```
Frontend (ClosePositionDialog)
    │
    ▼ POST /api/positions/[id]/close
API Handler
    │
    ▼
PositionCloser.closePosition()
    │
    ├─ 1. acquireCloseLock() (Redis)
    │
    ├─ 2. getAndValidatePosition() - DB 讀取
    │
    ├─ 3. updatePositionStatus('CLOSING')
    │
    ├─ 4. executeBilateralClose()
    │      ├─ ⚠️ 串行創建 longTrader (1-3s)
    │      ├─ ⚠️ 串行創建 shortTrader (1-3s)  ← 可優化為並行
    │      └─ ✅ Promise.all 執行雙邊訂單
    │           ├─ closePosition() + OrderPriceFetcher ⚠️ 500ms delay
    │           └─ closePosition() + OrderPriceFetcher ⚠️ 500ms delay
    │
    ├─ 5. queryBilateralFundingFees() - 查詢資金費率
    │
    ├─ 6. calculatePnL() - 損益計算
    │
    ├─ 7. 更新 Position + 創建 Trade 記錄
    │
    └─ 8. cancelConditionalOrders() - ✅ Promise.allSettled 並行取消
```

---

## 六、參考資料

- [Feature 033: Manual Open Position](/.specify/033-manual-open-position/)
- [Feature 035: Close Position](/.specify/035-close-position/)
- [Feature 052: WebSocket 即時數據訂閱](/.specify/052-specify-scripts-bash/)
- [Feature 062: Trading SRP 重構](/.specify/062-refactor-trading-srp/)

---

## 七、變更記錄

| 日期 | 變更內容 |
|------|---------|
| 2026-01-23 | 初始版本：完成交易流程效能分析 |
| 2026-01-23 | ✅ 完成 OrderPriceFetcher 指數退避輪詢優化 |
