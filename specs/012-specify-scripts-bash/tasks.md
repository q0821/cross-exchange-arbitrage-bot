---
description: "Task list for implementing standardized funding rate and net profit calculation"
---

# Tasks: 標準化資金費率時間與淨收益計算

**Input**: Design documents from `/specs/012-specify-scripts-bash/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/websocket.md, quickstart.md

**Tests**: This feature does NOT explicitly request tests in the specification. Test tasks are NOT included. Testing will be done manually via quickstart.md validation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- **Hybrid project**: CLI backend (`src/services/`, `src/lib/`), Next.js frontend (`app/(dashboard)/market-monitor/`)
- Paths follow existing repository structure

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies and setup basic utilities

- [ ] T001 Install decimal.js dependency for precise financial calculations: `pnpm add decimal.js`
- [ ] T002 [P] Create funding rate normalization utility in `src/lib/fundingRateUtils.ts`
- [ ] T003 [P] Create Zod validation schemas in `src/lib/validation/fundingRateSchemas.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core services and models that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Create `FundingRateNormalizer` service in `src/services/monitor/FundingRateNormalizer.ts`
- [ ] T005 Create `NetProfitCalculator` service in `src/services/calculation/NetProfitCalculator.ts`
- [ ] T006 [P] Add interval detection logic to existing exchange connectors in `src/lib/ccxt/`
- [ ] T007 [P] Create `NormalizedFundingRate` TypeScript interface in `src/types/normalized-rates.ts`
- [ ] T008 [P] Create `NetProfitCalculation` TypeScript interface in `src/types/net-profit.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - 標準化資金費率時間顯示 (Priority: P1) 🎯 MVP

**Goal**: 將不同交易所的資金費率標準化為統一時間基準，讓交易者能直接比較不同結算週期的費率

**Independent Test**: 在市場監控頁面選擇兩個具有不同結算週期的交易所（例如 Binance 8 小時 vs OKX 1 小時），驗證系統是否正確將費率標準化並顯示為相同時間基準的費率值

### Implementation for User Story 1

**Backend (CLI Monitor)**:

- [ ] T009 [US1] Integrate `FundingRateNormalizer` into `FundingRateMonitor` service in `src/services/monitor/FundingRateMonitor.ts`
- [ ] T010 [US1] Add funding interval detection for Binance in `src/lib/ccxt/binance-connector.ts`
- [ ] T011 [P] [US1] Add funding interval detection for OKX in `src/lib/ccxt/okx-connector.ts`
- [ ] T012 [P] [US1] Add funding interval detection for MEXC in `src/lib/ccxt/mexc-connector.ts`
- [ ] T013 [P] [US1] Add funding interval detection for Gate.io in `src/lib/ccxt/gateio-connector.ts`
- [ ] T014 [US1] Update `RatesCache` to store normalized rates in `src/services/monitor/RatesCache.ts`

**WebSocket Server**:

- [ ] T015 [US1] Extend `market-rates-update` event payload in `src/services/websocket/MarketRatesHandler.ts` to include `normalizedRate`, `originalFundingInterval`, `targetTimeBasis`
- [ ] T016 [US1] Add `set-time-basis` event handler in `src/services/websocket/MarketRatesHandler.ts`

**Frontend (React)**:

- [ ] T017 [P] [US1] Update `MarketRatesUpdatePayload` TypeScript interface in `app/(dashboard)/market-monitor/types.ts`
- [ ] T018 [US1] Modify `useMarketRates` hook to handle normalized rate fields in `app/(dashboard)/market-monitor/useMarketRates.ts`
- [ ] T019 [US1] Create `TimeBasisSelector` component in `app/(dashboard)/market-monitor/components/TimeBasisSelector.tsx`
- [ ] T020 [US1] Update `RatesTable` component to display normalized rates in `app/(dashboard)/market-monitor/components/RatesTable.tsx`
- [ ] T021 [US1] Update `RateRow` component to show original funding interval tooltip in `app/(dashboard)/market-monitor/components/RateRow.tsx`
- [ ] T022 [US1] Add localStorage persistence for time basis preference in `app/(dashboard)/market-monitor/utils/preferences.ts`

**Logging & Error Handling**:

- [ ] T023 [US1] Add structured logging for normalization calculations in `FundingRateNormalizer.ts`
- [ ] T024 [US1] Add error handling for missing interval data in `FundingRateNormalizer.ts`

**Checkpoint**: At this point, User Story 1 should be fully functional - users can see normalized rates across all exchanges with unified time basis

---

## Phase 4: User Story 2 - 重新計算淨收益邏輯 (Priority: P1)

**Goal**: 提供正確的淨收益計算，考慮標準化後的資金費率以及實際的套利成本（4 筆交易手續費 0.2%）

**Independent Test**: 選擇一個具體的套利場景（例如 BTCUSDT 在 Binance long 和 OKX short），手動計算預期淨收益（包含費率差、手續費 0.2%），並與系統顯示的淨收益進行比對驗證

### Implementation for User Story 2

**Backend (CLI Monitor)**:

- [ ] T025 [US2] Integrate `NetProfitCalculator` into `FundingRateMonitor` service in `src/services/monitor/FundingRateMonitor.ts`
- [ ] T026 [US2] Implement best arbitrage pair detection logic in `NetProfitCalculator.ts` (find max rate difference across 4 exchanges)
- [ ] T027 [US2] Add default taker fee rate configuration in `src/config/tradingConfig.ts` (0.0005 per trade, 0.002 total)

**WebSocket Server**:

- [ ] T028 [US2] Extend `market-rates-update` event payload to include `bestArbitragePair` and `netProfitDetails` in `src/services/websocket/MarketRatesHandler.ts`

**Frontend (React)**:

- [ ] T029 [P] [US2] Update `MarketRatesUpdatePayload` interface to include net profit fields in `app/(dashboard)/market-monitor/types.ts`
- [ ] T030 [US2] Update `RateRow` component to display net profit with color coding in `app/(dashboard)/market-monitor/components/RateRow.tsx`
- [ ] T031 [US2] Create net profit details tooltip component in `app/(dashboard)/market-monitor/components/NetProfitTooltip.tsx`
- [ ] T032 [US2] Add formatting utility for Decimal values in `app/(dashboard)/market-monitor/utils/formatters.ts`

**Logging & Validation**:

- [ ] T033 [US2] Add structured logging for net profit calculations in `NetProfitCalculator.ts`
- [ ] T034 [US2] Add validation for negative net profit scenarios in `NetProfitCalculator.ts`

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - users can see both normalized rates and correct net profit calculations

---

## Phase 5: User Story 3 - 市場監控頁面顯示優化 (Priority: P2)

**Goal**: 提升市場監控頁面的使用者體驗，提供排序、篩選功能，讓交易者能快速找到最佳套利機會

**Independent Test**: 在市場監控頁面測試排序功能（按淨收益排序），驗證排序結果是否正確，以及是否能快速找到最高淨收益的交易對

### Implementation for User Story 3

**Frontend (React)**:

- [ ] T035 [P] [US3] Add sort state management in `useMarketRates` hook in `app/(dashboard)/market-monitor/useMarketRates.ts`
- [ ] T036 [P] [US3] Create `SortableHeader` component in `app/(dashboard)/market-monitor/components/SortableHeader.tsx`
- [ ] T037 [US3] Implement useMemo sorting logic for net profit in `app/(dashboard)/market-monitor/useMarketRates.ts`
- [ ] T038 [US3] Implement useMemo sorting logic for rate difference in `app/(dashboard)/market-monitor/useMarketRates.ts`
- [ ] T039 [US3] Add localStorage persistence for sort preferences in `app/(dashboard)/market-monitor/utils/preferences.ts`
- [ ] T040 [US3] Update `RatesTable` component to integrate sortable headers in `app/(dashboard)/market-monitor/components/RatesTable.tsx`
- [ ] T041 [US3] Add visual indicators for best arbitrage opportunities in `app/(dashboard)/market-monitor/components/RateRow.tsx`
- [ ] T042 [US3] Create info tooltip for calculation details in `app/(dashboard)/market-monitor/components/CalculationInfoTooltip.tsx`

**UI Polish**:

- [ ] T043 [US3] Add red text styling for negative net profit in `app/(dashboard)/market-monitor/components/RateRow.tsx`
- [ ] T044 [US3] Add "Stale data" indicator for old rates in `app/(dashboard)/market-monitor/components/RateRow.tsx`

**Checkpoint**: All user stories should now be independently functional - users can view, understand, and sort standardized rates with correct net profit

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories and final validation

- [ ] T045 [P] Update quickstart.md with validation scenarios for all 3 user stories in `specs/012-specify-scripts-bash/quickstart.md`
- [ ] T046 [P] Add JSDoc comments to all new services and utilities
- [ ] T047 Run quickstart.md validation: verify normalized rates display correctly
- [ ] T048 Run quickstart.md validation: verify net profit calculation matches manual calculation
- [ ] T049 Run quickstart.md validation: verify sorting by net profit works correctly
- [ ] T050 Code cleanup: remove any console.log statements, ensure consistent code style
- [ ] T051 Performance check: verify WebSocket update frequency <= 1 update per 5 seconds per symbol

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User Story 1 (P1) can start after Foundational
  - User Story 2 (P1) can start after Foundational (integrates with US1 but independently testable)
  - User Story 3 (P2) can start after Foundational (builds on US1+US2 but independently testable)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - Uses normalized rates from US1 but can test independently
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Displays data from US1+US2 but can test sorting logic independently

### Within Each User Story

- Backend services before WebSocket extension
- WebSocket extension before frontend updates
- Frontend types before components
- Core components before UI polish

### Parallel Opportunities

- **Phase 1**: All 3 tasks can run in parallel
- **Phase 2**: T007, T008 can run in parallel; T006 can run in parallel with connector updates
- **User Story 1**: T011-T013 (exchange connectors) can run in parallel; T017 and T019 can run in parallel
- **User Story 2**: T029 and T032 can run in parallel
- **User Story 3**: T035 and T036 can run in parallel
- **Phase 6**: T045 and T046 can run in parallel

**Different user stories can be worked on in parallel by different team members after Phase 2 completes**

---

## Parallel Example: User Story 1

```bash
# Launch all exchange connector updates together:
Task: "Add funding interval detection for OKX in src/lib/ccxt/okx-connector.ts"
Task: "Add funding interval detection for MEXC in src/lib/ccxt/mexc-connector.ts"
Task: "Add funding interval detection for Gate.io in src/lib/ccxt/gateio-connector.ts"

# Launch frontend type and component in parallel:
Task: "Update MarketRatesUpdatePayload TypeScript interface in app/(dashboard)/market-monitor/types.ts"
Task: "Create TimeBasisSelector component in app/(dashboard)/market-monitor/components/TimeBasisSelector.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (install decimal.js, create utilities)
2. Complete Phase 2: Foundational (create normalizer and calculator services)
3. Complete Phase 3: User Story 1 (normalized rate display)
4. **STOP and VALIDATE**: Test User Story 1 independently using quickstart.md
5. Deploy/demo normalized rate feature

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP with normalized rates!)
3. Add User Story 2 → Test independently → Deploy/Demo (add net profit calculations)
4. Add User Story 3 → Test independently → Deploy/Demo (add sorting and UI polish)
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (normalized rates)
   - Developer B: User Story 2 (net profit) - can start in parallel
   - Developer C: User Story 3 (UI polish) - can start in parallel
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- No formal test tasks included - validation via quickstart.md manual testing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- CRITICAL: Use Decimal.js for ALL financial calculations (rates, fees, profits)
- CRITICAL: Maintain backward compatibility - all new WebSocket fields are optional
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence

## Task Count Summary

- **Total Tasks**: 51
- **Phase 1 (Setup)**: 3 tasks
- **Phase 2 (Foundational)**: 5 tasks
- **User Story 1**: 16 tasks
- **User Story 2**: 10 tasks
- **User Story 3**: 10 tasks
- **Polish**: 7 tasks
- **Parallel Opportunities**: 15 tasks marked [P]
