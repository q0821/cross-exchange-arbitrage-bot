# Tasks: Native WebSocket Clients

**Input**: Design documents from `/specs/054-native-websocket-clients/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**TDD Approach**: Constitution VII 要求測試先行，每個 WebSocket 客戶端的訊息解析邏輯需先撰寫單元測試。

**Organization**: 任務按 User Story 分組，每個 Story 可獨立實作和測試。

## Format: `[ID] [P?] [Story] Description`
- **[P]**: 可平行執行（不同檔案，無依賴）
- **[Story]**: 所屬 User Story (US1, US2, US3...)
- 包含確切檔案路徑

---

## Phase 1: Setup (共享基礎設施) ✅ COMPLETED

**Purpose**: 專案初始化和類型定義

- [x] T001 [P] 新增 OKX WebSocket 訊息類型定義 in `src/types/websocket-events.ts`
- [x] T002 [P] 新增 Gate.io WebSocket 訊息類型定義 in `src/types/websocket-events.ts`
- [x] T003 [P] 新增 BingX WebSocket 訊息類型定義 in `src/types/websocket-events.ts`
- [x] T004 [P] 新增 OKX Zod Schema 驗證 in `src/lib/schemas/websocket-messages.ts`
- [x] T005 [P] 新增 Gate.io Zod Schema 驗證 in `src/lib/schemas/websocket-messages.ts`
- [x] T006 [P] 新增 BingX Zod Schema 驗證 in `src/lib/schemas/websocket-messages.ts`
- [x] T007 新增 Symbol 轉換工具函式 in `src/lib/symbol-converter.ts`

**Checkpoint**: ✅ 類型和驗證 Schema 準備就緒

---

## Phase 2: Foundational (阻塞性前置任務) ✅ COMPLETED

**Purpose**: 必須在任何 User Story 之前完成的核心基礎設施

**⚠️ CRITICAL**: 所有 User Story 都依賴此階段完成

- [x] T008 建立 BaseExchangeWs 抽象類別 in `src/services/websocket/BaseExchangeWs.ts`
- [x] T009 建立 ConnectionPool 多連線管理器 in `src/services/websocket/ConnectionPool.ts`
- [ ] T010 [P] 更新 DataSourceManager 支援新交易所 in `src/services/monitor/DataSourceManager.ts`
- [x] T011 [P] 更新 data-source.ts 新增交易所 WebSocket 支援配置 in `src/types/data-source.ts`

**Checkpoint**: ✅ 基礎架構就緒 - 可開始 User Story 實作

---

## Phase 3: User Story 1+2 - 即時資金費率與價格監控 (Priority: P1) 🎯 MVP (IN PROGRESS)

**Goal**: 即時接收 OKX/Gate.io/BingX 的資金費率和標記價格更新

**Independent Test**: 系統可在資金費率或價格變動時，於 500 毫秒內收到更新

### Tests for US1+US2 (TDD - 先寫測試) ✅

- [x] T012 [P] [US1] 撰寫 OKX 資金費率解析單元測試 in `tests/unit/services/OkxFundingWs.test.ts`
- [x] T013 [P] [US1] 撰寫 Gate.io Tickers 解析單元測試 in `tests/unit/services/GateioFundingWs.test.ts`
- [x] T014 [P] [US1] 撰寫 BingX MarkPrice 解析單元測試 in `tests/unit/services/BingxFundingWs.test.ts`
- [x] T015 [P] [US1] 撰寫 ConnectionPool 單元測試 in `tests/unit/services/ConnectionPool.test.ts`
- [x] T015a [P] [US1] 撰寫 BaseExchangeWs 單元測試 in `tests/unit/services/BaseExchangeWs.test.ts` (新增)

### Implementation for US1+US2

- [x] T016 [US1] 實作 OkxFundingWs 客戶端 in `src/services/websocket/OkxFundingWs.ts`
- [x] T017 [US1] 實作 GateioFundingWs 客戶端 in `src/services/websocket/GateioFundingWs.ts`
- [x] T018 [US1] 實作 BingxFundingWs 客戶端 in `src/services/websocket/BingxFundingWs.ts`
- [x] T019 [US1] 整合 OkxFundingWs 到 PriceMonitor in `src/services/monitor/PriceMonitor.ts`
- [x] T020 [US1] 整合 GateioFundingWs 到 PriceMonitor in `src/services/monitor/PriceMonitor.ts`
- [x] T021 [US1] 整合 BingxFundingWs 到 PriceMonitor in `src/services/monitor/PriceMonitor.ts`
- [x] T022 [US1] 更新 RatesCache 處理新交易所數據 in `src/services/monitor/RatesCache.ts` (已是交易所無關設計，無需修改)

**Checkpoint**: ✅ P1 功能完成 - 可即時接收 3 個交易所的資金費率和價格

---

## Phase 4: User Story 3 - 訂單狀態即時通知 (Priority: P2)

**Goal**: 即時接收訂單狀態更新（成交、部分成交、取消）

**Independent Test**: 訂單狀態改變時，系統可即時收到通知

### Tests for US3 (TDD - 先寫測試) ✅

- [x] T023 [P] [US3] 撰寫 OKX 私有頻道認證測試 in `tests/unit/services/OkxFundingWs.test.ts`
- [x] T024 [P] [US3] 撰寫 Gate.io 訂單更新解析測試 in `tests/unit/services/GateioFundingWs.test.ts`
- [x] T025 [P] [US3] 撰寫 BingX 訂單更新解析測試 in `tests/unit/services/BingxFundingWs.test.ts`

### Implementation for US3

- [x] T026 [US3] 新增 OrderUpdate 類型和 Zod Schema in `src/types/websocket-events.ts` (已存在)
- [x] T027 [US3] 實作 OKX 私有頻道認證 (login) in `src/services/websocket/OkxFundingWs.ts`
- [x] T028 [US3] 實作 Gate.io 私有頻道認證 in `src/services/websocket/GateioFundingWs.ts`
- [x] T029 [US3] 實作 BingX listenKey 機制 in `src/services/websocket/BingxFundingWs.ts`
- [x] T030 [US3] 新增訂單狀態訂閱方法 (subscribeOrders) in `src/services/websocket/OkxFundingWs.ts`
- [x] T031 [US3] 新增訂單狀態訂閱方法 in `src/services/websocket/GateioFundingWs.ts`
- [x] T032 [US3] 新增訂單狀態訂閱方法 in `src/services/websocket/BingxFundingWs.ts`

**Checkpoint**: P2 訂單狀態功能完成

---

## Phase 5: User Story 4 - 自動重連與容錯 (Priority: P2)

**Goal**: WebSocket 連線具備自動重連機制，確保系統穩定運作

**Independent Test**: 斷線後可自動重連並恢復訂閱

### Tests for US4 (TDD - 先寫測試)

- [x] T033 [P] [US4] 撰寫重連機制單元測試 in `tests/unit/services/WebSocketReconnect.test.ts`
- [x] T034 [P] [US4] 撰寫健康檢查單元測試 in `tests/unit/services/ResubscribeOnReconnect.test.ts`
- [x] T035 [P] [US4] 撰寫 REST 備援切換測試 in `tests/unit/services/DataSourceManager.test.ts`

### Implementation for US4

- [x] T036 [US4] 實作 OkxFundingWs 重連邏輯 (指數退避) in `src/services/websocket/BaseExchangeWs.ts`
- [x] T037 [US4] 實作 GateioFundingWs 重連邏輯 in `src/services/websocket/BaseExchangeWs.ts`
- [x] T038 [US4] 實作 BingxFundingWs 重連邏輯 in `src/services/websocket/BaseExchangeWs.ts`
- [x] T039 [US4] 實作健康檢查 (60 秒無訊息觸發重連) in `src/lib/websocket/HealthChecker.ts`
- [x] T040 [US4] 實作健康檢查 in `src/lib/websocket/HealthChecker.ts`
- [x] T041 [US4] 實作健康檢查 in `src/lib/websocket/HealthChecker.ts`
- [x] T042 [US4] 實作 REST 備援切換邏輯 in `src/services/monitor/DataSourceManager.ts`
- [x] T043 [US4] 實作 WebSocket 恢復後自動切回邏輯 in `src/services/monitor/DataSourceManager.ts`

**Checkpoint**: P2 容錯功能完成

---

## Phase 6: User Story 5 - 資料源狀態監控 (Priority: P3)

**Goal**: 透過 API 查詢各交易所 WebSocket 連線狀態

**Independent Test**: 可透過 API 查詢連線狀態、延遲和健康度

### Tests for US5 (TDD - 先寫測試)

- [x] T044 [P] [US5] 撰寫 ws-status API 回應格式測試 in `tests/unit/services/DataSourceManager.test.ts` (透過 DataSourceManager 測試覆蓋)

### Implementation for US5

- [x] T045 [US5] 新增 getStats() 方法到 OkxFundingWs in `src/services/websocket/BaseExchangeWs.ts` (繼承自基類)
- [x] T046 [US5] 新增 getStats() 方法到 GateioFundingWs in `src/services/websocket/BaseExchangeWs.ts` (繼承自基類)
- [x] T047 [US5] 新增 getStats() 方法到 BingxFundingWs in `src/services/websocket/BaseExchangeWs.ts` (繼承自基類)
- [x] T048 [US5] 更新 ws-status API 回傳新交易所狀態 in `app/api/monitor/ws-status/route.ts` (已整合 DataSourceManager)
- [x] T049 [US5] 新增延遲統計 (P50/P95/P99) 計算 in `src/services/websocket/BaseExchangeWs.ts` (calculateLatencyStats)

**Checkpoint**: P3 監控功能完成

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 跨 User Story 的改進和文件更新

- [x] T050 [P] 撰寫多交易所整合測試 in `tests/integration/websocket/multi-exchange-ws.test.ts`
- [x] T051 [P] 新增 WebSocket 指標收集 (FR-015) in `src/services/websocket/BaseExchangeWs.ts` (messageCount, latencyStats, reconnectCount)
- [x] T052 更新 MonitorService 啟用新交易所 WebSocket in `src/services/MonitorService.ts` (已支援 binance,okx,mexc,gateio,bingx)
- [x] T053 執行 quickstart.md 驗證場景 (測試通過: 134 WebSocket tests + 56 reconnection tests)
- [x] T054 更新 CLAUDE.md 新增功能路徑說明 (透過 speckit 自動更新)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 無依賴 - 可立即開始
- **Foundational (Phase 2)**: 依賴 Setup 完成 - 阻塞所有 User Stories
- **US1+US2 (Phase 3)**: 依賴 Foundational 完成 - MVP
- **US3 (Phase 4)**: 依賴 US1+US2 完成（需要基礎 WebSocket 客戶端）
- **US4 (Phase 5)**: 依賴 US1+US2 完成（需要基礎 WebSocket 客戶端）
- **US5 (Phase 6)**: 依賴 US1+US2 完成（需要基礎 WebSocket 客戶端）
- **Polish (Phase 7)**: 依賴所有 User Stories 完成

### User Story Dependencies

```
Phase 1 (Setup) ──────────────────────────────────────────────►
                │
                ▼
Phase 2 (Foundational) ───────────────────────────────────────►
                │
                ├────────────────────────────────────────────────┐
                ▼                                                │
Phase 3 (US1+US2: 資金費率+價格) ──────────────────────────────► │
                │                                                │
                ├──────────────┬──────────────┬─────────────────┤
                ▼              ▼              ▼                  │
Phase 4 (US3)  Phase 5 (US4)  Phase 6 (US5)    (可平行)         │
                │              │              │                  │
                └──────────────┴──────────────┴─────────────────┘
                                              │
                                              ▼
                                    Phase 7 (Polish)
```

### Within Each User Story

- 測試 MUST 先撰寫並確認 FAIL
- Schema/類型 → 客戶端實作 → 整合
- 核心功能完成後再加入進階功能

### Parallel Opportunities

**Phase 1** (全部可平行):
- T001, T002, T003 可同時執行（不同交易所類型）
- T004, T005, T006 可同時執行（不同 Schema）

**Phase 3** (測試可平行):
- T012, T013, T014, T015 可同時執行（不同測試檔案）

**Phase 4, 5, 6** (可平行):
- US3, US4, US5 可由不同開發者同時進行

---

## Parallel Example: Phase 1 Setup

```bash
# 同時啟動所有類型定義任務:
Task: "新增 OKX WebSocket 訊息類型定義 in src/types/websocket-events.ts"
Task: "新增 Gate.io WebSocket 訊息類型定義 in src/types/websocket-events.ts"
Task: "新增 BingX WebSocket 訊息類型定義 in src/types/websocket-events.ts"

# 同時啟動所有 Schema 任務:
Task: "新增 OKX Zod Schema 驗證 in src/lib/schemas/websocket-messages.ts"
Task: "新增 Gate.io Zod Schema 驗證 in src/lib/schemas/websocket-messages.ts"
Task: "新增 BingX Zod Schema 驗證 in src/lib/schemas/websocket-messages.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1+2)

1. 完成 Phase 1: Setup
2. 完成 Phase 2: Foundational (CRITICAL)
3. 完成 Phase 3: US1+US2 (資金費率+價格)
4. **STOP and VALIDATE**: 測試 3 個交易所的即時數據
5. 可部署/演示

### Incremental Delivery

1. Setup + Foundational → 基礎架構就緒
2. 新增 US1+US2 → 測試 → 部署 (MVP!)
3. 新增 US3 (訂單狀態) → 測試 → 部署
4. 新增 US4 (自動重連) → 測試 → 部署
5. 新增 US5 (狀態監控) → 測試 → 部署
6. 每個 Story 獨立增加價值

### Parallel Team Strategy

多開發者情境:

1. 團隊共同完成 Setup + Foundational
2. Foundational 完成後:
   - 開發者 A: US1+US2 (MVP)
   - 開發者 B: US3 (待 A 完成基礎後)
   - 開發者 C: US4+US5 (待 A 完成基礎後)
3. 各 Story 獨立完成並整合

---

## Notes

- [P] = 不同檔案，無依賴
- [Story] = 對應 spec.md 的 User Story
- 每個 User Story 可獨立完成和測試
- TDD: 確認測試先 FAIL 再實作
- 每個任務或邏輯群組後 commit
- 任何 checkpoint 都可停下來驗證
- 避免: 模糊任務、同檔案衝突、破壞獨立性的跨 Story 依賴
