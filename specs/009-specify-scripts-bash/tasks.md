---
description: "Task list for Feature 009: 市場監控頁面穩定排序"
---

# Tasks: 市場監控頁面穩定排序

**Input**: Design documents from `/specs/009-specify-scripts-bash/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md
**Branch**: 009-specify-scripts-bash

**Tests**: Tests are included in this plan to validate success criteria from spec.md, but can be implemented after core functionality if needed.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- Web app: `app/`, `tests/` at repository root
- Frontend components: `app/(dashboard)/market-monitor/`
- Tests: `tests/unit/`, `tests/e2e/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify project structure and dependencies (no new dependencies needed)

- [X] T001 Verify React 18, Next.js 14 App Router, and TypeScript 5.6 are configured
- [X] T002 [P] Verify test environment (Vitest for unit, Playwright for E2E) is available
- [X] T003 [P] Create tests/unit/market-monitor/ directory for unit tests
- [X] T004 [P] Create tests/e2e/ directory for E2E tests (if not exists)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core utilities and types that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 Create SortField and SortDirection types in app/(dashboard)/market-monitor/types.ts
- [X] T006 [P] Create stable sort comparator function in app/(dashboard)/market-monitor/utils/sortComparator.ts
- [X] T007 [P] Create localStorage utility functions (save/load with error handling) in app/(dashboard)/market-monitor/utils/localStorage.ts

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - 預設穩定排序顯示 (Priority: P1) 🎯 MVP

**Goal**: 交易對列表按字母順序固定排序，WebSocket 更新不觸發重新排列

**Independent Test**: 開啟市場監控頁面，觀察 30 秒內交易對位置是否因資料更新而改變。成功標準：位置保持穩定，只有數值更新。

### Implementation for User Story 1

- [X] T008 [P] [US1] Modify useMarketRates hook to use Map<string, MarketRate> instead of array in app/(dashboard)/market-monitor/hooks/useMarketRates.ts
- [X] T009 [P] [US1] Update handleRatesUpdate to only update Map values (not recreate entire structure) in app/(dashboard)/market-monitor/hooks/useMarketRates.ts
- [X] T010 [US1] Implement snapshot sorting in RatesTable component using useMemo with [sortBy, sortDirection] dependencies in app/(dashboard)/market-monitor/components/RatesTable.tsx
- [X] T011 [US1] Remove rates from sortedSymbols useMemo dependencies in app/(dashboard)/market-monitor/components/RatesTable.tsx
- [X] T012 [US1] Update RatesTable rendering to map over sortedSymbols array and fetch values from ratesMap in app/(dashboard)/market-monitor/components/RatesTable.tsx
- [X] T013 [US1] Change default sort to 'symbol' (alphabetical) in useTableSort hook in app/(dashboard)/market-monitor/hooks/useTableSort.ts
- [X] T014 [US1] Change default sort direction to 'asc' in useTableSort hook in app/(dashboard)/market-monitor/hooks/useTableSort.ts
- [X] T015 [US1] Integrate stable sort comparator with secondary key (symbol name) in RatesTable component in app/(dashboard)/market-monitor/components/RatesTable.tsx
- [X] T016 [US1] Update page.tsx to pass ratesMap instead of rates array to RatesTable in app/(dashboard)/market-monitor/page.tsx

**Checkpoint**: At this point, User Story 1 should be fully functional - list displays in alphabetical order and remains stable during WebSocket updates

---

## Phase 4: User Story 2 - 用戶自訂排序並保持穩定 (Priority: P2)

**Goal**: 用戶可點擊欄位標題排序，排序後列表保持穩定

**Independent Test**: 點擊「費率差異」欄位標題進行排序，然後觀察 30 秒內列表是否保持該排序順序。成功標準：排序後順序穩定，即使資料更新也不重新排列。

### Implementation for User Story 2

- [X] T017 [P] [US2] Add sort toggle logic to useTableSort hook (same field = toggle direction, different field = change field) in app/(dashboard)/market-monitor/hooks/useTableSort.ts
- [X] T018 [P] [US2] Add column header click handlers to RatesTable component in app/(dashboard)/market-monitor/components/RatesTable.tsx
- [X] T019 [P] [US2] Add visual sort indicators (up/down arrows) to column headers in app/(dashboard)/market-monitor/components/RatesTable.tsx
- [X] T020 [US2] Implement sort comparators for all sortable fields (symbol, spread, annualizedReturn, netReturn) in app/(dashboard)/market-monitor/utils/sortComparator.ts
- [X] T021 [US2] Ensure sort stability with secondary key for duplicate values in app/(dashboard)/market-monitor/utils/sortComparator.ts
- [X] T022 [US2] Add onSort callback prop to RatesTable and wire to useTableSort in app/(dashboard)/market-monitor/page.tsx

**Checkpoint**: At this point, User Stories 1 AND 2 should both work - users can sort by any column and the order remains stable

---

## Phase 5: User Story 3 - 排序偏好記憶 (Priority: P3)

**Goal**: 系統記住用戶上次選擇的排序方式，下次開啟頁面時自動套用

**Independent Test**: 設定排序為「費率差異降序」，關閉頁面後重新開啟，驗證排序設定是否自動恢復。成功標準：排序偏好在瀏覽器會話之間保持。

### Implementation for User Story 3

- [X] T023 [P] [US3] Add localStorage save on sort change in useTableSort hook using localStorage utilities in app/(dashboard)/market-monitor/hooks/useTableSort.ts
- [X] T024 [P] [US3] Add localStorage load on hook initialization in useTableSort hook in app/(dashboard)/market-monitor/hooks/useTableSort.ts
- [X] T025 [US3] Add validation for loaded sort values (ensure valid SortField and SortDirection) in app/(dashboard)/market-monitor/hooks/useTableSort.ts
- [X] T026 [US3] Add fallback to default values when localStorage unavailable or invalid in app/(dashboard)/market-monitor/hooks/useTableSort.ts
- [X] T027 [US3] Test graceful degradation in private browsing mode (sort works, just doesn't persist)

**Checkpoint**: All user stories should now be independently functional - sort preferences persist across page reloads

---

## Phase 6: Testing & Validation (OPTIONAL - can be done incrementally)

**Purpose**: Validate success criteria from spec.md

### Unit Tests

- [ ] T028 [P] Write unit test for stable sort comparator with primary and secondary keys in tests/unit/market-monitor/sortComparator.test.ts
- [ ] T029 [P] Write unit test for localStorage save/load with error handling in tests/unit/market-monitor/localStorage.test.ts
- [ ] T030 [P] Write unit test for useTableSort toggle logic in tests/unit/market-monitor/useTableSort.test.ts
- [ ] T031 [P] Write unit test for Map-based data update (verify no unnecessary re-sorts) in tests/unit/market-monitor/useMarketRates.test.ts

### E2E Tests

- [ ] T032 [P] Write E2E test for SC-001: Verify position stability over 2 minutes with WebSocket updates in tests/e2e/market-monitor-sorting.spec.ts
- [ ] T033 [P] Write E2E test for SC-002: Verify sort completes within 500ms in tests/e2e/market-monitor-sorting.spec.ts
- [ ] T034 [P] Write E2E test for SC-003: Verify order consistency over 5 minutes with multiple updates in tests/e2e/market-monitor-sorting.spec.ts
- [ ] T035 [P] Write E2E test for SC-004: Verify sort preference restoration after page reload in tests/e2e/market-monitor-sorting.spec.ts
- [ ] T036 [P] Write E2E test for SC-005: Verify group switch with sort preservation in tests/e2e/market-monitor-sorting.spec.ts

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T037 [P] Add React.memo to RateRow component for render optimization in app/(dashboard)/market-monitor/components/RateRow.tsx
- [ ] T038 [P] Add useCallback to event handlers in RatesTable to prevent unnecessary re-renders in app/(dashboard)/market-monitor/components/RatesTable.tsx
- [ ] T039 [P] Verify no visual flicker during sort operations (use React DevTools Profiler)
- [ ] T040 [P] Add comments documenting the snapshot sorting pattern in RatesTable.tsx
- [ ] T041 [P] Update quickstart.md with final file paths and testing results in specs/009-specify-scripts-bash/quickstart.md
- [ ] T042 Run manual validation checklist from quickstart.md (stable sorting, custom sorting, persistence)
- [ ] T043 Performance validation: Use React DevTools Profiler to verify no unnecessary re-renders on WebSocket updates

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Testing (Phase 6)**: Can be done incrementally after each user story or all at once at the end
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories ✅ INDEPENDENT
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Builds on US1 but independently testable ✅ INDEPENDENT
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Enhances US2 but independently testable ✅ INDEPENDENT

### Within Each User Story

- Models/Hooks before Components
- Core logic before UI integration
- Implementation before tests (if using TDD, reverse this)
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel (T002, T003, T004)
- All Foundational tasks marked [P] can run in parallel (T006, T007)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- Within User Story 1: T008 and T009 can run in parallel (same file but different functions)
- Within User Story 2: T017, T018, T019 can run in parallel (different concerns)
- Within User Story 3: T023 and T024 can run in parallel (different functions)
- All unit tests (T028-T031) can run in parallel
- All E2E tests (T032-T036) can run in parallel
- All polish tasks (T037-T041) can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch Map-based modifications together (different parts of same file):
Task: "Modify useMarketRates hook to use Map<string, MarketRate> instead of array" (T008)
Task: "Update handleRatesUpdate to only update Map values" (T009)

# Then implement snapshot sorting (depends on Map being ready):
Task: "Implement snapshot sorting in RatesTable component" (T010)
Task: "Remove rates from sortedSymbols useMemo dependencies" (T011)
```

---

## Parallel Example: User Story 2

```bash
# Launch all UI enhancements together:
Task: "Add sort toggle logic to useTableSort hook" (T017)
Task: "Add column header click handlers to RatesTable" (T018)
Task: "Add visual sort indicators to column headers" (T019)
```

---

## Parallel Example: Testing Phase

```bash
# Launch all unit tests together:
Task: "Unit test for stable sort comparator" (T028)
Task: "Unit test for localStorage utilities" (T029)
Task: "Unit test for useTableSort toggle" (T030)
Task: "Unit test for Map-based updates" (T031)

# Launch all E2E tests together (in separate command):
Task: "E2E test for position stability" (T032)
Task: "E2E test for sort performance" (T033)
Task: "E2E test for order consistency" (T034)
Task: "E2E test for preference restoration" (T035)
Task: "E2E test for group switch" (T036)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T004)
2. Complete Phase 2: Foundational (T005-T007) - CRITICAL
3. Complete Phase 3: User Story 1 (T008-T016)
4. **STOP and VALIDATE**: Test alphabetical sorting stability manually
5. Deploy/demo if ready

**Estimated Effort**: ~8 tasks for MVP (Setup + Foundational + US1)

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready (T001-T007)
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!) (T008-T016)
3. Add User Story 2 → Test independently → Deploy/Demo (T017-T022)
4. Add User Story 3 → Test independently → Deploy/Demo (T023-T027)
5. Add Tests → Validate success criteria (T028-T036)
6. Polish → Optimize and document (T037-T043)

Each story adds value without breaking previous stories.

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (T001-T007)
2. Once Foundational is done:
   - Developer A: User Story 1 (T008-T016)
   - Developer B: User Story 2 (T017-T022)
   - Developer C: User Story 3 (T023-T027)
3. Stories complete and integrate independently
4. Team writes tests in parallel (T028-T036)

---

## Task Statistics

- **Total Tasks**: 43
- **Phase 1 (Setup)**: 4 tasks
- **Phase 2 (Foundational)**: 3 tasks (BLOCKING)
- **Phase 3 (US1 - MVP)**: 9 tasks
- **Phase 4 (US2)**: 6 tasks
- **Phase 5 (US3)**: 5 tasks
- **Phase 6 (Testing)**: 9 tasks (optional, can be incremental)
- **Phase 7 (Polish)**: 7 tasks

**Parallel Opportunities**: 30 tasks marked [P] (70% parallelizable)

**MVP Scope** (User Story 1 only): 16 tasks (Setup + Foundational + US1)

---

## Success Criteria Validation

After completing all tasks, verify these measurable outcomes from spec.md:

- [ ] **SC-001**: 用戶觀察列表 2 分鐘，位置穩定性達 100% (T032 validates)
- [ ] **SC-002**: 排序操作在 500 毫秒內完成 (T033 validates)
- [ ] **SC-003**: 設定排序後 5 分鐘內接收多次更新，順序一致性 100% (T034 validates)
- [ ] **SC-004**: 重新開啟頁面後，排序設定恢復準確率 100% (T035 validates)
- [ ] **SC-005**: 切換交易對群組時，1 秒內完成重新載入並套用排序 (T036 validates)
- [ ] **SC-006**: 95% 用戶能無需指導就成功使用排序功能 (manual user testing)

---

## Notes

- [P] tasks = different files or independent functions, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Tests can be written incrementally after each story or all at once
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Use quickstart.md for detailed implementation guidance
- Refer to research.md for technical decision rationale
- Refer to data-model.md for state management patterns

---

## Format Validation

✅ All tasks follow strict checklist format: `- [ ] [ID] [P?] [Story?] Description with file path`
✅ All user story tasks have [Story] labels (US1, US2, US3)
✅ All parallelizable tasks marked with [P]
✅ All file paths are explicit and absolute
✅ All checkpoints defined for independent validation
