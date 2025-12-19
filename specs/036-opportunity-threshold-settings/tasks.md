# Tasks: 可配置年化收益門檻

**Input**: Design documents from `/specs/036-opportunity-threshold-settings/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, quickstart.md

**Tests**: Not explicitly requested in the specification. Tests tasks are NOT included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- **Project type**: Next.js App Router (Web application)
- **Frontend**: `app/(dashboard)/` for pages and components
- **Hooks**: `app/(dashboard)/market-monitor/hooks/`
- **Utils**: `app/(dashboard)/market-monitor/utils/`
- **Settings**: `app/(dashboard)/settings/trading/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization - no setup needed for this feature

This feature is purely frontend and uses existing project structure. No new dependencies or infrastructure required.

- [x] T001 Verify existing project structure and dependencies are in place

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

- [x] T002 Extend preferences utility with threshold read/write functions in `app/(dashboard)/market-monitor/utils/preferences.ts`
- [x] T003 Modify `recalculateBestPair()` to accept optional `opportunityThreshold` parameter in `app/(dashboard)/market-monitor/utils/rateCalculations.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - 設定年化收益門檻 (Priority: P1) MVP

**Goal**: 用戶能在設定頁面自訂年化收益門檻，儲存後市場監控頁面即時使用新門檻判定「機會」狀態

**Independent Test**:
1. 前往 `/settings/trading`，輸入新門檻值（如 300%）
2. 點擊儲存
3. 前往 `/market-monitor`
4. 確認年化收益 ≥ 300% 的交易對顯示開倉按鈕

### Implementation for User Story 1

- [x] T004 [US1] Create `useOpportunityThreshold` hook in `app/(dashboard)/market-monitor/hooks/useOpportunityThreshold.ts`
- [x] T005 [US1] Modify `useMarketRates` to integrate threshold hook in `app/(dashboard)/market-monitor/hooks/useMarketRates.ts`
- [x] T006 [P] [US1] Create trading settings page directory structure at `app/(dashboard)/settings/trading/`
- [x] T007 [US1] Create `OpportunityThresholdSettings` component in `app/(dashboard)/settings/trading/components/OpportunityThresholdSettings.tsx`
- [x] T008 [US1] Create trading settings page in `app/(dashboard)/settings/trading/page.tsx`
- [x] T009 [US1] Add input validation for threshold range (1-10000) in `OpportunityThresholdSettings.tsx`
- [x] T010 [US1] Add success/error feedback messages after save in `OpportunityThresholdSettings.tsx`

**Checkpoint**: User Story 1 complete - users can set threshold and see it applied in market monitor

---

## Phase 4: User Story 2 - 使用快速選擇按鈕 (Priority: P2)

**Goal**: 用戶能快速選擇常用門檻值（300%、500%、800%、1000%），無需手動輸入

**Independent Test**:
1. 前往 `/settings/trading`
2. 點擊「500%」快速選擇按鈕
3. 確認輸入框顯示 500
4. 點擊「重設為預設值」
5. 確認輸入框顯示 800

### Implementation for User Story 2

- [x] T011 [US2] Add quick selection buttons (300%, 500%, 800%, 1000%) to `OpportunityThresholdSettings.tsx`
- [x] T012 [US2] Add reset to default button functionality in `OpportunityThresholdSettings.tsx`
- [x] T013 [US2] Style quick selection buttons with visual feedback for current selection in `OpportunityThresholdSettings.tsx`

**Checkpoint**: User Story 2 complete - users have quick selection and reset functionality

---

## Phase 5: User Story 3 - 跨標籤頁同步 (Priority: P3)

**Goal**: 在一個標籤頁修改門檻後，其他已開啟的標籤頁自動同步更新

**Independent Test**:
1. 開啟兩個瀏覽器標籤頁，都前往 `/market-monitor`
2. 在標籤頁 A 透過設定頁面修改門檻為 500%
3. 確認標籤頁 B 自動更新狀態顯示

### Implementation for User Story 3

- [x] T014 [US3] Add `storage` event listener for cross-tab sync in `useOpportunityThreshold.ts`
- [x] T015 [US3] Handle threshold updates from other tabs and trigger recalculation in `useMarketRates.ts`

**Checkpoint**: User Story 3 complete - cross-tab synchronization works

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases and final improvements

- [x] T016 [P] Handle localStorage unavailable (privacy mode) with fallback to default value in `preferences.ts`
- [x] T017 [P] Display warning when localStorage is unavailable in `OpportunityThresholdSettings.tsx`
- [x] T018 Add navigation link to trading settings from settings sidebar (if applicable)
- [x] T019 Run quickstart.md validation to verify complete user flow

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - verification only
- **Foundational (Phase 2)**: Must complete before ANY user story
- **User Story 1 (Phase 3)**: Depends on Foundational - This is the MVP
- **User Story 2 (Phase 4)**: Depends on User Story 1 (extends the same component)
- **User Story 3 (Phase 5)**: Depends on Foundational (independent of US1/US2)
- **Polish (Phase 6)**: Can run in parallel with user stories

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Phase 2 - No dependencies on other stories
- **User Story 2 (P2)**: Depends on US1 (extends the settings component)
- **User Story 3 (P3)**: Can start after Phase 2 - Independent of US1/US2

### Within Each User Story

- Core utility changes before hooks
- Hooks before components
- Components before pages

### Parallel Opportunities

Within User Story 1:
- T006 (directory structure) can run in parallel with T004/T005

Within User Story 3:
- T014 and T015 must be sequential (T14 before T15)

Within Polish:
- T016 and T017 can run in parallel (different files)

---

## Parallel Example: User Story 1

```bash
# Phase 2 Foundation (sequential - same files):
Task T002: "Extend preferences utility with threshold functions"
Task T003: "Modify recalculateBestPair() to accept threshold parameter"

# User Story 1 - After foundation:
# T006 can run in parallel with T004:
Task T004: "Create useOpportunityThreshold hook"
Task T006: "Create trading settings page directory structure"

# Then sequential:
Task T005: "Modify useMarketRates to integrate threshold hook" (depends on T004)
Task T007: "Create OpportunityThresholdSettings component" (depends on T006)
Task T008: "Create trading settings page" (depends on T007)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (T002-T003)
2. Complete Phase 3: User Story 1 (T004-T010)
3. **STOP and VALIDATE**: Test threshold setting and market monitor integration
4. Deploy/demo if ready

### Incremental Delivery

1. Complete Foundation → Core utilities ready
2. Add User Story 1 → Test independently → MVP Complete!
3. Add User Story 2 → Test quick selection → Enhanced UX
4. Add User Story 3 → Test cross-tab sync → Full feature
5. Polish → Edge cases handled

### Single Developer Strategy

Recommended order:
1. T002 → T003 (Foundation)
2. T004 → T005 → T006 → T007 → T008 → T009 → T010 (US1)
3. T011 → T012 → T013 (US2)
4. T014 → T015 (US3)
5. T016 → T017 → T018 → T019 (Polish)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently testable
- Commit after each task or logical group
- No database changes required - pure frontend feature
- localStorage is the only persistence mechanism

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| Phase 1: Setup | 1 | Verification only |
| Phase 2: Foundational | 2 | Core utility modifications |
| Phase 3: US1 (MVP) | 7 | Basic threshold setting |
| Phase 4: US2 | 3 | Quick selection buttons |
| Phase 5: US3 | 2 | Cross-tab sync |
| Phase 6: Polish | 4 | Edge cases and validation |
| **Total** | **19** | |

**MVP Scope**: Phase 1-3 (10 tasks)
**Full Feature**: All phases (19 tasks)
