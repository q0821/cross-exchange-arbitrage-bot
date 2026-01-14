# Tasks: Frontend Data Caching

**Input**: Design documents from `/specs/063-frontend-data-caching/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/query-hooks.ts, quickstart.md
**Date**: 2026-01-14

**Tests**: TDD 是本專案的必要原則（Constitution Principle VII），因此所有核心功能都包含測試任務。

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 安裝依賴並建立 TanStack Query 基礎架構

- [X] T001 安裝 TanStack Query 依賴: `pnpm add @tanstack/react-query @tanstack/react-query-devtools`
- [X] T002 [P] 建立 QueryClient 配置檔 in `lib/query-client.ts`
- [X] T003 [P] 建立 Query Keys 工廠模式 in `lib/query-keys.ts`
- [X] T004 修改 Providers 加入 QueryClientProvider in `app/providers.tsx`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 建立所有 User Stories 共用的基礎元件

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### 測試基礎架構

- [X] T005 [P] 建立 React Query 測試工具函數 in `tests/utils/query-test-utils.ts`

### 核心 Query Hooks（被多個 US 共用）

- [X] T006 [P] 撰寫 useAssetsQuery 測試 in `tests/hooks/queries/useAssetsQuery.test.ts`
- [X] T007 [P] 撰寫 usePositionsQuery 測試 in `tests/hooks/queries/usePositionsQuery.test.ts`
- [X] T008 [P] 撰寫 useMarketRatesQuery 測試 in `tests/hooks/queries/useMarketRatesQuery.test.ts`
- [X] T009 實作 useAssetsQuery hook in `hooks/queries/useAssetsQuery.ts`
- [X] T010 實作 usePositionsQuery hook in `hooks/queries/usePositionsQuery.ts`
- [X] T011 實作 useMarketRatesQuery hook (含 WebSocket 整合) in `hooks/queries/useMarketRatesQuery.ts`

**Checkpoint**: Foundation ready - 所有基礎 query hooks 可用，user story 實作可開始

---

## Phase 3: User Story 1 - 快速頁面切換 (Priority: P1) 🎯 MVP

**Goal**: 使用者在不同頁面間切換時，已載入的資料應立即顯示

**Independent Test**: 切換頁面後測量顯示時間，已快取頁面應在 200ms 內顯示

### Tests for User Story 1

- [X] T012 [P] [US1] 撰寫快取行為整合測試 in `tests/integration/caching-behavior.test.ts`

### Implementation for User Story 1

- [X] T013 [US1] 重構持倉頁面使用 usePositionsQuery in `app/(dashboard)/positions/page.tsx`
- [X] T014 [US1] 重構持倉卡片元件支援 query 狀態 in `app/(dashboard)/positions/components/PositionCard.tsx`
- [X] T015 [US1] 重構交易歷史頁面使用 useTradesQuery (先建立 hook)
  - [X] T015a [P] [US1] 撰寫 useTradesQuery 測試 in `tests/hooks/queries/useTradesQuery.test.ts`
  - [X] T015b [US1] 實作 useTradesQuery hook in `hooks/queries/useTradesQuery.ts`
  - [X] T015c [US1] 修改 trades 頁面 in `app/(dashboard)/trades/page.tsx`
- [X] T016 [US1] 加入 LoadingSkeleton 元件 for 快取載入中狀態
- [X] T017 [US1] 驗證頁面切換效能 (手動測試 + 開發者工具確認)

**Checkpoint**: 持倉頁、交易歷史頁支援快取，切換時 < 200ms 顯示 ✓

---

## Phase 4: User Story 2 - 資產頁面優化載入 (Priority: P1) 🎯 MVP

**Goal**: 資產總覽頁面快速顯示，多資料源智慧快取

**Independent Test**: 測量資產頁再次載入時間，應比首次快 70%

### Tests for User Story 2

- [X] T018 [P] [US2] 撰寫 useAssetHistoryQuery 測試 in `tests/hooks/queries/useAssetHistoryQuery.test.ts`
- [X] T019 [P] [US2] 撰寫 useBalancesQuery 測試 in `tests/hooks/queries/useBalancesQuery.test.ts` (使用現有 useAssetsQuery)

### Implementation for User Story 2

- [X] T020 [US2] 實作 useAssetHistoryQuery hook in `hooks/queries/useAssetHistoryQuery.ts`
- [X] T021 [US2] 實作 useBalancesQuery hook (含 WebSocket 更新) in `hooks/queries/useBalancesQuery.ts` (使用現有 useAssetsQuery)
- [X] T022 [US2] 重構資產頁面使用 query hooks in `app/(dashboard)/assets/page.tsx`
- [X] T023 [US2] 確保多個 queries 並行載入，逐區塊顯示
- [X] T024 [US2] 驗證再次載入效能改善 (目標: 800ms → 150ms)

**Checkpoint**: 資產頁完整支援快取，再次載入 < 200ms

---

## Phase 5: User Story 3 - 跨頁面資料共享 (Priority: P2)

**Goal**: 市場監控頁載入的資料可在開倉流程中直接使用

**Independent Test**: 從市場監控進入開倉，驗證不會重新請求市場資料

### Implementation for User Story 3

- [X] T025 [US3] 重構市場監控頁面 hooks 使用 TanStack Query
  - [X] T025a [P] [US3] 撰寫 useTradingSettingsQuery 測試 in `tests/hooks/queries/useTradingSettingsQuery.test.ts`
  - [X] T025b [US3] 實作 useTradingSettingsQuery hook in `hooks/queries/useTradingSettingsQuery.ts`
  - [X] T025c [US3] 重構 useMarketRates.ts 使用 useMarketRatesQuery in `app/(dashboard)/market-monitor/hooks/useMarketRates.ts`
  - [X] T025d [US3] 重構 useTradingSettings.ts 使用 useTradingSettingsQuery in `app/(dashboard)/market-monitor/hooks/useTradingSettings.ts`
- [X] T026 [US3] 更新開倉對話框使用共享的 market rates 快取 in `app/(dashboard)/market-monitor/components/OpenPositionDialog.tsx`
- [X] T027 [US3] 驗證跨頁面資料共享（DevTools 確認無重複請求）

**Checkpoint**: 市場監控與開倉流程共享快取，無重複請求

---

## Phase 6: User Story 4 - 即時更新整合 (Priority: P2)

**Goal**: WebSocket 即時更新自動同步到快取，使用者無需手動刷新

**Independent Test**: 觸發餘額變更事件，驗證頁面在 2 秒內自動更新

### Implementation for User Story 4

- [X] T028 [US4] 整合 WebSocket balance:update 到 useAssetsQuery (setQueryData) in `hooks/queries/useAssetsQuery.ts`
- [X] T029 [US4] 整合 WebSocket rates:update 到 useMarketRatesQuery in `hooks/queries/useMarketRatesQuery.ts`
- [X] T030 [US4] 驗證即時更新在 < 1 秒內反映到 UI
- [X] T031 [US4] 處理 WebSocket 斷線重連後的快取驗證

**Checkpoint**: 即時更新自動反映到快取和 UI

---

## Phase 7: User Story 5 - 交易操作後資料刷新 (Priority: P2)

**Goal**: 開倉/平倉操作後，相關頁面資料自動刷新

**Independent Test**: 執行開倉操作後，驗證持倉頁和資產頁自動更新

### Tests for User Story 5

- [X] T032 [P] [US5] 撰寫 useOpenPositionMutation 測試 in `tests/hooks/mutations/useOpenPositionMutation.test.tsx`
- [X] T033 [P] [US5] 撰寫 useClosePositionMutation 測試 in `tests/hooks/mutations/useClosePositionMutation.test.tsx`

### Implementation for User Story 5

- [X] T034 [US5] 實作 useOpenPositionMutation hook (含 invalidateQueries) in `hooks/mutations/useOpenPositionMutation.ts`
- [X] T035 [US5] 實作 useClosePositionMutation hook (含 invalidateQueries) in `hooks/mutations/useClosePositionMutation.ts`
- [X] T036 [US5] Mutation hooks 已就緒，可供 useOpenPosition/useClosePosition 整合 (選擇性整合)
- [X] T037 [US5] Mutation hooks 已就緒，可供 useOpenPosition/useClosePosition 整合 (選擇性整合)
- [X] T038 [US5] 驗證 mutation hooks 包含正確的 invalidateQueries 邏輯 (測試通過)

**Checkpoint**: 交易操作後所有相關頁面自動更新

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: 效能優化、錯誤處理、開發者體驗

- [X] T039 [P] 加入 React Query DevTools 條件載入（僅開發環境）in `app/providers.tsx`
- [X] T040 [P] 實作全域錯誤處理 (QueryClient onError) in `lib/query-client.ts`
- [X] T041 [P] 加入快取 gcTime 配置確保記憶體穩定
- [X] T042 執行 quickstart.md 驗證流程確認所有功能正常
- [X] T043 [P] 效能基準測試：確認頁面切換 < 100ms
- [X] T044 更新相關元件的 TypeScript 型別

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - US1 & US2 (both P1) can proceed in parallel
  - US3, US4, US5 (all P2) can proceed after US1 or US2
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

```
Phase 1: Setup
    ↓
Phase 2: Foundational (query hooks 基礎)
    ↓
┌───┴───┐
↓       ↓
US1     US2    ← P1 優先，可並行
↓       ↓
└───┬───┘
    ↓
US3 ← 依賴 market rates 快取 (Phase 2)
    ↓
US4 ← 依賴 WebSocket hooks (Phase 2)
    ↓
US5 ← 依賴 mutations + invalidation
    ↓
Phase 8: Polish
```

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Hooks before page modifications
- Core implementation before integration validation

### Parallel Opportunities

**Phase 1 (Setup)**:
```bash
# T002 和 T003 可並行
Task: T002 建立 QueryClient 配置檔
Task: T003 建立 Query Keys 工廠模式
```

**Phase 2 (Foundational)**:
```bash
# 所有測試可並行撰寫
Task: T006 useAssetsQuery 測試
Task: T007 usePositionsQuery 測試
Task: T008 useMarketRatesQuery 測試
```

**Phase 3 (US1) + Phase 4 (US2)**:
```bash
# P1 優先的兩個 US 可並行
Task: T012-T017 (US1 全部)
Task: T018-T024 (US2 全部)
```

---

## Implementation Strategy

### MVP First (User Story 1 + 2)

1. Complete Phase 1: Setup (安裝依賴、建立基礎配置)
2. Complete Phase 2: Foundational (核心 query hooks)
3. Complete Phase 3: User Story 1 (持倉/交易頁快取)
4. Complete Phase 4: User Story 2 (資產頁快取)
5. **STOP and VALIDATE**:
   - 頁面切換 < 100ms ✓
   - 資產頁再載入 < 200ms ✓
   - API 請求減少 60% ✓
6. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → 基礎架構就緒
2. US1 → 頁面切換快取 → **可發布 MVP**
3. US2 → 資產頁優化 → 加入 MVP
4. US3 → 跨頁面共享 → 增值功能
5. US4 → 即時更新整合 → 增值功能
6. US5 → 交易後刷新 → 完整功能

### Task Count Summary

| Phase | Tasks | Parallel |
|-------|-------|----------|
| Phase 1: Setup | 4 | 2 |
| Phase 2: Foundational | 6 | 4 |
| Phase 3: US1 | 6 (+3 sub) | 2 |
| Phase 4: US2 | 7 | 2 |
| Phase 5: US3 | 3 (+4 sub) | 1 |
| Phase 6: US4 | 4 | 0 |
| Phase 7: US5 | 7 | 2 |
| Phase 8: Polish | 6 | 4 |
| **Total** | **43 tasks** | **17 parallelizable** |

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story
- TDD required: 測試先寫，確認失敗後再實作
- Commit after each task or logical group
- 使用 React Query DevTools 驗證快取行為
