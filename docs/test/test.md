# 測試分析報告

> 最後更新：2026-01-21

## 統計摘要

### 最新測試執行結果

```
Test Files: 134 passed, 4 skipped (138)
Tests:      2,317 passed, 35 skipped, 11 todo (2,363)
```

### 測試案例數量（Test Cases）

| 測試類型          |   案例數 |   百分比 |
|:------------------|----------|----------|
| Unit Tests        |    2,123 |    89.0% |
| Integration Tests |      162 |     6.8% |
| Hooks Tests       |       45 |     1.9% |
| E2E Tests         |       23 |     1.0% |
| Performance Tests |       25 |     1.0% |
| **總計**          |**2,378** | **100%** |

### 測試檔案數量（Test Files）

| 測試類型          |   檔案數 |   百分比 |
|:------------------|----------|----------|
| Unit Tests        |      101 |    75.4% |
| Integration Tests |       20 |    14.9% |
| Hooks Tests       |        7 |     5.2% |
| Performance Tests |        4 |     3.0% |
| E2E Tests         |        2 |     1.5% |
| **總計**          |  **134** | **100%** |

### 跳過的測試（35 Skipped）

| 檔案 | 數量 | 原因 |
|:-----|:-----|:-----|
| `GateioConditionalOrderAdapter.test.ts` | 14 | `describe.skip` - Gate.io 原生 API 測試暫時跳過 |
| `monitor-init.test.ts` | 3 | `it.skip` - 條件單監控初始化測試待修復 |
| `multi-exchange-ws.test.ts` | 14 | `describe.skipIf` - 需要 WebSocket 連線 |
| `binance-subscription.test.ts` | 3 | `it.skipIf` - 需要 API 金鑰 |
| `okx-funding-rate-validation.test.ts` | 1 | `it.skip` - 避免 API 錯誤 |

### 待實作的測試（11 Todo）

| 檔案 | 數量 | 說明 |
|:-----|:-----|:-----|
| `BinanceWsClient.test.ts` | 11 | WebSocket 客戶端測試計劃中 |

---

## 詳細分析報告

| 測試類型 | 連結 | 說明 |
|:---------|:-----|:-----|
| 整合測試 | [integration-test.md](./integration-test.md) | 162 個測試案例詳細意圖分析 |
| E2E 測試 | [e2e-test.md](./e2e-test.md) | 23 個測試案例詳細意圖分析 |
| 效能測試 | [performance-test.md](./performance-test.md) | 25 個測試案例詳細意圖分析 |

---

## 詳細分類

### 1. Unit Tests（單元測試）

獨立模組的邏輯驗證，不依賴外部服務。

| 子目錄            | 檔案數 | 案例數 | 說明               |
|:------------------|--------|--------|:-------------------|
| `services/`       |     43 |    871 | 核心業務服務邏輯   |
| `lib/`            |     20 |    534 | 工具函式與輔助模組 |
| `formatters/`     |      4 |    105 | 輸出格式化         |
| `connectors/`     |      8 |    103 | 交易所連接器       |
| `repositories/`   |      5 |    118 | 資料存取層         |
| `websocket/`      |      6 |     89 | WebSocket 客戶端   |
| `notification/`   |      3 |     76 | 通知服務           |
| `models/`         |      2 |     40 | 資料模型           |
| `market-monitor/` |      2 |     38 | 市場監控           |
| `calculation/`    |      1 |     28 | 計算邏輯           |
| `frontend/`       |      2 |     26 | 前端工具函式       |
| `adapters/`       |      1 |     17 | 轉接器             |
| `middleware/`     |      1 |     36 | 中介層             |
| `prisma/`         |      1 |      9 | 資料庫遷移順序     |
| `api/`            |      1 |      3 | API 路由           |
| `components/`     |      1 |     14 | React 元件         |
| **總計**          |**101** |**2,123**|                   |

#### Services 子分類

| 子目錄              | 檔案數 |
|:--------------------|--------|
| 根目錄              |     31 |
| `trading/adapters/` |      3 |
| `apikey/`           |      2 |
| `monitor/`          |      2 |
| `notification/`     |      2 |
| `websocket/`        |      1 |
| `assets/`           |      1 |

---

### 2. Integration Tests（整合測試）

驗證多個模組間的互動與 API 端點。

- **檔案數**：20 個
- **案例數**：162 個

| 子目錄       | 檔案數 | 說明               |
|:-------------|--------|:-------------------|
| 根目錄       |      9 | 核心功能整合       |
| `websocket/` |      7 | WebSocket 訂閱整合 |
| `pages/`     |      2 | 頁面整合測試       |
| `api/`       |      2 | API 端點測試       |
| `trading/`   |      1 | 交易功能整合       |

#### 檔案列表

**根目錄**
- `ArbitrageOpportunityFlow.test.ts` - 套利機會生命週期（Feature 065）
- `CloseReason.test.ts` - 平倉原因（CloseReason enum 驗證）
- `FundingRateValidationRepository.test.ts` - 資金費率驗證 Repository
- `arbitrage-assessment.test.ts` - 套利評估
- `caching-behavior.test.ts` - 快取行為
- `database-connection.test.ts` - 資料庫連線與 Schema 完整性
- `notification-price-filter.test.ts` - 通知價格過濾
- `okx-funding-rate-validation.test.ts` - OKX 資金費率驗證

**websocket/**
- `binance-funding-ws.test.ts` - Binance 資金費率 WebSocket
- `binance-subscription.test.ts` - Binance 訂閱機制
- `bingx-subscription.test.ts` - BingX 訂閱機制
- `gateio-subscription.test.ts` - Gate.io 訂閱機制
- `multi-exchange-ws.test.ts` - 多交易所 WebSocket 整合
- `okx-subscription.test.ts` - OKX 訂閱機制
- `position-ws.test.ts` - 持倉 WebSocket

**pages/**
- `home.test.ts` - 首頁元件測試（Feature 064）
- `home-redirect.test.ts` - 首頁重導向測試

**api/**
- `market-rates.test.ts` - 市場費率 API
- `public-opportunities.test.ts` - 公開套利機會 API（Feature 065）

**trading/**
- `position-open-close.test.ts` - 開關倉整合測試（OKX Demo）

---

### 3. Hooks Tests（React Hooks 測試）

TanStack Query hooks 的測試。

- **檔案數**：7 個
- **案例數**：45 個

| 檔案                             | 說明                 |
|:---------------------------------|:---------------------|
| `useAssetHistoryQuery.test.ts`   | 資產歷史查詢         |
| `useAssetsQuery.test.ts`         | 資產查詢             |
| `useMarketRatesQuery.test.ts`    | 市場費率查詢         |
| `usePositionsQuery.test.ts`      | 持倉查詢             |
| `usePublicOpportunities.test.ts` | 公開套利機會查詢（Feature 065） |
| `useTradesQuery.test.ts`         | 交易記錄查詢         |
| `useTradingSettingsQuery.test.ts`| 交易設定查詢         |

---

### 4. E2E Tests（端對端測試）

使用 Playwright 的完整流程測試。

- **檔案數**：2 個
- **案例數**：23 個

| 檔案                                   | 說明               |
|:---------------------------------------|:-------------------|
| `market-monitor-exchange-links.spec.ts`| 市場監控交易所連結 |
| `user-registration-and-api-keys.spec.ts`| 用戶註冊與 API 金鑰|

---

### 5. Performance Tests（效能測試）

延遲與效能基準測試。

- **檔案數**：4 個
- **案例數**：25 個

| 檔案                                   | 說明                 |
|:---------------------------------------|:---------------------|
| `funding-rate-latency.test.ts`         | 資金費率延遲         |
| `trigger-detection-latency.test.ts`    | 觸發偵測延遲         |
| `trading/position-latency.test.ts`     | 開關倉延遲（OKX Demo）|
| `trading/position-latency-mock.test.ts`| 開關倉延遲（Mock）   |

---

## 目錄結構

```
tests/
├── e2e/                          # E2E 測試 (2 檔案, 23 案例)
├── hooks/                        # React Query Hooks (7 檔案, 45 案例)
│   └── queries/
├── integration/                  # 整合測試 (20 檔案, 162 案例)
│   ├── api/
│   ├── pages/                    # 頁面整合測試
│   ├── trading/                  # 交易功能整合測試
│   └── websocket/
├── performance/                  # 效能測試 (4 檔案, 25 案例)
│   └── trading/                  # 開關倉效能測試
├── unit/                         # 單元測試 (101 檔案, 2,123 案例)
│   ├── adapters/
│   ├── api/
│   ├── calculation/
│   ├── components/
│   ├── connectors/
│   ├── formatters/
│   ├── frontend/
│   ├── lib/
│   ├── market-monitor/
│   ├── middleware/               # 中介層測試
│   ├── models/
│   ├── notification/
│   ├── prisma/
│   ├── repositories/
│   ├── services/
│   │   ├── apikey/
│   │   ├── assets/
│   │   ├── monitor/
│   │   ├── notification/
│   │   ├── trading/adapters/
│   │   └── websocket/
│   └── websocket/
└── setup.ts                      # 測試設定
```

---

## 測試金字塔分析

### 以測試案例數量計算

```
          /\
         /  \       E2E (1.1%)
        /----\
       /      \     Performance (0.8%)
      /--------\
     /          \   Integration + Hooks (7.0%)
    /------------\
   /              \
  /                \ Unit (88.8%)
 /──────────────────\
```

### 分析

目前的測試分佈符合測試金字塔的最佳實踐：

- **Unit Tests** 佔比最高（88.9%），提供快速且穩定的回饋
- **Integration Tests** 佔比適中（9.1% 含 Hooks），驗證模組間互動
- **E2E Tests** 佔比最低（1.0%），聚焦關鍵使用者流程

### 測試密度（案例/檔案）

| 測試類型    | 平均案例數/檔案 |
|:------------|-----------------|
| Unit        |            21.0 |
| Integration |             8.1 |
| E2E         |            11.5 |
| Performance |             6.3 |
| Hooks       |             6.4 |

---

## 執行指令

### 快速指令（推薦）

```bash
# 執行所有測試
pnpm test

# 執行單元測試
pnpm test:unit

# 執行整合測試（自動設定環境變數）
pnpm test:integration

# 執行效能測試（需要真實 WebSocket 連線）
pnpm test:performance

# 執行 E2E 測試
pnpm test:e2e

# 執行交易整合測試（需要 OKX Demo API Key）
pnpm test:trading

# 執行交易效能測試（需要 OKX Demo API Key）
pnpm test:trading:perf
```

### 手動指定路徑

```bash
# 執行特定目錄
pnpm test tests/unit
pnpm test tests/integration
pnpm test tests/performance

# 手動設定環境變數
RUN_INTEGRATION_TESTS=true pnpm test tests/integration
PERFORMANCE_TEST=true pnpm test tests/performance
RUN_TRADING_INTEGRATION_TESTS=true pnpm test tests/integration/trading
TRADING_PERFORMANCE_TEST=true pnpm test tests/performance/trading
```

---

## 環境變數

| 變數 | 用途 | 預設值 |
|:-----|:-----|:-------|
| `RUN_INTEGRATION_TESTS` | 啟用需要資料庫的整合測試 | `true`（.env.test） |
| `PERFORMANCE_TEST` | 啟用需要真實 WebSocket 的效能測試 | `true`（.env.test） |
| `RUN_TRADING_INTEGRATION_TESTS` | 啟用需要 OKX Demo 的交易測試 | `false` |
| `TRADING_PERFORMANCE_TEST` | 啟用交易效能測試 | `false` |
