# Tasks: 統一持倉 groupId 架構

**Input**: Design documents from `/specs/070-unified-groupid/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: TDD 強制（Constitution 原則七），所有任務必須先寫測試。

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- **[TEST]**: TDD 測試任務（必須先執行並驗證 FAIL）
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: 準備開發環境和分支

- [ ] T001 確認在 070-unified-groupid 分支上
- [ ] T002 執行 `pnpm install` 確保依賴最新
- [ ] T003 執行 `pnpm docker:up` 確保資料庫可用

---

## Phase 2: Foundational - Database Migration (Blocking)

**Purpose**: 資料庫 schema 變更，必須先完成才能進行後續任務

**⚠️ CRITICAL**: 此階段必須完成後才能開始 User Story 實作

### Migration 任務

- [ ] T004 [TEST] 建立 migration 測試檔案 tests/integration/migration-unified-groupid.test.ts，驗證：(1) 現有 null groupId 持倉被補上 UUID (2) 現有有 groupId 的持倉不變 (3) 執行後無 null groupId
- [ ] T005 修改 prisma/schema.prisma：將 `groupId String?` 改為 `groupId String @default(dbgenerated("gen_random_uuid()"))`
- [ ] T006 執行 `npx prisma migrate dev --name unified-groupid` 產生 migration 檔案
- [ ] T007 驗證 migration 檔案包含：(1) UPDATE 現有 null 資料 (2) ALTER COLUMN SET NOT NULL (3) SET DEFAULT
- [ ] T008 執行 `pnpm db:generate` 重新產生 Prisma Client
- [ ] T009 執行 T004 的測試，驗證通過

**Checkpoint**: 資料庫層面完成，所有持倉都有 groupId

---

## Phase 3: User Story 1 - 單獨開倉自動分配 groupId (Priority: P1) 🎯 MVP

**Goal**: 單獨開倉時自動生成 groupId，而非 null

**Independent Test**: 呼叫單獨開倉 API，驗證回傳的持倉 groupId 為有效 UUID

### Tests for User Story 1

- [ ] T010 [TEST] [US1] 更新測試 tests/unit/services/PositionOrchestrator.test.ts：新增測試案例「單獨開倉應自動生成 groupId」，驗證 groupId 為有效 UUID
- [ ] T011 [TEST] [US1] 更新整合測試 tests/integration/position-group-open.test.ts：新增測試案例「單獨開倉的 Position 應有 groupId」

### Implementation for User Story 1

- [ ] T012 [US1] 修改 src/services/trading/PositionOrchestrator.ts：在 `openPosition` 方法中，若未提供 groupId，自動使用 `PositionGroupService.generateGroupId()` 生成
- [ ] T013 [US1] 修改 src/types/trading.ts：將 `PositionInfo.groupId` 類型從 `string | null` 改為 `string`
- [ ] T014 [US1] 執行 T010, T011 的測試，驗證通過

**Checkpoint**: 單獨開倉功能完成，新建持倉都有 groupId

---

## Phase 4: User Story 2 - 統一的持倉列表顯示格式 (Priority: P1)

**Goal**: API 回應只包含 groups 陣列，不再有獨立的 positions 陣列

**Independent Test**: 呼叫 GET /api/positions?grouped=true，驗證回應只有 groups 陣列

### Tests for User Story 2

- [ ] T015 [TEST] [P] [US2] 更新測試 tests/unit/services/PositionGroupService.test.ts：修改現有測試，移除對 positions 陣列的預期
- [ ] T016 [TEST] [P] [US2] 更新測試 tests/unit/lib/position-group.test.ts：修改 `toGroupedPositionsResponse` 測試，預期只回傳 groups

### Implementation for User Story 2

- [ ] T017 [P] [US2] 修改 src/types/position-group.ts：將 `GroupedPositionsResponse` 的 `positions` 欄位移除
- [ ] T018 [US2] 修改 src/lib/position-group.ts：更新 `toGroupedPositionsResponse` 函數，所有持倉都放入 groups（即使 group 只有 1 個持倉）
- [ ] T019 [US2] 修改 src/services/trading/PositionGroupService.ts：移除 null groupId 的特殊處理邏輯
- [ ] T020 [US2] 修改 app/api/positions/route.ts：更新 grouped=true 的回應格式，只回傳 groups
- [ ] T021 [US2] 執行 T015, T016 的測試，驗證通過

**Checkpoint**: API 格式統一，前端可開始更新

---

## Phase 5: User Story 3 - 現有資料 Migration (Priority: P1)

**Goal**: 確保 Phase 2 的 migration 正確處理現有資料

**Independent Test**: 查詢資料庫驗證沒有 null groupId

**Note**: 此 User Story 主要由 Phase 2 完成，此處為驗證任務

### Verification Tasks

- [ ] T022 [US3] 執行 migration 驗證腳本：`SELECT COUNT(*) FROM positions WHERE "groupId" IS NULL`，預期結果為 0
- [ ] T023 [US3] 執行整合測試 tests/integration/position-backward-compat.test.ts，驗證向後相容性

**Checkpoint**: 資料 migration 驗證完成

---

## Phase 6: User Story 4 - 前端統一顯示邏輯 (Priority: P2)

**Goal**: 前端使用統一的 groups 格式顯示所有持倉

**Independent Test**: 在前端介面查看持倉列表，所有持倉都以 group 卡片形式顯示

### Implementation for User Story 4

- [ ] T024 [US4] 檢視 app/(dashboard)/positions/ 目錄，確認需要修改的前端組件
- [ ] T025 [US4] 修改持倉列表組件：移除對 `positions` 陣列的處理，只使用 `groups` 陣列
- [ ] T026 [US4] 修改持倉卡片組件：確保 positionCount 為 1 時也正確顯示
- [ ] T027 [US4] 手動測試前端頁面，確認顯示正確

**Checkpoint**: 前端更新完成，功能完整

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 清理和驗證

- [ ] T028 執行所有單元測試：`pnpm test tests/unit/`
- [ ] T029 執行所有整合測試：`RUN_INTEGRATION_TESTS=true pnpm test tests/integration/position-group-*.test.ts`
- [ ] T030 執行 TypeScript 類型檢查：`pnpm exec tsc --noEmit`
- [ ] T031 執行 ESLint 檢查：`pnpm lint`
- [ ] T032 移除廢棄的程式碼和註解
- [ ] T033 更新 CHANGELOG.md 記錄此功能變更

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 無依賴
- **Phase 2 (Migration)**: 依賴 Phase 1 - **BLOCKS 所有 User Stories**
- **Phase 3 (US1)**: 依賴 Phase 2
- **Phase 4 (US2)**: 依賴 Phase 2，可與 Phase 3 平行
- **Phase 5 (US3)**: 依賴 Phase 2 完成
- **Phase 6 (US4)**: 依賴 Phase 4 (API 格式需先統一)
- **Phase 7 (Polish)**: 依賴所有 User Stories 完成

### User Story Dependencies

```
Phase 2 (Migration) ─┬─> US1 (單獨開倉) ─┐
                     │                   │
                     ├─> US2 (API 格式) ─┼─> US4 (前端)
                     │                   │
                     └─> US3 (資料驗證) ─┘
                                         │
                                         └─> Phase 7 (Polish)
```

### Parallel Opportunities

**Phase 3 & 4 可平行執行**:
- US1 (PositionOrchestrator) 和 US2 (PositionGroupService, API) 修改不同檔案

**Phase 4 內部可平行**:
```bash
# 可同時執行:
Task T015: tests/unit/services/PositionGroupService.test.ts
Task T016: tests/unit/lib/position-group.test.ts
Task T017: src/types/position-group.ts
```

---

## Implementation Strategy

### MVP First (US1 + US2 + US3)

1. 完成 Phase 1: Setup
2. 完成 Phase 2: Migration (CRITICAL)
3. 完成 Phase 3: US1 - 單獨開倉有 groupId
4. 完成 Phase 4: US2 - API 格式統一
5. 完成 Phase 5: US3 - 資料驗證
6. **STOP and VALIDATE**: 後端功能完整
7. 選擇性完成 Phase 6: US4 - 前端更新

### TDD 工作流程

每個標記 [TEST] 的任務：
1. 先寫測試
2. 執行測試，確認 **FAIL**
3. 實作功能
4. 執行測試，確認 **PASS**
5. 重構（如需要）

---

## Notes

- 所有 migration 必須使用 `prisma migrate dev`，禁止手動 SQL
- Schema 變更必須與 migration 檔案同一個 commit
- [TEST] 任務必須先執行並驗證 FAIL，才能進入實作
- 每個 User Story 完成後都應該可以獨立測試
