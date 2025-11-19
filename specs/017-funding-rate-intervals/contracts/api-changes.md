# API Contracts: 資金費率間隔動態獲取

**Feature**: 017-funding-rate-intervals | **Date**: 2025-11-19
**Status**: 無公開 API 變更

## Summary

此功能為**純內部邏輯修改**，不涉及任何公開 API 端點、WebSocket 事件或 CLI 命令的變更。所有修改僅限於內部 connector 實作和快取機制。

---

## REST API Endpoints (No Changes)

### 現有端點維持不變

**所有端點無需修改**：
- ✅ `GET /api/market-rates` - 返回標準化後的資金費率（已包含正確的標準化計算）
- ✅ `GET /api/market-stats` - 返回市場統計（間隔修復不影響統計邏輯）
- ✅ `GET /api/funding-history` - 返回歷史資金費率（資料庫已儲存標準化費率）

**Rationale**:
- 資料庫儲存的是**標準化後的費率**（統一至 8 小時基準）
- API 返回的數據格式與欄位完全相同
- 前端無需修改任何 API 呼叫程式碼

**Example Response** (格式不變):
```json
{
  "rates": [
    {
      "symbol": "BTCUSDT",
      "exchanges": {
        "binance": {
          "rate": 0.0001,
          "nextTime": "2025-11-19T08:00:00Z"
        },
        "okx": {
          "rate": 0.0002,
          "nextTime": "2025-11-19T08:00:00Z"
        }
      },
      "spreadPercent": 0.01,
      "updatedAt": "2025-11-19T07:55:00Z"
    }
  ],
  "timestamp": "2025-11-19T07:55:00Z"
}
```

---

## WebSocket Events (No Changes)

### `rates:update` Event

**Status**: ✅ **無變更**

**Payload 格式維持不變**:
```typescript
{
  "type": "rates:update",
  "data": {
    "rates": [
      {
        "symbol": "BTCUSDT",
        "exchanges": { /* ... */ },
        "spreadPercent": 0.01,
        "updatedAt": "2025-11-19T07:55:00Z"
      }
    ],
    "timestamp": "2025-11-19T07:55:00Z"
  }
}
```

**Rationale**: WebSocket 推送的是標準化後的費率，間隔修復不影響推送內容。

---

## CLI Commands (No Changes)

### Existing Commands

**所有 CLI 命令維持不變**：
- ✅ `pnpm monitor:start` - 啟動監控服務（內部邏輯修正，命令不變）
- ✅ `pnpm monitor:stop` - 停止監控服務
- ✅ `pnpm test` - 執行測試

**No New Commands**:
- ❌ 不新增任何 CLI 命令
- ❌ 不修改命令參數或選項

---

## Internal Connector Interface Changes

### Connector Method Additions (內部介面，非公開 API)

雖然此功能修改內部 connector 介面，但**不影響公開 API**：

**New Methods** (內部使用):
```typescript
// src/connectors/binance.ts
class BinanceConnector {
  /** 🆕 新增：獲取單一交易對的資金費率間隔 */
  async getFundingInterval(symbol: string): Promise<number>;

  /** 🆕 新增：批量獲取多個交易對的資金費率間隔 */
  async getFundingIntervals(symbols: string[]): Promise<Map<string, number>>;

  // 現有方法（內部實作修改，簽名不變）
  async getFundingRate(symbol: string): Promise<ExchangeRateData>;
  async getFundingRates(symbols: string[]): Promise<FundingRatePair[]>;
}
```

**Rationale**:
- 這些方法僅在 CLI 監控服務內部使用
- 不暴露至 Web API 或 WebSocket
- 符合 Constitution Principle VI（CLI vs Web 邊界）

---

## Data Model Changes

### ExchangeRateData Interface

**Type Definition** (內部型別，非 API 合約):
```typescript
export interface ExchangeRateData {
  rate: number;
  nextTime: string;
  fundingInterval?: number;  // 🆕 填充此欄位（原本為 undefined）
  timestamp?: number;
}
```

**Impact**:
- ✅ 欄位已存在於型別定義（optional `?`）
- ✅ 向後兼容（現有程式碼可繼續使用）
- ⚠️ 僅影響內部資料傳遞，不改變 API 響應

---

## Backward Compatibility

### API Version

**Current Version**: N/A (無版本號)
**After This Feature**: N/A (維持不變)

**No Version Bump Required**: 因為無 API 變更

### Breaking Changes

**None**: ✅ **完全向後兼容**

| 項目 | 變更 | 向後兼容 |
|------|------|---------|
| REST API 端點 | ❌ 無 | ✅ 是 |
| REST API 請求格式 | ❌ 無 | ✅ 是 |
| REST API 響應格式 | ❌ 無 | ✅ 是 |
| WebSocket 事件 | ❌ 無 | ✅ 是 |
| WebSocket Payload | ❌ 無 | ✅ 是 |
| CLI 命令 | ❌ 無 | ✅ 是 |
| 內部型別定義 | ⚠️ 欄位填充 | ✅ 是 (optional 欄位) |

---

## Database Schema Changes

**No Schema Changes**: ✅ 不涉及資料庫 schema 變更

**No Prisma Migration**: ✅ 不需要執行 `prisma migrate dev`

---

## Testing Contracts

### Existing Tests (Remain Valid)

所有現有的 API 測試仍然有效，無需修改：

```typescript
// 現有測試範例
describe('GET /api/market-rates', () => {
  it('should return array of rates', async () => {
    const response = await fetch('/api/market-rates');
    const data = await response.json();

    expect(data.rates).toBeInstanceOf(Array);
    expect(data.rates[0]).toHaveProperty('symbol');
    expect(data.rates[0]).toHaveProperty('exchanges');
    expect(data.rates[0]).toHaveProperty('spreadPercent');
    // ✅ 所有斷言仍然有效
  });
});
```

### New Internal Tests (Non-Public)

新增的測試僅驗證內部邏輯，不測試 API 合約：

```typescript
// 🆕 新增測試（內部 connector 測試）
describe('BinanceConnector.getFundingInterval', () => {
  it('should fetch 4h interval for BLZUSDT', async () => {
    const connector = new BinanceConnector();
    const interval = await connector.getFundingInterval('BLZUSDT');
    expect(interval).toBe(4);
  });
});
```

---

## Migration Guide

### For API Consumers (External Clients)

**Action Required**: ❌ **無需任何行動**

**Reason**: 無 API 變更，現有整合繼續運作。

### For Frontend Developers

**Action Required**: ❌ **無需修改任何程式碼**

**Reason**:
- API 響應格式不變
- WebSocket 事件格式不變
- 資金費率數據的準確性提升（透明於前端）

### For CLI Users

**Action Required**: ❌ **無需修改任何命令**

**Reason**: CLI 命令簽名不變，僅內部邏輯修正。

---

## Documentation Updates

### API Documentation

**No Updates Required**: ✅ 因為無 API 變更

### Internal Documentation

**Updates Required** (僅內部文件):
- ✅ 更新 `src/connectors/README.md`（如存在）說明新增的 `getFundingInterval()` 方法
- ✅ 更新 JSDoc 註釋於 connector 方法

---

## Monitoring & Observability

### New Log Events (Internal)

雖然不影響 API，但新增以下日誌事件（用於監控）：

```typescript
// 成功獲取間隔
logger.info({
  exchange: 'binance',
  symbol: 'BLZUSDT',
  interval: 4,
  source: 'api'
}, 'Funding interval fetched');

// 降級至預設值
logger.warn({
  exchange: 'okx',
  symbol: 'BTCUSDT',
  interval: 8,
  source: 'default'
}, 'Using default interval (API failed)');
```

**Rationale**: 提升可觀測性（Constitution Principle II），但不暴露至公開 API。

---

## Rollback Strategy

### How to Rollback

如需回滾此功能：

1. **Git Revert**:
   ```bash
   git revert <commit-hash>
   ```

2. **No Database Rollback Required**: 因為無 schema 變更

3. **No API Version Downgrade Required**: 因為無 API 變更

4. **Frontend/CLI No Changes Required**: 因為完全向後兼容

**Result**: 系統立即恢復至硬編碼 8 小時預設值（雖然會有 Binance 4h 合約的標準化誤差）。

---

## Security Considerations

### API Security

**No Changes**: ✅ 不涉及認證、授權或速率限制變更

### Data Privacy

**No Changes**: ✅ 不涉及使用者數據或敏感資訊變更

### External API Calls

**New Calls**:
- Binance `/fapi/v1/fundingInfo` (公開端點，無認證需求)
- MEXC/Gate.io 原生 API (若 CCXT 失敗時呼叫，公開端點)

**Security Review**: ✅ 所有呼叫使用 HTTPS，無需 API keys

---

## Summary

| 項目 | 狀態 | 說明 |
|------|------|------|
| **REST API 端點** | ✅ 無變更 | 所有端點維持不變 |
| **REST API 格式** | ✅ 無變更 | 請求/響應格式不變 |
| **WebSocket 事件** | ✅ 無變更 | 事件名稱和 Payload 不變 |
| **CLI 命令** | ✅ 無變更 | 所有命令簽名不變 |
| **資料庫 Schema** | ✅ 無變更 | 不需要 migration |
| **向後兼容** | ✅ 完全 | 無 breaking changes |
| **API 版本** | ✅ 維持 | 無需版本升級 |

**Conclusion**: ✅ 此功能為**純內部優化**，完全透明於 API 消費者，無需任何遷移或更新。

---

**Last Updated**: 2025-11-19
**Status**: Ready for Implementation
