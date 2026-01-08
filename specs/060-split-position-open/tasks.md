# Tasks: 分單開倉（獨立持倉）

**Input**: Design documents from `/specs/060-split-position-open/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included based on plan.md TDD discipline requirement (Principle VII)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- **Frontend**: `app/(dashboard)/market-monitor/` - 開倉相關組件和 Hooks
- **Tests**: `tests/unit/hooks/` - 單元測試

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 建立數量分配核心函式和測試

- [x] T001 [P] Create `splitQuantity` utility function in `src/lib/split-quantity.ts`
- [x] T002 [P] Create unit tests for splitQuantity in `tests/unit/lib/splitQuantity.test.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 擴展 `useOpenPosition` Hook 狀態和介面

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Add `currentGroup` and `totalGroups` state to `app/(dashboard)/market-monitor/hooks/useOpenPosition.ts`
- [x] T004 Add `executeSplitOpen` method signature to useOpenPosition return type in `app/(dashboard)/market-monitor/hooks/useOpenPosition.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - 分單開倉減少滑價 (Priority: P1) 🎯 MVP

**Goal**: 用戶可在開倉對話框指定組數，系統串行建立多個獨立持倉

**Independent Test**: 開倉對話框指定 2 組，系統依序建立 2 個獨立持倉，各 300 數量

### Tests for User Story 1 ⚠️

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T005 [P] [US1] Unit test for splitQuantity even division in `tests/unit/lib/splitQuantity.test.ts` - verify 600/2 = [300, 300]
- [x] T006 [P] [US1] Unit test for splitQuantity uneven division in `tests/unit/lib/splitQuantity.test.ts` - verify 100/3 = [34, 33, 33]
- [x] T007 [P] [US1] Unit test for splitQuantity edge case count=1 in `tests/unit/lib/splitQuantity.test.ts` - verify returns [original]

### Implementation for User Story 1

- [x] T008 [US1] Implement `splitQuantity` logic in `src/lib/split-quantity.ts` - large group first algorithm
- [x] T009 [US1] Implement `executeSplitOpen` method in `app/(dashboard)/market-monitor/hooks/useOpenPosition.ts` - serial execution loop
- [x] T010 [US1] Add `positionCount` state (default 1, range 1-10) to `app/(dashboard)/market-monitor/components/OpenPositionDialog.tsx`
- [x] T011 [US1] Add position count input field (Radix NumberInput or Slider) to `app/(dashboard)/market-monitor/components/OpenPositionDialog.tsx`
- [x] T012 [US1] Add `quantityPerGroup` computed display to `app/(dashboard)/market-monitor/components/OpenPositionDialog.tsx`
- [x] T013 [US1] Update confirm button handler to call `executeSplitOpen` with positionCount in `app/(dashboard)/market-monitor/components/OpenPositionDialog.tsx`
- [x] T014 [US1] Add progress text display "正在建立第 N/M 組持倉..." to loading overlay in `app/(dashboard)/market-monitor/components/OpenPositionDialog.tsx`

**Checkpoint**: User Story 1 should be fully functional - user can split open positions

---

## Phase 4: User Story 2 - 分組持倉獨立管理 (Priority: P2)

**Goal**: 每組持倉在持倉列表獨立顯示，可單獨設定停損停利或平倉

**Independent Test**: 建立 3 組分單持倉後，持倉列表顯示 3 個獨立持倉，各可獨立操作

### Implementation for User Story 2

**Note**: 此 User Story 基於現有架構已自動滿足。每次調用 `/api/positions/open` 都會建立獨立的 Position 記錄，現有的持倉列表和操作功能已支援獨立管理。只需驗證行為正確即可。

- [x] T015 [US2] Manual verification: Confirm each split position appears independently in positions list page
- [x] T016 [US2] Manual verification: Confirm each split position can be individually closed via existing close function
- [x] T017 [US2] Manual verification: Confirm each split position can have individual stop-loss/take-profit modified

**Checkpoint**: User Story 2 verified - each position is independently manageable

---

## Phase 5: User Story 3 - 分單開倉錯誤處理 (Priority: P3)

**Goal**: 某組失敗時停止後續開倉，清楚告知用戶並保留已成功持倉

**Independent Test**: 模擬第 2 組開倉失敗，顯示「已完成 1/3 組，第 2 組失敗：餘額不足」

### Tests for User Story 3 ⚠️

- [x] T018 [P] [US3] Unit test for error handling in executeSplitOpen - verify loop stops on first error

### Implementation for User Story 3

- [x] T019 [US3] Add error state tracking (`completedCount`, `failedAt`) to `app/(dashboard)/market-monitor/hooks/useOpenPosition.ts`
- [x] T020 [US3] Update error message format to include progress info "已完成 N/M 組，第 X 組失敗：{error}" in `app/(dashboard)/market-monitor/hooks/useOpenPosition.ts`
- [x] T021 [US3] Add validation for minimum quantity per group in `app/(dashboard)/market-monitor/components/OpenPositionDialog.tsx`
- [x] T022 [US3] Display validation error when `quantityPerGroup < MIN_QUANTITY` in `app/(dashboard)/market-monitor/components/OpenPositionDialog.tsx`

**Checkpoint**: User Story 3 complete - errors are handled gracefully

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 確保功能完整性和代碼品質

- [x] T023 [P] Run all unit tests and ensure 100% pass rate: `pnpm test --run`
- [x] T024 [P] Run linter and fix any issues: `pnpm lint`
- [ ] T025 Run quickstart.md validation - execute all 5 test scenarios manually
- [x] T026 Update CLAUDE.md with Feature 060 documentation (key paths, hooks, components)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (splitQuantity function) - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Phase 2 - core split open functionality
- **User Story 2 (Phase 4)**: Depends on Phase 3 (needs positions created) - verification only
- **User Story 3 (Phase 5)**: Can start after Phase 2, but recommended after Phase 3
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Core functionality - NO dependencies on other stories
- **User Story 2 (P2)**: Verification only - depends on US1 to have positions to verify
- **User Story 3 (P3)**: Error handling - can be developed in parallel with US2

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Utility functions before hook modifications
- Hook modifications before component modifications
- Core implementation before validation/error handling

### Parallel Opportunities

**Phase 1**:
```
T001 (splitQuantity function) || T002 (test file setup)
```

**Phase 3 Tests**:
```
T005 (even division test) || T006 (uneven test) || T007 (edge case test)
```

**Phase 5 + Phase 4**:
```
US2 verification tasks can run in parallel with US3 implementation
```

**Phase 6**:
```
T023 (tests) || T024 (lint)
```

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Unit test for splitQuantity even division in tests/unit/lib/splitQuantity.test.ts"
Task: "Unit test for splitQuantity uneven division in tests/unit/lib/splitQuantity.test.ts"
Task: "Unit test for splitQuantity edge case count=1 in tests/unit/lib/splitQuantity.test.ts"

# After tests pass, frontend tasks are sequential (same files):
T008 → T009 → T010 → T011 → T012 → T013 → T014
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 2: Foundational (T003-T004)
3. Complete Phase 3: User Story 1 (T005-T014)
4. **STOP and VALIDATE**: Test User Story 1 independently via quickstart.md Test 1 & 4
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test with basic split open → **MVP Deliverable**
3. Add User Story 2 → Verify independent management → Enhanced value
4. Add User Story 3 → Complete error handling → Production ready
5. Polish → Full test coverage and documentation

### Single Developer Strategy

Recommended execution order:
```
T001 → T002 → T003 → T004 → T005/T006/T007 → T008 → T009 → T010 → T011 → T012 → T013 → T014 → T015/T016/T017 → T018 → T019 → T020 → T021 → T022 → T023/T024 → T025 → T026
```

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing (TDD discipline per Constitution Principle VII)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- **Key insight**: This feature is frontend-only, no backend modifications required
- **MIN_QUANTITY**: Use existing constant from codebase (likely in types or config)
