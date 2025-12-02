# Tasks: Simulated APY Tracking

**Input**: Design documents from `/specs/029-simulated-apy-tracking/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: Not explicitly requested - focusing on implementation tasks only.

**Organization**: Tasks grouped by user story for independent implementation.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database schema and project structure setup

- [x] T001 Add SimulatedTracking and TrackingSnapshot models to prisma/schema.prisma
- [x] T002 Add TrackingStatus, SnapshotType, SettlementSide enums to prisma/schema.prisma
- [x] T003 Add simulatedTrackings relation to User model in prisma/schema.prisma
- [x] T004 Run Prisma migration: `pnpm prisma migrate dev --name add_simulated_tracking`
- [x] T005 [P] Create Zod schemas in src/models/SimulatedTracking.ts (CreateTrackingSchema, TrackingQuerySchema, SnapshotQuerySchema)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Repository layer and service foundation - MUST complete before user stories

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T006 Create SimulatedTrackingRepository in src/repositories/SimulatedTrackingRepository.ts
- [x] T007 [P] Create TrackingSnapshotRepository in src/repositories/TrackingSnapshotRepository.ts
- [x] T008 Create SimulatedTrackingService class shell in src/services/tracking/SimulatedTrackingService.ts
- [x] T009 [P] Create service index export in src/services/tracking/index.ts

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Start Tracking an Arbitrage Opportunity (Priority: P1)

**Goal**: Users can click "Track" on Market Monitor to start simulating returns

**Independent Test**: Click Track on a row, enter capital, verify tracking appears in list

### Implementation for User Story 1

- [x] T010 [US1] Implement `startTracking()` method in src/services/tracking/SimulatedTrackingService.ts
- [x] T011 [US1] Implement `countActiveTrackings()` method (for 5-limit check) in src/services/tracking/SimulatedTrackingService.ts
- [x] T012 [US1] Create POST /api/simulated-tracking route in app/api/simulated-tracking/route.ts
- [x] T013 [P] [US1] Create TrackButton component in app/(dashboard)/market-monitor/components/TrackButton.tsx
- [x] T014 [P] [US1] Create StartTrackingDialog component in app/(dashboard)/market-monitor/components/StartTrackingDialog.tsx
- [x] T015 [US1] Integrate TrackButton into RateRow component in app/(dashboard)/market-monitor/components/RateRow.tsx
- [x] T016 [US1] Add tracking state management hook in app/(dashboard)/market-monitor/hooks/useTrackingStatus.ts

**Checkpoint**: Users can start tracking from Market Monitor

---

## Phase 4: User Story 2 - View Active Trackings and Cumulative Returns (Priority: P1)

**Goal**: Users can view all trackings on a dedicated page with current stats

**Independent Test**: Navigate to tracking page, verify all active trackings display with profit

### Implementation for User Story 2

- [x] T017 [US2] Implement `getTrackingsByUserId()` method in src/services/tracking/SimulatedTrackingService.ts
- [x] T018 [US2] Implement `getTrackingById()` method in src/services/tracking/SimulatedTrackingService.ts
- [x] T019 [US2] Create GET /api/simulated-tracking route (list) in app/api/simulated-tracking/route.ts
- [x] T020 [US2] Create GET /api/simulated-tracking/[id] route in app/api/simulated-tracking/[id]/route.ts
- [x] T021 [P] [US2] Create ActiveTrackingCard component in app/(dashboard)/simulated-tracking/components/ActiveTrackingCard.tsx
- [x] T022 [P] [US2] Create TrackingHistoryTable component in app/(dashboard)/simulated-tracking/components/TrackingHistoryTable.tsx
- [x] T023 [US2] Create simulated-tracking page in app/(dashboard)/simulated-tracking/page.tsx
- [x] T024 [US2] Add navigation link to sidebar for Simulated Tracking page

**Checkpoint**: Users can view all their trackings on dedicated page

---

## Phase 5: User Story 3 - Record Settlement Snapshots Automatically (Priority: P1)

**Goal**: System automatically records snapshots at each funding rate settlement

**Independent Test**: Create tracking, wait for settlement time, verify snapshot recorded

### Implementation for User Story 3

- [x] T025 [US3] Implement `recordSettlementSnapshot()` method in src/services/tracking/SimulatedTrackingService.ts
- [x] T026 [US3] Implement `calculateSettlementProfit()` helper in src/services/tracking/SimulatedTrackingService.ts
- [x] T027 [US3] Implement `recordSettlementSnapshots()` for all active trackings in src/services/tracking/SimulatedTrackingService.ts
- [x] T028 [US3] Implement `isSettlementTime()` check (reuse from NotificationService pattern) in src/services/tracking/SimulatedTrackingService.ts
- [x] T029 [US3] Integrate SimulatedTrackingService with RatesCache.setAll() in src/services/monitor/RatesCache.ts
- [x] T030 [US3] Update cumulative statistics on SimulatedTracking after each snapshot

**Checkpoint**: Snapshots are automatically recorded at settlement times

---

## Phase 6: User Story 4 - Stop Tracking Manually (Priority: P2)

**Goal**: Users can stop any active tracking at any time

**Independent Test**: Stop an active tracking, verify status changes to STOPPED

### Implementation for User Story 4

- [x] T031 [US4] Implement `stopTracking()` method in src/services/tracking/SimulatedTrackingService.ts
- [x] T032 [US4] Create POST /api/simulated-tracking/[id]/stop route in app/api/simulated-tracking/[id]/stop/route.ts
- [x] T033 [US4] Add Stop button to ActiveTrackingCard component in app/(dashboard)/simulated-tracking/components/ActiveTrackingCard.tsx
- [x] T034 [US4] Add confirmation dialog for stop action

**Checkpoint**: Users can manually stop trackings

---

## Phase 7: User Story 5 - View Tracking History and Details (Priority: P2)

**Goal**: Users can view detailed snapshot history for any tracking

**Independent Test**: Click tracking, verify snapshot timeline displays

### Implementation for User Story 5

- [x] T035 [US5] Implement `getSnapshotsByTrackingId()` method in src/repositories/TrackingSnapshotRepository.ts
- [x] T036 [US5] Create GET /api/simulated-tracking/[id]/snapshots route in app/api/simulated-tracking/[id]/snapshots/route.ts
- [x] T037 [P] [US5] Create SnapshotTimeline component in app/(dashboard)/simulated-tracking/components/SnapshotTimeline.tsx
- [x] T038 [P] [US5] Create TrackingStatCards component in app/(dashboard)/simulated-tracking/components/TrackingStatCards.tsx
- [x] T039 [US5] Create tracking detail page in app/(dashboard)/simulated-tracking/[id]/page.tsx

**Checkpoint**: Users can view detailed tracking history with snapshots

---

## Phase 8: User Story 6 - Auto-Stop When Opportunity Disappears (Priority: P3)

**Goal**: Trackings optionally auto-stop when APY drops below threshold

**Independent Test**: Enable auto-stop, verify tracking stops when APY drops below 800%

### Implementation for User Story 6

- [x] T040 [US6] Implement `checkAndExpireTrackings()` method in src/services/tracking/SimulatedTrackingService.ts
- [x] T041 [US6] Add auto-expire check to RatesCache integration (after recording snapshots)
- [x] T042 [US6] Add autoStopOnExpire toggle to StartTrackingDialog in app/(dashboard)/market-monitor/components/StartTrackingDialog.tsx
- [x] T043 [US6] Display expired status badge in TrackingHistoryTable

**Checkpoint**: Auto-stop feature works based on user preference

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Cleanup job, delete functionality, final polish

- [x] T044 Create DELETE /api/simulated-tracking/[id] route in app/api/simulated-tracking/[id]/route.ts
- [x] T045 Implement `deleteTracking()` method in src/services/tracking/SimulatedTrackingService.ts
- [ ] T046 Create cleanup job for expired trackings (30 days) in src/jobs/cleanupExpiredTrackings.ts
- [x] T047 Add delete button to TrackingHistoryTable for stopped/expired trackings
- [x] T048 Add loading states and error handling to all UI components
- [x] T049 Add Pino logging to SimulatedTrackingService operations
- [ ] T050 Update Market Monitor to show "Tracking" badge on tracked rows

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-8)**: All depend on Foundational phase completion
- **Polish (Phase 9)**: Depends on core user stories (US1-US5) being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational - Shares service with US1
- **User Story 3 (P1)**: Can start after Foundational - Independent background processing
- **User Story 4 (P2)**: Requires US1 (need trackings to stop) - Can start after US1
- **User Story 5 (P2)**: Requires US3 (need snapshots to view) - Can start after US3
- **User Story 6 (P3)**: Requires US1 + US3 - Can start after both complete

### Within Each User Story

1. Service methods first
2. API routes next
3. UI components last
4. Integration and polish at end

### Parallel Opportunities

**Phase 1 (Setup)**:
- T005 can run in parallel with T001-T004

**Phase 2 (Foundational)**:
- T006 and T007 can run in parallel
- T008 and T009 can run in parallel

**Phase 3 (US1)**:
- T013 and T014 can run in parallel (different components)

**Phase 4 (US2)**:
- T021 and T022 can run in parallel (different components)

**Phase 7 (US5)**:
- T037 and T038 can run in parallel (different components)

---

## Parallel Example: User Story 1 Components

```bash
# Launch both UI components in parallel:
Task: "Create TrackButton component in app/(dashboard)/market-monitor/components/TrackButton.tsx"
Task: "Create StartTrackingDialog component in app/(dashboard)/market-monitor/components/StartTrackingDialog.tsx"
```

---

## Implementation Strategy

### MVP First (User Stories 1-3)

1. Complete Phase 1: Setup (T001-T005)
2. Complete Phase 2: Foundational (T006-T009)
3. Complete Phase 3: US1 - Start Tracking (T010-T016)
4. Complete Phase 4: US2 - View Trackings (T017-T024)
5. Complete Phase 5: US3 - Auto Snapshots (T025-T030)
6. **STOP and VALIDATE**: Core tracking flow complete
7. Deploy/demo MVP

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 → Can start tracking (minimal viable)
3. Add US2 → Can view trackings (MVP complete!)
4. Add US3 → Automatic data collection
5. Add US4 → User control
6. Add US5 → Detailed analysis
7. Add US6 → Smart automation

---

## Summary

| Phase | Story | Task Count | Key Deliverable | Status |
|-------|-------|------------|-----------------|--------|
| 1 | Setup | 5 | Database schema | ✅ Complete |
| 2 | Foundational | 4 | Repositories + Service shell | ✅ Complete |
| 3 | US1 (P1) | 7 | Start tracking from Market Monitor | ✅ Complete |
| 4 | US2 (P1) | 8 | Tracking list page | ✅ Complete |
| 5 | US3 (P1) | 6 | Automatic snapshot recording | ✅ Complete |
| 6 | US4 (P2) | 4 | Manual stop | ✅ Complete |
| 7 | US5 (P2) | 5 | Detail page with snapshots | ✅ Complete |
| 8 | US6 (P3) | 4 | Auto-stop feature | ✅ Complete |
| 9 | Polish | 7 | Cleanup, delete, logging | ⏳ 48/50 tasks done |
| **Total** | | **50** | | **48/50 Complete** |

---

## Notes

- No test tasks included (not explicitly requested)
- Focus on MVP: US1 + US2 + US3 provide core value
- US4-US6 are enhancements that can be added incrementally
- All API routes follow existing patterns from Feature 026/027
- T046 (cleanup job) and T050 (tracking badge) are optional enhancements for future iteration
