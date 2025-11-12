# 升級到 TimescaleDB 指南

> 📊 本指南說明如何從標準 PostgreSQL 升級到 TimescaleDB，以獲得更好的時間序列資料處理效能

## 📋 目錄

- [為什麼需要 TimescaleDB](#為什麼需要-timescaledb)
- [何時需要升級](#何時需要升級)
- [升級前檢查清單](#升級前檢查清單)
- [升級方案](#升級方案)
- [升級步驟](#升級步驟)
- [驗證和測試](#驗證和測試)
- [常見問題](#常見問題)

---

## 🎯 為什麼需要 TimescaleDB

### 標準 PostgreSQL vs TimescaleDB

| 功能 | 標準 PostgreSQL | TimescaleDB |
|------|----------------|-------------|
| **查詢效能** | 一般 | 快 10-100 倍 |
| **寫入效能** | 一般 | 優化 |
| **儲存效能** | 普通壓縮 | 90%+ 壓縮率 |
| **資料保留** | 手動刪除 | 自動清理 |
| **統計聚合** | 即時計算（慢） | 預先計算（快） |
| **分區管理** | 手動 | 自動 |

### TimescaleDB 在本專案的用途

1. **Hypertable（時序表）**
   - `funding_rates` 表自動按天分區
   - 查詢歷史資料快 10-100 倍

2. **自動資料保留**
   - 資金費率保留 30 天
   - 系統事件保留 7 天
   - 自動清理過期資料

3. **連續聚合**
   - 每小時統計自動更新
   - 查詢統計資料超快

4. **資料壓縮**
   - 節省 90% 以上儲存空間
   - 不影響查詢效能

---

## ⏰ 何時需要升級

### 判斷標準

| 指標 | 無需升級 | 建議升級 | 必須升級 |
|------|---------|---------|---------|
| **資料量** | < 10 萬筆 | 10-50 萬筆 | > 50 萬筆 |
| **運行時間** | < 1 個月 | 1-3 個月 | > 3 個月 |
| **查詢延遲** | < 1 秒 | 1-5 秒 | > 5 秒 |
| **儲存空間** | < 1 GB | 1-5 GB | > 5 GB |
| **寫入頻率** | 低 | 中 | 高 |

### 評估您的情況

```bash
# 1. 檢查資料量
SELECT COUNT(*) FROM funding_rates;
# < 100,000: 無需升級
# > 100,000: 建議升級

# 2. 檢查資料庫大小
SELECT pg_size_pretty(pg_database_size('arbitrage_db'));
# < 1 GB: 無需升級
# > 1 GB: 建議升級

# 3. 測試查詢效能
EXPLAIN ANALYZE
SELECT * FROM funding_rates
WHERE symbol = 'BTCUSDT'
  AND recorded_at > NOW() - INTERVAL '7 days'
ORDER BY recorded_at DESC;
# Execution Time > 1000ms: 建議升級
```

---

## ✅ 升級前檢查清單

### 1. 備份資料

```bash
# 方法 1: 使用 pg_dump
pg_dump -h <host> -U <user> -d arbitrage_db > backup_$(date +%Y%m%d).sql

# 方法 2: Zeabur/Railway 控制台備份
# 進入資料庫服務 → Backups → Create Backup
```

### 2. 記錄當前配置

```bash
# 匯出環境變數
echo $DATABASE_URL
echo $REDIS_URL

# 記下應用程式 URL
echo $NEXT_PUBLIC_API_URL
```

### 3. 評估停機時間

| 資料量 | 預估停機時間 |
|--------|-------------|
| < 10 萬筆 | 5-10 分鐘 |
| 10-50 萬筆 | 15-30 分鐘 |
| > 50 萬筆 | 30-60 分鐘 |

---

## 🚀 升級方案

### 方案 1: VPS + Docker (推薦) ⭐⭐⭐⭐⭐

**適合**: 長期運營、完整控制

**優點**:
- ✅ 使用專案現有的 docker-compose.yml
- ✅ 完整的 TimescaleDB 功能
- ✅ 價格合理（$5-20/月）
- ✅ 完全控制

**缺點**:
- ⚠️ 需要自己管理伺服器
- ⚠️ 需要設定 CI/CD

**推薦平台**:
- DigitalOcean ($6/月起)
- Linode ($5/月起)
- Vultr ($5/月起)
- AWS Lightsail ($5/月起)

👉 [查看 VPS 部署步驟](#方案-1-vps--docker-詳細步驟)

---

### 方案 2: Timescale Cloud + Zeabur ⭐⭐⭐⭐

**適合**: 不想管理資料庫、追求穩定性

**優點**:
- ✅ 原生 TimescaleDB 支援
- ✅ 自動備份和監控
- ✅ 有免費方案（30 天試用）

**缺點**:
- ⚠️ 需要信用卡
- ⚠️ 免費方案有限制

**成本**:
- Timescale Cloud: 免費試用 30 天，之後 $25/月起
- Zeabur: $5-15/月

👉 [查看 Timescale Cloud 步驟](#方案-2-timescale-cloud-詳細步驟)

---

### 方案 3: Railway + Docker ⭐⭐⭐

**適合**: 想要簡單部署 Docker

**優點**:
- ✅ 支援 Docker 部署
- ✅ 簡單易用

**缺點**:
- ⚠️ 需要信用卡
- ⚠️ 相對較貴

👉 [查看 Railway Docker 步驟](#方案-3-railway--docker-詳細步驟)

---

## 📝 升級步驟

### 方案 1: VPS + Docker 詳細步驟

#### 1. 選擇並設定 VPS

```bash
# 1. 在 DigitalOcean/Linode/Vultr 建立 Droplet/VM
# 選擇規格：2GB RAM, 1 vCPU, 50GB SSD

# 2. SSH 連接到伺服器
ssh root@your-server-ip

# 3. 安裝 Docker 和 Docker Compose
curl -fsSL https://get.docker.com | sh
```

#### 2. 部署專案

```bash
# 1. 安裝 Git 和 Node.js
apt update && apt install -y git
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# 2. 安裝 pnpm
npm install -g pnpm

# 3. Clone 專案
git clone https://github.com/your-username/your-repo.git
cd your-repo

# 4. 建立 .env 檔案（從 .env.example 複製並修改）
cp .env.example .env
nano .env

# 5. 啟動服務
pnpm docker:up

# 6. 等待 PostgreSQL 啟動（約 30 秒）
docker ps

# 7. 恢復 Prisma schema (加回 TimescaleDB)
# 編輯 prisma/schema.prisma
nano prisma/schema.prisma

# 將第 12-13 行改回：
# datasource db {
#   provider   = "postgresql"
#   url        = env("DATABASE_URL")
#   extensions = [timescaledb]
# }

# 8. 從備份還原資料
docker exec -i arbitrage-postgres psql -U arbitrage_user -d arbitrage_db < backup_20250113.sql

# 9. 執行 TimescaleDB 遷移
docker exec -i arbitrage-postgres psql -U arbitrage_user -d arbitrage_db < prisma/migrations/setup-hypertables.sql

# 10. 執行 Prisma 遷移
pnpm prisma migrate deploy
pnpm prisma generate

# 11. 建置並啟動應用程式
pnpm install
pnpm build
pnpm start

# 12. 使用 PM2 保持應用程式運行
npm install -g pm2
pm2 start "pnpm start" --name arbitrage-bot
pm2 save
pm2 startup
```

#### 3. 設定 Nginx 反向代理 (選用但建議)

```bash
# 1. 安裝 Nginx
apt install -y nginx

# 2. 建立 Nginx 配置
nano /etc/nginx/sites-available/arbitrage-bot

# 3. 貼上以下內容：
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# 4. 啟用配置
ln -s /etc/nginx/sites-available/arbitrage-bot /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx

# 5. 設定 SSL (使用 Let's Encrypt)
apt install -y certbot python3-certbot-nginx
certbot --nginx -d your-domain.com
```

---

### 方案 2: Timescale Cloud 詳細步驟

#### 1. 建立 Timescale Cloud 帳號

1. 前往 [Timescale Cloud](https://console.cloud.timescale.com/)
2. 註冊帳號（30 天免費試用）
3. 建立新的服務
   - 選擇 Region（建議選靠近您的區域）
   - 選擇方案（可先選 Trial）

#### 2. 取得連接資訊

1. 進入服務詳情頁
2. 複製連接字串（Connection String）
   ```
   postgresql://username:password@host.timescaledb.com:port/dbname?sslmode=require
   ```

#### 3. 遷移資料

```bash
# 1. 從舊資料庫匯出資料
pg_dump -h <old-host> -U <old-user> -d arbitrage_db --data-only > data.sql

# 2. 匯入到 Timescale Cloud
psql "<timescale-connection-string>" < data.sql

# 3. 執行 TimescaleDB 設定
psql "<timescale-connection-string>" < prisma/migrations/setup-hypertables.sql
```

#### 4. 更新 Zeabur 配置

1. 進入 Zeabur 專案
2. 點擊應用程式服務 →「Variables」
3. 更新 `DATABASE_URL` 為 Timescale Cloud 的連接字串
4. 重新部署應用程式

#### 5. 更新 Prisma Schema

```bash
# 在本地編輯 prisma/schema.prisma
# 將第 12-13 行改回：
datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [timescaledb]
}

# 提交並推送
git add prisma/schema.prisma
git commit -m "feat: 啟用 TimescaleDB 支援"
git push origin main

# Zeabur 會自動重新部署
```

---

### 方案 3: Railway + Docker 詳細步驟

#### 1. 準備 Dockerfile

建立 `Dockerfile.timescale` (專案根目錄):

```dockerfile
FROM timescale/timescaledb:latest-pg15

# 複製初始化腳本
COPY prisma/migrations/init-timescale.sql /docker-entrypoint-initdb.d/01-init-timescale.sql
COPY prisma/migrations/setup-hypertables.sql /docker-entrypoint-initdb.d/02-setup-hypertables.sql

# 設定環境變數
ENV POSTGRES_DB=arbitrage_db
ENV POSTGRES_USER=arbitrage_user
ENV POSTGRES_PASSWORD=change_this_password
```

#### 2. 在 Railway 部署

1. 進入 Railway 專案
2. 點擊「New」→「Docker」
3. 選擇 `Dockerfile.timescale`
4. 設定環境變數
5. 部署並取得連接資訊

#### 3. 更新應用程式配置

1. 更新 `DATABASE_URL`
2. 重新部署應用程式

---

## ✅ 驗證和測試

### 1. 確認 TimescaleDB 已啟用

```sql
-- 連接到資料庫
psql $DATABASE_URL

-- 檢查 TimescaleDB 版本
SELECT extversion FROM pg_extension WHERE extname = 'timescaledb';
-- 應該顯示版本號（例如：2.13.0）

-- 檢查 Hypertables
SELECT * FROM timescaledb_information.hypertables;
-- 應該看到 funding_rates 和其他表

-- 檢查資料保留策略
SELECT * FROM timescaledb_information.jobs;
-- 應該看到保留策略任務

-- 檢查連續聚合
SELECT * FROM timescaledb_information.continuous_aggregates;
-- 應該看到 funding_rates_hourly
```

### 2. 測試查詢效能

```sql
-- 測試查詢速度
EXPLAIN ANALYZE
SELECT * FROM funding_rates
WHERE symbol = 'BTCUSDT'
  AND recorded_at > NOW() - INTERVAL '7 days'
ORDER BY recorded_at DESC;

-- 應該看到 Execution Time < 100ms（使用 Index Scan）
```

### 3. 測試應用程式

1. 開啟市場監控頁面
2. 確認資料正常顯示
3. 檢查 WebSocket 連接
4. 測試套利機會偵測

### 4. 監控資料壓縮

```sql
-- 檢查壓縮狀態
SELECT * FROM timescaledb_information.compression_settings;

-- 查看壓縮率
SELECT
    pg_size_pretty(before_compression_total_bytes) as "原始大小",
    pg_size_pretty(after_compression_total_bytes) as "壓縮後",
    round(100 - (after_compression_total_bytes::numeric / before_compression_total_bytes::numeric * 100), 2) as "壓縮率 %"
FROM timescaledb_information.compression_statistics;
```

---

## ❓ 常見問題

### Q1: 升級後資料會遺失嗎？

**答**: 不會，只要備份正確。升級過程是：
1. 備份舊資料
2. 部署 TimescaleDB
3. 還原資料
4. 轉換為 Hypertable

### Q2: 可以在不停機的情況下升級嗎？

**答**: 較困難，建議規劃停機視窗（通常 15-30 分鐘）。如需零停機：
1. 部署新的 TimescaleDB 實例
2. 設定資料複製
3. 切換流量
4. 需要較複雜的架構

### Q3: 升級失敗怎麼辦？

**答**:
1. 停止應用程式
2. 從備份還原資料
3. 回滾到標準 PostgreSQL
4. 檢查錯誤訊息後重試

### Q4: 可以先在測試環境試用嗎？

**答**: 強烈建議！
1. 複製生產資料到測試環境
2. 按照本指南操作
3. 測試所有功能
4. 確認無誤後才升級生產環境

### Q5: 升級後成本會增加嗎？

**答**: 視方案而定
- VPS: 不變（$5-20/月）
- Timescale Cloud: 增加（$25/月起，但有免費試用）
- 儲存空間會減少（壓縮節省 90%）

---

## 📚 參考資源

- [TimescaleDB 官方文件](https://docs.timescale.com/)
- [Prisma TimescaleDB 指南](https://www.prisma.io/docs/concepts/database-connectors/postgresql#timescaledb)
- [資料遷移最佳實踐](https://docs.timescale.com/migrate/latest/)

---

## 🆘 需要幫助？

- 📖 回到 [部署指南主頁](./README.md)
- 💬 提交 [GitHub Issue](https://github.com/your-repo/issues)
- 📧 聯絡開發團隊

---

**上次更新**: 2025-01-13
