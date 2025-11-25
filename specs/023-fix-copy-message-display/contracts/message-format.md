# Message Format Contract

**Feature**: 023-fix-copy-message-display
**Created**: 2025-11-25
**Output Format**: Plain Text (UTF-8)

## Complete Message Template

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

## Variable Definitions

### {symbol}
- **Format**: `"{BASE}/{QUOTE}"`
- **Example**: `"BTC/USDT"`, `"ETH/USDT"`
- **Source**: `formatSymbolDisplay(rate.symbol)`

### {longExchange}
- **Format**: `"{EXCHANGE}（交易所）"`
- **Example**: `"BINANCE（交易所）"`, `"OKX（交易所）"`
- **Source**: `getExchangeDisplayName(rate.bestPair.longExchange)`

### {shortExchange}
- **Format**: `"{EXCHANGE}（交易所）"`
- **Example**: `"OKX（交易所）"`, `"GATE（交易所）"`
- **Source**: `getExchangeDisplayName(rate.bestPair.shortExchange)`

### {annualizedReturn}
- **Format**: `"約 {min}-{max}%（資金費率價差）"`
- **Example**: `"約 720-880%（資金費率價差）"`
- **Source**: `formatAnnualizedReturn(rate.bestPair.annualizedReturn)`
- **Range**: ±10% of base value
- **Special Case**: `"約 0%"` when value is 0

### {singleReturn}
- **Format**: `"約 {value}%（每 {hours} 小時結算一次）"`
- **Example**: `"約 0.73%（每 8 小時結算一次）"`
- **Source**: `formatSingleFundingReturn(rate.bestPair.spreadPercent, timeBasis)`
- **Precision**: 2 decimal places

### {priceDiff}
- **Format (positive)**: `"+{value}%（✓ 做空方價格較高，有利平倉）"`
- **Format (negative)**: `"-{value}%（✗ 做多方價格較高，不利平倉）"`
- **Format (null)**: `"N/A（無價格數據）"`
- **Example**: `"+0.15%（✓ 做空方價格較高，有利平倉）"`
- **Source**: `formatPriceDiffWithExplanation(rate.bestPair.priceDiffPercent)`
- **Precision**: 2 decimal places

## Example Messages

### Example 1: Normal Arbitrage Opportunity

**Input**:
```typescript
{
  symbol: 'BTCUSDT',
  bestPair: {
    longExchange: 'binance',
    shortExchange: 'okx',
    spreadPercent: 0.73,
    annualizedReturn: 800,
    priceDiffPercent: 0.15
  }
}
timeBasis: 8
```

**Output**:
```
=======
【套套摳訊】

📌
BTC/USDT
做多：BINANCE（交易所）
做空：OKX（交易所）

📈 收益評估：
 • 預估年化收益：約 720-880%（資金費率價差）
 • 單次費率收益：約 0.73%（每 8 小時結算一次）
 • 價格偏差：+0.15%（✓ 做空方價格較高，有利平倉）

🧾 下單小提醒：
 • 請使用全倉 + 低倍槓桿（最多 2～3 倍）
 • 兩邊市價一起敲，兩邊顆數要一樣

🚨 風險提示：
 • 價格偏差為負表示不利，可能影響平倉收益
 • 資金費率可能波動，請持續觀察
=======
```

---

### Example 2: Negative Price Difference

**Input**:
```typescript
{
  symbol: 'ETHUSDT',
  bestPair: {
    longExchange: 'okx',
    shortExchange: 'gateio',
    spreadPercent: 0.54,
    annualizedReturn: 591,
    priceDiffPercent: -0.08
  }
}
timeBasis: 8
```

**Output**:
```
=======
【套套摳訊】

📌
ETH/USDT
做多：OKX（交易所）
做空：GATE（交易所）

📈 收益評估：
 • 預估年化收益：約 532-650%（資金費率價差）
 • 單次費率收益：約 0.54%（每 8 小時結算一次）
 • 價格偏差：-0.08%（✗ 做多方價格較高，不利平倉）

🧾 下單小提醒：
 • 請使用全倉 + 低倍槓桿（最多 2～3 倍）
 • 兩邊市價一起敲，兩邊顆數要一樣

🚨 風險提示：
 • 價格偏差為負表示不利，可能影響平倉收益
 • 資金費率可能波動，請持續觀察
=======
```

---

### Example 3: Missing Price Data

**Input**:
```typescript
{
  symbol: 'SOLUSDT',
  bestPair: {
    longExchange: 'binance',
    shortExchange: 'mexc',
    spreadPercent: 0.62,
    annualizedReturn: 679,
    priceDiffPercent: null
  }
}
timeBasis: 8
```

**Output**:
```
=======
【套套摳訊】

📌
SOL/USDT
做多：BINANCE（交易所）
做空：MEXC（交易所）

📈 收益評估：
 • 預估年化收益：約 611-747%（資金費率價差）
 • 單次費率收益：約 0.62%（每 8 小時結算一次）
 • 價格偏差：N/A（無價格數據）

🧾 下單小提醒：
 • 請使用全倉 + 低倍槓桿（最多 2～3 倍）
 • 兩邊市價一起敲，兩邊顆數要一樣

🚨 風險提示：
 • 價格偏差為負表示不利，可能影響平倉收益
 • 資金費率可能波動，請持續觀察
=======
```

---

### Example 4: Different Time Basis (4 hours)

**Input**:
```typescript
{
  symbol: 'BNBUSDT',
  bestPair: {
    longExchange: 'okx',
    shortExchange: 'binance',
    spreadPercent: 0.25,
    annualizedReturn: 547.5,
    priceDiffPercent: 0.03
  }
}
timeBasis: 4
```

**Output**:
```
=======
【套套摳訊】

📌
BNB/USDT
做多：OKX（交易所）
做空：BINANCE（交易所）

📈 收益評估：
 • 預估年化收益：約 493-602%（資金費率價差）
 • 單次費率收益：約 0.25%（每 4 小時結算一次）
 • 價格偏差：+0.03%（✓ 做空方價格較高，有利平倉）

🧾 下單小提醒：
 • 請使用全倉 + 低倍槓桿（最多 2～3 倍）
 • 兩邊市價一起敲，兩邊顆數要一樣

🚨 風險提示：
 • 價格偏差為負表示不利，可能影響平倉收益
 • 資金費率可能波動，請持續觀察
=======
```

---

## Character Encoding Details

### Encoding
- **Standard**: UTF-8
- **BOM**: None (BOM-less UTF-8)

### Special Characters
| Character | Unicode | Category |
|-----------|---------|----------|
| 📌 | U+1F4CC | Emoji (Pushpin) |
| 📈 | U+1F4C8 | Emoji (Chart Increasing) |
| 🧾 | U+1F9FE | Emoji (Receipt) |
| 🚨 | U+1F6A8 | Emoji (Police Car Light) |
| ✓ | U+2713 | Symbol (Check Mark) |
| ✗ | U+2717 | Symbol (Ballot X) |
| • | U+2022 | Symbol (Bullet) |

### Line Endings
- **Format**: LF (`\n`)
- **NOT**: CRLF (`\r\n`)

---

## Formatting Rules

### Spacing
```
Line 1: "======="
Line 2: "【套套摳訊】"
Line 3: (empty)
Line 4: "📌"
Line 5: "{symbol}"
Line 6: "做多：{longExchange}（交易所）"
...
```

- No leading spaces on any line (except bullet points)
- Bullet points have 1 space prefix: ` • `
- No trailing spaces

### Section Markers
- **Header**: `"======="`
- **Footer**: `"======="`
- Both exactly 7 equals signs
- No spaces

### Bullet Points
- Symbol: `•` (U+2022)
- Format: ` • {text}`
- Prefix: 1 space before bullet
- No space after bullet (directly followed by text)

---

## Validation Regex

### Full Message Structure
```regex
/^=======\n【套套摳訊】\n\n📌\n.+\n做多：.+（交易所）\n做空：.+（交易所）\n\n📈 收益評估：\n • 預估年化收益：約 \d+-\d+%（資金費率價差）\n • 單次費率收益：約 \d+\.\d{2}%（每 [1|4|8|24] 小時結算一次）\n • 價格偏差：.+\n\n🧾 下單小提醒：\n • 請使用全倉 \+ 低倍槓桿（最多 2～3 倍）\n • 兩邊市價一起敲，兩邊顆數要一樣\n\n🚨 風險提示：\n • 價格偏差為負表示不利，可能影響平倉收益\n • 資金費率可能波動，請持續觀察\n=======$/
```

### Individual Elements
```regex
// Annualized return
/約 \d+-\d+%（資金費率價差）/

// Single return
/約 \d+\.\d{2}%（每 [1|4|8|24] 小時結算一次）/

// Price diff (positive)
/\+\d+\.\d{2}%（✓ 做空方價格較高，有利平倉）/

// Price diff (negative)
/-\d+\.\d{2}%（✗ 做多方價格較高，不利平倉）/

// Price diff (null)
/N\/A（無價格數據）/
```

---

## Change History

### Version 2.0 (This Feature)

**Changed**:
- Section title: "目前利潤預估" → "收益評估"
- First item: "目前價差：約 6-9%" → "預估年化收益：約 720-880%（資金費率價差）"
- Second item: "目前資費差：約 2-4%" → "單次費率收益：約 0.73%（每 8 小時結算一次）"

**Added**:
- Third item: "價格偏差：+0.15%（✓ 做空方價格較高，有利平倉）"
- Time basis in single return
- Positive/negative indicators for price diff

**Fixed**:
- Calculation error (values were multiplied by 100 incorrectly)
- Misleading range estimates (now ±10% for annualized, exact for others)

### Version 1.0 (Previous)

- Original format with calculation errors
- No price difference explanation
- No time basis indication
- Inconsistent terminology

---

## Localization Notes

### Language
- **Primary**: 繁體中文 (Traditional Chinese, Taiwan)
- **Fallback**: N/A (no English version)

### Currency
- **Unit**: Percentage (%)
- **No currency symbols**: All values are percentages, not monetary amounts

### Number Format
- **Decimal separator**: `.` (period)
- **Thousands separator**: None (values don't exceed 1000)
- **Example**: `800%` not `800 %` or `800.0%`

---

## Summary

| Element | Specification |
|---------|--------------|
| Encoding | UTF-8 (no BOM) |
| Line Ending | LF (\n) |
| Total Lines | 18 |
| Emoji Count | 4 |
| Sections | 5 (Header, Symbol, Assessment, Tips, Warnings) |
| Dynamic Variables | 5 (symbol, exchanges, returns, price diff, time basis) |
| Static Content | 2 sections (Tips, Warnings) |
| Bullet Points | 6 total |

**Ready for**: Implementation and testing
