# Tasks: CLI 狀態儀表板

**Input**: Design documents from `/specs/071-cli-status-dashboard/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, quickstart.md

**Tests**: 遵循 Constitution 原則七（TDD），所有實作任務前必須先寫測試並驗證 FAIL。

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story?] [TEST?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4, US5)
- **[TEST]**: This is a test task - must be written and FAIL before implementation
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: 建立專案結構和基礎型別定義

- [ ] T001 建立 CLI status-dashboard 目錄結構 `src/cli/status-dashboard/`
- [ ] T002 [P] 定義核心型別介面（DashboardState, DashboardConfig, IStatusCollector, IDashboardRenderer）in `src/cli/status-dashboard/types.ts`
- [ ] T003 [P] 建立 public-ip 工具模組 in `src/lib/public-ip.ts`
- [ ] T004 [P] 建立測試目錄結構 `tests/unit/cli/status-dashboard/`
- [ ] T005 更新 `.env.example` 新增環境變數說明（ENABLE_CLI_DASHBOARD, CLI_DASHBOARD_INTERVAL_MS, CLI_DASHBOARD_FORCE_TTY）

**Checkpoint**: 基礎結構就緒，可開始實作各 User Story

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 建立核心 StatusDashboard 類別框架，為所有 User Story 提供基礎

**⚠️ CRITICAL**: 此階段必須完成後才能開始 User Story 實作

- [ ] T006 [TEST] 撰寫 StatusDashboard 核心類別測試 in `tests/unit/cli/status-dashboard/StatusDashboard.test.ts`（測試 start/stop/refresh 生命週期）
- [ ] T007 實作 StatusDashboard 核心類別框架 in `src/cli/status-dashboard/StatusDashboard.ts`（包含 start, stop, refresh 方法骨架）
- [ ] T008 [TEST] 撰寫 TtyRenderer 基礎測試 in `tests/unit/cli/status-dashboard/renderers/TtyRenderer.test.ts`（測試 render 和 cleanup 方法）
- [ ] T009 [P] 實作 TtyRenderer 基礎框架 in `src/cli/status-dashboard/renderers/TtyRenderer.ts`（清屏、基本輸出格式）
- [ ] T010 [TEST] 撰寫 LogRenderer 基礎測試 in `tests/unit/cli/status-dashboard/renderers/LogRenderer.test.ts`（測試 JSON 輸出）
- [ ] T011 [P] 實作 LogRenderer 基礎框架 in `src/cli/status-dashboard/renderers/LogRenderer.ts`（Pino 結構化輸出）
- [ ] T012 實作 StatusDashboard 的 TTY 偵測邏輯（selectRenderer 方法）in `src/cli/status-dashboard/StatusDashboard.ts`

**Checkpoint**: Foundation ready - User Story 實作可以開始

---

## Phase 3: User Story 1 - 即時監控系統健康狀態 (Priority: P1) 🎯 MVP

**Goal**: 顯示系統運行時間、記憶體使用量、Proxy 狀態和公開 IP

**Independent Test**: 啟動程式後觀察 CLI 輸出，驗證系統健康指標正確顯示

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T013 [TEST] [US1] 撰寫 SystemStatusCollector 單元測試 in `tests/unit/cli/status-dashboard/collectors/SystemStatusCollector.test.ts`
- [ ] T014 [TEST] [US1] 撰寫 public-ip 工具單元測試 in `tests/unit/lib/public-ip.test.ts`

### Implementation for User Story 1

- [ ] T015 [US1] 實作 public-ip 工具（ipify API 查詢、快取、timeout 處理）in `src/lib/public-ip.ts`
- [ ] T016 [US1] 實作 SystemStatusCollector in `src/cli/status-dashboard/collectors/SystemStatusCollector.ts`
  - 整合 MonitorStatsTracker.getFormattedUptime()
  - 整合 getMemoryStats()
  - 讀取 process.env.PROXY_URL
  - 呼叫 public-ip 取得公開 IP
- [ ] T017 [US1] 更新 TtyRenderer 支援系統健康狀態區塊渲染 in `src/cli/status-dashboard/renderers/TtyRenderer.ts`
- [ ] T018 [US1] 更新 LogRenderer 支援系統健康狀態 JSON 欄位 in `src/cli/status-dashboard/renderers/LogRenderer.ts`
- [ ] T019 [US1] 整合 SystemStatusCollector 到 StatusDashboard in `src/cli/status-dashboard/StatusDashboard.ts`

**Checkpoint**: User Story 1 完成 - 可顯示系統健康狀態（uptime, memory, proxy, IP）

---

## Phase 4: User Story 2 - 監控套利業務指標 (Priority: P1) 🎯 MVP

**Goal**: 顯示套利機會數量、監控交易對數量、交易所連接數

**Independent Test**: 啟動監控服務後觀察 CLI 輸出，驗證業務指標正確顯示

### Tests for User Story 2 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T020 [TEST] [US2] 撰寫 BusinessMetricsCollector 單元測試 in `tests/unit/cli/status-dashboard/collectors/BusinessMetricsCollector.test.ts`

### Implementation for User Story 2

- [ ] T021 [US2] 實作 BusinessMetricsCollector in `src/cli/status-dashboard/collectors/BusinessMetricsCollector.ts`
  - 整合 MonitorStatsTracker.getStats().activeOpportunities
  - 整合 FundingRateMonitor.getStatus().symbols.length 取得監控交易對數量
  - 引用 ACTIVE_EXCHANGES 取得交易所清單
- [ ] T022 [US2] 更新 TtyRenderer 支援業務指標區塊渲染 in `src/cli/status-dashboard/renderers/TtyRenderer.ts`
- [ ] T023 [US2] 更新 LogRenderer 支援業務指標 JSON 欄位 in `src/cli/status-dashboard/renderers/LogRenderer.ts`
- [ ] T024 [US2] 整合 BusinessMetricsCollector 到 StatusDashboard in `src/cli/status-dashboard/StatusDashboard.ts`

**Checkpoint**: User Story 2 完成 - 可顯示業務指標（套利機會、交易對、交易所）

---

## Phase 5: User Story 3 - 自動定時刷新狀態 (Priority: P2)

**Goal**: 每 10 秒自動刷新狀態資訊，顯示最後更新時間戳記

**Independent Test**: 觀察 CLI 輸出在 10 秒後是否自動更新

### Tests for User Story 3 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T025 [TEST] [US3] 撰寫 StatusDashboard 定時刷新測試 in `tests/unit/cli/status-dashboard/StatusDashboard.test.ts`（使用 fake timers）

### Implementation for User Story 3

- [ ] T026 [US3] 實作 StatusDashboard 的 setInterval 刷新機制 in `src/cli/status-dashboard/StatusDashboard.ts`
  - 從環境變數讀取刷新間隔（CLI_DASHBOARD_INTERVAL_MS）
  - 實作 Promise.allSettled 收集邏輯
  - 確保 stop() 時正確清理 interval
- [ ] T027 [US3] 更新 TtyRenderer 顯示最後更新時間戳記 in `src/cli/status-dashboard/renderers/TtyRenderer.ts`
- [ ] T028 [US3] 更新 LogRenderer 加入時間戳記欄位 in `src/cli/status-dashboard/renderers/LogRenderer.ts`

**Checkpoint**: User Story 3 完成 - 狀態每 10 秒自動刷新

---

## Phase 6: User Story 4 - 監控 WebSocket 連線狀態 (Priority: P2)

**Goal**: 顯示各交易所 WebSocket 連線狀態

**Independent Test**: 啟動程式觀察各交易所 WebSocket 狀態指標

### Tests for User Story 4 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T029 [TEST] [US4] 撰寫 ConnectionStatusCollector 單元測試 in `tests/unit/cli/status-dashboard/collectors/ConnectionStatusCollector.test.ts`

### Implementation for User Story 4

- [ ] T030 [US4] 實作 ConnectionStatusCollector in `src/cli/status-dashboard/collectors/ConnectionStatusCollector.ts`
  - 整合 DataSourceManager.getInstance().getSummary()
  - 轉換為 ConnectionStatus 介面格式
  - 計算整體連線健康度
- [ ] T031 [US4] 更新 TtyRenderer 支援 WebSocket 連線狀態區塊渲染 in `src/cli/status-dashboard/renderers/TtyRenderer.ts`
  - 已連線顯示綠色 ●
  - 斷線顯示紅色 ○ 並醒目標示
- [ ] T032 [US4] 更新 LogRenderer 支援 WebSocket 狀態 JSON 欄位 in `src/cli/status-dashboard/renderers/LogRenderer.ts`
- [ ] T033 [US4] 整合 ConnectionStatusCollector 到 StatusDashboard in `src/cli/status-dashboard/StatusDashboard.ts`

**Checkpoint**: User Story 4 完成 - 可顯示各交易所 WebSocket 連線狀態

---

## Phase 7: User Story 5 - 顯示錯誤統計 (Priority: P3)

**Goal**: 顯示累計錯誤次數

**Independent Test**: 觀察錯誤計數是否隨系統運行正確累計

### Tests for User Story 5 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T034 [TEST] [US5] 撰寫 ErrorStats 收集邏輯測試（整合在 SystemStatusCollector 或獨立）in `tests/unit/cli/status-dashboard/collectors/SystemStatusCollector.test.ts`

### Implementation for User Story 5

- [ ] T035 [US5] 擴展 SystemStatusCollector 或新增邏輯收集 ErrorStats in `src/cli/status-dashboard/collectors/SystemStatusCollector.ts`
  - 整合 MonitorStatsTracker.getStats().errorCount
- [ ] T036 [US5] 更新 TtyRenderer 顯示錯誤統計區塊 in `src/cli/status-dashboard/renderers/TtyRenderer.ts`
- [ ] T037 [US5] 更新 LogRenderer 加入 errors 欄位 in `src/cli/status-dashboard/renderers/LogRenderer.ts`

**Checkpoint**: User Story 5 完成 - 可顯示累計錯誤次數

---

## Phase 8: Polish & Integration

**Purpose**: 整合入主程式、邊界情況處理、文件更新

- [ ] T038 [TEST] 撰寫整合測試驗證完整儀表板流程 in `tests/integration/cli/status-dashboard.integration.test.ts`
- [ ] T039 建立 CLI status-dashboard 主入口模組 in `src/cli/status-dashboard/index.ts`（匯出 createStatusDashboard 工廠函數）
- [ ] T040 整合 StatusDashboard 到 server.ts 啟動流程（根據 ENABLE_CLI_DASHBOARD 環境變數決定是否啟動）
- [ ] T041 實作邊界情況處理：
  - 無法取得公開 IP 時顯示 "無法取得"
  - 記憶體監控尚未初始化時顯示 "載入中..."
  - 收集器異常時不中斷刷新機制
- [ ] T042 [P] 更新 CLAUDE.md 新增 Feature 071 參考說明
- [ ] T043 驗證 quickstart.md 中的顯示範例與實際輸出一致

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)
    ↓
Phase 2 (Foundational) ← BLOCKS all user stories
    ↓
┌───────────────────────────────────────────────────────┐
│  Phase 3 (US1) ─┬─→ Phase 4 (US2) ← Both are P1 MVP  │
│                 │                                     │
│  Phase 5 (US3) ─┴─→ Phase 6 (US4) ← P2, can parallel │
│                                                       │
│  Phase 7 (US5) ← P3, lowest priority                  │
└───────────────────────────────────────────────────────┘
    ↓
Phase 8 (Polish) ← After all desired stories complete
```

### User Story Dependencies

| User Story | 依賴 | 可平行 |
|------------|------|--------|
| US1 (P1) | Foundational 完成 | 可與 US2 平行 |
| US2 (P1) | Foundational 完成 | 可與 US1 平行 |
| US3 (P2) | US1 + US2（需要資料來渲染） | 可與 US4 平行 |
| US4 (P2) | Foundational 完成 | 可與 US3 平行 |
| US5 (P3) | Foundational 完成 | 獨立 |

### TDD 循環（每個任務內）

1. **Red**: 撰寫 [TEST] 任務的測試，執行並驗證 FAIL
2. **Green**: 實作對應功能，使測試 PASS
3. **Refactor**: 改善程式碼品質，確保測試仍 PASS

---

## Parallel Opportunities

### Phase 1 平行任務

```bash
# 可同時執行
Task T002: 定義核心型別介面 in src/cli/status-dashboard/types.ts
Task T003: 建立 public-ip 工具模組 in src/lib/public-ip.ts
Task T004: 建立測試目錄結構
```

### Phase 2 平行任務

```bash
# Renderers 可平行開發
Task T009: 實作 TtyRenderer 基礎框架
Task T011: 實作 LogRenderer 基礎框架
```

### User Story 平行開發

```bash
# US1 和 US2 都是 P1，可平行開發（不同收集器）
Developer A: Phase 3 (US1 - SystemStatusCollector)
Developer B: Phase 4 (US2 - BusinessMetricsCollector)

# US3 和 US4 都是 P2，可平行開發
Developer A: Phase 5 (US3 - 定時刷新)
Developer B: Phase 6 (US4 - ConnectionStatusCollector)
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. 完成 Phase 1: Setup
2. 完成 Phase 2: Foundational
3. 完成 Phase 3: User Story 1（系統健康狀態）
4. 完成 Phase 4: User Story 2（業務指標）
5. **STOP and VALIDATE**: 測試 MVP 功能
6. 可部署 MVP 版本

### Incremental Delivery

| 階段 | 交付物 | 價值 |
|------|--------|------|
| Phase 3 | 系統健康監控 | 基本運維監控 |
| Phase 4 | 業務指標監控 | 完整 MVP |
| Phase 5 | 自動刷新 | 持續監控體驗 |
| Phase 6 | WebSocket 狀態 | 連線健康監控 |
| Phase 7 | 錯誤統計 | 穩定性評估 |
| Phase 8 | 整合完善 | 生產就緒 |

---

## Notes

- **[P]** 任務可平行執行（不同檔案、無依賴）
- **[TEST]** 任務必須先寫並驗證 FAIL，再實作功能（TDD 原則七）
- **[USx]** 標記任務所屬的 User Story，便於追蹤
- 每個 User Story 可獨立完成和測試
- 每完成一個 Checkpoint 後提交 commit
- 避免：模糊任務、同檔案衝突、跨 Story 依賴破壞獨立性
