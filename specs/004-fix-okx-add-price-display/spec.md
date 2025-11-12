# Feature Specification: 修正 OKX 資金費率與增強價格顯示

**Feature Branch**: `004-fix-okx-add-price-display`
**Created**: 2025-01-21
**Updated**: 2025-01-12
**Status**: Partially Completed
**Completion**: 38% (23/60 tasks completed)
**Input**: User description: "目前看起來取得的 okx 的測試網的資金費率，跟實際測試網上的不太一樣，要來檢查一下是否有那邊錯誤，另外 moninter 的界面除了資金費率外，也該要顯示價格，才知道是否有符合套利的原則，因為不是只有考慮資金費率，也要考慮一下價差，以免賺了資金費率，卻賠了價差，表格的敘述希望能更明確的表示出來是否有套利機會。"

## Implementation Status

### ✅ 已完成功能

**User Story 1 - OKX 資金費率驗證** (核心完成)
- ✅ OKX Native API 整合 (`/api/v5/public/funding-rate`)
- ✅ FundingRateValidator 雙重驗證服務 (OKX + CCXT)
- ✅ FundingRateValidationRepository (Prisma + TimescaleDB)
- ✅ 整合到 FundingRateMonitor
- ✅ CLI 參數 `--enable-validation`
- ✅ 單元測試和整合測試

**User Story 2 - 即時價格監控** (部分完成 - REST 版本)
- ✅ PriceMonitor 服務 (REST 輪詢版本)
- ✅ PriceCache (LRU 快取，10 秒過期)
- ✅ RestPoller (REST API 輪詢器)
- ✅ ReconnectionManager (指數退避重連)
- ✅ HealthChecker (60 秒無訊息檢測)
- ✅ 整合到 FundingRateMonitor
- ✅ CLI 參數 `--enable-price-monitor`

**User Story 3 - 套利可行性評估** (完整實作)
- ✅ ArbitrageAssessor 服務
- ✅ 手續費計算 (Maker/Taker/Mixed)
- ✅ 淨收益計算 (利差 - 手續費)
- ✅ 可行性判斷 (淨收益 > 最小利潤閾值)
- ✅ 極端價差檢測 (>5% 警告)
- ✅ 整合到 FundingRateMonitor
- ✅ CLI 參數支援 (`--arbitrage-capital`, `--maker-fee`, etc.)
- ✅ 單元測試和整合測試

**資料儲存**
- ✅ 套利機會自動寫入資料庫 (ArbitrageOpportunity)
- ✅ 避免重複寫入機制
- ✅ 機會消失自動刪除

### ⏸️ 延後功能

**WebSocket 價格訂閱**
- ⏸️ BinanceWsClient (部分實作，測試未完成)
- ⏸️ OkxWsClient (未實作)
- ⏸️ WebSocket 整合測試
- **原因**: REST 輪詢已滿足需求，WebSocket 作為未來優化項目

**CLI 界面增強**
- ⏸️ MonitorOutputFormatter 增強
- ⏸️ 表格欄位擴充 (價格、淨收益)
- ⏸️ 顏色編碼和 Emoji
- **原因**: 專案改用 Web 界面作為主要顯示方式，CLI 僅負責後台監控

**部分 Polish 任務**
- ⏸️ 完整的 E2E 測試
- ⏸️ 效能優化和程式碼審查
- ⏸️ 完整的文件更新
- **原因**: 核心功能已完成並測試通過，文件和優化可後續補充

### 🎯 實作決策

**架構調整**: 根據專案需求，調整為 **CLI (後台監控) + Web (界面顯示)** 分離架構：
- CLI 負責：監控、計算、寫入 DB、日誌記錄
- Web 負責：查詢 DB、展示套利機會、即時更新

**技術選型調整**:
- 價格數據來源：REST 輪詢 (原計畫為 WebSocket，降級為 REST 簡化實作)
- 輸出方式：資料庫 + WebSocket 廣播 (原計畫為 CLI 輸出)

**測試結果**:
- ✅ 單元測試: 40 passed (ArbitrageAssessor 17 + FundingRateValidator 8 + 其他 15)
- ✅ 整合測試: 12 passed (arbitrage-assessment 6 + okx-funding-rate-validation 6)
- ✅ 總測試: 284 passed | 1 skipped (285)

## Clarifications

### Session 2025-01-21

- Q: OKX 資金費率數據來源驗證方式？ → A: 使用 OKX 永續合約 API (`/api/v5/public/funding-rate`) 與 CCXT 作為備援驗證
- Q: 價格數據更新機制？ → A: WebSocket 即時訂閱 (primary) + REST API 輪詢備援 (fallback)
- Q: 套利可行性判斷的交易手續費假設？ → A: 使用可配置的手續費率，預設 0.1% maker + 0.1% taker = 0.2% 總成本
- Q: 極端價差的異常警報閾值？ → A: 當價差 >5% 時發出警報，但仍顯示數據（警告模式）
- Q: 資金費率驗證結果記錄格式？ → A: 記錄到 TimescaleDB（結構化時序資料，包含驗證時間、交易對、費率、來源、差異百分比）

## User Scenarios & Testing

### User Story 1 - 驗證 OKX 資金費率數據準確性 (Priority: P1) ✅ 核心完成

交易者需要確保從 OKX 測試網獲取的資金費率數據與 OKX 官方網站顯示的數據一致，以避免基於錯誤數據做出交易決策。

**Status**: ✅ 核心功能已實作完成。OKX Native API 整合、雙重驗證、資料庫記錄、CLI 參數支援、測試通過。

**Why this priority**: 數據準確性是套利交易的基礎，錯誤的資金費率會導致套利判斷錯誤，造成實際損失。這是最高優先級問題。

**Independent Test**: 可以獨立測試：啟動監控服務連接到 OKX 測試網，將顯示的資金費率與 OKX 官方測試網頁面上的數據進行比對，確認數值一致。

**Acceptance Scenarios**:

1. **Given** 監控服務連接到 OKX 測試網，**When** 查詢 BTCUSDT 資金費率，**Then** 顯示的費率數值與 OKX 官方測試網頁面完全一致
2. **Given** 監控服務運行中，**When** 資金費率發生變化，**Then** 系統能即時更新並保持與 OKX 官方數據同步
3. **Given** 多個交易對同時監控，**When** 查詢任意交易對資金費率，**Then** 所有交易對的費率數據都與官方一致

---

### User Story 2 - 顯示交易對即時價格 (Priority: P2) ⚠️ 部分完成

交易者需要在監控界面上同時看到各交易對的即時價格和資金費率，以便綜合評估套利機會是否真正可行。

**Status**: ⚠️ 部分完成。PriceMonitor 服務（REST 輪詢）、PriceCache、整合到 Monitor 已完成。WebSocket 訂閱延後，改由 Web 界面顯示價格。

**Why this priority**: 只看資金費率可能產生誤判，因為兩個交易所之間的價差可能會抵消甚至超過資金費率收益。顯示價格是正確判斷套利機會的必要條件。

**Independent Test**: 可以獨立測試：在監控界面上查看任意交易對，驗證是否同時顯示 Binance 和 OKX 的即時價格，並確認價格更新頻率符合預期。

**Acceptance Scenarios**:

1. **Given** 監控界面顯示 BTCUSDT 資料，**When** 查看表格，**Then** 能同時看到 Binance 和 OKX 的當前價格
2. **Given** 價格發生變動，**When** 監控服務更新數據，**Then** 界面上的價格即時更新
3. **Given** 監控多個交易對，**When** 查看表格，**Then** 每個交易對都顯示兩個交易所的價格
4. **Given** 兩個交易所的價格，**When** 系統計算，**Then** 顯示價格差異百分比

---

### User Story 3 - 明確標示套利機會可行性 (Priority: P2) ✅ 完成

交易者需要系統綜合考慮資金費率和價差，明確標示出真正可行的套利機會，而不是單純基於資金費率差異的判斷。

**Status**: ✅ 完整實作。ArbitrageAssessor 服務、手續費計算、淨收益判斷、極端價差檢測、CLI 參數支援、測試通過、自動寫入資料庫。

**Why this priority**: 這是最終的決策支持功能，幫助交易者快速識別值得執行的套利機會，提高決策效率和準確性。

**Independent Test**: 可以獨立測試：設定測試場景（已知資金費率和價差），驗證系統是否正確判斷套利可行性，並在界面上明確標示。

**Acceptance Scenarios**:

1. **Given** 資金費率差異為 0.1%，價差為 0.05%，**When** 系統計算綜合套利空間，**Then** 標示為可行套利機會（淨收益 0.05%）
2. **Given** 資金費率差異為 0.1%，價差為 0.15%，**When** 系統計算綜合套利空間，**Then** 標示為不可行（淨損失 0.05%）
3. **Given** 套利機會可行，**When** 查看監控界面，**Then** 清楚顯示預期淨收益百分比
4. **Given** 套利機會不可行，**When** 查看監控界面，**Then** 清楚標示風險警告並說明原因

---

### Edge Cases

- **資金費率數據缺失**: 當 OKX API 暫時無法返回資金費率數據時，系統顯示「N/A」並標註數據缺失警告
- **價格數據延遲**: 當兩個交易所的價格更新時間不同步時，系統記錄時間戳並在延遲超過 10 秒時顯示警告
- **極端價差**: 當價差 >5% 時，系統發出異常警報（黃色警告標示），但仍顯示完整數據供用戶判斷
- **網路連線問題**: 當連接到 OKX 測試網失敗時，系統顯示連線錯誤訊息並每 10 秒自動重試（最多 3 次）
- **測試網與正式網切換**: 用戶切換測試網/正式網時，系統清空舊數據並重新建立所有 API 連線

## Requirements

### Functional Requirements

- **FR-001**: 系統必須能從 OKX 測試網 API 獲取準確的資金費率數據（使用 OKX 永續合約 API `/api/v5/public/funding-rate`）
- **FR-002**: 系統必須驗證 OKX 資金費率數據一致性（使用 CCXT 作為備援驗證機制）
- **FR-003**: 系統必須在監控界面顯示 Binance 和 OKX 的即時價格（使用 WebSocket 即時訂閱，REST API 輪詢作為備援）
- **FR-004**: 系統必須計算並顯示兩個交易所之間的價格差異百分比
- **FR-005**: 系統必須綜合考慮資金費率差異和價差來判斷套利可行性（支援可配置的手續費率參數）
- **FR-006**: 系統必須在界面上明確標示套利機會的可行性（可行/不可行/風險）
- **FR-007**: 系統必須顯示預期淨收益百分比（資金費率收益 - 價差成本 - 交易手續費）
- **FR-008**: 系統必須在數據異常時顯示警告訊息（包含數據缺失、延遲超過 10 秒、價差 >5% 等情境）
- **FR-009**: 系統必須支持測試網和正式網的數據源切換
- **FR-010**: 系統必須記錄資金費率驗證結果到 TimescaleDB（包含時間戳、交易對、交易所、費率、數據來源、驗證狀態、差異百分比）以供後續分析

### Key Entities

- **價格數據 (Price Data)**: 包含交易所名稱、交易對、買入價、賣出價、中間價、更新時間
- **套利機會評估 (Arbitrage Assessment)**: 包含交易對、資金費率差異、價差、綜合評估結果（可行/不可行）、預期淨收益、風險等級
- **資金費率驗證記錄 (Funding Rate Validation Log)**: 包含時間戳 (timestamp)、交易對 (symbol)、交易所 (exchange)、資金費率 (funding_rate)、數據來源 (source: API/CCXT)、驗證狀態 (validation_status)、差異百分比 (discrepancy_percent)

## Success Criteria

### Measurable Outcomes

- **SC-001**: OKX 測試網的資金費率數據與官方網站顯示的差異小於 0.0001%（基本無誤差）
- **SC-002**: 監控界面能在 2 秒內顯示所有交易對的價格和資金費率數據
- **SC-003**: 價格數據更新延遲不超過 5 秒
- **SC-004**: 套利可行性判斷準確率達到 100%（基於資金費率和價差的數學計算）
- **SC-005**: 用戶能在 3 秒內識別出當前是否存在可行的套利機會
- **SC-006**: 系統能正確處理 95% 以上的 API 錯誤情況並給出明確提示

## Dependencies & Assumptions

### Dependencies

- OKX 測試網 API 必須可用且穩定
- Binance 測試網 API 必須可用且穩定
- 現有的監控服務框架和表格顯示系統已實作
- TimescaleDB 資料庫已配置且可寫入（用於記錄驗證結果）

### Assumptions

- OKX API 返回的資金費率格式與 Binance 一致
- 價格數據優先從 WebSocket ticker 訂閱獲取，WebSocket 斷線時自動切換至 REST API 輪詢
- WebSocket 連線中斷時，系統會在 30 秒內嘗試重連，期間使用 REST API 輪詢維持數據更新
- 套利可行性判斷公式：淨收益 = |資金費率差異| - |價差| - 交易手續費
- 交易手續費可配置，預設值為 0.2%（0.1% maker + 0.1% taker，涵蓋雙邊開倉成本）
- 當淨收益 > 0 時標示為可行套利機會
- 價格使用中間價（(bid + ask) / 2）進行計算
- 測試網和正式網使用相同的判斷邏輯

## Out of Scope

- 自動執行套利交易
- 歷史資金費率和價格數據的回測分析
- 其他交易所（非 Binance 和 OKX）的支援
- 槓桿交易的資金費率計算
- 交易成本優化建議
