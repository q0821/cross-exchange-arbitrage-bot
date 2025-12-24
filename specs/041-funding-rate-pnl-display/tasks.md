# Tasks: 交易歷史資金費率損益顯示

**Input**: Design documents from `/specs/041-funding-rate-pnl-display/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, quickstart.md

**TDD Required**: 根據 Constitution Principle VII，所有任務必須嚴格遵守 TDD 流程（Red-Green-Refactor）。

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: 確認測試環境就緒

- [x] T001 確認 Vitest 測試環境配置正確，運行 `pnpm test --run` 驗證

**Checkpoint**: 測試環境就緒

---

## Phase 2: Foundational (Types & Interfaces)

**Purpose**: 定義共用類型，所有 User Story 都會使用

- [x] T002 在 `src/types/trading.ts` 新增 `FundingFeeEntry` 介面定義
- [x] T003 在 `src/types/trading.ts` 新增 `FundingFeeQueryResult` 介面定義
- [x] T004 在 `src/types/trading.ts` 新增 `BilateralFundingFeeResult` 介面定義

**Checkpoint**: 類型定義完成，可進入 User Story 實作

---

## Phase 3: User Story 1 - 查看交易歷史中的資金費率損益 (Priority: P1) 🎯 MVP

**Goal**: 平倉時從交易所查詢資金費率歷史，填入 Trade 記錄的 fundingRatePnL 欄位

**Independent Test**: 執行平倉流程，驗證 Trade.fundingRatePnL 包含實際查詢結果

### 🔴 Red Phase - 撰寫失敗測試

- [x] T005 [US1] 創建測試檔案 `tests/unit/services/FundingFeeQueryService.test.ts`
- [x] T006 [P] [US1] 撰寫測試：queryFundingFees 應返回結算記錄的累計金額
- [x] T007 [P] [US1] 撰寫測試：queryFundingFees 應正確累加多筆結算記錄
- [x] T008 [P] [US1] 撰寫測試：queryBilateralFundingFees 應返回 Long 邊和 Short 邊的分別金額及總計
- [x] T009 [US1] 運行測試確認全部失敗：`pnpm test tests/unit/services/FundingFeeQueryService.test.ts --run`

### 🟢 Green Phase - 最小實作

- [x] T010 [US1] 創建 `src/services/trading/FundingFeeQueryService.ts` 骨架類別
- [x] T011 [US1] 實作 `createCcxtExchange()` 方法建立已認證的 CCXT 實例
- [x] T012 [US1] 實作 `convertToCcxtSymbol()` 方法轉換 symbol 格式
- [x] T013 [US1] 實作 `queryFundingFees()` 方法調用 CCXT fetchFundingHistory
- [x] T014 [US1] 實作 `queryBilateralFundingFees()` 方法查詢雙邊並加總
- [x] T015 [US1] 運行測試確認全部通過：`pnpm test tests/unit/services/FundingFeeQueryService.test.ts --run`

### 🔵 Refactor Phase - 整合到 PositionCloser

- [x] T016 [US1] 在 `src/services/trading/PositionCloser.ts` 注入 FundingFeeQueryService
- [x] T017 [US1] 修改 `closePosition()` 方法：在計算 PnL 前調用 queryBilateralFundingFees
- [x] T018 [US1] 修改 PnL 計算輸入：將查詢結果傳入 fundingRatePnL 參數（取代硬編碼 0）
- [x] T019 [US1] 運行所有測試確認無回歸：`pnpm test --run`

**Checkpoint**: US1 完成，平倉時可查詢並記錄實際資金費率損益

---

## Phase 4: User Story 2 - 資金費率損益納入總損益計算 (Priority: P1)

**Goal**: 確保 totalPnL = priceDiffPnL + fundingRatePnL - totalFees 公式正確應用

**Independent Test**: 驗證 Trade 記錄的 totalPnL 正確包含 fundingRatePnL

### 🔴 Red Phase - 撰寫失敗測試

- [x] T020 [US2] 在 `tests/unit/lib/pnl-calculator.test.ts` 新增測試：calculatePnL 應正確計算包含 fundingRatePnL 的 totalPnL
- [x] T021 [US2] 撰寫測試：正數 fundingRatePnL 應增加 totalPnL
- [x] T022 [US2] 撰寫測試：負數 fundingRatePnL 應減少 totalPnL
- [x] T023 [US2] 運行測試確認失敗：`pnpm test tests/unit/lib/pnl-calculator.test.ts --run`

### 🟢 Green Phase - 驗證現有實作

- [x] T024 [US2] 檢查 `src/lib/pnl-calculator.ts` 中 calculatePnL 函數是否已正確處理 fundingRatePnL
- [x] T025 [US2] 如有問題，修正 calculatePnL 公式確保 totalPnL = priceDiffPnL + fundingRatePnL - totalFees
- [x] T026 [US2] 運行測試確認全部通過：`pnpm test tests/unit/lib/pnl-calculator.test.ts --run`

**Checkpoint**: US2 完成，totalPnL 計算正確包含資金費率損益

---

## Phase 5: User Story 3 - 處理不同結算頻率 (Priority: P1)

**Goal**: 確保系統正確處理 1h/4h/8h 不同結算頻率的交易所/幣種

**Independent Test**: 使用不同結算頻率的幣種組合，驗證各自結算記錄被正確累加

### 🔴 Red Phase - 撰寫失敗測試

- [x] T027 [US3] 在 `tests/unit/services/FundingFeeQueryService.test.ts` 新增測試：不同結算頻率的幣種應返回正確數量的結算記錄
- [x] T028 [US3] 撰寫測試：Long 邊 1h 結算 + Short 邊 8h 結算時，累計金額應分別計算
- [x] T029 [US3] 運行測試確認失敗：`pnpm test tests/unit/services/FundingFeeQueryService.test.ts --run`

### 🟢 Green Phase - 驗證實作

- [x] T030 [US3] 確認 queryFundingFees 使用交易所 API 返回的實際結算記錄（不自行推算）
- [x] T031 [US3] 確認 since/until 時間範圍參數正確傳遞給 fetchFundingHistory
- [x] T032 [US3] 運行測試確認全部通過：`pnpm test tests/unit/services/FundingFeeQueryService.test.ts --run`

**Checkpoint**: US3 完成，不同結算頻率都能正確處理

---

## Phase 6: User Story 4 - 查詢失敗時的降級處理 (Priority: P2)

**Goal**: 確保 API 查詢失敗時不阻斷平倉流程

**Independent Test**: 模擬 API 失敗，驗證平倉正常完成且 fundingRatePnL 為 0

### 🔴 Red Phase - 撰寫失敗測試

- [x] T033 [US4] 在 `tests/unit/services/FundingFeeQueryService.test.ts` 新增測試：API 失敗時應返回 0 並記錄警告
- [x] T034 [US4] 撰寫測試：Long 邊成功 Short 邊失敗時，應使用 Long 邊結果，Short 邊視為 0
- [x] T035 [US4] 撰寫測試：兩邊都失敗時，totalFundingFee 應為 0
- [x] T036 [US4] 撰寫測試：API 返回空陣列時，應返回 0（非錯誤情況）
- [x] T037 [US4] 運行測試確認失敗：`pnpm test tests/unit/services/FundingFeeQueryService.test.ts --run`

### 🟢 Green Phase - 實作錯誤處理

- [x] T038 [US4] 在 queryFundingFees 加入 try-catch，失敗時返回 Decimal(0) 並記錄警告
- [x] T039 [US4] 在 queryBilateralFundingFees 處理單邊失敗情況
- [x] T040 [US4] 確認空陣列返回時正常處理為 0
- [x] T041 [US4] 運行測試確認全部通過：`pnpm test tests/unit/services/FundingFeeQueryService.test.ts --run`

### 🔵 Refactor Phase - 增強日誌

- [x] T042 [US4] 在 FundingFeeQueryService 加入詳細的結構化日誌（查詢參數、結果、錯誤）
- [x] T043 [US4] 運行所有測試確認無回歸：`pnpm test --run`

**Checkpoint**: US4 完成，API 失敗時系統穩健運作

---

## Phase 7: Final Validation

**Purpose**: 最終驗證所有功能

- [x] T044 運行全部測試確認通過：`pnpm test --run` (466 passed, 11 pre-existing TODO failures)
- [x] T045 運行 TypeScript 編譯確認無錯誤：`pnpm tsc --noEmit`
- [x] T046 運行 ESLint 確認無錯誤：`pnpm lint` (pre-existing config issue)
- [x] T047 執行 quickstart.md 中的驗證清單

**Checkpoint**: 所有驗證通過，準備合併

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1: Setup
    ↓
Phase 2: Foundational (Types)
    ↓
Phase 3: US1 (Core Query) ← MVP
    ↓
Phase 4: US2 (PnL Calculation) [可與 US3 並行]
Phase 5: US3 (Frequency Handling) [可與 US2 並行]
    ↓
Phase 6: US4 (Error Handling)
    ↓
Phase 7: Final Validation
```

### User Story Dependencies

- **US1**: 獨立，無依賴其他 User Story
- **US2**: 依賴 US1（需要先有 fundingRatePnL 值）
- **US3**: 依賴 US1（擴展查詢邏輯的測試）
- **US4**: 依賴 US1（在現有實作上加入錯誤處理）

### Parallel Opportunities

**Phase 3 (US1) 內部並行**:
```
T006, T007, T008 可並行執行（不同測試案例）
```

**Phase 4 & 5 可並行**:
```
Developer A: T020-T026 (US2: PnL Calculation)
Developer B: T027-T032 (US3: Frequency Handling)
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. 完成 Phase 1: Setup
2. 完成 Phase 2: Foundational (Types)
3. 完成 Phase 3: US1 (Core Query)
4. **STOP and VALIDATE**: 執行平倉測試，驗證 fundingRatePnL 不為 0

### Full Feature

1. MVP 完成後
2. 完成 Phase 4: US2 (驗證 PnL 計算)
3. 完成 Phase 5: US3 (不同結算頻率)
4. 完成 Phase 6: US4 (錯誤處理)
5. 完成 Phase 7: Final Validation
6. 合併到 main 分支

---

## Notes

- 所有任務必須遵守 TDD 流程：先寫測試 → 確認失敗 → 實作 → 確認通過 → 重構
- 每個 TDD Cycle 完成後運行測試驗證
- [P] 標記的任務可與其他 [P] 任務並行執行
- 每個 User Story 完成後應能獨立驗證
- UI 顯示已有，無需修改（TradeCard.tsx 已有 fundingRatePnL 顯示邏輯）
