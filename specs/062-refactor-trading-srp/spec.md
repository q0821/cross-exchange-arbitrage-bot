# Feature Specification: 重構交易服務以符合單一職責原則

**Feature Branch**: `062-refactor-trading-srp`
**Created**: 2026-01-13
**Status**: Draft
**Input**: 重構 PositionOrchestrator 和 PositionCloser 的 createCcxtTraderAsync 方法，將 400+ 行的巨大函數拆分為多個職責明確的小函數

## 背景

根據 code-review.md 的審查報告，`PositionOrchestrator.ts` 和 `PositionCloser.ts` 中的 `createCcxtTraderAsync` 方法嚴重違反單一職責原則（SRP）：

- `PositionOrchestrator.createCcxtTraderAsync`: ~427 行
- `PositionCloser.createCcxtTraderAsync`: ~317 行
- `detectBinanceAccountType`: 兩個檔案中完全重複（各 ~30 行）

這些方法包含了太多職責，導致：
- 程式碼難以測試
- 修改一處邏輯需要理解整個方法
- 重複程式碼難以維護

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 維護者修改交易所配置邏輯 (Priority: P1)

作為系統維護者，當我需要修改特定交易所的配置邏輯時，我希望能夠只修改該交易所相關的程式碼，而不需要閱讀和理解 400+ 行的巨大函數。

**Why this priority**: 這是重構的核心價值 - 提升可維護性。開發者最常遇到的痛點就是需要在巨大函數中定位和修改邏輯。

**Independent Test**: 可透過修改單一交易所配置（如 Binance Portfolio Margin 偵測邏輯）來驗證，確認修改範圍僅限於該職責的程式碼。

**Acceptance Scenarios**:

1. **Given** 維護者需要修改 Binance 帳戶類型偵測邏輯，**When** 維護者定位相關程式碼，**Then** 該邏輯應該獨立在一個專責的類別/函數中，行數不超過 50 行
2. **Given** 維護者修改了 Binance 偵測邏輯，**When** 執行所有現有測試，**Then** 不相關的測試（如 OKX 相關測試）不應受影響

---

### User Story 2 - 開發者為價格獲取邏輯撰寫單元測試 (Priority: P2)

作為開發者，當我需要為訂單價格獲取邏輯（包含 fetchOrder 和 fetchMyTrades 的重試機制）撰寫單元測試時，我希望能夠獨立測試這個邏輯，而不需要 mock 整個交易流程。

**Why this priority**: 測試覆蓋率不足是 code-review.md 中標記為 Critical 的問題。拆分後才能有效撰寫單元測試。

**Independent Test**: 可透過撰寫價格獲取服務的單元測試來驗證，確認可以獨立 mock 和測試。

**Acceptance Scenarios**:

1. **Given** 開發者需要測試價格獲取邏輯，**When** 開發者撰寫單元測試，**Then** 只需要 mock 價格獲取相關的依賴，不需要 mock 開倉/平倉邏輯
2. **Given** 價格獲取服務有 fetchOrder 失敗的情況，**When** 呼叫價格獲取服務，**Then** 應該自動使用 fetchMyTrades 作為備援

---

### User Story 3 - 消除重複程式碼 (Priority: P2)

作為系統維護者，當我需要修改 Binance 帳戶類型偵測邏輯時，我希望只需要修改一處程式碼，而不是在兩個不同檔案中分別修改相同的邏輯。

**Why this priority**: 重複程式碼是 code-review.md 中標記為 Major 的問題，會導致維護成本增加和潛在的不一致性。

**Independent Test**: 可透過搜尋 `detectBinanceAccountType` 確認只存在一個實作。

**Acceptance Scenarios**:

1. **Given** 系統中存在 Binance 帳戶類型偵測邏輯，**When** 檢查程式碼庫，**Then** 該邏輯只應存在於一個地方（共用服務）
2. **Given** 開發者修改了共用的 Binance 偵測邏輯，**When** 執行開倉和平倉流程，**Then** 兩者都應使用更新後的邏輯

---

### User Story 4 - 新增交易所支援 (Priority: P3)

作為開發者，當我需要新增一個交易所（如 Bybit）的支援時，我希望能夠透過實作清晰定義的介面來完成，而不需要修改現有的巨大函數。

**Why this priority**: 系統擴展性是長期維護的重要考量，但優先級低於核心重構。

**Independent Test**: 可透過模擬新增交易所的流程來驗證，確認只需要新增新的適配器類別。

**Acceptance Scenarios**:

1. **Given** 開發者需要新增 Bybit 交易所支援，**When** 開發者實作新的適配器，**Then** 不需要修改 PositionOrchestrator 或 PositionCloser 的核心邏輯
2. **Given** 新交易所適配器已實作，**When** 透過工廠方法獲取適配器，**Then** 系統應能正確返回對應的適配器實例

---

### Edge Cases

- 當 Binance 帳戶類型偵測 API 同時失敗時，系統應使用預設值（標準帳戶 + One-way Mode）
- 當價格獲取所有重試都失敗時，系統應記錄警告並使用 0 作為價格
- 當合約大小（contractSize）為 0 或 undefined 時，系統應使用 1 作為預設值

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系統 MUST 將 Binance 帳戶類型偵測邏輯提取到獨立的共用服務，供 PositionOrchestrator 和 PositionCloser 共同使用
- **FR-002**: 系統 MUST 將 CCXT 交易所實例創建邏輯提取到獨立的工廠類別
- **FR-003**: 系統 MUST 將合約數量轉換邏輯提取到獨立的工具類別/函數
- **FR-004**: 系統 MUST 將訂單價格獲取邏輯（含重試機制）提取到獨立的服務
- **FR-005**: 系統 MUST 將不同交易所的訂單參數建構邏輯提取到獨立的建構器
- **FR-006**: 重構後的 PositionOrchestrator 和 PositionCloser MUST 保持與現有 API 完全相容
- **FR-007**: 重構後的程式碼 MUST 通過所有現有的端對端測試

### Non-Functional Requirements

- **NFR-001**: 重構後的每個類別/函數 SHOULD 不超過 100 行
- **NFR-002**: 重構後的程式碼 SHOULD 提升單元測試可測性（每個職責可獨立 mock）
- **NFR-003**: 重構 MUST 不改變現有的功能行為

### Key Entities

- **BinanceAccountDetector**: 負責偵測 Binance 帳戶類型（標準/Portfolio Margin）和持倉模式（One-way/Hedge）
- **CcxtExchangeFactory**: 負責創建和配置 CCXT 交易所實例
- **ContractQuantityConverter**: 負責將用戶數量轉換為合約數量
- **OrderPriceFetcher**: 負責獲取訂單成交價格（含重試和備援機制）
- **OrderParamsBuilder**: 負責根據交易所和持倉模式建構訂單參數

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `createCcxtTraderAsync` 方法行數從 400+ 行減少到 50 行以下
- **SC-002**: 程式碼庫中不存在重複的 `detectBinanceAccountType` 實作
- **SC-003**: 所有現有的端對端測試和手動測試流程維持通過
- **SC-004**: 每個新提取的服務/類別都可以獨立進行單元測試（不需要 mock 整個交易流程）
- **SC-005**: 新增交易所支援時，只需要新增對應的適配器/配置，不需要修改核心協調器邏輯

## Assumptions

1. 現有的 CCXT 4.x 版本 API 不會在重構期間發生重大變更
2. 重構可以在不中斷現有服務的情況下進行（透過 feature branch）
3. 現有的測試覆蓋率足以驗證重構不會破壞功能（透過 E2E 測試）
4. 所有交易所的持倉模式偵測邏輯可以統一抽象為相似的介面

## Out of Scope

1. 不包含新增額外交易所的支援
2. 不包含修改現有的業務邏輯（如回滾機制、鎖機制）
3. 不包含效能優化（如快取交易所實例）
4. 不包含新增單元測試（測試撰寫將作為後續功能）
