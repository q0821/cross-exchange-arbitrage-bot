# Data Model: 一鍵複製套利機會資訊

**Feature**: 020-copy-arbitrage-info
**Date**: 2025-11-21
**Status**: Complete

## Overview

本文件描述一鍵複製功能所使用的數據結構。此功能主要讀取現有的 `MarketRate` 數據並格式化為文字，不涉及新的數據模型創建或資料庫變更。

## Existing Data Structures

### MarketRate (Input)

**定義位置**: `app/(dashboard)/market-monitor/types.ts`

```typescript
export interface MarketRate {
  symbol: string;                                    // 交易對符號（如 "BTCUSDT"）
  exchanges: Record<string, ExchangeRateData>;      // 各交易所的費率數據
  bestPair: BestArbitragePair | null;               // 最佳套利配對資訊
  status: 'opportunity' | 'approaching' | 'normal'; // 機會狀態
  timestamp: string;                                // 數據時間戳（ISO 8601 格式）
}
```

**欄位說明**:
- `symbol`: 交易對名稱，格式為 `BASE + QUOTE`（如 BTCUSDT、ETHUSDT）
- `exchanges`: 包含 binance、okx、mexc、gateio 四個交易所的費率數據
- `bestPair`: 套利配對資訊，當沒有套利機會時為 `null`
- `status`: 根據費率差判定的機會等級
  - `opportunity`: 費率差 ≥ 0.5%
  - `approaching`: 費率差 0.4%-0.5%
  - `normal`: 費率差 < 0.4%
- `timestamp`: 數據更新時間，用於判斷數據是否過期

### ExchangeRateData

```typescript
export interface ExchangeRateData {
  rate: number;                                     // 資金費率（小數形式，如 0.0001）
  price: number | null;                            // 現貨價格（USD）
  normalized?: {                                   // 標準化費率（多時間基準）
    '1h'?: number;
    '4h'?: number;
    '8h'?: number;
    '24h'?: number;
  };
  originalInterval?: number;                       // 原始資金費率週期（小時）
}
```

**欄位說明**:
- `rate`: 當前使用的資金費率（已根據時間基準標準化）
- `price`: 交易所的現貨價格，用於計算價差
- `normalized`: 不同時間基準的標準化費率值
- `originalInterval`: 交易所的原始資金費率結算週期

### BestArbitragePair

```typescript
export interface BestArbitragePair {
  longExchange: ExchangeName;                      // 做多的交易所
  shortExchange: ExchangeName;                     // 做空的交易所
  spread: number;                                  // 利差（絕對值，小數形式）
  spreadPercent: number;                           // 利差百分比
  annualizedReturn: number;                        // 年化收益百分比
  priceDiffPercent: number | null;                 // 價差百分比
}
```

**欄位說明**:
- `longExchange`: 資金費率較低的交易所（收取資金費率）
- `shortExchange`: 資金費率較高的交易所（支付資金費率）
- `spread`: 兩個交易所的費率差（絕對值）
- `spreadPercent`: 費率差百分比（spread × 100）
- `annualizedReturn`: 年化收益率，計算公式：`spread × 365 × (24 / timeBasis)`
- `priceDiffPercent`: 價差百分比，正值表示做空價格較高（有利）

### ExchangeName

```typescript
export type ExchangeName = 'binance' | 'okx' | 'mexc' | 'gateio';
```

**說明**: 支援的交易所名稱，用於類型安全檢查。

## New Function Signatures

### formatArbitrageMessage

**定義位置**: `app/(dashboard)/market-monitor/utils/formatArbitrageMessage.ts`

```typescript
/**
 * 將 MarketRate 數據格式化為指定的套利資訊文字格式
 *
 * @param rate - MarketRate 物件，包含交易對和套利配對資訊
 * @returns 格式化的文字字串，可直接複製到剪貼板
 * @throws Error 當 bestPair 為 null 時拋出異常
 */
export function formatArbitrageMessage(rate: MarketRate): string
```

**輸入**: `MarketRate` 物件

**輸出**: 格式化的文字字串（示例）
```
=======
【套套摳訊】

📌
BTC/USDT
做多：BINANCE（交易所）
做空：OKX（交易所）

📈 目前利潤預估：
 • 目前價差：約 5-7%
 • 目前資費差：約 3%

🧾 下單小提醒：
 • 請使用全倉 + 低倍槓桿（最多 2～3 倍）
 • 兩邊市價一起敲，兩邊顆數要一樣

🚨 風險提醒：
 • 資費有時會亂跳，要再注意觀察
=======
```

**前置條件**:
- `rate.bestPair` 不為 `null`
- `rate.symbol` 為有效的交易對名稱
- `rate.bestPair.priceDiffPercent` 和 `rate.bestPair.spreadPercent` 為有效數值

**後置條件**:
- 返回包含所有必要資訊的格式化文字
- 文字格式符合規格定義
- 包含正確的 emoji 圖標和縮排

### Helper Functions

#### formatSymbolDisplay

```typescript
/**
 * 將交易對符號格式化為顯示格式
 *
 * @param symbol - 交易對符號（如 "BTCUSDT"）
 * @returns 格式化後的顯示名稱（如 "BTC/USDT"）
 */
function formatSymbolDisplay(symbol: string): string
```

**輸入**: `"BTCUSDT"`
**輸出**: `"BTC/USDT"`

**演算法**:
1. 移除 "USDT" 後綴
2. 在基礎資產和 "USDT" 之間插入 "/"

#### getExchangeDisplayName

```typescript
/**
 * 獲取交易所的顯示名稱
 *
 * @param exchange - ExchangeName 類型
 * @returns 大寫的顯示名稱
 */
function getExchangeDisplayName(exchange: ExchangeName): string
```

**映射規則**:
```typescript
const EXCHANGE_DISPLAY_NAMES: Record<ExchangeName, string> = {
  binance: 'BINANCE',
  okx: 'OKX',
  mexc: 'MEXC',
  gateio: 'GATE'  // 特殊情況：簡化為 GATE
};
```

#### formatPercentageRange

```typescript
/**
 * 將百分比數值格式化為範圍估值
 *
 * @param value - 百分比數值（小數形式）
 * @returns 格式化的範圍字串（如 "約 5-7%"）
 */
function formatPercentageRange(value: number | null): string
```

**演算法**:
```typescript
if (value === null || isNaN(value) || value < 0) {
  return 'N/A';
}

if (value === 0) {
  return '約 0%';
}

const valuePercent = value * 100;  // 轉換為百分比
const min = Math.max(0, Math.round(valuePercent * 0.8));
const max = Math.round(valuePercent * 1.2);

if (min === max) {
  return `約 ${min}%`;
}

return `約 ${min}-${max}%`;
```

**範例**:
| 輸入值 | 輸出 |
|--------|------|
| 0.075 (7.5%) | "約 6-9%" |
| 0.03 (3%) | "約 2-4%" |
| 0.005 (0.5%) | "約 0-1%" |
| 0 | "約 0%" |
| null | "N/A" |
| NaN | "N/A" |
| -0.02 | "N/A" |

## Data Flow

```
User clicks Copy Button
      ↓
RateRow.handleCopy()
      ↓
formatArbitrageMessage(rate)
      ↓
[Extract data from rate.bestPair]
      ↓
formatSymbolDisplay(symbol)
getExchangeDisplayName(longExchange)
getExchangeDisplayName(shortExchange)
formatPercentageRange(priceDiffPercent)
formatPercentageRange(spreadPercent)
      ↓
[Assemble formatted text]
      ↓
navigator.clipboard.writeText(text)
      ↓
[Update button state to 'success']
```

## Validation Rules

### Input Validation

1. **MarketRate 物件必須有效**:
   ```typescript
   if (!rate || !rate.bestPair) {
     throw new Error('Invalid rate data or missing best pair');
   }
   ```

2. **交易對符號必須包含 USDT**:
   ```typescript
   if (!rate.symbol.endsWith('USDT')) {
     console.warn('Unexpected symbol format:', rate.symbol);
   }
   ```

3. **數值有效性檢查**:
   ```typescript
   if (isNaN(rate.bestPair.spreadPercent) || rate.bestPair.spreadPercent < 0) {
     // 處理異常值
   }
   ```

### Output Validation

1. **格式化文字長度合理**:
   - 典型長度: 200-300 字元
   - 最大長度: < 500 字元（避免剪貼板問題）

2. **包含所有必要資訊**:
   - 分隔線（`=======`）
   - 標題（`【套套摳訊】`）
   - 交易對名稱
   - 做多/做空交易所
   - 價差和資費差
   - 下單提醒和風險提醒

3. **格式正確性**:
   - 換行符一致（`\n`）
   - 縮排一致（空格）
   - Emoji 正確顯示

## Edge Cases

| 情況 | 處理方式 |
|------|---------|
| bestPair 為 null | 拋出 Error，組件層面禁用按鈕 |
| priceDiffPercent 為 null | 顯示 "N/A" |
| spreadPercent 為 0 | 顯示 "約 0%" |
| 負數值 | 顯示 "N/A" |
| NaN 值 | 顯示 "N/A" |
| 未知交易所名稱 | 使用 fallback（toUpperCase()） |
| symbol 不含 USDT | 直接顯示原始 symbol（容錯處理） |

## Testing Considerations

### Unit Test Cases

1. **正常情況**:
   - 標準 MarketRate 物件 → 完整格式化文字
   - 驗證所有欄位正確填充

2. **邊界情況**:
   - bestPair 為 null → 拋出 Error
   - priceDiffPercent 為 null → "N/A"
   - spreadPercent 為 0 → "約 0%"
   - 極小值（0.001%） → "約 0-0%"
   - 極大值（50%） → "約 40-60%"

3. **特殊交易所**:
   - gateio → "GATE"（不是 "GATEIO"）
   - 驗證所有四個交易所映射正確

4. **格式驗證**:
   - 檢查換行符數量
   - 檢查 emoji 存在
   - 檢查分隔線位置

## Performance Considerations

- **計算複雜度**: O(1) - 所有操作都是常數時間
- **記憶體使用**: 最小 - 僅創建一個字串物件
- **執行時間**: < 1ms（格式化操作非常快速）
- **剪貼板寫入**: < 100ms（取決於瀏覽器實現）

## Security Considerations

- **無注入風險**: 所有輸入數據都是內部產生，不來自用戶輸入
- **無 XSS 風險**: 輸出為純文字，不涉及 HTML 渲染
- **隱私**: 不包含敏感資訊（API keys、個人資料）
- **剪貼板權限**: 由瀏覽器自動管理，用戶點擊時自動授權

## Future Extensions

### Potential Enhancements

1. **自訂格式範本**:
   ```typescript
   interface FormatTemplate {
     title: string;
     fields: Array<keyof BestArbitragePair>;
     customFields?: Record<string, (rate: MarketRate) => string>;
   }

   function formatArbitrageMessage(
     rate: MarketRate,
     template?: FormatTemplate
   ): string
   ```

2. **多語言支援**:
   ```typescript
   function formatArbitrageMessage(
     rate: MarketRate,
     locale: 'zh-TW' | 'en-US' | 'ja-JP' = 'zh-TW'
   ): string
   ```

3. **包含限倉資訊**:
   ```typescript
   interface ExtendedMarketRate extends MarketRate {
     positionLimits?: Record<ExchangeName, PositionLimit>;
   }
   ```

## References

- **Related Types**: `app/(dashboard)/market-monitor/types.ts`
- **Related Utils**: `app/(dashboard)/market-monitor/utils/rateCalculations.ts`
- **Research Document**: [research.md](./research.md)
- **Specification**: [spec.md](./spec.md)

**Data Model Status**: ✅ COMPLETE
**Ready for Implementation**: ✅ YES
