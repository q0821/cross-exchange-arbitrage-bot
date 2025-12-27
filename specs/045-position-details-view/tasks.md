# Tasks: 持倉詳情查看功能

**Input**: Design documents from `/specs/045-position-details-view/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: 根據 Constitution VII (TDD Discipline) 原則，本功能需遵循 TDD 流程，但由於大部分測試框架已存在，測試任務為 OPTIONAL。

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions
- **API Routes**: `app/api/positions/[id]/details/`
- **Services**: `src/services/trading/`
- **Components**: `app/(dashboard)/positions/components/`
- **Hooks**: `app/(dashboard)/positions/hooks/`
- **Types**: `src/types/`
- **Tests**: `tests/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 類型定義和基礎設施擴展

- [x] T001 [P] 新增 `PositionDetailsInfo` 類型定義至 `src/types/trading.ts`
- [x] T002 [P] 新增 API 回應類型 `PositionDetailsResponse` 至 `src/types/trading.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 核心後端服務，所有 User Story 都依賴此階段完成

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 建立 `PositionDetailsService` 服務骨架於 `src/services/trading/PositionDetailsService.ts`
- [x] T004 實作 `fetchCurrentPrices` 方法：從交易所 API 查詢即時價格（使用 CCXT fetchTicker）
- [x] T005 實作 `calculateUnrealizedPnL` 方法：計算多頭和空頭未實現損益
- [x] T006 建立 API endpoint 骨架 `GET /api/positions/[id]/details` 於 `app/api/positions/[id]/details/route.ts`
- [x] T007 實作 API 權限驗證：確認用戶擁有該 Position 且狀態為 OPEN

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - 查看持倉詳情 (Priority: P1) 🎯 MVP

**Goal**: 用戶可展開持倉卡片查看開倉價格、當前價格、未實現損益

**Independent Test**: 在持倉卡片上點擊「查看詳情」按鈕，確認能展開顯示開倉價格、現在價格、未實現損益等資訊

### Implementation for User Story 1

- [x] T008 [US1] 完成 API endpoint：整合 Position 資料查詢和即時價格查詢於 `app/api/positions/[id]/details/route.ts`
- [x] T009 [US1] 建立 `usePositionDetails` Hook 於 `app/(dashboard)/positions/hooks/usePositionDetails.ts`
- [x] T010 [US1] 建立 `PositionDetailsPanel` 組件於 `app/(dashboard)/positions/components/PositionDetailsPanel.tsx`
- [x] T011 [US1] 修改 `PositionCard` 組件：加入展開/收起按鈕和狀態於 `app/(dashboard)/positions/components/PositionCard.tsx`
- [x] T012 [US1] 實作載入狀態顯示：在 API 查詢期間顯示 Skeleton 或 Spinner
- [x] T013 [US1] 實作錯誤處理：價格查詢失敗時顯示錯誤訊息和重試按鈕

**Checkpoint**: User Story 1 完成 - 用戶可查看持倉基本詳情（開倉價格、當前價格、未實現損益）

---

## Phase 4: User Story 2 - 查看資金費率明細 (Priority: P2)

**Goal**: 用戶可查看持倉期間已產生的資金費率結算明細

**Independent Test**: 展開持倉詳情，確認顯示多頭和空頭各自的資金費率結算記錄列表

### Implementation for User Story 2

- [x] T014 [US2] 在 `PositionDetailsService` 加入資金費率查詢：整合既有 `FundingFeeQueryService` 於 `src/services/trading/PositionDetailsService.ts`
- [x] T015 [US2] 更新 API endpoint：加入資金費率明細回傳於 `app/api/positions/[id]/details/route.ts`
- [x] T016 [US2] 建立 `FundingFeeBreakdown` 組件於 `app/(dashboard)/positions/components/FundingFeeBreakdown.tsx`
- [x] T017 [US2] 整合 `FundingFeeBreakdown` 至 `PositionDetailsPanel` 組件
- [x] T018 [US2] 實作資金費率總計顯示：多頭總計、空頭總計、整體總計
- [x] T019 [US2] 實作資金費率查詢錯誤處理：查詢失敗時顯示錯誤訊息但不影響其他資訊

**Checkpoint**: User Story 2 完成 - 用戶可查看資金費率結算明細

---

## Phase 5: User Story 3 - 查看預估年化報酬率 (Priority: P3)

**Goal**: 用戶可查看目前持倉的預估年化報酬率

**Independent Test**: 展開持倉詳情，確認顯示預估年化報酬率百分比及計算依據

### Implementation for User Story 3

- [x] T020 [US3] 在 `PositionDetailsService` 加入年化報酬率計算方法 `calculateAnnualizedReturn` 於 `src/services/trading/PositionDetailsService.ts`
- [x] T021 [US3] 更新 API endpoint：加入年化報酬率資訊回傳於 `app/api/positions/[id]/details/route.ts`
- [x] T022 [US3] 建立 `AnnualizedReturnDisplay` 組件於 `app/(dashboard)/positions/components/AnnualizedReturnDisplay.tsx`
- [x] T023 [US3] 整合 `AnnualizedReturnDisplay` 至 `PositionDetailsPanel` 組件
- [x] T024 [US3] 實作年化報酬率邊界情況：持倉時間 < 1 分鐘或無損益時顯示「資料不足」提示
- [x] T025 [US3] 顯示計算依據：總損益、持倉時間、保證金

**Checkpoint**: User Story 3 完成 - 用戶可查看預估年化報酬率

---

## Phase 6: User Story 4 - 查看手續費資訊 (Priority: P4)

**Goal**: 用戶可查看開倉時產生的手續費（SHOULD 功能）

**Independent Test**: 展開持倉詳情，確認顯示開倉手續費資訊

### Implementation for User Story 4

- [x] T026 [US4] 在 `PositionDetailsService` 加入手續費查詢：從 Trade 記錄取得開倉手續費於 `src/services/trading/PositionDetailsService.ts`
- [x] T027 [US4] 更新 API endpoint：加入手續費資訊回傳於 `app/api/positions/[id]/details/route.ts`
- [x] T028 [US4] 在 `PositionDetailsPanel` 顯示手續費區塊於 `app/(dashboard)/positions/components/PositionDetailsPanel.tsx`
- [x] T029 [US4] 實作手續費總計顯示：多頭手續費 + 空頭手續費

**Checkpoint**: User Story 4 完成 - 用戶可查看手續費資訊

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 優化和跨功能改善

- [x] T030 [P] 加入結構化日誌：使用 Pino 記錄 API 查詢和錯誤於 `app/api/positions/[id]/details/route.ts`
- [x] T031 [P] 實作 API 超時處理：3 秒超時顯示錯誤於 `src/services/trading/PositionDetailsService.ts`
- [x] T032 [P] 優化前端效能：避免重複查詢（已展開時不重複呼叫 API）於 `app/(dashboard)/positions/hooks/usePositionDetails.ts`
- [x] T033 [P] 驗證 quickstart.md 流程：依照指南測試完整功能
- [x] T034 UI 細節調整：確保載入、錯誤、成功狀態的視覺一致性

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User Story 1 (P1): 可獨立實作和測試
  - User Story 2 (P2): 依賴 US1 的 PositionDetailsPanel 組件
  - User Story 3 (P3): 依賴 US1 和 US2 的損益資料
  - User Story 4 (P4): 可獨立於 US2/US3，但需要 US1 的基礎
- **Polish (Phase 7)**: Depends on all user stories being complete

### Within Each User Story

- Service 方法在 API endpoint 之前
- API endpoint 在前端組件之前
- 核心功能在錯誤處理之前

### Parallel Opportunities

**Phase 1 (可並行)**:
- T001 和 T002 可同時進行

**Phase 2 (部分可並行)**:
- T003 必須先完成（服務骨架）
- T004 和 T005 可並行（不同方法）
- T006 和 T007 依序進行

**User Story 1-4 (部分可並行)**:
- 不同 User Story 的 Service 方法可並行開發
- 同一 User Story 內依序進行

**Phase 7 (可並行)**:
- T030、T031、T032 可同時進行

---

## Parallel Example: Phase 1 Setup

```bash
# Launch all setup tasks together:
Task: "新增 PositionDetailsInfo 類型定義至 src/types/trading.ts"
Task: "新增 API 回應類型 PositionDetailsResponse 至 src/types/trading.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 2: Foundational (T003-T007)
3. Complete Phase 3: User Story 1 (T008-T013)
4. **STOP and VALIDATE**: 測試展開詳情功能，確認開倉價格、當前價格、未實現損益正確顯示
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → 基礎設施就緒
2. Add User Story 1 → 核心持倉詳情功能 (MVP!)
3. Add User Story 2 → 資金費率明細功能
4. Add User Story 3 → 年化報酬率功能
5. Add User Story 4 → 手續費資訊功能（SHOULD）
6. Polish → 日誌、效能、UI 優化

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story (US1/US2/US3/US4)
- 本功能不新增資料庫欄位，所有資料來自現有 Position + 即時 API 查詢
- 資金費率查詢重用既有 `FundingFeeQueryService`
- 使用 Decimal.js 處理所有財務計算
- 所有交易所 API 呼叫都在後端執行
