# Feature Specification: CLI 狀態儀表板

**Feature Branch**: `071-cli-status-dashboard`
**Created**: 2026-02-04
**Status**: Draft
**Input**: User description: "程式啟動後cli畫面上可以看到當前的一些狀態, 像是是否有使用proxy, 系統ip(proxy ip), ram usage, 套利機會數量, 監控交易對數量, 或是其他你建議應該要讓管理者知道的即時資訊，並且每10秒刷新一次讓管理者可以從cli介面及時瞭解當前狀態"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 即時監控系統健康狀態 (Priority: P1)

管理者啟動套利機器人後，希望能在 CLI 介面上即時看到系統的運行狀態，包括記憶體使用量、運行時間、網路連線狀態等核心指標，以便快速判斷系統是否正常運作。

**Why this priority**: 系統健康狀態是管理者最基本且最重要的監控需求，直接影響是否需要立即介入處理。

**Independent Test**: 可透過啟動程式並觀察 CLI 輸出來獨立測試，驗證狀態資訊是否正確顯示並每 10 秒自動更新。

**Acceptance Scenarios**:

1. **Given** 程式已啟動, **When** CLI 畫面顯示狀態, **Then** 應顯示系統運行時間（uptime）
2. **Given** 程式已啟動, **When** CLI 畫面顯示狀態, **Then** 應顯示記憶體使用量（RAM usage）且格式為人類可讀（如 "256 MB / 512 MB"）
3. **Given** 系統有配置 Proxy, **When** CLI 畫面顯示狀態, **Then** 應顯示 "Proxy: 啟用" 並顯示 Proxy IP
4. **Given** 系統未配置 Proxy, **When** CLI 畫面顯示狀態, **Then** 應顯示 "Proxy: 未啟用" 並顯示本機公開 IP

---

### User Story 2 - 監控套利業務指標 (Priority: P1)

管理者需要即時了解套利業務的運行情況，包括當前偵測到的套利機會數量、監控中的交易對數量，以便評估系統效能和市場狀況。

**Why this priority**: 套利機會和監控交易對是核心業務指標，直接反映系統的實際運作成效。

**Independent Test**: 可透過啟動監控服務後觀察 CLI 輸出，驗證業務指標是否正確顯示。

**Acceptance Scenarios**:

1. **Given** 監控服務運行中, **When** CLI 畫面顯示狀態, **Then** 應顯示當前活躍套利機會數量
2. **Given** 監控服務運行中, **When** CLI 畫面顯示狀態, **Then** 應顯示監控中的交易對數量
3. **Given** 監控服務運行中, **When** CLI 畫面顯示狀態, **Then** 應顯示已連接的交易所數量

---

### User Story 3 - 自動定時刷新狀態 (Priority: P2)

管理者希望狀態資訊能自動定期更新，無需手動操作，以便持續監控系統狀態。

**Why this priority**: 自動刷新提升監控便利性，但即使手動刷新也能達到基本監控目的。

**Independent Test**: 可透過觀察 CLI 輸出在 10 秒後是否自動更新來獨立測試。

**Acceptance Scenarios**:

1. **Given** CLI 狀態儀表板已顯示, **When** 等待 10 秒, **Then** 狀態資訊應自動刷新
2. **Given** CLI 狀態儀表板正在刷新, **When** 刷新完成, **Then** 應顯示最後更新時間戳記
3. **Given** CLI 狀態儀表板運行中, **When** 更新發生, **Then** 畫面應平滑更新（使用清屏重繪方式），不產生閃爍或殘留字元

---

### User Story 4 - 監控 WebSocket 連線狀態 (Priority: P2)

管理者需要了解各交易所 WebSocket 連線的健康狀態，以便在連線異常時及時處理。

**Why this priority**: WebSocket 連線狀態影響即時數據的準確性，但已有自動重連機制作為後備。

**Independent Test**: 可透過啟動程式並觀察 WebSocket 狀態指標來獨立測試。

**Acceptance Scenarios**:

1. **Given** WebSocket 連線正常, **When** CLI 畫面顯示狀態, **Then** 應顯示各交易所 WebSocket 連線狀態為 "已連線"
2. **Given** 某交易所 WebSocket 斷線, **When** CLI 畫面顯示狀態, **Then** 應顯示該交易所狀態為 "斷線" 並以醒目方式標示

---

### User Story 5 - 顯示錯誤統計 (Priority: P3)

管理者希望能看到系統運行期間發生的錯誤次數統計，以便評估系統穩定性。

**Why this priority**: 錯誤統計有助於長期監控，但不影響即時操作決策。

**Independent Test**: 可透過觀察錯誤計數是否隨系統運行而正確累計來獨立測試。

**Acceptance Scenarios**:

1. **Given** 系統運行中發生錯誤, **When** CLI 畫面顯示狀態, **Then** 應顯示累計錯誤次數
2. **Given** 系統剛啟動, **When** CLI 畫面顯示狀態, **Then** 錯誤計數應為 0

---

### Edge Cases

- 當無法取得公開 IP 時，應顯示 "無法取得" 並不影響其他狀態顯示
- 當記憶體監控服務尚未初始化時，應顯示 "載入中..." 而非錯誤
- 當某個交易所 API 無回應時，應顯示該交易所為 "離線" 狀態
- 當刷新間隔內發生異常，應記錄錯誤但不中斷定時刷新機制
- 當 stdout 被重定向至檔案或在非 TTY 環境（如 Docker、CI）執行時，應自動降級為傳統日誌輸出

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系統 MUST 在程式啟動後自動顯示 CLI 狀態儀表板
- **FR-002**: 系統 MUST 顯示以下系統健康指標：
  - 系統運行時間（uptime），格式為 "Xh Ym Zs"
  - 記憶體使用量（Heap Used / Heap Total），格式為 "XXX MB / YYY MB (ZZ%)"
  - Proxy 狀態（啟用/未啟用）及對應 IP 位址
- **FR-003**: 系統 MUST 顯示以下業務指標：
  - 當前活躍套利機會數量
  - 監控中的交易對數量
  - 已連接的交易所數量
- **FR-004**: 系統 MUST 顯示各交易所 WebSocket 連線狀態（已連線/斷線）
- **FR-005**: 系統 MUST 顯示累計錯誤次數
- **FR-006**: 系統 MUST 每 10 秒自動刷新狀態資訊
- **FR-007**: 系統 MUST 在每次刷新時顯示最後更新時間戳記
- **FR-008**: 系統 MUST 使用清屏重繪方式更新畫面，避免閃爍和殘留字元
- **FR-009**: 使用者 MUST 能夠透過環境變數控制是否啟用 CLI 狀態儀表板
- **FR-010**: 系統 MUST 在無法取得某項資訊時顯示友善的預設值（如 "載入中..."、"無法取得"），而非錯誤訊息
- **FR-011**: 系統 MUST 自動偵測 stdout 是否為互動式終端機（TTY），非 TTY 環境下自動停用清屏刷新功能，改為輸出傳統日誌格式

### Key Entities

- **StatusDashboard**: 儀表板主體，負責協調各狀態資訊的收集與顯示，包含刷新間隔設定
- **SystemStatus**: 系統健康狀態資訊，包含 uptime、記憶體使用量、Proxy 狀態、公開 IP
- **BusinessMetrics**: 業務指標資訊，包含套利機會數量、監控交易對數量、交易所連接數
- **ConnectionStatus**: 連線狀態資訊，包含各交易所 WebSocket 狀態、整體連線健康度
- **ErrorStats**: 錯誤統計資訊，包含累計錯誤次數、最近錯誤時間

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 管理者可在程式啟動後 5 秒內看到完整的狀態儀表板
- **SC-002**: 狀態資訊每 10 秒自動更新，誤差不超過 1 秒
- **SC-003**: 所有顯示的數值與實際系統狀態一致，準確率達 100%
- **SC-004**: 儀表板刷新時畫面無明顯閃爍，使用者體驗流暢
- **SC-005**: 當任一資料來源異常時，儀表板仍能正常運作並顯示其他資訊

## Clarifications

### Session 2026-02-04

- Q: 當 stdout 不是互動式終端機時，儀表板應如何處理？ → A: 自動偵測 TTY：非 TTY 環境自動停用清屏刷新，僅輸出傳統日誌

## Assumptions

- 系統已有 `MonitorStatsTracker` 和 `getMemoryStats()` 等現有元件可供整合
- Proxy 設定從環境變數 `PROXY_URL` 讀取
- 公開 IP 可透過外部服務（如 ipify）查詢取得
- CLI 環境支援 ANSI 控制碼進行畫面清除和游標控制
- 此功能主要用於開發和運維監控，不需要持久化歷史資料
