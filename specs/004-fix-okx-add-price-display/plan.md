# Implementation Plan: 修正 OKX 資金費率與增強價格顯示

**Branch**: `004-fix-okx-add-price-display` | **Date**: 2025-01-21 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-fix-okx-add-price-display/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

修正 OKX 測試網資金費率數據準確性問題，並增強監控界面以顯示即時價格和綜合套利可行性評估。技術方案包括：(1) 使用 OKX 永續合約 API 與 CCXT 雙重驗證資金費率，(2) WebSocket 即時訂閱價格數據搭配 REST API 備援，(3) TimescaleDB 記錄驗證結果，(4) 可配置的手續費率參數進行套利評估。

## Technical Context

**Language/Version**: TypeScript 5.3+ with Node.js 20.x LTS
**Primary Dependencies**:
- Exchange APIs: binance-connector-node 3.x (Binance), okx-node-sdk 1.x (OKX), ccxt 4.x (備援驗證)
- Data: Prisma 5.x (ORM), TimescaleDB (via PostgreSQL 15)
- Real-time: ws 8.x (WebSocket)
- CLI: Commander.js (已整合), chalk, cli-table3, log-update
- Logging: Pino (結構化日誌)
- Validation: Zod (資料驗證)

**Storage**: PostgreSQL 15 + TimescaleDB extension (已配置於 Docker Compose)
**Testing**: Vitest (單元測試 + 整合測試)
**Target Platform**: Linux/macOS server, Docker containerized
**Project Type**: Single project (CLI-based monitoring and trading platform)
**Performance Goals**:
- 價格數據更新延遲 <5 秒 (WebSocket 目標 <1 秒)
- 監控界面刷新 <2 秒顯示所有交易對
- API 呼叫重試機制處理 95% 以上錯誤情況

**Constraints**:
- WebSocket 重連必須在 30 秒內完成
- 資金費率驗證差異必須 <0.0001%
- 極端價差 (>5%) 必須發出警報
- 價格延遲 >10 秒必須顯示警告

**Scale/Scope**:
- 監控 2 個交易所 (Binance, OKX)
- 支援多個交易對同時監控
- 測試網 + 正式網雙環境支援
- TimescaleDB 時序資料長期儲存

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: Trading Safety First (NON-NEGOTIABLE)

| Requirement | Status | Notes |
|-------------|--------|-------|
| Transaction compensation (Saga pattern) | ⚠️ DEFERRED | 此功能不執行交易，僅監控和驗證數據 |
| Dual-exchange atomic operations | ⚠️ DEFERRED | 此功能不執行交易 |
| Balance validation before orders | ⚠️ DEFERRED | 此功能不執行交易 |
| Position state persistence | ⚠️ DEFERRED | 此功能不涉及持倉管理 |
| No trade execution without confirmation | ⚠️ DEFERRED | 此功能不執行交易 |

**Assessment**: ✅ PASS - 此功能專注於監控和數據驗證，不涉及實際交易執行，因此交易安全要求暫不適用。

### Principle II: Complete Observability (NON-NEGOTIABLE)

| Requirement | Status | Notes |
|-------------|--------|-------|
| Structured logging for critical operations | ✅ COMPLIANT | 使用 Pino 記錄 API 呼叫、驗證結果、錯誤 |
| Error logs include context | ✅ COMPLIANT | 包含交易所、交易對、時間戳、錯誤類型 |
| Full traceability | ✅ COMPLIANT | TimescaleDB 記錄完整驗證歷程 |
| Performance metrics captured | ✅ COMPLIANT | 記錄 API 延遲、更新頻率、WebSocket 狀態 |
| No console.log in production | ✅ COMPLIANT | 使用 Pino 結構化日誌 |

**Assessment**: ✅ PASS - 完全符合可觀測性要求。

### Principle III: Defensive Programming

| Requirement | Status | Notes |
|-------------|--------|-------|
| API retry logic with exponential backoff | ✅ COMPLIANT | 所有 API 呼叫實作重試機制 |
| Graceful handling of network errors | ✅ COMPLIANT | 顯示錯誤訊息，每 10 秒重試（最多 3 次） |
| WebSocket auto-reconnection | ✅ COMPLIANT | 30 秒內重連，期間切換至 REST API 輪詢 |
| Data validation with Zod | ✅ COMPLIANT | 驗證 API 回應資料結構 |
| Graceful degradation | ✅ COMPLIANT | 單一交易所失敗時繼續監控另一個 |

**Assessment**: ✅ PASS - 完全符合防禦性程式設計要求。

### Principle IV: Data Integrity

| Requirement | Status | Notes |
|-------------|--------|-------|
| Prisma migrations for schema changes | ✅ COMPLIANT | 使用 Prisma 管理資料庫 schema |
| TimescaleDB for time-series data | ✅ COMPLIANT | 資金費率驗證記錄使用 TimescaleDB |
| Immutable funding rate records | ✅ COMPLIANT | 驗證記錄為 append-only |
| Position state transitions | ⚠️ DEFERRED | 此功能不涉及持倉管理 |
| Decimal type for financial calculations | ✅ COMPLIANT | 使用 Prisma Decimal 類型處理費率和價格 |

**Assessment**: ✅ PASS - 符合資料完整性要求（持倉相關需求不適用）。

### Principle V: Incremental Delivery

| Requirement | Status | Notes |
|-------------|--------|-------|
| MVP scope prioritization | ✅ COMPLIANT | 此功能為 User Story 1 的延伸（監控功能增強） |
| Independent testability | ✅ COMPLIANT | 每個 User Story 可獨立測試 |
| Testnet before mainnet | ✅ COMPLIANT | 支援測試網/正式網切換，先在測試網驗證 |
| E2E testing required | ✅ COMPLIANT | 規劃整合測試和端對端測試 |

**Assessment**: ✅ PASS - 符合漸進式交付要求。

### Overall Gate Result

**Status**: ✅ PASS - 所有適用的憲法原則均已滿足

**Justification for Deferred Requirements**:
此功能專注於資金費率驗證和價格監控顯示，不涉及實際交易執行和持倉管理，因此 Principle I 的交易安全要求和部分 Principle IV 的持倉要求標記為 DEFERRED。這些要求將在後續實作 User Story 3-5（交易執行功能）時重新評估。

---

## Re-evaluation After Phase 1 Design

**Date**: 2025-01-21
**Status**: ✅ PASS - All constitution principles remain satisfied after detailed design

### Design Compliance Verification

經過 Phase 0 (Research) 和 Phase 1 (Design) 後，重新驗證所有設計決策符合憲法原則：

#### Principle II: Complete Observability

**新增驗證點**:
- ✅ TimescaleDB 記錄結構 (`funding_rate_validations` table) 包含完整上下文欄位
  - `timestamp`, `symbol`, `exchange`, `errorMessage` 等
- ✅ 資料保留政策：90 天（符合審計需求）
- ✅ 壓縮政策：7 天前自動壓縮（效能優化）
- ✅ 索引設計：支援快速查詢驗證失敗記錄
- ✅ Pino 結構化日誌已規劃於所有服務（`IPriceMonitor`, `IFundingRateValidator`）

**Assessment**: ✅ PASS - 設計完全符合可觀測性要求

#### Principle III: Defensive Programming

**新增驗證點**:
- ✅ WebSocket 重連策略：指數退避 (1s → 30s)，最多 10 次嘗試
- ✅ REST API 備援機制：WebSocket 失敗自動切換，每 30 秒嘗試恢復
- ✅ 健康檢查機制：60 秒無訊息觸發重連
- ✅ Zod schema 驗證已規劃於 `service-interfaces.ts`
- ✅ 錯誤類型定義：`APIError`, `WebSocketError`, `ValidationError`
- ✅ 優雅降級：單一交易所失敗繼續監控另一個

**Assessment**: ✅ PASS - 設計完全符合防禦性程式設計要求

#### Principle IV: Data Integrity

**新增驗證點**:
- ✅ Prisma Schema 定義使用 `Decimal(18,8)` 類型處理資金費率
- ✅ PriceData 模型使用 `number` 類型（JavaScript 原生），搭配 Zod 驗證確保精度
- ✅ 驗證記錄設計為 append-only（immutable）
- ✅ TimescaleDB hypertable 確保時序資料效能
- ✅ 複合主鍵 `(timestamp, symbol)` 防止重複記錄

**Assessment**: ✅ PASS - 設計完全符合資料完整性要求

#### Principle V: Incremental Delivery

**新增驗證點**:
- ✅ Phase 0 (Research) 完成：所有技術決策已記錄
- ✅ Phase 1 (Design) 完成：資料模型、服務契約、快速上手指南已建立
- ✅ 獨立可測試：
  - 單元測試契約已定義（`IPriceMonitor`, `IArbitrageAssessor`）
  - 整合測試場景已規劃（OKX 資金費率驗證）
  - E2E 測試計畫已建立（完整監控流程）
- ✅ 測試網優先：quickstart.md 強調測試網配置和驗證

**Assessment**: ✅ PASS - 設計完全符合漸進式交付要求

### Overall Re-evaluation Result

**Status**: ✅ PASS - 所有憲法原則在詳細設計後仍保持合規

**無新增違規項目**

**設計品質指標**:
- 服務介面完整度：5/5（所有核心服務已定義契約）
- 資料模型完整度：3/3（`FundingRateValidation`, `PriceData`, `ArbitrageAssessment`）
- 測試覆蓋計畫：完整（單元/整合/E2E）
- 文件完整度：100%（spec, research, data-model, contracts, quickstart）

**風險評估**:
- **低風險**: 技術選型成熟且已有現有基礎（WebSocket 庫、Prisma、TimescaleDB）
- **低風險**: 無需修改核心交易邏輯（僅監控功能）
- **中風險**: WebSocket 穩定性依賴第三方服務（已透過 REST 備援降低）

**建議下一步**: 進入 Phase 2 (Tasks) - 執行 `/speckit.tasks` 生成任務分解清單

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
├── models/
│   ├── FundingRate.ts           # 現有：資金費率資料模型
│   ├── PriceData.ts              # 新增：價格資料模型
│   └── FundingRateValidation.ts # 新增：驗證記錄模型
├── services/
│   ├── monitor/
│   │   ├── FundingRateMonitor.ts     # 現有：資金費率監控
│   │   ├── PriceMonitor.ts           # 新增：價格監控服務
│   │   ├── ArbitrageAssessor.ts      # 新增：套利評估服務
│   │   └── MonitorStats.ts           # 現有：統計追蹤
│   ├── validation/
│   │   └── FundingRateValidator.ts   # 新增：資金費率驗證服務
│   └── websocket/
│       ├── BinanceWsClient.ts        # 新增：Binance WebSocket 客戶端
│       └── OkxWsClient.ts            # 新增：OKX WebSocket 客戶端
├── connectors/
│   ├── BinanceConnector.ts      # 現有：Binance API 連接器（增強 REST 備援）
│   └── OkxConnector.ts          # 現有：OKX API 連接器（增強 REST 備援）
├── cli/
│   └── index.ts                 # 現有：CLI 主程式（增強顯示邏輯）
└── lib/
    ├── formatters/
    │   └── MonitorOutputFormatter.ts # 現有：輸出格式化（增強價格顯示）
    └── utils/
        ├── retry.ts             # 現有：重試機制
        └── logger.ts            # 現有：Pino 日誌配置

tests/
├── unit/
│   ├── services/
│   │   ├── PriceMonitor.test.ts
│   │   ├── ArbitrageAssessor.test.ts
│   │   └── FundingRateValidator.test.ts
│   ├── models/
│   │   └── PriceData.test.ts
│   └── websocket/
│       ├── BinanceWsClient.test.ts
│       └── OkxWsClient.test.ts
├── integration/
│   ├── okx-funding-rate-validation.test.ts
│   ├── websocket-price-feed.test.ts
│   └── arbitrage-assessment.test.ts
└── e2e/
    └── monitor-with-prices.test.ts
```

**Structure Decision**:
採用單一專案結構（Option 1），因為這是 CLI-based 監控平台。主要變更：
1. **新增模型**: `PriceData`, `FundingRateValidation`
2. **新增服務**: `PriceMonitor`, `ArbitrageAssessor`, `FundingRateValidator`
3. **新增 WebSocket 客戶端**: 支援 Binance 和 OKX 即時價格訂閱
4. **增強現有元件**: `MonitorOutputFormatter` 增加價格和套利可行性顯示
5. **測試覆蓋**: 單元測試、整合測試、E2E 測試完整覆蓋新功能

## Complexity Tracking

*No constitution violations - this section is not applicable.*

Constitution Check 結果為 ✅ PASS，所有適用原則均已滿足，無需記錄複雜度違規。

