# Implementation Plan: 重構交易服務以符合單一職責原則

**Branch**: `062-refactor-trading-srp` | **Date**: 2026-01-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/062-refactor-trading-srp/spec.md`

## Summary

將 `PositionOrchestrator` 和 `PositionCloser` 中過長的 `createCcxtTraderAsync` 方法（400+ 行）重構為多個職責明確的小型服務。主要提取 5 個獨立服務：BinanceAccountDetector、CcxtExchangeFactory、ContractQuantityConverter、OrderPriceFetcher、OrderParamsBuilder。同時消除兩個檔案中重複的 `detectBinanceAccountType` 方法。

## Technical Context

**Language/Version**: TypeScript 5.8 + Node.js 20.x LTS
**Primary Dependencies**: CCXT 4.x (交易所抽象), Prisma 7.x (ORM), Next.js 15 (Web), Pino (logging)
**Storage**: PostgreSQL 15+ with TimescaleDB (無 schema 變更)
**Testing**: Vitest 4.x
**Target Platform**: Linux server (Web deployment)
**Project Type**: Web application (Next.js fullstack)
**Performance Goals**: 維持現有效能（重構不應降低效能）
**Constraints**: 重構不改變現有 API 行為；所有現有測試必須通過
**Scale/Scope**: 重構 2 個主要服務類別，提取 5 個新服務

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. Trading Safety First** | ✅ PASS | 重構不改變交易邏輯，Saga pattern 和回滾機制保持不變 |
| **II. Complete Observability** | ✅ PASS | 提取的服務保留現有 Pino 結構化日誌 |
| **III. Defensive Programming** | ✅ PASS | 重試邏輯、錯誤處理保持不變，只是移動到獨立服務 |
| **IV. Data Integrity** | ✅ PASS | 無 schema 變更，不需要 migration 檔案 |
| **V. Incremental Delivery** | ✅ PASS | 可分階段提取每個服務，逐步驗證 |
| **VI. System Architecture** | ✅ PASS | 重構僅影響 backend services，不改變 CLI/Web 邊界 |
| **VII. TDD Discipline** | ✅ PASS | 新提取的服務將遵循 TDD 流程撰寫測試 |

**Gate Result**: ✅ All principles satisfied. Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```
specs/062-refactor-trading-srp/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (N/A - no new entities)
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (internal interfaces)
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```
src/
├── services/
│   └── trading/
│       ├── PositionOrchestrator.ts     # 重構目標 (減少至 <50 行)
│       ├── PositionCloser.ts           # 重構目標 (減少至 <50 行)
│       ├── BinanceAccountDetector.ts   # 新增：Binance 帳戶偵測
│       ├── CcxtExchangeFactory.ts      # 新增：交易所實例工廠
│       ├── ContractQuantityConverter.ts # 新增：合約數量轉換
│       ├── OrderPriceFetcher.ts        # 新增：訂單價格獲取
│       └── OrderParamsBuilder.ts       # 新增：訂單參數建構
└── types/
    └── trading.ts                      # 擴展：新增服務介面定義

tests/
├── unit/
│   └── services/
│       └── trading/
│           ├── BinanceAccountDetector.test.ts
│           ├── CcxtExchangeFactory.test.ts
│           ├── ContractQuantityConverter.test.ts
│           ├── OrderPriceFetcher.test.ts
│           └── OrderParamsBuilder.test.ts
└── e2e/
    └── (現有測試保持不變)
```

**Structure Decision**: 新服務放置於 `src/services/trading/` 目錄下，與現有 PositionOrchestrator 和 PositionCloser 同級，便於引用和維護。

## Complexity Tracking

*No violations - this refactoring reduces complexity rather than adding it.*

## Refactoring Strategy

### Phase 1: 提取共用服務（低風險）

1. **BinanceAccountDetector** - 提取重複的 `detectBinanceAccountType` 方法
2. **ContractQuantityConverter** - 提取 `convertToContracts` 邏輯

### Phase 2: 提取工廠和建構器（中風險）

3. **CcxtExchangeFactory** - 提取 CCXT 實例創建邏輯
4. **OrderParamsBuilder** - 提取訂單參數建構邏輯

### Phase 3: 提取價格服務（中風險）

5. **OrderPriceFetcher** - 提取價格獲取和重試邏輯

### Phase 4: 整合與驗證

6. 更新 PositionOrchestrator 和 PositionCloser 使用新服務
7. 執行所有測試驗證行為不變

## Risk Mitigation

- **漸進式重構**：每個服務單獨提取、測試、合併
- **保持 API 相容**：PositionOrchestrator 和 PositionCloser 的公開 API 不變
- **E2E 驗證**：每階段完成後執行現有 E2E 測試
- **回滾策略**：使用 feature branch，問題時可快速回滾
