# E2E 測試分析報告

> 最後更新：2026-01-17

## 統計摘要

| 項目     | 數量 |
|:---------|------|
| 檔案數   | 2    |
| 案例數   | 23   |
| 測試框架 | Playwright |

---

## 測試檔案總覽

| 檔案名稱                                  | 案例數 | 說明                     |
|:------------------------------------------|--------|:-------------------------|
| market-monitor-exchange-links.spec.ts     | 18     | 市場監控頁面交易所快捷連結 |
| user-registration-and-api-keys.spec.ts    | 5      | 用戶註冊與 API 金鑰管理   |

---

## 詳細測試清單

### 1. market-monitor-exchange-links.spec.ts

**路徑**: `tests/e2e/market-monitor-exchange-links.spec.ts`
**功能**: Feature 008 - 交易所快捷連結
**測試工具**: Playwright

#### 測試輔助函式

| 函式名稱 | 說明 |
|:---------|:-----|
| `navigateToMarketMonitor(page)` | 導航到市場監控頁面並等待表格載入 |
| `findExchangeLink(page, symbol, exchange)` | 根據交易對和交易所找到對應的連結元素 |

---

#### Binance Links

| 編號 | 測試名稱 | 意圖說明 |
|:-----|:---------|:---------|
| E2E-001 | should display Binance link for BTC/USDT | 驗證 BTC/USDT 行有可見的 Binance 連結圖示 |
| E2E-002 | should open Binance contract page in new tab | 驗證點擊連結後在新分頁開啟 Binance Futures 頁面，URL 包含 binance.com/futures/BTCUSDT |
| E2E-003 | should have correct aria-label for Binance link | 驗證連結的 aria-label 包含 "Binance" 和 "BTC/USDT"，提供無障礙支援 |
| E2E-004 | should have security attributes (noopener noreferrer) | 驗證外部連結具有 target="_blank" 和 rel="noopener noreferrer" 安全屬性 |

---

#### OKX Links

| 編號 | 測試名稱 | 意圖說明 |
|:-----|:---------|:---------|
| E2E-005 | should display OKX link for ETH/USDT | 驗證 ETH/USDT 行有可見的 OKX 連結圖示 |
| E2E-006 | should open OKX contract page in new tab | 驗證點擊後開啟 OKX 永續合約頁面，URL 包含 okx.com/trade-swap/ETH-USDT-SWAP |
| E2E-007 | should have correct aria-label for OKX link | 驗證連結的 aria-label 包含 "OKX" 和 "ETH/USDT" |

---

#### MEXC Links

| 編號 | 測試名稱 | 意圖說明 |
|:-----|:---------|:---------|
| E2E-008 | should display MEXC link for SOL/USDT | 驗證 SOL/USDT 行有可見的 MEXC 連結圖示 |
| E2E-009 | should open MEXC contract page in new tab | 驗證點擊後開啟 MEXC 合約頁面，URL 包含 mexc.com/exchange/SOL_USDT |
| E2E-010 | should have correct aria-label for MEXC link | 驗證連結的 aria-label 包含 "MEXC" 和 "SOL/USDT" |

---

#### Gate.io Links

| 編號 | 測試名稱 | 意圖說明 |
|:-----|:---------|:---------|
| E2E-011 | should display Gate.io link for BNB/USDT | 驗證 BNB/USDT 行有可見的 Gate.io 連結圖示 |
| E2E-012 | should open Gate.io contract page in new tab | 驗證點擊後開啟 Gate.io Futures 頁面，URL 包含 gate.io/futures_trade/BNB_USDT |
| E2E-013 | should have correct aria-label for Gate.io link | 驗證連結的 aria-label 包含 "Gate.io" 和 "BNB/USDT" |

---

#### Tooltip Behavior

| 編號 | 測試名稱 | 意圖說明 |
|:-----|:---------|:---------|
| E2E-014 | should display tooltip on hover | 驗證滑鼠懸停在連結上 300ms 後顯示 tooltip，內容包含交易所名稱和交易對 |
| E2E-015 | should hide tooltip when mouse leaves | 驗證滑鼠移開後 tooltip 正確隱藏 |

---

#### Keyboard Navigation

| 編號 | 測試名稱 | 意圖說明 |
|:-----|:---------|:---------|
| E2E-016 | should be accessible via Tab key | 驗證可以使用 Tab 鍵導航到交易所連結，支援鍵盤無障礙操作 |
| E2E-017 | should open link with Enter key | 驗證聚焦連結後按 Enter 可以開啟新分頁 |

---

#### Disabled State

| 編號 | 測試名稱 | 意圖說明 |
|:-----|:---------|:---------|
| E2E-018 | should display disabled icon for unavailable exchange | 驗證無法使用的交易所顯示為禁用狀態（opacity-40、cursor-not-allowed、tabIndex=-1） |

---

#### Visual Regression

| 編號 | 測試名稱 | 意圖說明 |
|:-----|:---------|:---------|
| E2E-019 | should display exchange icons correctly | 驗證所有交易所圖示正確載入和顯示 |
| E2E-020 | should maintain layout with icons | 驗證表格結構未被圖示破壞，行列對齊正確 |

---

### 2. user-registration-and-api-keys.spec.ts

**路徑**: `tests/e2e/user-registration-and-api-keys.spec.ts`
**功能**: Feature 006 - Web 交易平台
**User Story**: US1 - 用戶註冊和 API Key 設置

#### 測試輔助

```typescript
const generateTestUser = () => {
  const timestamp = Date.now();
  return {
    email: `test_${timestamp}@example.com`,
    password: 'TestPassword123!',
    confirmPassword: 'TestPassword123!',
  };
};
```

---

#### 完整流程測試

| 編號 | 測試名稱 | 意圖說明 |
|:-----|:---------|:---------|
| E2E-021 | 完整流程：註冊 → 登入 → 新增 API Key | 驗證用戶完整註冊流程，包含 11 個步驟 |

**步驟詳解**：

| 步驟 | 動作 | 驗證點 |
|:-----|:-----|:-------|
| 1 | 訪問註冊頁面 | 頁面標題包含 Register 或 註冊 |
| 2 | 填寫註冊表單 | email、password、confirmPassword 欄位正確填寫 |
| 3 | 提交註冊 | 成功後重定向到 /login 或 /dashboard |
| 4 | 填寫登入表單 | 如果重定向到 login，填寫登入資訊 |
| 5 | 提交登入 | 成功後導航到 /opportunities |
| 6 | 驗證登入成功 | URL 包含 /opportunities |
| 7 | 訪問 API Key 管理頁面 | 點擊導航連結，URL 變為 /settings/api-keys |
| 8 | 點擊新增 API Key 按鈕 | 表單顯示，包含交易所選擇器 |
| 9 | 填寫 Binance API Key 表單 | 選擇 binance、填寫 label、apiKey、apiSecret |
| 10 | 提交 Binance API Key | 表單關閉或顯示錯誤訊息 |
| 11 | 驗證 API Key 列表頁面存在 | 顯示表格或列表容器 |

---

#### OKX API Key 流程

| 編號 | 測試名稱 | 意圖說明 |
|:-----|:---------|:---------|
| E2E-022 | 新增 OKX API Key 流程 | 驗證 OKX 特有的 passphrase 欄位處理正確 |

**OKX 特殊處理**：
- 選擇交易所為 'okx'
- 額外填寫 passphrase 欄位
- 驗證表單提交成功或顯示錯誤

---

#### 編輯和停用功能

| 編號 | 測試名稱 | 意圖說明 |
|:-----|:---------|:---------|
| E2E-023 | 測試 API Key 編輯和停用功能 | 驗證頁面功能按鈕存在且可操作 |

**驗證點**：
- 「新增 API Key」按鈕可見
- 顯示表格（有 API Keys）或空狀態訊息（尚未新增任何）

---

## 測試覆蓋分析

### 功能覆蓋

| 功能模組 | 覆蓋狀態 |
|:---------|:---------|
| 市場監控頁面 | ✅ 交易所連結功能完整覆蓋 |
| 用戶註冊 | ✅ 完整流程覆蓋 |
| 用戶登入 | ✅ 完整流程覆蓋 |
| API Key 新增 | ✅ Binance 和 OKX 覆蓋 |
| API Key 列表 | ✅ 基本驗證 |
| API Key 編輯/刪除 | ⚠️ 僅驗證按鈕存在 |

### 無障礙覆蓋

| 無障礙特性 | 覆蓋狀態 |
|:-----------|:---------|
| aria-label | ✅ 驗證交易所連結的標籤 |
| 鍵盤導航 | ✅ Tab 和 Enter 鍵支援 |
| 禁用狀態 | ✅ tabIndex=-1 驗證 |
| Tooltip | ✅ 懸停顯示/隱藏 |

### 安全性覆蓋

| 安全特性 | 覆蓋狀態 |
|:---------|:---------|
| 外部連結安全屬性 | ✅ noopener noreferrer |
| 密碼欄位隱藏 | ✅ type="password" |

---

## 執行說明

```bash
# 執行所有 E2E 測試
pnpm test:e2e

# 執行特定測試檔案
pnpm test:e2e tests/e2e/market-monitor-exchange-links.spec.ts
pnpm test:e2e tests/e2e/user-registration-and-api-keys.spec.ts

# 帶 UI 的互動模式
pnpm playwright test --ui

# 生成測試報告
pnpm playwright test --reporter=html
```

## 環境需求

- 需要啟動本地開發伺服器
- 需要資料庫連線（用於用戶註冊測試）
- Playwright 會自動管理瀏覽器生命週期
