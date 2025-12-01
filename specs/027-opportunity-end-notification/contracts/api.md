# API Contracts: 套利機會結束監測和通知

**Feature**: 027-opportunity-end-notification
**Date**: 2025-12-01

## 概述

本功能主要擴展現有 API，新增以下變更：
1. Webhook API 支援 `notifyOnDisappear` 欄位
2. 新增機會歷史查詢 API

---

## 1. Webhook API 擴展

### GET /api/notifications/webhooks

**Response 變更** - 新增 `notifyOnDisappear` 欄位：

```json
{
  "webhooks": [
    {
      "id": "clx123...",
      "name": "My Discord",
      "platform": "discord",
      "isEnabled": true,
      "threshold": 800,
      "notifyOnDisappear": true,
      "createdAt": "2025-12-01T00:00:00Z",
      "updatedAt": "2025-12-01T00:00:00Z"
    }
  ]
}
```

### POST /api/notifications/webhooks

**Request Body 變更** - 新增可選 `notifyOnDisappear` 欄位：

```json
{
  "name": "My Discord",
  "platform": "discord",
  "webhookUrl": "https://discord.com/api/webhooks/...",
  "threshold": 800,
  "notifyOnDisappear": true
}
```

| 欄位 | 類型 | 必填 | 預設值 | 說明 |
|------|------|------|--------|------|
| notifyOnDisappear | boolean | 否 | true | 是否接收機會結束通知 |

### PUT /api/notifications/webhooks/[id]

**Request Body 變更** - 新增可選 `notifyOnDisappear` 欄位：

```json
{
  "name": "My Discord",
  "isEnabled": true,
  "threshold": 800,
  "notifyOnDisappear": false
}
```

---

## 2. 機會歷史 API（新增）

### GET /api/opportunities/history

查詢用戶的套利機會歷史記錄。

**Query Parameters**:

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| limit | number | 否 | 每頁筆數，預設 20，最大 100 |
| offset | number | 否 | 分頁偏移，預設 0 |
| symbol | string | 否 | 篩選特定交易對 |
| startDate | string | 否 | 起始日期 (ISO8601) |
| endDate | string | 否 | 結束日期 (ISO8601) |

**Response**:

```json
{
  "histories": [
    {
      "id": "clx456...",
      "symbol": "BTCUSDT",
      "longExchange": "binance",
      "shortExchange": "okx",
      "detectedAt": "2025-12-01T08:30:00Z",
      "disappearedAt": "2025-12-01T15:45:00Z",
      "durationMs": 26100000,
      "durationFormatted": "7 小時 15 分鐘",
      "initialSpread": 0.009,
      "maxSpread": 0.015,
      "maxSpreadAt": "2025-12-01T12:30:00Z",
      "finalSpread": 0.006,
      "longIntervalHours": 8,
      "shortIntervalHours": 4,
      "longSettlementCount": 1,
      "shortSettlementCount": 2,
      "totalFundingProfit": 0.032,
      "totalCost": 0.002,
      "netProfit": 0.030,
      "realizedAPY": 1460.0,
      "notificationCount": 3,
      "createdAt": "2025-12-01T15:46:00Z"
    }
  ],
  "pagination": {
    "total": 42,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

**Error Responses**:

| Status | Code | 說明 |
|--------|------|------|
| 401 | UNAUTHORIZED | 未登入 |
| 400 | INVALID_PARAMS | 參數錯誤 |

### GET /api/opportunities/history/[id]

查詢單一機會歷史的詳細資訊（包含結算記錄）。

**Response**:

```json
{
  "id": "clx456...",
  "symbol": "BTCUSDT",
  "longExchange": "binance",
  "shortExchange": "okx",
  "detectedAt": "2025-12-01T08:30:00Z",
  "disappearedAt": "2025-12-01T15:45:00Z",
  "durationMs": 26100000,
  "durationFormatted": "7 小時 15 分鐘",
  "initialSpread": 0.009,
  "maxSpread": 0.015,
  "maxSpreadAt": "2025-12-01T12:30:00Z",
  "finalSpread": 0.006,
  "longIntervalHours": 8,
  "shortIntervalHours": 4,
  "settlementRecords": [
    {
      "side": "short",
      "timestamp": "2025-12-01T08:00:00Z",
      "rate": 0.0012
    },
    {
      "side": "short",
      "timestamp": "2025-12-01T12:00:00Z",
      "rate": 0.0010
    },
    {
      "side": "long",
      "timestamp": "2025-12-01T08:00:00Z",
      "rate": -0.0008
    }
  ],
  "longSettlementCount": 1,
  "shortSettlementCount": 2,
  "totalFundingProfit": 0.032,
  "totalCost": 0.002,
  "netProfit": 0.030,
  "realizedAPY": 1460.0,
  "notificationCount": 3,
  "createdAt": "2025-12-01T15:46:00Z"
}
```

---

## 3. Discord/Slack 通知格式

### 機會結束通知 - Discord Embed

```json
{
  "embeds": [{
    "title": "📉 套利機會結束：BTCUSDT",
    "color": 9807270,
    "fields": [
      {
        "name": "📍 交易對",
        "value": "做多：**BINANCE** / 做空：**OKX**",
        "inline": false
      },
      {
        "name": "⏱️ 持續時間",
        "value": "開始：08:30 → 結束：15:45\n持續：7 小時 15 分鐘",
        "inline": false
      },
      {
        "name": "📊 費差統計",
        "value": "初始：0.90% → 最高：1.50%（12:30）→ 結束：0.60%",
        "inline": false
      },
      {
        "name": "💰 模擬收益",
        "value": "結算次數：3 次（做多 1 + 做空 2）\n總費率收益：+3.20%\n開平倉成本：-0.20%\n淨收益：**+3.00%**\n實際 APY：**1460%**",
        "inline": false
      },
      {
        "name": "📬 通知次數",
        "value": "5 次",
        "inline": true
      }
    ],
    "footer": {
      "text": "💡 此機會的年化收益已低於您設定的閾值"
    },
    "timestamp": "2025-12-01T15:45:00Z"
  }]
}
```

### 機會結束通知 - Slack Block Kit

```json
{
  "blocks": [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": "📉 套利機會結束：BTCUSDT"
      }
    },
    {
      "type": "section",
      "fields": [
        {
          "type": "mrkdwn",
          "text": "*📍 交易對*\n做多：BINANCE / 做空：OKX"
        },
        {
          "type": "mrkdwn",
          "text": "*⏱️ 持續時間*\n開始：08:30 → 結束：15:45\n持續：7 小時 15 分鐘"
        }
      ]
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*📊 費差統計*\n初始：0.90% → 最高：1.50%（12:30）→ 結束：0.60%"
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*💰 模擬收益*\n結算次數：3 次（做多 1 + 做空 2）\n總費率收益：+3.20%\n開平倉成本：-0.20%\n淨收益：*+3.00%*\n實際 APY：*1460%*"
      }
    },
    {
      "type": "context",
      "elements": [
        {
          "type": "mrkdwn",
          "text": "📬 通知次數：5 次 | 💡 此機會的年化收益已低於您設定的閾值"
        }
      ]
    }
  ]
}
```

---

## 4. Zod Schemas

### Webhook 擴展 Schema

```typescript
// src/models/NotificationWebhook.ts

export const NotificationWebhookSchema = z.object({
  id: z.string().cuid(),
  userId: z.string(),
  platform: z.enum(['discord', 'slack']),
  webhookUrl: z.string().url(),
  name: z.string().min(1).max(100),
  isEnabled: z.boolean().default(true),
  threshold: z.number().min(0).max(10000).default(800),
  notifyOnDisappear: z.boolean().default(true),  // 新增
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CreateWebhookSchema = z.object({
  name: z.string().min(1).max(100),
  platform: z.enum(['discord', 'slack']),
  webhookUrl: z.string().url(),
  threshold: z.number().min(0).max(10000).optional().default(800),
  notifyOnDisappear: z.boolean().optional().default(true),  // 新增
});

export const UpdateWebhookSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  isEnabled: z.boolean().optional(),
  threshold: z.number().min(0).max(10000).optional(),
  notifyOnDisappear: z.boolean().optional(),  // 新增
});
```

### 機會歷史 Schema

```typescript
// src/models/OpportunityHistory.ts

export const OpportunityHistorySchema = z.object({
  id: z.string().cuid(),
  symbol: z.string().min(1).max(20),
  longExchange: z.string().min(1).max(20),
  shortExchange: z.string().min(1).max(20),
  detectedAt: z.date(),
  disappearedAt: z.date(),
  durationMs: z.bigint(),
  initialSpread: z.number().min(0).max(1),
  maxSpread: z.number().min(0).max(1),
  maxSpreadAt: z.date(),
  finalSpread: z.number().min(0).max(1),
  longIntervalHours: z.number().int().refine(v => [1, 4, 8].includes(v)),
  shortIntervalHours: z.number().int().refine(v => [1, 4, 8].includes(v)),
  settlementRecords: z.array(z.object({
    side: z.enum(['long', 'short']),
    timestamp: z.string().datetime(),
    rate: z.number(),
  })),
  longSettlementCount: z.number().int().min(0),
  shortSettlementCount: z.number().int().min(0),
  totalFundingProfit: z.number(),
  totalCost: z.number(),
  netProfit: z.number(),
  realizedAPY: z.number(),
  notificationCount: z.number().int().min(1),
  userId: z.string(),
  createdAt: z.date(),
});

export const HistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
  symbol: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});
```
