# Feature Specification: MEXC 和 Gate.io 資產追蹤

**Feature Branch**: `032-mexc-gateio-assets`
**Created**: 2025-12-11
**Status**: Draft
**Input**: User description: "請幫我實作 mexc 及 gateio 的資產記錄"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 查看 MEXC 交易所資產 (Priority: P1)

作為套利交易者，我希望能在資產總覽頁面看到我在 MEXC 交易所的總資產（以 USD 計），這樣我可以完整掌握所有交易所的資金狀況。

**Why this priority**: 這是核心功能之一，用戶需要看到 MEXC 的資產才能完整計算跨交易所的總資產。目前系統已支援 Binance 和 OKX，缺少 MEXC 會導致資產總覽不完整。

**Independent Test**: 可以透過綁定 MEXC API Key 後，進入資產總覽頁面，確認 MEXC 餘額正確顯示來獨立測試。

**Acceptance Scenarios**:

1. **Given** 用戶已綁定 MEXC 的 API Key，**When** 用戶進入資產總覽頁面，**Then** 系統顯示 MEXC 的總資產（USD）和連線狀態
2. **Given** 用戶的 MEXC API Key 有效，**When** 系統執行每小時快照任務，**Then** 系統記錄 MEXC 的資產餘額至快照中
3. **Given** 用戶的 MEXC API Key 失效或權限不足，**When** 系統查詢餘額，**Then** 系統顯示「API 錯誤」狀態並記錄錯誤訊息

---

### User Story 2 - 查看 Gate.io 交易所資產 (Priority: P1)

作為套利交易者，我希望能在資產總覽頁面看到我在 Gate.io 交易所的總資產（以 USD 計），這樣我可以完整掌握所有交易所的資金狀況。

**Why this priority**: 與 MEXC 同等重要，Gate.io 也是系統支援的交易所之一，缺少它會導致資產總覽不完整。

**Independent Test**: 可以透過綁定 Gate.io API Key 後，進入資產總覽頁面，確認 Gate.io 餘額正確顯示來獨立測試。

**Acceptance Scenarios**:

1. **Given** 用戶已綁定 Gate.io 的 API Key，**When** 用戶進入資產總覽頁面，**Then** 系統顯示 Gate.io 的總資產（USD）和連線狀態
2. **Given** 用戶的 Gate.io API Key 有效，**When** 系統執行每小時快照任務，**Then** 系統記錄 Gate.io 的資產餘額至快照中
3. **Given** 用戶的 Gate.io API Key 失效或權限不足，**When** 系統查詢餘額，**Then** 系統顯示「API 錯誤」狀態並記錄錯誤訊息

---

### User Story 3 - 查看 MEXC 和 Gate.io 持倉 (Priority: P2)

作為套利交易者，我希望能看到我在 MEXC 和 Gate.io 的當前持倉（期貨倉位），這樣我可以掌握所有交易所的倉位狀況。

**Why this priority**: 持倉資訊是補充功能，優先於餘額查詢之後。用戶可以先透過資產餘額了解整體狀況，持倉細節是進階需求。

**Independent Test**: 可以透過在 MEXC 或 Gate.io 開倉後，確認系統顯示正確的持倉資訊來獨立測試。

**Acceptance Scenarios**:

1. **Given** 用戶在 MEXC 有開啟的期貨倉位，**When** 用戶查看持倉列表，**Then** 系統顯示該倉位的幣種、方向、數量、未實現損益
2. **Given** 用戶在 Gate.io 有開啟的期貨倉位，**When** 用戶查看持倉列表，**Then** 系統顯示該倉位的幣種、方向、數量、未實現損益
3. **Given** 某交易所 API 無法取得持倉資訊，**When** 用戶查看持倉列表，**Then** 系統顯示該交易所「無法取得持倉」並不影響其他交易所的顯示

---

### Edge Cases

- 當 MEXC 或 Gate.io API 回應格式與預期不同時，系統應記錄錯誤並顯示「API 錯誤」狀態
- 當用戶在這兩個交易所沒有任何資產時，系統應顯示餘額為 0，而非錯誤
- 當交易所 API 達到速率限制時，系統應顯示「請求過於頻繁」狀態並在下次快照時重試
- 當用戶同時綁定 4 個交易所的 API Key 時，歷史曲線應正確顯示所有 4 個交易所的資料

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系統 MUST 支援查詢 MEXC 交易所的帳戶資產餘額
- **FR-002**: 系統 MUST 支援查詢 Gate.io 交易所的帳戶資產餘額
- **FR-003**: 系統 MUST 將 MEXC 和 Gate.io 的各幣種餘額換算為 USD 等值
- **FR-004**: 系統 MUST 在每小時快照任務中包含 MEXC 和 Gate.io 的資產記錄
- **FR-005**: 系統 MUST 記錄 MEXC 和 Gate.io 的連線狀態（成功/失敗/無 API Key）
- **FR-006**: 系統 MUST 支援查詢 MEXC 的期貨持倉資訊
- **FR-007**: 系統 MUST 支援查詢 Gate.io 的期貨持倉資訊
- **FR-008**: 系統 MUST 在歷史曲線圖中顯示 MEXC 和 Gate.io 的個別曲線

### Key Entities

- **MEXC 連接器**: 負責與 MEXC API 通訊，查詢餘額和持倉的元件
- **Gate.io 連接器**: 負責與 Gate.io API 通訊，查詢餘額和持倉的元件
- **AssetSnapshot（擴展）**: 現有的資產快照記錄，已包含 mexcBalanceUSD 和 gateioBalanceUSD 欄位

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 用戶能在資產總覽頁面看到 MEXC 餘額，查詢時間不超過 5 秒
- **SC-002**: 用戶能在資產總覽頁面看到 Gate.io 餘額，查詢時間不超過 5 秒
- **SC-003**: 系統每小時快照任務能成功記錄 MEXC 和 Gate.io 的餘額，成功率達 95% 以上
- **SC-004**: 歷史曲線圖能正確顯示 MEXC 和 Gate.io 的個別曲線
- **SC-005**: 當 API Key 無效時，用戶能在頁面上看到明確的錯誤說明

## Assumptions

- 用戶已在系統中設定了 MEXC 和/或 Gate.io 的 API Key
- MEXC 和 Gate.io 的 API 提供讀取餘額和持倉的權限（只需讀取權限，不需交易權限）
- 資料庫已有 mexcBalanceUSD 和 gateioBalanceUSD 欄位（由 Feature 031 建立）
- 前端的 AssetSummaryCard 和 AssetHistoryChart 元件已支援顯示 MEXC 和 Gate.io（由 Feature 031 建立）
- MEXC 使用 CCXT 或官方 SDK 進行連接
- Gate.io 使用 CCXT 或官方 SDK 進行連接

## Dependencies

- Feature 031: 交易所資產追蹤和歷史曲線（已完成）
- 現有的 API Key 管理功能（支援 MEXC 和 Gate.io）
