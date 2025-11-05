# Data Model: 市場監控頁面交易所快速連結

**Feature**: 008-specify-scripts-bash
**Date**: 2025-11-06
**Purpose**: 定義資料結構和類型介面

## Overview

此功能主要為純前端 UI 增強，不涉及新的資料庫模型或後端 API。資料模型聚焦於 TypeScript interfaces 和 URL 映射配置。

## TypeScript Interfaces

### 1. ExchangeUrlConfig

定義交易所 URL 配置結構。

```typescript
/**
 * 交易所 URL 配置
 */
interface ExchangeUrlConfig {
  /** 交易所名稱 */
  exchange: 'binance' | 'okx' | 'mexc' | 'gateio';

  /** 基礎 URL 模板（使用 {symbol} 作為占位符） */
  urlTemplate: string;

  /** 符號格式轉換函數 */
  formatSymbol: (symbol: string) => string;
}
```

**Example**:
```typescript
{
  exchange: 'binance',
  urlTemplate: 'https://www.binance.com/zh-TC/futures/{symbol}',
  formatSymbol: (symbol) => symbol.replace('/', '') // BTC/USDT → BTCUSDT
}
```

### 2. ExchangeLinkProps

定義 ExchangeLink 元件的 props。

```typescript
/**
 * ExchangeLink 元件屬性
 */
interface ExchangeLinkProps {
  /** 交易所名稱 */
  exchange: 'binance' | 'okx' | 'mexc' | 'gateio';

  /** 交易對符號（格式: "BTC/USDT"） */
  symbol: string;

  /** 是否可用（如果交易所不支援此交易對，設為 false） */
  isAvailable?: boolean;

  /** 自訂 className（可選） */
  className?: string;

  /** 自訂 aria-label（可選，默認自動生成） */
  ariaLabel?: string;
}
```

### 3. UrlBuilderResult

定義 URL 生成函數的返回類型。

```typescript
/**
 * URL Builder 返回結果
 */
interface UrlBuilderResult {
  /** 完整的交易所 URL */
  url: string;

  /** 格式化後的交易對符號 */
  formattedSymbol: string;

  /** 是否為有效 URL */
  isValid: boolean;

  /** 錯誤訊息（如果 isValid 為 false） */
  error?: string;
}
```

## Constants & Configuration

### EXCHANGE_CONFIGS

交易所配置的常數映射。

```typescript
/**
 * 交易所 URL 配置映射
 * 集中管理所有交易所的 URL 模板和格式轉換規則
 */
const EXCHANGE_CONFIGS: Record<string, ExchangeUrlConfig> = {
  binance: {
    exchange: 'binance',
    urlTemplate: 'https://www.binance.com/zh-TC/futures/{symbol}',
    formatSymbol: (symbol) => {
      // BTC/USDT → BTCUSDT
      return symbol.replace('/', '');
    },
  },
  okx: {
    exchange: 'okx',
    urlTemplate: 'https://www.okx.com/zh-hant/trade-swap/{symbol}',
    formatSymbol: (symbol) => {
      // BTC/USDT → BTC-USDT-SWAP
      return symbol.replace('/', '-') + '-SWAP';
    },
  },
  mexc: {
    exchange: 'mexc',
    urlTemplate: 'https://futures.mexc.com/zh-TW/exchange/{symbol}',
    formatSymbol: (symbol) => {
      // BTC/USDT → BTC_USDT
      return symbol.replace('/', '_');
    },
  },
  gateio: {
    exchange: 'gateio',
    urlTemplate: 'https://www.gate.io/zh-tw/futures_trade/USDT/{symbol}',
    formatSymbol: (symbol) => {
      // BTC/USDT → BTC_USDT
      return symbol.replace('/', '_');
    },
  },
};
```

### SUPPORTED_EXCHANGES

支援的交易所列表。

```typescript
/**
 * 支援的交易所列表
 */
const SUPPORTED_EXCHANGES = ['binance', 'okx', 'mexc', 'gateio'] as const;

/**
 * 交易所類型（從常數陣列推導）
 */
type SupportedExchange = typeof SUPPORTED_EXCHANGES[number];
```

## Function Signatures

### getExchangeContractUrl

主要的 URL 生成函數。

```typescript
/**
 * 生成交易所合約頁面 URL
 *
 * @param exchange - 交易所名稱
 * @param symbol - 交易對符號（格式: "BTC/USDT"）
 * @returns URL Builder 結果
 *
 * @example
 * ```typescript
 * const result = getExchangeContractUrl('binance', 'BTC/USDT');
 * // result.url: "https://www.binance.com/zh-TC/futures/BTCUSDT"
 * // result.formattedSymbol: "BTCUSDT"
 * // result.isValid: true
 * ```
 */
function getExchangeContractUrl(
  exchange: string,
  symbol: string
): UrlBuilderResult;
```

### validateSymbolFormat

驗證交易對符號格式。

```typescript
/**
 * 驗證交易對符號格式是否有效
 *
 * @param symbol - 交易對符號
 * @returns 是否為有效格式（應為 "BASE/QUOTE" 格式）
 *
 * @example
 * ```typescript
 * validateSymbolFormat('BTC/USDT'); // true
 * validateSymbolFormat('BTCUSDT');  // false
 * validateSymbolFormat('BTC-USDT'); // false
 * ```
 */
function validateSymbolFormat(symbol: string): boolean;
```

## Component Structure

### ExchangeLink Component

```typescript
/**
 * ExchangeLink - 交易所連結元件
 *
 * 顯示一個可點擊的圖示，連結到交易所的合約頁面
 *
 * Features:
 * - 在新分頁開啟連結
 * - 顯示 Tooltip 提示
 * - 支援不可用狀態（灰色、不可點擊）
 * - 符合無障礙標準（keyboard navigation, screen reader）
 *
 * @example
 * ```tsx
 * <ExchangeLink
 *   exchange="binance"
 *   symbol="BTC/USDT"
 *   isAvailable={true}
 * />
 * ```
 */
export function ExchangeLink(props: ExchangeLinkProps): JSX.Element;
```

### 元件內部結構

```tsx
<Tooltip.Provider>
  <Tooltip.Root>
    <Tooltip.Trigger asChild>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "inline-flex items-center",
          "text-gray-500 hover:text-blue-600",
          "transition-colors duration-200",
          !isAvailable && "opacity-40 cursor-not-allowed pointer-events-none"
        )}
        aria-label={`前往 ${exchangeName} 查看 ${symbol}`}
      >
        <ExternalLink className="w-4 h-4" />
      </a>
    </Tooltip.Trigger>
    <Tooltip.Content>
      <p>前往 {exchangeName} 查看 {symbol}</p>
    </Tooltip.Content>
  </Tooltip.Root>
</Tooltip.Provider>
```

## Integration with Existing Components

### RateRow 元件修改

在 `RateRow.tsx` 中整合 ExchangeLink：

```tsx
// Before (現有程式碼)
<div className="text-sm">
  {rate.toFixed(4)}%
</div>

// After (新增 ExchangeLink)
<div className="flex items-center gap-1">
  <span className="text-sm">{rate.toFixed(4)}%</span>
  <ExchangeLink
    exchange="binance"
    symbol={symbol}
    isAvailable={rate !== null && rate !== undefined}
  />
</div>
```

## Validation Rules

### Symbol Format Validation

交易對符號必須符合以下規則：

1. **格式**: `BASE/QUOTE`（使用斜線分隔）
2. **BASE**: 1-10 個大寫字母或數字（例如：BTC, ETH, SOL）
3. **QUOTE**: 通常為 USDT（但支援其他如 BUSD, USDC）
4. **範例**:
   - ✅ `BTC/USDT`
   - ✅ `ETH/USDT`
   - ✅ `1000PEPE/USDT`
   - ❌ `BTCUSDT`（缺少斜線）
   - ❌ `btc/usdt`（應為大寫）

**Regex Pattern**:
```typescript
const SYMBOL_PATTERN = /^[A-Z0-9]{1,10}\/[A-Z]{3,10}$/;
```

### Exchange Name Validation

交易所名稱必須是支援列表中的其中一個：

```typescript
function validateExchange(exchange: string): boolean {
  return SUPPORTED_EXCHANGES.includes(exchange as SupportedExchange);
}
```

## Error Handling

### URL Generation Errors

```typescript
// 錯誤場景 1: 不支援的交易所
getExchangeContractUrl('unknown', 'BTC/USDT');
// Returns: { url: '', formattedSymbol: '', isValid: false, error: 'Unsupported exchange: unknown' }

// 錯誤場景 2: 無效的符號格式
getExchangeContractUrl('binance', 'BTCUSDT');
// Returns: { url: '', formattedSymbol: '', isValid: false, error: 'Invalid symbol format: BTCUSDT' }

// 錯誤場景 3: 空字串
getExchangeContractUrl('binance', '');
// Returns: { url: '', formattedSymbol: '', isValid: false, error: 'Symbol cannot be empty' }
```

### Component Error States

```tsx
// ExchangeLink 元件內部錯誤處理
if (!isAvailable || !urlResult.isValid) {
  return (
    <span
      className="inline-flex items-center opacity-40 cursor-not-allowed"
      aria-label="此交易所不支援此交易對"
    >
      <ExternalLink className="w-4 h-4 text-gray-400" />
    </span>
  );
}
```

## Testing Data Structures

### Mock Data for Tests

```typescript
/**
 * 測試用的模擬資料
 */
export const MOCK_EXCHANGE_LINKS = {
  validCases: [
    { exchange: 'binance', symbol: 'BTC/USDT', expectedUrl: 'https://www.binance.com/zh-TC/futures/BTCUSDT' },
    { exchange: 'okx', symbol: 'ETH/USDT', expectedUrl: 'https://www.okx.com/zh-hant/trade-swap/ETH-USDT-SWAP' },
    { exchange: 'mexc', symbol: 'SOL/USDT', expectedUrl: 'https://futures.mexc.com/zh-TW/exchange/SOL_USDT' },
    { exchange: 'gateio', symbol: 'BNB/USDT', expectedUrl: 'https://www.gate.io/zh-tw/futures_trade/USDT/BNB_USDT' },
  ],
  invalidCases: [
    { exchange: 'unknown', symbol: 'BTC/USDT', expectedError: 'Unsupported exchange' },
    { exchange: 'binance', symbol: 'BTCUSDT', expectedError: 'Invalid symbol format' },
    { exchange: 'binance', symbol: '', expectedError: 'Symbol cannot be empty' },
  ],
};
```

## Database Models

**無需新增資料庫模型**。此功能為純前端 UI 增強，不涉及資料持久化。

## API Contracts

**無需新增 API 端點**。所有邏輯在前端完成。

## Dependencies

### New Dependencies

```json
{
  "@radix-ui/react-tooltip": "^1.0.0"
}
```

### Existing Dependencies (Reused)

- `lucide-react`: ExternalLink 圖示
- `tailwind-merge`: className 合併
- `clsx`: 條件樣式

## File Structure

```
src/
├── lib/
│   └── exchanges/
│       ├── url-builder.ts          # URL 生成邏輯（新增）
│       ├── url-builder.test.ts     # 單元測試（新增）
│       └── constants.ts             # 交易所配置常數（新增）
│
├── components/
│   └── market/
│       ├── ExchangeLink.tsx        # 連結元件（新增）
│       └── ExchangeLink.test.tsx   # 元件測試（新增）
│
app/
└── (dashboard)/
    └── market-monitor/
        └── components/
            └── RateRow.tsx          # 修改：整合 ExchangeLink

tests/
└── e2e/
    └── market-monitor-exchange-links.spec.ts  # E2E 測試（新增）
```

## Type Exports

```typescript
// src/lib/exchanges/index.ts
export type {
  ExchangeUrlConfig,
  ExchangeLinkProps,
  UrlBuilderResult,
  SupportedExchange,
};

export {
  getExchangeContractUrl,
  validateSymbolFormat,
  validateExchange,
  SUPPORTED_EXCHANGES,
  EXCHANGE_CONFIGS,
};

// src/components/market/index.ts
export { ExchangeLink } from './ExchangeLink';
export type { ExchangeLinkProps } from './ExchangeLink';
```

## Accessibility Annotations

### ARIA Labels

```typescript
// 動態生成 ARIA label
const ariaLabel = `前往 ${exchangeDisplayName} 查看 ${symbol} 永續合約`;

// 交易所顯示名稱映射
const EXCHANGE_DISPLAY_NAMES: Record<SupportedExchange, string> = {
  binance: 'Binance',
  okx: 'OKX',
  mexc: 'MEXC',
  gateio: 'Gate.io',
};
```

### Keyboard Navigation

```typescript
// 確保連結可通過 Tab 鍵訪問
<a
  href={url}
  target="_blank"
  rel="noopener noreferrer"
  tabIndex={isAvailable ? 0 : -1}  // 不可用時禁用 Tab 訪問
  className={focusStyles}           // 提供 focus indicator
>
  <ExternalLink />
</a>
```

## Performance Metrics

| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| URL 生成時間 | < 1ms | 單元測試中測量 |
| 元件首次渲染時間 | < 5ms | React DevTools Profiler |
| 圖示載入時間 | < 50ms | Network tab（SVG inline） |
| Tooltip 顯示延遲 | 200ms | Radix UI 預設值 |

## Summary

此資料模型定義了交易所連結功能所需的所有 TypeScript 介面、配置常數和函數簽名。設計重點：

1. **類型安全**: 使用 TypeScript 嚴格類型
2. **集中管理**: URL 配置集中在 constants.ts
3. **可測試性**: 清晰的函數簽名和錯誤處理
4. **可擴展性**: 易於新增新交易所
5. **無障礙性**: 符合 WCAG 標準

下一步: 生成 contracts/ 目錄和 quickstart.md
