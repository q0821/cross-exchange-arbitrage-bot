# Feature Specification: 修復開倉停損停利條件單設定

**Feature Branch**: `040-fix-conditional-orders`
**Created**: 2025-12-23
**Status**: Draft
**Input**: 修復開倉時設定停損停利條件單失敗的問題

## User Scenarios & Testing *(mandatory)*

### User Story 1 - OKX 條件單設定 (Priority: P1)

用戶在 OKX 交易所開倉時，系統應自動偵測帳戶模式（long_short_mode 或 net_mode），並使用正確的參數設定停損停利條件單。

**Why this priority**: OKX 是主要交易所之一，帳戶模式錯誤會導致所有條件單設定失敗。

**Independent Test**: 可透過模擬 OKX API 回應不同帳戶模式，驗證系統能正確偵測並設定條件單。

**Acceptance Scenarios**:

1. **Given** 用戶使用 OKX long_short_mode 帳戶, **When** 開倉並啟用停損, **Then** 系統應偵測到 long_short_mode 並使用對應參數設定條件單成功
2. **Given** 用戶使用 OKX net_mode 帳戶, **When** 開倉並啟用停損, **Then** 系統應偵測到 net_mode 並使用對應參數設定條件單成功
3. **Given** OKX API 無法回應帳戶模式, **When** 開倉並啟用停損, **Then** 系統應使用預設模式 (long_short_mode) 並記錄警告日誌

---

### User Story 2 - Gate.io 條件單設定 (Priority: P1)

用戶在 Gate.io 交易所開倉時，系統應正確轉換合約數量（支援小數），確保條件單設定成功。

**Why this priority**: 當前使用 parseInt() 會將 0.5 截斷為 0，導致下單失敗。

**Independent Test**: 可透過不同數量（0.4, 0.5, 1.6, 2.0）測試數量轉換邏輯。

**Acceptance Scenarios**:

1. **Given** 合約數量為 0.5, **When** 設定停損單, **Then** 系統應四捨五入為 1 張合約（非截斷為 0）
2. **Given** 合約數量為 0.4, **When** 設定停損單, **Then** 系統應使用最小值 1 張合約
3. **Given** 合約數量為 1.6, **When** 設定停損單, **Then** 系統應四捨五入為 2 張合約
4. **Given** Long 倉位平倉, **When** 設定停損單, **Then** 合約數量應為負數（賣出方向）
5. **Given** Short 倉位平倉, **When** 設定停損單, **Then** 合約數量應為正數（買入方向）

---

### User Story 3 - Binance 條件單設定 (Priority: P2)

用戶在 Binance 交易所開倉時，系統應使用已有的帳戶模式偵測機制設定條件單，並加強日誌記錄以便偵錯。

**Why this priority**: Binance 已有帳戶模式偵測，主要需要加強日誌。

**Independent Test**: 可驗證 Hedge Mode 和 One-way Mode 兩種情境的條件單設定。

**Acceptance Scenarios**:

1. **Given** Binance Hedge Mode 帳戶, **When** 開倉並啟用停損停利, **Then** 條件單設定成功並記錄完整日誌
2. **Given** Binance Portfolio Margin 帳戶, **When** 開倉並啟用停損, **Then** 使用正確的 API 端點設定條件單

---

### User Story 4 - 偵錯日誌增強 (Priority: P2)

當條件單設定失敗時，系統應記錄足夠的資訊供開發者偵錯，包括請求參數、回應內容、帳戶模式等。

**Why this priority**: 當前日誌不足以診斷問題根源。

**Independent Test**: 可透過模擬失敗情境，驗證日誌內容完整性。

**Acceptance Scenarios**:

1. **Given** 條件單設定失敗, **When** 查看日誌, **Then** 應包含：交易所名稱、交易對、倉位方向、觸發價格、API 錯誤訊息
2. **Given** 條件單設定成功, **When** 查看日誌, **Then** 應包含：訂單 ID、觸發價格、帳戶模式

---

### Edge Cases

- 網路超時時如何處理？（應重試並記錄錯誤）
- API 速率限制時如何處理？（應使用 exponential backoff）
- 價格波動導致條件單可能立即觸發時如何處理？（應記錄警告但仍執行設定）

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系統 MUST 動態偵測 OKX 帳戶的持倉模式（long_short_mode 或 net_mode）
- **FR-002**: 系統 MUST 在 Gate.io 使用四捨五入（非截斷）轉換合約數量
- **FR-003**: 系統 MUST 確保 Gate.io 合約數量最小值為 1
- **FR-004**: 系統 MUST 記錄條件單設定的完整請求和回應資訊
- **FR-005**: 系統 MUST 在 API 錯誤時記錄足夠的上下文供偵錯
- **FR-006**: 系統 SHOULD 在價格驗證失敗時記錄警告（可能立即觸發）

### Key Entities

- **ConditionalOrder**: 條件單（停損/停利），包含觸發價格、數量、訂單 ID
- **Position**: 持倉資訊，關聯雙邊條件單狀態
- **ExchangeAdapter**: 交易所適配器，處理各交易所差異

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: OKX 條件單設定成功率從 0% 提升至 95% 以上
- **SC-002**: Gate.io 小數數量（< 1）的條件單設定成功率達到 100%
- **SC-003**: 所有條件單設定操作有完整的日誌追蹤
- **SC-004**: 條件單設定失敗時，開發者能在 5 分鐘內從日誌定位問題

## Assumptions

- 用戶已正確配置交易所 API Key 並有足夠權限
- 交易所 API 正常運作且可訪問
- OKX 預設使用 long_short_mode，Gate.io 使用 USDT 結算
- Binance 帳戶模式偵測機制已正確實作，僅需加強日誌

## Scope Boundaries

**包含**:
- OKX 帳戶模式動態偵測
- Gate.io 合約數量轉換修復
- Binance、OKX、Gate.io 日誌增強

**不包含**:
- MEXC 交易所（尚未實作開倉功能）
- 新增交易所支援
- 條件單觸發後的追蹤
