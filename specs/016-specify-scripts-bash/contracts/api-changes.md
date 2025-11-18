# API Contracts: 擴大交易對監控規模

**Feature**: 016-specify-scripts-bash | **Date**: 2025-11-18
**Status**: 無 API 變更

## Summary

此功能為純配置擴展，**不涉及任何 API 端點或 WebSocket 事件的修改**。現有的 API 會自動適應更多交易對，完全向後兼容。

---

## REST API (No Changes)

### GET /api/market-rates

**端點**: `GET /api/market-rates`

**狀態**: ✅ **無變更**

**現有行為**:
```typescript
// 從 RatesCache 獲取所有費率數據
const rates = ratesCache.getAll();

return NextResponse.json({
  rates,
  timestamp: new Date().toISOString(),
});
```

**擴展後行為**:
- ✅ 完全相同的邏輯
- ✅ `ratesCache.getAll()` 自動返回所有監控的交易對
- ✅ 響應陣列長度從 30 增加至 100

**響應範例** (結構不變，僅陣列長度改變):
```json
{
  "rates": [
    {
      "symbol": "BTCUSDT",
      "exchanges": {
        "binance": {
          "rate": 0.0001,
          "nextTime": "2025-11-18T08:00:00Z",
          "interval": "8h"
        },
        "okx": {
          "rate": 0.0002,
          "nextTime": "2025-11-18T08:00:00Z",
          "interval": "8h"
        },
        "mexc": {
          "rate": 0.00015,
          "nextTime": "2025-11-18T08:00:00Z",
          "interval": "8h"
        },
        "gateio": {
          "rate": 0.00018,
          "nextTime": "2025-11-18T08:00:00Z",
          "interval": "8h"
        }
      },
      "spreadPercent": 0.01,
      "bestPair": {
        "longExchange": "binance",
        "shortExchange": "okx",
        "spreadPercent": 0.01,
        "longRate": 0.0001,
        "shortRate": 0.0002
      },
      "updatedAt": "2025-11-18T07:55:23Z"
    }
    // ... 從 30 個擴展至 100 個
  ],
  "timestamp": "2025-11-18T07:55:23Z"
}
```

**向後兼容性**: ✅ **完全兼容**
- 前端程式碼使用 `.map()` 遍歷陣列，自動適應任意長度
- 無需修改任何 API 呼叫程式碼

---

### GET /api/market-stats

**端點**: `GET /api/market-stats`

**狀態**: ✅ **無變更**

**現有行為**:
```typescript
const stats = ratesCache.getStats(threshold);

return NextResponse.json(stats);
```

**擴展後行為**:
- ✅ 完全相同的邏輯
- ✅ `totalSymbols` 欄位從 30 變為 100
- ✅ 其他統計自動根據新數據計算

**響應範例** (結構不變，數值改變):
```json
{
  "totalSymbols": 100,        // 從 30 → 100
  "opportunityCount": 25,     // 預期增加
  "approachingCount": 15,
  "maxSpread": {
    "symbol": "HYPEUSDT",
    "spread": 1.2
  },
  "uptime": 3600,
  "lastUpdate": "2025-11-18T07:55:23Z"
}
```

**向後兼容性**: ✅ **完全兼容**
- 響應格式相同，僅數值改變
- 前端 UI 自動顯示新數值

---

## WebSocket Events (No Changes)

### Connection & Authentication

**事件**: `connection`, `authenticate`

**狀態**: ✅ **無變更**

**現有行為**: 維持不變

---

### `rates:update` Event

**事件**: `rates:update`

**狀態**: ✅ **無變更**

**現有 Payload 結構** (維持不變):
```typescript
{
  "type": "rates:update",
  "data": {
    "rates": [
      {
        "symbol": "BTCUSDT",
        "exchanges": { /* ... */ },
        "spreadPercent": 0.01,
        "bestPair": { /* ... */ },
        "updatedAt": "2025-11-18T07:55:23Z"
      }
      // ... 從 30 個擴展至 100 個
    ],
    "timestamp": "2025-11-18T07:55:23Z"
  }
}
```

**擴展後行為**:
- ✅ 事件名稱不變 (`rates:update`)
- ✅ Payload 結構不變
- ✅ 陣列長度從 30 增加至 100
- ✅ Payload 大小從 ~15KB 增加至 ~40KB

**效能影響**:
- Socket.io 預設支援 100KB+ payload，40KB 完全可接受
- 網路傳輸時間增加 ~10-20ms（可忽略）

**向後兼容性**: ✅ **完全兼容**
- 前端監聽器無需修改
- 自動處理更大的陣列

---

### `rates:subscribe` Event

**事件**: Client → Server

**狀態**: ✅ **無變更**

**現有行為**:
```typescript
// 客戶端訂閱
socket.emit('rates:subscribe');

// 伺服器回應所有費率
socket.emit('rates:update', { rates: ratesCache.getAll() });
```

**擴展後行為**: 完全相同

---

### `error` Event

**事件**: `error`

**狀態**: ✅ **無變更**

**現有 Payload**: 維持不變
```typescript
{
  "message": "Error message",
  "code": "ERROR_CODE"
}
```

---

## CLI Interface (No Changes)

### `pnpm update-oi-symbols`

**命令**: `OI_TOP_N=100 pnpm update-oi-symbols`

**狀態**: ✅ **現有命令，無變更**

**參數**:
- `OI_TOP_N` (環境變數): 選取 OI 前 N 名交易對
- 預設值: 30
- 新值: 100

**輸出格式** (維持不變):
```
🔄 開始更新 OI 交易對清單...

📊 抓取 OI 前 100 名交易對
✅ 已抓取 100 個交易對

📈 OI 前 10 名：
   1. BTCUSDT      $45.23B
   2. ETHUSDT      $12.45B
   ...

📝 變更摘要：
   總數量: 100
   新增: 70 個
   移除: 0 個

➕ 新增的交易對：
   XRPUSDT       $3.21B
   ADAUSDT       $2.15B
   ...

✅ 已更新 /path/to/config/symbols.json

⚠️  請重啟 Web 服務以套用新的監控清單：
   pnpm dev  或  pnpm start
```

---

### `pnpm dev` / `pnpm start`

**命令**: `pnpm dev` 或 `pnpm start`

**狀態**: ✅ **無變更**

**啟動行為**:
- ✅ 自動讀取 `config/symbols.json`
- ✅ 載入 `top100_oi` 群組
- ✅ 開始監控所有列出的交易對

**日誌輸出** (新增數量資訊):
```
[2025-11-18 08:00:00] INFO: FundingRateMonitor initialized
[2025-11-18 08:00:00] INFO: Monitoring 100 symbols across 4 exchanges
[2025-11-18 08:00:00] INFO: Update interval: 5 minutes
[2025-11-18 08:00:05] INFO: First update completed successfully
```

---

## Frontend UI (No Changes Required)

### Market Monitor Page

**路徑**: `/market-monitor`

**狀態**: ✅ **無需修改**

**現有實作** (`app/(dashboard)/market-monitor/page.tsx`):
```typescript
// 自動適應任意數量的交易對
{rates.map((rate) => (
  <RateRow key={rate.symbol} rate={rate} />
))}
```

**擴展後行為**:
- ✅ 自動渲染 100 個交易對
- ✅ 表格高度自動調整（或使用滾動）
- ✅ 無需修改 React 組件

**預估載入時間**:
- 初始載入: ~1.1 秒 (< 3 秒目標)
- WebSocket 更新: ~150ms

---

## Internal Service Interfaces (No Changes)

### FundingRateMonitor

**介面**: `src/services/monitor/FundingRateMonitor.ts`

**狀態**: ✅ **無變更**

**Constructor Signature** (維持不變):
```typescript
constructor(
  symbols: string[] = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],  // 預設值
  updateInterval = 5000,
  minSpreadThreshold = 0.005,
  isTestnet = false,
  options?: {
    validator?: IFundingRateValidator;
    enableValidation?: boolean;
    enablePriceMonitor?: boolean;
    enableArbitrageAssessment?: boolean;
    arbitrageCapital?: number;
    arbitrageConfig?: Partial<ArbitrageConfig>;
    exchanges?: ExchangeName[];
    timeBasis?: TimeBasis;
  }
)
```

**擴展後使用**:
```typescript
// CLI 從 config/symbols.json 讀取
const config = JSON.parse(readFileSync('config/symbols.json', 'utf-8'));
const symbols = config.groups.top100_oi.symbols;  // 100 個交易對

const monitor = new FundingRateMonitor(
  symbols,        // 從 30 → 100
  300000,         // 5 分鐘 (不變)
  0.005,          // 0.5% 閾值 (不變)
  false,          // 正式環境 (不變)
  { /* options */ }
);
```

---

### RatesCache

**介面**: `src/services/monitor/RatesCache.ts`

**狀態**: ✅ **無變更**

**Public Methods** (維持不變):
```typescript
class RatesCache {
  set(symbol: string, rate: FundingRatePair): void;
  setAll(rates: FundingRatePair[]): void;
  get(symbol: string): FundingRatePair | null;
  getAll(): FundingRatePair[];  // ✅ 自動返回所有快取的交易對
  getStats(threshold?: number): MarketStats;
  clear(): void;
  size(): number;  // ✅ 從 30 → 100
}
```

---

## Error Responses (No Changes)

### HTTP Error Codes

**狀態**: ✅ **無變更**

**現有錯誤響應** (維持不變):
```json
{
  "error": {
    "message": "Error message",
    "code": "ERROR_CODE",
    "details": {}
  }
}
```

**常見錯誤碼**:
- `500`: Internal Server Error (系統錯誤)
- `503`: Service Unavailable (監控服務未啟動)

---

## Rate Limiting (No Changes)

### API Rate Limits

**狀態**: ✅ **無變更**

**現有限制** (維持不變):
- 無特定速率限制（內部 API）
- 依賴交易所 API 速率限制（已驗證充足）

---

## Authentication & Authorization (No Changes)

**狀態**: ✅ **無變更**

**現有機制** (維持不變):
- WebSocket 認證流程相同
- API 端點權限相同（內部 API，無需認證）

---

## Deprecations & Breaking Changes

### 無任何 Breaking Changes

✅ **完全向後兼容**

- ❌ 無 API 端點移除
- ❌ 無欄位型別改變
- ❌ 無必填欄位新增
- ❌ 無行為變更

### 無需 API 版本升級

✅ **維持現有版本**

- API 版本: N/A (無版本號)
- WebSocket Protocol: 維持不變

---

## Testing Contracts

### 現有 API 測試 (維持有效)

**測試範例**:
```typescript
describe('GET /api/market-rates', () => {
  it('should return array of rates', async () => {
    const response = await fetch('/api/market-rates');
    const data = await response.json();

    expect(data.rates).toBeInstanceOf(Array);
    expect(data.rates.length).toBeGreaterThan(0);  // ✅ 從 30 → 100
    expect(data.rates[0]).toHaveProperty('symbol');
    expect(data.rates[0]).toHaveProperty('exchanges');
  });
});
```

**擴展後測試**:
- ✅ 所有現有測試仍有效
- ✅ 陣列長度斷言需更新（如有硬編碼 `30`）

---

## Migration & Rollback

### API 遷移計劃

✅ **無需遷移**

- 無 API 版本變更
- 無客戶端程式碼修改

### Rollback 策略

如需回滾至 30 個交易對：

```bash
# 選項 1: 從備份恢復配置
cp config/symbols.json.backup config/symbols.json

# 選項 2: 重新執行腳本
OI_TOP_N=30 pnpm update-oi-symbols

# 重啟服務
pnpm dev
```

✅ **無需 API 變更或資料庫回滾**

---

## Documentation Updates

### 需要更新的文件

1. **README.md** (選項性):
   - 更新監控交易對數量說明（30 → 100）
   - 無需更新 API 文件（無變更）

2. **quickstart.md** (本功能產出):
   - 管理員操作指南
   - 包含腳本執行和驗證步驟

3. **CHANGELOG.md** (選項性):
   - 記錄配置變更
   - 無需記錄 API 變更（無變更）

---

## Summary Table

| 項目 | 變更 | 向後兼容 | 說明 |
|------|------|----------|------|
| **REST API 端點** | ❌ 無 | ✅ 是 | 所有端點維持不變 |
| **API 請求格式** | ❌ 無 | ✅ 是 | 無參數變更 |
| **API 響應格式** | ❌ 無 | ✅ 是 | 僅陣列長度改變 |
| **WebSocket 事件** | ❌ 無 | ✅ 是 | Payload 結構不變 |
| **CLI 命令** | ❌ 無 | ✅ 是 | 現有命令支援參數調整 |
| **錯誤響應** | ❌ 無 | ✅ 是 | 錯誤格式不變 |
| **認證機制** | ❌ 無 | ✅ 是 | 認證流程不變 |
| **速率限制** | ❌ 無 | ✅ 是 | 限制規則不變 |

**總結**: ✅ 無任何 API 合約變更，完全向後兼容
