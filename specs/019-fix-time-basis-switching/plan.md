# Implementation Plan: 修復時間基準切換功能

**Branch**: `019-fix-time-basis-switching` | **Date**: 2025-01-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/019-fix-time-basis-switching/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

修復 Web 應用中時間基準切換功能的三個關鍵錯誤：(1) WebSocket handler 不接受 4 小時時間基準，(2) REST API 缺少標準化費率資料，(3) 費率差計算使用原始費率而非標準化費率。技術方法：修改 WebSocket 驗證邏輯、擴展 API 回傳資料結構、重構費率差計算函數以支援時間基準參數。

## Technical Context

**Language/Version**: TypeScript 5.6 + Node.js 20.x LTS
**Primary Dependencies**: Socket.io 4.8.1 (WebSocket), Next.js 14 (Web framework), Prisma 5.x (ORM - 用於 REST API)
**Storage**: PostgreSQL 15 + TimescaleDB（現有資料庫，本次修復不涉及 schema 變更）
**Testing**: Jest（unit tests）, Playwright（E2E tests）
**Target Platform**: Web 應用（Node.js 後端 + React 前端）
**Project Type**: Web（前後端分離架構）
**Performance Goals**: WebSocket 事件處理 <100ms, REST API 回應時間 <500ms
**Constraints**:
- 向後相容：現有資料結構必須保持（不破壞已部署的監控服務）
- 零停機：修復不應中斷現有 WebSocket 連線
- 計算準確性：標準化費率誤差必須 <0.0001%

**Scale/Scope**:
- ~5 個檔案需要修改
- 影響 1 個 WebSocket handler, 1 個 REST API endpoint, 1 個計算函數
- 不涉及資料庫 migration

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### ✅ Principle I: Trading Safety First
**Status**: PASS (N/A for this feature)
**Rationale**: 此功能不涉及交易執行，僅修復資料顯示邏輯。不影響交易安全機制。

### ✅ Principle II: Complete Observability
**Status**: PASS
**Check**:
- WebSocket handler 已有結構化日誌（使用 logger.info/logger.error）
- 現有日誌包含所需上下文（socketId, userId, timeBasis）
- 費率差計算錯誤已在現有日誌中追蹤

**Action**: 確保修改後的計算函數保留所有現有日誌點。

### ✅ Principle III: Defensive Programming
**Status**: PASS
**Check**:
- WebSocket handler 已有輸入驗證（需要更新驗證邏輯以接受 4h）
- REST API 已有錯誤處理機制
- 前端已有 WebSocket 重連機制

**Action**: 在費率差計算函數中新增對缺失標準化資料的降級處理。

### ✅ Principle IV: Data Integrity
**Status**: PASS
**Check**:
- 不涉及資料庫 schema 變更
- 標準化費率計算使用現有 Decimal 型別
- FundingRateNormalizer 已確保計算精度

**Action**: 驗證費率差計算使用 Decimal 運算而非 JavaScript Number。

### ✅ Principle V: Incremental Delivery
**Status**: PASS
**Plan**:
- P1 User Story 1（4h 支援）可獨立部署和測試
- P2 User Story 2（REST API）可獨立部署和測試
- P1 User Story 3（費率差計算）依賴前兩者，但可單獨驗證邏輯

### ✅ Principle VI: System Architecture Boundaries
**Status**: PASS
**Check**:
- ✅ CLI 職責：FundingRateMonitor 已計算所有標準化費率並寫入 RatesCache
- ✅ Web 職責：REST API 和 WebSocket 從 RatesCache 讀取資料
- ✅ 資料流：CLI → RatesCache → WebSocket/REST API → 前端
- ✅ 單一資料源：RatesCache 作為記憶體快取層

**Compliance**: 所有修改都在 Web 層（WebSocket handler, REST API, 前端計算邏輯），不影響 CLI 監控服務。

## Project Structure

### Documentation (this feature)

```
specs/019-fix-time-basis-switching/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── websocket.md     # WebSocket 事件定義
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```
# Web application structure (現有專案結構)

# Backend (Next.js API + WebSocket)
src/
├── websocket/
│   └── handlers/
│       └── MarketRatesHandler.ts     # [MODIFY] 接受 4h 時間基準
├── models/
│   └── FundingRate.ts                # [MODIFY] 費率差計算使用標準化費率
├── services/
│   └── monitor/
│       └── RatesCache.ts             # [READ-ONLY] 資料來源
└── lib/
    └── validation/
        └── fundingRateSchemas.ts     # [READ-ONLY] TimeBasis 型別定義

app/
└── api/
    └── market-rates/
        └── route.ts                  # [MODIFY] REST API 回傳標準化資料

# Frontend (Next.js App Router)
app/
└── (dashboard)/
    └── market-monitor/
        ├── hooks/
        │   └── useMarketRates.ts     # [READ-ONLY] WebSocket 客戶端
        ├── components/
        │   ├── RateRow.tsx           # [READ-ONLY] 顯示標準化費率
        │   └── TimeBasisSelector.tsx # [READ-ONLY] 時間基準選擇器
        └── types.ts                  # [READ-ONLY] 前端型別定義

# Tests
tests/
├── unit/
│   └── services/
│       └── FundingRate.test.ts       # [ADD] 費率差計算測試
└── integration/
    └── websocket/
        └── MarketRatesHandler.test.ts # [ADD] WebSocket 4h 支援測試
```

**Structure Decision**: 專案使用 Next.js App Router 架構，前後端共存於同一個倉庫。修改主要集中在三個區域：
1. WebSocket handler（`src/websocket/handlers/`）
2. REST API（`app/api/`）
3. 費率計算模型（`src/models/`）

## Complexity Tracking

*無憲章違規，此部分留空*
