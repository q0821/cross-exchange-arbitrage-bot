# 測試分析報告

> 最後更新：2026-01-17

## 統計摘要

### 測試案例數量（Test Cases）

| 測試類型          |   案例數 |   百分比 |
|:------------------|----------|----------|
| Unit Tests        |    1,886 |    91.7% |
| Integration Tests |      103 |     5.0% |
| Hooks Tests       |       33 |     1.6% |
| E2E Tests         |       23 |     1.1% |
| Performance Tests |       11 |     0.5% |
| **總計**          |**2,056** | **100%** |

### 測試檔案數量（Test Files）

| 測試類型          |   檔案數 |   百分比 |
|:------------------|----------|----------|
| Unit Tests        |       91 |    79.1% |
| Integration Tests |       14 |    12.2% |
| Hooks Tests       |        6 |     5.2% |
| E2E Tests         |        2 |     1.7% |
| Performance Tests |        2 |     1.7% |
| **總計**          |  **115** | **100%** |

### 測試套件數量（Describe Blocks）

- **總計**：812 個 `describe` 區塊

---

## 詳細分析報告

| 測試類型 | 連結 | 說明 |
|:---------|:-----|:-----|
| 整合測試 | [integration-test.md](./integration-test.md) | 104 個測試案例詳細意圖分析 |
| E2E 測試 | [e2e-test.md](./e2e-test.md) | 23 個測試案例詳細意圖分析 |
| 效能測試 | [performance-test.md](./performance-test.md) | 11 個測試案例詳細意圖分析 |

---

## 詳細分類

### 1. Unit Tests（單元測試）

獨立模組的邏輯驗證，不依賴外部服務。

| 子目錄            | 檔案數 | 案例數 | 說明               |
|:------------------|--------|--------|:-------------------|
| `services/`       |     41 |    840 | 核心業務服務邏輯   |
| `lib/`            |     16 |    430 | 工具函式與輔助模組 |
| `formatters/`     |      4 |    105 | 輸出格式化         |
| `connectors/`     |      8 |    103 | 交易所連接器       |
| `websocket/`      |      6 |     89 | WebSocket 客戶端   |
| `repositories/`   |      3 |     82 | 資料存取層         |
| `notification/`   |      3 |     76 | 通知服務           |
| `models/`         |      2 |     40 | 資料模型           |
| `market-monitor/` |      2 |     38 | 市場監控           |
| `calculation/`    |      1 |     28 | 計算邏輯           |
| `frontend/`       |      2 |     26 | 前端工具函式       |
| `adapters/`       |      1 |     17 | 轉接器             |
| `prisma/`         |      1 |      9 | 資料庫遷移順序     |
| `api/`            |      1 |      3 | API 路由           |
| `components/`     |      0 |      0 | React 元件         |
| **總計**          | **91** |**1,886**|                   |

#### Services 子分類

| 子目錄              | 檔案數 |
|:--------------------|--------|
| 根目錄              |     31 |
| `trading/adapters/` |      3 |
| `apikey/`           |      2 |
| `monitor/`          |      2 |
| `notification/`     |      2 |
| `websocket/`        |      1 |

---

### 2. Integration Tests（整合測試）

驗證多個模組間的互動與 API 端點。

- **檔案數**：14 個
- **案例數**：103 個

| 子目錄       | 檔案數 | 說明               |
|:-------------|--------|:-------------------|
| 根目錄       |      6 | 核心功能整合       |
| `websocket/` |      7 | WebSocket 訂閱整合 |
| `api/`       |      1 | API 端點測試       |

#### 檔案列表

**根目錄**
- `CloseReason.test.ts` - 平倉原因
- `FundingRateValidationRepository.test.ts` - 資金費率驗證
- `arbitrage-assessment.test.ts` - 套利評估
- `caching-behavior.test.ts` - 快取行為
- `notification-price-filter.test.ts` - 通知價格過濾
- `okx-funding-rate-validation.test.ts` - OKX 資金費率驗證

**websocket/**
- `binance-funding-ws.test.ts`
- `binance-subscription.test.ts`
- `bingx-subscription.test.ts`
- `gateio-subscription.test.ts`
- `multi-exchange-ws.test.ts`
- `okx-subscription.test.ts`
- `position-ws.test.ts`

**api/**
- `market-rates.test.ts`

---

### 3. Hooks Tests（React Hooks 測試）

TanStack Query hooks 的測試。

- **檔案數**：6 個
- **案例數**：33 個

| 檔案                           | 說明         |
|:-------------------------------|:-------------|
| `useAssetHistoryQuery.test.ts` | 資產歷史查詢 |
| `useAssetsQuery.test.ts`       | 資產查詢     |
| `useMarketRatesQuery.test.ts`  | 市場費率查詢 |
| `usePositionsQuery.test.ts`    | 持倉查詢     |
| `useTradesQuery.test.ts`       | 交易記錄查詢 |
| `useTradingSettingsQuery.test.ts` | 交易設定查詢 |

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

- **檔案數**：2 個
- **案例數**：11 個

| 檔案                              | 說明           |
|:----------------------------------|:---------------|
| `funding-rate-latency.test.ts`    | 資金費率延遲   |
| `trigger-detection-latency.test.ts`| 觸發偵測延遲  |

---

## 目錄結構

```
tests/
├── e2e/                          # E2E 測試 (2 檔案, 23 案例)
├── hooks/
│   └── queries/                  # React Query Hooks (6 檔案, 33 案例)
├── integration/                  # 整合測試 (14 檔案, 103 案例)
│   ├── api/
│   └── websocket/
├── performance/                  # 效能測試 (2 檔案, 11 案例)
├── unit/                         # 單元測試 (91 檔案, 1,886 案例)
│   ├── adapters/
│   ├── api/
│   ├── calculation/
│   ├── components/
│   ├── connectors/
│   ├── formatters/
│   ├── frontend/
│   ├── lib/
│   ├── market-monitor/
│   ├── models/
│   ├── notification/
│   ├── prisma/
│   ├── repositories/
│   ├── services/
│   │   ├── apikey/
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
       /      \     Performance (0.5%)
      /--------\
     /          \   Integration + Hooks (6.6%)
    /------------\
   /              \
  /                \ Unit (91.7%)
 /──────────────────\
```

### 分析

目前的測試分佈符合測試金字塔的最佳實踐：

- **Unit Tests** 佔比最高（91.7%），提供快速且穩定的回饋
- **Integration Tests** 佔比適中（6.6% 含 Hooks），驗證模組間互動
- **E2E Tests** 佔比最低（1.1%），聚焦關鍵使用者流程

### 測試密度（案例/檔案）

| 測試類型    | 平均案例數/檔案 |
|:------------|-----------------|
| Unit        |            20.7 |
| Integration |             7.4 |
| E2E         |            11.5 |
| Performance |             5.5 |
| Hooks       |             5.5 |

---

## 執行指令

```bash
# 執行所有測試
pnpm test

# 執行特定類型
pnpm test tests/unit
pnpm test tests/integration
pnpm test tests/e2e
pnpm test tests/performance
```
