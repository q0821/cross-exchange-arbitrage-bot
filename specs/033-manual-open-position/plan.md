# Implementation Plan: 手動開倉功能

**Branch**: `033-manual-open-position` | **Date**: 2025-12-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/033-manual-open-position/spec.md`

## Summary

實現手動開倉功能，讓用戶能夠從套利機會或市場監控頁面，透過一鍵開倉在兩個交易所同時建立對沖倉位（Long + Short）。功能包含：開倉確認對話框、餘額即時驗證、雙邊開倉協調（Saga Pattern）、失敗回滾機制、並發控制（Redis 分散式鎖）、審計日誌記錄。

## Technical Context

**Language/Version**: TypeScript 5.6 + Node.js 20.x LTS
**Primary Dependencies**:
- Next.js 14 App Router（Web 框架）
- Prisma 5.x（ORM）
- CCXT 4.x（多交易所抽象庫）
- @binance/connector 3.x（Binance SDK）
- Redis 7+（分散式鎖）
- Socket.io 4.8.1（WebSocket）
- Decimal.js（精確計算）
- Zod（輸入驗證）

**Storage**: PostgreSQL 15 + TimescaleDB（現有 HedgePosition、TradeRecord 模型）
**Testing**: Vitest + Testing Library
**Target Platform**: Web（Next.js Server Actions + REST API）
**Project Type**: Web 應用（前後端整合）
**Performance Goals**: 開倉完成時間 < 30 秒（含雙邊執行）
**Constraints**:
- 必須使用市價單確保成交
- 回滾嘗試最多 3 次
- 餘額緩衝 10%
**Scale/Scope**: 單用戶同時最多 1 個開倉操作（同交易對）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: Trading Safety First ✅

| 要求 | 實現方式 |
|------|----------|
| 交易執行必須實現 Saga Pattern | PositionOrchestrator 實現雙邊協調，失敗時自動回滾 |
| 雙邊操作必須原子化或有自動回滾 | 一邊成功一邊失敗時，最多重試 3 次回滾已成功的一邊 |
| 餘額驗證必須在下單前執行 | BalanceValidator 在開倉前檢查兩個交易所餘額 |
| 持倉狀態必須在執行前持久化 | Position 記錄在執行前創建（PENDING 狀態） |
| 無明確確認不執行交易 | 開倉對話框需要用戶明確點擊「確認開倉」 |

### Principle II: Complete Observability ✅

| 要求 | 實現方式 |
|------|----------|
| 關鍵操作必須記錄日誌 | 所有開倉、平倉、回滾操作記錄到 AuditLog |
| 錯誤日誌包含完整上下文 | 包含 exchange、symbol、orderId、errorType、stack |
| 交易生命週期可追蹤 | Position 狀態轉換完整記錄 |
| 使用 Pino 結構化日誌 | 已有基礎設施，複用現有 logger |

### Principle III: Defensive Programming ✅

| 要求 | 實現方式 |
|------|----------|
| API 調用有重試邏輯 | 使用現有連接器的重試機制 |
| 網路錯誤優雅處理 | 錯誤分類：可重試 vs 不可重試 |
| 無效數據驗證拒絕 | 使用 Zod schema 驗證所有輸入 |
| 系統降級服務 | 單交易所失敗不影響其他功能 |

### Principle IV: Data Integrity ✅

| 要求 | 實現方式 |
|------|----------|
| 使用 Prisma migrations | 不需要新的 schema 變更（使用現有模型） |
| 財務計算使用 Decimal | 使用 Decimal.js 計算保證金、手續費 |
| Position 記錄狀態轉換 | PENDING → OPENING → OPEN / FAILED |

### Principle V: Incremental Delivery ✅

| 要求 | 實現方式 |
|------|----------|
| 獨立可測試 | 每個 User Story 可獨立測試 |
| 測試環境驗證 | 支援 Testnet 模式 |

### Principle VI: System Architecture Boundaries ⚠️ 需注意

| 要求 | 實現方式 |
|------|----------|
| Web 負責用戶交互 | 開倉對話框、進度顯示在前端 |
| CLI 負責監控 | 資金費率監控維持在 CLI |
| Database 單一真相源 | Position 狀態儲存在 DB |
| API Keys 僅在後端 | 交易執行在 Server-side，不暴露給前端 |

**注意**: 此功能需要在 Web 端執行真實交易，這是 Principle VI 的邊界案例。但因為：
1. 交易執行在 Server Actions / API Routes（後端）
2. API Keys 從 DB 解密後直接使用，不傳到前端
3. 前端只做 UI 交互和狀態顯示

所以仍符合架構邊界原則。

## Project Structure

### Documentation (this feature)

```
specs/033-manual-open-position/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── openapi.yaml     # REST API 規格
│   └── websocket.md     # WebSocket 事件規格
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```
# 後端（API Routes + Services）
app/api/
├── positions/
│   ├── route.ts              # GET 持倉列表
│   └── open/
│       └── route.ts          # POST 開倉
├── balances/
│   └── route.ts              # GET 餘額查詢

src/
├── services/
│   └── trading/
│       ├── PositionOrchestrator.ts    # 開倉協調器（Saga）
│       ├── BalanceValidator.ts        # 餘額驗證
│       └── PositionLockService.ts     # 並發控制（Redis）
├── connectors/                        # 已存在，擴展使用
└── lib/
    └── redis.ts                       # Redis 客戶端

# 前端（React Components）
app/(dashboard)/
├── market-monitor/
│   └── components/
│       ├── OpenPositionButton.tsx     # 開倉按鈕
│       └── OpenPositionDialog.tsx     # 開倉對話框
└── positions/                         # 新頁面
    ├── page.tsx                       # 持倉列表頁
    └── components/
        └── PositionCard.tsx           # 持倉卡片

# 測試
tests/
├── unit/
│   └── services/
│       └── trading/
│           ├── PositionOrchestrator.test.ts
│           └── BalanceValidator.test.ts
└── integration/
    └── api/
        └── positions.test.ts
```

**Structure Decision**: 使用現有的 Next.js App Router 結構，新增 trading 服務層和 positions API 路由。前端組件放在對應的 dashboard 目錄下。

## Complexity Tracking

*No constitution violations requiring justification.*
