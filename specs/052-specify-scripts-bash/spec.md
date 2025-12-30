# Feature Specification: 交易所 WebSocket 即時數據訂閱

**Feature Branch**: `052-connector-websocket-subscription`
**Created**: 2025-12-31
**Status**: Draft
**Input**: 實作各交易所 Connector 的 WebSocket 即時數據訂閱功能

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 即時資金費率更新 (Priority: P1)

作為套利交易者，我希望系統能透過 WebSocket 即時接收各交易所的資金費率更新，這樣我可以更快速地發現套利機會，而不是等待 5 秒的 REST 輪詢週期。

**Why this priority**: 資金費率是套利交易的核心數據，即時性直接影響套利機會的捕捉。降低數據延遲可提高交易效率。

**Independent Test**: 可透過監控 WebSocket 連線狀態和資料更新頻率來驗證，預期資料延遲從 5 秒降至 1 秒以內。

**Acceptance Scenarios**:

1. **Given** 系統已啟動且交易所 API 可用，**When** 連接到交易所 WebSocket，**Then** 應在 1 秒內收到首次資金費率數據
2. **Given** WebSocket 已連接，**When** 交易所發布新的資金費率，**Then** 系統應在 1 秒內更新本地快取

---

### User Story 2 - WebSocket 斷線自動重連 (Priority: P1)

作為系統管理員，我希望當 WebSocket 連線中斷時，系統能自動重新連接並恢復數據訂閱，這樣可以確保數據的連續性而無需人工干預。

**Why this priority**: 連線穩定性是生產環境的基本要求，自動重連確保系統 24/7 運作。

**Independent Test**: 可透過模擬網路中斷來測試，驗證系統能在設定時間內自動恢復連線。

**Acceptance Scenarios**:

1. **Given** WebSocket 連線中斷，**When** 超過心跳超時時間，**Then** 系統應自動嘗試重新連接（最多 10 次，指數退避）
2. **Given** 重連成功，**When** 連線恢復，**Then** 系統應自動重新訂閱之前的數據頻道
3. **Given** 重連多次失敗，**When** 達到最大重試次數，**Then** 系統應自動切換到 REST 輪詢模式並記錄警告

---

### User Story 3 - 混合數據源策略 (Priority: P2)

作為系統管理員，我希望系統能同時支援 WebSocket 和 REST API 兩種數據源，當 WebSocket 不可用時自動切換到 REST，確保數據獲取的可靠性。

**Why this priority**: 作為備援機制，確保即使 WebSocket 有問題也能持續運作。

**Independent Test**: 可透過關閉 WebSocket 服務來測試，驗證系統能無縫切換到 REST 模式。

**Acceptance Scenarios**:

1. **Given** WebSocket 連線失敗，**When** 系統偵測到連線問題，**Then** 應自動啟用 REST 輪詢作為備援
2. **Given** 使用 REST 備援中，**When** WebSocket 恢復可用，**Then** 系統應自動切回 WebSocket 模式

---

### User Story 4 - 多交易所統一訂閱管理 (Priority: P2)

作為開發者，我希望所有交易所的 WebSocket 訂閱都遵循統一的介面，這樣可以簡化程式碼維護和新增交易所的工作。

**Why this priority**: 統一介面降低維護成本，便於未來擴展。

**Independent Test**: 可透過為每個交易所執行相同的測試案例來驗證介面一致性。

**Acceptance Scenarios**:

1. **Given** 任一交易所 Connector，**When** 調用 subscribeWS()，**Then** 應成功建立 WebSocket 連線並開始接收數據
2. **Given** 已訂閱的 WebSocket，**When** 調用 unsubscribeWS()，**Then** 應正確取消訂閱並清理資源

---

### Edge Cases

- 當交易所 WebSocket 服務暫時不可用時，系統如何處理？（切換到 REST 備援）
- 當同時訂閱多個交易對時，如何管理連線數量？（連線池或單一連線多頻道）
- 當收到格式異常的 WebSocket 訊息時，如何處理？（記錄錯誤並忽略該訊息）
- 當網路延遲過高導致心跳超時時，如何避免誤判斷線？（調整心跳間隔）

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系統必須支援透過 WebSocket 訂閱 Binance 的資金費率數據
- **FR-002**: 系統必須支援透過 WebSocket 訂閱 OKX 的資金費率數據
- **FR-003**: 系統必須支援透過 WebSocket 訂閱 MEXC 的資金費率數據
- **FR-004**: 系統必須支援透過 WebSocket 訂閱 Gate.io 的資金費率數據
- **FR-005**: 系統必須支援透過 WebSocket 訂閱 BingX 的資金費率數據
- **FR-006**: 系統必須在 WebSocket 斷線時自動嘗試重新連接
- **FR-007**: 系統必須在重連失敗達到上限時自動切換到 REST 輪詢模式
- **FR-008**: 系統必須維護心跳機制以偵測連線狀態
- **FR-009**: 系統必須能正確處理各交易所不同的 WebSocket 訊息格式
- **FR-010**: 系統必須將 WebSocket 接收的數據更新到 RatesCache

### Key Entities

- **WebSocket 訂閱**: 代表一個活躍的 WebSocket 連線，包含訂閱類型、交易對、回調函式
- **連線狀態**: 追蹤每個交易所的 WebSocket 連線健康度（已連線、重連中、已斷線）
- **數據源模式**: 標記當前使用 WebSocket 或 REST 作為數據來源

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 資金費率數據更新延遲從 5 秒降至 1 秒以內
- **SC-002**: WebSocket 連線在斷線後 30 秒內自動恢復（網路正常情況下）
- **SC-003**: REST API 請求次數減少 80% 以上（正常運作時）
- **SC-004**: 系統可連續運行 24 小時而無需人工干預處理連線問題
- **SC-005**: 所有 5 個交易所的 WebSocket 訂閱功能都能正常運作

---

## 現有基礎設施分析

### 已實現的組件

| 組件 | 檔案路徑 | 狀態 |
|------|---------|------|
| IExchangeConnector 介面 | `src/connectors/types.ts` | ✅ 已定義 subscribeWS/unsubscribeWS |
| WebSocketManager 基類 | `src/lib/websocket.ts` | ✅ 已實現自動重連、心跳 |
| BinanceWsClient | `src/services/websocket/BinanceWsClient.ts` | ✅ 已實現 ticker 訂閱 |
| RatesCache | `src/services/monitor/RatesCache.ts` | ✅ 已實現快取層 |

### 待實現的組件

| 交易所 | 檔案路徑 | TODO 位置 |
|--------|---------|-----------|
| Binance | `src/connectors/binance.ts` | L81, L462, L467 |
| OKX | `src/connectors/okx.ts` | L877, L882 |
| MEXC | `src/connectors/mexc.ts` | L476, L481 |
| Gate.io | `src/connectors/gateio.ts` | L480, L485 |
| BingX | `src/connectors/bingx.ts` | L573, L578 |
| PriceMonitor | `src/services/monitor/PriceMonitor.ts` | L113, L141 |

---

## 實作優先級

| 優先級 | 交易所 | 理由 |
|--------|--------|------|
| 1 | Binance | 市佔率最高，已有 BinanceWsClient 可參考 |
| 2 | OKX | 市佔率高，CCXT 支援完整 |
| 3 | Gate.io | CCXT 支援完整 |
| 4 | MEXC | CCXT 支援完整 |
| 5 | BingX | 新加入的交易所 |

---

## Assumptions

- 各交易所的 WebSocket API 保持穩定，不會頻繁變更格式
- 現有的 WebSocketManager 基類足夠通用，可適用於所有交易所
- 系統運行環境的網路連線基本穩定（偶發斷線可接受）
- 使用現有的 CCXT 4.x 和 @binance/connector 3.x 作為底層 SDK
