# Quickstart Guide: 市場監控頁面交易所快速連結

**Feature**: 008-specify-scripts-bash
**Date**: 2025-11-06
**Target Audience**: Developers implementing this feature

## Overview

此指南提供快速實作此功能的步驟指引。完成後，用戶將能夠在市場監控頁面點擊圖示，直接跳轉到交易所的合約頁面。

**預估時間**: 4-6 小時

## Prerequisites

在開始之前，確保你已經：

- ✅ 閱讀 `spec.md` 了解功能需求
- ✅ 閱讀 `research.md` 了解技術決策
- ✅ 閱讀 `data-model.md` 了解資料結構
- ✅ 熟悉專案現有的市場監控頁面實作
- ✅ 本地開發環境已設置（Node.js 20+, pnpm 8+）

## Step-by-Step Implementation

### Step 1: 安裝新依賴 (5 分鐘)

```bash
# 安裝 Radix UI Tooltip 元件
pnpm add @radix-ui/react-tooltip

# 驗證安裝
pnpm list @radix-ui/react-tooltip
```

### Step 2: 複製類型定義 (5 分鐘)

```bash
# 從 contracts/ 複製類型定義到 src/
cp specs/008-specify-scripts-bash/contracts/types.ts src/types/exchange-links.ts

# 驗證檔案已建立
cat src/types/exchange-links.ts
```

### Step 3: 實作 URL Builder 模組 (30 分鐘)

建立 `src/lib/exchanges/url-builder.ts`：

```typescript
import {
  ExchangeConfigMap,
  UrlBuilderResult,
  SymbolFormat,
  SupportedExchange,
  SUPPORTED_EXCHANGES,
  isValidSymbolFormat,
  isSupportedExchange,
  ExchangeLinkError,
  ExchangeLinkErrorCode,
} from '@/types/exchange-links';

/**
 * Exchange URL configurations
 */
const EXCHANGE_CONFIGS: ExchangeConfigMap = {
  binance: {
    exchange: 'binance',
    displayName: 'Binance',
    urlTemplate: 'https://www.binance.com/zh-TC/futures/{symbol}',
    formatSymbol: (symbol) => symbol.replace('/', ''),
  },
  okx: {
    exchange: 'okx',
    displayName: 'OKX',
    urlTemplate: 'https://www.okx.com/zh-hant/trade-swap/{symbol}',
    formatSymbol: (symbol) => symbol.replace('/', '-') + '-SWAP',
  },
  mexc: {
    exchange: 'mexc',
    displayName: 'MEXC',
    urlTemplate: 'https://futures.mexc.com/zh-TW/exchange/{symbol}',
    formatSymbol: (symbol) => symbol.replace('/', '_'),
  },
  gateio: {
    exchange: 'gateio',
    displayName: 'Gate.io',
    urlTemplate: 'https://www.gate.io/zh-tw/futures_trade/USDT/{symbol}',
    formatSymbol: (symbol) => symbol.replace('/', '_'),
  },
};

/**
 * Generate exchange contract page URL
 */
export function getExchangeContractUrl(
  exchange: string,
  symbol: string
): UrlBuilderResult {
  // Validate exchange
  if (!isSupportedExchange(exchange)) {
    return {
      url: '',
      formattedSymbol: '',
      isValid: false,
      error: `Unsupported exchange: ${exchange}`,
    };
  }

  // Validate symbol
  if (!symbol || symbol.trim() === '') {
    return {
      url: '',
      formattedSymbol: '',
      isValid: false,
      error: 'Symbol cannot be empty',
    };
  }

  if (!isValidSymbolFormat(symbol)) {
    return {
      url: '',
      formattedSymbol: '',
      isValid: false,
      error: `Invalid symbol format: ${symbol}. Expected format: BASE/QUOTE (e.g., BTC/USDT)`,
    };
  }

  // Get config and format symbol
  const config = EXCHANGE_CONFIGS[exchange];
  const formattedSymbol = config.formatSymbol(symbol);
  const url = config.urlTemplate.replace('{symbol}', formattedSymbol);

  return {
    url,
    formattedSymbol,
    isValid: true,
  };
}

export { EXCHANGE_CONFIGS };
```

**測試**:
```bash
# 建立並執行簡單測試
npx tsx -e "import { getExchangeContractUrl } from './src/lib/exchanges/url-builder.js'; console.log(getExchangeContractUrl('binance', 'BTC/USDT'));"
```

### Step 4: 實作 ExchangeLink 元件 (45 分鐘)

建立 `src/components/market/ExchangeLink.tsx`：

```typescript
'use client';

import React from 'react';
import { ExternalLink } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils';
import { getExchangeContractUrl } from '@/lib/exchanges/url-builder';
import {
  ExchangeLinkProps,
  EXCHANGE_DISPLAY_NAMES,
} from '@/types/exchange-links';

/**
 * ExchangeLink - 交易所連結元件
 * 顯示可點擊的圖示，連結到交易所合約頁面
 */
export function ExchangeLink({
  exchange,
  symbol,
  isAvailable = true,
  className,
  ariaLabel,
  onClick,
}: ExchangeLinkProps) {
  // 生成 URL
  const urlResult = getExchangeContractUrl(exchange, symbol);

  // 如果不可用或 URL 無效，顯示禁用狀態
  if (!isAvailable || !urlResult.isValid) {
    return (
      <span
        className={cn(
          'inline-flex items-center opacity-40 cursor-not-allowed',
          className
        )}
        aria-label="此交易所不支援此交易對"
      >
        <ExternalLink className="w-4 h-4 text-gray-400" />
      </span>
    );
  }

  // 生成顯示名稱和 aria-label
  const displayName = EXCHANGE_DISPLAY_NAMES[exchange];
  const defaultAriaLabel = `前往 ${displayName} 查看 ${symbol} 永續合約`;

  return (
    <Tooltip.Provider>
      <Tooltip.Root delayDuration={200}>
        <Tooltip.Trigger asChild>
          <a
            href={urlResult.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'inline-flex items-center',
              'text-gray-500 hover:text-blue-600',
              'transition-colors duration-200',
              'focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded',
              className
            )}
            aria-label={ariaLabel || defaultAriaLabel}
            onClick={(e) => {
              if (onClick) {
                onClick(exchange, symbol);
              }
            }}
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg"
            sideOffset={5}
          >
            前往 {displayName} 查看 {symbol}
            <Tooltip.Arrow className="fill-gray-900" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
```

### Step 5: 整合到 RateRow 元件 (30 分鐘)

修改 `app/(dashboard)/market-monitor/components/RateRow.tsx`：

```typescript
// 在檔案頂部新增 import
import { ExchangeLink } from '@/components/market/ExchangeLink';

// 在顯示費率的地方，修改為：
// Before:
<div className="text-sm">{rate.toFixed(4)}%</div>

// After:
<div className="flex items-center gap-1.5">
  <span className="text-sm">{rate.toFixed(4)}%</span>
  <ExchangeLink
    exchange="binance"  // 替換為對應的交易所
    symbol={symbol}
    isAvailable={rate !== null && rate !== undefined}
  />
</div>
```

**具體修改位置**：
1. 找到顯示 Binance 費率的地方 → 添加 `<ExchangeLink exchange="binance" ... />`
2. 找到顯示 OKX 費率的地方 → 添加 `<ExchangeLink exchange="okx" ... />`
3. 找到顯示 MEXC 費率的地方 → 添加 `<ExchangeLink exchange="mexc" ... />`
4. 找到顯示 Gate.io 費率的地方 → 添加 `<ExchangeLink exchange="gateio" ... />`

### Step 6: 本地測試 (30 分鐘)

```bash
# 啟動開發服務器
pnpm dev

# 在瀏覽器中訪問 http://localhost:3000
# 導航到市場監控頁面
# 測試以下項目：
# 1. 圖示是否正確顯示
# 2. Hover 時是否顯示 Tooltip
# 3. 點擊是否在新分頁開啟正確的交易所頁面
# 4. 不可用的交易對是否顯示為灰色
```

### Step 7: 撰寫單元測試 (60 分鐘)

建立 `tests/unit/lib/url-builder.test.ts`：

```typescript
import { describe, it, expect } from 'vitest';
import { getExchangeContractUrl } from '@/lib/exchanges/url-builder';

describe('getExchangeContractUrl', () => {
  describe('Valid cases', () => {
    it('should generate correct URL for Binance', () => {
      const result = getExchangeContractUrl('binance', 'BTC/USDT');
      expect(result.isValid).toBe(true);
      expect(result.url).toBe('https://www.binance.com/zh-TC/futures/BTCUSDT');
      expect(result.formattedSymbol).toBe('BTCUSDT');
    });

    it('should generate correct URL for OKX', () => {
      const result = getExchangeContractUrl('okx', 'ETH/USDT');
      expect(result.isValid).toBe(true);
      expect(result.url).toBe('https://www.okx.com/zh-hant/trade-swap/ETH-USDT-SWAP');
      expect(result.formattedSymbol).toBe('ETH-USDT-SWAP');
    });

    // ... 更多測試案例
  });

  describe('Invalid cases', () => {
    it('should return error for unsupported exchange', () => {
      const result = getExchangeContractUrl('unknown', 'BTC/USDT');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Unsupported exchange');
    });

    it('should return error for invalid symbol format', () => {
      const result = getExchangeContractUrl('binance', 'BTCUSDT');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid symbol format');
    });
  });
});
```

**執行測試**:
```bash
pnpm test url-builder.test.ts
```

### Step 8: 撰寫 E2E 測試 (60 分鐘)

建立 `tests/e2e/market-monitor-exchange-links.spec.ts`：

```typescript
import { test, expect, Page } from '@playwright/test';

test.describe('Market Monitor - Exchange Links', () => {
  test.beforeEach(async ({ page }) => {
    // 登入並導航到市場監控頁面
    await page.goto('/login');
    // ... 登入邏輯
    await page.goto('/market-monitor');
    await page.waitForLoadState('networkidle');
  });

  test('should display exchange link icons for all exchanges', async ({ page }) => {
    // 檢查是否顯示 ExternalLink 圖示
    const icons = page.locator('a[target="_blank"] svg');
    const count = await icons.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should open correct Binance URL in new tab', async ({ page, context }) => {
    // 監聽新分頁開啟事件
    const pagePromise = context.waitForEvent('page');

    // 點擊第一個 Binance 的連結
    const binanceLink = page.locator('a[href*="binance.com"]').first();
    await binanceLink.click();

    // 驗證新分頁 URL
    const newPage = await pagePromise;
    await newPage.waitForLoadState();
    expect(newPage.url()).toContain('binance.com/zh-TC/futures/');
  });

  test('should show tooltip on hover', async ({ page }) => {
    const link = page.locator('a[target="_blank"]').first();
    await link.hover();

    // 等待 Tooltip 出現
    const tooltip = page.locator('[role="tooltip"]');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('前往');
  });
});
```

**執行 E2E 測試**:
```bash
pnpm test:e2e market-monitor-exchange-links.spec.ts
```

## Verification Checklist

完成實作後，驗證以下項目：

### Functionality
- [ ] 點擊 Binance 圖示開啟正確的 Binance 合約頁面
- [ ] 點擊 OKX 圖示開啟正確的 OKX 合約頁面
- [ ] 點擊 MEXC 圖示開啟正確的 MEXC 合約頁面
- [ ] 點擊 Gate.io 圖示開啟正確的 Gate.io 合約頁面
- [ ] 連結在新分頁開啟，原頁面保持不變
- [ ] 不可用的交易對顯示為灰色且不可點擊

### User Experience
- [ ] Hover 時顯示 Tooltip
- [ ] Tooltip 內容清晰描述操作
- [ ] 圖示尺寸適中，不會視覺混亂
- [ ] 在桌面和移動裝置上都可正常使用

### Accessibility
- [ ] 可通過 Tab 鍵訪問連結
- [ ] Focus 時有明顯的 focus indicator
- [ ] aria-label 正確描述連結功能
- [ ] Screen reader 可以正確讀取

### Testing
- [ ] 所有單元測試通過 (`pnpm test`)
- [ ] 所有 E2E 測試通過 (`pnpm test:e2e`)
- [ ] TypeScript 編譯無錯誤 (`pnpm build`)
- [ ] ESLint 檢查通過 (`pnpm lint`)

### Code Quality
- [ ] 程式碼符合專案編碼風格
- [ ] 所有函數都有 TSDoc 註解
- [ ] 沒有 console.log 或 debugger 語句
- [ ] 錯誤處理完整

## Troubleshooting

### 問題：Tooltip 不顯示

**解決方案**:
1. 檢查 `@radix-ui/react-tooltip` 是否正確安裝
2. 確保 `<Tooltip.Provider>` 包裹整個元件
3. 檢查 CSS 是否正確載入

### 問題：URL 生成錯誤

**解決方案**:
1. 在 `url-builder.ts` 添加 console.log 檢查輸入
2. 驗證交易對符號格式是否正確（應為 "BTC/USDT"）
3. 檢查 EXCHANGE_CONFIGS 配置是否正確

### 問題：新分頁被瀏覽器阻止

**解決方案**:
1. 確保使用 `<a target="_blank">` 而非 `window.open()`
2. 確保連結有 `href` 屬性
3. 確保使用者主動點擊（非自動觸發）

## Performance Tips

- 圖示使用 SVG（lucide-react），無需額外載入圖片
- URL 生成純計算，無網路請求
- Tooltip 僅在 hover 時渲染
- 元件使用 React.memo 可進一步優化（可選）

## Next Steps

完成此功能後：

1. **Code Review**: 請求 code review，確保符合團隊標準
2. **Documentation**: 更新用戶文件（如果需要）
3. **Monitoring**: 觀察生產環境中的使用情況
4. **Feedback**: 收集用戶反饋，規劃後續改進

## Resources

- [Spec Document](./spec.md)
- [Research Document](./research.md)
- [Data Model](./data-model.md)
- [Type Definitions](./contracts/types.ts)
- [Radix UI Tooltip Docs](https://www.radix-ui.com/primitives/docs/components/tooltip)
- [Lucide React Icons](https://lucide.dev/)

## Support

如果在實作過程中遇到問題：

1. 檢查上述 Troubleshooting 部分
2. 閱讀相關文件（spec.md, research.md）
3. 檢視現有的類似功能實作
4. 向團隊尋求協助

**預估完成時間**: 4-6 小時
**難度**: 低-中等
**風險**: 低
