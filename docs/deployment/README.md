# 部署指南

> 🚀 本指南提供完整的部署步驟，讓您快速將跨交易所資金費率套利平台部署到生產環境

## 📋 目錄

- [快速開始](#快速開始)
- [部署平台選擇](#部署平台選擇)
- [環境需求](#環境需求)
- [部署步驟](#部署步驟)
- [常見問題](#常見問題)
- [進階主題](#進階主題)

---

## 🎯 快速開始

### 推薦部署方案

| 方案 | 適合場景 | 難度 | 預估成本 |
|------|---------|------|---------|
| [Zeabur](#zeabur-部署) ⭐⭐⭐⭐⭐ | 快速部署、中文支援 | ⭐ 簡單 | $5-20/月 |
| [Railway](#railway-部署) | 國際化、靈活配置 | ⭐⭐ 中等 | $5-15/月 |
| [VPS 自建](./vps-deployment.md) | 完整控制、長期運營 | ⭐⭐⭐ 較難 | $5-20/月 |

**建議**: 新手推薦使用 **Zeabur**，中文介面友好，部署簡單

---

## 💡 部署平台選擇

### ✅ Zeabur (強烈推薦)

**優點**:
- ✅ 完整支援 Node.js 自訂伺服器
- ✅ 內建 PostgreSQL 和 Redis 服務
- ✅ 中文介面，台灣團隊開發
- ✅ 支援 WebSocket 長連接
- ✅ Git 自動部署
- ✅ 有免費方案可測試

**缺點**:
- ⚠️ 標準 PostgreSQL 不含 TimescaleDB（生產環境需升級，見[升級指南](./upgrade-to-timescaledb.md)）

👉 [查看 Zeabur 詳細部署指南](./zeabur-guide.md)

---

### ✅ Railway

**優點**:
- ✅ 完整支援 Node.js 自訂伺服器
- ✅ 內建 PostgreSQL 和 Redis
- ✅ 簡單易用的介面
- ✅ $5 免費額度/月

**缺點**:
- ⚠️ 英文介面
- ⚠️ 需要信用卡（驗證用）

👉 [查看 Railway 詳細部署指南](./railway-guide.md)

---

### ❌ Vercel (不推薦)

**為何不推薦**:
- ❌ 不支援自訂 Node.js 伺服器 (server.ts)
- ❌ Serverless 架構無法運行背景服務
- ❌ WebSocket 支援有限
- ❌ 不適合這個專案的架構

---

## 📦 環境需求

### 必要服務

1. **PostgreSQL 15+**
   - 用於儲存資金費率、套利機會、用戶資料
   - Zeabur/Railway 都提供內建服務

2. **Node.js 20.x LTS**
   - 執行環境
   - Zeabur/Railway 會自動配置

3. **環境變數** (詳見 [環境變數說明](./environment-variables.md))
   - JWT_SECRET
   - ENCRYPTION_KEY
   - 交易所 API 金鑰

### 選用服務

1. **Redis 7+**
   - 用於快取和 rate limiting
   - 建議在生產環境啟用
   - Zeabur/Railway 提供一鍵部署

2. **Telegram Bot**
   - 用於套利機會通知
   - 可選，不影響核心功能

---

## 🚀 部署步驟

### 方案 1: Zeabur 部署 (推薦)

#### 1. 準備工作

```bash
# 1. 確保程式碼已推送到 GitHub
git push origin main

# 2. 產生 JWT Secret 和 Encryption Key
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))"

# 記下這兩個值，稍後要用
```

#### 2. 在 Zeabur 建立專案

1. 前往 [Zeabur 控制台](https://zeabur.com/dashboard)
2. 點擊「Create Project」建立新專案
3. 輸入專案名稱（例如：arbitrage-bot）

#### 3. 部署 PostgreSQL

1. 點擊「Add Service」→「Database」→「PostgreSQL」
2. 等待服務啟動（約 30 秒）
3. 點擊 PostgreSQL 服務 →「Variables」
4. 複製 `DATABASE_URL` 環境變數

#### 4. 部署 Redis (選用但建議)

1. 點擊「Add Service」→「Database」→「Redis」
2. 等待服務啟動
3. 點擊 Redis 服務 →「Variables」
4. 複製 `REDIS_URL` 環境變數

#### 5. 部署應用程式

1. 點擊「Add Service」→「Git」
2. 連接您的 GitHub 帳號
3. 選擇專案倉庫和 `main` 分支
4. Zeabur 會自動檢測並建置專案

#### 6. 設定環境變數

點擊應用程式服務 →「Variables」，新增以下變數：

```bash
# 必填
NODE_ENV=production
HOSTNAME=0.0.0.0
DATABASE_URL=<從 PostgreSQL 服務複製>
JWT_SECRET=<步驟 1 產生的值>
ENCRYPTION_KEY=<步驟 1 產生的值>

# 選填但建議
REDIS_URL=<從 Redis 服務複製>

# 交易所 API（根據需求填寫）
BINANCE_API_KEY=your_key
BINANCE_API_SECRET=your_secret
OKX_API_KEY=your_key
OKX_API_SECRET=your_secret
OKX_PASSPHRASE=your_passphrase

# 前端 URL（部署後取得）
NEXT_PUBLIC_API_URL=https://your-app.zeabur.app/api
NEXT_PUBLIC_WS_URL=https://your-app.zeabur.app
```

#### 7. 執行資料庫遷移

在 Zeabur 專案中：

1. 進入應用程式服務
2. 點擊「Console」開啟終端機
3. 執行遷移命令：

```bash
pnpm prisma migrate deploy
pnpm prisma generate
```

#### 8. 取得部署 URL

1. 點擊應用程式服務 →「Networking」
2. 點擊「Generate Domain」產生網域
3. 複製產生的 URL（例如：https://your-app.zeabur.app）
4. 回到「Variables」更新 `NEXT_PUBLIC_API_URL` 和 `NEXT_PUBLIC_WS_URL`

#### 9. 驗證部署

開啟瀏覽器訪問部署的 URL：
- 主頁面：https://your-app.zeabur.app
- API 健康檢查：https://your-app.zeabur.app/api/health
- 市場監控：https://your-app.zeabur.app/market-monitor

---

### 方案 2: Railway 部署

👉 詳細步驟請參考 [Railway 部署指南](./railway-guide.md)

---

## ❓ 常見問題

### Q1: 部署後無法連接資料庫？

**解決方案**:
1. 確認 `DATABASE_URL` 格式正確
2. 確認 PostgreSQL 服務已啟動
3. 檢查網路連接設定

### Q2: WebSocket 連接失敗？

**解決方案**:
1. 確認 `NEXT_PUBLIC_WS_URL` 設定正確
2. 使用 HTTPS 而非 HTTP
3. 檢查防火牆設定

### Q3: 資金費率監控沒有資料？

**解決方案**:
1. 確認已設定交易所 API 金鑰
2. 檢查 API 金鑰權限（需要讀取權限）
3. 查看應用程式日誌

### Q4: 如何查看日誌？

**Zeabur**:
- 進入應用程式服務 →「Logs」

**Railway**:
- 進入專案 → 點擊服務 → 查看「Logs」頁籤

### Q5: 如何更新部署？

**自動部署** (推薦):
1. 推送程式碼到 GitHub
2. Zeabur/Railway 自動檢測並重新部署

**手動觸發**:
1. 進入服務設定
2. 點擊「Redeploy」重新部署

---

## 📚 進階主題

### 升級到 TimescaleDB

當您的資料量增大或需要更好的查詢效能時，可以升級到 TimescaleDB。

👉 [TimescaleDB 升級指南](./upgrade-to-timescaledb.md)

### 環境變數詳細說明

了解每個環境變數的用途和配置方法。

👉 [環境變數完整說明](./environment-variables.md)

### 監控和日誌

設定監控和日誌收集，追蹤系統健康狀態。

👉 [監控和日誌指南](./monitoring.md) (待補充)

### 備份和災難恢復

設定自動備份策略，確保資料安全。

👉 [備份指南](./backup.md) (待補充)

---

## 🆘 需要幫助？

- 📖 查看 [專案 README](../../README.md)
- 💬 提交 [GitHub Issue](https://github.com/your-repo/issues)
- 📧 聯絡開發團隊

---

## ⚖️ 授權

MIT License

---

**上次更新**: 2025-01-13
