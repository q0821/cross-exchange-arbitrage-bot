# Feature Specification: Core Trading Unit Tests

**Feature Branch**: `051-core-trading-tests`
**Created**: 2025-12-30
**Status**: Draft
**Input**: 為核心交易邏輯建立自動化測試覆蓋。目標是為以下關鍵服務建立單元測試：BalanceValidator、PositionOrchestrator、PositionCloser、ConditionalOrderMonitor、FundingFeeQueryService。使用 Vitest 測試框架，目標覆蓋率 80%。

## User Scenarios & Testing

### User Story 1 - BalanceValidator 測試覆蓋 (Priority: P1)

作為開發者，我希望 BalanceValidator 服務有完整的單元測試，以確保餘額驗證邏輯在各種情況下都能正確運作，防止用戶在餘額不足時開倉。

**Why this priority**: 餘額驗證是開倉的第一道防線，錯誤的驗證可能導致交易失敗或資金損失。

**Independent Test**: 可以獨立執行 BalanceValidator 測試套件，驗證所有餘額計算和驗證邏輯。

**Acceptance Scenarios**:

1. **Given** 用戶有足夠餘額，**When** 驗證開倉所需保證金，**Then** 驗證通過
2. **Given** 用戶餘額不足，**When** 驗證開倉所需保證金，**Then** 拋出 InsufficientBalanceError
3. **Given** 不同槓桿倍數，**When** 計算所需保證金，**Then** 計算結果正確
4. **Given** 雙邊交易所餘額，**When** 驗證雙邊開倉，**Then** 同時檢查兩邊餘額

---

### User Story 2 - PositionCloser 測試覆蓋 (Priority: P1)

作為開發者，我希望 PositionCloser 服務有完整的單元測試，以確保平倉邏輯在各種情況下都能正確執行，包括正常平倉和回滾處理。

**Why this priority**: 平倉涉及實際資金操作，錯誤的平倉邏輯可能導致部分平倉或資金損失。

**Independent Test**: 可以獨立執行 PositionCloser 測試套件，使用模擬的交易所 API 驗證平倉流程。

**Acceptance Scenarios**:

1. **Given** 有效的開倉持倉，**When** 執行雙邊平倉，**Then** 兩邊都成功平倉並更新狀態
2. **Given** 一邊平倉成功一邊失敗，**When** 處理部分平倉，**Then** 正確記錄狀態並發出警告
3. **Given** 平倉過程中發生錯誤，**When** 處理錯誤，**Then** 正確記錄錯誤並更新持倉狀態
4. **Given** 已平倉的持倉，**When** 嘗試再次平倉，**Then** 拒絕操作並返回適當錯誤

---

### User Story 3 - PositionOrchestrator 測試覆蓋 (Priority: P2)

作為開發者，我希望 PositionOrchestrator 服務有完整的單元測試，以確保開倉協調邏輯在各種情況下都能正確執行 Saga 模式的事務處理。

**Why this priority**: 開倉協調器管理整個開倉流程，需要確保事務的原子性和一致性。

**Independent Test**: 可以獨立執行 PositionOrchestrator 測試套件，驗證開倉流程的各個階段。

**Acceptance Scenarios**:

1. **Given** 有效的開倉參數和足夠餘額，**When** 執行開倉，**Then** 成功創建持倉記錄
2. **Given** 餘額驗證失敗，**When** 執行開倉，**Then** 拒絕開倉並返回錯誤
3. **Given** 一邊開倉成功一邊失敗，**When** 處理部分成功，**Then** 執行回滾並更新狀態
4. **Given** 啟用停損停利，**When** 開倉成功，**Then** 自動設定條件單

---

### User Story 4 - ConditionalOrderMonitor 測試覆蓋 (Priority: P2)

作為開發者，我希望 ConditionalOrderMonitor 服務有完整的單元測試，以確保條件單監控和觸發偵測邏輯正確運作。

**Why this priority**: 條件單監控影響自動平倉功能，錯誤的監控可能導致錯過觸發或重複觸發。

**Independent Test**: 可以獨立執行 ConditionalOrderMonitor 測試套件，驗證監控輪詢和觸發處理邏輯。

**Acceptance Scenarios**:

1. **Given** 有設定條件單的持倉，**When** 監控服務輪詢，**Then** 正確檢查條件單狀態
2. **Given** 條件單已觸發，**When** 偵測到觸發，**Then** 自動執行對邊平倉
3. **Given** 雙邊條件單都觸發，**When** 偵測到雙邊觸發，**Then** 更新持倉狀態為已平倉
4. **Given** 監控服務正在運行，**When** 請求停止，**Then** 優雅關閉並釋放資源

---

### User Story 5 - FundingFeeQueryService 測試覆蓋 (Priority: P3)

作為開發者，我希望 FundingFeeQueryService 服務有完整的單元測試，以確保資金費率歷史查詢邏輯正確運作。

**Why this priority**: 資金費率查詢用於計算持倉損益，影響報表準確性。

**Independent Test**: 可以獨立執行 FundingFeeQueryService 測試套件，使用模擬的交易所 API 驗證查詢邏輯。

**Acceptance Scenarios**:

1. **Given** 有效的查詢參數，**When** 查詢單一交易所資金費率，**Then** 返回正確的費率記錄
2. **Given** 雙邊交易所，**When** 查詢雙邊資金費率，**Then** 返回合併的費率總計
3. **Given** 查詢時間範圍，**When** 查詢資金費率，**Then** 只返回範圍內的記錄
4. **Given** 交易所 API 錯誤，**When** 查詢失敗，**Then** 返回錯誤狀態並記錄日誌

---

### Edge Cases

- 當交易所 API 回應超時時，測試是否正確處理超時錯誤？
- 當交易所返回無效數據格式時，測試是否正確處理解析錯誤？
- 當並發請求同一持倉時，測試是否正確處理競爭條件？
- 當數據庫連線失敗時，測試是否正確處理並回滾事務？
- 當 Decimal 精度邊界情況時，測試是否正確處理數值計算？

## Requirements

### Functional Requirements

- **FR-001**: 測試套件必須能夠獨立執行，不依賴外部服務（使用 mock）
- **FR-002**: 測試必須涵蓋所有公開方法的正常流程
- **FR-003**: 測試必須涵蓋所有公開方法的錯誤處理流程
- **FR-004**: 測試必須涵蓋邊界條件和異常情況
- **FR-005**: 測試必須使用一致的 mock 和 fixture 模式
- **FR-006**: 測試必須能夠生成覆蓋率報告
- **FR-007**: 測試執行時間必須在合理範圍內（單個測試檔案 < 30 秒）
- **FR-008**: 測試必須能夠在 CI/CD 環境中自動執行

### Key Entities

- **TestSuite**: 每個服務對應一個測試套件，包含多個測試案例
- **Mock**: 模擬外部依賴（Prisma、CCXT、Redis）的替身物件
- **Fixture**: 預設的測試數據，用於建立測試前置條件
- **Coverage Report**: 測試覆蓋率報告，顯示行覆蓋率和分支覆蓋率

## Success Criteria

### Measurable Outcomes

- **SC-001**: 核心服務（BalanceValidator、PositionCloser、PositionOrchestrator、ConditionalOrderMonitor、FundingFeeQueryService）的測試覆蓋率達到 80%
- **SC-002**: 所有測試案例在本地環境執行時間總計 < 2 分鐘
- **SC-003**: 測試套件可在無網路環境下完整執行（所有外部依賴已 mock）
- **SC-004**: 每個服務至少有 10 個測試案例，涵蓋主要功能路徑
- **SC-005**: 測試失敗時提供清晰的錯誤訊息，便於定位問題

## Assumptions

- 使用 Vitest 作為測試框架（專案已配置）
- 使用 vitest-mock-extended 或類似工具進行 mock
- 測試檔案放置於 `tests/unit/services/` 目錄
- 遵循 AAA（Arrange-Act-Assert）測試模式
- 測試命名遵循 `describe-it` 模式，清楚描述測試意圖
