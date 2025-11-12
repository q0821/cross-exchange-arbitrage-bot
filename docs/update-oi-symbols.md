# OI 交易對更新工具

## 功能說明

自動從 Binance 抓取 Open Interest (OI) 前 N 名的 USDT 永續合約交易對，並更新 `config/symbols.json` 中的 `top100_oi` 群組。

更新後的交易對清單將被 **MonitorService** 用於後端監控服務。

## 使用方式

### 1. 執行更新指令

```bash
pnpm update-oi-symbols
```

### 2. 自訂 Top N 數量（預設 30）

```bash
OI_TOP_N=50 pnpm update-oi-symbols
```

### 3. 重啟服務套用新清單

更新完成後，**必須重啟 Web 服務**才能套用新的監控清單：

```bash
# 開發環境
pnpm dev

# 生產環境
pnpm start
```

## 執行範例

```bash
$ pnpm update-oi-symbols

🔄 開始更新 OI 交易對清單...

📊 抓取 OI 前 30 名交易對
✅ 已抓取 30 個交易對

📈 OI 前 10 名：
   1. BTCUSDT      $8.91B
   2. ETHUSDT      $5.99B
   3. SOLUSDT      $1.34B
   4. XRPUSDT      $0.50B
   5. BNBUSDT      $0.50B
   6. DOGEUSDT     $0.27B
   7. ZECUSDT      $0.27B
   8. HYPEUSDT     $0.17B
   9. ASTERUSDT    $0.16B
   10. ENAUSDT      $0.15B

📝 變更摘要：
   總數量: 30
   新增: 12 個
   移除: 12 個

➕ 新增的交易對：
   ZECUSDT      $0.27B
   HYPEUSDT     $0.17B
   ASTERUSDT    $0.16B
   ...

➖ 移除的交易對：
   MATICUSDT
   ATOMUSDT
   ARBUSDT
   ...

✅ 已更新 /path/to/config/symbols.json

⚠️  請重啟 Web 服務以套用新的監控清單：
   pnpm dev  或  pnpm start
```

## 工作原理

1. **連接 Binance API**：使用 BinanceConnector 連接到交易所
2. **抓取 OI 資料**：獲取所有 USDT 永續合約的 Open Interest 數據
3. **排序與篩選**：按 OI USD 值降序排序，取前 N 名
4. **計算差異**：比對現有清單，識別新增和移除的交易對
5. **更新配置檔案**：寫入 `config/symbols.json`，保持 JSON 格式化
6. **顯示摘要**：輸出變更詳情供人工審核

## 注意事項

### 何時需要更新清單？

建議每週或每月執行一次，因為：
- 市場熱度會變化
- 新興幣種 OI 可能快速增長
- 過時的交易對可能流動性降低

### 環境變數

- `OI_TOP_N`：要取得的前 N 名交易對數量（預設：30）
- `BINANCE_API_KEY`：Binance API 金鑰（從 .env 讀取）
- `BINANCE_API_SECRET`：Binance API 密鑰（從 .env 讀取）

### 更新流程建議

1. 執行 `pnpm update-oi-symbols`
2. 檢查輸出的變更摘要
3. 確認新增/移除的交易對是否合理
4. 如有需要，手動編輯 `config/symbols.json` 微調
5. 重啟服務套用新清單
6. 觀察監控服務是否正常運作

### 手動調整

如果想要手動調整清單（例如保留特定交易對），可以：

1. 執行更新指令獲取最新 OI 排名
2. 編輯 `config/symbols.json`
3. 手動新增或移除特定交易對
4. 重啟服務

## 技術細節

- **實作檔案**：`src/scripts/update-oi-symbols.ts`
- **配置檔案**：`config/symbols.json`
- **使用群組**：`top100_oi`（被 MonitorService 讀取）
- **API 呼叫**：約 500+ 次（每個交易對獨立查詢）
- **執行時間**：約 3-5 秒
- **資料來源**：Binance Futures API `/fapi/v1/openInterest`

## 相關檔案

- `src/scripts/update-oi-symbols.ts` - CLI 工具主程式
- `src/services/MonitorService.ts` - 讀取 top100_oi 群組的服務
- `config/symbols.json` - 交易對配置檔案
- `package.json` - NPM script 定義
