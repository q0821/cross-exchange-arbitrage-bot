# Tasks: 修正複製套利訊息顯示

**Input**: Design documents from `/specs/023-fix-copy-message-display/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: Tests are included in this feature based on the specification requirements and quickstart.md guidance.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions
- **Web app**: Frontend code in `app/(dashboard)/market-monitor/`
- Tests in `tests/unit/frontend/`
- This is a frontend-only modification (no backend changes)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Review existing code and understand current implementation

- [ ] T001 [P] Read current formatArbitrageMessage.ts implementation in app/(dashboard)/market-monitor/utils/formatArbitrageMessage.ts
- [ ] T002 [P] Read current RateRow.tsx implementation in app/(dashboard)/market-monitor/components/RateRow.tsx
- [ ] T003 [P] Read MarketRate and BestArbitragePair type definitions in app/(dashboard)/market-monitor/types.ts
- [ ] T004 Review spec.md user stories and acceptance criteria in specs/023-fix-copy-message-display/spec.md
- [ ] T005 Review research.md technical decisions in specs/023-fix-copy-message-display/research.md

**Checkpoint**: Understanding complete - ready for implementation

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Remove broken code and create helper functions foundation

**⚠️ CRITICAL**: This must be complete before any user story implementation

- [ ] T006 Remove formatPercentageRange() function from app/(dashboard)/market-monitor/utils/formatArbitrageMessage.ts
- [ ] T007 Create formatAnnualizedReturn() helper function in app/(dashboard)/market-monitor/utils/formatArbitrageMessage.ts
- [ ] T008 [P] Create formatSingleFundingReturn() helper function in app/(dashboard)/market-monitor/utils/formatArbitrageMessage.ts
- [ ] T009 [P] Create formatPriceDiffWithExplanation() helper function in app/(dashboard)/market-monitor/utils/formatArbitrageMessage.ts

**Checkpoint**: Foundation ready - helper functions available for user story implementation

---

## Phase 3: User Story 1 - 正確顯示年化收益率 (Priority: P1) 🎯 MVP

**Goal**: 修正計算錯誤，顯示正確的年化收益率（如 800%）而非錯誤的超大數值

**Independent Test**: 複製一個套利機會訊息，檢查年化收益數值是否在合理範圍內（500-1500%）

### Tests for User Story 1

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T010 [P] [US1] Create test file tests/unit/frontend/formatArbitrageMessage.test.ts
- [ ] T011 [P] [US1] Write test for formatAnnualizedReturn with normal values (800 -> "約 720-880%") in tests/unit/frontend/formatArbitrageMessage.test.ts
- [ ] T012 [P] [US1] Write test for formatAnnualizedReturn with zero value (0 -> "約 0%") in tests/unit/frontend/formatArbitrageMessage.test.ts
- [ ] T013 [P] [US1] Write test for formatArbitrageMessage complete message includes correct annualized return in tests/unit/frontend/formatArbitrageMessage.test.ts

### Implementation for User Story 1

- [ ] T014 [US1] Modify formatArbitrageMessage() signature to accept timeBasis parameter in app/(dashboard)/market-monitor/utils/formatArbitrageMessage.ts
- [ ] T015 [US1] Replace formatPercentageRange usage with formatAnnualizedReturn for annualized return display in app/(dashboard)/market-monitor/utils/formatArbitrageMessage.ts
- [ ] T016 [US1] Update message template to use "預估年化收益：{value}（資金費率價差）" format in app/(dashboard)/market-monitor/utils/formatArbitrageMessage.ts
- [ ] T017 [US1] Verify formatAnnualizedReturn calculates ±10% range correctly in app/(dashboard)/market-monitor/utils/formatArbitrageMessage.ts
- [ ] T018 [US1] Run tests and verify T011, T012, T013 pass with pnpm test formatArbitrageMessage.test.ts

**Checkpoint**: At this point, User Story 1 should be fully functional - annualized return displays correctly

---

## Phase 4: User Story 2 - 顯示單次費率收益和時間基準 (Priority: P2)

**Goal**: 顯示單次結算收益和結算頻率，幫助用戶評估短期和長期收益

**Independent Test**: 檢查複製的訊息是否包含「單次費率收益：約 X%（每 Y 小時結算一次）」的資訊

### Tests for User Story 2

- [ ] T019 [P] [US2] Write test for formatSingleFundingReturn with 8h basis (0.73, 8 -> "約 0.73%（每 8 小時結算一次）") in tests/unit/frontend/formatArbitrageMessage.test.ts
- [ ] T020 [P] [US2] Write test for formatSingleFundingReturn with 4h basis (0.25, 4 -> "約 0.25%（每 4 小時結算一次）") in tests/unit/frontend/formatArbitrageMessage.test.ts
- [ ] T021 [P] [US2] Write test for formatArbitrageMessage includes single return with time basis in tests/unit/frontend/formatArbitrageMessage.test.ts

### Implementation for User Story 2

- [ ] T022 [US2] Add formatSingleFundingReturn call to message template in app/(dashboard)/market-monitor/utils/formatArbitrageMessage.ts
- [ ] T023 [US2] Update message template to replace "目前資費差" with "單次費率收益：{value}（每 {timeBasis} 小時結算一次）" in app/(dashboard)/market-monitor/utils/formatArbitrageMessage.ts
- [ ] T024 [US2] Verify formatSingleFundingReturn uses spreadPercent (not multiplied by 100) in app/(dashboard)/market-monitor/utils/formatArbitrageMessage.ts
- [ ] T025 [US2] Run tests and verify T019, T020, T021 pass with pnpm test formatArbitrageMessage.test.ts

**Checkpoint**: At this point, User Stories 1 AND 2 should both work - shows annualized return and single return

---

## Phase 5: User Story 3 - 改善價格偏差說明 (Priority: P2)

**Goal**: 清楚顯示價格偏差的正負值含義和對平倉收益的影響

**Independent Test**: 檢查複製的訊息中價格偏差是否包含正負號、百分比數值和有利/不利的說明

### Tests for User Story 3

- [ ] T026 [P] [US3] Write test for formatPriceDiffWithExplanation with positive value (0.15 -> "+0.15%（✓ 做空方價格較高，有利平倉）") in tests/unit/frontend/formatArbitrageMessage.test.ts
- [ ] T027 [P] [US3] Write test for formatPriceDiffWithExplanation with negative value (-0.10 -> "-0.10%（✗ 做多方價格較高，不利平倉）") in tests/unit/frontend/formatArbitrageMessage.test.ts
- [ ] T028 [P] [US3] Write test for formatPriceDiffWithExplanation with null value (null -> "N/A（無價格數據）") in tests/unit/frontend/formatArbitrageMessage.test.ts
- [ ] T029 [P] [US3] Write test for formatArbitrageMessage includes price diff with explanation in tests/unit/frontend/formatArbitrageMessage.test.ts

### Implementation for User Story 3

- [ ] T030 [US3] Add formatPriceDiffWithExplanation call to message template in app/(dashboard)/market-monitor/utils/formatArbitrageMessage.ts
- [ ] T031 [US3] Add new line "價格偏差：{value}" to message template after single return in app/(dashboard)/market-monitor/utils/formatArbitrageMessage.ts
- [ ] T032 [US3] Verify formatPriceDiffWithExplanation handles null gracefully in app/(dashboard)/market-monitor/utils/formatArbitrageMessage.ts
- [ ] T033 [US3] Verify formatPriceDiffWithExplanation shows correct symbols (✓ for positive, ✗ for negative) in app/(dashboard)/market-monitor/utils/formatArbitrageMessage.ts
- [ ] T034 [US3] Run tests and verify T026, T027, T028, T029 pass with pnpm test formatArbitrageMessage.test.ts

**Checkpoint**: All core formatting logic complete - shows annualized return, single return, and price diff

---

## Phase 6: User Story 4 - 使用口語化術語和註解 (Priority: P3)

**Goal**: 改善訊息可讀性，使用更口語化的術語和括號註解

**Independent Test**: 檢查複製的訊息是否使用「收益評估」而非「利潤預估」，是否包含術語註解

### Tests for User Story 4

- [ ] T035 [P] [US4] Write test verifying message uses "📈 收益評估：" instead of "目前利潤預估" in tests/unit/frontend/formatArbitrageMessage.test.ts
- [ ] T036 [P] [US4] Write test verifying annualized return includes "（資金費率價差）" annotation in tests/unit/frontend/formatArbitrageMessage.test.ts
- [ ] T037 [P] [US4] Write test verifying risk warning section is present and complete in tests/unit/frontend/formatArbitrageMessage.test.ts

### Implementation for User Story 4

- [ ] T038 [US4] Change message section title from "目前利潤預估" to "收益評估" in app/(dashboard)/market-monitor/utils/formatArbitrageMessage.ts
- [ ] T039 [US4] Add "（資金費率價差）" annotation after annualized return value in app/(dashboard)/market-monitor/utils/formatArbitrageMessage.ts
- [ ] T040 [US4] Update risk warning section to include price diff risk explanation in app/(dashboard)/market-monitor/utils/formatArbitrageMessage.ts
- [ ] T041 [US4] Verify complete message format matches contracts/message-format.md specification in app/(dashboard)/market-monitor/utils/formatArbitrageMessage.ts
- [ ] T042 [US4] Run tests and verify T035, T036, T037 pass with pnpm test formatArbitrageMessage.test.ts

**Checkpoint**: All user stories complete - message fully formatted with correct terminology

---

## Phase 7: RateRow Component Integration

**Purpose**: Integrate formatArbitrageMessage changes into RateRow component

- [ ] T043 Identify how to access current timeBasis in RateRow component in app/(dashboard)/market-monitor/components/RateRow.tsx
- [ ] T044 Pass timeBasis parameter to formatArbitrageMessage in handleCopy function in app/(dashboard)/market-monitor/components/RateRow.tsx
- [ ] T045 Verify default timeBasis is 8 if not available in app/(dashboard)/market-monitor/components/RateRow.tsx
- [ ] T046 Test copy functionality manually in browser at http://localhost:3000/market-monitor

**Checkpoint**: Component integration complete - copy button uses new formatting

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and improvements

- [ ] T047 Run full test suite with pnpm test --run
- [ ] T048 Run TypeScript type check with pnpm tsc --noEmit
- [ ] T049 [P] Run ESLint with pnpm lint
- [ ] T050 [P] Verify no console.log statements in production code
- [ ] T051 Manual testing with different scenarios per quickstart.md in specs/023-fix-copy-message-display/quickstart.md
- [ ] T052 Test edge cases: zero values, null price data, negative values, different time bases
- [ ] T053 Verify message encoding is UTF-8 and Emoji display correctly
- [ ] T054 [P] Update CLAUDE.md if needed (already updated by agent context script)
- [ ] T055 Code review self-check against contracts/formatting-functions.md

**Checkpoint**: All validation complete - ready for commit

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User stories can proceed sequentially (P1 → P2 → P2 → P3)
  - US2 depends on US1 (uses same message template)
  - US3 depends on US1, US2 (adds to existing template)
  - US4 depends on US1, US2, US3 (polishes complete message)
- **Integration (Phase 7)**: Depends on all user stories complete
- **Polish (Phase 8)**: Depends on integration complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Depends on US1 (modifies same formatArbitrageMessage function)
- **User Story 3 (P2)**: Depends on US1, US2 (adds to same message template)
- **User Story 4 (P3)**: Depends on US1, US2, US3 (polishes complete message)

**Note**: Due to all tasks modifying the same file (formatArbitrageMessage.ts), user stories must be sequential.

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Helper function before message template changes
- Message template changes before test verification
- Story complete before moving to next priority

### Parallel Opportunities

- **Phase 1 (Setup)**: T001, T002, T003 can run in parallel
- **Phase 2 (Foundational)**: T007 sequential, then T008 and T009 can run in parallel
- **Within US1 Tests**: T011, T012, T013 can run in parallel
- **Within US2 Tests**: T019, T020, T021 can run in parallel
- **Within US3 Tests**: T026, T027, T028, T029 can run in parallel
- **Within US4 Tests**: T035, T036, T037 can run in parallel
- **Phase 8 (Polish)**: T049, T050, T054 can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "[US1] Write test for formatAnnualizedReturn with normal values"
Task: "[US1] Write test for formatAnnualizedReturn with zero value"
Task: "[US1] Write test for formatArbitrageMessage complete message"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - creates helper functions)
3. Complete Phase 3: User Story 1 (fix calculation error)
4. **STOP and VALIDATE**: Test US1 independently - annualized return displays correctly
5. Can deploy this minimal fix if urgent

### Incremental Delivery

1. Complete Setup + Foundational → Helper functions ready
2. Add User Story 1 → Test independently → Annualized return fixed (MVP!)
3. Add User Story 2 → Test independently → Adds single return + time basis
4. Add User Story 3 → Test independently → Adds price diff explanation
5. Add User Story 4 → Test independently → Polishes terminology
6. Complete Integration → Component uses new formatting
7. Complete Polish → Full validation
8. Each story adds value without breaking previous stories

### Sequential Implementation (Recommended)

Since all tasks modify the same file (formatArbitrageMessage.ts), sequential implementation is recommended:

1. Complete Setup + Foundational
2. US1: Fix annualized return calculation
3. US2: Add single return with time basis
4. US3: Add price diff explanation
5. US4: Polish terminology
6. Integration: Update RateRow component
7. Polish: Full validation and testing

---

## Notes

- [P] tasks = different files/test cases, no dependencies
- [Story] label maps task to specific user story for traceability
- All user stories modify the same file, so they must be sequential
- Tests should fail before implementation (TDD approach)
- Commit after each user story phase completion
- Stop at any checkpoint to validate story independently
- Follow contracts/formatting-functions.md and contracts/message-format.md specifications
- Use quickstart.md for development and testing guidance
- Total estimated time: 4-6 hours for all phases

## Task Count Summary

- **Phase 1 (Setup)**: 5 tasks
- **Phase 2 (Foundational)**: 4 tasks
- **Phase 3 (US1)**: 9 tasks
- **Phase 4 (US2)**: 7 tasks
- **Phase 5 (US3)**: 9 tasks
- **Phase 6 (US4)**: 8 tasks
- **Phase 7 (Integration)**: 4 tasks
- **Phase 8 (Polish)**: 9 tasks

**Total**: 55 tasks

**MVP (US1 only)**: 18 tasks (Setup + Foundational + US1)
**Parallel Opportunities**: 13 tasks marked [P] can run in parallel within their phases
