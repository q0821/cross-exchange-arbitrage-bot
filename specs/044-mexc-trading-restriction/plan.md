# Implementation Plan: MEXC 交易所開倉限制處理

**Branch**: `044-mexc-trading-restriction` | **Date**: 2025-12-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/044-mexc-trading-restriction/spec.md`

## Summary

實作 MEXC 交易所的 API 開倉限制處理：在前端識別涉及 MEXC 的套利機會，禁用一鍵開倉按鈕並顯示警告提示，同時保留 MEXC 費率數據顯示和持倉/資產查看功能。這是一個純前端 UI 功能，不涉及後端 API 或資料庫變更。

## Technical Context

**Language/Version**: TypeScript 5.6 + Node.js 20.x LTS
**Primary Dependencies**: React 18, Next.js 14 App Router, Radix UI Tooltip (現有依賴，無需新增)
**Storage**: N/A（純前端功能，不涉及資料持久化）
**Testing**: Vitest（現有測試框架）
**Target Platform**: Web (現代瀏覽器)
**Project Type**: web（前端 React 應用）
**Performance Goals**: N/A（純 UI 邏輯，無效能關鍵路徑）
**Constraints**: 無（簡單的條件渲染邏輯）
**Scale/Scope**: 修改 2-3 個現有元件，新增 1 個配置檔案

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Applicable? | Status | Notes |
|-----------|-------------|--------|-------|
| I. Trading Safety First | ✅ 適用 | ✅ 通過 | 此功能防止用戶透過 API 在 MEXC 開倉（技術上不可行），是安全措施 |
| II. Complete Observability | ❌ 不適用 | - | 純 UI 功能，無需日誌記錄 |
| III. Defensive Programming | ❌ 不適用 | - | 無外部 API 呼叫 |
| IV. Data Integrity | ❌ 不適用 | - | 無資料庫變更 |
| V. Incremental Delivery | ✅ 適用 | ✅ 通過 | 功能可獨立測試和部署 |
| VI. System Architecture Boundaries | ✅ 適用 | ✅ 通過 | 純 Web 層變更，符合 Web 負責 UI 呈現的原則 |
| VII. TDD Discipline | ⚠️ 有限適用 | ⚠️ 調整 | 純 UI 條件渲染邏輯，以手動測試優先；如需自動化測試，可加入 component tests |

**Constitution Gate**: ✅ 通過 - 此功能是安全措施，防止用戶嘗試技術上不可行的操作。

## Project Structure

### Documentation (this feature)

```
specs/044-mexc-trading-restriction/
├── plan.md              # This file
├── research.md          # Phase 0 output - 交易所限制配置研究
├── data-model.md        # Phase 1 output - RestrictedExchange 型別定義
├── quickstart.md        # Phase 1 output - 測試指南
└── tasks.md             # Phase 2 output - 實作任務清單
```

### Source Code (repository root)

```
# 現有專案結構 (Web 應用)
app/(dashboard)/market-monitor/
├── components/
│   ├── OpenPositionButton.tsx    # 修改：加入 MEXC 限制檢查
│   ├── OpenPositionDialog.tsx    # 修改：加入警告橫幅
│   └── RateRow.tsx               # 參考：已有套利對識別邏輯
├── hooks/
│   └── useOpenPosition.ts        # 參考：開倉邏輯
└── types.ts                      # 參考：型別定義

src/lib/
└── trading-restrictions.ts       # 新增：交易所限制配置

# 測試（選用）
tests/unit/lib/
└── trading-restrictions.test.ts  # 新增：配置邏輯測試
```

**Structure Decision**: 使用現有 Next.js App Router 結構。新增一個共用的交易所限制配置檔案於 `src/lib/`，供前端元件使用。

## Key Files to Modify

| 檔案 | 變更類型 | 說明 |
|------|----------|------|
| `src/lib/trading-restrictions.ts` | 新增 | 受限交易所配置（可擴展） |
| `app/(dashboard)/market-monitor/components/OpenPositionButton.tsx` | 修改 | 加入 MEXC 禁用邏輯和 Tooltip |
| `app/(dashboard)/market-monitor/components/OpenPositionDialog.tsx` | 修改 | 加入警告橫幅和外部連結 |

## Complexity Tracking

*無 Constitution 違規，無需記錄*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| - | - | - |
