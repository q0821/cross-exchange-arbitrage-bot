# Implementation Plan: 一鍵複製套利機會資訊

**Branch**: `020-copy-arbitrage-info` | **Date**: 2025-11-21 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/020-copy-arbitrage-info/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

此功能在市場監控頁面為每個交易對新增複製按鈕，讓用戶能一鍵複製格式化的套利機會資訊到剪貼板。技術實現採用瀏覽器原生 Clipboard API，不需要新增外部依賴。實現包含三個核心部分：格式化工具函數（將 MarketRate 數據轉換為指定文字格式）、RateRow 組件修改（新增複製按鈕和狀態管理）、以及視覺反饋機制（成功/失敗狀態顯示）。

## Technical Context

**Language/Version**: TypeScript 5.6 + Node.js 20.x LTS
**Primary Dependencies**:
- React 18 (現有)
- Next.js 14 App Router (現有)
- Lucide React (現有，用於圖標)
- Tailwind CSS (現有，用於樣式)

**Storage**: N/A（純前端功能，不涉及資料持久化）
**Testing**: Jest + React Testing Library + Vitest（現有測試框架）
**Target Platform**: 現代瀏覽器（Chrome 90+、Firefox 88+、Safari 14+、Edge 90+）支援 Clipboard API
**Project Type**: Web（前端擴展）
**Performance Goals**:
- 複製操作延遲 < 100ms
- 視覺反饋顯示延遲 < 500ms
- UI 渲染不阻塞主執行緒

**Constraints**:
- 必須在 HTTPS 環境中使用 Clipboard API
- 瀏覽器需支援 `navigator.clipboard.writeText()`
- 不可新增外部依賴套件（使用瀏覽器原生 API）

**Scale/Scope**:
- 影響單一頁面（市場監控頁面）
- 修改 2 個檔案，新增 1 個工具函數檔案
- 新增約 150 行程式碼（含測試）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: Trading Safety First
**Status**: ✅ NOT APPLICABLE
**Reason**: 此功能不涉及交易執行、訂單下單或資金管理，僅為資訊展示和複製功能，不會影響交易安全。

### Principle II: Complete Observability
**Status**: ✅ COMPLIANT
**Implementation**:
- 複製失敗時會在 console 中記錄錯誤（開發模式）
- 用戶會看到明確的錯誤訊息（視覺反饋）
- 不需要結構化日誌（純前端互動，不涉及關鍵業務邏輯）

### Principle III: Defensive Programming
**Status**: ✅ COMPLIANT
**Implementation**:
- Clipboard API 呼叫包含 try-catch 錯誤處理
- 瀏覽器不支援時顯示友善錯誤訊息
- bestPair 為 null 時禁用複製按鈕
- 異常數值（負數、NaN）格式化為 "N/A"

### Principle IV: Data Integrity
**Status**: ✅ NOT APPLICABLE
**Reason**: 此功能不修改或持久化任何數據，僅讀取現有的 MarketRate 數據並格式化為文字。

### Principle V: Incremental Delivery
**Status**: ✅ COMPLIANT
**Implementation**:
- P1: 基本複製功能（核心價值）
- P2: 視覺反饋（提升 UX）
- P3: 錯誤處理（完整性）
- 每個優先級都可獨立測試和部署

### Principle VI: System Architecture Boundaries
**Status**: ✅ COMPLIANT
**Implementation**:
- 純前端功能，符合 "Web Responsibilities"
- 僅讀取已快取在前端的 MarketRate 數據（來自 WebSocket）
- 不直接呼叫交易所 API
- 不進行業務邏輯計算（使用已計算好的 bestPair）
- 不接觸 API keys 或敏感資料

**Gate Result**: ✅ ALL CHECKS PASSED - Proceed to Phase 0

## Project Structure

### Documentation (this feature)

```
specs/020-copy-arbitrage-info/
├── spec.md              # Feature specification
├── plan.md              # This file (implementation plan)
├── research.md          # Technical research and decisions
├── data-model.md        # Data structure documentation
├── quickstart.md        # User guide for using copy feature
├── checklists/
│   └── requirements.md  # Specification quality checklist
└── contracts/           # N/A (no API contracts for frontend-only feature)
```

### Source Code (repository root)

```
app/(dashboard)/market-monitor/
├── components/
│   └── RateRow.tsx                    # [MODIFY] 新增複製按鈕
├── utils/
│   ├── formatArbitrageMessage.ts      # [NEW] 格式化工具函數
│   └── rateCalculations.ts           # [EXISTING] 費率計算工具
├── hooks/
│   └── useMarketRates.ts              # [EXISTING] 數據獲取 hook
└── types.ts                           # [EXISTING] 類型定義

tests/unit/frontend/
├── formatArbitrageMessage.test.ts     # [NEW] 格式化函數測試
└── RateRow.test.tsx                   # [NEW] 組件測試
```

**Structure Decision**: 採用現有的 Next.js App Router 結構，功能代碼放在 `app/(dashboard)/market-monitor/` 目錄下。新增一個工具函數檔案 `formatArbitrageMessage.ts` 來處理文字格式化，修改現有的 `RateRow.tsx` 組件來新增複製按鈕。測試檔案放在 `tests/unit/frontend/` 目錄下。

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

**No violations** - 此功能完全符合 constitution 所有適用原則。

## Phase 0: Research & Technical Decisions

### Research Tasks

1. **Clipboard API 最佳實踐**
   - 研究 `navigator.clipboard.writeText()` 的錯誤處理模式
   - 確認瀏覽器相容性和 fallback 策略
   - 研究權限處理（Permissions API）

2. **範圍估值演算法**
   - 定義 ±20% 波動範圍的具體計算方式
   - 確定四捨五入規則（整數百分比）
   - 處理邊界情況（0%、負數、極大值）

3. **React 狀態管理模式**
   - 研究複製狀態（idle/copying/success/error）的最佳實踐
   - 確定 setTimeout 清理機制（避免 memory leak）
   - 研究 React 18 的 useEffect 清理函數模式

4. **交易所名稱映射**
   - 確認現有的 ExchangeName 類型定義
   - 定義大寫轉換規則（binance → BINANCE, gateio → GATE）
   - 處理未知交易所名稱

### Decision Log

見 `research.md`（將在 Phase 0 完成後生成）

## Phase 1: Design Artifacts

### Data Model

見 `data-model.md`（將描述現有的 MarketRate 和 BestArbitragePair 結構，以及格式化函數的輸入/輸出）

### API Contracts

**N/A** - 此功能不涉及 API 端點，純前端實現

### Quick Start Guide

見 `quickstart.md`（將包含用戶如何使用複製功能的指南）

## Implementation Strategy

### Phase 0: Research (Covered above)

**Deliverable**: `research.md` with all technical decisions documented

### Phase 1: Core Implementation

**Task 1.1**: 建立格式化工具函數
- 檔案: `app/(dashboard)/market-monitor/utils/formatArbitrageMessage.ts`
- 輸入: `MarketRate` 物件
- 輸出: 格式化的文字字串
- 包含: 交易所名稱映射、範圍估值計算、emoji 和格式化

**Task 1.2**: 修改 RateRow 組件
- 新增複製按鈕（使用 Lucide React 的 `Copy` 圖標）
- 實作複製狀態管理（useState）
- 實作 handleCopy 函數（呼叫 Clipboard API）
- 實作視覺反饋（圖標切換、2 秒倒數）

**Task 1.3**: 錯誤處理
- try-catch 包裹 Clipboard API 呼叫
- 處理權限被拒絕的情況
- 處理瀏覽器不支援的情況
- 顯示用戶友善的錯誤訊息

### Phase 2: Testing

**Task 2.1**: 單元測試
- 測試 `formatArbitrageMessage` 函數的各種輸入情況
- 測試範圍估值計算正確性
- 測試邊界情況處理（null bestPair、負數、NaN）

**Task 2.2**: 組件測試
- 測試複製按鈕渲染
- 測試點擊後狀態變化
- 測試視覺反饋（圖標切換）
- 測試錯誤處理流程

**Task 2.3**: 整合測試
- 在瀏覽器中手動測試複製功能
- 驗證在不同應用程式（記事本、Excel、通訊軟體）中貼上的格式正確性
- 測試在不同瀏覽器中的相容性

### Phase 3: Documentation

**Task 3.1**: 更新 quickstart.md
- 說明如何使用複製按鈕
- 列出支援的瀏覽器
- 提供故障排除指南

**Task 3.2**: 程式碼註解
- 為格式化函數新增 JSDoc 註解
- 為複雜邏輯新增內聯註解
- 更新 types.ts（如有需要）

## Risk Assessment

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Clipboard API 不支援 | Low | Medium | 顯示錯誤訊息，提供手動複製建議 |
| HTTPS 環境限制 | Low | High | 開發環境使用 localhost（視為安全上下文） |
| 範圍估值算法不準確 | Medium | Low | 可在後續版本調整演算法參數 |
| 視覺反饋狀態管理錯誤 | Medium | Low | 充分的單元測試覆蓋 |

### User Experience Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| 用戶不知道複製成功 | Medium | Medium | 清晰的視覺反饋（✓圖標持續 2 秒） |
| 格式在某些應用程式中損壞 | Low | Medium | 使用標準換行符和縮排，測試常見應用程式 |
| bestPair 為 null 時點擊無回應 | Low | Low | 禁用按鈕並顯示提示 |

## Success Metrics

Implementation complete when:

- [ ] All P1 acceptance scenarios passing
- [ ] Unit test coverage ≥ 85%
- [ ] Manual testing in 3+ browsers successful
- [ ] Copy-paste format correct in Excel, Notepad, Telegram
- [ ] No console errors in production build
- [ ] Visual feedback timing matches spec (2 seconds)
- [ ] Error handling covers all identified edge cases

## Dependencies & Prerequisites

### External Dependencies
**None** - 使用瀏覽器原生 Clipboard API，不需要新增 npm 套件

### Internal Dependencies
- 現有的 `MarketRate` 和 `BestArbitragePair` 類型定義
- 現有的 `RateRow` 組件結構
- 現有的 Lucide React 圖標庫
- 現有的 Tailwind CSS 配置

### Environment Requirements
- 開發環境: localhost（視為安全上下文）
- 生產環境: HTTPS（必須）
- 瀏覽器: 支援 Clipboard API 的現代瀏覽器

## Rollout Plan

### Phase 1: Development (1-2 days)
- 實作格式化函數和單元測試
- 修改 RateRow 組件
- 本地開發環境測試

### Phase 2: Testing (0.5 day)
- 執行完整的單元測試套件
- 手動測試各種瀏覽器和應用程式
- 驗證視覺反饋和錯誤處理

### Phase 3: Deployment (0.5 day)
- 合併到 main 分支
- 部署到生產環境
- 監控前端錯誤日誌

### Rollback Plan
- 如果發現嚴重問題，可快速 revert commit
- 純前端功能，不影響後端或資料庫
- 不影響現有的快速開倉功能

## Post-Implementation

### Future Enhancements (Out of Scope)

1. **自訂格式範本**
   - 讓用戶自訂複製的文字格式
   - 提供多種預設範本選擇

2. **交易所限倉資訊**
   - 顯示各交易所的限倉限制
   - 從交易所 API 即時查詢

3. **批量複製**
   - 支援選擇多個交易對一次複製
   - 生成彙總報告

4. **自動分享**
   - 整合 Telegram Bot API
   - 整合 Discord Webhook
   - 一鍵分享到指定群組

### Maintenance Considerations

- 當交易所名稱映射規則變更時，更新 `formatArbitrageMessage.ts`
- 當 MarketRate 數據結構變更時，更新格式化邏輯
- 定期檢查瀏覽器 Clipboard API 的更新和變化
- 監控用戶反饋，調整文字格式以符合實際使用需求
