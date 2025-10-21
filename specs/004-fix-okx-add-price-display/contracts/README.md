# API Contracts: 修正 OKX 資金費率與增強價格顯示

**Feature**: 004-fix-okx-add-price-display
**Date**: 2025-01-21

## 概述

本目錄包含所有服務介面定義和契約文件。由於此功能為 CLI-based 監控系統（非 REST API），契約主要定義內部服務之間的介面、事件和資料傳輸物件 (DTO)。

## 文件結構

```
contracts/
├── README.md                # 本文件
└── service-interfaces.ts    # TypeScript 服務介面定義
```

## 核心契約

### 1. 服務介面 (Service Interfaces)

#### `IPriceMonitor`
**職責**: 訂閱並管理即時價格數據（WebSocket + REST 備援）

**主要方法**:
- `start(symbols: string[])`: 啟動價格監控
- `stop()`: 停止價格監控
- `getLatestPrice(symbol, exchange)`: 獲取最新價格
- `getAllPricePairs()`: 獲取所有價格配對

**事件**:
- `price`: 價格更新
- `priceDelay`: 價格延遲警告
- `sourceChanged`: 數據來源切換 (WebSocket ↔ REST)
- `error`: 錯誤

**實作類別**: `PriceMonitor` (src/services/monitor/PriceMonitor.ts)

---

#### `IFundingRateValidator`
**職責**: 雙重驗證 OKX 資金費率（OKX API + CCXT）並記錄結果

**主要方法**:
- `validate(symbol)`: 驗證單一交易對
- `validateBatch(symbols)`: 批量驗證
- `getRecentFailures(limit)`: 查詢最近失敗記錄
- `getPassRate(symbol, daysBack)`: 計算通過率

**實作類別**: `FundingRateValidator` (src/services/validation/FundingRateValidator.ts)

---

#### `IArbitrageAssessor`
**職責**: 綜合資金費率和價格數據，計算套利淨收益並判斷可行性

**主要方法**:
- `assess(...)`: 評估單一交易對
- `assessBatch(...)`: 批量評估
- `updateConfig(config)`: 更新配置（手續費率）
- `getConfig()`: 獲取當前配置

**實作類別**: `ArbitrageAssessor` (src/services/monitor/ArbitrageAssessor.ts)

---

#### `IWebSocketClient`
**職責**: 管理 WebSocket 連線、訂閱和重連邏輯

**主要方法**:
- `connect()`: 連接到 WebSocket 伺服器
- `disconnect()`: 斷開連線
- `subscribe(symbols)`: 訂閱 ticker 資料流
- `unsubscribe(symbols)`: 取消訂閱
- `isConnected()`: 檢查連線狀態

**事件**:
- `connected`: 連線成功
- `disconnected`: 連線斷開
- `ticker`: 收到 ticker 數據
- `error`: 錯誤

**實作類別**:
- `BinanceWsClient` (src/services/websocket/BinanceWsClient.ts)
- `OkxWsClient` (src/services/websocket/OkxWsClient.ts)

---

#### `IFundingRateValidationRepository`
**職責**: 資金費率驗證記錄儲存

**主要方法**:
- `create(data)`: 建立驗證記錄
- `createBatch(dataList)`: 批量建立
- `findByTimeRange(...)`: 查詢時間範圍
- `findFailures(limit)`: 查詢失敗記錄
- `calculatePassRate(...)`: 計算通過率

**實作類別**: `FundingRateValidationRepository` (src/repositories/FundingRateValidationRepository.ts)

---

### 2. 資料傳輸物件 (DTOs)

#### `PriceData`
即時價格數據
```typescript
{
  id: string;
  timestamp: Date;
  symbol: string;           // 例如: BTCUSDT
  exchange: 'binance' | 'okx';
  lastPrice: number;
  bidPrice: number;
  askPrice: number;
  volume24h?: number;
  source: 'websocket' | 'rest';
  latencyMs?: number;
}
```

#### `PriceDataPair`
Binance + OKX 價格配對
```typescript
{
  symbol: string;
  binance: PriceData;
  okx: PriceData;
  priceSpread: number;
  priceSpreadPercent: number;
  timestamp: Date;
}
```

#### `FundingRateValidationResult`
資金費率驗證結果
```typescript
{
  symbol: string;
  timestamp: Date;
  okxRate: number;
  okxNextRate?: number;
  ccxtRate?: number;
  discrepancyPercent?: number;
  validationStatus: 'PASS' | 'FAIL' | 'ERROR' | 'N/A';
  errorMessage?: string;
}
```

#### `ArbitrageAssessment`
套利評估結果
```typescript
{
  symbol: string;
  timestamp: Date;

  // 輸入
  binanceFundingRate: number;
  okxFundingRate: number;
  binancePrice: number;
  okxPrice: number;

  // 計算
  fundingRateSpread: number;
  priceSpread: number;
  totalFees: number;
  netProfit: number;
  netProfitPercent: number;

  // 判斷
  direction: string;
  feasibility: 'VIABLE' | 'NOT_VIABLE' | 'HIGH_RISK';
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  extremeSpreadDetected: boolean;
  warningMessage?: string;
}
```

---

### 3. 配置類型

#### `PriceMonitorConfig`
價格監控配置
```typescript
{
  enableWebSocket: boolean;
  maxReconnectAttempts: number;
  reconnectBaseDelay: number;      // ms
  reconnectMaxDelay: number;        // ms
  restPollInterval: number;         // ms
  priceStaleThreshold: number;      // ms
  delayWarningThreshold: number;    // ms
}
```

#### `ArbitrageConfig`
套利評估配置
```typescript
{
  makerFee: number;                 // 預設 0.001 (0.1%)
  takerFee: number;                 // 預設 0.001 (0.1%)
  extremeSpreadThreshold: number;   // 預設 0.05 (5%)
}
```

#### `FundingRateValidatorConfig`
資金費率驗證配置
```typescript
{
  acceptableDiscrepancy: number;    // 預設 0.000001 (0.0001%)
  maxRetries: number;               // 預設 3
  timeoutMs: number;                // 預設 5000ms
  enableCCXT: boolean;              // 預設 true
}
```

---

### 4. 事件 Payloads

#### `PriceUpdateEvent`
價格更新事件
```typescript
{
  price: PriceData;
  previousPrice?: PriceData;
  priceChange: number;
  priceChangePercent: number;
}
```

#### `ArbitrageOpportunityEvent`
套利機會檢測事件
```typescript
{
  assessment: ArbitrageAssessment;
  alertLevel: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
}
```

#### `ValidationFailureEvent`
驗證失敗事件
```typescript
{
  result: FundingRateValidationResult;
  severity: 'MINOR' | 'MAJOR' | 'CRITICAL';
  recommendedAction: string;
}
```

---

### 5. 錯誤類型

#### `APIError`
API 調用錯誤
```typescript
class APIError extends Error {
  exchange: Exchange;
  endpoint: string;
  statusCode?: number;
  originalError?: Error;
}
```

#### `WebSocketError`
WebSocket 連線錯誤
```typescript
class WebSocketError extends Error {
  exchange: Exchange;
  reconnectAttempt?: number;
  originalError?: Error;
}
```

#### `ValidationError`
驗證錯誤
```typescript
class ValidationError extends Error {
  symbol: string;
  validationResult: FundingRateValidationResult;
  originalError?: Error;
}
```

---

## 使用範例

### 1. 實作 IPriceMonitor

```typescript
import { IPriceMonitor, PriceData, Exchange } from './contracts/service-interfaces';
import { EventEmitter } from 'events';

export class PriceMonitor extends EventEmitter implements IPriceMonitor {
  private wsClients: Map<Exchange, IWebSocketClient>;
  private priceCache: Map<string, PriceData>;

  async start(symbols: string[]): Promise<void> {
    // 啟動 Binance WebSocket
    const binanceWs = this.wsClients.get('binance');
    await binanceWs.connect();
    binanceWs.subscribe(symbols);

    // 啟動 OKX WebSocket
    const okxWs = this.wsClients.get('okx');
    await okxWs.connect();
    okxWs.subscribe(symbols.map(s => `${s}-SWAP`));

    // 監聽 ticker 事件
    binanceWs.on('ticker', (data) => {
      this.priceCache.set(`${data.exchange}:${data.symbol}`, data);
      this.emit('price', data);
    });
  }

  getLatestPrice(symbol: string, exchange: Exchange): PriceData | null {
    return this.priceCache.get(`${exchange}:${symbol}`) || null;
  }

  getAllPricePairs(): PriceDataPair[] {
    // 實作邏輯...
  }
}
```

### 2. 使用 IArbitrageAssessor

```typescript
import { IArbitrageAssessor, ArbitrageAssessment } from './contracts/service-interfaces';

const assessor: IArbitrageAssessor = new ArbitrageAssessor({
  makerFee: 0.001,
  takerFee: 0.001,
  extremeSpreadThreshold: 0.05
});

const assessment = assessor.assess(
  'BTCUSDT',
  0.0001,  // Binance funding rate
  0.0002,  // OKX funding rate
  43250.5, // Binance price
  43248.0  // OKX price
);

if (assessment.feasibility === 'VIABLE') {
  console.log(`✅ 套利機會: ${assessment.netProfitPercent.toFixed(3)}%`);
  console.log(`方向: ${assessment.direction}`);
}
```

### 3. 事件訂閱

```typescript
priceMonitor.on('price', (data: PriceData) => {
  console.log(`${data.exchange} ${data.symbol}: $${data.lastPrice}`);
});

priceMonitor.on('priceDelay', ({ symbol, exchange, delaySeconds }) => {
  console.warn(`⏱️ ${exchange} ${symbol} 延遲 ${delaySeconds} 秒`);
});

priceMonitor.on('sourceChanged', ({ exchange, newSource }) => {
  console.log(`🔄 ${exchange} 切換到 ${newSource}`);
});
```

---

## 契約遵守原則

### 1. 型別安全
- 所有服務實作必須嚴格遵守介面定義
- 使用 TypeScript `strict` 模式確保型別檢查
- 禁止使用 `any` 類型

### 2. 事件命名
- 事件名稱使用小寫駝峰式（camelCase）
- 事件 payload 必須符合定義的型別
- 錯誤事件統一命名為 `error`

### 3. 錯誤處理
- 使用定義的錯誤類型（`APIError`, `WebSocketError`, `ValidationError`）
- 錯誤必須包含足夠的上下文資訊（交易所、交易對、原始錯誤）
- 不得吞噬錯誤，必須記錄或拋出

### 4. 向後相容性
- 新增欄位使用 `optional` (`?`)
- 不得刪除現有欄位或方法
- 需要 breaking change 時，建立新版本介面（例如 `IPriceMonitorV2`）

---

## 測試契約

所有服務實作必須通過契約測試：

```typescript
import { IPriceMonitor } from './contracts/service-interfaces';

describe('Contract: IPriceMonitor', () => {
  let monitor: IPriceMonitor;

  it('should implement start() method', async () => {
    await expect(monitor.start(['BTCUSDT'])).resolves.toBeUndefined();
  });

  it('should emit price event with correct payload', (done) => {
    monitor.on('price', (data) => {
      expect(data).toHaveProperty('symbol');
      expect(data).toHaveProperty('exchange');
      expect(data).toHaveProperty('lastPrice');
      done();
    });
  });

  it('should return null for non-existent price', () => {
    const price = monitor.getLatestPrice('NONEXISTENT', 'binance');
    expect(price).toBeNull();
  });
});
```

---

## 版本歷史

- **v1.0.0** (2025-01-21): 初始版本
  - 定義 5 個核心服務介面
  - 定義 4 個主要 DTO
  - 定義 3 個錯誤類型

---

**Phase 1 - API Contracts Complete** | **Next: quickstart.md**
