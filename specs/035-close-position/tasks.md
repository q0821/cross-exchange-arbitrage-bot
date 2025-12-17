# Tasks: 一鍵平倉功能

**Input**: Design documents from `/specs/035-close-position/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓

**Tests**: 不包含測試任務（未在規格中明確要求）

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 類型定義擴展和工具函數建立

- [x] T001 Extend trading types with close position types in `src/types/trading.ts`
- [x] T002 [P] Create PnL calculator utility in `src/lib/pnl-calculator.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 核心服務層，所有 User Stories 都依賴此階段

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Implement PositionCloser service in `src/services/trading/PositionCloser.ts`
- [x] T004 [P] Extend AuditLogger with close position actions in `src/services/trading/AuditLogger.ts`
- [x] T005 [P] Extend PositionProgressEmitter with close events in `src/services/websocket/PositionProgressEmitter.ts`
- [x] T006 Export PositionCloser from trading services index in `src/services/trading/index.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - 一鍵平倉 (Priority: P1) 🎯 MVP

**Goal**: 用戶可以從持倉頁面點擊平倉按鈕，同時關閉兩個交易所的對沖倉位

**Independent Test**: 選擇 OPEN 狀態持倉 → 點擊平倉按鈕 → 確認 → 驗證雙邊都平倉成功 → 查看損益

### Backend API

- [x] T007 [US1] Implement POST /api/positions/[id]/close endpoint in `app/api/positions/[id]/close/route.ts`
- [x] T008 [P] [US1] Implement GET /api/positions/[id]/market-data endpoint in `app/api/positions/[id]/market-data/route.ts`

### Frontend Components

- [x] T009 [P] [US1] Create useClosePosition hook in `app/(dashboard)/positions/hooks/useClosePosition.ts`
- [x] T010 [US1] Connect PositionCard close button to useClosePosition in `app/(dashboard)/positions/components/PositionCard.tsx`
- [x] T011 [US1] Integrate close position into positions page in `app/(dashboard)/positions/page.tsx`

**Checkpoint**: User Story 1 完成 - 用戶可以一鍵平倉並看到結果

---

## Phase 4: User Story 2 - 平倉失敗處理 (Priority: P1)

**Goal**: 當一邊平倉成功另一邊失敗時，系統標記 PARTIAL 狀態並顯示警告

**Independent Test**: 模擬一個交易所 API 失敗 → 驗證 PARTIAL 狀態標記和警告訊息

### Implementation for User Story 2

- [x] T012 [US2] Add PARTIAL close handling in PositionCloser in `src/services/trading/PositionCloser.ts`
- [x] T013 [US2] Create PartialCloseAlert component in `app/(dashboard)/positions/components/PartialCloseAlert.tsx`
- [x] T014 [US2] Add PARTIAL status highlighting in PositionCard in `app/(dashboard)/positions/components/PositionCard.tsx`
- [x] T015 [US2] Handle partial close events in useClosePosition in `app/(dashboard)/positions/hooks/useClosePosition.ts`

**Checkpoint**: User Story 2 完成 - PARTIAL 狀態正確識別並顯示警告

---

## Phase 5: User Story 3 - 績效記錄與查看 (Priority: P2)

**Goal**: 平倉完成後自動創建 Trade 績效記錄，用戶可查看歷史交易

**Independent Test**: 完成平倉 → 查看交易歷史頁面 → 驗證績效記錄正確

### Backend API

- [x] T016 [US3] Implement GET /api/trades endpoint in `app/api/trades/route.ts`

### Frontend Components

- [x] T017 [P] [US3] Create trades history page in `app/(dashboard)/trades/page.tsx`
- [x] T018 [P] [US3] Create TradeCard component in `app/(dashboard)/trades/components/TradeCard.tsx`
- [x] T019 [US3] Add trades link to navigation in `app/(dashboard)/layout.tsx` or sidebar

**Checkpoint**: User Story 3 完成 - 用戶可以查看歷史交易績效

---

## Phase 6: User Story 4 - 平倉確認對話框 (Priority: P2)

**Goal**: 顯示確認對話框，展示市價、預估損益讓用戶確認

**Independent Test**: 點擊平倉按鈕 → 驗證對話框顯示正確資訊 → 取消或確認

### Frontend Components

- [x] T020 [US4] Create ClosePositionDialog component in `app/(dashboard)/positions/components/ClosePositionDialog.tsx`
- [x] T021 [US4] Integrate ClosePositionDialog with PositionCard in `app/(dashboard)/positions/components/PositionCard.tsx`
- [x] T022 [US4] Add market data fetching to useClosePosition in `app/(dashboard)/positions/hooks/useClosePosition.ts`

**Checkpoint**: User Story 4 完成 - 平倉前顯示確認對話框

---

## Phase 7: User Story 5 - 平倉進度即時更新 (Priority: P3)

**Goal**: 平倉過程中透過 WebSocket 即時推送進度更新

**Independent Test**: 執行平倉 → 觀察進度更新是否即時顯示

### Frontend Components

- [x] T023 [US5] Create CloseProgressOverlay component in `app/(dashboard)/positions/components/CloseProgressOverlay.tsx`
- [x] T024 [US5] Add WebSocket progress listener in useClosePosition in `app/(dashboard)/positions/hooks/useClosePosition.ts`
- [x] T025 [US5] Integrate CloseProgressOverlay with positions page in `app/(dashboard)/positions/page.tsx`

**Checkpoint**: User Story 5 完成 - 平倉進度即時顯示

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: 最終優化和跨功能改進

- [x] T026 [P] Add error boundary for close position components in `app/(dashboard)/positions/components/ClosePositionErrorBoundary.tsx`
- [x] T027 [P] Add loading skeletons for trades page in `app/(dashboard)/trades/components/TradeCardSkeleton.tsx`
- [x] T028 Verify all audit logs are recorded correctly
- [x] T029 Run quickstart.md validation scenarios
- [x] T030 Update CLAUDE.md with new feature paths

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational - Extends US1 PositionCloser
- **User Story 3 (P2)**: Can start after Foundational - Independent trades page
- **User Story 4 (P2)**: Can start after Foundational - Uses US1 close flow
- **User Story 5 (P3)**: Can start after Foundational - Uses US1 WebSocket events

### Parallel Opportunities

**Within Phase 1**:
```
T001, T002 → parallel
```

**Within Phase 2**:
```
T003 → T006 (sequential: service before export)
T004, T005 → parallel (different files)
```

**Within User Story Phases**:
```
US1: T007, T008 → parallel (backend APIs)
US1: T009 → T010 → T011 (sequential: hook → card → page)
US3: T016 (backend) | T017, T018 (frontend parallel)
US4: T020 → T021, T022 (sequential: dialog → integration)
```

---

## Implementation Strategy

### MVP First (User Story 1 + 2)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1 (核心平倉流程)
4. Complete Phase 4: User Story 2 (失敗處理)
5. **STOP and VALIDATE**: Test basic close position flow
6. Deploy/demo MVP

### Incremental Delivery

1. MVP (US1 + US2) → 基本平倉功能
2. Add US3 → 績效記錄查看
3. Add US4 → 平倉確認對話框
4. Add US5 → 進度即時更新
5. Polish → 最終優化

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- 無需 Prisma migration（複用現有 Position、Trade 模型）
- 複用現有開倉功能架構（PositionLockService、AuditLogger、PositionProgressEmitter）
