# Feature Specification: BalanceValidator 單元測試覆蓋

**Feature Branch**: `047-balance-validator-tests`
**Created**: 2025-12-28
**Status**: Draft
**Input**: 為 BalanceValidator 服務添加完整的單元測試覆蓋。BalanceValidator 是核心的風險控制模組，負責保證金計算和餘額驗證，目前完全沒有測試。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 保證金計算邏輯測試 (Priority: P1)

開發者需要確保保證金計算邏輯正確，因為這直接影響用戶能否安全開倉。計算錯誤可能導致資金不足或過度開倉。

**Why this priority**: 保證金計算是風險控制的基礎，錯誤會導致資金損失，必須優先確保正確性。

**Independent Test**: 可以通過單元測試直接驗證 `calculateRequiredMargin` 方法的輸入輸出是否符合預期公式。

**Acceptance Scenarios**:

1. **Given** 數量為 1 BTC、價格為 50000 USDT、槓桿為 10 倍，**When** 計算保證金，**Then** 應返回 5500 USDT（含 10% 緩衝）
2. **Given** 數量為 0.5 ETH、價格為 2000 USDT、槓桿為 5 倍，**When** 計算保證金，**Then** 應返回 220 USDT
3. **Given** 極小數量（0.001）、極高價格（100000），**When** 計算保證金，**Then** 應正確處理精度不丟失
4. **Given** 槓桿為 1 倍，**When** 計算保證金，**Then** 基礎保證金應等於倉位價值

---

### User Story 2 - 餘額查詢功能測試 (Priority: P1)

系統需要正確獲取用戶在各交易所的可用餘額，處理各種 API 狀態（成功、無 API Key、API 錯誤、限流）。

**Why this priority**: 餘額查詢是驗證的前提，如果餘額獲取錯誤，所有後續驗證都會失敗。

**Independent Test**: 可以通過 mock UserConnectorFactory 來測試各種餘額查詢場景。

**Acceptance Scenarios**:

1. **Given** 用戶有有效的 API Key，**When** 查詢餘額，**Then** 應返回正確的餘額數值
2. **Given** 用戶沒有某交易所的 API Key，**When** 查詢該交易所餘額，**Then** 應拋出 ApiKeyNotFoundError
3. **Given** 交易所 API 返回錯誤，**When** 查詢餘額，**Then** 應拋出 ExchangeApiError
4. **Given** 交易所 API 限流，**When** 查詢餘額，**Then** 應拋出帶有 rate_limited 標記的 ExchangeApiError
5. **Given** 查詢多個交易所，**When** 部分交易所無餘額結果，**Then** 該交易所餘額應設為 0

---

### User Story 3 - 餘額充足性驗證測試 (Priority: P1)

系統需要驗證用戶在做多和做空交易所的餘額是否足夠支付所需保證金。

**Why this priority**: 這是開倉前的最後一道防線，驗證失敗應阻止開倉以保護用戶資金。

**Independent Test**: 可以通過 mock 餘額數據來測試 `validateBalance` 的各種通過/失敗場景。

**Acceptance Scenarios**:

1. **Given** 兩個交易所餘額都充足，**When** 驗證餘額，**Then** 應返回 isValid=true 及詳細資訊
2. **Given** 做多交易所餘額不足，**When** 驗證餘額，**Then** 應拋出 InsufficientBalanceError 指向做多交易所
3. **Given** 做空交易所餘額不足，**When** 驗證餘額，**Then** 應拋出 InsufficientBalanceError 指向做空交易所
4. **Given** 兩個交易所餘額都不足，**When** 驗證餘額，**Then** 應先拋出做多交易所的 InsufficientBalanceError
5. **Given** 餘額剛好等於所需保證金（無緩衝），**When** 驗證餘額，**Then** 應因缺少 10% 緩衝而驗證失敗

---

### User Story 4 - 快速檢查功能測試 (Priority: P2)

開發者需要一個不拋出錯誤的檢查方法，用於 UI 預檢或批量驗證場景。

**Why this priority**: 這是 `validateBalance` 的便利包裝，優先級略低於核心驗證。

**Independent Test**: 可以測試 `checkBalance` 在各種場景下是否正確返回結果而非拋出錯誤。

**Acceptance Scenarios**:

1. **Given** 餘額充足，**When** 調用 checkBalance，**Then** 應返回 isValid=true
2. **Given** 餘額不足，**When** 調用 checkBalance，**Then** 應返回 isValid=false 及 insufficientExchange、insufficientAmount
3. **Given** API Key 不存在，**When** 調用 checkBalance，**Then** 應重新拋出 ApiKeyNotFoundError（非餘額不足錯誤）

---

### User Story 5 - 邊界條件與錯誤處理測試 (Priority: P2)

系統需要正確處理各種邊界條件和異常情況。

**Why this priority**: 確保系統在異常情況下的穩健性。

**Independent Test**: 通過構造邊界數據來測試系統行為。

**Acceptance Scenarios**:

1. **Given** 數量為 0，**When** 計算保證金，**Then** 應返回 0
2. **Given** 價格為 0，**When** 計算保證金，**Then** 應返回 0
3. **Given** 同一交易所同時做多做空，**When** 驗證餘額，**Then** 應正確處理（只查詢一次）
4. **Given** Decimal 精度極高的數值，**When** 計算保證金，**Then** 應保持精度不丟失

---

### Edge Cases

- 餘額查詢返回 null 或 undefined 時如何處理？
- 網路超時導致餘額查詢失敗的處理
- 同時對同一用戶進行多次驗證時的併發處理
- 極端槓桿值（如 125 倍）的計算正確性

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 測試套件 MUST 覆蓋 `calculateRequiredMargin` 方法的所有計算路徑
- **FR-002**: 測試套件 MUST 覆蓋 `getBalances` 方法的所有狀態處理（success、no_api_key、api_error、rate_limited）
- **FR-003**: 測試套件 MUST 覆蓋 `validateBalance` 的通過和失敗場景
- **FR-004**: 測試套件 MUST 覆蓋 `checkBalance` 的錯誤轉換邏輯
- **FR-005**: 測試套件 MUST 使用 mock 隔離外部依賴（UserConnectorFactory、PrismaClient）
- **FR-006**: 測試套件 MUST 包含邊界條件測試（零值、極大值、精度）
- **FR-007**: 測試套件 MUST 驗證錯誤類型和錯誤訊息的正確性
- **FR-008**: 每個公開方法 MUST 有至少 3 個測試案例覆蓋正常、邊界、錯誤場景

### Key Entities

- **BalanceValidator**: 核心驗證類，包含保證金計算和餘額驗證邏輯
- **BalanceValidationResult**: 驗證結果物件，包含 isValid、餘額、保證金需求等資訊
- **InsufficientBalanceError**: 餘額不足錯誤，包含交易所、所需金額、可用金額
- **ApiKeyNotFoundError**: API Key 不存在錯誤
- **ExchangeApiError**: 交易所 API 錯誤

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: BalanceValidator 的測試覆蓋率達到 90% 以上
- **SC-002**: 所有 4 個公開方法（calculateRequiredMargin、getBalances、validateBalance、checkBalance）都有完整測試
- **SC-003**: 測試套件執行時間不超過 5 秒（不含網路請求）
- **SC-004**: 測試套件可在 CI/CD 環境中獨立運行，無需外部依賴
- **SC-005**: 所有測試案例使用 describe/it 結構組織，便於閱讀和維護

## Assumptions

- 使用 Vitest 作為測試框架（專案已配置）
- 使用 mock 來隔離 UserConnectorFactory 和 PrismaClient
- 測試數據使用合理的交易參數（如 BTC、ETH 的典型價格和數量）
- 槓桿選項限制為 1-125 倍（根據 LeverageOption 類型）
