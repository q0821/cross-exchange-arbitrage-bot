# 效能測試分析報告

> 最後更新：2026-01-17

## 統計摘要

| 項目     | 數量   |
|:---------|--------|
| 檔案數   | 4      |
| 案例數   | 17     |
| 測試目標 | 延遲 < 1 秒（資金費率）、< 5 秒（開關倉）|

---

## 效能目標

### 資金費率與觸發偵測（Feature 052）

| 指標 | 目標值 | 說明 |
|:-----|:-------|:-----|
| SC-001 | < 1 秒 | 資金費率數據更新延遲從 5 秒降至 1 秒以內 |
| SC-002 | < 1 秒 | 觸發偵測延遲從 30 秒降至 1 秒以內 |

### 開關倉效能

| 指標 | 目標值 | 說明 |
|:-----|:-------|:-----|
| 雙邊開倉 | < 5 秒 | 雙邊同時開倉完成時間 |
| 雙邊平倉 | < 5 秒 | 雙邊同時平倉完成時間 |
| 完整週期 | < 10 秒 | 開倉 + 平倉完整流程 |
| 訂單參數建構 | < 1 ms | 純邏輯操作 |
| PnL 計算 | < 5 ms | 單次損益計算 |

---

## 測試檔案總覽

| 檔案名稱 | 案例數 | 環境變數 | 說明 |
|:---------|--------|:---------|:-----|
| funding-rate-latency.test.ts | 6 | `PERFORMANCE_TEST` | 資金費率 WebSocket 延遲測試 |
| trigger-detection-latency.test.ts | 5 | - | 觸發偵測處理延遲測試 |
| trading/position-latency.test.ts | 3 | `TRADING_PERFORMANCE_TEST` | 開關倉延遲測試（Testnet）|
| trading/position-latency-mock.test.ts | 3 | - | 開關倉邏輯效能測試（Mock）|

---

## 詳細測試清單

### 1. funding-rate-latency.test.ts

**路徑**: `tests/performance/funding-rate-latency.test.ts`
**功能**: Feature 052 - Task T076
**目標**: 驗證資金費率延遲 < 1 秒
**狀態**: 部分 `describe.skipIf` (需要 PERFORMANCE_TEST=true)

#### 延遲閾值定義

```typescript
const MAX_LATENCY_MS = 1000;  // 目標: <1 秒
const TEST_TIMEOUT = 30000;    // 測試超時: 30 秒
```

---

#### BinanceFundingWs (需要真實連線)

| 編號 | 測試名稱 | 意圖說明 |
|:-----|:---------|:---------|
| PERF-001 | should connect and receive first funding rate data within 1 second | 驗證 WebSocket 連線建立後，收到第一筆資金費率資料的延遲 < 1000ms。測量連線建立時間和首筆資料延遲。 |
| PERF-002 | should receive continuous updates with acceptable latency | 驗證持續接收更新時的延遲一致性。收集 5 筆更新並計算平均延遲，確保更新間隔符合預期（@markPrice@1s 串流約 1 秒）。 |

**測量指標**:
- `connectionLatency`: 從開始連線到連線建立的時間
- `firstDataLatency`: 連線建立後到收到第一筆資料的時間
- `updateLatencies[]`: 每次更新之間的間隔時間

---

#### Mock Performance Test (永遠執行)

| 編號 | 測試名稱 | 意圖說明 |
|:-----|:---------|:---------|
| PERF-003 | should process funding rate events within 1ms (mock) | 驗證資金費率資料解析處理時間 < 10ms，模擬 JSON 解析和型別轉換（parseFloat、Date 建構等）。 |
| PERF-004 | should batch process funding rates efficiently | 驗證批次處理 100 個交易對的效能，平均每個交易對處理時間應 < 1ms。 |
| PERF-005 | should demonstrate latency improvement over REST polling | 對比 WebSocket vs REST 輪詢的延遲差異。WebSocket 約 50ms，REST 輪詢平均延遲 2500ms（5 秒間隔的一半），證明 > 10 倍改善。 |

**效能基準**:
```
WebSocket (典型):    50ms
REST Polling (平均): 2500ms
改善倍數:            50x
```

---

### 2. trigger-detection-latency.test.ts

**路徑**: `tests/performance/trigger-detection-latency.test.ts`
**功能**: Feature 052 - Task T077
**目標**: 驗證觸發偵測延遲 < 1 秒

#### 延遲閾值定義

```typescript
const MAX_PROCESSING_LATENCY_MS = 100;  // 內部處理: <100ms
const MAX_E2E_LATENCY_MS = 1000;         // 端對端: <1 秒
```

---

#### TriggerDetector Processing Time

| 編號 | 測試名稱 | 意圖說明 |
|:-----|:---------|:---------|
| PERF-006 | should process order status changed events within 100ms | 驗證 TriggerDetector 處理 OrderStatusChanged 事件的時間 < 100ms。包含持倉註冊、事件匹配和觸發偵測邏輯。 |
| PERF-007 | should batch process position registrations within acceptable latency | 驗證批次註冊 100 個持倉的效能，平均每個持倉 < 1ms。 |
| PERF-008 | should find matching positions quickly | 驗證在 100 個已註冊持倉中進行 1000 次查找的效能，平均每次查找 < 1ms。測試 Map 查找效率。 |

---

#### End-to-End Latency Simulation

| 編號 | 測試名稱 | 意圖說明 |
|:-----|:---------|:---------|
| PERF-009 | should simulate full trigger detection pipeline within 1 second | 模擬完整觸發偵測流程的各階段延遲，驗證總延遲 < 1000ms。 |

**流程階段分解**:

| 階段 | 說明 | 預期延遲 |
|:-----|:-----|:---------|
| WebSocket receive | 網路接收延遲 | ~10ms |
| Message parsing | JSON 解析 | <1ms |
| Trigger detection | 觸發判定邏輯 | <1ms |
| Database lookup | 持倉資料查詢 | ~20ms |
| Event emission | 事件發送 | <1ms |
| **Total** | 總延遲 | < 100ms |

---

#### Comparison: WebSocket vs REST Polling

| 編號 | 測試名稱 | 意圖說明 |
|:-----|:---------|:---------|
| PERF-010 | should demonstrate WebSocket latency advantage | 對比 WebSocket vs REST 輪詢的延遲優勢。REST 30 秒輪詢 vs WebSocket 即時推送，證明 300-600 倍改善。 |

**延遲對比**:
```
WebSocket (典型):      50-100ms
REST Polling (平均):   15,000ms (30s / 2)
REST Polling (最差):   30,000ms
改善倍數 (平均):       ~300x
改善倍數 (最差):       ~600x
```

---

### 3. position-latency.test.ts

**路徑**: `tests/performance/trading/position-latency.test.ts`
**功能**: 實際開關倉效能測試
**目標**: 驗證雙邊開倉/平倉延遲 < 5 秒
**狀態**: `describe.skipIf` (需要 `TRADING_PERFORMANCE_TEST=true`)

#### 延遲閾值定義

```typescript
const PERFORMANCE_TARGETS = {
  BILATERAL_OPEN_MS: 5000,   // 雙邊開倉延遲目標
  BILATERAL_CLOSE_MS: 5000,  // 雙邊平倉延遲目標
  FULL_CYCLE_MS: 10000,      // 完整週期延遲目標
};
```

---

#### Position Trading Latency (Testnet)

| 編號 | 測試名稱 | 意圖說明 |
|:-----|:---------|:---------|
| PERF-011 | should open bilateral positions within 5 seconds | 驗證雙邊開倉（Binance + OKX Testnet）延遲 < 5000ms。測量從呼叫 PositionOrchestrator.openPosition() 到倉位創建完成的時間。 |
| PERF-012 | should close bilateral positions within 5 seconds | 驗證雙邊平倉延遲 < 5000ms。測量從呼叫 PositionCloser.closePosition() 到倉位關閉完成的時間。 |
| PERF-013 | should complete full open-close cycle within 10 seconds | 驗證完整開倉 + 平倉週期 < 10000ms。端對端測量整個交易流程。 |

**測量指標**:
- `openLatency`: 雙邊開倉延遲
- `closeLatency`: 雙邊平倉延遲
- `fullCycleLatency`: 完整週期延遲
- 統計數據: avg, min, max, p50, p95, p99

---

### 4. position-latency-mock.test.ts

**路徑**: `tests/performance/trading/position-latency-mock.test.ts`
**功能**: Mock 效能基準測試
**目標**: 驗證純邏輯操作效能
**狀態**: 永遠執行（不需要 Testnet）

#### 延遲閾值定義

```typescript
const PERFORMANCE_TARGETS = {
  ORDER_PARAMS_BUILD_MS: 1,      // 訂單參數建構
  PNL_CALCULATION_MS: 5,         // PnL 計算
  BATCH_PNL_PER_ITEM_MS: 1,      // 批量 PnL 計算（每筆）
  QUANTITY_CONVERSION_MS: 0.5,   // 數量轉換（每次）
};
```

---

#### Position Trading Performance (Mock)

| 編號 | 測試名稱 | 意圖說明 |
|:-----|:---------|:---------|
| PERF-014 | should construct order params within 1ms | 驗證訂單參數物件建構時間 < 1ms。純記憶體操作，無 I/O。 |
| PERF-015 | should calculate PnL within 5ms | 驗證單次 PnL 計算時間 < 5ms。使用 Decimal.js 進行精確計算。 |
| PERF-016 | should batch calculate PnL efficiently | 驗證批量 PnL 計算效能，平均每筆 < 1ms。測試 100 筆交易的計算效能。 |

---

## 效能測試結果範本

執行效能測試後的預期輸出：

```
Funding Rate WebSocket Latency
─────────────────────────────────────────────────
  Connection established in:     304ms
  First funding rate in:         554ms
  Total latency:                 858ms
  Target: <1000ms                ✅ PASS

  Average update interval:       1002ms
  Processing time per rate:      0.023ms

Trigger Detection Latency
─────────────────────────────────────────────────
  Order processing time:         0.5ms
  Position registration:         0.1ms/position
  Position lookup (100 items):   0.05ms/lookup

End-to-End Pipeline
─────────────────────────────────────────────────
  WebSocket receive:             10ms
  Message parsing:               0.1ms
  Trigger detection:             0.1ms
  Database lookup:               20ms
  Event emission:                0.1ms
  ─────────────────────────────────────────────
  TOTAL:                         30.3ms
  Target: <1000ms                ✅ PASS

Position Trading Latency (Testnet)
─────────────────────────────────────────────────
  Bilateral open latency:        2500ms
  Bilateral close latency:       2200ms
  Full cycle latency:            4700ms
  Target: <10000ms               ✅ PASS

Position Trading Performance (Mock)
─────────────────────────────────────────────────
  Order params construction:     0.05ms
  PnL calculation:               0.3ms
  Batch PnL (100 items):         15ms (0.15ms/item)
```

---

## 執行說明

```bash
# 執行所有效能測試（需要真實 WebSocket 連線）
PERFORMANCE_TEST=true pnpm test tests/performance --run

# 只執行 Mock 測試（不需要網路連線）
pnpm test tests/performance --run

# 執行特定測試檔案
PERFORMANCE_TEST=true pnpm test tests/performance/funding-rate-latency.test.ts --run
pnpm test tests/performance/trigger-detection-latency.test.ts --run

# 執行交易效能測試（需要 Testnet API Key）
TRADING_PERFORMANCE_TEST=true pnpm test tests/performance/trading/position-latency.test.ts --run

# 執行交易 Mock 測試（永遠可執行）
pnpm test tests/performance/trading/position-latency-mock.test.ts --run
```

---

## 效能改善總結

| 功能 | 改善前 | 改善後 | 提升幅度 |
|:-----|:-------|:-------|:---------|
| 資金費率更新 | 5 秒 (REST) | < 1 秒 (WebSocket) | 5x+ |
| 觸發偵測 | 30 秒 (REST) | < 1 秒 (WebSocket) | 30x+ |
| 批次處理 | N/A | < 1ms/項目 | 即時 |
| 雙邊開倉 | N/A | < 5 秒 | 目標達成 |
| 雙邊平倉 | N/A | < 5 秒 | 目標達成 |

---

## 環境需求

| 測試類型 | 環境變數 | 需求 |
|:---------|:---------|:-----|
| 資金費率 WebSocket | `PERFORMANCE_TEST=true` | 網路連線到 Binance |
| 觸發偵測 | - | 無特殊需求 |
| 交易 Mock | - | 無特殊需求 |
| 交易 Testnet | `TRADING_PERFORMANCE_TEST=true` | Testnet API Key |

**Testnet API Key 設定**（見 `.env.test.example`）：
- `BINANCE_TESTNET_API_KEY` / `BINANCE_TESTNET_API_SECRET`
- `OKX_DEMO_API_KEY` / `OKX_DEMO_API_SECRET` / `OKX_DEMO_PASSPHRASE`

`★ Insight ─────────────────────────────────────`
1. **效能測試採用兩層策略** - Mock 測試永遠執行驗證內部邏輯，真實測試需要明確啟用避免 CI 失敗
2. **測量多個延遲階段** - 分別測量連線、首筆資料、持續更新的延遲，便於定位瓶頸
3. **對比基準明確** - 每個測試都包含 REST vs WebSocket 的對比，量化改善幅度
4. **交易測試安全約束** - Testnet 強制使用 `sandbox: true`，數量限制 `0.001 BTC`
`─────────────────────────────────────────────────`
