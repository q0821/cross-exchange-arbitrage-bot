# Tasks: 資金費率間隔動態獲取

**Input**: Design documents from `/specs/017-funding-rate-intervals/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Test tasks are included based on quickstart.md test scenarios and spec.md acceptance criteria.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- **Single project**: `src/`, `tests/` at repository root
- Paths follow plan.md structure (CLI-focused, no Web UI changes)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and environment verification

- [X] T001 Verify Node.js >= 20.0.0 and pnpm >= 8.0.0 installed
- [X] T002 Verify current branch is `017-funding-rate-intervals`
- [X] T003 [P] Install all dependencies via `pnpm install`
- [X] T004 [P] Verify TypeScript compilation with `pnpm tsc --noEmit`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 Create `FundingIntervalCache` class in `src/lib/FundingIntervalCache.ts` with `set()`, `get()`, `setAll()`, `clear()`, `getStats()` methods
- [X] T006 [P] Create unit tests for `FundingIntervalCache` in `tests/unit/lib/FundingIntervalCache.test.ts` covering cache hit/miss, TTL expiration, stats tracking
- [X] T007 [P] Verify `ExchangeRateData` interface in `src/connectors/types.ts` includes optional `fundingInterval?: number` field
- [X] T008 Run unit tests for `FundingIntervalCache` with `pnpm test FundingIntervalCache` and ensure all pass

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Binance 4小時/8小時間隔動態偵測 (Priority: P1) 🎯 MVP

**Goal**: 修復 Binance 合約的資金費率間隔偵測，支援 4 小時和 8 小時間隔，解決 100% 標準化誤差問題

**Independent Test**: 使用 BLZUSDT (4h) 和 BTCUSDT (8h) 驗證系統正確識別各自間隔，且標準化計算符合預期（4h 費率 × 2 ≈ 8h 費率）

### Tests for User Story 1

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T009 [P] [US1] Create unit test file `tests/unit/connectors/binance.test.ts` for `BinanceConnector.getFundingInterval()` method
- [X] T010 [P] [US1] Write test case: should fetch 4h interval for BLZUSDT (mock API response with `fundingIntervalHours: 4`)
- [X] T011 [P] [US1] Write test case: should fetch 8h interval for BTCUSDT (mock API response with `fundingIntervalHours: 8`)
- [X] T012 [P] [US1] Write test case: should use default 8h when API fails (mock API rejection with network error)
- [X] T013 [P] [US1] Write test case: should cache interval values (verify API called once, second call uses cache)
- [X] T014 [US1] Run tests with `pnpm test binance.test.ts` and verify all FAIL (tests written, implementation not yet done)

### Implementation for User Story 1

- [X] T015 [US1] Add `intervalCache: FundingIntervalCache` instance to `BinanceConnector` class in `src/connectors/binance.ts` constructor
- [X] T016 [P] [US1] Implement `getFundingInterval(symbol: string): Promise<number>` method in `src/connectors/binance.ts` that calls `/fapi/v1/fundingInfo` API
- [X] T017 [P] [US1] Add cache check in `getFundingInterval()`: return cached value if exists and not expired
- [X] T018 [US1] Add API call logic in `getFundingInterval()`: call `this.client.futuresFundingInfo(symbol)` and parse `fundingIntervalHours` field
- [X] T019 [US1] Add validation in `getFundingInterval()`: warn if interval is not 4 or 8 (but still accept and cache it)
- [X] T020 [US1] Add error handling in `getFundingInterval()`: catch errors, log warning, return default 8h
- [X] T021 [US1] Add caching in `getFundingInterval()`: call `this.intervalCache.set('binance', symbol, interval, 'api')` before returning
- [X] T022 [US1] Add logging in `getFundingInterval()`: log interval source (api/cache/default) using Pino structured logging
- [X] T023 [US1] Modify `getFundingRate(symbol)` method in `src/connectors/binance.ts` to call `await this.getFundingInterval(symbol)` and populate `fundingInterval` field in returned `ExchangeRateData`
- [X] T024 [US1] Run unit tests with `pnpm test binance.test.ts` and verify all PASS

### Integration Tests for User Story 1

- [ ] T025 [P] [US1] Create integration test file `tests/integration/funding-intervals.test.ts` for real API calls
- [ ] T026 [P] [US1] Write integration test: should fetch real interval for BLZUSDT (4h) with 10s timeout
- [ ] T027 [P] [US1] Write integration test: should fetch real interval for BTCUSDT (8h) with 10s timeout
- [ ] T028 [US1] Run integration tests with `pnpm test:integration` and verify all PASS (requires network connection)

### Verification for User Story 1

- [ ] T029 [US1] Start monitoring service with `pnpm monitor:start` and verify logs show correct intervals for BLZUSDT (4h) and BTCUSDT (8h)
- [ ] T030 [US1] Verify cache mechanism: check logs show cache hits on second fetch for same symbol
- [ ] T031 [US1] Verify fallback mechanism: temporarily disable Binance API access and confirm system uses default 8h with warning log

**Checkpoint**: At this point, User Story 1 (Binance) should be fully functional and testable independently. System correctly identifies 4h vs 8h intervals for Binance contracts.

---

## Phase 4: User Story 2 - MEXC 與 Gate.io 間隔欄位擷取 (Priority: P2)

**Goal**: 從 MEXC 和 Gate.io API 獲取真實的資金費率間隔，測試 CCXT 是否暴露欄位，否則改用原生 API

**Independent Test**: 檢查系統日誌驗證 MEXC 和 Gate.io 的間隔值是否從 API 獲取（而非硬編碼），並測試當 CCXT 未暴露欄位時系統是否正確降級至原生 API 呼叫

### Tests for User Story 2

- [ ] T032 [P] [US2] Create unit test file `tests/unit/connectors/mexc.test.ts` for `MexcConnector.getFundingInterval()` method
- [ ] T033 [P] [US2] Write test case for MEXC: should parse `collectCycle` from CCXT response if available
- [ ] T034 [P] [US2] Write test case for MEXC: should fallback to native API if CCXT does not expose `collectCycle`
- [ ] T035 [P] [US2] Write test case for MEXC: should use default 8h when both CCXT and native API fail
- [ ] T036 [P] [US2] Create unit test file `tests/unit/connectors/gateio.test.ts` for `GateioConnector.getFundingInterval()` method
- [ ] T037 [P] [US2] Write test case for Gate.io: should parse `funding_interval` (in seconds) from CCXT response and convert to hours
- [ ] T038 [P] [US2] Write test case for Gate.io: should fallback to native API if CCXT does not expose `funding_interval`
- [ ] T039 [P] [US2] Write test case for Gate.io: should use default 8h when both CCXT and native API fail
- [ ] T040 [US2] Run tests with `pnpm test mexc.test.ts gateio.test.ts` and verify all FAIL (tests written, implementation not yet done)

### Implementation for User Story 2 - MEXC

- [ ] T041 [US2] Add `intervalCache: FundingIntervalCache` instance to `MexcConnector` class in `src/connectors/mexc.ts` constructor
- [ ] T042 [US2] Implement `getFundingInterval(symbol: string): Promise<number>` method in `src/connectors/mexc.ts`
- [ ] T043 [US2] Add CCXT test logic in MEXC `getFundingInterval()`: call CCXT `fetchFundingRate()` and check if `rate.info?.collectCycle` exists
- [ ] T044 [US2] Add native API fallback in MEXC `getFundingInterval()`: if CCXT fails, call MEXC native API `/api/v1/contract/funding_rate` and parse `collectCycle`
- [ ] T045 [US2] Add error handling in MEXC `getFundingInterval()`: catch errors, log warning with source (ccxt/native/default), return default 8h
- [ ] T046 [US2] Add caching in MEXC `getFundingInterval()`: cache result with appropriate source label
- [ ] T047 [US2] Modify `getFundingRate(symbol)` method in `src/connectors/mexc.ts` to populate `fundingInterval` field

### Implementation for User Story 2 - Gate.io

- [ ] T048 [US2] Add `intervalCache: FundingIntervalCache` instance to `GateioConnector` class in `src/connectors/gateio.ts` constructor
- [ ] T049 [US2] Implement `getFundingInterval(symbol: string): Promise<number>` method in `src/connectors/gateio.ts`
- [ ] T050 [US2] Add CCXT test logic in Gate.io `getFundingInterval()`: call CCXT `fetchFundingRate()` and check if `rate.info?.funding_interval` exists
- [ ] T051 [US2] Add unit conversion in Gate.io `getFundingInterval()`: convert `funding_interval` from seconds to hours (`funding_interval / 3600`)
- [ ] T052 [US2] Add native API fallback in Gate.io `getFundingInterval()`: if CCXT fails, call Gate.io native API `/api/v4/futures/usdt/contracts/{contract}` and parse `funding_interval`
- [ ] T053 [US2] Add error handling in Gate.io `getFundingInterval()`: catch errors, log warning with source, return default 8h
- [ ] T054 [US2] Add caching in Gate.io `getFundingInterval()`: cache result with appropriate source label
- [ ] T055 [US2] Modify `getFundingRate(symbol)` method in `src/connectors/gateio.ts` to populate `fundingInterval` field

### Verification for User Story 2

- [ ] T056 [US2] Run unit tests with `pnpm test mexc.test.ts gateio.test.ts` and verify all PASS
- [ ] T057 [US2] Start monitoring service and verify logs show interval source for MEXC (ccxt/native/default)
- [ ] T058 [US2] Start monitoring service and verify logs show interval source for Gate.io (ccxt/native/default)
- [ ] T059 [US2] Document in logs whether CCXT exposes interval fields for MEXC and Gate.io (for future reference)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently. System correctly fetches intervals from all 4 exchanges (Binance, OKX planned in US3, MEXC, Gate.io).

---

## Phase 5: User Story 3 - OKX 動態間隔計算機制 (Priority: P2)

**Goal**: 透過計算 `nextFundingTime - fundingTime` 時間戳差值推算 OKX 的動態間隔（1h/2h/4h/6h/8h），支援 OKX 的動態間隔調整機制

**Independent Test**: 驗證已知使用 4 小時間隔的 OKX 合約（如 API3-USDT-SWAP），系統是否正確計算間隔為 4 小時，並與 8 小時合約（如 BTC-USDT-SWAP）比較確認間隔偵測準確

### Tests for User Story 3

- [ ] T060 [P] [US3] Create unit test file `tests/unit/connectors/okx.test.ts` for `OkxConnector.getFundingInterval()` method
- [ ] T061 [P] [US3] Write test case: should calculate 8h interval from timestamps (mock `fundingTime` and `nextFundingTime` with 28800000ms difference)
- [ ] T062 [P] [US3] Write test case: should calculate 4h interval from timestamps (mock 14400000ms difference)
- [ ] T063 [P] [US3] Write test case: should validate timestamps (reject if `nextFundingTime <= fundingTime`)
- [ ] T064 [P] [US3] Write test case: should use default 8h when timestamps are invalid or missing
- [ ] T065 [US3] Run tests with `pnpm test okx.test.ts` and verify all FAIL (tests written, implementation not yet done)

### Implementation for User Story 3

- [ ] T066 [US3] Add `intervalCache: FundingIntervalCache` instance to `OkxConnector` class in `src/connectors/okx.ts` constructor
- [ ] T067 [US3] Implement `getFundingInterval(symbol: string): Promise<number>` method in `src/connectors/okx.ts`
- [ ] T068 [US3] Add timestamp calculation in OKX `getFundingInterval()`: call `fetchFundingRate()` to get `fundingTime` and `nextFundingTime`
- [ ] T069 [US3] Add validation in OKX `getFundingInterval()`: check both timestamps exist and `nextFundingTime > fundingTime`
- [ ] T070 [US3] Add interval calculation in OKX `getFundingInterval()`: compute `intervalMs = nextFundingTime - fundingTime`, then `intervalHours = intervalMs / 3600000`
- [ ] T071 [US3] Add caching in OKX `getFundingInterval()`: cache result with source 'calculated'
- [ ] T072 [US3] Add error handling in OKX `getFundingInterval()`: catch errors, log warning, return default 8h
- [ ] T073 [US3] Add logging in OKX `getFundingInterval()`: log interval and source ('calculated' or 'default')
- [ ] T074 [US3] Modify `getFundingRate(symbol)` method in `src/connectors/okx.ts` to populate `fundingInterval` field

### Integration Tests for User Story 3

- [ ] T075 [P] [US3] Add integration test in `tests/integration/funding-intervals.test.ts`: should fetch real interval for BTC-USDT-SWAP (8h)
- [ ] T076 [P] [US3] Add integration test: should fetch real interval for API3-USDT-SWAP (4h)
- [ ] T077 [US3] Run integration tests with `pnpm test:integration` and verify all PASS

### Verification for User Story 3

- [ ] T078 [US3] Run unit tests with `pnpm test okx.test.ts` and verify all PASS
- [ ] T079 [US3] Start monitoring service and verify logs show calculated intervals for OKX (BTC-USDT-SWAP: 8h, API3-USDT-SWAP: 4h)
- [ ] T080 [US3] Verify interval changes are detected: if OKX adjusts interval dynamically, next update should reflect new interval

**Checkpoint**: All user stories should now be independently functional. System correctly handles all 4 exchanges with dynamic interval detection.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories and final cleanup

- [ ] T081 Remove hardcoded default value from `src/services/monitor/FundingRateMonitor.ts` line 369: change `const originalInterval = rateData.fundingInterval || 8` to validate `fundingInterval` existence and log warning if missing
- [ ] T082 [P] Add structured logging for all connectors: ensure every `getFundingInterval()` call logs interval source (api/calculated/default) with exchange, symbol, interval values
- [ ] T083 [P] Verify cache statistics logging: add hourly log output of cache hit rate, size, API call savings using `intervalCache.getStats()`
- [ ] T084 Run full test suite with `pnpm test --run` and ensure all tests pass (unit + integration)
- [ ] T085 Run TypeScript compilation check with `pnpm tsc --noEmit` and fix any type errors
- [ ] T086 [P] Update quickstart.md with actual implementation results (verify all steps work as documented)
- [ ] T087 Perform end-to-end verification: start monitoring service, wait for 2 update cycles (10 minutes), verify all 100 symbols have correct intervals in logs
- [ ] T088 [P] Check code coverage with `pnpm test --coverage` and ensure > 80% coverage for new files
- [ ] T089 Run linter with `pnpm lint` and fix any linting errors
- [ ] T090 Commit changes with message: "feat(Feature 017): 實作資金費率間隔動態獲取功能"

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Independently testable, no dependencies on US1
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Independently testable, no dependencies on US1/US2

**CRITICAL**: All user stories are INDEPENDENT and can be implemented in parallel after Foundational phase completes.

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Models (if any) before services
- Services (connectors) before integration
- Core implementation before verification tasks
- All tasks within a story must complete before story is considered done

### Parallel Opportunities

- **Phase 1**: T003, T004 can run in parallel
- **Phase 2**: T006 can run in parallel after T005 completes
- **Phase 3 (US1)**: T009-T013 (all test writing tasks) can run in parallel, T016-T017 can run in parallel, T025-T027 can run in parallel
- **Phase 4 (US2)**: T032-T039 (all test writing tasks) can run in parallel, MEXC tasks (T041-T047) and Gate.io tasks (T048-T055) can run in parallel after tests written
- **Phase 5 (US3)**: T060-T064 (all test writing tasks) can run in parallel, T075-T076 can run in parallel
- **Phase 6**: T082, T083, T086, T088 can run in parallel
- **Cross-Story**: US1, US2, US3 can ALL be worked on in parallel by different developers after Foundational phase

---

## Parallel Example: User Story 1

```bash
# Launch all test writing tasks for User Story 1 together:
Task: "Create unit test file tests/unit/connectors/binance.test.ts" (T009)
Task: "Write test case: should fetch 4h interval for BLZUSDT" (T010)
Task: "Write test case: should fetch 8h interval for BTCUSDT" (T011)
Task: "Write test case: should use default 8h when API fails" (T012)
Task: "Write test case: should cache interval values" (T013)
# These 5 tasks can execute concurrently (different test cases in same file)

# Then after T015 completes, launch parallel implementation tasks:
Task: "Implement getFundingInterval() method" (T016)
Task: "Add cache check logic" (T017)
# These 2 tasks can execute concurrently (different methods/logic blocks)
```

## Parallel Example: Cross-Story

```bash
# After Foundational phase (T008) completes, launch ALL user stories in parallel:
Task: "User Story 1 - Binance implementation" (T009-T031)
Task: "User Story 2 - MEXC & Gate.io implementation" (T032-T059)
Task: "User Story 3 - OKX implementation" (T060-T080)
# These 3 user stories can execute concurrently (different connectors, independent)
```

---

## Implementation Strategy

### MVP Scope (Recommended for Initial Release)

**Focus on User Story 1 (P1) ONLY**:
- Tasks T001-T031 (Setup, Foundational, US1, partial Polish)
- Delivers immediate value: Fixes Binance 4h contract standardization error (100% accuracy improvement)
- Can be independently tested and deployed
- Estimated time: 2-4 hours

**Benefits of MVP-First Approach**:
- ✅ Quick win: Solves most critical issue (Binance is largest exchange)
- ✅ Validates architecture: Proves cache mechanism and API integration work
- ✅ Reduces risk: Smaller change set, easier to debug
- ✅ Faster feedback: Can deploy to production and monitor real-world behavior

### Full Feature Scope

**Include all User Stories (P1 + P2)**:
- Tasks T001-T090 (all phases)
- Covers all 4 exchanges with comprehensive interval detection
- Estimated time: 6-11 hours (as per plan.md)

**Incremental Delivery Path**:
1. **Week 1**: Deploy US1 (Binance) to production
2. **Week 2**: Monitor Binance intervals in production, gather confidence
3. **Week 3**: Add US3 (OKX) - second most critical exchange
4. **Week 4**: Add US2 (MEXC/Gate.io) - complete coverage
5. **Week 5**: Polish phase and final optimizations

---

## Task Summary

**Total Tasks**: 90

**By Phase**:
- Phase 1 (Setup): 4 tasks
- Phase 2 (Foundational): 4 tasks (BLOCKING)
- Phase 3 (US1 - Binance): 23 tasks
- Phase 4 (US2 - MEXC/Gate.io): 28 tasks
- Phase 5 (US3 - OKX): 21 tasks
- Phase 6 (Polish): 10 tasks

**By User Story**:
- User Story 1 (P1): 23 tasks (T009-T031)
- User Story 2 (P2): 28 tasks (T032-T059)
- User Story 3 (P2): 21 tasks (T060-T080)
- Cross-cutting: 18 tasks (Setup + Foundational + Polish)

**Parallel Opportunities**:
- 15 tasks marked [P] can run in parallel within their phase
- All 3 user stories can run in parallel after Foundational phase
- Estimated 40% time savings if parallelized with 3 developers

**Independent Test Criteria**:
- ✅ US1: BLZUSDT shows 4h interval, BTCUSDT shows 8h interval in logs
- ✅ US2: MEXC and Gate.io intervals logged with source (ccxt/native/default)
- ✅ US3: OKX BTC-USDT-SWAP shows 8h, API3-USDT-SWAP shows 4h in logs

**Format Validation**: ✅ All 90 tasks follow checklist format with checkbox, ID, [P]/[Story] labels, and file paths

---

**Generated**: 2025-11-19
**Status**: Ready for Implementation
**MVP Scope**: Tasks T001-T031 (User Story 1 only)
**Full Scope**: Tasks T001-T090 (All user stories)
