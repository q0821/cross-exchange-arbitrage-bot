# Tasks: MEXC 交易所開倉限制處理

**Input**: Design documents from `/specs/044-mexc-trading-restriction/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: 不需要自動化測試（純 UI 條件渲染邏輯，以手動測試優先）

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 建立交易所限制配置模組

- [ ] T001 建立交易所限制配置檔案 `src/lib/trading-restrictions.ts`，包含：
  - `RestrictedExchangeId` 型別定義
  - `ExchangeRestriction` 介面
  - `RESTRICTED_EXCHANGES` 配置常量（MEXC 限制資訊）
  - `isExchangeRestricted()` 工具函數
  - `getExchangeRestriction()` 工具函數
  - `isArbitragePairRestricted()` 工具函數

**Checkpoint**: 配置模組完成，可被前端元件引用

---

## Phase 2: User Story 1 - 識別涉及 MEXC 的套利機會 (Priority: P1) 🎯 MVP

**Goal**: 當最佳套利對涉及 MEXC 時，一鍵開倉按鈕顯示禁用狀態並提供 Tooltip 說明

**Independent Test**: 在市場監控頁面找到涉及 MEXC 的套利機會，確認按鈕禁用且 Tooltip 正確顯示

### Implementation for User Story 1

- [ ] T002 [US1] 修改 `app/(dashboard)/market-monitor/components/OpenPositionButton.tsx`：
  - 新增 `isMexcRestricted` prop
  - 當 `isMexcRestricted` 為 true 時，按鈕使用警告色樣式（amber）
  - 調整 Tooltip 內容顯示限制說明
- [ ] T003 [US1] 修改 `app/(dashboard)/market-monitor/components/RateRow.tsx`：
  - 引入 `isArbitragePairRestricted` 函數
  - 計算當前 bestPair 是否涉及 MEXC
  - 傳遞 `isMexcRestricted` prop 給 OpenPositionButton

**Checkpoint**: 涉及 MEXC 的套利機會按鈕正確顯示禁用狀態和 Tooltip

---

## Phase 3: User Story 2 - 開倉對話框 MEXC 警告 (Priority: P2)

**Goal**: 在涉及 MEXC 的開倉對話框中顯示警告橫幅和外部連結，並禁用提交按鈕

**Independent Test**: 開啟涉及 MEXC 的套利對話框，確認警告橫幅、外部連結和禁用提交按鈕正確顯示

### Implementation for User Story 2

- [ ] T004 [US2] 修改 `app/(dashboard)/market-monitor/components/OpenPositionDialog.tsx`：
  - 引入 `isArbitragePairRestricted` 和 `RESTRICTED_EXCHANGES`
  - 檢查 longExchange 和 shortExchange 是否涉及 MEXC
  - 新增警告橫幅元件（amber 配色 + AlertTriangle 圖示）
  - 加入 MEXC 交易所外部連結按鈕（開新分頁）
  - 當涉及 MEXC 時禁用開倉提交按鈕

**Checkpoint**: 對話框正確顯示警告並禁用提交

---

## Phase 4: User Story 3 & 4 - 保留現有功能 (Priority: P3)

**Goal**: 確認 MEXC 費率數據、持倉和資產顯示功能不受影響

**Independent Test**: 確認市場監控頁面 MEXC 欄位正常顯示，持倉和資產頁面正常運作

### Verification for User Story 3 & 4

- [ ] T005 [US3] [US4] 驗證現有功能不受影響：
  - 確認 MEXC 費率數據在 RatesTable 中正常顯示
  - 確認涉及 MEXC 的套利分析數據正常計算和顯示
  - 確認持倉列表頁面 `/positions` 正常顯示 MEXC 持倉
  - 確認資產頁面 `/assets` 正常顯示 MEXC 餘額

**Checkpoint**: 所有現有 MEXC 相關功能正常運作

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: 建置驗證和最終確認

- [ ] T006 執行 TypeScript 編譯檢查 `pnpm tsc --noEmit`
- [ ] T007 執行 ESLint 檢查 `pnpm lint`
- [ ] T008 執行 Next.js 建置 `pnpm build`
- [ ] T009 依照 quickstart.md 執行手動測試驗證

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **US1 (Phase 2)**: Depends on Setup (T001)
- **US2 (Phase 3)**: Depends on Setup (T001)，可與 US1 平行執行
- **US3 & US4 (Phase 4)**: 驗證任務，可在任何時候執行
- **Polish (Phase 5)**: Depends on US1 and US2 completion

### User Story Dependencies

- **User Story 1 (P1)**: 依賴 T001 配置模組
- **User Story 2 (P2)**: 依賴 T001 配置模組，與 US1 獨立
- **User Story 3 & 4 (P3)**: 無程式碼變更，僅驗證

### Parallel Opportunities

```bash
# Phase 2 和 Phase 3 可平行執行（不同檔案）:
# T002-T003 (OpenPositionButton + RateRow)
# T004 (OpenPositionDialog)

# 可同時進行：
Task: "T002 [US1] 修改 OpenPositionButton.tsx"
Task: "T004 [US2] 修改 OpenPositionDialog.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: User Story 1 (T002-T003)
3. **STOP and VALIDATE**: 測試禁用按鈕和 Tooltip
4. 如果 MVP 足夠，可先部署

### Full Implementation

1. Complete Setup (T001)
2. Complete US1 (T002-T003) 和 US2 (T004) 可平行
3. Verify US3 & US4 (T005)
4. Polish (T006-T009)
5. Commit and merge

---

## Notes

- 此功能為純前端 UI 變更，無後端 API 或資料庫變更
- 預估總工作量：1-2 小時
- 關鍵配置：`RESTRICTED_EXCHANGES.mexc.externalUrl = 'https://futures.mexc.com/exchange'`
- 樣式：使用 amber/yellow 警告色調
