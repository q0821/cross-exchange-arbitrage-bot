# Implementation Plan: 一鍵平倉功能

**Branch**: `035-close-position` | **Date**: 2025-12-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/035-close-position/spec.md`

## Summary

實作一鍵平倉功能，讓用戶可以從持倉頁面同時關閉兩個交易所的對沖倉位。平倉完成後自動計算並記錄交易績效（價差損益、資金費率損益、總損益、ROI）。功能複用開倉功能的基礎架構（PositionOrchestrator、PositionLockService、AuditLogger），新增 PositionCloser 服務處理平倉邏輯。

## Technical Context

**Language/Version**: TypeScript 5.6 + Node.js 20.x LTS
**Primary Dependencies**: Next.js 14 App Router, Prisma 5.x, Socket.io 4.8.1, CCXT 4.x, Decimal.js
**Storage**: PostgreSQL 15 + TimescaleDB (現有 Position、Trade 模型)
**Testing**: Vitest (現有專案配置)
**Target Platform**: Web (Next.js 全棧應用)
**Project Type**: Web application (frontend + backend 整合在 Next.js)
**Performance Goals**: 平倉操作 10 秒內完成（雙邊並行執行）
**Constraints**: 分散式鎖防止並發、審計日誌 100% 記錄、PARTIAL 狀態正確識別
**Scale/Scope**: 單用戶單倉位操作，支援 4 個交易所 (Binance, OKX, MEXC, Gate.io)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Trading Safety First | ✅ PASS | 使用 Saga pattern (並行執行 + PARTIAL 狀態)、分散式鎖防重複、用戶確認機制 |
| II. Complete Observability | ✅ PASS | AuditLogger 記錄所有操作、Pino 結構化日誌、Trade 績效追蹤 |
| III. Defensive Programming | ✅ PASS | 市價單確保成交、PARTIAL 狀態處理失敗、分散式鎖處理網路中斷 |
| IV. Data Integrity | ✅ PASS | Prisma migrations、Position 狀態轉換 (OPEN→CLOSING→CLOSED)、Decimal 金額計算 |
| V. Incremental Delivery | ✅ PASS | 5 個 User Story 按優先級獨立可測試、P1 先完成核心平倉 |
| VI. System Architecture | ✅ PASS | Web 負責 UI 和交易執行、符合現有開倉功能架構 |

**Trading Safety Requirements**:
- ✅ 平倉前驗證倉位狀態 (FR-003)
- ✅ 狀態持久化後執行 (FR-004)
- ✅ 需用戶確認 (US4)
- ✅ PARTIAL 處理單邊失敗 (US2)

## Project Structure

### Documentation (this feature)

```
specs/035-close-position/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── openapi.yaml     # Close position API spec
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```
# Backend Services (新增/修改)
src/
├── types/
│   └── trading.ts              # 擴展：平倉相關類型
├── services/
│   └── trading/
│       ├── PositionCloser.ts   # 新增：平倉服務
│       ├── PositionOrchestrator.ts  # 現有
│       ├── PositionLockService.ts   # 現有
│       └── AuditLogger.ts      # 擴展：平倉審計
└── lib/
    └── pnl-calculator.ts       # 新增：損益計算工具

# API Routes (新增)
app/api/
├── positions/
│   ├── [id]/
│   │   └── close/
│   │       └── route.ts        # POST /api/positions/:id/close
│   └── route.ts                # 現有 GET /api/positions
└── trades/
    └── route.ts                # 新增 GET /api/trades

# Frontend Components (新增/修改)
app/(dashboard)/
├── positions/
│   ├── page.tsx                # 修改：整合平倉功能
│   ├── components/
│   │   ├── PositionCard.tsx    # 修改：連接平倉按鈕
│   │   ├── ClosePositionDialog.tsx  # 新增：平倉確認對話框
│   │   └── CloseProgressOverlay.tsx # 新增：平倉進度
│   └── hooks/
│       └── useClosePosition.ts # 新增：平倉狀態管理
└── trades/
    └── page.tsx                # 新增：交易歷史頁面

# WebSocket (擴展)
src/services/websocket/
└── PositionProgressEmitter.ts  # 擴展：平倉進度事件
```

**Structure Decision**: 遵循現有 Next.js 14 App Router 結構，複用開倉功能的架構模式，新增平倉相關服務和組件。

## Complexity Tracking

*無違反 Constitution 的情況*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | - | - |
