# Tasks: 修正 OKX 資金費率標準化

**Input**: Design documents from `/specs/024-fix-okx-funding-normalization/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: Tests are included in this feature based on User Story 5 requirements and best practices for TDD.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4, US5)
- Include exact file paths in descriptions

## Path Conventions
- **Single project**: `src/`, `tests/`, `scripts/` at repository root
- This is a backend CLI project (Node.js/TypeScript)
- Main modification file: `src/connectors/okx.ts`
- Cache implementation: `src/lib/FundingIntervalCache.ts`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 環境驗證和文件審查

- [X] T001 Review current OKX connector implementation in src/connectors/okx.ts (L98-169)
- [X] T002 [P] Review FundingIntervalCache implementation in src/lib/FundingIntervalCache.ts
- [X] T003 [P] Review existing OKX tests in tests/unit/connectors/okx.test.ts
- [X] T004 [P] Review integration tests in tests/integration/okx-funding-rate-validation.test.ts
- [X] T005 Verify Node.js version (should be v20.x) and dependencies installed with pnpm install

**Checkpoint**: Understanding complete - ready for implementation

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 擴充快取機制和類型定義，為所有 User Stories 提供基礎設施

**⚠️ CRITICAL**: 這個階段必須完成，才能開始任何 User Story 實作

- [X] T006 Update IntervalSource type definition in src/lib/FundingIntervalCache.ts (change 'api' to 'native-api')
- [X] T007 Add CachedIntervalMetadata interface in src/lib/FundingIntervalCache.ts
- [X] T008 [P] Implement getWithMetadata() method in src/lib/FundingIntervalCache.ts
- [X] T009 [P] Implement getAllWithMetadata() method in src/lib/FundingIntervalCache.ts
- [X] T010 Update Binance connector to use 'native-api' source in src/connectors/binance.ts
- [X] T011 Add unit tests for new cache methods in tests/unit/lib/FundingIntervalCache.test.ts
- [X] T012 Run cache tests to verify backward compatibility with pnpm test FundingIntervalCache.test.ts --run

**Checkpoint**: Foundation ready - cache infrastructure supports metadata queries, user story implementation can begin

---

## Phase 3: User Story 1 - 準確偵測 OKX 資金費率結算週期 (Priority: P1) 🎯 MVP

**Goal**: 正確識別每個 OKX 交易對的實際結算週期（1h/4h/8h），避免誤用預設值導致標準化計算錯誤

**Independent Test**: 手動查詢 10-20 個 OKX 交易對，驗證系統偵測的結算週期與 OKX API 實際返回的週期一致，準確率應達 95% 以上

### Tests for User Story 1

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T013 [P] [US1] Create test file tests/unit/connectors/okx-interval-detection.test.ts
- [X] T014 [P] [US1] Write test: should calculate interval from valid timestamps (8h) in tests/unit/connectors/okx-interval-detection.test.ts
- [X] T015 [P] [US1] Write test: should calculate interval from valid timestamps (4h) in tests/unit/connectors/okx-interval-detection.test.ts
- [X] T016 [P] [US1] Write test: should calculate interval from valid timestamps (1h) in tests/unit/connectors/okx-interval-detection.test.ts
- [X] T017 [P] [US1] Write test: should cache calculated interval with 'calculated' source in tests/unit/connectors/okx-interval-detection.test.ts
- [X] T018 [US1] Run tests to verify they FAIL (no implementation yet) with pnpm test okx-interval-detection.test.ts --run

### Implementation for User Story 1

- [X] T019 [US1] Add detailed logging when successfully calculating interval in src/connectors/okx.ts (after L143)
- [X] T020 [US1] Log original fundingTime and nextFundingTime with ISO format in src/connectors/okx.ts
- [X] T021 [US1] Log calculated interval with 'calculated' source marker in src/connectors/okx.ts
- [X] T022 [US1] Update intervalCache.set() call to use 'calculated' source in src/connectors/okx.ts (L154)
- [X] T023 [US1] Verify interval calculation logic is correct: (nextFundingTime - fundingTime) / 3600000 in src/connectors/okx.ts (L142)
- [X] T024 [US1] Run tests and verify T014-T017 now PASS with pnpm test okx-interval-detection.test.ts --run

**Checkpoint**: At this point, User Story 1 should be fully functional - CCXT path logs correctly and caches with source marker

---

## Phase 4: User Story 2 - 增強錯誤處理和詳細日誌 (Priority: P1)

**Goal**: 當間隔偵測過程中發生異常時，記錄詳細的診斷資訊，幫助開發者快速定位問題根源

**Independent Test**: 模擬各種錯誤情況（CCXT 失敗、時間戳無效、網路超時），檢查系統日誌是否包含足夠的診斷資訊（錯誤類型、原始數據、降級路徑）

### Tests for User Story 2

- [X] T025 [P] [US2] Write test: should log warning when fundingTime is missing in tests/unit/connectors/okx-interval-detection.test.ts
- [X] T026 [P] [US2] Write test: should log warning when nextFundingTime is missing in tests/unit/connectors/okx-interval-detection.test.ts
- [X] T027 [P] [US2] Write test: should log error when timestamp parsing returns NaN in tests/unit/connectors/okx-interval-detection.test.ts
- [X] T028 [P] [US2] Write test: should log error when nextFundingTime <= fundingTime in tests/unit/connectors/okx-interval-detection.test.ts
- [X] T029 [P] [US2] Write test: should log error when calculated interval is non-positive in tests/unit/connectors/okx-interval-detection.test.ts
- [X] T030 [US2] Run tests to verify they FAIL with pnpm test okx-interval-detection.test.ts --run

### Implementation for User Story 2

- [X] T031 [US2] Enhance warning log when fundingTime/nextFundingTime missing in src/connectors/okx.ts (L118-125)
- [X] T032 [US2] Add available info fields to warning log (Object.keys(info)) in src/connectors/okx.ts
- [X] T033 [US2] Add raw timestamp values to warning log in src/connectors/okx.ts
- [X] T034 [US2] Enhance warning log for invalid timestamps in src/connectors/okx.ts (L132-139)
- [X] T035 [US2] Include parsed values and expected range in timestamp validation error in src/connectors/okx.ts
- [X] T036 [US2] Enhance warning log for non-positive intervals in src/connectors/okx.ts (L145-152)
- [X] T037 [US2] Include calculated value in non-positive interval error in src/connectors/okx.ts
- [X] T038 [US2] Add structured logging context (symbol, exchange, error type) to all error paths in src/connectors/okx.ts
- [X] T039 [US2] Run tests and verify T025-T029 now PASS with pnpm test okx-interval-detection.test.ts --run

**Checkpoint**: At this point, User Stories 1 AND 2 work - CCXT path has detailed logging for debugging

---

## Phase 5: User Story 3 - Native API 降級方案 (Priority: P2)

**Goal**: 當 CCXT 無法正確獲取間隔時，自動切換到 OKX Native API 作為備援，確保間隔偵測的可靠性

**Independent Test**: 強制 CCXT 失敗（mock 或斷網），驗證系統自動啟動 Native API 請求並成功取得正確的結算週期

### Tests for User Story 3

- [X] T040 [P] [US3] Write test: should call Native API when CCXT fundingTime is missing in tests/unit/connectors/okx-interval-detection.test.ts
- [X] T041 [P] [US3] Write test: should parse Native API response correctly in tests/unit/connectors/okx-interval-detection.test.ts
- [X] T042 [P] [US3] Write test: should cache Native API result with 'native-api' source in tests/unit/connectors/okx-interval-detection.test.ts
- [X] T043 [P] [US3] Write test: should handle 51001 error (invalid instId) in tests/unit/connectors/okx-interval-detection.test.ts
- [X] T044 [P] [US3] Write test: should handle 50011 error (rate limit) with retry in tests/unit/connectors/okx-interval-detection.test.ts
- [X] T045 [P] [US3] Write test: should handle network timeout in tests/unit/connectors/okx-interval-detection.test.ts
- [X] T046 [US3] Run tests to verify they FAIL with pnpm test okx-interval-detection.test.ts --run

### Implementation for User Story 3

- [X] T047 [US3] Create getFundingIntervalFromNativeAPI() private method in src/connectors/okx.ts
- [X] T048 [US3] Implement instId format conversion (BTCUSDT -> BTC-USDT-SWAP) in getFundingIntervalFromNativeAPI() in src/connectors/okx.ts
- [X] T049 [US3] Implement axios GET request to https://www.okx.com/api/v5/public/funding-rate in src/connectors/okx.ts
- [X] T050 [US3] Parse response and extract fundingTime, nextFundingTime from data[0] in src/connectors/okx.ts
- [X] T051 [US3] Calculate interval from Native API timestamps in src/connectors/okx.ts
- [X] T052 [US3] Add error handling for OKX API errors (51001, 50011, 50013) in src/connectors/okx.ts
- [X] T053 [US3] Add timeout configuration (5000ms) to axios request in src/connectors/okx.ts
- [X] T054 [US3] Integrate Native API fallback into getFundingInterval() method in src/connectors/okx.ts (after L125)
- [X] T055 [US3] Log when falling back to Native API in src/connectors/okx.ts
- [X] T056 [US3] Cache Native API result with 'native-api' source in src/connectors/okx.ts
- [X] T057 [US3] Implement retry logic with exponential backoff for rate limit errors in src/connectors/okx.ts
- [X] T058 [US3] Run tests and verify T040-T045 now PASS with pnpm test okx-interval-detection.test.ts --run

**Checkpoint**: All core fallback logic complete - CCXT failure triggers Native API, which successfully retrieves intervals

---

## Phase 6: User Story 4 - 間隔合理性驗證 (Priority: P2)

**Goal**: 驗證計算出的間隔是否符合標準值（1, 4, 8 小時），對異常值進行四捨五入修正，避免資料錯誤

**Independent Test**: 模擬不同的時間戳差值（標準值、接近標準值、完全異常值），驗證系統的驗證邏輯和修正行為是否符合預期

### Tests for User Story 4

- [ ] T059 [P] [US4] Write test: should accept exact standard intervals (1, 4, 8) in tests/unit/connectors/okx-interval-detection.test.ts
- [ ] T060 [P] [US4] Write test: should round 7.9h to 8h with deviation warning in tests/unit/connectors/okx-interval-detection.test.ts
- [ ] T061 [P] [US4] Write test: should round 8.1h to 8h with deviation warning in tests/unit/connectors/okx-interval-detection.test.ts
- [ ] T062 [P] [US4] Write test: should round 3.8h to 4h in tests/unit/connectors/okx-interval-detection.test.ts
- [ ] T063 [P] [US4] Write test: should round 1.1h to 1h in tests/unit/connectors/okx-interval-detection.test.ts
- [ ] T064 [P] [US4] Write test: should warn when deviation > 0.5h (e.g., 6h -> 8h) in tests/unit/connectors/okx-interval-detection.test.ts
- [ ] T065 [P] [US4] Write test: should reject non-positive intervals (0, -1) in tests/unit/connectors/okx-interval-detection.test.ts
- [ ] T066 [US4] Run tests to verify they FAIL with pnpm test okx-interval-detection.test.ts --run

### Implementation for User Story 4

- [ ] T067 [US4] Create validateAndRoundInterval() private method in src/connectors/okx.ts
- [ ] T068 [US4] Define VALID_INTERVALS constant [1, 4, 8] in src/connectors/okx.ts
- [ ] T069 [US4] Define TOLERANCE constant 0.5 hours in src/connectors/okx.ts
- [ ] T070 [US4] Implement positive number validation in validateAndRoundInterval() in src/connectors/okx.ts
- [ ] T071 [US4] Implement closest interval finder logic in validateAndRoundInterval() in src/connectors/okx.ts
- [ ] T072 [US4] Calculate deviation from closest standard value in validateAndRoundInterval() in src/connectors/okx.ts
- [ ] T073 [US4] Log warning when deviation > 0.5h in validateAndRoundInterval() in src/connectors/okx.ts
- [ ] T074 [US4] Return validation result with interval, rounded flag, deviation in validateAndRoundInterval() in src/connectors/okx.ts
- [ ] T075 [US4] Integrate validateAndRoundInterval() into CCXT path after interval calculation in src/connectors/okx.ts (after L142)
- [ ] T076 [US4] Integrate validateAndRoundInterval() into Native API path in src/connectors/okx.ts
- [ ] T077 [US4] Log when interval is rounded with original and final values in src/connectors/okx.ts
- [ ] T078 [US4] Run tests and verify T059-T065 now PASS with pnpm test okx-interval-detection.test.ts --run

**Checkpoint**: All validation logic complete - intervals are verified and rounded to standard values

---

## Phase 7: User Story 5 - 診斷工具和完整測試覆蓋 (Priority: P3)

**Goal**: 提供診斷腳本和完整測試覆蓋，確保修復的正確性和長期穩定性

**Independent Test**: 執行診斷腳本對比 CCXT 和 Native API 結果，檢查是否一致；測試覆蓋率報告應顯示 > 90% 的覆蓋率

### Diagnostic Tool Implementation

- [ ] T079 [US5] Create diagnostic script file scripts/test-okx-funding-interval.mjs
- [ ] T080 [US5] Define TEST_SYMBOLS array with 10 OKX symbols in scripts/test-okx-funding-interval.mjs
- [ ] T081 [US5] Implement testCCXT() function to query via CCXT in scripts/test-okx-funding-interval.mjs
- [ ] T082 [US5] Implement testNativeAPI() function to query via OKX API in scripts/test-okx-funding-interval.mjs
- [ ] T083 [US5] Implement runDiagnostic() main function in scripts/test-okx-funding-interval.mjs
- [ ] T084 [US5] Format output as comparison table (Symbol, CCXT, Native, Match, Deviation) in scripts/test-okx-funding-interval.mjs
- [ ] T085 [US5] Add summary statistics (Total, Matched, Mismatched, Errors) in scripts/test-okx-funding-interval.mjs
- [ ] T086 [US5] Add batch delay (200ms) to avoid rate limiting in scripts/test-okx-funding-interval.mjs
- [ ] T087 [US5] Test diagnostic tool execution with node scripts/test-okx-funding-interval.mjs
- [ ] T088 [US5] Verify diagnostic completes in < 30 seconds for 10 symbols

### Integration Tests

- [ ] T089 [US5] Create integration test file tests/integration/okx-funding-interval.test.ts
- [ ] T090 [P] [US5] Write integration test: should detect intervals for top 10 OKX symbols in tests/integration/okx-funding-interval.test.ts
- [ ] T091 [P] [US5] Write integration test: should match CCXT and Native API results in tests/integration/okx-funding-interval.test.ts
- [ ] T092 [P] [US5] Write integration test: should cache intervals correctly on first and second call in tests/integration/okx-funding-interval.test.ts
- [ ] T093 [P] [US5] Write integration test: should verify all intervals are standard values (1, 4, 8) in tests/integration/okx-funding-interval.test.ts
- [ ] T094 [US5] Run integration tests with pnpm test okx-funding-interval.test.ts --run

### Test Coverage Verification

- [ ] T095 [US5] Run all OKX tests with coverage: pnpm test okx --coverage
- [ ] T096 [US5] Verify line coverage > 90% for src/connectors/okx.ts
- [ ] T097 [US5] Verify branch coverage > 85% for error paths
- [ ] T098 [US5] Identify and add tests for any uncovered branches

**Checkpoint**: All user stories complete, diagnostic tool working, test coverage meets targets

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, documentation, and deployment preparation

- [ ] T099 Run full test suite with pnpm test --run
- [ ] T100 Run TypeScript type check with pnpm tsc --noEmit
- [ ] T101 [P] Run ESLint with pnpm lint
- [ ] T102 [P] Fix any linting warnings
- [ ] T103 Verify no console.log statements in production code (grep -r "console.log" src/)
- [ ] T104 Update CHANGELOG.md with feature changes
- [ ] T105 [P] Review and update JSDoc comments in src/connectors/okx.ts
- [ ] T106 [P] Review and update JSDoc comments in src/lib/FundingIntervalCache.ts
- [ ] T107 Verify all error paths have appropriate log levels (error, warn, info)
- [ ] T108 Run diagnostic tool final validation with node scripts/test-okx-funding-interval.mjs
- [ ] T109 Manual test: Start monitor service and observe OKX interval logs with pnpm start
- [ ] T110 Manual test: Verify interval detection accuracy by comparing with OKX website
- [ ] T111 Manual test: Verify cache hit rate > 80% on second query
- [ ] T112 Manual test: Verify default interval usage < 5% in logs
- [ ] T113 Commit changes with conventional commit message: "fix(okx): 修正資金費率間隔偵測邏輯"

**Checkpoint**: All validation complete - ready for code review and deployment

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - User stories CAN proceed in priority order (US1 → US2 → US3 → US4 → US5)
  - OR work on multiple stories in parallel (if team capacity allows)
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1 MVP)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Depends on US1 (enhances logging in same code path)
- **User Story 3 (P2)**: Depends on US1, US2 (adds fallback to same code path)
- **User Story 4 (P2)**: Depends on US1, US2, US3 (adds validation to all paths)
- **User Story 5 (P3)**: Can start anytime (diagnostic tool independent, tests can be written first)

**Note**: Due to all tasks modifying the same file (src/connectors/okx.ts), sequential implementation is recommended to avoid merge conflicts.

### Within Each User Story

- Tests MUST be written and FAIL before implementation (TDD approach)
- Implementation tasks proceed in logical order
- Run tests after implementation to verify they PASS
- Story complete before moving to next priority

### Parallel Opportunities

- **Phase 1 (Setup)**: T002, T003, T004 can run in parallel (reading different files)
- **Phase 2 (Foundational)**: T008, T009 can run in parallel (different methods in same class)
- **Within US1 Tests**: T014, T015, T016, T017 can run in parallel (different test cases)
- **Within US2 Tests**: T025-T029 can run in parallel (different test cases)
- **Within US3 Tests**: T040-T045 can run in parallel (different test cases)
- **Within US4 Tests**: T059-T065 can run in parallel (different test cases)
- **Within US5 Integration Tests**: T090-T093 can run in parallel (different test cases)
- **Phase 8 (Polish)**: T101, T102, T105, T106 can run in parallel (different concerns)

---

## Parallel Example: User Story 1

```bash
# Write all tests for User Story 1 together:
Task: "[US1] Write test: should calculate interval from valid timestamps (8h)"
Task: "[US1] Write test: should calculate interval from valid timestamps (4h)"
Task: "[US1] Write test: should calculate interval from valid timestamps (1h)"
Task: "[US1] Write test: should cache calculated interval with 'calculated' source"
```

---

## Implementation Strategy

### MVP First (User Story 1 + 2 Only)

1. Complete Phase 1: Setup (5 tasks)
2. Complete Phase 2: Foundational (7 tasks) - CRITICAL
3. Complete Phase 3: User Story 1 (12 tasks) - Core interval detection
4. Complete Phase 4: User Story 2 (15 tasks) - Enhanced logging
5. **STOP and VALIDATE**: Test US1+US2 independently
6. Can deploy this minimal fix if urgent (accurate detection + debugging info)

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Basic interval detection works (MVP!)
3. Add User Story 2 → Test independently → Adds detailed error logging
4. Add User Story 3 → Test independently → Adds Native API fallback
5. Add User Story 4 → Test independently → Adds interval validation
6. Add User Story 5 → Test independently → Adds diagnostic tools
7. Complete Polish → Full validation
8. Each story adds value without breaking previous stories

### Sequential Implementation (Recommended)

Since all tasks modify the same file (src/connectors/okx.ts), sequential implementation is recommended:

1. Complete Setup + Foundational (necessary infrastructure)
2. US1: Core CCXT path with logging
3. US2: Enhanced error logging
4. US3: Native API fallback
5. US4: Interval validation
6. US5: Diagnostic tools and tests
7. Polish: Full validation and cleanup

---

## Notes

- [P] tasks = different files or independent test cases, no dependencies
- [Story] label maps task to specific user story for traceability
- All user stories modify the same file (src/connectors/okx.ts), so sequential implementation avoids merge conflicts
- Tests follow TDD: write tests first, ensure they fail, then implement
- Commit after each user story phase completion
- Stop at any checkpoint to validate story independently
- Follow research.md decisions for all technical implementations
- Follow contracts/ specifications for API integration
- Use quickstart.md for development workflow guidance
- Estimated total time: 6-8 hours for all phases

## Task Count Summary

- **Phase 1 (Setup)**: 5 tasks
- **Phase 2 (Foundational)**: 7 tasks (BLOCKS all stories)
- **Phase 3 (US1)**: 12 tasks (6 tests + 6 implementation)
- **Phase 4 (US2)**: 15 tasks (6 tests + 9 implementation)
- **Phase 5 (US3)**: 19 tasks (7 tests + 12 implementation)
- **Phase 6 (US4)**: 20 tasks (8 tests + 12 implementation)
- **Phase 7 (US5)**: 20 tasks (10 diagnostic + 10 tests)
- **Phase 8 (Polish)**: 15 tasks

**Total**: 113 tasks

**MVP (US1 + US2)**: 39 tasks (Setup + Foundational + US1 + US2)
**Parallel Opportunities**: 27 tasks marked [P] can run in parallel within their phases
**Test Tasks**: 37 test tasks (32% of total, ensuring quality)

---

**Generated**: 2025-01-27
**Feature**: 024-fix-okx-funding-normalization
**Branch**: `024-fix-okx-funding-normalization`
**Status**: Ready for implementation
