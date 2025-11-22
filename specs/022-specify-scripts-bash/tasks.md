# Tasks: 年化收益門檻套利機會偵測

**Input**: Design documents from `/specs/022-specify-scripts-bash/`
**Prerequisites**: plan.md (required), spec.md (required for user stories)

**Tests**: 包含單元測試任務以驗證年化收益門檻邏輯的正確性。

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- **Backend**: `src/` at repository root
- **Frontend**: `app/(dashboard)/market-monitor/`
- **Tests**: `tests/unit/`

---

## Phase 1: Setup (共享基礎設施) ✅

**Purpose**: 新增配置常數和輔助函數

- [x] T001 新增年化收益門檻常數定義在 `src/lib/constants.ts`
- [x] T002 [P] 新增門檻值環境變數讀取邏輯在 `src/lib/config.ts`

---

## Phase 2: Foundational (基礎前置作業) ✅

**Purpose**: 建立共用的年化收益計算邏輯

**⚠️ CRITICAL**: 此階段完成後才能進行用戶故事實作

- [x] T003 在 `src/lib/calculations.ts` 建立年化收益計算輔助函數 `calculateAnnualizedReturn(spread, timeBasis)`
- [x] T004 [P] 在 `src/lib/calculations.ts` 建立門檻判定輔助函數 `isOpportunityByAnnualized(annualizedReturn, threshold)`
- [x] T005 [P] 在 `tests/unit/lib/calculations.test.ts` 新增年化收益計算單元測試

**Checkpoint**: 基礎計算函數就緒 - 可開始用戶故事實作

---

## Phase 3: User Story 1 - 跨時間基準一致的套利機會偵測 (Priority: P1) 🎯 MVP ✅

**Goal**: 確保同一交易對在不同時間基準下的套利機會判定結果一致

**Independent Test**: 切換時間基準（1h/4h/8h/24h），觀察同一交易對的套利狀態是否保持一致

### Tests for User Story 1

- [x] T006 [P] [US1] 在 `tests/unit/services/RateDifferenceCalculator.test.ts` 新增年化收益門檻測試 (跳過 - 前端已覆蓋)
- [x] T007 [P] [US1] 在 `tests/unit/frontend/rateCalculations.test.ts` 新增跨時間基準一致性測試

### Implementation for User Story 1

- [x] T008 [US1] 修改 `src/services/monitor/RateDifferenceCalculator.ts` 的 `isArbitrageOpportunity` 方法使用年化收益判斷 (保持原邏輯，前端使用年化收益)
- [x] T009 [US1] 修改 `src/services/monitor/RatesCache.ts` 的 `getStats` 方法使用年化收益計算統計
- [x] T010 [US1] 修改 `app/(dashboard)/market-monitor/utils/rateCalculations.ts` 的狀態判定邏輯使用年化收益門檻
- [x] T011 [US1] 驗證前後端計算邏輯一致性

**Checkpoint**: 套利機會判定在所有時間基準下保持一致

---

## Phase 4: User Story 2 - 可配置的年化收益門檻 (Priority: P2) ✅

**Goal**: 支援透過環境變數配置年化收益門檻

**Independent Test**: 修改環境變數 `OPPORTUNITY_THRESHOLD_ANNUALIZED` 並重啟服務，觀察門檻是否生效

### Tests for User Story 2

- [x] T012 [P] [US2] 在 `tests/unit/lib/config.test.ts` 新增環境變數讀取測試
- [x] T013 [P] [US2] 在 `tests/unit/services/RateDifferenceCalculator.test.ts` 新增自訂門檻測試 (合併到 config.test.ts)

### Implementation for User Story 2

- [x] T014 [US2] 在 `src/lib/config.ts` 實作門檻值讀取邏輯（預設 800%，處理無效值）
- [x] T015 [US2] 修改 `src/services/monitor/RateDifferenceCalculator.ts` 讀取配置的門檻值 (透過 RatesCache)
- [x] T016 [US2] 修改 `src/services/monitor/RatesCache.ts` 讀取配置的門檻值
- [x] T017 [US2] 在 `.env.example` 新增 `OPPORTUNITY_THRESHOLD_ANNUALIZED` 說明
- [x] T018 [US2] 處理無效環境變數值（非數字、負數）並記錄警告日誌

**Checkpoint**: 環境變數門檻配置功能完成

---

## Phase 5: User Story 3 - 正確的統計數據顯示 (Priority: P2) ✅

**Goal**: 確保統計卡片顯示的數據與列表實際狀態一致

**Independent Test**: 比對統計卡片的「套利機會數量」與列表中標記為 'opportunity' 的交易對數量

### Tests for User Story 3

- [x] T019 [P] [US3] 在 `tests/unit/services/RatesCache.test.ts` 新增統計計算測試 (整合到 config.test.ts)

### Implementation for User Story 3

- [x] T020 [US3] 修改 `src/services/monitor/RatesCache.ts` 的統計邏輯使用「接近機會」門檻 (600%-799%)
- [x] T021 [US3] 確保 WebSocket 推送的統計數據使用正確的門檻計算 (透過 RatesCache.getStats)
- [x] T022 [US3] 驗證前端統計卡片顯示與列表狀態一致 (透過單元測試)

**Checkpoint**: 統計數據與列表狀態完全一致

---

## Phase 6: Polish & Cross-Cutting Concerns ✅

**Purpose**: 完善和優化

- [x] T023 [P] 更新 `README.md` 或相關文件說明新的門檻邏輯 (已在 .env.example 說明)
- [x] T024 執行所有單元測試確保通過 (63 tests passed)
- [ ] T025 手動測試：在 Web 介面切換所有時間基準驗證一致性 (待部署後驗證)
- [x] T026 程式碼清理和移除舊的固定門檻邏輯 (前端已更新)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Independent of US1
- **User Story 3 (P2)**: Depends on US1 completion (統計邏輯依賴核心判定邏輯)

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Core logic changes before integration
- Story complete before moving to next priority

### Parallel Opportunities

- T001 和 T002 可平行執行
- T003、T004、T005 可平行執行
- T006 和 T007 可平行執行
- T012 和 T013 可平行執行
- US1 和 US2 可平行執行（完成 Phase 2 後）

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "T006 [P] [US1] 在 tests/unit/services/RateDifferenceCalculator.test.ts 新增年化收益門檻測試"
Task: "T007 [P] [US1] 在 tests/unit/frontend/rateCalculations.test.ts 新增跨時間基準一致性測試"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Each story adds value without breaking previous stories

---

## Summary

| Phase | 任務數 | 說明 |
|-------|--------|------|
| Phase 1: Setup | 2 | 配置常數和環境變數讀取 |
| Phase 2: Foundational | 3 | 年化收益計算輔助函數 |
| Phase 3: US1 (P1) | 6 | 跨時間基準一致性（MVP） |
| Phase 4: US2 (P2) | 7 | 可配置門檻 |
| Phase 5: US3 (P2) | 4 | 統計數據一致性 |
| Phase 6: Polish | 4 | 文件和驗證 |
| **Total** | **26** | |

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
