# Tasks: Discord/Slack 套利機會即時推送通知

**Input**: Design documents from `/specs/026-discord-slack-notification/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: 不包含測試任務（規格未明確要求）

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Create notification service directory structure at src/services/notification/
- [x] T002 [P] Create types file with notification interfaces at src/services/notification/types.ts
- [x] T003 [P] Add axios dependency for HTTP requests (if not already present)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Add NotificationWebhook model to prisma/schema.prisma
- [x] T005 Add NotificationWebhook relation to User model in prisma/schema.prisma
- [x] T006 Run Prisma migration: `pnpm prisma migrate dev --name add_notification_webhooks`
- [x] T007 Generate Prisma client: `pnpm prisma generate`
- [x] T008 [P] Create NotificationWebhookRepository at src/repositories/NotificationWebhookRepository.ts
- [x] T009 [P] Create NotificationWebhook domain model at src/models/NotificationWebhook.ts
- [x] T010 [P] Add navigation link to DashboardLayoutClient at app/(dashboard)/DashboardLayoutClient.tsx

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - 新增 Webhook 設定 (Priority: P1) MVP

**Goal**: 用戶可以新增 Discord/Slack Webhook 設定

**Independent Test**: 透過設定頁面新增 Webhook，驗證資料正確儲存到資料庫

### Implementation for User Story 1

- [x] T011 [P] [US1] Create Webhook list API (GET) at app/api/notifications/webhooks/route.ts
- [x] T012 [P] [US1] Create Webhook create API (POST) at app/api/notifications/webhooks/route.ts
- [x] T013 [US1] Add Webhook URL validation logic in app/api/notifications/webhooks/route.ts
- [x] T014 [US1] Create notifications settings page at app/(dashboard)/settings/notifications/page.tsx
- [x] T015 [US1] Implement WebhookForm component for adding new webhooks in settings page
- [x] T016 [US1] Implement WebhookList component to display existing webhooks in settings page
- [x] T017 [US1] Add Webhook URL encryption using existing crypto utilities

**Checkpoint**: User Story 1 complete - users can add new webhooks

---

## Phase 4: User Story 2 - 測試 Webhook 連線 (Priority: P1)

**Goal**: 用戶可以測試 Webhook 連線是否正常

**Independent Test**: 點擊測試按鈕，Discord/Slack 頻道收到測試訊息

### Implementation for User Story 2

- [x] T018 [P] [US2] Create base notifier interface at src/services/notification/types.ts
- [x] T019 [P] [US2] Create DiscordNotifier service at src/services/notification/DiscordNotifier.ts
- [x] T020 [P] [US2] Create SlackNotifier service at src/services/notification/SlackNotifier.ts
- [x] T021 [US2] Create test webhook API endpoint at app/api/notifications/webhooks/[id]/test/route.ts
- [x] T022 [US2] Add test button and status indicator to WebhookList component
- [x] T023 [US2] Implement test notification message format (simple success message)

**Checkpoint**: User Story 2 complete - users can test webhook connectivity

---

## Phase 5: User Story 3 - 自動推送套利機會通知 (Priority: P1)

**Goal**: 年化收益超過閾值時自動推送通知

**Independent Test**: 模擬高收益套利機會，檢查是否觸發通知

### Implementation for User Story 3

- [x] T024 [US3] Create NotificationService core class at src/services/notification/NotificationService.ts
- [x] T025 [US3] Implement checkAndNotify method to evaluate opportunities against thresholds
- [x] T026 [US3] Implement sendToWebhooks method to dispatch notifications to all enabled webhooks
- [x] T027 [US3] Add notification service singleton export at src/services/notification/index.ts
- [x] T028 [US3] Integrate NotificationService with RatesCache.setAll() at src/services/monitor/RatesCache.ts
- [x] T029 [US3] Add error handling for failed webhook deliveries (log but don't block)

**Checkpoint**: User Story 3 complete - automatic notifications are working

---

## Phase 6: User Story 4 - 通知內容包含完整資訊 (Priority: P1)

**Goal**: 通知內容包含完整套利資訊（費率、價差分析、交易所連結等）

**Independent Test**: 檢查收到的通知訊息包含所有必要欄位

### Implementation for User Story 4

- [x] T030 [P] [US4] Create NotificationMessage interface with all required fields at src/services/notification/types.ts
- [x] T031 [P] [US4] Create exchange URL generator utility at src/services/notification/utils.ts
- [x] T032 [US4] Implement Discord Embed format with full arbitrage details in DiscordNotifier.ts
- [x] T033 [US4] Implement Slack Block Kit format with full arbitrage details in SlackNotifier.ts
- [x] T034 [US4] Add price spread direction analysis (correct/reverse indicator)
- [x] T035 [US4] Add payback periods calculation (number of funding rate collections)
- [x] T036 [US4] Add original and normalized funding rate display (with time basis)

**Checkpoint**: User Story 4 complete - notifications contain comprehensive information

---

## Phase 7: User Story 5 - 管理 Webhook 設定 (Priority: P2)

**Goal**: 用戶可以編輯、刪除和啟停用 Webhook

**Independent Test**: 編輯/刪除 Webhook，驗證設定正確更新

### Implementation for User Story 5

- [x] T037 [P] [US5] Create get single webhook API (GET) at app/api/notifications/webhooks/[id]/route.ts
- [x] T038 [P] [US5] Create update webhook API (PUT) at app/api/notifications/webhooks/[id]/route.ts
- [x] T039 [P] [US5] Create delete webhook API (DELETE) at app/api/notifications/webhooks/[id]/route.ts
- [x] T040 [US5] Add edit modal/form to WebhookList component
- [x] T041 [US5] Add delete confirmation dialog to WebhookList component
- [x] T042 [US5] Add enable/disable toggle switch to WebhookList component

**Checkpoint**: User Story 5 complete - full webhook management available

---

## Phase 8: User Story 6 - 避免重複通知 (Priority: P2)

**Goal**: 同一套利機會 5 分鐘內不重複推送

**Independent Test**: 5 分鐘內多次觸發同一機會，只收到一次通知

### Implementation for User Story 6

- [x] T043 [US6] Add notifiedOpportunities Map to NotificationService for deduplication tracking
- [x] T044 [US6] Implement 5-minute deduplication check in checkAndNotify method
- [x] T045 [US6] Add opportunity key generation (userId-symbol-longExchange-shortExchange)
- [x] T046 [US6] Add stale entry cleanup for notifiedOpportunities Map (prevent memory leak)

**Checkpoint**: User Story 6 complete - deduplication working

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T047 [P] Add structured logging (Pino) for all notification operations
- [x] T048 [P] Add input validation using Zod schemas for all API endpoints
- [x] T049 Verify quickstart.md workflow end-to-end
- [x] T050 Code review and cleanup

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-8)**: All depend on Foundational phase completion
- **Polish (Phase 9)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (新增 Webhook)**: Foundational complete → can start independently
- **US2 (測試 Webhook)**: Foundational complete → can start in parallel with US1
- **US3 (自動推送)**: Requires US2 (Notifiers) → must wait for US2
- **US4 (完整資訊)**: Requires US3 (NotificationService) → must wait for US3
- **US5 (管理 Webhook)**: Foundational complete → can start in parallel with US1
- **US6 (重複過濾)**: Requires US3 (NotificationService) → must wait for US3

### Dependency Graph

```
Phase 1 (Setup)
    │
    ▼
Phase 2 (Foundational)
    │
    ├─────────┬─────────┐
    ▼         ▼         ▼
  US1       US2       US5
(新增)     (測試)    (管理)
    │         │
    │         ▼
    │       US3
    │     (自動推送)
    │         │
    │         ├─────────┐
    │         ▼         ▼
    │       US4       US6
    │    (完整資訊)  (重複過濾)
    │         │         │
    └─────────┴─────────┘
              │
              ▼
        Phase 9 (Polish)
```

### Parallel Opportunities

**Phase 2 (Foundational)**:
```
Task: T008 - NotificationWebhookRepository
Task: T009 - NotificationWebhook model
Task: T010 - Navigation link
```

**US1 + US2 + US5 can start in parallel** (after Phase 2):
```
Developer A: US1 (T011-T017)
Developer B: US2 (T018-T023)
Developer C: US5 (T037-T042)
```

**US4 + US6 can start in parallel** (after US3):
```
Developer A: US4 (T030-T036)
Developer B: US6 (T043-T046)
```

---

## Implementation Strategy

### MVP First (P1 Stories Only)

1. Complete Phase 1: Setup (3 tasks)
2. Complete Phase 2: Foundational (7 tasks)
3. Complete Phase 3: US1 - 新增 Webhook (7 tasks)
4. Complete Phase 4: US2 - 測試 Webhook (6 tasks)
5. Complete Phase 5: US3 - 自動推送 (6 tasks)
6. Complete Phase 6: US4 - 完整資訊 (7 tasks)
7. **STOP and VALIDATE**: Test all P1 stories independently
8. Deploy MVP!

### Incremental Delivery

1. Setup + Foundational → Foundation ready (10 tasks)
2. US1 + US2 → Basic webhook setup and testing (13 tasks) → Demo
3. US3 + US4 → Automatic notifications working (13 tasks) → Demo
4. US5 + US6 → Full management and optimization (10 tasks) → Demo
5. Polish → Production ready (4 tasks)

---

## Summary

| Phase | Description | Task Count |
|-------|-------------|------------|
| Phase 1 | Setup | 3 |
| Phase 2 | Foundational | 7 |
| Phase 3 | US1 - 新增 Webhook | 7 |
| Phase 4 | US2 - 測試 Webhook | 6 |
| Phase 5 | US3 - 自動推送 | 6 |
| Phase 6 | US4 - 完整資訊 | 7 |
| Phase 7 | US5 - 管理 Webhook | 6 |
| Phase 8 | US6 - 重複過濾 | 4 |
| Phase 9 | Polish | 4 |
| **Total** | | **50** |

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Webhook URL must be encrypted before storage
- Use existing crypto utilities from API Key encryption
- Notification failures should log but not block other webhooks
- 5-minute deduplication uses in-memory Map (acceptable to clear on restart)
