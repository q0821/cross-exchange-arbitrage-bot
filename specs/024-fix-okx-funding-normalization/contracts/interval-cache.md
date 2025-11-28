# Contract: FundingIntervalCache Interface

**Module**: `src/lib/FundingIntervalCache.ts`
**Purpose**: 快取資金費率間隔資訊，減少重複 API 請求

---

## 1. Interface Overview

### Class: FundingIntervalCache

記憶體內快取，儲存交易所和交易對的資金費率結算間隔資訊。

**特性**：
- 記憶體快取（不持久化到資料庫）
- 支援 TTL 過期機制（預設 24 小時）
- 支援偵測來源標記
- 執行緒安全（單一 Node.js 程序）

---

## 2. Type Definitions

### IntervalSource

```typescript
/**
 * 間隔偵測來源類型
 */
export type IntervalSource =
  | 'native-api'    // 從交易所 Native API 獲取
  | 'calculated'    // 從時間戳計算得出
  | 'default';      // 使用預設值（降級）
```

### CachedInterval

```typescript
/**
 * 快取項目的資料結構
 */
export interface CachedInterval {
  /** 間隔值（小時）*/
  interval: number;

  /** 資料來源 */
  source: IntervalSource;

  /** 快取建立時間戳（毫秒） */
  timestamp: number;

  /** 存活時間（毫秒） */
  ttl: number;
}
```

### CachedIntervalMetadata (新增)

```typescript
/**
 * 擴充的快取項目元資料
 * 包含交易所和交易對資訊
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

---

## 3. Class Methods

### Constructor

```typescript
constructor(defaultTTL: number = 86400000) // 預設 24 小時
```

**Parameters**:
- `defaultTTL`: 預設的快取存活時間（毫秒）

**Example**:
```typescript
const cache = new FundingIntervalCache(24 * 60 * 60 * 1000); // 24 小時
```

---

### get() - 獲取間隔值

```typescript
get(exchange: string, symbol: string): number | null
```

**Purpose**: 獲取快取的間隔值（若過期則返回 null）

**Parameters**:
- `exchange`: 交易所名稱（如 `'binance'`, `'okx'`）
- `symbol`: 交易對符號（如 `'BTCUSDT'`）

**Returns**:
- `number`: 間隔值（小時）
- `null`: 快取不存在或已過期

**Behavior**:
1. 查詢快取
2. 檢查是否過期（`now - timestamp > ttl`）
3. 若過期，刪除快取項目並返回 `null`
4. 更新統計數據（`stats.hits` 或 `stats.misses`）

**Example**:
```typescript
const interval = cache.get('okx', 'BTCUSDT');
if (interval === null) {
  // 快取未命中，執行間隔偵測
  const detectedInterval = await detectInterval('okx', 'BTCUSDT');
  cache.set('okx', 'BTCUSDT', detectedInterval, 'calculated');
}
```

---

### getWithMetadata() - 獲取完整元資料 (新增)

```typescript
getWithMetadata(
  exchange: string,
  symbol: string
): CachedIntervalMetadata | null
```

**Purpose**: 獲取包含元資料的完整快取項目

**Parameters**:
- `exchange`: 交易所名稱
- `symbol`: 交易對符號

**Returns**:
- `CachedIntervalMetadata`: 完整的快取資訊
- `null`: 快取不存在或已過期

**Example**:
```typescript
const metadata = cache.getWithMetadata('okx', 'BTCUSDT');

if (metadata) {
  console.log(`Interval: ${metadata.interval}h`);
  console.log(`Source: ${metadata.source}`);
  console.log(`Age: ${(Date.now() - metadata.timestamp) / 1000}s`);
  console.log(`Remaining TTL: ${metadata.remainingTTL / 1000}s`);

  if (metadata.source === 'default') {
    logger.warn('Using default interval - detection may have failed');
  }
}
```

---

### set() - 設定快取

```typescript
set(
  exchange: string,
  symbol: string,
  interval: number,
  source: IntervalSource
): void
```

**Purpose**: 設定或更新快取項目

**Parameters**:
- `exchange`: 交易所名稱
- `symbol`: 交易對符號
- `interval`: 間隔值（小時，必須為 1, 4, 或 8）
- `source`: 偵測來源

**Behavior**:
1. 生成快取鍵（`exchange-symbol`）
2. 建立快取項目
3. 設定時間戳為當前時間
4. 使用預設 TTL
5. 更新統計數據（`stats.sets`）

**Example**:
```typescript
// 從 CCXT 計算得出
cache.set('okx', 'BTCUSDT', 8, 'calculated');

// 從 Native API 獲取
cache.set('okx', 'ETHUSDT', 4, 'native-api');

// 使用預設值
cache.set('okx', 'SOLUSDT', 8, 'default');
```

**Validation** (呼叫方負責):
```typescript
// 呼叫 set() 前應驗證間隔值
const validIntervals = [1, 4, 8];
if (!validIntervals.includes(interval)) {
  throw new Error(`Invalid interval: ${interval}`);
}
```

---

### setAll() - 批量設定

```typescript
setAll(
  exchange: string,
  intervals: Map<string, number>,
  source: IntervalSource
): void
```

**Purpose**: 批量設定多個交易對的間隔

**Parameters**:
- `exchange`: 交易所名稱
- `intervals`: 交易對符號與間隔值的映射
- `source`: 偵測來源

**Example**:
```typescript
const intervals = new Map([
  ['BTCUSDT', 8],
  ['ETHUSDT', 8],
  ['SOLUSDT', 4],
  ['AVAXUSDT', 8],
]);

cache.setAll('okx', intervals, 'native-api');
```

---

### getAllWithMetadata() - 獲取所有快取項目 (新增)

```typescript
getAllWithMetadata(exchange?: string): CachedIntervalMetadata[]
```

**Purpose**: 獲取所有快取項目的元資料（可選篩選交易所）

**Parameters**:
- `exchange` (optional): 交易所名稱篩選

**Returns**:
- `CachedIntervalMetadata[]`: 快取項目陣列（已過濾過期項目）

**Example**:
```typescript
// 獲取所有 OKX 的快取項目
const okxCache = cache.getAllWithMetadata('okx');

console.log(`OKX cached symbols: ${okxCache.length}`);
okxCache.forEach(item => {
  console.log(`${item.symbol}: ${item.interval}h (${item.source})`);
});

// 獲取所有交易所的快取項目
const allCache = cache.getAllWithMetadata();
console.log(`Total cached symbols: ${allCache.length}`);
```

---

### delete() - 刪除快取

```typescript
delete(exchange: string, symbol: string): boolean
```

**Purpose**: 手動刪除快取項目

**Parameters**:
- `exchange`: 交易所名稱
- `symbol`: 交易對符號

**Returns**:
- `true`: 成功刪除
- `false`: 項目不存在

**Example**:
```typescript
cache.delete('okx', 'BTCUSDT');
```

---

### clear() - 清空快取

```typescript
clear(exchange?: string): void
```

**Purpose**: 清空所有快取（或指定交易所的快取）

**Parameters**:
- `exchange` (optional): 交易所名稱

**Example**:
```typescript
// 清空 OKX 的快取
cache.clear('okx');

// 清空所有快取
cache.clear();
```

---

### getStats() - 獲取統計資訊

```typescript
getStats(): {
  hits: number;
  misses: number;
  sets: number;
  hitRate: number;
  size: number;
}
```

**Purpose**: 獲取快取效能統計

**Returns**:
- `hits`: 快取命中次數
- `misses`: 快取未命中次數
- `sets`: 快取寫入次數
- `hitRate`: 命中率（0-1）
- `size`: 當前快取項目數量

**Example**:
```typescript
const stats = cache.getStats();

console.log(`Cache Hit Rate: ${(stats.hitRate * 100).toFixed(2)}%`);
console.log(`Cache Size: ${stats.size} items`);
console.log(`Total Hits: ${stats.hits}`);
console.log(`Total Misses: ${stats.misses}`);
```

---

## 4. Usage Patterns

### Pattern 1: 基本快取流程

```typescript
// 1. 查詢快取
let interval = cache.get('okx', 'BTCUSDT');

// 2. 快取未命中，執行偵測
if (interval === null) {
  try {
    // 嘗試從 CCXT 計算
    interval = await calculateIntervalFromCCXT('BTCUSDT');
    cache.set('okx', 'BTCUSDT', interval, 'calculated');
  } catch (error) {
    // 降級到 Native API
    try {
      interval = await calculateIntervalFromNativeAPI('BTCUSDT');
      cache.set('okx', 'BTCUSDT', interval, 'native-api');
    } catch (nativeError) {
      // 最後降級：使用預設值
      interval = 8;
      cache.set('okx', 'BTCUSDT', interval, 'default');
    }
  }
}

// 3. 使用間隔值
return interval;
```

### Pattern 2: 檢查偵測來源

```typescript
const metadata = cache.getWithMetadata('okx', 'BTCUSDT');

if (metadata) {
  if (metadata.source === 'default') {
    logger.warn({
      symbol: 'BTCUSDT',
      interval: metadata.interval,
      age: Date.now() - metadata.timestamp,
    }, 'Using default interval - may need re-detection');
  }
}
```

### Pattern 3: 批量初始化

```typescript
async function initializeIntervals(symbols: string[]): Promise<void> {
  const intervals = new Map<string, number>();

  for (const symbol of symbols) {
    const interval = await detectInterval('okx', symbol);
    intervals.set(symbol, interval);
  }

  cache.setAll('okx', intervals, 'calculated');

  logger.info({
    count: intervals.size,
  }, 'Initialized OKX funding intervals');
}
```

### Pattern 4: 監控快取健康度

```typescript
function monitorCacheHealth(): void {
  const allCache = cache.getAllWithMetadata('okx');

  const defaultCount = allCache.filter(item => item.source === 'default').length;
  const calculatedCount = allCache.filter(item => item.source === 'calculated').length;
  const nativeApiCount = allCache.filter(item => item.source === 'native-api').length;

  const stats = cache.getStats();

  logger.info({
    total: allCache.length,
    calculated: calculatedCount,
    nativeApi: nativeApiCount,
    default: defaultCount,
    hitRate: (stats.hitRate * 100).toFixed(2) + '%',
  }, 'OKX interval cache health');

  // 警告：過多預設值使用
  if (defaultCount > allCache.length * 0.1) {
    logger.warn({
      defaultCount,
      totalCount: allCache.length,
      percentage: ((defaultCount / allCache.length) * 100).toFixed(2) + '%',
    }, 'High default interval usage - detection may be failing');
  }
}
```

---

## 5. Cache Key Format

### Key Generation

```typescript
private generateKey(exchange: string, symbol: string): string {
  return `${exchange}-${symbol}`;
}
```

**Examples**:
- Binance BTC/USDT: `binance-BTCUSDT`
- OKX ETH/USDT: `okx-ETHUSDT`
- Gate.io SOL/USDT: `gateio-SOLUSDT`

**注意事項**：
- 交易對符號大小寫敏感（建議統一大寫）
- 不同交易所的相同交易對視為不同項目

---

## 6. TTL Management

### Default TTL

```typescript
const DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 小時
```

### Expiration Logic

```typescript
function isExpired(cached: CachedInterval): boolean {
  const now = Date.now();
  const age = now - cached.timestamp;
  return age > cached.ttl;
}
```

### TTL Justification

**為何選擇 24 小時**：
- 資金費率間隔是交易所配置，變更頻率極低
- 24 小時足夠平衡記憶體使用和準確性
- 監控服務重啟時會重新偵測，不依賴長期快取

**自訂 TTL** (未來擴充)：
```typescript
// 可選：支援自訂 TTL
cache.set('okx', 'BTCUSDT', 8, 'calculated', 60 * 60 * 1000); // 1 小時
```

---

## 7. Thread Safety

### Concurrency Considerations

**Node.js 單執行緒模型**：
- JavaScript 是單執行緒，Map 操作是原子性的
- 不需要額外的鎖機制

**多程序情況** (不適用於本專案)：
- 如果未來部署多個監控程序，快取不共享
- 每個程序有獨立的快取
- 可考慮使用 Redis 作為共享快取

---

## 8. Memory Usage

### Estimation

```typescript
// 單一快取項目記憶體估算
const itemSize = {
  key: 32,        // 'exchange-symbol' 字串
  interval: 8,    // number
  source: 24,     // string
  timestamp: 8,   // number
  ttl: 8,         // number
  mapOverhead: 16 // Map 內部開銷
};

const totalPerItem = 96 bytes;

// 200 個交易對的總記憶體
const totalMemory = 200 * 96 = 19,200 bytes ≈ 19 KB
```

**結論**：記憶體使用可忽略不計

---

## 9. Error Handling

### Invalid Interval

```typescript
// 呼叫方應在 set() 前驗證
function validateInterval(interval: number): void {
  const validIntervals = [1, 4, 8];

  if (!validIntervals.includes(interval)) {
    throw new Error(`Invalid funding interval: ${interval}. Must be 1, 4, or 8.`);
  }
}

// 使用範例
try {
  validateInterval(calculatedInterval);
  cache.set('okx', 'BTCUSDT', calculatedInterval, 'calculated');
} catch (error) {
  logger.error({ error }, 'Failed to cache interval');
  // 降級到預設值
  cache.set('okx', 'BTCUSDT', 8, 'default');
}
```

### Null Checks

```typescript
// 總是檢查 get() 返回值
const interval = cache.get('okx', 'BTCUSDT');

if (interval === null) {
  // 處理快取未命中
} else {
  // 使用快取值
}
```

---

## 10. Testing Contract

### Unit Test Requirements

```typescript
describe('FundingIntervalCache', () => {
  it('should return null for non-existent key', () => {
    const cache = new FundingIntervalCache();
    expect(cache.get('okx', 'NONEXISTENT')).toBeNull();
  });

  it('should store and retrieve interval', () => {
    const cache = new FundingIntervalCache();
    cache.set('okx', 'BTCUSDT', 8, 'calculated');
    expect(cache.get('okx', 'BTCUSDT')).toBe(8);
  });

  it('should return null for expired cache', () => {
    const cache = new FundingIntervalCache(100); // 100ms TTL
    cache.set('okx', 'BTCUSDT', 8, 'calculated');

    // 等待過期
    await new Promise(resolve => setTimeout(resolve, 150));

    expect(cache.get('okx', 'BTCUSDT')).toBeNull();
  });

  it('should return metadata with getWithMetadata()', () => {
    const cache = new FundingIntervalCache();
    cache.set('okx', 'BTCUSDT', 8, 'calculated');

    const metadata = cache.getWithMetadata('okx', 'BTCUSDT');

    expect(metadata).not.toBeNull();
    expect(metadata?.interval).toBe(8);
    expect(metadata?.source).toBe('calculated');
    expect(metadata?.exchange).toBe('okx');
    expect(metadata?.symbol).toBe('BTCUSDT');
  });

  it('should update hit/miss statistics', () => {
    const cache = new FundingIntervalCache();

    cache.get('okx', 'BTCUSDT'); // miss
    cache.set('okx', 'BTCUSDT', 8, 'calculated');
    cache.get('okx', 'BTCUSDT'); // hit

    const stats = cache.getStats();

    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.sets).toBe(1);
    expect(stats.hitRate).toBeCloseTo(0.5);
  });
});
```

---

## 11. Migration Notes

### Backward Compatibility

**現有使用端**（無需修改）：
```typescript
// Binance connector (src/connectors/binance.ts)
this.intervalCache.set('binance', symbol, interval, 'api'); // 仍然有效

// OKX connector (src/connectors/okx.ts)
const cached = this.intervalCache.get('okx', symbol); // 仍然有效
```

**新功能**（可選使用）：
```typescript
// 查詢偵測來源
const metadata = this.intervalCache.getWithMetadata('okx', symbol);
if (metadata?.source === 'default') {
  // 處理預設值情況
}

// 批量初始化
this.intervalCache.setAll('okx', intervals, 'calculated');
```

### Source Type Rename

**變更**：
- 舊：`'api'`
- 新：`'native-api'`

**遷移路徑**：
1. 更新 Binance connector：`'api'` → `'native-api'`
2. 執行測試確保向下相容
3. 更新文件說明新的命名

---

## 12. Performance Characteristics

| Operation | Time Complexity | Notes |
|-----------|----------------|-------|
| `get()` | O(1) | Map 查詢 |
| `getWithMetadata()` | O(1) | Map 查詢 + 物件組裝 |
| `set()` | O(1) | Map 插入 |
| `setAll()` | O(n) | n 次 Map 插入 |
| `getAllWithMetadata()` | O(n) | 遍歷所有項目 |
| `delete()` | O(1) | Map 刪除 |
| `clear()` | O(n) | 遍歷並刪除（可選篩選） |
| `getStats()` | O(n) | 遍歷計算 size |

---

**Contract Version**: 2.0
**Changes from v1.0**:
- 新增 `getWithMetadata()` 方法
- 新增 `getAllWithMetadata()` 方法
- 新增 `CachedIntervalMetadata` 介面
- 更新 `IntervalSource` 類型（`'api'` → `'native-api'`）

**Last Updated**: 2025-01-27
**Status**: Draft
