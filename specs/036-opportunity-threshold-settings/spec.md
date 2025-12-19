# Feature Specification: 可配置年化收益門檻

**Feature Branch**: `036-opportunity-threshold-settings`
**Created**: 2025-12-18
**Status**: Draft
**Input**: 讓用戶能在設定頁面自訂開倉機會的年化收益門檻值

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 設定年化收益門檻 (Priority: P1)

用戶想要自訂年化收益門檻，以便根據自己的投資策略決定何時顯示開倉按鈕。目前系統硬編碼為 800%，用戶希望能調整此值以看到更多或更少的交易機會。

**Why this priority**: 這是核心功能，沒有這個功能用戶無法自訂門檻值。

**Independent Test**: 可以透過進入設定頁面、輸入新門檻值、儲存後返回市場監控頁面驗證門檻是否生效。

**Acceptance Scenarios**:

1. **Given** 用戶在交易設定頁面，**When** 用戶輸入新的門檻值（例如 300%）並點擊儲存，**Then** 系統儲存該值並顯示成功訊息
2. **Given** 用戶已設定門檻為 300%，**When** 用戶查看市場監控頁面，**Then** 年化收益 ≥ 300% 的交易對顯示為「機會」狀態並顯示開倉按鈕
3. **Given** 用戶已設定門檻為 300%，**When** 年化收益為 250%，**Then** 該交易對顯示為「接近」狀態（300% × 75% = 225%）

---

### User Story 2 - 使用快速選擇按鈕 (Priority: P2)

用戶想要快速選擇常用的門檻值，而不需要手動輸入數字。

**Why this priority**: 提升用戶體驗，但核心功能不依賴此項。

**Independent Test**: 可以透過點擊預設按鈕驗證門檻值是否正確更新。

**Acceptance Scenarios**:

1. **Given** 用戶在交易設定頁面，**When** 用戶點擊「500%」快速選擇按鈕，**Then** 門檻輸入框顯示 500
2. **Given** 用戶在交易設定頁面，**When** 用戶點擊「重設為預設值」按鈕，**Then** 門檻值重設為 800%

---

### User Story 3 - 跨標籤頁同步 (Priority: P3)

用戶可能開啟多個瀏覽器標籤頁，在一個標籤頁修改門檻後，其他標籤頁應自動同步更新。

**Why this priority**: 進階功能，對基本使用不影響。

**Independent Test**: 可以透過開啟兩個標籤頁，在一個頁面修改門檻，驗證另一個頁面是否自動更新。

**Acceptance Scenarios**:

1. **Given** 用戶開啟兩個市場監控標籤頁，**When** 用戶在標籤頁 A 修改門檻為 500%，**Then** 標籤頁 B 自動更新門檻並重新計算狀態

---

### Edge Cases

- 用戶輸入負數或零時，系統應顯示錯誤訊息並阻止儲存
- 用戶輸入超過合理範圍（例如 > 10000%）時，系統應顯示警告
- localStorage 不可用時（例如隱私模式），系統應使用預設值 800% 並顯示提示
- 用戶清除瀏覽器資料後，門檻應重設為預設值 800%

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系統必須提供設定頁面讓用戶輸入年化收益門檻值
- **FR-002**: 系統必須將用戶設定的門檻值儲存在 localStorage
- **FR-003**: 系統必須在市場監控頁面使用用戶設定的門檻值來判定「機會」狀態
- **FR-004**: 系統必須自動計算「接近」門檻（主門檻 × 75%）
- **FR-005**: 系統必須提供快速選擇按鈕（300%、500%、800%、1000%）
- **FR-006**: 系統必須提供重設為預設值（800%）的功能
- **FR-007**: 系統必須驗證輸入值在有效範圍內（1% - 10000%）
- **FR-008**: 系統必須在門檻變更時即時更新市場監控頁面的狀態顯示

### Key Entities

- **OpportunityThresholdPreference**: 用戶的門檻偏好設定，包含主門檻值
- **MarketRateStatus**: 交易對狀態（opportunity、approaching、normal），由門檻值決定

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 用戶可在 30 秒內完成門檻設定變更
- **SC-002**: 門檻變更後，市場監控頁面在 1 秒內更新狀態顯示
- **SC-003**: 100% 的門檻設定能在瀏覽器重新載入後保留
- **SC-004**: 用戶設定較低門檻後，能看到更多顯示開倉按鈕的交易機會
