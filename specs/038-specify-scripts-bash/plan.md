# Implementation Plan: 開倉停損停利設定

**Branch**: `038-specify-scripts-bash` | **Date**: 2025-12-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/038-specify-scripts-bash/spec.md`

## Summary

實作開倉時同步設定停損停利條件單功能，防止單邊爆倉造成巨額虧損。系統在開倉成功後自動在交易所設定 STOP_MARKET 和 TAKE_PROFIT_MARKET 條件單，觸發價格基於開倉均價和用戶設定的百分比計算。

## Technical Context

**Language/Version**: TypeScript 5.6 + Node.js 20.x LTS
**Primary Dependencies**: Next.js 14 App Router, CCXT 4.x, Prisma 5.x, Socket.io 4.8.1
**Storage**: PostgreSQL 15 + TimescaleDB (現有 Position 模型擴展)
**Testing**: Jest + 手動整合測試
**Target Platform**: Web Application (Next.js)
**Project Type**: Web (monorepo: backend + frontend)
**Performance Goals**: 停損單設定 < 5 秒
**Constraints**: 依賴各交易所 API 可用性
**Scale/Scope**: 單用戶、多交易所

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: Trading Safety First ✅

- **Transaction Compensation**: 停損停利設定失敗不回滾開倉（開倉已成功執行）
- **Balance Validation**: 條件單不需要額外餘額
- **Position State**: 在 Position 記錄中保存停損停利設定

### Principle II: Complete Observability ✅

- **Structured Logging**: 使用 Pino 記錄所有條件單操作
- **Error Context**: 記錄交易所、訂單 ID、觸發價格、失敗原因

### Principle III: Defensive Programming ✅

- **Retry Logic**: 條件單設定失敗可重試
- **Graceful Degradation**: 單一交易所條件單失敗不影響另一邊
- **Zod Validation**: 驗證停損停利百分比範圍

### Principle IV: Data Integrity ✅

- **Prisma Migrations**: 使用遷移新增欄位
- **Decimal Type**: 停損停利價格使用 Decimal

### Principle V: Incremental Delivery ✅

- **MVP First**: 優先實作停損功能 (P1)
- **Independent Testing**: 每個用戶故事可獨立測試

### Principle VI: System Architecture Boundaries ✅

- **CLI Responsibilities**: N/A (本功能在 Web 執行)
- **Web Responsibilities**: 用戶設定 + 調用交易所 API + 顯示結果
- **Data Flow**: Web UI → API → Exchange → DB

## Project Structure

### Documentation (this feature)

```
specs/038-specify-scripts-bash/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── openapi.yaml
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```
src/
├── services/
│   └── trading/
│       ├── PositionOrchestrator.ts      # 修改: 整合停損停利設定
│       └── ConditionalOrderService.ts   # 新增: 條件單服務
├── lib/
│   └── conditional-order-calculator.ts  # 新增: 觸發價格計算
└── types/
    └── trading.ts                       # 修改: 新增條件單類型

app/
├── (dashboard)/
│   ├── market-monitor/
│   │   └── components/
│   │       └── OpenPositionDialog.tsx   # 修改: 新增停損停利輸入
│   ├── positions/
│   │   └── components/
│   │       └── PositionCard.tsx         # 修改: 顯示停損停利價位
│   └── settings/
│       └── trading/
│           └── page.tsx                 # 修改: 停損停利預設值設定
└── api/
    └── positions/
        └── open/
            └── route.ts                 # 修改: 處理停損停利參數

prisma/
└── schema.prisma                        # 修改: Position 新增條件單欄位
```

**Structure Decision**: 使用現有 Web 應用結構，在 `src/services/trading/` 新增條件單服務。

## Complexity Tracking

*No violations - using existing patterns*

---

## Phase 0: Research Summary

詳見 [research.md](./research.md)

### Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| 訂單類型 | STOP_MARKET / TAKE_PROFIT_MARKET | 市價單確保成交 |
| 觸發價格計算 | 百分比偏移 | 對用戶更直觀 |
| 設定時機 | 開倉成功後 | 需要實際成交價 |
| 失敗處理 | 警告但不回滾 | 開倉無法回滾 |

### Exchange-Specific Notes

| 交易所 | 特殊處理 |
|--------|----------|
| Binance | 偵測 Hedge/One-way Mode |
| OKX | 分開發送 TP/SL (Net Mode 限制) |
| Gate.io | 使用 price_orders API |
| MEXC | 與 Binance 類似 |

---

## Phase 1: Design Artifacts ✅

### Generated Artifacts

- [data-model.md](./data-model.md) - 資料模型設計
- [contracts/openapi.yaml](./contracts/openapi.yaml) - API 合約
- [quickstart.md](./quickstart.md) - 快速入門指南

---

## Next Steps

1. 執行 `/speckit.tasks` 生成任務清單
2. 執行 `/speckit.implement` 開始實作
