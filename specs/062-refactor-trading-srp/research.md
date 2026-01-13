# Research: 重構交易服務以符合單一職責原則

**Date**: 2026-01-13
**Feature**: 062-refactor-trading-srp

## 現有程式碼分析

### PositionOrchestrator.createCcxtTraderAsync 分析

**位置**: `src/services/trading/PositionOrchestrator.ts:769-1196`
**行數**: ~427 行

**識別的職責**:

1. **交易所實例創建** (L776-826)
   - 建立 CCXT 配置
   - 處理不同交易所的特殊設定（Binance future type, OKX passphrase）
   - 創建 CCXT 實例

2. **Binance 帳戶類型偵測** (L735-764, L811-826)
   - 偵測標準 vs Portfolio Margin 帳戶
   - 偵測 One-way vs Hedge Mode
   - 根據偵測結果重新配置實例

3. **市場資料載入** (L839-840)
   - 呼叫 `ccxtExchange.loadMarkets()`

4. **合約數量轉換** (L850-863)
   - 根據 `contractSize` 將用戶數量轉換為合約數量

5. **訂單參數建構** (L891-904, L1059-1076)
   - 根據交易所和持倉模式建構 `positionSide`/`posSide` 參數
   - 處理 Binance、OKX、BingX 的不同參數格式

6. **訂單執行** (L866-1046, L1049-1194)
   - `createMarketOrder` 邏輯
   - `closePosition` 邏輯
   - 錯誤處理和重試（-4061 錯誤）

7. **價格獲取** (L922-976, L1004-1033)
   - 優先使用 `order.average || order.price`
   - Fallback 1: `fetchOrder`
   - Fallback 2: `fetchMyTrades`

### PositionCloser.createCcxtTraderAsync 分析

**位置**: `src/services/trading/PositionCloser.ts:892-1209`
**行數**: ~317 行

**與 PositionOrchestrator 重複的職責**:

- Binance 帳戶類型偵測（完全重複）
- 交易所實例創建（幾乎相同）
- 合約數量轉換（完全相同）
- 訂單參數建構（幾乎相同）
- 價格獲取邏輯（幾乎相同）

**差異**:
- PositionCloser 只有 `closePosition`，沒有 `createMarketOrder`
- 日誌訊息略有不同（加入 "(PositionCloser)" 標記）

## 重構決策

### Decision 1: BinanceAccountDetector

**選擇**: 提取為獨立類別

**理由**:
- 完全重複的程式碼（兩個檔案各 ~30 行）
- 單一職責：只負責偵測 Binance 帳戶類型
- 可獨立測試（mock CCXT API 回應）

**替代方案考慮**:
- ❌ 保持內聯：無法消除重複
- ❌ 使用 mixin：TypeScript class 不支援多重繼承

### Decision 2: CcxtExchangeFactory

**選擇**: 提取為工廠類別

**理由**:
- 封裝交易所特定配置邏輯
- 支援未來新增交易所（Open/Closed Principle）
- 可注入 mock 實例進行測試

**替代方案考慮**:
- ❌ 簡單工廠函數：無法維護狀態（如 market cache）
- ❌ 抽象工廠模式：過度設計，目前只有一種產品類型

### Decision 3: ContractQuantityConverter

**選擇**: 提取為純函數工具

**理由**:
- 無狀態邏輯，適合純函數
- 可輕易進行單元測試
- 可在多處重用

**替代方案考慮**:
- ❌ 類別方法：無需維護狀態
- ❌ 內聯到 Factory：違反 SRP

### Decision 4: OrderParamsBuilder

**選擇**: 提取為建構器類別

**理由**:
- 封裝不同交易所的參數格式差異
- 支援 Binance/OKX/BingX 的 Hedge Mode 變體
- 可輕易擴展支援新交易所

**替代方案考慮**:
- ❌ 策略模式：過度設計，參數建構不需要運行時切換
- ❌ 配置映射：無法處理複雜的條件邏輯

### Decision 5: OrderPriceFetcher

**選擇**: 提取為服務類別

**理由**:
- 封裝複雜的重試和 fallback 邏輯
- 可獨立測試不同的 fallback 路徑
- 保持訂單執行邏輯簡潔

**替代方案考慮**:
- ❌ 內聯到訂單執行：違反 SRP，難以測試
- ❌ 使用裝飾器模式：TypeScript 支援有限

## 介面設計

### BinanceAccountDetector

```typescript
interface BinanceAccountInfo {
  isPortfolioMargin: boolean;
  isHedgeMode: boolean;
}

class BinanceAccountDetector {
  async detect(ccxtExchange: any): Promise<BinanceAccountInfo>
}
```

### CcxtExchangeFactory

```typescript
interface ExchangeConfig {
  apiKey: string;
  apiSecret: string;
  passphrase?: string;
  isTestnet: boolean;
}

interface ExchangeInstance {
  ccxt: any;  // CCXT 實例
  isPortfolioMargin: boolean;
  isHedgeMode: boolean;
  markets: Record<string, any>;
}

class CcxtExchangeFactory {
  async create(
    exchange: SupportedExchange,
    config: ExchangeConfig
  ): Promise<ExchangeInstance>
}
```

### ContractQuantityConverter

```typescript
function convertToContracts(
  ccxtExchange: any,
  symbol: string,
  amount: number
): number
```

### OrderParamsBuilder

```typescript
interface OrderParams {
  positionSide?: 'LONG' | 'SHORT';
  posSide?: 'long' | 'short';
  tdMode?: 'cross';
  reduceOnly?: boolean;
}

class OrderParamsBuilder {
  buildOpenParams(
    exchange: SupportedExchange,
    side: 'buy' | 'sell',
    hedgeMode: HedgeModeConfig
  ): OrderParams

  buildCloseParams(
    exchange: SupportedExchange,
    side: 'buy' | 'sell',
    hedgeMode: HedgeModeConfig
  ): OrderParams
}
```

### OrderPriceFetcher

```typescript
interface FetchPriceResult {
  price: number;
  source: 'order' | 'fetchOrder' | 'fetchMyTrades';
}

class OrderPriceFetcher {
  async fetch(
    ccxtExchange: any,
    orderId: string,
    symbol: string,
    initialPrice?: number
  ): Promise<FetchPriceResult>
}
```

## 風險評估

| 風險 | 影響 | 機率 | 緩解措施 |
|------|------|------|----------|
| 重構引入 bug | 高 | 中 | 保持現有 E2E 測試通過；漸進式重構 |
| 效能下降 | 中 | 低 | 服務間呼叫增加微量開銷，可忽略 |
| API 不相容 | 高 | 低 | 只重構內部實作，公開 API 不變 |
| 測試覆蓋不足 | 中 | 中 | 為每個新服務撰寫單元測試 |

## 結論

本重構遵循以下原則：
1. **Extract Method** → 將大方法拆分為小方法
2. **Extract Class** → 將方法群組提取為獨立類別
3. **Dependency Injection** → 服務間透過依賴注入協作
4. **Single Responsibility** → 每個類別只有一個變更理由

預期成果：
- `createCcxtTraderAsync` 從 400+ 行減少到 <50 行
- 消除 ~100 行重複程式碼
- 提升單元測試可測性
