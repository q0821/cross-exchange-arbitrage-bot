# Feature Specification: 修正 OKX 資金費率標準化

**Feature Branch**: `024-fix-okx-funding-normalization`
**Created**: 2025-01-27
**Status**: Draft
**Input**: 修正 OKX 資金費率標準化計算錯誤，無法正確偵測結算週期，導致標準化費率計算錯誤。需要增強間隔偵測邏輯、錯誤處理、降級方案，並新增診斷工具和完整測試覆蓋。

## User Scenarios & Testing

### User Story 1 - 準確偵測 OKX 資金費率結算週期 (Priority: P1) 🎯 MVP

當系統監控 OKX 交易所的資金費率時，能夠正確識別每個交易對的實際結算週期（1 小時、4 小時或 8 小時），避免誤用預設值導致標準化計算錯誤。

**Why this priority**: 這是核心問題，直接影響費率差和年化收益的計算準確性。如果結算週期錯誤（例如實際是 1 小時卻誤判為 8 小時），標準化費率會差 8 倍，導致套利機會判斷完全錯誤。

**Independent Test**: 可以透過查詢 10-20 個 OKX 交易對，對比系統偵測的結算週期與 OKX API 實際返回的週期，驗證準確率是否達標。系統應該能正確處理不同結算週期的交易對，並在日誌中清楚記錄偵測來源（CCXT、Native API 或預設值）。

**Acceptance Scenarios**:

1. **Given** OKX 交易對 BTC/USDT 的實際結算週期是 8 小時，**When** 系統透過 CCXT 獲取資金費率資訊，**Then** 系統正確識別並記錄間隔為 8 小時，標準化計算使用正確的原始週期
2. **Given** OKX API 正確返回 fundingTime 和 nextFundingTime 時間戳，**When** 系統計算間隔差值，**Then** 計算結果在合理範圍內（1, 4, 8 小時之一），且系統記錄偵測來源為 "calculated"
3. **Given** CCXT 未能正確暴露時間戳欄位（info.fundingTime 為 undefined），**When** 系統嘗試讀取間隔，**Then** 系統啟動降級方案（使用 Native API 或預設值），並記錄詳細的降級日誌

---

### User Story 2 - 增強錯誤處理和詳細日誌 (Priority: P1)

當 OKX 間隔偵測過程中發生任何異常情況時，系統能夠記錄詳細的診斷資訊，幫助開發者快速定位問題根源，而不是靜默使用預設值。

**Why this priority**: 完整的日誌是診斷和修復問題的關鍵。目前的問題就是因為缺乏詳細日誌，無法判斷是 CCXT 未暴露欄位、時間戳格式錯誤，還是計算邏輯問題。這與 US1 同等重要，因為沒有日誌就無法驗證 US1 是否正常運作。

**Independent Test**: 可以透過模擬各種錯誤情況（CCXT 失敗、時間戳無效、網路超時等），檢查系統日誌是否包含足夠的診斷資訊（錯誤類型、原始數據、降級路徑等）。每種錯誤情況都應該有對應的日誌級別（warn, error）和結構化資訊。

**Acceptance Scenarios**:

1. **Given** CCXT 未能暴露 fundingTime 欄位，**When** 系統偵測到缺失，**Then** 系統記錄 warn 級別日誌，包含可用欄位列表、info 物件樣本（前 200 字元），並明確說明降級策略
2. **Given** 時間戳解析失敗（parseInt 返回 NaN），**When** 系統驗證數值有效性，**Then** 系統記錄詳細錯誤，包含原始字串值、解析後的數值、預期的時間戳範圍
3. **Given** 計算出的間隔不在標準範圍內（例如 7.2 小時），**When** 系統驗證間隔合理性，**Then** 系統記錄警告，說明計算值與有效值的差異，並說明如何選擇最接近的標準間隔

---

### User Story 3 - Native API 降級方案 (Priority: P2)

當 CCXT 無法正確獲取 OKX 資金費率間隔時，系統自動切換到直接呼叫 OKX Native API 作為備援方案，確保間隔偵測的可靠性。

**Why this priority**: 這是保證系統健壯性的重要機制。如果 CCXT 升級或 OKX API 格式變更導致 CCXT 解析失敗，Native API 降級方案能確保系統持續運作。優先級為 P2 是因為需要先完成 US1（準確偵測）和 US2（日誌記錄），才能正確實作降級邏輯。

**Independent Test**: 可以透過強制 CCXT 失敗（mock 或斷網），驗證系統是否自動啟動 Native API 請求，並成功取得正確的結算週期。測試應該涵蓋 Native API 成功和失敗兩種情況。

**Acceptance Scenarios**:

1. **Given** CCXT fetchFundingRate 拋出異常，**When** 系統捕獲錯誤，**Then** 系統自動嘗試呼叫 OKX Native API (`/api/v5/public/funding-rate`)，使用正確的 instId 格式
2. **Given** Native API 成功返回有效的 fundingTime 和 nextFundingTime，**When** 系統解析回應，**Then** 系統計算並快取間隔，偵測來源標記為 "native-api"
3. **Given** Native API 也失敗（網路錯誤或 API 限流），**When** 所有降級方案都嘗試完畢，**Then** 系統使用預設 8 小時作為最後降級，並記錄完整的失敗鏈路

---

### User Story 4 - 間隔合理性驗證 (Priority: P2)

系統驗證計算出的資金費率間隔是否符合標準值（1, 4, 8 小時），對於異常值進行四捨五入修正或警告，避免資料錯誤導致的計算異常。

**Why this priority**: OKX 的結算週期應該是固定的標準值，如果計算出非標準值（例如 7.9 或 8.1 小時），很可能是數據異常或時鐘偏移。驗證機制能及早發現問題，避免錯誤數據影響後續計算。優先級為 P2 是因為需要基於 US1 的準確偵測邏輯。

**Independent Test**: 可以透過模擬不同的時間戳差值（標準值、接近標準值、完全異常值），驗證系統的驗證邏輯和修正行為是否符合預期。

**Acceptance Scenarios**:

1. **Given** 計算出的間隔是 7.9 小時（接近 8 小時），**When** 系統執行合理性檢查，**Then** 系統四捨五入到最接近的標準值 8 小時，並記錄原始計算值和修正後的值
2. **Given** 計算出的間隔是 5.2 小時（介於 4 和 8 之間），**When** 系統比對標準值列表，**Then** 系統選擇最接近的標準值（可能是 4 或 8），並記錄警告說明偏差較大
3. **Given** 計算出的間隔是負數或零，**When** 系統檢測到無效值，**Then** 系統拒絕使用該值，回退到預設 8 小時，並記錄 error 級別日誌

---

### User Story 5 - 診斷工具和完整測試覆蓋 (Priority: P3)

提供診斷腳本讓開發者能夠快速驗證 OKX 間隔偵測是否正常運作，並透過完整的單元測試和整合測試確保修復的正確性和長期穩定性。

**Why this priority**: 診斷工具和測試是確保修復品質的保障，但不直接影響功能運作，因此優先級為 P3。應該在核心邏輯（US1-US4）完成後再進行。

**Independent Test**: 可以執行診斷腳本對比 CCXT 和 Native API 的結果，檢查是否一致。測試覆蓋率報告應該顯示 > 90% 的行覆蓋率和分支覆蓋率。

**Acceptance Scenarios**:

1. **Given** 診斷腳本 `test-okx-funding-interval.mjs` 執行，**When** 腳本同時呼叫 CCXT 和 Native API，**Then** 腳本輸出兩者的結果對比，突顯任何差異
2. **Given** 單元測試覆蓋所有錯誤路徑，**When** 執行測試套件，**Then** 所有測試通過，覆蓋率報告顯示 > 90%
3. **Given** 整合測試使用真實 OKX API，**When** 測試執行，**Then** 驗證至少 10 個不同交易對的間隔偵測結果正確

---

### Edge Cases

- **時間戳格式異常**：OKX API 返回的時間戳不是預期的毫秒字串格式（例如秒、ISO 8601 格式、或完全無效的字串）
- **網路不穩定**：CCXT 請求超時或部分成功（返回不完整的 info 物件）
- **API 限流**：連續請求 OKX API 導致 429 Too Many Requests 錯誤
- **時鐘偏移**：伺服器時鐘與 OKX 時鐘不同步，導致計算出的間隔略有偏差（例如 7.98 小時）
- **新交易對**：OKX 新上架的交易對可能有不同的結算週期或資料格式
- **CCXT 版本更新**：CCXT 函式庫升級後可能改變 info 物件的結構或欄位名稱
- **空值與 undefined**：fundingTime 或 nextFundingTime 欄位存在但值為 null、空字串或 undefined
- **多重失敗**：CCXT 失敗後，Native API 也失敗，系統需要決定是否繼續使用預設值或暫停監控該交易對

## Requirements

### Functional Requirements

- **FR-001**: 系統必須透過 CCXT fetchFundingRate 嘗試取得 OKX 資金費率的 fundingTime 和 nextFundingTime 時間戳
- **FR-002**: 系統必須計算兩個時間戳的差值並轉換為小時數，作為資金費率結算週期
- **FR-003**: 系統必須驗證計算出的間隔是否為標準值（1, 4, 8 小時），非標準值應四捨五入到最接近的標準值
- **FR-004**: 系統必須在 CCXT 無法提供有效時間戳時，自動降級到 OKX Native API (`/api/v5/public/funding-rate`) 獲取資料
- **FR-005**: 系統必須記錄詳細的診斷日誌，包含：偵測來源（calculated, native-api, default）、原始數據、降級原因
- **FR-006**: 系統必須在所有降級方案都失敗時，使用預設 8 小時作為最後降級，並記錄 warning 級別日誌
- **FR-007**: 系統必須快取已成功偵測的間隔，避免重複 API 請求，快取應包含偵測來源標記
- **FR-008**: 系統必須提供診斷腳本，能夠對比 CCXT 和 Native API 的結果，輸出差異報告
- **FR-009**: 系統必須包含單元測試，覆蓋所有錯誤路徑（CCXT 失敗、時間戳無效、網路錯誤等）
- **FR-010**: 系統必須包含整合測試，使用真實 OKX API 驗證至少 10 個交易對的間隔偵測正確性

### Key Entities

- **FundingRateInterval**: 代表資金費率的結算週期
  - 屬性：交易對符號、間隔小時數（1, 4, 8）、偵測來源、時間戳
  - 來源類型：calculated（從時間戳計算）、native-api（Native API 備援）、fallback-timestamp（從 fundingTimestamp 推算）、default（預設值）、invalid-timestamp（時間戳無效時的預設）、rounded（四捨五入後的值）

- **IntervalDetectionResult**: 間隔偵測的結果物件
  - 屬性：成功/失敗狀態、間隔值、偵測來源、原始數據（fundingTime, nextFundingTime）、錯誤資訊（如果失敗）

## Success Criteria

### Measurable Outcomes

- **SC-001**: OKX 資金費率間隔偵測準確率達到 95% 以上（對比 OKX Native API 真實值）
- **SC-002**: 系統能夠在 CCXT 失敗的情況下，透過 Native API 降級方案成功取得間隔（成功率 > 90%）
- **SC-003**: 所有間隔偵測過程都有詳細的結構化日誌，包含偵測來源、原始數據、降級路徑
- **SC-004**: 單元測試覆蓋率達到 90% 以上，整合測試驗證至少 10 個 OKX 交易對
- **SC-005**: 診斷腳本能夠在 30 秒內完成 10 個交易對的對比測試，輸出清晰的差異報告
- **SC-006**: 修復後，標準化費率計算的準確性提升，套利機會的誤判率降低到 5% 以下
- **SC-007**: 系統能夠處理時間戳格式異常、網路不穩定、API 限流等邊界情況，不會導致服務中斷

## Out of Scope

以下項目不包含在此功能範圍內：

- **Binance 間隔偵測**：Binance 已經有穩定的間隔偵測邏輯（使用 /fapi/v1/fundingInfo），本次只修正 OKX
- **MEXC 和 Gate.io**：這兩個交易所目前使用預設 8 小時，如果未來需要動態偵測，應作為獨立功能
- **歷史資料修正**：資金費率沒有持久化到資料庫，因此不需要資料遷移或修正
- **前端顯示優化**：前端已正確使用後端提供的 originalInterval，不需要額外修改
- **即時 WebSocket 監控**：OKX 資金費率更新仍然使用 REST API 輪詢（每 5 分鐘），不改為 WebSocket
- **多交易所間隔統一**：不嘗試將不同交易所的結算週期統一為相同值，保持原始週期用於標準化計算

## Assumptions

- **假設 1**：OKX 的資金費率結算週期只有 1, 4, 8 小時三種，沒有其他特殊值（如 2 小時、12 小時）
  - 依據：行業標準和 OKX 官方文件，大部分永續合約使用 8 小時結算

- **假設 2**：OKX Native API (`/api/v5/public/funding-rate`) 是穩定的公開 API，不需要身份驗證，不會頻繁變更格式
  - 依據：OKX 官方文件標示此為公開端點，且歷史上格式穩定

- **假設 3**：CCXT 函式庫的 `info` 物件結構可能因版本升級而改變，因此需要 Native API 作為備援
  - 依據：過去 Binance 的經驗（commit 838dadf）顯示 CCXT 可能無法正確解析某些欄位

- **假設 4**：時間戳精度在秒級別就足夠，不需要毫秒級精度
  - 依據：資金費率結算週期是小時級別，秒級精度已經足夠準確

- **假設 5**：快取的間隔值在監控服務重啟前不需要重新驗證
  - 依據：資金費率結算週期是交易所配置，不會在運行期間動態改變

- **假設 6**：單一交易對的間隔偵測失敗不應該影響其他交易對的監控
  - 依據：系統應該具備容錯能力，個別失敗不應該導致整體服務中斷

## Dependencies

### External Dependencies

- **CCXT 函式庫**：依賴 ccxt 版本 4.x 的 `fetchFundingRate()` 方法和 `info` 物件結構
  - 風險：CCXT 升級可能改變 `info` 欄位，需要 Native API 降級方案

- **OKX Public API**：依賴 OKX `/api/v5/public/funding-rate` 端點的可用性和穩定性
  - 風險：OKX API 限流或維護期間可能無法取得資料

- **axios 或 Node.js fetch**：用於 Native API HTTP 請求
  - 風險：網路不穩定可能導致請求超時

### Internal Dependencies

- **IntervalCache**：依賴現有的間隔快取機制（`src/connectors/okx.ts` 中的 `intervalCache`）
  - 依賴版本：當前實作（Feature 017）

- **Logger**：依賴 pino logger 進行結構化日誌記錄
  - 依賴版本：當前配置

- **FundingRateMonitor**：依賴監控服務正確傳遞 `originalInterval` 給前端標準化邏輯
  - 依賴版本：Feature 012, 017 的實作

## Risks

### Technical Risks

- **風險 1：CCXT 持續無法暴露 OKX 時間戳**
  - 影響：如果 CCXT 長期無法正確解析 `fundingTime` 和 `nextFundingTime`，系統會持續依賴 Native API 降級
  - 緩解：建立自動化測試持續監控 CCXT 行為，如果問題持續，考慮向 CCXT 專案提交 PR 修復

- **風險 2：OKX Native API 格式變更**
  - 影響：如果 OKX 改變 API 回應格式，Native API 降級方案會失敗
  - 緩解：建立整合測試持續驗證 Native API 格式，設定監控告警，一旦失敗立即通知開發者

- **風險 3：間隔偵測增加 API 請求量**
  - 影響：每個交易對初次偵測時需要額外的 API 請求，可能觸發 OKX 限流
  - 緩解：使用快取減少重複請求，設定合理的重試延遲，考慮批次初始化而非並發請求

### Operational Risks

- **風險 4：修復後發現新的邊界情況**
  - 影響：生產環境可能出現測試未覆蓋的特殊情況（如新的交易對格式）
  - 緩解：詳細的日誌記錄能快速定位新問題，預設值降級機制確保系統不會中斷

- **風險 5：診斷工具誤判問題**
  - 影響：診斷腳本可能因為臨時網路問題或 API 限流而報告錯誤，誤導開發者
  - 緩解：診斷工具應該支援重試機制，並清楚區分暫時性錯誤和系統性問題

## Notes

- 本次修復參考了 Binance 資金費率間隔偵測的修復經驗（commit 838dadf），該修復成功解決了類似的 CCXT 欄位解析問題
- OKX 的 Native API 文件：https://www.okx.com/docs-v5/zh/#public-data-rest-api-get-funding-rate
- 標準化公式已驗證正確：`normalized = original × (targetInterval / originalInterval)`，問題在於 `originalInterval` 的值不準確
- 修復完成後應該立即生效，因為標準化計算是即時進行的，不依賴歷史資料
