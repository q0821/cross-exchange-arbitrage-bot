# Feature Specification: 追蹤記錄累計收益 Tooltip 明細

**Feature Branch**: `030-specify-scripts-bash`
**Created**: 2025-12-02
**Status**: Draft
**Input**: User description: "追蹤記錄的部分，請再累計收益的部分，滑鼠指到的時候有一個 tooltip，顯示開倉均價、關倉均價、共收了幾次資金流水，總計多少的明細"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 查看累計收益明細 (Priority: P1)

用戶在模擬追蹤歷史記錄頁面，想要快速了解某筆已完成追蹤的收益組成明細，而不需要點進詳情頁面。

**Why this priority**: 這是本功能的核心需求，提供用戶快速查看收益明細的便利性，減少頁面跳轉。

**Independent Test**: 可以透過將滑鼠移到任一歷史追蹤記錄的「累計收益」欄位上，驗證 Tooltip 是否正確顯示所有明細資訊。

**Acceptance Scenarios**:

1. **Given** 用戶在模擬追蹤列表頁面且有歷史追蹤記錄, **When** 滑鼠移到「累計收益」數值上, **Then** 顯示包含開倉價格、關倉價格、結算次數、資費收益的 Tooltip
2. **Given** Tooltip 已顯示, **When** 滑鼠移開「累計收益」欄位, **Then** Tooltip 消失
3. **Given** 追蹤記錄有完整的開關倉價格資料, **When** 查看 Tooltip, **Then** 顯示兩個交易所的開倉和關倉價格

---

### User Story 2 - 處理部分資料缺失情況 (Priority: P2)

當某些追蹤記錄缺少部分價格資料時（如交易所無報價），Tooltip 仍能正常顯示已有的資訊。

**Why this priority**: 確保功能在資料不完整時的穩健性，提升用戶體驗。

**Independent Test**: 建立一筆缺少關倉價格的追蹤記錄，驗證 Tooltip 能正確顯示已有資料並標示缺失項目為 N/A。

**Acceptance Scenarios**:

1. **Given** 追蹤記錄缺少開倉價格, **When** 查看 Tooltip, **Then** 該價格欄位顯示為 "N/A"
2. **Given** 追蹤記錄缺少關倉價格（仍在追蹤中）, **When** 查看 Tooltip, **Then** 關倉價格欄位顯示為 "N/A" 或 "追蹤中"

---

### Edge Cases

- 當結算次數為 0 時，Tooltip 應顯示「0 次」
- 當所有價格資料都缺失時，Tooltip 仍應顯示結算次數和收益資訊
- 快速連續移動滑鼠時，Tooltip 應正常開關不產生閃爍

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系統 MUST 在歷史追蹤記錄的「累計收益」欄位提供滑鼠懸停 Tooltip
- **FR-002**: Tooltip MUST 顯示做多交易所的開倉價格
- **FR-003**: Tooltip MUST 顯示做空交易所的開倉價格
- **FR-004**: Tooltip MUST 顯示做多交易所的關倉價格
- **FR-005**: Tooltip MUST 顯示做空交易所的關倉價格
- **FR-006**: Tooltip MUST 顯示資金費率結算次數
- **FR-007**: Tooltip MUST 顯示總資費收益金額
- **FR-008**: 當價格資料不存在時，系統 MUST 顯示 "N/A" 作為替代
- **FR-009**: Tooltip MUST 在滑鼠移開後自動消失

### Key Entities

- **TrackingData**: 追蹤記錄資料，包含開關倉價格、結算次數、收益等屬性
- **Tooltip**: UI 元件，負責顯示滑鼠懸停時的明細資訊

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 用戶可在 0.3 秒內看到 Tooltip 顯示（標準滑鼠懸停延遲）
- **SC-002**: Tooltip 內容完整顯示所有 6 項資訊（雙方開倉價、雙方關倉價、結算次數、資費收益）
- **SC-003**: 100% 的歷史追蹤記錄都能正確顯示 Tooltip，無論資料完整性
- **SC-004**: Tooltip 在滑鼠移開後 0.2 秒內消失

## Assumptions

- 專案已安裝 Radix UI Tooltip 元件（已確認存在）
- 資料庫已有 `exitLongPrice`、`exitShortPrice`、`totalSettlements`、`totalFundingProfit` 等欄位（已確認存在）
- 此功能套用於歷史追蹤記錄（已停止或過期的追蹤）
