# WebSocket Contract: 標準化資金費率與淨收益

**Feature**: 012-specify-scripts-bash
**Date**: 2025-01-15
**Protocol**: Socket.io 4.8
**Status**: Extended (向後相容)

## Overview

本文件定義擴展後的 WebSocket 事件契約，用於傳遞標準化資金費率和淨收益資訊。所有新增欄位均為**選填**，確保向後相容現有客戶端。

---

## Connection

### Endpoint
```
ws://localhost:3000 (development)
wss://your-domain.com (production)
```

### Authentication
```typescript
io.connect(WS_URL, {
  auth: {
    token: jwt_token // JWT from login
  }
})
```

### Namespaces
- `/` (default namespace)
- No custom namespaces needed for this feature

---

## Events

### 1. `market-rates-update` (Server → Client) **[EXTENDED]**

**Purpose**: 廣播最新的市場資金費率資訊，包含標準化費率和淨收益

**Frequency**: 每 5 秒最多一次更新（per symbol）

**Payload Schema**:

```typescript
interface MarketRatesUpdatePayload {
  // ===== Existing fields (unchanged) =====
  exchange: string;           // "binance" | "okx" | "mexc" | "gateio"
  symbol: string;             // "BTCUSDT", "ETHUSDT", etc.
  fundingRate: string;        // Original rate as Decimal string (e.g., "0.0001")
  nextFundingTime: string;    // ISO 8601 timestamp
  markPrice?: string;         // Current mark price (optional)
  indexPrice?: string;        // Current index price (optional)
  timestamp: string;          // ISO 8601 timestamp of data fetch

  // ===== NEW fields (optional for backward compat) =====
  normalizedRate?: string;              // Normalized rate as Decimal string
  originalFundingInterval?: number;     // Original interval in hours (1 | 4 | 8 | 24)
  targetTimeBasis?: number;             // Target time basis in hours (1 | 8 | 24)

  bestArbitragePair?: {
    longExchange: string;               // Exchange to go long
    shortExchange: string;              // Exchange to go short
    longRate: string;                   // Normalized long rate
    shortRate: string;                  // Normalized short rate
    rateDifference: string;             // longRate - shortRate
    netProfit: string;                  // rateDifference - totalFees
    netProfitDetails: {
      rateDifference: string;           // Same as parent
      totalFees: string;                // takerFeeRate × 4
      netProfit: string;                // Same as parent
    };
  };
}
```

**Example Payload** (NEW format with all fields):

```json
{
  "exchange": "binance",
  "symbol": "BTCUSDT",
  "fundingRate": "0.0001",
  "nextFundingTime": "2025-01-15T08:00:00Z",
  "markPrice": "45000.50",
  "indexPrice": "45001.25",
  "timestamp": "2025-01-15T07:55:00Z",

  "normalizedRate": "0.0008",
  "originalFundingInterval": 1,
  "targetTimeBasis": 8,

  "bestArbitragePair": {
    "longExchange": "binance",
    "shortExchange": "okx",
    "longRate": "0.0008",
    "shortRate": "-0.0004",
    "rateDifference": "0.0012",
    "netProfit": "0.001",
    "netProfitDetails": {
      "rateDifference": "0.0012",
      "totalFees": "0.002",
      "netProfit": "0.001"
    }
  }
}
```

**Example Payload** (OLD format, backward compatible):

```json
{
  "exchange": "binance",
  "symbol": "BTCUSDT",
  "fundingRate": "0.0001",
  "nextFundingTime": "2025-01-15T08:00:00Z",
  "timestamp": "2025-01-15T07:55:00Z"
}
```

**Client Handling**:
```typescript
socket.on('market-rates-update', (data: MarketRatesUpdatePayload) => {
  // NEW clients: Use normalizedRate if available
  const displayRate = data.normalizedRate ?? data.fundingRate;

  // NEW clients: Show net profit if available
  if (data.bestArbitragePair) {
    showNetProfit(data.bestArbitragePair.netProfit);
  }

  // OLD clients: Ignore unknown fields (backward compat)
});
```

---

### 2. `market-rates-subscribe` (Client → Server) **[UNCHANGED]**

**Purpose**: 訂閱特定交易對的市場資金費率更新

**Payload Schema**:

```typescript
interface SubscribePayload {
  symbols?: string[]; // Optional: specific symbols to subscribe
                     // If omitted, subscribe to all monitored symbols
}
```

**Example**:

```typescript
socket.emit('market-rates-subscribe', {
  symbols: ['BTCUSDT', 'ETHUSDT']
});
```

---

### 3. `market-rates-unsubscribe` (Client → Server) **[UNCHANGED]**

**Purpose**: 取消訂閱特定交易對

**Payload Schema**:

```typescript
interface UnsubscribePayload {
  symbols: string[]; // Symbols to unsubscribe
}
```

**Example**:

```typescript
socket.emit('market-rates-unsubscribe', {
  symbols: ['BTCUSDT']
});
```

---

### 4. `set-time-basis` (Client → Server) **[NEW]**

**Purpose**: 設定用戶偏好的時間基準，伺服器將根據此基準標準化費率

**Payload Schema**:

```typescript
interface SetTimeBasisPayload {
  timeBasis: 1 | 8 | 24; // Hours
}
```

**Server Response**: 無（伺服器會在下次 `market-rates-update` 時使用新的 timeBasis）

**Example**:

```typescript
socket.emit('set-time-basis', { timeBasis: 8 });
```

**Server Handling**:
```typescript
socket.on('set-time-basis', async ({ timeBasis }) => {
  // Validate
  if (![1, 8, 24].includes(timeBasis)) {
    socket.emit('error', { message: 'Invalid time basis' });
    return;
  }

  // Store preference (in-memory for this session, or persist to DB)
  socket.data.timeBasis = timeBasis;

  // Future updates will use this timeBasis
  logger.info({ timeBasis }, 'User updated time basis preference');
});
```

---

### 5. `error` (Server → Client) **[EXISTING]**

**Purpose**: 通知客戶端錯誤訊息

**Payload Schema**:

```typescript
interface ErrorPayload {
  message: string;
  code?: string; // Optional error code
  details?: any; // Optional additional context
}
```

**Example**:

```json
{
  "message": "Invalid time basis",
  "code": "INVALID_INPUT",
  "details": { "received": 10, "expected": [1, 8, 24] }
}
```

---

## Error Codes

| Code | Message | Cause | Client Action |
|------|---------|-------|---------------|
| `INVALID_INPUT` | Invalid time basis | User sent invalid timeBasis value | Show error toast, revert to previous value |
| `RATE_DATA_UNAVAILABLE` | Funding rate data unavailable | Exchange API error | Show "N/A" for affected rates |
| `CALCULATION_ERROR` | Failed to calculate net profit | Internal calculation error | Show "—" for net profit |
| `UNAUTHORIZED` | Authentication required | Missing or invalid JWT token | Redirect to login |

---

## Backward Compatibility

### OLD Clients (before this feature)

- **Receive**: All existing fields (`fundingRate`, `nextFundingTime`, etc.)
- **Ignore**: New optional fields (`normalizedRate`, `bestArbitragePair`, etc.)
- **Behavior**: Continue to work without any changes

### NEW Clients (with this feature)

- **Receive**: All fields (existing + new)
- **Prefer**: Use `normalizedRate` if available, fallback to `fundingRate`
- **Display**: Show net profit and calculation details if `bestArbitragePair` exists

**Migration Strategy**:
1. Deploy server with new fields (all optional)
2. Deploy new clients that use new fields
3. OLD clients continue to work (graceful degradation)

---

## Performance Considerations

### Update Frequency
- **Max 1 update per 5 seconds** per symbol (debounced)
- Prevent overloading client with rapid updates

### Payload Size
- Typical payload: ~500 bytes (with all new fields)
- Max concurrent connections: ~100 users
- Bandwidth: ~10 KB/s per user (acceptable)

### Calculation Cost
- Normalization: < 1ms per symbol
- Net profit: < 5ms per symbol (needs to find best pair across 4 exchanges)
- Total delay: < 10ms (acceptable for 5-second update cycle)

---

## Testing

### Unit Tests

```typescript
describe('market-rates-update payload', () => {
  it('should include normalized rate when available', () => {
    const payload = createMarketRateUpdate({ includeNormalized: true });
    expect(payload.normalizedRate).toBeDefined();
    expect(payload.originalFundingInterval).toBe(1);
    expect(payload.targetTimeBasis).toBe(8);
  });

  it('should be backward compatible without new fields', () => {
    const payload = createMarketRateUpdate({ includeNormalized: false });
    expect(payload.normalizedRate).toBeUndefined();
    expect(payload.fundingRate).toBeDefined(); // Old field still exists
  });
});
```

### Integration Tests

```typescript
describe('WebSocket normalization flow', () => {
  it('should broadcast normalized rates after calculation', async () => {
    const socket = io('http://localhost:3000');
    const received: MarketRatesUpdatePayload[] = [];

    socket.on('market-rates-update', (data) => {
      received.push(data);
    });

    socket.emit('market-rates-subscribe', { symbols: ['BTCUSDT'] });

    await wait(6000); // Wait for first update (5s interval)

    expect(received.length).toBeGreaterThan(0);
    expect(received[0].normalizedRate).toBeDefined();
    expect(received[0].bestArbitragePair).toBeDefined();
  });
});
```

---

## References

- Socket.io documentation: https://socket.io/docs/v4/
- Feature 006 (existing WebSocket implementation): `/specs/006-web-trading-platform/`
- Constitution Principle VI: System Architecture Boundaries

