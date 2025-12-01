# Tasks: 套利機會結束監測和通知

**Input**: Design documents from `/specs/027-opportunity-end-notification/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4, US5)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database schema changes and type definitions

- [x] T001 Add notifyOnDisappear field to NotificationWebhook model in prisma/schema.prisma
- [x] T002 Add OpportunityHistory model to prisma/schema.prisma
- [x] T003 Create and run database migration: pnpm prisma migrate dev --name add_opportunity_end_notification
- [x] T004 [P] Add TrackedOpportunity interface in src/services/notification/types.ts
- [x] T005 [P] Add FundingSettlement interface in src/services/notification/types.ts
- [x] T006 [P] Add NotifiedWebhookInfo interface in src/services/notification/types.ts
- [x] T007 [P] Add OpportunityDisappearedMessage interface in src/services/notification/types.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before user story implementation

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T008 Add trackedOpportunities Map to NotificationService class in src/services/notification/NotificationService.ts
- [x] T009 Implement startTracking() method to register new opportunities in src/services/notification/NotificationService.ts
- [x] T010 Modify checkAndNotify() to call startTracking() when sending opportunity notification in src/services/notification/NotificationService.ts
- [x] T011 [P] Add formatDuration() utility function in src/services/notification/utils.ts
- [x] T012 [P] Add formatSpreadStats() utility function in src/services/notification/utils.ts
- [x] T013 Update Zod schema to include notifyOnDisappear in src/models/NotificationWebhook.ts

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1+2 - 接收結束通知與統計 (Priority: P1) 🎯 MVP

**Goal**: When a tracked opportunity's spread drops below user threshold, send end notification with duration and spread statistics

**Independent Test**: Set a low threshold, wait for opportunity to end, verify notification received with correct statistics

### Implementation for User Story 1+2

- [x] T014 [US1] Implement checkDisappearedOpportunities() method in src/services/notification/NotificationService.ts
- [x] T015 [US1] Implement debounce logic with disappearingAt Map in src/services/notification/NotificationService.ts
- [x] T016 [US1] Implement updateTrackedOpportunity() to update spread statistics (max spread, current spread) in src/services/notification/NotificationService.ts
- [x] T017 [US1] Call checkDisappearedOpportunities() at end of checkAndNotify() in src/services/notification/NotificationService.ts
- [x] T018 [P] [US2] Implement buildDisappearedMessage() to construct notification message with statistics in src/services/notification/NotificationService.ts
- [x] T019 [P] [US2] Add sendDisappearedNotification() method to INotifier interface in src/services/notification/types.ts
- [x] T020 [US2] Implement sendDisappearedNotification() in src/services/notification/DiscordNotifier.ts with embed format
- [x] T021 [US2] Implement sendDisappearedNotification() in src/services/notification/SlackNotifier.ts with block kit format
- [x] T022 [US1] Integrate notifiers to send disappeared notifications in src/services/notification/NotificationService.ts
- [x] T023 [US1] Add structured logging for opportunity tracking and end detection in src/services/notification/NotificationService.ts

**Checkpoint**: User Story 1+2 should be fully functional - end notifications sent with statistics

---

## Phase 4: User Story 3 - 模擬收益計算 (Priority: P2)

**Goal**: Calculate simulated profit based on actual funding settlements at settlement times

**Independent Test**: Verify notification includes correct settlement counts, funding profit, costs, net profit, and APY

### Implementation for User Story 3

- [x] T024 [US3] Implement getSettlementTimes() to calculate settlement times based on interval hours in src/services/notification/NotificationService.ts
- [x] T025 [US3] Implement recordSettlement() to record funding rates at settlement times in src/services/notification/NotificationService.ts
- [x] T026 [US3] Implement shouldRecordSettlement() to check if current time is near a settlement time in src/services/notification/NotificationService.ts
- [x] T027 [US3] Call recordSettlement() during updateTrackedOpportunity() when at settlement time in src/services/notification/NotificationService.ts
- [x] T028 [US3] Implement calculateRealizedProfit() to compute total funding profit, costs, net profit, APY in src/services/notification/NotificationService.ts
- [x] T029 [US3] Include settlement records and profit calculation in buildDisappearedMessage() in src/services/notification/NotificationService.ts
- [x] T030 [P] [US3] Update Discord sendDisappearedNotification() to display settlement records and profit in src/services/notification/DiscordNotifier.ts
- [x] T031 [P] [US3] Update Slack sendDisappearedNotification() to display settlement records and profit in src/services/notification/SlackNotifier.ts

**Checkpoint**: User Story 3 complete - end notifications include accurate simulated profit

---

## Phase 5: User Story 4 - 控制結束通知開關 (Priority: P2)

**Goal**: Allow users to control whether they receive end notifications via webhook settings

**Independent Test**: Disable end notification for one webhook, verify it doesn't receive end notification while others do

### Implementation for User Story 4

- [x] T032 [US4] Update NotificationWebhookRepository to handle notifyOnDisappear field in src/repositories/NotificationWebhookRepository.ts
- [x] T033 [US4] Update POST /api/notifications/webhooks to accept notifyOnDisappear in app/api/notifications/webhooks/route.ts
- [x] T034 [US4] Update PUT /api/notifications/webhooks/[id] to accept notifyOnDisappear in app/api/notifications/webhooks/[id]/route.ts
- [x] T035 [US4] Update GET /api/notifications/webhooks to return notifyOnDisappear in app/api/notifications/webhooks/route.ts
- [x] T036 [US4] Check notifyOnDisappear flag before sending end notification in src/services/notification/NotificationService.ts
- [x] T037 [US4] Add notifyOnDisappear toggle switch to webhook settings UI in app/(dashboard)/settings/notifications/page.tsx

**Checkpoint**: User Story 4 complete - users can control end notification preference

---

## Phase 6: User Story 5 - 歷史機會記錄 (Priority: P3)

**Goal**: Persist opportunity history to database for future analysis

**Independent Test**: After opportunity ends, verify database record contains all statistics and settlement records

### Implementation for User Story 5

- [x] T038 [P] [US5] Create OpportunityHistory domain model with Zod schema in src/models/OpportunityHistory.ts
- [x] T039 [P] [US5] Create OpportunityHistoryRepository with create() and findByUserId() methods in src/repositories/OpportunityHistoryRepository.ts
- [x] T040 [US5] Call repository.create() to save history after sending end notification in src/services/notification/NotificationService.ts
- [x] T041 [P] [US5] Create GET /api/opportunities/history route with pagination in app/api/opportunities/history/route.ts
- [x] T042 [P] [US5] Create GET /api/opportunities/history/[id] route for single record in app/api/opportunities/history/[id]/route.ts

**Checkpoint**: User Story 5 complete - all ended opportunities are persisted to database

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Cleanup and edge case handling

- [x] T043 Handle edge case: opportunity ends before any settlement (no funding profit) in src/services/notification/NotificationService.ts
- [x] T044 Handle edge case: different settlement intervals for long/short positions in src/services/notification/NotificationService.ts
- [x] T045 [P] Remove tracked opportunity from Map when all webhooks are notified in src/services/notification/NotificationService.ts
- [x] T046 [P] Add cleanup for old entries in notifiedOpportunities to prevent memory leak in src/services/notification/NotificationService.ts
- [x] T047 Verify database schema matches data-model.md specification
- [x] T048 Run quickstart.md validation to verify implementation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - US1+US2 must complete before US3 (US3 extends US2 notification format)
  - US4 can proceed independently after Foundational
  - US5 can proceed independently after Foundational
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

```
Phase 1 (Setup)
    ↓
Phase 2 (Foundational)
    ↓
    ├─→ Phase 3 (US1+US2 - 結束通知與統計) ─→ Phase 4 (US3 - 模擬收益)
    ├─→ Phase 5 (US4 - 開關控制) [parallel]
    └─→ Phase 6 (US5 - 歷史記錄) [parallel]
    ↓
Phase 7 (Polish)
```

### Within Each User Story

- Models before services
- Services before endpoints
- Core implementation before UI
- Story complete before moving to next priority

### Parallel Opportunities

**Phase 1 - Setup**:
```bash
# Parallel execution (different files):
T004: Add TrackedOpportunity interface
T005: Add FundingSettlement interface
T006: Add NotifiedWebhookInfo interface
T007: Add OpportunityDisappearedMessage interface
```

**Phase 2 - Foundational**:
```bash
# Parallel execution:
T011: formatDuration() utility
T012: formatSpreadStats() utility
```

**Phase 3 - US1+US2**:
```bash
# Parallel execution:
T018: buildDisappearedMessage()
T019: INotifier interface update
```

**Phase 4 - US3**:
```bash
# Parallel execution:
T030: Discord profit display
T031: Slack profit display
```

**Phase 5/6 - US4/US5**:
```bash
# Can run in parallel with each other:
US4 tasks (T032-T037)
US5 tasks (T038-T042)
```

---

## Implementation Strategy

### MVP First (User Story 1+2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1+2
4. **STOP and VALIDATE**: Test end notifications with statistics
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add US1+US2 → Test end notifications → Deploy/Demo (MVP!)
3. Add US3 → Test profit calculation → Deploy/Demo
4. Add US4 → Test on/off toggle → Deploy/Demo
5. Add US5 → Test database persistence → Deploy/Demo

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1+2 → User Story 3
   - Developer B: User Story 4
   - Developer C: User Story 5
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- US1 and US2 are combined because US2's statistics are integral to the end notification
- Verify notifications are sent within 1 minute of opportunity ending (SC-001)
- Ensure Decimal type for financial calculations (Constitution IV)
- Add structured logging for all operations (Constitution II)
- Use debounce to prevent duplicate notifications (1 minute threshold)

---

## Completion Summary

**Status**: ✅ All 48 tasks completed (2025-12-01)

### Implementation Highlights

1. **Database Changes**:
   - Added `notifyOnDisappear` field to `NotificationWebhook` model
   - Added `OpportunityEndHistory` model for persisting ended opportunities

2. **Core Features**:
   - In-memory tracking of active opportunities with `TrackedOpportunity` interface
   - Debounce mechanism (1 minute) to prevent duplicate notifications
   - Support for different funding settlement intervals (1h/4h/8h) for long/short positions
   - Profit calculation based on actual funding settlements

3. **API Endpoints**:
   - Updated webhook CRUD APIs to support `notifyOnDisappear`
   - Added `GET /api/opportunities/history` for paginated history
   - Added `GET /api/opportunities/history/[id]` for single record

4. **Notifiers**:
   - Discord and Slack notifiers support end notifications with statistics

5. **Memory Management**:
   - Cleanup mechanism for stale tracked opportunities (30 minutes)
   - Cleanup for duplicate notification records (5 minutes)
