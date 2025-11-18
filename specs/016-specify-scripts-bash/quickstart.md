# Quickstart Guide: 擴大交易對監控至 100 個

**Feature**: 016-specify-scripts-bash | **Date**: 2025-11-18
**目標對象**: 系統管理員、DevOps

本指南提供快速步驟，將套利機器人的監控交易對從 30 個擴大至 100 個。

---

## 快速總覽

**執行時間**: 5-10 分鐘
**風險等級**: 🟢 低風險（純配置變更，可快速回滾）
**停機時間**: ~30 秒（重啟服務）

**一句話摘要**:
```bash
OI_TOP_N=100 pnpm update-oi-symbols && pnpm dev
```

---

## 前置需求

### 1. 環境檢查

確認以下工具已安裝：

```bash
# Node.js 版本 (需要 >= 20.0.0)
node --version
# 輸出範例: v20.11.0

# pnpm 版本 (需要 >= 8.0.0)
pnpm --version
# 輸出範例: 8.15.0
```

### 2. 專案路徑

確認當前目錄為專案根目錄：

```bash
pwd
# 輸出應為: /path/to/cross-exchange-arbitrage-bot

# 檢查配置檔案存在
ls config/symbols.json
# 輸出應為: config/symbols.json
```

### 3. 環境變數

確認 Binance API 金鑰已設定（用於獲取 OI 數據）：

```bash
# 檢查 .env 檔案
cat .env | grep BINANCE_API_KEY
# 應輸出: BINANCE_API_KEY=your_api_key

cat .env | grep BINANCE_API_SECRET
# 應輸出: BINANCE_API_SECRET=your_api_secret
```

**注意**: 如無 API 金鑰，請參考 [Binance API 文件](https://www.binance.com/en/support/faq/how-to-create-api-keys-on-binance-360002502072) 建立。

---

## 執行步驟

### Step 1: 備份現有配置 (建議)

```bash
# 備份配置檔案
cp config/symbols.json config/symbols.json.backup

# 驗證備份成功
ls -lh config/symbols.json*
```

**輸出範例**:
```
-rw-r--r--  1 user  staff   2.1K Nov 18 08:00 config/symbols.json
-rw-r--r--  1 user  staff   2.1K Nov 18 08:01 config/symbols.json.backup
```

### Step 2: 執行 OI 更新腳本

```bash
# 設定環境變數並執行腳本
OI_TOP_N=100 pnpm update-oi-symbols
```

**預期輸出**:
```
🔄 開始更新 OI 交易對清單...

📊 抓取 OI 前 100 名交易對
✅ 已抓取 100 個交易對

📈 OI 前 10 名：
   1. BTCUSDT      $45.23B
   2. ETHUSDT      $12.45B
   3. SOLUSDT      $8.91B
   4. XRPUSDT      $7.65B
   5. BNBUSDT      $6.34B
   6. DOGEUSDT     $5.12B
   7. ADAUSDT      $4.56B
   8. AVAXUSDT     $3.89B
   9. DOTUSDT      $3.21B
  10. LINKUSDT     $2.98B

📝 變更摘要：
   總數量: 100
   新增: 70 個
   移除: 0 個

➕ 新增的交易對：
   XRPUSDT       $7.65B
   ADAUSDT       $4.56B
   AVAXUSDT      $3.89B
   ...

✅ 已更新 /path/to/config/symbols.json

⚠️  請重啟 Web 服務以套用新的監控清單：
   pnpm dev  或  pnpm start
```

**執行時間**: ~3-5 秒

### Step 3: 驗證配置更新

```bash
# 檢查配置檔案中的交易對數量
cat config/symbols.json | jq '.groups.top100_oi.symbols | length'
```

**預期輸出**: `100`

如果沒有安裝 `jq`，可使用：
```bash
# macOS
brew install jq

# 或手動檢查
cat config/symbols.json | grep -A 5 "top100_oi"
```

### Step 4: 重啟監控服務

**開發環境**:
```bash
# 停止當前服務 (Ctrl+C)
# 然後啟動
pnpm dev
```

**生產環境**:
```bash
# 使用 PM2 (如有使用)
pm2 restart arbitrage-bot

# 或直接重啟
pnpm start
```

**預期日誌輸出**:
```
[2025-11-18 08:05:00] INFO: FundingRateMonitor initialized
[2025-11-18 08:05:00] INFO: Monitoring 100 symbols across 4 exchanges
[2025-11-18 08:05:00] INFO: Update interval: 300000 ms (5 minutes)
[2025-11-18 08:05:00] INFO: Server listening on http://localhost:3000
[2025-11-18 08:05:05] INFO: First funding rate update completed successfully
[2025-11-18 08:05:05] INFO: Successfully fetched rates for 98/100 symbols
```

---

## 驗證

### 1. 檢查系統日誌

```bash
# 查看最近的日誌
tail -n 50 logs/app.log
```

**關鍵訊息檢查**:
- ✅ `Monitoring 100 symbols across 4 exchanges`
- ✅ `First funding rate update completed successfully`
- ✅ `Successfully fetched rates for XX/100 symbols`

**預期成功率**: 95%+ (部分交易對在某些交易所可能不存在)

### 2. 訪問前端頁面

開啟瀏覽器，訪問：
```
http://localhost:3000/market-monitor
```

**檢查項目**:
- ✅ 頁面載入時間 < 3 秒
- ✅ 顯示 ~100 個交易對（表格行數）
- ✅ 每個交易對顯示 4 個交易所的費率
- ✅ WebSocket 連接正常（右上角狀態指示）
- ✅ 資金費率數據持續更新（每 5 分鐘）

**視覺驗證**:
![Market Monitor Page](預期顯示 100 行交易對數據)

### 3. API 測試 (選項性)

```bash
# 測試 REST API
curl http://localhost:3000/api/market-rates | jq '.rates | length'
# 預期輸出: 100

# 測試市場統計
curl http://localhost:3000/api/market-stats | jq '.totalSymbols'
# 預期輸出: 100
```

### 4. 效能驗證

```bash
# 監控記憶體使用 (使用 htop 或 top)
top -pid $(pgrep -f "node.*server")

# 或使用 Node.js 內建的記憶體報告
node -e "console.log(process.memoryUsage())"
```

**預期記憶體增加**: < 1MB (相較於監控 30 個交易對)

---

## 常見問題 (Troubleshooting)

### 問題 1: 腳本執行失敗 "Failed to fetch open interest data"

**可能原因**:
- Binance API 金鑰無效或過期
- 網路連接問題
- Binance API 維護中

**解決方案**:
```bash
# 1. 檢查 API 金鑰
cat .env | grep BINANCE_API

# 2. 測試網路連接
curl https://fapi.binance.com/fapi/v1/ping

# 3. 重試腳本
OI_TOP_N=100 pnpm update-oi-symbols

# 4. 如持續失敗，使用備份恢復
cp config/symbols.json.backup config/symbols.json
```

### 問題 2: 配置更新後，服務啟動失敗

**可能原因**:
- `config/symbols.json` 格式錯誤
- JSON 解析失敗

**解決方案**:
```bash
# 驗證 JSON 格式
cat config/symbols.json | jq .

# 如報錯，從備份恢復
cp config/symbols.json.backup config/symbols.json

# 或重新執行腳本
OI_TOP_N=100 pnpm update-oi-symbols
```

### 問題 3: 前端頁面載入緩慢 (> 3 秒)

**可能原因**:
- 資料庫查詢慢
- 網路延遲
- 前端渲染瓶頸

**診斷步驟**:
```bash
# 1. 檢查 API 響應時間
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3000/api/market-rates

# 2. 檢查資料庫連接
psql -U postgres -c "SELECT COUNT(*) FROM \"FundingRateValidation\";"

# 3. 檢查瀏覽器開發者工具 (Network tab)
# - API 請求時間
# - 渲染時間
```

**臨時解決**:
- 如效能不佳，可先回滾至 30 個交易對
- 等待未來優化（如虛擬化渲染）

### 問題 4: 部分交易對無法獲取資金費率

**症狀**:
```
[2025-11-18 08:05:05] WARN: Failed to fetch rate for XYZUSDT on mexc
[2025-11-18 08:05:05] INFO: Successfully fetched rates for 97/100 symbols
```

**原因**: 正常現象，部分交易對在某些交易所不存在

**處理**:
- ✅ 系統已有錯誤處理，不影響其他交易對
- ✅ 如成功率 > 95%，屬正常範圍
- ⚠️ 如成功率 < 90%，可能需檢查交易所 API 狀態

### 問題 5: WebSocket 連接失敗

**症狀**: 前端頁面顯示「連接失敗」或數據不更新

**解決方案**:
```bash
# 1. 檢查服務是否正常運行
ps aux | grep node

# 2. 檢查 WebSocket 端口
lsof -i :3000

# 3. 重啟服務
pnpm dev

# 4. 檢查瀏覽器控制台 (Console tab)
# 查看 WebSocket 錯誤訊息
```

---

## 回滾步驟

如需回滾至 30 個交易對：

### 選項 1: 從備份恢復 (最快)

```bash
# 停止服務 (Ctrl+C 或 pm2 stop)
# 恢復備份
cp config/symbols.json.backup config/symbols.json

# 驗證
cat config/symbols.json | jq '.groups.top100_oi.symbols | length'
# 預期輸出: 30

# 重啟服務
pnpm dev
```

### 選項 2: 重新執行腳本

```bash
# 停止服務
# 執行腳本（設定為 30）
OI_TOP_N=30 pnpm update-oi-symbols

# 重啟服務
pnpm dev
```

### 選項 3: 手動編輯 (不建議)

```bash
# 編輯配置檔案
vim config/symbols.json

# 手動移除 top100_oi.symbols 陣列中的元素，保留前 30 個
# 儲存並退出

# 重啟服務
pnpm dev
```

---

## 效能監控 (選項性)

### 監控 API 使用率

```bash
# 查看 API 呼叫日誌
tail -f logs/app.log | grep "API"

# 統計每分鐘 API 呼叫次數
grep "API request" logs/app.log | awk '{print $2}' | cut -d: -f1-2 | uniq -c
```

**預期**:
- Binance: ~80 req/min (< 7% of 1200 limit)
- OKX: ~80 req/min (< 13% of 600 limit)
- MEXC: ~80 req/min (< 40% of 200 limit)
- Gate.io: ~80 req/min (< 9% of 900 limit)

### 監控記憶體使用

```bash
# 使用 Node.js 內建工具
node -e "setInterval(() => console.log(process.memoryUsage()), 5000)"

# 或使用 pm2 (如有安裝)
pm2 monit
```

**預期記憶體增加**: 30MB (30 個) → 30.06MB (100 個)

### 監控套利機會數量

```bash
# 查看機會偵測日誌
tail -f logs/app.log | grep "opportunity-detected"

# 統計每小時套利機會數
grep "opportunity-detected" logs/app.log | awk '{print $2}' | cut -d: -f1 | uniq -c
```

**預期**:
- 每日機會數: 5-10 個 → 15-30 個 (3 倍提升)

---

## 進階配置 (選項性)

### 自訂 OI 數量

如需調整為其他數量（如 50, 150）：

```bash
# 50 個交易對
OI_TOP_N=50 pnpm update-oi-symbols

# 150 個交易對（需注意 API 速率限制）
OI_TOP_N=150 pnpm update-oi-symbols
```

**注意**: 超過 100 個交易對時，請參考 `research.md` 中的 API 速率計算。

### 排除特定交易對 (未來功能)

目前腳本不支援排除功能。如需排除特定交易對，需手動編輯 `config/symbols.json`。

### 定期更新 OI 清單 (未來功能)

目前需手動執行腳本。未來可設定 cron job 自動更新：

```bash
# 範例：每週日凌晨 2 點更新
0 2 * * 0 cd /path/to/project && OI_TOP_N=100 pnpm update-oi-symbols && pm2 restart arbitrage-bot
```

**注意**: 此功能超出當前範圍，謹慎使用。

---

## 檢查清單

執行前檢查：
- [ ] Node.js >= 20.0.0 已安裝
- [ ] pnpm >= 8.0.0 已安裝
- [ ] Binance API 金鑰已設定
- [ ] 位於專案根目錄
- [ ] 已備份 `config/symbols.json`

執行後驗證：
- [ ] 腳本執行成功，無錯誤訊息
- [ ] `config/symbols.json` 包含 100 個交易對
- [ ] 服務重啟成功
- [ ] 日誌顯示 "Monitoring 100 symbols"
- [ ] 前端頁面載入時間 < 3 秒
- [ ] 前端顯示 ~100 個交易對
- [ ] WebSocket 連接正常
- [ ] API 成功率 > 95%

---

## 相關資源

- **技術研究**: [research.md](./research.md) - 詳細的技術分析和效能評估
- **資料模型**: [data-model.md](./data-model.md) - 配置結構說明
- **API 合約**: [contracts/api-changes.md](./contracts/api-changes.md) - API 變更說明（無變更）
- **功能規格**: [spec.md](./spec.md) - 完整的功能需求
- **技術計劃**: [plan.md](./plan.md) - 實作計劃

---

## 支援與反饋

如遇到問題：
1. 檢查本指南的「常見問題」章節
2. 查看日誌檔案 `logs/app.log`
3. 參考 `research.md` 了解技術細節
4. 如問題仍未解決，請聯繫開發團隊

---

**最後更新**: 2025-11-18
**版本**: 1.0.0
**狀態**: Production Ready ✅
