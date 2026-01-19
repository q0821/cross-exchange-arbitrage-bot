# API Contract: Public Opportunities API

**Feature**: 065-arbitrage-opportunity-tracking
**Endpoint**: `GET /api/public/opportunities`
**Date**: 2026-01-18

## 概述

公開 API 用於獲取歷史套利機會記錄，供首頁顯示。此 API 不需要認證。

## 請求

### Method & URL

```
GET /api/public/opportunities
```

### Query Parameters

| 參數 | 類型 | 必填 | 預設值 | 說明 |
|------|------|------|--------|------|
| `days` | number | 否 | 7 | 查詢天數範圍（7、30、90） |
| `page` | number | 否 | 1 | 分頁頁碼 |
| `limit` | number | 否 | 20 | 每頁筆數（最大 100） |
| `status` | string | 否 | - | 狀態篩選：`ACTIVE`、`ENDED`、`all` |

### 範例請求

```bash
# 取得最近 7 天已結束的機會（預設）
curl https://example.com/api/public/opportunities

# 取得最近 30 天的記錄，第 2 頁
curl "https://example.com/api/public/opportunities?days=30&page=2"

# 取得所有進行中的機會
curl "https://example.com/api/public/opportunities?status=ACTIVE"
```

## 回應

### 成功回應 (200 OK)

```typescript
interface PublicOpportunitiesResponse {
  success: true;
  data: {
    opportunities: PublicOpportunity[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

interface PublicOpportunity {
  id: string;
  symbol: string;
  longExchange: string;
  shortExchange: string;
  status: 'ACTIVE' | 'ENDED';
  detectedAt: string;           // ISO 8601
  endedAt: string | null;       // ISO 8601 or null
  durationMs: number | null;    // 毫秒
  durationFormatted: string | null;  // "2h 15m" 格式
  initialSpread: number;        // 百分比，如 0.85
  maxSpread: number;
  currentSpread: number;
  initialAPY: number;           // 百分比，如 312.5
  maxAPY: number;
  currentAPY: number;
  longIntervalHours: number;
  shortIntervalHours: number;
}
```

### 範例回應

```json
{
  "success": true,
  "data": {
    "opportunities": [
      {
        "id": "cm4abcd1234",
        "symbol": "BTCUSDT",
        "longExchange": "binance",
        "shortExchange": "okx",
        "status": "ENDED",
        "detectedAt": "2026-01-18T08:30:00.000Z",
        "endedAt": "2026-01-18T10:45:00.000Z",
        "durationMs": 8100000,
        "durationFormatted": "2h 15m",
        "initialSpread": 0.65,
        "maxSpread": 0.92,
        "currentSpread": 0.48,
        "initialAPY": 237.25,
        "maxAPY": 335.80,
        "currentAPY": 175.20,
        "longIntervalHours": 8,
        "shortIntervalHours": 8
      },
      {
        "id": "cm4efgh5678",
        "symbol": "ETHUSDT",
        "longExchange": "gateio",
        "shortExchange": "binance",
        "status": "ACTIVE",
        "detectedAt": "2026-01-18T12:00:00.000Z",
        "endedAt": null,
        "durationMs": null,
        "durationFormatted": null,
        "initialSpread": 0.78,
        "maxSpread": 0.85,
        "currentSpread": 0.82,
        "initialAPY": 284.70,
        "maxAPY": 310.25,
        "currentAPY": 299.30,
        "longIntervalHours": 8,
        "shortIntervalHours": 4
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3
    }
  }
}
```

### 空結果回應 (200 OK)

```json
{
  "success": true,
  "data": {
    "opportunities": [],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 0,
      "totalPages": 0
    }
  }
}
```

### 錯誤回應

#### 400 Bad Request - 參數錯誤

```json
{
  "success": false,
  "error": {
    "code": "INVALID_PARAMETER",
    "message": "days must be one of: 7, 30, 90"
  }
}
```

#### 500 Internal Server Error

```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to fetch opportunities"
  }
}
```

## 速率限制

- 無認證請求：60 次/分鐘
- IP 層級限制

## 快取策略

- Cache-Control: `public, max-age=30`
- 每 30 秒更新一次快取

## 變更記錄

| 版本 | 日期 | 變更 |
|------|------|------|
| 1.0.0 | 2026-01-18 | 初始版本，改用 ArbitrageOpportunity model |
