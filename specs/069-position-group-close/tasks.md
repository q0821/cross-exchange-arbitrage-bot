# Tasks: 分單持倉合併顯示與批量平倉

**Input**: Design documents from `/specs/069-position-group-close/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: TDD 流程（Constitution Principle VII）- 先寫測試，確認 FAIL，再實作。

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- **[TEST]**: Test task - must be written and FAIL before implementation
- Include exact file paths in descriptions

---

## Phase 1: Setup (Database Schema)

**Purpose**: Position 模型新增 groupId 欄位

- [x] T001 Add groupId field to Position model in prisma/schema.prisma
- [x] T002 Run `pnpm prisma migrate dev --name add_position_group_id` to generate migration
- [x] T003 Run `pnpm prisma generate` to update Prisma Client

**Checkpoint**: Migration 成功執行，Prisma Client 已更新

---

## Phase 2: Foundational (Type Definitions & Utilities)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Tests for Foundational (RED Phase) 🔴

- [x] T004 [P] [TEST] Write unit tests for position-group utilities in tests/unit/lib/position-group.test.ts
- [x] T005 [P] [TEST] Write unit tests for PositionGroupService in tests/unit/services/PositionGroupService.test.ts

### Implementation for Foundational (GREEN Phase) 🟢

- [x] T006 [P] Create position-group types in src/types/position-group.ts
- [x] T007 Create position-group calculation utilities in src/lib/position-group.ts (run T004 tests, verify PASS)
- [x] T008 Create PositionGroupService in src/services/trading/PositionGroupService.ts (run T005 tests, verify PASS)

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - 組合持倉合併顯示 (Priority: P1) 🎯 MVP

**Goal**: 分單開倉後，前端將相同 groupId 的持倉合併顯示為一個「組合持倉」卡片

**Independent Test**: 分單開倉 3 組 → 進入持倉列表 → 看到 1 個組合卡片顯示「3 組」

### Tests for User Story 1 (RED Phase) 🔴

- [x] T009 [P] [TEST] [US1] Write unit tests for PositionOrchestrator.openPosition with groupId in tests/unit/services/PositionOrchestrator.groupId.test.ts
- [x] T010 [P] [TEST] [US1] Write integration tests for groupId assignment in tests/integration/position-group-open.test.ts

### Implementation for User Story 1 (GREEN Phase) 🟢

- [x] T011 [US1] Modify PositionOrchestrator to accept and assign groupId in src/services/trading/PositionOrchestrator.ts (run T009, verify PASS)
- [x] T012 [US1] Modify POST /api/positions/open to accept groupId in app/api/positions/open/route.ts
- [x] T013 [US1] Modify GET /api/positions to support grouped response in app/api/positions/route.ts
- [x] T014 [P] [US1] Create PositionGroupCard component in app/(dashboard)/positions/components/PositionGroupCard.tsx
- [x] T015 [P] [US1] Create PositionGroupExpanded component in app/(dashboard)/positions/components/PositionGroupExpanded.tsx
- [x] T016 [US1] Modify usePositions hook to support grouping in hooks/queries/usePositionsQuery.ts
- [x] T017 [US1] Modify positions page to render groups in app/(dashboard)/positions/page.tsx
- [x] T018 [US1] Run integration tests (T010), verify PASS

### Refactor for User Story 1 🔵

- [x] T019 [US1] Code cleanup and verify all US1 tests pass

**Checkpoint**: User Story 1 完成 - 組合持倉正確合併顯示

---

## Phase 4: User Story 2 - 批量一鍵平倉 (Priority: P1)

**Goal**: 用戶點擊「全部平倉」按鈕，系統一次性平倉組合內所有持倉

**Independent Test**: 組合持倉 3 組 → 點擊「全部平倉」→ 所有持倉平倉成功，條件單取消

### Tests for User Story 2 (RED Phase) 🔴

- [x] T020 [P] [TEST] [US2] Write unit tests for PositionCloser.closeBatchPositions in tests/unit/services/PositionCloser.batch.test.ts
- [x] T021 [P] [TEST] [US2] Write integration tests for batch close API in tests/integration/batch-close.test.ts

### Implementation for User Story 2 (GREEN Phase) 🟢

- [x] T022 [US2] Add closeBatchPositions method to PositionCloser in src/services/trading/PositionCloser.ts (run T020, verify PASS)
- [x] T023 [US2] Create batch close API route in app/api/positions/group/[groupId]/close/route.ts
- [x] T024 [US2] Add WebSocket events for batch close progress in src/services/websocket/PositionProgressEmitter.ts
- [x] T025 [P] [US2] Create useBatchClose hook in app/(dashboard)/positions/hooks/useBatchClose.ts
- [x] T026 [P] [US2] Create BatchCloseDialog component in app/(dashboard)/positions/components/BatchCloseDialog.tsx
- [x] T027 [US2] Add batch close button to PositionGroupCard in app/(dashboard)/positions/components/PositionGroupCard.tsx
- [x] T028 [US2] Run integration tests (T021), verify PASS

### Refactor for User Story 2 🔵

- [x] T029 [US2] Code cleanup and verify all US2 tests pass

**Checkpoint**: User Story 2 完成 - 批量平倉功能正常運作

---

## Phase 5: User Story 3 - 單一持倉向後相容 (Priority: P2)

**Goal**: 沒有 groupId 的持倉維持原有的獨立顯示和操作方式

**Independent Test**: 查看非分單開倉的持倉 → 顯示為獨立卡片 → 平倉流程與之前相同

### Tests for User Story 3 (RED Phase) 🔴

- [x] T030 [TEST] [US3] Write integration tests for backward compatibility in tests/integration/position-backward-compat.test.ts

### Implementation for User Story 3 (GREEN Phase) 🟢

- [x] T031 [US3] Verify PositionCard handles null groupId correctly in app/(dashboard)/positions/components/PositionCard.tsx
- [x] T032 [US3] Verify positions page correctly separates grouped and ungrouped positions
- [x] T033 [US3] Run integration tests (T030), verify PASS

### Refactor for User Story 3 🔵

- [x] T034 [US3] Code cleanup and verify all US3 tests pass

**Checkpoint**: User Story 3 完成 - 向後相容驗證通過

---

## Phase 6: User Story 4 - 組合持倉統計資訊 (Priority: P2)

**Goal**: 組合持倉顯示合併後的統計資訊（總資金費率收益、平均開倉價格）

**Independent Test**: 組合持倉 3 組 → 查看統計資訊 → 總收益正確加總，平均價格計算誤差 < 0.01%

### Tests for User Story 4 (RED Phase) 🔴

- [x] T035 [P] [TEST] [US4] Write unit tests for aggregate calculation accuracy in tests/unit/lib/position-group-aggregate.test.ts

### Implementation for User Story 4 (GREEN Phase) 🟢

- [x] T036 [US4] Add aggregate statistics calculation to PositionGroupService in src/services/trading/PositionGroupService.ts
- [x] T037 [US4] Display aggregate statistics in PositionGroupCard in app/(dashboard)/positions/components/PositionGroupCard.tsx
- [x] T038 [US4] Run unit tests (T035), verify PASS

### Refactor for User Story 4 🔵

- [x] T039 [US4] Code cleanup and verify all US4 tests pass

**Checkpoint**: User Story 4 完成 - 統計資訊正確顯示

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T040 [P] Update useOpenPosition hook to support split open with groupId in app/(dashboard)/market-monitor/hooks/useOpenPosition.ts
- [x] T041 [P] Run all tests and verify 100% pass rate (91/91 Feature 069 tests passed)
- [ ] T042 Run quickstart.md validation (manual test)
- [x] T043 Update CLAUDE.md with Feature 069 documentation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - US1 and US2 can proceed in parallel (both P1)
  - US3 and US4 can proceed after US1/US2 or in parallel (both P2)
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - Uses PositionGroupService from Phase 2
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Verifies backward compatibility
- **User Story 4 (P2)**: Can start after Foundational (Phase 2) - Extends aggregate calculations

### Within Each User Story (TDD Flow)

1. **RED Phase**: Tests MUST be written and FAIL before implementation
2. **GREEN Phase**: Write minimum code to make tests PASS
3. **REFACTOR Phase**: Clean up while keeping tests PASS

### Parallel Opportunities

- T004, T005 (Foundational tests) can run in parallel
- T006, T007, T008 (Foundational implementation) - T006 parallel, T007/T008 sequential after
- T009, T010 (US1 tests) can run in parallel
- T014, T015 (US1 components) can run in parallel
- T020, T021 (US2 tests) can run in parallel
- T025, T026 (US2 frontend) can run in parallel
- T040, T041 (Polish) can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together (RED Phase):
pnpm test tests/unit/services/PositionOrchestrator.groupId.test.ts
pnpm test tests/integration/position-group-open.test.ts

# Launch parallel components after backend is ready:
# - PositionGroupCard.tsx
# - PositionGroupExpanded.tsx
```

---

## Implementation Strategy

### MVP First (User Story 1 + 2)

1. Complete Phase 1: Setup (Database Migration)
2. Complete Phase 2: Foundational (Types + Utilities)
3. Complete Phase 3: User Story 1 (組合顯示)
4. **VALIDATE**: Test US1 independently
5. Complete Phase 4: User Story 2 (批量平倉)
6. **VALIDATE**: Test US2 independently
7. Deploy/demo if ready (MVP complete!)

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Demo (基本 MVP)
3. Add User Story 2 → Test independently → Demo (完整 MVP)
4. Add User Story 3 → Test independently → Deploy (確保向後相容)
5. Add User Story 4 → Test independently → Deploy (增強統計功能)

---

## Task Summary

| Phase | Story | Task Count | Key Files |
|-------|-------|------------|-----------|
| Setup | - | 3 | prisma/schema.prisma |
| Foundational | - | 5 | src/types/, src/lib/, src/services/ |
| US1 | P1 | 11 | PositionOrchestrator, API, Components |
| US2 | P1 | 10 | PositionCloser, API, Hooks, Components |
| US3 | P2 | 5 | Integration tests, PositionCard |
| US4 | P2 | 5 | Aggregate calculation, PositionGroupCard |
| Polish | - | 4 | useOpenPosition, Tests, Docs |

**Total Tasks**: 43
**Tasks with [TEST] marker**: 8
**Parallel Opportunities**: 15 tasks marked [P]

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- [TEST] tasks must FAIL before implementation (TDD RED phase)
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
