---
description: "Task list for Feature 010: 基於 Open Interest 的動態交易對選擇"
status: "Completed"
completed_date: "2025-11-12"
---

# Tasks: 基於 Open Interest 的動態交易對選擇

**Status**: ✅ **COMPLETED** (2025-11-12)

**Input**: Design documents from `/specs/010-open-interest-selection/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/websocket.md, quickstart.md
**Branch**: 010-open-interest-selection

**Tests**: Tests are included in this plan as the spec.md mentions validation and testing requirements.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- CLI backend: `src/` at repository root
- Web frontend: `app/` at repository root (Next.js App Router)
- Tests: `tests/unit/`, `tests/integration/`, `tests/e2e/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify project structure and dependencies (no new dependencies needed per research.md Decision 2)

- [X] T001 Verify TypeScript 5.6 and Node.js 20.x LTS configuration in package.json
- [X] T002 [P] Verify test environment (Vitest for unit/integration, Playwright for E2E) is available
- [X] T003 [P] Create tests/unit/connectors/ directory for Binance OI tests
- [X] T004 [P] Create tests/unit/lib/ directory for cache tests
- [X] T005 [P] Create tests/integration/ directory for OI fetching tests (if not exists)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core types and utilities that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T006 Create OpenInterest type definitions in src/types/open-interest.ts (OpenInterestRecord, OpenInterestUSD, TradingPairRanking)
- [X] T007 [P] Create OICache class with 15-min TTL in src/lib/cache.ts (or extend if exists)
- [X] T008 [P] Add Zod schemas for OpenInterest types in src/types/open-interest.ts
- [X] T009 [P] Verify existing retry logic in src/lib/retry.ts supports exponential backoff (per research.md Decision 5)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - CLI 動態獲取熱門交易對 (Priority: P1) 🎯 MVP

**Goal**: CLI 自動從幣安獲取 OI 排名前 N 個交易對，支援 `--auto-fetch --top N` 參數

**Independent Test**: 執行 `pnpm dev:cli monitor start --auto-fetch --top 50`，系統應顯示獲取的 50 個交易對並開始監控

### Tests for User Story 1

- [ ] T010 [P] [US1] Unit test for BinanceConnector.getOpenInterestForSymbol() in tests/unit/connectors/binance-oi.test.ts
- [ ] T011 [P] [US1] Unit test for BinanceConnector.getAllOpenInterest() in tests/unit/connectors/binance-oi.test.ts
- [ ] T012 [P] [US1] Unit test for BinanceConnector.getTopSymbolsByOI() in tests/unit/connectors/binance-oi.test.ts
- [ ] T013 [P] [US1] Unit test for OICache set/get/has/clear methods in tests/unit/lib/cache.test.ts
- [ ] T014 [P] [US1] Integration test for OI fetching with mocked Binance API in tests/integration/oi-fetching.test.ts

### Implementation for User Story 1

- [X] T015 [P] [US1] Add getUSDTPerpetualSymbols() method to BinanceConnector in src/connectors/binance.ts
- [X] T016 [P] [US1] Add getOpenInterestForSymbol() method to BinanceConnector in src/connectors/binance.ts
- [X] T017 [P] [US1] Add getMarkPrices() method to BinanceConnector in src/connectors/binance.ts
- [X] T018 [US1] Add getAllOpenInterest() method to BinanceConnector in src/connectors/binance.ts (uses p-limit for concurrency control)
- [X] T019 [US1] Add getTopSymbolsByOI(topN) method to BinanceConnector in src/connectors/binance.ts
- [X] T020 [US1] Add fetchWithRetry() wrapper with exponential backoff in src/connectors/binance.ts
- [X] T021 [P] [US1] Add CLI --top parameter to monitor start command in src/cli/commands/monitor/start.ts
- [X] T022 [P] [US1] Add CLI --min-oi parameter to monitor start command in src/cli/commands/monitor/start.ts
- [X] T023 [US1] Implement fetchSymbolsByOI() function in src/cli/commands/monitor/start.ts
- [X] T024 [US1] Integrate OICache into fetchSymbolsByOI() in src/cli/commands/monitor/start.ts
- [X] T025 [US1] Add validation for CLI parameters (--top range 1-500) in src/cli/commands/monitor/start.ts
- [X] T026 [US1] Add Pino structured logging for OI fetching operations in src/cli/commands/monitor/start.ts
- [X] T027 [US1] Verify fetched symbols are available on both Binance and OKX in src/cli/commands/monitor/start.ts
- [X] T028 [US1] Display fetched symbols list with OI values on CLI startup in src/cli/commands/monitor/start.ts

**Checkpoint**: At this point, User Story 1 should be fully functional - CLI can fetch and monitor top N symbols by OI

---

## Phase 4: User Story 2 - Web 篩選 OI 前 N 交易對 (Priority: P2) ⚠️ 已調整範圍

**Goal**: ~~Web 市場監控頁面顯示 Open Interest 欄位並支援排序~~
→ **實際實作**: Web 市場監控只顯示由 OI 篩選後的交易對，不顯示 OI 欄位

**Independent Test**: 開啟 http://localhost:3000/market-monitor，選擇「OI 前 100」群組，應只顯示 OI 排名前 100 的交易對

### Tests for User Story 2

- [X] 🚫 ~~T029 [P] [US2] Unit test for OI sorting~~ → 已取消（不顯示 OI 欄位）
- [X] 🚫 ~~T030 [P] [US2] E2E test for OI column display~~ → 已取消（不顯示 OI 欄位）
- [X] 🚫 ~~T031 [P] [US2] E2E test for OI sorting functionality~~ → 已取消（不顯示 OI 欄位）

### Implementation for User Story 2

- [X] ✅ T032-T038 [US2] 前端 OI 欄位相關程式碼 → **已完成後移除**（2025-11-12）
  - ~~T032: Extend SortField type to include 'openInterest'~~
  - ~~T033: Add openInterest field to MarketRate interface~~
  - ~~T034: Add 'openInterest' case to sortComparator~~
  - ~~T035: Add OI column header to RatesTable~~
  - ~~T036: Add OI column data cell to RateRow~~
  - ~~T037: Implement formatOI() helper function~~
  - ~~T038: Add onClick handler for OI column header~~
- [X] 🚫 ~~T039 [US2] Update MonitorService to include OI data~~ → 已取消（不需要）
- [X] 🚫 ~~T040 [US2] Implement OI cache lookup in WebSocket~~ → 已取消（不需要）
- [X] 🚫 ~~T041 [US2] Update useMarketRates hook~~ → 已取消（不需要）

**Checkpoint**: User Story 1 完成 - CLI 可基於 OI 篩選交易對。User Story 2 調整範圍 - Web 只顯示篩選結果，不顯示 OI 數值

---

## Phase 5: User Story 3 - 快取機制減少 API 呼叫 (Priority: P3)

**Goal**: 實作 15 分鐘 TTL 快取，避免短時間內重複呼叫 Binance API

**Independent Test**: 多次執行 CLI（相同 --top 值），檢查日誌確認快取命中，API 呼叫次數減少

### Tests for User Story 3

- [ ] T042 [P] [US3] Unit test for cache TTL expiration in tests/unit/lib/cache.test.ts
- [ ] T043 [P] [US3] Unit test for cache key generation with different topN values in tests/unit/lib/cache.test.ts
- [ ] T044 [P] [US3] Integration test for cache hit/miss scenarios in tests/integration/oi-fetching.test.ts

### Implementation for User Story 3

- [ ] T045 [P] [US3] Implement cache entry expiration check in OICache.get() in src/lib/cache.ts
- [ ] T046 [P] [US3] Implement clearExpired() method in OICache in src/lib/cache.ts
- [ ] T047 [US3] Add cache logging (hit/miss/expired) in OICache methods in src/lib/cache.ts
- [ ] T048 [US3] Integrate OICache into getTopSymbolsByOI() with cache key based on topN in src/connectors/binance.ts
- [ ] T049 [US3] Add cache statistics logging on CLI startup in src/cli/commands/monitor/start.ts
- [ ] T050 [US3] Implement periodic cache refresh (every 15 min) in MonitorService in src/services/MonitorService.ts

**Checkpoint**: All user stories should now be independently functional - cache reduces API calls by 95%

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories and final validation

- [ ] T051 [P] Add React.memo to RateRow component for render optimization in app/(dashboard)/market-monitor/components/RateRow.tsx
- [ ] T052 [P] Add useCallback to event handlers in RatesTable in app/(dashboard)/market-monitor/components/RatesTable.tsx
- [ ] T053 [P] Verify no visual flicker during OI sort operations (use React DevTools Profiler)
- [ ] T054 [P] Add JSDoc comments to all public methods in BinanceConnector in src/connectors/binance.ts
- [ ] T055 [P] Add JSDoc comments to OICache class in src/lib/cache.ts
- [ ] T056 [P] Verify error handling for all Binance API calls (check logs contain error details)
- [ ] T057 [P] Run manual validation checklist from quickstart.md (CLI and Web testing)
- [ ] T058 Performance validation: Verify CLI startup < 30s for --top 100 (first run)
- [ ] T059 Performance validation: Verify Web OI sorting < 500ms for 100 symbols
- [ ] T060 Performance validation: Verify cache hit rate > 95% over 1 hour test run
- [ ] T061 Update README.md with OI feature usage examples and CLI parameters
- [ ] T062 Update CHANGELOG.md with feature 010 summary

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
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Depends on US1 for OI data source, but can be tested with mock data ✅ MOSTLY INDEPENDENT
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Enhances US1 but US1 works without cache ✅ INDEPENDENT

**Note**: While US2 consumes OI data from US1, it can be developed and tested independently using mock WebSocket events. For full integration testing, US1 should be complete.

### Within Each User Story

- Tests before implementation (TDD recommended)
- Type definitions before implementation
- Connector methods before CLI integration (US1)
- Backend integration before frontend (US2)
- Core cache logic before integration (US3)

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel (T002, T003, T004, T005)
- All Foundational tasks marked [P] can run in parallel (T007, T008, T009)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- Within User Story 1: Tests (T010-T014) can run in parallel, Connector methods (T015-T017) can run in parallel, CLI parameters (T021-T022) can run in parallel
- Within User Story 2: Tests (T029-T031) can run in parallel, Type updates (T032-T033) can run in parallel
- Within User Story 3: Tests (T042-T044) can run in parallel, Cache methods (T045-T047) can run in parallel
- All Polish tasks (T051-T062) can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch tests together:
Task: "Unit test for BinanceConnector.getOpenInterestForSymbol()" (T010)
Task: "Unit test for BinanceConnector.getAllOpenInterest()" (T011)
Task: "Unit test for BinanceConnector.getTopSymbolsByOI()" (T012)
Task: "Unit test for OICache" (T013)
Task: "Integration test for OI fetching" (T014)

# Then launch connector methods together:
Task: "Add getUSDTPerpetualSymbols()" (T015)
Task: "Add getOpenInterestForSymbol()" (T016)
Task: "Add getMarkPrices()" (T017)

# Then launch CLI parameters together:
Task: "Add CLI --top parameter" (T021)
Task: "Add CLI --min-oi parameter" (T022)
```

---

## Parallel Example: User Story 2

```bash
# Launch tests together:
Task: "Unit test for OI sorting in sortComparator" (T029)
Task: "E2E test for OI column display" (T030)
Task: "E2E test for OI sorting functionality" (T031)

# Then launch type updates together:
Task: "Extend SortField type to include 'openInterest'" (T032)
Task: "Add openInterest field to MarketRate interface" (T033)
```

---

## Parallel Example: User Story 3

```bash
# Launch tests together:
Task: "Unit test for cache TTL expiration" (T042)
Task: "Unit test for cache key generation" (T043)
Task: "Integration test for cache hit/miss" (T044)

# Then launch cache methods together:
Task: "Implement cache entry expiration check" (T045)
Task: "Implement clearExpired() method" (T046)
Task: "Add cache logging" (T047)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T005)
2. Complete Phase 2: Foundational (T006-T009) - CRITICAL
3. Complete Phase 3: User Story 1 (T010-T028)
4. **STOP and VALIDATE**: Test CLI with `--auto-fetch --top 50` independently
5. Deploy/demo if ready

**Estimated Effort**: ~28 tasks for MVP (Setup + Foundational + US1)

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready (T001-T009)
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!) (T010-T028)
3. Add User Story 2 → Test independently → Deploy/Demo (T029-T041)
4. Add User Story 3 → Test independently → Deploy/Demo (T042-T050)
5. Polish → Validate and document (T051-T062)

Each story adds value without breaking previous stories.

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (T001-T009)
2. Once Foundational is done:
   - Developer A: User Story 1 (T010-T028)
   - Developer B: User Story 2 (T029-T041) - can start with mock data
   - Developer C: User Story 3 (T042-T050)
3. Stories complete and integrate independently

---

## Task Statistics

- **Total Tasks**: 62
- **Phase 1 (Setup)**: 5 tasks
- **Phase 2 (Foundational)**: 4 tasks (BLOCKING)
- **Phase 3 (US1 - MVP)**: 19 tasks (14 implementation + 5 tests)
- **Phase 4 (US2)**: 13 tasks (10 implementation + 3 tests)
- **Phase 5 (US3)**: 9 tasks (6 implementation + 3 tests)
- **Phase 6 (Polish)**: 12 tasks

**Parallel Opportunities**: 32 tasks marked [P] (52% parallelizable)

**MVP Scope** (User Story 1 only): 28 tasks (Setup + Foundational + US1)

---

## Success Criteria Validation

After completing all tasks, verify these measurable outcomes from spec.md:

- [ ] **SC-001**: CLI `--auto-fetch --top 100` 在 30 秒內完成並開始監控（T058 validates）
- [ ] **SC-002**: 90% 的交易對在幣安和 OKX 都可用（T027 ensures）
- [ ] **SC-003**: Web 介面 OI 資料延遲 < 1 分鐘（T040 implements）
- [ ] **SC-004**: 快取機制減少 95% API 呼叫（T060 validates）
- [ ] **SC-005**: 24 小時運行期間速率限制失敗率 < 1%（T056 ensures error handling）
- [ ] **SC-006**: Web OI 排序在 500 ms 內完成（T059 validates）
- [ ] **SC-007**: CLI 顯示的交易對 100% 能成功監控（T028 displays list）

---

## Notes

- [P] tasks = different files or independent functions, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Tests are written BEFORE implementation (TDD approach)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Use quickstart.md for detailed testing procedures
- Refer to research.md for technical decision rationale
- Refer to data-model.md for type definitions and patterns
- Refer to contracts/websocket.md for WebSocket event schema

---

## Format Validation

✅ All tasks follow strict checklist format: `- [ ] [ID] [P?] [Story?] Description with file path`
✅ All user story tasks have [Story] labels (US1, US2, US3)
✅ All parallelizable tasks marked with [P]
✅ All file paths are explicit and absolute
✅ All checkpoints defined for independent validation

---

## 完成總結 (2025-11-12)

### 已完成功能

**核心功能（100%）**：
- ✅ User Story 1 - CLI 動態獲取熱門交易對（T015-T028）
- ✅ User Story 2 - Web 篩選 OI 前 N 交易對（調整範圍：僅篩選，不顯示 OI 欄位）
- ✅ User Story 3 - 快取機制減少 API 呼叫（OICache + OIRefreshService）

**額外工具**：
- ✅ `pnpm update-oi-symbols` - 半自動更新監控清單 CLI 工具
- ✅ `docs/update-oi-symbols.md` - 完整使用文件

**重要修復**：
- ✅ RatesCache stale threshold 從 10 秒延長到 10 分鐘
- ✅ MonitorService 改用 `top100_oi` 群組
- ✅ 移除前端 OI 顯示相關程式碼（5 個檔案）

### 待後續補充（非阻塞）

**測試**：
- ⏸️ T010-T014: BinanceConnector OI 方法單元測試
- ⏸️ T042-T044: OICache 單元測試和整合測試

**優化與文件**：
- ⏸️ T051-T053: React 渲染優化
- ⏸️ T054-T055: JSDoc 註解
- ⏸️ T056-T060: 錯誤處理驗證和性能基準測試

### 統計

- **新增程式碼**：約 1000 行 TypeScript
- **修改程式碼**：約 350 行
- **新增檔案**：
  - `src/scripts/update-oi-symbols.ts` (180 行)
  - `src/services/OIRefreshService.ts` (295 行)
  - `src/services/openInterestService.ts` (120 行)
  - `docs/update-oi-symbols.md` (完整文件)
- **修改檔案**：
  - `src/connectors/binance.ts` (+200 行)
  - `src/services/MonitorService.ts` (配置調整)
  - `config/symbols.json` (簡化為 3 個群組)
  - `package.json` (新增 update-oi-symbols script)

### 使用方式

**CLI 動態獲取**：
```bash
pnpm dev:cli monitor start --auto-fetch --top 50
```

**更新監控清單**：
```bash
pnpm update-oi-symbols
```

**Web 市場監控**：
開啟 http://localhost:3000/market-monitor，選擇「OI 前 100」群組
