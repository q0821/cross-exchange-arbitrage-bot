# Feature Specification: BingX 交易所整合

**Feature Branch**: `043-bingx-integration`
**Created**: 2025-12-25
**Status**: Draft
**Input**: 整合 BingX 交易所，支援 API Key 管理、查詢幣價資金費率、資產查詢、開平倉交易、停損停利、收益計算

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 配置 BingX 監控用 API Key (Priority: P1)

系統管理員需要在 .env 配置檔中設定 BingX 的監控用 API Key，以便系統獲取市場數據（價格、資金費率）。

**Why this priority**: 這是所有 BingX 監控功能的基礎，沒有配置監控 API Key 就無法獲取市場數據。

**Independent Test**: 可以獨立測試配置載入功能，系統啟動時讀取 .env 中的 BingX API Key 並連線測試。

**Acceptance Scenarios**:

1. **Given** 管理員在 .env 中設定 BINGX_API_KEY 和 BINGX_API_SECRET，**When** 系統啟動，**Then** 系統成功載入配置並連線 BingX API
2. **Given** .env 中未設定 BingX API Key，**When** 系統啟動，**Then** 系統記錄警告日誌但不影響其他交易所的正常運作
3. **Given** .env 中設定的 API Key 無效，**When** 系統嘗試獲取數據，**Then** 系統記錄錯誤日誌並標記 BingX 數據為不可用

---

### User Story 2 - 新增 BingX 交易用 API Key (Priority: P1)

用戶需要在 web 界面的 API Key 管理頁面新增 BingX 交易所的 API Key，以便進行交易操作。交易用 API Key 需要更高的權限（合約交易權限）。

**Why this priority**: 這是所有 BingX 交易功能的基礎，沒有有效的交易用 API Key 就無法執行任何交易操作。

**Independent Test**: 可以獨立測試 API Key 的新增、驗證和儲存功能，驗證後用戶可在 API Key 管理頁面看到 BingX 連線狀態。

**Acceptance Scenarios**:

1. **Given** 用戶在 API Key 管理頁面，**When** 用戶選擇 BingX 交易所並輸入有效的 API Key 和 Secret，**Then** 系統顯示連線測試成功，並將加密後的 Key 儲存至資料庫
2. **Given** 用戶輸入無效的 API Key，**When** 系統執行連線測試，**Then** 系統顯示具體的錯誤訊息（如權限不足、Key 無效等）
3. **Given** 用戶輸入的 API Key 缺少合約交易權限，**When** 系統執行連線測試，**Then** 系統顯示「需要合約交易權限」的錯誤訊息
4. **Given** 用戶已有 BingX API Key，**When** 用戶更新 API Key，**Then** 系統重新驗證並更新儲存的憑證

---

### User Story 3 - 查詢 BingX 幣價與資金費率 (Priority: P1)

用戶需要在市場監控頁面查看 BingX 永續合約的即時價格和資金費率，以便發現套利機會。BingX 支援 1 小時、4 小時、8 小時等不同的資金費率結算週期。

**Why this priority**: 資金費率套利的核心功能，需要即時獲取多交易所的資金費率進行比較。

**Independent Test**: 可以獨立測試資金費率獲取功能，在市場監控頁面顯示 BingX 的資金費率數據。

**Acceptance Scenarios**:

1. **Given** 系統已配置有效的 BingX 監控 API Key，**When** 用戶查看市場監控頁面，**Then** 系統顯示 BingX 所有支援交易對的即時價格和資金費率
2. **Given** BingX 交易對有不同的資金費率週期（1h、4h、8h），**When** 系統顯示資金費率，**Then** 同時顯示結算週期資訊以便用戶比較
3. **Given** 系統正在獲取資金費率，**When** BingX API 回應延遲，**Then** 系統顯示載入狀態，並在超時後顯示最後已知數據
4. **Given** 多個交易所有相同交易對，**When** 用戶查看套利機會列表，**Then** BingX 的資金費率與其他交易所一同顯示，便於比較

---

### User Story 4 - 查詢 BingX 帳戶資產 (Priority: P1)

用戶需要查看 BingX 合約帳戶的 USDT 餘額，以評估可用於開倉的資金。

**Why this priority**: 開倉前必須確認帳戶有足夠餘額，是交易流程的必要前置條件。

**Independent Test**: 可以獨立測試餘額查詢功能，在資產總覽頁面顯示 BingX 帳戶餘額。

**Acceptance Scenarios**:

1. **Given** 用戶已配置有效的 BingX 交易用 API Key，**When** 用戶查看資產總覽頁面，**Then** 系統顯示 BingX 合約帳戶的 USDT 總額、可用餘額和凍結餘額
2. **Given** 用戶在開倉對話框，**When** 系統載入帳戶餘額，**Then** 顯示 BingX 可用於開倉的最大金額
3. **Given** BingX API 暫時不可用，**When** 用戶查詢餘額，**Then** 系統顯示上次已知餘額並標註數據時間

---

### User Story 5 - BingX 開倉交易 (Priority: P1)

用戶需要在 BingX 交易所開立多單或空單，支援市價單和限價單兩種類型。

**Why this priority**: 開倉是套利交易的核心操作，直接影響用戶的交易執行。

**Independent Test**: 可以獨立測試開倉功能，驗證訂單成功提交並在持倉列表顯示。

**Acceptance Scenarios**:

1. **Given** 用戶選擇在 BingX 開多單，**When** 用戶設定交易對、數量並確認，**Then** 系統以市價單開倉，並顯示成交價格和手續費
2. **Given** 用戶選擇開空單，**When** 用戶設定限價單價格並確認，**Then** 系統提交限價單，並在訂單成交後更新持倉
3. **Given** 用戶輸入的數量超過帳戶可用餘額，**When** 用戶嘗試開倉，**Then** 系統顯示餘額不足的錯誤訊息
4. **Given** 套利開倉需要同時在兩個交易所操作，**When** 用戶執行套利開倉，**Then** BingX 的開倉與另一交易所的開倉協調執行

---

### User Story 6 - BingX 停損停利設定 (Priority: P2)

用戶在開倉時需要同時設定停損和停利條件單，以控制風險和鎖定利潤。

**Why this priority**: 風險控制功能，雖然重要但可在開倉後手動設定，不阻擋基本交易流程。

**Independent Test**: 可以獨立測試條件單設定功能，驗證停損停利訂單在 BingX 正確創建。

**Acceptance Scenarios**:

1. **Given** 用戶在開倉對話框啟用停損，**When** 用戶設定停損百分比（如 5%），**Then** 系統根據開倉價格計算停損觸發價並創建條件單
2. **Given** 用戶同時啟用停損和停利，**When** 開倉成功後，**Then** 系統在 BingX 創建兩個條件單（止損市價單和止盈市價單）
3. **Given** BingX 的持倉達到停損價格，**When** 條件單觸發，**Then** 系統自動平倉並記錄交易結果
4. **Given** 用戶開倉後想修改停損停利價格，**When** 用戶在持倉詳情修改設定，**Then** 系統取消舊條件單並創建新條件單

---

### User Story 7 - BingX 平倉操作 (Priority: P1)

用戶需要對 BingX 的持倉進行平倉，支援全部平倉和部分平倉。

**Why this priority**: 平倉是交易閉環的必要操作，直接影響用戶的盈虧實現。

**Independent Test**: 可以獨立測試平倉功能，驗證持倉成功平掉並計算盈虧。

**Acceptance Scenarios**:

1. **Given** 用戶有 BingX 的多單持倉，**When** 用戶選擇全部平倉，**Then** 系統以市價平倉，顯示平倉價格和實現盈虧
2. **Given** 用戶有較大持倉，**When** 用戶選擇部分平倉並輸入數量，**Then** 系統按指定數量平倉，剩餘持倉保留
3. **Given** 套利平倉需要同時在兩個交易所操作，**When** 用戶執行套利平倉，**Then** BingX 的平倉與另一交易所的平倉協調執行
4. **Given** BingX 有設定停損停利條件單，**When** 用戶手動平倉，**Then** 系統同時取消相關的條件單

---

### User Story 8 - BingX 收益計算 (Priority: P2)

用戶需要查看 BingX 交易的收益明細，包括平倉損益和資金費率收益。

**Why this priority**: 收益計算是交易結果的呈現，不影響交易執行但對評估策略效果至關重要。

**Independent Test**: 可以獨立測試收益計算功能，在交易歷史頁面顯示完整的盈虧明細。

**Acceptance Scenarios**:

1. **Given** 用戶平倉 BingX 持倉，**When** 平倉完成，**Then** 系統計算並顯示平倉損益（含手續費）
2. **Given** 持倉期間經過資金費率結算時間，**When** 用戶查看持倉或交易歷史，**Then** 系統顯示累計的資金費率收支
3. **Given** 套利交易涉及 BingX 和另一交易所，**When** 用戶查看交易績效，**Then** 系統顯示整體套利收益（兩邊平倉損益 + 兩邊資金費率收支 - 手續費）
4. **Given** 用戶查看歷史交易，**When** 用戶篩選 BingX 交易，**Then** 系統顯示該交易所的所有歷史交易和累計收益

---

### Edge Cases

- 當 BingX API 限流時，系統應如何處理請求佇列？
- 當開倉成功但停損停利條件單創建失敗時，系統應如何處理？
- 當平倉過程中網路中斷導致只有一邊交易所成功時，系統應如何處理？
- 當 BingX 維護期間用戶嘗試交易時，系統應顯示什麼訊息？
- 當資金費率結算時間點正好在平倉過程中時，收益計算應如何處理？
- 當交易對在不同交易所有不同的資金費率週期時（如 BingX 4h vs Binance 8h），如何正確比較年化報酬？

## Requirements *(mandatory)*

### Functional Requirements

**監控用 API Key 配置（.env）**
- **FR-001**: 系統 MUST 支援在 .env 配置 BINGX_API_KEY 和 BINGX_API_SECRET
- **FR-002**: 系統 MUST 在啟動時驗證 BingX 監控 API Key 的有效性
- **FR-003**: 系統 MUST 在監控 API Key 無效時記錄警告日誌但不阻止系統啟動

**交易用 API Key 管理（Web 界面）**
- **FR-004**: 系統 MUST 支援在 web 界面新增 BingX 交易用 API Key 和 Secret
- **FR-005**: 系統 MUST 使用與現有交易所相同的加密機制儲存 BingX API Key
- **FR-006**: 系統 MUST 在儲存前驗證 BingX API Key 的有效性和合約交易權限
- **FR-007**: 系統 MUST 支援 BingX API Key 的更新和刪除操作

**市場數據查詢**
- **FR-008**: 系統 MUST 獲取 BingX 所有永續合約交易對的即時價格
- **FR-009**: 系統 MUST 獲取 BingX 所有永續合約交易對的資金費率
- **FR-010**: 系統 MUST 獲取並顯示每個交易對的資金費率結算週期（1h、4h、8h）
- **FR-011**: 系統 MUST 獲取 BingX 資金費率的下次結算時間
- **FR-012**: 系統 MUST 將 BingX 的資金費率整合到現有的市場監控介面
- **FR-013**: 系統 MUST 根據不同結算週期正確計算年化資金費率以便跨交易所比較

**資產查詢**
- **FR-014**: 系統 MUST 獲取 BingX 合約帳戶的 USDT 餘額（總額、可用、凍結）
- **FR-015**: 系統 MUST 將 BingX 餘額整合到資產總覽頁面
- **FR-016**: 系統 MUST 在開倉對話框顯示 BingX 可用餘額

**開倉交易**
- **FR-017**: 系統 MUST 支援在 BingX 開立多單（做多）
- **FR-018**: 系統 MUST 支援在 BingX 開立空單（做空）
- **FR-019**: 系統 MUST 支援市價單開倉
- **FR-020**: 系統 MUST 支援限價單開倉
- **FR-021**: 系統 MUST 支援設定開倉槓桿倍數
- **FR-022**: 系統 MUST 在開倉前驗證帳戶餘額是否足夠

**停損停利**
- **FR-023**: 系統 MUST 支援開倉時設定停損百分比
- **FR-024**: 系統 MUST 支援開倉時設定停利百分比
- **FR-025**: 系統 MUST 根據開倉價格自動計算停損停利觸發價
- **FR-026**: 系統 MUST 在 BingX 創建對應的條件單（止損市價單、止盈市價單）
- **FR-027**: 系統 MUST 在手動平倉時自動取消相關條件單

**平倉操作**
- **FR-028**: 系統 MUST 支援 BingX 持倉的市價平倉
- **FR-029**: 系統 MUST 支援全部平倉和部分平倉
- **FR-030**: 系統 MUST 在平倉後更新持倉狀態

**收益計算**
- **FR-031**: 系統 MUST 計算 BingX 平倉損益（開倉價 vs 平倉價）
- **FR-032**: 系統 MUST 計算 BingX 交易的手續費成本
- **FR-033**: 系統 MUST 獲取並計算持倉期間的資金費率收支
- **FR-034**: 系統 MUST 將 BingX 收益整合到現有的交易歷史和績效頁面

**系統整合**
- **FR-035**: 系統 MUST 將 BingX 加入支援的交易所列表
- **FR-036**: 系統 MUST 支援 BingX 與其他交易所的套利配對
- **FR-037**: 系統 MUST 遵循現有的錯誤處理和日誌記錄規範

### Key Entities

- **ApiKey**: 儲存 BingX 交易用 API 憑證，包含加密的 Key/Secret、交易所識別、環境（主網/測試網）、啟用狀態
- **Position**: 持倉記錄，擴展支援 BingX 交易所的持倉數據
- **Trade**: 交易記錄，擴展支援 BingX 的開平倉交易和手續費
- **FundingRatePayment**: 資金費率收支記錄，擴展支援 BingX 的資金費率結算
- **環境配置**: .env 中的 BINGX_API_KEY、BINGX_API_SECRET 用於市場數據監控

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 用戶可在 2 分鐘內完成 BingX 交易用 API Key 的新增和驗證
- **SC-002**: BingX 資金費率數據在市場監控頁面的刷新延遲不超過 5 秒
- **SC-003**: BingX 開倉操作從用戶確認到訂單成交的時間不超過 3 秒
- **SC-004**: 停損停利條件單在開倉成功後 2 秒內完成創建
- **SC-005**: 平倉損益計算的準確度達到 99.9%（與交易所數據一致）
- **SC-006**: 資金費率收益的計算誤差不超過 0.01%
- **SC-007**: 系統支援至少 50 個 BingX 永續合約交易對的監控
- **SC-008**: 套利開倉時兩邊交易所的執行時間差不超過 1 秒
- **SC-009**: 不同資金費率週期（1h、4h、8h）的年化計算結果正確可比較

## Assumptions

1. BingX API 支援 CCXT 標準介面，可複用現有的交易所連接器架構
2. BingX 永續合約使用 USDT 作為結算貨幣
3. BingX 資金費率結算週期支援 1 小時、4 小時、8 小時（依交易對不同）
4. BingX API 的請求限制足以支援即時監控和交易操作
5. 用戶的 BingX 帳戶已完成合約交易的開通和身份驗證
6. 監控用 API Key（.env）只需讀取權限，交易用 API Key（資料庫）需要合約交易權限
