# Tasks: 手動開倉功能

**Input**: Design documents from `/specs/033-manual-open-position/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓

**Tests**: 不包含測試任務（未在規格中明確要求）

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 基礎設施準備和 Redis 客戶端設置

- [x] T001 Create Redis client configuration in `src/lib/redis.ts`
- [x] T002 [P] Create trading error types in `src/lib/errors/trading-errors.ts`
- [x] T003 [P] Create trading types in `src/types/trading.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 核心服務層，所有 User Stories 都依賴此階段

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Implement PositionLockService (Redis distributed lock) in `src/services/trading/PositionLockService.ts`
- [x] T005 [P] Implement BalanceValidator service in `src/services/trading/BalanceValidator.ts`
- [x] T006 Implement PositionOrchestrator service (Saga Pattern coordinator) in `src/services/trading/PositionOrchestrator.ts`
- [x] T007 [P] Create AuditLog model if not exists, add audit logging helpers in `src/services/trading/AuditLogger.ts`
- [x] T008 Setup WebSocket room management for position progress in `src/services/websocket/PositionProgressEmitter.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - 從套利機會開倉 (Priority: P1) 🎯 MVP

**Goal**: 用戶可以從套利機會頁面點擊開倉按鈕，在兩個交易所同時建立對沖倉位

**Independent Test**: 在測試環境選擇套利機會 → 輸入倉位數量 → 確認開倉 → 驗證兩個交易所都成功開倉

### Implementation for User Story 1

#### Backend API

- [x] T009 [US1] Implement GET /api/balances endpoint in `app/api/balances/route.ts`
- [x] T010 [US1] Implement POST /api/positions/open endpoint in `app/api/positions/open/route.ts`
- [x] T011 [US1] Implement GET /api/positions endpoint in `app/api/positions/route.ts`
- [x] T012 [P] [US1] Implement GET /api/market-data/refresh endpoint for real-time price and funding rate in `app/api/market-data/refresh/route.ts`

#### Frontend Components

- [x] T013 [P] [US1] Create OpenPositionButton component in `app/(dashboard)/market-monitor/components/OpenPositionButton.tsx`
- [x] T014 [US1] Create OpenPositionDialog component with manual refresh button in `app/(dashboard)/market-monitor/components/OpenPositionDialog.tsx`
- [x] T015 [US1] Implement RefreshMarketDataButton in OpenPositionDialog (顯示即時價格、資金費率、最後更新時間)
- [x] T016 [US1] Create PositionProgressOverlay component in `app/(dashboard)/market-monitor/components/PositionProgressOverlay.tsx`
- [x] T017 [P] [US1] Integrate OpenPositionButton into market-monitor page

#### Positions Page

- [x] T018 [P] [US1] Create positions list page in `app/(dashboard)/positions/page.tsx`
- [x] T019 [US1] Create PositionCard component in `app/(dashboard)/positions/components/PositionCard.tsx`

**Checkpoint**: User Story 1 完成 - 用戶可以從套利機會開倉並查看持倉

---

## Phase 4: User Story 2 - 餘額不足處理 (Priority: P1)

**Goal**: 當餘額不足時，系統即時檢查並拒絕開倉，顯示明確錯誤訊息

**Independent Test**: 設定大於帳戶餘額的倉位數量 → 驗證系統拒絕開倉並顯示餘額不足警告

### Implementation for User Story 2

- [x] T020 [US2] Add real-time balance validation to OpenPositionDialog in `app/(dashboard)/market-monitor/components/OpenPositionDialog.tsx`
- [x] T021 [US2] Implement insufficient balance warning UI with specific exchange/amount details
- [x] T022 [US2] Add disabled state for confirm button when balance insufficient

**Checkpoint**: User Story 2 完成 - 餘額不足時開倉按鈕禁用並顯示警告

---

## Phase 5: User Story 3 - 開倉失敗回滾 (Priority: P2)

**Goal**: 當一邊開倉成功另一邊失敗時，系統自動回滾已成功的開倉

**Independent Test**: 模擬一個交易所 API 失敗 → 驗證系統回滾已成功的一邊

### Implementation for User Story 3

- [x] T023 [US3] Implement rollback logic with 3 retries (0ms, 1s, 2s) in `src/services/trading/PositionOrchestrator.ts`
- [x] T024 [US3] Add rollback_failed WebSocket event handling in `src/services/websocket/PositionProgressEmitter.ts`
- [x] T025 [US3] Create RollbackFailedAlert component for manual intervention warning in `app/(dashboard)/market-monitor/components/RollbackFailedAlert.tsx`
- [x] T026 [US3] Add PARTIAL status handling in positions page

**Checkpoint**: User Story 3 完成 - 失敗時自動回滾，回滾失敗時提示手動處理

---

## Phase 6: User Story 4 - 防止重複開倉 (Priority: P2)

**Goal**: 防止同一用戶對同一交易對重複開倉

**Independent Test**: 快速連續點擊確認開倉按鈕 → 驗證只執行一次開倉

### Implementation for User Story 4

- [x] T027 [US4] Add frontend button disable and loading state in OpenPositionDialog
- [x] T028 [US4] Integrate PositionLockService in POST /api/positions/open endpoint
- [x] T029 [US4] Add 409 Conflict response handling in frontend for concurrent operations
- [x] T030 [US4] Add lock conflict error message display

**Checkpoint**: User Story 4 完成 - 重複點擊和跨裝置並發都被正確阻止

---

## Phase 7: User Story 5 - 從市場監控快速開倉 (Priority: P3)

**Goal**: 在市場監控頁面對達到閾值的交易對，點擊快速開倉自動填入最佳方向

**Independent Test**: 在市場監控頁面對機會狀態交易對點擊快速開倉 → 驗證對話框自動填入正確方向

### Implementation for User Story 5

- [x] T031 [US5] Add QuickOpenButton to market-monitor table rows (only for opportunity status)
- [x] T032 [US5] Implement auto-fill logic for Long/Short exchange based on BUY/SELL indicators
- [x] T033 [US5] Add conditional rendering - hide button for non-opportunity rows

**Checkpoint**: User Story 5 完成 - 市場監控頁面顯示快速開倉按鈕

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: 最終優化和跨功能改進

- [x] T034 [P] Add error boundary for position-related components
- [x] T035 [P] Add loading skeletons for positions page
- [x] T036 Verify all audit logs are recorded correctly
- [x] T037 Run quickstart.md validation scenarios
- [x] T038 Update CLAUDE.md with new feature paths

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational - Extends US1 dialog but independently testable
- **User Story 3 (P2)**: Can start after Foundational - Extends US1 orchestrator
- **User Story 4 (P2)**: Can start after Foundational - Uses US1 infrastructure
- **User Story 5 (P3)**: Can start after Foundational - Uses US1 dialog component

### Parallel Opportunities

**Within Phase 1**:
```
T001 → T004 (sequential: Redis client needed for lock service)
T002, T003 → parallel
```

**Within Phase 2**:
```
T004, T005, T007, T008 → parallel (after T001)
T006 → depends on T004, T005
```

**Within User Story Phases**:
```
US1: T009, T010, T011, T012 → parallel (backend APIs)
US1: T013, T017, T018 → parallel (frontend components)
```

---

## Implementation Strategy

### MVP First (User Story 1 + 2)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1 (核心開倉流程)
4. Complete Phase 4: User Story 2 (餘額驗證)
5. **STOP and VALIDATE**: Test basic open position flow
6. Deploy/demo MVP

### Incremental Delivery

1. MVP (US1 + US2) → 基本開倉功能
2. Add US3 → 失敗回滾保護
3. Add US4 → 並發控制
4. Add US5 → 快速開倉便利性
5. Polish → 最終優化

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- 槓桿倍數僅支援 1x 或 2x（用戶可選，預設 1x）
- 倉位輸入為幣本位數量（如 0.1 BTC），確保兩邊數量完全對沖
- **手動刷新功能**: 開倉對話框提供「刷新市場數據」按鈕，點擊後即時獲取最新幣價和資金費率，顯示最後更新時間
