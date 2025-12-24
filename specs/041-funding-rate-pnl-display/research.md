# Research: 交易歷史資金費率損益顯示

**Feature**: 041-funding-rate-pnl-display
**Created**: 2025-12-24

## Research Summary

本研究解決如何從各交易所查詢持倉期間的資金費率收支歷史，以計算實際的 `fundingRatePnL`。

---

## Decision 1: 使用 CCXT 統一介面

### Decision
使用 CCXT 的 `fetchFundingHistory` 統一方法查詢各交易所的資金費率歷史。

### Rationale
1. CCXT 已經抽象各交易所 API 差異，提供統一的 `fetchFundingHistory(symbol, since, limit, params)` 介面
2. 專案已使用 CCXT 進行其他交易操作，保持一致性
3. 返回格式統一：`{ symbol, timestamp, amount, ... }`，其中 `amount` 為正表示收到、負表示支付

### Alternatives Considered
| 方案 | 優點 | 缺點 | 結論 |
|------|------|------|------|
| 直接調用各交易所 REST API | 完全控制 | 需自行處理各所差異、維護成本高 | ❌ 不採用 |
| 使用 CCXT 統一方法 | 統一介面、已有經驗 | 依賴 CCXT 版本 | ✅ 採用 |

---

## Decision 2: 各交易所 API 支援狀況

### Decision
Binance、OKX、Gate.io、MEXC 皆支援 CCXT `fetchFundingHistory` 方法。

### Research Findings

| Exchange | CCXT Method | Underlying API | Notes |
|----------|-------------|----------------|-------|
| Binance | `fetchFundingHistory()` | `GET /fapi/v1/income` (type=FUNDING_FEE) | 支援 `since`/`until` 時間範圍過濾 |
| OKX | `fetchFundingHistory()` | `GET /api/v5/account/bills` (type=8) | type=8 為資金費率 |
| Gate.io | `fetchFundingHistory()` | `GET /api/v4/futures/usdt/account_book` | type=fund |
| MEXC | `fetchFundingHistory()` | 支援，需確認具體 endpoint | 可能需要額外測試 |

### CCXT 返回格式

```typescript
interface FundingHistoryEntry {
  info: object;           // 交易所原始資料
  symbol: string;         // 統一市場符號，如 "BTC/USDT:USDT"
  code: string;           // 幣種代碼，如 "USDT"
  timestamp: number;      // 結算時間戳（毫秒）
  datetime: string;       // ISO 8601 格式
  id: string;             // 唯一識別碼
  amount: number;         // 金額：正=收到，負=支付
}
```

---

## Decision 3: 查詢時機與流程

### Decision
在 `PositionCloser.closePosition()` 成功平倉後、計算 PnL 前查詢資金費率歷史。

### Flow

```
PositionCloser.closePosition()
  │
  ├─ 1. 執行雙邊平倉 (longClose, shortClose)
  │
  ├─ 2. 查詢資金費率歷史 (新增)
  │     ├─ Long 邊: fetchFundingHistory(symbol, openedAt, closedAt)
  │     └─ Short 邊: fetchFundingHistory(symbol, openedAt, closedAt)
  │
  ├─ 3. 計算 fundingRatePnL = Long 邊累計 + Short 邊累計
  │
  └─ 4. 計算 PnL (現有，傳入 fundingRatePnL)
        └─ calculatePnL({ ..., fundingRatePnL })
```

### Rationale
1. 平倉成功後才查詢，確保時間範圍完整（closedAt 已確定）
2. 失敗不影響平倉結果（降級為 0）
3. 查詢在單一事務中完成，不需額外狀態管理

---

## Decision 4: 錯誤處理策略

### Decision
查詢失敗時降級處理：記錄警告日誌，`fundingRatePnL` 設為 0。

### Error Handling Matrix

| Scenario | Handling | fundingRatePnL |
|----------|----------|----------------|
| Long 邊查詢成功，Short 邊失敗 | 記錄警告，使用 Long 邊結果 | Long 邊金額 |
| 兩邊都失敗 | 記錄警告 | 0 |
| API Rate Limit | 記錄警告 | 0 |
| 返回空陣列 | 正常處理（無結算記錄） | 0 |

### Rationale
1. 資金費率查詢是**資訊增強**，非核心功能
2. 平倉交易已成功執行，不應因查詢失敗而回滾
3. 記錄警告讓用戶/運維可追蹤問題

---

## Decision 5: Symbol 格式轉換

### Decision
使用 CCXT 統一 symbol 格式（如 `BTC/USDT:USDT`）進行查詢。

### Symbol Mapping

| Internal Symbol | CCXT Symbol |
|-----------------|-------------|
| BTCUSDT | BTC/USDT:USDT |
| ETHUSDT | ETH/USDT:USDT |

### Implementation
複用現有的 `convertSymbolForExchange()` 函數或建立專用的轉換邏輯。

---

## Decision 6: 時間範圍處理

### Decision
使用 Position 的 `openedAt` 和 `closedAt` 作為查詢時間範圍。

### Considerations

1. **結算時間點判斷**：
   - 不需自行計算哪些結算點在時間範圍內
   - 交易所 API 會返回該時間範圍內的所有結算記錄
   - 如果沒有結算記錄，返回空陣列

2. **時間邊界**：
   - `since = openedAt.getTime()` (毫秒)
   - `params.until = closedAt.getTime()` (毫秒)

3. **空記錄處理**：
   - 若持倉期間未跨過結算時間點，返回空陣列
   - 空陣列 → fundingRatePnL = 0（正常情況）

---

## Decision 7: 服務架構

### Decision
創建獨立的 `FundingFeeQueryService` 類別封裝查詢邏輯。

### Class Design

```typescript
class FundingFeeQueryService {
  constructor(
    private prisma: PrismaClient,
    private apiKeyService: ApiKeyService
  ) {}

  /**
   * 查詢單一交易所的資金費率歷史
   */
  async queryFundingFees(
    exchange: SupportedExchange,
    symbol: string,
    startTime: Date,
    endTime: Date,
    userId: string
  ): Promise<Decimal>

  /**
   * 查詢雙邊的資金費率歷史並加總
   */
  async queryBilateralFundingFees(
    longExchange: SupportedExchange,
    shortExchange: SupportedExchange,
    symbol: string,
    startTime: Date,
    endTime: Date,
    userId: string
  ): Promise<{
    longFundingFee: Decimal;
    shortFundingFee: Decimal;
    totalFundingFee: Decimal;
  }>
}
```

### Rationale
1. 單一職責：專注資金費率查詢
2. 可測試：可獨立 mock 進行單元測試
3. 可複用：未來其他功能可能需要查詢資金費率歷史

---

## Decision 8: 交易所實例建立

### Decision
複用 `ConditionalOrderAdapterFactory` 的 CCXT 實例建立模式。

### Implementation
參考現有 `createCcxtExchange()` 方法建立已認證的 CCXT 實例：

```typescript
private async createCcxtExchange(
  exchange: SupportedExchange,
  userId: string
): Promise<ccxt.Exchange> {
  // 複用 ConditionalOrderAdapterFactory 的實作模式
  const apiKeyInfo = await this.apiKeyService.getApiKey(userId, exchange);
  return new ccxt[exchange]({
    apiKey: decrypt(apiKeyInfo.apiKey),
    secret: decrypt(apiKeyInfo.apiSecret),
    password: apiKeyInfo.passphrase ? decrypt(apiKeyInfo.passphrase) : undefined,
    options: { defaultType: 'swap' }
  });
}
```

---

## Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| API Rate Limit | 中 | 低 | 降級處理，記錄警告 |
| MEXC API 不穩定 | 中 | 低 | 針對 MEXC 增加重試邏輯 |
| 歷史記錄查詢時間過長 | 低 | 中 | 設定查詢超時 (5 秒) |

---

## References

- CCXT Documentation: https://docs.ccxt.com/#/?id=funding-history
- Binance Futures API: https://binance-docs.github.io/apidocs/futures/en/#get-income-history-user_data
- OKX API: https://www.okx.com/docs-v5/en/#trading-account-rest-api-get-bills-details-last-7-days
- Gate.io API: https://www.gate.io/docs/developers/futures/en/#query-account-book
