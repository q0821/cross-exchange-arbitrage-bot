# Implementation Plan: 修復餘額顯示不一致問題

**Branch**: `056-fix-balance-display` | **Date**: 2026-01-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/056-fix-balance-display/spec.md`

## Summary

修復兩個餘額顯示問題：
1. **開倉驗證**：Binance、OKX、BingX 改用「可用餘額」(availableBalanceUSD) 而非總餘額
2. **資產總覽**：Gate.io 納入持倉價值，計算「總權益」(totalEquityUSD) 與其他交易所一致

技術方案：擴展 AccountBalance 介面，新增 `availableBalanceUSD` 欄位，修改各交易所連接器分別獲取總權益和可用餘額。

## Technical Context

**Language/Version**: TypeScript 5.8 + Node.js 20.x LTS
**Primary Dependencies**: CCXT 4.x (交易所抽象), Prisma 7.x (ORM), Next.js 15 (Web)
**Storage**: PostgreSQL 15+ with TimescaleDB
**Testing**: Vitest 4.x
**Target Platform**: Linux server (CLI) + Web (Next.js)
**Project Type**: Web application (CLI monitor + Web dashboard)
**Performance Goals**: 餘額查詢 < 2 秒完成
**Constraints**: 各交易所 API 速率限制
**Scale/Scope**: 5 個交易所 (Binance, OKX, Gate.io, MEXC, BingX)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Trading Safety First | ✅ PASS | 餘額驗證改進有助於防止保證金不足的開倉失敗 |
| II. Complete Observability | ✅ PASS | 餘額查詢已有結構化日誌 |
| III. Defensive Programming | ✅ PASS | API 調用已有重試和錯誤處理 |
| IV. Data Integrity | ✅ PASS | 使用 Decimal 類型處理金額 |
| V. Incremental Delivery | ✅ PASS | 修改範圍明確，可獨立測試 |
| VI. System Architecture | ✅ PASS | 遵循 CLI → DB → Web 資料流 |
| VII. TDD Discipline | ✅ PASS | 將為每個連接器修改編寫測試 |

**Gate Result**: ✅ 所有原則通過

## Project Structure

### Documentation (this feature)

```
specs/056-fix-balance-display/
├── spec.md              # Feature specification
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
├── connectors/
│   └── types.ts                    # AccountBalance 介面修改
├── services/
│   ├── assets/
│   │   └── UserConnectorFactory.ts # 各交易所連接器修改
│   └── trading/
│       └── BalanceValidator.ts     # 餘額驗證邏輯修改
└── app/
    └── api/
        └── balances/
            └── route.ts            # API 返回 availableBalanceUSD

tests/
├── unit/
│   └── services/
│       ├── BinanceUserConnector.test.ts
│       ├── OkxUserConnector.test.ts
│       ├── GateioUserConnector.test.ts
│       └── BingxUserConnector.test.ts
└── integration/
    └── balance-display.test.ts
```

**Structure Decision**: 使用現有專案結構，主要修改 `UserConnectorFactory.ts` 中的各交易所連接器類別。

## Complexity Tracking

*No violations - no complexity justification needed*
