# API Contract: 公開套利機會歷史

**Feature**: 064-public-landing-page
**Date**: 2026-01-18

## Endpoint

```
GET /api/public/opportunities
```

## 認證

**無需認證** - 此為公開 API

## 速率限制

- 每 IP 每分鐘 30 次請求
- 超過限制回傳 `429 Too Many Requests`

## Request

### Query Parameters

| 參數 | 類型 | 必填 | 預設值 | 說明 |
|------|------|------|--------|------|
| `page` | integer | 否 | 1 | 頁碼（從 1 開始） |
| `limit` | integer | 否 | 20 | 每頁筆數（最大 100） |
| `days` | integer | 否 | 90 | 時間範圍（僅允許 7, 30, 90） |

### 範例請求

```bash
# 預設查詢（90 天、第 1 頁、20 筆）
curl https://example.com/api/public/opportunities

# 指定參數
curl "https://example.com/api/public/opportunities?days=30&page=2&limit=10"
```

## Response

### 成功回應 (200 OK)

```json
{
  "success": true,
  "data": [
    {
      "id": "clx1234567890",
      "symbol": "BTCUSDT",
      "longExchange": "binance",
      "shortExchange": "okx",
      "detectedAt": "2026-01-17T08:00:00.000Z",
      "disappearedAt": "2026-01-17T16:30:00.000Z",
      "durationMs": 30600000,
      "durationFormatted": "8 小時 30 分鐘",
      "initialSpread": 0.000850,
      "maxSpread": 0.001200,
      "maxSpreadAt": "2026-01-17T12:00:00.000Z",
      "finalSpread": 0.000750,
      "longIntervalHours": 8,
      "shortIntervalHours": 8,
      "longSettlementCount": 1,
      "shortSettlementCount": 1,
      "totalFundingProfit": 0.000950,
      "totalCost": 0.002000,
      "netProfit": -0.001050,
      "realizedAPY": 45.67
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 156,
    "totalPages": 8
  },
  "filter": {
    "days": 90
  }
}
```

### 欄位說明

| 欄位 | 類型 | 說明 |
|------|------|------|
| `id` | string | 記錄 ID |
| `symbol` | string | 交易對（如 BTCUSDT） |
| `longExchange` | string | 做多交易所 |
| `shortExchange` | string | 做空交易所 |
| `detectedAt` | string (ISO 8601) | 機會發現時間 |
| `disappearedAt` | string (ISO 8601) | 機會消失時間 |
| `durationMs` | number | 持續時間（毫秒） |
| `durationFormatted` | string | 持續時間（人類可讀） |
| `initialSpread` | number | 初始費差 |
| `maxSpread` | number | 最大費差 |
| `maxSpreadAt` | string (ISO 8601) | 最大費差時間 |
| `finalSpread` | number | 最終費差 |
| `longIntervalHours` | number | 多方結算週期（小時） |
| `shortIntervalHours` | number | 空方結算週期（小時） |
| `longSettlementCount` | number | 多方結算次數 |
| `shortSettlementCount` | number | 空方結算次數 |
| `totalFundingProfit` | number | 總資費收益 |
| `totalCost` | number | 總成本 |
| `netProfit` | number | 淨收益 |
| `realizedAPY` | number | 實現年化報酬率（%） |

### 錯誤回應

#### 400 Bad Request - 參數錯誤

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "days must be 7, 30, or 90"
  }
}
```

#### 429 Too Many Requests - 速率限制

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later.",
    "retryAfter": 45
  }
}
```

Headers:
```
Retry-After: 45
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1705574400
```

#### 500 Internal Server Error

```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred"
  }
}
```

## Response Headers

| Header | 說明 |
|--------|------|
| `X-Correlation-Id` | 請求追蹤 ID |
| `X-RateLimit-Limit` | 速率限制上限 |
| `X-RateLimit-Remaining` | 剩餘請求數 |
| `X-RateLimit-Reset` | 限制重置時間（Unix timestamp） |
| `Cache-Control` | `no-store`（不快取） |

## 安全考量

### 排除欄位

以下敏感欄位**不會**包含在回應中：

- `userId` - 用戶隱私
- `notificationCount` - 用戶行為資料
- `settlementRecords` - 詳細結算記錄
- `createdAt` - 內部管理用

### 資料範圍限制

- 最多查詢 90 天內的資料
- 每頁最多 100 筆
- 聚合所有用戶的記錄（無法按用戶篩選）
