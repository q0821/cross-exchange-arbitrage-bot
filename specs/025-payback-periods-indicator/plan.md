# Implementation Plan: 價差回本週期指標

**Branch**: `025-payback-periods-indicator` | **Date**: 2025-01-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/025-payback-periods-indicator/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

新增價差回本週期指標，幫助交易者快速評估套利風險。當價差對建倉不利時（做多交易所價格高於做空交易所），系統計算並顯示需要收取多少次資金費率才能抵銷價差損失。當價差有利時，顯示正面標記。

**Technical Approach**:
1. 在前端新增輕量級計算函數 `calculatePaybackPeriods()`，利用現有的 `priceDiffPercent` 和 `spreadPercent` 資料
2. 擴展 `RateRow` 組件，在價差欄位下方顯示回本指標（綠色/橙色/紅色標記）
3. 新增 Tooltip 提供詳細計算說明（價差、費率差、回本次數、預估時間）
4. 更新複製功能訊息，包含回本資訊

此功能為純前端增強，不涉及後端計算、資料庫變更或 API 修改。

## Technical Context

**Language/Version**: TypeScript 5.6 + Node.js 20.x LTS
**Primary Dependencies**: React 18, Next.js 14 App Router, Radix UI Tooltip (現有依賴，無需新增)
**Storage**: N/A（純前端計算，不涉及資料持久化）
**Testing**: Vitest (單元測試)，現有測試架構
**Target Platform**: Web Browser（現有 market-monitor 頁面）
**Project Type**: Web (前端擴展)
**Performance Goals**:
- 單次計算 < 0.1ms（單一除法運算）
- 200 個交易對同時計算 < 100ms
- UI 渲染不阻塞主執行緒

**Constraints**:
- 必須與現有時間基準切換功能整合（1h/4h/8h/24h）
- 不能破壞現有表格佈局（在價差欄位內擴展，不新增獨立欄位）
- 必須處理所有邊界情況（null、零、極大值）

**Scale/Scope**:
- 影響檔案數：5 個（3 個修改，2 個新增測試）
- 新增代碼：約 200 行（含測試）
- 影響組件：`RateRow`, `rateCalculations`, `formatArbitrageMessage`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### ✅ Principle I: Trading Safety First
**Status**: NOT APPLICABLE（低風險）
**Reasoning**: 此功能僅為資訊顯示，不執行交易。回本指標幫助用戶評估風險，實際上提升了交易安全性（防止在價差不利時開倉）。

### ✅ Principle II: Complete Observability
**Status**: ALIGNED
**How**: 雖為前端功能，但計算邏輯清晰可追溯。Tooltip 顯示完整計算過程（價差、費率差、計算公式），用戶可驗證結果準確性。

### ✅ Principle III: Defensive Programming
**Status**: ALIGNED
**How**:
- 所有邊界情況已明確處理（FR-009, FR-010, FR-015）
- 計算函數回傳類型化結果，避免 undefined 錯誤
- 當費率差為零時，優雅降級顯示「無法回本」
- 當數據為 null 時，顯示「N/A」而非崩潰

### ✅ Principle IV: Data Integrity
**Status**: ALIGNED
**How**:
- 不修改任何現有資料
- 純計算功能，輸入來自已驗證的 `BestArbitragePair` 資料
- 使用 `toFixed(1)` 確保數值精度一致性

### ✅ Principle V: Incremental Delivery
**Status**: ALIGNED
**How**:
- MVP（US1 + US2）可獨立測試和部署：顯示回本次數 + 顯示有利標記
- P2 功能（US3 + US4）可稍後加入：Tooltip + 複製功能
- P3 功能（US5）為錯誤處理，可最後完善
- 每個 User Story 都可獨立測試並提供價值

### ✅ Principle VI: System Architecture Boundaries
**Status**: ALIGNED
**How**:
- 完全在 Web 前端實作（符合 Web Responsibilities: Data visualization）
- 不涉及 CLI 監控邏輯
- 不直接呼叫交易所 API
- 數據來源為 WebSocket 推送的 `BestArbitragePair`（符合資料流模式）

**Final Verdict**: ✅ 所有相關原則都符合要求，無違規事項

## Project Structure

### Documentation (this feature)

```
specs/025-payback-periods-indicator/
├── spec.md              # Feature specification (已完成)
├── plan.md              # This file (當前)
├── research.md          # Phase 0 output (待生成)
├── data-model.md        # Phase 1 output (待生成)
├── quickstart.md        # Phase 1 output (待生成)
├── contracts/           # Phase 1 output (待生成)
│   └── payback-calculation.md  # 回本次數計算介面規範
├── checklists/          # 品質檢查清單
│   └── requirements.md  # 規格品質驗證（已完成）
└── tasks.md             # Phase 2 output (由 /speckit.tasks 生成)
```

### Source Code (repository root)

```
app/(dashboard)/market-monitor/
├── utils/
│   ├── rateCalculations.ts          # 修改：新增 calculatePaybackPeriods()
│   └── formatArbitrageMessage.ts    # 修改：擴展複製訊息
├── components/
│   └── RateRow.tsx                  # 修改：顯示回本指標和 Tooltip
├── hooks/
│   └── useMarketRates.ts            # 不修改（利用現有資料）
├── types.ts                         # 不修改（或新增 PaybackResult 型別）
└── page.tsx                         # 不修改（父組件無需調整）

tests/unit/market-monitor/
├── calculatePaybackPeriods.test.ts  # 新增：單元測試
└── formatMessage.test.ts            # 修改：測試複製訊息擴展
```

**Structure Decision**: Web 前端專案（Next.js 14 App Router）。此功能完全在前端實作，不涉及後端（`src/`）或資料庫（`prisma/`）變更。所有修改集中在 `app/(dashboard)/market-monitor/` 目錄下的前端組件和工具函數。

## Complexity Tracking

*本專案無需填寫此區塊，因為沒有違反 Constitution 原則的情況*

---

## Phase 0: Outline & Research

**Status**: ✅ COMPLETE

**Output**: [`research.md`](./research.md)

**Key Decisions**:
- TD-001: 前端計算（性能更優，符合架構邊界）
- TD-002: 價差欄位下方顯示（語義相關，不破壞佈局）
- TD-003: 類型化結果物件（避免 undefined，易於維護）
- TD-004: Tooltip 動態顯示時間預估（整合現有功能）
- TD-005: React.memo + pure function（確保 200+ 交易對流暢）
- TD-006: 單元測試 + 手動驗證（平衡測試成本與品質）
- TD-007: Tooltip 免責說明（避免使用者誤解）

**Technical Unknowns Resolved**: 8/8
- ✅ 計算邏輯正確性驗證
- ✅ 前端 vs 後端計算選擇
- ✅ UI 顯示位置確定
- ✅ 邊界情況處理策略
- ✅ 時間基準整合方案
- ✅ 效能考量驗證
- ✅ 測試策略定義
- ✅ 使用者誤解風險緩解

**Dependencies Validated**: 無需新增依賴（Radix UI Tooltip 已存在）

---

## Phase 1: Design & Contracts

**Status**: ✅ COMPLETE

**Outputs**:
1. [`data-model.md`](./data-model.md) - 資料結構定義
   - `PaybackResult` 介面規範
   - `calculatePaybackPeriods()` 函數簽名
   - 資料流圖（Backend → WebSocket → Frontend）
   - 記憶體佔用分析（170 bytes/pair, 34 KB total）
   - 驗證規則（priceDiffPercent, spreadPercent, timeBasis）

2. [`contracts/payback-calculation.md`](./contracts/payback-calculation.md) - 計算函數契約
   - 輸入參數規範（priceDiffPercent, spreadPercent, timeBasis）
   - 輸出欄位規範（status, periods, estimatedHours, displayText, color, details）
   - 5 種行為規範（favorable, payback_needed, too_many, impossible, no_data）
   - 邊界情況處理（null, zero, overflow, NaN）
   - 效能需求（< 0.1ms per calculation, < 100ms for 200 pairs）
   - 單元測試契約（6 個測試案例）

3. [`quickstart.md`](./quickstart.md) - 快速入門指南
   - 功能演示（Before/After 對比）
   - 4 個使用者情境（快速篩選、詳細評估、時間基準切換、複製分享）
   - 技術概覽（實作摘要、檔案清單）
   - 驗收標準（P1/P2/P3 分層）
   - 手動測試案例（5 個測試情境）
   - 成功指標（5 個可測量目標）
   - 已知限制和緩解措施

**Agent Context Updated**: ✅ CLAUDE.md 已更新

---

## Phase 2: Task Generation

**Status**: ⏳ PENDING

**Next Command**: `/speckit.tasks`

**Expected Output**: `tasks.md` - 詳細任務清單（預估 10-15 個任務）

**Task Categories**:
1. 前端計算函數開發（calculatePaybackPeriods）
2. UI 組件擴展（RateRow, Tooltip）
3. 複製功能擴展（formatArbitrageMessage）
4. 單元測試（100% 覆蓋率目標）
5. 手動驗證和文件更新

---

## Notes for Implementation

### Critical Path
1. **calculatePaybackPeriods()** 函數（核心邏輯）
2. **RateRow.tsx** 顯示指標（UI 整合）
3. **Tooltip** 詳細資訊（輔助功能）
4. **formatArbitrageMessage()** 擴展（複製功能）
5. **單元測試** 驗證正確性

### Performance Optimizations
- 使用 `React.memo` 包裹 `RateRow` 組件
- 計算函數為 pure function（無副作用）
- 僅在 `priceDiffPercent` 或 `spreadPercent` 變化時重新計算

### Testing Priority
- P0: 計算邏輯正確性（所有邊界情況）
- P1: UI 顯示正確性（displayText, color）
- P2: Tooltip 內容完整性（details, formula）
- P3: 複製訊息格式（包含回本資訊）

### User Experience
- 主要指標直接可見（不需 hover）
- 詳細資訊透過 Tooltip 提供（避免視覺混亂）
- 顏色編碼清晰（綠色=有利, 橙色=需回本, 紅色=高風險）
- 免責說明防止誤解（Tooltip 包含警告）

---

**準備進入 Phase 2: Task Generation** ✅

