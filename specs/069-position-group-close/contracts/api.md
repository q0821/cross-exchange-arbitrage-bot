# API Contracts: 分單持倉合併顯示與批量平倉

**Feature**: 069-position-group-close
**Date**: 2026-01-25
**Status**: Draft

## Overview

本文件定義 Feature 069 的 API 端點規格。

---

## Endpoints

### GET /api/positions

查詢用戶持倉列表，支援組合持倉分組。

#### Request

```http
GET /api/positions HTTP/1.1
Authorization: Bearer <jwt_token>
```

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | string | No | 篩選狀態：`OPEN`, `CLOSED`, `ALL`（預設 `OPEN`） |
| `grouped` | boolean | No | 是否回傳分組格式（預設 `true`） |

#### Response (grouped=true)

```json
{
  "success": true,
  "data": {
    "positions": [
      {
        "id": "clxxx1",
        "groupId": null,
        "symbol": "BTCUSDT",
        "longExchange": "binance",
        "shortExchange": "okx",
        "longPositionSize": "0.001",
        "longEntryPrice": "95000.00",
        "shortPositionSize": "0.001",
        "shortEntryPrice": "95100.00",
        "status": "OPEN",
        "openedAt": "2026-01-25T10:00:00Z"
      }
    ],
    "groups": [
      {
        "groupId": "550e8400-e29b-41d4-a716-446655440000",
        "symbol": "ETHUSDT",
        "longExchange": "binance",
        "shortExchange": "gateio",
        "positions": [
          {
            "id": "clxxx2",
            "groupId": "550e8400-e29b-41d4-a716-446655440000",
            "longPositionSize": "0.1",
            "longEntryPrice": "3200.00",
            "shortPositionSize": "0.1",
            "shortEntryPrice": "3210.00",
            "status": "OPEN",
            "openedAt": "2026-01-25T09:00:00Z"
          },
          {
            "id": "clxxx3",
            "groupId": "550e8400-e29b-41d4-a716-446655440000",
            "longPositionSize": "0.15",
            "longEntryPrice": "3195.00",
            "shortPositionSize": "0.15",
            "shortEntryPrice": "3205.00",
            "status": "OPEN",
            "openedAt": "2026-01-25T09:01:00Z"
          }
        ],
        "aggregate": {
          "totalQuantity": "0.25",
          "avgLongEntryPrice": "3197.00",
          "avgShortEntryPrice": "3207.00",
          "totalFundingPnL": "5.25",
          "totalUnrealizedPnL": "-2.50",
          "positionCount": 2,
          "firstOpenedAt": "2026-01-25T09:00:00Z",
          "stopLossPercent": "2.00",
          "takeProfitPercent": "5.00"
        }
      }
    ]
  }
}
```

#### Response (grouped=false)

```json
{
  "success": true,
  "data": {
    "positions": [
      {
        "id": "clxxx1",
        "groupId": null,
        ...
      },
      {
        "id": "clxxx2",
        "groupId": "550e8400-e29b-41d4-a716-446655440000",
        ...
      },
      {
        "id": "clxxx3",
        "groupId": "550e8400-e29b-41d4-a716-446655440000",
        ...
      }
    ]
  }
}
```

---

### POST /api/positions/group/:groupId/close

批量平倉指定組別的所有持倉。

#### Request

```http
POST /api/positions/group/550e8400-e29b-41d4-a716-446655440000/close HTTP/1.1
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "reason": "MANUAL"
}
```

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `groupId` | UUID | Yes | 組別 ID |

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `reason` | string | No | 平倉原因（預設 `MANUAL`） |

#### Response (Success)

```json
{
  "success": true,
  "data": {
    "status": "success",
    "successCount": 3,
    "failedCount": 0,
    "results": [
      {
        "positionId": "clxxx2",
        "success": true,
        "tradeId": "clyyy1",
        "pnL": "12.50"
      },
      {
        "positionId": "clxxx3",
        "success": true,
        "tradeId": "clyyy2",
        "pnL": "8.75"
      },
      {
        "positionId": "clxxx4",
        "success": true,
        "tradeId": "clyyy3",
        "pnL": "5.00"
      }
    ],
    "totalPnL": "26.25"
  }
}
```

#### Response (Partial Success)

```json
{
  "success": true,
  "data": {
    "status": "partial",
    "successCount": 2,
    "failedCount": 1,
    "results": [
      {
        "positionId": "clxxx2",
        "success": true,
        "tradeId": "clyyy1",
        "pnL": "12.50"
      },
      {
        "positionId": "clxxx3",
        "success": false,
        "error": "Exchange API timeout"
      },
      {
        "positionId": "clxxx4",
        "success": true,
        "tradeId": "clyyy3",
        "pnL": "5.00"
      }
    ],
    "totalPnL": "17.50"
  }
}
```

#### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 400 | `INVALID_GROUP_ID` | groupId 格式無效 |
| 404 | `GROUP_NOT_FOUND` | 找不到該組別的持倉 |
| 409 | `BATCH_CLOSE_IN_PROGRESS` | 該組正在進行批量平倉 |
| 403 | `FORBIDDEN` | 無權限操作該組持倉 |

```json
{
  "success": false,
  "error": {
    "code": "GROUP_NOT_FOUND",
    "message": "No open positions found for group 550e8400-e29b-41d4-a716-446655440000"
  }
}
```

---

## WebSocket Events

### Batch Close Progress

批量平倉進度推送。

#### Event: `position:batch:close:progress`

```json
{
  "event": "position:batch:close:progress",
  "data": {
    "groupId": "550e8400-e29b-41d4-a716-446655440000",
    "current": 2,
    "total": 5,
    "currentPositionId": "clxxx3",
    "status": "closing"
  }
}
```

#### Event: `position:batch:close:success`

```json
{
  "event": "position:batch:close:success",
  "data": {
    "groupId": "550e8400-e29b-41d4-a716-446655440000",
    "successCount": 5,
    "failedCount": 0,
    "totalPnL": "45.75"
  }
}
```

#### Event: `position:batch:close:partial`

```json
{
  "event": "position:batch:close:partial",
  "data": {
    "groupId": "550e8400-e29b-41d4-a716-446655440000",
    "successCount": 3,
    "failedCount": 2,
    "totalPnL": "25.50",
    "failedPositions": [
      {
        "positionId": "clxxx4",
        "error": "Exchange API error"
      },
      {
        "positionId": "clxxx5",
        "error": "Insufficient balance"
      }
    ]
  }
}
```

---

## OpenPosition API Modification

### POST /api/positions/open

修改現有開倉 API，支援 groupId 參數。

#### Request Body (Extended)

```json
{
  "symbol": "BTCUSDT",
  "longExchange": "binance",
  "shortExchange": "okx",
  "quantity": 0.01,
  "leverage": 3,
  "groupId": "550e8400-e29b-41d4-a716-446655440000"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `groupId` | UUID | No | 分單開倉時使用相同的 groupId |

**Note**: 前端分單開倉流程：
1. 第一組：不傳 groupId，API 回傳新 Position（含新生成的 groupId）
2. 後續組：使用第一組回傳的 groupId

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| `GET /api/positions` | 60 requests/minute |
| `POST /api/positions/group/:groupId/close` | 10 requests/minute |

---

## References

- Data Model: `specs/069-position-group-close/data-model.md`
- Existing API: `app/api/positions/route.ts`
- Existing Close API: `app/api/positions/[id]/close/route.ts`
