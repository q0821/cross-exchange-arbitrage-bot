# 環境變數完整說明

> 📝 本文件詳細說明所有環境變數的用途、格式和配置建議

## 📋 目錄

- [必填環境變數](#必填環境變數)
- [選填環境變數](#選填環境變數)
- [安全性建議](#安全性建議)
- [環境差異](#環境差異)

---

## 🔴 必填環境變數

### 應用程式基本配置

#### `NODE_ENV`
- **用途**: 指定執行環境
- **選項**: `development` | `production`
- **建議值**:
  - 本地開發: `development`
  - 生產環境: `production`
- **範例**: `NODE_ENV=production`

#### `PORT`
- **用途**: 應用程式監聽的埠號
- **預設值**: `3000`
- **注意**: Zeabur/Railway 會自動設定，通常不需要修改
- **範例**: `PORT=3000`

#### `HOSTNAME`
- **用途**: 伺服器監聽的主機名稱
- **建議值**:
  - 本地開發: `localhost`
  - Zeabur/Railway: `0.0.0.0`（監聽所有介面）
- **範例**: `HOSTNAME=0.0.0.0`

---

### 資料庫配置

#### `DATABASE_URL` 🔴 **必填**
- **用途**: PostgreSQL 連接字串
- **格式**: `postgresql://username:password@host:port/database?schema=public`
- **範例**:
  ```
  DATABASE_URL="postgresql://user:pass@localhost:5432/arbitrage_db?schema=public"
  ```
- **Zeabur**: 從 PostgreSQL 服務自動產生
- **Railway**: 從 PostgreSQL 服務的「Variables」頁籤複製
- **注意**: 包含敏感資訊，請勿公開

---

### 認證與安全

#### `JWT_SECRET` 🔴 **必填**
- **用途**: JWT Token 簽署金鑰
- **要求**: 至少 32 字元的隨機字串
- **產生方式**:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- **範例**: `JWT_SECRET=5b4e840c47f2122ba4af91b1ab9fc0549dfc39d7545744a51f560159a44caa6b`
- **⚠️ 警告**:
  - 必須保密
  - 變更會導致所有用戶需重新登入
  - 生產環境務必使用強隨機金鑰

#### `JWT_EXPIRES_IN`
- **用途**: JWT Token 有效期限
- **格式**: 數字 + 單位（s=秒, m=分鐘, h=小時, d=天）
- **預設值**: `7d`（7 天）
- **範例**:
  - `24h` = 24 小時
  - `7d` = 7 天
  - `3600s` = 3600 秒

#### `ENCRYPTION_KEY` 🔴 **必填**
- **用途**: 加密用戶交易所 API 金鑰
- **要求**: 必須是 32 bytes（64 個十六進位字元）
- **產生方式**:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- **範例**: `ENCRYPTION_KEY=deb966699f91ee79605874dc0af1048e6285ff1e168043cfb7c61b7982acc91c`
- **⚠️ 警告**:
  - 極度重要，用於加密敏感資訊
  - 遺失會導致無法解密已儲存的 API 金鑰
  - 建議備份到安全位置

---

### 前端 URL 配置

#### `NEXT_PUBLIC_API_URL` 🔴 **必填**
- **用途**: 前端呼叫的 API 端點
- **格式**: `https://your-domain.com/api`
- **範例**:
  - 本地開發: `http://localhost:3000/api`
  - Zeabur: `https://your-app.zeabur.app/api`
- **注意**: 必須使用 HTTPS（生產環境）

#### `NEXT_PUBLIC_WS_URL` 🔴 **必填**
- **用途**: WebSocket 伺服器 URL
- **格式**: `https://your-domain.com`
- **範例**:
  - 本地開發: `http://localhost:3000`
  - Zeabur: `https://your-app.zeabur.app`
- **注意**: 不包含 `/api` 路徑

---

### 交易所 API 金鑰

#### Binance

`BINANCE_API_KEY` 🔴 **必填**
- **用途**: Binance API 金鑰
- **取得方式**: [Binance API 管理](https://www.binance.com/zh-TC/my/settings/api-management)
- **權限需求**: 讀取、合約交易

`BINANCE_API_SECRET` 🔴 **必填**
- **用途**: Binance API 密鑰
- **注意**: 極度敏感，請勿公開

`BINANCE_TESTNET`
- **用途**: 是否使用測試網
- **選項**: `true` | `false`
- **預設值**: `false`
- **測試網**: https://testnet.binancefuture.com/

#### OKX

`OKX_API_KEY` 🔴 **必填**
- **用途**: OKX API 金鑰
- **取得方式**: [OKX API 管理](https://www.okx.com/account/my-api)

`OKX_API_SECRET` 🔴 **必填**
- **用途**: OKX API 密鑰

`OKX_PASSPHRASE` 🔴 **必填**
- **用途**: OKX API Passphrase
- **注意**: 建立 API 時設定的密碼

`OKX_TESTNET`
- **用途**: 是否使用模擬盤
- **選項**: `true` | `false`
- **預設值**: `false`

---

## 🟡 選填環境變數

### Redis 快取

#### `REDIS_URL`
- **用途**: Redis 連接字串
- **格式**: `redis://host:port`
- **範例**: `redis://localhost:6379`
- **建議**: 生產環境強烈建議啟用
- **Zeabur**: 從 Redis 服務自動產生

---

### 通知服務

#### `TELEGRAM_BOT_TOKEN`
- **用途**: Telegram Bot Token
- **取得方式**: 透過 @BotFather 建立
- **格式**: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`

#### `TELEGRAM_CHAT_ID`
- **用途**: Telegram Chat ID
- **取得方式**: 透過 @userinfobot 查詢
- **格式**: `123456789`（個人）或 `-123456789`（群組）

---

### 交易配置

#### `MIN_SPREAD_THRESHOLD`
- **用途**: 最小資金費率差異閾值
- **預設值**: `0.0005`（0.05%）
- **建議值**: `0.0003` - `0.001`

#### `MAX_POSITION_SIZE_USD`
- **用途**: 最大倉位大小（美元）
- **預設值**: `10000`
- **建議**: 不超過總資金的 20%

#### `DEFAULT_LEVERAGE`
- **用途**: 預設槓桿倍數
- **預設值**: `1`
- **範圍**: `1-10`
- **⚠️ 警告**: 高槓桿增加風險

---

### 風險管理

#### `MAX_DAILY_LOSS`
- **用途**: 每日最大虧損（美元）
- **預設值**: `1000`

#### `MAX_DRAWDOWN`
- **用途**: 最大回撤百分比
- **預設值**: `0.1`（10%）

#### `POSITION_SIZE_PERCENT`
- **用途**: 倉位佔帳戶比例
- **預設值**: `0.1`（10%）

---

### 監控與日誌

#### `LOG_LEVEL`
- **用途**: 日誌等級
- **選項**: `trace` | `debug` | `info` | `warn` | `error` | `fatal`
- **建議值**:
  - 開發: `debug`
  - 生產: `info`

#### `LOG_PRETTY`
- **用途**: 是否啟用美化日誌
- **選項**: `true` | `false`
- **建議值**:
  - 開發: `true`（彩色、易讀）
  - 生產: `false`（JSON 格式，適合日誌收集工具）

---

## 🔒 安全性建議

### 1. 金鑰管理

✅ **應該做**:
- 使用密碼管理器儲存金鑰
- 定期輪換 JWT_SECRET（每 3-6 個月）
- 備份 ENCRYPTION_KEY 到安全位置
- 為不同環境使用不同的金鑰

❌ **不應該做**:
- 將 .env 檔案提交到 Git
- 在公開場合分享金鑰
- 在程式碼中硬編碼金鑰
- 使用弱密碼（如 "123456"）

### 2. API 金鑰權限

✅ **最小權限原則**:
- Binance: 只啟用「讀取」和「合約交易」
- OKX: 只啟用「交易」權限
- 不啟用「提現」權限

### 3. 環境隔離

```
開發環境 (.env.local)
├── 使用測試網 API
├── LOG_PRETTY=true
└── 弱密碼（可接受）

生產環境 (.env)
├── 使用正式網 API
├── LOG_PRETTY=false
└── 強隨機密碼（必須）
```

---

## 🔄 環境差異

### 本地開發 vs 生產環境

| 變數 | 本地開發 | 生產環境 |
|------|---------|---------|
| `NODE_ENV` | `development` | `production` |
| `HOSTNAME` | `localhost` | `0.0.0.0` |
| `DATABASE_URL` | `localhost:5432` | Zeabur/Railway URL |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3000/api` | `https://your-app.zeabur.app/api` |
| `BINANCE_TESTNET` | `true` | `false` |
| `LOG_PRETTY` | `true` | `false` |

---

## 📝 設定檢查清單

部署前請確認：

- [ ] `JWT_SECRET` 已產生（64 字元隨機字串）
- [ ] `ENCRYPTION_KEY` 已產生（64 字元隨機字串）
- [ ] `DATABASE_URL` 設定正確
- [ ] `NEXT_PUBLIC_API_URL` 包含正確的部署 URL
- [ ] `NEXT_PUBLIC_WS_URL` 包含正確的部署 URL
- [ ] 交易所 API 金鑰已設定
- [ ] API 金鑰權限已檢查（最小權限）
- [ ] `NODE_ENV=production`
- [ ] `LOG_PRETTY=false`
- [ ] .env 檔案未提交到 Git

---

## 🆘 常見錯誤

### 錯誤 1: JWT verification failed

**原因**: `JWT_SECRET` 變更或未設定

**解決**:
```bash
# 產生新的 JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 錯誤 2: Database connection failed

**原因**: `DATABASE_URL` 格式錯誤

**檢查**:
- 格式: `postgresql://user:pass@host:port/db?schema=public`
- 主機和埠號是否正確
- 帳號密碼是否正確

### 錯誤 3: API Key decryption failed

**原因**: `ENCRYPTION_KEY` 變更

**解決**: 無法解決，需要用戶重新輸入 API 金鑰

---

## 📚 參考資源

- [.env.example 檔案](../../.env.example)
- [部署指南](./README.md)
- [Next.js 環境變數](https://nextjs.org/docs/basic-features/environment-variables)

---

**上次更新**: 2025-01-13
