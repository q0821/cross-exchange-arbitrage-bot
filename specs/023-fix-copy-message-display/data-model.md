# Data Model: 修正複製套利訊息顯示

**Feature**: 023-fix-copy-message-display
**Created**: 2025-11-25

## Overview

本功能是純前端顯示修改，不涉及新的資料模型或資料庫 schema 變更。所有類型定義都使用現有的 TypeScript 介面。

## Existing Types (Reference Only)

以下是本功能使用的現有類型定義，**不需要修改**：

### MarketRate

**Location**: `app/(dashboard)/market-monitor/types.ts`

```typescript
export interface MarketRate {
  symbol: string;                              // 交易對符號（如 "BTCUSDT"）
  exchanges: Record<string, ExchangeRateData>; // 各交易所的費率數據
  bestPair: BestArbitragePair | null;          // 最佳套利對
  status: 'opportunity' | 'approaching' | 'normal'; // 狀態
  timestamp: string;                           // ISO 8601 時間戳
}
```

**Usage in this feature**:
- 作為 `formatArbitrageMessage()` 的輸入參數
- 提供交易對、交易所、套利對等資訊

---

### BestArbitragePair

**Location**: `app/(dashboard)/market-monitor/types.ts`

```typescript
export interface BestArbitragePair {
  longExchange: ExchangeName;      // 做多的交易所
  shortExchange: ExchangeName;     // 做空的交易所
  spread: number;                  // 利差（小數形式，如 0.005）
  spreadPercent: number;           // 利差百分比（如 0.5 表示 0.5%）
  annualizedReturn: number;        // 年化收益百分比（如 800 表示 800%）
  priceDiffPercent: number | null; // 價格偏差百分比（可為 null）
}
```

**Usage in this feature**:
- 提供年化收益（`annualizedReturn`）- 用於顯示年化收益範圍
- 提供單次費率收益（`spreadPercent`）- 用於顯示單次收益
- 提供價格偏差（`priceDiffPercent`）- 用於顯示價格偏差和風險說明
- 提供交易所資訊（`longExchange`, `shortExchange`）

---

### ExchangeName

**Location**: `app/(dashboard)/market-monitor/types.ts`

```typescript
export type ExchangeName = 'binance' | 'okx' | 'mexc' | 'gateio';
```

**Usage in this feature**:
- 用於 `getExchangeDisplayName()` 函數的類型安全

---

### TimeBasis

**Location**: `app/(dashboard)/market-monitor/types.ts`

```typescript
export type TimeBasis = 1 | 4 | 8 | 24;
```

**Usage in this feature**:
- 作為 `formatArbitrageMessage()` 的參數類型
- 用於生成「每 X 小時結算一次」的說明文字

---

## New Helper Types (Internal Only)

以下是格式化函數內部使用的輔助類型，**不需要導出**：

### FormattedMessage

```typescript
/**
 * 格式化後的訊息結構（內部使用）
 *
 * NOTE: 此類型僅用於文檔目的，實際函數直接返回 string
 */
interface FormattedMessage {
  header: string;           // "【套套摳訊】"
  symbol: string;           // "BTC/USDT"
  longExchange: string;     // "BINANCE（交易所）"
  shortExchange: string;    // "OKX（交易所）"
  annualizedReturn: string; // "約 720-880%（資金費率價差）"
  singleReturn: string;     // "約 0.73%（每 8 小時結算一次）"
  priceDiff: string;        // "+0.15%（✓ 做空方價格較高，有利平倉）"
  tradingTips: string;      // 下單小提醒
  riskWarnings: string;     // 風險提示
}
```

---

## Function Signatures

### formatArbitrageMessage

```typescript
/**
 * 將 MarketRate 格式化為完整的套利訊息文字
 *
 * @param rate - MarketRate 物件，包含交易對和套利配對資訊
 * @param timeBasis - 時間基準（1, 4, 8, 24 小時），預設 8
 * @returns 格式化的文字字串，可直接複製到剪貼簿
 * @throws Error 當 bestPair 為 null 時拋出異常
 *
 * @example
 * const message = formatArbitrageMessage(rate, 8);
 * await navigator.clipboard.writeText(message);
 */
export function formatArbitrageMessage(
  rate: MarketRate,
  timeBasis: TimeBasis = 8
): string;
```

### formatAnnualizedReturn

```typescript
/**
 * 格式化年化收益為範圍估值（±10%）
 *
 * @param annualizedReturn - 年化收益百分比（如 800 表示 800%）
 * @returns 格式化字串（如 "約 720-880%"）
 *
 * @example
 * formatAnnualizedReturn(800) // => "約 720-880%"
 * formatAnnualizedReturn(0)   // => "約 0%"
 */
function formatAnnualizedReturn(annualizedReturn: number): string;
```

### formatSingleFundingReturn

```typescript
/**
 * 格式化單次費率收益並附加時間基準說明
 *
 * @param spreadPercent - 費率差異百分比（如 0.73 表示 0.73%）
 * @param timeBasis - 時間基準（1, 4, 8, 24 小時）
 * @returns 格式化字串（如 "約 0.73%（每 8 小時結算一次）"）
 *
 * @example
 * formatSingleFundingReturn(0.73, 8)  // => "約 0.73%（每 8 小時結算一次）"
 * formatSingleFundingReturn(0.25, 4)  // => "約 0.25%（每 4 小時結算一次）"
 */
function formatSingleFundingReturn(
  spreadPercent: number,
  timeBasis: TimeBasis
): string;
```

### formatPriceDiffWithExplanation

```typescript
/**
 * 格式化價格偏差並附帶有利/不利說明
 *
 * @param priceDiffPercent - 價格差異百分比（如 0.15 表示 0.15%，可為 null）
 * @returns 格式化字串，包含正負號、數值和風險說明
 *
 * @example
 * formatPriceDiffWithExplanation(0.15)
 * // => "+0.15%（✓ 做空方價格較高，有利平倉）"
 *
 * formatPriceDiffWithExplanation(-0.10)
 * // => "-0.10%（✗ 做多方價格較高，不利平倉）"
 *
 * formatPriceDiffWithExplanation(null)
 * // => "N/A（無價格數據）"
 */
function formatPriceDiffWithExplanation(
  priceDiffPercent: number | null
): string;
```

### Existing Functions (No Changes)

以下函數已存在，**不需要修改**：

```typescript
// 已存在於 formatArbitrageMessage.ts
export function formatSymbolDisplay(symbol: string): string;
export function getExchangeDisplayName(exchange: ExchangeName): string;
```

---

## State Management

### Component State (RateRow.tsx)

```typescript
/**
 * 複製狀態類型
 */
type CopyStatus = 'idle' | 'success' | 'error';

/**
 * RateRow 組件中的狀態
 */
const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle');
```

**State Transitions**:
```
idle -> (click copy button) -> success/error
                                    |
                              (after 2 seconds)
                                    ↓
                                  idle
```

---

## Data Flow

```
MarketRate (from WebSocket)
     ↓
RateRow Component
     ↓
handleCopy()
     ↓
formatArbitrageMessage(rate, currentTimeBasis)
     ├─ formatAnnualizedReturn(rate.bestPair.annualizedReturn)
     ├─ formatSingleFundingReturn(rate.bestPair.spreadPercent, timeBasis)
     ├─ formatPriceDiffWithExplanation(rate.bestPair.priceDiffPercent)
     ├─ formatSymbolDisplay(rate.symbol)
     └─ getExchangeDisplayName(rate.bestPair.longExchange/shortExchange)
     ↓
Formatted Message String
     ↓
navigator.clipboard.writeText(message)
     ↓
Success/Error State Update
```

---

## Validation Rules

### Input Validation

```typescript
// formatArbitrageMessage
- rate 不可為 null/undefined
- rate.bestPair 不可為 null（會拋出 Error）
- timeBasis 必須是 1, 4, 8, 24 其中之一（TypeScript 類型保證）

// formatAnnualizedReturn
- annualizedReturn 必須是數字
- 零值特殊處理（返回 "約 0%"）
- 負值允許但不常見（會顯示負範圍）

// formatSingleFundingReturn
- spreadPercent 必須是數字
- timeBasis 必須是有效值

// formatPriceDiffWithExplanation
- null 值特殊處理（返回 "N/A（無價格數據）"）
- 數字值必須是有限數字（非 NaN, Infinity）
```

### Output Format

```typescript
// 年化收益範圍格式
/^約 \d+-\d+%$/  // "約 720-880%"
/^約 0%$/        // 零值特例

// 單次收益格式
/^約 \d+\.\d{2}%（每 [1|4|8|24] 小時結算一次）$/  // "約 0.73%（每 8 小時結算一次）"

// 價格偏差格式
/^[+-]?\d+\.\d{2}% \([✓✗] .+\)$/  // "+0.15%（✓ 做空方價格較高，有利平倉）"
/^N\/A（無價格數據）$/            // null 值
```

---

## Type Safety Guarantees

### TypeScript Compile-Time Checks

- ✅ `TimeBasis` 只能是 1, 4, 8, 24
- ✅ `ExchangeName` 只能是 'binance' | 'okx' | 'mexc' | 'gateio'
- ✅ `priceDiffPercent` 明確標記為 `number | null`
- ✅ 函數參數類型強制執行

### Runtime Checks

- ✅ `bestPair` null 檢查（拋出錯誤）
- ✅ `priceDiffPercent` null 處理（返回 "N/A"）
- ✅ 零值特殊處理
- ✅ NaN/Infinity 防護（透過 `.toFixed()` 會拋出錯誤）

---

## Backward Compatibility

- ✅ `formatArbitrageMessage()` 添加可選參數 `timeBasis`，預設值 8
- ✅ 現有呼叫 `formatArbitrageMessage(rate)` 仍然有效
- ✅ 不修改現有類型定義
- ✅ 移除的函數：`formatPercentageRange()`（已棄用且有錯誤）

---

## Summary

| 類別 | 項目 | 狀態 |
|-----|------|------|
| 現有類型 | MarketRate, BestArbitragePair, ExchangeName, TimeBasis | ✅ 重用，無需修改 |
| 新增函數 | formatAnnualizedReturn | ✅ 新增 |
| 新增函數 | formatSingleFundingReturn | ✅ 新增 |
| 新增函數 | formatPriceDiffWithExplanation | ✅ 新增 |
| 修改函數 | formatArbitrageMessage | ✅ 添加 timeBasis 參數 |
| 移除函數 | formatPercentageRange | ✅ 移除（錯誤邏輯） |
| 資料模型變更 | N/A | ✅ 無需變更 |
| 資料庫 Schema | N/A | ✅ 無需變更 |

**Next**: 生成 contracts/ 和 quickstart.md
