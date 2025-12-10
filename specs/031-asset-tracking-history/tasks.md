# Tasks: 交易所資產追蹤和歷史曲線

**Input**: Design documents from `/specs/031-asset-tracking-history/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: 本規格未明確要求測試，測試任務為選擇性項目。

**Organization**: 任務依 User Story 分組，支援獨立實作和測試。

## Format: `[ID] [P?] [Story] Description`
- **[P]**: 可並行執行（不同檔案，無依賴）
- **[Story]**: 所屬 User Story (US1-US5)
- 包含完整檔案路徑

---

## Phase 1: Setup (共享基礎設施)

**Purpose**: 資料模型和 Repository 層設置

- [x] T001 新增 AssetSnapshot 模型至 prisma/schema.prisma
- [x] T002 新增 User 模型的 assetSnapshots relation 至 prisma/schema.prisma
- [x] T003 建立 Prisma migration: `pnpm prisma migrate dev --name add_asset_snapshots`
- [x] T004 [P] 建立 src/services/assets/ 目錄結構
- [x] T005 [P] 實作 AssetSnapshotRepository 在 src/repositories/AssetSnapshotRepository.ts

---

## Phase 2: Foundational (阻塞性前置作業)

**Purpose**: 核心服務層，必須在 User Story 實作前完成

**⚠️ CRITICAL**: 此階段完成前，不可開始 User Story 實作

- [x] T006 實作 UserConnectorFactory 在 src/services/assets/UserConnectorFactory.ts
- [x] T007 補完 Binance getPositions() 在 src/connectors/binance.ts（使用 /fapi/v2/positionRisk）
- [x] T008 [P] 驗證 OKX getBalance() 和 getPositions() 在 src/connectors/okx.ts
- [x] T009 [P] 驗證 MEXC getBalance() 和 getPositions() 在 src/connectors/mexc.ts（如有）
- [x] T010 [P] 驗證 Gate.io getBalance() 和 getPositions() 在 src/connectors/gate.ts（如有）
- [x] T011 實作 AssetSnapshotService 核心方法在 src/services/assets/AssetSnapshotService.ts
- [x] T012 新增環境變數 ENABLE_ASSET_SNAPSHOT、ASSET_SNAPSHOT_INTERVAL_MS 至 .env.example

**Checkpoint**: Foundation ready - User Story 實作可開始

---

## Phase 3: User Story 1 - 查看即時資產總覽 (Priority: P1) 🎯 MVP

**Goal**: 用戶在一個頁面上看到各交易所的總資產（USD）和連線狀態

**Independent Test**: 登入後訪問資產頁面，確認各交易所餘額正確顯示

### Implementation for User Story 1

- [x] T013 [US1] 實作 GET /api/assets 端點在 app/api/assets/route.ts
- [x] T014 [US1] 建立 assets 頁面結構在 app/(dashboard)/assets/page.tsx
- [x] T015 [P] [US1] 實作 TotalAssetCard 組件在 app/(dashboard)/assets/components/TotalAssetCard.tsx
- [x] T016 [P] [US1] 實作 AssetSummaryCard 組件在 app/(dashboard)/assets/components/AssetSummaryCard.tsx
- [x] T017 [US1] 整合 API 呼叫和狀態管理至 assets/page.tsx
- [x] T018 [US1] 處理無 API Key 狀態，顯示引導訊息
- [x] T019 [US1] 處理 API 錯誤狀態，顯示明確錯誤訊息和建議操作
- [x] T020 [US1] 更新 Dashboard 導航，新增 Assets 連結

**Checkpoint**: User Story 1 完成，可獨立測試即時資產總覽功能

---

## Phase 4: User Story 2 - 查看資產歷史曲線 (Priority: P1)

**Goal**: 用戶查看過去 30 天的資產變化曲線圖

**Independent Test**: 確認曲線圖正確呈現、時間範圍可選擇、各交易所曲線可辨識

**Dependencies**: 需要 US3 提供歷史資料，但可先用 seed 資料測試 UI

### Implementation for User Story 2

- [x] T021 [US2] 實作 GET /api/assets/history 端點在 app/api/assets/history/route.ts
- [x] T022 [P] [US2] 實作 TimeRangeSelector 組件在 app/(dashboard)/assets/components/TimeRangeSelector.tsx
- [x] T023 [US2] 實作 AssetHistoryChart 組件在 app/(dashboard)/assets/components/AssetHistoryChart.tsx（Recharts AreaChart）
- [x] T024 [US2] 整合曲線圖至 assets/page.tsx
- [x] T025 [US2] 實作期間統計摘要（起始/結束總資產、變化金額/百分比）
- [x] T026 [US2] 處理無歷史資料狀態，顯示提示訊息

**Checkpoint**: User Story 2 完成，可獨立測試歷史曲線功能（需有快照資料）

---

## Phase 5: User Story 3 - 自動記錄資產快照 (Priority: P1)

**Goal**: 系統每小時自動記錄所有用戶的資產快照

**Independent Test**: 等待一小時後確認資料庫有新增快照記錄，或手動觸發測試

### Implementation for User Story 3

- [x] T027 [US3] 實作 AssetSnapshotScheduler 在 src/services/assets/AssetSnapshotScheduler.ts
- [x] T028 [US3] 實作 createSnapshotForUser() 方法，處理單一用戶快照建立
- [x] T029 [US3] 實作批次處理邏輯（Promise.allSettled + BATCH_SIZE=10）
- [x] T030 [US3] 實作連續失敗計數器和警告機制
- [x] T031 [US3] 實作 30 天過期資料清理邏輯 cleanupOldSnapshots()
- [x] T032 [US3] 整合 AssetSnapshotScheduler 至 server.ts
- [x] T033 [US3] 導出 startAssetSnapshotScheduler, stopAssetSnapshotScheduler, getAssetSnapshotSchedulerStatus
- [x] T034 [US3] 在 server.ts shutdown() 中停止排程服務

**Checkpoint**: User Story 3 完成，自動快照機制運作正常

---

## Phase 6: User Story 4 - 查看當前持倉 (Priority: P2)

**Goal**: 用戶看到各交易所的期貨持倉（幣種、方向、數量、未實現損益）

**Independent Test**: 在交易所開倉後，確認系統顯示正確持倉資訊

### Implementation for User Story 4

- [x] T035 [US4] 實作 GET /api/assets/positions 端點在 app/api/assets/positions/route.ts
- [x] T036 [US4] 實作 PositionTable 組件在 app/(dashboard)/assets/components/PositionTable.tsx
- [x] T037 [US4] 整合持倉列表至 assets/page.tsx（可收合區塊）
- [x] T038 [US4] 處理無持倉狀態，顯示「目前無持倉」提示
- [x] T039 [US4] 顯示總未實現損益摘要

**Checkpoint**: User Story 4 完成，可獨立測試持倉查詢功能

---

## Phase 7: User Story 5 - 手動刷新資產 (Priority: P2)

**Goal**: 用戶手動刷新資產資料，不必等待下次自動快照

**Independent Test**: 點擊刷新按鈕，確認資料更新

### Implementation for User Story 5

- [x] T040 [US5] 擴展 GET /api/assets 支援 ?refresh=true 參數
- [x] T041 [US5] 實作刷新頻率限制（Rate Limiting）邏輯
- [x] T042 [US5] 新增刷新按鈕至 assets/page.tsx
- [x] T043 [US5] 處理 429 Too Many Requests 錯誤，顯示「請稍後再試」
- [x] T044 [US5] 刷新時顯示 Loading 狀態

**Checkpoint**: User Story 5 完成，手動刷新功能正常

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: 跨 User Story 的改進和優化

- [x] T045 [P] 建立測試 seed 腳本 scripts/seed-asset-snapshots.ts
- [x] T046 [P] 新增 Pino 結構化日誌至所有服務（AssetSnapshotService, Scheduler）
- [x] T047 更新 Dashboard 側邊欄 icon 和排序
- [x] T048 [P] 處理 Edge Cases：API Key 失效、交易所 API 超時、所有交易所都無法連線
- [ ] T049 執行 quickstart.md 驗證流程
- [ ] T050 更新 README.md 功能說明（如需要）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 無依賴 - 可立即開始
- **Phase 2 (Foundational)**: 依賴 Phase 1 完成 - **阻塞所有 User Stories**
- **Phase 3-7 (User Stories)**: 全部依賴 Phase 2 完成
  - US1, US3 可並行
  - US2 UI 可先開發，但需 US3 資料才能完整測試
  - US4, US5 可並行，獨立於 US1-US3
- **Phase 8 (Polish)**: 依賴所需 User Stories 完成

### User Story Dependencies

```
Phase 2 (Foundational)
    │
    ├─▶ US1 (即時總覽) ──▶ 獨立可測試 ✓
    │
    ├─▶ US2 (歷史曲線) ──▶ 需要 US3 資料
    │
    ├─▶ US3 (自動快照) ──▶ 獨立可測試 ✓
    │
    ├─▶ US4 (持倉查詢) ──▶ 獨立可測試 ✓
    │
    └─▶ US5 (手動刷新) ──▶ 獨立可測試 ✓
```

### Within Each User Story

- API 端點 → 前端組件 → 整合 → 錯誤處理
- 服務層 → 排程層（US3）
- 核心功能 → 邊界情況

### Parallel Opportunities

**Phase 1:**
- T004, T005 可並行

**Phase 2:**
- T008, T009, T010 可並行（不同連接器）

**Phase 3 (US1):**
- T015, T016 可並行（不同組件）

**Phase 6 (US4) + Phase 7 (US5):**
- 整個 Phase 6 和 Phase 7 可並行（獨立功能）

---

## Parallel Example: Phase 3 (User Story 1)

```bash
# 並行執行組件開發:
Task: "T015 [P] [US1] 實作 TotalAssetCard 組件"
Task: "T016 [P] [US1] 實作 AssetSummaryCard 組件"

# 組件完成後，執行整合:
Task: "T017 [US1] 整合 API 呼叫和狀態管理至 assets/page.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 + 3)

1. Complete Phase 1: Setup (Prisma model + migration)
2. Complete Phase 2: Foundational (Connectors + Services)
3. Complete Phase 3: User Story 1 (即時資產總覽)
4. Complete Phase 5: User Story 3 (自動快照)
5. **STOP and VALIDATE**: 測試即時總覽 + 快照機制
6. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → 基礎架構就緒
2. Add US1 (即時總覽) → Deploy (MVP v1)
3. Add US3 (自動快照) → 開始累積歷史資料
4. Add US2 (歷史曲線) → Deploy (有曲線圖)
5. Add US4 (持倉查詢) → Deploy
6. Add US5 (手動刷新) → Deploy (完整功能)

### Suggested MVP Scope

**MVP = US1 + US3**
- US1: 即時看到各交易所資產
- US3: 開始累積歷史資料

曲線圖 (US2) 需要歷史資料累積，可在 MVP 之後逐步完善。

---

## Summary

| Phase | User Story | Tasks | Parallel Tasks |
|-------|------------|-------|----------------|
| 1 | Setup | 5 | 2 |
| 2 | Foundational | 7 | 3 |
| 3 | US1 - 即時總覽 | 8 | 2 |
| 4 | US2 - 歷史曲線 | 6 | 1 |
| 5 | US3 - 自動快照 | 8 | 0 |
| 6 | US4 - 持倉查詢 | 5 | 0 |
| 7 | US5 - 手動刷新 | 5 | 0 |
| 8 | Polish | 6 | 3 |
| **Total** | | **50** | **11** |

---

## Notes

- [P] tasks = 不同檔案，無依賴
- [Story] label 標記任務所屬 User Story
- 每個 User Story 可獨立完成和測試
- 每個任務或邏輯群組完成後 commit
- 遇到 checkpoint 可暫停驗證
