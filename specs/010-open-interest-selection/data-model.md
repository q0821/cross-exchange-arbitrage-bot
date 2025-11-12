# Data Model: 基於 Open Interest 的動態交易對選擇

**Feature**: 010-open-interest-selection
**Date**: 2025-11-12
**Purpose**: 定義 Open Interest 相關的資料結構、狀態管理模式和驗證規則

## Overview

本功能涉及的資料主要為**臨時性、快取性質的資料**，不需要持久化到資料庫。資料流程為：

```
Binance API → In-memory Cache → CLI Logic → WebSocket Event → Web UI
```

關鍵資料模型包括：
1. **OpenInterestRecord**: 原始 OI 資料（從 Binance API 獲取）
2. **OpenInterestUSD**: 轉換後的 OI 資料（美元價值）
3. **TradingPairRanking**: 排序後的交易對清單
4. **OICache**: 快取機制的資料結構

## Core Entities

### 1. OpenInterestRecord (原始 OI 資料)

**Purpose**: 代表從 Binance API 獲取的原始 Open Interest 資料

**Source**: Binance `/fapi/v1/openInterest` API response

**TypeScript Interface**:
```typescript
interface OpenInterestRecord {
  symbol: string;              // 交易對名稱，如 "BTCUSDT"
  openInterest: string;        // 未平倉合約數量（字串格式）
  time: number;                // 時間戳（Unix ms）
}
```

**Validation Rules**:
- `symbol`: 必須符合 Binance 交易對格式（大寫字母 + "USDT"）
- `openInterest`: 必須為有效的數字字串，可轉換為 number
- `time`: 必須為正整數，距離當前時間不超過 1 小時（避免過期資料）

**Zod Schema**:
```typescript
import { z } from 'zod';

const OpenInterestRecordSchema = z.object({
  symbol: z.string().regex(/^[A-Z]+USDT$/),
  openInterest: z.string().regex(/^\d+(\.\d+)?$/),
  time: z.number().int().positive(),
});

export type OpenInterestRecord = z.infer<typeof OpenInterestRecordSchema>;
```

**Example**:
```json
{
  "symbol": "BTCUSDT",
  "openInterest": "125432.567",
  "time": 1699999999999
}
```

---

### 2. OpenInterestUSD (轉換後的 OI 資料)

**Purpose**: 將合約數量轉換為美元價值，方便比較和排序

**Source**: 計算自 `OpenInterestRecord` + 標記價格

**TypeScript Interface**:
```typescript
interface OpenInterestUSD {
  symbol: string;                  // 交易對名稱
  openInterestUSD: number;         // OI 美元價值（合約數量 × 標記價格）
  openInterestContracts: number;   // 原始合約數量
  markPrice: number;               // 標記價格（用於計算）
  timestamp: number;               // 資料時間戳（Unix ms）
}
```

**Validation Rules**:
- `symbol`: 必須符合 Binance 交易對格式
- `openInterestUSD`: 必須為正數，合理範圍 $1,000 - $50,000,000,000
- `openInterestContracts`: 必須為正數
- `markPrice`: 必須為正數
- `timestamp`: 必須為有效的時間戳

**Calculation**:
```typescript
function calculateOIinUSD(
  oi: OpenInterestRecord,
  markPrice: number
): OpenInterestUSD {
  const contracts = parseFloat(oi.openInterest);
  return {
    symbol: oi.symbol,
    openInterestUSD: contracts * markPrice,
    openInterestContracts: contracts,
    markPrice,
    timestamp: oi.time,
  };
}
```

**Zod Schema**:
```typescript
const OpenInterestUSDSchema = z.object({
  symbol: z.string().regex(/^[A-Z]+USDT$/),
  openInterestUSD: z.number().positive().max(50_000_000_000),
  openInterestContracts: z.number().positive(),
  markPrice: z.number().positive(),
  timestamp: z.number().int().positive(),
});

export type OpenInterestUSD = z.infer<typeof OpenInterestUSDSchema>;
```

**Example**:
```json
{
  "symbol": "BTCUSDT",
  "openInterestUSD": 5432100000.50,
  "openInterestContracts": 125432.567,
  "markPrice": 43300.25,
  "timestamp": 1699999999999
}
```

---

### 3. TradingPairRanking (交易對排名)

**Purpose**: 儲存按 OI 排序後的交易對清單，用於 CLI 選擇和監控

**Source**: 計算自 `OpenInterestUSD[]` 排序結果

**TypeScript Interface**:
```typescript
interface TradingPairRanking {
  rankings: OpenInterestUSD[];     // 已排序的 OI 資料（降序）
  totalSymbols: number;            // 總交易對數量
  topN: number;                    // 取前 N 個
  generatedAt: number;             // 產生時間（Unix ms）
}
```

**Invariants**:
- `rankings` 必須按 `openInterestUSD` 降序排列
- `rankings.length` 應等於 `totalSymbols`（獲取全部資料）
- `topN` 必須 <= `totalSymbols`

**Operations**:
```typescript
class TradingPairRanking {
  constructor(
    public rankings: OpenInterestUSD[],
    public totalSymbols: number,
    public topN: number,
    public generatedAt: number = Date.now()
  ) {
    // 驗證排序
    for (let i = 1; i < rankings.length; i++) {
      if (rankings[i - 1].openInterestUSD < rankings[i].openInterestUSD) {
        throw new Error('Rankings must be sorted in descending order');
      }
    }
  }

  /**
   * 取得前 N 個交易對名稱
   */
  getTopSymbols(n: number = this.topN): string[] {
    return this.rankings.slice(0, n).map(r => r.symbol);
  }

  /**
   * 過濾最小 OI 門檻
   */
  filterByMinOI(minOI: number): TradingPairRanking {
    const filtered = this.rankings.filter(r => r.openInterestUSD >= minOI);
    return new TradingPairRanking(
      filtered,
      filtered.length,
      this.topN,
      this.generatedAt
    );
  }

  /**
   * 檢查是否過期（超過 15 分鐘）
   */
  isExpired(ttlMs: number = 15 * 60 * 1000): boolean {
    return Date.now() - this.generatedAt > ttlMs;
  }
}
```

---

### 4. OICache (快取資料結構)

**Purpose**: 提供 15 分鐘 TTL 的快取機制，避免重複 API 呼叫

**Source**: In-memory Map-based cache

**TypeScript Interface**:
```typescript
interface CacheEntry<T> {
  data: T;                // 快取資料
  expiresAt: number;      // 過期時間（Unix ms）
}

class OICache {
  private cache = new Map<string, CacheEntry<TradingPairRanking>>();
  private readonly TTL_MS = 15 * 60 * 1000;  // 15 分鐘

  /**
   * 設定快取
   */
  set(topN: number, ranking: TradingPairRanking): void {
    const key = this.getCacheKey(topN);
    this.cache.set(key, {
      data: ranking,
      expiresAt: Date.now() + this.TTL_MS,
    });
  }

  /**
   * 獲取快取（若未過期）
   */
  get(topN: number): TradingPairRanking | null {
    const key = this.getCacheKey(topN);
    const entry = this.cache.get(key);

    if (!entry) return null;

    // 檢查過期
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * 檢查快取是否存在且有效
   */
  has(topN: number): boolean {
    return this.get(topN) !== null;
  }

  /**
   * 清除所有快取
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 清除過期快取（可定時執行）
   */
  clearExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * 產生快取鍵
   */
  private getCacheKey(topN: number): string {
    return `top_oi_${topN}`;
  }
}
```

**Cache Eviction Policy**:
- **TTL-based**: 固定 15 分鐘過期
- **Manual clear**: 系統重啟時清空（in-memory）
- **Periodic cleanup**: 每小時清理過期項目（可選）

---

## State Management Patterns

### CLI 端（資料獲取和快取）

```typescript
// 全域快取實例
const oiCache = new OICache();

async function getTopSymbolsByOI(
  topN: number,
  minOI?: number
): Promise<string[]> {
  // 檢查快取
  let ranking = oiCache.get(topN);

  if (!ranking) {
    // 快取未命中，獲取新資料
    logger.info({ topN }, 'OI cache miss, fetching from API');

    const binance = new BinanceConnector();
    const allOI = await binance.getAllOpenInterest();

    // 排序
    const sorted = allOI.sort((a, b) => b.openInterestUSD - a.openInterestUSD);

    ranking = new TradingPairRanking(sorted, sorted.length, topN);

    // 快取結果
    oiCache.set(topN, ranking);
    logger.info({ topN, total: sorted.length }, 'OI data cached');
  } else {
    logger.info({ topN }, 'OI cache hit');
  }

  // 過濾最小 OI（若指定）
  if (minOI) {
    ranking = ranking.filterByMinOI(minOI);
  }

  // 返回前 N 個
  return ranking.getTopSymbols(topN);
}
```

### Web 端（資料顯示）

```typescript
// Web 前端型別擴展
interface MarketRate {
  symbol: string;
  bestPair?: {
    buyExchange: string;
    sellExchange: string;
    spreadPercent: number;
    // ... 其他欄位
  };
  openInterest?: number;  // 新增：OI 美元價值（可選）
  // ... 其他欄位
}

// WebSocket 事件包含 OI 資料
interface RatesUpdateEvent {
  type: 'rates:update';
  data: {
    rates: MarketRate[];  // 每個 rate 包含 openInterest 欄位
  };
}

// 前端使用 Feature 009 的穩定排序
const sortedSymbols = useMemo(() => {
  const symbols = Array.from(ratesMap.keys());
  return symbols.sort((a, b) => {
    const rateA = ratesMap.get(a)!;
    const rateB = ratesMap.get(b)!;

    // 支援 OI 排序
    if (sortBy === 'openInterest') {
      const oiA = rateA.openInterest || 0;
      const oiB = rateB.openInterest || 0;
      const result = oiA - oiB;
      return sortDirection === 'asc' ? result : -result;
    }

    // ... 其他排序欄位
  });
}, [sortBy, sortDirection]);  // 不依賴 ratesMap，保持穩定
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ 1. CLI 啟動：pnpm dev:cli monitor start --auto-fetch --top 100 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │ getTopSymbolsByOI(100)│
         └───────────┬───────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │ 檢查 oiCache.get(100) │
         └───────────┬───────────┘
                     │
        ┌────────────┴─────────────┐
        │                          │
        ▼ Cache Miss               ▼ Cache Hit
┌──────────────────┐      ┌──────────────────┐
│ 呼叫 Binance API  │      │ 返回快取資料      │
│ getAllOpenInterest()│   └────────┬─────────┘
└────────┬─────────┘               │
         │                         │
         ▼                         │
┌────────────────────┐             │
│ 計算 OI USD        │             │
│ (contracts × price)│             │
└────────┬───────────┘             │
         │                         │
         ▼                         │
┌────────────────────┐             │
│ 按 OI USD 降序排序 │             │
└────────┬───────────┘             │
         │                         │
         ▼                         │
┌────────────────────┐             │
│ 快取結果 (15 min)  │             │
└────────┬───────────┘             │
         │                         │
         └────────────┬────────────┘
                      │
                      ▼
         ┌────────────────────────┐
         │ 過濾最小 OI (若指定)    │
         └────────────┬───────────┘
                      │
                      ▼
         ┌────────────────────────┐
         │ 取前 N 個交易對         │
         └────────────┬───────────┘
                      │
                      ▼
         ┌────────────────────────┐
         │ MonitorService.start()  │
         │ (開始監控費率)          │
         └────────────┬───────────┘
                      │
                      ▼
         ┌────────────────────────┐
         │ WebSocket 廣播         │
         │ rates:update 事件      │
         │ (包含 OI 資料)          │
         └────────────┬───────────┘
                      │
                      ▼
         ┌────────────────────────┐
         │ Web UI 顯示 OI 欄位    │
         │ 支援 OI 排序           │
         └────────────────────────┘
```

---

## Validation and Error Handling

### Input Validation

```typescript
// CLI 參數驗證
function validateCLIOptions(options: MonitorOptions): void {
  if (options.top !== undefined) {
    const topN = parseInt(options.top.toString(), 10);
    if (isNaN(topN) || topN < 1 || topN > 500) {
      throw new Error('--top must be between 1 and 500');
    }
  }

  if (options.minOi !== undefined) {
    const minOI = parseFloat(options.minOi.toString());
    if (isNaN(minOI) || minOI < 0) {
      throw new Error('--min-oi must be a non-negative number');
    }
  }
}

// API 回應驗證
function validateAPIResponse(data: unknown): OpenInterestRecord[] {
  const schema = z.array(OpenInterestRecordSchema);
  return schema.parse(data);
}
```

### Error Handling

```typescript
async function safeGetTopSymbols(topN: number): Promise<string[]> {
  try {
    return await getTopSymbolsByOI(topN);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 429) {
        logger.error('Binance API rate limit exceeded');
        throw new Error(
          'API rate limit exceeded. Please try again later or reduce --top value.'
        );
      }
    }

    logger.error({ error }, 'Failed to fetch symbols by OI');
    throw new Error(
      'Unable to fetch trading pairs. Please check network connection and API status.'
    );
  }
}
```

---

## Performance Considerations

### Memory Usage

估算快取記憶體使用：
- 單一 `OpenInterestUSD` 物件：~100 bytes
- 200 個交易對：200 × 100 = 20 KB
- 快取 10 個不同的 topN 值：10 × 20 KB = 200 KB

**結論**：記憶體使用量可忽略不計（< 1 MB）

### API Call Optimization

- 使用 `p-limit` 控制並行數為 10，避免瞬間大量請求
- 批次獲取價格（一次呼叫獲取所有價格）
- 快取 15 分鐘，95% 的請求從快取返回

### WebSocket Payload Size

- 每個 `MarketRate` 新增 `openInterest` 欄位：+8 bytes (number)
- 100 個交易對：100 × 8 = 800 bytes
- 總 payload 增加：< 1 KB

**結論**：對 WebSocket 效能影響極小

---

## Summary

本功能的資料模型設計遵循以下原則：

1. **簡單性**：使用 in-memory cache，不增加資料庫複雜度
2. **效能**：快取機制減少 95% 的 API 呼叫
3. **可靠性**：Zod schema 驗證所有外部資料
4. **可擴展性**：資料結構支援未來新增過濾條件（如 minOI）
5. **整合性**：與 Feature 009 穩定排序無縫整合

所有資料模型已定義完成，可進入下一階段：契約設計（contracts/）和快速開始指南（quickstart.md）。
