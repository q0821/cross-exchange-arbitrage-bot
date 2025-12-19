# Tasks: 手動標記持倉已平倉

**Input**: Design documents from `/specs/037-specify-scripts-bash/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Not explicitly requested - test tasks excluded.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Path Conventions
- **Next.js App Router**: `app/api/` for API routes, `app/(dashboard)/` for dashboard pages

---

## Phase 1: Setup

**Purpose**: 確認現有基礎設施可用

- [x] T001 確認現有 Position 模型包含 status 和 closedAt 欄位 (prisma/schema.prisma)
- [x] T002 確認現有認證中間件可用 (src/middleware/authMiddleware.ts)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 準備共用元件

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 建立 Zod 請求驗證 schema 在 app/api/positions/[id]/route.ts

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - 標記單一持倉為已平倉 (Priority: P1) 🎯 MVP

**Goal**: 讓用戶能夠手動將持倉標記為「已平倉」

**Independent Test**: 在 UI 上點擊「標記已平倉」按鈕，驗證持倉狀態變更為 CLOSED 並從活躍列表中移除

### Implementation for User Story 1

- [x] T004 [US1] 建立 PATCH handler 在 app/api/positions/[id]/route.ts
  - 驗證用戶身份 (authenticate)
  - 驗證持倉所有權 (userId 匹配)
  - 驗證狀態轉換規則 (只允許 OPEN、PARTIAL、FAILED → CLOSED)
  - 更新 status 為 CLOSED 和 closedAt 為當前時間
  - 記錄操作日誌

- [x] T005 [P] [US1] 在 PositionCard 組件新增「標記已平倉」按鈕 (app/(dashboard)/positions/components/PositionCard.tsx)
  - 新增 onMarkAsClosed prop
  - 針對 OPEN、PARTIAL、FAILED 狀態顯示按鈕
  - 使用灰色系樣式 (bg-gray-100 text-gray-600 hover:bg-gray-200)
  - 按鈕位置在平倉按鈕下方

- [x] T006 [US1] 在 PositionsPage 新增處理邏輯 (app/(dashboard)/positions/page.tsx)
  - 新增 handleMarkAsClosed 函數
  - 調用 PATCH API
  - 成功後刷新持倉列表
  - 錯誤處理和提示

- [x] T007 [US1] 新增操作日誌記錄 (在 T004 的 PATCH handler 中)
  - 使用 Pino 結構化日誌
  - 記錄 positionId, userId, previousStatus, timestamp

**Checkpoint**: User Story 1 完成 - 用戶可以手動標記持倉為已平倉

---

## Phase 4: User Story 2 - 查看已平倉記錄 (Priority: P2)

**Goal**: 讓用戶能夠查看已平倉的持倉記錄

**Independent Test**: 標記持倉為已平倉後，使用 status=CLOSED 參數查詢 API，驗證可以看到已平倉記錄

### Implementation for User Story 2

- [x] T008 [US2] 驗證現有 GET /api/positions API 支援 status=CLOSED 查詢 (app/api/positions/route.ts)
  - 確認 statusParam 解析正確處理 CLOSED
  - 確認回應格式正確

**Note**: 現有 API 已支援 status 參數查詢，此任務主要為驗證現有功能

**Checkpoint**: User Story 2 完成 - 用戶可以查看已平倉記錄

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: 優化和完善

- [x] T009 驗證 quickstart.md 中的 API 範例可正常運作
- [x] T010 執行手動整合測試 (開啟持倉頁面 → 點擊標記已平倉 → 驗證狀態變更)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - 確認現有基礎設施
- **Foundational (Phase 2)**: Depends on Setup completion
- **User Story 1 (Phase 3)**: Depends on Foundational phase completion
- **User Story 2 (Phase 4)**: Can proceed independently of US1 (驗證現有功能)
- **Polish (Phase 5)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: 核心功能，無外部依賴
- **User Story 2 (P2)**: 無外部依賴 (使用現有 API)

### Within User Story 1

- T004 (API) 和 T005 (UI 組件) 可並行開發
- T006 (頁面邏輯) 依賴 T004 和 T005 完成
- T007 (日誌) 整合在 T004 中

### Parallel Opportunities

```bash
# Phase 3 並行任務:
# 以下兩個任務可同時進行 (不同檔案)
Task: T004 - PATCH handler (app/api/positions/[id]/route.ts)
Task: T005 - PositionCard 按鈕 (app/(dashboard)/positions/components/PositionCard.tsx)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (驗證現有基礎設施)
2. Complete Phase 2: Foundational (建立 Zod schema)
3. Complete Phase 3: User Story 1 (API + UI)
4. **STOP and VALIDATE**: 測試標記功能
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → 核心功能完成 (MVP!)
3. Add User Story 2 → 驗證現有查詢功能
4. Polish → 文檔和測試驗證

---

## Summary

| Phase | Task Count | Description |
|-------|------------|-------------|
| Setup | 2 | 確認現有基礎設施 |
| Foundational | 1 | Zod schema |
| User Story 1 | 4 | API + UI 核心功能 |
| User Story 2 | 1 | 驗證現有查詢 |
| Polish | 2 | 驗證和測試 |
| **Total** | **10** | |

---

## Notes

- [P] tasks = 不同檔案，無依賴
- [Story] 標籤對應 spec.md 中的用戶故事
- 每個用戶故事可獨立完成和測試
- 在 Checkpoint 處驗證功能
- 每完成一個任務或邏輯群組後提交
