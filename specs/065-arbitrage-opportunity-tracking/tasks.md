# Tasks: ArbitrageOpportunity 即時追蹤記錄

**Input**: Design documents from `/specs/065-arbitrage-opportunity-tracking/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Constitution Compliance**:
- ✅ Principle IV (Migration Mandate): Migration 檔案必須與 schema 一起 commit
- ✅ Principle VII (TDD Discipline): 測試先寫、先 FAIL、再實作

## Format: `[ID] [P?] [Story?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- **[TEST]**: 測試任務標記
- Include exact file paths in descriptions

## User Stories 對應

| Story | Priority | 說明 |
|-------|----------|------|
| US1 | P1 | 訪客查看歷史套利機會 |
| US2 | P1 | 即時記錄新發現的套利機會 |
| US3 | P2 | 記錄套利機會結束 |
| US4 | P3 | 時間範圍篩選 |

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 資料庫 Schema 和基礎設定

- [ ] T001 新增 ArbitrageOpportunity model 到 `prisma/schema.prisma`
- [ ] T002 執行 `npx prisma migrate dev --name add-arbitrage-opportunity` 產生 migration
- [ ] T003 執行 `npx prisma generate` 產生 Prisma Client

**⚠️ CRITICAL (Principle IV)**: T001 和 T002 必須一起完成，migration 檔案必須與 schema 一起 commit

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 核心 Repository 和類型定義，所有 User Story 都依賴這些

**⚠️ CRITICAL**: 此階段必須完成後才能開始 User Story 實作

### Tests for Foundational (RED Phase) 🔴

- [ ] T004 [P] [TEST] 建立 Repository 單元測試骨架 `tests/unit/repositories/ArbitrageOpportunityRepository.test.ts`
  - **執行測試，驗證 FAIL**（類別不存在）

### Implementation for Foundational (GREEN Phase) 🟢

- [ ] T005 [P] 建立 Domain Model `src/models/ArbitrageOpportunity.ts`
  - 定義 `CreateOpportunityInput`, `UpdateOpportunityInput`, `UpsertOpportunityInput` types
  - 定義 `PublicOpportunitiesOptions` type
  - 定義 `PublicOpportunity` response type
- [ ] T006 實作 `ArbitrageOpportunityRepository` 類別 `src/repositories/ArbitrageOpportunityRepository.ts`
  - 實作 `create()`, `update()`, `findActiveByKey()` 方法
  - 實作 `markAsEnded()`, `upsert()` 方法
  - 實作 `getPublicOpportunities()`, `findAllActiveBySymbol()` 方法
  - **執行 T004 測試，驗證 PASS**

### Refactor for Foundational 🔵

- [ ] T007 完善 Repository 測試案例（全部方法覆蓋）`tests/unit/repositories/ArbitrageOpportunityRepository.test.ts`
  - **執行所有測試，驗證全部 PASS**

**Checkpoint**: Foundation ready - User Story 實作可以開始

---

## Phase 3: User Story 2 - 即時記錄新發現的套利機會 (Priority: P1) 🎯 MVP

**Goal**: 當監測服務偵測到套利機會時，立即記錄到資料庫

**Independent Test**: 啟動監測服務 → 等待偵測到機會 → 查詢資料庫驗證記錄存在

**注意**: 雖然 US1 是首頁顯示，但 US2（記錄機會）是資料來源，必須先完成

### Tests for User Story 2 (RED Phase) 🔴

- [ ] T008 [P] [TEST] [US2] 建立 Tracker 單元測試 `tests/unit/services/ArbitrageOpportunityTracker.test.ts`
  - 測試 `attach()` 正確綁定事件
  - 測試 `handleOpportunityDetected()` 正常記錄
  - 測試 `handleOpportunityDetected()` 無 bestPair 時跳過
  - 測試 `handleOpportunityDetected()` 資料庫錯誤時不中斷監測
  - **執行測試，驗證 FAIL**

### Implementation for User Story 2 (GREEN Phase) 🟢

- [ ] T009 [US2] 實作 `ArbitrageOpportunityTracker` 類別 `src/services/monitor/ArbitrageOpportunityTracker.ts`
  - 實作 `attach()`, `detach()` 方法
  - 實作 `handleOpportunityDetected()` 方法
  - 實作 `getStats()` 方法
  - **執行 T008 測試，驗證 PASS**
- [ ] T010 [US2] 整合 Tracker 到 MonitorService `src/services/MonitorService.ts`
  - 在 `start()` 中初始化 ArbitrageOpportunityTracker
  - 在 `stop()` 中呼叫 `tracker.detach()`
  - 新增結構化日誌

### Refactor for User Story 2 🔵

- [ ] T011 [US2] 驗證端對端流程
  - 手動啟動 monitor CLI
  - 確認機會偵測時有新增資料庫記錄
  - **執行所有測試，驗證全部 PASS**

**Checkpoint**: User Story 2 完成 - 機會可以被即時記錄

---

## Phase 4: User Story 3 - 記錄套利機會結束 (Priority: P2)

**Goal**: 當機會消失時，將記錄標記為已結束

**Independent Test**: 製造機會消失情況 → 驗證記錄狀態為 ENDED

### Tests for User Story 3 (RED Phase) 🔴

- [ ] T012 [P] [TEST] [US3] 新增 Tracker 結束測試 `tests/unit/services/ArbitrageOpportunityTracker.test.ts`
  - 測試 `handleOpportunityDisappeared()` 正常結束
  - 測試 `handleOpportunityDisappeared()` 結束多個機會
  - **執行測試，驗證 FAIL**

### Implementation for User Story 3 (GREEN Phase) 🟢

- [ ] T013 [US3] 實作 `handleOpportunityDisappeared()` 方法 `src/services/monitor/ArbitrageOpportunityTracker.ts`
  - 查找所有 ACTIVE 狀態的記錄
  - 呼叫 `repository.markAsEnded()`
  - 更新統計和日誌
  - **執行 T012 測試，驗證 PASS**

### Refactor for User Story 3 🔵

- [ ] T014 [US3] 驗證結束流程
  - 等待機會消失
  - 確認資料庫記錄狀態為 ENDED
  - **執行所有測試，驗證全部 PASS**

**Checkpoint**: User Story 3 完成 - 機會生命週期完整追蹤

---

## Phase 5: User Story 1 - 訪客查看歷史套利機會 (Priority: P1)

**Goal**: 公開首頁顯示歷史套利機會列表

**Independent Test**: 訪問首頁 → 確認顯示歷史記錄（或空狀態）

**注意**: 此 User Story 依賴 US2 和 US3 提供資料

### Tests for User Story 1 (RED Phase) 🔴

- [ ] T015 [P] [TEST] [US1] 建立公開 API 測試 `tests/unit/repositories/ArbitrageOpportunityRepository.public.test.ts`
  - 測試 `getPublicOpportunities()` 分頁
  - 測試 `getPublicOpportunities()` 空結果
  - 測試 `getPublicOpportunities()` 排序（按 endedAt 降序）
  - **執行測試，驗證 FAIL**

### Implementation for User Story 1 (GREEN Phase) 🟢

- [ ] T016 [US1] 更新公開 API route `app/api/public/opportunities/route.ts`
  - 改用 `ArbitrageOpportunityRepository.getPublicOpportunities()`
  - 保持相同的 response 格式
  - **執行 T015 測試，驗證 PASS**
- [ ] T017 [P] [US1] 更新 `get-public-opportunities.ts` helper `src/lib/get-public-opportunities.ts`
  - 改用新的 Repository
  - 新增 `durationFormatted` 欄位轉換

### Refactor for User Story 1 🔵

- [ ] T018 [US1] 驗證首頁顯示
  - 訪問 `http://localhost:3000`
  - 確認歷史套利機會列表顯示正確
  - 確認空狀態訊息正確
  - **執行所有測試，驗證全部 PASS**

**Checkpoint**: User Story 1 完成 - 公開首頁可顯示歷史記錄

---

## Phase 6: User Story 4 - 時間範圍篩選 (Priority: P3)

**Goal**: 支援按時間範圍篩選歷史記錄

**Independent Test**: 選擇不同時間篩選 → 驗證結果在指定範圍內

### Tests for User Story 4 (RED Phase) 🔴

- [ ] T019 [P] [TEST] [US4] 新增時間篩選測試 `tests/unit/repositories/ArbitrageOpportunityRepository.public.test.ts`
  - 測試 `days` 參數 7/30/90 天篩選
  - 測試 `status` 參數 ACTIVE/ENDED/all 篩選
  - **執行測試，驗證 FAIL**

### Implementation for User Story 4 (GREEN Phase) 🟢

- [ ] T020 [US4] 確認 Repository 支援時間篩選 `src/repositories/ArbitrageOpportunityRepository.ts`
  - 驗證 `days` 參數正確過濾
  - 驗證 `status` 參數正確過濾
  - **執行 T019 測試，驗證 PASS**
- [ ] T021 [US4] 更新公開 API 支援篩選參數 `app/api/public/opportunities/route.ts`
  - 支援 `days` query parameter
  - 支援 `status` query parameter
  - 驗證參數範圍（days: 7/30/90）

### Refactor for User Story 4 🔵

- [ ] T022 [US4] 驗證篩選功能
  - 測試各種篩選組合
  - **執行所有測試，驗證全部 PASS**

**Checkpoint**: User Story 4 完成 - 時間範圍篩選可用

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 整合測試和最終驗證

- [ ] T023 [P] 建立整合測試 `tests/integration/ArbitrageOpportunityFlow.test.ts`
  - 完整生命週期：create → update → markAsEnded
  - 公開 API 回應格式驗證
- [ ] T024 更新 CLAUDE.md Feature 065 區段
- [ ] T025 執行 `quickstart.md` 驗證流程
- [ ] T026 執行 `pnpm lint && pnpm exec tsc --noEmit` 確認無錯誤

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup) ──────────────┐
                              │
                              ▼
Phase 2 (Foundational) ───────┤
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ▼                   ▼                   ▼
    Phase 3 (US2)       Phase 4 (US3)       (等待 US2+US3)
    即時記錄機會         記錄機會結束              │
          │                   │                   │
          └─────────┬─────────┘                   │
                    │                             │
                    ▼                             ▼
              Phase 5 (US1) ◄──────────────────────
              首頁顯示
                    │
                    ▼
              Phase 6 (US4)
              時間篩選
                    │
                    ▼
              Phase 7 (Polish)
```

### User Story Dependencies

- **User Story 2 (P1)**: 無依賴，可在 Foundational 後立即開始 ✅
- **User Story 3 (P2)**: 無依賴，可與 US2 並行開發 ✅
- **User Story 1 (P1)**: 依賴 US2 和 US3 提供資料
- **User Story 4 (P3)**: 依賴 US1 完成

### Within Each User Story

1. **RED**: 測試先寫，驗證 FAIL
2. **GREEN**: 最小實作，驗證 PASS
3. **REFACTOR**: 重構和端對端驗證

### Parallel Opportunities

**Phase 2 並行**:
```
T004 [TEST] Repository 測試
T005 Domain Model
→ 可同時進行，T006 等待兩者完成
```

**Phase 3 + 4 並行** (如有多人):
```
Developer A: Phase 3 (US2) - 記錄機會
Developer B: Phase 4 (US3) - 結束機會
→ 兩者可並行開發
```

---

## Parallel Example: Phase 2

```bash
# 同時進行：
Task T004: "建立 Repository 單元測試骨架"
Task T005: "建立 Domain Model"

# 完成後：
Task T006: "實作 ArbitrageOpportunityRepository"
```

---

## Implementation Strategy

### MVP First (US2 Only)

1. ✅ Complete Phase 1: Setup (Schema + Migration)
2. ✅ Complete Phase 2: Foundational (Repository)
3. ✅ Complete Phase 3: User Story 2 (即時記錄)
4. **STOP and VALIDATE**: 確認機會可被記錄
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → 基礎架構完成
2. Add US2 (記錄機會) → 資料開始收集
3. Add US3 (結束機會) → 生命週期完整
4. Add US1 (首頁顯示) → 用戶可見
5. Add US4 (時間篩選) → 增強體驗

### TDD Execution Reminder

**每個 User Story 必須遵循**:

1. 🔴 **RED**: 寫測試 → `pnpm test` → 確認 FAIL
2. 🟢 **GREEN**: 寫最小實作 → `pnpm test` → 確認 PASS
3. 🔵 **REFACTOR**: 改善程式碼 → `pnpm test` → 確認仍 PASS

---

## Notes

- [P] 任務 = 不同檔案，無相依性
- [TEST] 任務 = 必須先執行驗證 FAIL
- [Story] 標籤 = 對應 spec.md 的 User Story
- Migration 必須與 schema 一起 commit (Principle IV)
- 測試必須先寫先 FAIL (Principle VII)
- 每個 checkpoint 後可獨立驗證該 Story
