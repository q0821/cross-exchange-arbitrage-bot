# Tasks: 開倉停損停利設定

**Input**: Design documents from `/specs/038-specify-scripts-bash/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md

**Tests**: 本功能規格未要求自動化測試，採用手動整合測試驗證。

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database schema extensions and type definitions

- [x] T001 Add ConditionalOrderStatus enum and Position model extensions in prisma/schema.prisma
- [x] T002 Add TradingSettings model with User relation in prisma/schema.prisma
- [x] T003 Run Prisma migration to create new schema: `pnpm prisma migrate dev --name add_conditional_orders`
- [x] T004 [P] Add conditional order types in src/types/trading.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core services that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 Create trigger price calculator in src/lib/conditional-order-calculator.ts
- [x] T006 Create ConditionalOrderService interface in src/services/trading/ConditionalOrderService.ts
- [x] T007 [P] Implement BinanceConditionalOrderAdapter in src/services/trading/adapters/BinanceConditionalOrderAdapter.ts
- [x] T008 [P] Implement OkxConditionalOrderAdapter in src/services/trading/adapters/OkxConditionalOrderAdapter.ts
- [x] T009 [P] Implement GateioConditionalOrderAdapter in src/services/trading/adapters/GateioConditionalOrderAdapter.ts
- [x] T010 [P] Implement MexcConditionalOrderAdapter in src/services/trading/adapters/MexcConditionalOrderAdapter.ts
- [x] T011 Create adapter factory in src/services/trading/ConditionalOrderAdapterFactory.ts
- [x] T012 Create TradingSettingsRepository in src/repositories/TradingSettingsRepository.ts

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - 開倉時設定停損 (Priority: P1) 🎯 MVP

**Goal**: 用戶在開倉時，系統自動為雙邊倉位設定停損單，當市場價格不利於套利策略時自動平倉

**Independent Test**: 開倉後在交易所確認停損單已正確設定，並驗證當價格觸及停損價位時倉位自動平倉

### Implementation for User Story 1

- [x] T013 [US1] Add stopLoss params validation schema in app/api/positions/open/route.ts
- [x] T014 [US1] Modify PositionOrchestrator to call ConditionalOrderService after successful open in src/services/trading/PositionOrchestrator.ts
- [x] T015 [US1] Add stop loss input fields (toggle + percent) in app/(dashboard)/market-monitor/components/OpenPositionDialog.tsx
- [x] T016 [US1] Display calculated stop loss trigger price preview in OpenPositionDialog.tsx
- [x] T017 [US1] Add stopLoss result display in app/(dashboard)/positions/components/PositionCard.tsx
- [x] T018 [US1] Add ConditionalOrderStatus badge display in PositionCard.tsx
- [x] T019 [US1] Add WebSocket event for conditional order setting progress in src/services/websocket/PositionProgressEmitter.ts
- [ ] T020 [US1] Manual integration test: Open position with stop loss on Binance and verify order created

**Checkpoint**: User Story 1 (MVP) complete - stop loss on open position works

---

## Phase 4: User Story 2 - 開倉時設定停利 (Priority: P2)

**Goal**: 用戶在開倉時，系統可選擇性地為雙邊倉位設定停利單，當套利價差達到預期目標時自動平倉鎖定利潤

**Independent Test**: 開倉後在交易所確認停利單已正確設定，並驗證當價格觸及停利價位時倉位自動平倉

### Implementation for User Story 2

- [x] T021 [US2] Add takeProfit params validation schema in app/api/positions/open/route.ts
- [x] T022 [US2] Extend ConditionalOrderService to handle take profit orders in src/services/trading/ConditionalOrderService.ts
- [x] T023 [US2] Add take profit input fields (toggle + percent) in app/(dashboard)/market-monitor/components/OpenPositionDialog.tsx
- [x] T024 [US2] Display calculated take profit trigger price preview in OpenPositionDialog.tsx
- [x] T025 [US2] Add takeProfit result display in app/(dashboard)/positions/components/PositionCard.tsx
- [x] T026 [US2] Handle OKX Net Mode limitation (separate TP/SL orders) in OkxConditionalOrderAdapter.ts
- [ ] T027 [US2] Manual integration test: Open position with take profit on OKX and verify order created

**Checkpoint**: User Story 2 complete - take profit on open position works

---

## Phase 5: User Story 3 - 停損停利預設值管理 (Priority: P3)

**Goal**: 用戶可以在設定頁面配置停損停利的預設值，避免每次開倉都需要手動輸入

**Independent Test**: 在設定頁面設定預設值後，開倉對話框自動帶入預設值

### Implementation for User Story 3

- [x] T028 [US3] Create GET /api/settings/trading endpoint in app/api/settings/trading/route.ts
- [x] T029 [US3] Create PATCH /api/settings/trading endpoint in app/api/settings/trading/route.ts
- [x] T030 [US3] Create trading settings page in app/(dashboard)/settings/trading/page.tsx
- [x] T031 [US3] Add stop loss default settings form (toggle + percent input) in settings/trading/page.tsx
- [x] T032 [US3] Add take profit default settings form (toggle + percent input) in settings/trading/page.tsx
- [x] T033 [US3] Create useTradingSettings hook to fetch defaults in app/(dashboard)/market-monitor/hooks/useTradingSettings.ts
- [x] T034 [US3] Modify OpenPositionDialog to use default values from useTradingSettings hook
- [x] T035 [US3] Add navigation link to trading settings in app/(dashboard)/settings/page.tsx (already existed)
- [ ] T036 [US3] Manual integration test: Set defaults and verify they appear in open position dialog

**Checkpoint**: User Story 3 complete - default settings management works

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Error handling, edge cases, and documentation

- [x] T037 Add error handling for conditional order failures with user-friendly messages in PositionOrchestrator.ts (already implemented)
- [x] T038 Add warning alert component for partial conditional order success in app/(dashboard)/positions/components/ConditionalOrderWarning.tsx
- [x] T039 Handle minimum percent validation (0.5%) to prevent immediate trigger (already in Zod schemas)
- [x] T040 Add logging for all conditional order operations using Pino (already implemented)
- [ ] T041 Run quickstart.md validation - test all documented scenarios
- [x] T042 Update CLAUDE.md with Feature 038 key paths and components

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - US1 (Stop Loss): Independent, can start after Phase 2
  - US2 (Take Profit): Can start after Phase 2, minor integration with US1
  - US3 (Default Settings): Can start after Phase 2, integrates with US1/US2 UI
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational - Extends US1 dialog but independently testable
- **User Story 3 (P3)**: Can start after Foundational - Requires US1/US2 UI fields to exist for integration

### Within Each User Story

- API changes before frontend changes
- Core implementation before UI integration
- Story complete before moving to next priority

### Parallel Opportunities

**Phase 2 (Foundational)**:
```
T007 BinanceConditionalOrderAdapter ─┬─ All can run in parallel
T008 OkxConditionalOrderAdapter ─────┤
T009 GateioConditionalOrderAdapter ──┤
T010 MexcConditionalOrderAdapter ────┘
```

**User Stories can run in parallel after Phase 2**:
```
After Phase 2 completes:
├── Developer A: User Story 1 (P1) - Stop Loss
├── Developer B: User Story 2 (P2) - Take Profit (after T022)
└── Developer C: User Story 3 (P3) - Settings (after API foundation)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (schema, types)
2. Complete Phase 2: Foundational (adapters, services)
3. Complete Phase 3: User Story 1 (Stop Loss)
4. **STOP and VALIDATE**: Test stop loss independently on all exchanges
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 (Stop Loss) → Test independently → Deploy (MVP!)
3. Add User Story 2 (Take Profit) → Test independently → Deploy
4. Add User Story 3 (Default Settings) → Test independently → Deploy
5. Polish phase → Final release

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Exchange-specific adapters based on research.md findings
- OKX requires special handling for Net Mode TP/SL limitation
