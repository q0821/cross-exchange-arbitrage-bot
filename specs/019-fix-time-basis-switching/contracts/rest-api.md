# REST API Contract: 修復時間基準切換功能

**Feature**: 019-fix-time-basis-switching
**Date**: 2025-01-19
**Status**: Complete

## Overview

此文件定義 REST API 的變更，確保頁面重新載入後能正確顯示標準化費率資訊。

---

## Endpoints

### GET `/api/market-rates`

**Purpose**: 獲取所有交易對的即時資金費率（含標準化資料）

**Authentication**: Required (session-based)

**Query Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `threshold` | number | No | `0.5` | 套利機會閾值（百分比） |

**Request Example**:
```http
GET /api/market-rates?threshold=0.5 HTTP/1.1
Host: localhost:3000
Cookie: session=xxx
```

**Response Structure** (修改後):

```typescript
{
  success: boolean,
  data: {
    rates: Array<{
      symbol: string,
      exchanges: Record<ExchangeName, {
        rate: number,
        ratePercent: string,
        price: number,
        nextFundingTime: string,  // ISO 8601
        // ✅ 新增欄位
        normalized?: {
          '1h'?: number,
          '4h'?: number,
          '8h'?: number,
          '24h'?: number
        },
        originalInterval?: number  // ✅ 新增欄位
      }>,
      bestPair: {
        longExchange: string,
        shortExchange: string,
        spreadPercent: string,
        annualizedReturn: string,
        priceDiffPercent: string | null
      } | null,
      status: 'opportunity' | 'approaching' | 'normal',
      timestamp: string  // ISO 8601
    }>,
    stats: {
      totalSymbols: number,
      opportunityCount: number,
      approachingCount: number,
      maxSpread: {
        symbol: string,
        spread: string
      } | null,
      uptime: number,
      lastUpdate: string | null
    },
    threshold: string
  },
  error?: {
    message: string,
    code: string
  }
}
```

**Success Response Example**:

```json
{
  "success": true,
  "data": {
    "rates": [
      {
        "symbol": "BTCUSDT",
        "exchanges": {
          "binance": {
            "rate": 0.0001,
            "ratePercent": "0.0100",
            "price": 45000.5,
            "nextFundingTime": "2025-01-19T12:00:00.000Z",
            "normalized": {
              "1h": 0.0000125,
              "4h": 0.00005,
              "8h": 0.0001,
              "24h": 0.0003
            },
            "originalInterval": 8
          },
          "okx": {
            "rate": 0.00005,
            "ratePercent": "0.0050",
            "price": 45001.2,
            "nextFundingTime": "2025-01-19T11:00:00.000Z",
            "normalized": {
              "1h": 0.0000125,
              "4h": 0.00005,
              "8h": 0.0001,
              "24h": 0.0003
            },
            "originalInterval": 4
          },
          "mexc": {
            "rate": 0.00008,
            "ratePercent": "0.0080",
            "price": 45000.8,
            "nextFundingTime": "2025-01-19T12:00:00.000Z",
            "normalized": {
              "1h": 0.00001,
              "4h": 0.00004,
              "8h": 0.00008,
              "24h": 0.00024
            },
            "originalInterval": 8
          }
        },
        "bestPair": {
          "longExchange": "okx",
          "shortExchange": "binance",
          "spreadPercent": "0.0050",
          "annualizedReturn": "5.48",
          "priceDiffPercent": "0.0016"
        },
        "status": "normal",
        "timestamp": "2025-01-19T10:30:00.000Z"
      }
    ],
    "stats": {
      "totalSymbols": 100,
      "opportunityCount": 5,
      "approachingCount": 12,
      "maxSpread": {
        "symbol": "ETHUSDT",
        "spread": "0.8500"
      },
      "uptime": 3600,
      "lastUpdate": "2025-01-19T10:30:00.000Z"
    },
    "threshold": "0.50"
  }
}
```

**Error Response Example**:

```json
{
  "success": false,
  "error": {
    "message": "Unauthorized",
    "code": "UNAUTHORIZED"
  }
}
```

**Status Codes**:
| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | 成功取得費率資料 |
| 401 | Unauthorized | 未登入或 session 過期 |
| 500 | Internal Server Error | 伺服器錯誤 |

---

## Field Changes

### exchanges[name] Object

**Before** (缺少標準化資料):
```json
{
  "rate": 0.0001,
  "ratePercent": "0.0100",
  "price": 45000.5,
  "nextFundingTime": "2025-01-19T12:00:00.000Z"
}
```

**After** (完整資料):
```json
{
  "rate": 0.0001,
  "ratePercent": "0.0100",
  "price": 45000.5,
  "nextFundingTime": "2025-01-19T12:00:00.000Z",
  "normalized": {
    "1h": 0.0000125,
    "4h": 0.00005,
    "8h": 0.0001,
    "24h": 0.0003
  },
  "originalInterval": 8
}
```

**New Fields**:
| Field | Type | Optional | Description |
|-------|------|----------|-------------|
| `normalized` | object | Yes | 包含四種時間基準的標準化費率 |
| `normalized.1h` | number | Yes | 標準化為 1 小時基準的費率 |
| `normalized.4h` | number | Yes | 標準化為 4 小時基準的費率 |
| `normalized.8h` | number | Yes | 標準化為 8 小時基準的費率 |
| `normalized.24h` | number | Yes | 標準化為 24 小時基準的費率 |
| `originalInterval` | number | Yes | 交易所原始結算週期（小時） |

**Notes**:
- `normalized` 欄位可能不存在（CLI 監控服務尚未計算）
- 如果 `originalInterval` 與某個時間基準相同，該基準的 `normalized` 值會等於 `rate`
- 所有費率值以小數表示（例如 0.0001 = 0.01%）

---

## Implementation Changes

### Source File: `app/api/market-rates/route.ts`

**Line 64-72: 更新資料格式化邏輯**

```typescript
// 修改前
const exchanges: Record<string, any> = {};
for (const [exchangeName, exchangeData] of rate.exchanges) {
  exchanges[exchangeName] = {
    rate: exchangeData.rate.fundingRate,
    ratePercent: (exchangeData.rate.fundingRate * 100).toFixed(4),
    price: exchangeData.price || exchangeData.rate.markPrice,
    nextFundingTime: exchangeData.rate.nextFundingTime.toISOString(),
  };
}

// 修改後
const exchanges: Record<string, any> = {};
for (const [exchangeName, exchangeData] of rate.exchanges) {
  exchanges[exchangeName] = {
    rate: exchangeData.rate.fundingRate,
    ratePercent: (exchangeData.rate.fundingRate * 100).toFixed(4),
    price: exchangeData.price || exchangeData.rate.markPrice,
    nextFundingTime: exchangeData.rate.nextFundingTime.toISOString(),
    // ✅ 新增欄位
    normalized: exchangeData.normalized || {},
    originalInterval: exchangeData.originalFundingInterval
  };
}
```

**Key Points**:
1. 從 `exchangeData` 中提取 `normalized` 和 `originalFundingInterval`
2. 使用 `||` 運算子提供預設值（空物件）
3. 欄位為可選，不會破壞現有客戶端

---

## Data Source

### RatesCache

**Source**: `src/services/monitor/RatesCache.ts`

**Data Flow**:
```
CLI Monitor (FundingRateMonitor)
    ↓ 計算標準化費率
    ↓ ratesCache.set(symbol, pair)
RatesCache (in-memory)
    ↓ ratesCache.getAll()
REST API Handler
    ↓ 格式化為 JSON
HTTP Response
```

**Cache Structure**:
```typescript
Map<string, FundingRatePair> {
  'BTCUSDT' => {
    symbol: 'BTCUSDT',
    exchanges: Map {
      'binance' => {
        rate: FundingRateRecord,
        price: 45000.5,
        normalized: {
          '1h': 0.0000125,
          '4h': 0.00005,
          '8h': 0.0001,
          '24h': 0.0003
        },
        originalFundingInterval: 8
      },
      // ... other exchanges
    },
    bestPair: { ... },
    recordedAt: Date
  }
}
```

---

## Client-Side Usage

### Fetching Data

```typescript
// app/(dashboard)/market-monitor/hooks/useMarketRates.ts
const reload = useCallback(async () => {
  try {
    setIsLoading(true);
    setError(null);

    const response = await fetch('/api/market-rates');
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    if (data.success) {
      // ✅ 資料現在包含 normalized 和 originalInterval
      const newMap = new Map<string, MarketRate>();
      data.data.rates.forEach((rate: MarketRate) => {
        newMap.set(rate.symbol, rate);
      });
      setRatesMap(newMap);
      setStats(data.data.stats);
    }
  } catch (err) {
    setError(err);
  } finally {
    setIsLoading(false);
  }
}, []);
```

### Displaying Normalized Rates

```typescript
// app/(dashboard)/market-monitor/components/RateRow.tsx
const timeBasisKey = `${timeBasis}h` as '1h' | '4h' | '8h' | '24h';
const normalizedRate = exchangeData.normalized?.[timeBasisKey];
const originalInterval = exchangeData.originalInterval;

// 如果有標準化費率且原始週期與目標不同，顯示標準化費率
if (normalizedRate !== undefined &&
    originalInterval &&
    originalInterval !== timeBasis) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <span className="underline decoration-dotted">
          {formatRate(normalizedRate)}
        </span>
      </Tooltip.Trigger>
      <Tooltip.Content>
        原始費率：{formatRate(exchangeData.rate)}
        原始週期：{originalInterval}h
        已標準化為：{timeBasis}h
      </Tooltip.Content>
    </Tooltip.Root>
  );
}

// 否則直接顯示原始費率
return <span>{formatRate(exchangeData.rate)}</span>;
```

---

## Testing

### Unit Tests

```typescript
describe('GET /api/market-rates', () => {
  it('should return normalized rates', async () => {
    const response = await fetch('/api/market-rates');
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data.rates[0].exchanges.binance.normalized).toBeDefined();
    expect(data.data.rates[0].exchanges.binance.originalInterval).toBeDefined();
  });

  it('should handle missing normalized data gracefully', async () => {
    // Mock RatesCache with incomplete data
    mockRatesCache.set('BTCUSDT', {
      exchanges: new Map([
        ['binance', {
          rate: mockRate,
          price: 45000,
          // normalized missing
          // originalFundingInterval missing
        }]
      ])
    });

    const response = await fetch('/api/market-rates');
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data.rates[0].exchanges.binance.normalized).toEqual({});
    expect(data.data.rates[0].exchanges.binance.originalInterval).toBeUndefined();
  });
});
```

### Integration Tests

```typescript
describe('REST API Integration', () => {
  it('should match WebSocket data format', async () => {
    // Fetch from REST API
    const restResponse = await fetch('/api/market-rates');
    const restData = await restResponse.json();

    // Connect to WebSocket and wait for rates:update
    const wsData = await waitForWebSocketEvent('rates:update');

    // Compare data structure
    expect(restData.data.rates[0].exchanges.binance).toMatchObject(
      wsData.data.rates[0].exchanges.binance
    );
  });
});
```

---

## Performance Metrics

### Expected Performance

| Metric | Before | After | Notes |
|--------|--------|-------|-------|
| Response time (P95) | <500ms | <520ms | +20ms due to additional fields |
| Response size | ~50KB | ~60KB | +20% due to normalized data |
| Cache hit rate | 100% | 100% | No change (same data source) |

### Optimization Strategies

1. **Lazy serialization**: Only serialize `normalized` if client accepts it
2. **Compression**: Enable gzip/brotli compression for large payloads
3. **Caching**: Add ETag support for client-side caching

**Not implemented in this phase** (optimization can be added later if needed)

---

## Error Handling

### Server-Side Errors

```typescript
// app/api/market-rates/route.ts
export async function GET(request: NextRequest): Promise<NextResponse> {
  const correlationId = getCorrelationId(request);

  try {
    // Authenticate
    const user = await authenticate(request);

    // Fetch from cache
    const rates = ratesCache.getAll();
    const stats = ratesCache.getStats(threshold);

    // Format and return
    return NextResponse.json({
      success: true,
      data: { rates: formattedRates, stats, threshold }
    });
  } catch (error) {
    // Centralized error handling
    return handleError(error, correlationId);
  }
}
```

### Client-Side Error Handling

```typescript
try {
  const response = await fetch('/api/market-rates');
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error?.message || 'Failed to fetch rates');
  }

  // Process data
} catch (err) {
  console.error('Failed to reload:', err);
  setError(err instanceof Error ? err : new Error(String(err)));
}
```

---

## Migration Checklist

- [x] Add normalized field to response
- [x] Add originalInterval field to response
- [x] Maintain backward compatibility
- [x] Update TypeScript types (already in types.ts)
- [x] Add unit tests
- [x] Add integration tests
- [x] Update API documentation
- [x] Monitor response time and size

---

## Backward Compatibility Statement

✅ **100% Backward Compatible**

- Old clients will ignore new fields
- All existing fields remain unchanged
- Response structure unchanged (only new optional fields added)
- No breaking changes to query parameters
- Error handling unchanged

---

## Future Enhancements

### Query Parameter Support

**Future consideration** (not implemented in this phase):

```http
GET /api/market-rates?timeBasis=4
```

**Rationale**: Currently not needed because:
1. Frontend has all normalized versions in the response
2. Frontend can select the appropriate version based on user choice
3. Reduces backend complexity

**When to implement**:
- If we need to reduce response size (only send requested time basis)
- If we add server-side filtering based on time basis

---

## References

- Source: `app/api/market-rates/route.ts`
- Types: `app/(dashboard)/market-monitor/types.ts`
- Cache: `src/services/monitor/RatesCache.ts`
- WebSocket Contract: `contracts/websocket.md`
- Feature Spec: `specs/019-fix-time-basis-switching/spec.md`
