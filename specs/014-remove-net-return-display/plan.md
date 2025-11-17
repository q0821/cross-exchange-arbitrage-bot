# Implementation Plan: 移除淨收益欄位，改為獨立參考指標顯示

**Branch**: `014-remove-net-return-display` | **Date**: 2025-01-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/014-remove-net-return-display/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

移除市場監控頁面中誤導性的「淨收益」欄位顯示，改為分別顯示資金費率差、價差、預估手續費（0.05% × 4 = 0.2%）三個獨立指標，讓用戶根據自己的持倉策略自行判斷套利空間。同時建立專案手續費計算規範文件，明確定義套利交易的手續費標準。

技術方法：移除前端 UI 元件中的淨收益顯示邏輯，新增預估手續費欄位和 Tooltip，移除後端 API 和 WebSocket 中的淨收益計算，更新排序和高收益判斷邏輯，建立手續費規範文件。

## Technical Context

**Language/Version**: TypeScript 5.6 + Node.js 20.x LTS
**Primary Dependencies**: React 18, Next.js 14 App Router, Tailwind CSS, Socket.io 4.8.1 (WebSocket)
**Storage**: N/A（純 UI 重構，不涉及資料模型變更；手續費規範為 Markdown 文件）
**Testing**: Jest + React Testing Library（單元測試）, Playwright（E2E 測試）
**Target Platform**: Web 瀏覽器（桌面版，Chrome/Firefox/Safari 最新版本）
**Project Type**: Web（Next.js App Router 架構）
**Performance Goals**: UI 更新即時響應（< 100ms），WebSocket 數據同步無延遲
**Constraints**: 無破壞性變更，保持向後兼容；不修改資料庫 schema；保留現有功能（排序、篩選）
**Scale/Scope**: 6-8 個前端元件檔案修改，2 個後端檔案修改，1 個文件新增

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Trading Safety First ✅ PASS (Not Applicable)

**Status**: This feature does not involve trade execution, position management, or fund handling.

**Compliance**: N/A - Pure UI/UX improvement focused on data display. No trading logic affected.

### II. Complete Observability ✅ PASS

**Status**: Logging requirements met.

**Compliance**:
- UI changes do not require additional logging (standard React error boundaries sufficient)
- Backend API/WebSocket modifications will preserve existing Pino structured logging
- No critical operations introduced that require new audit trails

### III. Defensive Programming ✅ PASS

**Status**: Error handling requirements met.

**Compliance**:
- Frontend will use TypeScript strict mode for type safety
- Remove deprecated code paths (netReturn) reduces potential error sources
- WebSocket data updates already have retry/reconnection logic (unchanged)
- No new external API calls introduced

### IV. Data Integrity ⚠️ CONDITIONAL PASS

**Status**: No database schema changes.

**Compliance**:
- No Prisma migrations required（不修改資料庫 schema）
- 移除 `netReturn` 欄位僅影響 API 返回值，不影響資料庫儲存
- Financial calculations not affected（手續費為固定值 0.2%，不涉及 Decimal 運算）

**Note**: `ArbitrageResult` 表中的 `net_profit` 欄位保留不變（用於其他功能），本次僅移除 Web UI 顯示。

### V. Incremental Delivery ✅ PASS

**Status**: Feature is independently testable.

**Compliance**:
- P1 (移除淨收益顯示) can be tested independently and provides immediate value
- P2 (手續費明細 Tooltip) is optional enhancement, not blocking P1
- P3 (文件規範) is documentation task, independent of code changes
- Each priority level can be deployed separately if needed

### VI. System Architecture Boundaries ✅ PASS

**Status**: CLI/Web separation maintained.

**Compliance**:
- **Web Changes Only**: All modifications are in Web UI (`app/(dashboard)/market-monitor/*`)
- **No CLI Changes**: CLI monitors continue writing to database unchanged
- **Data Flow Preserved**: Web continues reading from database/WebSocket (no direct exchange API calls)
- **Single Source of Truth**: Database remains the source of truth; UI only changes display format

**Verification**:
- No modifications to `src/services/` (CLI business logic)
- No modifications to `src/connectors/` (Exchange adapters)
- Only `/app/api/` and `app/(dashboard)/` affected (Web layer)

### GATE RESULT: ✅ ALL GATES PASSED

**Summary**: This feature is a pure UI/UX improvement that simplifies data display without affecting core trading logic, data persistence, or system architecture. No constitution principles violated.

**Justification for Proceed**: Low-risk change focusing on user clarity and reducing misleading information. No new complexity introduced; actually reduces code complexity by removing unused calculations.

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
app/
├── (dashboard)/
│   └── market-monitor/
│       ├── components/
│       │   ├── RatesTable.tsx          # [MODIFY] 移除淨收益欄位，新增手續費欄位
│       │   ├── RateRow.tsx             # [MODIFY] 更新顯示邏輯，移除 NetProfitTooltip
│       │   ├── NetProfitTooltip.tsx    # [DELETE] 或重構為 FeeEstimateTooltip
│       │   └── FeeEstimateTooltip.tsx  # [NEW] 手續費明細 Tooltip
│       ├── types.ts                    # [MODIFY] 更新介面定義，移除 netReturn
│       ├── utils/
│       │   └── sortComparator.ts       # [MODIFY] 移除 netReturn 排序邏輯
│       └── hooks/
│           └── useTableSort.ts         # [MODIFY] 檢查預設排序欄位
└── api/
    └── market-rates/
        └── route.ts                    # [MODIFY] 移除 netReturn 計算邏輯

src/
├── lib/
│   ├── net-return-calculator.ts        # [DELETE] 移除未使用的計算器
│   └── cost-calculator.ts              # [KEEP] 保留供其他功能使用
├── services/
│   └── calculation/
│       └── NetProfitCalculator.ts      # [KEEP] 後端套利評估仍需使用
└── websocket/
    └── handlers/
        └── MarketRatesHandler.ts       # [MODIFY] 移除 netReturn WebSocket 推送

tests/
├── unit/
│   └── lib/
│       └── net-return-calculator.test.ts  # [DELETE] 相關測試移除
└── e2e/
    └── market-monitor.spec.ts          # [MODIFY] 更新 E2E 測試驗證新 UI

docs/
└── trading-fees.md                     # [NEW] 手續費計算規範文件
```

**Structure Decision**: 此專案為 Next.js 14 App Router Web 應用。修改範圍主要集中在 Web 前端（`app/(dashboard)/market-monitor/`）和 API 路由（`app/api/`）。不涉及 CLI 業務邏輯（`src/services/`、`src/connectors/`），符合 Constitution Principle VI（系統架構邊界）。

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

**Status**: ✅ No violations - Complexity Tracking not required

This feature actually **reduces** complexity:
- Removes unused calculation logic (`net-return-calculator.ts`)
- Simplifies UI by removing misleading computed field
- Reduces maintenance burden (fewer code paths to test)
- No new patterns or abstractions introduced


## Phase 0 & Phase 1 Completion

### Phase 0: Research ✅ COMPLETE

**Generated Artifacts**:
- [research.md](./research.md): Technical decisions and rationale

**Key Findings**:
- Decision 1: 完全移除淨收益欄位（而非重構）
- Decision 2: 手續費標準化為 0.05% × 4 = 0.2%
- Decision 3: 新增 FeeEstimateTooltip 元件
- Decision 4: 僅移除 netReturn API 返回，保留後端計算邏輯
- Decision 5: 移除淨收益排序選項
- Decision 6: 高收益判斷改用 spreadPercent > 0.5%

**Unknowns Resolved**: N/A (無 NEEDS CLARIFICATION)

### Phase 1: Design & Contracts ✅ COMPLETE

**Generated Artifacts**:
- [data-model.md](./data-model.md): 資料模型（無變更）
- [contracts/api-changes.md](./contracts/api-changes.md): API 合約變更
- [quickstart.md](./quickstart.md): 快速上手指南

**Key Designs**:
- 無資料庫 schema 變更（純 UI 重構）
- API 移除 `netReturn` 欄位返回
- WebSocket 移除 `netReturn` 推送
- 手續費規範文件規劃

**Agent Context Updated**: ✅ CLAUDE.md updated with feature technologies

### Constitution Re-Check (Post-Phase 1) ✅ ALL GATES STILL PASS

重新評估結果與 Phase 0 前一致：
- **I. Trading Safety**: ✅ PASS (Not Applicable)
- **II. Complete Observability**: ✅ PASS
- **III. Defensive Programming**: ✅ PASS
- **IV. Data Integrity**: ⚠️ CONDITIONAL PASS (無 DB 變更)
- **V. Incremental Delivery**: ✅ PASS
- **VI. System Architecture Boundaries**: ✅ PASS

**Design Validation**: Phase 1 設計符合所有 Constitution 原則，未引入新的複雜度或違規。

---

## Next Steps

### Immediate Actions

1. **Run /speckit.tasks**: Generate implementation task list
   ```bash
   # This will create tasks.md with detailed implementation tasks
   ```

2. **Review Plan**: Ensure all stakeholders approve the technical approach

3. **Prepare Environment**: Ensure development environment is ready

### Implementation Phase

After `/speckit.tasks` completion:

1. **Execute Tasks**: Follow tasks.md step-by-step or use `/speckit.implement`
2. **Testing**: Run unit tests, integration tests, and E2E tests
3. **Documentation**: Create `docs/trading-fees.md` per specification
4. **Code Review**: Submit PR for team review
5. **Deployment**: Deploy to staging → production

---

## Plan Completion Summary

**Status**: ✅ PLANNING COMPLETE - Ready for Task Generation

**Deliverables**:
- ✅ Implementation Plan (this file)
- ✅ Research & Technical Decisions (research.md)
- ✅ Data Model Analysis (data-model.md)
- ✅ API Contract Changes (contracts/api-changes.md)
- ✅ Quick Start Guide (quickstart.md)
- ✅ Agent Context Updated (CLAUDE.md)

**Gates Passed**: All Constitution checks passed

**Next Command**: `/speckit.tasks` to generate implementation tasks
