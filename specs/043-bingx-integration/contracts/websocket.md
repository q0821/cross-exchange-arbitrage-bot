# WebSocket Events: BingX 交易所整合

**Feature**: 043-bingx-integration
**Date**: 2025-12-25

## Overview

BingX 整合複用現有的 WebSocket 事件架構，無需新增事件類型。以下列出與 BingX 相關的事件。

## Server → Client Events

### 1. 資金費率更新

**Event**: `funding-rates:update`

當 BingX 資金費率更新時廣播給所有客戶端。

```typescript
interface FundingRatesUpdatePayload {
  timestamp: string; // ISO 8601
  rates: {
    exchange: 'binance' | 'okx' | 'gateio' | 'mexc' | 'bingx';
    symbol: string;
    fundingRate: number;
    nextFundingTime: string;
    markPrice: number;
    indexPrice: number;
    fundingInterval: 1 | 4 | 8; // BingX 支援 1h, 4h, 8h
  }[];
}
```

### 2. 開倉進度

**Event**: `position:open:progress`

BingX 開倉進度更新。

```typescript
interface PositionOpenProgressPayload {
  positionId: string;
  step: 'VALIDATING' | 'SETTING_LEVERAGE' | 'OPENING_LONG' | 'OPENING_SHORT' | 'SETTING_SL_TP';
  progress: number; // 0-100
  exchange?: 'binance' | 'okx' | 'gateio' | 'mexc' | 'bingx';
  message: string;
}
```

### 3. 開倉成功

**Event**: `position:open:success`

BingX 開倉成功。

```typescript
interface PositionOpenSuccessPayload {
  positionId: string;
  symbol: string;
  longExchange: string;
  shortExchange: string;
  longEntryPrice: number;
  shortEntryPrice: number;
  positionSize: number;
  marginUsed: number;
  stopLoss?: {
    enabled: boolean;
    longPrice: number;
    shortPrice: number;
  };
  takeProfit?: {
    enabled: boolean;
    longPrice: number;
    shortPrice: number;
  };
}
```

### 4. 開倉失敗

**Event**: `position:open:failed`

BingX 開倉失敗。

```typescript
interface PositionOpenFailedPayload {
  positionId: string;
  error: string;
  failedStep: string;
  exchange?: 'binance' | 'okx' | 'gateio' | 'mexc' | 'bingx';
  rollbackStatus: 'SUCCESS' | 'PARTIAL' | 'FAILED';
}
```

### 5. 平倉進度

**Event**: `position:close:progress`

BingX 平倉進度更新。

```typescript
interface PositionCloseProgressPayload {
  positionId: string;
  step: 'CANCELING_ORDERS' | 'CLOSING_LONG' | 'CLOSING_SHORT' | 'CALCULATING_PNL';
  progress: number;
  exchange?: 'binance' | 'okx' | 'gateio' | 'mexc' | 'bingx';
  message: string;
}
```

### 6. 平倉成功

**Event**: `position:close:success`

BingX 平倉成功。

```typescript
interface PositionCloseSuccessPayload {
  positionId: string;
  tradeId: string;
  pnl: {
    priceDiff: number;
    fundingRate: number;
    totalFees: number;
    total: number;
  };
  roi: number;
  holdingDuration: number; // seconds
}
```

### 7. 平倉失敗

**Event**: `position:close:failed`

BingX 平倉失敗。

```typescript
interface PositionCloseFailedPayload {
  positionId: string;
  error: string;
  failedExchange: 'binance' | 'okx' | 'gateio' | 'mexc' | 'bingx';
  partialClose?: {
    closedExchange: string;
    remainingExchange: string;
  };
}
```

### 8. 條件單狀態

**Event**: `position:conditional:status`

BingX 條件單（停損/停利）狀態更新。

```typescript
interface ConditionalOrderStatusPayload {
  positionId: string;
  exchange: 'binance' | 'okx' | 'gateio' | 'mexc' | 'bingx';
  status: 'SETTING' | 'SET' | 'PARTIAL' | 'FAILED';
  stopLoss?: {
    orderId: string;
    triggerPrice: number;
    status: 'SET' | 'FAILED';
  };
  takeProfit?: {
    orderId: string;
    triggerPrice: number;
    status: 'SET' | 'FAILED';
  };
  error?: string;
}
```

## Client → Server Events

### 1. 訂閱資金費率

**Event**: `subscribe:funding-rates`

訂閱特定交易對的資金費率更新。

```typescript
interface SubscribeFundingRatesPayload {
  symbols: string[];
  exchanges?: ('binance' | 'okx' | 'gateio' | 'mexc' | 'bingx')[];
}
```

### 2. 取消訂閱

**Event**: `unsubscribe:funding-rates`

```typescript
interface UnsubscribeFundingRatesPayload {
  symbols: string[];
}
```

## Connection Flow

```
Client                                    Server
  │                                          │
  │─── connect ───────────────────────────►  │
  │                                          │
  │◄── connected (with session id) ────────  │
  │                                          │
  │─── subscribe:funding-rates ────────────► │
  │    { symbols: ['BTCUSDT'], exchanges: ['bingx'] }
  │                                          │
  │◄── funding-rates:update (periodic) ────  │
  │    { rates: [{ exchange: 'bingx', ... }] }
  │                                          │
  │◄── position:open:progress ─────────────  │
  │    { step: 'OPENING_LONG', exchange: 'bingx' }
  │                                          │
  │◄── position:open:success ──────────────  │
  │                                          │
  │◄── position:conditional:status ────────  │
  │    { exchange: 'bingx', status: 'SET' }
  │                                          │
```

## Error Codes

| Code | Description |
|------|-------------|
| `BINGX_AUTH_ERROR` | BingX API 認證失敗 |
| `BINGX_RATE_LIMIT` | BingX API 限流 |
| `BINGX_INSUFFICIENT_BALANCE` | BingX 餘額不足 |
| `BINGX_ORDER_FAILED` | BingX 下單失敗 |
| `BINGX_CONDITIONAL_FAILED` | BingX 條件單設定失敗 |

## Notes

1. BingX 事件格式與現有交易所（Binance, OKX, Gate.io, MEXC）完全一致
2. `fundingInterval` 欄位在 BingX 中可能為 1、4 或 8 小時
3. 條件單事件需要額外監控，因 BingX 條件單 API 行為可能與其他交易所不同
