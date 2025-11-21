# Tasks: 修正費率差異計算的時間基準一致性

**Input**: Design documents from `/specs/021-fix-rate-spread-calculation/`
**Prerequisites**: plan.md (required), spec.md (required for user stories)

**Tests**: Tests are REQUIRED for this feature as specified in the specification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- **Single project**: `src/`, `tests/`, `app/` at repository root
- Paths assume TypeScript project with Next.js frontend

## Phase 1: User Story 1 - 修正後端年化報酬計算邏輯 (Priority: P1) 🎯

**Goal**: 修正後端 `src/models/FundingRate.ts` 中的年化收益計算公式，使其根據 timeBasis 參數動態計算，而不是使用固定的 8 小時週期。

**Independent Test**: 執行單元測試驗證年化報酬在不同時間基準下計算正確，且所有時間基準下的年化報酬保持一致。

### Implementation for User Story 1

- [ ] T001 [US1] 讀取 src/models/FundingRate.ts 文件，定位到第 270 行的年化收益計算邏輯
- [ ] T002 [US1] 修改 src/models/FundingRate.ts:270 將固定公式 `spread * 365 * 3 * 100` 改為動態公式 `spread * 365 * (24 / timeBasis) * 100`
- [ ] T003 [US1] 驗證 src/models/FundingRate.ts 中 `createMultiExchangeFundingRatePair` 函數正確接收並使用 timeBasis 參數
- [ ] T004 [P] [US1] 創建單元測試 tests/unit/models/FundingRate.test.ts 測試年化報酬計算邏輯
- [ ] T005 [US1] 在 tests/unit/models/FundingRate.test.ts 中添加測試：驗證 1 小時基準下的年化報酬計算
- [ ] T006 [US1] 在 tests/unit/models/FundingRate.test.ts 中添加測試：驗證 4 小時基準下的年化報酬計算
- [ ] T007 [US1] 在 tests/unit/models/FundingRate.test.ts 中添加測試：驗證 8 小時基準下的年化報酬計算
- [ ] T008 [US1] 在 tests/unit/models/FundingRate.test.ts 中添加測試：驗證 24 小時基準下的年化報酬計算
- [ ] T009 [US1] 在 tests/unit/models/FundingRate.test.ts 中添加測試：驗證所有時間基準下的年化報酬保持一致（允許 0.01% 誤差）
- [ ] T010 [US1] 運行測試 `pnpm test tests/unit/models/FundingRate.test.ts` 確保所有測試通過

**Checkpoint**: 後端年化報酬計算邏輯已修正，所有單元測試通過。

---

## Phase 2: User Story 2 - 增強 getNormalizedRate 函數的健壯性 (Priority: P1)

**Goal**: 增強後端和前端的 `getNormalizedRate` 函數，處理標準化數據缺失的情況，添加降級邏輯和警告日誌。

**Independent Test**: 執行單元測試驗證 getNormalizedRate 函數在各種邊界情況下都能正確返回標準化費率或降級處理。

### Implementation for User Story 2

#### Backend Enhancement

- [ ] T011 [US2] 讀取 src/models/FundingRate.ts 文件，定位到第 131-146 行的 getNormalizedRate 函數
- [ ] T012 [US2] 增強 src/models/FundingRate.ts:131-146 的 getNormalizedRate 函數：添加 null 檢查和降級邏輯
- [ ] T013 [US2] 在 src/models/FundingRate.ts 的 getNormalizedRate 函數中添加規則 3：當標準化數據缺失時進行即時計算
- [ ] T014 [US2] 在 src/models/FundingRate.ts 的 getNormalizedRate 函數中添加規則 4：最後降級返回原始費率並記錄警告日誌
- [ ] T015 [P] [US2] 在 tests/unit/models/FundingRate.test.ts 中添加 getNormalizedRate 測試：驗證優先使用標準化值的邏輯
- [ ] T016 [P] [US2] 在 tests/unit/models/FundingRate.test.ts 中添加 getNormalizedRate 測試：驗證原始週期等於目標時間基準時直接返回原始費率
- [ ] T017 [P] [US2] 在 tests/unit/models/FundingRate.test.ts 中添加 getNormalizedRate 測試：驗證標準化數據缺失時的即時計算邏輯
- [ ] T018 [P] [US2] 在 tests/unit/models/FundingRate.test.ts 中添加 getNormalizedRate 測試：驗證最後降級邏輯並記錄警告
- [ ] T019 [US2] 運行後端測試 `pnpm test tests/unit/models/FundingRate.test.ts` 確保所有 getNormalizedRate 測試通過

#### Frontend Synchronization

- [ ] T020 [P] [US2] 讀取 app/(dashboard)/market-monitor/utils/rateCalculations.ts 文件，定位到第 23-41 行的 getNormalizedRate 函數
- [ ] T021 [US2] 同步前端 app/(dashboard)/market-monitor/utils/rateCalculations.ts:23-41 的 getNormalizedRate 函數邏輯與後端一致
- [ ] T022 [US2] 在前端 getNormalizedRate 函數中添加降級邏輯：即時計算標準化值
- [ ] T023 [US2] 在前端 getNormalizedRate 函數中添加 console.warn 記錄標準化數據缺失的情況
- [ ] T024 [P] [US2] 創建前端單元測試 tests/unit/frontend/rateCalculations.test.ts 測試 getNormalizedRate 邏輯
- [ ] T025 [US2] 在 tests/unit/frontend/rateCalculations.test.ts 中添加測試：驗證前端 getNormalizedRate 函數的各種情況
- [ ] T026 [US2] 運行前端測試確保所有 getNormalizedRate 測試通過

**Checkpoint**: getNormalizedRate 函數已增強，前後端邏輯一致，所有單元測試通過。

---

## Phase 3: User Story 3 - 集成測試和端到端驗證 (Priority: P2)

**Goal**: 創建集成測試驗證完整的費率差異和年化報酬計算流程，確保前後端計算一致，並在所有時間基準下測試驗證。

**Independent Test**: 執行集成測試模擬完整的數據流（WebSocket 推送 → 計算 → 顯示），驗證所有時間基準下的計算正確性。

### Integration Tests for User Story 3

- [ ] T027 [P] [US3] 創建集成測試 tests/integration/rate-calculation.test.ts 測試完整的費率計算流程
- [ ] T028 [US3] 在 tests/integration/rate-calculation.test.ts 中添加測試：驗證 WebSocket 推送數據格式包含 normalized 和 originalInterval 欄位
- [ ] T029 [US3] 在 tests/integration/rate-calculation.test.ts 中添加測試：驗證所有時間基準下的費率差異計算正確
- [ ] T030 [US3] 在 tests/integration/rate-calculation.test.ts 中添加測試：驗證所有時間基準下的年化報酬計算正確且一致
- [ ] T031 [US3] 在 tests/integration/rate-calculation.test.ts 中添加測試：驗證費率差異隨時間基準成比例變動（spread_8h = spread_1h × 8）
- [ ] T032 [US3] 在 tests/integration/rate-calculation.test.ts 中添加測試：驗證前端 recalculateBestPair 函數與後端計算一致
- [ ] T033 [US3] 運行集成測試 `pnpm test tests/integration/rate-calculation.test.ts` 確保所有測試通過

### Manual Validation for User Story 3

- [ ] T034 [US3] 啟動開發服務器 `pnpm dev` 並導航到市場監控頁面
- [ ] T035 [US3] 手動測試：選擇 1 小時時間基準，記錄某個交易對的費率差異和年化報酬
- [ ] T036 [US3] 手動測試：切換到 4 小時時間基準，驗證費率差異約為 1 小時的 4 倍，年化報酬保持一致
- [ ] T037 [US3] 手動測試：切換到 8 小時時間基準，驗證費率差異約為 1 小時的 8 倍，年化報酬保持一致
- [ ] T038 [US3] 手動測試：切換到 24 小時時間基準，驗證費率差異約為 1 小時的 24 倍，年化報酬保持一致
- [ ] T039 [US3] 檢查瀏覽器控制台和伺服器日誌，確認沒有警告或錯誤

**Checkpoint**: 所有集成測試通過，手動驗證確認修正正確，功能符合預期。

---

## Phase 4: Polish & Documentation

**Purpose**: 完成文檔更新和最終驗證

- [ ] T040 [P] 更新 CHANGELOG.md 記錄此次修正的變更內容
- [ ] T041 [P] 檢查並確認 spec.md 中的所有成功標準都已滿足
- [ ] T042 運行完整測試套件 `pnpm test` 確保所有測試通過
- [ ] T043 運行 linter `pnpm lint` 確保代碼質量
- [ ] T044 運行 TypeScript 類型檢查 `pnpm tsc --noEmit` 確保無類型錯誤
- [ ] T045 [P] 清理開發過程中添加的臨時調試日誌（如有）
- [ ] T046 提交修改 `git add . && git commit -m "fix: correct rate spread and annualized return calculation with dynamic time basis"`

**Checkpoint**: 所有測試通過，代碼質量檢查通過，修改已提交，準備合併到 main。

---

## Dependencies & Execution Order

### Phase Dependencies

- **User Story 1 (Phase 1)**: 可以立即開始 - 修正後端計算邏輯
- **User Story 2 (Phase 2)**: 可以與 Phase 1 並行開始 - 增強函數健壯性（不同文件或不同函數）
  - 後端部分可以與 Phase 1 並行
  - 前端部分獨立進行
- **User Story 3 (Phase 3)**: 依賴 Phase 1 和 Phase 2 完成 - 驗證修正後的計算邏輯
- **Polish (Phase 4)**: 依賴所有用戶故事完成

### Task Dependencies Within Phases

#### Phase 1 (User Story 1) Dependencies:
- T001 → T002 → T003（順序執行：讀取 → 修改 → 驗證）
- T004 可以在 T002 完成後並行開始（創建測試文件）
- T005-T009 依賴 T004（測試文件創建後才能添加測試）
- T010 依賴 T005-T009（運行測試需要所有測試都寫好）

#### Phase 2 (User Story 2) Dependencies:
- **Backend**: T011 → T012 → T013 → T014（順序執行）
- **Backend Tests**: T015-T018 可以並行執行（標記 [P]，測試不同邏輯分支）
- T019 依賴 T015-T018
- **Frontend**: T020 → T021 → T022 → T023（可以與 Backend 並行進行）
- T024 → T025 → T026（前端測試）

#### Phase 3 (User Story 3) Dependencies:
- T027 可以在 Phase 1 和 Phase 2 完成後立即開始
- T028-T032 依賴 T027（測試文件創建後才能添加測試）
- T033 依賴 T028-T032
- T034-T039 手動測試可以與自動化測試並行進行

#### Phase 4 (Polish) Dependencies:
- T040, T041, T045 可以並行執行（標記 [P]）
- T042, T043, T044 可以在修改完成後並行執行
- T046 依賴所有其他任務完成

### Parallel Opportunities

#### Within Phase 1:
```bash
# After T002 完成，可以並行執行：
Task T003: "驗證 timeBasis 參數使用"
Task T004: "創建測試文件"

# T004 完成後，可以並行添加多個測試：
Task T005: "1 小時基準測試"
Task T006: "4 小時基準測試"
Task T007: "8 小時基準測試"
Task T008: "24 小時基準測試"
Task T009: "一致性測試"
```

#### Phase 1 and Phase 2 Parallelization:
```bash
# Phase 1 (後端年化報酬) 和 Phase 2 (getNormalizedRate) 可以同時進行：
# Developer A 或 時間段 1:
Phase 1 Tasks (T001-T010)

# Developer B 或 時間段 2:
Phase 2 Backend Tasks (T011-T019)
Phase 2 Frontend Tasks (T020-T026)
```

#### Within Phase 2:
```bash
# Backend tests 可以並行執行（標記 [P]）:
Task T015: "測試標準化值優先使用"
Task T016: "測試原始週期相等情況"
Task T017: "測試即時計算邏輯"
Task T018: "測試降級警告邏輯"

# Backend 和 Frontend 可以並行：
Backend Enhancement (T011-T019)
Frontend Synchronization (T020-T026)
```

#### Within Phase 4:
```bash
# 並行執行多個檢查任務：
Task T040: "更新 CHANGELOG"
Task T041: "檢查成功標準"
Task T045: "清理調試日誌"

# 並行運行測試和檢查：
Task T042: "運行完整測試"
Task T043: "運行 linter"
Task T044: "TypeScript 類型檢查"
```

---

## Implementation Strategy

### MVP First (Bug Fix Focused)

1. **Phase 1**: 修正後端年化報酬計算（最關鍵）
2. **Phase 2**: 增強函數健壯性（防止未來問題）
3. **Phase 3**: 測試驗證（確保修正正確）
4. **Phase 4**: Polish 和提交

### Incremental Delivery

1. **完成 Phase 1** → 後端計算邏輯已修正 → 運行後端測試驗證
2. **完成 Phase 2** → 函數健壯性增強 → 運行所有單元測試驗證
3. **完成 Phase 3** → 集成測試通過 → 手動驗證功能正確
4. **完成 Phase 4** → 代碼質量檢查通過 → 準備部署

### Parallel Team Strategy

如果有多個開發人員：

1. **Developer A**: Phase 1 (後端年化報酬修正) + Phase 1 測試
2. **Developer B**: Phase 2 Backend (getNormalizedRate 增強) + 後端測試
3. **Developer C**: Phase 2 Frontend (getNormalizedRate 同步) + 前端測試
4. **合併後**: 一起執行 Phase 3 (集成測試) 和 Phase 4 (Polish)

---

## Success Criteria Verification

根據 spec.md 中定義的成功標準，以下任務對應各個標準：

- **SC-001** (費率差異在 100ms 內更新):
  - 驗證：T036-T038 手動測試切換時間基準

- **SC-002** (所有時間基準下年化報酬一致):
  - 驗證：T009, T030 單元測試和集成測試

- **SC-003** (費率差異計算公式正確):
  - 驗證：T005-T008, T031 測試費率差異計算

- **SC-004** (年化報酬計算公式正確):
  - 驗證：T005-T009 測試年化報酬計算

- **SC-005** (測試覆蓋率達到 90%):
  - 驗證：T042 運行完整測試套件時檢查覆蓋率

- **SC-006** (費率差異數值關係符合比例):
  - 驗證：T031, T036-T038 測試比例關係

- **SC-007** (標準化數據缺失時不崩潰):
  - 驗證：T017-T018, T025 測試降級邏輯

---

## Notes

- 此為 bug 修復任務，無需 Setup 或 Foundational phase
- 主要修改集中在 2 個文件的計算邏輯
- 測試是必需的，確保修正的正確性
- Phase 1 和 Phase 2 可以部分並行執行
- Phase 3 必須在 Phase 1 和 Phase 2 完成後執行
- 每個 checkpoint 都應該驗證功能正確性
- 提交訊息應該清楚說明修正內容
- 合併前確保所有測試通過且代碼質量檢查通過
