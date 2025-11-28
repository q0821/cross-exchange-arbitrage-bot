# Data Model: 價差回本週期指標

**Feature**: `025-payback-periods-indicator`
**Date**: 2025-01-28

## Overview

此功能為純前端計算功能，**不涉及資料庫變更**。所有計算基於現有的 `BestArbitragePair` 資料結構，透過 WebSocket 即時推送到前端。

---

## Existing Data Structures (No Changes)

### BestArbitragePair (from WebSocket)

```typescript
interface BestArbitragePair {
  symbol: string
  longExchange: string
  shortExchange: string
  longRate: number           // 做多交易所的資金費率
  shortRate: number          // 做空交易所的資金費率
  spreadPercent: number      // 費率差異百分比（絕對值）

  longPrice: number | null   // 做多交易所價格
  shortPrice: number | null  // 做空交易所價格
  priceDiffPercent: number | null  // 價差百分比（已考慮方向）

  // ... 其他欄位（longFee, shortFee, etc.）
}
```

**關鍵欄位說明**:
- `priceDiffPercent`: 價差百分比，**正值**表示價差有利（做空價 > 做多價），**負值**表示價差不利
- `spreadPercent`: 費率差異百分比（絕對值），用於計算回本次數的分母

---

## New Frontend Types (TypeScript Only)

### PaybackResult

```typescript
/**
 * 價差回本次數計算結果
 */
interface PaybackResult {
  /**
   * 回本狀態
   * - favorable: 價差有利（立即有正報酬）
   * - payback_needed: 需要回本（1-100 次資費）
   * - too_many: 回本次數過多（> 100 次）
   * - impossible: 無法回本（費率差為零或負數）
   * - no_data: 無價格數據
   */
  status: 'favorable' | 'payback_needed' | 'too_many' | 'impossible' | 'no_data'

  /**
   * 回本次數（僅當 status = 'payback_needed' 或 'too_many' 時有值）
   * 精度：小數點後 1 位
   */
  periods?: number

  /**
   * 預估回本時間（小時）
   * 計算公式：periods × timeBasis
   */
  estimatedHours?: number

  /**
   * 顯示文字（用於 UI 渲染）
   * 範例：
   * - "✓ 價差有利"
   * - "⚠️ 需 3.0 次資費回本"
   * - "❌ 回本次數過多 (50+ 次)"
   * - "無法回本（費率差為零）"
   * - "N/A（無價格數據）"
   */
  displayText: string

  /**
   * 顯示顏色（用於 UI 樣式）
   */
  color: 'green' | 'orange' | 'red' | 'gray'

  /**
   * 詳細資訊（用於 Tooltip）
   */
  details?: {
    priceDiff: number | null    // 當前價差百分比
    rateSpread: number          // 當前費率差百分比
    formula: string             // 計算公式說明
    warning?: string            // 警告訊息（如有）
  }
}
```

**Usage Example**:
```typescript
const result: PaybackResult = calculatePaybackPeriods(
  priceDiffPercent,
  spreadPercent,
  timeBasis
)

// Rendering
<div className={`text-${result.color}-500`}>
  {result.displayText}
</div>
```

---

## Function Signatures

### calculatePaybackPeriods()

```typescript
/**
 * 計算價差回本次數
 *
 * @param priceDiffPercent - 價差百分比（來自 BestArbitragePair.priceDiffPercent）
 *   - 正值：價差有利（做空價 > 做多價）
 *   - 負值：價差不利（做空價 < 做多價）
 *   - null：無價格數據
 *
 * @param spreadPercent - 費率差異百分比（來自 BestArbitragePair.spreadPercent）
 *   - 必須為正數
 *   - 若為 0，表示無法回本
 *
 * @param timeBasis - 時間基準（小時）
 *   - 可能值：1 | 4 | 8 | 24
 *   - 用於計算預估回本時間
 *
 * @returns PaybackResult - 計算結果物件
 *
 * @example
 * // 情境 1：價差不利，需回本
 * calculatePaybackPeriods(-0.15, 0.05, 8)
 * // => { status: 'payback_needed', periods: 3.0, displayText: '⚠️ 需 3.0 次資費回本', ... }
 *
 * // 情境 2：價差有利
 * calculatePaybackPeriods(0.10, 0.03, 8)
 * // => { status: 'favorable', displayText: '✓ 價差有利', color: 'green', ... }
 *
 * // 情境 3：無價格數據
 * calculatePaybackPeriods(null, 0.05, 8)
 * // => { status: 'no_data', displayText: 'N/A（無價格數據）', color: 'gray', ... }
 */
function calculatePaybackPeriods(
  priceDiffPercent: number | null,
  spreadPercent: number,
  timeBasis: number
): PaybackResult
```

---

## Data Flow

```
Backend (CLI Monitor)
│
├─ 計算 priceDiffPercent
│  └─ 公式：((shortPrice - longPrice) / avgPrice) * 100
│
├─ 計算 spreadPercent
│  └─ 公式：Math.abs(shortRate - longRate) * 100
│
├─ 組裝 BestArbitragePair 物件
│
└─ WebSocket 推送 (每 5 秒)
    │
    ▼
Frontend (market-monitor 頁面)
│
├─ useMarketRates Hook 接收資料
│
├─ RatesTable 組件渲染
│
└─ RateRow 組件（每個交易對）
    │
    ├─ 呼叫 calculatePaybackPeriods()
    │   └─ 輸入：priceDiffPercent, spreadPercent, timeBasis
    │   └─ 輸出：PaybackResult
    │
    ├─ 渲染主要指標（displayText）
    │
    └─ Tooltip 顯示詳細資訊（details）
```

**關鍵點**:
1. ✅ **無新增資料來源**：所有計算基於現有 WebSocket 資料
2. ✅ **無資料庫變更**：純記憶體計算，不持久化
3. ✅ **即時計算**：每次 WebSocket 推送後重新計算（每 5 秒）
4. ✅ **狀態管理**：利用 React state（timeBasis）驅動重新計算

---

## Memory Footprint Analysis

**單個 PaybackResult 物件大小**:
```typescript
{
  status: 'payback_needed',  // 16 bytes (string)
  periods: 3.0,              // 8 bytes (number)
  estimatedHours: 24.0,      // 8 bytes (number)
  displayText: '...',        // ~30 bytes (short string)
  color: 'orange',           // 8 bytes (string)
  details: { ... }           // ~100 bytes (object)
}
// Total: ~170 bytes per pair
```

**200 個交易對記憶體使用**:
- 170 bytes × 200 = **34 KB**
- **結論**：記憶體影響可忽略不計

---

## No Database Migrations

**Prisma Schema**: 無變更
**Migrations**: 無需執行
**Seed Data**: 無需更新

此功能完全在前端實作，不涉及任何資料持久化。

---

## Type Definition Location

**新增檔案**（建議）:
```
app/(dashboard)/market-monitor/types/payback.ts
```

**或整合到現有檔案**:
```
app/(dashboard)/market-monitor/types.ts  // 如果已存在
```

**Export**:
```typescript
export type { PaybackResult }
```

---

## Validation Rules

雖然此功能為純顯示邏輯，但仍需驗證輸入資料：

| 欄位 | 驗證規則 | 錯誤處理 |
|------|---------|---------|
| `priceDiffPercent` | 允許 null，數字範圍 -100 ~ 100 | 回傳 `no_data` |
| `spreadPercent` | 必須 ≥ 0 | 若 < 0，視為 0（回傳 `impossible`） |
| `timeBasis` | 必須為 1, 4, 8, 或 24 | 預設使用 8（若異常） |

**驗證位置**：在 `calculatePaybackPeriods()` 函數內部執行

---

## Summary

- ✅ **無資料庫變更**：完全前端計算
- ✅ **無新增 API**：利用現有 WebSocket 資料流
- ✅ **型別安全**：定義 `PaybackResult` 介面
- ✅ **記憶體效率**：每個交易對僅 170 bytes
- ✅ **驗證完整**：邊界情況全部處理

**下一步**：設計 Contracts（計算函數規範）
