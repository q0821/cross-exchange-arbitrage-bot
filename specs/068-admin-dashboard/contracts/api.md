# API Contracts: 平台管理後臺

**Feature**: 068-admin-dashboard
**Date**: 2026-01-23

## Base URL

所有 Admin API 路徑前綴: `/api/admin`

## Authentication

所有 API 需要 Admin 權限：
- Cookie: `token` (JWT with `role: 'ADMIN'`)
- 或 Header: `Authorization: Bearer <token>`

未認證回傳 `401 Unauthorized`
非 Admin 角色回傳 `403 Forbidden`

---

## 1. 認證 API

### POST /api/admin/auth/login

管理員登入（與一般用戶登入分開）

**Request Body:**
```json
{
  "email": "admin@example.com",
  "password": "securePassword123"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "clxxx...",
      "email": "admin@example.com",
      "role": "ADMIN"
    }
  }
}
```

**Error Responses:**
- `400` - 驗證失敗
- `401` - 帳密錯誤
- `403` - 非管理員帳戶
- `423` - 帳戶已鎖定

---

## 2. 儀表板 API

### GET /api/admin/dashboard

取得平台統計數據

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "users": {
      "total": 150,
      "active": 145,
      "inactive": 5,
      "todayNew": 3,
      "weekActive": 89,
      "monthActive": 120
    },
    "positions": {
      "activeCount": 45,
      "byExchange": {
        "binance": 20,
        "okx": 15,
        "gateio": 5,
        "mexc": 3,
        "bingx": 2
      }
    },
    "trades": {
      "closedCount": 1250,
      "totalPnL": "15234.56",
      "averageROI": "2.35",
      "todayCount": 12,
      "todayPnL": "234.56"
    }
  }
}
```

---

## 3. 用戶管理 API

### GET /api/admin/users

取得用戶列表（分頁）

**Query Parameters:**
| 參數 | 類型 | 預設 | 說明 |
|------|------|------|------|
| page | number | 1 | 頁碼 |
| limit | number | 20 | 每頁筆數 (max: 100) |
| search | string | - | Email 搜尋 |
| status | string | all | 'all', 'active', 'inactive' |
| sortBy | string | createdAt | 'createdAt', 'email' |
| sortOrder | string | desc | 'asc', 'desc' |

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "clxxx...",
        "email": "user@example.com",
        "role": "USER",
        "isActive": true,
        "createdAt": "2026-01-15T10:30:00Z",
        "lastLoginAt": "2026-01-23T08:00:00Z",
        "positionCount": 2,
        "tradeCount": 15
      }
    ],
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8
  }
}
```

---

### POST /api/admin/users

新增用戶

**Request Body:**
```json
{
  "email": "newuser@example.com",
  "role": "USER"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "clxxx...",
      "email": "newuser@example.com",
      "role": "USER",
      "isActive": true,
      "createdAt": "2026-01-23T12:00:00Z"
    },
    "initialPassword": "Temp@Pass123"
  }
}
```

**Error Responses:**
- `400` - 驗證失敗
- `409` - Email 已存在

---

### GET /api/admin/users/:id

取得用戶詳情

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "clxxx...",
    "email": "user@example.com",
    "role": "USER",
    "isActive": true,
    "createdAt": "2026-01-15T10:30:00Z",
    "lastLoginAt": "2026-01-23T08:00:00Z",
    "positionCount": 2,
    "tradeCount": 15,
    "failedLoginAttempts": 0,
    "lockedUntil": null,
    "passwordChangedAt": "2026-01-20T14:00:00Z",
    "timeBasisPreference": 8,
    "apiKeyCount": 3,
    "totalPnL": "1234.56"
  }
}
```

**Error Responses:**
- `404` - 用戶不存在

---

### PATCH /api/admin/users/:id

更新用戶資訊

**Request Body:**
```json
{
  "email": "newemail@example.com"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "clxxx...",
    "email": "newemail@example.com",
    "role": "USER",
    "isActive": true
  }
}
```

**Error Responses:**
- `400` - 驗證失敗
- `404` - 用戶不存在
- `409` - Email 已被使用

---

### DELETE /api/admin/users/:id

刪除用戶

**Request Body:**
```json
{
  "confirmText": "DELETE"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "用戶已刪除"
}
```

**Error Responses:**
- `400` - 確認文字不正確
- `403` - 無法刪除自己
- `404` - 用戶不存在
- `409` - 用戶有活躍持倉，無法刪除

---

### POST /api/admin/users/:id/suspend

停用用戶

**Request Body:**
```json
{
  "confirm": true
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "clxxx...",
    "isActive": false
  },
  "warning": null
}
```

**Warning Response (200):**（用戶有活躍持倉時）
```json
{
  "success": true,
  "data": {
    "id": "clxxx...",
    "isActive": false
  },
  "warning": "此用戶有 2 個活躍持倉，停用後仍需手動處理"
}
```

**Error Responses:**
- `400` - 確認參數缺失
- `403` - 無法停用自己
- `404` - 用戶不存在

---

### POST /api/admin/users/:id/enable

啟用用戶

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "clxxx...",
    "isActive": true
  }
}
```

**Error Responses:**
- `404` - 用戶不存在

---

### POST /api/admin/users/:id/reset-password

重設用戶密碼

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "newPassword": "NewTemp@Pass456"
  }
}
```

**Error Responses:**
- `404` - 用戶不存在

---

### GET /api/admin/users/:id/trades

取得用戶交易記錄

**Query Parameters:**
| 參數 | 類型 | 預設 | 說明 |
|------|------|------|------|
| page | number | 1 | 頁碼 |
| limit | number | 20 | 每頁筆數 |
| status | string | all | 'all', 'open', 'closed' |
| startDate | ISO date | - | 開始日期 |
| endDate | ISO date | - | 結束日期 |

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "positions": [
      {
        "id": "clxxx...",
        "symbol": "BTCUSDT",
        "status": "CLOSED",
        "longExchange": "binance",
        "shortExchange": "okx",
        "longEntryPrice": "65000.00",
        "shortEntryPrice": "65050.00",
        "openFundingRateLong": "0.0001",
        "openFundingRateShort": "-0.0002",
        "openedAt": "2026-01-20T10:00:00Z",
        "closedAt": "2026-01-21T14:00:00Z",
        "trade": {
          "longExitPrice": "65100.00",
          "shortExitPrice": "65080.00",
          "priceDiffPnL": "20.00",
          "fundingRatePnL": "15.50",
          "totalPnL": "35.50",
          "roi": "1.23",
          "holdingDuration": 100800
        }
      }
    ],
    "total": 15,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

## 4. 平台交易 API

### GET /api/admin/trades

取得平台所有交易

**Query Parameters:**
| 參數 | 類型 | 預設 | 說明 |
|------|------|------|------|
| page | number | 1 | 頁碼 |
| limit | number | 20 | 每頁筆數 |
| userId | string | - | 篩選特定用戶 |
| symbol | string | - | 篩選交易對 |
| startDate | ISO date | - | 開始日期 |
| endDate | ISO date | - | 結束日期 |
| sortBy | string | closedAt | 'closedAt', 'totalPnL' |
| sortOrder | string | desc | 'asc', 'desc' |

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "clxxx...",
        "userId": "clyyy...",
        "userEmail": "user@example.com",
        "symbol": "BTCUSDT",
        "longExchange": "binance",
        "shortExchange": "okx",
        "openedAt": "2026-01-20T10:00:00Z",
        "closedAt": "2026-01-21T14:00:00Z",
        "holdingDuration": 100800,
        "priceDiffPnL": "20.00",
        "fundingRatePnL": "15.50",
        "totalPnL": "35.50",
        "roi": "1.23",
        "status": "SUCCESS"
      }
    ],
    "total": 1250,
    "page": 1,
    "limit": 20,
    "totalPages": 63
  }
}
```

---

### GET /api/admin/trades/export

匯出交易記錄 CSV

**Query Parameters:**
同 `GET /api/admin/trades`（不含分頁參數）

**Success Response (200):**
- Content-Type: `text/csv`
- Content-Disposition: `attachment; filename="trades_20260123.csv"`

**CSV 欄位:**
```
id,userEmail,symbol,longExchange,shortExchange,openedAt,closedAt,holdingDuration,priceDiffPnL,fundingRatePnL,totalPnL,roi,status
```

**Error Responses:**
- `400` - 匯出資料過多（超過 10000 筆需縮小範圍）

---

## 5. 錯誤格式

所有錯誤回應遵循統一格式：

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "人類可讀的錯誤訊息"
  }
}
```

### 錯誤碼對照

| Code | HTTP Status | 說明 |
|------|-------------|------|
| UNAUTHORIZED | 401 | 未認證 |
| FORBIDDEN | 403 | 權限不足 |
| NOT_FOUND | 404 | 資源不存在 |
| CONFLICT | 409 | 資源衝突 |
| VALIDATION_ERROR | 400 | 驗證失敗 |
| ACCOUNT_LOCKED | 423 | 帳戶已鎖定 |
| INTERNAL_ERROR | 500 | 內部錯誤 |
