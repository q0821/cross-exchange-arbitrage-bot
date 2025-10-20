# Tasks: 跨交易所資金費率套利平台

**Input**: Design documents from `/specs/001-funding-rate-arbitrage/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/cli-spec.md
**Tests**: 規格中沒有要求撰寫測試,所以本任務清單不包含測試相關任務

**Organization**: 任務按照 User Story 分組,每個故事可以獨立實作和測試

---

## 📊 當前進度摘要 (2025-10-19)

### ✅ 已完成
- **Phase 1: Setup** - 100% 完成 (8/8 任務)
  - TypeScript 專案架構建立
  - 所有必要套件安裝完成
  - 專案結構和配置檔建立完成

- **Phase 2: Foundational** - 78% 完成 (7/9 任務)
  - ✅ Prisma schema 定義 (7 個核心實體)
  - ✅ Logger 模組 (Pino)
  - ✅ Config 模組 (Zod 驗證)
  - ✅ Error Handler (完整錯誤類型系統)
  - ✅ Retry 機制 (指數退避)
  - ✅ WebSocket 管理 (含重連機制)
  - ✅ Prisma Client 初始化
  - ⏳ 資料庫設置 (待 PostgreSQL + TimescaleDB 安裝)

- **Phase 3: User Story 1** - 部分完成
  - ✅ 交易所連接器架構 (Base + Interface + Factory)
  - ✅ Binance 連接器 (使用 Binance Futures API `/fapi/v1/premiumIndex`)
  - ✅ OKX 連接器 (使用 CCXT)
  - ✅ API 測試腳本驗證通過
  - 測試結果：成功取得 BTCUSDT 價格和資金費率，計算出套利機會

### 🔄 進行中
- 交易所連接器功能擴充
- 資料庫安裝與設置準備

### ⏭️ 下一步
1. 安裝 PostgreSQL + TimescaleDB
2. 執行資料庫 migration
3. 完成 User Story 1 剩餘任務（監控服務、CLI 指令）

### 📈 技術亮點
- 成功整合 Binance Futures API 直接調用（不使用 SDK）
- CCXT 用於 OKX 永續合約資金費率查詢
- 完整的錯誤處理和重試機制
- 結構化日誌系統 (Pino)

---

## Format: `[ID] [P?] [Story] Description`
- **[P]**: 可平行執行 (不同檔案、無依賴)
- **[Story]**: 任務所屬的使用者故事 (US1, US2, US3, US4, US5)
- 包含精確的檔案路徑

---

## Phase 1: Setup (專案初始化) ✅

**Purpose**: 建立專案基礎結構和開發環境

- [x] T001 建立 TypeScript 專案結構,設定 package.json 和 tsconfig.json
- [x] T002 安裝核心依賴: TypeScript 5.3+, Node.js 20.x, Prisma 5.x, ws 8.x
- [x] T003 [P] 安裝交易所 SDK: binance-connector-node 3.x, okx-node-sdk 1.x, ccxt 4.x
- [x] T004 [P] 設定 ESLint 和 Prettier 配置檔於專案根目錄
- [x] T005 建立專案目錄結構: src/models, src/services, src/connectors, src/cli, src/lib
- [x] T006 建立設定檔架構: config/default.json, .env.example
- [x] T007 [P] 設定 .gitignore,排除 node_modules, .env, logs, dist
- [x] T008 [P] 建立 README.md 基本文件

---

## Phase 2: Foundational (基礎設施 - 必須先完成) ⚠️ 部分完成

**Purpose**: 核心基礎設施,所有 User Story 的前置條件

**⚠️ CRITICAL**: 此階段完成前,任何 User Story 都無法開始

- [x] T009 定義 Prisma schema 於 prisma/schema.prisma,包含 7 個核心實體
- [ ] T010 建立 PostgreSQL 初始化腳本,啟用 TimescaleDB extension (待資料庫安裝)
- [ ] T011 執行 Prisma migrate 建立資料庫 schema (待資料庫安裝)
- [ ] T012 設定 TimescaleDB Hypertable 轉換腳本於 prisma/migrations/timescale-setup.sql (待資料庫安裝)
- [ ] T013 [P] 建立 Redis 連線模組於 src/lib/redis.ts (選用功能,暫時跳過)
- [x] T014 [P] 建立 Logger 模組於 src/lib/logger.ts,支援檔案和 console 輸出
- [x] T015 [P] 建立設定載入模組於 src/lib/config.ts,支援環境變數替換
- [x] T016 建立錯誤處理基礎類別於 src/lib/errors.ts,定義自訂錯誤類型
- [x] T017 建立 Prisma Client 初始化模組於 src/lib/db.ts (檔名為 db.ts)
- [x] T018 [P] 建立重試機制於 src/lib/retry.ts (包含指數退避策略)
- [x] T019 [P] 建立 WebSocket 管理模組於 src/lib/websocket.ts

**Progress**: 7/9 核心任務完成 (資料庫相關任務待安裝 PostgreSQL 後執行)

**Checkpoint**: 基礎設施大部分完成 - 可以開始 API 測試和交易所連接器開發

---

## Phase 3: User Story 1 - 即時監控資金費率差異 (Priority: P1) 🎯 MVP - 進行中

**Goal**: 即時查看幣安和 OKX 的資金費率差異,追蹤 BTC、ETH、SOL,5 秒內更新數據

**Independent Test**: 啟動監控服務,驗證能成功從兩個交易所取得資金費率並計算差異

### 實作任務

- [ ] T020 [P] [US1] 建立 FundingRate 資料模型於 src/models/FundingRate.ts,包含驗證邏輯
- [x] T021 [P] [US1] 建立 Binance 連接器於 src/connectors/binance.ts,實作資金費率 API 調用 (使用 Binance Futures API)
- [x] T022 [P] [US1] 建立 OKX 連接器於 src/connectors/okx.ts,實作資金費率 API 調用 (使用 CCXT)
- [x] T023 [US1] 建立交易所連接器介面於 src/connectors/types.ts 和 base.ts,定義統一介面
- [x] T024 [US1] 建立連接器工廠於 src/connectors/factory.ts,根據交易所名稱建立實例
- [x] T025 [US1] 建立 API 測試腳本於 src/test-api.ts,驗證交易所連接器功能

**Progress**: 5/6 任務完成 - 交易所連接器已完成並通過測試
- [ ] T024 [US1] 實作資金費率監控服務於 src/services/monitor/FundingRateMonitor.ts
- [ ] T025 [US1] 整合 WebSocket 訂閱於 src/services/monitor/WebSocketManager.ts
- [ ] T026 [US1] 實作費率差異計算服務於 src/services/monitor/RateDifferenceCalculator.ts
- [ ] T027 [US1] 實作 Redis 快取層於 src/services/monitor/RateCache.ts
- [ ] T028 [US1] 實作 API 連線失敗重試機制於 src/lib/retry.ts
- [ ] T029 [US1] 建立 CLI monitor start 指令於 src/cli/commands/monitor/start.ts
- [ ] T030 [US1] 建立 CLI monitor stop 指令於 src/cli/commands/monitor/stop.ts
- [ ] T031 [US1] 建立 CLI monitor status 指令於 src/cli/commands/monitor/status.ts
- [ ] T032 [US1] 建立 CLI 主程式入口於 src/cli/index.ts,整合 Commander.js
- [ ] T033 [US1] 建立 funding-rates list 指令於 src/cli/commands/funding-rates/list.ts

**Checkpoint**: 監控服務完成,可以即時查看資金費率差異

---

## Phase 4: User Story 2 - 自動偵測套利機會 (Priority: P1) 🎯 MVP

**Goal**: 根據閾值自動判斷套利機會,即時通知使用者,按潛在收益排序顯示

**Independent Test**: 模擬不同費率差異場景,驗證系統正確識別套利機會並發出通知

### 實作任務

- [ ] T034 [P] [US2] 建立 ArbitrageOpportunity 資料模型於 src/models/ArbitrageOpportunity.ts
- [ ] T035 [P] [US2] 建立 RiskParameters 資料模型於 src/models/RiskParameters.ts
- [ ] T036 [US2] 實作套利機會偵測器於 src/services/detector/OpportunityDetector.ts
- [ ] T037 [US2] 實作閾值判斷邏輯於 src/services/detector/ThresholdValidator.ts
- [ ] T038 [US2] 實作預期收益計算器於 src/services/detector/ProfitEstimator.ts
- [ ] T039 [US2] 建立通知服務基礎介面於 src/services/notification/NotificationService.ts
- [ ] T040 [US2] 實作 Telegram Bot 通知於 src/services/notification/TelegramNotifier.ts
- [ ] T041 [US2] 整合 Redis Pub/Sub 機制於 src/services/notification/EventPublisher.ts
- [ ] T042 [US2] 實作機會過期管理於 src/services/detector/OpportunityExpiration.ts
- [ ] T043 [US2] 建立 CLI opportunities list 指令於 src/cli/commands/opportunities/list.ts
- [ ] T044 [US2] 建立 CLI opportunities show 指令於 src/cli/commands/opportunities/show.ts
- [ ] T045 [US2] 整合偵測器至監控服務於 src/services/monitor/FundingRateMonitor.ts

**Checkpoint**: 自動偵測套利機會完成,可以即時通知使用者

---

## Phase 5: User Story 3 - 執行雙邊對沖交易 (Priority: P2)

**Goal**: 自動在兩個交易所執行相反方向交易,包含餘額驗證和單邊失敗補償

**Independent Test**: 在測試環境模擬套利機會,驗證雙邊對沖部位建立正確

### 實作任務

- [ ] T046 [P] [US3] 建立 HedgePosition 資料模型於 src/models/HedgePosition.ts
- [ ] T047 [P] [US3] 建立 TradeRecord 資料模型於 src/models/TradeRecord.ts
- [ ] T048 [P] [US3] 建立 ArbitrageCycle 資料模型於 src/models/ArbitrageCycle.ts
- [ ] T049 [US3] 實作交易執行器基礎框架於 src/services/executor/TradeExecutor.ts
- [ ] T050 [US3] 實作 Saga Pattern 補償機制於 src/services/executor/SagaCoordinator.ts
- [ ] T051 [US3] 實作餘額驗證服務於 src/services/executor/BalanceValidator.ts
- [ ] T052 [US3] 實作雙邊開倉邏輯於 src/services/executor/PositionOpener.ts
- [ ] T053 [US3] 實作訂單執行狀態追蹤於 src/services/executor/OrderTracker.ts
- [ ] T054 [US3] 實作單邊失敗回滾機制於 src/services/executor/RollbackHandler.ts
- [ ] T055 [US3] 擴展 Binance 連接器交易功能於 src/connectors/BinanceConnector.ts
- [ ] T056 [US3] 擴展 OKX 連接器交易功能於 src/connectors/OkxConnector.ts
- [ ] T057 [US3] 建立 CLI trade execute 指令於 src/cli/commands/trade/execute.ts
- [ ] T058 [US3] 建立 CLI trade cancel 指令於 src/cli/commands/trade/cancel.ts
- [ ] T059 [US3] 建立 CLI positions list 指令於 src/cli/commands/positions/list.ts
- [ ] T060 [US3] 建立 CLI positions show 指令於 src/cli/commands/positions/show.ts
- [ ] T061 [US3] 實作交易確認互動介面於 src/cli/utils/confirmation.ts

**Checkpoint**: 雙邊對沖交易執行完成,可以建立對沖部位

---

## Phase 6: User Story 4 - 自動平倉與收益結算 (Priority: P2)

**Goal**: 監控對沖部位,在適當時機自動平倉,計算實際收益

**Independent Test**: 模擬已存在的對沖部位,驗證自動平倉和收益計算正確

### 實作任務

- [ ] T062 [P] [US4] 實作平倉服務於 src/services/executor/PositionCloser.ts
- [ ] T063 [P] [US4] 實作收益計算器於 src/services/executor/ProfitCalculator.ts
- [ ] T064 [US4] 實作資金費率結算時間監控於 src/services/monitor/FundingTimeMonitor.ts
- [ ] T065 [US4] 實作自動平倉觸發邏輯於 src/services/executor/AutoCloseTrigger.ts
- [ ] T066 [US4] 實作止損機制於 src/services/executor/StopLossManager.ts
- [ ] T067 [US4] 實作流動性檢查於 src/services/executor/LiquidityChecker.ts
- [ ] T068 [US4] 實作套利週期完整性驗證於 src/services/executor/CycleValidator.ts
- [ ] T069 [US4] 建立 CLI trade close 指令於 src/cli/commands/trade/close.ts
- [ ] T070 [US4] 建立 CLI history list 指令於 src/cli/commands/history/list.ts
- [ ] T071 [US4] 建立 CLI history stats 指令於 src/cli/commands/history/stats.ts
- [ ] T072 [US4] 整合自動平倉至監控服務於 src/services/monitor/FundingRateMonitor.ts

**Checkpoint**: 自動平倉與收益結算完成,可以完整執行套利週期

---

## Phase 7: User Story 5 - 風險管理與監控 (Priority: P3)

**Goal**: 提供風險管理功能,包含交易限制、倉位控制和異常處理

**Independent Test**: 設定不同風險參數,驗證系統正確執行風險控制邏輯

### 實作任務

- [ ] T073 [P] [US5] 建立 SystemEvent 資料模型於 src/models/SystemEvent.ts
- [ ] T074 [US5] 實作風險管理服務於 src/services/risk/RiskManager.ts
- [ ] T075 [US5] 實作倉位限制檢查於 src/services/risk/PositionLimitChecker.ts
- [ ] T076 [US5] 實作保證金使用率監控於 src/services/risk/MarginMonitor.ts
- [ ] T077 [US5] 實作滑價檢測於 src/services/risk/SlippageDetector.ts
- [ ] T078 [US5] 實作異常事件處理於 src/services/risk/AnomalyHandler.ts
- [ ] T079 [US5] 實作風險參數驗證於 src/services/risk/ParameterValidator.ts
- [ ] T080 [US5] 建立 CLI config show 指令於 src/cli/commands/config/show.ts
- [ ] T081 [US5] 建立 CLI config set 指令於 src/cli/commands/config/set.ts
- [ ] T082 [US5] 建立 CLI config validate 指令於 src/cli/commands/config/validate.ts
- [ ] T083 [US5] 建立風險儀表板輸出格式於 src/cli/utils/risk-dashboard.ts
- [ ] T084 [US5] 整合風險管理至交易執行器於 src/services/executor/TradeExecutor.ts

**Checkpoint**: 風險管理與監控完成,系統具備完整的風控能力

---

## Phase 8: Polish & Cross-cutting (完善和橫切關注點)

**Purpose**: 完善系統功能,提升使用者體驗

- [ ] T085 [P] 建立 CLI config init 指令於 src/cli/commands/config/init.ts
- [ ] T086 [P] 建立 CLI account balance 指令於 src/cli/commands/account/balance.ts
- [ ] T087 [P] 建立 CLI account check 指令於 src/cli/commands/account/check.ts
- [ ] T088 [P] 建立 CLI logs 指令於 src/cli/commands/system/logs.ts
- [ ] T089 [P] 建立 CLI version 指令於 src/cli/commands/system/version.ts
- [ ] T090 [P] 建立 CLI doctor 指令於 src/cli/commands/system/doctor.ts
- [ ] T091 實作 CLI 表格格式化工具於 src/cli/utils/table-formatter.ts
- [ ] T092 實作 CLI JSON 輸出格式化於 src/cli/utils/json-formatter.ts
- [ ] T093 實作 CLI 顏色輸出支援於 src/cli/utils/colors.ts
- [ ] T094 建立 TimescaleDB 連續聚合腳本於 prisma/migrations/continuous-aggregates.sql
- [ ] T095 建立 Docker Compose 配置於 docker-compose.yml
- [ ] T096 建立 Dockerfile 於專案根目錄
- [ ] T097 更新 README.md 包含完整使用說明
- [ ] T098 建立部署腳本於 scripts/deploy.sh
- [ ] T099 建立資料庫備份腳本於 scripts/backup.sh
- [ ] T100 執行 quickstart.md 驗證流程

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)
    ↓
Phase 2 (Foundational) ← BLOCKING: 所有 User Story 必須等待此階段完成
    ↓
    ├─→ Phase 3 (US1) ← P1 優先
    ├─→ Phase 4 (US2) ← P1 優先
    ├─→ Phase 5 (US3) ← P2
    ├─→ Phase 6 (US4) ← P2
    └─→ Phase 7 (US5) ← P3
         ↓
Phase 8 (Polish)
```

### User Story Dependencies

- **Phase 3 (US1)**: 依賴 Phase 2,無其他 User Story 依賴
- **Phase 4 (US2)**: 依賴 Phase 2 和 US1 (使用監控數據),可獨立測試
- **Phase 5 (US3)**: 依賴 Phase 2 和 US2 (使用套利機會),可獨立測試
- **Phase 6 (US4)**: 依賴 Phase 2 和 US3 (操作對沖部位),可獨立測試
- **Phase 7 (US5)**: 依賴 Phase 2,與其他 Story 整合但可獨立測試

### Within Each User Story

1. 資料模型優先 (Models)
2. 服務層次之 (Services)
3. CLI 指令最後 (CLI Commands)
4. 標記 [P] 的任務可平行執行

### Parallel Opportunities

**Phase 1 (Setup)**: T003, T004, T007, T008 可平行

**Phase 2 (Foundational)**: T013, T014, T015, T016, T018 可平行

**Phase 3 (US1)**: T019, T020, T021 可平行

**Phase 4 (US2)**: T034, T035 可平行

**Phase 5 (US3)**: T046, T047, T048 可平行;T055, T056 可平行

**Phase 6 (US4)**: T062, T063 可平行

**Phase 7 (US5)**: T073 獨立

**Phase 8 (Polish)**: T085-T090 可平行

---

## Parallel Example: Phase 3 (User Story 1)

```bash
# 同時建立資料模型和連接器
Task T019: "建立 FundingRate 資料模型於 src/models/FundingRate.ts"
Task T020: "建立 Binance 連接器於 src/connectors/BinanceConnector.ts"
Task T021: "建立 OKX 連接器於 src/connectors/OkxConnector.ts"

# 完成後再進行服務層
Task T024: "實作資金費率監控服務於 src/services/monitor/FundingRateMonitor.ts"
```

---

## Implementation Strategy

### MVP First (Phase 1 → 2 → 3 → 4)

1. **Phase 1**: 建立專案結構
2. **Phase 2**: 完成基礎設施 (CRITICAL)
3. **Phase 3**: 實作 US1 (即時監控) → MVP 第一部分
4. **Phase 4**: 實作 US2 (自動偵測) → MVP 完成
5. **VALIDATE**: 測試監控和偵測功能
6. 決定是否繼續或部署 MVP

### Incremental Delivery (依優先級)

1. **Foundational** (Phase 1-2) → 基礎就緒
2. **P1 Stories** (Phase 3-4) → MVP 可部署
3. **P2 Stories** (Phase 5-6) → 完整套利功能
4. **P3 Stories** (Phase 7) → 風險管理
5. **Polish** (Phase 8) → 生產就緒

### Parallel Team Strategy

團隊協作建議:

1. **全員**: Phase 1-2 一起完成
2. **Phase 2 完成後分工**:
   - Developer A: Phase 3 (US1)
   - Developer B: Phase 4 (US2)
3. **P1 完成後**:
   - Developer A: Phase 5 (US3)
   - Developer B: Phase 6 (US4)
   - Developer C: Phase 7 (US5)
4. **全員**: Phase 8 一起完成

---

## Notes

- **[P] 標記**: 表示不同檔案、無依賴關係,可平行執行
- **[Story] 標記**: 追溯任務所屬的使用者故事
- **無測試任務**: 規格中沒有要求,專注於功能實作
- **Checkpoint**: 每個 Phase 結束時的驗證點
- **檔案路徑**: 所有任務都包含明確的檔案路徑
- **依賴關係**: Phase 2 是關鍵路徑,必須先完成
- **優先級**: P1 > P2 > P3,建議按優先級執行
- **提交策略**: 完成每個任務或邏輯群組後提交

---

## Risk Mitigation

### 技術風險

1. **交易所 API 穩定性**: 實作完整的重試和錯誤處理機制 (T028)
2. **雙邊交易一致性**: 使用 Saga Pattern 確保補償機制 (T050)
3. **資金費率時效性**: WebSocket 即時訂閱 + 5 秒輪詢備援 (T025)
4. **資料庫效能**: TimescaleDB 優化時序資料查詢 (T012)

### 執行風險

1. **Phase 2 阻塞**: 優先完成基礎設施,避免後續阻塞
2. **API 金鑰管理**: 環境變數管理敏感資訊 (T006)
3. **測試環境**: 建議使用交易所 testnet 進行初期測試
4. **部署複雜度**: Docker Compose 簡化部署流程 (T095)

---

## Success Criteria

### Phase 完成標準

- **Phase 1**: 專案可編譯,依賴安裝完成
- **Phase 2**: 資料庫連線成功,基礎模組可用
- **Phase 3**: 監控服務可啟動,能顯示資金費率
- **Phase 4**: 能偵測套利機會並發出通知
- **Phase 5**: 能執行雙邊交易並建立對沖部位
- **Phase 6**: 能自動平倉並計算收益
- **Phase 7**: 風險控制機制生效
- **Phase 8**: 所有 CLI 指令正常運作

### 整體成功標準

根據 spec.md 中的 Success Criteria:

- SC-001: 5 秒內完成資金費率更新 ✓ (US1)
- SC-002: 10 秒內完成雙邊開倉 ✓ (US3)
- SC-003: 95% 開倉成功率 ✓ (US3)
- SC-004: 3 秒內處理單邊失敗 ✓ (US3)
- SC-005: 同時監控 3 個幣別無延遲 ✓ (US1)
- SC-006: 24 小時運行穩定性 99% ✓ (US1)
- SC-007: 完整交易記錄 10+ 數據點 ✓ (US4)
- SC-008: 3 次點擊內啟動監控 ✓ (US1)
- SC-009: 100% 阻止超額交易 ✓ (US5)
- SC-010: 1 分鐘內完成自動平倉 ✓ (US4)
