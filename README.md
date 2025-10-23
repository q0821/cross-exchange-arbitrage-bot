# Cross-Exchange Arbitrage Bot

跨交易所資金費率套利平台 - 自動偵測幣安和 OKX 的資金費率差異並執行套利交易

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## 🎯 專案狀態

**當前版本**: v0.4.0 (MVP 核心功能 100% 完成)
**最後更新**: 2025-10-23

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

### 🔄 計畫功能 (Phase 4-7)

- 🔜 **Phase 4**: 多幣別機會排序與優先級
- 🔜 **Phase 5**: 機會生命週期追蹤與歷史記錄查詢
- 🔜 **Phase 6**: 多通道通知（Webhook, Telegram）
- 🔜 **Phase 7**: 效能優化、文件、整合測試

## 功能特色

- 🔍 **即時監控**: 每 5 秒更新 Binance 和 OKX 的資金費率
- 📊 **智能偵測**: 自動識別套利機會並計算年化收益率
- 🎨 **彩色輸出**: 終端機彩色顯示不同嚴重性的通知
- 🛡️ **防抖動**: 30 秒窗口防止通知轟炸
- 📈 **歷史記錄**: 完整的機會生命週期追蹤與統計
- ⚡ **高精確度**: 使用 Decimal.js 確保金融計算精確

## 技術架構

- **語言**: TypeScript 5.3+
- **運行環境**: Node.js 20.x LTS
- **數據庫**: PostgreSQL 15+ with TimescaleDB extension
- **ORM**: Prisma 5.x
- **日誌**: Pino (高性能結構化日誌)
- **金融計算**: Decimal.js (精確度保證)
- **CLI 框架**: Commander.js
- **終端機輸出**: Chalk (彩色顯示)

### 交易所整合

- **Binance**: Binance Futures API (直接調用 `/fapi/v1/premiumIndex`)
- **OKX**: `ccxt` v4.x (統一介面)

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
