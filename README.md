# Cross-Exchange Arbitrage Bot

跨交易所資金費率套利平台 - 自動偵測多交易所資金費率差異並支援套利交易

[![CI](https://github.com/q0821/cross-exchange-arbitrage-bot/actions/workflows/ci.yml/badge.svg)](https://github.com/q0821/cross-exchange-arbitrage-bot/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)](https://nextjs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## 專案狀態

**當前版本**: v1.0.0 (Web 多用戶平台 + 完整交易功能)
**最後更新**: 2026-01-21

### 已完成功能

#### 核心交易功能

| 功能 | 說明 | 狀態 |
|------|------|------|
| 手動開倉 | Saga Pattern 雙邊開倉協調器 | ✅ 完成 |
| 手動平倉 | 一鍵平倉 + PnL 計算 | ✅ 完成 |
| 分單開倉 | 大組優先分配算法 (1-10 組) | ✅ 完成 |
| 停損停利 | 四交易所條件單適配器 | ✅ 完成 |
| 觸發偵測 | 自動偵測停損停利觸發 + 平倉 | ✅ 完成 |

#### 市場監控

| 功能 | 說明 | 狀態 |
|------|------|------|
| 資金費率監控 | 5 交易所即時費率顯示 | ✅ 完成 |
| 套利機會偵測 | 自動計算最佳套利對 | ✅ 完成 |
| WebSocket 即時更新 | markPrice、fundingRate 訂閱 | ✅ 完成 |
| 套利機會追蹤 | 機會生命週期記錄 (Feature 065) | ✅ 完成 |
| 平倉建議監控 | APY 監控 + 智能平倉建議 (Feature 067) | ✅ 完成 |

#### 用戶系統

| 功能 | 說明 | 狀態 |
|------|------|------|
| 用戶認證 | Email/Password + JWT Token | ✅ 完成 |
| API Key 管理 | 5 交易所 + AES-256-GCM 加密 | ✅ 完成 |
| 通知系統 | Discord/Slack Webhook | ✅ 完成 |
| 公開首頁 | 套利機會歷史展示 (Feature 064) | ✅ 完成 |

#### 支援交易所

| 交易所 | 費率監控 | 開倉 | 平倉 | 停損停利 |
|--------|----------|------|------|----------|
| Binance | ✅ | ✅ | ✅ | ✅ |
| OKX | ✅ | ✅ | ✅ | ✅ |
| Gate.io | ✅ | ✅ | ✅ | ✅ |
| MEXC | ✅ | ✅ | ✅ | ✅ |
| BingX | ✅ | ✅ | ✅ | ✅ |

## 功能特色

### Web 多用戶平台
- 👤 **多用戶系統**: Email/Password 註冊登入 + JWT Token 認證
- 🔐 **API Key 管理**: 支援 5 個交易所，AES-256-GCM 加密儲存
- 🌐 **環境隔離**: 主網/測試網環境分離管理
- 📊 **即時更新**: WebSocket 推送套利機會和市場數據
- 🗺️ **市場全景**: 5 個交易所資金費率一覽表
- 🎯 **智能標示**: 自動計算並標示最佳套利對（BUY/SELL 標籤）
- 📈 **收益分析**: 年化收益率、淨利潤率即時計算
- 🔗 **快速跳轉**: 一鍵開啟交易所對應交易對頁面

### 交易功能
- 💹 **雙邊開倉**: Saga Pattern 協調器，支援回滾機制
- 📉 **一鍵平倉**: 雙邊市價平倉 + PnL 計算
- 🔢 **分單開倉**: 將大單拆分為 1-10 個獨立持倉
- 🛡️ **停損停利**: 四交易所條件單自動設定
- ⚡ **觸發偵測**: 每 30 秒輪詢條件單狀態，自動平倉

### 智能監控
- 🔍 **平倉建議**: 當 APY < 0% 或滿足獲利鎖定條件時通知
- 📊 **機會追蹤**: 記錄套利機會生命週期和統計
- 🔔 **即時通知**: Discord/Slack Webhook 推送
- 📱 **WebSocket 推送**: 持倉進度、觸發事件即時更新

### 公開展示
- 🏠 **公開首頁**: 無需登入查看歷史套利機會
- 📅 **時間篩選**: 7/30/90 天範圍選擇
- 📊 **統計展示**: 持續時間、最大 APY、費差變化

## 技術架構

### 前端
| 技術 | 版本 | 用途 |
|------|------|------|
| Next.js | 15 | App Router 框架 |
| React | 19 | UI 函式庫 |
| TypeScript | 5.8+ | 型別安全 |
| Tailwind CSS | 4.x | 樣式框架 |
| TanStack Query | 5.x | 資料快取 |
| Socket.io Client | 4.8+ | WebSocket 客戶端 |
| Radix UI | - | 無障礙元件庫 |

### 後端
| 技術 | 版本 | 用途 |
|------|------|------|
| Node.js | 20.x LTS | 運行環境 |
| Prisma | 7.x | ORM |
| PostgreSQL | 15+ | 主資料庫 |
| TimescaleDB | - | 時序資料擴展 |
| Socket.io | 4.8+ | WebSocket 伺服器 |
| Pino | 10.x | 結構化日誌 |
| Decimal.js | 10.x | 金融精確計算 |

### 交易所整合
| 交易所 | 整合方式 | 特殊說明 |
|--------|----------|----------|
| Binance | CCXT 4.x + Native API | Futures API 直接調用 |
| OKX | CCXT 4.x + Native API | 雙重驗證機制 |
| Gate.io | CCXT 4.x | 需 API Key 獲取公開數據 |
| MEXC | CCXT 4.x | 標準整合 |
| BingX | CCXT 4.x | 標準整合 |

## 系統需求

- Node.js >= 20.0.0
- pnpm >= 8.0.0
- PostgreSQL >= 15.0 (含 TimescaleDB extension)
- Docker (可選，用於本地開發環境)

## 快速開始

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

```bash
cp .env.example .env
```

編輯 `.env` 檔案，填入：
- 資料庫連線資訊
- JWT 密鑰
- 加密金鑰
- (可選) 交易所 API 金鑰

### 4. 設定資料庫

```bash
# 啟動 PostgreSQL (使用 Docker)
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

# 開發模式（美化日誌）
pnpm dev:pretty

# 生產模式
pnpm build
pnpm start
```

## 開發指令

### 開發
```bash
pnpm dev              # 啟動開發伺服器
pnpm dev:pretty       # 啟動開發伺服器（美化日誌）
pnpm build            # 建置生產版本
```

### 測試
```bash
pnpm test             # 執行所有測試
pnpm test:unit        # 執行單元測試
pnpm test:integration # 執行整合測試
pnpm test:e2e         # 執行 E2E 測試
pnpm test:coverage    # 產生覆蓋率報告
```

### 資料庫
```bash
pnpm docker:up        # 啟動 PostgreSQL + Redis
pnpm db:migrate       # 執行資料庫遷移
pnpm db:generate      # 產生 Prisma Client
pnpm db:studio        # 開啟 Prisma Studio
```

### 診斷工具
```bash
# 測試交易所 API 連線
pnpm tsx scripts/diagnostics/test-binance-api.ts
pnpm tsx scripts/diagnostics/test-gateio-api.ts
pnpm tsx scripts/diagnostics/test-mexc-api.ts
pnpm tsx scripts/diagnostics/test-okx-position.ts
```

### 其他工具
```bash
pnpm update-oi-symbols    # 更新 OI 監控清單
pnpm validate-trading     # 驗證交易設定
pnpm lint                 # ESLint 檢查
pnpm format               # Prettier 格式化
```

## 專案結構

```
├── app/                      # Next.js App Router
│   ├── (auth)/               # 認證頁面 (登入/註冊)
│   ├── (dashboard)/          # 儀表板頁面
│   │   ├── market-monitor/   # 市場監控
│   │   ├── positions/        # 持倉管理
│   │   ├── trades/           # 交易歷史
│   │   ├── assets/           # 資產總覽
│   │   └── settings/         # 設定頁面
│   ├── (public)/             # 公開頁面
│   └── api/                  # API 路由
├── src/
│   ├── connectors/           # 交易所連接器
│   ├── services/             # 核心業務邏輯
│   │   ├── trading/          # 交易服務
│   │   ├── monitor/          # 監控服務
│   │   ├── websocket/        # WebSocket 處理
│   │   └── notification/     # 通知服務
│   ├── repositories/         # 資料存取層
│   ├── models/               # 資料模型
│   ├── lib/                  # 工具函式
│   └── types/                # 型別定義
├── tests/
│   ├── unit/                 # 單元測試 (~1900 案例)
│   ├── integration/          # 整合測試 (~120 案例)
│   ├── hooks/                # React Hooks 測試
│   ├── e2e/                  # E2E 測試 (~23 案例)
│   └── performance/          # 效能測試
├── prisma/                   # 資料庫 Schema 和遷移
├── config/                   # 配置檔案
└── docs/                     # 文件
    ├── deployment/           # 部署指南
    └── test/                 # 測試報告
```

## 核心檔案說明

### 交易服務
| 檔案 | 說明 |
|------|------|
| `src/services/trading/PositionOrchestrator.ts` | Saga Pattern 雙邊開倉協調器 |
| `src/services/trading/PositionCloser.ts` | 雙邊平倉服務 |
| `src/services/trading/ConditionalOrderService.ts` | 停損停利統一管理 |
| `src/services/trading/BalanceValidator.ts` | 保證金驗證 |

### 監控服務
| 檔案 | 說明 |
|------|------|
| `src/services/MonitorService.ts` | 監控服務主入口 |
| `src/services/monitor/FundingRateMonitor.ts` | 資金費率監控 |
| `src/services/monitor/ConditionalOrderMonitor.ts` | 條件單觸發監控 |
| `src/services/monitor/PositionExitMonitor.ts` | 平倉建議監控 |
| `src/services/monitor/ArbitrageOpportunityTracker.ts` | 套利機會追蹤 |

### WebSocket
| 檔案 | 說明 |
|------|------|
| `src/services/websocket/PositionProgressEmitter.ts` | 開倉進度推送 |
| `src/services/websocket/TriggerProgressEmitter.ts` | 觸發事件推送 |
| `src/services/websocket/PositionExitEmitter.ts` | 平倉建議推送 |
| `src/services/websocket/BalanceUpdateEmitter.ts` | 餘額更新推送 |

## 環境變數

詳細說明請參考 `.env.example` 和 `docs/deployment/environment-variables.md`

### 核心設定
| 變數 | 說明 |
|------|------|
| `DATABASE_URL` | PostgreSQL 連線字串 |
| `JWT_SECRET` | JWT 簽名密鑰 |
| `ENCRYPTION_KEY` | API Key 加密金鑰 |

### 功能開關
| 變數 | 說明 |
|------|------|
| `ENABLE_CONDITIONAL_ORDER_MONITOR` | 啟用條件單監控 |
| `ENABLE_POSITION_EXIT_MONITOR` | 啟用平倉建議監控 |

## 部署

### 推薦平台

| 平台 | 難度 | 成本 | 特色 |
|------|------|------|------|
| [Zeabur](docs/deployment/README.md#zeabur-部署) | ⭐ 簡單 | $5-20/月 | 中文介面、自動部署 |
| [Railway](docs/deployment/railway-guide.md) | ⭐⭐ 中等 | $5-15/月 | $5 免費額度 |
| [VPS 自建](docs/deployment/upgrade-to-timescaledb.md) | ⭐⭐⭐ 較難 | $5-20/月 | 完整控制 |

詳細部署指南請參考 `docs/deployment/README.md`

## 測試

### 測試統計
- **單元測試**: ~1,900 案例
- **整合測試**: ~120 案例
- **E2E 測試**: ~23 案例
- **效能測試**: ~11 案例

### CI/CD
| 工作流程 | 觸發條件 | 內容 |
|----------|----------|------|
| `ci.yml` | 每次 push/PR | Lint + 型別檢查 + 單元測試 |
| `integration.yml` | push to main | 整合測試 |
| `e2e.yml` | push to main | Playwright E2E 測試 |

## 安全性注意事項

1. **不要**將 `.env` 檔案提交到版本控制系統
2. 確保 API 金鑰僅具有必要權限
3. 在測試網上充分測試後再使用真實資金
4. 定期檢查和更新依賴套件
5. 設定合理的風險參數

## 專案文件

- `CHANGELOG.md` - 版本歷史與變更記錄
- `CLAUDE.md` - 開發指南與程式碼規範
- `.specify/memory/constitution.md` - 專案憲法 (7 個核心原則)
- `docs/deployment/` - 部署相關文件
- `docs/test/` - 測試報告

## 授權

MIT License

## 貢獻

歡迎提交 Issue 和 Pull Request！

## 免責聲明

本軟體僅供教育和研究用途。使用本軟體進行實際交易需自行承擔風險。作者不對任何財務損失負責。

⚠️ **警告**: 加密貨幣交易具有高風險。請確保您了解相關風險，並只投入您能承受損失的資金。
