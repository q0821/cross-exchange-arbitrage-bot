# Implementation Plan: 修復開倉停損停利條件單設定

**Branch**: `040-fix-conditional-orders` | **Date**: 2025-12-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/040-fix-conditional-orders/spec.md`

## Summary

修復 Binance、OKX、Gate.io 三個交易所在開倉時設定停損停利條件單失敗的問題。主要修復：
1. OKX 帳戶模式動態偵測（long_short_mode / net_mode）
2. Gate.io 合約數量轉換（使用四捨五入取代 parseInt 截斷）
3. 增強所有適配器的偵錯日誌

## Technical Context

**Language/Version**: TypeScript 5.6 + Node.js 20.x LTS
**Primary Dependencies**: CCXT 4.x（多交易所抽象）, Prisma 5.x（ORM）, Pino（日誌）, Vitest（測試）
**Storage**: PostgreSQL 15 + TimescaleDB（現有 Position 模型已有條件單欄位）
**Testing**: Vitest + Mock CCXT Exchange
**Target Platform**: Linux server (Docker)
**Project Type**: Single project (CLI + Web)
**Performance Goals**: 條件單設定延遲 < 2 秒
**Constraints**: 交易所 API 速率限制
**Scale/Scope**: 支援 3 個交易所（Binance, OKX, Gate.io）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Trading Safety First | ✅ Pass | 修復確保條件單正確設定，保護倉位 |
| II. Complete Observability | ✅ Pass | 增強日誌記錄是本次修復重點 |
| III. Defensive Programming | ✅ Pass | API 錯誤時使用預設值並記錄警告 |
| IV. Data Integrity | ✅ Pass | 使用 Decimal 處理數量，避免精度問題 |
| V. Incremental Delivery | ✅ Pass | 可按交易所逐一修復並驗證 |
| VI. System Architecture Boundaries | ✅ Pass | 修改僅限 CLI 服務層 |
| VII. TDD Discipline | ✅ Required | **必須嚴格遵守 Red-Green-Refactor** |

## Project Structure

### Documentation (this feature)

```
specs/040-fix-conditional-orders/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (existing models)
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```
src/
├── services/
│   └── trading/
│       ├── ConditionalOrderAdapterFactory.ts  # 🔧 修改：新增 OKX 偵測
│       ├── ConditionalOrderService.ts         # 🔧 修改：加入價格驗證
│       └── adapters/
│           ├── ConditionalOrderAdapter.ts     # 介面定義
│           ├── BinanceConditionalOrderAdapter.ts  # 🔧 修改：增強日誌
│           ├── OkxConditionalOrderAdapter.ts      # 🔧 修改：增強日誌
│           └── GateioConditionalOrderAdapter.ts   # 🔧 修改：修復整數轉換
└── lib/
    └── conditional-order-calculator.ts  # 現有價格計算工具

tests/
└── unit/
    └── services/
        ├── ConditionalOrderAdapterFactory.test.ts  # 🆕 新增
        ├── GateioConditionalOrderAdapter.test.ts   # 🆕 新增
        └── ConditionalOrderService.test.ts         # 🆕 新增（或擴充）
```

**Structure Decision**: 使用現有單一專案結構，修改集中在 `src/services/trading/` 目錄。

## TDD Implementation Strategy

根據 Constitution Principle VII，本次實作必須嚴格遵守 TDD 流程：

### Cycle 1: OKX 帳戶模式偵測
1. 🔴 **Red**: 撰寫 `detectOkxPositionMode()` 測試（3 個案例）
2. 🟢 **Green**: 實作偵測邏輯
3. 🔵 **Refactor**: 增強日誌

### Cycle 2: Gate.io 整數轉換
1. 🔴 **Red**: 撰寫合約數量轉換測試（5 個案例）
2. 🟢 **Green**: 使用 `Math.round()` + `Math.max(1, ...)` 修復
3. 🔵 **Refactor**: 增強日誌

### Cycle 3: 價格驗證警告
1. 🔴 **Red**: 撰寫價格驗證測試
2. 🟢 **Green**: 加入驗證邏輯
3. 🔵 **Refactor**: 優化警告訊息

## Complexity Tracking

*無違反 Constitution 的情況*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | N/A | N/A |
