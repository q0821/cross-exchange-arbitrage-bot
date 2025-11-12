# Implementation Plan: 基於 Open Interest 的動態交易對選擇

**Branch**: `010-open-interest-selection` | **Date**: 2025-11-12 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/010-open-interest-selection/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

本功能將實作基於 Open Interest (OI) 的動態交易對選擇機制，允許系統自動從幣安獲取市場上最活躍的交易對（基於 OI 排名），取代目前手動維護 config/symbols.json 的方式。技術方案包括：(1) 擴展幣安連接器以支援 OI API 呼叫；(2) 在 CLI 監控服務中整合 OI 資料獲取和排序邏輯；(3) 實作快取機制 (15 分鐘 TTL) 避免過度 API 呼叫；(4) 在 Web 介面新增 OI 欄位顯示並整合穩定排序功能。

## Technical Context

**Language/Version**: TypeScript 5.6, Node.js 20.x LTS
**Primary Dependencies**:
- 現有：Prisma 5.x (ORM), ccxt 4.x (exchange API), ws 8.x (WebSocket), Pino (logging)
- CLI: Commander.js (現有，用於 CLI 參數解析)
- Web: React 18, Next.js 14 App Router (現有)
- 新增：無（使用現有依賴即可）

**Storage**:
- PostgreSQL 15+ with TimescaleDB (現有，用於持久化資料)
- In-memory cache (Map-based，用於 OI 資料快取，15 分鐘 TTL)

**Testing**:
- Unit tests: Vitest (現有)
- Integration tests: Vitest with mocked Binance API
- E2E tests: Playwright (Web 部分)

**Target Platform**:
- CLI: Node.js server (Linux/macOS)
- Web: Browser (Chrome, Firefox, Safari, Edge)

**Project Type**: Web (CLI backend + Web frontend)

**Performance Goals**:
- OI API 呼叫在 5 秒內完成（獲取 100+ 交易對的 OI 資料）
- CLI 啟動時間增加不超過 10 秒（包含 OI 資料獲取和排序）
- Web 介面 OI 排序在 500 毫秒內完成（符合 Feature 009 的排序效能標準）

**Constraints**:
- 必須符合幣安 Futures API 速率限制（2400 requests/min，每個 OI 請求 weight 1）
- 快取 TTL 固定為 15 分鐘（不可配置，避免複雜度）
- 只支援 USDT 永續合約（不支援 BUSD、交割合約）
- CLI `--auto-fetch` 模式不回退到靜態配置檔案（失敗即退出）

**Scale/Scope**:
- 支援獲取和監控 10-200 個交易對（預設 50，最大 200）
- Web 介面同時顯示最多 100 個交易對的 OI 資料
- 修改 3 個核心檔案（binance.ts, MonitorService.ts, CLI start command）
- Web 前端修改 2 個檔案（RatesTable.tsx, types.ts）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### ✅ Principle I: Trading Safety First
**Status**: N/A (不適用)
**Rationale**: 此功能不涉及交易執行、倉位管理或資金操作，只是資料獲取和顯示功能，不影響交易安全性。

### ✅ Principle II: Complete Observability
**Status**: PASS
**Rationale**:
- OI API 呼叫將使用 Pino 結構化日誌記錄（成功、失敗、延遲）
- 快取命中/未命中事件將被記錄
- CLI 啟動時顯示獲取到的交易對清單和 OI 數值（可觀察性）
- 錯誤處理包含詳細的錯誤訊息和 remediation hints

### ✅ Principle III: Defensive Programming
**Status**: PASS
**Rationale**:
- Binance OI API 呼叫將實作重試機制（exponential backoff）
- 處理 HTTP 429 (rate limit) 錯誤
- 處理網路錯誤和超時（graceful degradation）
- 使用 Zod schema 驗證 API 回應資料
- 快取機制處理 cache miss 情況（自動重新獲取）

### ✅ Principle IV: Data Integrity
**Status**: PASS
**Rationale**:
- OI 資料不需要持久化到資料庫（臨時性資料，快取於記憶體）
- 若未來需要持久化，將使用 Prisma migrations
- OI 數值使用 Decimal 或 Number（USD 金額，需要精度但不涉及財務計算）
- 資料來源明確標記（exchange: 'binance'）

### ✅ Principle V: Incremental Delivery
**Status**: PASS
**Rationale**:
- P1 (CLI 動態獲取) 是獨立可測試的 MVP
- P2 (Web 顯示) 在 P1 基礎上增強，可獨立部署
- P3 (快取優化) 是效能改進，非必要功能
- 每個 User Story 都有明確的 Independent Test 標準

### ✅ Principle VI: System Architecture Boundaries
**Status**: PASS
**Rationale**:
- **CLI Responsibilities**:
  - 從 Binance API 獲取 OI 資料 ✅
  - 根據 OI 排序和過濾交易對 ✅
  - （可選）將 OI 資料寫入 WebSocket 事件供 Web 消費 ✅
- **Web Responsibilities**:
  - 顯示 OI 欄位（來自 WebSocket 更新） ✅
  - 提供 OI 排序功能（基於 Feature 009 穩定排序） ✅
  - 不直接呼叫 Binance API ✅
- **Data Flow**:
  - CLI Monitor → (OI API) → CLI Memory Cache → WebSocket Event → Web UI ✅
  - 符合 CLI → (Database or WebSocket) → Web 的模式
  - API keys 只在 CLI 環境中使用 ✅

**結論**: 所有 Constitution Check 項目皆為 PASS 或 N/A，無違反原則，可以繼續進行 Phase 0 研究。

## Project Structure

### Documentation (this feature)

```
specs/010-open-interest-selection/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── websocket.md     # WebSocket event schema for OI updates
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
src/
├── connectors/
│   └── binance.ts                    # [MODIFY] 新增 getOpenInterest() 和 getTopSymbolsByOI() 方法
├── cli/
│   └── commands/
│       └── monitor/
│           └── start.ts              # [MODIFY] 擴展 --auto-fetch 參數，整合 OI 排序邏輯
├── services/
│   └── MonitorService.ts             # [MODIFY] 整合 OI 資料獲取到監控流程
├── lib/
│   ├── cache.ts                      # [NEW or MODIFY] 快取工具函式 (若現有則擴展)
│   └── retry.ts                      # [EXISTING] 重試邏輯 (已存在，用於 API 呼叫)
├── types/
│   └── open-interest.ts              # [NEW] OI 相關的 TypeScript 型別定義
└── models/
    └── (no changes needed)

app/(dashboard)/market-monitor/
├── types.ts                          # [MODIFY] 新增 SortField 支援 'openInterest'
├── components/
│   └── RatesTable.tsx                # [MODIFY] 新增 OI 欄位顯示和排序
├── hooks/
│   └── useMarketRates.ts             # [MODIFY] WebSocket 事件包含 OI 資料
└── utils/
    └── sortComparator.ts             # [MODIFY] 新增 OI 排序邏輯

tests/
├── unit/
│   ├── connectors/
│   │   └── binance-oi.test.ts        # [NEW] Binance OI API 單元測試
│   ├── lib/
│   │   └── cache.test.ts             # [NEW] 快取機制單元測試
│   └── market-monitor/
│       └── oi-sorting.test.ts        # [NEW] OI 排序邏輯測試
└── integration/
    └── oi-fetching.test.ts           # [NEW] OI 資料獲取整合測試
```

**Structure Decision**: 此專案為 Web application 架構（CLI backend + Web frontend），源碼分為 `src/` (CLI/backend) 和 `app/` (Next.js frontend)。此功能主要修改現有檔案，只新增少量型別定義和測試檔案。選擇此結構因為：
1. 沿用專案既有的目錄組織，降低學習成本
2. OI 功能橫跨 CLI 和 Web，需要同時修改兩邊
3. 快取和重試邏輯可重用現有的 `src/lib/` 工具函式

## Complexity Tracking

*No constitution violations - this section is not needed.*

所有 Constitution Check 項目皆為 PASS 或 N/A，無需額外複雜度追蹤。

