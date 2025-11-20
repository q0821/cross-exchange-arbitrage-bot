# WebSocket API Contract: 修復時間基準切換功能

**Feature**: 019-fix-time-basis-switching
**Date**: 2025-01-19
**Status**: Complete

## Overview

此文件定義 WebSocket 通訊協定的變更，確保時間基準功能正確運作。

## Connection

**Endpoint**: `/` (WebSocket 根路徑)
**Protocol**: Socket.io 4.8.1
**Authentication**: Required (session-based)

### Connection Flow

```
Client → Server: Connect with auth credentials
Server → Client: 'connect' event
Client → Server: emit('subscribe:market-rates')
Server → Client: emit('subscribed:market-rates', { success: true })
Client → Server: emit('set-time-basis', { timeBasis: 4 })  // 新增 4h 支援
Server → Client: emit('time-basis-updated', { success: true, timeBasis: 4 })
```

---

## Events

### 1. Client → Server: `set-time-basis`

**Purpose**: 設定客戶端的時間基準偏好

**Payload**:
```typescript
{
  timeBasis: TimeBasis  // 1 | 4 | 8 | 24
}
```

**Validation Rules** (修改後):
```typescript
// 修改前
if (![1, 8, 24].includes(timeBasis)) {
  return error;
}

// 修改後
if (![1, 4, 8, 24].includes(timeBasis)) {
  return error;
}
```

**Success Response**:
```typescript
Event: 'time-basis-updated'
Payload: {
  success: true,
  timeBasis: number  // Echo back the set value
}
```

**Error Response**:
```typescript
Event: 'error'
Payload: {
  message: string,
  code: 'INVALID_INPUT' | 'INTERNAL_ERROR',
  details?: {
    received: number,
    expected: number[]
  }
}
```

**Example**:

Valid request:
```typescript
// Client
socket.emit('set-time-basis', { timeBasis: 4 });

// Server response
socket.on('time-basis-updated', (data) => {
  console.log(data); // { success: true, timeBasis: 4 }
});
```

Invalid request:
```typescript
// Client
socket.emit('set-time-basis', { timeBasis: 6 });

// Server response
socket.on('error', (data) => {
  console.log(data);
  // {
  //   message: 'Invalid time basis',
  //   code: 'INVALID_INPUT',
  //   details: { received: 6, expected: [1, 4, 8, 24] }
  // }
});
```

---

### 2. Server → Client: `rates:update`

**Purpose**: 推送市場費率更新（包含標準化資料）

**Frequency**: 每 5 秒

**Payload Structure** (修改後):
```typescript
{
  type: 'rates:update',
  data: {
    rates: Array<{
      symbol: string,
      exchanges: Record<ExchangeName, {
        rate: number,
        price: number | null,
        // ✅ 新增欄位
        normalized: {
          '1h'?: number,
          '4h'?: number,
          '8h'?: number,
          '24h'?: number
        },
        originalInterval: number  // ✅ 新增欄位
      }>,
      bestPair: {
        longExchange: ExchangeName,
        shortExchange: ExchangeName,
        spread: number,
        spreadPercent: number,
        annualizedReturn: number,
        priceDiffPercent: number | null
      } | null,
      status: 'opportunity' | 'approaching' | 'normal',
      timestamp: string  // ISO 8601
    }>,
    timestamp: string  // ISO 8601
  }
}
```

**Example Payload**:
```json
{
  "type": "rates:update",
  "data": {
    "rates": [
      {
        "symbol": "BTCUSDT",
        "exchanges": {
          "binance": {
            "rate": 0.0001,
            "price": 45000.5,
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
            "price": 45001.2,
            "normalized": {
              "1h": 0.0000125,
              "4h": 0.00005,
              "8h": 0.0001,
              "24h": 0.0003
            },
            "originalInterval": 4
          }
        },
        "bestPair": {
          "longExchange": "okx",
          "shortExchange": "binance",
          "spread": 0.00005,
          "spreadPercent": 0.005,
          "annualizedReturn": 5.475,
          "priceDiffPercent": 0.0016
        },
        "status": "normal",
        "timestamp": "2025-01-19T10:30:00.000Z"
      }
    ],
    "timestamp": "2025-01-19T10:30:00.000Z"
  }
}
```

**Field Changes**:

| Field | Before | After | Notes |
|-------|--------|-------|-------|
| `exchanges[name].normalized` | ❌ 不存在 | ✅ 物件 | 包含所有四種時間基準的標準化費率 |
| `exchanges[name].originalInterval` | ❌ 不存在 | ✅ 數字 | 交易所原始結算週期（小時） |
| `bestPair.spreadPercent` | 使用原始費率計算 | ✅ 使用標準化費率 | 基於預設 8h 時間基準 |

**Backward Compatibility**:
- 舊版客戶端會忽略新增的 `normalized` 和 `originalInterval` 欄位
- 所有現有欄位保持不變
- 完全向後相容

---

### 3. Server → Client: `rates:stats`

**Purpose**: 推送市場統計資訊

**Frequency**: 每 5 秒（與 rates:update 同時）

**Payload Structure**: 無變更

```typescript
{
  type: 'rates:stats',
  data: {
    totalSymbols: number,
    opportunityCount: number,
    approachingCount: number,
    maxSpread: {
      symbol: string,
      spread: number
    } | null,
    uptime: number,  // seconds
    lastUpdate: string | null  // ISO 8601
  }
}
```

**Note**: 此事件不受時間基準影響，統計資料保持不變。

---

## Error Handling

### Client-Side Error Handling

```typescript
socket.on('error', (error: {
  message: string,
  code: string,
  details?: unknown
}) => {
  switch (error.code) {
    case 'INVALID_INPUT':
      // 驗證錯誤：顯示錯誤訊息給用戶
      console.error('Invalid time basis:', error.details);
      break;

    case 'INTERNAL_ERROR':
      // 伺服器錯誤：記錄並通知用戶
      console.error('Server error:', error.message);
      break;

    default:
      // 未知錯誤
      console.error('Unknown error:', error);
  }
});
```

### Connection Error Handling

```typescript
socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
  // WebSocket 客戶端會自動重連
  // useWebSocket hook 已實作重連邏輯
});

socket.on('reconnect', (attemptNumber) => {
  console.log('Reconnected after', attemptNumber, 'attempts');
  // 重新訂閱和設定時間基準
  socket.emit('subscribe:market-rates');
  socket.emit('set-time-basis', { timeBasis: currentTimeBasis });
});
```

---

## Client Implementation Guide

### Frontend Hook Usage

```typescript
import { useMarketRates } from '@/hooks/useMarketRates';

function MarketMonitorPage() {
  const {
    ratesMap,
    stats,
    isConnected,
    timeBasis,
    setTimeBasis  // 設定時間基準的函數
  } = useMarketRates();

  // 切換時間基準
  const handleTimeBasisChange = (newBasis: TimeBasis) => {
    setTimeBasis(newBasis);  // 會自動 emit 'set-time-basis' 事件
  };

  return (
    <div>
      <TimeBasisSelector value={timeBasis} onChange={handleTimeBasisChange} />
      {/* 顯示費率資料 */}
    </div>
  );
}
```

### Accessing Normalized Rates

```typescript
// 從 ratesMap 中取得交易對資料
const rate = ratesMap.get('BTCUSDT');

if (rate) {
  // 取得特定時間基準的標準化費率
  const timeBasisKey = `${timeBasis}h` as '1h' | '4h' | '8h' | '24h';
  const binanceNormalized = rate.exchanges.binance?.normalized?.[timeBasisKey];
  const okxNormalized = rate.exchanges.okx?.normalized?.[timeBasisKey];

  // 顯示標準化費率或降級到原始費率
  const displayRate = binanceNormalized ?? rate.exchanges.binance?.rate;
}
```

---

## Server Implementation Changes

### MarketRatesHandler.ts

```typescript
// Line 78: 更新驗證邏輯
socket.on('set-time-basis', (data: { timeBasis: 1 | 4 | 8 | 24 }) => {
  try {
    const { timeBasis } = data;

    // ✅ 修改驗證陣列
    if (![1, 4, 8, 24].includes(timeBasis)) {  // 新增 4
      socket.emit('error', {
        message: 'Invalid time basis',
        code: 'INVALID_INPUT',
        details: { received: timeBasis, expected: [1, 4, 8, 24] }
      });
      return;
    }

    // 儲存用戶偏好
    authenticatedSocket.data.timeBasis = timeBasis;

    // 發送確認
    socket.emit('time-basis-updated', {
      success: true,
      timeBasis
    });
  } catch (error) {
    // 錯誤處理
  }
});

// Line 336-344: 更新 formatRates 函數
private formatRates(rates: any[]): any[] {
  return rates.map((rate) => {
    // ... existing code ...

    // ✅ 新增標準化資料
    const exchanges: Record<string, any> = {};
    for (const [exchangeName, exchangeData] of rate.exchanges) {
      exchanges[exchangeName] = {
        rate: exchangeData.rate.fundingRate,
        price: exchangeData.price || exchangeData.rate.markPrice || null,
        normalized: exchangeData.normalized || {},  // ✅ 新增
        originalInterval: exchangeData.originalFundingInterval  // ✅ 新增
      };
    }

    // ... rest of the code ...
  });
}
```

---

## Testing

### Unit Tests

```typescript
describe('MarketRatesHandler', () => {
  it('should accept timeBasis = 4', () => {
    socket.emit('set-time-basis', { timeBasis: 4 });
    expect(socket.lastEmittedEvent).toBe('time-basis-updated');
  });

  it('should reject invalid timeBasis', () => {
    socket.emit('set-time-basis', { timeBasis: 6 });
    expect(socket.lastEmittedEvent).toBe('error');
    expect(socket.lastEmittedData.code).toBe('INVALID_INPUT');
  });

  it('should include normalized rates in rates:update', () => {
    const payload = handler.formatRates(mockRates);
    expect(payload[0].exchanges.binance.normalized).toBeDefined();
    expect(payload[0].exchanges.binance.originalInterval).toBe(8);
  });
});
```

### Integration Tests

```typescript
describe('WebSocket Time Basis Integration', () => {
  it('should handle complete time basis flow', async () => {
    // 1. Connect
    await socket.connect();

    // 2. Subscribe
    socket.emit('subscribe:market-rates');
    await waitFor('subscribed:market-rates');

    // 3. Set time basis
    socket.emit('set-time-basis', { timeBasis: 4 });
    const response = await waitFor('time-basis-updated');
    expect(response.timeBasis).toBe(4);

    // 4. Receive rates with normalized data
    const ratesUpdate = await waitFor('rates:update');
    expect(ratesUpdate.data.rates[0].exchanges.binance.normalized['4h']).toBeDefined();
  });
});
```

---

## Performance Metrics

### Expected Performance

| Metric | Target | Notes |
|--------|--------|-------|
| Event handling latency | <100ms | Time from emit to response |
| Payload size increase | +10-15% | Due to normalized data |
| Broadcast frequency | 5s | Unchanged |
| Concurrent connections | 100+ | Unchanged |

### Monitoring

```typescript
// Add logging for time basis changes
logger.info({
  socketId: socket.id,
  userId: authenticatedSocket.data.userId,
  timeBasis,
  duration: Date.now() - startTime
}, 'Time basis updated');
```

---

## Migration Checklist

- [x] Update validation logic to accept 4h
- [x] Add normalized field to rates:update payload
- [x] Add originalInterval field to rates:update payload
- [x] Update error messages to include all valid options
- [x] Add unit tests for 4h validation
- [x] Add integration tests for normalized data
- [x] Update client-side types (already done in types.ts)
- [x] Update documentation

---

## Backward Compatibility Statement

✅ **100% Backward Compatible**

- Old clients (using 1h/8h/24h) will continue to work without changes
- New fields are optional and will be ignored by old clients
- Error handling remains unchanged
- Connection flow remains unchanged
- Event names remain unchanged

---

## References

- Source: `src/websocket/handlers/MarketRatesHandler.ts`
- Types: `app/(dashboard)/market-monitor/types.ts`
- Hook: `app/(dashboard)/market-monitor/hooks/useMarketRates.ts`
- Feature Spec: `specs/019-fix-time-basis-switching/spec.md`
