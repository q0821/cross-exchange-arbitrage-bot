# Data Model: OKX 資金費率間隔偵測

**Feature**: 024-fix-okx-funding-normalization
**Date**: 2025-01-27

## 概述

本功能不涉及資料庫 schema 變更，所有資料模型都是記憶體內的 TypeScript 介面定義。主要擴充現有的 `FundingIntervalCache` 和新增間隔偵測相關的類型定義。

---

## 1. 間隔來源類型 (IntervalSource)

### 定義

```typescript
/**
 * 資金費率間隔的偵測來源
 */
export type IntervalSource =
  | 'native-api'    // 從 OKX Native API 獲取
  | 'calculated'    // 從 CCXT info 時間戳計算
  | 'default';      // 使用預設值（降級）
```

### 用途

標記間隔資料的來源，用於：
- 診斷和日誌記錄
- 快取項目的可追溯性
- 監控降級頻率

### 狀態轉換

```
CCXT fetchFundingRate 成功
  └─> info.fundingTime 存在？
       ├─ Yes → calculated
       └─ No  → 嘗試 Native API
               └─> Native API 成功？
                    ├─ Yes → native-api
                    └─ No  → default
```

---

## 2. 快取項目 (CachedInterval)

### 現有定義（無需修改）

```typescript
/**
 * 快取的資金費率間隔資訊
 */
export interface CachedInterval {
  /** 間隔值（小時） */
  interval: number;

  /** 資料來源 */
  source: IntervalSource;

  /** 快取建立時間戳（毫秒） */
  timestamp: number;

  /** 存活時間（毫秒），預設 24 小時 */
  ttl: number;
}
```

### 擴充：快取項目元資料 (CachedIntervalMetadata)

```typescript
/**
 * 快取項目的完整元資料（包含交易所和交易對資訊）
 */
export interface CachedIntervalMetadata extends CachedInterval {
  /** 交易所名稱 */
  exchange: string;

  /** 交易對符號 */
  symbol: string;

  /** 是否已過期 */
  isExpired: boolean;

  /** 剩餘有效時間（毫秒） */
  remainingTTL: number;
}
```

### 範例資料

```typescript
const cachedItem: CachedIntervalMetadata = {
  exchange: 'okx',
  symbol: 'BTCUSDT',
  interval: 8,
  source: 'calculated',
  timestamp: 1732704000000,
  ttl: 86400000,       // 24 小時
  isExpired: false,
  remainingTTL: 82800000  // 約 23 小時
};
```

---

## 3. 間隔偵測結果 (IntervalDetectionResult)

### 定義

```typescript
/**
 * 資金費率間隔偵測的結果物件
 */
export interface IntervalDetectionResult {
  /** 偵測是否成功 */
  success: boolean;

  /** 間隔值（小時），失敗時可能為 null */
  interval: number | null;

  /** 偵測來源 */
  source: IntervalSource;

  /** 原始資料（用於診斷） */
  rawData?: {
    fundingTime?: number;      // Unix 毫秒時間戳
    nextFundingTime?: number;  // Unix 毫秒時間戳
    calculatedHours?: number;  // 計算出的原始小時數
  };

  /** 錯誤資訊（如果失敗） */
  error?: {
    code: string;           // 錯誤碼（如 'MISSING_TIMESTAMPS', 'INVALID_RANGE'）
    message: string;        // 錯誤訊息
    details?: any;          // 額外的錯誤細節
  };

  /** 是否進行了四捨五入 */
  rounded?: boolean;

  /** 與標準值的偏差（小時） */
  deviation?: number;
}
```

### 成功案例範例

```typescript
const successResult: IntervalDetectionResult = {
  success: true,
  interval: 8,
  source: 'calculated',
  rawData: {
    fundingTime: 1764259200000,      // 2025-11-27T16:00:00.000Z
    nextFundingTime: 1764288000000,  // 2025-11-28T00:00:00.000Z
    calculatedHours: 8.0
  },
  rounded: false,
  deviation: 0
};
```

### 失敗案例範例

```typescript
const failureResult: IntervalDetectionResult = {
  success: false,
  interval: null,
  source: 'default',
  rawData: {
    fundingTime: 1764259200000,
    nextFundingTime: undefined  // 欄位缺失
  },
  error: {
    code: 'MISSING_TIMESTAMPS',
    message: 'CCXT did not expose nextFundingTime field',
    details: { availableFields: ['fundingTime', 'fundingRate', 'instId'] }
  }
};
```

---

## 4. OKX Native API 回應 (OkxFundingRateResponse)

### 定義

```typescript
/**
 * OKX Native API 的回應格式
 * 端點: GET https://www.okx.com/api/v5/public/funding-rate
 */
export interface OkxFundingRateResponse {
  /** 回應碼，"0" 表示成功 */
  code: string;

  /** 錯誤訊息，成功時為空字串 */
  msg: string;

  /** 資金費率資料陣列 */
  data: OkxFundingRateData[];
}

export interface OkxFundingRateData {
  /** 合約 ID，格式：BTC-USDT-SWAP */
  instId: string;

  /** 合約類型，永續合約為 "SWAP" */
  instType: string;

  /** 當前資金費率（字串型數值） */
  fundingRate: string;

  /** 當前資金費率結算時間（Unix 毫秒時間戳字串） */
  fundingTime: string;

  /** 下次資金費率結算時間（Unix 毫秒時間戳字串） */
  nextFundingTime: string;

  /** 預測下次資金費率（通常為空字串） */
  nextFundingRate?: string;

  /** 最大資金費率上限 */
  maxFundingRate: string;

  /** 最小資金費率下限 */
  minFundingRate: string;

  /** 利息率 */
  interestRate: string;

  /** 溢價指數 */
  premium: string;

  /** 已結算的資金費率 */
  settFundingRate: string;

  /** 結算狀態 */
  settState: string;

  /** 計算公式類型 */
  formulaType: string;

  /** 計算方法 */
  method: string;

  /** 影響值 */
  impactValue: string;

  /** 資料時間戳（Unix 毫秒） */
  ts: string;
}
```

### 範例回應

```json
{
  "code": "0",
  "msg": "",
  "data": [{
    "instId": "BTC-USDT-SWAP",
    "instType": "SWAP",
    "fundingRate": "-0.0000441162021490",
    "fundingTime": "1764259200000",
    "nextFundingTime": "1764288000000",
    "nextFundingRate": "",
    "maxFundingRate": "0.00375",
    "minFundingRate": "-0.00375",
    "interestRate": "0.0001000000000000",
    "premium": "-0.0005461795343571",
    "settFundingRate": "-0.0000481320193476",
    "settState": "settled",
    "formulaType": "withRate",
    "method": "current_period",
    "impactValue": "20000.0000000000000000",
    "ts": "1764232457550"
  }]
}
```

---

## 5. 錯誤碼定義 (ErrorCodes)

### 定義

```typescript
/**
 * OKX 間隔偵測相關的錯誤碼
 */
export enum OkxIntervalErrorCode {
  /** CCXT 未暴露時間戳欄位 */
  MISSING_TIMESTAMPS = 'MISSING_TIMESTAMPS',

  /** 時間戳解析失敗（非數值） */
  INVALID_TIMESTAMP_FORMAT = 'INVALID_TIMESTAMP_FORMAT',

  /** 時間戳超出合理範圍 */
  TIMESTAMP_OUT_OF_RANGE = 'TIMESTAMP_OUT_OF_RANGE',

  /** nextFundingTime <= fundingTime */
  INVALID_TIMESTAMP_ORDER = 'INVALID_TIMESTAMP_ORDER',

  /** 計算出的間隔為非正數 */
  NON_POSITIVE_INTERVAL = 'NON_POSITIVE_INTERVAL',

  /** 間隔偏離標準值過大 */
  INTERVAL_DEVIATION_TOO_LARGE = 'INTERVAL_DEVIATION_TOO_LARGE',

  /** OKX Native API 請求失敗 */
  NATIVE_API_FAILURE = 'NATIVE_API_FAILURE',

  /** OKX API 限流 */
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  /** OKX 系統繁忙 */
  SYSTEM_BUSY = 'SYSTEM_BUSY',

  /** 合約 ID 不存在 */
  INVALID_INST_ID = 'INVALID_INST_ID',
}
```

### 錯誤碼對應表

| 錯誤碼 | OKX API 錯誤碼 | 描述 | 可重試 |
|--------|----------------|------|--------|
| `MISSING_TIMESTAMPS` | - | CCXT info 缺少時間戳欄位 | No |
| `INVALID_TIMESTAMP_FORMAT` | - | 時間戳不是有效數值 | No |
| `TIMESTAMP_OUT_OF_RANGE` | - | 時間戳不在 2020-2030 年範圍 | No |
| `INVALID_TIMESTAMP_ORDER` | - | nextFundingTime <= fundingTime | No |
| `NON_POSITIVE_INTERVAL` | - | 計算間隔 <= 0 | No |
| `INTERVAL_DEVIATION_TOO_LARGE` | - | 間隔偏離標準值 > 0.5h | No |
| `NATIVE_API_FAILURE` | - | Native API 請求失敗 | Yes |
| `RATE_LIMIT_EXCEEDED` | `50011` | 超過限流 | Yes |
| `SYSTEM_BUSY` | `50013` | 系統繁忙 | Yes |
| `INVALID_INST_ID` | `51001` | 合約 ID 不存在 | No |

---

## 6. 資料流程圖

### 間隔偵測流程

```
┌─────────────────┐
│ getFundingRate  │
│   (CCXT call)   │
└────────┬────────┘
         │
         v
┌─────────────────────────┐
│ Extract info.fundingTime│
│   info.nextFundingTime  │
└────────┬────────────────┘
         │
         ├─> fundingTime 存在？
         │   ├─ Yes → 計算間隔
         │   │        └─> 驗證間隔合理性
         │   │             └─> 快取 (source: 'calculated')
         │   │
         │   └─ No  → 呼叫 Native API
         │            ├─ 成功 → 快取 (source: 'native-api')
         │            └─ 失敗 → 快取 (source: 'default', interval: 8)
         │
         v
┌─────────────────┐
│ 返回間隔值      │
└─────────────────┘
```

### 快取查詢流程

```
┌─────────────────┐
│  Query Cache    │
│ (exchange, symbol)
└────────┬────────┘
         │
         v
    快取存在？
         │
         ├─ Yes → 檢查過期？
         │        ├─ No  → 返回快取值
         │        └─ Yes → 刪除快取，執行偵測
         │
         └─ No  → 執行偵測
                  └─> 快取結果
                      └─> 返回間隔值
```

---

## 7. 資料驗證規則

### 時間戳驗證

| 規則 | 檢查項目 | 有效範圍 |
|------|---------|---------|
| 格式驗證 | 是否為數值 | `!isNaN(timestamp)` |
| 範圍驗證 | 2020-2030 年 | `1577836800000` - `1893456000000` |
| 順序驗證 | nextFundingTime > fundingTime | `next > current` |

### 間隔驗證

| 規則 | 檢查項目 | 有效範圍 |
|------|---------|---------|
| 正數驗證 | interval > 0 | `interval > 0` |
| 標準值驗證 | 最接近 1, 4, 8 | `deviation <= 0.5h` |
| 四捨五入 | 修正到標準值 | `roundToNearest([1, 4, 8])` |

---

## 8. 記憶體使用估算

### 快取大小估算

假設監控 200 個交易對：

```typescript
const cacheItemSize =
  8 +  // interval (number)
  24 + // source (string)
  8 +  // timestamp (number)
  8;   // ttl (number)
  // ≈ 48 bytes per item

const totalSymbols = 200;
const totalCacheSize = cacheItemSize * totalSymbols;
// ≈ 9.6 KB

// Map 額外開銷（key 字串）
const keySize = 'exchange-symbol'.length * 2; // ≈ 32 bytes
const totalWithKeys = totalSymbols * (cacheItemSize + keySize);
// ≈ 16 KB
```

**結論**：記憶體使用可忽略不計（< 20 KB）

---

## 9. 與現有模型的整合

### 整合點

1. **FundingRateData** (`src/models/FundingRate.ts`):
   - 新增 `fundingInterval: number` 欄位（可選）
   - 由 OKX connector 提供，傳遞給 FundingRateMonitor

2. **FundingRateMonitor** (`src/services/monitor/FundingRateMonitor.ts`):
   - 使用 `originalInterval` 進行標準化計算
   - 不需要修改，只需確保 connector 提供正確的 interval

3. **WebSocket 事件** (`src/types/events.ts`):
   - 不需要修改，間隔資訊已包含在 `FundingRateData` 中

### 向後相容性

- ✅ 所有新增介面都是記憶體內的類型定義
- ✅ 不影響資料庫 schema
- ✅ 不破壞現有 API 合約
- ✅ 現有程式碼可以繼續使用 `cache.get()` 方法

---

## 10. 總結

本功能的資料模型設計遵循以下原則：

1. **最小化改動**：擴充現有的 `FundingIntervalCache`，不修改核心結構
2. **明確的類型定義**：所有資料結構都有完整的 TypeScript 介面
3. **可追溯性**：透過 `IntervalSource` 標記資料來源
4. **錯誤處理**：詳細的錯誤碼和結果物件
5. **向後相容**：保持現有 API 不變，新增方法獲取額外資訊

**關鍵檔案**：
- `src/lib/FundingIntervalCache.ts` - 快取實作（需擴充）
- `src/connectors/okx.ts` - OKX connector（主要修改）
- `src/types/` - 新增類型定義檔案（如需要）
