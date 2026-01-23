# Tasks: 平台管理後臺

**Input**: Design documents from `/specs/068-admin-dashboard/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: 依據 Constitution Principle VII (TDD 紀律)，所有 Service 層邏輯需先寫測試。

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `src/services/admin/`, `src/repositories/`, `src/lib/admin/`
- **API Routes**: `app/api/admin/`
- **Frontend**: `app/(admin)/`
- **Tests**: `tests/unit/services/admin/`, `tests/integration/admin/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, schema changes, and admin types

- [ ] T001 Update prisma/schema.prisma to add UserRole enum and User model extensions (role, isActive fields)
- [ ] T002 Generate migration with `prisma migrate dev --name add_admin_fields` in prisma/migrations/
- [ ] T003 Run `prisma db:generate` to update Prisma Client
- [ ] T004 [P] Create admin types in src/types/admin.ts (DashboardStats, AdminUserListItem, AdminTradeListItem, etc.)
- [ ] T005 [P] Extend JwtPayload interface to include role in src/lib/jwt.ts
- [ ] T006 [P] Create admin seed script in prisma/seed-admin.ts for initial admin user

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core admin infrastructure that MUST be complete before ANY user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Tests for Foundational (RED Phase) 🔴

- [ ] T007 [P] Unit test for admin auth middleware in tests/unit/lib/admin/middleware.test.ts
- [ ] T008 [P] Unit test for AdminAuthService in tests/unit/services/admin/AdminAuthService.test.ts

### Implementation for Foundational (GREEN Phase) 🟢

- [ ] T009 [P] Create withAdminAuth middleware in src/lib/admin/middleware.ts
- [ ] T010 [P] Create admin auth utilities in src/lib/admin/auth.ts (password generation, validation)
- [ ] T011 Implement AdminAuthService in src/services/admin/AdminAuthService.ts
- [ ] T012 Implement AdminRepository base class in src/repositories/AdminRepository.ts
- [ ] T013 Create POST /api/admin/auth/login route in app/api/admin/auth/login/route.ts
- [ ] T014 [P] Create admin login page in app/(admin)/admin-login/page.tsx
- [ ] T015 [P] Create admin layout with sidebar in app/(admin)/admin/layout.tsx
- [ ] T016 Create admin index redirect page in app/(admin)/admin/page.tsx

### Refactor for Foundational (BLUE Phase) 🔵

- [ ] T017 Verify admin login flow works end-to-end
- [ ] T018 Ensure existing user login rejects non-USER accounts attempting admin login

**Checkpoint**: Foundation ready - admin authentication operational, user story implementation can now begin

---

## Phase 3: User Story 1 - 查看平台整體績效總覽 (Priority: P1) 🎯 MVP

**Goal**: 管理員登入後臺後，能在首頁儀表板看到平台整體的關鍵績效指標

**Independent Test**: 管理員登入後即可在儀表板看到完整的平台統計數據，無需其他功能也能獨立運作

### Tests for User Story 1 (RED Phase) 🔴

- [ ] T019 [P] [US1] Unit test for AdminDashboardService in tests/unit/services/admin/AdminDashboardService.test.ts
- [ ] T020 [P] [US1] Integration test for dashboard API in tests/integration/admin/AdminDashboardFlow.test.ts

### Implementation for User Story 1 (GREEN Phase) 🟢

- [ ] T021 [US1] Implement AdminDashboardService.getUserStats() in src/services/admin/AdminDashboardService.ts
- [ ] T022 [US1] Implement AdminDashboardService.getPositionStats() in src/services/admin/AdminDashboardService.ts
- [ ] T023 [US1] Implement AdminDashboardService.getTradeStats() in src/services/admin/AdminDashboardService.ts
- [ ] T024 [US1] Create GET /api/admin/dashboard route in app/api/admin/dashboard/route.ts
- [ ] T025 [P] [US1] Create dashboard page with stats cards in app/(admin)/admin/dashboard/page.tsx
- [ ] T026 [P] [US1] Create DashboardStatsCard component in app/(admin)/admin/dashboard/components/StatsCard.tsx
- [ ] T027 [US1] Add empty state handling for zero users/trades scenario

### Refactor for User Story 1 (BLUE Phase) 🔵

- [ ] T028 [US1] Verify dashboard loads within 3 seconds (SC-001)
- [ ] T029 [US1] Ensure all tests pass for US1

**Checkpoint**: User Story 1 complete - Dashboard showing platform statistics

---

## Phase 4: User Story 2 - 使用者列表與搜尋 (Priority: P1)

**Goal**: 管理員能查看所有使用者的列表，支援搜尋和篩選功能

**Independent Test**: 管理員可以瀏覽使用者列表、使用搜尋功能找到特定使用者

### Tests for User Story 2 (RED Phase) 🔴

- [ ] T030 [P] [US2] Unit test for AdminUserService.listUsers() in tests/unit/services/admin/AdminUserService.test.ts
- [ ] T031 [P] [US2] Unit test for AdminUserService.getUserDetail() in tests/unit/services/admin/AdminUserService.test.ts

### Implementation for User Story 2 (GREEN Phase) 🟢

- [ ] T032 [US2] Implement AdminUserService.listUsers() with pagination/search/filter in src/services/admin/AdminUserService.ts
- [ ] T033 [US2] Implement AdminUserService.getUserDetail() in src/services/admin/AdminUserService.ts
- [ ] T034 [US2] Create GET /api/admin/users route in app/api/admin/users/route.ts
- [ ] T035 [US2] Create GET /api/admin/users/[id] route in app/api/admin/users/[id]/route.ts
- [ ] T036 [P] [US2] Create users list page with search/filter in app/(admin)/admin/users/page.tsx
- [ ] T037 [P] [US2] Create UserListTable component in app/(admin)/admin/users/components/UserListTable.tsx
- [ ] T038 [P] [US2] Create user detail page in app/(admin)/admin/users/[id]/page.tsx
- [ ] T039 [US2] Add empty state and no results handling

### Refactor for User Story 2 (BLUE Phase) 🔵

- [ ] T040 [US2] Verify search results return within 1 second (SC-002)
- [ ] T041 [US2] Ensure all tests pass for US2

**Checkpoint**: User Story 2 complete - User list with search and filtering working

---

## Phase 5: User Story 7 - 查看使用者交易明細 (Priority: P1)

**Goal**: 管理員能查看特定使用者的所有持倉和已平倉交易記錄，包含開倉時的資金費率

**Independent Test**: 管理員可以獨立查看任一使用者的完整交易歷史

### Tests for User Story 7 (RED Phase) 🔴

- [ ] T042 [P] [US7] Unit test for AdminTradeService.getUserPositions() in tests/unit/services/admin/AdminTradeService.test.ts
- [ ] T043 [P] [US7] Unit test for AdminTradeService.exportUserTrades() in tests/unit/services/admin/AdminTradeService.test.ts

### Implementation for User Story 7 (GREEN Phase) 🟢

- [ ] T044 [US7] Implement AdminTradeService.getUserPositions() in src/services/admin/AdminTradeService.ts
- [ ] T045 [US7] Implement AdminTradeService.exportUserTrades() for CSV export in src/services/admin/AdminTradeService.ts
- [ ] T046 [US7] Create GET /api/admin/users/[id]/trades route in app/api/admin/users/[id]/trades/route.ts
- [ ] T047 [P] [US7] Create positions tab in user detail page in app/(admin)/admin/users/[id]/components/PositionsTab.tsx
- [ ] T048 [P] [US7] Create PositionDetailCard component showing funding rates in app/(admin)/admin/users/[id]/components/PositionDetailCard.tsx
- [ ] T049 [US7] Add CSV export button and functionality
- [ ] T050 [US7] Verify openFundingRateLong/openFundingRateShort are displayed (SC-005)

### Refactor for User Story 7 (BLUE Phase) 🔵

- [ ] T051 [US7] Verify CSV export completes within 10 seconds for 1000 records (SC-006)
- [ ] T052 [US7] Ensure all tests pass for US7

**Checkpoint**: User Story 7 complete - User trade details with funding rates and export working

---

## Phase 6: User Story 3 - 新增使用者 (Priority: P2)

**Goal**: 管理員能手動建立新的使用者帳戶，自動產生初始密碼

**Independent Test**: 管理員可以獨立完成新使用者的建立

### Tests for User Story 3 (RED Phase) 🔴

- [ ] T053 [P] [US3] Unit test for AdminUserService.createUser() in tests/unit/services/admin/AdminUserService.test.ts

### Implementation for User Story 3 (GREEN Phase) 🟢

- [ ] T054 [US3] Implement AdminUserService.createUser() with password generation in src/services/admin/AdminUserService.ts
- [ ] T055 [US3] Implement AdminAuditLogger.logUserCreate() in src/services/admin/AdminAuditLogger.ts
- [ ] T056 [US3] Create POST /api/admin/users route in app/api/admin/users/route.ts (add POST handler)
- [ ] T057 [P] [US3] Create CreateUserDialog component in app/(admin)/admin/users/components/CreateUserDialog.tsx
- [ ] T058 [US3] Add validation for email format and duplicate check
- [ ] T059 [US3] Display generated password to admin after creation

### Refactor for User Story 3 (BLUE Phase) 🔵

- [ ] T060 [US3] Verify user creation flow completes within 2 minutes (SC-003)
- [ ] T061 [US3] Ensure all tests pass for US3

**Checkpoint**: User Story 3 complete - Admin can create new users

---

## Phase 7: User Story 4 - 編輯使用者資訊 (Priority: P2)

**Goal**: 管理員能編輯使用者的 email 和重設密碼

**Independent Test**: 管理員可以獨立編輯任一使用者的資訊

### Tests for User Story 4 (RED Phase) 🔴

- [ ] T062 [P] [US4] Unit test for AdminUserService.updateUser() in tests/unit/services/admin/AdminUserService.test.ts
- [ ] T063 [P] [US4] Unit test for AdminUserService.resetPassword() in tests/unit/services/admin/AdminUserService.test.ts

### Implementation for User Story 4 (GREEN Phase) 🟢

- [ ] T064 [US4] Implement AdminUserService.updateUser() in src/services/admin/AdminUserService.ts
- [ ] T065 [US4] Implement AdminUserService.resetPassword() in src/services/admin/AdminUserService.ts
- [ ] T066 [US4] Implement AdminAuditLogger.logUserUpdate() and logPasswordReset() in src/services/admin/AdminAuditLogger.ts
- [ ] T067 [US4] Create PATCH /api/admin/users/[id] route in app/api/admin/users/[id]/route.ts (add PATCH handler)
- [ ] T068 [US4] Create POST /api/admin/users/[id]/reset-password route in app/api/admin/users/[id]/reset-password/route.ts
- [ ] T069 [P] [US4] Create EditUserDialog component in app/(admin)/admin/users/[id]/components/EditUserDialog.tsx
- [ ] T070 [US4] Add email duplicate validation (excluding current user)

### Refactor for User Story 4 (BLUE Phase) 🔵

- [ ] T071 [US4] Verify audit logs record all updates (SC-007)
- [ ] T072 [US4] Ensure all tests pass for US4

**Checkpoint**: User Story 4 complete - Admin can edit users and reset passwords

---

## Phase 8: User Story 5 - 停用與啟用使用者 (Priority: P2)

**Goal**: 管理員能停用或重新啟用使用者帳戶，停用後 session 即時失效

**Independent Test**: 管理員可以獨立執行停用/啟用操作

### Tests for User Story 5 (RED Phase) 🔴

- [ ] T073 [P] [US5] Unit test for AdminUserService.suspendUser() in tests/unit/services/admin/AdminUserService.test.ts
- [ ] T074 [P] [US5] Unit test for AdminUserService.enableUser() in tests/unit/services/admin/AdminUserService.test.ts
- [ ] T075 [P] [US5] Integration test for session invalidation in tests/integration/admin/AdminUserFlow.test.ts

### Implementation for User Story 5 (GREEN Phase) 🟢

- [ ] T076 [US5] Implement AdminUserService.suspendUser() with tokenVersion increment in src/services/admin/AdminUserService.ts
- [ ] T077 [US5] Implement AdminUserService.enableUser() in src/services/admin/AdminUserService.ts
- [ ] T078 [US5] Implement AdminUserService.checkActivePositions() helper in src/services/admin/AdminUserService.ts
- [ ] T079 [US5] Implement AdminAuditLogger.logUserSuspend() and logUserEnable() in src/services/admin/AdminAuditLogger.ts
- [ ] T080 [US5] Create POST /api/admin/users/[id]/suspend route in app/api/admin/users/[id]/suspend/route.ts
- [ ] T081 [US5] Create POST /api/admin/users/[id]/enable route in app/api/admin/users/[id]/enable/route.ts
- [ ] T082 [P] [US5] Create SuspendUserDialog with warning for active positions in app/(admin)/admin/users/[id]/components/SuspendUserDialog.tsx
- [ ] T083 [US5] Update existing auth middleware to check isActive status in src/middleware/authMiddleware.ts

### Refactor for User Story 5 (BLUE Phase) 🔵

- [ ] T084 [US5] Verify suspended user cannot login within 5 seconds (SC-004)
- [ ] T085 [US5] Ensure all tests pass for US5

**Checkpoint**: User Story 5 complete - Admin can suspend/enable users with session invalidation

---

## Phase 9: User Story 8 - 平台交易列表 (Priority: P2)

**Goal**: 管理員能查看平台所有交易的彙總列表，支援篩選

**Independent Test**: 管理員可以獨立瀏覽和篩選平台所有交易

### Tests for User Story 8 (RED Phase) 🔴

- [ ] T086 [P] [US8] Unit test for AdminTradeService.listAllTrades() in tests/unit/services/admin/AdminTradeService.test.ts

### Implementation for User Story 8 (GREEN Phase) 🟢

- [ ] T087 [US8] Implement AdminTradeService.listAllTrades() with filters in src/services/admin/AdminTradeService.ts
- [ ] T088 [US8] Create GET /api/admin/trades route in app/api/admin/trades/route.ts
- [ ] T089 [US8] Create GET /api/admin/trades/export route in app/api/admin/trades/export/route.ts
- [ ] T090 [P] [US8] Create platform trades page in app/(admin)/admin/trades/page.tsx
- [ ] T091 [P] [US8] Create TradeListTable with filters in app/(admin)/admin/trades/components/TradeListTable.tsx
- [ ] T092 [US8] Add user filter, symbol filter, and date range filter
- [ ] T093 [US8] Implement AdminAuditLogger.logTradeExport() in src/services/admin/AdminAuditLogger.ts

### Refactor for User Story 8 (BLUE Phase) 🔵

- [ ] T094 [US8] Verify pagination handles large datasets (10000+ trades)
- [ ] T095 [US8] Ensure all tests pass for US8

**Checkpoint**: User Story 8 complete - Platform-wide trade list with filtering

---

## Phase 10: User Story 6 - 刪除使用者 (Priority: P3)

**Goal**: 管理員能永久刪除使用者帳戶（無活躍持倉），需二次確認

**Independent Test**: 管理員可以獨立執行刪除操作

### Tests for User Story 6 (RED Phase) 🔴

- [ ] T096 [P] [US6] Unit test for AdminUserService.deleteUser() in tests/unit/services/admin/AdminUserService.test.ts

### Implementation for User Story 6 (GREEN Phase) 🟢

- [ ] T097 [US6] Implement AdminUserService.deleteUser() with active position check in src/services/admin/AdminUserService.ts
- [ ] T098 [US6] Implement AdminAuditLogger.logUserDelete() in src/services/admin/AdminAuditLogger.ts
- [ ] T099 [US6] Create DELETE /api/admin/users/[id] route in app/api/admin/users/[id]/route.ts (add DELETE handler)
- [ ] T100 [P] [US6] Create DeleteUserDialog with confirmation text input in app/(admin)/admin/users/[id]/components/DeleteUserDialog.tsx
- [ ] T101 [US6] Add prevention for deleting users with active positions (FR-012)
- [ ] T102 [US6] Add prevention for admin deleting themselves

### Refactor for User Story 6 (BLUE Phase) 🔵

- [ ] T103 [US6] Verify deleted user data is properly cascaded
- [ ] T104 [US6] Ensure all tests pass for US6

**Checkpoint**: User Story 6 complete - Admin can delete users (with safeguards)

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T105 [P] Add navigation links between admin pages in layout
- [ ] T106 [P] Add breadcrumb navigation in app/(admin)/admin/components/Breadcrumb.tsx
- [ ] T107 [P] Add loading states and skeleton components
- [ ] T108 [P] Add error boundary for admin pages
- [ ] T109 Run full test suite and verify all tests pass
- [ ] T110 Run quickstart.md validation checklist
- [ ] T111 Update CLAUDE.md with Feature 068 documentation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-10)**: All depend on Foundational phase completion
  - P1 stories (US1, US2, US7) can proceed in parallel after Foundational
  - P2 stories (US3, US4, US5, US8) can proceed in parallel after Foundational
  - P3 story (US6) can proceed after Foundational
- **Polish (Phase 11)**: Depends on all desired user stories being complete

### User Story Dependencies

| Story | Priority | Dependencies | Can Run Parallel With |
|-------|----------|--------------|----------------------|
| US1 (Dashboard) | P1 | Foundational only | US2, US7 |
| US2 (User List) | P1 | Foundational only | US1, US7 |
| US7 (User Trades) | P1 | US2 (needs user detail page) | US1 |
| US3 (Create User) | P2 | US2 (needs user list page) | US4, US5, US8 |
| US4 (Edit User) | P2 | US2 (needs user detail page) | US3, US5, US8 |
| US5 (Suspend/Enable) | P2 | US2 (needs user detail page) | US3, US4, US8 |
| US6 (Delete User) | P3 | US5 (suspend should be tried first) | None |
| US8 (Platform Trades) | P2 | Foundational only | US3, US4, US5 |

### Within Each User Story

- Tests (RED) MUST be written and FAIL before implementation
- Models/Services before API routes
- API routes before frontend pages
- Core implementation before edge cases
- Story complete before moving to next priority

### Parallel Opportunities

**Within Foundational:**
- T007 + T008 (tests) can run in parallel
- T009 + T010 (utilities) can run in parallel
- T014 + T015 (frontend pages) can run in parallel

**Within User Stories:**
- All tests for a story marked [P] can run in parallel
- Frontend components marked [P] can run in parallel
- Different user stories can be worked on in parallel by different team members

---

## Parallel Example: P1 User Stories

```bash
# After Foundational phase completes, launch all P1 stories in parallel:

# Team Member A: User Story 1 (Dashboard)
Task: T019-T029

# Team Member B: User Story 2 (User List)
Task: T030-T041

# Team Member C: User Story 7 (User Trades) - starts after US2 detail page ready
Task: T042-T052
```

---

## Implementation Strategy

### MVP First (P1 User Stories Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Dashboard)
4. Complete Phase 4: User Story 2 (User List)
5. Complete Phase 5: User Story 7 (User Trades)
6. **STOP and VALIDATE**: Test all P1 stories independently
7. Deploy/demo if ready (MVP complete!)

### Incremental Delivery

1. Setup + Foundational → Admin login working
2. Add US1 → Dashboard visible (MVP Demo 1)
3. Add US2 → User management browsing (MVP Demo 2)
4. Add US7 → Trade details visible (MVP Complete)
5. Add US3, US4, US5 → Full user management
6. Add US8 → Platform-wide trade view
7. Add US6 → Delete capability (complete feature)

### TDD Workflow Per Story

```
For each User Story:
1. Write tests (RED) - T0XX
2. Run tests, verify FAIL
3. Implement service layer (GREEN) - T0XX
4. Run tests, verify PASS
5. Implement API routes
6. Implement frontend
7. Refactor (BLUE) - verify all tests still PASS
8. Checkpoint: story complete
```

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- TDD: Verify tests fail before implementing (Constitution Principle VII)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Migration file MUST be committed with schema changes (Constitution Principle IV)

---

## Summary

| Metric | Value |
|--------|-------|
| Total Tasks | 111 |
| Setup Phase | 6 tasks |
| Foundational Phase | 12 tasks |
| US1 (P1) | 11 tasks |
| US2 (P1) | 12 tasks |
| US7 (P1) | 11 tasks |
| US3 (P2) | 9 tasks |
| US4 (P2) | 11 tasks |
| US5 (P2) | 13 tasks |
| US8 (P2) | 10 tasks |
| US6 (P3) | 9 tasks |
| Polish Phase | 7 tasks |
| Parallel Opportunities | 45 tasks marked [P] |
| MVP Scope | US1 + US2 + US7 (34 tasks) |
