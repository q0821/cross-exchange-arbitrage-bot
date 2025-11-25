# Formatting Functions Contract

**Feature**: 023-fix-copy-message-display
**Created**: 2025-11-25
**Location**: `app/(dashboard)/market-monitor/utils/formatArbitrageMessage.ts`

## Public API

### formatArbitrageMessage

**Signature**:
```typescript
export function formatArbitrageMessage(
  rate: MarketRate,
  timeBasis: TimeBasis = 8
): string
```

**Parameters**:
- `rate: MarketRate` - 市場費率數據物件
  - Required
  - Must have valid `bestPair` (non-null)
  - Must have valid `symbol`
- `timeBasis: TimeBasis` - 時間基準（1, 4, 8, 24 小時）
  - Optional, default: 8
  - Type-safe: only accepts 1 | 4 | 8 | 24

**Returns**: `string`
- Multi-line formatted message ready for clipboard
- Contains UTF-8 characters (Chinese, Emoji)
- Newline separated sections

**Throws**:
- `Error` - When `rate` is null/undefined
- `Error` - When `rate.bestPair` is null

**Example**:
```typescript
const rate: MarketRate = {
  symbol: 'BTCUSDT',
  bestPair: {
    longExchange: 'binance',
    shortExchange: 'okx',
    spreadPercent: 0.73,
    annualizedReturn: 800,
    priceDiffPercent: 0.15,
    // ...
  },
  // ...
};

const message = formatArbitrageMessage(rate, 8);
// Returns:
// =======
// 【套套摳訊】
//
// 📌
// BTC/USDT
// 做多：BINANCE（交易所）
// 做空：OKX（交易所）
//
// 📈 收益評估：
//  • 預估年化收益：約 720-880%（資金費率價差）
//  • 單次費率收益：約 0.73%（每 8 小時結算一次）
//  • 價格偏差：+0.15%（✓ 做空方價格較高，有利平倉）
//
// 🧾 下單小提醒：
//  • 請使用全倉 + 低倍槓桿（最多 2～3 倍）
//  • 兩邊市價一起敲，兩邊顆數要一樣
//
// 🚨 風險提示：
//  • 價格偏差為負表示不利，可能影響平倉收益
//  • 資金費率可能波動，請持續觀察
// =======
```

**Contract**:
- ✅ Pure function (no side effects)
- ✅ Deterministic (same input → same output)
- ✅ Thread-safe (no shared mutable state)
- ✅ Type-safe (TypeScript enforced)
- ❌ Does NOT validate market data correctness
- ❌ Does NOT perform calculations
- ❌ Does NOT mutate input

---

## Internal Helper Functions

### formatAnnualizedReturn

**Signature**:
```typescript
function formatAnnualizedReturn(annualizedReturn: number): string
```

**Parameters**:
- `annualizedReturn: number` - 年化收益百分比（如 800 表示 800%）

**Returns**: `string`
- Format: `"約 {min}-{max}%"` where min = value * 0.9, max = value * 1.1
- Special case: `"約 0%"` when value is 0

**Example**:
```typescript
formatAnnualizedReturn(800)  // => "約 720-880%"
formatAnnualizedReturn(547.5)  // => "約 493-602%"
formatAnnualizedReturn(0)    // => "約 0%"
```

**Contract**:
- ✅ Rounds to nearest integer
- ✅ Always positive range (min ≥ 0)
- ✅ Handles zero as special case
- ⚠️ Does NOT validate negative values (will display negative range)

---

### formatSingleFundingReturn

**Signature**:
```typescript
function formatSingleFundingReturn(
  spreadPercent: number,
  timeBasis: TimeBasis
): string
```

**Parameters**:
- `spreadPercent: number` - 費率差異百分比（如 0.73 表示 0.73%）
- `timeBasis: TimeBasis` - 時間基準（1, 4, 8, 24 小時）

**Returns**: `string`
- Format: `"約 {value}%（每 {timeBasis} 小時結算一次）"`
- Value formatted to 2 decimal places

**Example**:
```typescript
formatSingleFundingReturn(0.73, 8)   // => "約 0.73%（每 8 小時結算一次）"
formatSingleFundingReturn(0.25, 4)   // => "約 0.25%（每 4 小時結算一次）"
formatSingleFundingReturn(0.125, 1)  // => "約 0.13%（每 1 小時結算一次）"
```

**Contract**:
- ✅ Always 2 decimal places
- ✅ Includes time basis in Chinese
- ✅ Rounds using standard rounding rules

---

### formatPriceDiffWithExplanation

**Signature**:
```typescript
function formatPriceDiffWithExplanation(
  priceDiffPercent: number | null
): string
```

**Parameters**:
- `priceDiffPercent: number | null` - 價格差異百分比（可為 null）

**Returns**: `string`
- Non-null: `"{sign}{value}%（{symbol} {explanation}）"`
  - sign: `"+"` for positive, `"-"` for negative, empty for zero
  - symbol: `"✓"` for positive/zero, `"✗"` for negative
  - explanation: describes favorability for position closing
- Null: `"N/A（無價格數據）"`

**Example**:
```typescript
formatPriceDiffWithExplanation(0.15)
// => "+0.15%（✓ 做空方價格較高，有利平倉）"

formatPriceDiffWithExplanation(-0.10)
// => "-0.10%（✗ 做多方價格較高，不利平倉）"

formatPriceDiffWithExplanation(0)
// => "+0.00%（✓ 做空方價格較高，有利平倉）"

formatPriceDiffWithExplanation(null)
// => "N/A（無價格數據）"
```

**Contract**:
- ✅ Null-safe (handles null gracefully)
- ✅ Explicit sign for positive values (`"+0.15%"`)
- ✅ Clear favorable/unfavorable indication
- ✅ Always 2 decimal places for non-null values
- ⚠️ Zero is treated as favorable (positive case)

---

## Existing Functions (No Changes)

### formatSymbolDisplay

**Signature**:
```typescript
export function formatSymbolDisplay(symbol: string): string
```

**Contract**:
- Converts `"BTCUSDT"` → `"BTC/USDT"`
- Handles symbols ending with `"USDT"`
- Fallback: returns original symbol if not matching pattern

**Example**:
```typescript
formatSymbolDisplay("BTCUSDT")  // => "BTC/USDT"
formatSymbolDisplay("ETHUSDT")  // => "ETH/USDT"
```

---

### getExchangeDisplayName

**Signature**:
```typescript
export function getExchangeDisplayName(exchange: ExchangeName): string
```

**Contract**:
- Maps exchange name to uppercase display name
- Type-safe mapping using const object

**Example**:
```typescript
getExchangeDisplayName('binance')  // => "BINANCE"
getExchangeDisplayName('okx')      // => "OKX"
getExchangeDisplayName('gateio')   // => "GATE"
```

---

## Message Format Contract

### Structure

```
=======
【套套摳訊】

📌
{symbol}
做多：{longExchange}（交易所）
做空：{shortExchange}（交易所）

📈 收益評估：
 • 預估年化收益：{annualizedReturn}（資金費率價差）
 • 單次費率收益：{singleReturn}（每 {timeBasis} 小時結算一次）
 • 價格偏差：{priceDiff}

🧾 下單小提醒：
 • 請使用全倉 + 低倍槓桿（最多 2～3 倍）
 • 兩邊市價一起敲，兩邊顆數要一樣

🚨 風險提示：
 • 價格偏差為負表示不利，可能影響平倉收益
 • 資金費率可能波動，請持續觀察
=======
```

### Character Encoding
- UTF-8 encoded
- Contains Chinese characters (繁體中文)
- Contains Emoji (📌, 📈, 🧾, 🚨, ✓, ✗)
- Newline: `\n` (LF)

### Sections (Order Preserved)
1. Header: `【套套摳訊】`
2. Symbol and Exchanges
3. 收益評估 (Profit Assessment)
4. 下單小提醒 (Trading Tips) - Static content
5. 風險提示 (Risk Warnings) - Static content
6. Footer: `=======`

---

## Breaking Changes from Previous Version

### Removed

- ❌ `formatPercentageRange(value: number | null): string`
  - **Reason**: Incorrect logic (multiplied by 100 when value was already percentage)
  - **Migration**: Use specific formatters instead:
    - For annualized return: `formatAnnualizedReturn()`
    - For single return: `formatSingleFundingReturn()`
    - For price diff: `formatPriceDiffWithExplanation()`

### Modified

- ✅ `formatArbitrageMessage(rate: MarketRate)` → `formatArbitrageMessage(rate: MarketRate, timeBasis?: TimeBasis)`
  - **Added**: Optional `timeBasis` parameter (default: 8)
  - **Backward compatible**: Existing calls without `timeBasis` still work

### Message Content Changes

| Element | Before | After |
|---------|--------|-------|
| Section title | 📈 目前利潤預估 | 📈 收益評估 |
| First item | 目前價差：約 6-9% | 預估年化收益：約 720-880%（資金費率價差） |
| Second item | 目前資費差：約 2-4% | 單次費率收益：約 0.73%（每 8 小時結算一次） |
| Third item | (none) | 價格偏差：+0.15%（✓ 做空方價格較高，有利平倉） |

**Impact**:
- ✅ More accurate values (fixed calculation error)
- ✅ More informative (added terminology explanations)
- ✅ Better risk communication (added price diff explanation)
- ⚠️ Message format changed (may affect users expecting old format)

---

## Testing Contract

### Unit Tests Required

```typescript
// formatAnnualizedReturn
✅ Normal values (positive numbers)
✅ Zero value
✅ Large values (> 1000%)
✅ Small values (< 100%)
⚠️ Negative values (edge case, document behavior)

// formatSingleFundingReturn
✅ All time bases (1, 4, 8, 24)
✅ Different spread values
✅ Rounding behavior

// formatPriceDiffWithExplanation
✅ Positive values
✅ Negative values
✅ Zero value
✅ Null value
✅ Very small values (< 0.01%)

// formatArbitrageMessage
✅ Complete message format
✅ All fields present
✅ Correct emoji and Chinese characters
✅ Default timeBasis (8)
✅ Custom timeBasis (1, 4, 24)
✅ Error when bestPair is null
```

### Integration Tests Required

```typescript
✅ RateRow copy button triggers formatArbitrageMessage
✅ Formatted message copies to clipboard
✅ Copy status updates correctly (idle → success → idle)
✅ Error handling when clipboard API fails
```

---

## Performance Contract

### Complexity
- **Time**: O(1) - All operations are constant time
- **Space**: O(1) - No dynamic memory allocation based on input size

### Benchmarks (Target)
- `formatArbitrageMessage()`: < 10ms per call
- Individual formatters: < 1ms per call
- No memory leaks
- No unnecessary string allocations

### Constraints
- ✅ Synchronous execution
- ✅ No I/O operations
- ✅ No network calls
- ✅ No DOM manipulation

---

## Security Contract

### Input Validation
- ✅ Type checking via TypeScript
- ✅ Null/undefined checks for optional values
- ❌ Does NOT sanitize for XSS (clipboard is safe)
- ❌ Does NOT validate numerical ranges (trusts input data)

### Output Safety
- ✅ No HTML injection (plain text output)
- ✅ No script injection (no executable code)
- ✅ Safe for clipboard API

### Data Privacy
- ✅ No sensitive data logging
- ✅ No external data transmission
- ✅ No data persistence

---

## Summary

| Contract Element | Status |
|-----------------|--------|
| Type Safety | ✅ Enforced by TypeScript |
| Null Safety | ✅ Explicit handling |
| Pure Functions | ✅ No side effects |
| Backward Compatibility | ✅ Optional parameter |
| Error Handling | ✅ Throws on invalid input |
| Performance | ✅ O(1) complexity |
| Security | ✅ Safe output |
| Testing | ✅ Comprehensive coverage |

**Next**: Generate quickstart.md for development guide
