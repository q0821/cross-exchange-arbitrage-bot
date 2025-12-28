# Tasks: BalanceValidator 單元測試覆蓋

**Input**: Design documents from `/specs/047-balance-validator-tests/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup ✅

**Purpose**: 建立測試檔案基本結構

- [x] T001 Create test file with mock setup in tests/unit/services/BalanceValidator.test.ts
- [x] T002 Setup vi.mock for logger in tests/unit/services/BalanceValidator.test.ts
- [x] T003 Setup vi.mock for UserConnectorFactory in tests/unit/services/BalanceValidator.test.ts
- [x] T004 Import BalanceValidator and error classes in tests/unit/services/BalanceValidator.test.ts
- [x] T005 Setup beforeEach/afterEach with vi.clearAllMocks in tests/unit/services/BalanceValidator.test.ts

**Checkpoint**: ✅ 測試檔案基礎結構完成，可執行空測試

---

## Phase 2: User Story 1 - 保證金計算邏輯測試 (Priority: P1) 🎯 MVP ✅

**Goal**: 驗證 `calculateRequiredMargin` 方法計算正確性

**Independent Test**: 執行 `pnpm test BalanceValidator -- --grep "calculateRequiredMargin"`

### Implementation for User Story 1

- [x] T006 [US1] Add describe block for calculateRequiredMargin in tests/unit/services/BalanceValidator.test.ts
- [x] T007 [US1] Test: should calculate margin with 10% buffer (1 BTC * 50000 / 10 * 1.1 = 5500) in tests/unit/services/BalanceValidator.test.ts
- [x] T008 [US1] Test: should calculate margin for ETH (0.5 * 2000 / 5 * 1.1 = 220) in tests/unit/services/BalanceValidator.test.ts
- [x] T009 [US1] Test: should handle high precision decimals (0.001 * 100000) in tests/unit/services/BalanceValidator.test.ts
- [x] T010 [US1] Test: should handle leverage 1x (margin equals position value * 1.1) in tests/unit/services/BalanceValidator.test.ts
- [x] T011 [US1] Test: should handle leverage 2x in tests/unit/services/BalanceValidator.test.ts

**Checkpoint**: ✅ calculateRequiredMargin 測試通過，覆蓋基本計算邏輯

---

## Phase 3: User Story 2 - 餘額查詢功能測試 (Priority: P1) ✅

**Goal**: 驗證 `getBalances` 方法處理各種 API 狀態

**Independent Test**: 執行 `pnpm test BalanceValidator -- --grep "getBalances"`

### Implementation for User Story 2

- [x] T012 [US2] Add describe block for getBalances in tests/unit/services/BalanceValidator.test.ts
- [x] T013 [US2] Test: should return balances for valid API keys in tests/unit/services/BalanceValidator.test.ts
- [x] T014 [US2] Test: should throw ApiKeyNotFoundError when status is no_api_key in tests/unit/services/BalanceValidator.test.ts
- [x] T015 [US2] Test: should throw ExchangeApiError when status is api_error in tests/unit/services/BalanceValidator.test.ts
- [x] T016 [US2] Test: should throw ExchangeApiError with rate_limited flag when status is rate_limited in tests/unit/services/BalanceValidator.test.ts
- [x] T017 [US2] Test: should set balance to 0 when exchange result is missing in tests/unit/services/BalanceValidator.test.ts

**Checkpoint**: ✅ getBalances 測試通過，覆蓋所有 API 狀態處理

---

## Phase 4: User Story 3 - 餘額充足性驗證測試 (Priority: P1) ✅

**Goal**: 驗證 `validateBalance` 方法正確判斷餘額充足性

**Independent Test**: 執行 `pnpm test BalanceValidator -- --grep "validateBalance"`

### Implementation for User Story 3

- [x] T018 [US3] Add describe block for validateBalance in tests/unit/services/BalanceValidator.test.ts
- [x] T019 [US3] Test: should return isValid=true when both exchanges have sufficient balance in tests/unit/services/BalanceValidator.test.ts
- [x] T020 [US3] Test: should throw InsufficientBalanceError for long exchange when balance insufficient in tests/unit/services/BalanceValidator.test.ts
- [x] T021 [US3] Test: should throw InsufficientBalanceError for short exchange when balance insufficient in tests/unit/services/BalanceValidator.test.ts
- [x] T022 [US3] Test: should check long exchange first when both insufficient in tests/unit/services/BalanceValidator.test.ts
- [x] T023 [US3] Test: should fail when balance equals required margin without buffer in tests/unit/services/BalanceValidator.test.ts
- [x] T024 [US3] Test: should include correct values in validation result in tests/unit/services/BalanceValidator.test.ts

**Checkpoint**: ✅ validateBalance 測試通過，覆蓋通過和失敗場景

---

## Phase 5: User Story 4 - 快速檢查功能測試 (Priority: P2) ✅

**Goal**: 驗證 `checkBalance` 方法正確處理錯誤轉換

**Independent Test**: 執行 `pnpm test BalanceValidator -- --grep "checkBalance"`

### Implementation for User Story 4

- [x] T025 [US4] Add describe block for checkBalance in tests/unit/services/BalanceValidator.test.ts
- [x] T026 [US4] Test: should return isValid=true when balance is sufficient in tests/unit/services/BalanceValidator.test.ts
- [x] T027 [US4] Test: should return isValid=false with insufficientExchange and insufficientAmount when balance insufficient in tests/unit/services/BalanceValidator.test.ts
- [x] T028 [US4] Test: should re-throw ApiKeyNotFoundError (not convert to validation result) in tests/unit/services/BalanceValidator.test.ts
- [x] T029 [US4] Test: should re-throw ExchangeApiError (not convert to validation result) in tests/unit/services/BalanceValidator.test.ts

**Checkpoint**: ✅ checkBalance 測試通過，覆蓋錯誤轉換邏輯

---

## Phase 6: User Story 5 - 邊界條件與錯誤處理測試 (Priority: P2) ✅

**Goal**: 驗證系統在邊界條件下的穩健性

**Independent Test**: 執行 `pnpm test BalanceValidator -- --grep "edge cases"`

### Implementation for User Story 5

- [x] T030 [US5] Add describe block for edge cases in tests/unit/services/BalanceValidator.test.ts
- [x] T031 [US5] Test: should return 0 margin when quantity is 0 in tests/unit/services/BalanceValidator.test.ts
- [x] T032 [US5] Test: should return 0 margin when price is 0 in tests/unit/services/BalanceValidator.test.ts
- [x] T033 [US5] Test: should handle same exchange for long and short in tests/unit/services/BalanceValidator.test.ts
- [x] T034 [US5] Test: should maintain precision for high decimal values in tests/unit/services/BalanceValidator.test.ts
- [x] T035 [US5] Test: should handle null/undefined balanceUSD gracefully in tests/unit/services/BalanceValidator.test.ts

**Checkpoint**: ✅ 邊界條件測試通過，系統穩健性驗證完成

---

## Phase 7: Polish & Validation ✅

**Purpose**: 驗證測試覆蓋率並確保測試品質

- [x] T036 Run all BalanceValidator tests with `pnpm test BalanceValidator --run`
- [x] T037 Run coverage report with `pnpm test:coverage -- --grep BalanceValidator`
- [x] T038 Verify coverage meets 90% threshold for BalanceValidator.ts
- [x] T039 Fix any failing tests or coverage gaps identified
- [x] T040 Run quickstart.md validation scenarios

**Checkpoint**: ✅ 所有測試通過，覆蓋率達標

---

## Completion Summary

**Date**: 2025-12-28
**Status**: ✅ All tasks completed

### Test Results
- **Total Tests**: 30
- **Passed**: 30
- **Failed**: 0
- **Coverage**: 100% lines, 90.47% branches

### Files Created
- `tests/unit/services/BalanceValidator.test.ts` (610 lines)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **User Stories (Phase 2-6)**: All depend on Setup (Phase 1) completion
  - User Stories can proceed sequentially (recommended for single file)
  - Tests within each user story should be written in order
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Setup - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Setup - No dependencies on other stories
- **User Story 3 (P1)**: Can start after Setup - Uses calculateRequiredMargin internally but tests independently
- **User Story 4 (P2)**: Can start after Setup - Wraps validateBalance but tests independently
- **User Story 5 (P2)**: Can start after Setup - Tests edge cases across all methods

### Within Each User Story

- Create describe block first
- Add tests in logical order (normal → edge → error cases)
- Run tests after each addition to verify

### Parallel Opportunities

由於所有任務在同一個測試檔案中，並行機會有限：

- T002, T003 可並行（不同 mock 設定）
- 同一 User Story 內的測試案例需按順序撰寫（同一 describe block）

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: User Story 1 (calculateRequiredMargin tests)
3. **STOP and VALIDATE**: `pnpm test BalanceValidator --run`
4. Core calculation logic verified

### Incremental Delivery

1. Setup → Foundation ready
2. Add US1 → calculateRequiredMargin tested
3. Add US2 → getBalances tested
4. Add US3 → validateBalance tested
5. Add US4 → checkBalance tested
6. Add US5 → Edge cases tested
7. Polish → Coverage verified

---

## Notes

- 所有任務在單一測試檔案 `tests/unit/services/BalanceValidator.test.ts`
- 使用 Vitest 的 `vi.mock`、`vi.fn`、`vi.clearAllMocks`
- 使用 `Decimal.js` 處理精度
- 測試後立即運行驗證：`pnpm test BalanceValidator --run`
- 目標覆蓋率：90%+
