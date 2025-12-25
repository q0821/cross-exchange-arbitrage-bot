# Quick Start: BingX 交易所整合

**Feature**: 043-bingx-integration
**Date**: 2025-12-25

## Prerequisites

- Node.js 20.x LTS
- pnpm 8+
- PostgreSQL 15+ (Docker Compose 已配置)
- BingX 帳戶和 API Key

## 1. 環境配置

### 1.1 監控用 API Key（.env）

在 `.env` 檔案中新增 BingX API 配置：

```bash
# BingX API (監控用 - 讀取權限即可)
BINGX_API_KEY=your_bingx_api_key
BINGX_API_SECRET=your_bingx_api_secret
```

### 1.2 BingX API Key 權限設定

前往 BingX 網站建立 API Key：

1. 登入 BingX → Account → API Management
2. 點擊 "Create API"
3. 設定權限：
   - **監控用 API**：僅勾選 "Read" 權限
   - **交易用 API**：勾選 "Read" + "Trade" 權限
4. 建議綁定 IP 白名單增加安全性

## 2. 資料庫遷移

執行 Prisma migration 新增 BingX 相關欄位：

```bash
# 建立 migration
pnpm prisma migrate dev --name add-bingx-support

# 或直接推送 schema 變更（開發環境）
pnpm prisma db push
```

## 3. 驗證整合

### 3.1 測試資金費率獲取

```bash
# 啟動開發伺服器
pnpm dev

# 檢查 CLI 日誌，應顯示 BingX 資金費率資料
```

### 3.2 測試 API Key 驗證

```bash
# 透過 API 測試連線
curl -X POST http://localhost:3000/api/api-keys/test \
  -H "Content-Type: application/json" \
  -d '{
    "exchange": "bingx",
    "apiKey": "your_key",
    "apiSecret": "your_secret"
  }'
```

### 3.3 測試餘額查詢

```bash
curl http://localhost:3000/api/balances
```

回應應包含 BingX 餘額：

```json
{
  "balances": [
    { "exchange": "binance", "balanceUSD": 1000.00, "status": "success" },
    { "exchange": "bingx", "balanceUSD": 500.00, "status": "success" }
  ],
  "totalEquityUSD": 1500.00
}
```

## 4. 常見問題

### Q: BingX 資金費率週期如何判斷？

A: BingX 支援 1h、4h、8h 三種週期。系統會自動從 `fetchFundingRate()` 回傳的 `nextFundingTimestamp` 推算週期並記錄在 `fundingInterval` 欄位。

### Q: BingX 測試網如何使用？

A: 目前 BingX 沒有公開的測試網。建議使用小額資金進行測試。

### Q: 停損停利如何運作？

A: 開倉時透過 CCXT `createOrder` 的 `stopLoss` 和 `takeProfit` 參數附加條件單。BingX 原生支援此模式。

### Q: API 限流如何處理？

A: CCXT 內建 `enableRateLimit: true` 會自動處理。BingX API 限流約為 10 req/s。

## 5. 相關檔案

| 檔案 | 說明 |
|------|------|
| `src/connectors/bingx.ts` | BingX connector 實作 |
| `src/connectors/types.ts` | ExchangeName 類型定義 |
| `src/services/trading/adapters/BingxConditionalOrderAdapter.ts` | 停損停利適配器 |
| `.env.example` | 環境變數範例 |

## 6. 下一步

1. 在 Web 界面新增交易用 BingX API Key
2. 嘗試開啟 BingX 對沖持倉
3. 驗證停損停利功能
4. 檢查資金費率收益計算
