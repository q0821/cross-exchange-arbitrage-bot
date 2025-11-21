# Tasks: 一鍵複製套利機會資訊

**Input**: Design documents from `/specs/020-copy-arbitrage-info/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, quickstart.md

**Tests**: Test tasks are included as OPTIONAL. Skip them for faster MVP delivery, or implement them for production-ready quality.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- Frontend code: `app/(dashboard)/market-monitor/`
- Utils: `app/(dashboard)/market-monitor/utils/`
- Components: `app/(dashboard)/market-monitor/components/`
- Tests: `tests/unit/frontend/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and dependencies verification

- [X] T001 Verify existing project structure matches plan.md requirements (Next.js 14, React 18, TypeScript 5.6)
- [X] T002 [P] Verify Lucide React icons library is available for Copy and Check icons
- [X] T003 [P] Verify Tailwind CSS configuration supports required styling

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core types and utilities that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Verify MarketRate and BestArbitragePair type definitions exist in app/(dashboard)/market-monitor/types.ts
- [X] T005 Verify ExchangeName type includes all four exchanges (binance, okx, mexc, gateio)

**Checkpoint**: Foundation verified - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - 快速複製套利機會資訊 (Priority: P1) 🎯 MVP

**Goal**: 用戶可以點擊複製按鈕，將套利機會資訊複製到剪貼板

**Independent Test**: 在市場監控頁面點擊任意交易對的「複製」按鈕，檢查剪貼板內容是否包含正確格式的套利資訊

### Implementation for User Story 1

- [X] T006 [P] [US1] Create formatSymbolDisplay helper function in app/(dashboard)/market-monitor/utils/formatArbitrageMessage.ts (converts "BTCUSDT" → "BTC/USDT")
- [X] T007 [P] [US1] Create getExchangeDisplayName helper function in app/(dashboard)/market-monitor/utils/formatArbitrageMessage.ts (maps exchange names to display format)
- [X] T008 [P] [US1] Create formatPercentageRange helper function in app/(dashboard)/market-monitor/utils/formatArbitrageMessage.ts (implements ±20% range calculation)
- [X] T009 [US1] Create formatArbitrageMessage main function in app/(dashboard)/market-monitor/utils/formatArbitrageMessage.ts (assembles complete message format, depends on T006-T008)
- [X] T010 [US1] Add Copy button to RateRow component in app/(dashboard)/market-monitor/components/RateRow.tsx (add button UI next to existing quick open button)
- [X] T011 [US1] Implement handleCopy function in RateRow component using navigator.clipboard.writeText() API
- [X] T012 [US1] Add copy button disabled state when bestPair is null in RateRow component
- [ ] T013 [US1] Test copy functionality manually: click button, paste to Notepad/Excel/Telegram and verify format

**Checkpoint**: At this point, User Story 1 should be fully functional - users can copy arbitrage info to clipboard

---

## Phase 4: User Story 2 - 即時視覺反饋 (Priority: P2)

**Goal**: 用戶點擊複製按鈕後看到清楚的視覺確認（✓圖標持續 2 秒）

**Independent Test**: 點擊複製按鈕，觀察按鈕圖標是否變為 ✓ 並持續 2 秒後恢復

### Implementation for User Story 2

- [X] T014 [US2] Add copyStatus state to RateRow component in app/(dashboard)/market-monitor/components/RateRow.tsx (useState with 'idle' | 'success' | 'error')
- [X] T015 [US2] Update handleCopy function to set copyStatus to 'success' after successful copy
- [X] T016 [US2] Implement useEffect hook to auto-reset copyStatus to 'idle' after 2 seconds with cleanup function
- [X] T017 [US2] Update Copy button icon to conditionally render Check icon when copyStatus is 'success'
- [ ] T018 [US2] Test visual feedback manually: click button, verify ✓ icon appears for exactly 2 seconds

**Checkpoint**: At this point, User Stories 1 AND 2 should both work - users get immediate visual confirmation

---

## Phase 5: User Story 3 - 錯誤處理與用戶提示 (Priority: P3)

**Goal**: 當複製失敗時，用戶看到明確的錯誤訊息和可能的解決方案

**Independent Test**: 模擬權限被拒絕或不支援的環境，檢查是否顯示適當的錯誤訊息

### Implementation for User Story 3

- [X] T019 [US3] Wrap navigator.clipboard.writeText() in try-catch block in handleCopy function
- [X] T020 [US3] Add error handling to set copyStatus to 'error' when clipboard operation fails
- [X] T021 [US3] Implement error message display (toast or inline message) with user-friendly Chinese text
- [X] T022 [US3] Handle edge case: bestPair is null (already handled in T012, verify it works)
- [X] T023 [US3] Handle edge case: invalid percentage values (NaN, negative) in formatPercentageRange function
- [X] T024 [US3] Add console.error logging for debugging in development mode
- [ ] T025 [US3] Test error handling manually: deny clipboard permission in browser settings, verify error message appears

**Checkpoint**: All user stories should now be independently functional with complete error handling

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Testing, documentation, and quality improvements

### Optional: Automated Tests (can be skipped for MVP)

- [ ] T026 [P] Write unit tests for formatSymbolDisplay function in tests/unit/frontend/formatArbitrageMessage.test.ts
- [ ] T027 [P] Write unit tests for getExchangeDisplayName function covering all exchange mappings
- [ ] T028 [P] Write unit tests for formatPercentageRange function covering edge cases (null, NaN, negative, zero, normal values)
- [ ] T029 [P] Write unit tests for formatArbitrageMessage main function with complete MarketRate mock
- [ ] T030 [P] Write component tests for RateRow copy button rendering in tests/unit/frontend/RateRow.test.tsx
- [ ] T031 [P] Write component tests for RateRow copy button state changes (idle → success → idle)
- [ ] T032 [P] Write component tests for RateRow error handling flow

### Documentation & Validation

- [ ] T033 Add JSDoc comments to all functions in formatArbitrageMessage.ts explaining parameters and return values
- [ ] T034 Add inline comments for complex logic (range calculation, exchange mapping)
- [ ] T035 Verify all acceptance scenarios from spec.md are satisfied by manual testing
- [ ] T036 Cross-browser compatibility test: Chrome, Firefox, Safari, Edge
- [ ] T037 Format validation: paste copied text to Excel, Telegram, Notepad and verify formatting
- [ ] T038 Review quickstart.md and update if any user instructions are missing

### Code Quality

- [ ] T039 Run TypeScript compiler check (tsc --noEmit) and fix any type errors
- [ ] T040 Run ESLint and fix any warnings related to new code
- [ ] T041 Check for memory leaks: verify useEffect cleanup function works correctly on component unmount
- [ ] T042 Performance check: verify copy operation completes in < 100ms
- [ ] T043 Accessibility check: verify copy button has proper aria-label and keyboard support

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories ✅ INDEPENDENT
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Builds on US1 but uses different state logic ✅ MOSTLY INDEPENDENT
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Adds error handling to US1 & US2 ✅ MOSTLY INDEPENDENT

### Within Each User Story

**User Story 1**:
- T006-T008 (helpers) can run in parallel [P]
- T009 (main function) depends on T006-T008 completing
- T010-T012 (component changes) depend on T009
- T013 (manual test) is the final validation

**User Story 2**:
- T014-T017 are sequential (state management flow)
- T018 (manual test) is the final validation

**User Story 3**:
- T019-T025 are mostly sequential (error handling flow)
- T022-T023 can be done in parallel with T019-T021 if different devs

**Polish Phase**:
- T026-T032 (tests) can all run in parallel [P]
- T033-T038 (docs) can run in parallel [P]
- T039-T043 (quality) should be sequential

### Parallel Opportunities

- **Phase 1 Setup**: All 3 tasks can run in parallel [T001-T003]
- **User Story 1 Helpers**: T006, T007, T008 can run in parallel
- **Polish Tests**: All test writing tasks T026-T032 can run in parallel
- **Different User Stories**: If team has capacity, US1, US2, US3 can be worked on by different developers simultaneously after Foundational phase completes

---

## Parallel Example: User Story 1

```bash
# Launch all helper functions together:
Task: "Create formatSymbolDisplay helper function in app/(dashboard)/market-monitor/utils/formatArbitrageMessage.ts"
Task: "Create getExchangeDisplayName helper function in app/(dashboard)/market-monitor/utils/formatArbitrageMessage.ts"
Task: "Create formatPercentageRange helper function in app/(dashboard)/market-monitor/utils/formatArbitrageMessage.ts"

# After helpers complete, create main function:
Task: "Create formatArbitrageMessage main function in app/(dashboard)/market-monitor/utils/formatArbitrageMessage.ts"

# Then modify component:
Task: "Add Copy button to RateRow component in app/(dashboard)/market-monitor/components/RateRow.tsx"
Task: "Implement handleCopy function in RateRow component using navigator.clipboard.writeText() API"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only) - Fastest Path to Value

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T005)
3. Complete Phase 3: User Story 1 (T006-T013)
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready - users can now copy arbitrage info!

**Estimated Time**: 2-3 hours for experienced developer

### Incremental Delivery (Recommended)

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!) 🎯
3. Add User Story 2 → Test independently → Deploy/Demo (Better UX)
4. Add User Story 3 → Test independently → Deploy/Demo (Production-ready)
5. Add Polish tasks as needed → Deploy/Demo (High quality)

**Estimated Time**: 4-6 hours total for all user stories

### Parallel Team Strategy

With 2 developers:

1. Both complete Setup + Foundational together (30 min)
2. Once Foundational is done:
   - **Developer A**: User Story 1 (T006-T013) - 1.5 hours
   - **Developer B**: User Story 2 (T014-T018) - 1 hour
3. **Developer B** then does User Story 3 (T019-T025) - 1 hour
4. Both collaborate on Polish tasks if needed

**Estimated Time**: 3-4 hours with 2 developers

---

## Task Summary

### Total Tasks by Phase

- **Phase 1 (Setup)**: 3 tasks
- **Phase 2 (Foundational)**: 2 tasks
- **Phase 3 (US1)**: 8 tasks
- **Phase 4 (US2)**: 5 tasks
- **Phase 5 (US3)**: 7 tasks
- **Phase 6 (Polish)**: 18 tasks (mostly optional)
- **Total**: 43 tasks

### Core Implementation (MVP)

- **Required for MVP**: T001-T013 (15 tasks)
- **Estimated Time**: 2-3 hours
- **Deliverable**: Working copy button with correct format

### Production-Ready

- **Required for Production**: T001-T025 (25 tasks)
- **Estimated Time**: 4-6 hours
- **Deliverable**: Complete feature with visual feedback and error handling

### With Full Testing

- **All Tasks**: T001-T043 (43 tasks)
- **Estimated Time**: 8-10 hours
- **Deliverable**: Production-ready feature with comprehensive test coverage

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Tests (T026-T032) are optional - include them for higher quality, skip for faster MVP
- Manual testing (T013, T018, T025) is mandatory to verify each story works
- Cross-browser testing (T036) is important for production deployment
- Can stop after US1 (T013) for MVP, or after US3 (T025) for complete feature

## Success Criteria Checklist

Based on spec.md Success Criteria, feature is complete when:

- [ ] **SC-001**: Copy operation completes in < 1 second (verify with T042)
- [ ] **SC-002**: Format is correct in Notepad, Excel, Telegram (verify with T037)
- [ ] **SC-003**: 95% success rate in modern browsers (verify with T036)
- [ ] **SC-004**: Visual feedback appears in < 500ms (verify with T018)
- [ ] **SC-005**: Error messages display on failure (verify with T025)

## Ready for Implementation

✅ All tasks defined with clear file paths
✅ Dependencies mapped out
✅ Parallel opportunities identified
✅ MVP scope defined (User Story 1 only)
✅ Independent test criteria for each story
✅ Estimated timelines provided

**Status**: READY FOR /speckit.implement
