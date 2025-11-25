# Implementation Plan: 修正複製套利訊息顯示

**Branch**: `023-fix-copy-message-display` | **Date**: 2025-11-25 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/023-fix-copy-message-display/spec.md`

## Summary

修正複製套利訊息功能中的計算錯誤和術語說明。主要問題是 `formatPercentageRange()` 函數錯誤地將已經是百分比的數值再乘以 100，導致顯示錯誤的超大數值。此外，改善訊息內容以顯示更有意義的年化收益、單次費率收益、價格偏差說明和風險提示，使用更口語化的術語幫助用戶理解。

**Technical Approach**:
1. 移除 `formatPercentageRange()` 的錯誤乘法邏輯，改為直接使用後端傳送的百分比值
2. 新增專門的格式化函數處理年化收益、單次費率收益和價格偏差
3. 重構訊息模板使用年化收益而非原始利差
4. 加上術語註解和風險提示

## Technical Context

**Language/Version**: TypeScript 5.6 + Node.js 20.x LTS
**Primary Dependencies**: React 18, Next.js 14 App Router (現有依賴，無需新增)
**Storage**: N/A（純前端顯示修改，不涉及資料持久化）
**Testing**: Vitest (現有測試框架)
**Target Platform**: Web Browser (支援 navigator.clipboard API 的現代瀏覽器)
**Project Type**: Web application（前端修改）
**Performance Goals**: 複製操作 < 100ms，格式化函數執行 < 10ms
**Constraints**: 不修改後端邏輯，不修改資料模型，僅修改前端顯示和格式化
**Scale/Scope**: 2 個文件修改（formatArbitrageMessage.ts, RateRow.tsx），約 3-4 個新函數

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: Trading Safety First (NON-NEGOTIABLE)
**Status**: ✅ NOT APPLICABLE

此功能不執行交易、不管理倉位、不修改交易邏輯。僅修改複製訊息的顯示格式，不影響交易安全。

### Principle II: Complete Observability (NON-NEGOTIABLE)
**Status**: ✅ NOT APPLICABLE

此功能僅修改 UI 顯示和客戶端格式化邏輯，不涉及需要記錄的關鍵操作（交易、倉位變更、API 呼叫等）。

### Principle III: Defensive Programming
**Status**: ✅ COMPLIANT

- ✅ 格式化函數將處理 `null` 和 `undefined` 值（價格數據缺失情況）
- ✅ 邊界值檢查（零值、負值、極小值）
- ✅ 使用 TypeScript 型別保護防止型別錯誤

### Principle IV: Data Integrity
**Status**: ✅ NOT APPLICABLE

此功能不涉及：
- 資料庫操作
- Prisma migrations
- 財務計算（使用後端已計算好的值）
- 資料狀態變更

### Principle V: Incremental Delivery
**Status**: ✅ COMPLIANT

開發順序：
1. **P1**: 修正計算錯誤（核心功能，可獨立測試）
2. **P2**: 顯示單次費率收益和時間基準（增強功能，依賴 P1）
3. **P2**: 改善價格偏差說明（增強功能，可獨立測試）
4. **P3**: 改善術語和風險提示（UX 改善，最後實作）

每個優先級可獨立測試和部署。

### Principle VI: System Architecture Boundaries
**Status**: ✅ COMPLIANT

此功能完全在 **Web Responsibilities** 範圍內：
- ✅ 僅修改 Web UI 顯示邏輯
- ✅ 使用後端已計算好的數據（`annualizedReturn`, `spreadPercent`, `priceDiffPercent`）
- ✅ 不執行業務邏輯或計算（僅格式化顯示）
- ✅ 不直接呼叫交易所 API
- ✅ 不存取 API 金鑰

**Data Flow**:
```
CLI Monitor → Database → Web API → WebSocket → React State → formatArbitrageMessage() → Clipboard
                                                                        ↑
                                                              (此功能僅在這裡修改)
```

### Gate Evaluation

**✅ PASSED - No violations, proceed to Phase 0**

此功能完全符合憲法要求：
- 不涉及交易安全議題
- 不需要新的可觀測性機制
- 遵循防禦性程式設計原則
- 不影響資料完整性
- 遵循增量交付原則
- 完全符合架構邊界（純 Web 顯示修改）

## Project Structure

### Documentation (this feature)

```
specs/023-fix-copy-message-display/
├── spec.md              # Feature specification ✅
├── plan.md              # This file ✅
├── research.md          # Phase 0 output (技術決策和最佳實踐)
├── data-model.md        # Phase 1 output (類型定義和資料結構)
├── quickstart.md        # Phase 1 output (測試和驗證指南)
├── contracts/           # Phase 1 output (函數簽名和訊息格式)
├── checklists/          # ✅
│   └── requirements.md  # Spec quality checklist ✅
└── tasks.md             # Phase 2 output (by /speckit.tasks)
```

### Source Code (repository root)

此功能修改的是現有 Web 前端代碼，使用 Option 2 (Web application) 結構：

```
app/(dashboard)/market-monitor/
├── components/
│   └── RateRow.tsx                    # 修改：傳遞 timeBasis 參數
├── utils/
│   ├── formatArbitrageMessage.ts      # 主要修改：重構格式化邏輯
│   └── formatters.ts                  # 可能需要：共享格式化工具
└── types.ts                           # 參考：MarketRate, BestArbitragePair 型別

tests/unit/frontend/
└── formatArbitrageMessage.test.ts     # 新增：單元測試
```

**Structure Decision**: 使用現有的 Web application 結構。修改僅限於前端 `app/(dashboard)/market-monitor/` 目錄，不涉及後端 `src/` 或 API routes。所有變更都在 Web Responsibilities 範圍內。

## Complexity Tracking

*No Constitution violations - this section intentionally left empty.*

此功能完全符合憲法要求，無需複雜度豁免。

## Phase 0: Research & Decisions

*Research will be documented in [research.md](research.md)*

需要研究的技術決策：

1. **訊息格式化策略**
   - 決定：移除 formatPercentageRange 的 ±20% 波動邏輯，改為年化收益使用 ±10%，其他使用精確值
   - 需研究：百分比格式化最佳實踐（保留幾位小數）

2. **函數設計模式**
   - 決定：新增專門的格式化函數（單一職責原則）
   - 需研究：函數命名慣例和參數設計

3. **時間基準傳遞方式**
   - 需研究：如何從 RateRow 組件獲取當前時間基準（從 context 或 props）

4. **測試策略**
   - 需研究：如何測試 clipboard API（可能需要 mock）
   - 需研究：快照測試 vs 精確值測試

## Phase 1: Design & Contracts

*Will generate:*
- `data-model.md` - TypeScript 介面和類型定義
- `contracts/` - 函數簽名和訊息格式規範
- `quickstart.md` - 開發和測試指南

## Next Steps

1. ✅ Specification complete ([spec.md](spec.md))
2. ✅ Plan complete (this file)
3. ⏭️ Run `/speckit.plan` Phase 0 to generate [research.md](research.md)
4. ⏭️ Run `/speckit.plan` Phase 1 to generate design artifacts
5. ⏭️ Run `/speckit.tasks` to generate [tasks.md](tasks.md)
6. ⏭️ Run `/speckit.implement` to execute tasks
