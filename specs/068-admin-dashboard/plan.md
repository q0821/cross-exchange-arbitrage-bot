# Implementation Plan: 平台管理後臺

**Branch**: `068-admin-dashboard` | **Date**: 2026-01-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/068-admin-dashboard/spec.md`

## Summary

建立平台管理後臺，提供管理員使用者管理（CRUD、停用/啟用）、平台績效總覽、使用者交易明細查詢等功能。採用現有 User 模型擴展 `role` 和 `isActive` 欄位，實作獨立的管理員認證入口與路由。

## Technical Context

**Language/Version**: TypeScript 5.8 + Node.js 20.x LTS
**Primary Dependencies**: Next.js 15, React 19, Prisma 7.x, Tailwind CSS, Radix UI
**Storage**: PostgreSQL 15+ with TimescaleDB (現有資料庫擴展)
**Testing**: Vitest 4.x (單元/整合測試), Playwright (E2E)
**Target Platform**: Web (管理後臺)
**Project Type**: Web application (monorepo 前後端整合)
**Performance Goals**: 儀表板載入 < 3 秒, 搜尋結果 < 1 秒
**Constraints**: 管理員操作需記錄審計日誌, Session 即時失效機制
**Scale/Scope**: 預估 < 100 管理員, < 10,000 使用者, < 100,000 交易記錄

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 狀態 | 說明 |
|------|------|------|
| **I. 交易安全優先** | ✅ Pass | 管理後臺為查詢/管理功能，不直接執行交易操作。停用使用者時有活躍持倉警告機制。 |
| **II. 完整可觀測性** | ✅ Pass | 所有管理操作記錄至 AuditLog，包含操作者、時間、目標、變更內容。 |
| **III. 防禦性程式設計** | ✅ Pass | 管理員認證獨立驗證、權限檢查、輸入驗證。使用 Factory 模式取得 DB 連線。 |
| **IV. 資料完整性** | ✅ Pass | User 模型擴展需產生 Migration 檔案（role, isActive 欄位）。Migration 與 schema 同步提交。 |
| **V. 漸進式交付** | ✅ Pass | P1 功能（儀表板、使用者列表、交易明細）先交付，P2/P3 功能後續迭代。 |
| **VI. 系統架構邊界** | ✅ Pass | 管理後臺為 Web 層讀取/管理功能，資料來源為資料庫。不直接呼叫交易所 API。 |
| **VII. TDD 紀律** | ✅ Pass | 所有 Service 層邏輯需先寫測試（Red）→ 實作（Green）→ 重構（Refactor）。 |

## Project Structure

### Documentation (this feature)

```text
specs/068-admin-dashboard/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
# Admin Dashboard - Web Application 結構

app/
├── (admin)/                    # Admin 路由群組
│   ├── admin/
│   │   ├── layout.tsx          # Admin 佈局（側邊欄、導航）
│   │   ├── page.tsx            # Admin 首頁重導向
│   │   ├── dashboard/
│   │   │   └── page.tsx        # 儀表板頁面
│   │   ├── users/
│   │   │   ├── page.tsx        # 使用者列表頁面
│   │   │   └── [id]/
│   │   │       └── page.tsx    # 使用者詳情頁面
│   │   └── trades/
│   │       └── page.tsx        # 平台交易列表頁面
│   └── admin-login/
│       └── page.tsx            # 管理員登入頁面

src/
├── services/
│   └── admin/
│       ├── AdminAuthService.ts         # 管理員認證服務
│       ├── AdminUserService.ts         # 使用者管理服務
│       ├── AdminDashboardService.ts    # 儀表板統計服務
│       └── AdminTradeService.ts        # 交易查詢服務
├── repositories/
│   └── AdminRepository.ts              # 管理後臺資料存取層
├── lib/
│   └── admin/
│       ├── auth.ts                     # Admin 認證工具
│       └── middleware.ts               # Admin 路由中介層

app/api/
├── admin/
│   ├── auth/
│   │   └── login/route.ts              # POST /api/admin/auth/login
│   ├── dashboard/
│   │   └── route.ts                    # GET /api/admin/dashboard
│   ├── users/
│   │   ├── route.ts                    # GET/POST /api/admin/users
│   │   └── [id]/
│   │       ├── route.ts                # GET/PATCH/DELETE /api/admin/users/[id]
│   │       ├── suspend/route.ts        # POST /api/admin/users/[id]/suspend
│   │       ├── enable/route.ts         # POST /api/admin/users/[id]/enable
│   │       ├── reset-password/route.ts # POST /api/admin/users/[id]/reset-password
│   │       └── trades/route.ts         # GET /api/admin/users/[id]/trades
│   └── trades/
│       ├── route.ts                    # GET /api/admin/trades
│       └── export/route.ts             # GET /api/admin/trades/export

prisma/
├── schema.prisma                       # 擴展 User 模型（role, isActive）
└── migrations/
    └── YYYYMMDDHHMMSS_add_admin_fields/
        └── migration.sql               # Migration 檔案

tests/
├── unit/
│   └── services/
│       └── admin/
│           ├── AdminAuthService.test.ts
│           ├── AdminUserService.test.ts
│           ├── AdminDashboardService.test.ts
│           └── AdminTradeService.test.ts
├── integration/
│   └── admin/
│       ├── AdminUserFlow.test.ts
│       └── AdminDashboardFlow.test.ts
└── e2e/
    └── admin/
        └── admin-dashboard.spec.ts
```

**Structure Decision**: 採用 Next.js 15 的路由群組 `(admin)` 將管理後臺路由獨立，避免與現有用戶端路由混淆。服務層放在 `src/services/admin/` 保持模組化，API 路由在 `app/api/admin/` 下。

## Complexity Tracking

> **無需填寫** - Constitution Check 全部通過，無違規需要說明。
