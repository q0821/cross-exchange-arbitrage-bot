# Tasks: 停損停利觸發偵測與自動平倉

**Input**: Design documents from `/specs/050-sl-tp-trigger-monitor/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: 本功能不需要額外的測試任務（依據 Constitution VII: TDD Discipline，實作時需先寫測試）

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 資料模型更新和基礎類型定義

- [x] T001 新增 CloseReason enum 到 prisma/schema.prisma
- [x] T002 新增 closeReason 欄位到 Position 模型 in prisma/schema.prisma
- [x] T003 執行 Prisma migration: `pnpm prisma migrate dev --name add-close-reason`
- [x] T004 [P] 建立觸發監控類型定義 in src/services/monitor/types.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 核心基礎設施，所有 User Story 都依賴這些任務

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 重構 ExchangeQueryService 為可重用模組 in src/lib/exchange-query-service.ts（從 src/scripts/trading-validation/ 移出）
- [x] T006 [P] 實作訂單歷史查詢方法（確認觸發 vs 取消）in src/lib/exchange-query-service.ts
- [x] T007 擴展 PositionCloser 新增 closeSingleSide() 方法 in src/services/trading/PositionCloser.ts
- [x] T008 [P] 新增 cancelSingleSideConditionalOrders() 方法 in src/services/trading/PositionCloser.ts

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - 條件單觸發自動偵測 (Priority: P1) 🎯 MVP

**Goal**: 每 30 秒偵測一次所有 ACTIVE 持倉的條件單狀態，識別觸發事件

**Independent Test**: 手動在交易所觸發條件單，觀察系統是否在 30 秒內偵測到

### Implementation for User Story 1

- [x] T009 [US1] 建立 ConditionalOrderMonitor 類別骨架 in src/services/monitor/ConditionalOrderMonitor.ts
- [x] T010 [US1] 實作 start() 和 stop() 方法（定時輪詢控制）in src/services/monitor/ConditionalOrderMonitor.ts
- [x] T011 [US1] 實作 checkAllPositions() 方法（查詢所有 ACTIVE 持倉）in src/services/monitor/ConditionalOrderMonitor.ts
- [x] T012 [US1] 實作 checkPositionConditionalOrders() 方法（查詢單一持倉的條件單）in src/services/monitor/ConditionalOrderMonitor.ts
- [x] T013 [US1] 實作 detectTrigger() 邏輯（比對資料庫與交易所訂單列表）in src/services/monitor/ConditionalOrderMonitor.ts
- [x] T014 [US1] 實作 confirmTriggerWithHistory() 方法（查詢訂單歷史確認觸發狀態）in src/services/monitor/ConditionalOrderMonitor.ts
- [x] T015 [US1] 實作 detectBothSidesTriggered() 邏輯（雙邊同時觸發偵測）in src/services/monitor/ConditionalOrderMonitor.ts
- [x] T016 [US1] 新增結構化日誌記錄觸發偵測事件 in src/services/monitor/ConditionalOrderMonitor.ts

**Checkpoint**: User Story 1 完成 - 可獨立測試觸發偵測功能

---

## Phase 4: User Story 2 - 觸發後自動平倉對沖倉位 (Priority: P1)

**Goal**: 偵測到單邊觸發後，自動平倉另一邊並取消剩餘條件單

**Independent Test**: 觸發一邊條件單，驗證系統自動平倉另一邊

### Implementation for User Story 2

- [x] T017 [US2] 實作 handleTrigger() 方法（處理觸發事件入口）in src/services/monitor/ConditionalOrderMonitor.ts
- [x] T018 [US2] 實作單邊觸發時呼叫 PositionCloser.closeSingleSide() in src/services/monitor/ConditionalOrderMonitor.ts
- [x] T019 [US2] 實作平倉後取消另一邊條件單邏輯 in src/services/monitor/ConditionalOrderMonitor.ts
- [x] T020 [US2] 實作 handleBothTriggered() 方法（雙邊觸發處理，不需平倉）in src/services/monitor/ConditionalOrderMonitor.ts
- [x] T021 [US2] 實作平倉失敗錯誤處理和重試邏輯 in src/services/monitor/ConditionalOrderMonitor.ts
- [x] T022 [US2] 更新 Position.closeReason 欄位 in src/services/monitor/ConditionalOrderMonitor.ts
- [x] T023 [US2] 更新 Position.status 為 CLOSED in src/services/monitor/ConditionalOrderMonitor.ts
- [x] T024 [US2] 建立 Trade 績效記錄（觸發平倉）in src/services/monitor/ConditionalOrderMonitor.ts

**Checkpoint**: User Story 2 完成 - 可獨立測試自動平倉功能

---

## Phase 5: User Story 3 - 觸發通知 (Priority: P2)

**Goal**: 觸發事件發生後發送 Discord/Slack 通知

**Independent Test**: 觸發條件單，驗證用戶收到通知

### Implementation for User Story 3

- [x] T025 [P] [US3] 新增 TriggerNotificationMessage 介面 in src/services/notification/types.ts
- [x] T026 [P] [US3] 實作 buildTriggerNotificationMessage() 方法 in src/services/notification/utils.ts
- [x] T027 [US3] 實作 sendTriggerNotification() 方法 in src/services/monitor/ConditionalOrderMonitor.ts
- [x] T028 [P] [US3] 新增 Discord 觸發通知模板 in src/services/notification/DiscordNotifier.ts
- [x] T029 [P] [US3] 新增 Slack 觸發通知模板 in src/services/notification/SlackNotifier.ts
- [x] T030 [US3] 在 handleTrigger() 中整合通知發送 in src/services/monitor/ConditionalOrderMonitor.ts
- [x] T031 [US3] 實作平倉失敗時的緊急通知 in src/services/monitor/ConditionalOrderMonitor.ts

**Checkpoint**: User Story 3 完成 - 可獨立測試通知功能

---

## Phase 6: User Story 4 - 持倉狀態更新與歷史記錄 (Priority: P2)

**Goal**: 正確更新持倉狀態和平倉原因，支援歷史查詢

**Independent Test**: 觸發後檢查持倉狀態和交易記錄是否正確更新

### Implementation for User Story 4

- [x] T032 [P] [US4] 新增 WebSocket 事件類型定義 in src/services/websocket/TriggerProgressEmitter.ts
- [x] T033 [P] [US4] 實作 TriggerProgressEmitter 類別 in src/services/websocket/TriggerProgressEmitter.ts
- [x] T034 [US4] 實作 emitTriggerDetected() 事件推送 in src/services/websocket/TriggerProgressEmitter.ts
- [x] T035 [US4] 實作 emitTriggerCloseProgress() 事件推送 in src/services/websocket/TriggerProgressEmitter.ts
- [x] T036 [US4] 實作 emitTriggerCloseSuccess() 事件推送 in src/services/websocket/TriggerProgressEmitter.ts
- [x] T037 [US4] 實作 emitTriggerCloseFailed() 事件推送 in src/services/websocket/TriggerProgressEmitter.ts
- [x] T038 [US4] 在 ConditionalOrderMonitor 中整合 WebSocket 事件推送 in src/services/monitor/ConditionalOrderMonitor.ts
- [x] T039 [US4] 更新現有 PositionCloser.closePosition() 設定 closeReason = MANUAL in src/services/trading/PositionCloser.ts

**Checkpoint**: User Story 4 完成 - 可獨立測試狀態更新和 WebSocket 事件

---

## Phase 7: Application Integration

**Purpose**: 應用程式啟動整合和優雅關閉

- [x] T040 建立監控服務初始化模組 in src/lib/monitor-init.ts
- [x] T041 實作 singleton pattern 確保只有一個監控實例 in src/lib/monitor-init.ts
- [x] T042 在 Next.js API 層整合監控啟動 in src/lib/db.ts (使用環境變數 ENABLE_CONDITIONAL_ORDER_MONITOR)
- [x] T043 實作 SIGINT/SIGTERM 信號處理（優雅關閉）in src/lib/monitor-init.ts
- [x] T044 [P] 新增監控狀態查詢 API in app/api/monitor/status/route.ts

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: 最終整合和驗證

- [x] T045 [P] 更新 CLAUDE.md 新增 Feature 050 路徑和關鍵檔案
- [x] T046 [P] 執行完整測試驗證（109 tests passed）
- [x] T047 程式碼審查和重構（TDD 流程確保代碼品質）
- [x] T048 效能優化（批次查詢、並行處理）- 已內建於 checkAllPositions
- [x] T049 錯誤處理完整性驗證（重試邏輯和緊急通知已實作）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup (T001-T003) completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - US1 + US2 (P1) should be completed before US3 + US4 (P2)
  - US2 depends on US1 (needs trigger detection before auto-close)
  - US3 + US4 can proceed in parallel after US1 + US2
- **Application Integration (Phase 7)**: Depends on US1 + US2 minimum
- **Polish (Phase 8)**: Depends on all phases being complete

### User Story Dependencies

```
Phase 1: Setup
    │
    ▼
Phase 2: Foundational
    │
    ├──────────────────────────────┐
    ▼                              │
Phase 3: US1 (觸發偵測)            │
    │                              │
    ▼                              │
Phase 4: US2 (自動平倉)            │
    │                              │
    ├──────────────┬───────────────┤
    ▼              ▼               │
Phase 5: US3   Phase 6: US4       │
(通知)         (狀態更新)          │
    │              │               │
    └──────┬───────┘               │
           ▼                       │
    Phase 7: Integration ◄─────────┘
           │
           ▼
    Phase 8: Polish
```

### Within Each User Story

- Models/Types before services
- Services before integration
- Core implementation before error handling
- Story complete before moving to next priority

### Parallel Opportunities

**Phase 1 (Setup)**:
```bash
# T001-T003 必須依序執行（migration 依賴 schema 變更）
# T004 可與 T003 並行
Task: T003 [P] + Task: T004
```

**Phase 2 (Foundational)**:
```bash
# T005 先執行，T006-T008 可並行
Task: T006 + Task: T007 + Task: T008
```

**Phase 5 (US3) - 通知**:
```bash
# 類型定義和模板可並行
Task: T025 + Task: T028 + Task: T029
```

**Phase 6 (US4) - 狀態更新**:
```bash
# 類型定義和事件類別可並行
Task: T032 + Task: T033
```

---

## Implementation Strategy

### MVP First (User Story 1 + 2)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL)
3. Complete Phase 3: User Story 1 (觸發偵測)
4. Complete Phase 4: User Story 2 (自動平倉)
5. **STOP and VALIDATE**: 測試觸發偵測 + 自動平倉功能
6. Deploy/Demo - MVP 完成！

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add US1 + US2 → Test → Deploy (MVP!)
3. Add US3 (通知) → Test → Deploy
4. Add US4 (WebSocket 事件) → Test → Deploy
5. Add Integration → Test → Deploy (Production Ready!)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- 每個 User Story 應可獨立完成和測試
- 依據 Constitution VII: TDD Discipline，實作時需先寫測試
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently

---

## Summary

| Phase | Tasks | 說明 |
|-------|-------|------|
| Setup | T001-T004 | 資料模型和類型定義 |
| Foundational | T005-T008 | 核心基礎設施 |
| US1 (P1) | T009-T016 | 觸發偵測 |
| US2 (P1) | T017-T024 | 自動平倉 |
| US3 (P2) | T025-T031 | 通知整合 |
| US4 (P2) | T032-T039 | 狀態更新和 WebSocket |
| Integration | T040-T044 | 應用程式整合 |
| Polish | T045-T049 | 最終驗證 |

**Total Tasks**: 49 tasks
**MVP Scope**: T001-T024 (24 tasks) - Setup + Foundational + US1 + US2
