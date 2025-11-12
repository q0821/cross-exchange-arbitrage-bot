# WebSocket Contract: Market Rates with Price Spread and Net Return

**Feature**: 011-price-spread-net-return
**Created**: 2025-11-12
**Protocol**: Socket.io 4.8.1
**Transport**: WebSocket (fallback to long-polling)

---

## Overview

此文件定義市場監控 WebSocket 事件的資料格式，包含新增的價差（Price Spread）和淨收益（Net Return）欄位。

---

## Event: `rates:update`

**方向**：Server → Client
**頻率**：每 5 秒推送一次
**描述**：推送所有監控交易對的最新資金費率、價格、價差和淨收益資訊

### Event Payload

```typescript
interface RatesUpdatePayload {
  /** 市場費率資料陣列 */
  rates: MarketRateData[];

  /** 推送時間戳（Unix timestamp, ms） */
  timestamp: number;

  /** 統計資訊 */
  stats?: {
    /** 套利機會數量 */
    opportunityCount: number;

    /** 最後更新時間 */
    lastUpdate: string | null;

    /** 系統運行時間（秒） */
    uptime: number;
  };
}
```

### MarketRateData Schema

```typescript
interface MarketRateData {
  /** 交易對名稱（例如 "BTCUSDT"） */
  symbol: string;

  /** 各交易所的費率和價格資訊 */
  exchanges: {
    [exchangeName: string]: ExchangeRateInfo;
  };

  /**
   * 最佳套利對資訊（包含價差和淨收益）
   * null 表示無套利機會或資料不足
   */
  bestPair: BestArbitragePairData | null;

  /** 狀態：'active' | 'stale' | 'error' */
  status: string;

  /** 資料時間戳（Unix timestamp, ms） */
  timestamp: number;
}
```

### ExchangeRateInfo Schema

```typescript
interface ExchangeRateInfo {
  /** 資金費率（小數形式，例如 0.0001 = 0.01%） */
  rate: number;

  /** 資金費率百分比字串（例如 "0.01%"） */
  ratePercent?: string;

  /**
   * 現貨價格（USDT 計價）
   * null 表示價格暫時無法取得
   */
  price?: number | null;
}
```

### BestArbitragePairData Schema（擴展版本）

```typescript
interface BestArbitragePairData {
  /** 做多交易所名稱 */
  longExchange: string;

  /** 做空交易所名稱 */
  shortExchange: string;

  /** 費率差異（小數形式，例如 0.00005） */
  spread: number;

  /** 費率差異百分比（例如 0.5 表示 0.5%） */
  spreadPercent: number;

  /** 年化收益率百分比 */
  annualizedReturn: number;

  // ========== 新增欄位 ==========

  /**
   * 價差百分比
   *
   * 計算公式：(shortPrice - longPrice) / avgPrice × 100
   *
   * - 正值：做空價格 > 做多價格（有利於套利）
   * - 負值：做空價格 < 做多價格（不利於套利）
   * - null：價格資料暫時無法取得
   */
  priceDiffPercent: number | null;

  /**
   * 淨收益百分比
   *
   * 計算公式：spreadPercent - |priceDiffPercent| - 0.3
   *
   * - 正值：套利有獲利空間
   * - 負值：套利會虧損
   * - null：無法計算（價差資料缺失）
   */
  netReturn: number | null;
}
```

---

## Example Payload

### Complete Example

```json
{
  "rates": [
    {
      "symbol": "BTCUSDT",
      "exchanges": {
        "binance": {
          "rate": 0.0001,
          "ratePercent": "0.01%",
          "price": 50000.5
        },
        "okx": {
          "rate": 0.00015,
          "ratePercent": "0.015%",
          "price": 50050.2
        },
        "mexc": {
          "rate": 0.00012,
          "ratePercent": "0.012%",
          "price": 50025.0
        }
      },
      "bestPair": {
        "longExchange": "binance",
        "shortExchange": "okx",
        "spread": 0.00005,
        "spreadPercent": 0.5,
        "annualizedReturn": 438,
        "priceDiffPercent": 0.1,
        "netReturn": 0.1
      },
      "status": "active",
      "timestamp": 1699999999999
    },
    {
      "symbol": "ETHUSDT",
      "exchanges": {
        "binance": {
          "rate": 0.00008,
          "ratePercent": "0.008%",
          "price": 3000.2
        },
        "okx": {
          "rate": 0.00005,
          "ratePercent": "0.005%",
          "price": 3005.8
        }
      },
      "bestPair": {
        "longExchange": "okx",
        "shortExchange": "binance",
        "spread": 0.00003,
        "spreadPercent": 0.3,
        "annualizedReturn": 262.8,
        "priceDiffPercent": -0.19,
        "netReturn": -0.19
      },
      "status": "active",
      "timestamp": 1699999999999
    }
  ],
  "timestamp": 1699999999999,
  "stats": {
    "opportunityCount": 15,
    "lastUpdate": "2025-11-12T10:30:00.000Z",
    "uptime": 3600
  }
}
```

### Edge Case Examples

**情境 1：價格資料缺失**

```json
{
  "symbol": "SOLUSDT",
  "exchanges": {
    "binance": {
      "rate": 0.0001,
      "ratePercent": "0.01%",
      "price": null  // 價格暫時無法取得
    },
    "okx": {
      "rate": 0.00015,
      "ratePercent": "0.015%",
      "price": 105.5
    }
  },
  "bestPair": {
    "longExchange": "binance",
    "shortExchange": "okx",
    "spread": 0.00005,
    "spreadPercent": 0.5,
    "annualizedReturn": 438,
    "priceDiffPercent": null,  // 無法計算價差
    "netReturn": null           // 無法計算淨收益
  },
  "status": "active",
  "timestamp": 1699999999999
}
```

**情境 2：無套利機會**

```json
{
  "symbol": "ADAUSDT",
  "exchanges": {
    "binance": {
      "rate": 0.00005,
      "ratePercent": "0.005%",
      "price": 0.5
    },
    "okx": {
      "rate": 0.00005,
      "ratePercent": "0.005%",
      "price": 0.501
    }
  },
  "bestPair": null,  // 無套利機會（費率相同）
  "status": "active",
  "timestamp": 1699999999999
}
```

---

## Event: `connect`

**方向**：Client → Server
**描述**：客戶端連線建立

### Connection Options

```typescript
const socket = io('http://localhost:3001', {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});
```

---

## Event: `disconnect`

**方向**：Server → Client
**描述**：連線中斷

### Disconnect Reasons

- `'io server disconnect'` - 伺服器主動斷開
- `'io client disconnect'` - 客戶端主動斷開
- `'ping timeout'` - ping 超時
- `'transport close'` - 傳輸層關閉
- `'transport error'` - 傳輸層錯誤

---

## Event: `error`

**方向**：Server → Client
**描述**：錯誤事件

### Error Payload

```typescript
interface ErrorPayload {
  /** 錯誤訊息 */
  message: string;

  /** 錯誤代碼 */
  code?: string;

  /** 錯誤時間戳 */
  timestamp: number;
}
```

---

## Client Implementation

### Subscribe to Market Rates

```typescript
import { io, Socket } from 'socket.io-client';

const socket: Socket = io('http://localhost:3001');

// 訂閱市場費率更新
socket.on('rates:update', (payload: RatesUpdatePayload) => {
  console.log(`Received ${payload.rates.length} rates`);

  payload.rates.forEach((rate) => {
    if (rate.bestPair) {
      console.log(`${rate.symbol}:`, {
        spread: `${rate.bestPair.spreadPercent}%`,
        priceDiff: rate.bestPair.priceDiffPercent
          ? `${rate.bestPair.priceDiffPercent}%`
          : 'N/A',
        netReturn: rate.bestPair.netReturn
          ? `${rate.bestPair.netReturn}%`
          : 'N/A',
      });
    }
  });
});

// 處理連線事件
socket.on('connect', () => {
  console.log('Connected to WebSocket');
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});

socket.on('error', (error) => {
  console.error('WebSocket error:', error);
});
```

---

## Rate Limiting

- **推送頻率**：每 5 秒一次
- **連線限制**：每個 IP 最多 10 個並發連線
- **重連限制**：5 次重連嘗試後暫停 60 秒

---

## Backward Compatibility

**向後相容**：此更新完全向後相容

- 新增欄位（`priceDiffPercent`、`netReturn`）為可選欄位
- 舊客戶端忽略新欄位，正常顯示其他資訊
- 無需客戶端強制更新

**升級建議**：
- 建議客戶端升級以使用新欄位
- 新客戶端自動接收並顯示價差和淨收益
- 無需手動遷移或配置

---

## Testing

### Manual Testing with websocat

```bash
# 安裝 websocat
brew install websocat  # macOS
apt install websocat   # Ubuntu

# 連接並監聽 WebSocket 事件
websocat "ws://localhost:3001/socket.io/?EIO=4&transport=websocket"
```

### Automated Testing with Playwright

見 `tests/e2e/market-monitor-price-spread.spec.ts`

---

## Monitoring

### Key Metrics

- **推送延遲**：time_to_push < 100ms
- **資料完整性**：priceDiffPercent 和 netReturn 非 null 率 > 95%
- **連線穩定性**：disconnect rate < 1%

### Logging

所有 WebSocket 事件已記錄在 Pino 日誌中：

```typescript
logger.info({
  room,
  rateCount: rates.length,
  opportunityCount: stats.opportunityCount,
  subscriberCount: this.io.sockets.adapter.rooms.get(room)?.size || 0,
  lastUpdate: stats.lastUpdate?.toISOString() || null,
}, 'Broadcasted market rates update');
```

---

## Security

- **無認證**：市場監控資料為公開資訊，無需認證
- **CORS**：允許 `http://localhost:3000`（開發環境）
- **Rate Limiting**：Socket.io 內建速率限制
- **Input Validation**：所有資料經過 Zod schema 驗證

---

## Summary

- **新增欄位**：2 個（priceDiffPercent、netReturn）
- **向後相容**：完全相容
- **推送頻率**：每 5 秒
- **資料來源**：RatesCache（記憶體快取）
- **計算位置**：後端（MarketRatesHandler）
- **測試覆蓋**：單元測試 + E2E 測試
