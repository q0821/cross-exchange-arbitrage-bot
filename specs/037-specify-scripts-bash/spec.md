# Feature Specification: 手動標記持倉已平倉

**Feature Branch**: `037-mark-position-closed`
**Created**: 2025-12-19
**Status**: Draft
**Input**: User description: "手動標記持倉已平倉功能：用戶在交易所手動平倉後，系統 UI 仍顯示舊的測試倉位。需要提供 API 和 UI 讓用戶手動標記這些倉位為「已平倉」。包含：1) PATCH /api/positions/[id] API 端點允許更新狀態為 CLOSED，2) 在 PositionCard 新增「標記已平倉」按鈕"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 標記單一持倉為已平倉 (Priority: P1)

作為一個用戶，我已經在交易所手動平倉了某個持倉，但系統 UI 仍顯示該持倉為「持倉中」狀態。我需要能夠在系統中將該持倉標記為「已平倉」，以保持系統記錄與實際情況一致。

**Why this priority**: 這是核心功能，解決用戶無法清理過時持倉記錄的問題。沒有此功能，用戶會看到不準確的持倉列表，造成困惑。

**Independent Test**: 可以通過創建一個測試持倉、手動標記為已平倉、並驗證狀態變更來獨立測試。

**Acceptance Scenarios**:

1. **Given** 用戶有一個狀態為「持倉中」(OPEN) 的持倉記錄，**When** 用戶點擊「標記已平倉」按鈕，**Then** 該持倉狀態變更為「已平倉」(CLOSED)，並從活躍持倉列表中移除
2. **Given** 用戶有一個狀態為「需手動處理」(PARTIAL) 的持倉記錄，**When** 用戶點擊「標記已平倉」按鈕，**Then** 該持倉狀態變更為「已平倉」(CLOSED)
3. **Given** 用戶有一個狀態為「失敗」(FAILED) 的持倉記錄，**When** 用戶點擊「標記已平倉」按鈕，**Then** 該持倉狀態變更為「已平倉」(CLOSED)

---

### User Story 2 - 查看已平倉記錄 (Priority: P2)

作為一個用戶，在標記持倉為已平倉後，我希望能夠在歷史記錄中查看這些已平倉的持倉，以便追蹤和審計。

**Why this priority**: 這是輔助功能，幫助用戶查看歷史記錄。主要功能（標記為已平倉）完成後才需要此功能。

**Independent Test**: 可以通過標記多個持倉為已平倉、然後查詢已平倉列表來獨立測試。

**Acceptance Scenarios**:

1. **Given** 用戶已將持倉標記為已平倉，**When** 用戶查詢持倉列表並選擇顯示「已平倉」狀態，**Then** 可以看到所有已平倉的持倉記錄

---

### Edge Cases

- 當用戶嘗試標記一個已經是「已平倉」狀態的持倉時，系統應顯示適當提示或禁用按鈕
- 當用戶嘗試標記一個正在「開倉中」(OPENING) 或「平倉中」(CLOSING) 的持倉時，系統應禁止此操作並顯示提示
- 當網路錯誤導致標記操作失敗時，系統應顯示錯誤訊息並允許用戶重試
- 當用戶在沒有登入的情況下嘗試標記持倉時，系統應要求用戶登入

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系統必須提供手動標記持倉為「已平倉」的功能
- **FR-002**: 系統必須只允許用戶標記自己的持倉
- **FR-003**: 系統必須只允許將以下狀態的持倉標記為已平倉：OPEN、PARTIAL、FAILED
- **FR-004**: 系統必須禁止標記 PENDING、OPENING、CLOSING 狀態的持倉
- **FR-005**: 系統必須在標記成功後自動記錄平倉時間
- **FR-006**: 系統必須在持倉卡片上顯示「標記已平倉」按鈕（針對可標記的狀態）
- **FR-007**: 系統必須在操作完成後刷新持倉列表

### Key Entities *(include if feature involves data)*

- **Position（持倉）**: 現有實體，需要更新其狀態 (status) 和平倉時間 (closedAt) 欄位
- **PositionWebStatus**: 現有枚舉，包含 PENDING、OPENING、OPEN、CLOSING、CLOSED、FAILED、PARTIAL 狀態

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 用戶可以在 3 秒內完成單一持倉的標記操作
- **SC-002**: 標記操作成功率達到 99% 以上（排除網路錯誤）
- **SC-003**: 用戶能夠在持倉列表中直接操作，無需離開頁面或額外步驟
- **SC-004**: 標記後的持倉從活躍列表中移除，減少用戶困惑

## Assumptions

- 用戶已經在交易所手動平倉，只需要在系統中同步狀態
- 此功能不涉及實際的交易所操作，僅更新本地資料庫記錄
- 用戶已登入並有權限管理自己的持倉
- 現有的認證和授權機制已經就位
