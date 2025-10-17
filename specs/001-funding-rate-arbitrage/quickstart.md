# 快速開始指南: 跨交易所資金費率套利平台

**文件版本**: 1.0
**最後更新**: 2025-10-17
**適用對象**: 初次使用者、開發者、系統管理員

---

## 目錄

1. [環境需求](#1-環境需求)
2. [安裝步驟](#2-安裝步驟)
3. [設定檔案](#3-設定檔案)
4. [初次執行](#4-初次執行)
5. [基本使用範例](#5-基本使用範例)
6. [常見問題](#6-常見問題)
7. [下一步](#7-下一步)

---

## 1. 環境需求

### 必要軟體版本

| 軟體 | 最低版本 | 建議版本 | 說明 |
|------|----------|----------|------|
| Node.js | 20.0.0 | 20.x LTS | JavaScript 執行環境 |
| PostgreSQL | 15.0 | 15.x | 關聯式資料庫 |
| Redis | 7.0 | 7.x | 快取與訊息佇列 |
| pnpm | 8.0 | 8.x | 套件管理工具 |

### 作業系統需求

- **建議**: Linux (Ubuntu 22.04 LTS 或更新版本)
- **支援**: macOS 12+ (用於開發)
- **支援**: Windows 10/11 (需要 WSL2 環境)

### 硬體建議

- **CPU**: 2 核心以上
- **記憶體**: 4GB 以上
- **儲存空間**: 10GB 以上 (用於資料庫和日誌)
- **網路**: 穩定的網路連線,建議延遲 < 100ms 至交易所

### 交易所帳戶需求

- 已註冊 **幣安 (Binance)** 帳戶並完成 KYC 認證
- 已註冊 **OKX** 帳戶並完成 KYC 認證
- 兩個交易所都需開通永續合約交易功能
- 建議初期在測試網路上進行測試

---

## 2. 安裝步驟

### 2.1 安裝 Node.js

#### Ubuntu/Debian

```bash
# 使用 NodeSource 官方倉庫安裝 Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 驗證安裝
node --version  # 應顯示 v20.x.x
npm --version
```

#### macOS

```bash
# 使用 Homebrew 安裝
brew install node@20

# 驗證安裝
node --version
```

#### Windows (WSL2)

在 WSL2 環境中執行與 Ubuntu 相同的指令。

### 2.2 安裝 pnpm

```bash
# 使用 npm 安裝 pnpm
npm install -g pnpm

# 驗證安裝
pnpm --version  # 應顯示 8.x.x
```

### 2.3 安裝 PostgreSQL

#### Ubuntu/Debian

```bash
# 安裝 PostgreSQL 15
sudo apt-get update
sudo apt-get install -y postgresql-15 postgresql-contrib-15

# 啟動服務
sudo systemctl start postgresql
sudo systemctl enable postgresql

# 驗證安裝
psql --version  # 應顯示 PostgreSQL 15.x
```

#### macOS

```bash
# 使用 Homebrew 安裝
brew install postgresql@15

# 啟動服務
brew services start postgresql@15

# 驗證安裝
psql --version
```

### 2.4 安裝 TimescaleDB 擴展

```bash
# Ubuntu/Debian
sudo sh -c "echo 'deb https://packagecloud.io/timescale/timescaledb/ubuntu/ $(lsb_release -c -s) main' > /etc/apt/sources.list.d/timescaledb.list"
wget --quiet -O - https://packagecloud.io/timescale/timescaledb/gpgkey | sudo apt-key add -
sudo apt-get update
sudo apt-get install -y timescaledb-2-postgresql-15

# macOS
# TimescaleDB 會隨 PostgreSQL 一起安裝,或使用 brew
brew install timescaledb

# 初始化 TimescaleDB
sudo timescaledb-tune --quiet --yes

# 重啟 PostgreSQL
sudo systemctl restart postgresql  # Ubuntu/Debian
brew services restart postgresql@15  # macOS
```

### 2.5 安裝 Redis

#### Ubuntu/Debian

```bash
# 安裝 Redis 7.x
sudo apt-get install -y redis-server

# 啟動服務
sudo systemctl start redis-server
sudo systemctl enable redis-server

# 驗證安裝
redis-cli --version  # 應顯示 redis-cli 7.x.x
redis-cli ping  # 應返回 PONG
```

#### macOS

```bash
# 使用 Homebrew 安裝
brew install redis

# 啟動服務
brew services start redis

# 驗證安裝
redis-cli ping
```

### 2.6 克隆專案並安裝依賴

```bash
# 克隆專案倉庫
git clone https://github.com/your-org/cross-exchange-arbitrage-bot.git
cd cross-exchange-arbitrage-bot

# 安裝依賴套件
pnpm install

# 驗證專案結構
ls -la
# 應該看到: package.json, tsconfig.json, src/, tests/, config/ 等目錄
```

---

## 3. 設定檔案

### 3.1 建立資料庫

```bash
# 連線到 PostgreSQL (預設使用者為 postgres)
sudo -u postgres psql

# 在 psql 提示符中執行以下 SQL
CREATE DATABASE arbitrage_bot;
CREATE USER arbitrage_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE arbitrage_bot TO arbitrage_user;

# 切換到新資料庫並啟用 TimescaleDB 擴展
\c arbitrage_bot
CREATE EXTENSION IF NOT EXISTS timescaledb;

# 退出 psql
\q
```

### 3.2 環境變數設定

複製範例環境變數檔案並填寫必要資訊:

```bash
# 複製範例檔案
cp .env.example .env

# 使用文字編輯器編輯 .env 檔案
nano .env
```

**.env 範例內容**:

```env
# 資料庫連線
DATABASE_URL="postgresql://arbitrage_user:your_secure_password@localhost:5432/arbitrage_bot"

# Redis 連線
REDIS_URL="redis://localhost:6379"

# 幣安 API 金鑰 (生產環境)
BINANCE_API_KEY="your_binance_api_key"
BINANCE_API_SECRET="your_binance_api_secret"

# 幣安測試網路 API 金鑰 (建議初期使用)
BINANCE_TESTNET_API_KEY="your_binance_testnet_api_key"
BINANCE_TESTNET_API_SECRET="your_binance_testnet_api_secret"

# OKX API 金鑰 (生產環境)
OKX_API_KEY="your_okx_api_key"
OKX_API_SECRET="your_okx_api_secret"
OKX_API_PASSPHRASE="your_okx_api_passphrase"

# OKX 模擬交易 API 金鑰 (建議初期使用)
OKX_DEMO_API_KEY="your_okx_demo_api_key"
OKX_DEMO_API_SECRET="your_okx_demo_api_secret"
OKX_DEMO_API_PASSPHRASE="your_okx_demo_api_passphrase"

# 環境設定
NODE_ENV="development"  # 選項: development, production
USE_TESTNET="true"      # 是否使用測試網路

# Telegram 通知 (選填)
TELEGRAM_BOT_TOKEN="your_telegram_bot_token"
TELEGRAM_CHAT_ID="your_telegram_chat_id"

# 日誌設定
LOG_LEVEL="info"  # 選項: error, warn, info, debug
LOG_FILE_PATH="./logs/arbitrage.log"

# 應用程式設定
PORT="3000"
```

### 3.3 取得交易所 API 金鑰

#### 幣安測試網路

1. 訪問 [Binance Testnet](https://testnet.binancefuture.com/)
2. 使用 GitHub 或 Google 帳號登入
3. 進入 "API Key" 頁面
4. 點擊 "Generate HMAC_SHA256 Key"
5. 複製 API Key 和 Secret Key 到 `.env` 檔案
6. **權限設定**: 確保啟用 "Enable Trading" (交易) 權限

#### OKX 模擬交易

1. 訪問 [OKX Demo Trading](https://www.okx.com/demo-trading)
2. 登入你的 OKX 帳號
3. 進入 "API" 設定頁面
4. 建立新的 API Key,選擇 "Demo Trading"
5. 設定 API Passphrase (請妥善保存)
6. 複製 API Key、Secret Key 和 Passphrase 到 `.env` 檔案
7. **權限設定**: 啟用 "Trade" 權限,但不要啟用 "Withdraw" (提現) 權限

**安全注意事項**:

- ❌ **絕對不要**將 API 金鑰提交到 Git 倉庫
- ✅ 確保 `.env` 檔案已加入 `.gitignore`
- ✅ 生產環境使用時,設定 API 金鑰的 IP 白名單
- ✅ 生產環境的 API 金鑰不要授予提現 (Withdraw) 權限

### 3.4 設定檔範例

**config.yaml** (選用,用於覆蓋預設配置):

```yaml
# 監控設定
monitor:
  # 監控的幣別清單
  symbols:
    - BTC
    - ETH
    - SOL

  # 資金費率更新頻率 (秒)
  updateInterval: 5

  # WebSocket 重連設定
  reconnect:
    maxRetries: 5
    retryDelay: 3000  # 毫秒

# 套利偵測設定
detector:
  # 套利閾值: 資金費率差異需大於此值才觸發 (百分比)
  threshold: 0.05

  # 最小預期收益率 (百分比,扣除手續費後)
  minProfitRate: 0.02

  # 套利機會過期時間 (秒)
  opportunityExpiry: 60

# 交易執行設定
executor:
  # 是否啟用自動交易
  autoTrade: false

  # 訂單執行超時時間 (秒)
  orderTimeout: 10

  # 雙邊開倉失敗時的補償策略
  compensationStrategy: "immediate"  # 選項: immediate, delayed, manual

  # 滑價容忍度 (百分比)
  slippageTolerance: 0.1

# 風險管理設定
risk:
  # 單次交易最大金額 (USDT)
  maxTradeAmount: 10000

  # 總倉位上限 (USDT)
  maxTotalPosition: 50000

  # 固定比例倉位管理 (佔總資金的百分比)
  fixedFraction: 0.03  # 3%

  # 止損閾值: 資金費率反轉超過此值時平倉 (百分比)
  stopLossThreshold: 0.1

  # 時間止損: 持倉超過此時間自動平倉 (小時)
  timeStopLoss: 24

# 通知設定
notification:
  # 通知方式
  channels:
    - telegram
    - log

  # 通知事件
  events:
    - opportunity_detected
    - trade_executed
    - trade_failed
    - position_closed
    - risk_alert
```

---

## 4. 初次執行

### 4.1 資料庫遷移

執行資料庫 schema 初始化:

```bash
# 使用 Prisma 進行資料庫遷移
pnpm prisma migrate dev --name init

# 驗證資料表建立
pnpm prisma studio
# 這會開啟一個網頁介面 (http://localhost:5555) 供你檢視資料庫結構
```

**預期結果**:

- 資料表建立成功: `funding_rates`, `arbitrage_opportunities`, `hedge_positions`, `trade_records`, `arbitrage_cycles`, `risk_parameters`
- TimescaleDB hypertables 已建立於 `funding_rates` 和 `trade_records`

### 4.2 測試 API 連線

執行連線測試腳本,驗證 API 金鑰是否正確設定:

```bash
# 測試交易所 API 連線
pnpm run test:connection

# 預期輸出範例
# ✅ Binance Testnet 連線成功
# ✅ Binance 帳戶資訊: Balance: 100000 USDT
# ✅ OKX Demo 連線成功
# ✅ OKX 帳戶資訊: Balance: 100000 USDT
```

**常見錯誤**:

- `API key invalid`: 請檢查 `.env` 中的 API Key 是否正確複製
- `Signature verification failed`: API Secret 或 Passphrase 錯誤
- `IP not whitelisted`: 如果設定了 IP 白名單,請確認當前 IP 已加入

### 4.3 啟動監控服務

啟動資金費率監控服務 (不執行交易,僅觀察):

```bash
# 啟動監控服務
pnpm run start:monitor

# 預期輸出範例
# [2025-10-17 10:00:00] INFO  Connecting to Binance WebSocket...
# [2025-10-17 10:00:01] INFO  Connecting to OKX WebSocket...
# [2025-10-17 10:00:02] INFO  ✅ Monitoring started for BTC, ETH, SOL
# [2025-10-17 10:00:07] INFO  BTC Funding Rate - Binance: 0.0100%, OKX: 0.0150%, Diff: 0.0050%
# [2025-10-17 10:00:07] INFO  ETH Funding Rate - Binance: 0.0080%, OKX: 0.0120%, Diff: 0.0040%
# [2025-10-17 10:00:07] INFO  SOL Funding Rate - Binance: 0.0200%, OKX: 0.0180%, Diff: -0.0020%
```

讓監控服務運行幾分鐘,觀察資金費率數據是否正常更新。使用 `Ctrl + C` 停止服務。

### 4.4 查看第一個套利機會

如果監控服務發現符合閾值的套利機會,會顯示通知:

```bash
# 預期輸出範例 (當費率差異 > 0.05%)
# [2025-10-17 10:05:00] INFO  🎯 套利機會偵測!
# [2025-10-17 10:05:00] INFO  幣別: BTC
# [2025-10-17 10:05:00] INFO  Binance 費率: 0.0100%
# [2025-10-17 10:05:00] INFO  OKX 費率: 0.0700%
# [2025-10-17 10:05:00] INFO  費率差異: 0.0600% (超過閾值 0.0500%)
# [2025-10-17 10:05:00] INFO  預期收益率: 0.0400% (扣除手續費)
# [2025-10-17 10:05:00] INFO  建議操作: Binance 做多, OKX 做空
```

你也可以查詢資料庫中儲存的套利機會:

```bash
# 使用 CLI 查詢套利機會
pnpm run cli opportunities --status active

# 或直接查詢資料庫
psql $DATABASE_URL -c "SELECT * FROM arbitrage_opportunities WHERE status = 'pending' ORDER BY created_at DESC LIMIT 5;"
```

---

## 5. 基本使用範例

### 5.1 啟動/停止監控

```bash
# 啟動監控服務 (前台運行)
pnpm run start:monitor

# 啟動監控服務 (背景運行,使用 PM2)
pnpm run pm2:start

# 查看運行狀態
pnpm run pm2:status

# 停止服務
pnpm run pm2:stop

# 查看日誌
pnpm run pm2:logs
```

### 5.2 查詢套利機會

```bash
# 查詢所有待執行的套利機會
pnpm run cli opportunities --status pending

# 查詢特定幣別的套利機會
pnpm run cli opportunities --symbol BTC

# 查詢今天的套利機會統計
pnpm run cli opportunities --date today --summary
```

**輸出範例**:

```
╔════════════════════════════════════════════════════════════════════╗
║                    套利機會清單 (待執行)                           ║
╠════════════════════════════════════════════════════════════════════╣
║ ID   │ 幣別 │ Binance 費率 │ OKX 費率 │ 差異   │ 預期收益 │ 時間   ║
╠════════════════════════════════════════════════════════════════════╣
║ 1234 │ BTC  │ 0.0100%      │ 0.0700%  │ 0.060% │ 0.040%   │ 10:05 ║
║ 1235 │ ETH  │ 0.0150%      │ 0.0800%  │ 0.065% │ 0.045%   │ 10:08 ║
╚════════════════════════════════════════════════════════════════════╝
```

### 5.3 執行套利交易

**⚠️ 警告**: 首次執行前,請確保你了解永續合約交易的風險,並在測試網路上充分測試。

```bash
# 手動執行指定的套利機會
pnpm run cli execute --opportunity-id 1234

# 執行時會顯示確認訊息
# 套利機會詳情:
#   幣別: BTC
#   Binance 費率: 0.0100%, OKX 費率: 0.0700%
#   費率差異: 0.0600%
#   預期收益率: 0.0400%
#   建議操作: Binance 做多 1.5 BTC, OKX 做空 1.5 BTC
#   預估保證金: 10000 USDT (每邊 5000 USDT)
#
# 是否確認執行? (yes/no):
```

輸入 `yes` 確認後,系統會執行雙邊開倉:

```
# [10:10:00] INFO  開始執行套利交易 (Opportunity ID: 1234)
# [10:10:01] INFO  正在向 Binance 發送做多訂單...
# [10:10:01] INFO  正在向 OKX 發送做空訂單...
# [10:10:02] INFO  ✅ Binance 訂單成功 (Order ID: BN123456)
# [10:10:02] INFO  ✅ OKX 訂單成功 (Order ID: OKX789012)
# [10:10:02] INFO  雙邊開倉完成!
# [10:10:02] INFO  對沖部位已建立 (Hedge Position ID: HP001)
```

**啟用自動交易** (謹慎使用):

編輯 `config.yaml` 或設定環境變數:

```yaml
executor:
  autoTrade: true  # 啟用自動交易
```

然後重新啟動監控服務:

```bash
pnpm run pm2:restart
```

系統會自動偵測套利機會並執行交易。

### 5.4 查看持倉

```bash
# 查看所有持倉中的對沖部位
pnpm run cli positions --status open

# 查看特定幣別的持倉
pnpm run cli positions --symbol BTC

# 查看持倉的詳細資訊
pnpm run cli positions --id HP001 --detail
```

**輸出範例**:

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                          持倉中的對沖部位                                  ║
╠═══════════════════════════════════════════════════════════════════════════╣
║ ID    │ 幣別 │ 開倉時間 │ Binance 部位 │ OKX 部位   │ 未實現盈虧 │ 狀態 ║
╠═══════════════════════════════════════════════════════════════════════════╣
║ HP001 │ BTC  │ 10:10    │ 做多 1.5 BTC │ 做空 1.5 BTC │ +120 USDT  │ 持倉中 ║
║ HP002 │ ETH  │ 10:15    │ 做多 10 ETH  │ 做空 10 ETH  │ +85 USDT   │ 持倉中 ║
╚═══════════════════════════════════════════════════════════════════════════╝

總保證金使用: 15000 / 50000 USDT (30%)
總未實現盈虧: +205 USDT
```

### 5.5 手動平倉

```bash
# 平倉指定的對沖部位
pnpm run cli close --position-id HP001

# 確認訊息
# 對沖部位詳情:
#   幣別: BTC
#   Binance 部位: 做多 1.5 BTC
#   OKX 部位: 做空 1.5 BTC
#   未實現盈虧: +120 USDT
#
# 是否確認平倉? (yes/no):
```

輸入 `yes` 確認後:

```
# [10:30:00] INFO  開始平倉對沖部位 (HP001)
# [10:30:01] INFO  正在向 Binance 發送平多單...
# [10:30:01] INFO  正在向 OKX 發送平空單...
# [10:30:02] INFO  ✅ Binance 平倉成功
# [10:30:02] INFO  ✅ OKX 平倉成功
# [10:30:02] INFO  平倉完成!
# [10:30:02] INFO  實際收益: +118.50 USDT (扣除手續費)
```

---

## 6. 常見問題

### 6.1 API 連線失敗

**問題**: 執行 `pnpm run test:connection` 時顯示連線失敗

**可能原因與解決方案**:

1. **API Key 錯誤**
   - 檢查 `.env` 檔案中的 API Key 和 Secret 是否正確
   - 確認沒有多餘的空格或換行符號
   - 重新產生 API Key 並更新 `.env`

2. **權限不足**
   - 確認 API Key 已啟用 "Enable Trading" 權限
   - 生產環境確認已啟用 "Enable Futures" 權限

3. **IP 白名單限制**
   - 如果設定了 IP 白名單,確認當前伺服器 IP 已加入
   - 或暫時移除 IP 白名單限制 (僅限測試)

4. **網路問題**
   - 檢查伺服器是否能夠存取交易所 API 端點
   ```bash
   curl -I https://testnet.binancefuture.com
   curl -I https://www.okx.com
   ```

### 6.2 資料庫連線問題

**問題**: 應用程式無法連線到 PostgreSQL

**可能原因與解決方案**:

1. **PostgreSQL 服務未啟動**
   ```bash
   # Ubuntu/Debian
   sudo systemctl status postgresql
   sudo systemctl start postgresql

   # macOS
   brew services list
   brew services start postgresql@15
   ```

2. **DATABASE_URL 設定錯誤**
   - 檢查 `.env` 中的 `DATABASE_URL` 格式
   - 格式: `postgresql://使用者名稱:密碼@主機:埠/資料庫名稱`
   - 確認密碼中的特殊字元已經 URL 編碼

3. **資料庫或使用者不存在**
   ```bash
   # 連線到 PostgreSQL 並驗證
   sudo -u postgres psql
   \l  # 列出所有資料庫
   \du # 列出所有使用者
   ```

4. **權限問題**
   ```sql
   -- 重新授予權限
   GRANT ALL PRIVILEGES ON DATABASE arbitrage_bot TO arbitrage_user;
   ```

### 6.3 WebSocket 連線不穩定

**問題**: 監控服務頻繁斷線重連

**可能原因與解決方案**:

1. **網路不穩定**
   - 檢查網路連線品質
   - 使用 `ping` 測試到交易所的延遲
   ```bash
   ping -c 10 testnet.binancefuture.com
   ```

2. **交易所限流**
   - 檢查是否訂閱過多的 WebSocket 頻道
   - 減少 `config.yaml` 中的 `symbols` 數量
   - 增加 `reconnect.retryDelay` 延遲時間

3. **防火牆或代理問題**
   - 確認防火牆允許 WebSocket 連線 (通常使用 443 埠)
   - 如果使用代理,確認代理支援 WebSocket

### 6.4 訂單執行失敗

**問題**: 執行套利交易時,訂單被交易所拒絕

**可能原因與解決方案**:

1. **餘額不足**
   ```bash
   # 檢查帳戶餘額
   pnpm run cli balance
   ```
   - 測試網路帳戶可能需要手動充值測試幣
   - 幣安測試網路: 使用網頁介面的 "Get Test Funds" 功能
   - OKX 模擬交易: 帳戶會自動配發虛擬資金

2. **訂單金額過小或過大**
   - 檢查交易所的最小訂單金額限制
   - 調整 `config.yaml` 中的 `risk.maxTradeAmount`

3. **市場流動性不足**
   - 測試網路的流動性通常較差
   - 嘗試使用主流幣別 (BTC, ETH)
   - 減少訂單金額

4. **API 限流**
   - 短時間內發送過多請求
   - 增加 `executor.orderTimeout` 時間
   - 實作請求速率限制

### 6.5 TimescaleDB 擴展未啟用

**問題**: 資料庫遷移時顯示 TimescaleDB 擴展錯誤

**解決方案**:

```bash
# 連線到資料庫
psql $DATABASE_URL

# 手動啟用 TimescaleDB 擴展
CREATE EXTENSION IF NOT EXISTS timescaledb;

# 驗證擴展已安裝
\dx

# 應該會看到 timescaledb 出現在清單中
```

如果 `CREATE EXTENSION` 失敗:

```bash
# 重新安裝 TimescaleDB
sudo apt-get install --reinstall timescaledb-2-postgresql-15

# 重新執行 timescaledb-tune
sudo timescaledb-tune --quiet --yes

# 重啟 PostgreSQL
sudo systemctl restart postgresql
```

---

## 7. 下一步

恭喜你完成基本設定!以下是建議的後續步驟:

### 7.1 進階設定

- **調整套利閾值**: 根據市場狀況調整 `detector.threshold` 和 `detector.minProfitRate`
- **設定 Telegram 通知**: 填寫 `TELEGRAM_BOT_TOKEN` 和 `TELEGRAM_CHAT_ID`,接收即時通知
- **配置監控儀表板**: 設定 Prometheus + Grafana 進行系統監控

### 7.2 風險參數調整

編輯 `config.yaml` 中的 `risk` 區塊:

```yaml
risk:
  # 根據你的風險承受能力調整
  maxTradeAmount: 5000      # 初期建議使用較小金額
  maxTotalPosition: 20000   # 限制總倉位
  fixedFraction: 0.02       # 保守型使用 2%
  stopLossThreshold: 0.08   # 設定止損閾值
  timeStopLoss: 16          # 16 小時後自動平倉
```

### 7.3 監控和告警設定

設定系統健康監控:

```bash
# 啟動 Prometheus 和 Grafana (需要先安裝)
docker-compose -f docker/monitoring.yml up -d

# 匯入預設的 Grafana 儀表板
pnpm run setup:grafana
```

訪問 Grafana 介面 (預設 http://localhost:3001),監控:

- API 連線狀態
- 套利機會偵測數量
- 交易成功率
- 雙邊開倉延遲
- 資料庫查詢效能

### 7.4 測試完成後切換到生產環境

**⚠️ 重要警告**: 切換到生產環境前,請確保:

1. ✅ 已在測試網路上運行至少 1 週,驗證系統穩定性
2. ✅ 已充分理解永續合約和資金費率套利的風險
3. ✅ 已設定適當的風險參數和止損策略
4. ✅ 已備份所有設定檔和資料庫
5. ✅ 生產環境 API Key 已設定 IP 白名單
6. ✅ 生產環境 API Key 已禁用提現權限

切換步驟:

```bash
# 修改 .env 檔案
USE_TESTNET="false"

# 更新 API 金鑰為生產環境的金鑰
BINANCE_API_KEY="生產環境金鑰"
BINANCE_API_SECRET="生產環境密鑰"
OKX_API_KEY="生產環境金鑰"
OKX_API_SECRET="生產環境密鑰"
OKX_API_PASSPHRASE="生產環境密碼"

# 建議初期保持 autoTrade: false,手動驗證機會後再啟用
```

### 7.5 學習資源

- **交易所 API 文件**:
  - [Binance Futures API](https://binance-docs.github.io/apidocs/futures/en/)
  - [OKX Perpetual Swap API](https://www.okx.com/docs-v5/en/)

- **資金費率套利原理**:
  - 閱讀 `docs/funding-rate-arbitrage-explained.md`
  - 觀看相關教學影片

- **風險管理最佳實踐**:
  - 閱讀 `specs/001-funding-rate-arbitrage/research.md` 中的風險管理章節

### 7.6 尋求協助

如果遇到問題:

1. 查看日誌檔案: `tail -f logs/arbitrage.log`
2. 查看 GitHub Issues: [專案 Issues 頁面]
3. 加入社群討論: [Discord 或 Telegram 群組]
4. 閱讀完整文件: `docs/` 目錄

---

**祝你套利順利!記得始終控制風險,不要投入超過你能承受損失的資金。**

