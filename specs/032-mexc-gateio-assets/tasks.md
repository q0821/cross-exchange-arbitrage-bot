# Tasks: MEXC 和 Gate.io 資產追蹤

**Input**: Design documents from `/specs/032-mexc-gateio-assets/`
**Prerequisites**: plan.md, spec.md, research.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (N/A)

**Purpose**: 此功能為 Feature 031 的擴展，無需額外設定

**Note**: 所有基礎設施（CCXT、Prisma、TypeScript）已由 Feature 031 建立完成

---

## Phase 2: Foundational (N/A)

**Purpose**: 核心基礎設施已存在

**Note**:
- `UserConnectorFactory.ts` 架構已存在
- `IExchangeConnector` 介面已定義
- `AssetSnapshot` 資料模型已包含 `mexcBalanceUSD` 和 `gateioBalanceUSD` 欄位
- 前端的 `AssetSummaryCard` 和 `AssetHistoryChart` 已支援 MEXC 和 Gate.io

**Checkpoint**: Foundation ready - 可直接進入 User Story 實作

---

## Phase 3: User Story 1 - 查看 MEXC 交易所資產 (Priority: P1) 🎯 MVP

**Goal**: 用戶能在資產總覽頁面看到 MEXC 交易所的總資產（USD）

**Independent Test**: 綁定 MEXC API Key 後，進入資產總覽頁面，確認 MEXC 餘額正確顯示

### Implementation for User Story 1

- [x] T001 [US1] 新增 MexcUserConnector 類別在 src/services/assets/UserConnectorFactory.ts
  - 參考 OkxUserConnector 實作模式
  - 使用 CCXT 4.x 的 `mexc` 類別
  - 實作 `connect()`, `disconnect()`, `isConnected()` 方法
  - 不需要 passphrase 參數

- [x] T002 [US1] 實作 MexcUserConnector.getBalance() 方法在 src/services/assets/UserConnectorFactory.ts
  - 使用 `this.exchange.fetchBalance()` 查詢餘額
  - 設定 `defaultType: 'swap'` 使用永續合約
  - 計算 `totalEquityUSD` 使用 USDT 餘額
  - 格式化餘額資料符合 `AccountBalance` 介面

- [x] T003 [US1] 更新 createConnector() 支援 MEXC 在 src/services/assets/UserConnectorFactory.ts
  - 在 switch 語句中新增 `case 'mexc':`
  - 返回 `new MexcUserConnector(apiKey, apiSecret, isTestnet)`

- [ ] T004 [US1] 驗證 MEXC 餘額查詢功能
  - 啟動服務並綁定 MEXC API Key
  - 確認資產總覽頁面顯示 MEXC 餘額
  - 確認狀態顯示為「success」而非「no_api_key」

**Checkpoint**: User Story 1 完成 - MEXC 資產查詢可獨立運作

---

## Phase 4: User Story 2 - 查看 Gate.io 交易所資產 (Priority: P1)

**Goal**: 用戶能在資產總覽頁面看到 Gate.io 交易所的總資產（USD）

**Independent Test**: 綁定 Gate.io API Key 後，進入資產總覽頁面，確認 Gate.io 餘額正確顯示

### Implementation for User Story 2

- [x] T005 [P] [US2] 新增 GateioUserConnector 類別在 src/services/assets/UserConnectorFactory.ts
  - 參考 OkxUserConnector 實作模式
  - 使用 CCXT 4.x 的 `gateio` 類別
  - 實作 `connect()`, `disconnect()`, `isConnected()` 方法
  - 不需要 passphrase 參數

- [x] T006 [US2] 實作 GateioUserConnector.getBalance() 方法在 src/services/assets/UserConnectorFactory.ts
  - 使用 `this.exchange.fetchBalance()` 查詢餘額
  - 設定 `defaultType: 'swap'` 使用永續合約
  - 計算 `totalEquityUSD` 使用 USDT 餘額
  - 格式化餘額資料符合 `AccountBalance` 介面

- [x] T007 [US2] 更新 createConnector() 支援 Gate.io 在 src/services/assets/UserConnectorFactory.ts
  - 在 switch 語句中新增 `case 'gateio':` 和 `case 'gate':`
  - 返回 `new GateioUserConnector(apiKey, apiSecret, isTestnet)`

- [ ] T008 [US2] 驗證 Gate.io 餘額查詢功能
  - 啟動服務並綁定 Gate.io API Key
  - 確認資產總覽頁面顯示 Gate.io 餘額
  - 確認狀態顯示為「success」而非「no_api_key」

**Checkpoint**: User Stories 1 AND 2 完成 - 兩個交易所資產查詢可獨立運作

---

## Phase 5: User Story 3 - 查看 MEXC 和 Gate.io 持倉 (Priority: P2)

**Goal**: 用戶能看到在 MEXC 和 Gate.io 的當前期貨持倉

**Independent Test**: 在 MEXC 或 Gate.io 開倉後，確認系統顯示正確的持倉資訊

### Implementation for User Story 3

- [x] T009 [US3] 實作 MexcUserConnector.getPositions() 方法在 src/services/assets/UserConnectorFactory.ts
  - 使用 `this.exchange.fetchPositions()` 查詢持倉
  - 過濾出 `contracts > 0` 的持倉
  - 格式化持倉資料符合 `PositionInfo` 介面
  - 映射欄位: symbol, side, quantity, entryPrice, markPrice, leverage, unrealizedPnl

- [x] T010 [P] [US3] 實作 GateioUserConnector.getPositions() 方法在 src/services/assets/UserConnectorFactory.ts
  - 使用 `this.exchange.fetchPositions()` 查詢持倉
  - 過濾出 `contracts > 0` 的持倉
  - 格式化持倉資料符合 `PositionInfo` 介面
  - 映射欄位: symbol, side, quantity, entryPrice, markPrice, leverage, unrealizedPnl

- [ ] T011 [US3] 驗證持倉查詢功能
  - 在 MEXC 或 Gate.io 開啟測試倉位
  - 確認資產總覽頁面正確顯示持倉資訊
  - 確認無持倉時顯示空列表而非錯誤

**Checkpoint**: All user stories 完成 - MEXC 和 Gate.io 資產追蹤功能完整

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 程式碼品質和整合驗證

- [ ] T012 驗證每小時快照任務正確記錄 MEXC 和 Gate.io 餘額
  - 檢查 `asset_snapshots` 表中的 `mexc_balance_usd` 和 `gateio_balance_usd` 欄位
  - 確認 `mexc_status` 和 `gateio_status` 記錄正確狀態

- [ ] T013 驗證歷史曲線圖正確顯示 MEXC 和 Gate.io 資料
  - 選擇 7/14/30 天時間範圍
  - 確認 MEXC (綠色 #00B897) 和 Gate.io (藍色 #2354E6) 曲線正確顯示

- [x] T014 [P] 執行 TypeScript 類型檢查和 lint
  - `pnpm tsc --noEmit` ✅ 通過
  - `pnpm lint` ⚠️ ESLint 配置問題 (非程式碼問題)

- [ ] T015 執行 quickstart.md 驗證流程
  - 依照 quickstart.md 的驗證步驟測試完整功能

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: N/A - 已由 Feature 031 完成
- **Foundational (Phase 2)**: N/A - 已存在
- **User Story 1 (Phase 3)**: 可直接開始
- **User Story 2 (Phase 4)**: 可與 US1 並行開發 (T005 標記為 [P])
- **User Story 3 (Phase 5)**: 依賴 US1 和 US2 的基礎類別
- **Polish (Phase 6)**: 依賴所有 User Stories 完成

### User Story Dependencies

- **User Story 1 (P1)**: 獨立 - 實作 MexcUserConnector
- **User Story 2 (P1)**: 獨立 - 實作 GateioUserConnector (可與 US1 並行)
- **User Story 3 (P2)**: 依賴 US1 和 US2 的類別定義，但方法可獨立實作

### Within Each User Story

- 類別定義 (constructor, connect, disconnect) → getBalance() → createConnector() 更新 → 驗證

### Parallel Opportunities

- T005 (GateioUserConnector) 可與 T001-T004 (MexcUserConnector) 並行開發
- T009 和 T010 (getPositions 方法) 可並行開發

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. 完成 T001-T004: MexcUserConnector 實作
2. **驗證**: MEXC 餘額查詢功能正常
3. 可部署使用

### Incremental Delivery

1. T001-T004: MEXC 餘額查詢 → 驗證 → 可部署 (MVP!)
2. T005-T008: Gate.io 餘額查詢 → 驗證 → 可部署
3. T009-T011: 持倉查詢 → 驗證 → 可部署
4. T012-T015: 整合驗證和品質檢查 → 完成

### Estimated Effort

| Phase | Tasks | 預估行數 |
|-------|-------|---------|
| US1 | T001-T004 | ~80 行 |
| US2 | T005-T008 | ~80 行 |
| US3 | T009-T011 | ~40 行 |
| Polish | T012-T015 | 驗證工作 |
| **Total** | 15 tasks | ~200 行 |

---

## Notes

- 此功能修改單一檔案: `src/services/assets/UserConnectorFactory.ts`
- 無需新增資料庫 migration（欄位已存在）
- 無需修改前端（UI 已支援 MEXC 和 Gate.io）
- 參考 `OkxUserConnector` (行 596-730) 作為實作模板
- CCXT 4.x 已安裝並在專案中使用
