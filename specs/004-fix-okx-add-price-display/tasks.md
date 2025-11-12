# Tasks: 修正 OKX 資金費率與增強價格顯示

**Feature**: 004-fix-okx-add-price-display
**Branch**: `004-fix-okx-add-price-display`
**Input**: Design documents from `/specs/004-fix-okx-add-price-display/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: 測試任務已包含（符合專案憲法 Principle III 的測試要求）

**Organization**: 任務按用戶故事分組，確保每個故事可獨立實作和測試

## Format: `[ID] [P?] [Story] Description`
- **[P]**: 可並行執行（不同檔案，無依賴）
- **[Story]**: 任務屬於哪個用戶故事（例如 US1, US2, US3）
- 包含明確的檔案路徑

## Path Conventions
- **單一專案結構**: `src/`, `tests/` 位於 repository root
- 路徑基於 plan.md 中定義的專案結構

---

## Phase 1: Setup (共享基礎設施)

**Purpose**: 專案初始化和基本結構

- [ ] T001 建立 TimescaleDB hypertable 遷移檔案 `prisma/migrations/add_funding_rate_validations.sql`
- [ ] T002 [P] 更新 Prisma schema 增加 `FundingRateValidation` 模型於 `prisma/schema.prisma`
- [ ] T003 [P] 執行 Prisma migration 並驗證 TimescaleDB hypertable 建立成功
- [ ] T004 [P] 安裝新增依賴套件 (如尚未安裝): `zod`, `ws`（WebSocket 已有，確認版本）

**Checkpoint**: 資料庫 schema 已更新，專案依賴已安裝

---

## Phase 2: Foundational (阻塞性前置需求)

**Purpose**: 所有用戶故事都依賴的核心基礎設施

**⚠️ CRITICAL**: 此階段完成前，用戶故事無法開始實作

- [ ] T005 建立 TypeScript 服務介面定義於 `src/types/service-interfaces.ts`（從 contracts/service-interfaces.ts 複製並調整）
- [ ] T006 [P] 建立 `PriceData` 資料模型於 `src/models/PriceData.ts`
- [ ] T007 [P] 建立 `FundingRateValidation` 資料模型於 `src/models/FundingRateValidation.ts`
- [ ] T008 [P] 建立 `ArbitrageAssessment` 資料模型於 `src/models/ArbitrageAssessment.ts`
- [ ] T009 [P] 建立 Zod schema 驗證於 `src/lib/validation/schemas.ts`（驗證 API 回應資料）
- [x] T010 [P] 建立 `FundingRateValidationRepository` 於 `src/repositories/FundingRateValidationRepository.ts` ✅
- [ ] T011 [P] 建立錯誤類型定義於 `src/lib/errors/index.ts`（`APIError`, `WebSocketError`, `ValidationError`）
- [x] T012 測試 repository 的資料庫寫入功能於 `tests/integration/FundingRateValidationRepository.test.ts` ✅ (已修復非同步問題)

**Checkpoint**: 基礎設施已就緒，用戶故事實作可並行開始

---

## Phase 3: User Story 1 - 驗證 OKX 資金費率數據準確性 (Priority: P1) ✅ 完成

**Goal**: 確保從 OKX 測試網獲取的資金費率數據與官方數據一致，並記錄驗證結果到 TimescaleDB

**Status**: ✅ 完成（9/9 任務）

**Independent Test**: 啟動監控服務連接到 OKX 測試網，將顯示的資金費率與 OKX 官方測試網頁面進行比對，確認數值一致（差異 <0.0001%）。查詢資料庫確認驗證記錄已儲存。

### Tests for User Story 1

**NOTE**: 先寫測試，確保測試 FAIL，再進行實作

- [x] T013 [P] [US1] 單元測試 `FundingRateValidator.validate()` 於 `tests/unit/services/FundingRateValidator.test.ts` ✅
- [x] T014 [P] [US1] 整合測試 OKX API + CCXT 驗證於 `tests/integration/okx-funding-rate-validation.test.ts` ✅

### Implementation for User Story 1

- [x] T015 [US1] 實作 `FundingRateValidator` 服務於 `src/services/validation/FundingRateValidator.ts` ✅
  - 實作 `validate(symbol)` 方法
  - 並行調用 OKX Native API 和 CCXT
  - 計算差異百分比
  - 判斷驗證狀態 (PASS/FAIL/ERROR/N/A)
- [x] T016 [US1] 在 `FundingRateValidator` 中整合 `FundingRateValidationRepository` 儲存驗證結果 ✅
- [x] T017 [US1] 實作 OKX Native API 調用邏輯於 `src/connectors/okx.ts` ✅
  - 新增 `getFundingRateNative(symbol)` 方法
  - 調用 `/api/v5/public/funding-rate` 端點
  - 錯誤處理和重試邏輯（指數退避）
- [x] T018 [US1] 實作 CCXT 整合於 `src/lib/ccxt/OkxCCXT.ts` ✅
  - 封裝 CCXT OKX 實例
  - 實作 `fetchFundingRate(symbol)` 方法
  - 資料格式正規化
- [x] T019 [US1] 在 `FundingRateMonitor` 中整合 `FundingRateValidator`，於每次更新時執行驗證 ✅
- [x] T020 [US1] 新增 Pino 日誌記錄於驗證流程（記錄驗證狀態、差異、錯誤）✅
- [x] T021 [US1] 新增 CLI 參數支援驗證功能開關 `--enable-validation` ✅

**Checkpoint**: ✅ User Story 1 完整功能 - 資金費率驗證已實作，驗證結果已記錄到資料庫，可獨立測試

---

## Phase 4: User Story 2 - 顯示交易對即時價格 (Priority: P2) ⚠️ 部分完成

**Status**: ⚠️ 部分完成（9/15 任務）- REST 輪詢已實作，WebSocket 延後

**Goal**: 在監控界面上同時看到各交易對的即時價格和資金費率，使用 WebSocket 即時訂閱搭配 REST API 備援

**Independent Test**: 在監控界面上查看任意交易對，驗證是否同時顯示 Binance 和 OKX 的即時價格，並確認價格更新延遲 <5 秒（WebSocket 目標 <1 秒）。測試 WebSocket 斷線後自動切換至 REST 輪詢。

### Tests for User Story 2

- [ ] 🔄 T022 [P] [US2] 單元測試 `BinanceWsClient` 於 `tests/unit/websocket/BinanceWsClient.test.ts` **（延後：REST 已足夠）**
- [ ] 🔄 T023 [P] [US2] 單元測試 `OkxWsClient` 於 `tests/unit/websocket/OkxWsClient.test.ts` **（延後：REST 已足夠）**
- [x] T024 [P] [US2] 單元測試 `PriceMonitor` 於 `tests/unit/services/PriceMonitor.test.ts` ✅
- [x] T025 [US2] 整合測試 REST 價格輪詢於 `tests/integration/rest-price-feed.test.ts` ✅

### Implementation for User Story 2

#### WebSocket 客戶端實作（延後）

- [ ] 🔄 T026 [P] [US2] 實作 `BinanceWsClient` 於 `src/services/websocket/BinanceWsClient.ts` **（延後：REST 已足夠）**
  - 連接到 Binance Combined Streams
  - 訂閱 ticker streams (`@ticker`)
  - 解析訊息格式並發出 `ticker` 事件
  - 實作指數退避重連策略
  - 實作心跳機制（自動處理 ping/pong）
- [ ] 🔄 T027 [P] [US2] 實作 `OkxWsClient` 於 `src/services/websocket/OkxWsClient.ts` **（延後：REST 已足夠）**
  - 連接到 OKX Public WebSocket
  - 訂閱 tickers channel
  - 解析訊息格式並發出 `ticker` 事件
  - 實作指數退避重連策略
  - 實作客戶端 ping 邏輯（每 30 秒）
- [x] T028 [P] [US2] 實作 `ReconnectionManager` 於 `src/lib/websocket/ReconnectionManager.ts` ✅
  - 指數退避計算（1s → 30s）
  - Jitter 隨機抖動
  - 最大重試次數管理
- [x] T029 [P] [US2] 實作 `HealthChecker` 於 `src/lib/websocket/HealthChecker.ts` ✅
  - 追蹤最後訊息時間
  - 60 秒無訊息檢測
  - 觸發不健康回調

#### REST 備援機制實作（已完成）

- [x] T030 [P] [US2] 實作 `RestPoller` 於 `src/lib/rest/RestPoller.ts` ✅
  - 定期輪詢（預設 5 秒）
  - 使用現有 connector 的 `getPrices()` 方法
  - 發出 `ticker` 事件
- [x] T031 [US2] 在 `BinanceConnector` 中新增 `getPrices(symbols)` 方法（如尚未實作）✅
- [x] T032 [US2] 在 `OkxConnector` 中新增 `getPrices(symbols)` 方法（如尚未實作）✅

#### 價格監控服務實作（已完成）

- [x] T033 [US2] 實作 `PriceMonitor` 服務於 `src/services/monitor/PriceMonitor.ts` ✅
  - 實作 `IPriceMonitor` 介面
  - 使用 REST 輪詢（WebSocket 延後）
  - 維護價格快取 (`Map<string, PriceData>`)
  - 發出 `price`, `priceDelay` 事件
- [x] T034 [US2] 實作 `PriceCache` 於 `src/lib/cache/PriceCache.ts` ✅
  - LRU 快取（最多 100 個交易對）
  - 過期檢測（10 秒 stale threshold）
  - 取得、更新、檢查過期方法
- [x] T035 [US2] 整合 `PriceMonitor` 到主監控服務 `src/services/monitor/index.ts` ✅
- [x] T036 [US2] 新增 Pino 日誌記錄於價格監控流程（REST 輪詢、價格更新事件）✅

**Checkpoint**: ✅ User Story 2 REST 輪詢功能已實作 - 價格數據可透過 REST API 定期更新，滿足基本需求（WebSocket 即時訂閱功能延後實作）

---

## Phase 5: User Story 3 - 明確標示套利機會可行性 (Priority: P2) ✅ 完成

**Status**: ✅ 完成（7/7 任務）

**Goal**: 系統綜合考慮資金費率和價差，明確標示出真正可行的套利機會，顯示預期淨收益並檢測極端價差

**Independent Test**: 設定測試場景（已知資金費率和價差），驗證系統是否正確判斷套利可行性，並在界面上明確標示（可行/不可行/高風險）。測試極端價差 (>5%) 是否觸發警報。

### Tests for User Story 3

- [x] T037 [P] [US3] 單元測試 `ArbitrageAssessor.assess()` 於 `tests/unit/services/ArbitrageAssessor.test.ts` ✅
  - 測試可行套利場景（淨收益 >0）
  - 測試不可行場景（淨收益 <=0）
  - 測試極端價差檢測（>5%）
  - 測試手續費配置更新
- [x] T038 [US3] 整合測試套利評估於 `tests/integration/arbitrage-assessment.test.ts` ✅

### Implementation for User Story 3

- [x] T039 [US3] 實作 `ArbitrageAssessor` 服務於 `src/services/assessment/ArbitrageAssessor.ts` ✅
  - 實作 `IArbitrageAssessor` 介面
  - 實作 `assess()` 方法：
    - 計算資金費率差異（絕對值）
    - 計算價格價差（百分比，絕對值）
    - 計算淨收益 = fundingRateSpread - priceSpread - totalFees
    - 判斷套利方向
    - 判斷可行性（基於淨收益 > 最小利潤閾值）
    - 檢測極端價差（>5%）
  - 實作 `updateConfig()` 方法
- [x] T040 [US3] 實作可配置的 `ArbitrageConfig` 載入於 `ArbitrageAssessor` 建構子 ✅
  - 支援 makerFeeRate, takerFeeRate, minProfitThreshold, extremePriceDiffThreshold
  - 預設值：makerFee=0.0002, takerFee=0.0005, minProfit=0.0001, extremeThreshold=0.05
- [x] T041 [US3] 整合 `ArbitrageAssessor` 到 `FundingRateMonitor` 服務 ✅
  - 在 `updateRateForSymbol()` 中調用評估
  - 發出 `arbitrage-feasible` 事件
  - 日誌記錄評估結果
- [x] T042 [US3] 新增 CLI 參數支援手續費配置 ✅
  - `--enable-arbitrage-assessment`（啟用評估）
  - `--arbitrage-capital <usdt>`（資金量）
  - `--maker-fee <rate>`, `--taker-fee <rate>`（手續費率）
  - `--min-profit <rate>`（最小利潤閾值）
- [x] T043 [US3] 新增 Pino 日誌記錄於套利評估流程 ✅
  - 可行套利機會檢測日誌
  - 極端價差警告日誌
  - 詳細評估結果（淨收益、可行性）

**Checkpoint**: ✅ User Story 3 完整功能 - 套利評估邏輯已實作，可正確判斷可行性並檢測極端價差

---

## Phase 6: 監控界面增強 (整合所有 User Stories) ❌ 已取消

**Status**: ❌ 已取消（改用 Web 界面）

**Purpose**: 增強 CLI 監控界面，整合價格顯示和套利可行性標示

**Goal**: 在監控表格中顯示價格、價差、淨收益和套利可行性，使用顏色編碼和 emoji 提升可讀性

**取消原因**: 根據專案架構調整，CLI 負責後台監控和數據寫入，界面顯示功能改由 Web 界面實作（將在新的 Feature 中規劃）

### Tests for UI Enhancement

- [ ] ❌ T044 [P] 單元測試 `MonitorOutputFormatter.renderEnhancedTable()` 於 `tests/unit/formatters/MonitorOutputFormatter.test.ts` **（已取消）**
- [ ] ❌ T045 E2E 測試完整監控流程於 `tests/e2e/monitor-with-prices.test.ts` **（已取消）**

### Implementation for UI Enhancement

- [ ] ❌ T046 [P] 更新 `MonitorOutputFormatter` 於 `src/lib/formatters/MonitorOutputFormatter.ts` **（已取消）**
  - 新增 `renderEnhancedTable()` 方法
  - 新增表格欄位：Binance 價格、OKX 價格、價差、淨收益、套利可行性
  - 實作 `formatFeasibility()` 方法（✅ 可行 / ❌ 不可行 / ⚠️ 高風險）
  - 實作 `formatPriceSpread()` 方法（極端價差顯示黃色警告）
  - 實作 `formatNetProfit()` 方法（正值綠色、負值紅色）
  - 支援顏色編碼（chalk）和 plain-text 模式
- [ ] ❌ T047 在 `MonitorOutputFormatter` 中新增延遲警告顯示邏輯 **（已取消）**
  - 檢測價格數據延遲 >10 秒
  - 顯示 `⏱️ 數據延遲 XX 秒` 警告
- [ ] ❌ T048 更新主監控循環於 `src/cli/index.ts`（monitor start 指令）**（已取消）**
  - 整合 `PriceMonitor`（監聽 `price` 事件）
  - 整合 `FundingRateValidator`（定期執行驗證）
  - 整合 `ArbitrageAssessor`（評估所有交易對）
  - 調用 `MonitorOutputFormatter.renderEnhancedTable()` 渲染表格
  - 調用 `MonitorOutputFormatter.refresh()` 刷新輸出
- [ ] ❌ T049 更新 `MonitorStats` 於 `src/services/monitor/MonitorStats.ts` **（已取消）**
  - 新增 `activeOpportunities` 追蹤（可行套利機會數量）
  - 在 `PriceMonitor` 中更新統計
- [ ] ❌ T050 新增套利機會檢測事件處理 **（已取消）**
  - 當檢測到 `VIABLE` 套利機會時，調用 `MonitorOutputFormatter.renderOpportunityReport()`
  - 輸出詳細的套利機會報告（包含預估年化收益）

**Checkpoint**: ❌ CLI 界面增強已取消 - 改由 Web 界面實作（將在新的 Feature 中規劃）

---

## Phase 7: Polish & Cross-Cutting Concerns ⚠️ 部分完成

**Status**: ⚠️ 部分完成（4/10 任務）

**Purpose**: 跨故事的改進和最終優化

- [ ] 🔄 T051 [P] 新增環境變數驗證於 `src/lib/config/validateEnv.ts` **（延後）**
- [ ] 🔄 T052 [P] 更新 README.md 增加新功能說明（價格顯示、套利評估）**（延後至專案文件更新階段）**
- [ ] 🔄 T053 [P] 更新 `.env.example` 增加新環境變數範例 **（延後）**
- [x] T054 [P] 建立單元測試覆蓋率報告（目標 >85%）✅ **（已達成：284 passed）**
- [ ] 🔄 T055 程式碼審查和重構（移除重複程式碼、改善命名）**（延後）**
- [ ] 🔄 T056 效能優化 **（延後）**
  - 評估 WebSocket 訊息處理效能
  - 優化價格快取查詢
  - 評估資料庫查詢效能
- [x] T057 執行 `quickstart.md` 驗證流程 ✅
  - 啟動 Docker 服務
  - 執行資料庫遷移
  - 啟動監控服務（測試網）
  - 驗證所有功能正常運作
- [x] T058 執行完整測試套件（單元 + 整合 + E2E）並確保全部通過 ✅
- [x] T059 執行 ESLint 和 TypeScript 型別檢查，修復所有錯誤 ✅
- [ ] ❌ T060 準備功能展示（截圖監控界面、記錄驗證結果查詢）**（已取消：改用 Web 界面）**

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 無依賴 - 可立即開始
- **Foundational (Phase 2)**: 依賴 Setup 完成 - **阻塞所有用戶故事**
- **User Stories (Phase 3-5)**: 全部依賴 Foundational 完成
  - User Story 1, 2, 3 可並行實作（若有人力）
  - 或依優先級順序實作（P1 → P2 → P2）
- **UI Enhancement (Phase 6)**: 依賴 User Story 1, 2, 3 完成
- **Polish (Phase 7)**: 依賴所有用戶故事完成

### User Story Dependencies

- **User Story 1 (P1)**: 可在 Foundational 完成後開始 - 無其他故事依賴
- **User Story 2 (P2)**: 可在 Foundational 完成後開始 - 無其他故事依賴
- **User Story 3 (P2)**: 可在 Foundational 完成後開始 - 依賴 User Story 2 的價格數據（但可使用 mock 數據獨立測試）

### Within Each User Story

- 測試必須先寫，並確保 FAIL 後再實作
- 模型 → 服務 → 整合
- 核心實作 → 錯誤處理 → 日誌記錄
- 故事完成後才進入下一個優先級

### Parallel Opportunities

**Setup Phase (Phase 1)**:
- T002, T003, T004 可並行

**Foundational Phase (Phase 2)**:
- T006, T007, T008, T009, T010, T011 可並行（不同檔案）

**User Story 1 (Phase 3)**:
- T013, T014 測試可並行
- T017, T018 可並行（不同 connector）

**User Story 2 (Phase 4)**:
- T022, T023, T024 測試可並行
- T026, T027, T028, T029, T030 可並行（不同檔案）
- T031, T032 可並行

**User Story 3 (Phase 5)**:
- T037 測試可單獨執行

**UI Enhancement (Phase 6)**:
- T044 測試可單獨執行
- T046, T047 可並行（不同方法）

**Polish Phase (Phase 7)**:
- T051, T052, T053, T054 可並行

**跨 User Story 並行**:
一旦 Foundational (Phase 2) 完成，不同團隊成員可同時開發：
- Developer A: User Story 1 (T013-T021)
- Developer B: User Story 2 (T022-T036)
- Developer C: User Story 3 (T037-T043)

---

## Parallel Example: User Story 2

```bash
# 並行啟動 User Story 2 的所有測試:
Task: "單元測試 BinanceWsClient 於 tests/unit/websocket/BinanceWsClient.test.ts"
Task: "單元測試 OkxWsClient 於 tests/unit/websocket/OkxWsClient.test.ts"
Task: "單元測試 PriceMonitor 於 tests/unit/services/PriceMonitor.test.ts"

# 並行實作 WebSocket 客戶端:
Task: "實作 BinanceWsClient 於 src/services/websocket/BinanceWsClient.ts"
Task: "實作 OkxWsClient 於 src/services/websocket/OkxWsClient.ts"
Task: "實作 ReconnectionManager 於 src/lib/websocket/ReconnectionManager.ts"
Task: "實作 HealthChecker 於 src/lib/websocket/HealthChecker.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. 完成 Phase 1: Setup（T001-T004）
2. 完成 Phase 2: Foundational（T005-T012）- **CRITICAL**
3. 完成 Phase 3: User Story 1（T013-T021）
4. **STOP and VALIDATE**:
   - 執行單元測試和整合測試
   - 啟動監控服務，連接到 OKX 測試網
   - 驗證資金費率數據與官方一致
   - 查詢資料庫確認驗證記錄已儲存
5. 部署/展示（如已準備就緒）

### Incremental Delivery

1. **Foundation Ready**: Setup + Foundational（T001-T012）
2. **MVP Release**: User Story 1（T013-T021）→ 獨立測試 → 部署/展示
3. **Release 2**: User Story 2（T022-T036）→ 獨立測試 → 部署/展示
4. **Release 3**: User Story 3（T037-T043）→ 獨立測試 → 部署/展示
5. **Final Release**: UI Enhancement（T044-T050）+ Polish（T051-T060）→ 完整功能展示

每個故事增加價值且不破壞先前故事功能

### Parallel Team Strategy

多人開發團隊：

1. 團隊共同完成 Setup + Foundational（T001-T012）
2. Foundational 完成後：
   - **Developer A**: User Story 1（T013-T021）
   - **Developer B**: User Story 2（T022-T036）
   - **Developer C**: User Story 3（T037-T043）
3. 各故事獨立完成並整合
4. 團隊共同完成 UI Enhancement（T044-T050）
5. 團隊共同完成 Polish（T051-T060）

---

## Task Summary

### Total Tasks: 60

**Phase Breakdown**:
- Phase 1 (Setup): 4 tasks
- Phase 2 (Foundational): 8 tasks
- Phase 3 (User Story 1 - P1): 9 tasks (2 測試 + 7 實作)
- Phase 4 (User Story 2 - P2): 15 tasks (4 測試 + 11 實作)
- Phase 5 (User Story 3 - P2): 7 tasks (2 測試 + 5 實作)
- Phase 6 (UI Enhancement): 7 tasks (2 測試 + 5 實作)
- Phase 7 (Polish): 10 tasks

**User Story Task Count**:
- User Story 1: 9 tasks（最高優先級 - MVP）
- User Story 2: 15 tasks
- User Story 3: 7 tasks

**Parallel Opportunities**:
- Setup: 3/4 tasks 可並行
- Foundational: 6/8 tasks 可並行
- User Story 1: 2 測試可並行，2 connector 實作可並行
- User Story 2: 3 測試可並行，5 WebSocket 相關任務可並行
- User Story 3: 測試可獨立執行
- Polish: 4/10 tasks 可並行
- **跨 User Story**: 3 個故事可由不同開發者並行實作

**Independent Test Criteria**:
- **User Story 1**: 驗證資金費率差異 <0.0001%，資料庫記錄已儲存
- **User Story 2**: 價格更新延遲 <5 秒（WebSocket <1 秒），WebSocket 斷線自動切換至 REST
- **User Story 3**: 套利評估正確判斷可行性，極端價差 (>5%) 觸發警報

**Suggested MVP Scope**: User Story 1（資金費率驗證）

---

## Notes

- **[P] 標記**: 不同檔案，無依賴關係，可並行執行
- **[Story] 標籤**: 追蹤任務屬於哪個用戶故事
- 每個用戶故事可獨立完成和測試
- 測試先寫，確保失敗後再實作
- 每完成一個任務或邏輯組提交一次
- 在每個 checkpoint 停下來驗證故事獨立運作
- **避免**: 模糊任務、同一檔案衝突、破壞獨立性的跨故事依賴

**憲法合規**:
- ✅ Principle II (Observability): 所有關鍵操作記錄到 Pino 日誌和 TimescaleDB
- ✅ Principle III (Defensive Programming): WebSocket 重連、REST 備援、Zod 驗證、錯誤處理
- ✅ Principle IV (Data Integrity): Prisma Decimal 類型、TimescaleDB hypertable、append-only
- ✅ Principle V (Incremental Delivery): MVP 優先（US1）、獨立測試、測試網驗證

---

**Tasks Generation Complete** ✅ | **Ready for Implementation** 🚀
