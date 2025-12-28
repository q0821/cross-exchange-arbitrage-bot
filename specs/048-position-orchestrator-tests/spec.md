# Feature Specification: PositionOrchestrator 單元測試覆蓋

**Feature Branch**: `048-position-orchestrator-tests`
**Created**: 2025-12-28
**Status**: Draft
**Input**: User description: "為 PositionOrchestrator 服務添加單元測試覆蓋。PositionOrchestrator 是核心開倉服務，使用 Saga 模式實現雙邊開倉。"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 雙邊開倉成功流程測試 (Priority: P1) 🎯 MVP

作為開發者，我需要驗證當兩個交易所都成功開倉時，系統能正確更新 Position 狀態並記錄開倉資訊。

**Why this priority**: 這是最基本的成功路徑，開倉功能的核心價值。

**Independent Test**: 執行 `pnpm test PositionOrchestrator -- --grep "successful bilateral open"` 驗證雙邊成功場景

**Acceptance Scenarios**:

1. **Given** 用戶有足夠餘額且 API Key 有效, **When** 執行開倉請求, **Then** 兩邊都成功開倉且 Position 狀態變為 OPEN
2. **Given** 開倉請求包含停損停利設定, **When** 開倉成功後, **Then** 系統應自動設定條件單並更新 Position 記錄
3. **Given** 開倉成功, **When** 查詢 Position, **Then** 應包含正確的入場價格、數量、訂單 ID

---

### User Story 2 - 回滾機制測試 (Priority: P1)

作為開發者，我需要驗證當一邊開倉成功但另一邊失敗時，系統能正確執行回滾操作以避免單邊曝險。

**Why this priority**: 回滾機制是風險控制的關鍵，防止用戶資金單邊曝險。

**Independent Test**: 執行 `pnpm test PositionOrchestrator -- --grep "rollback"` 驗證回滾場景

**Acceptance Scenarios**:

1. **Given** Long 成功但 Short 失敗, **When** 執行回滾, **Then** 系統應平倉 Long 並標記 Position 為 FAILED
2. **Given** Short 成功但 Long 失敗, **When** 執行回滾, **Then** 系統應平倉 Short 並標記 Position 為 FAILED
3. **Given** 回滾嘗試 3 次都失敗, **When** 回滾結束, **Then** Position 應標記為 PARTIAL 並拋出 RollbackFailedError
4. **Given** 回滾第一次失敗, **When** 第二次重試, **Then** 應等待 1 秒後重試

---

### User Story 3 - 雙邊都失敗處理測試 (Priority: P1)

作為開發者，我需要驗證當兩邊開倉都失敗時，系統能正確記錄錯誤並標記 Position 為 FAILED。

**Why this priority**: 正確處理雙邊失敗能讓用戶清楚了解開倉失敗原因。

**Independent Test**: 執行 `pnpm test PositionOrchestrator -- --grep "both failed"` 驗證雙邊失敗場景

**Acceptance Scenarios**:

1. **Given** Long 和 Short 都因 API 錯誤失敗, **When** 處理結果, **Then** Position 狀態應為 FAILED 且包含兩邊的錯誤訊息
2. **Given** Long 和 Short 都因超時失敗, **When** 處理結果, **Then** 應拋出 TradingError 且 code 為 BILATERAL_OPEN_FAILED

---

### User Story 4 - 餘額驗證測試 (Priority: P2)

作為開發者，我需要驗證開倉前的餘額驗證邏輯能正確阻止餘額不足的開倉請求。

**Why this priority**: 餘額驗證是開倉前的重要檢查，但 BalanceValidator 已有獨立測試。

**Independent Test**: 執行 `pnpm test PositionOrchestrator -- --grep "balance validation"` 驗證餘額驗證

**Acceptance Scenarios**:

1. **Given** 用戶餘額不足, **When** 執行開倉, **Then** 應拋出 InsufficientBalanceError 且 Position 標記為 FAILED
2. **Given** 用戶無 API Key, **When** 執行開倉, **Then** 應拋出 ApiKeyNotFoundError

---

### User Story 5 - 條件單設定測試 (Priority: P2)

作為開發者，我需要驗證開倉成功後的停損停利條件單設定邏輯。

**Why this priority**: 條件單設定失敗不影響開倉成功，但需確保正確記錄狀態。

**Independent Test**: 執行 `pnpm test PositionOrchestrator -- --grep "conditional orders"` 驗證條件單設定

**Acceptance Scenarios**:

1. **Given** 開倉成功且啟用停損, **When** 設定條件單, **Then** Position 應記錄停損價格和訂單 ID
2. **Given** 條件單設定失敗, **When** 處理結果, **Then** Position 的 conditionalOrderStatus 應為 FAILED 但開倉狀態仍為 OPEN
3. **Given** 停損停利都啟用, **When** 設定條件單, **Then** 兩邊的停損停利訂單都應記錄

---

### User Story 6 - 分散式鎖測試 (Priority: P2)

作為開發者，我需要驗證開倉操作使用分散式鎖防止並發衝突。

**Why this priority**: 分散式鎖是並發控制的關鍵，但主要邏輯在 PositionLockService。

**Independent Test**: 執行 `pnpm test PositionOrchestrator -- --grep "lock"` 驗證鎖機制

**Acceptance Scenarios**:

1. **Given** 開倉請求, **When** 執行 openPosition, **Then** 應調用 PositionLockService.withLock
2. **Given** 同一用戶和交易對正在開倉, **When** 再次請求, **Then** 應被鎖阻擋

---

### Edge Cases

- 訂單執行超時（30 秒）時的處理
- Binance 帳戶類型偵測失敗時的預設行為
- CCXT 交易對格式轉換（BTCUSDT → BTC/USDT:USDT）
- 合約數量轉換（非 1:1 合約大小）
- 訂單價格為 0 時的價格獲取備援機制
- Binance 持倉模式不匹配錯誤（-4061）的自動重試

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 測試 MUST 覆蓋 openPosition 主要公開方法
- **FR-002**: 測試 MUST 驗證雙邊成功、雙邊失敗、部分成功三種結果處理
- **FR-003**: 測試 MUST 驗證回滾機制的重試邏輯（最多 3 次，間隔 0/1000/2000ms）
- **FR-004**: 測試 MUST 使用 mock 隔離 PrismaClient、BalanceValidator、ConditionalOrderService、CCXT
- **FR-005**: 測試 MUST 驗證 Position 狀態轉換（PENDING → OPENING → OPEN/FAILED/PARTIAL）
- **FR-006**: 測試 MUST 驗證條件單設定成功和失敗的處理
- **FR-007**: 測試 MUST 驗證錯誤類型的正確拋出（TradingError、RollbackFailedError）
- **FR-008**: 測試 MUST 驗證訂單超時處理（30 秒超時）

### Key Entities

- **Position**: 持倉記錄，包含狀態、入場價格、訂單 ID、條件單資訊
- **OpenPositionParams**: 開倉參數，包含交易對、交易所、數量、槓桿、停損停利設定
- **BilateralOpenResult**: 雙邊開倉結果，包含 longResult 和 shortResult
- **ExecuteOpenResult**: 單邊開倉結果，包含 success、orderId、price、quantity、fee
- **RollbackResult**: 回滾結果，包含 success、attempts、requiresManualIntervention

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 測試覆蓋率達到 80% 以上（行覆蓋）
- **SC-002**: 所有 6 個用戶故事的測試案例都通過
- **SC-003**: 測試套件執行時間低於 10 秒
- **SC-004**: 測試完全隔離，不依賴外部服務（資料庫、交易所 API）
- **SC-005**: 核心流程（成功、回滾、失敗）各有至少 3 個測試案例

## Assumptions

- 測試將使用 Vitest 框架和 vi.mock 進行模擬
- 使用 Decimal.js 處理精度相關測試數據
- PositionLockService.withLock 將被 mock 以直接執行回調
- CCXT 交易所實例將被完全 mock
- ConditionalOrderService 將被 mock 以控制條件單設定結果
