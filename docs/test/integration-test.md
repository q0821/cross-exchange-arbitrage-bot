# 整合測試分析報告

> 最後更新：2026-01-17

## 統計摘要

| 項目     | 數量   |
|:---------|--------|
| 檔案數   | 14     |
| 案例數   | 103    |
| 目錄分類 | 3 個   |

---

## 測試分類索引

| 分類                   | 檔案數 | 案例數 |
|:-----------------------|--------|--------|
| 根目錄                 | 6      | 39     |
| WebSocket (`websocket/`) | 7      | 61     |
| API (`api/`)           | 1      | 3      |

---

## 詳細測試清單

### 1. CloseReason.test.ts

**路徑**: `tests/integration/CloseReason.test.ts`
**功能**: Feature 050 - 停損停利觸發偵測
**狀態**: `describe.skip` (需要資料庫連線)

| 編號 | 測試名稱 | 意圖說明 |
|:-----|:---------|:---------|
| INT-001 | should have all required close reason values | 驗證 CloseReason enum 包含所有必要的平倉原因值（MANUAL, LONG_SL_TRIGGERED, LONG_TP_TRIGGERED, SHORT_SL_TRIGGERED, SHORT_TP_TRIGGERED, BOTH_TRIGGERED） |
| INT-002 | should have exactly 6 close reason values | 驗證 CloseReason enum 剛好有 6 個值，確保沒有遺漏或多餘的平倉原因 |
| INT-003 | should allow null closeReason for open positions | 驗證開啟中的持倉其 closeReason 欄位可以是 null，符合業務邏輯 |
| INT-004 | should accept valid CloseReason values in query | 驗證可以使用任何有效的 CloseReason 值進行資料庫查詢，包含 null 值 |

---

### 2. FundingRateValidationRepository.test.ts

**路徑**: `tests/integration/FundingRateValidationRepository.test.ts`
**功能**: Feature 004 - OKX 修正與價格顯示
**狀態**: `describe.skip` (需要資料庫連線)

| 編號 | 測試名稱 | 意圖說明 |
|:-----|:---------|:---------|
| INT-005 | 應該成功建立驗證記錄（PASS 狀態） | 驗證 repository 能正確建立通過驗證的資金費率記錄，差異為 0% 時狀態應為 PASS |
| INT-006 | 應該成功建立驗證記錄（FAIL 狀態） | 驗證當 OKX 與 CCXT 費率差異過大時，記錄狀態應為 FAIL |
| INT-007 | 應該成功建立驗證錯誤記錄（ERROR 狀態） | 驗證 API 錯誤時能正確建立 ERROR 狀態的記錄並包含錯誤訊息 |
| INT-008 | 應該成功批量建立多個驗證記錄 | 驗證 createBatch() 能一次建立多筆不同狀態的驗證記錄 |
| INT-009 | 應該查詢指定時間範圍的驗證記錄 | 驗證 findByTimeRange() 能正確過濾指定時間區間的記錄 |
| INT-010 | 應該查詢驗證失敗記錄 | 驗證 findFailures() 只返回狀態為 FAIL 的記錄 |
| INT-011 | 應該正確計算驗證通過率 | 驗證 calculatePassRate() 計算公式正確：PASS / (PASS + FAIL) * 100%，ERROR 記錄不計入 |
| INT-012 | 應該在沒有記錄時返回 0 | 驗證當無任何記錄時，通過率返回 0 而非錯誤 |

---

### 3. arbitrage-assessment.test.ts

**路徑**: `tests/integration/arbitrage-assessment.test.ts`
**功能**: Feature 004 - 套利評估整合測試

| 編號 | 測試名稱 | 意圖說明 |
|:-----|:---------|:---------|
| INT-013 | 應該正確評估可行的套利機會（4 個交易所） | 驗證 ArbitrageAssessor 能處理 Binance、OKX、MEXC、Gate.io 四個交易所的資金費率資料，正確計算最佳套利對和淨收益 |
| INT-014 | 應該正確評估不可行的套利機會（利差太小） | 驗證當利差小於雙邊手續費時，評估結果應為不可行並顯示負收益 |
| INT-015 | 應該檢測極端價差並發出警告 | 驗證當交易所間價差超過 5% 閾值時，系統會在 warnings 中加入極端價差警告 |
| INT-016 | 應該支援不同的手續費類型 | 驗證 Maker (0.04%)、Taker (0.1%)、Mixed (0.07%) 三種手續費計算正確，且 Maker 模式收益最高 |
| INT-017 | 應該處理零資金量 | 驗證當投入資金為 0 時，所有金額計算結果都為 0，不會拋出錯誤 |
| INT-018 | 應該處理無價格資料的情況 | 驗證當交易所無價格資料時，不會產生極端價差警告 |

---

### 4. caching-behavior.test.ts

**路徑**: `tests/integration/caching-behavior.test.ts`
**功能**: Feature 063 - 前端資料快取

| 編號 | 測試名稱 | 意圖說明 |
|:-----|:---------|:---------|
| INT-019 | should cache positions data and reuse on subsequent calls | 驗證 usePositionsQuery 第一次呼叫會發送請求，第二次呼叫直接使用快取，不重複發送請求 |
| INT-020 | should invalidate cache when manually triggered | 驗證手動呼叫 queryClient.invalidateQueries() 後會觸發重新請求 |
| INT-021 | should cache assets data with 30s stale time | 驗證 useAssetsQuery 的快取資料正確儲存在 queryClient 中 |
| INT-022 | should share market rates data across different components | 驗證多個元件使用 useMarketRatesQuery 時會共享快取資料，即使 staleTime: 0 也能立即返回快取 |
| INT-023 | should use correct hierarchical query keys | 驗證 queryKeys 結構正確：assets → ['assets', 'balances']、trading → ['trading', 'positions'] 等 |
| INT-024 | should support bulk invalidation via parent keys | 驗證使用父層級 key 可以一次失效所有子查詢，例如 invalidate trading.all 會同時失效 positions 和 trades |

---

### 5. notification-price-filter.test.ts

**路徑**: `tests/integration/notification-price-filter.test.ts`
**功能**: Feature 057 - 通知價格過濾
**狀態**: `describe.skipIf` (需要 RUN_INTEGRATION_TESTS=true)

| 編號 | 測試名稱 | 意圖說明 |
|:-----|:---------|:---------|
| INT-025 | T014: should update webhook with requireFavorablePrice=true | 驗證可以將現有 webhook 的 requireFavorablePrice 從 false 更新為 true |
| INT-026 | T014: should update webhook to disable price filter | 驗證可以將 requireFavorablePrice 從 true 改回 false |
| INT-027 | T015: should include requireFavorablePrice in findAllEnabled results | 驗證 findEnabledByUserId() 返回的 webhook 包含 requireFavorablePrice 欄位 |
| INT-028 | T022: should default requireFavorablePrice to false for new webhooks | 驗證新建 webhook 不指定 requireFavorablePrice 時預設為 false（後向相容） |
| INT-029 | T023: should not affect requireFavorablePrice when updating other fields | 驗證更新 threshold 等其他欄位時不會影響 requireFavorablePrice 值 |
| INT-030 | T027: should create webhook with requireFavorablePrice=true | 驗證新建 webhook 時可以直接設定 requireFavorablePrice=true |
| INT-031 | T028: should create webhook with explicit requireFavorablePrice=false | 驗證新建時明確設定 requireFavorablePrice=false 也能正常運作 |

---

### 6. okx-funding-rate-validation.test.ts

**路徑**: `tests/integration/okx-funding-rate-validation.test.ts`
**功能**: Feature 004 - OKX API 驗證
**狀態**: `describe.skip` (需要 API 連線)

| 編號 | 測試名稱 | 意圖說明 |
|:-----|:---------|:---------|
| INT-032 | 應該成功驗證 BTC-USDT-SWAP 資金費率 | 驗證 FundingRateValidator 能正確獲取 BTC 永續合約的資金費率並儲存到資料庫 |
| INT-033 | 應該成功驗證 ETH-USDT-SWAP 資金費率 | 驗證 ETH 永續合約的資金費率驗證流程正確 |
| INT-034 | 應該批量驗證多個交易對 | 驗證 validateBatch() 能同時處理多個交易對並全部儲存 |
| INT-035 | 驗證結果應符合 schema 定義 | 驗證返回的結果物件包含 symbol、okxRate、validationStatus、timestamp 等必要欄位 |

---

### 7. api/market-rates.test.ts

**路徑**: `tests/integration/api/market-rates.test.ts`
**功能**: Feature 019 - 時間基準切換修正

| 編號 | 測試名稱 | 意圖說明 |
|:-----|:---------|:---------|
| INT-036 | T012: should return normalized rates for all exchanges | 驗證 API 回傳的費率資料包含 normalized 物件，內含 1h、4h、8h、24h 標準化費率 |
| INT-037 | T013: should return originalInterval for all exchanges | 驗證每個交易所的費率資料包含 originalInterval 欄位，標示原始結算週期（8h 或 4h） |
| INT-038 | should handle missing normalized data gracefully | 驗證當 normalized 或 originalInterval 欄位缺失時，API 仍能正常運作（後向相容） |

---

### 8. websocket/binance-funding-ws.test.ts

**路徑**: `tests/integration/websocket/binance-funding-ws.test.ts`
**功能**: Feature 052 - WebSocket 即時數據訂閱
**狀態**: 部分 `describe.skipIf` (需要 RUN_INTEGRATION_TESTS=true)

| 編號 | 測試名稱 | 意圖說明 |
|:-----|:---------|:---------|
| INT-039 | should connect to Binance WebSocket successfully | 驗證能成功建立與 Binance WebSocket 的連線，isReady() 返回 true |
| INT-040 | should handle connection timeout gracefully | 驗證連線到無效 URL 時會正確拋出錯誤而非無限等待 |
| INT-041 | should subscribe to single symbol and receive funding rate | 驗證訂閱單一交易對後能收到包含 fundingRate、nextFundingTime、markPrice 的資料 |
| INT-042 | should subscribe to multiple symbols | 驗證能同時訂閱多個交易對並收到各自的資料 |
| INT-043 | should unsubscribe from symbols | 驗證取消訂閱後 getSubscribedSymbols() 不再包含該交易對 |
| INT-044 | should receive valid funding rate data structure | 驗證收到的資料結構包含 Decimal.js 數值、Date 物件和正確的 source 標記 |
| INT-045 | should receive data with reasonable latency | 驗證第一筆資料在訂閱後 5 秒內收到（1s 更新頻率） |
| INT-046 | should track message count | 驗證 getStats() 能正確追蹤訊息數量和連線時間 |
| INT-047 | should initialize with default config | 驗證新建 client 初始狀態：isReady=false、subscribedSymbols=[] |
| INT-048 | should throw error when subscribing without connection | 驗證未連線時呼叫 subscribe() 會拋出 'Not connected' 錯誤 |
| INT-049 | should throw error when connecting a destroyed client | 驗證已銷毀的 client 呼叫 connect() 會拋出 'Client has been destroyed' 錯誤 |
| INT-050 | should return correct stats for disconnected client | 驗證未連線 client 的 stats 值都是初始狀態 |

---

### 9. websocket/binance-subscription.test.ts

**路徑**: `tests/integration/websocket/binance-subscription.test.ts`
**功能**: Feature 052 - Binance WebSocket 介面一致性

| 編號 | 測試名稱 | 意圖說明 |
|:-----|:---------|:---------|
| INT-051 | should accept WSSubscription interface | 驗證 subscribeWS() 方法接受標準 WSSubscription 介面參數 |
| INT-052 | should subscribe to funding rate updates | 驗證訂閱後能接收到資金費率更新回調 |
| INT-053 | should accept type and optional symbol parameters | 驗證 unsubscribeWS() 方法接受 type 必填和 symbol 選填參數 |
| INT-054 | should unsubscribe single symbol | 驗證取消特定交易對訂閱後不再收到該交易對的回調 |
| INT-055 | should unsubscribe all when symbol not provided | 驗證不提供 symbol 時會取消該類型的所有訂閱 |
| INT-056 | should implement IExchangeConnector WebSocket methods | 驗證 connector 實作了 subscribeWS 和 unsubscribeWS 異步方法 |

---

### 10. websocket/bingx-subscription.test.ts

**路徑**: `tests/integration/websocket/bingx-subscription.test.ts`
**功能**: Feature 052 - BingX WebSocket 介面一致性

| 編號 | 測試名稱 | 意圖說明 |
|:-----|:---------|:---------|
| INT-057 | should define subscribeWS method signature | 驗證 IExchangeConnector 介面的 subscribeWS 方法簽名正確編譯 |
| INT-058 | should define unsubscribeWS method signature | 驗證 unsubscribeWS 方法接受 WSSubscriptionType 和可選 symbol 參數 |
| INT-059 | should support fundingRate subscription type | 驗證可以建立 fundingRate 類型的 WSSubscription 物件 |

---

### 11. websocket/gateio-subscription.test.ts

**路徑**: `tests/integration/websocket/gateio-subscription.test.ts`
**功能**: Feature 052 - Gate.io WebSocket 介面一致性

| 編號 | 測試名稱 | 意圖說明 |
|:-----|:---------|:---------|
| INT-060 | should define subscribeWS method signature | 驗證介面的 subscribeWS 方法簽名正確 |
| INT-061 | should define unsubscribeWS method signature | 驗證 unsubscribeWS 方法簽名正確 |
| INT-062 | should support fundingRate subscription type | 驗證支援 fundingRate 訂閱類型 |
| INT-063 | should support positionUpdate subscription type | 驗證支援 positionUpdate 訂閱類型 |

---

### 12. websocket/okx-subscription.test.ts

**路徑**: `tests/integration/websocket/okx-subscription.test.ts`
**功能**: Feature 052 - OKX WebSocket 介面一致性

| 編號 | 測試名稱 | 意圖說明 |
|:-----|:---------|:---------|
| INT-064 | should define subscribeWS method signature | 驗證介面的 subscribeWS 方法簽名正確 |
| INT-065 | should define unsubscribeWS method signature | 驗證 unsubscribeWS 方法簽名正確 |
| INT-066 | should support fundingRate subscription type | 驗證支援 fundingRate 訂閱類型 |
| INT-067 | should support positionUpdate subscription type | 驗證支援 positionUpdate 訂閱類型 |

---

### 13. websocket/multi-exchange-ws.test.ts

**路徑**: `tests/integration/websocket/multi-exchange-ws.test.ts`
**功能**: Feature 054 - 原生 WebSocket 客戶端
**狀態**: 部分 `describe.skipIf` (需要 RUN_INTEGRATION_TESTS=true)

#### OKX Funding WebSocket Integration

| 編號 | 測試名稱 | 意圖說明 |
|:-----|:---------|:---------|
| INT-068 | should connect to OKX WebSocket successfully | 驗證能成功建立與 OKX WebSocket 的連線 |
| INT-069 | should subscribe to single symbol and receive funding rate | 驗證訂閱 BTCUSDT 後能收到 exchange='okx' 的資金費率資料 |
| INT-070 | should subscribe to multiple symbols | 驗證能同時訂閱多個交易對並收到各自的資料 |
| INT-071 | should receive valid funding rate data structure | 驗證資料結構包含 Decimal.js 費率、Date 型別的 nextFundingTime |

#### Gate.io Funding WebSocket Integration

| 編號 | 測試名稱 | 意圖說明 |
|:-----|:---------|:---------|
| INT-072 | should connect to Gate.io WebSocket successfully | 驗證能成功建立與 Gate.io WebSocket 的連線 |
| INT-073 | should subscribe to single symbol and receive funding rate | 驗證訂閱後能收到 exchange='gateio' 的資金費率資料 |
| INT-074 | should subscribe to multiple symbols | 驗證多交易對訂閱正確 |
| INT-075 | should receive valid funding rate data structure | 驗證 Gate.io 資料結構符合標準 |

#### BingX Funding WebSocket Integration

| 編號 | 測試名稱 | 意圖說明 |
|:-----|:---------|:---------|
| INT-076 | should connect to BingX WebSocket successfully | 驗證能成功建立與 BingX WebSocket 的連線 |
| INT-077 | should subscribe to single symbol and receive funding rate | 驗證訂閱後能收到 exchange='bingx' 的資金費率資料 |
| INT-078 | should subscribe to multiple symbols | 驗證多交易對訂閱正確 |
| INT-079 | should receive valid funding rate data structure | 驗證 BingX 資料結構符合標準 |

#### Cross-Exchange Tests

| 編號 | 測試名稱 | 意圖說明 |
|:-----|:---------|:---------|
| INT-080 | should receive data from all three exchanges concurrently | 驗證能同時連線 OKX、Gate.io、BingX 三個交易所並接收資料 |
| INT-081 | should handle concurrent subscriptions to different symbols | 驗證每個交易所能訂閱不同的交易對而不互相干擾 |

#### Unit Tests (Always Run)

| 編號 | 測試名稱 | 意圖說明 |
|:-----|:---------|:---------|
| INT-082 | OKX: should initialize with default config | 驗證 OKX client 初始狀態正確 |
| INT-083 | OKX: should throw error when subscribing without connection | 驗證未連線時拋出錯誤 |
| INT-084 | Gate.io: should initialize with default config | 驗證 Gate.io client 初始狀態正確 |
| INT-085 | Gate.io: should throw error when subscribing without connection | 驗證未連線時拋出錯誤 |
| INT-086 | BingX: should initialize with default config | 驗證 BingX client 初始狀態正確 |
| INT-087 | BingX: should throw error when subscribing without connection | 驗證未連線時拋出錯誤 |

---

### 14. websocket/position-ws.test.ts

**路徑**: `tests/integration/websocket/position-ws.test.ts`
**功能**: Feature 052 - 持倉 WebSocket 監控

#### Multi-Exchange Connection

| 編號 | 測試名稱 | 意圖說明 |
|:-----|:---------|:---------|
| INT-088 | should connect to multiple exchanges | 驗證 PrivateWsManager 能同時連線 Binance 和 OKX |
| INT-089 | should emit userConnected event | 驗證用戶連線成功時發出 userConnected 事件 |
| INT-090 | should track connected exchanges | 驗證 getConnectedExchanges() 返回所有已連線的交易所 |
| INT-091 | should disconnect all exchanges for user | 驗證斷線時所有交易所都正確斷開 |

#### Position Change Events

| 編號 | 測試名稱 | 意圖說明 |
|:-----|:---------|:---------|
| INT-092 | should receive position changes from Binance | 驗證能收到 Binance 的持倉變更事件，包含 size、entryPrice、markPrice 等 |
| INT-093 | should receive position changes from OKX | 驗證能收到 OKX 的持倉變更事件 |
| INT-094 | should aggregate position changes from multiple exchanges | 驗證能同時接收多個交易所的持倉變更並正確聚合 |

#### Balance Change Events

| 編號 | 測試名稱 | 意圖說明 |
|:-----|:---------|:---------|
| INT-095 | should receive balance changes from Binance | 驗證能收到餘額變更事件，包含 walletBalance、balanceChange、changeReason |

#### Order Status Events

| 編號 | 測試名稱 | 意圖說明 |
|:-----|:---------|:---------|
| INT-096 | should receive order updates from Binance | 驗證能收到 Binance 訂單狀態更新 |
| INT-097 | should receive order updates from OKX | 驗證能收到 OKX 訂單狀態更新 |

#### Trigger Detection Integration

| 編號 | 測試名稱 | 意圖說明 |
|:-----|:---------|:---------|
| INT-098 | should detect LONG_SL trigger from Binance STOP_MARKET order | 驗證偵測到 Binance 做多停損觸發並發出正確的 triggerType |
| INT-099 | should detect SHORT_TP trigger from OKX take_profit order | 驗證偵測到 OKX 做空停利觸發 |
| INT-100 | should not detect trigger from regular market order | 驗證一般市價單不會誤觸發偵測 |

#### Reconnection Handling

| 編號 | 測試名稱 | 意圖說明 |
|:-----|:---------|:---------|
| INT-101 | should handle adapter disconnection | 驗證斷線時發出 adapterDisconnected 事件 |
| INT-102 | should handle adapter reconnection | 驗證重連時重新發出 adapterConnected 事件 |

#### Error Scenarios & End-to-End Flow

| 編號 | 測試名稱 | 意圖說明 |
|:-----|:---------|:---------|
| INT-103 | should throw error for unknown exchange | 驗證嘗試連線不支援的交易所時拋出明確錯誤 |
| INT-104 | should handle complete arbitrage position monitoring flow | 驗證完整的套利持倉監控流程：連線 → 開多空倉 → 價格變動 → 停損觸發 |

---

## 執行說明

```bash
# 執行所有整合測試
pnpm test tests/integration

# 執行需要資料庫的測試
RUN_INTEGRATION_TESTS=true pnpm test tests/integration

# 執行特定分類
pnpm test tests/integration/websocket
pnpm test tests/integration/api
```
