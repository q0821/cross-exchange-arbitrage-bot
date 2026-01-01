# Tasks: 修復餘額顯示不一致問題

**Input**: Design documents from `/specs/056-fix-balance-display/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, quickstart.md

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Interface modification shared by both user stories

- [x] T001 [US1/US2] Modify `AccountBalance` interface in `src/connectors/types.ts` - add `availableBalanceUSD: number` field

**Checkpoint**: Interface ready, connector modifications can begin

---

## Phase 2: User Story 1 - 開倉時顯示真實可用餘額 (Priority: P1) 🎯 MVP

**Goal**: 讓用戶在開倉對話框看到真實可用餘額，而非總餘額

**Independent Test**: 用戶在有現有倉位的情況下，打開開倉對話框，確認顯示的餘額是扣除現有倉位佔用保證金後的可用餘額

### Implementation for User Story 1

- [x] T002 [P] [US1] Modify `BinanceUserConnector.getBalance()` in `src/services/assets/UserConnectorFactory.ts` - use `balance.free['USDT']` for `availableBalanceUSD`
- [x] T003 [P] [US1] Modify `OkxUserConnector.getBalance()` in `src/services/assets/UserConnectorFactory.ts` - use `balance.free['USDT']` for `availableBalanceUSD`
- [x] T004 [P] [US1] Modify `BingxUserConnector.getBalance()` in `src/services/assets/UserConnectorFactory.ts` - use `balance.free['USDT']` for `availableBalanceUSD`
- [x] T005 [P] [US1] Modify `MexcUserConnector.getBalance()` in `src/services/assets/UserConnectorFactory.ts` - use `balance.free['USDT']` for `availableBalanceUSD` (optional, for consistency)
- [x] T006 [US1] Modify `BalanceValidator.getBalances()` in `src/services/trading/BalanceValidator.ts` - use `availableBalanceUSD` for validation instead of `totalEquityUSD`
- [x] T007 [US1] Modify `GET /api/balances` in `app/api/balances/route.ts` - return `availableBalanceUSD` to frontend for open position dialog

**Checkpoint**: User Story 1 complete - 開倉對話框顯示可用餘額

---

## Phase 3: User Story 2 - 資產總覽 Gate.io 納入持倉價值 (Priority: P1)

**Goal**: 讓 Gate.io 的資產總覽與其他交易所一致，納入持倉價值

**Independent Test**: 用戶在 Gate.io 開倉前後查看資產總覽，確認總資產不會因開倉動作而大幅下降

### Implementation for User Story 2

- [x] T008 [US2] Modify `GateioUserConnector.getBalance()` in `src/services/assets/UserConnectorFactory.ts`:
  - Query positions via `/api/v4/futures/usdt/positions`
  - Calculate position value = Σ(margin + unrealised_pnl)
  - Set `totalEquityUSD = available + position value`
  - Keep `availableBalanceUSD` as current `available` value

**Checkpoint**: User Story 2 complete - Gate.io 資產總覽納入持倉價值

---

## Phase 4: Polish & Validation

**Purpose**: Final validation and testing

- [x] T009 Run unit tests: `pnpm test -- --grep "UserConnector"`
- [x] T010 Run unit tests: `pnpm test -- --grep "BalanceValidator"`
- [ ] T011 Manual validation per quickstart.md acceptance criteria:
  - Binance 開倉顯示可用餘額
  - OKX 開倉顯示可用餘額
  - BingX 開倉顯示可用餘額
  - Gate.io 資產總覽納入持倉價值
  - 資產曲線不因開/平倉異常波動

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies - modify interface first
- **Phase 2 (US1)**: Depends on T001 - can start after interface modified
- **Phase 3 (US2)**: Depends on T001 - can run in parallel with Phase 2
- **Phase 4 (Polish)**: Depends on Phase 2 and Phase 3

### Parallel Opportunities

- T002, T003, T004, T005 can all run in parallel (different connectors)
- Phase 2 and Phase 3 can run in parallel after T001

---

## Notes

- `totalEquityUSD`: 用於資產總覽（可用餘額 + 持倉價值）
- `availableBalanceUSD`: 用於開倉驗證（可自由使用的餘額）
- CCXT `balance.free['USDT']` 已封裝各交易所的可用餘額邏輯
- Gate.io 需要額外 API 調用獲取持倉資訊
