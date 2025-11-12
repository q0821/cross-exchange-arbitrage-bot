# Implementation Plan: 市場監控頁面穩定排序

**Branch**: `009-specify-scripts-bash` | **Date**: 2025-11-12 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-specify-scripts-bash/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

市場監控頁面目前因 WebSocket 即時更新導致交易對列表不斷重新排序，造成用戶閱讀困難。本功能將實作穩定排序機制，確保列表順序固定，僅更新數值資料。技術方案基於 React 的 useMemo 優化和狀態管理分離，將排序邏輯與資料更新邏輯解耦。

## Technical Context

**Language/Version**: TypeScript 5.6, Node.js 20.x LTS
**Primary Dependencies**: React 18, Next.js 14 App Router, Radix UI (現有依賴，無需新增)
**Storage**: 瀏覽器 localStorage (用於儲存排序偏好)
**Testing**: Vitest (unit tests), Playwright (E2E tests) - 現有測試框架
**Target Platform**: 現代瀏覽器 (Chrome, Firefox, Safari, Edge)
**Project Type**: Web (前端改進，純 Client-side)
**Performance Goals**: 排序操作 <500ms, WebSocket 更新不觸發重排
**Constraints**: 不影響現有 WebSocket 即時更新機制，保持 100% 數值更新即時性
**Scale/Scope**: 單一頁面改進 (app/(dashboard)/market-monitor), 影響 3 個組件 + 1 個 hook

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### ✅ Principle I: Trading Safety First
**Status**: N/A (不適用)
**Rationale**: 此功能僅涉及前端顯示邏輯，不涉及交易執行、倉位管理或資金操作。

### ✅ Principle II: Complete Observability
**Status**: PASS
**Rationale**:
- 前端排序操作已透過現有 logger 機制記錄（useTableSort hook 中的 console.log）
- 無需額外的觀察性機制，因為這是純 UI 行為
- 錯誤處理透過 React Error Boundaries 已涵蓋

### ✅ Principle III: Defensive Programming
**Status**: PASS
**Rationale**:
- localStorage 操作已包含 try-catch 錯誤處理
- 不涉及外部 API 呼叫，無需 retry 邏輯
- 降級方案：localStorage 不可用時，排序功能仍正常運作，僅不保存偏好

### ✅ Principle IV: Data Integrity
**Status**: PASS
**Rationale**:
- 不涉及資料庫變更或新的資料模型
- 排序偏好儲存在 client-side localStorage，不影響伺服器端資料完整性
- 交易對資料來源不變，僅改變顯示順序

### ✅ Principle V: Incremental Delivery
**Status**: PASS
**Rationale**:
- P1 (預設穩定排序) 可獨立實作和測試
- P2 (自訂排序) 和 P3 (偏好記憶) 可漸進式新增
- 無需等待其他功能完成，可立即部署

### ✅ Principle VI: System Architecture Boundaries
**Status**: PASS
**Rationale**:
- **純 Web 前端功能**：符合 Web Responsibilities 定義
  - 只涉及資料顯示邏輯改進
  - 不新增或修改 API 端點
  - 不影響 CLI 監控服務
- **Data Flow Pattern 符合**：
  - CLI Monitor → Database → Web API → **Web UI (排序顯示)** ✅
  - 排序邏輯完全在 Web UI 層實作
  - 不修改從資料庫取得的資料，只改變顯示順序
  - WebSocket 更新機制保持不變
- **無跨界操作**：
  - 不涉及 CLI 與 Web 的直接通訊
  - 不涉及 Exchange API 呼叫
  - 不涉及業務邏輯計算（費率計算仍在 CLI）

**結論**: 完全符合 Principle VI，此為標準的 Web UI 改進，屬於 "Data visualization" 和 "User interactions" 範疇。

## Project Structure

### Documentation (this feature)

```
specs/009-specify-scripts-bash/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
app/(dashboard)/market-monitor/
├── page.tsx                    # [MODIFY] 主頁面組件 - 加入穩定排序邏輯
├── components/
│   ├── RatesTable.tsx          # [MODIFY] 表格組件 - 優化 useMemo 依賴
│   ├── RateRow.tsx             # [NO CHANGE] 單行組件
│   └── SymbolSelector.tsx      # [NO CHANGE] 群組選擇器
└── hooks/
    ├── useMarketRates.ts       # [MODIFY] 資料 hook - 分離排序邏輯
    ├── useTableSort.ts         # [MODIFY] 排序 hook - 改為預設字母順序
    └── useSymbolGroups.ts      # [NO CHANGE] 群組管理 hook

tests/
├── unit/
│   └── market-monitor/
│       └── useStableSort.test.ts  # [NEW] 穩定排序邏輯測試
└── e2e/
    └── market-monitor-sorting.spec.ts  # [NEW] E2E 排序穩定性測試
```

**Structure Decision**:
此功能為現有市場監控頁面的改進，沿用現有的 Next.js App Router 結構。主要修改集中在 `app/(dashboard)/market-monitor/` 目錄下的組件和 hooks。不需要新增目錄或重構現有架構，保持變更範圍最小化以降低風險。

## Complexity Tracking

*No constitution violations - this section is not needed.*

所有 Constitution Check 項目皆為 PASS，無需額外複雜度追蹤。
