# Research Document: OKX 資金費率標準化修復

**Feature**: 024-fix-okx-funding-normalization
**Date**: 2025-01-27
**Status**: Complete

## 研究摘要

本研究針對 OKX 資金費率間隔偵測失敗問題，調查了 CCXT info 物件結構、OKX Native API 規範、現有快取機制、以及最佳實踐。研究結果確認 CCXT 的 `info` 物件是可靠的，但需要增強錯誤處理和降級方案。

---

## 1. CCXT info 物件結構調查

### 決策：使用 CCXT info.fundingTime 和 info.nextFundingTime（可靠）

**調查發現**：
- ✅ CCXT 4.x 的 OKX connector 確實會在 `info` 物件中暴露 `fundingTime` 和 `nextFundingTime` 欄位
- ✅ 這些欄位是 OKX 原始 API 回應的完整保留，格式為毫秒級 Unix 時間戳字串
- ✅ 透過實際 API 測試驗證，欄位始終存在且可靠

**當前存取路徑**（`src/connectors/okx.ts` L113-116）：
```typescript
const info = (fundingRate as any).info;
const fundingTimeStr = info?.fundingTime;       // "1764259200000"
const nextFundingTimeStr = info?.nextFundingTime; // "1764288000000"
```

**已知失敗情況**：
1. 欄位不存在或為 null/undefined（實測罕見）
2. 時間戳解析失敗（parseInt 返回 NaN）
3. nextFundingTime ≤ fundingTime（邏輯錯誤）
4. 計算出的間隔為非正數
5. API 呼叫拋出異常（網路錯誤、超時等）

**現有降級機制**：
- 快取優先（如果快取存在，直接返回）
- 欄位檢查 → 數值驗證 → 間隔驗證
- 所有失敗情況統一降級至預設 8 小時

**為何選擇此方案**：
- CCXT 已經實作 OKX API 解析，無需重複工作
- info 物件保留原始 API 回應，資料完整性高
- 現有程式碼已經實作基礎邏輯，只需增強錯誤處理

**替代方案考慮**：
- ❌ 完全放棄 CCXT，只使用 Native API：會失去 CCXT 的多交易所抽象層和限流管理
- ✅ CCXT + Native API 混合模式：當 CCXT 失敗時降級到 Native API（採用）

**實作建議**：
1. 保持現有 CCXT 路徑作為主要方案
2. 增強日誌記錄，記錄原始時間戳和計算過程
3. 實作 Native API 作為備援降級路徑
4. 新增間隔合理性驗證層

---

## 2. OKX Native API 規範研究

### 決策：使用 `/api/v5/public/funding-rate` 作為 CCXT 降級方案

**API 端點規範**：
- **URL**: `https://www.okx.com/api/v5/public/funding-rate`
- **方法**: GET
- **認證**: 不需要（公開端點）
- **參數**: `instId` (必填) - 格式為 `BTC-USDT-SWAP`

**回應格式範例**：
```json
{
  "code": "0",
  "data": [{
    "instId": "BTC-USDT-SWAP",
    "fundingRate": "-0.0000441162021490",
    "fundingTime": "1764259200000",        // 當前收費時間（毫秒）
    "nextFundingTime": "1764288000000",    // 下次收費時間（毫秒）
    "nextFundingRate": "",                 // 通常為空
    "method": "current_period",
    "ts": "1764232457550"
  }],
  "msg": ""
}
```

**關鍵欄位**：
- `fundingTime`: 當前資金費率結算時間（毫秒 Unix 時間戳字串）
- `nextFundingTime`: 下次資金費率結算時間（毫秒 Unix 時間戳字串）
- 計算間隔：`(nextFundingTime - fundingTime) / 3600000` 小時

**限流政策**：
- 公開端點：20 requests / 2 seconds（基於 IP）
- 限流錯誤碼：`50011` - "Too Many Requests"
- 系統忙碌：`50013` - "System is busy, please try again later"

**錯誤碼處理**：
- `"0"`: 成功
- `"51001"`: 合約 ID 不存在（instId 格式錯誤）
- `"50011"`: 超過限流（需要重試）
- `"50013"`: 系統繁忙（需要延遲重試）

**instId 格式轉換**：
- 專案內部格式：`BTCUSDT`
- OKX instId 格式：`BTC-USDT-SWAP`
- 轉換邏輯（已在 `src/connectors/okx.ts` 實作）：
  ```typescript
  private toOkxInstId(symbol: string): string {
    const base = symbol.replace('USDT', '');
    return `${base}-USDT-SWAP`;
  }
  ```

**為何選擇此方案**：
- 公開端點，無需 API 金鑰
- 回應格式與 CCXT info 物件一致，可共用解析邏輯
- 專案已有基礎實作（`getFundingRateNative()` 方法）

**實作建議**：
1. 擴展現有 `getFundingRateNative()` 方法，返回 `nextFundingTime`
2. 實作錯誤碼專用處理方法
3. 實作重試邏輯（針對限流和系統繁忙錯誤）
4. 整合到 `getFundingInterval()` 的降級路徑中

**效能考量**：
- 使用 `intervalCache` 快取結果，避免重複 API 請求
- 批量請求時分批處理（每批 10 個，間隔 200ms）
- 設定合理的超時時間（建議 5 秒）

---

## 3. 時間戳格式標準確認

### 決策：統一使用毫秒級 Unix 時間戳

**OKX API 時間戳格式**：
- 格式：毫秒級 Unix 時間戳（字串型別）
- 範例：`"1764259200000"` → `2025-11-27T16:00:00.000Z`
- 精度：毫秒（13 位數字）

**CCXT info 物件時間戳格式**：
- 格式：與 OKX 原始 API 相同（毫秒級字串）
- 存取：`info.fundingTime`, `info.nextFundingTime`

**解析方式**：
```typescript
const fundingTime = parseInt(fundingTimeStr, 10);      // 毫秒時間戳（數值）
const fundingDate = new Date(fundingTime);             // Date 物件
const fundingISO = fundingDate.toISOString();          // ISO 8601 字串
```

**驗證邏輯**：
```typescript
// 1. 檢查是否為有效數值
if (isNaN(fundingTime) || isNaN(nextFundingTime)) {
  throw new Error('Invalid timestamp: not a number');
}

// 2. 檢查是否在合理範圍內（2020-2030 年）
const MIN_TIMESTAMP = 1577836800000; // 2020-01-01
const MAX_TIMESTAMP = 1893456000000; // 2030-01-01
if (fundingTime < MIN_TIMESTAMP || fundingTime > MAX_TIMESTAMP) {
  throw new Error('Timestamp out of reasonable range');
}

// 3. 檢查邏輯順序
if (nextFundingTime <= fundingTime) {
  throw new Error('nextFundingTime must be greater than fundingTime');
}
```

**為何選擇此方案**：
- OKX 官方 API 使用毫秒時間戳
- JavaScript Date 物件原生支援毫秒時間戳
- 與專案其他部分的時間處理保持一致

**注意事項**：
- OKX API 返回的時間戳是字串，需要 `parseInt()` 轉換
- 始終使用 `parseInt(str, 10)` 明確指定基數 10
- 時間戳精度為毫秒，但計算間隔時會轉換為小時

---

## 4. 間隔驗證演算法設計

### 決策：四捨五入到最接近的標準值，容差 ±0.5 小時

**OKX 支援的標準間隔**：
- 1 小時
- 4 小時
- 8 小時（最常見）

**驗證演算法**：
```typescript
function validateAndRoundInterval(calculatedHours: number): {
  interval: number;
  rounded: boolean;
  deviation: number;
} {
  const VALID_INTERVALS = [1, 4, 8];
  const TOLERANCE = 0.5; // ±0.5 小時容差

  // 1. 檢查是否為正數
  if (calculatedHours <= 0) {
    throw new Error(`Invalid interval: ${calculatedHours} (must be positive)`);
  }

  // 2. 找到最接近的標準值
  let closestInterval = VALID_INTERVALS[0];
  let minDeviation = Math.abs(calculatedHours - closestInterval);

  for (const validInterval of VALID_INTERVALS) {
    const deviation = Math.abs(calculatedHours - validInterval);
    if (deviation < minDeviation) {
      closestInterval = validInterval;
      minDeviation = deviation;
    }
  }

  // 3. 檢查是否在容差範圍內
  if (minDeviation > TOLERANCE) {
    logger.warn(
      { calculatedHours, closestInterval, deviation: minDeviation },
      'Calculated interval significantly deviates from standard values'
    );
  }

  // 4. 返回結果
  return {
    interval: closestInterval,
    rounded: minDeviation > 0.01, // 是否進行了四捨五入
    deviation: minDeviation,
  };
}
```

**測試案例**：
```typescript
validateAndRoundInterval(8.0)   // → { interval: 8, rounded: false, deviation: 0 }
validateAndRoundInterval(7.9)   // → { interval: 8, rounded: true, deviation: 0.1 }
validateAndRoundInterval(8.1)   // → { interval: 8, rounded: true, deviation: 0.1 }
validateAndRoundInterval(6.0)   // → { interval: 8, rounded: true, deviation: 2.0 } (warn)
validateAndRoundInterval(3.8)   // → { interval: 4, rounded: true, deviation: 0.2 }
validateAndRoundInterval(0)     // → Error: must be positive
validateAndRoundInterval(-1)    // → Error: must be positive
```

**為何選擇此方案**：
- 容錯性：允許時鐘偏移或計算誤差（±0.5 小時）
- 明確性：超過容差的異常值會記錄警告
- 實用性：OKX 只使用固定的標準間隔

**替代方案考慮**：
- ❌ 嚴格匹配（零容差）：會因為時鐘偏移導致過多失敗
- ❌ 直接四捨五入不驗證：可能接受完全錯誤的值（如 12 小時）
- ✅ 四捨五入 + 容差驗證 + 警告日誌（採用）

**實作位置**：
- 整合到 `src/connectors/okx.ts` 的 `getFundingInterval()` 方法
- 在計算出間隔後、快取前執行驗證

---

## 5. 重試策略最佳實踐

### 決策：指數退避 + 最大重試 3 次 + 可重試錯誤判斷

**重試策略設計**：
```typescript
async function retryableApiCall<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries: number;      // 最大重試次數（建議 3）
    initialDelayMs: number;  // 初始延遲（建議 1000ms）
    maxDelayMs: number;      // 最大延遲（建議 10000ms）
    backoffMultiplier: number; // 退避倍數（建議 2）
  }
): Promise<T> {
  const { maxRetries, initialDelayMs, maxDelayMs, backoffMultiplier } = options;
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // 檢查是否為可重試錯誤
      if (!isRetryableError(error)) {
        throw error;
      }

      // 最後一次嘗試，不再重試
      if (attempt === maxRetries) {
        break;
      }

      // 計算延遲時間（指數退避）
      const delay = Math.min(
        initialDelayMs * Math.pow(backoffMultiplier, attempt),
        maxDelayMs
      );

      logger.debug(
        { attempt: attempt + 1, maxRetries, delayMs: delay },
        'Retrying API call after error'
      );

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

function isRetryableError(error: any): boolean {
  // 網路錯誤（可重試）
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return true;
  }

  // OKX API 錯誤碼判斷
  if (error.response?.data?.code) {
    const code = error.response.data.code;
    return code === '50011' || // 限流
           code === '50013';    // 系統繁忙
  }

  return false;
}
```

**可重試錯誤類型**：
- ✅ 網路超時 (`ETIMEDOUT`, `ECONNABORTED`)
- ✅ OKX 限流 (`50011`)
- ✅ OKX 系統繁忙 (`50013`)
- ❌ 合約不存在 (`51001`) - 不可重試
- ❌ 資料格式錯誤 - 不可重試

**重試參數建議**：
- `maxRetries`: 3 次（總共 4 次嘗試）
- `initialDelayMs`: 1000ms（第一次重試延遲 1 秒）
- `maxDelayMs`: 10000ms（最大延遲 10 秒）
- `backoffMultiplier`: 2（指數增長）

**重試時序範例**：
```
嘗試 1: 立即執行 → 失敗（限流）
嘗試 2: 延遲 1s   → 失敗（限流）
嘗試 3: 延遲 2s   → 失敗（限流）
嘗試 4: 延遲 4s   → 成功 ✓
```

**為何選擇此方案**：
- 指數退避避免持續衝擊 API
- 最大重試 3 次平衡可靠性和延遲
- 可重試錯誤判斷避免無效重試

**專案現有實作**：
- 檔案：`src/lib/retry.js`（已實作基礎重試邏輯）
- 整合方式：包裝 `getFundingRateNative()` 和 `getFundingInterval()` 呼叫

---

## 6. 快取擴充需求評估

### 決策：最小化擴充 - 新增 getWithMetadata() 方法

**現有快取結構**（`src/lib/FundingIntervalCache.ts`）：
```typescript
export interface CachedInterval {
  interval: number;                           // 間隔值（小時）
  source: 'api' | 'calculated' | 'default';  // 偵測來源
  timestamp: number;                          // 快取建立時間（毫秒）
  ttl: number;                                // 存活時間（毫秒）
}
```

**評估結果**：
- ✅ **已支援偵測來源標記**（`source` 欄位）
- ✅ **已支援時間戳和過期驗證**（`timestamp` 和 `ttl`）
- ✅ **已有完整的單元測試覆蓋**
- ⚠️ `get()` 方法只返回 `interval` 數值，不返回來源資訊

**建議的擴充方案**：

1. **更新 `source` 類型定義**（與規格對齊）：
   ```typescript
   type IntervalSource = 'native-api' | 'calculated' | 'default';
   ```

2. **新增方法獲取完整元資料**：
   ```typescript
   interface CachedIntervalMetadata extends CachedInterval {
     exchange: string;
     symbol: string;
     isExpired: boolean;
     remainingTTL: number;
   }

   getWithMetadata(exchange: string, symbol: string): CachedIntervalMetadata | null;
   getAllWithMetadata(exchange?: string): CachedIntervalMetadata[];
   ```

3. **保持現有 API 向後相容**：
   - `get()` 方法行為不變（只返回 interval）
   - `set()` 方法簽名不變
   - 現有測試全部通過

**使用範例**：
```typescript
// 基本使用（向後相容）
const interval = cache.get('okx', 'BTCUSDT');
// 返回: 8

// 獲取完整元資料（新功能）
const metadata = cache.getWithMetadata('okx', 'BTCUSDT');
// 返回: {
//   interval: 8,
//   source: 'calculated',
//   timestamp: 1732704000000,
//   ttl: 86400000,
//   exchange: 'okx',
//   symbol: 'BTCUSDT',
//   isExpired: false,
//   remainingTTL: 82800000
// }

// 檢查偵測來源
if (metadata?.source === 'default') {
  logger.warn('Using default interval - detection may have failed');
}
```

**為何選擇此方案**：
- 最小化改動，保持向後相容性
- 滿足新需求（查詢偵測來源、驗證快取狀態）
- 不破壞現有測試和使用端程式碼

**不需要的變更**：
- ❌ 不修改 `CachedInterval` 介面結構
- ❌ 不改變現有的 TTL 機制（24 小時預設值合理）
- ❌ 不破壞 API 相容性

---

## 7. 診斷工具設計

### 決策：建立對比腳本 `scripts/test-okx-funding-interval.mjs`

**工具目標**：
1. 同時呼叫 CCXT 和 OKX Native API
2. 對比兩者返回的 fundingTime、nextFundingTime 和計算出的間隔
3. 突顯任何差異或異常
4. 提供清晰的表格輸出

**輸出格式設計**：
```
======================================
OKX Funding Interval Diagnostic Tool
======================================
Testing 10 symbols...

Symbol          | CCXT Interval | Native Interval | Match | Deviation
----------------|---------------|-----------------|-------|----------
BTC-USDT-SWAP   | 8h            | 8h              | ✓     | 0h
ETH-USDT-SWAP   | 8h            | 8h              | ✓     | 0h
SOL-USDT-SWAP   | 4h            | 4h              | ✓     | 0h
AVAX-USDT-SWAP  | 8h            | [ERROR]         | ✗     | N/A

Detailed Error for AVAX-USDT-SWAP:
  CCXT: fundingTime=1764259200000, nextFundingTime=1764288000000
  Native API: HTTP 429 - Too Many Requests

Summary:
  Total Tested: 10
  Matched: 9 (90%)
  Mismatched: 0 (0%)
  Errors: 1 (10%)

  Average Calculation Time:
    - CCXT: 245ms
    - Native API: 312ms
```

**實作範例**：
```javascript
// scripts/test-okx-funding-interval.mjs
import ccxt from 'ccxt';
import axios from 'axios';

const TEST_SYMBOLS = [
  'BTC-USDT-SWAP',
  'ETH-USDT-SWAP',
  'SOL-USDT-SWAP',
  'AVAX-USDT-SWAP',
  'BNB-USDT-SWAP',
  'ADA-USDT-SWAP',
  'DOGE-USDT-SWAP',
  'MATIC-USDT-SWAP',
  'DOT-USDT-SWAP',
  'UNI-USDT-SWAP',
];

async function testCCXT(symbol) {
  const startTime = Date.now();
  try {
    const exchange = new ccxt.okx({ enableRateLimit: true });
    const ccxtSymbol = symbol.replace('-SWAP', '').replace('-', '/') + ':USDT';
    const rate = await exchange.fetchFundingRate(ccxtSymbol);

    const fundingTime = parseInt(rate.info?.fundingTime);
    const nextFundingTime = parseInt(rate.info?.nextFundingTime);
    const interval = (nextFundingTime - fundingTime) / 3600000;

    return {
      success: true,
      interval: Math.round(interval),
      fundingTime,
      nextFundingTime,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      duration: Date.now() - startTime,
    };
  }
}

async function testNativeAPI(symbol) {
  const startTime = Date.now();
  try {
    const response = await axios.get(
      `https://www.okx.com/api/v5/public/funding-rate`,
      { params: { instId: symbol }, timeout: 5000 }
    );

    const data = response.data.data[0];
    const fundingTime = parseInt(data.fundingTime);
    const nextFundingTime = parseInt(data.nextFundingTime);
    const interval = (nextFundingTime - fundingTime) / 3600000;

    return {
      success: true,
      interval: Math.round(interval),
      fundingTime,
      nextFundingTime,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      duration: Date.now() - startTime,
    };
  }
}

async function runDiagnostic() {
  console.log('======================================');
  console.log('OKX Funding Interval Diagnostic Tool');
  console.log('======================================');
  console.log(`Testing ${TEST_SYMBOLS.length} symbols...\n`);

  const results = [];

  for (const symbol of TEST_SYMBOLS) {
    const ccxtResult = await testCCXT(symbol);
    await new Promise(resolve => setTimeout(resolve, 100)); // 避免限流
    const nativeResult = await testNativeAPI(symbol);

    results.push({
      symbol,
      ccxt: ccxtResult,
      native: nativeResult,
    });
  }

  // 輸出表格
  console.log('Symbol          | CCXT Interval | Native Interval | Match | Deviation');
  console.log('----------------|---------------|-----------------|-------|----------');

  let matched = 0, mismatched = 0, errors = 0;

  for (const result of results) {
    const { symbol, ccxt, native } = result;

    const ccxtInterval = ccxt.success ? `${ccxt.interval}h` : '[ERROR]';
    const nativeInterval = native.success ? `${native.interval}h` : '[ERROR]';

    let match = '✗';
    let deviation = 'N/A';

    if (ccxt.success && native.success) {
      const diff = Math.abs(ccxt.interval - native.interval);
      if (diff === 0) {
        match = '✓';
        matched++;
      } else {
        mismatched++;
      }
      deviation = `${diff}h`;
    } else {
      errors++;
    }

    console.log(
      `${symbol.padEnd(15)} | ${ccxtInterval.padEnd(13)} | ${nativeInterval.padEnd(15)} | ${match.padEnd(5)} | ${deviation}`
    );
  }

  // 總結
  console.log(`\nSummary:`);
  console.log(`  Total Tested: ${results.length}`);
  console.log(`  Matched: ${matched} (${Math.round(matched/results.length*100)}%)`);
  console.log(`  Mismatched: ${mismatched} (${Math.round(mismatched/results.length*100)}%)`);
  console.log(`  Errors: ${errors} (${Math.round(errors/results.length*100)}%)`);
}

runDiagnostic().catch(console.error);
```

**執行方式**：
```bash
# 執行診斷工具
node scripts/test-okx-funding-interval.mjs

# 預期執行時間：< 30 秒（10 個交易對，含延遲）
```

**為何選擇此方案**：
- 獨立腳本，不影響生產程式碼
- 清晰的表格輸出，易於理解
- 同時測試 CCXT 和 Native API，確保一致性
- 可快速驗證修復是否有效

---

## 8. 技術決策摘要

| 項目 | 決策 | 理由 |
|------|------|------|
| **主要資料來源** | CCXT info 物件 | 可靠且已有基礎實作 |
| **降級方案** | OKX Native API | 公開端點，無需認證 |
| **時間戳格式** | 毫秒級 Unix 時間戳 | OKX 官方格式，與專案其他部分一致 |
| **間隔驗證** | 四捨五入 + ±0.5h 容差 | 容錯性與準確性平衡 |
| **重試策略** | 指數退避，最多 3 次 | 標準最佳實踐 |
| **快取擴充** | 新增 getWithMetadata() | 最小化改動，保持相容性 |
| **診斷工具** | 獨立對比腳本 | 易於驗證和偵錯 |

---

## 9. 風險與緩解措施

| 風險 | 影響 | 緩解措施 |
|------|------|---------|
| CCXT 持續無法暴露時間戳 | 依賴 Native API 降級 | 實作自動化測試監控 CCXT 行為 |
| OKX API 格式變更 | Native API 降級失敗 | 整合測試持續驗證格式 |
| API 限流 | 批量初始化失敗 | 分批處理，快取結果 |
| 時鐘偏移 | 計算間隔略有誤差 | 使用容差驗證演算法 |
| 新交易對格式 | 偵測失敗 | 詳細日誌 + 預設值降級 |

---

## 10. 參考資料

- **OKX API 文件**: https://www.okx.com/docs-v5/en/#public-data-rest-api-get-funding-rate
- **CCXT GitHub Issues**:
  - #14392 - Question on fetch_funding_rate
  - #11298 - fundingRate, previousFundingRate and nextFundingRate
- **專案程式碼**:
  - `src/connectors/okx.ts` - OKX connector 實作
  - `src/lib/FundingIntervalCache.ts` - 間隔快取機制
  - `tests/unit/connectors/okx.test.ts` - OKX 單元測試
  - `tests/integration/okx-funding-rate-validation.test.ts` - OKX 整合測試

---

**Research Complete** ✅
**Next Phase**: Phase 1 - Design & Contracts (生成 data-model.md, contracts/, quickstart.md)
