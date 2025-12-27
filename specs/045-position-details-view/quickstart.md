# Quickstart: 持倉詳情查看功能

**Feature**: 045-position-details-view
**Date**: 2025-12-28

## Prerequisites

- Node.js 20.x LTS
- pnpm 8.x
- PostgreSQL 15+ with TimescaleDB
- Docker (for local database)
- 至少一個有效的交易所 API Key（Binance、OKX、MEXC、Gate.io 或 BingX）

## Setup

### 1. 確認環境

```bash
# 確認 Node.js 版本
node --version  # v20.x.x

# 確認 pnpm 版本
pnpm --version  # 8.x.x

# 確認 Docker 運行中
docker ps
```

### 2. 啟動資料庫

```bash
# 如果資料庫尚未啟動
docker-compose up -d postgres
```

### 3. 安裝依賴

```bash
pnpm install
```

### 4. 確認 Prisma 已同步

```bash
pnpm prisma generate
```

## Development

### 啟動開發伺服器

```bash
pnpm dev
```

### 訪問持倉頁面

打開瀏覽器訪問：`http://localhost:3000/positions`

### 測試持倉詳情功能

1. 確認有至少一個狀態為 `OPEN` 的持倉
2. 在持倉卡片上點擊「查看詳情」按鈕
3. 觀察展開的詳情面板，應顯示：
   - 開倉價格（多頭/空頭）
   - 當前價格（即時查詢）
   - 未實現損益
   - 資金費率明細（如有）
   - 預估年化報酬率

## API Testing

### 使用 curl 測試 API

```bash
# 獲取持倉詳情（需要先登入獲取 session cookie）
curl -X GET http://localhost:3000/api/positions/{position_id}/details \
  -H "Cookie: session=<your_session_cookie>"
```

### 預期回應

```json
{
  "success": true,
  "data": {
    "positionId": "cm5abc123",
    "symbol": "BTCUSDT",
    "longExchange": "binance",
    "shortExchange": "okx",
    "longEntryPrice": "95000.00",
    "shortEntryPrice": "95010.00",
    "longCurrentPrice": 95100.50,
    "shortCurrentPrice": 95105.20,
    "priceQuerySuccess": true,
    "totalUnrealizedPnL": 0.053,
    "fundingFees": {
      "longTotal": "-0.12",
      "shortTotal": "0.18",
      "netTotal": "0.06"
    },
    "fundingFeeQuerySuccess": true,
    "annualizedReturn": {
      "value": 52.36,
      "totalPnL": 0.113,
      "margin": 950.05,
      "holdingHours": 2.5
    },
    "queriedAt": "2025-12-28T12:30:00Z"
  }
}
```

## Running Tests

### 單元測試

```bash
# 運行所有單元測試
pnpm test

# 運行特定測試
pnpm test PositionDetailsService
pnpm test PositionDetailsPanel
```

### 整合測試

```bash
# 運行整合測試
pnpm test:integration position-details
```

## Troubleshooting

### 問題：當前價格顯示 N/A

**可能原因**：
- 交易所 API 請求失敗
- 網路連線問題
- API Rate Limit

**解決方式**：
1. 檢查控制台日誌
2. 點擊「重試」按鈕
3. 確認交易所 API Key 有效

### 問題：資金費率明細為空

**可能原因**：
- 持倉時間太短，尚未跨過整點結算時間
- 交易所 API 查詢失敗

**解決方式**：
1. 等待下一個整點後重新查詢
2. 檢查控制台日誌中的錯誤訊息

### 問題：年化報酬率顯示「資料不足」

**可能原因**：
- 持倉時間少於 1 分鐘
- 沒有任何損益資料

**解決方式**：
- 等待更長時間後重新查看

## File Structure

```
# 新增/修改的檔案
app/api/positions/[id]/details/route.ts          # API endpoint
src/services/trading/PositionDetailsService.ts   # 後端服務
src/types/trading.ts                             # 新增類型定義

app/(dashboard)/positions/
├── components/
│   ├── PositionCard.tsx                         # 修改：加入展開功能
│   ├── PositionDetailsPanel.tsx                 # 新增
│   ├── FundingFeeBreakdown.tsx                  # 新增
│   └── AnnualizedReturnDisplay.tsx              # 新增
└── hooks/
    └── usePositionDetails.ts                    # 新增

tests/
├── unit/services/PositionDetailsService.test.ts
└── integration/position-details-api.test.ts
```

## Next Steps

1. 完成 `/speckit.tasks` 生成任務清單
2. 按 TDD 流程實作：
   - 先寫測試
   - 確認測試失敗
   - 寫最小實作
   - 確認測試通過
   - 重構
