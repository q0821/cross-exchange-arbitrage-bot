# Feature Specification: 改善監控輸出格式

**Feature Branch**: `002-improve-monitor-output`
**Created**: 2025-10-20
**Status**: Draft
**Input**: User description: "目前監控的訊息輸出，非常難閱讀，修改輸出的內容格式，比較方便閱讀，以及如果有套利機會能夠一眼看到"

## Clarifications

### Session 2025-10-20

- Q: 當表格正在更新時，系統如何處理來自 Pino logger 的結構化日誌輸出（如錯誤、警告）？如果直接打印到 stdout，會破壞表格的視覺更新。 → A: 日誌僅輸出到檔案（例如 logs/monitor.log），終端僅顯示表格 UI，保持視覺簡潔
- Q: 表格欄位佈局：資金費率資訊應該如何排列以最大化可讀性？ → A: 橫向排列：上方顯示交易對名稱行，下方顯示對應的幣安/OKX/差異數值（類似儀表板佈局），節省垂直空間
- Q: 當終端視窗寬度不足以顯示完整表格時的處理策略？ → A: 切換到簡化顯示模式，省略部分欄位（例如只顯示交易對名稱和費率差異），保持可讀性
- Q: 當費率數據暫時無法取得時（例如 API 超時）的顯示策略？ → A: 使用視覺佔位符如 "---" 或 "N/A"，清楚標示該欄位資料不可用
- Q: 當系統在非 TTY 環境運行（如重定向到檔案或 CI/CD 管道）時的輸出模式？ → A: 自動檢測非 TTY 環境（process.stdout.isTTY），切換到 plain-text 或 JSON 格式輸出

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 結構化表格顯示資金費率 (Priority: P1)

使用者在執行 `arbitrage-bot monitor start` 時，希望看到清晰的表格格式顯示各交易對的資金費率資訊，而不是雜亂的文字輸出。每次更新應該在固定位置刷新，而不是不斷往下捲動。

**Why this priority**: 這是最基本的可讀性需求，目前的輸出格式 (單純的 console.log) 在監控多個交易對時非常難以追蹤，無法快速比對不同交易對的資訊。

**Independent Test**: 可以透過啟動監控服務並觀察終端輸出，驗證是否顯示為清晰的表格格式，且資訊更新時不會造成畫面混亂。

**Acceptance Scenarios**:

1. **Given** 使用者啟動監控服務追蹤 3 個交易對，**When** 資金費率更新，**Then** 系統在終端顯示橫向排列的表格，上方顯示交易對名稱（BTC、ETH、SOL），下方顯示對應的幣安費率、OKX 費率、費率差異
2. **Given** 監控服務正在運行，**When** 新的資金費率數據到達，**Then** 系統在原地更新表格內容，而不是新增一行（避免畫面滾動混亂）
3. **Given** 表格正在顯示，**When** 使用者調整終端視窗寬度至小於 80 字元，**Then** 系統自動切換到簡化顯示模式（僅顯示交易對名稱和費率差異），保持可讀性
4. **Given** 使用者正在觀看表格輸出，**When** 發生錯誤（例如 API 呼叫失敗），**Then** 錯誤詳細資訊記錄到日誌檔案，狀態摘要區域顯示錯誤計數增加

---

### User Story 2 - 視覺化突顯套利機會 (Priority: P1)

當系統偵測到符合閾值的套利機會時，該交易對的資訊應該透過顏色、emoji 或其他視覺提示明顯突顯，讓使用者能夠一眼識別。

**Why this priority**: 這是使用者明確要求的核心需求——「如果有套利機會能夠一眼看到」。套利交易的時效性很重要，視覺化提示可以讓使用者快速做出反應。

**Independent Test**: 可以透過設定較低的套利閾值（例如 0.01%），讓系統更容易偵測到機會，然後驗證視覺化提示是否正確顯示。

**Acceptance Scenarios**:

1. **Given** 監控服務正在運行且設定閾值為 0.05%，**When** BTC 的費率差異達到 0.06%，**Then** 該行在表格中以綠色背景或綠色文字突顯，並在行首顯示 🎯 emoji
2. **Given** 表格中有 2 個交易對達到套利條件，**When** 使用者查看輸出，**Then** 這 2 個交易對的行都以相同的視覺樣式突顯，其他交易對保持正常樣式
3. **Given** 某個交易對原本達到套利條件，**When** 費率差異降至閾值以下，**Then** 該行的視覺突顯效果移除，恢復為正常樣式
4. **Given** 系統偵測到套利機會，**When** 使用者在無彩色支援的終端運行（例如純黑白終端），**Then** 系統使用替代方案（如 * 或 >>> 符號）標記套利機會

---

### User Story 3 - 顯示統計資訊與狀態摘要 (Priority: P2)

在表格上方或下方顯示監控服務的執行狀態摘要，包括已運行時間、總更新次數、當前活躍套利機會數量等統計資訊。

**Why this priority**: 這是增強型功能，能提升整體使用體驗，讓使用者了解系統運行狀況，但不影響核心的監控與機會識別功能。

**Independent Test**: 可以透過長時間運行監控服務，驗證統計資訊是否準確累計，以及狀態摘要是否及時更新。

**Acceptance Scenarios**:

1. **Given** 監控服務已啟動，**When** 使用者查看輸出，**Then** 畫面頂部顯示標題區域，包含當前時間、已運行時長、監控的交易對列表
2. **Given** 服務運行中，**When** 系統完成 100 次費率更新，**Then** 狀態摘要顯示「總更新次數: 100」
3. **Given** 當前有 2 個交易對達到套利條件，**When** 使用者查看狀態摘要，**Then** 顯示「活躍機會: 2」並以特殊樣式突顯該數字
4. **Given** 監控過程中發生 3 次 API 錯誤，**When** 使用者查看狀態摘要，**Then** 顯示「錯誤次數: 3」並提供錯誤等級指標（如正常/警告/嚴重）

---

### User Story 4 - 詳細機會報告的格式改進 (Priority: P3)

當系統觸發 `opportunity-detected` 事件時，輸出的機會報告應該更加結構化，包含建議操作、預估收益、風險提示等資訊。

**Why this priority**: 這是對現有機會報告功能的增強，對 MVP 來說優先級較低，可以在基本的表格顯示和視覺突顯完成後再優化。

**Independent Test**: 可以透過觸發套利機會事件，驗證機會報告的格式是否清晰、資訊是否完整。

**Acceptance Scenarios**:

1. **Given** 系統偵測到 SOL 的套利機會，**When** 觸發通知，**Then** 輸出包含交易對、費率差異、建議操作方向、預估年化收益率的結構化報告
2. **Given** 機會報告正在顯示，**When** 使用者查看，**Then** 報告使用邊框或分隔線與正常輸出明確區分
3. **Given** 套利機會的費率差異超過閾值 3 倍以上，**When** 輸出報告，**Then** 報告中顯示風險提示（如「費率異常，請確認市場狀況」）
4. **Given** 系統生成機會報告，**When** 使用者希望複製操作建議，**Then** 報告包含易於複製的純文字格式（而非僅視覺化元素）

---

### Edge Cases

- 當終端視窗寬度小於 80 字元時，系統切換到簡化顯示模式（僅顯示交易對名稱和費率差異），省略幣安/OKX 個別費率欄位
- 當監控的交易對數量超過 10 個時，表格是否會過長導致無法在一個畫面內顯示？是否需要分頁或滾動模式？
- 當系統在非 TTY 環境運行（如重定向到檔案或 CI/CD 管道）時，自動檢測 `process.stdout.isTTY` 並切換到 plain-text 或 JSON 格式，避免 ANSI 控制碼造成亂碼
- 當費率數據暫時無法取得時（例如 API 超時），表格中的對應欄位顯示 "---" 或 "N/A"，清楚標示資料不可用狀態

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系統 MUST 以橫向排列的表格格式顯示所有監控中的交易對資金費率資訊，上方顯示交易對名稱行，下方顯示對應的幣安費率、OKX 費率、費率差異數值，最大化垂直空間利用；當終端寬度 < 80 字元時，切換到簡化模式（僅顯示交易對和費率差異）
- **FR-002**: 系統 MUST 當資金費率更新時，在終端的固定位置刷新表格內容，而非新增新行（使用 ANSI 控制碼或類似技術）
- **FR-003**: 系統 MUST 當費率差異達到套利閾值時，以視覺化方式突顯該交易對（顏色、emoji 或其他標記）
- **FR-004**: 系統 MUST 在表格上方顯示監控服務狀態摘要，包含已運行時長、總更新次數、活躍套利機會數量
- **FR-005**: 系統 MUST 當套利機會出現時，輸出結構化的機會報告，包含交易對、費率差異、建議操作方向、預估收益
- **FR-006**: 系統 MUST 偵測終端是否支援彩色輸出（TTY check），若不支援則使用文字符號作為替代方案
- **FR-011**: 系統 MUST 當無法取得交易所資金費率數據時（例如 API 超時、錯誤），在表格對應欄位顯示 "---" 佔位符，明確標示資料不可用狀態
- **FR-007**: 系統 MUST 將 Pino 結構化日誌（包含錯誤、警告、調試資訊）輸出到檔案（例如 `logs/monitor.log`），終端僅顯示表格 UI 和套利機會通知，保持視覺簡潔
- **FR-008**: 系統 SHOULD 根據費率差異的大小使用不同的視覺強度（例如：差異 0.05-0.1% 為黃色警告，> 0.1% 為綠色高亮）
- **FR-009**: 系統 MUST 透過 `process.stdout.isTTY` 檢測非 TTY 環境（如輸出重定向到檔案或 CI/CD 管道），自動切換到 plain-text 或 JSON 格式輸出，不使用 ANSI 控制碼或表格渲染
- **FR-010**: 系統 MAY 提供命令列選項讓使用者選擇輸出模式（表格模式 / 簡化模式 / JSON 模式）

### Non-Functional Requirements

- **NFR-UI-001**: 表格更新的刷新率 MUST 與監控間隔一致（預設 5 秒），不應造成畫面閃爍或視覺疲勞
- **NFR-UI-002**: 輸出格式 MUST 支援常見終端模擬器（iTerm2, Terminal.app, Windows Terminal, VS Code 終端）
- **NFR-UI-003**: 表格渲染邏輯 SHOULD 對效能影響最小，處理時間不超過 10ms（避免阻塞資料更新）
- **NFR-UI-004**: 視覺突顯樣式 SHOULD 遵循無障礙設計原則，不僅依賴顏色（同時提供 emoji 或符號）

### Key Entities

本功能不涉及新的資料模型，主要是改進現有資料的呈現方式。會使用到的現有實體：

- **FundingRatePair**: 已存在於 `src/models/FundingRate.ts`，包含交易對的雙邊資金費率資訊
- **MonitorStatus**: FundingRateMonitor 服務的狀態資訊（可能需要增強以支援統計資料）

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 使用者在監控 3 個交易對時，能夠在單一畫面內同時查看所有資訊，無需滾動（假設終端高度 > 20 行）
- **SC-002**: 當套利機會出現時，使用者能夠在 1 秒內識別出是哪個交易對（透過視覺突顯）
- **SC-003**: 表格更新時，使用者不會看到明顯的畫面閃爍或重繪延遲（刷新時間 < 100ms）
- **SC-004**: 在非彩色終端環境下，使用者仍能透過文字符號識別套利機會（不依賴顏色）
- **SC-005**: 開發者能夠在 30 分鐘內理解並修改輸出格式邏輯（程式碼結構清晰、有適當註解）

## Technical Considerations

### Recommended Libraries

- **cli-table3** 或 **table**: 用於建立 ASCII 表格
- **chalk**: 用於終端顏色輸出（需檢測 TTY 支援）
- **log-update**: 用於在固定位置更新輸出（而非持續新增行）
- **ora** 或 **cli-spinners**: 用於顯示載入狀態（可選）

### Implementation Notes

- 目前的輸出邏輯位於 `src/cli/commands/monitor/start.ts:35-42`，需要重構為獨立的 Formatter 類別
- 需要保持與現有事件監聽器 (`rate-updated`, `opportunity-detected`) 的相容性
- Pino logger 應該繼續用於結構化日誌，新的格式化輸出僅用於終端 UI
- 需要考慮與憲法 Principle II (Complete Observability) 的相容性：重要事件仍需記錄到結構化日誌

### Constitution Compliance Check

根據 `.specify/memory/constitution.md` 檢查本功能對核心原則的影響：

- ✅ **Principle I (Trading Safety First)**: 本功能不涉及交易執行，無影響
- ✅ **Principle II (Complete Observability)**: 輸出格式改進不影響 Pino 結構化日誌，保持完整可觀測性
- ✅ **Principle III (Defensive Programming)**: 需要處理終端環境相容性（TTY 檢測、寬度限制），符合優雅降級原則
- ✅ **Principle IV (Data Integrity)**: 本功能僅改變資料呈現，不涉及資料模型或儲存邏輯
- ✅ **Principle V (Incremental Delivery)**: 這是對 User Story 1 (監控) 的增強，不影響 MVP 核心流程，可獨立測試

**Compliance Status**: ✅ All principles satisfied

## Dependencies & Integration

### Upstream Dependencies

- 依賴 `FundingRateMonitor` 服務正常運作（已在 User Story 1 完成）
- 依賴 `RateDifferenceCalculator` 提供準確的費率差異計算（已實作）

### Downstream Impact

- 不影響其他功能模組，僅改變 CLI 命令的輸出格式
- 未來如果新增 Web UI 或 API，可以復用相同的格式化邏輯（抽象為獨立模組）

### Integration Points

- 修改 `src/cli/commands/monitor/start.ts` 的事件處理邏輯
- 新增 `src/lib/formatters/MonitorOutputFormatter.ts`（建議檔名）處理輸出格式化
- 確保與 `logger` (Pino) 的整合不衝突：結構化日誌繼續使用 logger，終端 UI 使用 formatter

## Out of Scope

以下項目明確不在本功能範圍內：

- ❌ 新增圖表或歷史走勢圖（超出終端 UI 能力，應由 Web UI 實現）
- ❌ 修改資料更新頻率或監控邏輯（屬於 User Story 1 的範疇）
- ❌ 新增音效提示或系統通知（應在通知系統功能中實現）
- ❌ 提供 GUI 或 Web 介面（超出 CLI 範疇）

## Assumptions

- 使用者使用支援 ANSI 控制碼的現代終端模擬器（iTerm2, Terminal.app, Windows Terminal 等）
- 終端視窗寬度至少為 80 個字元（如果更窄，可能需要簡化顯示）
- 使用者在執行監控時會保持終端視窗開啟（不會最小化或切換到其他應用）
- Node.js 執行環境正確設定 `process.stdout.isTTY` 屬性以判斷是否為互動式終端；非 TTY 環境下系統自動切換到 plain-text 或 JSON 格式

## References

- 現有監控輸出實作: `src/cli/commands/monitor/start.ts:35-49`
- 專案憲法: `.specify/memory/constitution.md`
- User Story 1 原始規格: `specs/001-funding-rate-arbitrage/spec.md#user-story-1`
