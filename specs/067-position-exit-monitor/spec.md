# Feature Specification: 持倉平倉建議監控 (Position Exit Monitor)

**Feature Branch**: `067-position-exit-monitor`
**Created**: 2026-01-21
**Status**: Draft
**Input**: User description: "套利機會消失觸發機制 - 實作持倉平倉建議功能（PositionExitMonitor），當 APY < 0% 或 (APY < X% AND 累計費率收益 > 價差損失) 時，透過 WebSocket 和 Discord/Slack 通知用戶建議平倉。"

---

## Background & Context

### 系統現狀

目前系統已有以下相關功能：

1. **ArbitrageOpportunityTracker** (Feature 065)：追蹤市場上的套利機會，當 APY < 0% 時標記為機會消失。這是純市場記錄，不涉及用戶持倉。

2. **Position 管理** (Feature 033/035)：用戶可以手動開倉/平倉，但缺乏主動的平倉建議機制。

3. **通知系統** (Feature 026/027)：支援 Discord/Slack webhook 通知，目前用於套利機會偵測和消失通知。

### 問題陳述

用戶開倉後，可能因為以下情況錯過最佳平倉時機：
- 套利機會已經消失（APY 轉負），繼續持有會虧損
- APY 已大幅下降，但累計收益仍為正，可以獲利了結

用戶需要一個主動監控系統，在適當時機發送平倉建議通知。

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 接收平倉建議通知 (Priority: P1)

交易者開倉後，系統持續監控該持倉的套利狀態。當 APY 下降至閾值以下且整體仍有獲利時，用戶會收到平倉建議通知，讓用戶決定是否平倉鎖定獲利。

**Why this priority**: 這是核心功能，直接影響用戶的交易決策和獲利能力。沒有此功能，用戶可能在不知情的情況下錯過最佳平倉時機。

**Independent Test**: 可透過開啟一個測試持倉，模擬 APY 變化，驗證通知是否正確發送。

**Acceptance Scenarios**:

1. **Given** 用戶有一個 OPEN 狀態的持倉且 APY 轉為負值
   **When** 系統偵測到費率更新
   **Then** 用戶透過 WebSocket 收到平倉建議，包含原因、當前 APY、累計收益、價差損失、淨收益等資訊

2. **Given** 用戶有一個 OPEN 狀態的持倉，APY 低於用戶設定的閾值（預設 100%），且累計費率收益大於價差損失
   **When** 系統偵測到費率更新
   **Then** 用戶透過 WebSocket 收到平倉建議，說明雖然 APY 下降但整體仍有獲利

3. **Given** 用戶已設定 Discord/Slack webhook 且啟用平倉建議通知
   **When** 系統發送平倉建議
   **Then** 用戶同時在 Discord/Slack 收到相同的平倉建議訊息

4. **Given** 同一持倉在 1 分鐘內已發送過平倉建議
   **When** 系統再次偵測到符合建議條件
   **Then** 系統不會重複發送通知（防抖動機制）

---

### User Story 2 - 設定平倉建議偏好 (Priority: P2)

交易者可以在設定頁面調整平倉建議的相關參數，包含是否啟用、APY 閾值等，以符合個人的交易策略。

**Why this priority**: 讓用戶可以根據自己的風險偏好調整通知敏感度，提升用戶體驗。

**Independent Test**: 可透過修改設定並驗證系統行為是否相應改變。

**Acceptance Scenarios**:

1. **Given** 用戶進入交易設定頁面
   **When** 用戶修改平倉建議 APY 閾值為 50%
   **Then** 系統儲存新設定，後續只有當 APY 低於 50% 時才會觸發建議

2. **Given** 用戶停用平倉建議功能
   **When** 持倉的 APY 轉為負值
   **Then** 系統不會發送平倉建議通知

3. **Given** 用戶啟用 Discord 平倉建議通知
   **When** 系統發送平倉建議
   **Then** 用戶透過 Discord 收到格式化的平倉建議訊息

---

### User Story 3 - 在持倉頁面看到平倉建議警告 (Priority: P3)

交易者在持倉列表頁面可以即時看到哪些持倉被建議平倉，並瞭解建議原因。

**Why this priority**: 提供視覺化提示，讓用戶即使錯過通知也能在查看持倉時注意到建議。

**Independent Test**: 可透過前端 UI 直接驗證警告顯示。

**Acceptance Scenarios**:

1. **Given** 用戶有一個被建議平倉的持倉
   **When** 用戶開啟持倉列表頁面
   **Then** 該持倉顯示醒目的平倉建議警告，包含建議原因

2. **Given** 用戶的持倉 APY 從負值回升至正值
   **When** 系統偵測到 APY 回升
   **Then** 平倉建議警告消失，用戶收到「建議取消」的 WebSocket 事件

---

### Edge Cases

- 當交易所 API 無法取得即時價格時，系統應使用最後已知價格計算，並在通知中標註資料可能延遲
- 當多個持倉同時符合平倉建議條件時，系統應並行處理並分別發送通知
- 當用戶尚未設定 TradingSettings 時，系統應使用預設值（啟用、100% 閾值）
- 當持倉正在平倉中（CLOSING 狀態）時，不應發送平倉建議
- 當計算累計費率收益時發生錯誤，應記錄錯誤日誌但不中斷其他持倉的監控

---

## Requirements *(mandatory)*

### Functional Requirements

#### 監控與觸發

- **FR-001**: 系統 MUST 監聽費率更新事件，檢查所有 OPEN 狀態的持倉是否符合平倉建議條件
- **FR-002**: 系統 MUST 支援兩種平倉建議觸發條件：
  - 條件 A：APY < 0%（強制建議，因為繼續持有會虧損）
  - 條件 B：APY < X% 且累計費率收益 > 價差損失（整體有獲利可鎖定）
- **FR-003**: 系統 MUST 對每個持倉實施 1 分鐘的通知防抖動，避免頻繁發送相同建議

#### 計算邏輯

- **FR-004**: 系統 MUST 計算持倉的累計資金費率收益，透過查詢開倉至今的資金費率結算記錄
- **FR-005**: 系統 MUST 計算當前平倉的價差損失，公式為：(當前多頭價 - 開倉多頭價) - (當前空頭價 - 開倉空頭價)
- **FR-006**: 系統 MUST 快取累計資金費率收益，避免頻繁查詢交易所 API（5 分鐘 TTL）

#### 通知

- **FR-007**: 系統 MUST 透過 WebSocket 推送平倉建議事件，包含以下資訊：
  - 持倉 ID 和交易對符號
  - 建議原因（APY 轉負 / 獲利可鎖定）
  - 當前 APY
  - 累計費率收益
  - 價差損失
  - 淨收益（累計費率收益 - 價差損失）
- **FR-008**: 系統 MUST 支援 Discord/Slack webhook 通知，用戶可選擇是否啟用
- **FR-009**: 系統 MUST 在 APY 回升且不再符合建議條件時，發送「建議取消」事件

#### 用戶設定

- **FR-010**: 用戶 MUST 能夠啟用/停用平倉建議功能（預設啟用）
- **FR-011**: 用戶 MUST 能夠設定平倉建議 APY 閾值（預設 100%，範圍 0-500%）
- **FR-012**: 用戶 MUST 能夠啟用/停用 Discord/Slack 平倉建議通知（預設啟用）

#### 前端顯示

- **FR-013**: 持倉卡片 MUST 在持倉被建議平倉時顯示醒目警告
- **FR-014**: 警告 MUST 包含建議原因和關鍵數據（APY、淨收益）

### Key Entities

- **TradingSettings（擴展）**: 用戶交易設定，新增平倉建議相關設定（是否啟用、閾值、通知偏好）
- **Position（擴展）**: 持倉資訊，新增累計費率收益快取、平倉建議狀態及原因
- **ExitSuggestion（計算結果）**: 平倉建議的計算結果，包含原因、各項數據、建議時間

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 當 APY 轉負時，用戶在 10 秒內收到平倉建議通知
- **SC-002**: 通知防抖動機制確保同一持倉在 1 分鐘內最多發送 1 次通知
- **SC-003**: 累計費率收益計算的快取命中率達 80% 以上
- **SC-004**: 100% 的平倉建議包含完整的決策資訊（APY、累計收益、價差損失、淨收益）
- **SC-005**: 用戶設定修改後，下一次費率更新即生效新設定

---

## Assumptions

1. 現有的 FundingRateMonitor 會發出費率更新事件，新服務可以監聽此事件
2. 累計資金費率收益可以透過交易所 API 的資金費率歷史或訂單歷史計算
3. 用戶已經設定 Discord/Slack webhook（來自 Feature 026）
4. 即時價格可以透過現有的 PriceMonitor 或交易所 API 取得
5. WebSocket 基礎設施已經建立（來自 Feature 052）

---

## Out of Scope

- 自動平倉執行（本功能僅提供建議，不自動執行交易）
- 歷史平倉建議記錄查詢
- 平倉建議的機器學習最佳化
- 多語言通知內容
