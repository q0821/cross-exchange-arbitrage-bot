# Tasks: Prisma Client Singleton 優化

**Input**: Design documents from `/specs/039-specify-scripts-bash/`
**Prerequisites**: plan.md, spec.md, research.md, quickstart.md

**Tests**: 本功能規格指定手動整合測試，不新增自動化測試。

**Organization**: 由於此功能為純程式碼重構，所有三個 User Stories 透過相同的程式碼變更同時達成。任務按檔案分組以便平行執行。

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: 此功能無需 Setup - 使用現有專案結構和 singleton 實作

*無任務 - singleton 已存在於 `src/lib/db.ts`*

---

## Phase 2: Foundational

**Purpose**: 此功能無需 Foundational 任務 - 所有基礎設施已就緒

*無任務 - `src/lib/db.ts` 已配置完整的監控和優雅關閉機制*

**Checkpoint**: 可直接開始重構工作

---

## Phase 3: API Routes 重構 (實現 US1, US2, US3) 🎯 MVP

**Goal**: 將所有 API routes 的 `new PrismaClient()` 替換為 `import { prisma } from '@/src/lib/db'`

**Independent Test**: 執行 `pnpm build` 確認編譯成功，手動測試關鍵 API endpoints

### Auth Routes (2 files)

- [x] T001 [P] Refactor app/api/auth/register/route.ts to use singleton prisma
- [x] T002 [P] Refactor app/api/auth/login/route.ts to use singleton prisma

### Opportunities Routes (2 files)

- [x] T003 [P] Refactor app/api/opportunities/history/route.ts to use singleton prisma
- [x] T004 [P] Refactor app/api/opportunities/history/[id]/route.ts to use singleton prisma

### API Keys Routes (2 files)

- [x] T005 [P] Refactor app/api/api-keys/route.ts to use singleton prisma
- [x] T006 [P] Refactor app/api/api-keys/[id]/route.ts to use singleton prisma

### Simulated Tracking Routes (4 files)

- [x] T007 [P] Refactor app/api/simulated-tracking/route.ts to use singleton prisma
- [x] T008 [P] Refactor app/api/simulated-tracking/[id]/route.ts to use singleton prisma
- [x] T009 [P] Refactor app/api/simulated-tracking/[id]/snapshots/route.ts to use singleton prisma
- [x] T010 [P] Refactor app/api/simulated-tracking/[id]/stop/route.ts to use singleton prisma

### Positions Routes (5 files)

- [x] T011 [P] Refactor app/api/positions/route.ts to use singleton prisma
- [x] T012 [P] Refactor app/api/positions/open/route.ts to use singleton prisma
- [x] T013 [P] Refactor app/api/positions/[id]/route.ts to use singleton prisma
- [x] T014 [P] Refactor app/api/positions/[id]/market-data/route.ts to use singleton prisma
- [x] T015 [P] Refactor app/api/positions/[id]/close/route.ts to use singleton prisma

### Assets Routes (3 files)

- [x] T016 [P] Refactor app/api/assets/route.ts to use singleton prisma
- [x] T017 [P] Refactor app/api/assets/history/route.ts to use singleton prisma
- [x] T018 [P] Refactor app/api/assets/positions/route.ts to use singleton prisma

### Notifications Routes (3 files)

- [x] T019 [P] Refactor app/api/notifications/webhooks/route.ts to use singleton prisma
- [x] T020 [P] Refactor app/api/notifications/webhooks/[id]/route.ts to use singleton prisma
- [x] T021 [P] Refactor app/api/notifications/webhooks/[id]/test/route.ts to use singleton prisma

### Other Routes (3 files)

- [x] T022 [P] Refactor app/api/trades/route.ts to use singleton prisma
- [x] T023 [P] Refactor app/api/balances/route.ts to use singleton prisma
- [x] T024 Skipped - app/api/settings/trading/route.ts already uses repository pattern

**Checkpoint**: 所有 API routes 已重構完成

---

## Phase 4: Repositories 重構

**Goal**: 將所有 repositories 的 `new PrismaClient()` 替換為 `import { prisma } from '@/src/lib/db'`

- [x] T025 [P] Refactor src/repositories/TradingSettingsRepository.ts to use singleton prisma
- [x] T026 [P] Refactor src/repositories/AuditLogRepository.ts to use singleton prisma

**Checkpoint**: 所有 repositories 已重構完成

---

## Phase 5: 驗證與 Polish

**Purpose**: 確認重構成功，更新文件

- [x] T027 Run `pnpm build` to verify TypeScript compilation
- [x] T028 Run `grep -r "new PrismaClient" app/api/ src/repositories/` to verify no remaining instances
- [ ] T029 Manual test: Login API endpoint functionality
- [ ] T030 Manual test: Positions API endpoint functionality
- [x] T031 Run quickstart.md validation checklist
- [ ] T032 Update CLAUDE.md with Feature 039 key paths (if needed)

**Checkpoint**: 功能完成，可合併至 main

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 無任務 - 跳過
- **Phase 2 (Foundational)**: 無任務 - 跳過
- **Phase 3 (API Routes)**: 可立即開始，所有任務可平行執行
- **Phase 4 (Repositories)**: 可與 Phase 3 平行執行
- **Phase 5 (驗證)**: 必須等待 Phase 3 和 Phase 4 完成

### Parallel Execution

所有 T001-T026 任務都可平行執行（不同檔案，無相依性）

```
T001 ─┬─ 全部可平行執行
T002 ─┤
T003 ─┤
...   │
T026 ─┘
      ↓
T027 → T028 → T029 → T030 → T031 → T032 (依序執行)
```

---

## Implementation Strategy

### 單一開發者執行順序

1. 逐一執行 T001-T026（可批次處理同類型檔案）
2. 每完成一組檔案後執行 `pnpm build` 確認無錯誤
3. 完成後執行 T027-T032 驗證

### 平行開發者執行策略

```
Developer A: T001-T010 (Auth, Opportunities, API Keys, Simulated Tracking)
Developer B: T011-T018 (Positions, Assets)
Developer C: T019-T026 (Notifications, Other, Repositories)
```

完成後集中執行 T027-T032 驗證

### 每個檔案的修改模式

**Before**:
```typescript
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
```

**After**:
```typescript
import { prisma } from '@/src/lib/db';
```

---

## Notes

- 所有 T001-T026 任務標記 [P] 表示可平行執行
- 每個檔案修改後立即確認無 TypeScript 錯誤
- 若發現問題可執行 `git checkout -- <file>` 快速回滾單一檔案
- 範圍外：scripts/*.ts、tests/*.ts、server.ts
