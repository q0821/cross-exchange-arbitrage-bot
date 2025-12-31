# Quick Start: Native WebSocket Clients

**Feature**: 054-native-websocket-clients
**Created**: 2025-12-31

## Overview

本指南說明如何使用 OKX、Gate.io、BingX 原生 WebSocket 客戶端訂閱即時資金費率和價格數據。

## Prerequisites

- Node.js 20.x LTS
- 已安裝 `ws` 8.x
- 環境變數配置完成（用於私有頻道）

## Basic Usage

### 1. OKX WebSocket

```typescript
import { OkxFundingWs } from '@/services/websocket/OkxFundingWs';

// 建立客戶端
const okxWs = new OkxFundingWs({
  autoReconnect: true,
  enableHealthCheck: true,
});

// 監聽事件
okxWs.on('fundingRate', (data) => {
  console.log(`OKX ${data.symbol}: ${data.fundingRate.toString()}`);
});

okxWs.on('connected', () => {
  console.log('OKX WebSocket connected');
});

okxWs.on('error', (error) => {
  console.error('OKX error:', error.message);
});

// 連接並訂閱
await okxWs.connect();
await okxWs.subscribe(['BTCUSDT', 'ETHUSDT', 'SOLUSDT']);

// 斷開連接
await okxWs.disconnect();
```

### 2. Gate.io WebSocket

```typescript
import { GateioFundingWs } from '@/services/websocket/GateioFundingWs';

// 建立客戶端
const gateWs = new GateioFundingWs({
  autoReconnect: true,
  enableHealthCheck: true,
});

// 監聽事件
gateWs.on('fundingRate', (data) => {
  console.log(`Gate.io ${data.symbol}: ${data.fundingRate.toString()}`);
  console.log(`  Mark Price: ${data.markPrice?.toString()}`);
  console.log(`  Index Price: ${data.indexPrice?.toString()}`);
});

// 連接並訂閱
await gateWs.connect();
await gateWs.subscribe(['BTCUSDT', 'ETHUSDT']);

// 注意: Gate.io 每連線最多 20 個訂閱
// 如需更多，請使用 ConnectionPool
```

### 3. BingX WebSocket

```typescript
import { BingxFundingWs } from '@/services/websocket/BingxFundingWs';

// 建立客戶端
const bingxWs = new BingxFundingWs({
  autoReconnect: true,
  enableHealthCheck: true,
});

// 監聯事件
bingxWs.on('fundingRate', (data) => {
  console.log(`BingX ${data.symbol}: ${data.fundingRate.toString()}`);
});

// 連接並訂閱
await bingxWs.connect();
await bingxWs.subscribe(['BTCUSDT', 'ETHUSDT', 'SOLUSDT']);
```

## Connection Pool (大量訂閱)

當需要訂閱超過單一連線限制的交易對時，使用 ConnectionPool：

```typescript
import { ConnectionPool } from '@/services/websocket/ConnectionPool';
import { GateioFundingWs } from '@/services/websocket/GateioFundingWs';

// Gate.io 限制: 每連線最多 20 個訂閱
const pool = new ConnectionPool({
  exchange: 'gateio',
  maxPerConnection: 20,
  createClient: () => new GateioFundingWs({ autoReconnect: true }),
});

// 監聽事件 (來自所有連線)
pool.on('fundingRate', (data) => {
  console.log(`${data.exchange} ${data.symbol}: ${data.fundingRate.toString()}`);
});

// 訂閱 100 個交易對 (自動建立 5 個連線)
const symbols = ['BTCUSDT', 'ETHUSDT', /* ... 共 100 個 */];
await pool.subscribeAll(symbols);

// 查看連線狀態
const state = pool.getState();
console.log(`Active connections: ${state.activeConnections}`);
console.log(`Total subscriptions: ${state.totalSubscriptions}`);
```

## Integration with PriceMonitor

```typescript
import { PriceMonitor } from '@/services/monitor/PriceMonitor';

// PriceMonitor 內部整合了所有交易所的 WebSocket 客戶端
const monitor = new PriceMonitor({
  symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
  exchanges: ['binance', 'okx', 'gateio', 'bingx'],
  enableWebSocket: true,
});

// 監聽價格更新
monitor.on('price', (data) => {
  console.log(`${data.exchange} ${data.symbol}: ${data.markPrice}`);
});

// 啟動監控
await monitor.start();
```

## Error Handling

```typescript
const okxWs = new OkxFundingWs();

// 監聽錯誤
okxWs.on('error', (error) => {
  console.error('WebSocket error:', error.message);
  // 錯誤會被記錄到結構化日誌
});

// 監聽重連
okxWs.on('reconnecting', (attempt) => {
  console.log(`Reconnecting... attempt ${attempt}`);
});

// 監聽斷線
okxWs.on('disconnected', () => {
  console.log('WebSocket disconnected');
  // 如果 autoReconnect=true，會自動嘗試重連
});

// 監聽重新訂閱完成
okxWs.on('resubscribed', (count) => {
  console.log(`Resubscribed to ${count} symbols`);
});
```

## Statistics & Metrics

```typescript
const okxWs = new OkxFundingWs();
await okxWs.connect();
await okxWs.subscribe(['BTCUSDT', 'ETHUSDT']);

// 等待一段時間...
await sleep(60000);

// 查看統計
const stats = okxWs.getStats();
console.log(`Messages received: ${stats.messageCount}`);
console.log(`Connection uptime: ${stats.connectionUptime} seconds`);
console.log(`Subscribed symbols: ${stats.subscribedSymbolCount}`);
console.log(`Is connected: ${stats.isConnected}`);

// 輸出日誌
okxWs.logStats();
// [INFO] WebSocket connection stats { messageCount: 1234, connectionUptime: 60, ... }
```

## Private Channels (訂單狀態)

```typescript
import { OkxFundingWs } from '@/services/websocket/OkxFundingWs';
import { ApiKeyRepository } from '@/repositories/ApiKeyRepository';

// 從資料庫讀取 API Key
const repo = new ApiKeyRepository();
const apiKey = await repo.getByExchange('user-id', 'okx');

// 建立客戶端並認證
const okxWs = new OkxFundingWs({
  apiKey: apiKey.apiKey,
  secretKey: apiKey.secretKey,
  passphrase: apiKey.passphrase,
});

// 監聽訂單更新
okxWs.on('orderUpdate', (order) => {
  console.log(`Order ${order.orderId}: ${order.status}`);
  console.log(`Filled: ${order.executedQty}/${order.origQty}`);
});

// 連接並訂閱私有頻道
await okxWs.connect();
await okxWs.subscribeOrders();
```

## Environment Variables

```bash
# WebSocket 配置
ENABLE_WEBSOCKET_PRICE_MONITOR=true

# 連線逾時 (毫秒)
WS_CONNECTION_TIMEOUT=10000

# 健康檢查間隔 (毫秒)
WS_HEALTH_CHECK_INTERVAL=60000

# 重連配置
WS_RECONNECT_INITIAL_DELAY=1000
WS_RECONNECT_MAX_DELAY=30000
WS_RECONNECT_MAX_RETRIES=10
```

## Troubleshooting

### 連線失敗

```typescript
// 檢查網路連線
okxWs.on('error', (error) => {
  if (error.message.includes('ENOTFOUND')) {
    console.error('DNS resolution failed. Check network connectivity.');
  }
  if (error.message.includes('ETIMEDOUT')) {
    console.error('Connection timeout. Check firewall settings.');
  }
});
```

### 訂閱失敗

```typescript
// 檢查交易對格式
// 內部格式: BTCUSDT (正確)
// OKX 格式: BTC-USDT-SWAP (自動轉換)
await okxWs.subscribe(['BTCUSDT']);  // ✓
await okxWs.subscribe(['BTC-USDT-SWAP']);  // ✗ 不要使用交易所格式
```

### 訊息延遲

```typescript
// 檢查訊息延遲
okxWs.on('fundingRate', (data) => {
  const latency = Date.now() - data.receivedAt.getTime();
  if (latency > 500) {
    console.warn(`High latency: ${latency}ms`);
  }
});
```
