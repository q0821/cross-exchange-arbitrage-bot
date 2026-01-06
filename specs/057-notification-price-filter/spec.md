# Feature Specification: 通知價差過濾

**Feature Branch**: `057-notification-price-filter`
**Created**: 2026-01-06
**Status**: Draft
**Input**: 在 Webhook 設定中新增「價差過濾」開關，讓通知只在價差有利且資費差符合設定時才發送。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 啟用價差過濾功能 (Priority: P1)

用戶希望只在真正有利可圖的套利機會出現時才收到通知，避免收到「資費差達標但價差太大」的無效通知。用戶可以在 Webhook 設定頁面啟用「價差過濾」開關，系統會自動過濾掉淨收益為負或價差方向不利的機會。

**Why this priority**: 這是核心功能，直接解決用戶的痛點 - 減少無效通知的干擾。

**Independent Test**: 可以獨立測試，只需在 Webhook 設定頁面啟用開關，然後觀察通知是否正確過濾。

**Acceptance Scenarios**:

1. **Given** 用戶已建立 Webhook 且價差過濾為關閉狀態，**When** 用戶編輯 Webhook 並啟用價差過濾，**Then** 系統儲存設定且 Webhook 列表顯示「價差過濾：開」
2. **Given** 用戶的 Webhook 已啟用價差過濾，**When** 出現年化收益達標但淨收益為負的機會，**Then** 系統不發送通知
3. **Given** 用戶的 Webhook 已啟用價差過濾，**When** 出現年化收益達標且淨收益為正且價差方向正確的機會，**Then** 系統發送通知

---

### User Story 2 - 保持現有用戶行為不變 (Priority: P1)

現有用戶的 Webhook 設定不應受到影響。價差過濾功能預設為關閉狀態，確保後向兼容。

**Why this priority**: 與 P1 並列，因為後向兼容性是必要條件，不能破壞現有用戶的工作流程。

**Independent Test**: 現有 Webhook 在功能上線後應繼續按原有邏輯發送通知。

**Acceptance Scenarios**:

1. **Given** 用戶有既存的 Webhook 設定，**When** 系統升級加入價差過濾功能，**Then** 該 Webhook 的價差過濾預設為關閉
2. **Given** 用戶的 Webhook 價差過濾為關閉狀態，**When** 出現年化收益達標的機會（不論淨收益正負），**Then** 系統照常發送通知

---

### User Story 3 - 新建 Webhook 時設定價差過濾 (Priority: P2)

用戶在新建 Webhook 時可以選擇是否啟用價差過濾，預設為關閉。

**Why this priority**: 次要功能，但對新用戶的初始設定體驗很重要。

**Independent Test**: 新建 Webhook 時可獨立測試價差過濾選項的勾選和儲存。

**Acceptance Scenarios**:

1. **Given** 用戶在新建 Webhook 表單中，**When** 用戶填寫必要欄位但不勾選價差過濾，**Then** 系統建立 Webhook 且價差過濾為關閉
2. **Given** 用戶在新建 Webhook 表單中，**When** 用戶勾選啟用價差過濾並提交，**Then** 系統建立 Webhook 且價差過濾為開啟

---

### Edge Cases

- **價格數據不完整時**: 當機會的價格數據不完整無法計算價差方向時，若價差過濾啟用，系統不發送通知（保守策略）
- **淨收益剛好等於 0 時**: 淨收益必須嚴格大於 0 才發送通知，等於 0 不發送
- **價差在容忍範圍邊界時**: 價差小於等於 0.05% 視為可接受，超過 0.05% 則視為不利

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系統 MUST 在 Webhook 設定中提供「價差過濾」開關選項
- **FR-002**: 系統 MUST 將新建和現有 Webhook 的價差過濾預設值設為「關閉」
- **FR-003**: 當價差過濾啟用時，系統 MUST 只在滿足以下兩個條件時發送通知：
  - 淨收益 > 0（資費差減去 0.5% 總成本後仍為正）
  - 價差方向正確（空方價格 >= 多方價格，或價差在 0.05% 容忍範圍內）
- **FR-004**: 當價差過濾關閉時，系統 MUST 按現有邏輯發送通知（只檢查年化收益閾值）
- **FR-005**: 系統 MUST 在 Webhook 列表中顯示價差過濾的啟用狀態
- **FR-006**: 系統 MUST 允許用戶隨時編輯 Webhook 的價差過濾設定
- **FR-007**: 當價格數據不完整無法判斷價差方向時，若價差過濾啟用，系統 MUST 不發送通知

### Key Entities

- **NotificationWebhook**: 用戶的通知 Webhook 設定，新增「價差過濾啟用」屬性
- **BestArbitragePair**: 套利對資訊，需包含「價差方向是否正確」和「淨收益」資訊

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 啟用價差過濾的用戶收到的無效通知（淨收益為負的機會）減少 100%
- **SC-002**: 現有用戶的 Webhook 在功能上線後行為完全不變（0% 影響）
- **SC-003**: 用戶可在 5 秒內完成價差過濾設定的切換
- **SC-004**: 價差過濾的判斷邏輯執行時間不影響通知發送延遲（增加不超過 10ms）

## Assumptions

- 淨收益計算使用現有的 `netReturn` 欄位（已在 Feature 012 實作）
- 價差方向判斷使用現有的 `RateDifferenceCalculator.isPriceDiffFavorableForBestPair` 邏輯
- 總成本率固定為 0.5%（已定義在成本常數中）
- 可接受的不利價差容忍值為 0.05%（已定義在成本常數中）
