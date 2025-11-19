# Feature Specification: 資金費率間隔動態獲取

**Feature Branch**: `017-funding-rate-intervals`
**Created**: 2025-11-19
**Status**: Draft
**Input**: User description: "Fix funding rate interval dynamic fetching from exchange APIs instead of hardcoded 8-hour default"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Binance 4小時/8小時間隔動態偵測 (Priority: P1) 🎯 MVP

作為套利交易者，我希望系統能正確識別 Binance 上使用 4 小時和 8 小時資金費率間隔的合約，以便準確計算套利收益。

**Why this priority**: Binance 是最大的交易所，自 2023 年 10 月起部分合約改用 4 小時間隔。若使用錯誤的間隔（假設全部為 8 小時），會導致套利收益計算錯誤達 100%（4h 的費率需 × 2 才能與 8h 比較）。這是最高優先級的資料準確性問題。

**Independent Test**: 可透過選擇已知使用 4 小時間隔的 Binance 合約（如 BLZUSDT）和 8 小時間隔的合約（如 BTCUSDT），驗證系統是否正確獲取並顯示各自的間隔，且標準化計算結果符合預期（4h 費率 × 2 ≈ 8h 費率）。

**Acceptance Scenarios**:

1. **Given** 系統監控 BLZUSDT（4 小時間隔）和 BTCUSDT（8 小時間隔），**When** 從 Binance API 獲取資金費率，**Then** 系統正確識別 BLZUSDT 為 4 小時、BTCUSDT 為 8 小時，並在日誌中記錄實際間隔值
2. **Given** 系統首次啟動並呼叫 Binance `/fapi/v1/fundingInfo` API，**When** 獲取間隔資訊成功，**Then** 系統快取每個交易對的間隔值，後續更新資金費率時無需重複呼叫該 API
3. **Given** Binance 4 小時合約的原始費率為 0.0001，8 小時合約的原始費率為 0.0002，**When** 標準化至 8 小時基準，**Then** 4 小時合約的標準化費率為 0.0002（0.0001 × 2），兩者可正確比較
4. **Given** Binance API `/fapi/v1/fundingInfo` 暫時無法訪問，**When** 嘗試獲取間隔資訊，**Then** 系統使用預設值 8 小時並記錄警告日誌，不中斷監控服務

---

### User Story 2 - MEXC 與 Gate.io 間隔欄位擷取 (Priority: P2)

作為套利交易者，我希望系統能從 MEXC 和 Gate.io 的 API 獲取真實的資金費率間隔，而非假設全部為 8 小時，以提高資料完整性。

**Why this priority**: MEXC 和 Gate.io 的原生 API 提供間隔欄位（`collectCycle` 和 `funding_interval`），但目前使用 CCXT 抽象層可能遺失此資訊。雖然這兩個交易所多數合約使用 8 小時間隔，但確保資料準確性仍然重要，且實作成本相對較低。

**Independent Test**: 可透過檢查系統日誌驗證 MEXC 和 Gate.io 的間隔值是否從 API 獲取（而非硬編碼），並測試當 CCXT 未暴露欄位時，系統是否正確降級至原生 API 呼叫。

**Acceptance Scenarios**:

1. **Given** 系統使用 CCXT 從 MEXC 獲取資金費率，**When** CCXT 響應包含 `collectCycle` 欄位，**Then** 系統正確解析並使用該值（如 8）
2. **Given** CCXT 未暴露 MEXC 的 `collectCycle` 欄位，**When** 檢測到缺失，**Then** 系統改用 MEXC 原生 API `/api/v1/contract/funding_rate` 並解析 `collectCycle`
3. **Given** 系統從 Gate.io API 獲取合約資訊，**When** 解析 `funding_interval` 欄位（單位為秒，如 28800），**Then** 系統正確轉換為小時（28800 ÷ 3600 = 8）並儲存
4. **Given** 無法從 MEXC 或 Gate.io API 獲取間隔資訊，**When** 發生錯誤，**Then** 系統使用預設值 8 小時並記錄警告，不影響其他交易所的監控

---

### User Story 3 - OKX 動態間隔計算機制 (Priority: P2)

作為套利交易者，我希望系統能正確識別 OKX 的動態間隔（1h/2h/4h/6h/8h），透過計算 `nextFundingTime` - `fundingTime` 獲取真實間隔，以確保資料準確性。

**Why this priority**: OKX 的資金費率間隔會根據市場波動動態調整（如 API3USDT 使用 4 小時，BTCUSDT 使用 8 小時）。雖然 API 沒有明確的 `fundingIntervalMinutes` 欄位，但可透過時間戳差值輕鬆計算，實作成本低且準確性高，應優先處理。從 P3 提升至 P2。

**Independent Test**: 可透過驗證已知使用 4 小時間隔的 OKX 合約（如 API3-USDT-SWAP），系統是否正確計算 `nextFundingTime` - `fundingTime` = 4 小時，並與 8 小時合約（如 BTC-USDT-SWAP）比較，確認間隔偵測準確。

**Acceptance Scenarios**:

1. **Given** 系統從 OKX API 獲取 BTC-USDT-SWAP 的資金費率，**When** 解析 `fundingTime` 和 `nextFundingTime`，**Then** 系統計算差值（28800000 ms = 8 小時）並正確儲存間隔值
2. **Given** 系統從 OKX API 獲取 API3-USDT-SWAP 的資金費率，**When** 解析時間戳，**Then** 系統計算差值（14400000 ms = 4 小時）並識別為 4 小時間隔
3. **Given** OKX 合約的間隔從 8 小時動態調整為 4 小時（如市場波動觸發自動調整），**When** 下次更新時計算新的時間戳差值，**Then** 系統偵測到間隔變更並更新快取，記錄變更日誌
4. **Given** OKX API 響應缺少 `nextFundingTime` 欄位（異常情況），**When** 無法計算間隔，**Then** 系統使用預設值 8 小時並記錄警告日誌，不中斷監控

---

### Edge Cases

- **間隔資訊快取失效**：當交易所修改合約的資金費率間隔（如 Binance 將某合約從 8h 改為 4h），系統如何更新快取？建議：定期（每 24 小時）重新驗證間隔值，或在偵測到異常費率時觸發重新獲取。
- **API 回應格式變更**：如果交易所修改 API 響應結構（如 Binance 將 `fundingIntervalHours` 改名），系統如何處理？建議：使用防禦性解析（檢查多個可能的欄位名），並在解析失敗時記錄詳細錯誤日誌。
- **多個間隔值不一致**：如果同一交易對在不同 API 端點返回不同間隔值（資料不一致），系統如何決定使用哪個？建議：優先使用專門的合約資訊端點（如 Binance `/fapi/v1/fundingInfo`），並記錄不一致情況。
- **極端間隔值**：如果 API 返回非標準間隔（如 3 小時、12 小時），系統如何處理？建議：支援任意間隔值（不限於 4h/8h），標準化邏輯使用通用公式（原始費率 × 目標基準 ÷ 原始間隔）。
- **並發更新快取**：多個監控任務同時更新同一交易對的間隔資訊時，如何避免競態條件？建議：使用快取鎖機制或原子性更新，確保資料一致性。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系統必須為每個交易所實作動態獲取資金費率間隔的方法（如 `getFundingInterval(symbol)` 和 `getFundingIntervals(symbols)`）
- **FR-002**: 系統必須從 Binance API `/fapi/v1/fundingInfo` 獲取 `fundingIntervalHours` 欄位，識別每個合約的真實間隔（4h 或 8h）
- **FR-003**: 系統必須測試 CCXT 是否暴露 MEXC 的 `collectCycle` 欄位和 Gate.io 的 `funding_interval` 欄位，若否則改用原生 API 呼叫
- **FR-004**: 系統必須實作間隔資訊快取機制（類似現有的 `symbolInfoCache`），避免重複呼叫合約資訊 API
- **FR-005**: 系統必須在無法獲取間隔資訊時使用交易所特定的預設值（Binance/MEXC/Gate.io: 8h），並記錄警告日誌
- **FR-006**: 系統必須從 OKX API 響應中計算資金費率間隔（公式：`(nextFundingTime - fundingTime) / 3600000` 小時），支援動態間隔（1h/2h/4h/6h/8h）
- **FR-007**: 系統必須在 `FundingRateMonitor` 中移除硬編碼的 8 小時預設值（line 369: `const originalInterval = rateData.fundingInterval || 8`），改用從 API 獲取的實際值
- **FR-008**: 系統必須確保 `ExchangeRateData` 介面中的 `fundingInterval` 欄位在所有連接器中被正確填充（而非保持 `undefined`）
- **FR-009**: 系統必須在日誌中記錄每個交易對使用的間隔值（用於驗證和除錯），格式如：`[Binance] BLZUSDT: Using 4h interval (from API)`
- **FR-010**: 系統必須處理間隔單位轉換（如 Gate.io 的秒轉小時：`funding_interval / 3600`），統一使用小時作為內部單位
- **FR-011**: 系統必須在 `FundingRateNormalizer` 使用正確的間隔值進行標準化，確保不同間隔的費率可正確比較（如 4h 費率 × 2 = 8h 等效費率）
- **FR-012**: 系統必須定期（建議每 24 小時）重新驗證快取中的間隔值，以偵測交易所對合約設定的變更

### Key Entities

- **FundingInterval（資金費率間隔）**: 代表特定交易對在特定交易所的資金費率結算週期
  - 屬性：交易所名稱、交易對符號、間隔值（小時）、資料來源（API/推論/預設）、最後更新時間
  - 關聯：關聯至 FundingRate（資金費率數據），用於標準化計算
  - 快取策略：長期快取（24 小時），因間隔值通常不會頻繁變更

- **IntervalCache（間隔快取）**: 儲存各交易對的間隔資訊，減少 API 呼叫
  - 屬性：快取映射（key: `${exchange}-${symbol}`，value: 間隔值）、過期時間戳、快取命中統計
  - 行為：支援批量初始化、單一查詢、定期刷新、清除過期項目

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 系統能正確識別 100% 的 Binance 合約間隔（透過 `/fapi/v1/fundingInfo` API），包含所有 4 小時和 8 小時間隔的合約
- **SC-002**: 對於已知使用 4 小時間隔的 Binance 合約（如 BLZUSDT），標準化至 8 小時基準後的費率誤差 < 0.01%（驗證公式：4h 費率 × 2 ≈ 實際 8h 等效費率）
- **SC-003**: 系統啟動後，95% 以上的監控交易對能從 API 成功獲取間隔資訊（而非使用預設值），透過日誌統計驗證
- **SC-004**: 當某個交易所的間隔 API 不可用時，系統能降級至預設值並繼續運作，不中斷其他交易所的監控（可用性 > 99.9%）
- **SC-005**: 間隔快取機制能減少 90% 以上的合約資訊 API 呼叫（相較於每次更新費率都呼叫），透過 API 呼叫計數驗證
- **SC-006**: 系統日誌能清楚顯示每個交易對使用的間隔值及資料來源（API/推論/預設），方便營運監控和除錯
- **SC-007**: 套利機會計算的準確性提升，因不同間隔的費率能正確標準化和比較（透過回測歷史資料驗證，誤報率降低 > 50%）
