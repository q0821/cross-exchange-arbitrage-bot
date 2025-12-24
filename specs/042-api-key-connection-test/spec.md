# Feature Specification: API Key 連線測試

**Feature Branch**: `042-api-key-connection-test`
**Created**: 2025-12-24
**Status**: Draft
**Input**: User description: "在輸入 api key 的時候，希望可以做連線測試"

## Clarifications

### Session 2025-12-24

- Q: 當 API Key 連線測試失敗時，系統應該如何處理儲存請求？ → A: 允許儲存但顯示警告：顯示警告訊息但仍允許用戶選擇儲存

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 新增 API Key 時測試連線 (Priority: P1)

用戶在新增 API Key 時，希望能夠在儲存之前先測試連線是否成功。這可以避免儲存無效的 API Key，並確認該 API Key 具有所需的權限。

**Why this priority**: 這是核心功能，直接回應用戶的需求。在儲存前測試可以避免無效 API Key 進入系統，減少後續交易失敗的風險。

**Independent Test**: 可透過在 API Key 設定頁面填入資訊並點擊「測試連線」按鈕來獨立測試，成功則顯示連線狀態和權限資訊。

**Acceptance Scenarios**:

1. **Given** 用戶在新增 API Key 表單中填入有效的 API Key 和 Secret，**When** 用戶點擊「測試連線」按鈕，**Then** 系統顯示連線成功訊息，並顯示該 API Key 的權限狀態（如：讀取權限、交易權限）。

2. **Given** 用戶填入無效的 API Key 或 Secret，**When** 用戶點擊「測試連線」按鈕，**Then** 系統顯示連線失敗訊息，並說明失敗原因（如：無效的 API Key、權限不足、簽名錯誤）。

3. **Given** 用戶選擇 OKX 交易所但未填入 Passphrase，**When** 用戶點擊「測試連線」按鈕，**Then** 系統提示用戶 OKX 需要 Passphrase。

4. **Given** 用戶填入的 API Key 有效但缺少交易權限，**When** 用戶點擊「測試連線」按鈕，**Then** 系統顯示連線成功但警告交易權限不足，建議用戶確認是否需要交易功能。

5. **Given** 用戶測試連線失敗，**When** 用戶點擊「儲存」按鈕，**Then** 系統顯示警告訊息提醒用戶 API Key 可能無效，但仍允許用戶確認後儲存。

---

### User Story 2 - 對現有 API Key 重新測試連線 (Priority: P2)

用戶希望能夠對已儲存的 API Key 進行重新測試，以確認 API Key 仍然有效（例如：API Key 可能已被交易所撤銷或過期）。

**Why this priority**: 這是輔助功能，幫助用戶維護現有的 API Key 狀態。優先級較低是因為主要需求是新增時的測試。

**Independent Test**: 可透過在 API Key 列表中點擊現有 API Key 的「重新測試」按鈕來獨立測試。

**Acceptance Scenarios**:

1. **Given** 用戶有一個已儲存的有效 API Key，**When** 用戶點擊該 API Key 的「重新測試」按鈕，**Then** 系統顯示測試中狀態，測試完成後更新該 API Key 的驗證時間和狀態。

2. **Given** 用戶有一個已儲存但已失效的 API Key（例如已在交易所撤銷），**When** 用戶點擊「重新測試」按鈕，**Then** 系統顯示連線失敗，並將該 API Key 標記為無效狀態。

---

### User Story 3 - 顯示 API Key 權限詳情 (Priority: P3)

用戶希望能夠看到 API Key 的詳細權限資訊，包括讀取權限、交易權限、提款權限等，以便確認 API Key 的配置是否符合需求。

**Why this priority**: 這是進階功能，提供更詳細的資訊。基本的連線測試功能完成後再實作。

**Independent Test**: 可透過測試連線後查看權限詳情面板來獨立測試。

**Acceptance Scenarios**:

1. **Given** 用戶完成 API Key 連線測試，**When** 測試成功，**Then** 系統顯示權限詳情，包括：讀取權限（帳戶餘額、持倉資訊）、交易權限（下單、撤單）、提款權限狀態。

2. **Given** API Key 缺少某些權限，**When** 顯示權限詳情，**Then** 缺少的權限以警告樣式標示，並提供說明文字。

---

### Edge Cases

- 網路連線不穩定時，測試應有適當的超時處理和錯誤訊息
- 交易所 API 暫時不可用時，應區分是 API Key 問題還是交易所問題
- 用戶快速連續點擊測試按鈕時，應防止重複請求
- 測試過程中用戶關閉對話框，應適當取消進行中的請求

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系統 MUST 在新增 API Key 表單中提供「測試連線」按鈕
- **FR-002**: 系統 MUST 支援測試所有已支援的交易所（Binance、OKX、Gate.io、MEXC）
- **FR-003**: 系統 MUST 在測試時驗證 API Key 的基本連線能力
- **FR-004**: 系統 MUST 在測試時檢查 API Key 的讀取權限（查詢帳戶資訊）
- **FR-005**: 系統 MUST 在測試時檢查 API Key 的交易權限
- **FR-006**: 系統 MUST 在測試進行中顯示載入狀態
- **FR-007**: 系統 MUST 在測試失敗時顯示明確的錯誤訊息
- **FR-008**: 系統 MUST 在 API Key 列表中提供「重新測試」功能
- **FR-009**: 系統 MUST 在測試成功後更新 API Key 的最後驗證時間
- **FR-010**: 系統 MUST 在測試過程中有適當的超時處理（建議 30 秒）
- **FR-011**: 系統 MUST 防止用戶在測試進行中重複發起測試請求
- **FR-012**: 系統 MUST 在測試失敗時仍允許儲存 API Key，但須顯示警告訊息讓用戶確認

### Key Entities

- **ApiKey**: 現有實體，新增 `validationStatus` 概念（valid/invalid/unknown）用於顯示
- **ConnectionTestResult**: 測試結果資訊，包含連線狀態、權限詳情、錯誤訊息

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 用戶可在 5 秒內得知 API Key 是否有效（正常網路環境下）
- **SC-002**: 95% 的有效 API Key 測試能正確回報成功狀態
- **SC-003**: 100% 的無效 API Key 測試能正確回報失敗狀態並說明原因
- **SC-004**: 用戶首次新增 API Key 時，90% 以上會使用測試功能
- **SC-005**: 測試功能能正確識別至少 3 種權限狀態（讀取、交易、無權限）

## Assumptions

- 各交易所的 API 具有標準的帳戶查詢端點可用於驗證
- 用戶的網路環境能夠連接到各交易所的 API 服務
- 測試連線不會觸發交易所的 Rate Limit（使用低頻率的查詢端點）
- 現有的 `ApiKeyValidator` 類別架構可以擴展來支援此功能
