# 專案審查報告與改進計劃

## 審查日期: 2026-01-01 (更新)

---

## 一、已完成項目

| 日期 | 項目 | Feature |
|------|------|---------|
| 2025-12-20 | Prisma Client Singleton 優化 | #039 |
| 2025-12-25 | API Key 連線測試功能 | #042 |
| 2025-12-26 | BingX 交易所整合 | #043 |
| 2025-12-28 | 統一 UI 主題系統 (Dark Glassmorphism) | #046 |
| 2025-12-29 | BalanceValidator 單元測試 | #047 |
| 2025-12-30 | 核心交易模組測試（PositionCloser、FundingFeeQueryService） | #051 |
| 2025-12-31 | 原生 WebSocket 客戶端（OKX、Gate.io、BingX） | #054 |
| 2026-01-01 | 條件單觸發誤判修復（Gate.io side 正規化） | Bug #053 |

---

## 二、高優先級問題

### 1. 核心交易模組測試覆蓋 ✅ 部分完成

**狀態**: 已為關鍵模組添加單元測試

| 模組 | 行數 | 風險 | 狀態 | 說明 |
|------|------|------|------|------|
| `PositionOrchestrator.ts` | 1,214 | 🟠 中 | ⚠️ 待測試 | 開倉協調器（Saga Pattern） |
| `PositionCloser.ts` | 1,265 | 🟢 低 | ✅ 已測試 | 平倉協調器（#051 bilateral close 測試） |
| `BalanceValidator.ts` | 299 | 🟢 低 | ✅ 已測試 | 保證金計算、風險控制（#047） |
| `conditional-order-calculator.ts` | ~300 | 🟠 中 | ⚠️ 待測試 | 停損停利價格計算 |
| `PositionLockService.ts` | ~200 | 🟠 中 | ⚠️ 待測試 | Redis 分散式鎖 |
| `cost-calculator.ts` | ~150 | 🟡 低 | ⚠️ 待測試 | 交易成本計算 |

**剩餘工作**: 為 PositionOrchestrator 添加單元測試

---

### 2. WebSocket 訂閱功能 ✅ 已完成 (#054)

**狀態**: 已實作原生 WebSocket 客戶端，繞過 CCXT 限制

| 交易所 | WebSocket 客戶端 | 狀態 |
|--------|-----------------|------|
| Binance | `BinanceFundingWs.ts` | ✅ 已實作 |
| OKX | `OkxFundingWs.ts` | ✅ 已實作 |
| Gate.io | `GateioFundingWs.ts` | ✅ 已實作 |
| BingX | `BingxFundingWs.ts` | ✅ 已實作 |
| MEXC | REST Poller (備援) | ✅ 運作中 |

**架構說明**:
- `DataSourceManager` 統一管理 WebSocket 和 REST 資料來源
- `EXCHANGE_DATA_SOURCE_CAPABILITIES` 配置各交易所支援的資料來源類型
- 自動 fallback：WebSocket 斷線時切換至 REST 輪詢

**註**: Connector 中的 `subscribeToTicker()` 方法保留為 TODO，因實際 WebSocket 邏輯已移至獨立的 `*FundingWs` 類別

---

### 3. 重複程式碼需重構

#### 3.1 Binance 帳戶檢測邏輯（~150 行重複 3 次）

| 檔案 | 行號 |
|------|------|
| `PositionCloser.ts` | 774-803 |
| `PositionOrchestrator.ts` | 753-782 |
| `FundingFeeQueryService.ts` | 234-263 |

**建議**: 提取到 `src/lib/ccxt/BinanceAccountDetector.ts`

#### 3.2 CCXT 交易所實例創建（4 處重複）

**建議**: 統一使用 `src/lib/ccxt/exchangeFactory.ts`

---

## 三、中優先級問題

### 4. 大型檔案需拆分（5 個 > 500 行）

| 檔案 | 行數 | 建議拆分 |
|------|------|----------|
| `PositionCloser.ts` | 1,265 | 提取：訂單執行器、帳戶檢測、PnL 計算 |
| `UserConnectorFactory.ts` | 1,254 | 拆分 5 個交易所 Connector 到獨立檔案 |
| `PositionOrchestrator.ts` | 1,214 | 提取：Saga 協調器、條件單設定 |
| `NotificationService.ts` | 1,120 | 拆分 Discord/Slack 適配器 |
| `SimulatedTrackingService.ts` | 773 | 提取業務邏輯到獨立模組 |

---

### 5. any 類型使用過多（28 處）

**主要位置**:
- CCXT 交易所配置和初始化
- Binance 帳戶檢測方法
- 錯誤處理中的 response 解析

**建議**:
1. 為 CCXT 配置建立專用 TypeScript 介面
2. 使用 `unknown` + 類型守衛取代 `any`

---

### 6. API 錯誤處理不一致

**問題**:
- 不同 route 對相同錯誤的 HTTP 狀態碼不統一
- 部分 route 使用 Zod 驗證，部分直接使用請求數據
- WebSocket 進度回報缺乏錯誤處理

**建議**: 建立 `src/lib/api-response.ts` 統一響應格式

---

## 四、低優先級/長期

### 7. Binance 期貨功能完善

| 檔案 | 行號 | 功能 |
|------|------|------|
| `binance.ts` | 347 | `getPositions()` 未實作 |
| `binance.ts` | 358 | `getPosition()` 未實作 |
| `binance.ts` | 329 | 總權益計算（需 USD 轉換） |
| `binance.ts` | 407 | 從交易記錄取得手續費 |

---

### 8. OI 數據 OKX 替代方案

**檔案**: `server.ts:64`

**問題**: 在 Binance API 被地理限制的環境中無法使用 OI 更新功能

**建議**: 實作使用 OKX API 獲取 OI 數據的替代方案

---

## 五、測試覆蓋率現況

### 已覆蓋（80+ 個測試案例）

- ✅ 所有交易所連接器（Binance、OKX、Gate.io、MEXC、BingX）
- ✅ ConditionalOrderService（停損停利）
- ✅ ConditionalOrderMonitor（條件單觸發偵測，含 Bug #053 修復測試）
- ✅ FundingFeeQueryService
- ✅ pnl-calculator
- ✅ ApiKeyValidator
- ✅ ArbitrageAssessor
- ✅ BalanceValidator（#047）
- ✅ PositionCloser - bilateral close（#051）
- ✅ WebSocket 客戶端（BaseExchangeWs、OkxFundingWs、GateioFundingWs、BingxFundingWs）
- ✅ DataSourceManager
- ✅ ConnectionPool

### 未覆蓋（待補充）

- ⚠️ PositionOrchestrator（開倉協調器）
- ⚠️ PositionDetailsService
- ⚠️ PositionLockService
- ⚠️ AuditLogger

---

## 六、優先級排序建議

### 已完成 ✅
1. ~~為 `BalanceValidator` 添加單元測試（風險控制）~~ → #047
2. ~~為 `PositionCloser` 添加單元測試~~ → #051
3. ~~實現 WebSocket 訂閱功能~~ → #054（4 個交易所）

### 短期
1. 為 `PositionOrchestrator` 添加單元測試
2. 提取 Binance 帳戶檢測共享工具

### 中期
3. 拆分大型檔案（PositionCloser、PositionOrchestrator）
4. 統一 API 錯誤處理

### 長期
5. 移除 any 類型
6. 完善 Binance 期貨功能
7. OI 數據 OKX 替代方案

---

## 七、新交易所整合評估

### 整合難度對比

| 交易所 | CCXT 支援 | 期貨 API | 資金費率 | 條件訂單 | 難度 | 狀態 |
|--------|----------|---------|---------|---------|------|------|
| **BingX** | ✅ | ✅ | ✅ | ✅ | ⭐⭐ | ✅ 已完成 |
| **Backpack** | ✅ | ⚠️ 待驗證 | ⚠️ 未知 | ⚠️ 未知 | ⭐⭐⭐ | 可選 |
| **XREX** | ❌ | ❌ | ❌ | ❌ | ⭐⭐⭐⭐⭐ | 不推薦 |

---

## 八、MEXC 交易能力確認

### API 連線測試結果（2025-12-25）

| 端點類型 | 狀態 | 說明 |
|----------|------|------|
| 公開 API | ✅ 正常 | fetchTicker, fetchFundingRate |
| 私有讀取 | ✅ 正常 | fetchBalance, fetchPositions |
| 私有寫入 | ❌ 超時 | 需要合約交易權限 |

**結論**: 需要在 MEXC 網站的 API 管理頁面開啟「合約交易」權限

---

## 九、變更記錄

| 日期 | 項目 | 狀態 |
|------|------|------|
| 2025-12-20 | Prisma Client Singleton 優化 | ✅ 完成 |
| 2025-12-25 | API Key 連線測試功能 | ✅ 完成 |
| 2025-12-25 | MEXC 合約交易 API 測試 | ⚠️ 需要權限 |
| 2025-12-26 | BingX 交易所整合 | ✅ 完成 |
| 2025-12-28 | 統一 UI 主題系統 | ✅ 完成 |
| 2025-12-28 | 專案審查更新 | ✅ 完成 |
| 2025-12-29 | BalanceValidator 單元測試 (#047) | ✅ 完成 |
| 2025-12-30 | 核心交易模組測試 (#051) | ✅ 完成 |
| 2025-12-31 | 原生 WebSocket 客戶端 (#054) | ✅ 完成 |
| 2026-01-01 | 條件單觸發誤判修復 (Bug #053) | ✅ 完成 |
| 2026-01-01 | 專案審查報告更新 | ✅ 完成 |
