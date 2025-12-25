# Research: BingX 交易所整合

**Feature**: 043-bingx-integration
**Date**: 2025-12-25
**Status**: Complete

## 1. CCXT BingX 支援度

### Decision
使用 CCXT 4.x 內建的 BingX connector，完全支援永續合約交易。

### Rationale
- CCXT 官方完整支援 BingX 交易所
- 提供標準化介面：`fetchFundingRate`, `createOrder`, `fetchPositions`, `setLeverage` 等
- 與現有 Binance/OKX/Gate.io/MEXC connector 一致的模式

### Key Findings

#### 市場類型
- Swap 市場符號格式：`BTC/USDT:USDT`
- 設定 `defaultType: 'swap'` 啟用永續合約模式

#### 資金費率
```typescript
// 獲取單一交易對資金費率
const fundingRate = await bingx.fetchFundingRate('BTC/USDT:USDT');
// 回傳: { fundingRate, fundingTimestamp, nextFundingTimestamp, ... }

// 獲取所有資金費率
const fundingRates = await bingx.fetchFundingRates(['BTC/USDT:USDT', 'ETH/USDT:USDT']);
```

#### 槓桿設定
```typescript
// 設定槓桿（必須在下單前執行）
await bingx.setLeverage(10, 'BTC/USDT:USDT');

// 獲取當前槓桿
const leverage = await bingx.fetchLeverage('BTC/USDT:USDT');
```

#### 持倉模式
```typescript
// 設定雙向持倉模式
await bingx.setPositionMode(true, 'BTC/USDT:USDT'); // hedged

// 獲取持倉模式
const mode = await bingx.fetchPositionMode('BTC/USDT:USDT');
```

### Alternatives Considered
- **直接使用 BingX REST API**: 需自建連接器，增加維護成本
- **使用第三方 BingX SDK**: 不如 CCXT 穩定和標準化

---

## 2. 停損停利實作方式

### Decision
使用 CCXT 附加條件單模式（Attached Stop Loss / Take Profit）

### Rationale
- CCXT 支援在 `createOrder` 時附加 `stopLoss` 和 `takeProfit` 參數
- BingX API 原生支援這種模式
- 與現有其他交易所的條件單適配器模式一致

### Implementation Pattern

```typescript
// 開倉時附加停損停利
const order = await bingx.createOrder(
  'BTC/USDT:USDT',
  'market',
  'buy',
  0.001,
  undefined,
  {
    stopLoss: {
      triggerPrice: 85000, // 停損觸發價
      // price: 84900,    // 可選：限價（省略則為市價）
    },
    takeProfit: {
      triggerPrice: 95000, // 停利觸發價
    },
  }
);
```

### BingX Conditional Order Adapter

需建立 `BingxConditionalOrderAdapter.ts`，實作：
- `setStopLossOrder()`: 創建止損市價單
- `setTakeProfitOrder()`: 創建止盈市價單
- `cancelConditionalOrder()`: 取消條件單

### Alternatives Considered
- **分開建立條件單**: 增加 API 調用次數，時序複雜度高
- **使用 BingX 原生 API**: 失去 CCXT 抽象層優勢

---

## 3. 資金費率結算週期

### Decision
在 `FundingRateData` 介面中使用 `fundingInterval` 欄位記錄結算週期

### Rationale
- BingX 支援 1h、4h、8h 多種週期
- 需要正確計算年化報酬以便跨交易所比較
- 現有 `FundingRateData` 介面已有 `fundingInterval?: number` 欄位

### Annualization Calculation

```typescript
// 年化計算公式
const periodsPerYear = 24 * 365 / fundingInterval; // hours
const annualizedRate = fundingRate * periodsPerYear;

// 範例：
// 8h 週期: 24*365/8 = 1095 次/年
// 4h 週期: 24*365/4 = 2190 次/年
// 1h 週期: 24*365/1 = 8760 次/年
```

### Data Source
- `fetchFundingRate()` 回傳的 `fundingTimestamp` 和 `nextFundingTimestamp` 差值可推算週期
- 或從 `fetchMarkets()` 獲取市場配置中的週期資訊

---

## 4. API Key 權限需求

### Decision
區分監控用 API Key（.env，讀取權限）和交易用 API Key（資料庫，完整權限）

### Rationale
- 監控只需讀取權限，降低安全風險
- 交易需要完整權限，由用戶在 web 界面管理
- 與現有其他交易所的權限模式一致

### Permission Requirements

#### 監控用 API Key（.env 配置）
- `Read Only` 權限即可
- 用途：獲取價格、資金費率、市場數據

#### 交易用 API Key（資料庫儲存）
- `Trade` 權限（合約交易）
- `Read` 權限（餘額、持倉查詢）
- 用途：開平倉、停損停利、資產查詢

### Validation Strategy
```typescript
// 驗證監控權限
await bingx.fetchBalance(); // 或 fetchFundingRate

// 驗證交易權限
await bingx.fetchBalance();
await bingx.fetchPositions();
// 檢查 has['createOrder'] = true
```

---

## 5. 符號格式轉換

### Decision
使用 CCXT 統一格式 `BTC/USDT:USDT`，內部轉換為 BingX 格式

### Rationale
- CCXT 處理符號轉換，無需手動處理
- 與現有系統的符號格式一致

### Symbol Mapping

| 系統內部格式 | CCXT 格式 | BingX 原生格式 |
|-------------|-----------|---------------|
| BTCUSDT | BTC/USDT:USDT | BTC-USDT |
| ETHUSDT | ETH/USDT:USDT | ETH-USDT |

### Implementation
```typescript
// 轉換函數（擴展現有 convertSymbolForExchange）
export function convertSymbolForExchange(
  symbol: string,
  exchange: 'binance' | 'okx' | 'gateio' | 'mexc' | 'bingx',
): string {
  // ... 現有邏輯
  case 'bingx':
    // CCXT 會自動處理，返回統一格式
    return `${base}/${quote}:${quote}`;
}
```

---

## 6. 錯誤處理與限流

### Decision
複用現有的 `retryApiCall` 工具函數，新增 BingX 特定錯誤碼映射

### Rationale
- CCXT 已內建重試和錯誤處理
- 需要將 BingX 錯誤碼映射到系統內部錯誤類型

### Error Code Mapping

| BingX 錯誤 | 系統錯誤類型 | 處理方式 |
|-----------|-------------|---------|
| Rate limit | RateLimitError | 指數退避重試 |
| Insufficient balance | InsufficientBalanceError | 拋出，不重試 |
| Invalid API key | AuthenticationError | 拋出，提示用戶 |
| Order not found | OrderNotFoundError | 拋出，記錄日誌 |

### Rate Limits
- BingX API 限流：約 10 req/s
- CCXT `enableRateLimit: true` 自動處理

---

## 7. 資料模型擴展

### Decision
擴展現有 `ExchangeName` 類型，無需新增 Prisma 模型

### Rationale
- 現有 `ApiKey`、`Position`、`Trade` 模型已支援多交易所
- 只需在 `exchange` 欄位支援 `'bingx'` 值

### Changes Required

```typescript
// src/connectors/types.ts
export type ExchangeName = 'binance' | 'okx' | 'mexc' | 'gateio' | 'bingx';

// src/types/trading.ts
export type SupportedExchange = 'binance' | 'okx' | 'gateio' | 'mexc' | 'bingx';
```

---

## Summary

| 研究項目 | 結論 | 複雜度 |
|---------|------|--------|
| CCXT 支援 | ✅ 完整支援 | 低 |
| 停損停利 | ✅ 附加條件單模式 | 中 |
| 資金費率週期 | ✅ 使用 fundingInterval | 低 |
| API 權限 | ✅ 分離監控/交易權限 | 低 |
| 符號轉換 | ✅ CCXT 自動處理 | 低 |
| 錯誤處理 | ✅ 複用現有模式 | 低 |
| 資料模型 | ✅ 擴展現有類型 | 低 |

**整體評估**: BingX 整合難度低，可完全複用現有架構
