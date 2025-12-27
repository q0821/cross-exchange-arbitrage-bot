# Implementation Plan: 持倉詳情查看功能

**Branch**: `045-position-details-view` | **Date**: 2025-12-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/045-position-details-view/spec.md`

## Summary

實作持倉詳情展開功能，讓用戶在持倉管理頁面查看詳細資訊：開倉價格、當前價格、未實現損益、資金費率明細、手續費和預估年化報酬率。採用 Lazy Loading 模式，僅在用戶展開詳情時即時查詢交易所 API，不新增資料庫欄位。

## Technical Context

**Language/Version**: TypeScript 5.6 + Node.js 20.x LTS
**Primary Dependencies**: Next.js 14 App Router, React 18, CCXT 4.x, Prisma 5.x, Tailwind CSS, Decimal.js
**Storage**: PostgreSQL 15 + TimescaleDB (現有 Position 模型，不新增欄位)
**Testing**: Vitest + React Testing Library
**Target Platform**: Web Application (Next.js)
**Project Type**: Web Application (Monorepo 結構：前端 + 後端整合)
**Performance Goals**: API 回應時間 < 3 秒（含交易所查詢）
**Constraints**: 不新增資料庫欄位、展開時才查詢 API
**Scale/Scope**: 單用戶持倉管理功能擴展

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Trading Safety First | ✅ PASS | 本功能為唯讀資訊查詢，不涉及交易執行 |
| II. Complete Observability | ✅ PASS | 將使用 Pino 記錄 API 查詢錯誤 |
| III. Defensive Programming | ✅ PASS | API 失敗有重試選項和錯誤處理 |
| IV. Data Integrity | ✅ PASS | 使用 Decimal 處理財務計算 |
| V. Incremental Delivery | ✅ PASS | 優先級 P1-P4 分階段實作 |
| VI. System Architecture Boundaries | ✅ PASS | Web 透過 API 查詢資料，交易所 API 呼叫在後端 |
| VII. TDD Discipline | ✅ PASS | 將先寫測試再實作 |

**Gate Result**: ✅ PASS - 無違規項目

### Post-Design Re-Check

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Trading Safety First | ✅ PASS | 唯讀 API，不執行任何交易 |
| II. Complete Observability | ✅ PASS | 使用 Pino 記錄所有 API 錯誤 |
| III. Defensive Programming | ✅ PASS | 部分成功模式、重試機制、優雅降級 |
| IV. Data Integrity | ✅ PASS | 使用 Decimal.js 處理所有財務計算 |
| V. Incremental Delivery | ✅ PASS | P1-P4 優先級明確，可分階段交付 |
| VI. System Architecture Boundaries | ✅ PASS | API 呼叫在後端，前端純展示 |
| VII. TDD Discipline | ✅ PASS | 測試計劃已包含在結構中 |

**Post-Design Gate Result**: ✅ PASS - 設計符合所有原則

## Project Structure

### Documentation (this feature)

```
specs/045-position-details-view/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── openapi.yaml     # API specification
└── tasks.md             # Phase 2 output (from /speckit.tasks)
```

### Source Code (repository root)

```
# Backend API
app/api/positions/[id]/details/
└── route.ts                    # GET /api/positions/[id]/details

# Backend Services
src/services/trading/
├── PositionDetailsService.ts   # 持倉詳情查詢服務
└── FundingFeeQueryService.ts   # 既有資金費率查詢服務 (重用)

# Frontend Components
app/(dashboard)/positions/
├── page.tsx                           # 持倉列表頁面 (修改)
├── components/
│   ├── PositionCard.tsx               # 持倉卡片 (修改：加入展開功能)
│   ├── PositionDetailsPanel.tsx       # 持倉詳情面板 (新增)
│   ├── FundingFeeBreakdown.tsx        # 資金費率明細 (新增)
│   └── AnnualizedReturnDisplay.tsx    # 年化報酬率顯示 (新增)
└── hooks/
    └── usePositionDetails.ts          # 詳情查詢 Hook (新增)

# Types
src/types/
└── trading.ts                  # 擴展：PositionDetailsInfo

# Tests
tests/
├── unit/
│   ├── services/
│   │   └── PositionDetailsService.test.ts
│   └── components/
│       ├── PositionDetailsPanel.test.tsx
│       └── FundingFeeBreakdown.test.tsx
└── integration/
    └── position-details-api.test.ts
```

**Structure Decision**: 採用現有 Web Application 結構，新增 API endpoint 和前端元件。後端服務使用既有的 `FundingFeeQueryService` 查詢資金費率歷史，新增 `PositionDetailsService` 整合所有詳情資料。

## Complexity Tracking

*無違規項目，不需要填寫*
