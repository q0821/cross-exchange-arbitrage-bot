# Implementation Plan: 交易歷史資金費率損益顯示

**Branch**: `041-funding-rate-pnl-display` | **Date**: 2025-12-24 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/041-funding-rate-pnl-display/spec.md`

## Summary

實作交易歷史中的資金費率損益顯示功能。目前 `PositionCloser.ts` 將 `fundingRatePnL` 硬編碼為 0，需要在平倉時從各交易所 API 查詢持倉期間的實際資金費率收支記錄，並將累計金額納入 Trade 記錄中。

**技術方案**：
1. 新建 `FundingFeeQueryService` 封裝各交易所資金費率歷史查詢
2. 修改 `PositionCloser` 在平倉時調用查詢服務獲取實際資金費率損益
3. 將查詢結果傳入現有的 `calculatePnL()` 函數

## Technical Context

**Language/Version**: TypeScript 5.6 + Node.js 20.x LTS
**Primary Dependencies**: CCXT 4.x（多交易所抽象）, Prisma 5.x（ORM）, Pino（日誌）, Vitest（測試）
**Storage**: PostgreSQL 15 + TimescaleDB（現有 Trade 模型已有 fundingRatePnL 欄位）
**Testing**: Vitest + TDD（Constitution Principle VII）
**Target Platform**: Linux/macOS server, Next.js 14 App Router
**Project Type**: Web application (CLI + Web)
**Performance Goals**: API 查詢失敗時平倉流程仍能在 5 秒內完成
**Constraints**: 各交易所 API Rate Limit，查詢失敗需降級處理
**Scale/Scope**: 單用戶，每筆平倉交易觸發一次查詢

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Trading Safety First | ✅ PASS | 資金費率查詢是唯讀操作，不影響交易執行；失敗時降級為 0，不阻斷平倉流程 |
| II. Complete Observability | ✅ PASS | 將記錄查詢結果和失敗日誌；使用 Pino 結構化日誌 |
| III. Defensive Programming | ✅ PASS | API 呼叫失敗時降級處理；查詢結果驗證 |
| IV. Data Integrity | ✅ PASS | 使用 Decimal 類型；資金費率記錄為唯讀查詢 |
| V. Incremental Delivery | ✅ PASS | 功能獨立，不影響現有平倉邏輯 |
| VI. System Architecture Boundaries | ✅ PASS | CLI/Web 職責分離已遵守；資金費率查詢在 CLI/Server 端執行 |
| VII. TDD Discipline | ✅ PASS | 將遵循 Red-Green-Refactor 流程 |

**Gate Result**: PASS - 無違規，可進入 Phase 0

## Project Structure

### Documentation (this feature)

```
specs/041-funding-rate-pnl-display/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (N/A - no new API)
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```
src/
├── services/
│   └── trading/
│       ├── PositionCloser.ts          # 修改：調用 FundingFeeQueryService
│       ├── FundingFeeQueryService.ts  # 新增：資金費率歷史查詢服務
│       └── adapters/
│           └── FundingFeeAdapter.ts   # 新增：各交易所適配器介面
├── lib/
│   └── pnl-calculator.ts              # 已有 fundingRatePnL 參數

app/
└── (dashboard)/
    └── trades/
        └── components/
            └── TradeCard.tsx          # 已有顯示欄位，無需修改

tests/
├── unit/
│   └── services/
│       └── FundingFeeQueryService.test.ts  # 新增
└── integration/
    └── funding-fee-query.test.ts          # 新增（可選）
```

**Structure Decision**: 使用現有 Web application 結構，在 `src/services/trading/` 新增資金費率查詢服務，遵循現有的適配器模式。

## Complexity Tracking

*No violations - table not needed*
