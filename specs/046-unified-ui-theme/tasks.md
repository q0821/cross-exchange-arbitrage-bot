# Tasks: 統一 UI 主題系統

**Input**: Design documents from `/specs/046-unified-ui-theme/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: E2E 視覺測試使用 Playwright，依需求添加

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 安裝依賴並建立主題基礎設施

- [ ] T001 安裝 next-themes 依賴: `pnpm add next-themes`
- [ ] T002 [P] 更新 CSS 變數系統 - 添加主題色彩和語意色彩至 `app/globals.css`
- [ ] T003 [P] 擴展 Tailwind 配置 - 添加 profit/loss/warning 色彩至 `tailwind.config.js`
- [ ] T004 建立 ThemeProvider 封裝 `app/providers.tsx`
- [ ] T005 更新根佈局整合 ThemeProvider `app/layout.tsx`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 建立共用元件，所有頁面遷移前必須完成

**⚠️ CRITICAL**: 無法在此階段完成前開始頁面遷移

- [ ] T006 建立 ThemeToggle 元件 `components/ui/theme-toggle.tsx`
- [ ] T007 [P] 建立 GlassCard 元件 `components/ui/glass-card.tsx`
- [ ] T008 [P] 添加 Glassmorphism CSS utilities 至 `app/globals.css`
- [ ] T009 [P] 添加 Bento Grid CSS utilities 至 `app/globals.css`
- [ ] T010 更新 DashboardLayoutClient 添加 ThemeToggle 至導航列 `app/(dashboard)/DashboardLayoutClient.tsx`

**Checkpoint**: 基礎設施就緒 - 可開始頁面遷移

---

## Phase 3: User Story 1 + 2 - 主題偏好自動適應 & 一致的視覺體驗 (Priority: P1) 🎯 MVP

**Goal**: 系統自動偵測並套用系統主題偏好，所有頁面呈現統一的視覺風格

**Independent Test**: 切換作業系統主題設定，驗證所有頁面即時響應並呈現一致配色

### Implementation for User Story 1 + 2

- [ ] T011 [US1] 遷移 DashboardLayoutClient 配色 - 移除硬編碼 gray 類別，使用語意化類別 `app/(dashboard)/DashboardLayoutClient.tsx`
- [ ] T012 [P] [US2] 遷移資產總覽頁面 - 移除深色硬編碼，統一為主題感知 `app/(dashboard)/assets/page.tsx`
- [ ] T013 [P] [US2] 遷移 TotalAssetCard 元件 `app/(dashboard)/assets/components/TotalAssetCard.tsx`
- [ ] T014 [P] [US2] 遷移 AssetSummaryCard 元件 `app/(dashboard)/assets/components/AssetSummaryCard.tsx`
- [ ] T015 [P] [US2] 遷移 AssetHistoryChart 元件 `app/(dashboard)/assets/components/AssetHistoryChart.tsx`
- [ ] T016 [P] [US2] 遷移 PositionTable 元件（資產頁） `app/(dashboard)/assets/components/PositionTable.tsx`
- [ ] T017 [P] [US2] 遷移市場監控頁面 `app/(dashboard)/market-monitor/page.tsx`
- [ ] T018 [P] [US2] 遷移 StatsCard 元件 `app/(dashboard)/market-monitor/components/StatsCard.tsx`
- [ ] T019 [P] [US2] 遷移 RatesTable 元件 `app/(dashboard)/market-monitor/components/RatesTable.tsx`
- [ ] T020 [P] [US2] 遷移 RateRow 元件 `app/(dashboard)/market-monitor/components/RateRow.tsx`
- [ ] T021 [P] [US2] 遷移持倉管理頁面 `app/(dashboard)/positions/page.tsx`
- [ ] T022 [P] [US2] 遷移 PositionCard 元件 `app/(dashboard)/positions/components/PositionCard.tsx`
- [ ] T023 [P] [US2] 遷移 PositionDetailsPanel 元件 `app/(dashboard)/positions/components/PositionDetailsPanel.tsx`
- [ ] T024 [P] [US2] 遷移交易歷史頁面 `app/(dashboard)/trades/page.tsx`
- [ ] T025 [P] [US2] 遷移 TradeCard 元件 `app/(dashboard)/trades/components/TradeCard.tsx`
- [ ] T026 [P] [US2] 遷移模擬追蹤頁面 `app/(dashboard)/simulated-tracking/page.tsx`
- [ ] T027 [P] [US2] 遷移 API 金鑰設定頁面 `app/(dashboard)/settings/api-keys/page.tsx`
- [ ] T028 [P] [US2] 遷移通知設定頁面 `app/(dashboard)/settings/notifications/page.tsx`
- [ ] T029 [P] [US2] 遷移交易設定頁面 `app/(dashboard)/settings/trading/page.tsx`
- [ ] T030 [US1] 驗證系統主題偵測功能 - 測試 prefers-color-scheme 響應

**Checkpoint**: 所有六個主要頁面在深色/淺色模式下呈現一致配色，系統主題自動適應

---

## Phase 4: User Story 3 - 手動主題切換 (Priority: P2)

**Goal**: 用戶可手動選擇淺色、深色或跟隨系統，偏好設定被持久化

**Independent Test**: 點擊主題切換按鈕，選擇深色模式，重新整理頁面驗證設定被保留

### Implementation for User Story 3

- [ ] T031 [US3] 增強 ThemeToggle 元件 - 添加下拉選單支援三種模式 `components/ui/theme-toggle.tsx`
- [ ] T032 [US3] 添加主題選項 UI - 淺色/深色/跟隨系統選項與圖示 `components/ui/theme-toggle.tsx`
- [ ] T033 [US3] 驗證 localStorage 持久化 - 確認 theme 值正確儲存與讀取

**Checkpoint**: 主題切換功能完整，偏好設定在瀏覽器重啟後保留

---

## Phase 5: User Story 4 - Glassmorphism 毛玻璃視覺效果 (Priority: P2)

**Goal**: 卡片元件具有半透明背景和模糊效果，舊版瀏覽器有降級方案

**Independent Test**: 檢查卡片是否具有毛玻璃效果，在不支援 backdrop-filter 的環境中是否正常顯示

### Implementation for User Story 4

- [ ] T034 [P] [US4] 應用 GlassCard 至資產總覽卡片 `app/(dashboard)/assets/components/TotalAssetCard.tsx`
- [ ] T035 [P] [US4] 應用 GlassCard 至交易所摘要卡片 `app/(dashboard)/assets/components/AssetSummaryCard.tsx`
- [ ] T036 [P] [US4] 應用 GlassCard 至市場監控統計卡片 `app/(dashboard)/market-monitor/components/StatsCard.tsx`
- [ ] T037 [P] [US4] 應用 GlassCard 至持倉卡片 `app/(dashboard)/positions/components/PositionCard.tsx`
- [ ] T038 [P] [US4] 應用 GlassCard 至交易卡片 `app/(dashboard)/trades/components/TradeCard.tsx`
- [ ] T039 [US4] 驗證 @supports 降級方案 - 測試不支援 backdrop-filter 時的純色降級

**Checkpoint**: 所有卡片具有毛玻璃效果，降級方案正常運作

---

## Phase 6: User Story 5 - Bento Grid 版面佈局 (Priority: P3)

**Goal**: 資產總覽頁面採用 Bento Grid 佈局，響應式支援桌面/平板/手機

**Independent Test**: 檢查資產總覽頁面在不同螢幕尺寸下的佈局變化

### Implementation for User Story 5

- [ ] T040 [US5] 重構資產總覽頁面佈局為 Bento Grid `app/(dashboard)/assets/page.tsx`
- [ ] T041 [US5] 調整總資產卡片為大尺寸佔位 (span-2) `app/(dashboard)/assets/components/TotalAssetCard.tsx`
- [ ] T042 [US5] 調整資產曲線圖為大尺寸佔位 (span-2) `app/(dashboard)/assets/components/AssetHistoryChart.tsx`
- [ ] T043 [US5] 調整持倉表格為全寬佔位 (span-full) `app/(dashboard)/assets/components/PositionTable.tsx`
- [ ] T044 [US5] 實作響應式斷點 - 平板 (768-1023px) 雙欄佈局 `app/(dashboard)/assets/page.tsx`
- [ ] T045 [US5] 實作響應式斷點 - 手機 (<768px) 單欄堆疊 `app/(dashboard)/assets/page.tsx`

**Checkpoint**: 資產總覽頁面在所有螢幕尺寸下呈現正確的 Bento Grid 佈局

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 最終驗證、效能優化和邊界情況處理

- [ ] T046 [P] 驗證 WCAG 2.1 AA 色彩對比度 - 使用 Chrome DevTools 檢查所有頁面
- [ ] T047 [P] 驗證無 FOUC - 測試頁面載入時無主題閃爍
- [ ] T048 [P] 測試邊界情況 - localStorage 清除後重置為跟隨系統
- [ ] T049 [P] 測試邊界情況 - JavaScript 禁用時顯示淺色主題
- [ ] T050 執行 quickstart.md 驗證 - 確認所有步驟可正常運作
- [ ] T051 更新 CLAUDE.md 文件 - 添加主題系統相關路徑說明

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all page migrations
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - US1+US2 (P1) → US3 (P2) → US4 (P2) → US5 (P3)
  - US3 和 US4 可平行執行（都是 P2）
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1+2 (P1)**: Can start after Phase 2 - Foundation of all theme functionality
- **User Story 3 (P2)**: Can start after Phase 2 - Enhances ThemeToggle from Phase 2
- **User Story 4 (P2)**: Can start after Phase 3 - Applies GlassCard to migrated components
- **User Story 5 (P3)**: Can start after Phase 3 - Restructures assets page layout

### Within Each User Story

- 頁面遷移任務 (T012-T029) 可平行執行
- GlassCard 應用任務 (T034-T038) 可平行執行
- Bento Grid 佈局調整需依序執行

### Parallel Opportunities

- Phase 1: T002 和 T003 可平行執行
- Phase 2: T007, T008, T009 可平行執行
- Phase 3: T012-T029 所有頁面/元件遷移可平行執行
- Phase 5: T034-T038 所有 GlassCard 應用可平行執行
- Phase 7: T046-T049 所有驗證任務可平行執行

---

## Parallel Example: Phase 3 Page Migration

```bash
# 所有頁面遷移可同時進行：
Task: "遷移資產總覽頁面 app/(dashboard)/assets/page.tsx"
Task: "遷移市場監控頁面 app/(dashboard)/market-monitor/page.tsx"
Task: "遷移持倉管理頁面 app/(dashboard)/positions/page.tsx"
Task: "遷移交易歷史頁面 app/(dashboard)/trades/page.tsx"
Task: "遷移模擬追蹤頁面 app/(dashboard)/simulated-tracking/page.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1+2 Only)

1. Complete Phase 1: Setup (T001-T005)
2. Complete Phase 2: Foundational (T006-T010)
3. Complete Phase 3: User Story 1+2 (T011-T030)
4. **STOP and VALIDATE**: 測試所有頁面主題一致性
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → 基礎設施就緒
2. Add US1+US2 → 所有頁面統一配色 (MVP!)
3. Add US3 → 手動主題切換功能
4. Add US4 → Glassmorphism 視覺增強
5. Add US5 → Bento Grid 佈局優化
6. Each story adds visual value without breaking previous stories

### Single Developer Strategy

按優先級順序完成：
1. Phase 1-2: 建立基礎 (~30 分鐘)
2. Phase 3: 所有頁面遷移 (~2 小時)
3. Phase 4: 主題切換增強 (~30 分鐘)
4. Phase 5: Glassmorphism 應用 (~1 小時)
5. Phase 6: Bento Grid 佈局 (~1 小時)
6. Phase 7: 驗證和收尾 (~30 分鐘)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- 頁面遷移主要是將 `bg-gray-*` 替換為 `bg-background`、`text-gray-*` 替換為 `text-foreground`
- GlassCard 應用需確保降級方案正常運作
- Bento Grid 需在三種螢幕尺寸下測試
- 避免: 在同一檔案的多個任務同時進行
