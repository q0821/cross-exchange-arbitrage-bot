# Implementation Plan: 用戶密碼管理

**Branch**: `061-specify-scripts-bash` | **Date**: 2026-01-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/061-specify-scripts-bash/spec.md`

## Summary

實作用戶密碼變更與忘記密碼重設功能，包含暴力破解保護（5 次失敗鎖定 15 分鐘）、密碼強度即時回饋、審計日誌記錄、以及帳戶鎖定郵件通知。

## Technical Context

**Language/Version**: TypeScript 5.8 + Node.js 20.x LTS
**Primary Dependencies**: Next.js 15, React 19, Prisma 7.x, bcrypt, jsonwebtoken, Zod
**Storage**: PostgreSQL 15 + TimescaleDB (現有 User, AuditLog 模型)
**Testing**: Vitest 4.x
**Target Platform**: Web application (Next.js App Router)
**Project Type**: web (Next.js 全端應用)
**Performance Goals**: 密碼驗證 < 500ms，郵件發送 < 30s
**Constraints**: Session 失效在密碼變更後立即生效
**Scale/Scope**: 單一用戶系統（目前不支援多租戶）

**Email Service**: Nodemailer + SMTP 環境變數（見 research.md）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Design Check (Phase 0)

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Trading Safety First | ✅ N/A | 密碼管理不涉及交易執行 |
| II. Complete Observability | ✅ Pass | FR-014 要求審計日誌（時間、用戶、操作類型、IP） |
| III. Defensive Programming | ✅ Pass | 需實作暴力破解保護、郵件失敗處理 |
| IV. Data Integrity | ✅ Pass | 使用 Prisma migrations、密碼雜湊儲存 |
| V. Incremental Delivery | ✅ Pass | P1→P2→P3 優先順序明確 |
| VI. System Architecture | ✅ Pass | Web-only 功能，不涉及 CLI |
| VII. TDD Discipline | ⚠️ Required | 所有實作必須遵循 Red-Green-Refactor |

**Gate Result**: ✅ PASS

### Post-Design Check (Phase 1)

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Trading Safety First | ✅ N/A | 不涉及交易 |
| II. Complete Observability | ✅ Pass | AuditLog 新增 6 種密碼相關 action |
| III. Defensive Programming | ✅ Pass | 暴力破解保護、郵件失敗處理、token 過期處理 |
| IV. Data Integrity | ✅ Pass | PasswordResetToken 使用 bcrypt 雜湊、Prisma migration |
| V. Incremental Delivery | ✅ Pass | P1/P2/P3 可獨立交付和測試 |
| VI. System Architecture | ✅ Pass | 純 Web 功能，資料庫為單一資料來源 |
| VII. TDD Discipline | ⚠️ Required | 測試檔案已規劃在 tests/ 目錄 |

**Gate Result**: ✅ PASS - 可進入 Phase 2 (tasks)

## Project Structure

### Documentation (this feature)

```
specs/061-specify-scripts-bash/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (OpenAPI)
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```
src/
├── models/User.ts                          # 擴展：失敗嘗試、鎖定狀態
├── services/
│   └── auth/
│       ├── AuthService.ts                  # 擴展：密碼變更、重設
│       ├── PasswordResetService.ts         # 新增：重設 token 管理
│       └── SessionManager.ts               # 擴展：session 失效
├── repositories/
│   ├── UserRepository.ts                   # 擴展：鎖定查詢
│   └── PasswordResetTokenRepository.ts     # 新增
├── lib/
│   ├── password-strength.ts                # 新增：密碼強度計算
│   └── email/                              # 新增：郵件服務
│       ├── EmailService.ts
│       └── templates/
│           ├── password-reset.ts
│           └── account-locked.ts
└── types/
    └── auth.ts                             # 擴展：密碼相關類型

app/
├── (dashboard)/settings/
│   └── security/
│       └── page.tsx                        # 新增：密碼變更頁面
├── (auth)/
│   ├── forgot-password/
│   │   └── page.tsx                        # 新增
│   └── reset-password/
│       └── page.tsx                        # 新增
└── api/
    └── auth/
        ├── change-password/route.ts        # 新增
        ├── forgot-password/route.ts        # 新增
        └── reset-password/route.ts         # 新增

tests/
├── unit/
│   ├── services/PasswordResetService.test.ts
│   └── lib/password-strength.test.ts
└── integration/
    └── api/auth/
        ├── change-password.test.ts
        ├── forgot-password.test.ts
        └── reset-password.test.ts
```

**Structure Decision**: 使用現有的 Next.js App Router 架構，擴展 `src/services/auth/` 處理密碼相關邏輯，新增 `src/lib/email/` 處理郵件發送。

## Complexity Tracking

*無違規需要追蹤*

