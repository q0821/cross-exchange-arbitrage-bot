# Research: Native WebSocket Clients

**Feature**: 054-native-websocket-clients
**Created**: 2025-12-31

## 1. OKX WebSocket API

### Decision
使用 OKX 公開 WebSocket API (`wss://ws.okx.com:8443/ws/v5/public`) 訂閱 `funding-rate` 和 `mark-price` 頻道。

### Rationale
- OKX 官方 WebSocket 支援資金費率即時推送
- 不需要 CCXT，直接使用原生 API 可獲得更低延遲
- 與現有 BinanceFundingWs 模式一致

### API Details

**Endpoint**: `wss://ws.okx.com:8443/ws/v5/public`

**訂閱格式**:
```json
{
  "op": "subscribe",
  "args": [
    { "channel": "funding-rate", "instId": "BTC-USDT-SWAP" },
    { "channel": "mark-price", "instId": "BTC-USDT-SWAP" }
  ]
}
```

**推送格式 (funding-rate)**:
```json
{
  "arg": { "channel": "funding-rate", "instId": "BTC-USDT-SWAP" },
  "data": [{
    "instId": "BTC-USDT-SWAP",
    "fundingRate": "0.0001",
    "fundingTime": "1704096000000",
    "nextFundingRate": "0.00012",
    "nextFundingTime": "1704124800000"
  }]
}
```

**推送格式 (mark-price)**:
```json
{
  "arg": { "channel": "mark-price", "instId": "BTC-USDT-SWAP" },
  "data": [{
    "instId": "BTC-USDT-SWAP",
    "markPx": "42000.5",
    "ts": "1704096000000"
  }]
}
```

**Symbol 轉換**: `BTCUSDT` → `BTC-USDT-SWAP`

**連線限制**: 每個連線最多 100 個訂閱頻道

### Alternatives Considered
- CCXT `watchFundingRate`: 不支援 OKX
- REST 輪詢: 延遲高，不符合需求

---

## 2. Gate.io WebSocket API

### Decision
使用 Gate.io Futures WebSocket API (`wss://fx-ws.gateio.ws/v4/ws/usdt`) 訂閱 `futures.tickers` 頻道，一次獲取資金費率和標記價格。

### Rationale
- `futures.tickers` 頻道包含 `funding_rate`、`mark_price`、`index_price`，一次訂閱多種數據
- 減少連線數和訂閱數
- 官方 API 穩定可靠

### API Details

**Endpoint**: `wss://fx-ws.gateio.ws/v4/ws/usdt`

**訂閱格式**:
```json
{
  "time": 1234567890,
  "channel": "futures.tickers",
  "event": "subscribe",
  "payload": ["BTC_USDT"]
}
```

**推送格式**:
```json
{
  "time": 1234567890,
  "channel": "futures.tickers",
  "event": "update",
  "result": {
    "contract": "BTC_USDT",
    "last": "42000.5",
    "mark_price": "42001.2",
    "index_price": "42000.8",
    "funding_rate": "0.0001",
    "funding_rate_indicative": "0.00012",
    "volume_24h": "1000000"
  }
}
```

**Symbol 轉換**: `BTCUSDT` → `BTC_USDT`

**連線限制**: 每個連線最多 20 個訂閱頻道

### Alternatives Considered
- 分別訂閱 `futures.funding_rate` 和 `futures.mark_price`: 需要兩個訂閱，浪費額度
- REST 輪詢: 延遲高

---

## 3. BingX WebSocket API

### Decision
使用 BingX Swap WebSocket API (`wss://open-api-swap.bingx.com/swap-market`) 訂閱 `@markPrice` 頻道。

### Rationale
- BingX 的 `@markPrice` 頻道推送標記價格
- 資金費率需要從 `@ticker` 頻道或定期 REST 補充
- 官方 API 相對簡單

### API Details

**Endpoint**: `wss://open-api-swap.bingx.com/swap-market`

**訂閱格式**:
```json
{
  "id": "unique-id",
  "reqType": "sub",
  "dataType": "BTC-USDT@markPrice"
}
```

**推送格式**:
```json
{
  "code": 0,
  "data": {
    "e": "markPriceUpdate",
    "E": 1704096000000,
    "s": "BTC-USDT",
    "p": "42000.5",
    "r": "0.0001",
    "T": 1704124800000
  }
}
```

**字段說明**:
- `s`: 交易對
- `p`: 標記價格
- `r`: 資金費率
- `T`: 下次結算時間

**Symbol 轉換**: `BTCUSDT` → `BTC-USDT`

**連線限制**: 每個連線最多 50 個訂閱頻道

### Alternatives Considered
- CCXT: 不支援 BingX WebSocket
- REST 輪詢: 延遲高

---

## 4. 多連線管理策略

### Decision
實作 `ConnectionPool` 類別，當訂閱數超過單一連線限制時自動建立多個連線。

### Rationale
- 用戶可能監控 100+ 交易對
- Gate.io 限制最嚴格（20/連線），100 個交易對需要 5 個連線
- 連線池模式可複用於所有交易所

### Implementation Pattern
```typescript
class ConnectionPool {
  private connections: Map<number, WebSocket> = new Map();
  private subscriptions: Map<string, number> = new Map(); // symbol -> connectionId

  constructor(
    private maxPerConnection: number,
    private createConnection: () => WebSocket
  ) {}

  subscribe(symbol: string): void {
    // 找到有空間的連線或建立新連線
    const connectionId = this.findAvailableConnection();
    this.subscriptions.set(symbol, connectionId);
  }
}
```

### Alternatives Considered
- 固定連線數: 不靈活，可能浪費資源或不足
- 優先訂閱前 N 個: 會遺漏部分交易對

---

## 5. 統一訊息格式

### Decision
所有交易所的資金費率和價格數據統一轉換為 `FundingRateReceived` 和 `PriceData` 類型。

### Rationale
- 下游消費者（RatesCache、DataSourceManager）無需關心數據來源
- 便於單元測試和整合測試
- 與現有 Binance 實作一致

### Unified Types
```typescript
interface FundingRateReceived {
  exchange: ExchangeName;
  symbol: string;              // 內部格式: BTCUSDT
  fundingRate: Decimal;
  nextFundingTime: Date;
  markPrice?: Decimal;
  indexPrice?: Decimal;
  source: 'websocket' | 'rest';
  receivedAt: Date;
}

interface PriceData {
  exchange: ExchangeName;
  symbol: string;
  lastPrice: number;
  markPrice: number;
  indexPrice?: number;
  timestamp: Date;
  source: 'websocket' | 'rest';
}
```

---

## 6. 私有頻道認證

### Decision
訂單狀態訂閱需要從 ApiKey 資料庫模型讀取憑證，使用各交易所的簽名認證機制。

### Authentication Methods

**OKX** (wss://ws.okx.com:8443/ws/v5/private):
```json
{
  "op": "login",
  "args": [{
    "apiKey": "<api-key>",
    "passphrase": "<passphrase>",
    "timestamp": "<unix-timestamp>",
    "sign": "<hmac-sha256-signature>"
  }]
}
```

**Gate.io** (同一連線，發送認證訊息):
```json
{
  "time": 1234567890,
  "channel": "futures.orders",
  "event": "subscribe",
  "auth": {
    "method": "api_key",
    "KEY": "<api-key>",
    "SIGN": "<hmac-sha512-signature>"
  },
  "payload": ["user_id"]
}
```

**BingX** (需要 listenKey):
1. 先透過 REST API 取得 listenKey
2. 連接到 `wss://open-api-swap.bingx.com/swap-market?listenKey=<key>`
3. 定期 (每 30 分鐘) 發送心跳延長 listenKey 有效期

### Rationale
- 各交易所認證方式不同，需要分別實作
- API Key 從資料庫讀取，不在程式碼或環境變數中硬編碼
- 私有頻道是 P2 功能，可後續實作

---

## 7. 心跳與健康檢查

### Decision
複用現有 `HealthChecker` 類別，設定 60 秒無訊息視為不健康，觸發重連。

### Rationale
- 現有 BinanceFundingWs 已驗證此模式有效
- 避免重複實作
- 統一的健康檢查策略便於監控

### Exchange-Specific Heartbeat

| 交易所 | 心跳機制 | 間隔 |
|--------|---------|------|
| OKX | 伺服器發送 ping，客戶端回覆 pong | 30 秒 |
| Gate.io | 伺服器發送 ping，客戶端回覆 pong | 10-15 秒 |
| BingX | 客戶端發送 ping，伺服器回覆 pong | 20 秒 |

---

## 8. 指標收集

### Decision
使用現有日誌系統記錄指標，未來可整合 Prometheus 或其他監控系統。

### Metrics to Collect
- `ws_connections_total`: 各交易所連線數
- `ws_messages_received_total`: 訊息接收計數
- `ws_message_latency_ms`: 訊息延遲 (P50/P95/P99)
- `ws_reconnections_total`: 重連次數
- `ws_errors_total`: 錯誤計數

### Rationale
- 先用結構化日誌記錄，便於分析
- 未來可透過日誌解析或直接整合監控系統
- 符合 FR-015 要求
