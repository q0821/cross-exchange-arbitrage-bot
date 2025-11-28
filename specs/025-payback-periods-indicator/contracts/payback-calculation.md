# Contract: 價差回本次數計算

**Feature**: `025-payback-periods-indicator`
**Contract Type**: Frontend Calculation Function
**Date**: 2025-01-28

---

## Function Contract: `calculatePaybackPeriods()`

### Purpose

計算並判斷套利機會的價差回本狀態，幫助交易者快速評估風險。

### Signature

```typescript
function calculatePaybackPeriods(
  priceDiffPercent: number | null,
  spreadPercent: number,
  timeBasis: number
): PaybackResult
```

---

## Input Parameters

### `priceDiffPercent: number | null`

**描述**: 價差百分比（考慮方向）

**來源**: `BestArbitragePair.priceDiffPercent`

**計算公式** (來自後端):
```typescript
priceDiffPercent = ((shortPrice - longPrice) / avgPrice) * 100
```

**值範圍**:
- `null`: 無價格數據（至少一個交易所價格缺失）
- `-100 ~ 0`: 價差不利（做多交易所價格 > 做空交易所價格）
- `0`: 價差中性（兩交易所價格相等）
- `0 ~ 100`: 價差有利（做空交易所價格 > 做多交易所價格）

**範例**:
```typescript
// 幣安 (做多) = 100 USDT, OKX (做空) = 99.85 USDT
priceDiffPercent = ((99.85 - 100) / 99.925) * 100 = -0.15%
// => 價差不利（建倉會有損失）

// 幣安 (做多) = 100 USDT, OKX (做空) = 100.15 USDT
priceDiffPercent = ((100.15 - 100) / 100.075) * 100 = +0.15%
// => 價差有利（建倉立即獲利）
```

---

### `spreadPercent: number`

**描述**: 費率差異百分比（絕對值）

**來源**: `BestArbitragePair.spreadPercent`

**計算公式** (來自後端):
```typescript
spreadPercent = Math.abs(shortRate - longRate) * 100
```

**值範圍**:
- `0 ~ 1`: 正常範圍（例如 0.05% = 每次收取 0.05% 資金費率）
- `> 1`: 極端情況（罕見）

**約束條件**:
- ✅ 必須 ≥ 0（絕對值保證）
- ⚠️ 若 = 0，表示兩交易所費率相同，無法透過資費回本

**範例**:
```typescript
// 幣安費率 = 0.01%, OKX 費率 = -0.04%
spreadPercent = Math.abs(-0.04 - 0.01) * 100 = 0.05%
// => 每次收取資費可獲得 0.05% 收益
```

---

### `timeBasis: number`

**描述**: 資金費率結算時間基準（小時）

**來源**: 前端 state（由使用者選擇或預設）

**可能值**:
- `1`: 每小時結算（如 Binance USD-M 永續合約）
- `4`: 每 4 小時結算
- `8`: 每 8 小時結算（如 OKX、Binance COIN-M）
- `24`: 每日結算（罕見）

**用途**: 計算預估回本時間（小時）

**範例**:
```typescript
// 回本次數 = 3.0, 時間基準 = 8h
estimatedHours = 3.0 × 8 = 24 小時（約 1 天）
```

---

## Output: `PaybackResult`

### Type Definition

```typescript
interface PaybackResult {
  status: 'favorable' | 'payback_needed' | 'too_many' | 'impossible' | 'no_data'
  periods?: number
  estimatedHours?: number
  displayText: string
  color: 'green' | 'orange' | 'red' | 'gray'
  details?: {
    priceDiff: number | null
    rateSpread: number
    formula: string
    warning?: string
  }
}
```

### Field Specifications

#### `status`

| Value | Condition | Meaning |
|-------|-----------|---------|
| `favorable` | `priceDiffPercent >= 0` | 價差有利，建倉立即有正報酬 |
| `payback_needed` | `priceDiffPercent < 0` AND `1 <= periods <= 100` | 需要回本，但次數合理 |
| `too_many` | `priceDiffPercent < 0` AND `periods > 100` | 回本次數過多，高風險 |
| `impossible` | `priceDiffPercent < 0` AND `spreadPercent == 0` | 無法回本（費率差為零） |
| `no_data` | `priceDiffPercent == null` | 無價格數據 |

#### `periods` (optional)

**條件**: 僅當 `status` 為 `payback_needed` 或 `too_many` 時存在

**計算公式**:
```typescript
periods = Math.abs(priceDiffPercent) / spreadPercent
```

**精度**: 小數點後 1 位（使用 `toFixed(1)`）

**範例**:
```typescript
// priceDiffPercent = -0.15%, spreadPercent = 0.05%
periods = 0.15 / 0.05 = 3.0
```

#### `estimatedHours` (optional)

**條件**: 僅當 `periods` 存在時計算

**計算公式**:
```typescript
estimatedHours = periods * timeBasis
```

**精度**: 小數點後 1 位

**範例**:
```typescript
// periods = 3.0, timeBasis = 8
estimatedHours = 3.0 × 8 = 24.0 小時
```

#### `displayText`

**格式規範**:

| Status | Format | Example |
|--------|--------|---------|
| `favorable` | `✓ 價差有利` | `✓ 價差有利` |
| `payback_needed` | `⚠️ 需 {X.X} 次資費回本` | `⚠️ 需 3.0 次資費回本` |
| `too_many` | `❌ 回本次數過多 ({X}+ 次)` | `❌ 回本次數過多 (150+ 次)` |
| `impossible` | `無法回本（費率差為零）` | `無法回本（費率差為零）` |
| `no_data` | `N/A（無價格數據）` | `N/A（無價格數據）` |

**Unicode 字元**:
- ✓ (U+2713): Check mark
- ⚠️ (U+26A0 + U+FE0F): Warning sign with emoji variation
- ❌ (U+274C): Cross mark

#### `color`

**映射規則**:

| Status | Color | CSS Class Example |
|--------|-------|-------------------|
| `favorable` | `green` | `text-green-500` |
| `payback_needed` | `orange` | `text-orange-500` |
| `too_many` | `red` | `text-red-500` |
| `impossible` | `red` | `text-red-500` |
| `no_data` | `gray` | `text-gray-400` |

#### `details` (optional)

**用途**: 提供 Tooltip 詳細資訊

**範例 (payback_needed)**:
```typescript
details: {
  priceDiff: -0.15,
  rateSpread: 0.05,
  formula: '回本次數 = |價差| ÷ 費率差 = 0.15% ÷ 0.05% = 3.0 次',
  warning: undefined
}
```

**範例 (favorable)**:
```typescript
details: {
  priceDiff: 0.15,
  rateSpread: 0.03,
  formula: '價差有利表示建倉即有正報酬，無需等待資費收取',
  warning: undefined
}
```

**範例 (too_many)**:
```typescript
details: {
  priceDiff: -0.50,
  rateSpread: 0.01,
  formula: '回本次數 = 0.50% ÷ 0.01% = 50 次',
  warning: '⚠️ 注意：回本次數過多，費率可能在持倉期間波動，風險較高'
}
```

---

## Behavior Specification

### Case 1: 價差有利 (Favorable)

**Input**:
```typescript
priceDiffPercent = 0.15
spreadPercent = 0.03
timeBasis = 8
```

**Output**:
```typescript
{
  status: 'favorable',
  periods: undefined,
  estimatedHours: undefined,
  displayText: '✓ 價差有利',
  color: 'green',
  details: {
    priceDiff: 0.15,
    rateSpread: 0.03,
    formula: '價差有利表示建倉即有正報酬，無需等待資費收取',
    warning: undefined
  }
}
```

**Rationale**: 做空價格 > 做多價格，建倉時已獲利 0.15%

---

### Case 2: 需要回本 (Payback Needed)

**Input**:
```typescript
priceDiffPercent = -0.15
spreadPercent = 0.05
timeBasis = 8
```

**Output**:
```typescript
{
  status: 'payback_needed',
  periods: 3.0,
  estimatedHours: 24.0,
  displayText: '⚠️ 需 3.0 次資費回本',
  color: 'orange',
  details: {
    priceDiff: -0.15,
    rateSpread: 0.05,
    formula: '回本次數 = |價差| ÷ 費率差 = 0.15% ÷ 0.05% = 3.0 次',
    warning: undefined
  }
}
```

**Rationale**: 建倉虧損 0.15%，每次收取 0.05% 資費，需 3 次才能回本

---

### Case 3: 回本次數過多 (Too Many)

**Input**:
```typescript
priceDiffPercent = -0.50
spreadPercent = 0.01
timeBasis = 8
```

**Output**:
```typescript
{
  status: 'too_many',
  periods: 50.0,
  estimatedHours: 400.0,
  displayText: '❌ 回本次數過多 (50+ 次)',
  color: 'red',
  details: {
    priceDiff: -0.50,
    rateSpread: 0.01,
    formula: '回本次數 = 0.50% ÷ 0.01% = 50 次',
    warning: '⚠️ 注意：回本次數過多，費率可能在持倉期間波動，風險較高'
  }
}
```

**Rationale**: 需要 50 次（400 小時 = 16.7 天），費率波動風險極高

---

### Case 4: 無法回本 (Impossible)

**Input**:
```typescript
priceDiffPercent = -0.15
spreadPercent = 0  // 費率差為零
timeBasis = 8
```

**Output**:
```typescript
{
  status: 'impossible',
  periods: undefined,
  estimatedHours: undefined,
  displayText: '無法回本（費率差為零）',
  color: 'red',
  details: {
    priceDiff: -0.15,
    rateSpread: 0,
    formula: '費率差為零，無法透過收取資費來回本',
    warning: undefined
  }
}
```

**Rationale**: 沒有資費收益，永遠無法抵銷價差損失

---

### Case 5: 無價格數據 (No Data)

**Input**:
```typescript
priceDiffPercent = null  // 至少一個交易所價格缺失
spreadPercent = 0.05
timeBasis = 8
```

**Output**:
```typescript
{
  status: 'no_data',
  periods: undefined,
  estimatedHours: undefined,
  displayText: 'N/A（無價格數據）',
  color: 'gray',
  details: undefined
}
```

**Rationale**: 無法計算價差，無法判斷回本狀態

---

## Edge Cases & Error Handling

| Edge Case | Input | Expected Behavior |
|-----------|-------|-------------------|
| 價差為零 | `priceDiffPercent = 0` | 視為 `favorable`（沒有損失） |
| 費率差為負數 | `spreadPercent = -0.05` | 取絕對值：`Math.abs(spreadPercent)` |
| 極小價差 | `priceDiffPercent = -0.001` | 正常計算，可能回本次數 < 1 |
| 極大回本次數 | `periods = 9999` | 顯示 `❌ 回本次數過多 (9999+ 次)` |
| 時間基準異常 | `timeBasis = 0` 或 `999` | 預設使用 `8`（容錯處理） |
| NaN 輸入 | `priceDiffPercent = NaN` | 視為 `no_data` |

---

## Performance Requirements

| Metric | Target | Measurement |
|--------|--------|-------------|
| 單次計算時間 | < 0.1ms | 單一除法運算 |
| 200 個交易對計算 | < 100ms | 批次計算測試 |
| 記憶體佔用 | < 170 bytes/pair | PaybackResult 物件大小 |

---

## Testing Contract

### Unit Test Cases (Vitest)

```typescript
describe('calculatePaybackPeriods()', () => {
  it('should return favorable when price diff is positive', () => {
    const result = calculatePaybackPeriods(0.15, 0.03, 8)
    expect(result.status).toBe('favorable')
    expect(result.displayText).toBe('✓ 價差有利')
    expect(result.color).toBe('green')
  })

  it('should calculate payback periods correctly', () => {
    const result = calculatePaybackPeriods(-0.15, 0.05, 8)
    expect(result.status).toBe('payback_needed')
    expect(result.periods).toBe(3.0)
    expect(result.estimatedHours).toBe(24.0)
  })

  it('should warn when payback periods > 100', () => {
    const result = calculatePaybackPeriods(-0.50, 0.01, 8)
    expect(result.status).toBe('too_many')
    expect(result.displayText).toContain('50+ 次')
  })

  it('should handle zero spread gracefully', () => {
    const result = calculatePaybackPeriods(-0.15, 0, 8)
    expect(result.status).toBe('impossible')
    expect(result.displayText).toContain('費率差為零')
  })

  it('should handle null price diff', () => {
    const result = calculatePaybackPeriods(null, 0.05, 8)
    expect(result.status).toBe('no_data')
    expect(result.displayText).toBe('N/A（無價格數據）')
  })

  it('should use toFixed(1) for precision', () => {
    const result = calculatePaybackPeriods(-0.123, 0.045, 8)
    expect(result.periods).toBe(2.7)  // 0.123 / 0.045 = 2.733... => 2.7
  })
})
```

---

## Versioning

**Version**: 1.0
**Compatibility**: TypeScript 5.6+, React 18+
**Breaking Changes**: N/A (initial implementation)

---

## Summary

- ✅ **Pure Function**: 無副作用，易於測試
- ✅ **Type Safe**: 完整的 TypeScript 型別定義
- ✅ **Edge Case Handling**: 所有邊界情況都有明確處理
- ✅ **Performance Optimized**: 單次計算 < 0.1ms
- ✅ **User-Friendly Output**: displayText 和 color 直接可用於 UI 渲染

**實作位置**: `app/(dashboard)/market-monitor/utils/rateCalculations.ts`
