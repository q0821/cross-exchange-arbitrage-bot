# WebSocket 訂閱機制優化建議

> 建立日期：2026-01-29
> 目標：針對「最新資料才重要」的特性，優化 WebSocket 事件推送以降低記憶體使用

## 目前架構總覽

```
┌─────────────────────────────────────────────────────────────────────┐
│                         WebSocket 數據流                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  交易所 WS          →  EventEmitter       →  PriceMonitor          │
│  (每秒 N 條訊息)        emit('fundingRate')    handleWsUpdate()     │
│                                                                     │
│        ↓                    ↓                      ↓                │
│                                                                     │
│  JSON.parse()         逐筆發送事件          RatesCache.update()     │
│  Schema 驗證          (即使批量也拆開)       Map.set() 覆寫         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## 關鍵發現

| 層級 | 檔案 | 問題 |
|:-----|:-----|:-----|
| **WebSocket 客戶端** | `BinanceFundingWs.ts:346-352` | 批量數據收到後，**同時發送 batch 和逐筆事件** |
| **事件發送** | `BinanceFundingWs.ts:349-351` | `for (const rate of fundingRates) { emit('fundingRate', rate) }` |
| **訂閱頻率** | `BinanceFundingWs.ts:82` | 預設 `@markPrice@1s`，每秒推送 |
| **快取更新** | `RatesCache.ts:182-227` | 每條訊息都獨立處理，無聚合機制 |

### 批量訂閱的問題

Binance 使用 `!markPrice@arr` 批量訂閱時，會每秒推送所有交易對（約 200+ 個）的數據。目前的實作會把批量拆成逐筆事件發送，造成每秒 200+ 次 `emit('fundingRate')`。

### EventEmitter 的隱藏成本

每次 `emit()` 都會同步執行所有監聯器，且 EventEmitter 內部維護監聽器陣列，高頻事件會有記憶體壓力。

## 目前的記憶體使用點

```typescript
// BinanceFundingWs.ts - 批量數據處理
if (Array.isArray(message)) {
  const fundingRates: FundingRateReceived[] = [];  // ← 建立陣列
  for (const item of message) {
    const parsed = this.parseMarkPriceUpdate(item);
    if (parsed) {
      fundingRates.push(parsed);                   // ← 累積物件
    }
  }
  if (fundingRates.length > 0) {
    this.emit('fundingRateBatch', fundingRates);  // ← 發送批量
    for (const rate of fundingRates) {
      this.emit('fundingRate', rate);              // ← 又逐筆發送！
    }
  }
}
```

---

## 優化方案

### 方案 1: 移除逐筆事件發送（快速修復）

**改動位置**：
- `src/services/websocket/BinanceFundingWs.ts:346-353`
- `src/services/websocket/OkxFundingWs.ts`（如有類似邏輯）
- `src/services/websocket/GateioFundingWs.ts`（如有類似邏輯）
- `src/services/websocket/BingxFundingWs.ts`（如有類似邏輯）

**修改內容**：

```typescript
// 修改前
this.emit('fundingRateBatch', fundingRates);
for (const rate of fundingRates) {
  this.emit('fundingRate', rate);  // 冗餘！
}

// 修改後 - 只發送批量事件
this.emit('fundingRateBatch', fundingRates);
// 移除逐筆發送
```

**預估效益**：減少 50% 的事件發送量

**影響評估**：
- 需確認 `PriceMonitor` 是否有監聽 `fundingRateBatch` 事件
- 如果只監聽 `fundingRate`，需要調整監聽器改用批量事件

---

### 方案 2: 批次聚合 + Latest-Value-Wins 策略

在 PriceMonitor 或 RatesCache 層實作 Throttle/Debounce。

**新增檔案**：`src/lib/ThrottledRatesUpdater.ts`

```typescript
import type { FundingRateReceived } from '@/types/websocket-events';
import { RatesCache } from '@/services/monitor/RatesCache';
import { logger } from '@/lib/logger';

export interface ThrottledRatesUpdaterConfig {
  /** Flush 間隔（毫秒），預設 500ms */
  flushIntervalMs?: number;
}

/**
 * ThrottledRatesUpdater
 *
 * 聚合 WebSocket 更新，每個 symbol 只保留最新值
 * 定期批次更新到 RatesCache，減少處理頻率
 */
export class ThrottledRatesUpdater {
  private pendingUpdates = new Map<string, FundingRateReceived>();
  private flushTimer: NodeJS.Timeout | null = null;
  private readonly flushIntervalMs: number;
  private readonly ratesCache: RatesCache;

  constructor(
    ratesCache: RatesCache,
    config: ThrottledRatesUpdaterConfig = {}
  ) {
    this.ratesCache = ratesCache;
    this.flushIntervalMs = config.flushIntervalMs ?? 500;
  }

  /**
   * 接收更新，只保留每個 symbol 的最新值
   */
  update(data: FundingRateReceived): void {
    // Latest-Value-Wins：直接覆寫
    this.pendingUpdates.set(data.symbol, data);

    // 排程 flush（如果尚未排程）
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), this.flushIntervalMs);
    }
  }

  /**
   * 批次接收更新
   */
  updateBatch(dataArray: FundingRateReceived[]): void {
    for (const data of dataArray) {
      this.pendingUpdates.set(data.symbol, data);
    }

    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), this.flushIntervalMs);
    }
  }

  /**
   * 立即 flush 所有待處理更新
   */
  flush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.pendingUpdates.size === 0) {
      return;
    }

    const updates = Array.from(this.pendingUpdates.values());
    this.pendingUpdates.clear();

    logger.debug({
      count: updates.length,
    }, 'Flushing throttled rates updates');

    // 批次更新到 RatesCache
    this.ratesCache.updateBatchFromWebSocket(updates);
  }

  /**
   * 取得待處理更新數量
   */
  getPendingCount(): number {
    return this.pendingUpdates.size;
  }

  /**
   * 銷毀，清理定時器
   */
  destroy(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.pendingUpdates.clear();
  }
}
```

**預估效益**：
- 每秒 200+ 條訊息 → 每秒 2 次批次更新
- 減少 99% 的快取操作

**影響評估**：
- 需要在 `PriceMonitor` 中整合 `ThrottledRatesUpdater`
- 資料更新會有最多 500ms 的延遲（可接受，因為資金費率 8 小時結算一次）

---

### 方案 3: 降低訂閱更新頻率

**改動位置**：`src/services/websocket/BinanceFundingWs.ts:82`

```typescript
// 修改前
updateSpeed: config.updateSpeed ?? '1s',

// 修改後 - 資金費率 8 小時結算一次，3 秒更新足夠
updateSpeed: config.updateSpeed ?? '3s',
```

**預估效益**：減少 67% 的訊息量

**影響評估**：
- 價格顯示延遲從 1 秒增加到 3 秒
- 對於資金費率套利來說，3 秒延遲完全可接受

---

### 方案 4: 完整優化架構（整合方案 1-3）

```
┌─────────────────────────────────────────────────────────────────────┐
│                    優化後的 WebSocket 數據流                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  交易所 WS          →  Aggregation Buffer   →  RatesCache          │
│  (@3s, 減少頻率)       (500ms flush)           批次 Map.set()       │
│                                                                     │
│        ↓                    ↓                      ↓                │
│                                                                     │
│  只發送 batch 事件    Latest-Value-Wins      單次 notification      │
│  (移除逐筆 emit)       每 symbol 只保留最新    check                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**整合效益**：
- 訊息量減少 67%（3s vs 1s）
- 事件發送減少 50%（移除逐筆 emit）
- 快取操作減少 99%（500ms 批次聚合）
- **總計：記憶體壓力預估降低 80%+**

---

## 實作優先順序建議

| 優先級 | 方案 | 改動範圍 | 風險 | 效益 |
|:------:|:-----|:---------|:-----|:-----|
| 1 | 方案 1 | 小 | 低 | 中 |
| 2 | 方案 3 | 小 | 低 | 中 |
| 3 | 方案 2 | 中 | 中 | 高 |

**建議步驟**：
1. 先實作方案 1 + 3（快速修復 + 降低頻率），約可減少 83% 的事件處理量
2. 觀察效果後，再決定是否需要方案 2 的完整優化

---

## 相關檔案清單

| 檔案 | 用途 |
|:-----|:-----|
| `src/services/websocket/BinanceFundingWs.ts` | Binance WebSocket 客戶端 |
| `src/services/websocket/OkxFundingWs.ts` | OKX WebSocket 客戶端 |
| `src/services/websocket/GateioFundingWs.ts` | Gate.io WebSocket 客戶端 |
| `src/services/websocket/BingxFundingWs.ts` | BingX WebSocket 客戶端 |
| `src/services/monitor/PriceMonitor.ts` | 價格監控服務（事件監聽器） |
| `src/services/monitor/RatesCache.ts` | 資金費率快取 |
| `src/lib/websocket.ts` | WebSocket 管理器基礎類別 |

---

## 測試驗證項目

實作後需要驗證：

1. **功能正確性**
   - [ ] 資金費率數據正確更新
   - [ ] 價格顯示正確
   - [ ] 套利機會計算正確

2. **效能驗證**
   - [ ] 記憶體使用量監控（使用 `memory-monitor.ts`）
   - [ ] 事件處理頻率（透過日誌統計）
   - [ ] CPU 使用率

3. **回歸測試**
   - [ ] 現有單元測試通過
   - [ ] WebSocket 連線/斷線/重連正常
   - [ ] 通知服務正常觸發
