# Data Model: 資金費率間隔動態獲取

**Feature**: 017-funding-rate-intervals | **Date**: 2025-11-19
**Status**: 無資料庫變更

## Summary

此功能為**純邏輯修改**，不涉及資料庫 schema 變更或 Prisma migrations。所有間隔資訊僅儲存於記憶體快取中，不持久化至資料庫。

---

## In-Memory Data Structures

### 1. FundingIntervalCache（間隔快取）

**Purpose**: 儲存各交易對的資金費率間隔資訊，避免重複 API 呼叫。

**Implementation**: `src/lib/FundingIntervalCache.ts`

```typescript
interface CachedInterval {
  /** 間隔值（小時） */
  interval: number;

  /** 資料來源 */
  source: 'api' | 'calculated' | 'default';

  /** 快取建立時間戳（毫秒） */
  timestamp: number;

  /** 存活時間（毫秒），預設 24 小時 */
  ttl: number;
}

class FundingIntervalCache {
  /** 快取映射，key: `${exchange}-${symbol}` */
  private cache: Map<string, CachedInterval>;

  /** 快取統計 */
  private stats: {
    hits: number;
    misses: number;
    sets: number;
  };

  constructor(defaultTTL: number = 24 * 60 * 60 * 1000) {
    this.cache = new Map();
    this.stats = { hits: 0, misses: 0, sets: 0 };
  }

  /** 設定間隔值 */
  set(exchange: string, symbol: string, interval: number, source: string): void;

  /** 獲取間隔值（若過期則返回 null） */
  get(exchange: string, symbol: string): number | null;

  /** 批量設定（用於 Binance 批量查詢） */
  setAll(exchange: string, intervals: Map<string, number>, source: string): void;

  /** 清除快取 */
  clear(): void;

  /** 清除過期項目 */
  clearExpired(): void;

  /** 獲取快取統計 */
  getStats(): { size: number; hitRate: number; hits: number; misses: number };
}
```

**Key Fields**:
- `interval`: 資金費率間隔（小時），可能值：1, 2, 4, 6, 8（OKX 動態調整）
- `source`: 標記資料來源以便監控和除錯
  - `'api'`: 從交易所 API 直接獲取（如 Binance `/fapi/v1/fundingInfo`）
  - `'calculated'`: 計算得出（如 OKX 時間戳差值）
  - `'default'`: 降級至預設值（API 失敗時）
- `timestamp`: 用於 TTL 檢查
- `ttl`: 預設 24 小時，可配置

**Memory Footprint**:
- 每個 entry ~80 bytes（考慮 V8 物件開銷）
- 400 entries（100 symbols × 4 exchanges）≈ 32 KB
- **結論**: 記憶體成本可忽略

---

### 2. ExchangeRateData（現有型別，需確保欄位填充）

**Purpose**: 表示單一交易所的資金費率數據。

**Implementation**: `src/connectors/types.ts`（已存在，無需新增）

```typescript
export interface ExchangeRateData {
  /** 資金費率（小數，如 0.0001 表示 0.01%） */
  rate: number;

  /** 下次結算時間（ISO 8601 字串） */
  nextTime: string;

  /** 資金費率間隔（小時）*/
  fundingInterval?: number;  // ⚠️ 此欄位已定義但當前未填充

  /** 資料來源時間戳 */
  timestamp?: number;
}
```

**Changes Required**:
- ✅ 欄位已定義於型別中（`fundingInterval?: number`）
- ⚠️ 當前實作未填充此欄位（保持 `undefined`）
- ✅ 需修改各 connector 的 `getFundingRate()` 和 `getFundingRates()` 方法以填充此欄位

**Example Usage After Fix**:
```typescript
// src/connectors/binance.ts
async getFundingRate(symbol: string): Promise<ExchangeRateData> {
  const rate = await this.fetchRate(symbol);
  const interval = await this.getFundingInterval(symbol); // 🆕 新增方法

  return {
    rate: parseFloat(rate.fundingRate),
    nextTime: new Date(rate.nextFundingTime).toISOString(),
    fundingInterval: interval,  // 🆕 填充欄位
    timestamp: Date.now()
  };
}
```

---

## Modified Structures

### 3. Connector Method Signatures（新增方法）

各 connector 需新增以下方法：

```typescript
/** 獲取單一交易對的資金費率間隔（小時） */
async getFundingInterval(symbol: string): Promise<number>;

/** 批量獲取多個交易對的資金費率間隔 */
async getFundingIntervals(symbols: string[]): Promise<Map<string, number>>;
```

**Implementation Notes**:
- **Binance**: 呼叫 `/fapi/v1/fundingInfo` API
- **OKX**: 從 `getFundingRate()` 的時間戳計算（無需額外 API 呼叫）
- **MEXC**: 測試 CCXT `info.collectCycle` 或呼叫原生 API
- **Gate.io**: 測試 CCXT `info.funding_interval` 或呼叫原生 API

---

## Database Models (No Changes)

### PostgreSQL + TimescaleDB

此功能**不涉及資料庫 schema 變更**。

**現有表**（不修改）:
- `FundingRateValidation`: 資金費率歷史驗證記錄
- `PriceData`: 價格數據歷史記錄
- `ArbitrageAssessment`: 套利評估記錄

**Rationale**:
- 間隔資訊僅用於**即時計算**（標準化費率時使用）
- 資料庫已儲存**標準化後的費率**（統一至 8 小時基準）
- 無需儲存原始間隔值（快取即可滿足需求）
- 簡化資料模型，避免額外維護成本

**Example Data Flow**:
```
1. Connector 獲取原始費率 + 間隔
   ↓
2. FundingRateNormalizer 標準化（使用間隔值）
   ↓
3. 寫入資料庫（僅標準化後的費率，不含間隔）
   ↓
4. Web UI 讀取資料庫（僅顯示標準化費率）
```

---

## Validation Rules

### Interval Value Constraints

```typescript
function validateInterval(interval: number): void {
  if (interval <= 0 || interval > 24) {
    throw new Error(`Invalid funding interval: ${interval}h (must be 0 < interval ≤ 24)`);
  }

  // 警告非標準間隔（但仍接受）
  const standardIntervals = [1, 2, 4, 6, 8, 24];
  if (!standardIntervals.includes(interval)) {
    logger.warn({ interval }, 'Non-standard funding interval detected');
  }
}
```

**Rationale**:
- 支援未來可能的新間隔值（如 12 小時）
- 記錄非標準值以監控交易所變更

### Cache TTL Constraints

```typescript
const MIN_TTL = 60 * 60 * 1000;  // 1 hour
const MAX_TTL = 7 * 24 * 60 * 60 * 1000;  // 7 days
const DEFAULT_TTL = 24 * 60 * 60 * 1000;  // 24 hours

function validateTTL(ttl: number): void {
  if (ttl < MIN_TTL || ttl > MAX_TTL) {
    throw new Error(`Invalid TTL: ${ttl}ms (must be ${MIN_TTL}ms - ${MAX_TTL}ms)`);
  }
}
```

---

## Migration Guide

### No Prisma Migration Required

```bash
# 不需要執行
# pnpm prisma migrate dev
```

### No Database Schema Changes

```sql
-- 不需要任何 SQL 變更
```

### Code Migration

**Required Changes**:

1. **新增檔案**: `src/lib/FundingIntervalCache.ts`
2. **修改檔案**:
   - `src/connectors/binance.ts` - 新增 `getFundingInterval()` 方法
   - `src/connectors/okx.ts` - 實作時間戳計算邏輯
   - `src/connectors/mexc.ts` - 測試/實作 CCXT 或原生 API
   - `src/connectors/gateio.ts` - 測試/實作 CCXT 或原生 API
   - `src/services/monitor/FundingRateMonitor.ts` - 移除硬編碼預設值

**No Breaking Changes**:
- ✅ `ExchangeRateData.fundingInterval` 為 optional 欄位（`?`）
- ✅ 現有程式碼可繼續使用（欄位為 `undefined` 時不影響）
- ✅ 向後兼容

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Connector 呼叫交易所 API                                      │
│    - Binance: GET /fapi/v1/fundingInfo                          │
│    - OKX: GET /api/v5/public/funding-rate (計算時間戳差值)        │
│    - MEXC: CCXT fetchFundingRate() 或原生 API                    │
│    - Gate.io: CCXT fetchFundingRate() 或原生 API                 │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. 獲取間隔值                                                    │
│    interval = 4 or 8 (或其他值)                                 │
│    source = 'api' | 'calculated'                                │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. 寫入 FundingIntervalCache                                     │
│    cache.set('binance-BLZUSDT', 4, 'api')                       │
│    TTL = 24 hours                                               │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. 填充 ExchangeRateData.fundingInterval                         │
│    { rate: 0.0001, nextTime: '...', fundingInterval: 4 }        │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. FundingRateNormalizer 標準化                                  │
│    normalizedRate = originalRate × (8 / originalInterval)       │
│    例: 4h 費率 0.0001 → 8h 等效 0.0002                            │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. 寫入資料庫（僅標準化後的費率）                                 │
│    FundingRateValidation { normalizedRate: 0.0002 }             │
│    ⚠️ 不儲存原始間隔值                                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Related Files

### Modified Files

- `src/connectors/binance.ts` - 新增間隔獲取方法
- `src/connectors/okx.ts` - 實作時間戳計算
- `src/connectors/mexc.ts` - 測試/實作間隔獲取
- `src/connectors/gateio.ts` - 測試/實作間隔獲取
- `src/services/monitor/FundingRateMonitor.ts` - 使用動態間隔

### New Files

- `src/lib/FundingIntervalCache.ts` - 快取實作
- `tests/unit/lib/FundingIntervalCache.test.ts` - 快取測試

### Unchanged Files

- `src/services/validation/FundingRateNormalizer.ts` - 標準化邏輯已支援動態間隔
- `src/models/FundingRate.ts` - 資料模型無需變更
- `prisma/schema.prisma` - 無 schema 變更

---

## Summary

| 項目 | 變更 | 說明 |
|------|------|------|
| **Prisma Schema** | ❌ 無 | 不涉及資料庫結構變更 |
| **新增資料結構** | ✅ 是 | `FundingIntervalCache`（記憶體快取） |
| **現有型別修改** | ⚠️ 欄位填充 | `ExchangeRateData.fundingInterval` 需填充 |
| **資料庫遷移** | ❌ 無 | 不需要 Prisma migration |
| **向後兼容** | ✅ 是 | Optional 欄位，不破壞現有程式碼 |
| **記憶體增加** | ~32 KB | 可忽略不計 |
| **資料持久化** | ❌ 否 | 間隔值僅存在於記憶體快取 |

**結論**: ✅ 無資料模型變更，完全向後兼容，僅需程式碼邏輯修改。

---

**Last Updated**: 2025-11-19
**Status**: Ready for Implementation
