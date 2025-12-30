# Tasks: 交易操作驗證腳本

**Input**: Design documents from `/specs/049-specify-scripts-bash/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/validation-report.md, quickstart.md

**Tests**: 本功能不包含自動化測試任務（驗證腳本本身即為測試工具）

**Organization**: 任務按 User Story 分組，支援獨立實作和測試

## Format: `[ID] [P?] [Story] Description`
- **[P]**: 可平行執行（不同檔案、無依賴）
- **[Story]**: 所屬 User Story（US1, US2, US3）
- 包含精確檔案路徑

## Path Conventions
- **單一專案**: `src/scripts/trading-validation/` 為主要目錄

---

## Phase 1: Setup（共用基礎設施）

**Purpose**: 專案初始化和基本結構

- [x] T001 建立目錄結構 `src/scripts/trading-validation/`
- [x] T002 [P] 定義類型介面 `src/scripts/trading-validation/types.ts`
- [x] T003 [P] 安裝 commander 依賴（如尚未安裝）

---

## Phase 2: Foundational（必要前置任務）

**Purpose**: 所有 User Story 都依賴的核心基礎設施

**⚠️ CRITICAL**: 必須完成此階段才能開始 User Story 實作

- [x] T004 實作 ExchangeQueryService 基礎類別 `src/scripts/trading-validation/ExchangeQueryService.ts`
  - 封裝 CCXT 交易所連接
  - 實作 `createExchange(exchange, apiKey)` 方法
  - 實作 `fetchPosition(symbol)` 查詢持倉
  - 實作 `fetchConditionalOrders(symbol)` 查詢條件單（各交易所特定 API）
- [x] T005 [P] 實作 ValidationReporter 報告生成器 `src/scripts/trading-validation/ValidationReporter.ts`
  - 實作文字格式輸出（emoji 增強可讀性）
  - 實作 JSON 格式輸出
  - 實作總結統計（passed/failed/skipped/warned）
- [x] T006 [P] 實作 API Key 讀取工具函數 `src/scripts/trading-validation/utils.ts`
  - 從資料庫讀取加密的 API Key
  - 使用現有 `decryptApiKey()` 解密

**Checkpoint**: 基礎設施就緒 - 可開始 User Story 實作

---

## Phase 3: User Story 1 - 透過 API 自動執行完整交易驗證 (Priority: P1) 🎯 MVP

**Goal**: 透過腳本呼叫 Web API 執行開倉→停損停利→平倉完整流程，並自動驗證每個步驟

**Independent Test**: 執行 `pnpm tsx src/scripts/trading-validation/validate-trading.ts run --exchange gateio --symbol BTCUSDT --quantity 10 --leverage 1 --stop-loss 5 --take-profit 5 --user-id <userId>` 可完成完整驗證

### Implementation for User Story 1

- [x] T007 [US1] 實作 TradingValidator 核心類別 `src/scripts/trading-validation/TradingValidator.ts`
  - 定義 11 項驗證項目常數
  - 實作 `validatePositionOpen()` 開倉驗證（項目 1-3）
  - 實作 `validateConditionalOrders()` 條件單驗證（項目 4-9）
  - 實作 `validatePositionClose()` 平倉驗證（項目 10-11）
  - 實作 `runFullValidation()` 完整驗證流程
- [x] T008 [US1] 實作 Web API 呼叫模組 `src/scripts/trading-validation/ApiClient.ts`
  - 使用 axios 呼叫 `POST /api/positions/open`
  - 使用 axios 呼叫 `POST /api/positions/[id]/close`
  - 設定 timeout（30 秒）
  - 處理 API 錯誤回應
- [x] T009 [US1] 實作 CLI 入口點 `run` 命令 `src/scripts/trading-validation/validate-trading.ts`
  - 使用 commander 解析參數（exchange, symbol, quantity, leverage, stop-loss, take-profit, user-id, json）
  - 參數驗證（必填檢查、交易所白名單）
  - 呼叫 TradingValidator.runFullValidation()
  - 輸出驗證報告
  - 設定正確的 exit code（0=通過, 1=失敗, 2=致命錯誤）
- [x] T010 [US1] 實作開倉驗證邏輯
  - 驗證項目 1：交易對格式轉換正確（BTCUSDT → BTC/USDT:USDT）
  - 驗證項目 2：開倉數量正確（查詢交易所持倉比對）
  - 驗證項目 3：contractSize 轉換正確（幣本位 vs 合約張數）
- [x] T011 [US1] 實作條件單驗證邏輯
  - 驗證項目 4：停損單已建立（查詢交易所條件單列表）
  - 驗證項目 5：停損價格正確（比對觸發價格）
  - 驗證項目 6：停損數量正確（考慮 contractSize 轉換）
  - 驗證項目 7：停利單已建立
  - 驗證項目 8：停利價格正確
  - 驗證項目 9：停利數量正確
- [x] T012 [US1] 實作平倉驗證邏輯
  - 驗證項目 10：平倉執行成功（查詢交易所確認持倉關閉）
  - 驗證項目 11：平倉數量正確（比對成交數量）
- [x] T013 [US1] 實作錯誤處理策略
  - 致命錯誤處理（API Key 不存在、餘額不足、連線失敗）
  - 可恢復錯誤處理（條件單設定失敗→繼續驗證、超時→重試 3 次）
  - 跳過項目處理（未啟用停損停利→跳過相關驗證）

**Checkpoint**: User Story 1 完成 - 可執行完整自動驗證流程

---

## Phase 4: User Story 2 - 查詢驗證手動操作結果 (Priority: P2)

**Goal**: 驗證已透過 Web 界面建立的持倉，確認交易所實際狀態與系統記錄一致

**Independent Test**: 執行 `pnpm tsx src/scripts/trading-validation/validate-trading.ts verify --position-id <positionId>` 可驗證現有持倉

### Implementation for User Story 2

- [x] T014 [US2] 實作 CLI 入口點 `verify` 命令 `src/scripts/trading-validation/validate-trading.ts`
  - 使用 commander 解析參數（position-id, json）
  - 從資料庫讀取 Position 記錄
  - 取得對應的 API Key
- [x] T015 [US2] 實作 TradingValidator.verifyPosition() 方法 `src/scripts/trading-validation/TradingValidator.ts`
  - 根據 Position 記錄查詢交易所狀態
  - 比對持倉數量、方向、symbol
  - 比對條件單狀態（如有）
  - 不執行交易，僅查詢驗證
- [x] T016 [US2] 實作雙邊持倉驗證
  - 驗證 longExchange 端持倉狀態
  - 驗證 shortExchange 端持倉狀態
  - 比對兩邊數量一致性

**Checkpoint**: User Story 2 完成 - 可驗證手動建立的持倉

---

## Phase 5: User Story 3 - 驗證單一交易所 (Priority: P3)

**Goal**: 針對特定交易所進行快速驗證，便於除錯和回歸測試

**Independent Test**: 執行 `pnpm tsx src/scripts/trading-validation/validate-trading.ts run --exchange gateio ...` 僅針對指定交易所

### Implementation for User Story 3

- [x] T017 [P] [US3] 實作 Binance 特定查詢邏輯 `src/scripts/trading-validation/ExchangeQueryService.ts`
  - 持倉查詢：`fetchPositions()`
  - 條件單查詢：`fetchOpenOrders(symbol)` + 過濾 STOP_MARKET/TAKE_PROFIT_MARKET
- [x] T018 [P] [US3] 實作 OKX 特定查詢邏輯 `src/scripts/trading-validation/ExchangeQueryService.ts`
  - 持倉查詢：`fetchPositions()`
  - 條件單查詢：`privateGetTradeOrdersAlgoPending()`
- [x] T019 [P] [US3] 實作 Gate.io 特定查詢邏輯 `src/scripts/trading-validation/ExchangeQueryService.ts`
  - 持倉查詢：`fetchPositions()`
  - 條件單查詢：`privateFuturesGetSettlePriceOrders()`
  - 特別處理 contractSize（Gate.io 部分幣種 contractSize 不為 1）
- [x] T020 [P] [US3] 實作 BingX 特定查詢邏輯 `src/scripts/trading-validation/ExchangeQueryService.ts`
  - 持倉查詢：`fetchPositions()`
  - 條件單查詢：`fetchOpenOrders(symbol)`
- [x] T021 [US3] 驗證 contractSize 轉換正確性
  - Gate.io BTC contractSize = 0.001
  - 比對：預期幣本位數量 vs 實際合約張數 × contractSize

**Checkpoint**: 所有 User Story 完成 - 支援所有四個交易所的獨立驗證

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 改進和完善

- [x] T022 [P] 新增 package.json 便捷指令 `package.json`
  - 新增 `"validate-trading": "tsx src/scripts/trading-validation/validate-trading.ts"`
- [x] T023 驗證 quickstart.md 所有指令可正常執行
- [x] T024 [P] 改善報告輸出格式（對齊、顏色）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 無依賴 - 可立即開始
- **Foundational (Phase 2)**: 依賴 Setup 完成 - **阻擋所有 User Story**
- **User Stories (Phase 3-5)**: 依賴 Foundational 完成
  - US1 必須先完成（提供核心驗證邏輯）
  - US2 可在 US1 完成後並行
  - US3 可在 Foundational 完成後開始（交易所特定邏輯獨立）
- **Polish (Phase 6)**: 依賴所有 User Story 完成

### User Story Dependencies

- **User Story 1 (P1)**: Foundational 完成後可開始 - 提供核心驗證邏輯
- **User Story 2 (P2)**: 依賴 US1（使用相同的驗證邏輯）
- **User Story 3 (P3)**: 可與 US1 並行（交易所特定查詢邏輯獨立）

### Within Each User Story

- 類型定義 → 服務實作 → CLI 入口
- 核心邏輯 → 錯誤處理
- 完成一個 Story 後再進入下一個

### Parallel Opportunities

- T002, T003 可並行（不同檔案）
- T004, T005, T006 可並行（Foundational 階段）
- T017, T018, T019, T020 可並行（各交易所獨立）
- T022, T024 可並行（Polish 階段）

---

## Parallel Example: Phase 2 Foundational

```bash
# 同時啟動三個任務：
Task: "實作 ExchangeQueryService 基礎類別 src/scripts/trading-validation/ExchangeQueryService.ts"
Task: "實作 ValidationReporter 報告生成器 src/scripts/trading-validation/ValidationReporter.ts"
Task: "實作 API Key 讀取工具函數 src/scripts/trading-validation/utils.ts"
```

## Parallel Example: Phase 5 User Story 3

```bash
# 同時啟動四個交易所查詢邏輯：
Task: "實作 Binance 特定查詢邏輯"
Task: "實作 OKX 特定查詢邏輯"
Task: "實作 Gate.io 特定查詢邏輯"
Task: "實作 BingX 特定查詢邏輯"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. 完成 Phase 1: Setup
2. 完成 Phase 2: Foundational（**關鍵 - 阻擋所有 Story**）
3. 完成 Phase 3: User Story 1
4. **停止驗證**: 使用真實交易所測試完整流程
5. 可部署/展示 MVP

### Incremental Delivery

1. Setup + Foundational → 基礎就緒
2. User Story 1 → 獨立測試 → MVP 完成！
3. User Story 2 → 獨立測試 → 查詢驗證功能
4. User Story 3 → 獨立測試 → 所有交易所支援
5. 每個 Story 都能獨立運作且不破壞先前功能

---

## Notes

- [P] 任務 = 不同檔案、無依賴
- [Story] 標籤對應 spec.md 的 User Story
- 每個 User Story 可獨立完成和測試
- 使用真實交易所（小額）驗證
- 每個任務完成後 commit
- 任何 checkpoint 都可停止驗證
- 避免：模糊任務、同檔案衝突、破壞 Story 獨立性的跨 Story 依賴
