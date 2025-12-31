# Implementation Plan: Native WebSocket Clients

**Branch**: `054-native-websocket-clients` | **Date**: 2025-12-31 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/054-native-websocket-clients/spec.md`

## Summary

實作 OKX、Gate.io、BingX 原生 WebSocket 客戶端，繞過 CCXT 的限制，支援即時訂閱資金費率、標記價格和訂單狀態。遵循現有 BinanceFundingWs 模式，整合到 PriceMonitor 和 DataSourceManager 架構中。

## Technical Context

**Language/Version**: TypeScript 5.6 + Node.js 20.x LTS
**Primary Dependencies**: ws 8.x (WebSocket), Decimal.js (精度計算), Zod (訊息驗證), Pino (日誌)
**Storage**: PostgreSQL 15 + TimescaleDB (現有 ApiKey 模型)
**Testing**: Vitest 2.1.2
**Target Platform**: Node.js 服務端
**Project Type**: single
**Performance Goals**: 資金費率更新延遲 < 500ms, 支援 100+ 交易對同時監控
**Constraints**: 單一連線訂閱數限制 (OKX: 100, Gate.io: 20, BingX: 50)
**Scale/Scope**: 3 個交易所, 每交易所獨立 WebSocket 客戶端

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Trading Safety First | ✅ PASS | 此功能僅訂閱數據，不執行交易 |
| II. Complete Observability | ✅ PASS | FR-013/FR-015 要求結構化日誌和完整指標 |
| III. Defensive Programming | ✅ PASS | FR-007/FR-008/FR-009 要求重連、健康檢查、REST 備援 |
| IV. Data Integrity | ✅ PASS | FR-004/FR-005 要求標準化格式，使用 Decimal.js |
| V. Incremental Delivery | ✅ PASS | P1 (資金費率+價格) 可獨立交付，P2 (訂單狀態) 後續整合 |
| VI. System Architecture | ✅ PASS | WebSocket 客戶端位於 CLI 層，數據寫入 RatesCache/DB |
| VII. TDD Discipline | ✅ PASS | 測試先行，訊息解析需單元測試覆蓋 |

## Project Structure

### Documentation (this feature)

```
specs/054-native-websocket-clients/
├── plan.md              # 本文件
├── research.md          # Phase 0 研究輸出
├── data-model.md        # Phase 1 數據模型
├── quickstart.md        # Phase 1 快速入門
├── contracts/           # Phase 1 API 契約
│   └── websocket.md     # WebSocket 訊息格式規格
└── tasks.md             # Phase 2 任務清單
```

### Source Code (repository root)

```
src/
├── services/
│   └── websocket/
│       ├── BinanceFundingWs.ts      # 現有 (參考模式)
│       ├── OkxFundingWs.ts          # 新增: OKX WebSocket 客戶端
│       ├── GateioFundingWs.ts       # 新增: Gate.io WebSocket 客戶端
│       ├── BingxFundingWs.ts        # 新增: BingX WebSocket 客戶端
│       └── ConnectionPool.ts        # 新增: 多連線管理器
├── lib/
│   ├── schemas/
│   │   └── websocket-messages.ts    # 修改: 新增 OKX/Gateio/BingX schema
│   └── websocket/
│       ├── ReconnectionManager.ts   # 現有 (複用)
│       └── HealthChecker.ts         # 現有 (複用)
├── types/
│   └── websocket-events.ts          # 修改: 新增交易所事件類型

tests/
├── unit/
│   └── services/
│       ├── OkxFundingWs.test.ts     # 新增
│       ├── GateioFundingWs.test.ts  # 新增
│       └── BingxFundingWs.test.ts   # 新增
└── integration/
    └── websocket/
        └── multi-exchange-ws.test.ts # 新增: 多交易所整合測試
```

**Structure Decision**: 沿用現有單一專案結構，WebSocket 客戶端放置於 `src/services/websocket/`，與現有 BinanceFundingWs 平行。新增 ConnectionPool 管理多連線場景。

## Complexity Tracking

*無憲法違規，無需額外複雜度說明*
