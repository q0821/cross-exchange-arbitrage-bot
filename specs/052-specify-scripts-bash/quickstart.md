# Quickstart: 交易所 WebSocket 即時數據訂閱

**Feature**: 052-specify-scripts-bash
**Date**: 2025-12-31

## 前置需求

- Node.js 20.x LTS
- pnpm 8.x+
- PostgreSQL 15 + TimescaleDB (Docker)
- 有效的交易所 API Key（至少一個）

## 1. 環境設定

```bash
# 確保 Docker 服務運行
docker compose up -d postgres

# 安裝依賴
pnpm install

# 設定環境變數 (.env)
cp .env.example .env
```

### 必要環境變數

```bash
# Database
DATABASE_URL="postgresql://..."

# 至少設定一個交易所 API Key
BINANCE_API_KEY="..."
BINANCE_API_SECRET="..."

# 或
OKX_API_KEY="..."
OKX_API_SECRET="..."
OKX_PASSPHRASE="..."

# WebSocket 設定 (可選)
WS_RECONNECT_MAX_ATTEMPTS=10
WS_HEARTBEAT_INTERVAL=20000
WS_FUNDING_RATE_MODE=websocket  # 'websocket' | 'rest' | 'hybrid'
```

## 2. 驗證 WebSocket 連線

### 2.1 測試資金費率 WebSocket

```bash
# 執行整合測試
pnpm test:integration websocket/binance-funding-ws.test.ts

# 或手動測試
pnpm tsx scripts/test-funding-ws.ts
```

### 2.2 測試私有頻道

```bash
# 需要有效的 API Key
pnpm tsx scripts/test-private-ws.ts --exchange binance
```

## 3. 開發流程

### 3.1 實作新交易所 WebSocket

1. **建立 Adapter** (`src/services/websocket/<Exchange>WsAdapter.ts`)

```typescript
import { WebSocketManager } from '@/lib/websocket';

export class OkxFundingWsAdapter {
  private ccxt: ccxt.pro.okx;

  async connect(): Promise<void> {
    // 使用 CCXT watch* 方法
    while (true) {
      const rate = await this.ccxt.watchFundingRate('BTC/USDT:USDT');
      this.emit('fundingRate', this.normalize(rate));
    }
  }

  private normalize(rate: any): FundingRateReceived {
    return {
      exchange: 'okx',
      symbol: this.convertSymbol(rate.symbol),
      fundingRate: new Decimal(rate.fundingRate),
      nextFundingTime: new Date(rate.fundingTimestamp),
      source: 'websocket',
      receivedAt: new Date(),
    };
  }
}
```

2. **在 Connector 中實作介面** (`src/connectors/<exchange>.ts`)

```typescript
async subscribeWS(subscription: WSSubscription): Promise<void> {
  const { type, symbols, callback } = subscription;

  if (type === 'fundingRate') {
    this.fundingWsAdapter = new OkxFundingWsAdapter(this.ccxt);
    this.fundingWsAdapter.on('fundingRate', callback);
    await this.fundingWsAdapter.connect();
  }
}

async unsubscribeWS(type: WSSubscriptionType): Promise<void> {
  if (type === 'fundingRate' && this.fundingWsAdapter) {
    await this.fundingWsAdapter.disconnect();
    this.fundingWsAdapter = null;
  }
}
```

3. **整合到 PriceMonitor** (`src/services/monitor/PriceMonitor.ts`)

```typescript
private async initWebSocketSubscriptions(): Promise<void> {
  for (const connector of this.connectors) {
    try {
      await connector.subscribeWS({
        type: 'fundingRate',
        callback: (data) => this.handleFundingRateUpdate(data),
      });
    } catch (error) {
      logger.warn({ exchange: connector.name }, 'WebSocket subscription failed, using REST fallback');
    }
  }
}
```

### 3.2 實作私有頻道

1. **建立 listenKey 管理** (Binance/BingX)

```typescript
class ListenKeyManager {
  private listenKey: string | null = null;
  private renewalTimer: NodeJS.Timeout | null = null;

  async createListenKey(): Promise<string> {
    const response = await this.api.post('/fapi/v1/listenKey');
    this.listenKey = response.listenKey;
    this.scheduleRenewal();
    return this.listenKey;
  }

  private scheduleRenewal(): void {
    // Renew every 30 minutes (before 60-minute expiry)
    this.renewalTimer = setInterval(
      () => this.renewListenKey(),
      30 * 60 * 1000
    );
  }
}
```

2. **建立 PrivateWsManager**

```typescript
class PrivateWsManager {
  private connections = new Map<string, UserPrivateConnection>();

  async connectUser(userId: string, apiKey: ApiKey): Promise<void> {
    const exchange = apiKey.exchange;
    const connectionKey = `${userId}:${exchange}`;

    if (this.connections.has(connectionKey)) {
      return; // Already connected
    }

    const connection = await this.createConnection(apiKey);
    this.connections.set(connectionKey, connection);

    // Subscribe to position/order updates
    await this.subscribePrivateChannels(connection);
  }
}
```

## 4. 測試

### 4.1 單元測試

```bash
# 測試特定服務
pnpm test BinanceFundingWs.test.ts
pnpm test PrivateWsManager.test.ts
pnpm test TriggerDetector.test.ts
```

### 4.2 整合測試

```bash
# 需要網路連線
pnpm test:integration websocket/
```

### 4.3 Mock WebSocket 測試

```typescript
// tests/unit/services/BinanceFundingWs.test.ts
import { vi, describe, it, expect } from 'vitest';
import { BinanceFundingWs } from '@/services/websocket/BinanceFundingWs';

describe('BinanceFundingWs', () => {
  it('should parse markPriceUpdate event', () => {
    const ws = new BinanceFundingWs();
    const mockMessage = JSON.stringify({
      e: 'markPriceUpdate',
      s: 'BTCUSDT',
      r: '0.0001',
      T: Date.now() + 8 * 60 * 60 * 1000,
    });

    const result = ws.parseMessage(mockMessage);

    expect(result).toEqual({
      exchange: 'binance',
      symbol: 'BTCUSDT',
      fundingRate: expect.any(Decimal),
      nextFundingTime: expect.any(Date),
      source: 'websocket',
    });
  });
});
```

## 5. 監控

### 5.1 日誌

```typescript
// WebSocket 事件日誌格式
logger.info({
  exchange: 'binance',
  channel: 'markPrice',
  symbol: 'BTCUSDT',
  latency: Date.now() - eventTime,
}, 'Funding rate received via WebSocket');
```

### 5.2 健康檢查

```bash
# 檢查 WebSocket 連線狀態
curl http://localhost:3000/api/monitor/ws-status

# 回應範例
{
  "connections": [
    {
      "exchange": "binance",
      "type": "public",
      "status": "connected",
      "lastHeartbeat": "2025-12-31T12:00:00Z"
    },
    {
      "exchange": "binance",
      "type": "private",
      "status": "connected",
      "userId": "user123"
    }
  ]
}
```

## 6. 故障排除

### 6.1 WebSocket 連線失敗

```bash
# 檢查網路連線
ping fstream.binance.com

# 檢查防火牆
nc -zv fstream.binance.com 443

# 查看日誌
tail -f logs/app.log | grep -E "(websocket|ws)"
```

### 6.2 認證錯誤

```bash
# 驗證 API Key
pnpm tsx scripts/validate-api-key.ts --exchange binance

# 檢查 listenKey 狀態
pnpm tsx scripts/check-listen-key.ts
```

### 6.3 觸發偵測延遲

```bash
# 比較 WebSocket vs REST 延遲
pnpm tsx scripts/compare-latency.ts

# 檢查 TriggerDetector 狀態
curl http://localhost:3000/api/monitor/trigger-detector
```

## 7. 參考資料

- [Binance Futures WebSocket API](https://developers.binance.com/docs/derivatives/usds-margined-futures/websocket-market-streams)
- [OKX WebSocket API](https://www.okx.com/docs-v5/en/#websocket-api)
- [Gate.io Futures WebSocket](https://www.gate.com/docs/developers/futures/ws/en/)
- [CCXT Documentation](https://docs.ccxt.com/)
