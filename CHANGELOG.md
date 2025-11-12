# Changelog

跨交易所資金費率套利平台開發日誌

---

## [Unreleased]

### 計畫中
- Feature 004 剩餘任務 (WebSocket 即時訂閱、CLI 界面增強)
- Web 界面開發 (套利機會顯示、即時價格顯示、資金費率顯示)
- Phase 5-7: 交易執行、平倉管理、風險控制
- Telegram Bot 和 Webhook 通知渠道

---

## [0.4.0] - 2025-11-12

### 新增
#### Feature 004: OKX 資金費率驗證與套利評估系統（部分完成 38%）

**核心功能完成**：

- **User Story 1 - OKX 資金費率驗證** (✅ 核心完成 - 9/9 任務)
  - `FundingRateValidator` - 雙重驗證服務 (OKX Native API + CCXT 備援)
  - `FundingRateValidationRepository` - Prisma + TimescaleDB 持久化
  - 整合測試：OKX API + CCXT 驗證流程
  - 資料庫遷移：`funding_rate_validations` 表（10 個欄位）

- **User Story 3 - 套利可行性評估** (✅ 完整實作 - 7/7 任務)
  - `ArbitrageAssessor` - 套利評估服務（362 行）
    - 手續費計算（Maker/Taker/Mixed 三種模式）
    - 淨收益計算（利差金額 - 雙邊手續費）
    - 可行性判斷（淨收益 > 最小利潤閾值）
    - 極端價差檢測（預設閾值 5%）
  - CLI 參數支援：
    - `--enable-arbitrage-assessment`（啟用評估）
    - `--arbitrage-capital <usdt>`（資金量，預設 10000）
    - `--maker-fee <rate>`, `--taker-fee <rate>`（手續費率）
    - `--min-profit <rate>`（最小利潤閾值）
  - 整合到 `FundingRateMonitor`：
    - 新增 `arbitrageAssessor` 可選屬性
    - 發出 `arbitrage-feasible` 事件
    - 詳細日誌記錄（可行性、淨收益、警告）

- **User Story 2 - 價格監控** (⚠️ 部分完成 - 9/15 任務)
  - `PriceMonitor` - REST 輪詢價格監控服務
  - `PriceCache` - LRU 快取（最多 100 個交易對）
  - `RestPoller` - 定期輪詢機制（預設 5 秒）
  - `BinanceConnector.getPrices()` 和 `OkxConnector.getPrices()` 方法
  - **延後功能**：WebSocket 即時訂閱（REST 輪詢已滿足基本需求）

### 測試

**單元測試**（全數通過）：
- `ArbitrageAssessor.test.ts` - 17 個測試
  - 手續費計算（3 種模式）
  - 淨收益計算（正收益、負收益）
  - 完整評估流程（可行、不可行、極端價差）
  - 配置更新

**整合測試**（全數通過）：
- `arbitrage-assessment.test.ts` - 6 個測試
  - 完整套利評估流程（4 個交易所）
  - 不可行套利（利差太小）
  - 極端價差警告檢測
  - 不同手續費類型測試
  - 邊界條件（零資金量、無價格資料）
- `okx-funding-rate-validation.test.ts` - OKX 驗證整合測試
- `FundingRateValidationRepository.test.ts` - Repository 測試

**測試統計**：
- 總測試數：284 passed | 1 skipped (285)
- 建置狀態：✅ 成功
- 類型檢查：✅ 無錯誤

### 架構調整

**系統架構邊界原則（Constitution Principle VI）**：
- **CLI 職責**：後台監控 + 數據計算 + 寫入 DB + 日誌記錄
- **Web 職責**：查詢 DB + 即時更新 + 使用者互動 + 數據視覺化
- **資料流向**：CLI Monitor → Database → Web API → Web UI
- **安全性**：API 金鑰僅存在於 CLI 環境

### 延後功能
- **WebSocket 即時訂閱**（6 個任務）：REST 輪詢已滿足需求，WebSocket 延後實作
- **CLI 界面增強**（7 個任務）：改由 Web 界面實作
- **部分 Polish 任務**（6 個任務）：環境變數驗證、程式碼重構等延後

### 統計
- **新增程式碼**: ~994 行 TypeScript
  - `ArbitrageAssessor.ts`: 362 行
  - `ArbitrageAssessor.test.ts`: 280 行
  - `arbitrage-assessment.test.ts`: 352 行
- **修改檔案**: 2 個核心服務
  - `FundingRateMonitor.ts`: 71 行新增
  - `start.ts` (CLI): 24 行新增
- **完成進度**: 23/60 任務（38%）
- **Commits**:
  - `85fce39` - docs: 更新 Feature 004 狀態為部分完成
  - `875c448` - docs: 修訂 Constitution 至 v1.1.0

### 文件更新
- `specs/004-fix-okx-add-price-display/spec.md` - 狀態更新為 Partially Completed
- `specs/004-fix-okx-add-price-display/tasks.md` - 任務進度標記
- `.specify/memory/constitution.md` - 新增 Principle VI (v1.0.0 → v1.1.0)

---

## [0.3.0] - 2025-10-22

### 新增
#### 套利機會偵測系統 (提前實作 Phase 4 核心功能)
- **資料模型**
  - `ArbitrageOpportunity` - 套利機會記錄 (357 行)
  - `OpportunityHistory` - 機會歷史摘要 (275 行)
  - 新增 4 個 enum: `OpportunityStatus`, `DisappearReason`, `NotificationType`, `NotificationChannel`, `Severity`

- **服務層**
  - `OpportunityDetector` - 套利機會偵測邏輯 (277 行)
  - `NotificationService` - 通知服務協調器 (315 行)
  - `TerminalChannel` - 彩色終端機通知輸出 (154 行)
  - `LogChannel` - 結構化日誌通知輸出 (145 行)

- **資料存取層**
  - `ArbitrageOpportunityRepository` - 機會資料持久化 (296 行)
  - `OpportunityHistoryRepository` - 歷史資料查詢 (206 行)

- **輔助工具**
  - `opportunity-helpers.ts` - 計算與格式化工具 (277 行)
    - 年化收益率計算
    - 費率差異格式化
    - 持續時間格式化
  - `debounce.ts` - 防抖動管理器 (194 行)
    - 30 秒防抖動窗口
    - 每個幣別獨立追蹤

- **型別定義**
  - `src/types/opportunity-detection.ts` - 服務介面契約 (387 行)
  - `src/types/events.ts` - 事件驅動架構型別 (177 行)

### 資料庫
- **Migration**: `20251022022506_add_opportunity_detection`
  - 新增 `arbitrage_opportunities` 表
  - 新增 `opportunity_history` 表
  - 新增 `notification_logs` 表 (TimescaleDB hypertable)
  - Enum 型別轉換 (OpportunityStatus: PENDING/EXECUTING/COMPLETED/FAILED/EXPIRED → ACTIVE/EXPIRED/CLOSED)
  - 複合主鍵支援 TimescaleDB 分區 (`id`, `sent_at`)

### 技術改進
- 使用 `Decimal.js` 確保金融計算精確度
- TimescaleDB hypertables 用於 `notification_logs` (90 天保留)
- Repository Pattern 分離資料存取邏輯
- 防抖動機制防止通知轟炸

### 統計
- **新增程式碼**: ~1,500 行 TypeScript
- **新增檔案**: 11 個核心檔案
- **Commits**:
  - `b13ca21` - feat: 實作通知系統 (TerminalChannel, LogChannel)
  - 整合至 main 分支

---

## [0.2.0] - 2025-10-19

### 新增
#### 資金費率監控服務 (Phase 3: User Story 1)
- **資料模型**
  - `FundingRate` - 資金費率記錄模型
  - `PriceData` - 價格資料模型
  - `ArbitrageAssessment` - 套利評估模型
  - `FundingRateValidation` - 資金費率驗證模型

- **服務層**
  - `FundingRateMonitor` - 資金費率監控主服務
  - `RateDifferenceCalculator` - 費率差異計算服務
  - `MonitorStats` - 監控統計服務
  - `FundingRateValidator` - 資金費率驗證服務

- **交易所連接器**
  - `BinanceConnector` - 幣安交易所適配器 (使用 Binance Futures API)
  - `OkxConnector` - OKX 交易所適配器 (使用 CCXT)
  - `ExchangeConnectorFactory` - 連接器工廠模式
  - 統一交易所介面 (`IExchangeConnector`)

- **Repository**
  - `FundingRateValidationRepository` - 驗證記錄持久化

- **CLI 指令**
  - `arb monitor start` - 啟動監控服務
  - `arb monitor status` - 查看監控狀態
  - CLI 主程式入口 (Commander.js)

### 資料庫
- **Migration**: `20251019_initial_setup`
  - 建立 `funding_rates` 表 (TimescaleDB hypertable)
  - 建立 `hedge_positions` 表
  - 建立 `trade_records` 表
  - 建立 `arbitrage_cycles` 表
  - 建立 `risk_parameters` 表
  - 建立 `funding_rate_validations` 表
  - 建立 `system_events` 表

### 測試
- API 測試腳本 (`src/test-api.ts`)
- 成功驗證 Binance 和 OKX API 連接
- 成功計算資金費率差異

### 統計
- **新增程式碼**: ~1,750 行 TypeScript
- **新增檔案**: 15 個核心檔案
- **Commits**: `2db9232` - feat: 實作資金費率監控與交易所連接器

---

## [0.1.0] - 2025-10-17

### 新增
#### 專案基礎設施 (Phase 1-2: Setup & Foundational)
- **專案結構**
  - TypeScript 5.3+ 專案配置
  - ESLint + Prettier 程式碼風格規範
  - 目錄結構: `src/models`, `src/services`, `src/connectors`, `src/cli`, `src/lib`
  - `.env.example` 環境變數範本

- **核心依賴**
  - Node.js 20.x LTS
  - Prisma 5.x (ORM)
  - ccxt 4.x (交易所統一介面)
  - ws 8.x (WebSocket)
  - pino (結構化日誌)
  - zod (配置驗證)
  - commander (CLI 框架)
  - chalk (終端機彩色輸出)

- **基礎模組**
  - `src/lib/logger.ts` - Pino 日誌系統
  - `src/lib/config.ts` - Zod 配置管理
  - `src/lib/errors.ts` - 錯誤處理類別系統
  - `src/lib/retry.ts` - 指數退避重試機制
  - `src/lib/websocket.ts` - WebSocket 連線管理 (含自動重連)
  - `src/lib/db.ts` - Prisma Client 初始化

- **資料庫**
  - PostgreSQL 15 設置
  - TimescaleDB extension 啟用
  - Prisma schema 定義 (10 個實體模型)

### 文件
- `.specify/memory/constitution.md` - 專案憲法 v1.0.0
  - 5 個核心原則: 交易安全、可觀測性、防禦性程式設計、資料完整性、漸進式交付
- `specs/001-funding-rate-arbitrage/spec.md` - 功能規格
- `specs/001-funding-rate-arbitrage/plan.md` - 實作計畫
- `specs/001-funding-rate-arbitrage/tasks.md` - 任務清單
- `README.md` - 專案說明

### 統計
- **初始程式碼**: ~1,000 行 TypeScript
- **配置檔案**: 8 個
- **Commits**:
  - `819980e` - feat: 實作交易所連接器與 API 整合
  - `31f6be5` - docs: 建立專案憲法並更新開發文件

---

## 版本說明

- **[0.3.0]** - 套利機會偵測與通知系統 (MVP 核心功能 70% 完成)
- **[0.2.0]** - 資金費率監控服務 (Phase 3 US1)
- **[0.1.0]** - 專案基礎設施 (Phase 1-2)

---

## 技術債務追蹤

### 已知限制
1. WebSocket 即時訂閱功能尚未實作 (目前使用輪詢)
2. Redis 快取層尚未啟用 (Phase 8+ 效能優化)
3. 單元測試和整合測試尚未建立
4. Telegram Bot 和 Webhook 通知渠道尚未實作

### 計畫改進
1. 完成 Phase 3 US1 端到端測試
2. 實作 Phase 4 US2 剩餘任務
3. 新增測試覆蓋率 (目標 85%)
4. 新增 CI/CD pipeline

---

## 開發者備註

### 與原規劃的差異
1. **提前實作**: OpportunityDetector, NotificationService 原計畫在 Phase 4，但因架構需要提前實作
2. **技術選擇**:
   - 使用 Binance Futures API 直接調用而非 SDK (更靈活)
   - 使用 CCXT 統一處理 OKX API (跨交易所一致性)
3. **額外實體**: 新增 OpportunityHistory, NotificationLog (增強可觀測性)

### 憲法合規性
- ✅ 所有實作都符合 constitution.md v1.1.0 的 6 個核心原則
- ✅ Trading Safety: Saga Pattern 已規劃於 Phase 5
- ✅ Observability: Pino 日誌 + NotificationLog 完整追蹤
- ✅ Defensive: 重試機制、WebSocket 重連已實作
- ✅ Data Integrity: Prisma migrations + Decimal 類型
- ✅ Incremental Delivery: MVP (US1+US2) 優先，測試網驗證
- ✅ System Architecture Boundaries: CLI 監控 + Web 顯示分離（v1.1.0 新增）

---

**維護者**: Claude Code
**專案啟動日期**: 2025-10-17
**最後更新**: 2025-11-12
