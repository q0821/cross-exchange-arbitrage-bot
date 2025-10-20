# 幣安和 OKX 交易所 API 最佳實踐研究報告
## 資金費率套利場景專用

**研究日期**: 2025-10-18
**適用場景**: 跨交易所資金費率套利平台
**交易所**: 幣安 (Binance) 和 OKX
**幣別**: BTC, ETH, SOL 永續合約

---

## 1. Rate Limit 管理

### 1.1 幣安 API Rate Limits

#### **Decision: 採用加權追蹤系統 + 本地限流器**

**技術細節**:
- **預設限制**: 2,400 requests/min (IP 級別)
- **訂單限制**: 300 orders/10s + 1,200 orders/min (API Key 級別)
- **權重系統**: 每個 endpoint 有不同的 weight 值
- **資金費率 endpoint**: `GET /fapi/v1/fundingRate` 與 `/fapi/v1/fundingInfo` 共享 **500 requests/5min/IP** 限制

#### **Rationale**:
1. 幣安使用 weight-based rate limiting,不同 endpoint 消耗不同權重
2. Response headers 包含 `X-MBX-USED-WEIGHT-(intervalNum)(intervalLetter)` 可追蹤當前使用量
3. 訂單相關 API 有額外的獨立限制,需要分別追蹤
4. VIP 用戶可獲得更高限額 (30 天成交量越高,限額越高)

#### **Best Practices**:

```typescript
// 1. 實作本地 Rate Limiter
interface RateLimitConfig {
  weightPerMinute: number;      // 2400 for default
  ordersPerTenSeconds: number;  // 300 for default
  ordersPerMinute: number;      // 1200 for default
}

class BinanceRateLimiter {
  private weightBucket: TokenBucket;
  private orderBucket10s: TokenBucket;
  private orderBucket1m: TokenBucket;

  constructor(config: RateLimitConfig) {
    this.weightBucket = new TokenBucket(config.weightPerMinute, 60000);
    this.orderBucket10s = new TokenBucket(config.ordersPerTenSeconds, 10000);
    this.orderBucket1m = new TokenBucket(config.ordersPerMinute, 60000);
  }

  async checkAndConsume(endpoint: string, isOrder: boolean): Promise<void> {
    const weight = this.getEndpointWeight(endpoint);

    // 檢查是否有足夠的配額
    if (!this.weightBucket.hasTokens(weight)) {
      throw new RateLimitError('Weight limit exceeded');
    }

    if (isOrder) {
      if (!this.orderBucket10s.hasTokens(1) || !this.orderBucket1m.hasTokens(1)) {
        throw new RateLimitError('Order limit exceeded');
      }
    }

    // 消耗配額
    this.weightBucket.consume(weight);
    if (isOrder) {
      this.orderBucket10s.consume(1);
      this.orderBucket1m.consume(1);
    }
  }

  // 從 response headers 同步實際使用量
  updateFromHeaders(headers: Record<string, string>): void {
    const usedWeight = parseInt(headers['x-mbx-used-weight-1m']);
    const orderCount10s = parseInt(headers['x-mbx-order-count-10s']);
    const orderCount1m = parseInt(headers['x-mbx-order-count-1m']);

    this.weightBucket.syncUsage(usedWeight);
    this.orderBucket10s.syncUsage(orderCount10s);
    this.orderBucket1m.syncUsage(orderCount1m);
  }

  private getEndpointWeight(endpoint: string): number {
    // 從 exchangeInfo 動態獲取,或使用靜態配置
    const weights: Record<string, number> = {
      '/fapi/v1/fundingRate': 1,
      '/fapi/v1/premiumIndex': 10,
      '/fapi/v1/order': 1,
      // ... 其他 endpoints
    };
    return weights[endpoint] || 1;
  }
}

// 2. 使用現成的 binance-rate-limit 套件
// npm install binance-rate-limit
import { RateLimitTracker } from 'binance-rate-limit';

const tracker = new RateLimitTracker();
tracker.updateFromHeaders(response.headers);

if (tracker.canMakeRequest('/fapi/v1/fundingRate')) {
  await fetchFundingRate();
  tracker.updateFromHeaders(response.headers);
}
```

#### **Risk Mitigation**:

1. **預留安全邊界**: 只使用 80% 的配額,留 20% 作為緩衝
   ```typescript
   const SAFETY_MARGIN = 0.8;
   const effectiveLimit = config.weightPerMinute * SAFETY_MARGIN;
   ```

2. **動態調整策略**: 根據 headers 實際值調整請求頻率
   ```typescript
   if (usedWeight > weightPerMinute * 0.7) {
     // 減速策略:延長請求間隔
     await sleep(calculateBackoffTime(usedWeight));
   }
   ```

3. **優先級隊列**: 關鍵操作 (下單、平倉) 優先於監控操作
   ```typescript
   enum RequestPriority {
     CRITICAL = 0,  // 平倉、風險處理
     HIGH = 1,      // 開倉
     NORMAL = 2,    // 查詢持倉
     LOW = 3        // 資金費率監控
   }
   ```

4. **錯誤重試**: 收到 429 錯誤時,使用指數退避重試
   ```typescript
   async function retryWithBackoff(fn: () => Promise<any>, maxRetries = 3) {
     for (let i = 0; i < maxRetries; i++) {
       try {
         return await fn();
       } catch (error) {
         if (error.code === 429 || error.code === -1003) {
           const backoffTime = Math.min(1000 * Math.pow(2, i), 30000);
           await sleep(backoffTime);
           continue;
         }
         throw error;
       }
     }
   }
   ```

---

### 1.2 OKX API Rate Limits

#### **Decision: 採用 Per-Endpoint Tracking + Sub-Account 分流**

**技術細節**:
- **Public API**: IP 級別限制,每個 endpoint 有不同限額
- **Private API**: User ID 級別限制 (sub-account 有獨立 User ID)
- **訂單限制**: 1,000 orders/2s per sub-account (只計算新建和修改訂單)
- **錯誤碼**:
  - `50011`: Rate limit reached (整體限流)
  - `50061`: Sub-account rate limit exceeded (子帳戶訂單限流)

#### **Rationale**:
1. OKX 的 rate limit 是 per-endpoint 的,需要為每個 endpoint 單獨追蹤
2. Sub-account 有獨立的 User ID,可用於分散流量
3. 交易相關 API (place/cancel/amend order) 在 REST 和 WebSocket 之間共享限額
4. VIP5+ 客戶可獲得更高的 sub-account rate limit (需要高成交率)

#### **Best Practices**:

```typescript
// 1. Per-Endpoint Rate Limiter
class OKXRateLimiter {
  private endpointLimiters: Map<string, TokenBucket> = new Map();
  private subAccountOrderLimiter: TokenBucket;

  constructor() {
    // Sub-account order limit: 1000 orders/2s
    this.subAccountOrderLimiter = new TokenBucket(1000, 2000);

    // 為常用 endpoints 初始化 limiters
    this.initializeEndpointLimiters();
  }

  private initializeEndpointLimiters(): void {
    // 從 OKX API 文檔獲取各 endpoint 限額
    const limits = {
      '/api/v5/public/funding-rate': { limit: 20, window: 2000 }, // 20 req/2s
      '/api/v5/trade/order': { limit: 60, window: 2000 },         // 60 req/2s
      '/api/v5/trade/batch-orders': { limit: 300, window: 2000 }, // 300 req/2s
      '/api/v5/account/positions': { limit: 10, window: 2000 },   // 10 req/2s
    };

    for (const [endpoint, config] of Object.entries(limits)) {
      this.endpointLimiters.set(
        endpoint,
        new TokenBucket(config.limit, config.window)
      );
    }
  }

  async checkAndConsume(endpoint: string, isOrderRequest: boolean): Promise<void> {
    const limiter = this.endpointLimiters.get(endpoint);
    if (!limiter) {
      throw new Error(`Unknown endpoint: ${endpoint}`);
    }

    if (!limiter.hasTokens(1)) {
      throw new RateLimitError(`Endpoint ${endpoint} rate limit exceeded`);
    }

    // 檢查 sub-account order limit
    if (isOrderRequest && !this.subAccountOrderLimiter.hasTokens(1)) {
      throw new RateLimitError('Sub-account order rate limit exceeded (50061)');
    }

    limiter.consume(1);
    if (isOrderRequest) {
      this.subAccountOrderLimiter.consume(1);
    }
  }

  handleRateLimitError(error: any): number {
    if (error.code === '50011') {
      // General rate limit - 使用較長的退避時間
      return 5000; // OKX 建議的 DDos Protection backoff
    } else if (error.code === '50061') {
      // Sub-account order limit - 等待 2 秒窗口重置
      return 2000;
    }
    return 1000;
  }
}

// 2. Sub-Account 分流策略
class OKXSubAccountManager {
  private subAccounts: SubAccount[];
  private currentIndex = 0;

  async executeWithLoadBalancing(orderRequest: OrderRequest): Promise<any> {
    // Round-robin 選擇 sub-account
    const subAccount = this.subAccounts[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.subAccounts.length;

    try {
      return await subAccount.placeOrder(orderRequest);
    } catch (error) {
      if (error.code === '50061') {
        // 當前 sub-account 達到限額,嘗試下一個
        return this.executeWithLoadBalancing(orderRequest);
      }
      throw error;
    }
  }
}
```

#### **Risk Mitigation**:

1. **自動重試機制**: 收到 50011/50061 錯誤時自動重試
   ```typescript
   async function retryWithOKXBackoff(fn: () => Promise<any>): Promise<any> {
     const maxRetries = 3;

     for (let i = 0; i < maxRetries; i++) {
       try {
         return await fn();
       } catch (error) {
         if (error.code === '50011' || error.code === '50061') {
           const backoffTime = i === 0 ? 5000 : 5000 * Math.pow(2, i);
           await sleep(backoffTime);
           continue;
         }
         throw error;
       }
     }
   }
   ```

2. **動態限額查詢**: 定期調用 API 查詢當前實際限額
   ```typescript
   // OKX API 提供查詢當前 rate limit 的方法
   async function updateRateLimits(): Promise<void> {
     const limits = await okxClient.getRateLimits();
     rateLimiter.updateLimits(limits);
   }

   // 每 5 分鐘更新一次
   setInterval(updateRateLimits, 5 * 60 * 1000);
   ```

3. **Batch Order API 優化**: 使用 batch-orders 減少請求次數
   ```typescript
   // 單個訂單: 2 requests (place + cancel)
   // Batch: 1 request for 20 orders
   async function placeBatchOrders(orders: Order[]): Promise<any> {
     // 最多 20 個訂單一次
     const batches = chunk(orders, 20);

     for (const batch of batches) {
       await rateLimiter.checkAndConsume('/api/v5/trade/batch-orders', true);
       await okxClient.batchOrders(batch);
     }
   }
   ```

4. **WebSocket 優先策略**: 交易操作優先使用 WebSocket (共享限額但更高效)
   ```typescript
   // REST 和 WebSocket 共享訂單限額,但 WebSocket 延遲更低
   if (websocketConnected) {
     await wsClient.placeOrder(order); // 優先使用
   } else {
     await restClient.placeOrder(order); // 降級方案
   }
   ```

---

## 2. WebSocket 連線管理

### 2.1 資金費率數據訂閱

#### **Decision: 幣安使用 Mark Price Stream, OKX 使用 Funding Rate Channel**

**幣安 WebSocket**:
```typescript
// Mark Price Stream 包含 funding rate 資訊
// wss://fstream.binance.com/ws/btcusdt@markPrice@1s

interface BinanceMarkPriceUpdate {
  e: "markPriceUpdate";  // Event type
  E: 1562305380000;      // Event time
  s: "BTCUSDT";          // Symbol
  p: "11794.15000000";   // Mark price
  i: "11784.62659091";   // Index price
  P: "11792.89000000";   // Estimated Settle Price (only for delivery contracts)
  r: "0.00038167";       // Funding rate
  T: 1562306400000;      // Next funding time
}

// 訂閱多個幣別
const symbols = ['btcusdt', 'ethusdt', 'solusdt'];
const streams = symbols.map(s => `${s}@markPrice@1s`);
const wsUrl = `wss://fstream.binance.com/stream?streams=${streams.join('/')}`;
```

**更新頻率**:
- Mark Price Stream: **每 1 秒**或每 3 秒更新 (可選)
- Funding Rate 數值: **每分鐘**重新計算
- 結算時間: 每 **8 小時** (00:00, 08:00, 16:00 UTC),部分合約為每 **4 小時**

**OKX WebSocket**:
```typescript
// Funding Rate Channel
// wss://ws.okx.com:8443/ws/v5/public

interface OKXFundingRateUpdate {
  arg: {
    channel: "funding-rate",
    instId: "BTC-USDT-SWAP"
  },
  data: [{
    fundingRate: "0.0001515",     // 當前資金費率
    fundingTime: "1597026383085", // 下次結算時間 (ms)
    instId: "BTC-USDT-SWAP",
    instType: "SWAP",
    nextFundingRate: "0.0001",    // 預測下次費率
    nextFundingTime: "1597055085000"
  }]
}

// 訂閱方式
const subscribeMsg = {
  op: "subscribe",
  args: [
    { channel: "funding-rate", instId: "BTC-USDT-SWAP" },
    { channel: "funding-rate", instId: "ETH-USDT-SWAP" },
    { channel: "funding-rate", instId: "SOL-USDT-SWAP" }
  ]
};
```

**更新頻率**:
- Funding Rate Channel: **每分鐘**推送一次
- 結算時間: 每 **8 小時** (00:00, 08:00, 16:00 UTC),部分合約可能為 6h/4h/2h/1h

#### **Rationale**:
1. 幣安的 Mark Price Stream 包含即時的 funding rate 和 next funding time,適合高頻監控
2. OKX 的 Funding Rate Channel 提供當前和預測下次費率,適合套利決策
3. 兩者都是 **每分鐘**更新費率數值,足夠用於套利監控 (不需要秒級精度)
4. WebSocket 推送機制比輪詢 REST API 更高效,且不消耗 rate limit

---

### 2.2 連線穩定性保證

#### **Decision: 實作 Heartbeat + Auto-Reconnect + Subscription Recovery**

**幣安 Heartbeat**:
```typescript
// Binance 要求 Ping/Pong 機制
// Server 每 20 秒發送 ping frame
// Client 必須在 1 分鐘內回覆 pong,否則連線會被斷開

class BinanceWebSocketClient {
  private ws: WebSocket;
  private pingInterval: NodeJS.Timeout;
  private lastPongTime: number = Date.now();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  connect(url: string): void {
    this.ws = new WebSocket(url);

    this.ws.on('ping', (data) => {
      // 立即回覆 pong
      this.ws.pong(data);
      this.lastPongTime = Date.now();
    });

    this.ws.on('pong', () => {
      this.lastPongTime = Date.now();
    });

    // 主動發送 ping 監控連線狀態
    this.pingInterval = setInterval(() => {
      if (Date.now() - this.lastPongTime > 60000) {
        // 超過 1 分鐘未收到 pong,認為連線死亡
        this.handleConnectionDeath();
      } else {
        this.ws.ping();
      }
    }, 20000);

    this.ws.on('close', (code) => {
      this.handleDisconnect(code);
    });

    this.ws.on('error', (error) => {
      logger.error('WebSocket error:', error);
      this.handleDisconnect(1006); // Abnormal closure
    });
  }

  private handleDisconnect(code: number): void {
    clearInterval(this.pingInterval);

    if (code === 1000) {
      // Normal closure - 可能是伺服器主動斷線
      logger.info('WebSocket closed normally, reconnecting...');
    } else {
      logger.warn(`WebSocket closed with code ${code}, reconnecting...`);
    }

    this.reconnect();
  }

  private reconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached, giving up');
      this.emit('max-reconnect-failed');
      return;
    }

    const backoffTime = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts),
      30000 // Max 30 seconds
    );

    setTimeout(() => {
      this.reconnectAttempts++;
      logger.info(`Reconnecting... (attempt ${this.reconnectAttempts})`);
      this.connect(this.wsUrl);
    }, backoffTime);
  }

  private handleConnectionDeath(): void {
    logger.error('Connection dead (no pong received), forcing reconnect');
    this.ws.terminate(); // 強制關閉
    this.reconnect();
  }
}
```

**OKX Heartbeat**:
```typescript
// OKX 要求主動發送 'ping' 字串
// 如果 30 秒內沒有任何數據推送,連線會自動斷開

class OKXWebSocketClient {
  private ws: WebSocket;
  private heartbeatInterval: NodeJS.Timeout;
  private lastMessageTime: number = Date.now();
  private heartbeatTimeout = 30000; // 30 seconds

  connect(url: string): void {
    this.ws = new WebSocket(url);

    this.ws.on('message', (data) => {
      this.lastMessageTime = Date.now();

      const msg = data.toString();
      if (msg === 'pong') {
        logger.debug('Received pong from OKX');
        return;
      }

      // 處理正常訊息
      this.handleMessage(JSON.parse(msg));
    });

    // 每 15 秒發送 ping (30 秒超時的一半)
    this.heartbeatInterval = setInterval(() => {
      const timeSinceLastMessage = Date.now() - this.lastMessageTime;

      if (timeSinceLastMessage > this.heartbeatTimeout) {
        logger.error('No message received for 30s, reconnecting');
        this.reconnect();
      } else {
        // 主動發送 ping
        this.ws.send('ping');
      }
    }, 15000);

    this.ws.on('close', () => {
      this.handleDisconnect();
    });

    this.ws.on('error', (error) => {
      logger.error('OKX WebSocket error:', error);
    });
  }

  private handleDisconnect(): void {
    clearInterval(this.heartbeatInterval);
    this.reconnect();
  }

  private reconnect(): void {
    // 類似幣安的指數退避重連邏輯
    // ...
  }
}
```

#### **Best Practices**:

1. **Subscription Recovery**: 重連後自動重新訂閱
   ```typescript
   class WebSocketManager {
     private subscriptions: Set<string> = new Set();

     subscribe(channel: string): void {
       this.subscriptions.add(channel);
       this.ws.send(JSON.stringify({
         op: 'subscribe',
         args: [channel]
       }));
     }

     private async reconnect(): Promise<void> {
       await this.connect();

       // 重新訂閱所有頻道
       for (const channel of this.subscriptions) {
         this.ws.send(JSON.stringify({
           op: 'subscribe',
           args: [channel]
         }));
       }

       logger.info(`Reconnected and resubscribed to ${this.subscriptions.size} channels`);
     }
   }
   ```

2. **Graceful Degradation**: WebSocket 斷線時降級到 REST API
   ```typescript
   class FundingRateMonitor {
     private wsClient: WebSocketClient;
     private restClient: RestClient;
     private isWebSocketHealthy = true;

     async getFundingRate(symbol: string): Promise<FundingRate> {
       if (this.isWebSocketHealthy) {
         // 優先從 WebSocket 緩存獲取
         return this.wsCache.get(symbol);
       } else {
         // 降級到 REST API
         logger.warn('WebSocket unhealthy, falling back to REST API');
         return this.restClient.getFundingRate(symbol);
       }
     }

     private monitorWebSocketHealth(): void {
       this.wsClient.on('disconnect', () => {
         this.isWebSocketHealthy = false;
       });

       this.wsClient.on('reconnected', () => {
         this.isWebSocketHealthy = true;
       });
     }
   }
   ```

3. **使用成熟的 SDK**: 優先使用官方或社群維護的 SDK
   ```typescript
   // 幣安: binance-connector-node (官方)
   import { WebsocketStream } from '@binance/connector';

   const ws = new WebsocketStream({ logger: console });
   ws.markPrice('btcusdt', '1s', (data) => {
     console.log(data);
   });

   // OKX: okx-api (社群,支援 auto-reconnect)
   import { WebsocketClient } from 'okx-api';

   const wsClient = new WebsocketClient({
     // 自動重連 + 心跳檢測
   });

   wsClient.on('reconnect', ({ wsKey }) => {
     console.log('Reconnecting...', wsKey);
   });

   wsClient.on('reconnected', () => {
     console.log('Reconnected successfully');
   });

   wsClient.subscribeFundingRate({ instId: 'BTC-USDT-SWAP' });
   ```

#### **Risk Mitigation**:

1. **連線狀態監控**: 記錄連線時長和斷線次數
   ```typescript
   class ConnectionMetrics {
     private connectTime: number;
     private disconnectCount = 0;
     private totalDowntime = 0;

     onConnect(): void {
       this.connectTime = Date.now();
     }

     onDisconnect(): void {
       const uptime = Date.now() - this.connectTime;
       this.disconnectCount++;

       logger.info(`Connection uptime: ${uptime}ms, total disconnects: ${this.disconnectCount}`);
     }

     getHealthScore(): number {
       // 計算穩定性評分 (99%+ 為健康)
       const totalTime = Date.now() - this.startTime;
       return ((totalTime - this.totalDowntime) / totalTime) * 100;
     }
   }
   ```

2. **Alert 機制**: 連線異常時立即通知
   ```typescript
   if (metrics.getHealthScore() < 99) {
     alertService.send({
       level: 'WARNING',
       message: 'WebSocket stability below 99%',
       details: {
         disconnectCount: metrics.disconnectCount,
         healthScore: metrics.getHealthScore()
       }
     });
   }
   ```

3. **Max Reconnect Limit**: 防止無限重連消耗資源
   ```typescript
   if (reconnectAttempts > MAX_ATTEMPTS) {
     logger.error('Max reconnection attempts exceeded, stopping service');
     process.exit(1); // 停止服務,等待人工介入
   }
   ```

---

## 3. 交易執行的原子性

### 3.1 現實情況: 無法保證真正的原子性

#### **Decision: 採用 Best-Effort 雙邊執行 + 快速回滾策略**

**關鍵發現**:
1. 幣安和 OKX 都 **不支援跨交易所的原子性事務**
2. OKX 的 batch-orders API 明確說明 **"not all-or-nothing"** - 部分訂單可以成功
3. 兩個交易所之間的訂單無法在單一事務中提交

#### **Rationale**:
這是跨交易所套利的根本挑戰:
- **DeFi 鏈上套利**: 可使用智能合約實現真正的原子性 (atomic arbitrage)
- **CEX 跨交易所**: 只能依賴應用層邏輯盡可能減少單邊風險窗口

---

### 3.2 雙邊對沖執行策略

#### **Best Practices**:

```typescript
// 策略 1: 快速雙邊執行 + 部分成交處理
class HedgeExecutor {

  async executeHedge(opportunity: ArbitrageOpportunity): Promise<HedgeResult> {
    const { symbol, side1, side2, quantity } = opportunity;

    // Step 1: 預檢查 (快速失敗)
    await this.preflightCheck(symbol, quantity);

    // Step 2: 同時向兩個交易所發送訂單 (並行執行)
    const [result1, result2] = await Promise.allSettled([
      this.binanceClient.placeOrder({
        symbol,
        side: side1,  // e.g., 'BUY'
        type: 'MARKET',
        quantity
      }),
      this.okxClient.placeOrder({
        instId: symbol,
        side: side2,  // e.g., 'SELL'
        ordType: 'MARKET',
        sz: quantity
      })
    ]);

    // Step 3: 檢查執行結果
    return this.handleExecutionResult(result1, result2, opportunity);
  }

  private async preflightCheck(symbol: string, quantity: number): Promise<void> {
    // 1. 檢查餘額
    const [binanceBalance, okxBalance] = await Promise.all([
      this.binanceClient.getBalance(),
      this.okxClient.getBalance()
    ]);

    if (!this.hasSufficientBalance(binanceBalance, okxBalance, quantity)) {
      throw new InsufficientBalanceError('Not enough balance for hedge');
    }

    // 2. 檢查市場流動性 (orderbook depth)
    const [binanceDepth, okxDepth] = await Promise.all([
      this.binanceClient.getOrderBookDepth(symbol, 5),
      this.okxClient.getOrderBookDepth(symbol, 5)
    ]);

    const expectedSlippage = this.calculateSlippage(binanceDepth, okxDepth, quantity);
    if (expectedSlippage > this.maxSlippageThreshold) {
      throw new SlippageTooHighError(`Expected slippage: ${expectedSlippage}%`);
    }

    // 3. 檢查 rate limit 配額
    if (!this.rateLimiter.canPlaceOrder()) {
      throw new RateLimitError('Rate limit exceeded, cannot place order');
    }
  }

  private async handleExecutionResult(
    result1: PromiseSettledResult<OrderResponse>,
    result2: PromiseSettledResult<OrderResponse>,
    opportunity: ArbitrageOpportunity
  ): Promise<HedgeResult> {

    // Case 1: 雙邊都成功 ✅
    if (result1.status === 'fulfilled' && result2.status === 'fulfilled') {
      return this.handleBothSuccess(result1.value, result2.value);
    }

    // Case 2: 雙邊都失敗 ❌
    if (result1.status === 'rejected' && result2.status === 'rejected') {
      logger.error('Both orders failed', {
        error1: result1.reason,
        error2: result2.reason
      });
      return { status: 'FAILED', reason: 'Both orders failed' };
    }

    // Case 3: 單邊成功 ⚠️ - 最危險的情況
    if (result1.status === 'fulfilled' && result2.status === 'rejected') {
      return this.handlePartialFill('binance', result1.value, result2.reason);
    }

    if (result1.status === 'rejected' && result2.status === 'fulfilled') {
      return this.handlePartialFill('okx', result2.value, result1.reason);
    }
  }
}
```

---

### 3.3 部分成交處理和回滾策略

#### **Decision: 3 秒內完成風險對沖**

```typescript
class PartialFillHandler {

  async handlePartialFill(
    successExchange: 'binance' | 'okx',
    successOrder: OrderResponse,
    failReason: any
  ): Promise<void> {

    const startTime = Date.now();

    logger.error('CRITICAL: Partial fill detected!', {
      successExchange,
      orderId: successOrder.orderId,
      failReason
    });

    // 立即發送警報
    await this.alertService.sendCritical({
      message: 'Hedge execution partial fill',
      exchange: successExchange,
      orderId: successOrder.orderId
    });

    // 策略 1: 立即反向平倉成功的訂單
    try {
      await this.emergencyClosePosition(successExchange, successOrder);

      const elapsed = Date.now() - startTime;
      logger.info(`Emergency close completed in ${elapsed}ms`);

      if (elapsed > 3000) {
        logger.warn('Emergency close took longer than 3s SLA');
      }

      return {
        status: 'ROLLBACK_SUCCESS',
        rollbackTime: elapsed
      };

    } catch (closeError) {
      // 策略 2: 如果反向平倉失敗,嘗試在另一個交易所建立對沖
      return this.attemptHedgeOnOtherExchange(successExchange, successOrder);
    }
  }

  private async emergencyClosePosition(
    exchange: string,
    originalOrder: OrderResponse
  ): Promise<void> {

    // 反向平倉: 如果原訂單是 BUY,則發送 SELL
    const reverseOrder = {
      symbol: originalOrder.symbol,
      side: originalOrder.side === 'BUY' ? 'SELL' : 'BUY',
      type: 'MARKET',
      quantity: originalOrder.executedQty, // 使用實際成交量
      reduceOnly: true  // 只平倉,不開新倉
    };

    if (exchange === 'binance') {
      return this.binanceClient.placeOrder(reverseOrder);
    } else {
      return this.okxClient.placeOrder(this.convertToOKXFormat(reverseOrder));
    }
  }

  private async attemptHedgeOnOtherExchange(
    successExchange: string,
    successOrder: OrderResponse
  ): Promise<void> {

    logger.warn('Emergency close failed, attempting hedge on other exchange');

    const hedgeOrder = {
      symbol: successOrder.symbol,
      side: successOrder.side === 'BUY' ? 'SELL' : 'BUY', // 反向
      type: 'MARKET',
      quantity: successOrder.executedQty
    };

    const otherExchange = successExchange === 'binance' ? 'okx' : 'binance';

    try {
      if (otherExchange === 'binance') {
        await this.binanceClient.placeOrder(hedgeOrder);
      } else {
        await this.okxClient.placeOrder(this.convertToOKXFormat(hedgeOrder));
      }

      return {
        status: 'HEDGE_ON_OTHER_EXCHANGE',
        note: 'Position hedged but not in original plan'
      };

    } catch (hedgeError) {
      // 最糟情況: 無法平倉也無法對沖
      logger.error('CRITICAL: Failed to rollback or hedge!', {
        successExchange,
        orderId: successOrder.orderId,
        hedgeError
      });

      // 人工介入
      await this.alertService.sendCritical({
        message: 'MANUAL INTERVENTION REQUIRED',
        exchange: successExchange,
        orderId: successOrder.orderId,
        position: successOrder.executedQty
      });

      return {
        status: 'MANUAL_INTERVENTION_REQUIRED',
        unhedgedPosition: successOrder
      };
    }
  }
}
```

#### **Risk Mitigation**:

1. **Pre-Execution Checks**: 執行前驗證所有條件
   ```typescript
   // 防止明顯會失敗的訂單
   - 餘額檢查
   - 流動性檢查 (orderbook depth)
   - Rate limit 檢查
   - 市場狀態檢查 (是否暫停交易)
   ```

2. **Fast-Fail Pattern**: 快速失敗,不要等待超時
   ```typescript
   const ORDER_TIMEOUT = 5000; // 5 秒超時

   const result = await Promise.race([
     placeOrder(),
     timeout(ORDER_TIMEOUT)
   ]);
   ```

3. **Monitoring and Alerts**: 記錄所有部分成交事件
   ```typescript
   metrics.increment('hedge.partial_fill', {
     exchange: successExchange,
     symbol: symbol
   });

   if (partialFillRate > 0.05) { // 5% 以上
     alertService.send({
       level: 'WARNING',
       message: `Partial fill rate: ${partialFillRate * 100}%`
     });
   }
   ```

4. **Circuit Breaker**: 部分成交率過高時暫停自動交易
   ```typescript
   class CircuitBreaker {
     private partialFillCount = 0;
     private totalExecutions = 0;

     checkAndUpdate(result: HedgeResult): boolean {
       this.totalExecutions++;

       if (result.status.includes('PARTIAL')) {
         this.partialFillCount++;
       }

       const rate = this.partialFillCount / this.totalExecutions;

       if (rate > 0.1) { // 10% 以上部分成交
         logger.error('Circuit breaker triggered: high partial fill rate');
         return false; // 停止自動交易
       }

       return true; // 可以繼續
     }
   }
   ```

---

## 4. 資金費率數據精確度

### 4.1 更新頻率和時間同步

#### **Decision: 使用交易所提供的 Next Funding Time + NTP 同步本地時間**

**幣安資金費率機制**:
```typescript
interface BinanceFundingRateInfo {
  symbol: string;
  adjustedFundingRateCap: string;      // 資金費率上限
  adjustedFundingRateFloor: string;    // 資金費率下限
  fundingIntervalHours: number;        // 結算間隔 (8 or 4 hours)

  // 從 markPrice stream 獲取
  currentFundingRate: string;          // 當前資金費率
  nextFundingTime: number;             // 下次結算時間 (timestamp)
}

// 資金費率計算方式 (每分鐘更新)
// Funding Rate = Premium Index (1-minute average) capped by ±0.05%
// Premium Index = (Mark Price - Index Price) / Index Price
```

**更新機制**:
- **計算頻率**: 每 **1 分鐘**重新計算 Premium Index
- **推送頻率**: Mark Price Stream 每 **1 秒**或 3 秒推送 (但資金費率值每分鐘才變化)
- **結算週期**: 每 **8 小時** (00:00, 08:00, 16:00 UTC),部分合約每 **4 小時**
- **結算時間範圍**: 系統可能需要最多 **1 分鐘**完成所有符號的資金費用結算

**OKX 資金費率機制**:
```typescript
interface OKXFundingRateInfo {
  instId: string;                  // 合約 ID
  fundingRate: string;             // 當前資金費率
  fundingTime: string;             // 當前週期結算時間
  nextFundingRate: string;         // 預測下次費率
  nextFundingTime: string;         // 下次結算時間

  // 可變週期
  settlingPeriod: '8h' | '6h' | '4h' | '2h' | '1h'; // 動態調整
}

// 資金費率計算
// Funding Rate = Clamp(Premium Index, -1.5%, +1.5%)
// Premium Index = (Mark Price - Index Price) / Index Price
```

**更新機制**:
- **計算頻率**: 每 **1 分鐘**重新計算
- **推送頻率**: Funding Rate Channel 每 **1 分鐘**推送
- **結算週期**: 預設每 **8 小時**,可動態調整為 6h/4h/2h/1h
- **結算精度**: Millisecond level,交易不中斷

#### **Best Practices**:

```typescript
// 1. 資金費率數據管理
class FundingRateManager {
  private binanceRates: Map<string, FundingRateData> = new Map();
  private okxRates: Map<string, FundingRateData> = new Map();

  // 從 WebSocket 更新數據
  onBinanceMarkPriceUpdate(data: BinanceMarkPriceUpdate): void {
    const key = data.s; // Symbol

    this.binanceRates.set(key, {
      symbol: data.s,
      fundingRate: parseFloat(data.r),
      nextFundingTime: data.T,
      updatedAt: Date.now(),
      source: 'websocket'
    });

    // 計算與 OKX 的費率差異
    this.checkArbitrageOpportunity(key);
  }

  onOKXFundingRateUpdate(data: OKXFundingRateData): void {
    const key = data.instId;

    this.okxRates.set(key, {
      symbol: data.instId,
      fundingRate: parseFloat(data.fundingRate),
      nextFundingRate: parseFloat(data.nextFundingRate),
      nextFundingTime: parseInt(data.nextFundingTime),
      updatedAt: Date.now(),
      source: 'websocket'
    });

    this.checkArbitrageOpportunity(key);
  }

  // 檢查套利機會
  private checkArbitrageOpportunity(symbol: string): void {
    const binanceRate = this.binanceRates.get(symbol);
    const okxRate = this.okxRates.get(symbol);

    if (!binanceRate || !okxRate) return;

    // 檢查數據新鮮度 (不超過 2 分鐘)
    const now = Date.now();
    if (now - binanceRate.updatedAt > 120000 || now - okxRate.updatedAt > 120000) {
      logger.warn(`Stale funding rate data for ${symbol}`);
      return;
    }

    // 計算費率差異
    const rateDiff = Math.abs(binanceRate.fundingRate - okxRate.fundingRate);
    const rateDiffPercent = rateDiff * 100; // 轉換為百分比

    if (rateDiffPercent > this.arbitrageThreshold) {
      this.emit('arbitrage-opportunity', {
        symbol,
        binanceRate: binanceRate.fundingRate,
        okxRate: okxRate.fundingRate,
        rateDiff: rateDiffPercent,
        nextFundingTime: Math.min(
          binanceRate.nextFundingTime,
          okxRate.nextFundingTime
        )
      });
    }
  }
}

// 2. 時間同步檢查
class TimeSync {
  private serverTimeOffset = 0; // 與伺服器時間差

  async syncTime(): Promise<void> {
    // 同時查詢兩個交易所的伺服器時間
    const [binanceTime, okxTime] = await Promise.all([
      this.binanceClient.getServerTime(),
      this.okxClient.getServerTime()
    ]);

    const localTime = Date.now();

    // 計算時間偏移
    const binanceOffset = binanceTime - localTime;
    const okxOffset = okxTime - localTime;

    logger.info('Time sync check', {
      localTime,
      binanceTime,
      okxTime,
      binanceOffset,
      okxOffset
    });

    // 如果偏移超過 1 秒,發出警告
    if (Math.abs(binanceOffset) > 1000 || Math.abs(okxOffset) > 1000) {
      logger.warn('Significant time offset detected', {
        binanceOffset,
        okxOffset
      });

      // 使用平均偏移量
      this.serverTimeOffset = (binanceOffset + okxOffset) / 2;
    }

    // 檢查兩個交易所之間的時間差
    const exchangeTimeDiff = Math.abs(binanceTime - okxTime);
    if (exchangeTimeDiff > 1000) {
      logger.warn('Large time difference between exchanges', {
        diff: exchangeTimeDiff
      });
    }
  }

  // 每 5 分鐘同步一次時間
  startTimeSyncScheduler(): void {
    this.syncTime(); // 立即同步
    setInterval(() => this.syncTime(), 5 * 60 * 1000);
  }

  // 獲取調整後的當前時間
  getAdjustedTime(): number {
    return Date.now() + this.serverTimeOffset;
  }
}

// 3. 結算時間追蹤
class FundingSettlementTracker {

  async trackSettlement(symbol: string): Promise<void> {
    const binanceRate = this.fundingRateManager.getBinanceRate(symbol);
    const okxRate = this.fundingRateManager.getOKXRate(symbol);

    const nextSettlement = Math.min(
      binanceRate.nextFundingTime,
      okxRate.nextFundingTime
    );

    const timeUntilSettlement = nextSettlement - this.timeSync.getAdjustedTime();

    // 在結算前 5 分鐘檢查是否需要平倉
    if (timeUntilSettlement < 5 * 60 * 1000 && timeUntilSettlement > 0) {
      logger.info(`Settlement approaching for ${symbol}`, {
        timeRemaining: timeUntilSettlement,
        nextSettlement: new Date(nextSettlement).toISOString()
      });

      // 觸發平倉檢查
      await this.positionManager.checkAutoClose(symbol, nextSettlement);
    }

    // 在結算後 1 分鐘檢查是否完成
    if (timeUntilSettlement < -60000) {
      logger.info(`Settlement completed for ${symbol}, verifying...`);
      await this.verifySettlementCompletion(symbol);
    }
  }

  private async verifySettlementCompletion(symbol: string): Promise<void> {
    // 查詢持倉的資金費用記錄
    const [binanceFunding, okxFunding] = await Promise.all([
      this.binanceClient.getFundingHistory(symbol, 1),
      this.okxClient.getFundingHistory(symbol, 1)
    ]);

    logger.info('Funding settlement verified', {
      symbol,
      binanceFunding: binanceFunding[0],
      okxFunding: okxFunding[0]
    });
  }
}
```

#### **Risk Mitigation**:

1. **數據新鮮度檢查**: 拒絕過時的資金費率數據
   ```typescript
   const DATA_FRESHNESS_THRESHOLD = 120000; // 2 minutes

   if (Date.now() - fundingRate.updatedAt > DATA_FRESHNESS_THRESHOLD) {
     logger.error('Funding rate data too old, skipping arbitrage check');
     return;
   }
   ```

2. **結算時間窗口**: 避免在結算時間附近執行交易
   ```typescript
   const SETTLEMENT_BUFFER = 5 * 60 * 1000; // 5 minutes

   function isSafeToTrade(nextSettlementTime: number): boolean {
     const timeUntil = nextSettlementTime - Date.now();
     return timeUntil > SETTLEMENT_BUFFER;
   }
   ```

3. **跨交易所時間驗證**: 檢測並修正時間偏移
   ```typescript
   // 使用 NTP 同步本地時間
   import ntpClient from 'ntp-client';

   async function syncWithNTP(): Promise<void> {
     const ntpTime = await ntpClient.getNetworkTime('pool.ntp.org');
     const localTime = Date.now();
     const offset = ntpTime - localTime;

     if (Math.abs(offset) > 1000) {
       logger.warn(`Local time offset: ${offset}ms, consider syncing system clock`);
     }
   }
   ```

4. **資金費率變化監控**: 追蹤費率變化趨勢
   ```typescript
   class FundingRateHistory {
     private history: FundingRateSnapshot[] = [];

     track(symbol: string, binanceRate: number, okxRate: number): void {
       this.history.push({
         timestamp: Date.now(),
         symbol,
         binanceRate,
         okxRate,
         rateDiff: Math.abs(binanceRate - okxRate)
       });

       // 只保留最近 24 小時
       this.history = this.history.filter(
         h => Date.now() - h.timestamp < 24 * 60 * 60 * 1000
       );
     }

     getVolatility(symbol: string, hours = 1): number {
       const cutoff = Date.now() - hours * 60 * 60 * 1000;
       const recent = this.history.filter(
         h => h.symbol === symbol && h.timestamp > cutoff
       );

       if (recent.length < 2) return 0;

       // 計算標準差
       const diffs = recent.map(h => h.rateDiff);
       const mean = diffs.reduce((a, b) => a + b) / diffs.length;
       const variance = diffs.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / diffs.length;

       return Math.sqrt(variance);
     }
   }
   ```

---

## 總結與建議

### 關鍵決策摘要

| 議題 | 決策 | 優先級 |
|------|------|--------|
| **Rate Limit 管理** | 本地 Token Bucket + Response Headers 同步 | P0 |
| **WebSocket 連線** | Auto-Reconnect + Heartbeat + Subscription Recovery | P0 |
| **交易原子性** | Best-Effort 雙邊執行 + 3 秒快速回滾 | P0 |
| **資金費率精度** | WebSocket 推送 + 2 分鐘新鮮度檢查 | P0 |
| **時間同步** | 定期 NTP 同步 + 交易所時間校驗 | P1 |
| **錯誤恢復** | 指數退避重試 + Circuit Breaker | P1 |
| **監控告警** | 部分成交、連線異常、時間偏移 | P1 |

### 實作優先順序

**Phase 1 - 基礎設施 (P0)**:
1. 實作 Rate Limiter (幣安 weight-based, OKX per-endpoint)
2. 建立 WebSocket 連線管理 (auto-reconnect, heartbeat)
3. 整合 SDK (binance-connector-node, okx-api)

**Phase 2 - 資金費率監控 (P0)**:
1. 訂閱 Funding Rate WebSocket streams
2. 實作資金費率差異計算
3. 新鮮度檢查和時間同步

**Phase 3 - 交易執行 (P0)**:
1. 雙邊下單邏輯 (並行執行)
2. 部分成交處理和快速回滾
3. Pre-execution checks (餘額、流動性、rate limit)

**Phase 4 - 風險管理 (P1)**:
1. Circuit Breaker (部分成交率監控)
2. Alert 系統 (Telegram/Email/Webhook)
3. Metrics 和 Dashboard

### 技術債務和未來優化

1. **Sub-Account 分流**: OKX 支援多 sub-account 分散訂單限額
2. **Smart Order Routing**: 根據流動性動態選擇交易所
3. **Historical Data Analysis**: 分析最佳執行時機和費率趨勢
4. **Machine Learning**: 預測資金費率變化和套利機會持續時間

---

**參考資料**:
- [Binance Futures API Documentation](https://developers.binance.com/docs/derivatives/usds-margined-futures)
- [OKX API v5 Documentation](https://www.okx.com/docs-v5/en/)
- [binance-connector-node GitHub](https://github.com/binance/binance-connector-node)
- [okx-api GitHub](https://github.com/tiagosiebler/okx-api)
- [binance-rate-limit GitHub](https://github.com/pixtron/binance-rate-limit)
