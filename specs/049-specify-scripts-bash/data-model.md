# Data Model: 交易操作驗證腳本

**Feature**: 049-trading-validation-script | **Date**: 2025-12-29

---

## 概述

本功能為 CLI 驗證腳本，主要使用記憶體中的資料結構。不新增資料庫模型，僅讀取現有模型。

---

## 讀取的現有模型

### Position（持倉）

從 `prisma/schema.prisma` 讀取，用於查詢驗證模式：

```prisma
model Position {
  id                     String   @id @default(cuid())
  userId                 String
  symbol                 String
  longExchange           String
  shortExchange          String
  quantity               Decimal
  entryTime              DateTime
  status                 String   // OPEN, CLOSED
  stopLossEnabled        Boolean?
  stopLossPercent        Decimal?
  takeProfitEnabled      Boolean?
  takeProfitPercent      Decimal?
  conditionalOrderStatus String?  // PENDING, SETTING, SET, PARTIAL, FAILED
  longStopLossOrderId    String?
  longTakeProfitOrderId  String?
  shortStopLossOrderId   String?
  shortTakeProfitOrderId String?
}
```

### ApiKey（API 金鑰）

用於取得交易所連線憑證：

```prisma
model ApiKey {
  id             String   @id @default(cuid())
  userId         String
  exchange       String   // binance, okx, gateio, bingx
  apiKey         String
  encryptedSecret String
  isActive       Boolean
}
```

---

## 記憶體資料結構

### ValidationItem（驗證項目）

```typescript
interface ValidationItem {
  /** 驗證項目編號 (1-11) */
  id: number;

  /** 驗證項目名稱 */
  name: string;

  /** 驗證類別 */
  category: 'position' | 'conditional' | 'close';

  /** 預期值（字串化） */
  expected: string;

  /** 實際值（字串化） */
  actual: string;

  /** 驗證結果 */
  status: 'pass' | 'fail' | 'skip' | 'warn';

  /** 錯誤訊息（僅 fail 時） */
  error?: string;
}
```

### ValidationReport（驗證報告）

```typescript
interface ValidationReport {
  /** 驗證時間 */
  timestamp: Date;

  /** 交易所名稱 */
  exchange: string;

  /** 交易對 */
  symbol: string;

  /** 驗證模式 */
  mode: 'run' | 'verify';

  /** 所有驗證項目 */
  items: ValidationItem[];

  /** 總結 */
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    warned: number;
  };

  /** 執行時間（毫秒） */
  duration: number;
}
```

### ExchangePosition（交易所持倉）

從交易所 API 查詢的持倉資訊：

```typescript
interface ExchangePosition {
  /** CCXT symbol 格式 (e.g., BTC/USDT:USDT) */
  symbol: string;

  /** 持倉方向 */
  side: 'long' | 'short';

  /** 合約張數 */
  contracts: number;

  /** 合約大小 */
  contractSize: number;

  /** 幣本位數量 (contracts * contractSize) */
  quantity: number;

  /** 入場價格 */
  entryPrice: number;

  /** 未實現盈虧 */
  unrealizedPnl: number;
}
```

### ExchangeConditionalOrder（交易所條件單）

```typescript
interface ExchangeConditionalOrder {
  /** 訂單 ID */
  orderId: string;

  /** 訂單類型 */
  type: 'stop_loss' | 'take_profit';

  /** CCXT symbol 格式 */
  symbol: string;

  /** 觸發價格 */
  triggerPrice: number;

  /** 合約張數 */
  contracts: number;

  /** 合約大小 */
  contractSize: number;

  /** 幣本位數量 */
  quantity: number;

  /** 訂單狀態 */
  status: 'open' | 'triggered' | 'cancelled';
}
```

### RunParams（執行參數）

```typescript
interface RunParams {
  /** 交易所 */
  exchange: 'binance' | 'okx' | 'gateio' | 'bingx';

  /** 交易對 (e.g., BTCUSDT) */
  symbol: string;

  /** 開倉金額 (USDT) */
  quantity: number;

  /** 槓桿倍數 */
  leverage: number;

  /** 停損百分比 (0-100) */
  stopLossPercent?: number;

  /** 停利百分比 (0-100) */
  takeProfitPercent?: number;

  /** 用戶 ID */
  userId: string;

  /** 輸出 JSON 格式 */
  json?: boolean;
}
```

### VerifyParams（查詢驗證參數）

```typescript
interface VerifyParams {
  /** 持倉 ID */
  positionId: string;

  /** 輸出 JSON 格式 */
  json?: boolean;
}
```

---

## 資料流程

```
┌─────────────────────────────────────────────────────────────────┐
│ CLI 輸入                                                         │
│ RunParams / VerifyParams                                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 資料庫查詢                                                       │
│ ├─ ApiKey（取得交易所憑證）                                       │
│ └─ Position（查詢驗證模式）                                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Web API 呼叫（自動測試模式）                                      │
│ ├─ POST /api/positions/open                                     │
│ └─ POST /api/positions/[id]/close                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 交易所 API 查詢                                                  │
│ ├─ ExchangePosition（持倉狀態）                                  │
│ └─ ExchangeConditionalOrder（條件單狀態）                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 驗證結果                                                         │
│ ValidationReport（含 11 個 ValidationItem）                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 不新增資料庫模型的原因

1. **一次性執行**：驗證腳本為手動執行的一次性工具，不需持久化結果
2. **報告輸出**：驗證結果直接輸出至終端機或 JSON 檔案
3. **避免複雜度**：不增加資料庫維護負擔
4. **測試隔離**：驗證腳本應與生產資料庫分離，僅讀取必要資訊
