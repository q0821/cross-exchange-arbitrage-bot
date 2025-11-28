# Contract: OKX Native API

**Endpoint**: `/api/v5/public/funding-rate`
**Type**: Public REST API
**Purpose**: 備援方案，當 CCXT 無法提供資金費率間隔時使用

---

## 1. API 規範

### Base URL
```
Production: https://www.okx.com
```

### Endpoint
```
GET /api/v5/public/funding-rate
```

### Authentication
不需要（公開端點）

---

## 2. 請求格式

### Query Parameters

| 參數 | 類型 | 必填 | 說明 | 範例 |
|------|------|------|------|------|
| `instId` | String | Yes | 合約 ID | `BTC-USDT-SWAP` |

### instId 格式規範

OKX 合約 ID 格式：`{BASE}-{QUOTE}-SWAP`

**轉換範例**：
- 專案內部：`BTCUSDT` → OKX instId：`BTC-USDT-SWAP`
- 專案內部：`ETHUSDT` → OKX instId：`ETH-USDT-SWAP`
- 專案內部：`SOLUSDT` → OKX instId：`SOL-USDT-SWAP`

**轉換函數**（已實作於 `src/connectors/okx.ts`）：
```typescript
private toOkxInstId(symbol: string): string {
  const base = symbol.replace('USDT', '');
  return `${base}-USDT-SWAP`;
}
```

### Request Example

```bash
curl -X GET "https://www.okx.com/api/v5/public/funding-rate?instId=BTC-USDT-SWAP" \
  -H "Content-Type: application/json"
```

---

## 3. 回應格式

### Success Response (HTTP 200)

```json
{
  "code": "0",
  "msg": "",
  "data": [
    {
      "formulaType": "withRate",
      "fundingRate": "-0.0000440383848496",
      "fundingTime": "1764259200000",
      "impactValue": "20000.0000000000000000",
      "instId": "BTC-USDT-SWAP",
      "instType": "SWAP",
      "interestRate": "0.0001000000000000",
      "maxFundingRate": "0.00375",
      "method": "current_period",
      "minFundingRate": "-0.00375",
      "nextFundingRate": "",
      "nextFundingTime": "1764288000000",
      "premium": "-0.0005461795343571",
      "settFundingRate": "-0.0000481320193476",
      "settState": "settled",
      "ts": "1764232516515"
    }
  ]
}
```

### Response Fields

| 欄位 | 類型 | 說明 |
|------|------|------|
| `code` | String | 回應碼，`"0"` 表示成功 |
| `msg` | String | 錯誤訊息，成功時為空字串 |
| `data` | Array | 資金費率資料陣列 |
| `data[].instId` | String | 合約 ID |
| `data[].instType` | String | 合約類型（`SWAP` = 永續合約） |
| `data[].fundingRate` | String | 當前資金費率（數值型字串） |
| `data[].fundingTime` | String | 當前結算時間（Unix 毫秒時間戳） |
| `data[].nextFundingTime` | String | 下次結算時間（Unix 毫秒時間戳） |
| `data[].nextFundingRate` | String | 預測下次費率（通常為空字串） |
| `data[].maxFundingRate` | String | 最大費率上限 |
| `data[].minFundingRate` | String | 最小費率下限 |
| `data[].interestRate` | String | 利息率 |
| `data[].premium` | String | 溢價指數 |
| `data[].settFundingRate` | String | 已結算費率 |
| `data[].settState` | String | 結算狀態 |
| `data[].formulaType` | String | 計算公式類型 |
| `data[].method` | String | 計算方法 |
| `data[].impactValue` | String | 影響值 |
| `data[].ts` | String | 資料時間戳（Unix 毫秒） |

### 關鍵欄位（用於間隔計算）

```typescript
{
  fundingTime: "1764259200000",     // 必須存在
  nextFundingTime: "1764288000000", // 必須存在
}

// 計算間隔
const interval = (parseInt(nextFundingTime) - parseInt(fundingTime)) / 3600000;
// 範例：(1764288000000 - 1764259200000) / 3600000 = 8 小時
```

---

## 4. 錯誤回應

### Error Response Format

```json
{
  "code": "51001",
  "msg": "Instrument ID, Instrument ID code, or Spread ID doesn't exist.",
  "data": []
}
```

### Error Codes

| 錯誤碼 | 說明 | HTTP Status | 可重試 | 處理方式 |
|--------|------|-------------|--------|----------|
| `"0"` | 成功 | 200 | - | 正常處理 |
| `"51001"` | 合約 ID 不存在 | 200 | No | 檢查 instId 格式，返回錯誤 |
| `"50011"` | 超過限流 | 429 | Yes | 指數退避重試（最多 3 次） |
| `"50013"` | 系統繁忙 | 503 | Yes | 延遲後重試 |

### Error Handling Examples

```typescript
// 錯誤 1: 合約不存在
{
  "code": "51001",
  "msg": "Instrument ID, Instrument ID code, or Spread ID doesn't exist.",
  "data": []
}
// 處理：記錄錯誤，返回預設 8 小時

// 錯誤 2: 限流
{
  "code": "50011",
  "msg": "Too Many Requests",
  "data": []
}
// 處理：等待 1 秒後重試（指數退避）

// 錯誤 3: 系統繁忙
{
  "code": "50013",
  "msg": "System is busy, please try again later",
  "data": []
}
// 處理：等待 2 秒後重試
```

---

## 5. 限流規範

### Rate Limits

| 端點類型 | 限制 | 計算方式 |
|----------|------|----------|
| 公開端點 | 20 requests / 2 seconds | 基於 IP 位址 |

### Rate Limit Headers

OKX 可能在回應 header 中包含限流資訊（非必須）：

```
X-RateLimit-Limit: 20
X-RateLimit-Remaining: 18
X-RateLimit-Reset: 1732704002
```

### 限流策略建議

1. **批量請求分批處理**：
   ```typescript
   const BATCH_SIZE = 10;
   const BATCH_DELAY_MS = 200;

   for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
     const batch = symbols.slice(i, i + BATCH_SIZE);
     await Promise.allSettled(batch.map(fetchFundingRate));

     if (i + BATCH_SIZE < symbols.length) {
       await sleep(BATCH_DELAY_MS);
     }
   }
   ```

2. **指數退避重試**：
   ```typescript
   const delays = [1000, 2000, 4000]; // 1s, 2s, 4s

   for (let i = 0; i < delays.length; i++) {
     try {
       return await fetchFundingRate(symbol);
     } catch (error) {
       if (error.code === '50011' && i < delays.length - 1) {
         await sleep(delays[i]);
         continue;
       }
       throw error;
     }
   }
   ```

3. **快取結果**：
   ```typescript
   // 快取間隔資訊 24 小時
   const TTL = 24 * 60 * 60 * 1000;
   intervalCache.set('okx', symbol, interval, 'native-api', TTL);
   ```

---

## 6. 資料驗證規則

### Response Validation

```typescript
function validateOkxApiResponse(response: any): void {
  // 1. 檢查回應碼
  if (response.code !== '0') {
    throw new OkxApiError(response.code, response.msg);
  }

  // 2. 檢查資料陣列
  if (!Array.isArray(response.data) || response.data.length === 0) {
    throw new Error('Empty data array in OKX API response');
  }

  const data = response.data[0];

  // 3. 檢查必要欄位
  if (!data.fundingTime || !data.nextFundingTime) {
    throw new Error('Missing fundingTime or nextFundingTime in response');
  }

  // 4. 驗證時間戳格式
  const fundingTime = parseInt(data.fundingTime, 10);
  const nextFundingTime = parseInt(data.nextFundingTime, 10);

  if (isNaN(fundingTime) || isNaN(nextFundingTime)) {
    throw new Error('Invalid timestamp format');
  }

  // 5. 驗證時間戳順序
  if (nextFundingTime <= fundingTime) {
    throw new Error('nextFundingTime must be greater than fundingTime');
  }

  // 6. 驗證時間戳範圍（2020-2030）
  const MIN_TS = 1577836800000; // 2020-01-01
  const MAX_TS = 1893456000000; // 2030-01-01

  if (fundingTime < MIN_TS || fundingTime > MAX_TS ||
      nextFundingTime < MIN_TS || nextFundingTime > MAX_TS) {
    throw new Error('Timestamp out of reasonable range');
  }
}
```

---

## 7. 使用範例

### TypeScript Implementation

```typescript
import axios from 'axios';
import { logger } from '../lib/logger.js';

interface OkxFundingRateResult {
  fundingRate: number;
  fundingTime: Date;
  nextFundingTime: Date;
  interval: number; // 小時
}

async function fetchOkxFundingRate(
  symbol: string
): Promise<OkxFundingRateResult> {
  const instId = toOkxInstId(symbol);
  const baseUrl = 'https://www.okx.com';

  try {
    const response = await axios.get(`${baseUrl}/api/v5/public/funding-rate`, {
      params: { instId },
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // 驗證回應
    validateOkxApiResponse(response.data);

    const data = response.data.data[0];

    // 解析時間戳
    const fundingTime = parseInt(data.fundingTime, 10);
    const nextFundingTime = parseInt(data.nextFundingTime, 10);

    // 計算間隔
    const intervalMs = nextFundingTime - fundingTime;
    const intervalHours = intervalMs / 3600000;

    // 驗證間隔合理性
    const validatedInterval = validateAndRoundInterval(intervalHours);

    logger.info({
      symbol,
      instId,
      fundingRate: data.fundingRate,
      interval: validatedInterval.interval,
      source: 'native-api',
    }, 'Fetched OKX funding rate via Native API');

    return {
      fundingRate: parseFloat(data.fundingRate),
      fundingTime: new Date(fundingTime),
      nextFundingTime: new Date(nextFundingTime),
      interval: validatedInterval.interval,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.data?.code) {
        const code = error.response.data.code;
        const msg = error.response.data.msg;
        logger.error({ symbol, instId, code, msg }, 'OKX API error');
        throw new OkxApiError(code, msg);
      }

      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        logger.error({ symbol, instId }, 'OKX API request timeout');
        throw new Error('Request timeout');
      }
    }

    logger.error({ symbol, instId, error }, 'Failed to fetch OKX funding rate');
    throw error;
  }
}

function toOkxInstId(symbol: string): string {
  const base = symbol.replace('USDT', '');
  return `${base}-USDT-SWAP`;
}

class OkxApiError extends Error {
  constructor(public code: string, public msg: string) {
    super(`OKX API Error [${code}]: ${msg}`);
    this.name = 'OkxApiError';
  }
}
```

---

## 8. 整合測試案例

### Test Case 1: 成功獲取資金費率

**Request**:
```
GET /api/v5/public/funding-rate?instId=BTC-USDT-SWAP
```

**Expected Response**:
```json
{
  "code": "0",
  "data": [{
    "fundingTime": "1764259200000",
    "nextFundingTime": "1764288000000",
    ...
  }]
}
```

**Assertion**:
- `code === "0"`
- `data.length > 0`
- `interval === 8`（計算自時間戳）

### Test Case 2: 合約不存在

**Request**:
```
GET /api/v5/public/funding-rate?instId=INVALID-USDT-SWAP
```

**Expected Response**:
```json
{
  "code": "51001",
  "msg": "Instrument ID doesn't exist.",
  "data": []
}
```

**Assertion**:
- `code === "51001"`
- Error handler triggered
- Falls back to default interval (8)

### Test Case 3: 限流錯誤

**Request**:
```
GET /api/v5/public/funding-rate?instId=BTC-USDT-SWAP
(第 21 次請求在 2 秒內)
```

**Expected Response**:
```json
{
  "code": "50011",
  "msg": "Too Many Requests",
  "data": []
}
```

**Assertion**:
- Retry mechanism triggered
- Exponential backoff applied
- Request succeeds after delay

---

## 9. 效能指標

### Latency Targets

| 指標 | 目標值 | 測量方式 |
|------|--------|----------|
| P50 Latency | < 300ms | API 回應時間 |
| P95 Latency | < 800ms | API 回應時間 |
| P99 Latency | < 1500ms | API 回應時間 |
| Timeout | 5000ms | axios timeout 設定 |

### Throughput

- **批量查詢**：10 個交易對約 2-3 秒（含延遲）
- **單一查詢**：< 500ms（正常情況）
- **快取命中**：< 1ms

---

## 10. 版本相容性

### API Versioning

OKX API 當前版本：`v5`

**版本鎖定**：
- 端點 URL 明確指定 `/api/v5/`
- 如果未來有 v6，需要評估向下相容性

**監控變更**：
- 定期執行整合測試驗證 API 格式
- 監控 OKX 官方 Changelog
- 訂閱 OKX API 郵件通知

---

## 11. 安全考量

### API Key Requirements

- ✅ 無需 API Key（公開端點）
- ✅ 無需簽名驗證
- ✅ 無需 IP 白名單

### Rate Limit Protection

- 使用快取減少 API 請求
- 實作指數退避重試
- 批量請求分批處理

### Error Message Handling

- 不在日誌中暴露敏感資訊
- 錯誤訊息記錄到結構化日誌（Pino）
- 監控異常錯誤頻率

---

## 12. 參考文件

- **OKX API 官方文件**: https://www.okx.com/docs-v5/en/#public-data-rest-api-get-funding-rate
- **OKX API Changelog**: https://www.okx.com/docs-v5/en/#change-log
- **專案實作檔案**: `src/connectors/okx.ts`
- **整合測試**: `tests/integration/okx-funding-rate-validation.test.ts`

---

**Contract Version**: 1.0
**Last Updated**: 2025-01-27
**Status**: Final
