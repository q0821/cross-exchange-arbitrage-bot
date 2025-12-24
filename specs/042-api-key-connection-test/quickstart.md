# Quickstart: API Key 連線測試

**Feature**: 042-api-key-connection-test
**Date**: 2025-12-24

## 快速驗證清單

### 1. 單元測試驗證

```bash
# 執行 ApiKeyValidator 測試
pnpm test tests/unit/services/ApiKeyValidator.test.ts --run

# 預期結果：所有測試通過
```

### 2. API 端點驗證

#### 測試新 API Key（POST /api/api-keys/test）

```bash
# 使用 curl 測試（需先登入獲取 session）
curl -X POST http://localhost:3000/api/api-keys/test \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" \
  -d '{
    "exchange": "binance",
    "environment": "TESTNET",
    "apiKey": "your-api-key",
    "apiSecret": "your-api-secret"
  }'

# 預期回應（成功）：
{
  "success": true,
  "data": {
    "isValid": true,
    "hasReadPermission": true,
    "hasTradePermission": true,
    "details": {
      "balance": { "total": 1000, "available": 800, "currency": "USDT" },
      "responseTime": 234
    }
  }
}

# 預期回應（失敗）：
{
  "success": true,
  "data": {
    "isValid": false,
    "hasReadPermission": false,
    "hasTradePermission": false
  },
  "error": {
    "code": "INVALID_API_KEY",
    "message": "無效的 API Key"
  }
}
```

#### 重新測試已儲存的 API Key（POST /api/api-keys/{id}/test）

```bash
curl -X POST http://localhost:3000/api/api-keys/cm123abc/test \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN"

# 預期回應同上
```

### 3. 前端 UI 驗證

1. 啟動開發伺服器：
   ```bash
   pnpm dev
   ```

2. 訪問 API Key 設定頁面：
   ```
   http://localhost:3000/settings/api-keys
   ```

3. 驗證場景：

   | 場景 | 操作 | 預期結果 |
   |------|------|---------|
   | 新增測試 | 填入有效 API Key → 點擊「測試連線」 | 顯示綠色成功訊息和權限狀態 |
   | 無效 Key | 填入無效 API Key → 點擊「測試連線」 | 顯示紅色錯誤訊息 |
   | OKX 缺少 Passphrase | 選擇 OKX → 不填 Passphrase → 點擊「測試連線」 | 顯示需要 Passphrase 提示 |
   | 重新測試 | 在列表中點擊「重新測試」 | 顯示測試中狀態 → 更新驗證時間 |
   | 超時處理 | 在網路不穩時測試 | 20 秒後顯示超時訊息 |
   | 重複請求防護 | 快速連續點擊「測試連線」 | 第二次點擊被忽略 |

### 4. 各交易所測試

| 交易所 | 環境 | 測試要點 |
|--------|------|---------|
| Binance | TESTNET | 驗證 testnet.binancefuture.com 連線 |
| Binance | MAINNET | 驗證 fapi.binance.com 連線 |
| OKX | TESTNET | 驗證 sandboxMode，需要 passphrase |
| OKX | MAINNET | 驗證正式環境，需要 passphrase |
| Gate.io | MAINNET | 驗證 Futures 帳戶餘額 |
| MEXC | MAINNET | 驗證 Futures 帳戶餘額 |

### 5. 錯誤場景測試

```bash
# 測試超時（模擬慢網路）
# 在 DevTools 中設置 Network throttling 為 Slow 3G
# 預期：20 秒後顯示超時訊息

# 測試無效 API Key
curl -X POST http://localhost:3000/api/api-keys/test \
  -H "Content-Type: application/json" \
  -H "Cookie: ..." \
  -d '{"exchange": "binance", "environment": "MAINNET", "apiKey": "invalid", "apiSecret": "invalid"}'
# 預期：error.code = "INVALID_API_KEY"

# 測試 IP 限制（如果交易所設置了 IP 白名單）
# 預期：error.code = "IP_NOT_WHITELISTED"
```

### 6. 日誌驗證

確認 Pino 結構化日誌正確記錄：

```bash
# 查看伺服器日誌
pnpm dev 2>&1 | grep "API key"

# 預期日誌格式：
{"level":"info","time":"...","exchange":"binance","environment":"MAINNET","msg":"API key validation started"}
{"level":"info","time":"...","exchange":"binance","isValid":true,"hasTradePermission":true,"responseTime":234,"msg":"API key validated"}
{"level":"error","time":"...","exchange":"binance","error":"Invalid API-key","msg":"API key validation failed"}
```

## 驗收標準

- [ ] 所有單元測試通過
- [ ] POST /api/api-keys/test 正常運作
- [ ] POST /api/api-keys/{id}/test 正常運作
- [ ] 前端「測試連線」按鈕正常運作
- [ ] 前端「重新測試」按鈕正常運作
- [ ] 所有 4 個交易所測試通過（至少各測一個環境）
- [ ] 超時處理正常（20 秒）
- [ ] 錯誤訊息清楚易懂
- [ ] 測試成功後更新 lastValidatedAt
- [ ] 測試失敗仍可儲存 API Key（顯示警告）
