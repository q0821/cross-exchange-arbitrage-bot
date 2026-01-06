# API Changes: 通知價差過濾

**Feature**: 057-notification-price-filter
**Date**: 2026-01-06

## Overview

此功能只涉及對現有 Webhook API 的擴展，新增 `requireFavorablePrice` 欄位。

---

## Endpoint Changes

### 1. GET /api/notifications/webhooks

**Response Change**:

```json
{
  "success": true,
  "data": {
    "webhooks": [
      {
        "id": "string",
        "platform": "discord" | "slack",
        "name": "string",
        "isEnabled": true,
        "threshold": 800,
        "notifyOnDisappear": true,
        "notificationMinutes": [50],
        "requireFavorablePrice": false,  // NEW
        "createdAt": "2026-01-06T00:00:00Z",
        "updatedAt": "2026-01-06T00:00:00Z"
      }
    ]
  }
}
```

---

### 2. POST /api/notifications/webhooks

**Request Change**:

```json
{
  "platform": "discord",
  "webhookUrl": "https://discord.com/api/webhooks/...",
  "name": "My Webhook",
  "threshold": 800,
  "notifyOnDisappear": true,
  "notificationMinutes": [50],
  "requireFavorablePrice": false  // NEW (optional, defaults to false)
}
```

**Response Change**:

Same as GET - includes `requireFavorablePrice` field.

---

### 3. PUT /api/notifications/webhooks/[id]

**Request Change**:

```json
{
  "name": "Updated Name",
  "threshold": 900,
  "notifyOnDisappear": true,
  "notificationMinutes": [40, 50],
  "requireFavorablePrice": true  // NEW (optional)
}
```

**Response Change**:

Same as GET - includes `requireFavorablePrice` field.

---

## Field Specification

### requireFavorablePrice

| Property | Value |
|----------|-------|
| Type | `boolean` |
| Required | No |
| Default | `false` |
| Description | 當設為 `true` 時，只在淨收益 > 0 且價差方向正確時發送通知 |

---

## Backward Compatibility

- 現有 API 客戶端不發送 `requireFavorablePrice` 時，使用預設值 `false`
- 現有 Webhook 的行為不變（預設關閉過濾）
- 新欄位為可選，不破壞現有 API 合約

---

## Error Cases

無新增錯誤案例。`requireFavorablePrice` 為 Boolean 類型，無效值會被 Zod 驗證拒絕。

```json
{
  "success": false,
  "message": "Validation error",
  "errors": [
    {
      "field": "requireFavorablePrice",
      "message": "Expected boolean, received string"
    }
  ]
}
```
