# Tasks: 追蹤記錄累計收益 Tooltip 明細

**Feature**: 030-specify-scripts-bash
**Generated**: 2025-12-02
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Summary

| Metric | Value |
|--------|-------|
| Total Tasks | 6 |
| User Stories | 2 |
| Parallel Opportunities | 2 |
| MVP Scope | US1 (P1) |

## Dependencies

```
Phase 1 (Setup) → Phase 2 (US1) → Phase 3 (US2) → Phase 4 (Polish)
                       ↓
              Independent Test: 驗證 Tooltip 顯示完整資訊
```

---

## Phase 1: Setup

*無需額外設定 - 使用現有專案結構和依賴*

---

## Phase 2: User Story 1 - 查看累計收益明細 (P1)

**Goal**: 用戶在歷史追蹤記錄頁面，滑鼠移到「累計收益」數值時顯示 Tooltip 明細

**Independent Test**:
1. 前往 `/simulated-tracking` 頁面
2. 在歷史記錄區找到任一筆追蹤
3. 將滑鼠移到「累計收益」數值上
4. 驗證 Tooltip 顯示：開倉價格、關倉價格、結算次數、資費收益

### Tasks

- [x] T001 [US1] 更新 TrackingData interface 加入 exitLongPrice, exitShortPrice, fundingPnl, pricePnl 欄位 in `app/(dashboard)/simulated-tracking/components/TrackingHistoryTable.tsx`

- [x] T002 [US1] 同步更新 TrackingData interface in `app/(dashboard)/simulated-tracking/page.tsx`

- [x] T003 [US1] Import Radix UI Tooltip 元件 in `app/(dashboard)/simulated-tracking/components/TrackingHistoryTable.tsx`

- [x] T004 [US1] 在累計收益欄位 (Profit cell) 加入 Tooltip.Provider, Tooltip.Root, Tooltip.Trigger, Tooltip.Content 結構 in `app/(dashboard)/simulated-tracking/components/TrackingHistoryTable.tsx`

---

## Phase 3: User Story 2 - 處理部分資料缺失情況 (P2)

**Goal**: 當追蹤記錄缺少部分價格資料時，Tooltip 仍能正常顯示已有的資訊

**Independent Test**:
1. 找到缺少關倉價格的追蹤記錄（仍在追蹤中）
2. 驗證 Tooltip 該欄位顯示 "N/A"

### Tasks

- [x] T005 [US2] 在 Tooltip 內容中使用 optional chaining 和 nullish coalescing 處理 null 價格 in `app/(dashboard)/simulated-tracking/components/TrackingHistoryTable.tsx`

---

## Phase 4: Polish

### Tasks

- [x] T006 執行 TypeScript 編譯檢查確認無錯誤

---

## Parallel Execution

**可平行執行的任務組合**:

| 組合 | 任務 | 原因 |
|------|------|------|
| 1 | T001, T002 | 不同檔案，無相依性 |

---

## Implementation Strategy

1. **MVP (US1)**: 實作基本 Tooltip 顯示功能
2. **Enhancement (US2)**: 處理資料缺失邊界情況
3. **Polish**: TypeScript 驗證

---

## Completion Status

✅ **All tasks completed** - Feature 030 implementation finished
