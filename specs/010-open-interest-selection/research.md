# Technical Research: 基於 Open Interest 的動態交易對選擇

**Feature**: 010-open-interest-selection
**Date**: 2025-11-12
**Purpose**: 研究 Open Interest API 整合、快取策略、CLI 參數設計的最佳實踐和技術方案

## Research Questions

1. **Binance Open Interest API**: 端點、請求格式、回應結構、速率限制如何設計？
2. **快取策略**: In-memory cache vs Redis，TTL 機制如何實作？
3. **CLI 參數擴展**: 如何在現有 `--auto-fetch` 基礎上整合 OI 排序？
4. **Web 前端整合**: 如何在 Feature 009 穩定排序基礎上新增 OI 欄位？
5. **錯誤處理和重試**: 如何處理 API 速率限制和網路錯誤？

## Decision 1: Binance Open Interest API 整合

### Decision
使用 Binance Futures API 的 `/fapi/v1/openInterest` 端點批次獲取所有 USDT 永續合約的 OI 資料，然後在本地進行排序和過濾。

### Rationale

**API 研究結果**：
- **端點**: `GET https://fapi.binance.com/fapi/v1/openInterest`
- **參數**: `symbol` (required) - 必須逐個交易對查詢，無批次端點
- **回應格式**:
  ```json
  {
    "openInterest": "10659.509",  // 合約數量（非美元價值）
    "symbol": "BTCUSDT",
    "time": 1499405658658
  }
  ```
- **速率限制**: Weight = 1 per request, 總限制 2400/min

**替代方案**：使用 `/fapi/v1/ticker/24hr` 獲取所有交易對的 24 小時統計，但該端點不包含 OI 資料。

**實作策略**：
1. 先呼叫 `/fapi/v1/exchangeInfo` 獲取所有 USDT 永續合約清單（weight 1）
2. 並行呼叫每個交易對的 `/fapi/v1/openInterest`（batch size 控制在 50 個/批次）
3. 同時呼叫 `/fapi/v1/ticker/price` 獲取標記價格，用於將合約數量轉換為美元價值
4. 本地計算 OI USD = OI contracts × mark price
5. 按 OI USD 降序排序，取前 N 個

**速率限制計算**：
- 假設有 200 個 USDT 合約
- 需要 200 次 OI 查詢 + 1 次 exchangeInfo + 1 次批次 price = 202 requests
- 總 weight ≈ 202，遠低於 2400/min 限制
- 使用 p-limit 控制並行數為 10，避免瞬間大量請求

### Alternatives Considered

1. **使用 CCXT 的 fetchOpenInterest()**
   - 優點：統一介面，支援多交易所
   - 缺點：CCXT 可能不支援批次 OI 查詢，需要逐個呼叫
   - **拒絕原因**：直接使用 Binance API 更可控，且已有 binance connector

2. **使用 Trading Volume 代替 OI**
   - 優點：24hr ticker 端點可一次獲取所有交易對的 volume
   - 缺點：volume 不等於 OI，無法反映未平倉合約量
   - **拒絕原因**：用戶明確要求使用 OI 作為篩選標準

3. **從第三方資料源獲取 OI**
   - 優點：可能有聚合資料，減少 API 呼叫
   - 缺點：增加外部依賴，資料可能不及時
   - **拒絕原因**：直接從幣安獲取最權威且即時

### Implementation Pattern

```typescript
// src/connectors/binance.ts
import axios from 'axios';
import pLimit from 'p-limit';

interface OpenInterestData {
  symbol: string;
  openInterest: string;  // 合約數量
  time: number;
}

interface OpenInterestUSD {
  symbol: string;
  openInterestUSD: number;  // 美元價值
  openInterestContracts: number;
  markPrice: number;
  timestamp: number;
}

export class BinanceConnector {
  private baseUrl = 'https://fapi.binance.com';

  /**
   * 獲取所有 USDT 永續合約的 Open Interest（美元價值）
   */
  async getAllOpenInterest(): Promise<OpenInterestUSD[]> {
    // 1. 獲取所有 USDT 永續合約
    const symbols = await this.getUSDTPerpetualSymbols();

    // 2. 並行獲取 OI 資料（控制並行數）
    const limit = pLimit(10);
    const oiPromises = symbols.map(symbol =>
      limit(() => this.getOpenInterestForSymbol(symbol))
    );
    const oiData = await Promise.all(oiPromises);

    // 3. 獲取標記價格（批次）
    const prices = await this.getMarkPrices(symbols);

    // 4. 計算美元價值
    const result: OpenInterestUSD[] = oiData.map(oi => {
      const price = prices.get(oi.symbol) || 0;
      return {
        symbol: oi.symbol,
        openInterestUSD: parseFloat(oi.openInterest) * price,
        openInterestContracts: parseFloat(oi.openInterest),
        markPrice: price,
        timestamp: oi.time,
      };
    });

    return result;
  }

  /**
   * 獲取 OI 排名前 N 的交易對
   */
  async getTopSymbolsByOI(topN: number = 50): Promise<string[]> {
    const allOI = await this.getAllOpenInterest();

    // 按 OI USD 降序排序
    const sorted = allOI.sort((a, b) => b.openInterestUSD - a.openInterestUSD);

    // 取前 N 個
    const topSymbols = sorted.slice(0, topN).map(item => item.symbol);

    return topSymbols;
  }

  private async getOpenInterestForSymbol(symbol: string): Promise<OpenInterestData> {
    const response = await axios.get(`${this.baseUrl}/fapi/v1/openInterest`, {
      params: { symbol },
    });
    return response.data;
  }

  private async getUSDTPerpetualSymbols(): Promise<string[]> {
    const response = await axios.get(`${this.baseUrl}/fapi/v1/exchangeInfo`);
    const symbols = response.data.symbols
      .filter((s: any) =>
        s.quoteAsset === 'USDT' &&
        s.contractType === 'PERPETUAL' &&
        s.status === 'TRADING'
      )
      .map((s: any) => s.symbol);
    return symbols;
  }

  private async getMarkPrices(symbols: string[]): Promise<Map<string, number>> {
    const response = await axios.get(`${this.baseUrl}/fapi/v1/ticker/price`);
    const priceMap = new Map<string, number>();
    response.data
      .filter((p: any) => symbols.includes(p.symbol))
      .forEach((p: any) => {
        priceMap.set(p.symbol, parseFloat(p.price));
      });
    return priceMap;
  }
}
```

## Decision 2: 快取策略

### Decision
使用 **In-memory Map-based cache** 搭配簡單的 TTL 機制（15 分鐘），不使用 Redis。

### Rationale

**問題分析**：
- OI 資料獲取成本較高（200+ API 請求）
- OI 資料不需要頻繁更新（15 分鐘內變化不大）
- 避免短時間內重複呼叫 API 浪費速率限制配額

**In-memory cache 優勢**：
1. **零外部依賴**：不需要 Redis 服務，降低部署複雜度
2. **低延遲**：記憶體存取遠快於 Redis 網路呼叫
3. **簡單實作**：TypeScript Map + timestamp 即可
4. **適合單機部署**：CLI 通常單一實例運行

**TTL 機制設計**：
```typescript
interface CacheEntry<T> {
  data: T;
  expiresAt: number;  // Unix timestamp (ms)
}

class SimpleCache<T> {
  private cache = new Map<string, CacheEntry<T>>();

  set(key: string, value: T, ttlMs: number): void {
    this.cache.set(key, {
      data: value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // 檢查是否過期
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  clear(): void {
    this.cache.clear();
  }
}

// 使用範例
const oiCache = new SimpleCache<OpenInterestUSD[]>();
const CACHE_TTL = 15 * 60 * 1000;  // 15 分鐘

async function getTopSymbols(topN: number): Promise<string[]> {
  const cacheKey = `top_oi_${topN}`;

  // 檢查快取
  const cached = oiCache.get(cacheKey);
  if (cached) {
    logger.info({ topN }, 'OI cache hit');
    return cached.slice(0, topN).map(item => item.symbol);
  }

  // 快取未命中，獲取新資料
  logger.info({ topN }, 'OI cache miss, fetching from API');
  const allOI = await binanceConnector.getAllOpenInterest();

  // 快取結果
  oiCache.set(cacheKey, allOI, CACHE_TTL);

  // 返回前 N 個
  const sorted = allOI.sort((a, b) => b.openInterestUSD - a.openInterestUSD);
  return sorted.slice(0, topN).map(item => item.symbol);
}
```

### Alternatives Considered

1. **使用 Redis**
   - 優點：支援分散式部署，持久化
   - 缺點：增加外部依賴，需要 Redis 服務
   - **拒絕原因**：CLI 通常單機運行，不需要分散式快取

2. **使用 node-cache 套件**
   - 優點：成熟的快取套件，支援 TTL、LRU 等
   - 缺點：增加 npm 依賴
   - **拒絕原因**：自實作非常簡單（20 行代碼），無需引入套件

3. **不使用快取**
   - 優點：實作最簡單
   - 缺點：每次啟動都需要 200+ API 請求，耗時且浪費配額
   - **拒絕原因**：用戶明確要求快取機制

## Decision 3: CLI 參數設計

### Decision
擴展現有 `--auto-fetch` 參數，新增 `--top N` 參數控制獲取數量，並整合到 `fetchAvailableSymbols()` 函式中。

### Rationale

**現有程式碼分析**：
檔案 `src/cli/commands/monitor/start.ts` 已有 `fetchAvailableSymbols()` 函式，目前使用 CCXT 獲取交易對並按 volume 過濾。我們需要修改此函式以支援按 OI 排序。

**參數設計**：
```typescript
interface MonitorOptions {
  autoFetch?: boolean;  // 現有：啟用動態獲取
  top?: number;        // 新增：獲取前 N 個（預設 50）
  minOi?: number;      // 可選：最小 OI 門檻（USD）
  testnet?: boolean;   // 現有
}

// CLI 命令定義
program
  .command('start')
  .option('--auto-fetch', 'Dynamically fetch trading pairs based on Open Interest')
  .option('--top <number>', 'Number of top symbols to fetch (default: 50)', '50')
  .option('--min-oi <number>', 'Minimum Open Interest in USD (optional)')
  .option('--testnet', 'Use testnet environment')
  .action(async (options: MonitorOptions) => {
    let symbols: string[];

    if (options.autoFetch) {
      const topN = parseInt(options.top || '50', 10);
      const minOI = options.minOi ? parseFloat(options.minOi) : undefined;

      logger.info({ topN, minOI }, 'Fetching symbols by Open Interest...');
      symbols = await fetchSymbolsByOI(topN, minOI, options.testnet);
    } else {
      // 使用靜態配置檔案
      symbols = config.groups.top30?.symbols || [];
    }

    // 啟動監控
    await monitorService.start(symbols);
  });
```

**函式重構**：
```typescript
async function fetchSymbolsByOI(
  topN: number,
  minOI: number | undefined,
  isTestnet: boolean
): Promise<string[]> {
  const binance = new BinanceConnector(isTestnet);

  // 獲取所有 OI 資料（帶快取）
  const allOI = await getTopSymbolsWithCache(binance, topN);

  // 過濾最小 OI（若指定）
  const filtered = minOI
    ? allOI.filter(item => item.openInterestUSD >= minOI)
    : allOI;

  // 取前 N 個
  const topSymbols = filtered.slice(0, topN).map(item => item.symbol);

  // 驗證交易對在 OKX 也可用
  const okxSymbols = await getOKXAvailableSymbols(isTestnet);
  const validSymbols = topSymbols.filter(s => okxSymbols.includes(s));

  logger.info({
    total: topSymbols.length,
    valid: validSymbols.length,
    filtered: topSymbols.length - validSymbols.length,
  }, 'Symbol filtering complete');

  return validSymbols;
}
```

### Alternatives Considered

1. **新增獨立的 `--sort-by oi` 參數**
   - 優點：更明確的語義
   - 缺點：增加參數複雜度，與現有 `--auto-fetch` 重疊
   - **拒絕原因**：`--auto-fetch` 已暗示動態獲取，直接整合 OI 排序更直觀

2. **完全取代 volume-based 過濾**
   - 優點：簡化邏輯，只保留一種排序方式
   - 缺點：破壞向後相容性
   - **拒絕原因**：保留 volume 作為備選方案，視為 fallback

## Decision 4: Web 前端整合

### Decision
在 Feature 009 穩定排序基礎上，新增 `openInterest` 作為新的 `SortField`，擴展 `RatesTable` 顯示 OI 欄位。

### Rationale

**Feature 009 架構回顧**：
- `SortField` 型別：`'symbol' | 'spread' | 'annualizedReturn' | 'netReturn'`
- `RatesTable` 使用 snapshot sorting，WebSocket 更新不觸發重排
- `sortComparator` 函式處理排序邏輯，支援次要鍵（symbol）

**整合策略**：
1. **擴展型別定義**（`app/(dashboard)/market-monitor/types.ts`）:
   ```typescript
   export type SortField =
     | 'symbol'
     | 'spread'
     | 'annualizedReturn'
     | 'netReturn'
     | 'openInterest';  // 新增
   ```

2. **修改 MarketRate 介面**（若需要）:
   ```typescript
   interface MarketRate {
     symbol: string;
     // ... 現有欄位
     openInterest?: number;  // 可選，因為舊資料可能沒有
   }
   ```

3. **更新 sortComparator**（`app/(dashboard)/market-monitor/utils/sortComparator.ts`）:
   ```typescript
   export function stableSortComparator(
     a: MarketRate,
     b: MarketRate,
     sortBy: SortField,
     sortDirection: SortDirection
   ): number {
     let result = 0;

     switch (sortBy) {
       case 'openInterest':
         result = (a.openInterest || 0) - (b.openInterest || 0);
         break;
       // ... 其他 case
     }

     // 次要排序：symbol
     if (result === 0) {
       result = a.symbol.localeCompare(b.symbol);
     }

     return sortDirection === 'asc' ? result : -result;
   }
   ```

4. **修改 RatesTable**（`app/(dashboard)/market-monitor/components/RatesTable.tsx`）:
   ```tsx
   <thead>
     <tr>
       <th onClick={() => onSort('symbol')}>Symbol</th>
       <th onClick={() => onSort('spread')}>Spread</th>
       <th onClick={() => onSort('annualizedReturn')}>Annual Return</th>
       <th onClick={() => onSort('netReturn')}>Net Return</th>
       <th onClick={() => onSort('openInterest')}>Open Interest</th> {/* 新增 */}
     </tr>
   </thead>
   <tbody>
     {sortedSymbols.map(symbol => {
       const rate = ratesMap.get(symbol);
       return rate ? (
         <tr key={symbol}>
           {/* ... 現有欄位 */}
           <td>{formatOI(rate.openInterest)}</td> {/* 新增 */}
         </tr>
       ) : null;
     })}
   </tbody>

   // 格式化函式
   function formatOI(oi: number | undefined): string {
     if (!oi) return 'N/A';
     if (oi >= 1e9) return `$${(oi / 1e9).toFixed(2)}B`;
     if (oi >= 1e6) return `$${(oi / 1e6).toFixed(2)}M`;
     if (oi >= 1e3) return `$${(oi / 1e3).toFixed(2)}K`;
     return `$${oi.toFixed(0)}`;
   }
   ```

5. **WebSocket 事件更新**（`src/services/MonitorService.ts`）:
   ```typescript
   // 在 WebSocket 更新事件中包含 OI 資料
   const ratesUpdate: RatesUpdateEvent = {
     type: 'rates:update',
     data: {
       rates: currentRates.map(rate => ({
         ...rate,
         openInterest: oiCache.get(rate.symbol)?.openInterestUSD,  // 從快取獲取
       })),
     },
   };

   wsServer.broadcast(JSON.stringify(ratesUpdate));
   ```

### Alternatives Considered

1. **建立獨立的 OI 顯示元件**
   - 優點：職責分離，OI 資料獨立管理
   - 缺點：增加複雜度，與現有表格分離
   - **拒絕原因**：整合到現有 RatesTable 更一致

2. **使用獨立的 WebSocket 事件傳送 OI**
   - 優點：OI 更新頻率可獨立控制
   - 缺點：前端需要處理兩個資料源
   - **拒絕原因**：OI 與 rates 同步更新即可，無需獨立事件

## Decision 5: 錯誤處理和重試

### Decision
使用 **exponential backoff** 重試機制處理 API 錯誤，特別針對 HTTP 429 (rate limit) 和網路錯誤。

### Rationale

**錯誤場景**：
1. **HTTP 429 Too Many Requests**: 觸發速率限制
2. **Network Timeout**: 網路延遲或中斷
3. **HTTP 5xx**: Binance 服務異常
4. **Invalid Response**: API 回應格式錯誤

**重試策略**：
```typescript
import axios, { AxiosError } from 'axios';

interface RetryOptions {
  maxRetries: number;
  baseDelay: number;  // ms
  maxDelay: number;   // ms
}

async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = { maxRetries: 3, baseDelay: 1000, maxDelay: 30000 }
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // 判斷是否應該重試
      if (!shouldRetry(error, attempt, options.maxRetries)) {
        throw error;
      }

      // 計算延遲時間（exponential backoff）
      const delay = Math.min(
        options.baseDelay * Math.pow(2, attempt),
        options.maxDelay
      );

      logger.warn({
        attempt: attempt + 1,
        maxRetries: options.maxRetries,
        delay,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'API call failed, retrying...');

      await sleep(delay);
    }
  }

  throw lastError!;
}

function shouldRetry(error: any, attempt: number, maxRetries: number): boolean {
  // 超過最大重試次數
  if (attempt >= maxRetries) return false;

  // 不是 Axios 錯誤
  if (!axios.isAxiosError(error)) return false;

  const axiosError = error as AxiosError;

  // HTTP 429 (rate limit) - 應該重試
  if (axiosError.response?.status === 429) return true;

  // HTTP 5xx (server error) - 應該重試
  if (axiosError.response?.status && axiosError.response.status >= 500) return true;

  // Network timeout - 應該重試
  if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT') return true;

  // 其他錯誤 - 不重試
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 使用範例
const response = await fetchWithRetry(() =>
  axios.get('https://fapi.binance.com/fapi/v1/openInterest', {
    params: { symbol: 'BTCUSDT' },
    timeout: 5000,
  })
);
```

**日誌記錄**：
```typescript
// 成功
logger.info({
  symbol,
  openInterest: data.openInterest,
  duration: Date.now() - startTime,
}, 'Fetched Open Interest successfully');

// 失敗
logger.error({
  symbol,
  error: error.message,
  statusCode: error.response?.status,
  attempt,
  maxRetries,
}, 'Failed to fetch Open Interest');

// 快取命中
logger.debug({
  cacheKey,
  ttl: CACHE_TTL,
}, 'OI cache hit');
```

### Alternatives Considered

1. **使用 retry 套件（如 async-retry）**
   - 優點：成熟的重試邏輯，支援多種策略
   - 缺點：增加依賴
   - **拒絕原因**：自實作足夠簡單且可控

2. **固定延遲重試**
   - 優點：實作簡單
   - 缺點：可能持續觸發速率限制
   - **拒絕原因**：exponential backoff 更符合 API 最佳實踐

## Best Practices Summary

### Performance Optimization
1. **並行請求控制**：使用 p-limit 限制並行 API 呼叫數（10 個）
2. **批次操作**：一次獲取所有價格，避免逐個查詢
3. **快取機制**：15 分鐘 TTL，減少 95% 的 API 呼叫

### Error Handling
1. **Retry with exponential backoff**：處理暫時性錯誤
2. **Graceful degradation**：若 OI 無法獲取，記錄警告但不中斷流程
3. **Structured logging**：所有關鍵操作記錄到 Pino

### Testing Strategy
1. **Unit Tests**：
   - BinanceConnector.getTopSymbolsByOI()
   - SimpleCache TTL 機制
   - sortComparator with openInterest field

2. **Integration Tests**：
   - Mock Binance API responses
   - 測試 API 錯誤處理和重試
   - 測試快取機制

3. **E2E Tests**：
   - CLI `--auto-fetch --top 50` 成功啟動
   - Web 介面顯示 OI 欄位並可排序

## Implementation Checklist

- [ ] 擴展 BinanceConnector 支援 OI API
- [ ] 實作 SimpleCache 快取機制
- [ ] 修改 CLI start command 支援 `--top` 參數
- [ ] 整合 OI 排序到 fetchAvailableSymbols()
- [ ] 擴展 Web 前端型別定義（SortField, MarketRate）
- [ ] 修改 RatesTable 新增 OI 欄位
- [ ] 更新 WebSocket 事件包含 OI 資料
- [ ] 實作錯誤處理和重試邏輯
- [ ] 撰寫 unit tests
- [ ] 撰寫 integration tests
- [ ] 撰寫 E2E tests
- [ ] 更新文檔（README, quickstart.md）
