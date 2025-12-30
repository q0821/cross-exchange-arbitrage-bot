# WebSocket Events Contract

**Feature**: 052-specify-scripts-bash
**Date**: 2025-12-31

## 1. 交易所 → 系統（入站事件）

### 1.1 Binance 事件

#### markPriceUpdate (資金費率)

```typescript
// Stream: btcusdt@markPrice@1s
interface BinanceMarkPriceUpdate {
  e: 'markPriceUpdate';
  E: number;              // Event time (ms)
  s: string;              // Symbol, e.g., 'BTCUSDT'
  p: string;              // Mark price
  i: string;              // Index price
  P: string;              // Estimated settle price
  r: string;              // Funding rate
  T: number;              // Next funding time (ms)
}
```

#### ACCOUNT_UPDATE (持倉/餘額變更)

```typescript
// Stream: User Data Stream (listenKey)
interface BinanceAccountUpdate {
  e: 'ACCOUNT_UPDATE';
  E: number;              // Event time (ms)
  T: number;              // Transaction time (ms)
  a: {
    m: string;            // Event reason: 'ORDER' | 'FUNDING_FEE' | 'DEPOSIT' | ...
    B: Array<{
      a: string;          // Asset
      wb: string;         // Wallet balance
      cw: string;         // Cross wallet balance
      bc: string;         // Balance change
    }>;
    P: Array<{
      s: string;          // Symbol
      pa: string;         // Position amount
      ep: string;         // Entry price
      cr: string;         // Accumulated realized
      up: string;         // Unrealized PnL
      ps: 'LONG' | 'SHORT' | 'BOTH';
      bep: string;        // Break-even price
    }>;
  };
}
```

#### ORDER_TRADE_UPDATE (訂單狀態)

```typescript
interface BinanceOrderTradeUpdate {
  e: 'ORDER_TRADE_UPDATE';
  E: number;              // Event time (ms)
  T: number;              // Transaction time (ms)
  o: {
    s: string;            // Symbol
    c: string;            // Client order ID
    S: 'BUY' | 'SELL';
    o: string;            // Order type: 'LIMIT' | 'MARKET' | 'STOP_MARKET' | 'TAKE_PROFIT_MARKET'
    x: string;            // Execution type: 'NEW' | 'TRADE' | 'CANCELED' | 'EXPIRED'
    X: string;            // Order status: 'NEW' | 'FILLED' | 'CANCELED' | ...
    i: number;            // Order ID
    l: string;            // Last filled quantity
    z: string;            // Cumulative filled quantity
    L: string;            // Last filled price
    ap: string;           // Average price
    sp: string;           // Stop price
    ps: 'LONG' | 'SHORT' | 'BOTH';
    rp: string;           // Realized profit
  };
}
```

---

### 1.2 OKX 事件

#### funding-rate

```typescript
// Channel: funding-rate
interface OkxFundingRateEvent {
  arg: {
    channel: 'funding-rate';
    instId: string;       // e.g., 'BTC-USDT-SWAP'
  };
  data: Array<{
    instId: string;
    fundingRate: string;
    fundingTime: string;  // Unix timestamp (ms)
    nextFundingRate: string;
    nextFundingTime: string;
  }>;
}
```

#### positions

```typescript
// Channel: positions
interface OkxPositionEvent {
  arg: {
    channel: 'positions';
    instType: 'SWAP';
  };
  data: Array<{
    posId: string;
    instId: string;
    posSide: 'long' | 'short' | 'net';
    pos: string;          // Position quantity
    avgPx: string;        // Average price
    markPx: string;
    lever: string;
    liquidPx: string;
    upl: string;          // Unrealized PnL
    uplRatio: string;
    mgnRatio: string;
    mmr: string;          // Maintenance margin
    imr: string;          // Initial margin
    ts: string;           // Timestamp (ms)
  }>;
}
```

#### orders

```typescript
// Channel: orders
interface OkxOrderEvent {
  arg: {
    channel: 'orders';
    instType: 'SWAP';
  };
  data: Array<{
    instId: string;
    ordId: string;
    clOrdId: string;
    px: string;
    sz: string;
    ordType: 'limit' | 'market' | 'trigger' | 'stop_loss' | 'take_profit';
    side: 'buy' | 'sell';
    posSide: 'long' | 'short' | 'net';
    state: 'live' | 'filled' | 'canceled' | 'partially_filled';
    fillSz: string;
    fillPx: string;
    pnl: string;
    fee: string;
    feeCcy: string;
    cTime: string;
    uTime: string;
  }>;
}
```

---

### 1.3 Gate.io 事件

#### futures.tickers (資金費率)

```typescript
// Channel: futures.tickers
interface GateioTickerEvent {
  time: number;
  channel: 'futures.tickers';
  event: 'update';
  result: {
    contract: string;       // e.g., 'BTC_USDT'
    last: string;
    mark_price: string;
    index_price: string;
    funding_rate: string;
    funding_rate_indicative: string;
    volume_24h: string;
    volume_24h_usd: string;
  };
}
```

#### futures.positions

```typescript
// Channel: futures.positions (authenticated)
interface GateioPositionEvent {
  time: number;
  channel: 'futures.positions';
  event: 'update';
  result: Array<{
    contract: string;
    size: number;           // Position size (positive = long, negative = short)
    entry_price: string;
    mark_price: string;
    realised_pnl: string;
    unrealised_pnl: string;
    leverage: number;
    margin: string;
    liq_price: string;      // Liquidation price
    user: string;           // User ID
  }>;
}
```

#### futures.orders

```typescript
// Channel: futures.orders (authenticated)
interface GateioOrderEvent {
  time: number;
  channel: 'futures.orders';
  event: 'update';
  result: Array<{
    id: number;
    contract: string;
    size: number;
    price: string;
    status: 'open' | 'finished';
    finish_as: 'filled' | 'cancelled' | 'liquidated' | 'ioc' | 'auto_deleveraged' | 'reduce_only';
    fill_price: string;
    left: number;           // Remaining size
    is_close: boolean;
    is_reduce_only: boolean;
    create_time: number;
    finish_time: number;
  }>;
}
```

---

### 1.4 BingX 事件

#### accountUpdate (GZIP 壓縮)

```typescript
// Stream: User Data Stream (listenKey)
// Note: Message is GZIP compressed
interface BingxAccountUpdate {
  e: 'ACCOUNT_UPDATE';
  E: number;              // Event time (ms)
  a: {
    m: string;            // Event reason
    B: Array<{
      a: string;          // Asset
      wb: string;         // Wallet balance
      cw: string;         // Cross wallet balance
    }>;
    P: Array<{
      s: string;          // Symbol
      pa: string;         // Position amount
      ep: string;         // Entry price
      up: string;         // Unrealized PnL
      ps: 'LONG' | 'SHORT';
      mp: string;         // Mark price
    }>;
  };
}
```

#### orderTradeUpdate (GZIP 壓縮)

```typescript
interface BingxOrderTradeUpdate {
  e: 'ORDER_TRADE_UPDATE';
  E: number;              // Event time (ms)
  o: {
    s: string;            // Symbol
    c: string;            // Client order ID
    S: 'BUY' | 'SELL';
    o: string;            // Order type
    X: string;            // Order status
    i: string;            // Order ID
    z: string;            // Filled quantity
    ap: string;           // Average price
    sp: string;           // Stop price (for conditional orders)
    rp: string;           // Realized profit
    ps: 'LONG' | 'SHORT';
  };
}
```

---

## 2. 系統 → 前端（出站事件）

### 2.1 費率更新事件

```typescript
// Event: rates:update
interface RatesUpdateEvent {
  type: 'rates:update';
  data: {
    rates: Array<{
      symbol: string;
      exchanges: Record<string, {
        rate: number;
        price: number | null;
        normalized: Record<string, number>;
        originalInterval: number;
      }>;
      bestPair: {
        longExchange: string;
        shortExchange: string;
        spread: number;
        spreadPercent: number;
        annualizedReturn: number;
        priceDiffPercent: number | null;
      } | null;
      status: 'opportunity' | 'approaching' | 'normal';
      timestamp: string;
    }>;
    timestamp: string;
  };
}
```

### 2.2 觸發偵測事件

```typescript
// Event: position:trigger:detected
interface TriggerDetectedEvent {
  type: 'position:trigger:detected';
  data: {
    positionId: string;
    symbol: string;
    triggerType: 'LONG_SL' | 'LONG_TP' | 'SHORT_SL' | 'SHORT_TP';
    exchange: string;
    triggerPrice: string;
    detectedAt: string;
    source: 'websocket' | 'rest';
  };
}
```

### 2.3 平倉進度事件

```typescript
// Event: position:trigger:close:progress
interface TriggerCloseProgressEvent {
  type: 'position:trigger:close:progress';
  data: {
    positionId: string;
    step: 'detecting' | 'closing_hedge' | 'completed' | 'failed';
    progress: number;       // 0-100
    message: string;
    details?: {
      hedgeLeg: {
        exchange: string;
        symbol: string;
        side: string;
      };
    };
  };
}
```

### 2.4 WebSocket 連線狀態事件

```typescript
// Event: ws:connection:status
interface WsConnectionStatusEvent {
  type: 'ws:connection:status';
  data: {
    exchange: string;
    channelType: 'public' | 'private';
    status: 'connected' | 'reconnecting' | 'disconnected' | 'fallback_rest';
    lastUpdate: string;
    error?: string;
  };
}
```

---

## 3. 內部事件（服務間通訊）

### 3.1 FundingRateReceived

```typescript
// Internal event for RatesCache update
interface FundingRateReceived {
  exchange: ExchangeName;
  symbol: string;
  fundingRate: Decimal;
  nextFundingTime: Date;
  markPrice?: Decimal;
  source: 'websocket' | 'rest';
  receivedAt: Date;
}
```

### 3.2 PositionChanged

```typescript
// Internal event for position tracking
interface PositionChanged {
  exchange: ExchangeName;
  symbol: string;
  side: 'LONG' | 'SHORT';
  size: Decimal;
  entryPrice: Decimal;
  markPrice: Decimal;
  unrealizedPnl: Decimal;
  receivedAt: Date;
}
```

### 3.3 OrderStatusChanged

```typescript
// Internal event for trigger detection
interface OrderStatusChanged {
  exchange: ExchangeName;
  symbol: string;
  orderId: string;
  orderType: string;
  status: 'NEW' | 'FILLED' | 'CANCELED' | 'EXPIRED';
  side: 'BUY' | 'SELL';
  positionSide: 'LONG' | 'SHORT';
  filledQty: Decimal;
  avgPrice: Decimal;
  stopPrice?: Decimal;     // For conditional orders
  realizedPnl?: Decimal;
  receivedAt: Date;
}
```

---

## 4. 錯誤事件

### 4.1 WebSocket 錯誤

```typescript
// Event: ws:error
interface WsErrorEvent {
  type: 'ws:error';
  data: {
    exchange: string;
    channelType: 'public' | 'private';
    errorCode: string;
    errorMessage: string;
    recoverable: boolean;
    action: 'reconnecting' | 'fallback_rest' | 'manual_intervention';
    timestamp: string;
  };
}
```

### 4.2 認證錯誤

```typescript
// Event: ws:auth:error
interface WsAuthErrorEvent {
  type: 'ws:auth:error';
  data: {
    exchange: string;
    userId: string;
    errorCode: string;
    errorMessage: string;
    action: 'retry' | 'reauth' | 'check_api_key';
    timestamp: string;
  };
}
```
