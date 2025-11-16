# Implementation Plan: 移除套利機會頁面與 API

**Branch**: `013-specify-scripts-bash` | **Date**: 2025-01-21 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/013-specify-scripts-bash/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

移除套利機會 (Opportunities) 頁面及其相關功能，因為市場監控 (Market Monitor) 已提供完整的即時資金費率監控功能。此移除包括：
- 前端頁面組件 (`app/(dashboard)/opportunities/`)
- API 端點 (`app/api/opportunities/`)
- 後端業務邏輯 (OpportunityDetector service)
- 資料訪問層 (Repository classes)
- 資料模型標記為廢棄 (保留歷史資料)

技術方法：直接刪除相關檔案和代碼引用，保留 NotificationService 供未來擴展使用，將預設首頁改為市場監控頁面。

## Technical Context

**Language/Version**: TypeScript 5.6 + Node.js 20.x LTS
**Primary Dependencies**: Next.js 14 App Router (前端), Prisma 5.x (資料模型), Socket.io 4.8.1 (WebSocket)
**Storage**: PostgreSQL 15+ with TimescaleDB (保留歷史資料，標記模型為廢棄)
**Testing**: Jest (單元測試), E2E testing (路由驗證)
**Target Platform**: Web application (Next.js)
**Project Type**: Web - Next.js 14 App Router with separate frontend/backend structure
**Performance Goals**:
- 減少前端打包體積 (移除 opportunities 組件)
- 簡化 API 路由處理
- 降低系統複雜度
**Constraints**:
- 不可刪除歷史資料 (資料保護)
- 不可影響市場監控的正常運作
- 保留 NotificationService (未來擴展)
**Scale/Scope**:
- 移除約 15-20 個檔案
- 影響 3 個主要模組 (frontend, API, backend services)
- 保留約 2-3 個月的歷史 opportunity 記錄

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: Trading Safety First - ✅ PASS
- **Assessment**: 此移除不涉及交易執行邏輯，不影響 trading safety
- **Justification**: Opportunities 頁面僅用於展示，無交易功能

### Principle II: Complete Observability - ✅ PASS
- **Assessment**: 移除過程會產生 git commit，記錄所有變更
- **Compliance**:
  - 移除相關日誌保持結構化 (使用 logger.info)
  - 清楚記錄哪些組件被移除
  - CHANGELOG.md 記錄移除原因和影響

### Principle III: Defensive Programming - ✅ PASS
- **Assessment**: 需要處理舊 URL 的優雅降級
- **Compliance**:
  - `/opportunities` 路由返回 404 或重定向
  - API 端點返回 404 和清楚的錯誤訊息
  - 不影響其他模組的錯誤處理

### Principle IV: Data Integrity - ✅ PASS
- **Assessment**: 保留歷史資料，使用 Prisma migration 標記模型廢棄
- **Compliance**:
  - 使用 Prisma schema 註解標記 `@deprecated`
  - 不刪除資料表 (避免資料遺失)
  - 不影響 funding rate 等其他資料的完整性

### Principle V: Incremental Delivery - ✅ PASS
- **Assessment**: 功能移除是單一 Pull Request，可獨立測試
- **Compliance**:
  - User Story 1 (移除前端) 可獨立驗證
  - User Story 2 (移除 API) 可獨立測試
  - 所有變更在單一 PR 中，便於 review 和回滾

### Principle VI: System Architecture Boundaries - ✅ PASS
- **Assessment**: 移除遵循 CLI vs Web 分離原則
- **Compliance**:
  - 移除的 OpportunityDetector 是 CLI 職責 (背景監控)
  - 移除的 Opportunities 頁面是 Web 職責 (資料展示)
  - 市場監控頁面仍遵循「Database → Web API → Web UI」模式
  - API keys 不受影響 (僅存在於 CLI 環境)

**Overall Assessment**: ✅ 所有原則通過，無違規需要處理

## Project Structure

### Documentation (this feature)

```
specs/013-specify-scripts-bash/
├── plan.md              # This file (/speckit.plan command output)
├── spec.md              # Feature specification (completed)
├── research.md          # Phase 0 output (minimal - mostly file deletion tasks)
├── data-model.md        # Phase 1 output (deprecated models documentation)
├── quickstart.md        # Phase 1 output (how to verify removal)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

此功能涉及的代碼結構（移除路徑）：

```
# Frontend (Next.js 14 App Router)
app/
├── (dashboard)/
│   ├── opportunities/              # ❌ 移除整個目錄
│   │   ├── page.tsx
│   │   ├── components/
│   │   └── types.ts
│   └── market-monitor/             # ✅ 保留 (替代方案)
│       └── ...
├── api/
│   ├── opportunities/              # ❌ 移除整個目錄
│   │   ├── route.ts
│   │   └── [id]/route.ts
│   └── market-rates/               # ✅ 保留
│       └── ...
└── layout.tsx                      # ⚠️  修改 (更新預設首頁)

# Backend Services
src/
├── services/
│   ├── monitor/
│   │   ├── OpportunityDetector.ts  # ❌ 移除
│   │   ├── FundingRateMonitor.ts   # ✅ 保留
│   │   └── MonitorService.ts       # ⚠️  修改 (移除 OpportunityDetector 註冊)
│   └── notification/
│       └── NotificationService.ts  # ✅ 保留 (未來擴展)
├── repositories/
│   ├── ArbitrageOpportunityRepository.ts  # ❌ 移除
│   ├── OpportunityHistoryRepository.ts    # ❌ 移除
│   └── FundingRateRepository.ts           # ✅ 保留
├── models/
│   ├── ArbitrageOpportunity.ts     # ❌ 移除
│   ├── OpportunityHistory.ts       # ❌ 移除
│   └── FundingRate.ts              # ✅ 保留
└── lib/
    └── debounce.ts                 # ⚠️  檢查使用 (可能可移除)

# Database Schema
prisma/
└── schema.prisma                   # ⚠️  修改 (標記 models 為 @deprecated)

# Tests
tests/
├── integration/
│   └── opportunities.test.ts       # ❌ 移除
└── unit/
    └── OpportunityDetector.test.ts # ❌ 移除
```

**Structure Decision**:
- 使用 Next.js 14 App Router 結構 (已存在)
- Frontend 位於 `app/` 目錄 (App Router 約定)
- Backend services 位於 `src/` 目錄
- 遵循現有專案架構，不引入新模式
- 移除方式：直接刪除整個目錄和檔案

## Complexity Tracking

*此功能為移除操作，不引入新複雜度，無違規需要處理。*

**N/A** - 無新增抽象或模式
