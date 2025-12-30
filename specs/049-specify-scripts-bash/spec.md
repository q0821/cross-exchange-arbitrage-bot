# Feature Specification: 交易操作驗證腳本

**Feature Branch**: `049-trading-validation-script`
**Created**: 2025-12-29
**Status**: Draft
**Input**: 建立交易操作驗證腳本，用於在真實交易所（小額）執行開倉、停損停利、平倉，並自動驗證結果正確性。

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 透過 API 自動執行完整交易驗證 (Priority: P1)

開發者或 QA 人員需要驗證交易系統的完整流程是否正常運作。透過腳本呼叫 Web API 執行開倉、設定停損停利、平倉，並自動驗證每個步驟的結果是否符合預期。

**Why this priority**: 這是核心功能，確保系統透過 Web API 執行的交易流程與實際 Web 界面使用相同程式碼路徑，驗證結果具有實際意義。

**Independent Test**: 可透過執行單一腳本指令完成完整驗證流程，輸出通過/失敗報告。

**Acceptance Scenarios**:

1. **Given** 用戶已設定有效的 API Key，**When** 執行驗證腳本並指定交易所和交易對，**Then** 系統透過 Web API 開倉並驗證倉位數量正確
2. **Given** 開倉成功，**When** 系統設定停損停利單，**Then** 驗證停損停利單已建立且價格、數量正確
3. **Given** 停損停利設定完成，**When** 系統執行平倉，**Then** 驗證倉位已關閉且數量正確
4. **Given** 驗證流程完成，**When** 腳本結束，**Then** 輸出完整驗證報告，顯示 11 項檢查的通過/失敗狀態

---

### User Story 2 - 查詢驗證手動操作結果 (Priority: P2)

用戶已透過 Web 界面手動執行交易操作，想要驗證交易所端的實際狀態是否與系統記錄一致。

**Why this priority**: 提供手動操作後的驗證能力，幫助用戶確認交易所實際狀態。

**Independent Test**: 可透過執行查詢指令，驗證指定持倉的交易所狀態。

**Acceptance Scenarios**:

1. **Given** 用戶已在 Web 界面開倉，**When** 執行查詢驗證指令，**Then** 顯示交易所實際持倉與系統記錄的比對結果
2. **Given** 用戶已設定停損停利，**When** 執行查詢驗證指令，**Then** 顯示交易所條件單狀態與系統記錄的比對結果

---

### User Story 3 - 驗證單一交易所 (Priority: P3)

開發者需要針對特定交易所（如 Gate.io）進行驗證，確認該交易所的 contractSize 轉換等特殊處理是否正確。

**Why this priority**: 支援針對特定交易所的快速驗證，便於除錯和回歸測試。

**Independent Test**: 可指定單一交易所執行驗證。

**Acceptance Scenarios**:

1. **Given** 用戶指定 Gate.io 交易所，**When** 執行驗證腳本，**Then** 僅針對 Gate.io 執行驗證流程
2. **Given** 交易所 contractSize 不為 1，**When** 開倉 100 USDT，**Then** 驗證合約張數轉換正確

---

### Edge Cases

- 當交易所 API 暫時無法連線時，驗證腳本應顯示明確錯誤訊息並安全退出
- 當用戶餘額不足時，應在驗證開始前提示並終止流程
- 當停損停利價格會立即觸發時，應跳過該驗證項目並標記為「無法驗證」
- 當驗證過程中發生部分失敗（如開倉成功但停損設定失敗），應繼續執行可行的驗證項目並完整報告

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系統必須支援透過 Web API 執行開倉操作（呼叫 /api/positions/open）
- **FR-002**: 系統必須在開倉後查詢交易所 API 驗證持倉狀態
- **FR-003**: 系統必須驗證開倉數量與預期一致（考慮 contractSize 轉換）
- **FR-004**: 系統必須驗證停損單已建立且觸發價格正確
- **FR-005**: 系統必須驗證停損單數量正確（考慮 contractSize 轉換）
- **FR-006**: 系統必須驗證停利單已建立且觸發價格正確
- **FR-007**: 系統必須驗證停利單數量正確（考慮 contractSize 轉換）
- **FR-008**: 系統必須支援透過 Web API 執行平倉操作（呼叫 /api/positions/[id]/close）
- **FR-009**: 系統必須驗證平倉後持倉已關閉
- **FR-010**: 系統必須驗證平倉數量正確
- **FR-011**: 系統必須支援查詢模式，僅驗證現有持倉狀態而不執行交易
- **FR-012**: 系統必須輸出結構化驗證報告，包含 11 項檢查結果
- **FR-013**: 系統必須支援 Binance、OKX、Gate.io、BingX 四個交易所

### Key Entities

- **ValidationResult**: 單項驗證結果，包含項目名稱、預期值、實際值、通過/失敗狀態
- **ValidationReport**: 完整驗證報告，包含所有 ValidationResult 和總體統計
- **ExchangePosition**: 交易所持倉資訊，包含 symbol、side、quantity、contractSize
- **ExchangeConditionalOrder**: 交易所條件單資訊，包含 orderId、type、triggerPrice、quantity

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 驗證流程可在 60 秒內完成（開倉→停損停利→平倉→報告）
- **SC-002**: 驗證報告正確識別 100% 的數量轉換錯誤（如 contractSize 問題）
- **SC-003**: 用戶可透過單一指令完成完整驗證，無需手動介入
- **SC-004**: 驗證報告清楚顯示 11 項檢查的通過/失敗狀態
- **SC-005**: 查詢模式可在 10 秒內完成持倉狀態驗證

---

## Assumptions

- 用戶已在系統中設定有效的交易所 API Key
- 用戶帳戶有足夠餘額執行小額測試交易
- 交易所 API 可正常連線
- 用戶接受驗證過程會產生實際交易（含手續費）
