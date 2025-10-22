# Implementation Plan: 跨交易所資金費率套利平台

**Branch**: `001-funding-rate-arbitrage` | **Date**: 2025-10-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-funding-rate-arbitrage/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

建立一個自動化的跨交易所資金費率套利平台,監控幣安 (Binance) 和 OKX 兩個交易所之間 BTC、ETH、SOL 三種幣別的永續合約資金費率差異。當費率差異達到設定閾值時,自動執行雙邊對沖交易以獲取資金費率收益,同時透過風險管理機制確保交易安全。系統採用 TypeScript + Node.js 開發,使用官方 SDK 連接交易所 API,透過 WebSocket 實現即時數據監控,並使用 Prisma ORM 管理交易記錄和部位狀態。

## Technical Context

**Language/Version**: TypeScript 5.3+ + Node.js 20.x LTS
**Primary Dependencies**:
  - binance-connector-node 3.x (幣安官方 SDK) - 部分使用，主要使用直接 API 調用
  - ccxt 4.x (統一交易所介面，用於 OKX)
  - Prisma 5.x (ORM,資料庫管理) ✅
  - ws 8.x (WebSocket 連線管理) ✅
  - ✅ 通知系統:
    - chalk 5.x (終端機彩色輸出) - MVP 階段
    - pino (結構化日誌) - MVP 階段
    - Telegram Bot (Phase 4+, 選用功能)
    - Webhook (Phase 4+, 選用功能)
  - ✅ 日誌系統: pino (已選擇並實作)
  - ✅ 配置管理: dotenv + Zod schema validation (已實作)
  - ✅ 金融計算: decimal.js (確保精確度)

**Storage**:
  - ✅ PostgreSQL 15 + TimescaleDB extension (已實作)
    - 交易記錄、部位狀態、資金費率歷史
    - Hypertables: funding_rates, notification_logs
    - 90 天資料保留政策
  - ⏭️ Redis (選用功能，Phase 8+ 效能優化時考慮)
    - 快取即時費率、減少 API 呼叫

**Testing**:
  - ⏳ Jest (規劃中)
  - ⏳ 測試策略:
    - 單元測試: 模擬交易所 API 回應
    - 整合測試: 使用交易所 testnet 環境
    - E2E 測試: 完整交易流程驗證

**Target Platform**: Linux/macOS server (長時間運行的 Node.js 服務)

**Project Type**: single (單一後端服務,未來可能加上 Web 監控介面)

**Performance Goals**:
  - 資金費率更新延遲 < 5 秒
  - 雙邊開倉執行時間 < 10 秒
  - 單邊訂單失敗後的風險處理 < 3 秒
  - NEEDS CLARIFICATION: 並發處理能力 (同時監控多個幣別)

**Constraints**:
  - 必須遵守交易所 API 請求限制 (Rate Limits)
  - WebSocket 連線穩定性要求 99%+
  - 錯誤恢復機制 (自動重連、重試策略)
  - NEEDS CLARIFICATION: 資金費率數據精確度要求
  - NEEDS CLARIFICATION: 交易執行的原子性保證

**Scale/Scope**:
  - 初期支援 2 個交易所 (Binance, OKX)
  - 初期支援 3 個幣別 (BTC, ETH, SOL)
  - 預期並發部位數量 < 10
  - NEEDS CLARIFICATION: 歷史數據保留期限
  - NEEDS CLARIFICATION: 系統擴展性 (未來新增交易所/幣別的架構設計)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Status**: ✅ Constitution v1.0.0 ratified on 2025-10-19

**Core Principles Compliance**:

1. ✅ **Trading Safety First**: Plan includes Saga pattern for trade execution (T050), balance validation (T051), and rollback mechanisms (T054)
2. ✅ **Complete Observability**: Pino structured logging implemented (T014), all services designed with logging
3. ✅ **Defensive Programming**: Retry mechanism implemented (T018), WebSocket reconnection (T019), error handling (T016)
4. ✅ **Data Integrity**: Prisma schema defined (T009), TimescaleDB planned (T012), Decimal types for financial data
5. ✅ **Incremental Delivery**: MVP defined as US1+US2, testnet mode configured in .env

**Additional Compliance**:
- Trading Safety Requirements: Risk parameters model (T035), position limits in config
- Development Workflow: Directory structure follows constitution (`src/connectors/`, `src/services/`, `src/models/`)
- Quality Gates: TypeScript, ESLint, tests configured in package.json

**Non-Compliance Items**: None identified

**Recommendations**:
- Ensure all trade execution tasks (Phase 5+) follow Pre-Trade and Post-Trade validation checklists
- Add emergency CLI commands (manual override) in Phase 5
- Implement circuit breaker in monitoring service (Phase 3)

## Project Structure

### Documentation (this feature)

```
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
src/
├── exchanges/              # 交易所適配層
│   ├── binance/
│   │   ├── client.ts      # 幣安 API 客戶端封裝
│   │   ├── websocket.ts   # 幣安 WebSocket 管理
│   │   └── types.ts       # 幣安特定型別定義
│   ├── okx/
│   │   ├── client.ts      # OKX API 客戶端封裝
│   │   ├── websocket.ts   # OKX WebSocket 管理
│   │   └── types.ts       # OKX 特定型別定義
│   └── base/
│       └── exchange.interface.ts  # 統一交易所介面定義
│
├── services/              # 核心業務邏輯
│   ├── funding-rate-monitor.ts   # 資金費率監控服務
│   ├── arbitrage-detector.ts     # 套利機會偵測服務
│   ├── trade-executor.ts         # 交易執行服務
│   ├── position-manager.ts       # 部位管理服務
│   └── risk-manager.ts           # 風險管理服務
│
├── models/                # 資料模型 (Prisma 生成 + 業務模型)
│   ├── funding-rate.ts
│   ├── arbitrage-opportunity.ts
│   ├── hedge-position.ts
│   └── trade-record.ts
│
├── utils/                 # 工具函式
│   ├── logger.ts         # 日誌管理
│   ├── config.ts         # 配置管理
│   └── retry.ts          # 重試邏輯
│
├── cli/                  # CLI 介面 (手動控制)
│   ├── start.ts         # 啟動監控
│   ├── stop.ts          # 停止監控
│   └── status.ts        # 查看狀態
│
└── index.ts             # 主程式入口

tests/
├── unit/                # 單元測試
│   ├── services/
│   ├── exchanges/
│   └── utils/
├── integration/         # 整合測試 (模擬交易所 API)
│   ├── funding-rate-flow.test.ts
│   ├── arbitrage-flow.test.ts
│   └── trade-execution.test.ts
└── mocks/              # API 模擬資料
    ├── binance-mock.ts
    └── okx-mock.ts

prisma/
├── schema.prisma       # 資料庫 schema 定義
└── migrations/         # 資料庫遷移記錄
```

**Structure Decision**: 選擇 Single Project 架構,因為這是一個專注於後端套利邏輯的服務。採用分層架構:
1. **exchanges/** - 隔離不同交易所的 API 實作,便於未來擴展新交易所
2. **services/** - 核心業務邏輯,每個服務負責單一職責
3. **models/** - 使用 Prisma ORM 管理資料模型
4. **CLI** - 提供手動控制介面,方便調試和管理

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |

