# Cross-Exchange Arbitrage Bot

跨交易所資金費率套利平台 - 自動偵測幣安和 OKX 的資金費率差異並執行套利交易

## 功能特色

- 🔍 即時監控 Binance 和 OKX 的資金費率差異
- 📊 自動識別套利機會並計算預期收益
- ⚡ 快速執行對沖交易（目標 < 2 秒）
- 🛡️ 完整的風險管理機制
- 📱 Telegram 通知整合
- 📈 交易歷史記錄與績效分析

## 技術架構

- **語言**: TypeScript 5.3+
- **運行環境**: Node.js 20.x LTS
- **數據庫**: PostgreSQL 15+ with TimescaleDB extension
- **快取**: Redis 7.x
- **ORM**: Prisma 5.x
- **測試**: Vitest with 85%+ coverage target
- **日誌**: Pino (高性能結構化日誌)

### 交易所整合

- **Binance**: `@binance/connector` v3.x (官方 SDK)
- **OKX**: `ccxt` v4.x (統一介面)

## 系統需求

- Node.js >= 20.0.0
- pnpm >= 8.0.0
- PostgreSQL >= 15.0
- Redis >= 7.0

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

### CLI 命令

```bash
# 啟動套利機器人
pnpm cli start

# 查看即時套利機會
pnpm cli opportunities

# 查看當前持倉
pnpm cli positions

# 查看交易歷史
pnpm cli history

# 查看系統狀態
pnpm cli status
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

## 免責聲明

本軟體僅供教育和研究用途。使用本軟體進行實際交易需自行承擔風險。作者不對任何財務損失負責。
