# WebSocket Message Contracts

**Feature**: 054-native-websocket-clients
**Created**: 2025-12-31

## Overview

定義各交易所 WebSocket 訊息格式和內部標準化格式的契約。

---

## 1. OKX WebSocket Messages

### 1.1 訂閱請求

```typescript
interface OkxSubscribeRequest {
  op: 'subscribe' | 'unsubscribe';
  args: OkxSubscriptionArg[];
}

interface OkxSubscriptionArg {
  channel: 'funding-rate' | 'mark-price' | 'tickers';
  instId: string;  // e.g., "BTC-USDT-SWAP"
}
```

**Example**:
```json
{
  "op": "subscribe",
  "args": [
    { "channel": "funding-rate", "instId": "BTC-USDT-SWAP" },
    { "channel": "mark-price", "instId": "BTC-USDT-SWAP" }
  ]
}
```

### 1.2 資金費率推送

```typescript
interface OkxFundingRateEvent {
  arg: {
    channel: 'funding-rate';
    instId: string;
  };
  data: OkxFundingRateData[];
}

interface OkxFundingRateData {
  instId: string;
  fundingRate: string;      // 小數字串, e.g., "0.0001"
  fundingTime: string;      // 毫秒時間戳
  nextFundingRate: string;
  nextFundingTime: string;
}
```

### 1.3 標記價格推送

```typescript
interface OkxMarkPriceEvent {
  arg: {
    channel: 'mark-price';
    instId: string;
  };
  data: OkxMarkPriceData[];
}

interface OkxMarkPriceData {
  instId: string;
  markPx: string;   // 標記價格
  ts: string;       // 毫秒時間戳
}
```

### 1.4 Zod Schema

```typescript
import { z } from 'zod';

export const OkxFundingRateDataSchema = z.object({
  instId: z.string(),
  fundingRate: z.string(),
  fundingTime: z.string(),
  nextFundingRate: z.string(),
  nextFundingTime: z.string(),
});

export const OkxFundingRateEventSchema = z.object({
  arg: z.object({
    channel: z.literal('funding-rate'),
    instId: z.string(),
  }),
  data: z.array(OkxFundingRateDataSchema),
});

export const OkxMarkPriceDataSchema = z.object({
  instId: z.string(),
  markPx: z.string(),
  ts: z.string(),
});

export const OkxMarkPriceEventSchema = z.object({
  arg: z.object({
    channel: z.literal('mark-price'),
    instId: z.string(),
  }),
  data: z.array(OkxMarkPriceDataSchema),
});
```

---

## 2. Gate.io WebSocket Messages

### 2.1 訂閱請求

```typescript
interface GateioSubscribeRequest {
  time: number;     // Unix 時間戳 (秒)
  channel: string;
  event: 'subscribe' | 'unsubscribe';
  payload: string[];
}
```

**Example**:
```json
{
  "time": 1234567890,
  "channel": "futures.tickers",
  "event": "subscribe",
  "payload": ["BTC_USDT", "ETH_USDT"]
}
```

### 2.2 Tickers 推送 (含資金費率)

```typescript
interface GateioTickersEvent {
  time: number;
  channel: 'futures.tickers';
  event: 'update';
  result: GateioTickerData;
}

interface GateioTickerData {
  contract: string;              // e.g., "BTC_USDT"
  last: string;                  // 最新成交價
  mark_price: string;            // 標記價格
  index_price: string;           // 指數價格
  funding_rate: string;          // 當前資金費率
  funding_rate_indicative: string; // 預估下次資金費率
  volume_24h: string;
  volume_24h_quote: string;
  low_24h: string;
  high_24h: string;
}
```

### 2.3 Zod Schema

```typescript
import { z } from 'zod';

export const GateioTickerDataSchema = z.object({
  contract: z.string(),
  last: z.string(),
  mark_price: z.string(),
  index_price: z.string(),
  funding_rate: z.string(),
  funding_rate_indicative: z.string(),
  volume_24h: z.string().optional(),
  volume_24h_quote: z.string().optional(),
  low_24h: z.string().optional(),
  high_24h: z.string().optional(),
});

export const GateioTickersEventSchema = z.object({
  time: z.number(),
  channel: z.literal('futures.tickers'),
  event: z.literal('update'),
  result: GateioTickerDataSchema,
});
```

---

## 3. BingX WebSocket Messages

### 3.1 訂閱請求

```typescript
interface BingxSubscribeRequest {
  id: string;           // 唯一請求 ID
  reqType: 'sub' | 'unsub';
  dataType: string;     // e.g., "BTC-USDT@markPrice"
}
```

**Example**:
```json
{
  "id": "req-001",
  "reqType": "sub",
  "dataType": "BTC-USDT@markPrice"
}
```

### 3.2 標記價格推送 (含資金費率)

```typescript
interface BingxMarkPriceEvent {
  code: number;
  data: BingxMarkPriceData;
}

interface BingxMarkPriceData {
  e: 'markPriceUpdate';   // 事件類型
  E: number;              // 事件時間 (毫秒)
  s: string;              // 交易對, e.g., "BTC-USDT"
  p: string;              // 標記價格
  r: string;              // 資金費率
  T: number;              // 下次結算時間 (毫秒)
}
```

### 3.3 Zod Schema

```typescript
import { z } from 'zod';

export const BingxMarkPriceDataSchema = z.object({
  e: z.literal('markPriceUpdate'),
  E: z.number(),
  s: z.string(),
  p: z.string(),
  r: z.string(),
  T: z.number(),
});

export const BingxMarkPriceEventSchema = z.object({
  code: z.number(),
  data: BingxMarkPriceDataSchema,
});
```

---

## 4. Standardized Output

### 4.1 FundingRateReceived

所有交易所的資金費率數據統一轉換為此格式。

```typescript
interface FundingRateReceived {
  exchange: 'binance' | 'okx' | 'gateio' | 'bingx' | 'mexc';
  symbol: string;              // 內部格式: BTCUSDT
  fundingRate: Decimal;
  nextFundingTime: Date;
  nextFundingRate?: Decimal;
  markPrice?: Decimal;
  indexPrice?: Decimal;
  source: 'websocket' | 'rest';
  receivedAt: Date;
}
```

### 4.2 Transformation Examples

**OKX → FundingRateReceived**:
```typescript
function transformOkxFundingRate(event: OkxFundingRateEvent): FundingRateReceived {
  const data = event.data[0];
  return {
    exchange: 'okx',
    symbol: data.instId.replace('-SWAP', '').replace('-', ''),
    fundingRate: new Decimal(data.fundingRate),
    nextFundingTime: new Date(parseInt(data.nextFundingTime)),
    nextFundingRate: new Decimal(data.nextFundingRate),
    source: 'websocket',
    receivedAt: new Date(),
  };
}
```

**Gate.io → FundingRateReceived**:
```typescript
function transformGateioTicker(event: GateioTickersEvent): FundingRateReceived {
  const data = event.result;
  return {
    exchange: 'gateio',
    symbol: data.contract.replace('_', ''),
    fundingRate: new Decimal(data.funding_rate),
    nextFundingTime: calculateNextFundingTime(), // 需計算
    nextFundingRate: new Decimal(data.funding_rate_indicative),
    markPrice: new Decimal(data.mark_price),
    indexPrice: new Decimal(data.index_price),
    source: 'websocket',
    receivedAt: new Date(),
  };
}
```

**BingX → FundingRateReceived**:
```typescript
function transformBingxMarkPrice(event: BingxMarkPriceEvent): FundingRateReceived {
  const data = event.data;
  return {
    exchange: 'bingx',
    symbol: data.s.replace('-', ''),
    fundingRate: new Decimal(data.r),
    nextFundingTime: new Date(data.T),
    markPrice: new Decimal(data.p),
    source: 'websocket',
    receivedAt: new Date(),
  };
}
```

---

## 5. Event Emitter Interface

### 5.1 WebSocket Client Events

```typescript
interface WebSocketClientEvents {
  /** 資金費率更新 */
  'fundingRate': (data: FundingRateReceived) => void;

  /** 批量資金費率更新 */
  'fundingRateBatch': (data: FundingRateReceived[]) => void;

  /** 價格更新 */
  'price': (data: PriceData) => void;

  /** 訂單更新 (P2) */
  'orderUpdate': (data: OrderUpdate) => void;

  /** 連線成功 */
  'connected': () => void;

  /** 斷線 */
  'disconnected': () => void;

  /** 錯誤 */
  'error': (error: Error) => void;

  /** 重連中 */
  'reconnecting': (attempt: number) => void;

  /** 重新訂閱完成 */
  'resubscribed': (count: number) => void;
}
```

---

## 6. Error Codes

### 6.1 OKX Error Responses

| Code | Message | 處理方式 |
|------|---------|---------|
| 60001 | Login failed | 重新認證 |
| 60002 | Invalid request | 檢查請求格式 |
| 60003 | Rate limit exceeded | 等待後重試 |
| 60004 | Connection limit exceeded | 減少連線數 |
| 60005 | Channel not found | 檢查頻道名稱 |

### 6.2 Gate.io Error Responses

| Code | Message | 處理方式 |
|------|---------|---------|
| 1 | Invalid request | 檢查請求格式 |
| 2 | Server error | 重試 |
| 3 | Auth failed | 重新認證 |

### 6.3 BingX Error Responses

| Code | Message | 處理方式 |
|------|---------|---------|
| 100001 | Signature error | 重新簽名 |
| 100002 | Invalid parameter | 檢查參數 |
| 100500 | Internal error | 重試 |
