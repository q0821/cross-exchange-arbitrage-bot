# Feature Specification: 基於 Open Interest 的動態交易對選擇

**Feature Branch**: `010-open-interest-selection`
**Created**: 2025-11-12
**Completed**: 2025-11-12
**Status**: Completed
**Input**: User description: "動態交易對選擇使用 Open Interest API - 自動從幣安獲取並監控基於 Open Interest 排名的前 100 個交易對，支援 CLI 和 Web 介面。CLI 使用 --top 參數指定數量，Web 介面顯示 OI 欄位並可排序。包含快取機制避免過度呼叫 API，符合交易所速率限制。"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - CLI 動態獲取熱門交易對 (Priority: P1)

交易員希望系統能自動從幣安獲取市場上最活躍的交易對（基於 Open Interest 排名），而不需要手動維護交易對清單，以便即時追蹤最具交易價值的市場機會。

**Why this priority**: 這是核心 MVP 功能，解決了目前需要手動維護 config/symbols.json 的痛點。基於 Open Interest 的自動選擇能確保系統始終監控最活躍的市場，直接提升套利機會發現的效率。這是整個功能的基礎，其他功能都依賴於此。

**Independent Test**: 可以獨立測試 - 執行 `pnpm dev:cli monitor start --auto-fetch --top 50` 命令，系統應從幣安獲取 OI 排名前 50 的交易對並開始監控。成功標準：系統顯示已獲取的交易對清單，並開始接收費率更新。

**Acceptance Scenarios**:

1. **Given** 用戶執行 CLI monitor start 命令並加上 `--auto-fetch --top 100` 參數，**When** 系統啟動，**Then** 系統從幣安 API 獲取 OI 排名前 100 的 USDT 永續合約交易對，並顯示清單
2. **Given** 系統已獲取交易對清單，**When** 清單中某個交易對在幣安或 OKX 不可用，**Then** 系統從清單中移除該交易對並記錄警告訊息，繼續監控其餘交易對
3. **Given** 用戶執行命令時未指定 `--top` 參數，**When** 使用 `--auto-fetch`，**Then** 系統使用預設值（50 個交易對）
4. **Given** 用戶指定 `--top 150`，**When** 系統獲取 OI 資料，**Then** 系統最多返回 150 個交易對（若幣安提供足夠資料）
5. **Given** 系統首次執行 `--auto-fetch`，**When** 獲取 OI 資料時遇到 API 錯誤，**Then** 系統顯示錯誤訊息並退出，不會回退到靜態配置檔案

---

### User Story 2 - Web 介面顯示 OI 資料 (Priority: P2)

交易員在市場監控頁面上希望能看到每個交易對的 Open Interest 數值，並可以根據 OI 大小排序，以便快速識別市場參與度最高的交易對，輔助決策。

**Why this priority**: 在 P1 建立了 OI 資料獲取能力後，此功能提供視覺化呈現，提升用戶體驗。雖然重要但不是核心功能，因為即使沒有 Web 顯示，CLI 已能正常運作。是重要的增強功能。

**Independent Test**: 可以獨立測試 - 開啟市場監控頁面 (http://localhost:3000/market-monitor)，應看到每個交易對旁顯示 OI 數值，點擊 OI 欄位標題可排序。成功標準：OI 欄位正確顯示，排序功能正常運作。

**Acceptance Scenarios**:

1. **Given** 用戶開啟市場監控頁面，**When** 頁面載入完成，**Then** 每個交易對列顯示 Open Interest 數值（單位：美元），格式化為易讀形式（如 $123.5M）
2. **Given** 列表已顯示 OI 資料，**When** 用戶點擊 "Open Interest" 欄位標題，**Then** 列表按 OI 數值降序排列（最高 OI 在最上方）
3. **Given** 列表已按 OI 降序排列，**When** 用戶再次點擊 "Open Interest" 欄位標題，**Then** 列表切換為 OI 升序排列
4. **Given** WebSocket 推送新的費率更新，**When** 更新包含最新的 OI 數值，**Then** 對應交易對的 OI 顯示更新，但列表順序保持穩定（依據 Feature 009 的穩定排序機制）
5. **Given** 某個交易對的 OI 資料暫時無法獲取，**When** 頁面顯示該交易對，**Then** OI 欄位顯示 "N/A" 或 "-"，不影響其他欄位的顯示

---

### User Story 3 - 快取機制減少 API 呼叫 (Priority: P3)

系統在獲取 Open Interest 資料時應使用快取機制，避免在短時間內重複呼叫幣安 API，以符合交易所速率限制並提升系統效能。

**Why this priority**: 這是效能優化功能，在 P1 和 P2 功能正常運作後才需要。雖然能提升系統穩定性和效能，但不是最小可行方案的必要組成部分。可在後續階段實作。

**Independent Test**: 可以獨立測試 - 多次執行 CLI 監控命令，檢查日誌確認系統在快取有效期內（15 分鐘）不會重新呼叫 OI API。成功標準：相同參數在快取有效期內只呼叫一次 API。

**Acceptance Scenarios**:

1. **Given** 系統首次獲取 OI 資料，**When** 資料成功返回，**Then** 系統將結果快取 15 分鐘，並記錄快取建立時間
2. **Given** 快取已建立且未過期（距離上次獲取不足 15 分鐘），**When** 系統需要 OI 資料，**Then** 系統從快取讀取資料，不呼叫幣安 API
3. **Given** 快取已過期（距離上次獲取超過 15 分鐘），**When** 系統需要 OI 資料，**Then** 系統重新呼叫幣安 API 獲取最新資料，並更新快取
4. **Given** 用戶使用不同的 `--top` 參數值，**When** 系統檢查快取，**Then** 系統識別為不同的快取鍵，重新獲取對應數量的資料
5. **Given** 快取中的資料，**When** 系統重啟或快取因任何原因清除，**Then** 系統能正常處理快取不存在的情況，重新獲取資料

---

### Edge Cases

- **API 速率限制觸發**：當系統在短時間內呼叫幣安 API 過於頻繁，觸發 429 Too Many Requests 錯誤時，系統應如何處理？系統應等待適當時間後重試，並記錄警告訊息。
- **OI 資料不完整**：當幣安 API 返回的 OI 資料中，某些交易對缺少 OI 數值時，系統如何處理？系統應跳過沒有 OI 資料的交易對，或將其 OI 視為 0 排在最後。
- **交易所可用性不一致**：當某個交易對在幣安有高 OI，但在 OKX 不可用時，系統如何處理？系統應檢查交易對在目標交易所（幣安、OKX）的可用性，只監控兩者都支援的交易對。
- **極小 OI 值**：當交易對的 OI 非常小（如低於 $10,000）時，是否應該過濾掉？系統應提供可選的 `--min-oi` 參數，允許用戶設定最小 OI 門檻，預設不過濾。
- **OI 資料單位**：不同交易所可能返回不同單位的 OI（合約數量 vs 美元價值），系統如何統一？系統應將所有 OI 轉換為美元價值，使用當前標記價格計算。
- **並行請求處理**：當 Web 介面多個用戶同時請求 OI 資料時，快取機制如何避免重複請求？系統應使用 promise-based locking 確保同一時間只有一個請求在獲取資料，其他請求等待並共享結果。
- **網路中斷後恢復**：當系統因網路問題無法獲取 OI 資料，網路恢復後應如何處理？系統應在下次需要資料時自動重試，不需要手動介入。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: CLI 監控命令必須支援 `--auto-fetch` 參數，啟用後從幣安 API 動態獲取交易對清單，而不使用靜態配置檔案
- **FR-002**: CLI 監控命令必須支援 `--top N` 參數，指定獲取 OI 排名前 N 個交易對，N 的預設值為 50
- **FR-003**: 系統必須能夠從幣安 Futures API 獲取所有 USDT 永續合約的 Open Interest 資料
- **FR-004**: 系統必須根據 Open Interest 數值對交易對進行降序排序，選取前 N 個交易對
- **FR-005**: 系統必須驗證選取的交易對在目標交易所（幣安、OKX）的可用性，只監控兩者都支援的交易對
- **FR-006**: 系統必須在 CLI 啟動時顯示獲取到的交易對清單和每個交易對的 OI 數值
- **FR-007**: 系統必須將 Open Interest 資料轉換為美元價值（使用標記價格），確保單位統一
- **FR-008**: Web 市場監控頁面必須在交易對列表中新增 "Open Interest" 欄位，顯示 OI 美元價值
- **FR-009**: Web 介面必須支援點擊 "Open Interest" 欄位標題進行升序/降序排序
- **FR-010**: Web 介面在顯示 OI 數值時必須格式化為易讀形式（如 $123.5M, $45.2K），保留適當精度
- **FR-011**: 系統必須實作快取機制，將 OI 資料快取 15 分鐘，避免短時間內重複呼叫 API
- **FR-012**: 快取鍵必須包含相關參數（如 top N 的數值），確保不同請求使用正確的快取
- **FR-013**: 系統必須處理幣安 API 速率限制錯誤（HTTP 429），實作適當的 backoff 和重試機制
- **FR-014**: 系統必須處理 OI API 呼叫失敗的情況，當使用 `--auto-fetch` 時若無法獲取資料應顯示錯誤並退出
- **FR-015**: 系統必須在 WebSocket 更新事件中包含最新的 OI 資料（若可用），保持前端資料即時性
- **FR-016**: 系統必須記錄 OI 資料獲取的關鍵事件（成功、失敗、快取命中、快取過期）到日誌

### Key Entities

- **Open Interest Record (OI 記錄)**: 代表特定交易對在特定時間點的未平倉合約量。關鍵屬性包括：交易對名稱（symbol）、OI 數值（以合約數量或美元價值表示）、更新時間戳（timestamp）、數據來源（exchange）。
- **Trading Pair Ranking (交易對排名)**: 基於 OI 數值對交易對的排序結果。關鍵屬性包括：交易對清單（已排序）、排名依據（OI 值）、總交易對數量、排名產生時間。
- **OI Cache Entry (OI 快取條目)**: 儲存快取的 OI 資料。關鍵屬性包括：快取鍵（含參數如 top N）、快取資料（OI 記錄清單）、建立時間、過期時間（TTL: 15 分鐘）。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 使用 `--auto-fetch --top 100` 參數啟動 CLI 監控時，系統能在 30 秒內完成交易對獲取並開始監控，成功率 95% 以上
- **SC-002**: 系統根據 OI 排名獲取的交易對清單中，至少 90% 的交易對在幣安和 OKX 都可用且能成功訂閱費率更新
- **SC-003**: Web 介面顯示 OI 資料時，資料延遲不超過 1 分鐘（從 API 更新到前端顯示）
- **SC-004**: 快取機制有效運作，在快取有效期內（15 分鐘）相同請求的 API 呼叫減少 95% 以上
- **SC-005**: 系統在 24 小時運行期間，因 API 速率限制導致的獲取失敗率低於 1%
- **SC-006**: Web 介面按 OI 排序功能的響應時間在 500 毫秒內完成（30 個交易對）
- **SC-007**: CLI 啟動時顯示的交易對清單準確性達 100%（顯示的交易對都能成功監控）

## Dependencies & Assumptions *(mandatory)*

### Dependencies

- 幣安 Futures API 的 `/fapi/v1/openInterest` 端點可用且穩定
- 現有的 CLI 監控服務 (`src/services/MonitorService.ts`) 可擴展以支援動態交易對清單
- 現有的幣安連接器 (`src/connectors/binance.ts`) 可擴展以支援 OI API 呼叫
- Web 前端已實作穩定排序機制（Feature 009），OI 排序可整合其中
- 系統已有基本的 API 錯誤處理和重試機制

### Assumptions

- 用戶主要關注 USDT 永續合約，不需要支援其他類型的合約（如 BUSD 或交割合約）
- Open Interest 是衡量交易對活躍度的有效指標，OI 高的交易對通常有更好的流動性和套利機會
- 15 分鐘的快取 TTL 對於 OI 資料是合理的，OI 不會在短時間內發生劇烈變化
- 幣安的 OI API 速率限制允許系統在正常使用下不會觸發限制（每個請求 weight 1，限制為 2400/分鐘）
- 用戶期望 CLI 的 `--top` 參數範圍在 10-200 之間，超出此範圍的需求較少見
- OI 資料的更新頻率不需要像費率資料那樣即時（分鐘級更新已足夠）

## Out of Scope *(mandatory)*

- 支援其他交易所（非幣安）的 Open Interest 資料源
- 歷史 OI 資料的儲存和趨勢分析
- OI 變化的警報或通知功能
- 基於 OI 變化的自動交易決策或建議
- 跨交易所的 OI 資料比較或聚合
- 用戶自訂 OI 門檻值的 Web 介面配置（僅 CLI 參數支援）
- 支援非 USDT 計價的合約（如 BUSD, USDC）
- OI 資料的匯出功能（CSV, JSON）
- 多種快取策略的配置選項（固定使用 15 分鐘 TTL）
