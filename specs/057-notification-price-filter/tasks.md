# Tasks: 通知價差過濾

**Input**: Design documents from `/specs/057-notification-price-filter/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/api-changes.md, research.md

**Tests**: Required (Constitution Principle VII: TDD Discipline is NON-NEGOTIABLE)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Database Schema & Core Types)

**Purpose**: Database migration, type definitions, and isPriceDirectionCorrect calculation

**⚠️ TDD**: T003a (test) must be written and FAIL before T003b (implementation)

- [x] T001 Add `requireFavorablePrice` field to NotificationWebhook model in `prisma/schema.prisma`
- [x] T002 Run Prisma migration: `pnpm prisma migrate dev --name add_require_favorable_price`
- [x] T003 [P] Add `isPriceDirectionCorrect` field to BestArbitragePair interface in `src/models/FundingRate.ts`
- [x] T003a [P] Write unit test for `isPriceDirectionCorrect` calculation in `tests/unit/models/FundingRate.test.ts` (🔴 Red)
- [x] T003b Calculate and set `isPriceDirectionCorrect` in `createMultiExchangeFundingRatePair()` in `src/models/FundingRate.ts` (🟢 Green)
- [x] T004 [P] Add `requireFavorablePrice` field to WebhookConfig interface in `src/services/notification/types.ts`

**Checkpoint**: Schema, types, and isPriceDirectionCorrect calculation ready

---

## Phase 2: Foundational (Core Filter Logic)

**Purpose**: Core price filter logic that all user stories depend on

**⚠️ CRITICAL**: Tests MUST be written and FAIL before implementation (TDD Red-Green-Refactor)

### Tests (🔴 Red Phase)

- [x] T005 [P] Write unit test for `passesPriceFilter()` with `requireFavorablePrice=false` in `tests/unit/services/NotificationService.passesPriceFilter.test.ts`
- [x] T006 [P] Write unit test for `passesPriceFilter()` with positive netReturn and correct price direction in `tests/unit/services/NotificationService.passesPriceFilter.test.ts`
- [x] T007 [P] Write unit test for `passesPriceFilter()` with negative netReturn in `tests/unit/services/NotificationService.passesPriceFilter.test.ts`
- [x] T008 [P] Write unit test for `passesPriceFilter()` with incorrect price direction in `tests/unit/services/NotificationService.passesPriceFilter.test.ts`
- [x] T009 [P] Write unit test for `passesPriceFilter()` with missing bestPair in `tests/unit/services/NotificationService.passesPriceFilter.test.ts`

### Implementation (🟢 Green Phase)

- [x] T010 Implement `passesPriceFilter()` method in `src/services/notification/NotificationService.ts`
- [x] T011 Integrate `passesPriceFilter()` into `sendNotificationForOpportunity()` in `src/services/notification/NotificationService.ts`
- [x] T012 Add debug logging for price filter decisions in `src/services/notification/NotificationService.ts`

### Refactor (🔵 Refactor Phase)

- [x] T013 Run all tests and verify they pass: `pnpm test tests/unit/services/NotificationService.passesPriceFilter.test.ts`

**Checkpoint**: Core filter logic complete and tested

---

## Phase 3: User Story 1 - 啟用價差過濾功能 (Priority: P1) 🎯 MVP

**Goal**: 用戶可以編輯現有 Webhook 啟用價差過濾，系統根據設定過濾通知

**Independent Test**: 編輯 Webhook 啟用開關 → 確認只收到有利的機會通知

### Tests (🔴 Red Phase)

- [x] T014 [P] [US1] Write integration test for webhook update with requireFavorablePrice in `tests/integration/notification-price-filter.test.ts`
- [x] T015 [P] [US1] Write integration test for notification filtering when filter enabled in `tests/integration/notification-price-filter.test.ts`

### Implementation (🟢 Green Phase)

- [x] T016 [US1] Update `toWebhookConfig()` to include requireFavorablePrice in `src/repositories/NotificationWebhookRepository.ts`
- [x] T017 [US1] Update `update()` method to handle requireFavorablePrice in `src/repositories/NotificationWebhookRepository.ts`
- [x] T018 [US1] Update PUT handler to accept requireFavorablePrice in `app/api/notifications/webhooks/[id]/route.ts`
- [x] T019 [US1] Add price filter toggle UI to edit form in `app/(dashboard)/settings/notifications/page.tsx`
- [x] T020 [US1] Display filter status in webhook list in `app/(dashboard)/settings/notifications/page.tsx`

### Verify (🔵 Refactor Phase)

- [x] T021 [US1] Run integration tests: `pnpm test tests/integration/notification-price-filter.test.ts`

**Checkpoint**: User Story 1 complete - editing webhook with price filter works

---

## Phase 4: User Story 2 - 保持現有用戶行為不變 (Priority: P1)

**Goal**: 現有 Webhook 預設 requireFavorablePrice=false，行為不變

**Independent Test**: 現有 Webhook 不受影響，無需手動操作

### Tests (🔴 Red Phase)

- [x] T022 [P] [US2] Write test for existing webhook default value in `tests/integration/notification-price-filter.test.ts`
- [x] T023 [P] [US2] Write test for notification behavior when filter disabled in `tests/integration/notification-price-filter.test.ts`

### Implementation (🟢 Green Phase)

- [x] T024 [US2] Verify migration sets default to false (already done in T001/T002)
- [x] T025 [US2] Verify `passesPriceFilter()` returns true when requireFavorablePrice=false (already done in T010)

### Verify (🔵 Refactor Phase)

- [x] T026 [US2] Run backward compatibility tests: `pnpm test tests/integration/notification-price-filter.test.ts --grep "backward"`

**Checkpoint**: User Story 2 complete - backward compatibility verified

---

## Phase 5: User Story 3 - 新建 Webhook 時設定價差過濾 (Priority: P2)

**Goal**: 用戶新建 Webhook 時可選擇啟用價差過濾

**Independent Test**: 新建 Webhook 時勾選/不勾選價差過濾，確認設定正確儲存

### Tests (🔴 Red Phase)

- [x] T027 [P] [US3] Write integration test for webhook creation with requireFavorablePrice=true in `tests/integration/notification-price-filter.test.ts`
- [x] T028 [P] [US3] Write integration test for webhook creation with default requireFavorablePrice in `tests/integration/notification-price-filter.test.ts`

### Implementation (🟢 Green Phase)

- [x] T029 [US3] Update `create()` method to handle requireFavorablePrice in `src/repositories/NotificationWebhookRepository.ts`
- [x] T030 [US3] Update POST handler to accept requireFavorablePrice in `app/api/notifications/webhooks/route.ts`
- [x] T031 [US3] Add price filter toggle to create form in `app/(dashboard)/settings/notifications/page.tsx`
- [x] T032 [US3] Set default form value for requireFavorablePrice to false in `app/(dashboard)/settings/notifications/page.tsx`

### Verify (🔵 Refactor Phase)

- [x] T033 [US3] Run creation tests: `pnpm test tests/integration/notification-price-filter.test.ts --grep "create"`

**Checkpoint**: User Story 3 complete - new webhook creation with price filter works

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup

- [x] T034 Run full test suite: `pnpm test`
- [ ] T035 Run build verification: `pnpm build`
- [ ] T036 Manual validation using quickstart.md scenarios
- [ ] T037 Update CLAUDE.md with Feature 057 key paths (if needed)

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup) ─────────────────────────────────┐
                                                 │
Phase 2 (Foundational) ◄─────────────────────────┤
                                                 │
    ┌────────────────┬────────────────┐          │
    ▼                ▼                ▼          │
Phase 3 (US1)    Phase 4 (US2)    Phase 5 (US3)  │ Can run in parallel
    │                │                │          │ after Phase 2
    └────────────────┴────────────────┘          │
                                                 │
Phase 6 (Polish) ◄───────────────────────────────┘
```

### User Story Dependencies

- **User Story 1 (P1)**: Depends on Phase 2 - No dependencies on other stories
- **User Story 2 (P1)**: Depends on Phase 2 - Verifies backward compatibility
- **User Story 3 (P2)**: Depends on Phase 2 - No dependencies on US1/US2

### Within Each Phase

- 🔴 Tests MUST be written and FAIL before implementation
- 🟢 Implementation makes tests pass
- 🔵 Refactor only after tests pass

### Parallel Opportunities

**Phase 1**:
- T003 and T004 can run in parallel (different files)

**Phase 2 Tests**:
- T005, T006, T007, T008, T009 can all run in parallel (same file, different test cases)

**Phase 3-5**:
- All user story phases can run in parallel after Phase 2 completes

---

## Parallel Example: Phase 2 Tests

```bash
# Launch all Phase 2 unit tests in parallel:
Task: "Write unit test for passesPriceFilter() with requireFavorablePrice=false"
Task: "Write unit test for passesPriceFilter() with positive netReturn"
Task: "Write unit test for passesPriceFilter() with negative netReturn"
Task: "Write unit test for passesPriceFilter() with incorrect price direction"
Task: "Write unit test for passesPriceFilter() with missing bestPair"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T004)
2. Complete Phase 2: Foundational with TDD (T005-T013)
3. Complete Phase 3: User Story 1 with TDD (T014-T021)
4. **STOP and VALIDATE**: Test editing webhook with price filter
5. Deploy/demo if ready

### Full Delivery

1. MVP + Phase 4: User Story 2 (backward compatibility)
2. Add Phase 5: User Story 3 (new webhook creation)
3. Complete Phase 6: Polish

---

## Task Summary

| Phase | Task Count | Purpose |
|-------|------------|---------|
| Phase 1 | 6 | Setup (含 TDD: T003a → T003b) |
| Phase 2 | 9 | Foundational (TDD) |
| Phase 3 (US1) | 8 | Edit webhook + filtering |
| Phase 4 (US2) | 5 | Backward compatibility |
| Phase 5 (US3) | 7 | Create webhook |
| Phase 6 | 4 | Polish |
| **Total** | **39** | |

---

## Notes

- Constitution VII (TDD) is NON-NEGOTIABLE - all tests must fail before implementation
- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
