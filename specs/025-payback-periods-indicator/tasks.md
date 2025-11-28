# Tasks: 價差回本週期指標

**Input**: Design documents from `/specs/025-payback-periods-indicator/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Unit tests are explicitly requested in the specification (see FR-014, Success Criteria SC-006, SC-007).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

---

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- **Web app**: All frontend code in `app/(dashboard)/market-monitor/`
- **Tests**: `tests/unit/market-monitor/` for unit tests
- **Types**: New types in `app/(dashboard)/market-monitor/types/payback.ts` or existing `types.ts`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Type definitions and project structure preparation

- [X] T001 Create TypeScript type definitions file at `app/(dashboard)/market-monitor/types/payback.ts` with `PaybackResult` interface per data-model.md specification
- [X] T002 [P] Verify Radix UI Tooltip dependency version (^1.2.8) in package.json matches plan.md requirements

**Checkpoint**: Type definitions ready for implementation

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core calculation function that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Implement `calculatePaybackPeriods()` function in `app/(dashboard)/market-monitor/utils/rateCalculations.ts` per contracts/payback-calculation.md specification
- [X] T004 Add edge case handling for null values, zero spread, and extreme values in `calculatePaybackPeriods()` function
- [X] T005 Add formula formatting helper function `formatPaybackFormula()` in `app/(dashboard)/market-monitor/utils/rateCalculations.ts` for Tooltip display

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - 價差不利時顯示回本次數 (Priority: P1) 🎯 MVP

**Goal**: 當價差不利時（做多價 > 做空價），在市場監控表格的價差欄位下方顯示「⚠️ 需 X.X 次資費回本」

**Independent Test**:
1. 啟動開發伺服器 (`pnpm dev`)
2. 開啟瀏覽器訪問 `/market-monitor`
3. 找到一個價差為負值的交易對（或用測試數據模擬：priceDiffPercent = -0.15, spreadPercent = 0.05）
4. 驗證在價差欄位下方顯示「⚠️ 需 3.0 次資費回本」（橙色文字）
5. 驗證回本次數計算正確：|價差| ÷ 費率差 = 0.15 ÷ 0.05 = 3.0

### Tests for User Story 1

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T006 [P] [US1] Create unit test file `tests/unit/market-monitor/calculatePaybackPeriods.test.ts` with test case for payback_needed status (priceDiffPercent = -0.15, spreadPercent = 0.05)
- [X] T007 [P] [US1] Add unit test case for periods calculation precision (verify toFixed(1) behavior) in `tests/unit/market-monitor/calculatePaybackPeriods.test.ts`
- [X] T008 [P] [US1] Add unit test case for too_many status (回本次數 > 100) in `tests/unit/market-monitor/calculatePaybackPeriods.test.ts`

### Implementation for User Story 1

- [X] T009 [US1] Modify `RateRow.tsx` component at `app/(dashboard)/market-monitor/components/RateRow.tsx` to call `calculatePaybackPeriods()` with pair.priceDiffPercent, pair.spreadPercent, and timeBasis
- [X] T010 [US1] Add conditional rendering in `RateRow.tsx` price difference cell to display payback indicator below priceDiffPercent when status is 'payback_needed' or 'too_many'
- [X] T011 [US1] Apply color coding in `RateRow.tsx` using Tailwind classes: `text-orange-500` for payback_needed, `text-red-500` for too_many
- [X] T012 [US1] Add displayText rendering with proper Unicode characters (⚠️ for payback_needed, ❌ for too_many) in `RateRow.tsx`

**Checkpoint**: At this point, User Story 1 should be fully functional - price difference unfavorable scenarios show payback periods

---

## Phase 4: User Story 2 - 價差有利時顯示正面指標 (Priority: P1) 🎯 MVP

**Goal**: 當價差有利時（做空價 > 做多價），在價差欄位下方顯示「✓ 價差有利」（綠色文字）

**Independent Test**:
1. 開啟瀏覽器訪問 `/market-monitor`
2. 找到一個價差為正值的交易對（或用測試數據模擬：priceDiffPercent = 0.15）
3. 驗證在價差欄位下方顯示「✓ 價差有利」（綠色文字）
4. 驗證價差為 0 時也顯示「✓ 價差有利」（中性情況視為有利）

### Tests for User Story 2

- [X] T013 [P] [US2] Add unit test case for favorable status (priceDiffPercent >= 0) in `tests/unit/market-monitor/calculatePaybackPeriods.test.ts`
- [X] T014 [P] [US2] Add unit test case for zero price difference (priceDiffPercent = 0) returning favorable status in `tests/unit/market-monitor/calculatePaybackPeriods.test.ts`

### Implementation for User Story 2

- [X] T015 [US2] Extend conditional rendering in `RateRow.tsx` to display payback indicator when status is 'favorable'
- [X] T016 [US2] Apply green color coding in `RateRow.tsx` using Tailwind class `text-green-500` for favorable status
- [X] T017 [US2] Add displayText rendering with check mark Unicode character (✓) for favorable status in `RateRow.tsx`

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - both favorable and unfavorable price differences display correctly

---

## Phase 5: User Story 3 - 提供詳細的回本資訊工具提示 (Priority: P2)

**Goal**: 當用戶將滑鼠移到回本次數指標上時，顯示 Tooltip 包含：當前價差、費率差異、回本次數、預估回本時間

**Independent Test**:
1. 開啟瀏覽器訪問 `/market-monitor`
2. 將滑鼠移到任一回本指標上（「⚠️ 需 3.0 次資費回本」或「✓ 價差有利」）
3. 驗證 Tooltip 在 0.5 秒內顯示
4. 驗證 Tooltip 包含：當前價差、費率差、計算公式、預估時間
5. 切換時間基準（1h/4h/8h）後，驗證 Tooltip 中的預估時間自動更新

### Tests for User Story 3

- [X] T018 [P] [US3] Add unit test case for estimatedHours calculation (periods × timeBasis) in `tests/unit/market-monitor/calculatePaybackPeriods.test.ts`
- [X] T019 [P] [US3] Add unit test case for details object generation (priceDiff, rateSpread, formula) in `tests/unit/market-monitor/calculatePaybackPeriods.test.ts`

### Implementation for User Story 3

- [X] T020 [P] [US3] Create `PaybackTooltip.tsx` component at `app/(dashboard)/market-monitor/components/PaybackTooltip.tsx` using Radix UI Tooltip primitives (TooltipProvider, Tooltip, TooltipTrigger, TooltipContent)
- [X] T021 [US3] Implement Tooltip content layout in `PaybackTooltip.tsx` displaying priceDiff, rateSpread, formula, and estimatedHours from PaybackResult.details
- [X] T022 [US3] Add time formatting logic in `PaybackTooltip.tsx` to display hours as "約 X.X 小時" when < 24h, or "約 X.X 天" when >= 24h
- [X] T023 [US3] Add disclaimer warning text in Tooltip for too_many status: "⚠️ 注意：回本次數過多，費率可能在持倉期間波動，風險較高"
- [X] T024 [US3] Wrap payback indicator displayText in `RateRow.tsx` with `PaybackTooltip` component, passing PaybackResult as prop
- [X] T025 [US3] Add general disclaimer in Tooltip footer: "⚠️ 注意：回本次數基於當前費率差計算，實際費率可能波動。此指標僅供參考，不構成投資建議。"

**Checkpoint**: All payback indicators now have detailed Tooltip information on hover

---

## Phase 6: User Story 4 - 在複製訊息中包含回本資訊 (Priority: P2)

**Goal**: 當用戶點擊複製按鈕時，複製的訊息包含價差回本資訊（例如：「⏱️ 價差回本：需收取 3.0 次資費（約 24 小時）」）

**Independent Test**:
1. 開啟瀏覽器訪問 `/market-monitor`
2. 點擊任一交易對的複製按鈕
3. 檢查剪貼簿內容（貼到文字編輯器）
4. 驗證訊息包含價差回本資訊行
5. 驗證不同狀態的訊息格式：favorable, payback_needed, too_many

### Tests for User Story 4

- [X] T026 [P] [US4] Create unit test file `tests/unit/market-monitor/formatArbitrageMessage.test.ts` (if not exists) or extend existing tests
- [X] T027 [P] [US4] Add test case for formatArbitrageMessage with payback_needed status including payback info in output in `tests/unit/market-monitor/formatArbitrageMessage.test.ts`
- [X] T028 [P] [US4] Add test case for formatArbitrageMessage with favorable status including "價差有利" message in `tests/unit/market-monitor/formatArbitrageMessage.test.ts`
- [X] T029 [P] [US4] Add test case for formatArbitrageMessage with too_many status including warning message in `tests/unit/market-monitor/formatArbitrageMessage.test.ts`

### Implementation for User Story 4

- [X] T030 [US4] Read existing `formatArbitrageMessage()` function in `app/(dashboard)/market-monitor/utils/formatArbitrageMessage.ts` to understand current message structure
- [X] T031 [US4] Modify `formatArbitrageMessage()` function to accept PaybackResult parameter (from calculatePaybackPeriods call)
- [X] T032 [US4] Add conditional logic in `formatArbitrageMessage()` to append payback info line based on PaybackResult.status
- [X] T033 [US4] Format payback_needed message as: "⏱️ 價差回本：需收取 X.X 次資費（約 Y 小時）"
- [X] T034 [US4] Format favorable message as: "✓ 價差有利：建倉即有正報酬"
- [X] T035 [US4] Format too_many or impossible message as: "❌ 價差回本：回本次數過多，不建議建倉"
- [X] T036 [US4] Update `RateRow.tsx` copy button handler to pass PaybackResult to formatArbitrageMessage function

**Checkpoint**: Copy functionality now includes payback information in all scenarios

---

## Phase 7: User Story 5 - 處理無價格數據的情況 (Priority: P3)

**Goal**: 當某些交易對暫時沒有價格數據時，系統優雅地處理，顯示「N/A（無價格數據）」

**Independent Test**:
1. 模擬無價格數據情況（設定 priceDiffPercent = null）
2. 驗證顯示「N/A（無價格數據）」（灰色文字）
3. 模擬數據恢復（priceDiffPercent 從 null 變為有效值）
4. 驗證回本指標即時更新為正確計算結果

### Tests for User Story 5

- [X] T037 [P] [US5] Add unit test case for no_data status (priceDiffPercent = null) in `tests/unit/market-monitor/calculatePaybackPeriods.test.ts`
- [X] T038 [P] [US5] Add unit test case for impossible status (spreadPercent = 0) in `tests/unit/market-monitor/calculatePaybackPeriods.test.ts`
- [X] T039 [P] [US5] Add unit test case for NaN input handling (priceDiffPercent = NaN) in `tests/unit/market-monitor/calculatePaybackPeriods.test.ts`

### Implementation for User Story 5

- [X] T040 [US5] Extend conditional rendering in `RateRow.tsx` to display payback indicator when status is 'no_data' or 'impossible'
- [X] T041 [US5] Apply gray color coding in `RateRow.tsx` using Tailwind class `text-gray-400` for no_data status
- [X] T042 [US5] Apply red color coding in `RateRow.tsx` using Tailwind class `text-red-500` for impossible status
- [X] T043 [US5] Add displayText rendering for no_data and impossible statuses in `RateRow.tsx`
- [X] T044 [US5] Verify WebSocket data update handling in `RateRow.tsx` - ensure component re-renders when priceDiffPercent changes from null to valid value

**Checkpoint**: All edge cases handled gracefully - null data, zero spread, NaN values

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Optimizations, documentation, and final validation

- [X] T045 [P] Apply React.memo optimization to `RateRow` component in `app/(dashboard)/market-monitor/components/RateRow.tsx` to prevent unnecessary re-renders
- [X] T046 [P] Add React.memo comparison function to only re-render when priceDiffPercent, spreadPercent, or timeBasis change
- [X] T047 [P] Verify all unit tests pass with 100% coverage for calculatePaybackPeriods function: `pnpm test calculatePaybackPeriods`
- [X] T048 [P] Verify all unit tests pass for formatArbitrageMessage extensions: `pnpm test formatArbitrageMessage`
- [X] T049 Run manual validation tests from quickstart.md Test Cases section (5 test scenarios)
- [X] T050 [P] Update deployment documentation in `docs/deployment/README.md` if needed (likely no changes required as pure frontend feature)
- [X] T051 [P] Run linter and fix any issues: `pnpm lint`
- [X] T052 Verify performance with 200+ trading pairs loaded (check < 100ms render time per success criteria SC-008)

**Checkpoint**: Feature complete, tested, optimized, and documented

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion (T001-T002) - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion (T003-T005)
  - User stories CAN proceed in parallel if desired (independent files)
  - OR sequentially in priority order: US1 → US2 → US3 → US4 → US5
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (T003-T005) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (T003-T005) - Extends same RateRow.tsx as US1 but different conditional branch
- **User Story 3 (P2)**: Can start after Foundational (T003-T005) - Creates new PaybackTooltip component, wraps US1/US2 output
- **User Story 4 (P2)**: Can start after Foundational (T003-T005) - Modifies different file (formatArbitrageMessage.ts), no conflict
- **User Story 5 (P3)**: Can start after Foundational (T003-T005) - Extends same RateRow.tsx as US1/US2 but different conditional branch

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Core calculation logic (T003-T005) before any UI work
- Component modifications can proceed after calculation function exists
- Story complete before moving to next priority

### Parallel Opportunities

**Setup Phase (all parallel)**:
- T001 and T002 can run in parallel (different concerns)

**Foundational Phase (sequential within this phase)**:
- T003-T005 are sequential (same file, building on each other)

**User Story 1**:
- T006, T007, T008 (all tests) can run in parallel
- T009-T012 are sequential (same file, building on each other)

**User Story 2**:
- T013, T014 (tests) can run in parallel
- T015-T017 are sequential (same file)

**User Story 3**:
- T018, T019 (tests) can run in parallel
- T020-T023 (new component) can develop in parallel to T024-T025 (integration)

**User Story 4**:
- T026-T029 (all tests) can run in parallel
- T030-T035 are sequential (same file)
- T036 depends on T030-T035 completion

**User Story 5**:
- T037-T039 (all tests) can run in parallel
- T040-T044 are sequential (same file)

**Polish Phase (most tasks parallel)**:
- T045-T048, T050-T051 can run in parallel (different files/concerns)
- T049, T052 are validation tasks (run after implementation complete)

**Cross-Story Parallel**:
- After Foundational complete, US1 and US2 can proceed in parallel (different conditional branches in RateRow.tsx)
- US3 and US4 can proceed in parallel (different files: PaybackTooltip.tsx vs formatArbitrageMessage.ts)

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task T006: "Create unit test file with test case for payback_needed status"
Task T007: "Add unit test case for periods calculation precision"
Task T008: "Add unit test case for too_many status"

# After tests written and failing, implement in sequence (same file):
Task T009: "Modify RateRow.tsx to call calculatePaybackPeriods"
Task T010: "Add conditional rendering for payback indicator"
Task T011: "Apply color coding"
Task T012: "Add displayText rendering"
```

---

## Parallel Example: Multiple User Stories

```bash
# After Foundational (T003-T005) complete, these can run in parallel:

# Developer A works on US1 + US2 (RateRow.tsx modifications):
Task T009-T012 (US1)
Task T015-T017 (US2)

# Developer B works on US3 (new PaybackTooltip component):
Task T020-T025 (US3)

# Developer C works on US4 (formatArbitrageMessage.ts):
Task T030-T036 (US4)

# All three streams are independent and can merge when complete
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only) - Recommended

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 2: Foundational (T003-T005) - **CRITICAL**
3. Complete Phase 3: User Story 1 (T006-T012)
4. Complete Phase 4: User Story 2 (T013-T017)
5. **STOP and VALIDATE**: Test both favorable and unfavorable scenarios
6. Deploy/demo if ready (P1 stories provide core value)

**MVP Deliverable**:
- Price difference unfavorable → Shows "⚠️ 需 X.X 次資費回本"
- Price difference favorable → Shows "✓ 價差有利"
- All calculations correct, color-coded, immediately visible

### Incremental Delivery

1. **Foundation** (T001-T005) → Calculation ready
2. **MVP** (T006-T017) → Core indicators visible → **Test independently** → Deploy/Demo
3. **Enhanced UX** (T018-T025, US3) → Add Tooltips → Test independently → Deploy/Demo
4. **Copy Feature** (T026-T036, US4) → Add copy info → Test independently → Deploy/Demo
5. **Edge Cases** (T037-T044, US5) → Handle errors → Test independently → Deploy/Demo
6. **Polish** (T045-T052) → Optimize and validate → Final deployment

Each increment adds value without breaking previous functionality.

### Parallel Team Strategy

With multiple developers:

1. **Team completes Foundational together** (T001-T005)
2. **Once Foundational done**:
   - Developer A: US1 + US2 (RateRow.tsx core display) - T006-T017
   - Developer B: US3 (PaybackTooltip.tsx) - T018-T025
   - Developer C: US4 (formatArbitrageMessage.ts) - T026-T036
   - Developer D: US5 (edge cases) - T037-T044
3. **Stories integrate independently** (different files or different conditional branches)
4. **Team completes Polish together** (T045-T052)

---

## Task Summary

**Total Tasks**: 52
- Phase 1 (Setup): 2 tasks
- Phase 2 (Foundational): 3 tasks (BLOCKING)
- Phase 3 (US1 - P1 MVP): 7 tasks (3 tests + 4 implementation)
- Phase 4 (US2 - P1 MVP): 5 tasks (2 tests + 3 implementation)
- Phase 5 (US3 - P2): 8 tasks (2 tests + 6 implementation)
- Phase 6 (US4 - P2): 11 tasks (4 tests + 7 implementation)
- Phase 7 (US5 - P3): 8 tasks (3 tests + 5 implementation)
- Phase 8 (Polish): 8 tasks

**MVP Scope** (Recommended): T001-T017 (19 tasks)
- Setup + Foundational + US1 + US2
- Delivers core value: visible payback indicators for all scenarios
- Estimated effort: 1-2 days for single developer

**Full Feature**: All 52 tasks
- Includes Tooltips, copy feature, edge cases, polish
- Estimated effort: 3-4 days for single developer, 1-2 days with parallel team

**Parallel Opportunities**:
- Setup phase: 2 tasks can run in parallel
- Within each user story: Test tasks can run in parallel (typically 2-4 tests per story)
- Across user stories: US3, US4, US5 can run in parallel after US1+US2 complete (different files)
- Polish phase: 6 out of 8 tasks can run in parallel

**Independent Test Criteria Met**: ✅
- Each user story has clear acceptance test steps
- Each story can be validated independently
- MVP (US1+US2) provides immediate, testable value

---

## Notes

- [P] tasks = different files or independent concerns, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing (TDD approach)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- **Key Risk**: RateRow.tsx modified by US1, US2, US5 - coordinate carefully if parallel development
- **Mitigation**: US1/US2/US5 use different conditional branches (status checks), minimize merge conflicts
- All file paths validated against existing codebase structure
- Performance target: < 100ms for 200 pairs (validated in T052)
