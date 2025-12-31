# Data Model: Native WebSocket Clients

**Feature**: 054-native-websocket-clients
**Created**: 2025-12-31

## Overview

此功能不新增資料庫模型，主要使用記憶體中的數據結構和現有模型。

## Existing Models (Reference Only)

### ApiKey (現有)
用於私有頻道認證，從資料庫讀取已加密的 API 憑證。

```prisma
model ApiKey {
  id              String    @id @default(cuid())
  userId          String
  exchange        String    // 'binance' | 'okx' | 'gateio' | 'bingx' | 'mexc'
  apiKey          String
  secretKey       String
  passphrase      String?   // OKX 需要
  isTestnet       Boolean   @default(false)
  lastValidatedAt DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```

## In-Memory Data Structures

### FundingRateReceived

標準化的資金費率數據，由各交易所 WebSocket 客戶端產生。

```typescript
interface FundingRateReceived {
  /** 交易所名稱 */
  exchange: 'binance' | 'okx' | 'gateio' | 'bingx' | 'mexc';

  /** 內部交易對格式 (e.g., BTCUSDT) */
  symbol: string;

  /** 當前資金費率 (小數格式, e.g., 0.0001 = 0.01%) */
  fundingRate: Decimal;

  /** 下次結算時間 */
  nextFundingTime: Date;

  /** 預估下次資金費率 (如有) */
  nextFundingRate?: Decimal;

  /** 標記價格 */
  markPrice?: Decimal;

  /** 指數價格 */
  indexPrice?: Decimal;

  /** 數據來源 */
  source: 'websocket' | 'rest';

  /** 接收時間 */
  receivedAt: Date;
}
```

### PriceData

標準化的價格數據。

```typescript
interface PriceData {
  /** 交易所名稱 */
  exchange: ExchangeName;

  /** 內部交易對格式 */
  symbol: string;

  /** 最新成交價 */
  lastPrice: number;

  /** 標記價格 */
  markPrice: number;

  /** 指數價格 (如有) */
  indexPrice?: number;

  /** 數據時間戳 */
  timestamp: Date;

  /** 數據來源 */
  source: 'websocket' | 'rest';
}
```

### OrderUpdate

訂單狀態更新數據 (P2 功能)。

```typescript
interface OrderUpdate {
  /** 交易所名稱 */
  exchange: ExchangeName;

  /** 訂單 ID */
  orderId: string;

  /** 客戶端訂單 ID (如有) */
  clientOrderId?: string;

  /** 交易對 */
  symbol: string;

  /** 訂單狀態 */
  status: 'NEW' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELED' | 'REJECTED' | 'EXPIRED';

  /** 訂單方向 */
  side: 'BUY' | 'SELL';

  /** 持倉方向 */
  positionSide: 'LONG' | 'SHORT' | 'BOTH';

  /** 訂單類型 */
  orderType: 'LIMIT' | 'MARKET' | 'STOP_MARKET' | 'TAKE_PROFIT_MARKET';

  /** 原始數量 */
  origQty: Decimal;

  /** 已成交數量 */
  executedQty: Decimal;

  /** 累計成交金額 */
  cumQuote: Decimal;

  /** 成交均價 */
  avgPrice: Decimal;

  /** 更新時間 */
  updateTime: Date;
}
```

### WebSocketClientState

WebSocket 客戶端內部狀態。

```typescript
interface WebSocketClientState {
  /** 連線 ID */
  connectionId: string;

  /** 交易所 */
  exchange: ExchangeName;

  /** 是否已連線 */
  isConnected: boolean;

  /** 是否已銷毀 */
  isDestroyed: boolean;

  /** 已訂閱的交易對 */
  subscribedSymbols: Set<string>;

  /** 訊息計數 */
  messageCount: number;

  /** 最後訊息時間 */
  lastMessageTime: Date | null;

  /** 連線開始時間 */
  connectionStartTime: Date | null;

  /** 重連次數 */
  reconnectCount: number;
}
```

### ConnectionPoolState

連線池狀態。

```typescript
interface ConnectionPoolState {
  /** 交易所 */
  exchange: ExchangeName;

  /** 單一連線最大訂閱數 */
  maxPerConnection: number;

  /** 活躍連線數 */
  activeConnections: number;

  /** 總訂閱數 */
  totalSubscriptions: number;

  /** 各連線訂閱分佈 */
  subscriptionDistribution: Map<number, number>;
}
```

## Symbol Conversion Rules

| 內部格式 | OKX 格式 | Gate.io 格式 | BingX 格式 |
|---------|---------|-------------|-----------|
| BTCUSDT | BTC-USDT-SWAP | BTC_USDT | BTC-USDT |
| ETHUSDT | ETH-USDT-SWAP | ETH_USDT | ETH-USDT |
| SOLUSDT | SOL-USDT-SWAP | SOL_USDT | SOL-USDT |

### Conversion Functions

```typescript
// 內部格式 → 交易所格式
function toOkxSymbol(symbol: string): string {
  // BTCUSDT → BTC-USDT-SWAP
  const base = symbol.replace('USDT', '');
  return `${base}-USDT-SWAP`;
}

function toGateioSymbol(symbol: string): string {
  // BTCUSDT → BTC_USDT
  const base = symbol.replace('USDT', '');
  return `${base}_USDT`;
}

function toBingxSymbol(symbol: string): string {
  // BTCUSDT → BTC-USDT
  const base = symbol.replace('USDT', '');
  return `${base}-USDT`;
}

// 交易所格式 → 內部格式
function fromOkxSymbol(instId: string): string {
  // BTC-USDT-SWAP → BTCUSDT
  return instId.replace('-SWAP', '').replace('-', '');
}

function fromGateioSymbol(contract: string): string {
  // BTC_USDT → BTCUSDT
  return contract.replace('_', '');
}

function fromBingxSymbol(symbol: string): string {
  // BTC-USDT → BTCUSDT
  return symbol.replace('-', '');
}
```

## State Transitions

### WebSocket Client Lifecycle

```
[初始化] → [連線中] → [已連線] → [訂閱中] → [運作中]
                ↓           ↓           ↓
           [連線失敗]  [斷線]     [訂閱失敗]
                ↓           ↓           ↓
           [重連等待] ← ← ← ← ← ← ← ← ←
                ↓
           [最大重試] → [銷毀/切換REST]
```

### Connection States

| 狀態 | 說明 | 觸發條件 |
|------|------|---------|
| INITIAL | 初始狀態 | 建立客戶端 |
| CONNECTING | 連線中 | 呼叫 connect() |
| CONNECTED | 已連線 | WebSocket open 事件 |
| SUBSCRIBING | 訂閱中 | 發送訂閱請求 |
| ACTIVE | 運作中 | 收到訂閱確認 |
| RECONNECTING | 重連中 | 連線斷開，開始重連 |
| DISCONNECTED | 已斷線 | 達到最大重試次數 |
| DESTROYED | 已銷毀 | 呼叫 destroy() |

## Validation Rules

### FundingRateReceived
- `fundingRate` 必須在 -1 到 1 之間（-100% ~ 100%）
- `nextFundingTime` 必須大於當前時間
- `markPrice` 和 `indexPrice` 必須大於 0

### Symbol
- 內部格式必須匹配 `/^[A-Z]+USDT$/`
- 不允許空白或特殊字元

### Decimal Precision
- 資金費率：保留 8 位小數
- 價格：依交易對不同，通常 2-8 位小數
- 數量：依交易對不同，通常 3-8 位小數
