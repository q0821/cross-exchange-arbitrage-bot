# Cross-Exchange Arbitrage Bot

跨交易所資金費率套利平台 - 自動偵測幣安和 OKX 的資金費率差異並執行套利交易

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## 🎯 專案狀態

**當前版本**: v0.5.0 (CLI 監控 + Web 多用戶平台)
**最後更新**: 2025-11-12

### ✅ 已完成功能 (Phase 1-3)

#### Phase 1: 資料庫與型別系統 ✅
- ✅ PostgreSQL 15 + TimescaleDB 時序資料庫
- ✅ 3 個核心資料表：套利機會、機會歷史、通知日誌
- ✅ Prisma ORM (完整型別安全)
- ✅ TimescaleDB hypertable 自動分區
- ✅ 完整的事件型別定義系統

#### Phase 2: 基礎元件 ✅
- ✅ **領域模型**
  - ArbitrageOpportunity（套利機會業務邏輯）
  - OpportunityHistory（生命週期追蹤）
- ✅ **資料存取層**
  - ArbitrageOpportunityRepository（CRUD + 查詢 + 統計）
  - OpportunityHistoryRepository（歷史記錄管理）
  - NotificationLogRepository（通知日誌 + 防抖動統計）
- ✅ **工具函式**
  - DebounceManager（per-symbol 防抖動機制）

#### Phase 3: 核心偵測與通知功能 ✅
- ✅ **OpportunityDetector 偵測引擎**
  - 自動偵測費率差異達到閾值的套利機會
  - 計算預期年化收益率（考慮資金費率結算頻率）
  - 追蹤機會生命週期（ACTIVE → EXPIRED → CLOSED）
  - 記錄最大費率差異和持續時間

- ✅ **NotificationService 通知系統**
  - 多渠道通知管理（Terminal + Log）
  - 防抖動機制（30 秒窗口，避免通知轟炸）
  - Graceful degradation（單一渠道失敗不影響其他渠道）
  - 通知統計與追蹤

- ✅ **通知渠道實作**
  - TerminalChannel（終端機彩色輸出，INFO/WARNING/CRITICAL）
  - LogChannel（Pino 結構化日誌）

- ✅ **CLI 指令**
  - `opportunities config` - 查看/設定偵測配置
  - `opportunities list` - 列出套利機會（支援篩選和排序）
  - `opportunities show <id>` - 查看特定機會詳情

#### 測試覆蓋 ✅
- ✅ **186 個測試全部通過**
  - 19 個整合測試（資料庫、Repository、防抖動機制）
  - 6 個端到端測試（完整流程驗證）
  - 161 個單元測試（現有功能）
- ✅ **測試覆蓋率**: Phase 1-3 核心功能 100%

#### Feature 004: OKX 驗證與套利評估 ⚠️（部分完成 38%）

- ✅ **User Story 1: OKX 資金費率驗證**（核心完成）
  - FundingRateValidator - 雙重驗證服務（OKX Native API + CCXT 備援）
  - FundingRateValidationRepository - 驗證記錄持久化（TimescaleDB）
  - 整合測試 - OKX API + CCXT 驗證流程驗證

- ⚠️ **User Story 2: 價格監控**（部分完成）
  - PriceMonitor - REST 輪詢價格監控服務（每 5 秒更新）
  - PriceCache - LRU 快取機制（100 個交易對）
  - BinanceConnector / OkxConnector - getPrices() 方法實作
  - 🔄 **延後**: WebSocket 即時訂閱（REST 已滿足需求）

- ✅ **User Story 3: 套利可行性評估**（完整實作）
  - ArbitrageAssessor - 套利評估引擎（362 行）
    - 手續費計算（Maker/Taker/Mixed 三種模式）
    - 淨收益計算（利差 - 雙邊手續費）
    - 可行性判斷（淨收益 > 最小利潤閾值）
    - 極端價差檢測（預設閾值 5%）
  - CLI 參數支援 - `--enable-arbitrage-assessment`, `--arbitrage-capital`, `--maker-fee`, `--taker-fee`, `--min-profit`
  - 整合到 FundingRateMonitor - 發出 `arbitrage-feasible` 事件

- ✅ **測試**: 284 個測試通過（包含 Feature 004 測試）
  - 17 個 ArbitrageAssessor 單元測試
  - 6 個套利評估整合測試

- ✅ **系統架構調整**: 新增 Constitution Principle VI
  - CLI 職責: 後台監控 + 數據計算 + 寫入 DB
  - Web 職責: 查詢 DB + 即時更新 + 使用者互動
  - 資料流向: CLI Monitor → Database → Web API → Web UI

#### Feature 006: Web 多用戶套利交易平台 ⚠️（部分完成 36%）

**已完成核心功能**：

- ✅ **User Story 1: 用戶註冊和 API Key 設定**（完成）
  - 自定義 JWT Token 認證（SessionManager）
  - Email/Password 登入和註冊
  - API Key 管理頁面（支援 5 個交易所：Binance、OKX、Bybit、MEXC、Gate.io）
  - AES-256-GCM 加密儲存
  - 環境選擇（主網/測試網）
  - 完整 CRUD 操作（新增、編輯、啟用/停用、刪除）

- ✅ **User Story 2: 即時套利機會監控**（完成）
  - 套利機會列表頁面（網格卡片展示）
  - WebSocket 即時更新（new、update、expired 事件）
  - 機會詳情頁面
  - 成本計算和淨利潤率展示（Decimal.js 精確計算）
  - 年化收益率計算
  - 連線狀態指示器（綠色脈動動畫）

- ✅ **User Story 2.5: 多交易所市場監控**（完成）
  - 市場監控頁面（表格形式，同時顯示 4 個交易所）
  - 即時資金費率和價格顯示
  - 最佳套利對自動計算和標示（BUY/SELL 標籤）
  - WebSocket 定期廣播（每 5 秒更新）
  - 費率差異狀態指示（🔔 機會 / ⚠️ 接近 / ➖ 正常）
  - 交易對群組篩選和排序
  - 統計卡片（機會數、最高年化收益）

**技術實作**：
- Next.js 14 App Router + React 18 + TypeScript 5.6
- Socket.io WebSocket（JWT 認證、Room 管理）
- Prisma + PostgreSQL + TimescaleDB + Redis
- Tailwind CSS + Radix UI + Lucide React
- 5 個主要頁面（register、login、api-keys、opportunities、market-monitor）
- 8+ 個 API 路由
- 2 個 WebSocket Handlers（MarketRatesHandler、OpportunityHandler）
- 4+ 個自定義 Hooks（useWebSocket、useMarketRates 等）
- 10+ 個組件

**延後功能**：
- ⏸️ User Story 3: 手動開倉（TradeOrchestrator、Saga Pattern）
- ⏸️ User Story 4: 手動平倉（PnL 計算）
- ⏸️ User Story 5: 歷史記錄查詢

#### Feature 008: 交易所快速連結 ✅（核心功能完成 40%）

- ✅ **ExchangeLink 組件**（115 行）
  - 支援 4 個交易所 URL 生成（Binance、OKX、MEXC、Gate.io）
  - URL Builder 服務（統一符號格式處理：BTCUSDT → 各交易所格式）
  - 新分頁開啟（target="_blank" + rel="noopener noreferrer"）
  - 整合到市場監控頁面 RateRow 組件

- ✅ **視覺化和無障礙**
  - Radix UI Tooltip 提示說明
  - Hover 效果（opacity-70）
  - Lucide React ExternalLink 圖標
  - 完整的 aria-label 支援
  - 禁用狀態處理（無數據時自動禁用）

**符號格式轉換**：
- 內部格式：BTCUSDT（統一標準）
- Binance：BTCUSDT
- OKX：BTC-USDT-SWAP
- MEXC：BTC_USDT
- Gate.io：BTC_USDT

#### Feature 009: 市場監控頁面穩定排序 ✅（完成 100% - 27/27 任務）

- ✅ **快照排序 (Snapshot Sorting) 模式**
  - 列表順序固定，WebSocket 更新不觸發重新排序
  - 位置穩定性達 100%
  - 只有數值更新，交易對位置保持不變
  - 預設按交易對字母順序排列（升序）

- ✅ **用戶自訂排序**
  - 支援按交易對名稱、費率差異、年化收益排序
  - 點擊欄位標題切換排序方向
  - 視覺排序指示器（↑ 升序 / ↓ 降序 / ↕ 未排序）
  - 排序後列表保持穩定

- ✅ **排序偏好記憶**
  - localStorage 自動儲存排序設定
  - 頁面重新載入後自動恢復排序
  - 優雅降級處理（私密瀏覽模式下功能照常運作）

- ✅ **技術實作**
  - Map-based 資料儲存（O(1) 查找和更新）
  - 穩定排序演算法（次要排序鍵確保穩定性）
  - useMemo 精確控制依賴（避免不必要的重新計算）
  - 完整的 localStorage 錯誤處理

**新增檔案**：
- `app/(dashboard)/market-monitor/types.ts` - 排序類型定義
- `app/(dashboard)/market-monitor/utils/sortComparator.ts` - 穩定排序比較器
- `app/(dashboard)/market-monitor/utils/localStorage.ts` - localStorage 工具

**修改組件**：
- `useMarketRates.ts` - 改用 Map 儲存資料
- `RatesTable.tsx` - 實作快照排序
- `useTableSort.ts` - 預設排序改為字母順序
- `page.tsx` - 整合 ratesMap 和過濾邏輯

### 🔄 計畫功能 (Phase 4-7)

- 🔜 **Phase 4**: 多幣別機會排序與優先級
- 🔜 **Phase 5**: 機會生命週期追蹤與歷史記錄查詢
- 🔜 **Phase 6**: 多通道通知（Webhook, Telegram）
- 🔜 **Phase 7**: 效能優化、文件、整合測試

## 功能特色

### CLI 監控系統
- 🔍 **即時監控**: 每 5 秒更新 Binance 和 OKX 的資金費率與價格
- 📊 **智能偵測**: 自動識別套利機會並計算年化收益率
- ✅ **雙重驗證**: OKX 資金費率使用 Native API + CCXT 雙重驗證確保準確性
- 💰 **套利評估**: 自動計算淨收益（利差 - 手續費），判斷套利可行性
- 🎯 **極端價差檢測**: 自動檢測異常價差（預設 >5%）並發出警告
- 🛡️ **防抖動**: 30 秒窗口防止通知轟炸
- ⚡ **高精確度**: 使用 Decimal.js 確保金融計算精確

### Web 多用戶平台
- 👤 **多用戶系統**: Email/Password 註冊登入 + JWT Token 認證
- 🔐 **API Key 管理**: 支援 5 個交易所（Binance、OKX、Bybit、MEXC、Gate.io）
- 🔒 **安全加密**: AES-256-GCM 加密儲存 API Keys
- 🌐 **環境隔離**: 主網/測試網環境分離管理
- 📊 **即時更新**: WebSocket 推送套利機會（new、update、expired 事件）
- 🗺️ **市場全景**: 4 個交易所資金費率一覽表（Binance、OKX、MEXC、Gate.io）
- 🎯 **智能標示**: 自動計算並標示最佳套利對（BUY/SELL 標籤）
- 📈 **收益分析**: 年化收益率、淨利潤率即時計算
- 🔗 **快速跳轉**: 一鍵開啟交易所對應交易對頁面
- 🎨 **現代 UI**: Next.js 14 + Tailwind CSS + Radix UI
- 📱 **響應式設計**: 支援桌面和行動裝置
- ♿ **無障礙設計**: 完整的 aria-label 和 Tooltip 支援

### 架構特色
- 🏗️ **職責分離**: CLI 負責監控計算，Web 負責顯示互動
- 🗄️ **單一真相來源**: 資料庫作為 CLI 和 Web 之間的契約
- 🔄 **即時同步**: WebSocket 確保多用戶即時數據同步
- 📈 **歷史追蹤**: 完整的機會生命週期追蹤與統計

## 技術架構

### CLI 監控系統
- **語言**: TypeScript 5.3+
- **運行環境**: Node.js 20.x LTS
- **數據庫**: PostgreSQL 15+ with TimescaleDB extension
- **ORM**: Prisma 5.x
- **日誌**: Pino (高性能結構化日誌)
- **金融計算**: Decimal.js (精確度保證)
- **CLI 框架**: Commander.js
- **終端機輸出**: Chalk (彩色顯示)

### Web 多用戶平台
- **前端框架**: Next.js 14 App Router
- **UI 框架**: React 18
- **語言**: TypeScript 5.6
- **樣式**: Tailwind CSS
- **組件庫**: Radix UI (Tooltip)
- **圖標**: Lucide React
- **即時通訊**: Socket.io v4 (WebSocket + polling)
- **認證**: JWT Token + HttpOnly Cookies
- **資料庫**: Prisma 5.x + PostgreSQL 15 + TimescaleDB
- **快取**: Redis 7+
- **精確計算**: Decimal.js

### 交易所整合

- **Binance**: Binance Futures API (直接調用 `/fapi/v1/premiumIndex`)
- **OKX**: OKX Native API + `ccxt` v4.x (雙重驗證)
- **MEXC**: `ccxt` v4.x
- **Gate.io**: `ccxt` v4.x
- **Bybit**: `ccxt` v4.x (API Key 管理支援)

## 系統需求

- Node.js >= 20.0.0
- pnpm >= 8.0.0
- PostgreSQL >= 15.0 (含 TimescaleDB extension)
- Docker (可選，用於本地開發環境)

## 安裝步驟

### 1. 克隆專案

```bash
git clone <repository-url>
cd cross-exchange-arbitrage-bot
```

### 2. 安裝依賴

```bash
pnpm install
```

### 3. 設定環境變數

複製範例環境變數檔案並填入您的 API 金鑰：

```bash
cp .env.example .env
```

編輯 `.env` 檔案，填入以下資訊：

- Binance API 金鑰和密鑰
- OKX API 金鑰、密鑰和 Passphrase
- 資料庫連線資訊
- Redis 連線資訊
- (可選) Telegram Bot Token 和 Chat ID

### 4. 設定資料庫

```bash
# 啟動 PostgreSQL 和 Redis (使用 Docker)
pnpm docker:up

# 執行資料庫遷移
pnpm db:migrate

# 生成 Prisma Client
pnpm db:generate
```

### 5. 啟動應用

```bash
# 開發模式
pnpm dev

# 生產模式
pnpm build
pnpm start
```

## 使用指南

### 快速開始

#### 1. 啟動監控服務
```bash
# 啟動資金費率監控
pnpm tsx src/cli/index.ts monitor start

# 查看監控狀態
pnpm tsx src/cli/index.ts monitor status
```

#### 2. 查看套利機會
```bash
# 列出所有活躍的套利機會
pnpm tsx src/cli/index.ts opportunities list

# 列出所有機會（包含已過期）
pnpm tsx src/cli/index.ts opportunities list --status ALL

# 篩選特定幣別
pnpm tsx src/cli/index.ts opportunities list --symbol BTCUSDT

# 按年化收益率排序，限制顯示 10 筆
pnpm tsx src/cli/index.ts opportunities list --sort-by return --limit 10

# JSON 格式輸出
pnpm tsx src/cli/index.ts opportunities list --format json
```

#### 3. 查看機會詳情
```bash
# 查看特定機會的詳細資訊
pnpm tsx src/cli/index.ts opportunities show <opportunity-id>
```

#### 4. 配置偵測參數
```bash
# 查看當前配置
pnpm tsx src/cli/index.ts opportunities config

# 設定最小費率差異閾值（0.08% = 0.0008）
pnpm tsx src/cli/index.ts opportunities config --threshold 0.0008

# 設定防抖動窗口時間（60 秒）
pnpm tsx src/cli/index.ts opportunities config --debounce 60

# 重置為預設值
pnpm tsx src/cli/index.ts opportunities config --reset

# JSON 格式輸出配置
pnpm tsx src/cli/index.ts opportunities config --format json
```

### CLI 命令完整列表

#### 監控管理
```bash
pnpm tsx src/cli/index.ts monitor start       # 啟動監控服務
pnpm tsx src/cli/index.ts monitor status      # 查看監控狀態
pnpm tsx src/cli/index.ts monitor stop        # 停止監控服務
```

#### 套利機會管理
```bash
# 列出機會
pnpm tsx src/cli/index.ts opportunities list [options]
  -s, --status <status>      篩選狀態: ACTIVE | EXPIRED | CLOSED (預設: ACTIVE)
  --symbol <symbol>          篩選特定幣別
  --min-return <percent>     最小年化收益率
  -l, --limit <number>       限制顯示數量 (預設: 20)
  --format <type>            輸出格式: table | json (預設: table)
  --sort-by <field>          排序方式: return | time | spread (預設: return)

# 查看詳情
pnpm tsx src/cli/index.ts opportunities show <id>

# 配置管理
pnpm tsx src/cli/index.ts opportunities config [options]
  --threshold <value>        設定最小費率差異閾值
  --debounce <seconds>       設定防抖動窗口時間
  --reset                    重置為預設值
  --format <type>            輸出格式: table | json
```

#### 計畫中的指令（Phase 4-7）
```bash
# 查看機會歷史（Phase 5）
pnpm tsx src/cli/index.ts opportunities history [options]

# 查看當前持倉
pnpm tsx src/cli/index.ts positions list

# 查看交易歷史
pnpm tsx src/cli/index.ts trades list
```

### 配置說明

主要配置檔案位於 `config/default.json`，您可以調整以下參數：

- **交易參數**
  - `minSpreadThreshold`: 最小價差門檻
  - `maxPositionSizeUsd`: 最大持倉金額
  - `defaultLeverage`: 預設槓桿倍數

- **風險管理**
  - `maxDailyLoss`: 每日最大虧損
  - `maxDrawdown`: 最大回撤比例
  - `stopLossPercent`: 止損百分比

- **監控設定**
  - `priceUpdateIntervalMs`: 價格更新頻率
  - `fundingRateCheckIntervalMs`: 資金費率檢查頻率

## 開發指南

### 專案結構

```
src/
├── models/        # 資料模型 (Prisma + 業務邏輯)
├── services/      # 核心業務邏輯
├── connectors/    # 交易所 API 適配器
├── cli/           # 命令列介面
└── lib/           # 工具函式 (logger, config, retry)

tests/
├── unit/          # 單元測試
├── integration/   # 整合測試
└── mocks/         # API 模擬

config/            # 配置檔案
prisma/            # 資料庫 schema 和遷移
```

### 開發命令

```bash
# 執行測試
pnpm test

# 執行測試並監聽變更
pnpm test:watch

# 測試覆蓋率報告
pnpm test:coverage

# 程式碼檢查
pnpm lint

# 自動修復程式碼風格
pnpm lint:fix

# 格式化程式碼
pnpm format

# 檢查格式
pnpm format:check
```

### 資料庫管理

```bash
# 開啟 Prisma Studio
pnpm db:studio

# 執行種子資料
pnpm db:seed

# 重置資料庫
pnpm db:reset
```

## 測試

```bash
# 執行所有測試
pnpm test

# 執行測試並顯示 UI
pnpm test:ui

# 生成覆蓋率報告
pnpm test:coverage
```

## Docker 支援

```bash
# 啟動所有服務
pnpm docker:up

# 停止所有服務
pnpm docker:down

# 查看日誌
pnpm docker:logs
```

## 安全性注意事項

⚠️ **重要**:

1. 不要將 `.env` 檔案提交到版本控制系統
2. 確保 API 金鑰具有適當的權限（僅需交易和查詢權限）
3. 在測試網上進行充分測試後再使用真實資金
4. 定期檢查和更新依賴套件
5. 設定合理的風險參數以保護您的資金

## 授權

MIT License

## 貢獻

歡迎提交 Issue 和 Pull Request！

## 專案文件

- **CHANGELOG.md** - 版本歷史與變更記錄
- **specs/001-funding-rate-arbitrage/spec.md** - 功能規格說明
- **specs/001-funding-rate-arbitrage/plan.md** - 技術實作計畫
- **specs/001-funding-rate-arbitrage/tasks.md** - 開發任務清單
- **.specify/memory/constitution.md** - 專案憲法 (5 個核心原則)

## 參考資源

- [Prisma 文件](https://www.prisma.io/docs)
- [TimescaleDB 文件](https://docs.timescale.com)
- [Binance Futures API](https://binance-docs.github.io/apidocs/futures/en/)
- [CCXT 文件](https://docs.ccxt.com)
- [Pino 日誌](https://getpino.io)

## 免責聲明

本軟體僅供教育和研究用途。使用本軟體進行實際交易需自行承擔風險。作者不對任何財務損失負責。

⚠️ **警告**: 當前版本 (v0.3.0) 僅實作監控和偵測功能，尚未實作自動交易功能。請勿在未充分測試的情況下使用於生產環境。
