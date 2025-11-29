# Feature Specification: Discord/Slack 套利機會即時推送通知

**Feature Branch**: `026-discord-slack-notification`
**Created**: 2025-11-29
**Status**: Draft
**Input**: User description: "當套利機會的年化收益超過用戶設定的閾值時，自動推送通知到用戶自訂的 Discord/Slack Webhook"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 新增 Webhook 設定 (Priority: P1)

用戶進入通知設定頁面，可以新增 Discord 或 Slack 的 Webhook URL，設定名稱和觸發閾值（年化收益百分比）。

**Why this priority**: 這是整個通知功能的基礎，沒有 Webhook 設定就無法發送任何通知。

**Independent Test**: 可以透過在設定頁面新增一個 Webhook，並驗證資料是否正確儲存到資料庫來獨立測試。

**Acceptance Scenarios**:

1. **Given** 用戶已登入並進入通知設定頁面，**When** 用戶填入 Discord Webhook URL、名稱和閾值 800%，點擊新增，**Then** 系統儲存設定並顯示在列表中。
2. **Given** 用戶已登入並進入通知設定頁面，**When** 用戶填入 Slack Webhook URL、名稱和閾值 1000%，點擊新增，**Then** 系統儲存設定並顯示在列表中。
3. **Given** 用戶填入無效的 Webhook URL，**When** 點擊新增，**Then** 系統顯示驗證錯誤訊息。

---

### User Story 2 - 測試 Webhook 連線 (Priority: P1)

用戶可以對已設定的 Webhook 發送測試訊息，確認連線是否正常。

**Why this priority**: 用戶需要驗證 Webhook 設定是否正確，這是確保通知功能可用的關鍵步驟。

**Independent Test**: 可以透過點擊測試按鈕，檢查 Discord/Slack 是否收到測試訊息來獨立測試。

**Acceptance Scenarios**:

1. **Given** 用戶有一個已設定的 Discord Webhook，**When** 點擊測試按鈕，**Then** Discord 頻道收到測試訊息，UI 顯示「測試成功」。
2. **Given** 用戶有一個已設定的 Slack Webhook，**When** 點擊測試按鈕，**Then** Slack 頻道收到測試訊息，UI 顯示「測試成功」。
3. **Given** 用戶的 Webhook URL 已失效，**When** 點擊測試按鈕，**Then** UI 顯示「測試失敗：無法連線到 Webhook」。

---

### User Story 3 - 自動推送套利機會通知 (Priority: P1)

當系統偵測到年化收益超過用戶設定閾值的套利機會時，自動推送通知到用戶啟用的所有 Webhook。

**Why this priority**: 這是核心功能，讓用戶能即時收到高收益套利機會的通知。

**Independent Test**: 可以透過模擬一個高年化收益的套利機會，檢查是否正確觸發通知來獨立測試。

**Acceptance Scenarios**:

1. **Given** 用戶設定閾值為 800%，有一個啟用的 Discord Webhook，**When** 系統偵測到年化收益 1000% 的套利機會，**Then** Discord 頻道收到包含完整資訊的通知。
2. **Given** 用戶設定閾值為 800%，**When** 系統偵測到年化收益 500% 的套利機會，**Then** 不發送通知。
3. **Given** 用戶有多個啟用的 Webhook（Discord + Slack），**When** 系統偵測到符合條件的套利機會，**Then** 所有啟用的 Webhook 都收到通知。
4. **Given** 用戶的 Webhook 已停用，**When** 系統偵測到符合條件的套利機會，**Then** 不發送通知到該 Webhook。

---

### User Story 4 - 通知內容包含完整資訊 (Priority: P1)

通知內容包含：交易對、做多/做空交易所、原始費率（含 time basis）、標準化 8h 費率、費率差、年化收益、回本週期（收幾次費率）、價差分析（方向是否正確、打平所需次數、套利建議）、交易所直連網址。

**Why this priority**: 完整的資訊讓用戶能快速判斷是否要執行套利操作。

**Independent Test**: 可以透過檢查收到的通知訊息內容是否包含所有必要欄位來獨立測試。

**Acceptance Scenarios**:

1. **Given** 系統偵測到 BTCUSDT 套利機會，做多 Binance（0.0100% / 8h）、做空 OKX（-0.0300% / 4h），**When** 發送通知，**Then** 通知內容包含：
   - 交易對：BTCUSDT
   - 做多交易所：Binance，原始費率 0.0100% / 8h，標準化 8h 費率 0.0100%
   - 做空交易所：OKX，原始費率 -0.0300% / 4h，標準化 8h 費率 -0.0600%
   - 費率差、年化收益、回本週期
   - 價差分析（方向、打平次數、建議）
   - 交易所直連網址

2. **Given** 價差方向正確（做多交易所價格較低），**When** 發送通知，**Then** 價差分析顯示「✅ 正確」和「✅ 適合套利」。

3. **Given** 價差方向反向（做多交易所價格較高 0.05%），需 3 次費率打平，**When** 發送通知，**Then** 價差分析顯示「⚠️ 反向」、「需 3 次費率才能打平價差損失」和「⚠️ 需注意價差風險」。

---

### User Story 5 - 管理 Webhook 設定 (Priority: P2)

用戶可以編輯和刪除已設定的 Webhook，也可以啟用或停用個別 Webhook。

**Why this priority**: 讓用戶能靈活管理通知設定，但核心功能不依賴此功能。

**Independent Test**: 可以透過編輯/刪除/啟停用 Webhook，檢查設定是否正確更新來獨立測試。

**Acceptance Scenarios**:

1. **Given** 用戶有一個已設定的 Webhook，**When** 編輯名稱和閾值後儲存，**Then** 設定更新成功並顯示新的值。
2. **Given** 用戶有一個已設定的 Webhook，**When** 點擊刪除並確認，**Then** Webhook 從列表中移除。
3. **Given** 用戶有一個啟用的 Webhook，**When** 點擊停用，**Then** Webhook 狀態變為停用，不再收到通知。

---

### User Story 6 - 避免重複通知 (Priority: P2)

同一套利機會在 5 分鐘內不重複推送，避免訊息轟炸。

**Why this priority**: 改善用戶體驗，避免因頻繁更新而收到過多相同通知。

**Independent Test**: 可以透過在 5 分鐘內多次觸發同一套利機會，檢查是否只收到一次通知來獨立測試。

**Acceptance Scenarios**:

1. **Given** 剛發送過 BTCUSDT 套利機會通知，**When** 1 分鐘後同一機會再次觸發（年化收益仍超過閾值），**Then** 不重複發送通知。
2. **Given** 剛發送過 BTCUSDT 套利機會通知，**When** 6 分鐘後同一機會再次觸發，**Then** 發送新的通知。
3. **Given** 剛發送過 BTCUSDT 套利機會通知，**When** 1 分鐘後 ETHUSDT 套利機會觸發，**Then** 發送 ETHUSDT 的通知（不同交易對不受限制）。

---

### Edge Cases

- 當 Webhook URL 失效或網路錯誤時，系統應記錄錯誤但不影響其他 Webhook 的發送。
- 當所有 Webhook 都停用時，不執行通知邏輯。
- 當年化收益剛好等於閾值時，視為符合條件並發送通知。
- 當用戶同時設定多個閾值不同的 Webhook 時，每個 Webhook 根據各自的閾值獨立判斷。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系統 MUST 支援 Discord Webhook 通知發送
- **FR-002**: 系統 MUST 支援 Slack Webhook 通知發送
- **FR-003**: 用戶 MUST 能夠新增多個 Webhook 設定
- **FR-004**: 每個 Webhook MUST 可設定獨立的觸發閾值（年化收益百分比）
- **FR-005**: Webhook 閾值預設值 MUST 為 800%
- **FR-006**: 系統 MUST 在年化收益超過用戶設定閾值時自動發送通知
- **FR-007**: 系統 MUST 實作 5 分鐘重複過濾機制，同一套利機會 5 分鐘內不重複推送
- **FR-008**: 通知內容 MUST 包含：交易對、做多/做空交易所資訊、原始費率（含 time basis）、標準化 8h 費率、費率差、年化收益
- **FR-009**: 通知內容 MUST 包含回本週期，以「收幾次費率」為單位
- **FR-010**: 通知內容 MUST 包含價差分析：方向是否正確、反向時打平所需次數、套利建議
- **FR-011**: 通知內容 MUST 包含各交易所交易對的直連網址
- **FR-012**: 用戶 MUST 能夠測試 Webhook 連線
- **FR-013**: 用戶 MUST 能夠啟用/停用個別 Webhook
- **FR-014**: 用戶 MUST 能夠編輯和刪除 Webhook 設定

### Key Entities

- **NotificationWebhook**: 用戶的通知設定，包含平台類型（discord/slack）、Webhook URL、名稱、啟用狀態、觸發閾值。關聯到 User。
- **NotificationMessage**: 通知訊息結構，包含套利機會的完整資訊，用於格式化發送到 Discord/Slack。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 用戶可在 30 秒內完成新增 Webhook 設定
- **SC-002**: 當套利機會符合條件時，通知在 5 秒內發送到所有啟用的 Webhook
- **SC-003**: 5 分鐘內同一套利機會不重複發送通知
- **SC-004**: Discord 和 Slack 通知格式正確顯示，包含所有必要欄位
- **SC-005**: 測試 Webhook 功能可在 3 秒內返回結果
- **SC-006**: Webhook 發送失敗時不影響其他 Webhook 或系統運作
