# API Contracts: Simulated APY Tracking

## Base URL

```
/api/simulated-tracking
```

## Authentication

All endpoints require authentication via Bearer token in Authorization header.

```
Authorization: Bearer <jwt_token>
```

---

## Endpoints

### 1. Start Tracking

**POST** `/api/simulated-tracking`

Start tracking an arbitrage opportunity.

**Request Body**:
```json
{
  "symbol": "BTCUSDT",
  "longExchange": "binance",
  "shortExchange": "okx",
  "simulatedCapital": 10000,
  "autoStopOnExpire": true
}
```

**Success Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "tracking": {
      "id": "clxyz123...",
      "symbol": "BTCUSDT",
      "longExchange": "binance",
      "shortExchange": "okx",
      "simulatedCapital": 10000,
      "autoStopOnExpire": true,
      "initialSpread": 0.0073,
      "initialAPY": 850.5,
      "status": "ACTIVE",
      "startedAt": "2025-12-02T10:00:00Z",
      "totalFundingProfit": 0,
      "totalSettlements": 0
    }
  }
}
```

**Error Responses**:

- 400 Bad Request (validation error):
```json
{
  "success": false,
  "error": "Bad Request",
  "message": "Long and short exchanges must be different"
}
```

- 400 Bad Request (limit reached):
```json
{
  "success": false,
  "error": "Bad Request",
  "message": "Maximum 5 active trackings allowed. Please stop an existing tracking first."
}
```

- 409 Conflict (duplicate):
```json
{
  "success": false,
  "error": "Conflict",
  "message": "Already tracking this opportunity"
}
```

---

### 2. List Trackings

**GET** `/api/simulated-tracking`

Get all trackings for the authenticated user.

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| status | string | "all" | Filter: ACTIVE, STOPPED, EXPIRED, all |
| limit | number | 20 | Max items (1-100) |
| offset | number | 0 | Pagination offset |

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "trackings": [
      {
        "id": "clxyz123...",
        "symbol": "BTCUSDT",
        "longExchange": "binance",
        "shortExchange": "okx",
        "simulatedCapital": 10000,
        "status": "ACTIVE",
        "startedAt": "2025-12-02T10:00:00Z",
        "totalFundingProfit": 125.50,
        "totalSettlements": 5,
        "currentAPY": 820.3
      }
    ],
    "pagination": {
      "total": 8,
      "limit": 20,
      "offset": 0,
      "hasMore": false
    }
  }
}
```

---

### 3. Get Tracking Detail

**GET** `/api/simulated-tracking/{id}`

Get detailed information for a specific tracking.

**Path Parameters**:
| Param | Type | Description |
|-------|------|-------------|
| id | string | Tracking ID |

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "tracking": {
      "id": "clxyz123...",
      "symbol": "BTCUSDT",
      "longExchange": "binance",
      "shortExchange": "okx",
      "simulatedCapital": 10000,
      "autoStopOnExpire": true,
      "initialSpread": 0.0073,
      "initialAPY": 850.5,
      "initialLongRate": -0.0012,
      "initialShortRate": 0.0061,
      "longIntervalHours": 8,
      "shortIntervalHours": 8,
      "status": "ACTIVE",
      "startedAt": "2025-12-02T10:00:00Z",
      "stoppedAt": null,
      "totalFundingProfit": 125.50,
      "totalSettlements": 5,
      "maxSpread": 0.0095,
      "minSpread": 0.0058,
      "durationFormatted": "2 days 5 hours"
    }
  }
}
```

**Error Responses**:

- 404 Not Found:
```json
{
  "success": false,
  "error": "Not Found",
  "message": "Tracking not found"
}
```

- 403 Forbidden:
```json
{
  "success": false,
  "error": "Forbidden",
  "message": "You do not have access to this tracking"
}
```

---

### 4. Stop Tracking

**POST** `/api/simulated-tracking/{id}/stop`

Stop an active tracking.

**Path Parameters**:
| Param | Type | Description |
|-------|------|-------------|
| id | string | Tracking ID |

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "tracking": {
      "id": "clxyz123...",
      "status": "STOPPED",
      "stoppedAt": "2025-12-04T15:30:00Z",
      "totalFundingProfit": 125.50,
      "totalSettlements": 5,
      "durationFormatted": "2 days 5 hours"
    }
  }
}
```

**Error Responses**:

- 400 Bad Request (already stopped):
```json
{
  "success": false,
  "error": "Bad Request",
  "message": "Tracking is already stopped"
}
```

---

### 5. Get Tracking Snapshots

**GET** `/api/simulated-tracking/{id}/snapshots`

Get snapshot history for a tracking.

**Path Parameters**:
| Param | Type | Description |
|-------|------|-------------|
| id | string | Tracking ID |

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| type | string | "all" | Filter: SETTLEMENT, PERIODIC, all |
| limit | number | 50 | Max items (1-100) |
| offset | number | 0 | Pagination offset |

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "snapshots": [
      {
        "id": "snap123...",
        "snapshotType": "SETTLEMENT",
        "longRate": -0.0015,
        "shortRate": 0.0058,
        "spread": 0.0073,
        "annualizedReturn": 850.5,
        "longPrice": 95420.50,
        "shortPrice": 95415.20,
        "priceDiffPercent": -0.0055,
        "settlementSide": "BOTH",
        "fundingProfit": 73.00,
        "cumulativeProfit": 125.50,
        "recordedAt": "2025-12-02T16:00:00Z"
      }
    ],
    "pagination": {
      "total": 12,
      "limit": 50,
      "offset": 0,
      "hasMore": false
    }
  }
}
```

---

### 6. Delete Tracking

**DELETE** `/api/simulated-tracking/{id}`

Delete a stopped or expired tracking and all its snapshots.

**Path Parameters**:
| Param | Type | Description |
|-------|------|-------------|
| id | string | Tracking ID |

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "message": "Tracking deleted successfully"
  }
}
```

**Error Responses**:

- 400 Bad Request (still active):
```json
{
  "success": false,
  "error": "Bad Request",
  "message": "Cannot delete active tracking. Stop it first."
}
```

---

## Common Error Responses

All endpoints may return:

- 401 Unauthorized:
```json
{
  "success": false,
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

- 500 Internal Server Error:
```json
{
  "success": false,
  "error": "Internal Server Error",
  "message": "An unexpected error occurred"
}
```

---

## Response Headers

All responses include:
- `X-Correlation-Id`: Request tracking ID for debugging
- `Content-Type`: application/json
