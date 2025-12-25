# Feature Specification: MEXC 交易所開倉限制處理

**Feature Branch**: `044-mexc-trading-restriction`
**Created**: 2025-12-25
**Status**: Draft
**Input**: 由於 MEXC 不支援通過 API 進行開倉交易，需要在前端進行相應處理

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 識別涉及 MEXC 的套利機會 (Priority: P1)

作為一位套利交易者，當我在市場監控頁面查看套利機會時，我希望系統能清楚標示哪些機會涉及 MEXC 交易所，並告知我無法使用一鍵開倉功能，這樣我可以決定是否要手動在 MEXC 建立倉位。

**Why this priority**: 這是核心功能，用戶必須首先知道哪些套利機會涉及 MEXC 限制，才能做出正確的交易決策。

**Independent Test**: 可透過在市場監控頁面觀察涉及 MEXC 的套利機會顯示狀態來獨立測試，確認視覺提示正確呈現。

**Acceptance Scenarios**:

1. **Given** 市場監控頁面顯示一個最佳套利對涉及 MEXC（做多或做空方），**When** 用戶查看該交易對，**Then** 一鍵開倉按鈕顯示為禁用狀態或警告色
2. **Given** 一鍵開倉按鈕因 MEXC 限制而禁用，**When** 用戶將滑鼠移至按鈕上，**Then** 顯示 Tooltip 提示「MEXC 不支援 API 開倉，請手動建倉」
3. **Given** 最佳套利對不涉及 MEXC，**When** 用戶查看該交易對，**Then** 一鍵開倉按鈕正常顯示可點擊狀態

---

### User Story 2 - 開倉對話框 MEXC 警告 (Priority: P2)

作為一位套利交易者，當我開啟涉及 MEXC 的套利機會開倉對話框時，我希望看到明確的警告訊息和 MEXC 交易所連結，這樣我可以方便地前往 MEXC 手動建立倉位。

**Why this priority**: 即使按鈕禁用，用戶仍可能透過其他方式進入對話框（如直接選擇交易對），需要在對話框內再次提醒並提供便利連結。

**Independent Test**: 可透過開啟涉及 MEXC 的套利對話框來獨立測試，確認警告橫幅和連結正確顯示。

**Acceptance Scenarios**:

1. **Given** 用戶開啟一個涉及 MEXC 的套利機會對話框，**When** 對話框載入完成，**Then** 顯示警告橫幅說明 MEXC 不支援 API 開倉
2. **Given** 警告橫幅顯示中，**When** 用戶查看橫幅內容，**Then** 包含可點擊的 MEXC 交易所連結
3. **Given** 涉及 MEXC 的套利機會對話框，**When** 用戶嘗試提交開倉，**Then** 開倉按鈕保持禁用狀態，無法提交

---

### User Story 3 - 保留 MEXC 費率數據顯示 (Priority: P3)

作為一位套利分析者，我希望繼續在市場監控頁面看到 MEXC 的費率數據，即使無法透過 API 開倉，這樣我仍可以評估 MEXC 相關的套利機會價值。

**Why this priority**: MEXC 費率數據對於套利分析仍有價值，用戶可能選擇手動建倉或僅作為參考。

**Independent Test**: 可透過確認市場監控頁面 MEXC 欄位正常顯示費率數據來獨立測試。

**Acceptance Scenarios**:

1. **Given** 市場監控頁面載入完成，**When** 用戶查看費率表格，**Then** MEXC 欄位正常顯示費率、價格等數據
2. **Given** 某交易對的最佳套利機會涉及 MEXC，**When** 系統計算並顯示套利數據，**Then** 仍正常顯示費率差、年化收益等分析數據

---

### User Story 4 - 保留 MEXC 持倉和資產顯示 (Priority: P3)

作為一位交易者，我希望在持倉列表和資產頁面繼續看到我在 MEXC 的持倉和餘額，因為我可能已經手動建立了倉位。

**Why this priority**: 用戶可能已有 MEXC 持倉（手動建立），系統應完整顯示所有持倉狀態。

**Independent Test**: 可透過確認持倉列表和資產頁面正常顯示 MEXC 相關數據來獨立測試。

**Acceptance Scenarios**:

1. **Given** 用戶在 MEXC 有手動建立的持倉，**When** 用戶查看持倉列表，**Then** MEXC 持倉正常顯示
2. **Given** 用戶已設定 MEXC API Key，**When** 用戶查看資產頁面，**Then** MEXC 餘額正常顯示

---

### Edge Cases

- 當 MEXC 是做多方但其他交易所是做空方時，系統如何處理？（答：同樣禁用開倉按鈕）
- 當用戶嘗試透過 URL 直接訪問涉及 MEXC 的開倉功能時怎麼辦？（答：對話框內的警告和禁用按鈕仍然生效）
- 如果未來 MEXC 開放 API 交易，如何快速調整？（答：透過配置或常量控制禁用狀態）

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系統必須識別涉及 MEXC 的套利機會（無論 MEXC 是做多方或做空方）
- **FR-002**: 當最佳套利對涉及 MEXC 時，一鍵開倉按鈕必須顯示為禁用狀態或使用警告色
- **FR-003**: 禁用的開倉按鈕必須顯示 Tooltip，說明「MEXC 不支援 API 開倉，請手動建倉」
- **FR-004**: 開倉對話框必須在涉及 MEXC 時顯示警告橫幅
- **FR-005**: 警告橫幅必須包含可點擊的 MEXC 交易所連結（開新分頁）
- **FR-006**: 涉及 MEXC 的開倉對話框必須禁用提交按鈕
- **FR-007**: 市場監控頁面必須繼續正常顯示 MEXC 費率數據和套利分析
- **FR-008**: 持倉列表必須繼續顯示涉及 MEXC 的持倉（用戶手動建立的）
- **FR-009**: 資產頁面必須繼續顯示 MEXC 餘額
- **FR-010**: MEXC 限制交易所清單應易於維護和擴展（配置化）

### Key Entities

- **RestrictedExchange**: 受限交易所識別標記，包含交易所名稱、限制類型（API 開倉限制）、提示訊息、外部連結

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% 涉及 MEXC 的套利機會在一鍵開倉按鈕上顯示正確的禁用狀態
- **SC-002**: 100% 的禁用按鈕 Tooltip 正確顯示限制說明
- **SC-003**: 用戶可在 1 次點擊內從警告橫幅跳轉至 MEXC 交易所
- **SC-004**: MEXC 費率數據顯示延遲與其他交易所一致（無額外延遲）
- **SC-005**: 用戶能夠正常查看所有 MEXC 相關的持倉和資產數據

## Assumptions

- MEXC 的 API 開倉限制是交易所層面的限制，短期內不會改變
- 用戶理解手動建倉的操作流程
- MEXC 交易所的合約交易網址為 `https://futures.mexc.com/exchange`
- 現有的 Tooltip 和警告橫幅 UI 模式可以復用
