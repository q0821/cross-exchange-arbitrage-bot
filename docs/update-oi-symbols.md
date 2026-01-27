# 交易對更新工具（24hr Volume）

## 功能說明

自動從 Binance 抓取 **24hr 交易量**前 N 名的 USDT 永續合約交易對，並更新 `config/symbols.json` 中的 `top100_oi` 群組。

更新後的交易對清單將被 **MonitorService** 用於後端監控服務。

> **優化**：使用 `/fapi/v1/ticker/24hr` 單次 API 呼叫，執行時間從 2-4 秒降到 <1 秒。

## 使用方式

### 1. 手動執行更新指令

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

🔄 開始更新交易對清單（依 24hr 交易量排序）...

📊 抓取 24hr 交易量前 30 名交易對
✅ 已抓取 30 個交易對

📈 24hr 交易量前 10 名：
   1. BTCUSDT      $58.91B
   2. ETHUSDT      $25.99B
   3. SOLUSDT      $8.34B
   4. XRPUSDT      $3.50B
   5. BNBUSDT      $2.50B
   6. DOGEUSDT     $1.27B
   ...

📝 變更摘要：
   總數量: 30
   新增: 5 個
   移除: 5 個

➕ 新增的交易對：
   NEWCOIN1     $0.50B
   NEWCOIN2     $0.45B
   ...

➖ 移除的交易對：
   OLDCOIN1
   OLDCOIN2
   ...

✅ 已更新 /path/to/config/symbols.json

⚠️  請重啟 Web 服務以套用新的監控清單：
   pnpm dev  或  pnpm start
```

## 自動定時更新

除了手動執行腳本，也可以在伺服器上啟用自動定時更新 `config/symbols.json`。

### 啟用方式

在 `.env` 中設定環境變數：

```bash
# 啟用 config/symbols.json 自動更新（預設關閉）
ENABLE_SYMBOLS_FILE_UPDATE=true

# 更新間隔（毫秒），預設 24 小時
SYMBOLS_UPDATE_INTERVAL_MS=86400000
```

### 運作機制

- 啟用後，`OIRefreshService` 會在伺服器啟動時自動更新一次檔案
- 之後每隔指定間隔（預設 24 小時）自動更新
- 如果交易對清單沒有變更，會跳過寫入
- 檔案更新失敗不會影響服務運作（保留舊配置）

### 日誌輸出

啟用時會看到以下日誌：

```
INFO: Symbols config file auto-update enabled
      fileUpdateIntervalHours: 24
      nextFileUpdateAt: 2025-01-27T12:00:00.000Z

INFO: Symbols config file updated successfully
      symbolCount: 30
      added: 3
      removed: 2
      addedSymbols: ["NEWCOIN1", "NEWCOIN2", "NEWCOIN3"]
```

## 工作原理

1. **呼叫 Binance API**：使用 `/fapi/v1/ticker/24hr` 單次請求獲取所有交易對
2. **排序與篩選**：按 24hr USDT 成交額降序排序，取前 N 名
3. **計算差異**：比對現有清單，識別新增和移除的交易對
4. **更新配置檔案**：寫入 `config/symbols.json`，保持 JSON 格式化
5. **顯示摘要**：輸出變更詳情供人工審核

## 注意事項

### 何時需要更新清單？

建議每週或每月執行一次，因為：
- 市場熱度會變化
- 新興幣種交易量可能快速增長
- 過時的交易對可能流動性降低

### 環境變數

| 變數 | 說明 | 預設值 |
|:-----|:-----|:-------|
| `OI_TOP_N` | 要取得的前 N 名交易對數量 | 30 |
| `ENABLE_SYMBOLS_FILE_UPDATE` | 啟用自動檔案更新 | false |
| `SYMBOLS_UPDATE_INTERVAL_MS` | 檔案更新間隔（毫秒） | 86400000 (24hr) |

### 更新流程建議

1. 執行 `pnpm update-oi-symbols`
2. 檢查輸出的變更摘要
3. 確認新增/移除的交易對是否合理
4. 如有需要，手動編輯 `config/symbols.json` 微調
5. 重啟服務套用新清單
6. 觀察監控服務是否正常運作

### 手動調整

如果想要手動調整清單（例如保留特定交易對），可以：

1. 執行更新指令獲取最新排名
2. 編輯 `config/symbols.json`
3. 手動新增或移除特定交易對
4. 重啟服務

## 技術細節

| 項目 | 說明 |
|:-----|:-----|
| 實作檔案 | `src/scripts/update-oi-symbols.ts` |
| 配置檔案 | `config/symbols.json` |
| 使用群組 | `top100_oi`（被 MonitorService 讀取） |
| API 呼叫 | **1 次**（優化後） |
| 執行時間 | **<1 秒**（優化後） |
| 資料來源 | Binance Futures API `/fapi/v1/ticker/24hr` |

## 相關檔案

- `src/scripts/update-oi-symbols.ts` - CLI 工具主程式
- `src/services/OIRefreshService.ts` - 定時更新服務（含檔案更新）
- `src/services/MonitorService.ts` - 讀取 top100_oi 群組的服務
- `config/symbols.json` - 交易對配置檔案
- `package.json` - NPM script 定義
