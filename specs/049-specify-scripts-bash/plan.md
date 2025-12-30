# Implementation Plan: 交易操作驗證腳本

**Branch**: `049-trading-validation-script` | **Date**: 2025-12-29 | **Spec**: [spec.md](./spec.md)
**Input**: 建立交易操作驗證腳本，透過 Web API 執行完整交易流程並驗證結果正確性

## Summary

建立 CLI 腳本，透過呼叫現有的 Web API（`/api/positions/open`、`/api/positions/[id]/close`）執行交易流程，並查詢交易所 API 驗證結果。支援兩種模式：
1. **自動測試模式**：執行開倉→停損停利→平倉完整流程
2. **查詢驗證模式**：驗證現有持倉的交易所狀態

## Technical Context

**Language/Version**: TypeScript 5.6 + Node.js 20.x LTS
**Primary Dependencies**: CCXT 4.x（查詢交易所）、axios（呼叫 Web API）、commander（CLI 參數解析）、Prisma 5.x（讀取用戶/持倉資料）
**Storage**: PostgreSQL 15 + TimescaleDB（現有 Position、ApiKey 模型）
**Testing**: Vitest（單元測試）
**Target Platform**: Linux/macOS CLI
**Project Type**: Single project（CLI 腳本）
**Performance Goals**: 完整驗證流程 < 60 秒
**Constraints**: 需要真實交易所 API Key、小額測試資金
**Scale/Scope**: 4 個交易所（Binance、OKX、Gate.io、BingX）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Trading Safety First | ✅ PASS | 透過現有 Web API 執行，繼承所有安全機制 |
| II. Complete Observability | ✅ PASS | 輸出結構化驗證報告，記錄所有步驟 |
| III. Defensive Programming | ✅ PASS | 處理 API 錯誤、超時、部分失敗 |
| IV. Data Integrity | ✅ PASS | 只讀取資料庫驗證，不直接修改 |
| V. Incremental Delivery | ✅ PASS | 可獨立執行單一交易所驗證 |
| VI. System Architecture | ✅ PASS | CLI 腳本透過 HTTP 呼叫 Web API |
| VII. TDD Discipline | ✅ PASS | 驗證邏輯可單元測試 |

## Project Structure

### Documentation (this feature)

```
specs/049-specify-scripts-bash/
├── spec.md              # 功能規格
├── plan.md              # 本文件
├── research.md          # Phase 0: 研究決策
├── data-model.md        # Phase 1: 資料模型
├── quickstart.md        # Phase 1: 快速入門
├── contracts/           # Phase 1: API 契約
│   └── validation-report.md
└── tasks.md             # Phase 2: 任務清單
```

### Source Code (repository root)

```
src/scripts/trading-validation/
├── TradingValidator.ts          # 核心驗證類別
├── ExchangeQueryService.ts      # 交易所查詢封裝
├── ValidationReporter.ts        # 報告生成器
├── validate-trading.ts          # CLI 入口點
└── types.ts                     # 類型定義

tests/unit/scripts/trading-validation/
├── TradingValidator.test.ts
├── ExchangeQueryService.test.ts
└── ValidationReporter.test.ts
```

**Structure Decision**: 單一腳本模組，放置於 `src/scripts/trading-validation/`，遵循現有腳本架構模式。

## Complexity Tracking

*No constitution violations - no justifications needed.*

---

## Phase 0 Output: research.md

詳見 [research.md](./research.md)

## Phase 1 Output: data-model.md, contracts/, quickstart.md

詳見各文件
