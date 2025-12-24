# Implementation Plan: API Key 連線測試

**Branch**: `042-api-key-connection-test` | **Date**: 2025-12-24 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/042-api-key-connection-test/spec.md`

## Summary

實作 API Key 連線測試功能，讓用戶可以在新增或管理 API Key 時，測試與交易所的連線是否有效並檢查權限狀態。

技術方案：擴展現有的 `ApiKeyValidator` 類別，新增 Gate.io 和 MEXC 的驗證方法，並透過新的 REST API endpoint 提供測試功能給前端使用。

## Technical Context

**Language/Version**: TypeScript 5.6 + Node.js 20.x LTS
**Primary Dependencies**: Next.js 14 App Router, CCXT 4.x（多交易所抽象）, Prisma 5.x (ORM), Pino（結構化日誌）
**Storage**: PostgreSQL 15 + TimescaleDB（現有 ApiKey 模型已有 `lastValidatedAt` 欄位）
**Testing**: Vitest（單元測試）+ 整合測試
**Target Platform**: Web 瀏覽器 + Node.js 伺服器
**Project Type**: Web application (Next.js fullstack)
**Performance Goals**: API Key 測試應在 5 秒內完成（正常網路環境）
**Constraints**: 30 秒超時處理、防止重複請求
**Scale/Scope**: 支援 4 個交易所（Binance、OKX、Gate.io、MEXC）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Trading Safety First | ✅ N/A | 此功能僅測試連線，不涉及交易執行 |
| II. Complete Observability | ✅ Pass | 使用 Pino 結構化日誌記錄測試結果 |
| III. Defensive Programming | ✅ Pass | 實作超時處理、錯誤處理、重試邏輯 |
| IV. Data Integrity | ✅ Pass | 使用現有 Prisma 模型，更新 lastValidatedAt |
| V. Incremental Delivery | ✅ Pass | 可獨立測試的 User Stories，P1 優先 |
| VI. System Architecture Boundaries | ✅ Pass | Web API 調用服務層，符合架構分離 |
| VII. TDD Discipline | ✅ Required | 所有實作必須遵守 Red-Green-Refactor 流程 |

## Project Structure

### Documentation (this feature)

```
specs/042-api-key-connection-test/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── openapi.yaml     # API 規格
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```
src/
├── services/
│   └── apikey/
│       ├── ApiKeyService.ts      # 擴展 validateApiKey 方法
│       └── ApiKeyValidator.ts    # 新增 Gate.io、MEXC 驗證
├── types/
│   └── api-key-validation.ts     # 新增驗證結果類型定義
└── lib/
    └── errors.ts                 # 錯誤處理（現有）

app/
├── api/
│   └── api-keys/
│       ├── route.ts              # 現有 CRUD
│       └── test/
│           └── route.ts          # 新增：測試未儲存的 API Key
│       └── [id]/
│           ├── route.ts          # 現有
│           └── test/
│               └── route.ts      # 新增：重新測試已儲存的 API Key
└── (dashboard)/
    └── settings/
        └── api-keys/
            └── page.tsx          # 修改：新增測試按鈕和結果顯示

tests/
├── unit/
│   └── services/
│       └── ApiKeyValidator.test.ts  # 新增測試
└── integration/
    └── api-key-validation.test.ts   # 新增整合測試
```

**Structure Decision**: 使用現有的 Web application 結構，新增 API endpoints 和擴展現有服務類別。

## Complexity Tracking

*No violations requiring justification.*
