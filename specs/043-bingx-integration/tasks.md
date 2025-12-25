# Tasks: BingX 交易所整合

**Input**: Design documents from `/specs/043-bingx-integration/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Optional - included for key components based on project TDD discipline.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, type extensions, and environment configuration

- [x] T001 [P] Add 'bingx' to ExchangeName type in src/connectors/types.ts
- [x] T002 [P] Add 'bingx' to SupportedExchange type in src/types/trading.ts
- [x] T003 [P] Add BINGX_API_KEY and BINGX_API_SECRET to .env.example
- [x] T004 [P] Add BingX configuration to src/lib/config.ts (apiKey, apiSecret, sandbox)
- [x] T005 Create Prisma migration for AssetSnapshot bingx fields (bingxBalanceUSD, bingxStatus)
- [x] T006 Run prisma migrate dev and generate client

---

## Phase 2: Foundational (Core BingX Connector)

**Purpose**: Implement the BingX connector that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T007 Create BingX connector class in src/connectors/bingx.ts implementing IExchangeConnector
- [x] T008 [P] Implement connect() and disconnect() methods in src/connectors/bingx.ts
- [x] T009 [P] Implement isConnected() method in src/connectors/bingx.ts
- [x] T010 Implement getFundingRate() with fundingInterval support in src/connectors/bingx.ts
- [x] T011 Implement getFundingRates() for batch queries in src/connectors/bingx.ts
- [x] T012 [P] Implement getPrice() and getPrices() in src/connectors/bingx.ts
- [x] T013 [P] Implement getSymbolInfo() in src/connectors/bingx.ts
- [x] T014 Implement getBalance() returning AccountBalance in src/connectors/bingx.ts
- [x] T015 Implement getPositions() and getPosition() in src/connectors/bingx.ts
- [x] T016 Implement createOrder() supporting MARKET and LIMIT types in src/connectors/bingx.ts
- [x] T017 [P] Implement cancelOrder() and getOrder() in src/connectors/bingx.ts
- [x] T018 [P] Implement validateSymbol(), formatQuantity(), formatPrice() in src/connectors/bingx.ts
- [x] T019 Add BingX case to connector factory in src/connectors/factory.ts
- [x] T020 Export BingxConnector from src/connectors/index.ts

**Checkpoint**: BingX connector ready - user story implementation can now begin

---

## Phase 3: User Story 1 - 配置 BingX 監控用 API Key (Priority: P1) 🎯 MVP

**Goal**: System loads BingX API Key from .env and validates connectivity on startup

**Independent Test**: System startup logs show BingX connection status (success/warning)

### Implementation for User Story 1

- [x] T021 [US1] Add BingX API validation in startup sequence in src/lib/startup.ts or equivalent
- [x] T022 [US1] Implement BingX connectivity check using connector.connect() in startup
- [x] T023 [US1] Add warning log when BINGX_API_KEY is missing (non-blocking) in startup
- [x] T024 [US1] Add error log when BINGX_API_KEY is invalid in startup

**Checkpoint**: US1 complete - BingX monitoring API Key loads from .env

---

## Phase 4: User Story 2 - 新增 BingX 交易用 API Key (Priority: P1)

**Goal**: Users can add/validate/store BingX trading API Keys via web interface

**Independent Test**: Add BingX API Key in settings page, verify connection test and encrypted storage

### Implementation for User Story 2

- [x] T025 [US2] Add BingX validation logic to ApiKeyValidator in src/services/apikey/ApiKeyValidator.ts
- [x] T026 [US2] Implement BingX contract trading permission check in ApiKeyValidator
- [x] T027 [US2] Update API Key form to include BingX option in app/(dashboard)/settings/api-keys/
- [x] T028 [US2] Update POST /api/api-keys route to handle exchange='bingx' in app/api/api-keys/route.ts
- [x] T029 [US2] Update POST /api/api-keys/[id]/test route for BingX in app/api/api-keys/[id]/test/route.ts

**Checkpoint**: US2 complete - BingX trading API Keys can be managed via web interface

---

## Phase 5: User Story 3 - 查詢 BingX 幣價與資金費率 (Priority: P1)

**Goal**: Market monitor displays BingX funding rates with 1h/4h/8h interval info

**Independent Test**: Market monitor page shows BingX symbols with funding rates and intervals

### Implementation for User Story 3

- [ ] T030 [US3] Integrate BingX connector into FundingRateMonitor in src/services/fundingrate/FundingRateMonitor.ts
- [ ] T031 [US3] Add fundingInterval extraction from CCXT response in BingX connector
- [ ] T032 [US3] Implement correct annualization calculation based on interval in rate calculator
- [ ] T033 [US3] Update market-rates API to include BingX data in app/api/market-rates/route.ts
- [ ] T034 [US3] Update frontend to display fundingInterval column for BingX in market monitor

**Checkpoint**: US3 complete - BingX funding rates visible in market monitor with interval info

---

## Phase 6: User Story 4 - 查詢 BingX 帳戶資產 (Priority: P1)

**Goal**: Asset overview shows BingX USDT balance

**Independent Test**: Asset page displays BingX balance alongside other exchanges

### Implementation for User Story 4

- [ ] T035 [US4] Add BingX balance query to balances service in src/services/balance/ or equivalent
- [ ] T036 [US4] Update GET /api/balances to include BingX in app/api/balances/route.ts
- [ ] T037 [US4] Update AssetSnapshot creation to include bingxBalanceUSD in asset snapshot service
- [ ] T038 [US4] Update asset overview frontend to display BingX balance
- [ ] T039 [US4] Update open position dialog to show BingX available balance

**Checkpoint**: US4 complete - BingX balances visible in asset overview and position dialogs

---

## Phase 7: User Story 5 - BingX 開倉交易 (Priority: P1)

**Goal**: Users can open long/short positions on BingX with market/limit orders

**Independent Test**: Open a BingX position, verify order fills and position appears in list

### Implementation for User Story 5

- [ ] T040 [US5] Implement setLeverage() in BingX connector in src/connectors/bingx.ts
- [ ] T041 [US5] Implement setPositionMode() for hedged mode in src/connectors/bingx.ts
- [ ] T042 [US5] Add BingX support to PositionOrchestrator in src/services/trading/PositionOrchestrator.ts
- [ ] T043 [US5] Add BingX margin validation in BalanceValidator in src/services/trading/BalanceValidator.ts
- [ ] T044 [US5] Update POST /api/positions/open to accept BingX as exchange in app/api/positions/open/route.ts
- [ ] T045 [US5] Add BingX WebSocket progress events for opening in src/services/websocket/PositionProgressEmitter.ts

**Checkpoint**: US5 complete - BingX positions can be opened via market/limit orders

---

## Phase 8: User Story 7 - BingX 平倉操作 (Priority: P1)

**Goal**: Users can close BingX positions (full or partial)

**Independent Test**: Close a BingX position, verify position status updates and PnL calculated

### Implementation for User Story 7

- [ ] T046 [US7] Add BingX support to PositionCloser in src/services/trading/PositionCloser.ts
- [ ] T047 [US7] Implement BingX order cancellation before close in PositionCloser
- [ ] T048 [US7] Update POST /api/positions/[id]/close for BingX in app/api/positions/[id]/close/route.ts
- [ ] T049 [US7] Add BingX WebSocket progress events for closing in PositionProgressEmitter
- [ ] T050 [US7] Calculate and record BingX closing PnL in Trade model

**Checkpoint**: US7 complete - BingX positions can be closed with PnL calculation

---

## Phase 9: User Story 6 - BingX 停損停利設定 (Priority: P2)

**Goal**: Users can set stop loss/take profit when opening BingX positions

**Independent Test**: Open position with SL/TP enabled, verify conditional orders created on BingX

### Implementation for User Story 6

- [ ] T051 [US6] Create BingxConditionalOrderAdapter in src/services/trading/adapters/BingxConditionalOrderAdapter.ts
- [ ] T052 [US6] Implement setStopLossOrder() using CCXT stopLoss params in BingxConditionalOrderAdapter
- [ ] T053 [US6] Implement setTakeProfitOrder() using CCXT takeProfit params in BingxConditionalOrderAdapter
- [ ] T054 [US6] Implement cancelConditionalOrder() in BingxConditionalOrderAdapter
- [ ] T055 [US6] Add BingX case to ConditionalOrderAdapterFactory in src/services/trading/ConditionalOrderAdapterFactory.ts
- [ ] T056 [US6] Integrate BingX conditional orders with PositionOrchestrator
- [ ] T057 [US6] Add conditional order status WebSocket events for BingX

**Checkpoint**: US6 complete - BingX positions support stop loss and take profit

---

## Phase 10: User Story 8 - BingX 收益計算 (Priority: P2)

**Goal**: Trade history shows BingX PnL breakdown (price diff, funding, fees)

**Independent Test**: View closed BingX trade, verify PnL components match exchange data

### Implementation for User Story 8

- [ ] T058 [US8] Implement BingX fee calculation in pnl-calculator in src/lib/pnl-calculator.ts
- [ ] T059 [US8] Implement BingX funding rate PnL tracking during position hold
- [ ] T060 [US8] Update Trade creation with BingX PnL breakdown in trade service
- [ ] T061 [US8] Update GET /api/trades to include BingX trades with full PnL in app/api/trades/route.ts
- [ ] T062 [US8] Update trade history frontend to display BingX PnL breakdown

**Checkpoint**: US8 complete - BingX trading PnL fully tracked and displayed

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Testing, error handling, and final integration

### Unit Tests (Optional - for key components)

- [ ] T063 [P] Create BingX connector unit tests in tests/unit/connectors/bingx.test.ts
- [ ] T064 [P] Create BingxConditionalOrderAdapter unit tests in tests/unit/adapters/bingx-conditional.test.ts

### Integration Tests (Optional)

- [ ] T065 Create BingX trading integration test in tests/integration/bingx-trading.test.ts

### Error Handling & Polish

- [ ] T066 [P] Add BingX-specific error code mapping in src/lib/errors/ or connector
- [ ] T067 [P] Add BingX rate limit handling with exponential backoff
- [ ] T068 Verify BingX symbol format conversion (BTCUSDT → BTC/USDT:USDT) in connector
- [ ] T069 Update CHANGELOG.md with BingX integration notes
- [ ] T070 Run quickstart.md validation steps

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup - BLOCKS all user stories
- **User Stories (Phase 3-10)**: All depend on Foundational (Phase 2) completion
- **Polish (Phase 11)**: Depends on desired user stories being complete

### User Story Dependencies

| Story | Depends On | Can Parallel With |
|-------|-----------|-------------------|
| US1 (監控 API) | Foundational | US2, US3 |
| US2 (交易 API) | Foundational | US1, US3, US4 |
| US3 (資金費率) | Foundational, US1 | US2, US4 |
| US4 (資產查詢) | Foundational, US2 | US3, US5 |
| US5 (開倉) | Foundational, US2, US4 | US7 (after connector complete) |
| US7 (平倉) | US5 | US6, US8 |
| US6 (停損停利) | US5 | US8 |
| US8 (收益計算) | US7 | US6 |

### Within Each User Story

1. Backend service/connector changes first
2. API route updates second
3. Frontend updates last
4. Integration testing after all components

---

## Parallel Opportunities

### Phase 1: Setup (All parallel)
```
T001 (types.ts) | T002 (trading.ts) | T003 (.env.example) | T004 (config.ts)
```

### Phase 2: Foundational (Grouped parallelism)
```
Group 1: T007 (create class)
Group 2: T008, T009, T012, T013, T017, T018 (independent methods)
Group 3: T010, T011 (funding rate methods)
Group 4: T014, T015, T016 (account/trading methods)
Group 5: T019, T020 (exports)
```

### User Stories (Cross-story parallelism)
```
After Phase 2 complete:
  Developer A: US1 → US3
  Developer B: US2 → US4 → US5 → US7
  Developer C: US6 → US8 (after US5)
```

---

## Implementation Strategy

### MVP First (Monitoring Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: US1 (監控 API)
4. Complete Phase 5: US3 (資金費率)
5. **STOP and VALIDATE**: BingX rates appear in market monitor

### Trading MVP

1. Add Phase 4: US2 (交易 API)
2. Add Phase 6: US4 (資產查詢)
3. Add Phase 7: US5 (開倉)
4. Add Phase 8: US7 (平倉)
5. **STOP and VALIDATE**: Full trading flow works

### Complete Feature

1. Add Phase 9: US6 (停損停利)
2. Add Phase 10: US8 (收益計算)
3. Complete Phase 11: Polish
4. **FINAL VALIDATION**: All acceptance scenarios pass

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- BingX uses CCXT unified format: `BTC/USDT:USDT` for swap markets
- Funding intervals (1h, 4h, 8h) calculated from `nextFundingTimestamp - fundingTimestamp`
- Stop loss/take profit use CCXT attached order params (not separate API calls)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
