# Tasks: 通知加入開倉連結

**Input**: Design documents from `/specs/058-notification-open-link/`
**Prerequisites**: plan.md, spec.md, research.md, quickstart.md

**Tests**: 包含單元測試任務

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: 環境配置

- [x] T001 確認環境變數 `NEXT_PUBLIC_BASE_URL` 已在 `.env.local` 和 `.env.example` 中設定（使用 NEXT_PUBLIC_WS_URL 作為 fallback）

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 共用基礎設施 - 連結生成函式

**⚠️ CRITICAL**: User Story 1 和 2 都依賴此階段完成

- [x] T002 在 `src/services/notification/utils.ts` 新增 `generateOpenPositionUrl(symbol, longExchange, shortExchange)` 函式

**Checkpoint**: 連結生成函式就緒，可開始 User Story 實作

---

## Phase 3: User Story 1 - Discord 通知快速開倉 (Priority: P1) 🎯 MVP

**Goal**: 用戶在 Discord 收到套利機會通知時，可以直接點擊「開倉」連結，自動跳轉到市場監控頁面並開啟開倉對話框

**Independent Test**: 透過 Discord 發送測試通知，點擊連結驗證跳轉和對話框開啟

### Implementation for User Story 1

- [x] T003 [US1] 修改 `src/services/notification/DiscordNotifier.ts` 的 `sendArbitrageNotification` 方法，將「交易連結」區塊改為「快速操作」區塊，包含開倉連結
- [x] T004 [US1] 在 `app/(dashboard)/market-monitor/page.tsx` 新增 `useSearchParams` hook 解析 URL 參數 (symbol, long, short)
- [x] T005 [US1] 在 `app/(dashboard)/market-monitor/page.tsx` 新增 `useRef` 追蹤是否已從 URL 開啟對話框（避免重複觸發）
- [x] T006 [US1] 在 `app/(dashboard)/market-monitor/page.tsx` 新增 `useEffect` 監聽 URL 參數，當參數存在且 ratesMap 已載入時自動開啟開倉對話框
- [x] T007 [US1] 在 `app/(dashboard)/market-monitor/page.tsx` 處理 Edge Case：當 symbol 存在但交易所組合不匹配時，顯示提示訊息

**Checkpoint**: Discord 通知開倉連結完整可用，前端 URL 參數處理就緒

---

## Phase 4: User Story 2 - Slack 通知快速開倉 (Priority: P2)

**Goal**: 用戶在 Slack 收到套利機會通知時，可以直接點擊「開倉」連結，功能與 Discord 相同

**Independent Test**: 透過 Slack 發送測試通知，點擊連結驗證跳轉和對話框開啟

### Implementation for User Story 2

- [x] T008 [US2] 修改 `src/services/notification/SlackNotifier.ts` 的 `sendArbitrageNotification` 方法，將「交易連結」區塊改為「快速操作」區塊，包含開倉連結

**Checkpoint**: Slack 通知開倉連結完整可用

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: 測試和文件

- [x] T009 [P] 在 `tests/unit/services/notification/OpenLinkNotification.test.ts` 新增 `generateOpenPositionUrl` 函式測試：正確生成 URL、包含正確 query parameters、特殊字元正確編碼
- [x] T010 [P] 執行 `pnpm test` 確認所有測試通過
- [x] T011 執行 quickstart.md 中的驗收測試流程

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - 立即開始
- **Foundational (Phase 2)**: 依賴 Setup 完成 - BLOCKS all user stories
- **User Story 1 (Phase 3)**: 依賴 Foundational 完成
- **User Story 2 (Phase 4)**: 依賴 Foundational 完成，可與 US1 並行（但建議先完成 US1 確認前端處理正確）
- **Polish (Phase 5)**: 依賴 US1 和 US2 完成

### User Story Dependencies

- **User Story 1 (P1)**: 依賴 T002（連結生成函式），實作前端 URL 處理
- **User Story 2 (P2)**: 依賴 T002（連結生成函式），複用 US1 的前端處理

### Within Each User Story

- T003 (Discord) 可獨立完成
- T004-T007 (前端) 需依序完成
- T008 (Slack) 可獨立完成

### Parallel Opportunities

- T009 和 T010 可並行執行
- US1 和 US2 技術上可並行，但建議先完成 US1 驗證前端邏輯

---

## Parallel Example: Phase 5

```bash
# Launch all polish tasks together:
Task: T009 - 新增單元測試
Task: T010 - 執行測試確認
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002)
3. Complete Phase 3: User Story 1 (T003-T007)
4. **STOP and VALIDATE**: 使用 Discord 測試通知驗證完整流程
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → 連結生成就緒
2. Add User Story 1 → Discord 開倉連結可用 (MVP!)
3. Add User Story 2 → Slack 開倉連結可用
4. Add Polish → 測試完善

---

## Notes

- [P] tasks = 不同檔案，無依賴關係
- [Story] label 標記任務所屬 user story
- 每個 user story 應可獨立完成和測試
- 每個任務完成後 commit
- 在任何 checkpoint 可暫停驗證功能

---

## Task Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| Setup | 1 | 環境變數配置 |
| Foundational | 1 | 連結生成函式 |
| User Story 1 | 5 | Discord 通知 + 前端 URL 處理 |
| User Story 2 | 1 | Slack 通知 |
| Polish | 3 | 測試和驗收 |
| **Total** | **11** | |
