# Implementation Plan: 資金費率間隔動態獲取

**Branch**: `017-funding-rate-intervals` | **Date**: 2025-11-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/017-funding-rate-intervals/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

**Primary Requirement**: 修復各交易所資金費率間隔的動態獲取機制，取代硬編碼的 8 小時預設值，確保套利計算準確性。

**Technical Approach**:
- **Binance**: 呼叫 `/fapi/v1/fundingInfo` API 獲取 `fundingIntervalHours` 欄位（4h 或 8h）
- **OKX**: 計算 `nextFundingTime - fundingTime` 時間戳差值推算間隔（1h-8h 動態調整）
- **MEXC**: 測試 CCXT 是否暴露 `collectCycle` 欄位，否則改用原生 API
- **Gate.io**: 測試 CCXT 是否暴露 `funding_interval` 欄位（秒），轉換為小時
- **快取機制**: 實作 `FundingIntervalCache` 避免重複 API 呼叫（24 小時 TTL）
- **降級策略**: 無法獲取時使用交易所預設值（8h）並記錄警告

**Impact**: 解決 Binance 4 小時合約的費率標準化錯誤（100% 誤差），提升套利機會偵測準確性 >50%。

## Technical Context

**Language/Version**: TypeScript 5.6 + Node.js 20.x LTS
**Primary Dependencies**: CCXT 4.x (多交易所抽象), Binance Connector 3.x, OKX SDK 1.x
**Storage**: N/A（間隔資訊僅記憶體快取，不持久化至資料庫）
**Testing**: Vitest (單元測試), 整合測試（實際 API 呼叫驗證）
**Target Platform**: Linux server / macOS (CLI 監控服務)
**Project Type**: Single (CLI + 現有 Next.js Web UI，此功能主要修改 CLI connectors)
**Performance Goals**: 間隔獲取 API 呼叫 < 500ms，快取命中率 > 90%
**Constraints**: API 速率限制（Binance: 1200 req/min, OKX: 600 req/min），需避免過度呼叫
**Scale/Scope**: 4 個交易所，100 個監控交易對，每 5 分鐘更新一次費率

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: Trading Safety First

**Status**: ✅ **PASS** (Not Applicable)

**Rationale**: 此功能不涉及交易執行或部位管理，僅修復資金費率間隔的數據獲取邏輯。不觸發任何交易安全要求。

**Validation**: 無需交易補償機制、餘額驗證或部位狀態管理。

---

### Principle II: Complete Observability

**Status**: ⚠️ **MUST IMPLEMENT**

**Requirements**:
- ✅ 必須記錄每個交易對使用的間隔值及資料來源（API/計算/預設）
- ✅ 必須記錄 API 呼叫失敗並包含錯誤類型、交易所名稱、符號、時間戳
- ✅ 必須記錄降級至預設值的警告（含交易所和符號）
- ✅ 必須記錄快取命中/未命中統計以監控效能

**Implementation Checkpoints**:
- [ ] `getFundingInterval()` 記錄間隔來源：`[Binance] BLZUSDT: Using 4h interval (from /fapi/v1/fundingInfo API)`
- [ ] API 錯誤記錄：`[OKX] Failed to calculate interval for BTCUSDT: nextFundingTime missing in response`
- [ ] 降級警告：`[MEXC] Using default 8h interval for ETHUSDT (CCXT did not expose collectCycle field)`
- [ ] 快取統計：每小時記錄命中率

---

### Principle III: Defensive Programming

**Status**: ⚠️ **MUST IMPLEMENT**

**Requirements**:
- ✅ Binance `/fapi/v1/fundingInfo` API 呼叫必須有重試機制（exponential backoff）
- ✅ OKX 時間戳計算必須驗證 `nextFundingTime` 和 `fundingTime` 存在且合理（差值 > 0）
- ✅ MEXC/Gate.io 原生 API 呼叫必須處理網路錯誤和速率限制
- ✅ 當單一交易所的間隔獲取失敗時，必須降級至預設值，不影響其他交易所

**Implementation Checkpoints**:
- [ ] Binance API 呼叫使用 `p-retry` 或等效機制（最多 3 次重試）
- [ ] OKX 間隔計算包含驗證：`if (!fundingTime || !nextFundingTime || nextFundingTime <= fundingTime) throw new Error(...)`
- [ ] 錯誤處理使用 try-catch，失敗時返回預設值並記錄警告
- [ ] 整合測試驗證：當 Binance API 失敗時，OKX/MEXC/Gate.io 仍正常運作

---

### Principle IV: Data Integrity

**Status**: ✅ **PASS** (Not Applicable)

**Rationale**: 此功能不修改資料庫 schema，不涉及 Prisma migrations。間隔資訊僅儲存於記憶體快取中，不持久化至資料庫。

**Validation**: 無需資料庫遷移、無財務計算（僅元數據）、無不可變記錄要求。

---

### Principle V: Incremental Delivery

**Status**: ✅ **PASS**

**MVP Scope**: User Story 1 (P1) - Binance 4h/8h 間隔動態偵測

**Rationale**:
- MVP 可獨立測試：選擇 BLZUSDT (4h) 和 BTCUSDT (8h) 驗證間隔偵測準確性
- MVP 可獨立部署：僅修改 Binance connector，不影響其他交易所
- MVP 提供立即價值：修復最大交易所（Binance）的 100% 費率誤差問題

**Incremental Path**:
1. ✅ Phase 1 (P1): Binance 間隔獲取 → 立即修復 4h 合約標準化錯誤
2. ⏭️ Phase 2 (P2): OKX 計算機制 → 支援動態間隔變更
3. ⏭️ Phase 3 (P2): MEXC/Gate.io → 完整覆蓋所有交易所
4. ⏭️ Phase 4: 定期重新驗證快取（24h）→ 偵測交易所設定變更

---

### Principle VI: System Architecture Boundaries

**Status**: ✅ **PASS**

**CLI Responsibilities** (此功能修改範圍):
- ✅ 修改 `src/connectors/*.ts` 以動態獲取資金費率間隔
- ✅ 修改 `src/services/monitor/FundingRateMonitor.ts` 移除硬編碼預設值
- ✅ 新增 `src/lib/FundingIntervalCache.ts` 實作快取機制
- ✅ 記錄日誌至 CLI 輸出（使用 Pino）

**Web Responsibilities** (無需修改):
- ✅ 不修改 Web UI 或 API 端點
- ✅ Web 繼續從資料庫讀取現有的費率數據（已包含標準化後的費率）
- ✅ 無需新增 WebSocket 事件或 REST API 端點

**Data Flow** (符合 CLI → DB → Web 模式):
- ✅ CLI connectors 獲取原始費率和間隔 → FundingRateNormalizer 標準化 → 寫入資料庫
- ✅ Web 從資料庫讀取已標準化的費率（無需知道原始間隔）
- ✅ 間隔資訊僅存在於 CLI 記憶體快取，不暴露至 Web

**Validation**: 此功能完全符合架構邊界，無跨層耦合。

---

### Summary

**Overall Status**: ✅ **PASS WITH CONDITIONS**

**Required Actions Before Implementation**:
1. ✅ 實作完整的日誌記錄（Principle II）
2. ✅ 實作 API 重試和錯誤處理（Principle III）
3. ✅ 確保 MVP 範圍聚焦於 Binance（Principle V）

**No Constitution Violations**: 所有原則均符合或不適用，無需在 Complexity Tracking 表中記錄違規豁免。

## Project Structure

### Documentation (this feature)

```
specs/017-funding-rate-intervals/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── api-changes.md   # API 變更說明（此功能無 API 變更）
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
src/
├── connectors/                    # 🔧 MODIFIED - Exchange adapters
│   ├── binance.ts                # 修改: 新增 getFundingInterval() 方法
│   ├── okx.ts                    # 修改: 實作時間戳計算邏輯
│   ├── mexc.ts                   # 修改: 測試/實作 collectCycle 獲取
│   ├── gateio.ts                 # 修改: 測試/實作 funding_interval 獲取
│   └── types.ts                  # 修改: 確保 fundingInterval 欄位定義
├── services/
│   ├── monitor/
│   │   ├── FundingRateMonitor.ts # 修改: 移除硬編碼預設值 (line 369)
│   │   └── RatesCache.ts         # 無需修改（快取邏輯已存在）
│   └── validation/
│       └── FundingRateNormalizer.ts # 無需修改（標準化邏輯已存在）
├── lib/                           # 🆕 NEW - Utilities
│   └── FundingIntervalCache.ts   # 新增: 間隔資訊快取機制
└── types/
    └── service-interfaces.ts      # 無需修改（介面已定義）

tests/
├── unit/
│   ├── connectors/
│   │   ├── binance.test.ts       # 🆕 新增: 測試 Binance 間隔獲取
│   │   ├── okx.test.ts           # 🆕 新增: 測試 OKX 間隔計算
│   │   ├── mexc.test.ts          # 🆕 新增: 測試 MEXC 間隔獲取
│   │   └── gateio.test.ts        # 🆕 新增: 測試 Gate.io 間隔獲取
│   └── lib/
│       └── FundingIntervalCache.test.ts # 🆕 新增: 測試快取機制
└── integration/
    └── funding-intervals.test.ts  # 🆕 新增: 整合測試（實際 API 呼叫）
```

**Structure Decision**: 此功能採用 **Option 1: Single project** 結構，因為：
- 僅修改 CLI 監控服務（`src/connectors/`, `src/services/monitor/`）
- 不涉及 Web UI 變更（無需修改 `app/` 或 `frontend/`）
- 符合 Constitution Principle VI（CLI → DB → Web 資料流）

**Key Directories**:
- **`src/connectors/`**: 交易所連接器，負責呼叫各交易所 API 獲取資金費率和間隔
- **`src/lib/`**: 共用工具庫，新增 `FundingIntervalCache` 快取機制
- **`tests/unit/connectors/`**: 單元測試，驗證各交易所的間隔獲取邏輯
- **`tests/integration/`**: 整合測試，使用實際 API 驗證端到端流程

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

**No violations to track**: All Constitution principles pass or are not applicable to this feature. See Constitution Check section above for details.
