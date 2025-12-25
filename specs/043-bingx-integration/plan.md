# Implementation Plan: BingX 交易所整合

**Branch**: `043-bingx-integration` | **Date**: 2025-12-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/043-bingx-integration/spec.md`

## Summary

整合 BingX 永續合約交易所，包含監控用 API（.env 配置）和交易用 API（Web 界面管理）。需實作 connector、conditional order adapter，並整合到現有的資金費率監控和套利交易系統。BingX 支援 1h、4h、8h 多種資金費率結算週期。

## Technical Context

**Language/Version**: TypeScript 5.6+ with Node.js 20.x LTS
**Primary Dependencies**: CCXT 4.x（BingX connector）, Prisma 5.x（ORM）, Next.js 14（Web）, Socket.io 4.8.1（WebSocket）
**Storage**: PostgreSQL 15 + TimescaleDB（現有 ApiKey、Position、Trade 模型）
**Testing**: Vitest（單元/整合測試）, Playwright（E2E 測試）
**Target Platform**: Linux server（CLI 監控）, Web browser（交易介面）
**Project Type**: Web + CLI hybrid application
**Performance Goals**: 資金費率刷新 <5 秒, 開倉執行 <3 秒, 套利時間差 <1 秒
**Constraints**: 遵循現有 connector 介面（IExchangeConnector）, 複用 CCXT 抽象層
**Scale/Scope**: 支援 50+ BingX 永續合約交易對監控

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Trading Safety First | ✅ PASS | 複用現有 Saga pattern (PositionOrchestrator), 支援補償回滾 |
| II. Complete Observability | ✅ PASS | 使用 Pino structured logging, 整合現有審計日誌 (AuditLogger) |
| III. Defensive Programming | ✅ PASS | CCXT 已內建重試和錯誤處理, 新增 BingX-specific 錯誤映射 |
| IV. Data Integrity | ✅ PASS | 使用 Decimal.js 進行金融計算, Prisma migration 管理 schema |
| V. Incremental Delivery | ✅ PASS | 分階段實作: 監控 → 餘額 → 開倉 → 停損停利 → 平倉 → 收益 |
| VI. System Architecture Boundaries | ✅ PASS | CLI 處理監控/計算, Web 處理 UI/交易觸發, Database 為單一真相來源 |
| VII. TDD Discipline | ✅ PASS | 所有實作遵循 Red-Green-Refactor 流程 |

**Gate Status**: ✅ PASS - 所有原則符合，可進入 Phase 0

## Project Structure

### Documentation (this feature)

```
specs/043-bingx-integration/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── openapi.yaml     # REST API 規格
│   └── websocket.md     # WebSocket 事件規格
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```
src/
├── connectors/
│   ├── types.ts         # 更新: 新增 'bingx' 到 ExchangeName
│   ├── factory.ts       # 更新: 新增 BingX case
│   └── bingx.ts         # 新增: BingX connector 實作
├── services/
│   ├── trading/
│   │   ├── adapters/
│   │   │   └── BingxConditionalOrderAdapter.ts  # 新增
│   │   └── ConditionalOrderAdapterFactory.ts    # 更新
│   ├── apikey/
│   │   └── ApiKeyValidator.ts                   # 更新: 新增 BingX 驗證
│   └── fundingrate/
│       └── FundingRateMonitor.ts                # 更新: 新增 BingX 支援
├── lib/
│   └── config.ts        # 更新: 新增 BINGX_API_KEY, BINGX_API_SECRET
└── types/
    └── trading.ts       # 更新: SupportedExchange 新增 'bingx'

app/
├── api/
│   └── apikeys/
│       └── route.ts     # 更新: 支援 BingX 交易所
└── (dashboard)/
    └── settings/
        └── api-keys/    # 更新: UI 支援 BingX

tests/
├── unit/
│   └── connectors/
│       └── bingx.test.ts
└── integration/
    └── bingx-trading.test.ts

.env.example             # 更新: 新增 BINGX_API_KEY, BINGX_API_SECRET
```

**Structure Decision**: 遵循現有 Web + CLI hybrid 架構，新增檔案與現有 connector pattern 一致

## Complexity Tracking

*無違規項目需要說明*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | - | - |

---

## Phase Completion Status

### Phase 0: Research ✅ Complete

- [x] CCXT BingX 支援度調查
- [x] 停損停利實作方式研究
- [x] 資金費率結算週期分析
- [x] API Key 權限需求定義
- [x] 符號格式轉換規則
- [x] 錯誤處理與限流策略
- [x] 資料模型擴展評估

**產出**: [research.md](./research.md)

### Phase 1: Design ✅ Complete

- [x] 資料模型設計 (data-model.md)
- [x] REST API 規格 (contracts/openapi.yaml)
- [x] WebSocket 事件規格 (contracts/websocket.md)
- [x] 快速入門指南 (quickstart.md)
- [x] Agent context 更新

**Post-Phase 1 Constitution Re-check**: ✅ PASS

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Trading Safety First | ✅ PASS | 設計複用 PositionOrchestrator Saga pattern |
| II. Complete Observability | ✅ PASS | WebSocket 事件定義完整，支援進度追蹤 |
| III. Defensive Programming | ✅ PASS | 錯誤碼映射已定義 |
| IV. Data Integrity | ✅ PASS | 資料模型僅擴展現有類型，無結構性變更 |
| V. Incremental Delivery | ✅ PASS | API 規格支援漸進式整合 |
| VI. System Architecture Boundaries | ✅ PASS | 監控 (.env) 與交易 (DB) API 分離 |
| VII. TDD Discipline | ✅ PASS | 測試檔案結構已規劃 |

### Phase 2: Tasks (Pending)

執行 `/speckit.tasks` 生成任務清單。

---

## Implementation Summary

### 新增檔案

| 檔案 | 說明 | 預估行數 |
|------|------|---------|
| `src/connectors/bingx.ts` | BingX connector 實作 | ~500 |
| `src/services/trading/adapters/BingxConditionalOrderAdapter.ts` | 停損停利適配器 | ~150 |
| `tests/unit/connectors/bingx.test.ts` | 單元測試 | ~200 |
| `tests/integration/bingx-trading.test.ts` | 整合測試 | ~150 |

### 修改檔案

| 檔案 | 變更 |
|------|------|
| `src/connectors/types.ts` | 新增 `'bingx'` 到 ExchangeName |
| `src/connectors/factory.ts` | 新增 BingX case |
| `src/types/trading.ts` | 新增 `'bingx'` 到 SupportedExchange |
| `src/lib/config.ts` | 新增 BINGX_API_KEY, BINGX_API_SECRET |
| `src/services/trading/ConditionalOrderAdapterFactory.ts` | 新增 BingX adapter |
| `src/services/apikey/ApiKeyValidator.ts` | 新增 BingX 驗證邏輯 |
| `prisma/schema.prisma` | AssetSnapshot 新增 bingx 欄位 |
| `.env.example` | 新增 BingX 環境變數 |

### 預估工作量

- **Connector 實作**: 4 小時
- **條件單適配器**: 2 小時
- **類型擴展與整合**: 1 小時
- **測試撰寫**: 3 小時
- **文件更新**: 1 小時

**總計**: ~11 小時（約 1.5 天）
