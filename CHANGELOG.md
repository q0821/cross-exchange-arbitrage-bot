# Changelog

跨交易所資金費率套利平台開發日誌

---

## [Unreleased]

### 計畫中
- Phase 4: User Story 2 剩餘任務 (閾值判斷、收益計算、CLI 指令)
- Phase 5-7: 交易執行、平倉管理、風險控制
- 單元測試與整合測試
- Telegram Bot 和 Webhook 通知渠道

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
- ✅ 所有實作都符合 constitution.md v1.0.0 的 5 個核心原則
- ✅ Trading Safety: Saga Pattern 已規劃於 Phase 5
- ✅ Observability: Pino 日誌 + NotificationLog 完整追蹤
- ✅ Defensive: 重試機制、WebSocket 重連已實作
- ✅ Data Integrity: Prisma migrations + Decimal 類型
- ✅ Incremental Delivery: MVP (US1+US2) 優先，測試網驗證

---

**維護者**: Claude Code
**專案啟動日期**: 2025-10-17
**最後更新**: 2025-10-22
