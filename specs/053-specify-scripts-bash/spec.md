# Feature Specification: 修復條件單觸發誤判導致單邊平倉

**Feature Branch**: `053-specify-scripts-bash`
**Created**: 2025-12-31
**Status**: Draft
**Input**: User description: "修復條件單觸發誤判導致單邊平倉的 Bug"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 正確判斷停損停利觸發狀態 (Priority: P1)

當條件單（停損或停利）狀態變更時，系統必須能正確判斷該條件單是真的被觸發成交，還是只是被取消。這是防止單邊曝險的核心功能。

**Why this priority**: 這是造成資金損失的直接原因。如果觸發判斷錯誤，系統會執行單邊平倉，導致用戶承擔單邊市場風險。

**Independent Test**: 可透過模擬各交易所返回不同的訂單狀態和持倉資料來驗證，確認系統能正確判斷觸發狀態。

**Acceptance Scenarios**:

1. **Given** 條件單狀態為「已取消」且對應倉位不存在，**When** 系統查詢持倉狀態，**Then** 判定為「確認觸發」，繼續執行雙邊平倉流程
2. **Given** 條件單狀態為「已取消」且對應倉位仍存在，**When** 系統查詢持倉狀態，**Then** 判定為「非觸發」（僅訂單取消），不執行任何平倉動作
3. **Given** Gate.io 返回持倉方向為 'sell'，**When** 系統比對持倉方向，**Then** 能正確識別為 'short' 方向

---

### User Story 2 - 預防性雙邊平倉機制 (Priority: P1)

當系統無法確認條件單是否真的觸發時（例如 API 查詢失敗），系統必須採取預防性措施，主動平倉雙邊以避免單邊曝險。

**Why this priority**: 避免單邊曝險是最高優先級。即使可能損失部分利潤，也比承擔單邊市場風險更安全。

**Independent Test**: 可透過模擬 API 連續失敗來驗證系統是否會執行預防性雙邊平倉。

**Acceptance Scenarios**:

1. **Given** 持倉查詢 API 失敗，**When** 系統重試 2 次後仍失敗（共 3 次嘗試），**Then** 系統自動執行雙邊平倉
2. **Given** 系統執行預防性平倉，**When** 平倉完成或失敗，**Then** 系統發送緊急通知給用戶
3. **Given** 系統無法確認觸發狀態，**When** 預防性平倉執行失敗，**Then** 系統發送緊急通知，提醒用戶手動處理

---

### User Story 3 - 多交易所持倉方向格式統一 (Priority: P2)

系統必須能統一處理不同交易所返回的持倉方向格式，包括 Binance、OKX、Gate.io 和 BingX。

**Why this priority**: 這是根本原因的修復，確保所有交易所的持倉查詢都能正確運作。

**Independent Test**: 可透過單元測試驗證各種持倉方向格式的轉換。

**Acceptance Scenarios**:

1. **Given** 交易所返回 'long' 或 'buy'，**When** 系統標準化方向，**Then** 統一轉換為 'long'
2. **Given** 交易所返回 'short' 或 'sell'，**When** 系統標準化方向，**Then** 統一轉換為 'short'
3. **Given** 交易所返回大寫格式如 'LONG' 或 'SHORT'，**When** 系統標準化方向，**Then** 能正確識別並轉換

---

### Edge Cases

- 當重試期間 API 狀態不穩定（第一次失敗、第二次成功）時，系統如何處理？
- 當預防性平倉期間，其中一邊已被市場自動平倉（例如已觸價），系統如何處理？
- 當 API 返回空的持倉列表但實際有持倉時，系統如何處理？
- 當持倉數量欄位名稱不一致時（contracts vs contractSize vs size），系統如何處理？

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系統 MUST 能將 'buy'/'sell' 格式的持倉方向轉換為 'long'/'short' 標準格式
- **FR-002**: 系統 MUST 支援大小寫不敏感的持倉方向比對（'LONG', 'Long', 'long' 皆可）
- **FR-003**: 系統 MUST 在持倉查詢失敗時進行最多 2 次重試（共 3 次嘗試）
- **FR-004**: 系統 MUST 在連續 3 次查詢失敗後執行預防性雙邊平倉
- **FR-005**: 系統 MUST 在執行預防性平倉後發送緊急通知
- **FR-006**: 系統 MUST 在預防性平倉失敗時發送緊急通知，提醒用戶手動處理
- **FR-007**: 系統 MUST 記錄詳細的持倉查詢日誌，包含原始資料和標準化後的資料
- **FR-008**: 系統 MUST 支援 Binance、OKX、Gate.io、BingX 四個交易所的持倉查詢

### Key Entities

- **Position**: 套利持倉記錄，包含多空雙邊的交易所、交易對、倉位大小等資訊
- **ConditionalOrder**: 條件單（停損/停利），包含訂單 ID、觸發價格、狀態等
- **Notification**: 通知記錄，包含通知類型、內容、發送狀態等

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 系統能 100% 正確識別 Gate.io 返回的 'sell' 方向為 'short'
- **SC-002**: 系統能 100% 正確識別所有交易所的持倉方向格式
- **SC-003**: 當 API 查詢失敗時，系統在 5 秒內完成重試並決定後續動作（重試間隔 1 秒 × 2 次）
- **SC-004**: 預防性平倉觸發時，用戶在 10 秒內收到緊急通知
- **SC-005**: 不再發生因觸發誤判導致的單邊平倉事件

## Assumptions

- 各交易所的持倉方向格式已知且穩定（Binance/OKX/BingX 使用 'long'/'short'，Gate.io 使用 'buy'/'sell'）
- 緊急通知管道（Discord/Slack）已設定完成
- PositionCloser 服務已能正確執行雙邊平倉
- 交易所 API 的臨時性失敗通常可在 3 次嘗試內恢復

## Dependencies

- 現有的 ConditionalOrderMonitor 服務
- 現有的 ExchangeQueryService 服務
- 現有的 PositionCloser 服務
- 現有的 NotificationService 服務
