# Data Model: 市場監控頁面穩定排序

**Feature**: 009-specify-scripts-bash
**Date**: 2025-11-12

## Overview

本功能為前端顯示邏輯改進，不引入新的資料庫模型或 API 端點。本文件記錄與排序相關的前端狀態管理模型和資料結構。

## State Models

### 1. RatesDataModel

**用途**: 儲存交易對的最新資金費率資料

**結構**:
```typescript
type RatesDataModel = Map<string, MarketRate>;

interface MarketRate {
  symbol: string;                    // 交易對名稱 (e.g., "BTCUSDT")
  binanceRate: number | null;        // Binance 費率
  okxRate: number | null;            // OKX 費率
  mexcRate: number | null;           // MEXC 費率
  gateioRate: number | null;         // Gate.io 費率
  bestPair: {
    longExchange: string;            // 做多的交易所
    shortExchange: string;           // 做空的交易所
    spreadPercent: number;           // 費率差異百分比
    annualizedReturn: number;        // 年化收益
  } | null;
  status: 'opportunity' | 'approaching' | 'normal';
  timestamp: string;                 // 最後更新時間
}
```

**儲存位置**: React state in `useMarketRates` hook

**更新機制**:
- WebSocket `rates:update` 事件觸發
- 只更新 Map 中對應 symbol 的資料，不影響其他項目
- 不會觸發重新排序

---

### 2. SortPreferenceModel

**用途**: 儲存用戶的排序偏好設定

**結構**:
```typescript
interface SortPreferenceModel {
  sortBy: SortField;                // 排序欄位
  sortDirection: SortDirection;     // 排序方向
}

type SortField = 'symbol' | 'spread' | 'annualizedReturn' | 'netReturn';
type SortDirection = 'asc' | 'desc';
```

**儲存位置**:
1. React state in `useTableSort` hook (runtime)
2. localStorage (persistence)
   - Key: `market-monitor:sort-by`
   - Key: `market-monitor:sort-direction`

**預設值**:
```typescript
const DEFAULT_SORT_BY: SortField = 'symbol';        // 改為字母順序
const DEFAULT_SORT_DIRECTION: SortDirection = 'asc';  // 升序
```

**生命週期**:
- **初始化**: 從 localStorage 讀取，不存在則使用預設值
- **更新**: 用戶點擊欄位標題時觸發
- **持久化**: 每次更新時寫入 localStorage

---

### 3. SortedDisplayModel

**用途**: 維護固定的顯示順序，不因資料更新而改變

**結構**:
```typescript
type SortedSymbolsArray = string[];  // 排序後的 symbol 陣列

// 範例：
const sortedSymbols: SortedSymbolsArray = [
  'BTCUSDT',
  'ETHUSDT',
  'BNBUSDT',
  // ... 其他 symbol，順序固定
];
```

**計算邏輯**:
```typescript
const sortedSymbols = useMemo(() => {
  const symbols = Array.from(ratesMap.keys());

  return symbols.sort((a, b) => {
    const rateA = ratesMap.get(a)!;
    const rateB = ratesMap.get(b)!;

    // 主要排序
    let result = 0;
    switch (sortBy) {
      case 'symbol':
        result = a.localeCompare(b);
        break;
      case 'spread':
        const spreadA = rateA.bestPair?.spreadPercent ?? 0;
        const spreadB = rateB.bestPair?.spreadPercent ?? 0;
        result = spreadA - spreadB;
        break;
      // ... 其他欄位
    }

    // 次要排序：確保穩定性
    if (result === 0) {
      result = a.localeCompare(b);
    }

    return sortDirection === 'asc' ? result : -result;
  });
}, [sortBy, sortDirection]); // ✅ 只依賴排序參數，不依賴 ratesMap
```

**更新時機**: **只在**以下情況重新計算
1. 用戶改變 sortBy（點擊不同欄位）
2. 用戶改變 sortDirection（點擊同一欄位）
3. 用戶切換交易對群組（symbol 列表改變）

**不會觸發重新計算**: WebSocket 推送資料更新

---

## Data Flow

### Normal WebSocket Update (資料更新)

```
WebSocket Event
    ↓
useMarketRates.handleRatesUpdate()
    ↓
setRatesMap(prev => {
  const next = new Map(prev);
  rates.forEach(rate => next.set(rate.symbol, rate));  // 只更新值
  return next;
})
    ↓
RatesTable re-renders
    ↓
sortedSymbols from useMemo (cached, not re-computed) ✅
    ↓
displayRates = sortedSymbols.map(symbol => ratesMap.get(symbol))
    ↓
Each RateRow renders with updated data but same position ✅
```

**關鍵點**: `sortedSymbols` 的 useMemo 不依賴 `ratesMap`，所以不會重新計算排序。

---

### User Triggers Sort Change (用戶改變排序)

```
User clicks column header
    ↓
useTableSort.toggleSort(field)
    ↓
setSortBy(field) / setSortDirection(newDirection)
    ↓
localStorage.setItem('market-monitor:sort-by', field)  // 保存偏好
    ↓
sortedSymbols useMemo re-computes (sortBy changed) ✅
    ↓
New order: ['ETHUSDT', 'BTCUSDT', 'SOLUSDT', ...]
    ↓
displayRates = sortedSymbols.map(...) updates
    ↓
Table re-renders with new order
```

**關鍵點**: 排序變更時才重新計算順序，之後的資料更新不再改變順序。

---

## Validation Rules

### 1. Sort Field Validation
```typescript
const VALID_SORT_FIELDS: SortField[] = ['symbol', 'spread', 'annualizedReturn', 'netReturn'];

function isValidSortField(field: string): field is SortField {
  return VALID_SORT_FIELDS.includes(field as SortField);
}
```

從 localStorage 讀取時驗證，無效值則使用預設值。

### 2. Sort Direction Validation
```typescript
const VALID_SORT_DIRECTIONS: SortDirection[] = ['asc', 'desc'];

function isValidSortDirection(direction: string): direction is SortDirection {
  return VALID_SORT_DIRECTIONS.includes(direction as SortDirection);
}
```

### 3. Data Integrity

```typescript
// 確保 Map 中的 symbol 與 sortedSymbols 一致
const displayRates = sortedSymbols
  .map(symbol => ratesMap.get(symbol))
  .filter((rate): rate is MarketRate => rate !== undefined);  // 過濾 undefined
```

---

## State Transitions

### SortPreferenceModel State Machine

```
         ┌─────────────┐
         │   Initial   │
         │  (default)  │
         └──────┬──────┘
                │
                ↓ User clicks header
         ┌─────────────┐
         │   Sorting   │ ← → Toggle direction
         │  (active)   │
         └──────┬──────┘
                │
                ↓ localStorage.setItem()
         ┌─────────────┐
         │   Persisted │
         │  (saved)    │
         └──────┬──────┘
                │
                ↓ Page reload
         ┌─────────────┐
         │   Restored  │ → Continue as "Sorting (active)"
         │  (from LS)  │
         └─────────────┘
```

---

## Performance Considerations

### Memory Usage

| Model | Size Estimate | Count | Total |
|-------|---------------|-------|-------|
| MarketRate | ~500 bytes | 30 (top30) | ~15 KB |
| sortedSymbols | ~10 bytes/symbol | 30 | ~300 bytes |
| SortPreferenceModel | ~50 bytes | 1 | ~50 bytes |
| **Total** | | | **~15.35 KB** |

結論：記憶體使用可忽略不計。

### Re-render Optimization

使用 React DevTools Profiler 測試：
- **Before**: 每次 WebSocket 更新觸發 30 個 RateRow re-render (完整重排)
- **After**: 每次 WebSocket 更新只觸發資料變更的 RateRow re-render (無重排)

預期效能提升：減少 90% 的不必要渲染。

---

## 附錄：現有資料模型（未變更）

### MarketRate (from API)

**來源**: `/api/market-rates` REST endpoint
**更新**: WebSocket `rates:update` event
**不受此功能影響**：API 回傳格式保持不變，只有前端顯示邏輯改變。

```typescript
// API Response (unchanged)
{
  "success": true,
  "data": {
    "rates": MarketRate[],
    "stats": {
      "totalSymbols": number,
      "opportunityCount": number,
      // ...
    }
  }
}
```

此功能不修改 API，只優化前端排序邏輯。
