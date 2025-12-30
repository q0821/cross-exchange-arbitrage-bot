# Tasks: 交易所 WebSocket 即時數據訂閱

**Input**: Design documents from `/specs/052-specify-scripts-bash/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: 依據 Constitution Principle VII (TDD Discipline)，所有任務包含測試優先。

**Organization**: 任務按 User Story 分組，支援獨立實作和測試。

## Format: `[ID] [P?] [Story] Description`
- **[P]**: 可平行執行（不同檔案、無相依）
- **[Story]**: 所屬 User Story（US1-US6）
- 描述包含確切檔案路徑

---

## Phase 1: Setup

**Purpose**: 專案初始化和基本結構

- [x] T001 確認 CCXT 4.x 版本支援 watch* 方法，檢查 package.json
- [x] T002 [P] 建立 WebSocket 事件類型定義 in src/types/websocket-events.ts
- [x] T003 [P] 建立 Zod schema 驗證各交易所 WebSocket 訊息 in src/lib/schemas/websocket-messages.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 所有 User Story 共用的核心基礎架構

**⚠️ CRITICAL**: 完成此階段後才能開始 User Story 實作

- [x] T004 擴展 WebSocketManager 基類支援多頻道訂閱 in src/lib/websocket.ts
- [x] T005 [P] 新增 WebSocket 連線狀態追蹤類型 in src/types/connection-state.ts
- [x] T006 [P] 新增 DataSourceMode 類型（websocket/rest/hybrid）in src/types/data-source.ts
- [x] T007 擴展 IExchangeConnector 介面的 subscribeWS/unsubscribeWS 參數類型 in src/connectors/types.ts
- [x] T008 新增 FundingRateReceived 內部事件類型 in src/types/internal-events.ts

**Checkpoint**: 基礎架構就緒，User Story 實作可開始

---

## Phase 3: User Story 1 - 即時資金費率更新 (Priority: P1) 🎯 MVP

**Goal**: 透過 WebSocket 即時接收各交易所資金費率，延遲從 5 秒降至 1 秒以內

**Independent Test**: 驗證 WebSocket 連線後 1 秒內收到首次資金費率數據

### Tests for User Story 1 ⚠️

**NOTE: 先寫測試，確認測試失敗後再實作**

- [x] T009 [P] [US1] 單元測試 BinanceFundingWs 訊息解析 in tests/unit/services/BinanceFundingWs.test.ts
- [x] T010 [P] [US1] 單元測試 OKX 資金費率 WebSocket 解析 in tests/unit/services/OkxFundingWs.test.ts
- [x] T011 [P] [US1] 單元測試 Gate.io 資金費率解析 in tests/unit/services/GateioFundingWs.test.ts
- [x] T012 [P] [US1] 單元測試 MEXC 資金費率解析 in tests/unit/services/MexcFundingWs.test.ts
- [x] T013 [P] [US1] 整合測試 Binance 資金費率 WebSocket in tests/integration/websocket/binance-funding-ws.test.ts

### Implementation for User Story 1

- [x] T014 [P] [US1] 實作 BinanceFundingWs 連接 @markPrice@1s stream in src/services/websocket/BinanceFundingWs.ts
- [x] T015 [US1] 實作 Binance subscribeWS (fundingRate) in src/connectors/binance.ts
- [x] T016 [P] [US1] 實作 OKX 資金費率訂閱 via CCXT watchFundingRate in src/connectors/okx.ts
- [x] T017 [P] [US1] 實作 Gate.io 資金費率訂閱 via CCXT watchFundingRate in src/connectors/gateio.ts
- [x] T018 [P] [US1] 實作 MEXC 資金費率訂閱 via CCXT watchFundingRate in src/connectors/mexc.ts
- [x] T019 [US1] 修改 PriceMonitor 整合 WebSocket 訂閱 in src/services/monitor/PriceMonitor.ts
- [x] T020 [US1] 修改 RatesCache 接收 WebSocket 更新 in src/services/monitor/RatesCache.ts
- [x] T021 [US1] 新增資金費率 WebSocket 結構化日誌 in src/services/websocket/BinanceFundingWs.ts

**Checkpoint**: Binance、OKX、Gate.io、MEXC 資金費率即時更新完成

---

## Phase 4: User Story 2 - WebSocket 斷線自動重連 (Priority: P1)

**Goal**: WebSocket 斷線時自動重連並恢復訂閱，30 秒內恢復連線

**Independent Test**: 模擬斷線後驗證系統自動重連（最多 10 次，指數退避）

### Tests for User Story 2 ⚠️

- [x] T022 [P] [US2] 單元測試自動重連邏輯 in tests/unit/services/WebSocketReconnect.test.ts
- [x] T023 [P] [US2] 單元測試指數退避演算法 in tests/unit/lib/exponential-backoff.test.ts
- [x] T024 [P] [US2] 單元測試重連後自動重新訂閱 in tests/unit/services/ResubscribeOnReconnect.test.ts

### Implementation for User Story 2

- [x] T025 [US2] 實作指數退避重連邏輯 in src/lib/websocket/ReconnectionManager.ts (已存在)
- [x] T026 [US2] 擴展 BinanceFundingWs 加入自動重連 in src/services/websocket/BinanceFundingWs.ts (已存在)
- [x] T027 [US2] 實作重連後自動重新訂閱機制 in src/services/websocket/BinanceFundingWs.ts (已存在)
- [x] T028 [US2] 實作心跳超時偵測（20 秒 ping, 60 秒 pong timeout）in src/lib/websocket/HealthChecker.ts (已存在)
- [x] T029 [US2] 新增重連事件日誌和指標 in src/services/websocket/BinanceFundingWs.ts (已存在)

**Checkpoint**: WebSocket 斷線自動重連機制完成

---

## Phase 5: User Story 5 - 即時持倉狀態監控 (Priority: P1)

**Goal**: 透過 WebSocket 即時接收持倉變更和觸發通知，延遲從 30 秒降至 1 秒

**Independent Test**: 驗證條件單觸發後 1 秒內偵測到並發送通知

### Tests for User Story 5 ⚠️

- [x] T030 [P] [US5] 單元測試 PrivateWsManager 連線管理 in tests/unit/services/PrivateWsManager.test.ts
- [x] T031 [P] [US5] 單元測試 Binance listenKey 管理 in tests/unit/services/BinanceListenKeyManager.test.ts
- [x] T032 [P] [US5] 單元測試 BinanceUserDataWs ACCOUNT_UPDATE 解析 in tests/unit/services/BinanceUserDataWs.test.ts
- [x] T033 [P] [US5] 單元測試 TriggerDetector 觸發偵測 in tests/unit/services/TriggerDetector.test.ts
- [x] T034 [P] [US5] 單元測試 PositionWsHandler 持倉變更處理 in tests/unit/services/PositionWsHandler.test.ts
- [x] T035 [P] [US5] 整合測試持倉 WebSocket 監控 in tests/integration/websocket/position-ws.test.ts

### Implementation for User Story 5

- [x] T036 [US5] 建立 PrivateWsManager 框架 in src/services/websocket/PrivateWsManager.ts
- [x] T037 [US5] 實作 Binance listenKey 建立和續期 in src/services/websocket/BinanceListenKeyManager.ts
- [x] T038 [US5] 實作 BinanceUserDataWs 連接私有頻道 in src/services/websocket/BinanceUserDataWs.ts
- [x] T039 [US5] 實作 Binance ACCOUNT_UPDATE 事件解析 in src/services/websocket/BinanceUserDataWs.ts
- [x] T040 [US5] 實作 Binance ORDER_TRADE_UPDATE 事件解析 in src/services/websocket/BinanceUserDataWs.ts
- [x] T041 [P] [US5] 實作 OKX 持倉監控 via CCXT watchPositions in src/connectors/okx.ts
- [x] T042 [P] [US5] 實作 Gate.io 持倉監控 via CCXT watchPositions in src/connectors/gateio.ts
- [x] T043 [US5] 實作 BingX 私有頻道連接（自行實作 accountUpdate）in src/services/websocket/BingxUserDataWs.ts
- [x] T044 [US5] 建立 PositionWsHandler 處理持倉變更 in src/services/websocket/PositionWsHandler.ts
- [x] T045 [US5] 建立 TriggerDetector 從 WebSocket 事件偵測觸發 in src/services/monitor/TriggerDetector.ts
- [x] T046 [US5] 整合 TriggerDetector 與 PositionCloser 自動平倉 in src/services/monitor/TriggerDetector.ts
- [x] T047 [US5] 新增觸發事件推送至前端 WebSocket in src/services/websocket/TriggerProgressEmitter.ts (已存在)
- [x] T048 [US5] 修改 ConditionalOrderMonitor 與 TriggerDetector 並行運作 in src/services/monitor/ConditionalOrderMonitor.ts

**Checkpoint**: 持倉監控 WebSocket 完成，觸發偵測延遲 <1 秒

---

## Phase 6: User Story 3 - 混合數據源策略 (Priority: P2)

**Goal**: WebSocket 不可用時自動切換到 REST，確保數據可靠性

**Independent Test**: 關閉 WebSocket 後驗證系統無縫切換到 REST 模式

### Tests for User Story 3 ⚠️

- [x] T049 [P] [US3] 單元測試 DataSourceManager fallback 邏輯 in tests/unit/services/DataSourceManager.test.ts
- [x] T050 [P] [US3] 單元測試 WebSocket 恢復後切回 in tests/unit/services/DataSourceManager.test.ts (與 T049 合併)

### Implementation for User Story 3

- [x] T051 [US3] 建立 DataSourceManager 管理數據源模式 in src/services/monitor/DataSourceManager.ts
- [x] T052 [US3] 實作 WebSocket 失敗時切換到 REST in src/services/monitor/DataSourceManager.ts
- [x] T053 [US3] 實作 WebSocket 恢復時切回 in src/services/monitor/DataSourceManager.ts
- [x] T054 [US3] 整合 DataSourceManager 到 PriceMonitor in src/services/monitor/PriceMonitor.ts
- [x] T055 [US3] 新增數據源切換日誌和事件 in src/services/monitor/DataSourceManager.ts

**Checkpoint**: 混合數據源策略完成

---

## Phase 7: User Story 4 - 多交易所統一訂閱管理 (Priority: P2)

**Goal**: 所有交易所 WebSocket 訂閱遵循統一介面

**Independent Test**: 對每個交易所執行相同的訂閱/取消訂閱測試案例

### Tests for User Story 4 ⚠️

- [x] T056 [P] [US4] 整合測試 Binance subscribeWS/unsubscribeWS in tests/integration/websocket/binance-subscription.test.ts
- [x] T057 [P] [US4] 整合測試 OKX subscribeWS/unsubscribeWS in tests/integration/websocket/okx-subscription.test.ts
- [x] T058 [P] [US4] 整合測試 Gate.io subscribeWS/unsubscribeWS in tests/integration/websocket/gateio-subscription.test.ts
- [x] T059 [P] [US4] 整合測試 BingX subscribeWS/unsubscribeWS in tests/integration/websocket/bingx-subscription.test.ts

### Implementation for User Story 4

- [x] T060 [US4] 完善 Binance unsubscribeWS 資源清理 in src/connectors/binance.ts
- [x] T061 [P] [US4] 實作 OKX unsubscribeWS in src/connectors/okx.ts
- [x] T062 [P] [US4] 實作 Gate.io unsubscribeWS in src/connectors/gateio.ts
- [x] T063 [P] [US4] 實作 MEXC unsubscribeWS in src/connectors/mexc.ts
- [x] T064 [P] [US4] 實作 BingX unsubscribeWS in src/connectors/bingx.ts
- [x] T065 [US4] 驗證所有 Connector 的 subscribeWS/unsubscribeWS 介面一致性

**Checkpoint**: 統一訂閱介面完成

---

## Phase 8: User Story 6 - 帳戶餘額即時更新 (Priority: P2)

**Goal**: 即時顯示各交易所帳戶餘額變化

**Independent Test**: 執行交易後驗證餘額更新延遲 <1 秒

### Tests for User Story 6 ⚠️

- [X] T066 [P] [US6] 單元測試 BalanceWsHandler 餘額解析 in tests/unit/services/BalanceWsHandler.test.ts
- [X] T067 [P] [US6] 單元測試餘額變更推送至前端 in tests/unit/services/BalanceUpdateEmitter.test.ts

### Implementation for User Story 6

- [X] T068 [US6] 建立 BalanceWsHandler 處理餘額變更 in src/services/websocket/BalanceWsHandler.ts
- [X] T069 [US6] 擴展 BinanceUserDataWs 解析餘額更新 in src/services/websocket/BinanceUserDataWs.ts (已在 T039 實作)
- [X] T070 [P] [US6] 實作 OKX 餘額監控 via CCXT watchBalance in src/connectors/okx.ts
- [X] T071 [P] [US6] 實作 Gate.io 餘額監控 via CCXT watchBalance in src/connectors/gateio.ts
- [X] T072 [US6] 實作餘額更新推送至前端 WebSocket in src/services/websocket/BalanceUpdateEmitter.ts
- [X] T073 [US6] 修改資產總覽頁面接收即時餘額更新 in app/(dashboard)/assets/page.tsx

**Checkpoint**: 帳戶餘額即時更新完成 ✅

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: 跨 User Story 的改進和優化

- [X] T074 [P] 新增 WebSocket 連線狀態 API endpoint in app/api/monitor/ws-status/route.ts
- [X] T075 [P] 更新 CLAUDE.md 加入 Feature 052 關鍵路徑
- [X] T076 效能測試：驗證資金費率延遲 <1 秒
- [X] T077 效能測試：驗證觸發偵測延遲 <1 秒
- [X] T078 [P] 執行 quickstart.md 驗證腳本
- [X] T079 程式碼清理和重構
- [X] T080 安全性檢查：確認 API Key 僅在 CLI/Backend 環境使用

**Phase 9 Checkpoint**: All tasks completed ✅

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 無依賴 - 可立即開始
- **Foundational (Phase 2)**: 依賴 Setup - **阻擋所有 User Story**
- **User Stories (Phase 3-8)**: 依賴 Foundational 完成後可開始
- **Polish (Phase 9)**: 依賴所有 User Story 完成

### User Story Dependencies

- **US1 (P1)**: Foundational 完成後可開始 - 無其他 Story 依賴
- **US2 (P1)**: 可與 US1 並行或緊接 US1 後（共用 WebSocket 基礎）
- **US5 (P1)**: 可與 US1/US2 並行（使用 PrivateWsManager 獨立架構）
- **US3 (P2)**: 依賴 US1 完成（需要 WebSocket 實作才能做 fallback）
- **US4 (P2)**: 依賴 US1/US5 完成（整合所有 Connector 的訂閱介面）
- **US6 (P2)**: 依賴 US5 完成（共用 PrivateWsManager 和 UserDataWs）

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- 核心服務優先於 Connector 整合
- 整合測試在單元測試之後
- Story 完成後再進行下一個

### Parallel Opportunities

**Setup Phase:**
- T002, T003 可平行

**Foundational Phase:**
- T005, T006 可平行

**User Story 1:**
- T009-T013 測試可平行
- T014, T016, T017, T018 實作可平行（不同交易所）

**User Story 5:**
- T030-T035 測試可平行
- T041, T042 可平行（OKX 和 Gate.io）

**User Story 4:**
- T056-T059 測試可平行
- T061-T064 實作可平行（不同交易所）

---

## Parallel Example: User Story 1

```bash
# 平行執行所有 US1 測試:
pnpm test tests/unit/services/BinanceFundingWs.test.ts &
pnpm test tests/unit/services/OkxFundingWs.test.ts &
pnpm test tests/unit/services/GateioFundingWs.test.ts &
pnpm test tests/unit/services/MexcFundingWs.test.ts &

# 平行執行不同交易所實作:
# (T014 Binance 和 T016 OKX 和 T017 Gate.io 和 T018 MEXC 可同時進行)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. 完成 Phase 1: Setup
2. 完成 Phase 2: Foundational (CRITICAL)
3. 完成 Phase 3: User Story 1 - 即時資金費率更新
4. **STOP and VALIDATE**: 獨立測試 US1，驗證延遲 <1 秒
5. 部署/展示 MVP

### Incremental Delivery

1. Setup + Foundational → 基礎就緒
2. US1 → 測試 → 部署（MVP！）
3. US2 → 測試 → 部署（穩定性提升）
4. US5 → 測試 → 部署（風險控制能力）
5. US3, US4, US6 → 依序完成 P2 功能

### Parallel Team Strategy

多人團隊時：
1. 團隊共同完成 Setup + Foundational
2. Foundational 完成後：
   - Developer A: US1 + US2（資金費率相關）
   - Developer B: US5 + US6（持倉監控相關）
3. P2 功能可依序或並行完成

---

## Notes

- [P] 任務 = 不同檔案、無依賴，可平行
- [Story] 標籤對應 User Story 追蹤
- 每個 User Story 應可獨立完成和測試
- 先寫測試，確認失敗後再實作
- 每個任務或邏輯群組完成後提交
- 任何 Checkpoint 都可停下來獨立驗證

## Summary

| 類別 | 數量 |
|------|------|
| 總任務數 | 80 |
| Phase 1 Setup | 3 |
| Phase 2 Foundational | 5 |
| US1 即時資金費率 | 13 |
| US2 斷線自動重連 | 8 |
| US5 持倉狀態監控 | 19 |
| US3 混合數據源 | 7 |
| US4 統一訂閱管理 | 10 |
| US6 餘額即時更新 | 8 |
| Phase 9 Polish | 7 |
| 可平行任務 | 45 |
