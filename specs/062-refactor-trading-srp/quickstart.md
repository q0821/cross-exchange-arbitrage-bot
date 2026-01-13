# Quickstart: 重構交易服務以符合單一職責原則

**Feature**: 062-refactor-trading-srp
**Branch**: `062-refactor-trading-srp`

## 概述

本功能將 `PositionOrchestrator` 和 `PositionCloser` 中過長的 `createCcxtTraderAsync` 方法重構為 5 個獨立服務。

## 前置需求

- Node.js 20.x LTS
- pnpm 8.x+
- PostgreSQL 15+ with TimescaleDB
- 現有專案環境已設定完成

## 開發環境設定

```bash
# 切換到功能分支
git checkout 062-refactor-trading-srp

# 安裝依賴
pnpm install

# 確認現有測試通過
pnpm test
```

## 新增服務概覽

| 服務 | 檔案路徑 | 職責 |
|------|----------|------|
| BinanceAccountDetector | `src/services/trading/BinanceAccountDetector.ts` | 偵測 Binance 帳戶類型和持倉模式 |
| CcxtExchangeFactory | `src/services/trading/CcxtExchangeFactory.ts` | 創建和配置 CCXT 交易所實例 |
| ContractQuantityConverter | `src/services/trading/ContractQuantityConverter.ts` | 合約數量轉換 |
| OrderParamsBuilder | `src/services/trading/OrderParamsBuilder.ts` | 建構不同交易所的訂單參數 |
| OrderPriceFetcher | `src/services/trading/OrderPriceFetcher.ts` | 獲取訂單成交價格（含 fallback） |

## 重構策略

### Phase 1: 提取共用服務（低風險）

1. **BinanceAccountDetector**
   - 從兩個檔案中提取重複的 `detectBinanceAccountType` 方法
   - 先寫單元測試，再提取

2. **ContractQuantityConverter**
   - 提取純函數邏輯
   - 無狀態，易於測試

### Phase 2: 提取工廠和建構器（中風險）

3. **CcxtExchangeFactory**
   - 封裝交易所配置邏輯
   - 整合 BinanceAccountDetector

4. **OrderParamsBuilder**
   - 提取不同交易所的參數格式處理

### Phase 3: 提取價格服務（中風險）

5. **OrderPriceFetcher**
   - 提取價格獲取和 fallback 邏輯
   - 需處理非同步重試

### Phase 4: 整合與驗證

6. 更新 PositionOrchestrator 和 PositionCloser 使用新服務
7. 執行所有測試驗證行為不變

## 介面定義

介面定義位於 `specs/062-refactor-trading-srp/contracts/interfaces.ts`。

主要介面：

```typescript
// Binance 帳戶偵測
interface IBinanceAccountDetector {
  detect(ccxtExchange: unknown): Promise<BinanceAccountInfo>;
}

// 交易所工廠
interface ICcxtExchangeFactory {
  create(exchange: SupportedExchange, config: ExchangeConfig): Promise<ExchangeInstance>;
}

// 合約數量轉換
type ContractQuantityConverterFn = (
  ccxtExchange: unknown,
  symbol: string,
  amount: number
) => number;

// 訂單參數建構
interface IOrderParamsBuilder {
  buildOpenParams(exchange, side, hedgeMode): OrderParams;
  buildCloseParams(exchange, side, hedgeMode): OrderParams;
}

// 價格獲取
interface IOrderPriceFetcher {
  fetch(ccxtExchange, orderId, symbol, initialPrice?): Promise<FetchPriceResult>;
}
```

## 測試指南

### 單元測試結構

```
tests/unit/services/trading/
├── BinanceAccountDetector.test.ts
├── CcxtExchangeFactory.test.ts
├── ContractQuantityConverter.test.ts
├── OrderPriceFetcher.test.ts
└── OrderParamsBuilder.test.ts
```

### 執行測試

```bash
# 執行所有測試
pnpm test

# 執行特定服務測試
pnpm test tests/unit/services/trading/BinanceAccountDetector.test.ts

# 執行 E2E 測試驗證整合
pnpm test:e2e
```

## 驗收標準

- [ ] `createCcxtTraderAsync` 行數 < 50 行
- [ ] 不存在重複的 `detectBinanceAccountType` 實作
- [ ] 所有現有 E2E 測試通過
- [ ] 每個新服務都有對應的單元測試

## 風險緩解

1. **漸進式重構**：每個服務單獨提取、測試、合併
2. **保持 API 相容**：公開 API 不變
3. **E2E 驗證**：每階段完成後執行現有 E2E 測試
4. **回滾策略**：使用 feature branch，問題時可快速回滾

## 擴展指南：新增交易所

重構後的架構支援輕鬆新增交易所（如 Bybit）而不需修改 PositionOrchestrator 或 PositionCloser。

### 新增交易所的步驟

#### 1. 更新 SupportedExchange 類型

在 `src/types/trading.ts` 中新增交易所：

```typescript
// 新增 'bybit' 到 SupportedExchange
export type SupportedExchange = 'binance' | 'okx' | 'mexc' | 'gateio' | 'bingx' | 'bybit';
```

#### 2. 更新 CcxtExchangeFactory

在 `src/services/trading/CcxtExchangeFactory.ts` 的 `exchangeMap` 中新增：

```typescript
const exchangeMap: Record<SupportedExchange, string> = {
  binance: 'binance',
  okx: 'okx',
  mexc: 'mexc',
  gateio: 'gateio',
  bingx: 'bingx',
  bybit: 'bybit',  // 新增
};
```

如果該交易所需要特殊配置（如 defaultType），在同一檔案中新增處理邏輯。

#### 3. 更新 OrderParamsBuilder

在 `src/services/trading/OrderParamsBuilder.ts` 中新增參數格式處理：

```typescript
// buildOpenParams 和 buildCloseParams 中新增
if (exchange === 'bybit') {
  // Bybit 的特殊參數格式
  const positionIdx = side === 'buy' ? 1 : 2; // Bybit 使用 positionIdx
  return { positionIdx };
}
```

#### 4. 測試驗證

```bash
# 執行所有測試確保沒有破壞現有功能
pnpm test
```

### 設計優勢

- **單一修改點**：新增交易所只需修改 CcxtExchangeFactory 和 OrderParamsBuilder
- **不需修改協調器**：PositionOrchestrator 和 PositionCloser 完全不需改動
- **類型安全**：TypeScript 會在 `SupportedExchange` 更新後自動提示需要處理的地方

## 參考文件

- [spec.md](./spec.md) - 功能規格
- [research.md](./research.md) - 研究決策
- [plan.md](./plan.md) - 實作計劃
- [contracts/interfaces.ts](./contracts/interfaces.ts) - 介面定義
