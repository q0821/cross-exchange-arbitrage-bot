# WebSocket Contract: Open Interest Updates

**Feature**: 010-open-interest-selection
**Purpose**: Define WebSocket event schema for transmitting Open Interest data from CLI backend to Web frontend
**Protocol**: WebSocket over HTTP
**Message Format**: JSON

## Connection

### Endpoint

```
ws://localhost:3001/ws
```

**Notes**:
- WebSocket server runs alongside CLI monitor service
- Connection established by Web frontend on page load
- Automatic reconnection on disconnect (handled by client)

### Connection Lifecycle

1. **Client connects**: `new WebSocket('ws://localhost:3001/ws')`
2. **Server acknowledges**: Sends `connection:established` event
3. **Server broadcasts**: `rates:update` events every 5 seconds (or on data change)
4. **Client processes**: Updates UI with new data
5. **Connection close**: Server or client can close connection

## Event Types

### 1. Connection Established

**Direction**: Server → Client

**Purpose**: Acknowledge successful WebSocket connection

**Event Schema**:
```typescript
interface ConnectionEstablishedEvent {
  type: 'connection:established';
  data: {
    timestamp: number;        // Unix ms
    clientId: string;         // Unique client identifier
    serverVersion: string;    // e.g., "1.0.0"
  };
}
```

**Example**:
```json
{
  "type": "connection:established",
  "data": {
    "timestamp": 1699999999999,
    "clientId": "client-abc123",
    "serverVersion": "1.0.0"
  }
}
```

---

### 2. Rates Update (with Open Interest)

**Direction**: Server → Client

**Purpose**: Broadcast current funding rates and Open Interest data for all monitored trading pairs

**Event Schema**:
```typescript
interface RatesUpdateEvent {
  type: 'rates:update';
  data: {
    rates: MarketRate[];      // Array of market rates with OI data
    timestamp: number;        // Unix ms
    updateCount: number;      // Number of updates since connection
  };
}

interface MarketRate {
  symbol: string;                  // e.g., "BTCUSDT"
  binance: ExchangeRate;
  okx: ExchangeRate;
  bestPair?: ArbitragePair;
  openInterest?: number;          // ✨ NEW: OI in USD (optional)
  lastUpdated: number;            // Unix ms
}

interface ExchangeRate {
  fundingRate: number;            // e.g., 0.0001 (0.01%)
  nextFundingTime: number;        // Unix ms
  markPrice: number;
}

interface ArbitragePair {
  buyExchange: string;
  sellExchange: string;
  spreadPercent: number;
  annualizedReturn: number;
  netReturn: number;
}
```

**Example**:
```json
{
  "type": "rates:update",
  "data": {
    "rates": [
      {
        "symbol": "BTCUSDT",
        "binance": {
          "fundingRate": 0.0001,
          "nextFundingTime": 1700000000000,
          "markPrice": 43300.25
        },
        "okx": {
          "fundingRate": 0.00015,
          "nextFundingTime": 1700000000000,
          "markPrice": 43305.50
        },
        "bestPair": {
          "buyExchange": "binance",
          "sellExchange": "okx",
          "spreadPercent": 0.05,
          "annualizedReturn": 438.0,
          "netReturn": 437.5
        },
        "openInterest": 5432100000.50,
        "lastUpdated": 1699999999999
      },
      {
        "symbol": "ETHUSDT",
        "binance": {
          "fundingRate": 0.00008,
          "nextFundingTime": 1700000000000,
          "markPrice": 2280.75
        },
        "okx": {
          "fundingRate": 0.00012,
          "nextFundingTime": 1700000000000,
          "markPrice": 2282.50
        },
        "bestPair": {
          "buyExchange": "binance",
          "sellExchange": "okx",
          "spreadPercent": 0.04,
          "annualizedReturn": 350.4,
          "netReturn": 350.0
        },
        "openInterest": 3210450200.25,
        "lastUpdated": 1699999999998
      }
    ],
    "timestamp": 1699999999999,
    "updateCount": 42
  }
}
```

**Field Descriptions**:

- **`openInterest`** (NEW):
  - **Type**: `number | undefined`
  - **Unit**: USD
  - **Source**: Cached from Binance OI API (15-min TTL)
  - **Optional**: May be `undefined` if OI data is unavailable or not yet fetched
  - **Format**: Raw number (e.g., 5432100000.50 = $5.43B)
  - **Client Responsibility**: Format for display (e.g., "$5.43B")

**Backward Compatibility**:
- `openInterest` field is optional
- Existing clients without OI support will ignore this field
- No breaking changes to existing `MarketRate` structure

---

### 3. Error Event

**Direction**: Server → Client

**Purpose**: Notify client of errors (e.g., exchange API failures, data fetch errors)

**Event Schema**:
```typescript
interface ErrorEvent {
  type: 'error';
  data: {
    message: string;          // Human-readable error message
    code: string;             // Error code (e.g., "EXCHANGE_API_ERROR")
    severity: 'warning' | 'error' | 'critical';
    timestamp: number;        // Unix ms
    details?: Record<string, any>;  // Optional additional details
  };
}
```

**Example**:
```json
{
  "type": "error",
  "data": {
    "message": "Failed to fetch Open Interest data from Binance",
    "code": "OI_FETCH_ERROR",
    "severity": "warning",
    "timestamp": 1699999999999,
    "details": {
      "exchange": "binance",
      "statusCode": 429,
      "retryAfter": 60
    }
  }
}
```

---

## Message Flow

```
┌──────────┐                           ┌─────────────────┐
│ Web      │                           │ CLI Monitor     │
│ Client   │                           │ (WebSocket      │
│          │                           │  Server)        │
└────┬─────┘                           └────┬────────────┘
     │                                      │
     │  1. Connect ws://localhost:3001/ws   │
     │─────────────────────────────────────>│
     │                                      │
     │  2. connection:established           │
     │<─────────────────────────────────────│
     │                                      │
     │  3. rates:update (every 5s)          │
     │<─────────────────────────────────────│
     │      includes openInterest field     │
     │                                      │
     │  4. rates:update                     │
     │<─────────────────────────────────────│
     │                                      │
     │  5. error (if OI fetch fails)        │
     │<─────────────────────────────────────│
     │      severity: warning               │
     │                                      │
     │  6. rates:update (continues)         │
     │<─────────────────────────────────────│
     │      openInterest may be undefined   │
     │                                      │
```

## Open Interest Data Lifecycle

### Server-Side (CLI)

1. **Startup**: Fetch OI data using `getTopSymbolsByOI(topN)`
2. **Cache**: Store in OICache with 15-min TTL
3. **Monitor Loop**: Every 5 seconds, broadcast `rates:update`
4. **Attach OI**: For each symbol, lookup OI from cache
   - If found: Include `openInterest` field
   - If not found: Omit `openInterest` field or set to `undefined`
5. **Cache Refresh**: After 15 minutes, refetch OI data in background

### Client-Side (Web)

1. **Receive**: `rates:update` event with `openInterest` field
2. **Update**: Store in `ratesMap` (Map<symbol, MarketRate>)
3. **Display**: Render OI column with formatted value
   - If `openInterest` exists: Format as "$5.43B"
   - If `undefined`: Display "N/A" or "-"
4. **Sort**: Support sorting by `openInterest` field

## Client Implementation Example

```typescript
// Web frontend - useMarketRates hook
interface MarketRate {
  symbol: string;
  binance: ExchangeRate;
  okx: ExchangeRate;
  bestPair?: ArbitragePair;
  openInterest?: number;  // ✨ NEW
  lastUpdated: number;
}

function useMarketRates() {
  const [ratesMap, setRatesMap] = useState<Map<string, MarketRate>>(new Map());

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3001/ws');

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.type === 'rates:update') {
        setRatesMap(prev => {
          const next = new Map(prev);
          message.data.rates.forEach((rate: MarketRate) => {
            next.set(rate.symbol, rate);  // ✅ openInterest included automatically
          });
          return next;
        });
      }
    };

    return () => ws.close();
  }, []);

  return { ratesMap };
}

// Display component
function RatesTable({ ratesMap, sortBy, sortDirection }: Props) {
  const sortedSymbols = useMemo(() => {
    // ... sorting logic with openInterest support
  }, [sortBy, sortDirection]);

  return (
    <table>
      <thead>
        <tr>
          <th onClick={() => onSort('openInterest')}>Open Interest</th>
        </tr>
      </thead>
      <tbody>
        {sortedSymbols.map(symbol => {
          const rate = ratesMap.get(symbol);
          return (
            <tr key={symbol}>
              <td>{formatOI(rate?.openInterest)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function formatOI(oi: number | undefined): string {
  if (!oi) return 'N/A';
  if (oi >= 1e9) return `$${(oi / 1e9).toFixed(2)}B`;
  if (oi >= 1e6) return `$${(oi / 1e6).toFixed(2)}M`;
  if (oi >= 1e3) return `$${(oi / 1e3).toFixed(2)}K`;
  return `$${oi.toFixed(0)}`;
}
```

## Server Implementation Example

```typescript
// CLI - MonitorService.ts
class MonitorService {
  private oiCache = new OICache();
  private wsServer: WebSocketServer;

  async start(symbols: string[]) {
    // Fetch OI data on startup
    await this.refreshOICache(symbols);

    // Start monitoring loop
    setInterval(() => {
      this.broadcastRatesUpdate();
    }, 5000);

    // Refresh OI cache every 15 minutes
    setInterval(() => {
      this.refreshOICache(symbols);
    }, 15 * 60 * 1000);
  }

  private async refreshOICache(symbols: string[]) {
    try {
      const binance = new BinanceConnector();
      const allOI = await binance.getAllOpenInterest();

      // Store in cache
      allOI.forEach(oi => {
        this.oiCache.set(oi.symbol, oi);
      });

      logger.info({ count: allOI.length }, 'OI cache refreshed');
    } catch (error) {
      logger.error({ error }, 'Failed to refresh OI cache');
    }
  }

  private broadcastRatesUpdate() {
    const rates = this.getCurrentRates().map(rate => ({
      ...rate,
      openInterest: this.oiCache.get(rate.symbol)?.openInterestUSD,  // ✅ Attach OI
    }));

    const event: RatesUpdateEvent = {
      type: 'rates:update',
      data: {
        rates,
        timestamp: Date.now(),
        updateCount: this.updateCount++,
      },
    };

    this.wsServer.broadcast(JSON.stringify(event));
  }
}
```

## Error Handling

### Server-Side

**OI Fetch Failure**:
- Log error with details
- Send `error` event to clients (severity: warning)
- Continue broadcasting `rates:update` without `openInterest` field
- Retry on next refresh cycle (15 min later)

**WebSocket Disconnection**:
- Log disconnection
- Clean up client resources
- Client should auto-reconnect

### Client-Side

**Missing OI Data**:
- Display "N/A" if `openInterest` is undefined
- No error thrown
- Sorting still works (treat undefined as 0)

**WebSocket Error**:
- Display connection status indicator
- Attempt reconnection with exponential backoff
- Show cached data until reconnection

## Versioning

**Current Version**: 1.0.0

**Backward Compatibility**:
- Adding `openInterest` field is **non-breaking** (optional field)
- Old clients ignore unknown fields
- New clients handle missing fields gracefully

**Future Changes**:
If breaking changes are needed:
1. Increment version in `connection:established` event
2. Support multiple protocol versions simultaneously
3. Clients negotiate protocol version on connection

## Performance Considerations

### Message Size

**Before (without OI)**:
- Single MarketRate: ~200 bytes
- 100 symbols: ~20 KB per message
- Broadcast every 5s: ~4 KB/s bandwidth

**After (with OI)**:
- Single MarketRate: ~208 bytes (+8 bytes for number)
- 100 symbols: ~20.8 KB per message
- Broadcast every 5s: ~4.16 KB/s bandwidth

**Impact**: +4% message size, negligible for typical network bandwidth

### Update Frequency

- **Rates Update**: Every 5 seconds (unchanged)
- **OI Cache Refresh**: Every 15 minutes (background, doesn't block updates)

## Testing

### Unit Tests

```typescript
// Test OI field inclusion
test('rates:update includes openInterest field', () => {
  const event = buildRatesUpdateEvent(rates, oiCache);
  expect(event.data.rates[0].openInterest).toBeDefined();
  expect(event.data.rates[0].openInterest).toBeGreaterThan(0);
});

// Test missing OI gracefully handled
test('rates:update handles missing OI', () => {
  const emptyCache = new OICache();
  const event = buildRatesUpdateEvent(rates, emptyCache);
  expect(event.data.rates[0].openInterest).toBeUndefined();
});
```

### Integration Tests

```typescript
// Test WebSocket transmission
test('WebSocket broadcasts OI data', async () => {
  const client = new WebSocket('ws://localhost:3001/ws');
  await waitForConnection(client);

  const message = await waitForMessage(client);
  const event = JSON.parse(message);

  expect(event.type).toBe('rates:update');
  expect(event.data.rates[0].openInterest).toBeDefined();
});
```

## Summary

本 WebSocket 契約定義了 Open Interest 資料在 CLI backend 和 Web frontend 之間的傳輸格式。關鍵設計決策：

1. **Backward Compatible**: `openInterest` 為可選欄位，不影響現有客戶端
2. **Graceful Degradation**: OI 資料不可用時不影響基本功能
3. **Efficient**: 只增加 4% 訊息大小，可忽略的效能影響
4. **Simple**: 直接附加到現有 `rates:update` 事件，無需新事件類型

所有契約定義完成，可以開始實作。
