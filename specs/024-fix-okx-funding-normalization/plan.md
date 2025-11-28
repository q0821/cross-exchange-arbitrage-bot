# Implementation Plan: 修正 OKX 資金費率標準化

**Branch**: `024-fix-okx-funding-normalization` | **Date**: 2025-01-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/024-fix-okx-funding-normalization/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

修正 OKX 交易所資金費率標準化計算錯誤。目前系統無法正確偵測 OKX 的資金費率結算週期（1h/4h/8h），導致在多個降級點誤用預設 8 小時值，使標準化計算錯誤（最多可能差 8 倍）。

**Technical Approach**:
1. 增強 `src/connectors/okx.ts` 中的 `getFundingInterval()` 方法，加入詳細日誌和驗證邏輯
2. 實作 Native OKX API (`/api/v5/public/funding-rate`) 作為 CCXT 失敗時的降級方案
3. 新增間隔合理性驗證層，確保計算值為標準值（1, 4, 8 小時）
4. 建立診斷工具 `scripts/test-okx-funding-interval.mjs` 用於對比 CCXT vs Native API
5. 完整的單元測試和整合測試覆蓋

## Technical Context

**Language/Version**: TypeScript 5.6 + Node.js 20.x LTS
**Primary Dependencies**: CCXT 4.x (多交易所抽象), axios (HTTP 請求), pino (結構化日誌)
**Storage**: N/A（間隔資訊僅記憶體快取，不持久化至資料庫）
**Testing**: Vitest (單元測試), Node.js test runner (整合測試)
**Target Platform**: Node.js CLI 服務（背景監控程式）
**Project Type**: Single project (backend CLI)
**Performance Goals**:
- 間隔偵測延遲 < 2 秒（包含 CCXT + Native API 降級）
- 快取命中後查詢延遲 < 1ms
- 診斷腳本完成 10 個交易對對比 < 30 秒
**Constraints**:
- OKX API 限流：公開端點 20 req/2s
- CCXT 可能無法暴露 info.fundingTime/nextFundingTime 欄位
- 必須保持與現有 IntervalCache 機制的相容性
**Scale/Scope**:
- 影響範圍：單一檔案 `src/connectors/okx.ts` (約 200 行)
- 新增診斷腳本 1 個
- 新增單元測試 10-15 個案例
- 新增整合測試 1 個（驗證 10+ 交易對）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### ✅ Principle I: Trading Safety First
**Status**: NOT APPLICABLE (低風險)
**Reasoning**: 此修復不直接執行交易，僅改善資金費率間隔偵測。錯誤的間隔會影響套利機會判斷，但不會導致未對沖的倉位或資金損失（因為交易前會再次驗證）。

### ✅ Principle II: Complete Observability
**Status**: ALIGNED
**How**:
- 新增詳細的結構化日誌（pino），記錄：偵測來源、原始時間戳、計算值、降級路徑
- 所有錯誤路徑都有對應的 warn/error 日誌
- 診斷工具提供可追溯的對比報告

### ✅ Principle III: Defensive Programming
**Status**: ALIGNED
**How**:
- 多層降級機制：CCXT → Native API → 預設值
- 時間戳驗證：檢查是否為有效的數值和合理範圍
- 間隔合理性驗證：確保值為標準值（1, 4, 8）
- 優雅降級：個別交易對失敗不影響整體監控
- 實作重試邏輯（針對網路暫時性錯誤）

### ✅ Principle IV: Data Integrity
**Status**: ALIGNED
**How**:
- IntervalCache 儲存偵測來源標記，確保資料可追溯性
- 快取值包含時間戳，支援未來的過期驗證
- 不修改資料庫 schema（間隔資訊不持久化）

### ✅ Principle V: Incremental Delivery
**Status**: ALIGNED
**How**:
- MVP (P1): US1 + US2（準確偵測 + 詳細日誌）可獨立測試和部署
- P2: US3 + US4（Native API 降級 + 驗證層）可漸進式加入
- P3: US5（診斷工具 + 測試）可最後完成
- 每個 User Story 都可獨立驗證功能

### ⚠️ Principle VI: System Architecture Boundaries
**Status**: ALIGNED
**How**:
- 修改範圍限於 CLI 監控服務（`src/connectors/okx.ts`）
- 不涉及 Web 前端或 API 變更
- 符合資料流模式：CLI 計算 → 記憶體快取 → 傳遞給 FundingRateMonitor

**Final Verdict**: ✅ 所有相關原則都符合要求，無違規事項

## Project Structure

### Documentation (this feature)

```
specs/024-fix-okx-funding-normalization/
├── spec.md              # Feature specification (已完成)
├── plan.md              # This file (當前)
├── research.md          # Phase 0 output (待生成)
├── data-model.md        # Phase 1 output (待生成)
├── quickstart.md        # Phase 1 output (待生成)
├── contracts/           # Phase 1 output (待生成)
│   ├── okx-api.md       # OKX Native API 規範
│   └── interval-cache.md # IntervalCache 介面規範
├── checklists/          # 品質檢查清單
│   └── requirements.md  # 規格品質驗證（已完成）
└── tasks.md             # Phase 2 output (由 /speckit.tasks 生成)
```

### Source Code (repository root)

```
src/
├── connectors/
│   └── okx.ts                    # 主要修改檔案（增強 getFundingInterval）
├── lib/
│   └── intervalCache.ts          # 現有快取機制（可能需要擴充）
└── services/
    └── monitor/
        └── FundingRateMonitor.ts # 使用間隔資訊（不修改）

tests/
├── unit/
│   └── connectors/
│       └── okx-interval-detection.test.ts  # 新增單元測試
└── integration/
    └── okx-funding-interval.test.ts        # 新增整合測試

scripts/
└── test-okx-funding-interval.mjs           # 新增診斷工具
```

**Structure Decision**: 採用 Single Project 結構。此修復僅涉及後端 CLI 監控服務，不涉及前端或多專案架構。主要修改集中在 `src/connectors/okx.ts`，新增測試和診斷工具於標準位置。

## Complexity Tracking

*本專案無需填寫此區塊，因為沒有違反 Constitution 原則的情況*

---

## Phase 0: Outline & Research ✅

**Status**: Complete
**Output**: `research.md`

**Research Tasks**:
1. **CCXT info 物件結構調查**：分析 CCXT 4.x 的 `fetchFundingRate()` 返回的 `info` 物件，確認 `fundingTime` 和 `nextFundingTime` 欄位的可靠性
2. **OKX Native API 規範**：研究 `/api/v5/public/funding-rate` 端點的請求/回應格式、限流政策、錯誤碼
3. **時間戳格式標準**：確認 OKX 使用的時間戳格式（毫秒 Unix timestamp vs ISO 8601）
4. **間隔驗證演算法**：研究最佳的四捨五入邏輯，決定容差範圍（例如 ±0.5 小時內算有效）
5. **重試策略最佳實踐**：研究 API 降級的重試機制（指數退避、最大重試次數）
6. **快取擴充需求**：評估現有 IntervalCache 是否需要擴充（如：支援偵測來源標記、過期時間）
7. **診斷工具設計**：研究類似工具的輸出格式（如：表格對比、差異高亮）

**Deliverable**: ✅ 詳細的研究文件，解決所有 "NEEDS CLARIFICATION" 項目

**Research Completed**:
- CCXT info 物件結構調查 - 確認 fundingTime/nextFundingTime 可靠
- OKX Native API 規範 - 完整的 API 文件和使用範例
- 時間戳格式標準 - 統一使用毫秒級 Unix 時間戳
- 間隔驗證演算法 - 四捨五入 + ±0.5h 容差
- 重試策略最佳實踐 - 指數退避，最多 3 次重試
- 快取擴充需求 - 最小化擴充方案
- 診斷工具設計 - 對比腳本設計完成

---

## Phase 1: Design & Contracts ✅

**Status**: Complete
**Prerequisites**: `research.md` 完成
**Outputs**: `data-model.md`, `contracts/`, `quickstart.md`

**Tasks**:
1. **Data Model 設計**：
   - IntervalDetectionResult 介面定義
   - IntervalCacheEntry 擴充（加入偵測來源標記）

2. **API Contracts 設計**：
   - `contracts/okx-api.md`: 記錄 OKX Native API 的請求/回應範例
   - `contracts/interval-cache.md`: 記錄 IntervalCache 的介面變更

3. **Quickstart Guide 撰寫**：
   - 開發者如何測試修復
   - 如何執行診斷工具
   - 如何驗證日誌輸出

4. **Agent Context Update**：
   - 執行 `.specify/scripts/bash/update-agent-context.sh claude`
   - 更新 CLAUDE.md 記錄新技術決策

**Deliverable**: ✅ 完整的設計文件和開發指南

**Artifacts Generated**:
- `data-model.md` - 資料模型定義（IntervalSource, CachedInterval, IntervalDetectionResult, OKX API 類型）
- `contracts/okx-api.md` - OKX Native API 完整規範
- `contracts/interval-cache.md` - FundingIntervalCache 介面契約
- `quickstart.md` - 開發者快速入門指南
- `CLAUDE.md` - Agent context 已更新

---

## Phase 2: Task Generation (由 /speckit.tasks 執行)

**Status**: Not Started
**Command**: `/speckit.tasks`
**Output**: `tasks.md`

此階段由獨立命令執行，不在 `/speckit.plan` 範圍內。

---

## Next Steps

1. ✅ **完成**: 規格文件撰寫和品質驗證 (`/speckit.specify`)
2. ✅ **完成**: 實作計劃撰寫 (`/speckit.plan`)
3. ✅ **完成**: Phase 0 - 研究和技術決策
4. ✅ **完成**: Phase 1 - 設計文件和合約
5. ⏳ **待執行**: 任務分解 (`/speckit.tasks`)
6. ⏳ **待執行**: 實作執行 (`/speckit.implement`)

---

**Plan Version**: 1.0
**Last Updated**: 2025-01-27
**Status**: Complete - Ready for Task Generation
