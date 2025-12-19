# Implementation Plan: 手動標記持倉已平倉

**Branch**: `037-mark-position-closed` | **Date**: 2025-12-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/037-specify-scripts-bash/spec.md`

## Summary

新增手動標記持倉為「已平倉」功能，讓用戶能夠在交易所手動平倉後，同步更新系統中的持倉記錄。包含一個 PATCH API 端點和 UI 按鈕。

## Technical Context

**Language/Version**: TypeScript 5.6 + Node.js 20.x LTS
**Primary Dependencies**: Next.js 14 App Router, Prisma 5.x, React 18
**Storage**: PostgreSQL 15 + TimescaleDB (現有 Position 模型)
**Testing**: Vitest (現有測試框架)
**Target Platform**: Web application
**Project Type**: Web application (Next.js fullstack)
**Performance Goals**: 3 秒內完成標記操作
**Constraints**: 僅更新本地資料庫，不涉及交易所 API
**Scale/Scope**: 單一用戶操作，低併發

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Trading Safety First | PASS | 此功能不執行實際交易，僅更新本地記錄 |
| II. Complete Observability | PASS | 將記錄操作日誌 |
| III. Defensive Programming | PASS | 使用 Zod 驗證請求 |
| IV. Data Integrity | PASS | 使用 Prisma 更新，狀態轉換受限 |
| V. Incremental Delivery | PASS | 獨立功能，可單獨測試 |
| VI. System Architecture | PASS | Web 負責 UI 和 API，符合架構邊界 |

## Project Structure

### Documentation (this feature)

```
specs/037-specify-scripts-bash/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── openapi.yaml     # API contract
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```
app/
├── api/
│   └── positions/
│       └── [id]/
│           └── route.ts          # 新增 PATCH handler
└── (dashboard)/
    └── positions/
        ├── page.tsx              # 修改：新增標記已平倉處理
        └── components/
            └── PositionCard.tsx  # 修改：新增標記已平倉按鈕
```

**Structure Decision**: 使用現有 Next.js App Router 結構，在 `app/api/positions/[id]/` 新增 PATCH 端點，修改現有 PositionCard 組件新增按鈕。

## Complexity Tracking

*No violations - simple CRUD operation with existing patterns*
