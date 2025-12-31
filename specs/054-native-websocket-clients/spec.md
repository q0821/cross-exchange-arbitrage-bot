# Feature Specification: Native WebSocket Clients

**Feature Branch**: `054-native-websocket-clients`
**Created**: 2025-12-31
**Status**: Draft
**Input**: 實作 OKX、Gate.io、BingX 原生 WebSocket 客戶端，支援訂閱幣價、資金費率和訂單狀態

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 即時資金費率監控 (Priority: P1)

作為套利交易者，我需要即時接收多個交易所的資金費率更新，以便在費率出現有利差異時快速做出交易決策。

**Why this priority**: 資金費率是套利機會的核心指標，即時性直接影響套利策略的有效性。目前 CCXT 不支援 OKX/Gate.io/BingX 的 WebSocket 資金費率訂閱，只能透過 REST 輪詢，延遲較高。

**Independent Test**: 系統可以在資金費率變動時，於 500 毫秒內收到更新並顯示在監控介面上。

**Acceptance Scenarios**:

1. **Given** 系統已連接 OKX WebSocket，**When** OKX 推送 BTCUSDT 資金費率更新，**Then** 系統在 500 毫秒內收到並更新監控介面
2. **Given** 系統已連接 Gate.io WebSocket，**When** Gate.io 推送 ETHUSDT 資金費率更新，**Then** 系統在 500 毫秒內收到並更新監控介面
3. **Given** 系統已連接 BingX WebSocket，**When** BingX 推送 SOLUSDT 資金費率更新，**Then** 系統在 500 毫秒內收到並更新監控介面

---

### User Story 2 - 即時價格監控 (Priority: P1)

作為套利交易者，我需要即時接收多個交易所的標記價格和最新成交價，以便計算套利收益和監控持倉損益。

**Why this priority**: 價格是計算套利收益的基礎數據，與資金費率同等重要。

**Independent Test**: 系統可以在價格變動時，即時更新並在監控介面顯示各交易所的價格差異。

**Acceptance Scenarios**:

1. **Given** 系統已連接 OKX WebSocket，**When** OKX 推送 BTCUSDT 標記價格更新，**Then** 系統即時更新價格顯示
2. **Given** 系統已連接 Gate.io WebSocket，**When** Gate.io 推送 BTCUSDT 標記價格更新，**Then** 系統即時更新價格顯示
3. **Given** 系統已連接 BingX WebSocket，**When** BingX 推送 BTCUSDT 標記價格更新，**Then** 系統即時更新價格顯示

---

### User Story 3 - 訂單狀態即時通知 (Priority: P2)

作為套利交易者，我需要即時接收訂單狀態更新（成交、部分成交、取消等），以便監控交易執行情況和處理異常。

**Why this priority**: 訂單狀態更新對交易執行監控很重要，但相比資金費率和價格，對套利決策的影響較間接。

**Independent Test**: 當訂單狀態改變時，系統可以即時收到通知並更新介面。

**Acceptance Scenarios**:

1. **Given** 用戶在 OKX 有一筆掛單，**When** 訂單被成交，**Then** 系統即時收到成交通知
2. **Given** 用戶在 Gate.io 有一筆掛單，**When** 訂單被取消，**Then** 系統即時收到取消通知
3. **Given** 用戶在 BingX 有一筆掛單，**When** 訂單部分成交，**Then** 系統即時收到部分成交通知和剩餘數量

---

### User Story 4 - 自動重連與容錯 (Priority: P2)

作為系統管理員，我需要 WebSocket 連線具備自動重連機制，以確保在網路不穩定時系統仍能持續運作。

**Why this priority**: 連線穩定性直接影響系統可用性，是基礎設施層級的需求。

**Independent Test**: 當 WebSocket 斷線後，系統可以自動嘗試重連並恢復訂閱。

**Acceptance Scenarios**:

1. **Given** OKX WebSocket 連線中，**When** 網路斷線導致連線中斷，**Then** 系統自動嘗試重連（指數退避策略）並在成功後恢復所有訂閱
2. **Given** Gate.io WebSocket 連線失敗超過最大重試次數，**When** 系統檢測到無法恢復，**Then** 自動切換到 REST 輪詢模式並記錄日誌
3. **Given** BingX WebSocket 60 秒無任何訊息，**When** 健康檢查偵測到連線不健康，**Then** 主動觸發重連

---

### User Story 5 - 資料源狀態監控 (Priority: P3)

作為系統管理員，我需要透過 API 查詢各交易所 WebSocket 連線狀態，以便監控系統健康度。

**Why this priority**: 監控功能是輔助性需求，對核心套利功能沒有直接影響。

**Independent Test**: 可以透過 API 查詢到每個交易所的連線狀態、延遲和健康度。

**Acceptance Scenarios**:

1. **Given** 所有交易所 WebSocket 正常連線，**When** 查詢 ws-status API，**Then** 顯示所有連線為 connected 狀態
2. **Given** OKX WebSocket 斷線並切換到 REST，**When** 查詢 ws-status API，**Then** OKX 顯示為 fallback_rest 狀態

---

### Edge Cases

- WebSocket 連線建立後立即斷線：系統應觸發重連機制
- 收到格式錯誤的訊息：系統應記錄錯誤日誌並忽略該訊息，不影響其他訂閱
- 訂閱的交易對不存在：系統應記錄錯誤並繼續處理其他有效訂閱
- 同時訂閱大量交易對（100+）：系統應分批訂閱，避免超過交易所訂閱數量限制
- 交易所維護期間推送維護通知：系統應切換到 REST 模式並記錄日誌
- 心跳超時：系統應主動發送 ping 或觸發重連

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系統 MUST 支援連接 OKX WebSocket 並訂閱資金費率頻道
- **FR-002**: 系統 MUST 支援連接 Gate.io WebSocket 並訂閱 futures.tickers 頻道（含資金費率）
- **FR-003**: 系統 MUST 支援連接 BingX WebSocket 並訂閱標記價格頻道
- **FR-004**: 系統 MUST 將各交易所推送的資金費率數據標準化為統一格式
- **FR-005**: 系統 MUST 將各交易所推送的價格數據標準化為統一格式
- **FR-006**: 系統 MUST 支援訂單狀態更新訂閱，從 ApiKey 資料庫模型讀取已加密儲存的憑證進行認證
- **FR-007**: 系統 MUST 實作自動重連機制，採用指數退避策略（初始 1 秒，最大 30 秒）
- **FR-008**: 系統 MUST 實作健康檢查機制，60 秒無訊息視為不健康並觸發重連
- **FR-009**: 系統 MUST 在 WebSocket 不可用時自動切換到 REST 輪詢模式
- **FR-010**: 系統 MUST 在 WebSocket 恢復可用時自動切回 WebSocket 模式
- **FR-011**: 系統 MUST 支援動態新增和移除訂閱的交易對
- **FR-012**: 系統 MUST 支援批量訂閱多個交易對，當訂閱數超過單一連線限制時自動建立多個連線並平均分配（OKX: 100/連線, Gate.io: 20/連線, BingX: 50/連線）
- **FR-013**: 系統 MUST 記錄所有連線狀態變化和錯誤的結構化日誌
- **FR-014**: 系統 MUST 提供 API 端點查詢各交易所 WebSocket 連線狀態
- **FR-015**: 系統 MUST 收集完整運行時指標：連線數、訊息吞吐量、延遲分佈（P50/P95/P99）、重連次數、錯誤率、每交易所狀態

### Key Entities

- **WebSocket Client**: 代表與單一交易所的 WebSocket 連線，包含連線狀態、已訂閱頻道、重連邏輯
- **Funding Rate Data**: 標準化的資金費率數據，包含交易所、交易對、費率、下次結算時間
- **Price Data**: 標準化的價格數據，包含交易所、交易對、標記價格、指數價格、最新成交價
- **Order Update**: 訂單狀態更新數據，包含訂單 ID、狀態、成交數量、剩餘數量
- **Data Source State**: 數據源狀態，記錄當前模式（WebSocket/REST）、延遲、最後更新時間

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 資金費率更新延遲從 REST 輪詢的 5 分鐘降低到 500 毫秒以內
- **SC-002**: 系統支援同時監控 100 個以上交易對的資金費率
- **SC-003**: WebSocket 連線斷線後，95% 的情況下能在 30 秒內自動恢復
- **SC-004**: 當 WebSocket 不可用時，100% 能自動切換到 REST 模式確保數據可用性
- **SC-005**: 系統在連續運行 24 小時後，WebSocket 連線保持穩定（無非預期斷線）
- **SC-006**: 所有訂單狀態變更能在 1 秒內反映在系統中

## Assumptions

- 各交易所 WebSocket API 穩定可用，符合其官方文件描述
- 用戶已配置有效的 API Key 用於訂單狀態訂閱（私有頻道）
- 網路環境能夠維持與各交易所的 WebSocket 連線
- 系統已有現成的 BinanceFundingWs 實作可作為參考模式
- DataSourceManager 已實作並可處理數據源切換

## Clarifications

### Session 2025-12-31

- Q: 當訂閱數量超過單一 WebSocket 連線限制時，系統應如何處理？ → A: 自動建立多連線，根據交易所限制自動建立多個 WebSocket 連線，平均分配訂閱
- Q: 系統應收集哪些 WebSocket 運行時指標？ → A: 完整指標（連線數、訊息吞吐量、延遲分佈、重連次數、錯誤率、每交易所狀態）
- Q: 私有頻道的 API Key 應如何傳遞給 WebSocket 客戶端？ → A: 從資料庫讀取，WebSocket 客戶端啟動時從 ApiKey 模型讀取已加密儲存的憑證

## Out of Scope

- 其他交易所（如 Bybit、Huobi）的 WebSocket 整合
- 歷史資金費率數據查詢（僅即時訂閱）
- WebSocket 訂閱的交易對自動發現（由用戶配置）
- 交易執行功能（僅訂閱通知，不執行交易）
