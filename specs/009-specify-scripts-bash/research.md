# Technical Research: 市場監控頁面穩定排序

**Feature**: 009-specify-scripts-bash
**Date**: 2025-11-12
**Purpose**: 研究穩定排序實作的最佳實踐和技術方案

## Research Questions

1. **React 列表渲染優化**: 如何防止 WebSocket 更新觸發整個列表重新排序？
2. **穩定排序演算法**: 如何確保排序穩定性（相同值的項目保持原順序）？
3. **State 管理分離**: 如何分離資料更新邏輯和排序邏輯？
4. **localStorage 最佳實踐**: 如何處理儲存失敗和瀏覽器相容性？

## Decision 1: React 列表優化策略

### Decision
採用**快照排序 (Snapshot Sorting)** 模式：在用戶主動觸發排序時建立一次排序快照，後續資料更新僅更新對應位置的項目資料，不重新執行排序邏輯。

### Rationale

**問題分析**：
目前的實作在 `RatesTable.tsx` 中使用 `useMemo`，但依賴陣列包含 `rates`，導致每次 WebSocket 推送新資料時都會觸發重新排序：

```typescript
const processedRates = useMemo(() => {
  // 每次 rates 更新都會重新執行
  const sorted = [...filtered].sort((a, b) => { /* ... */ });
  return sorted;
}, [rates, sortBy, sortDirection, filterStatus]); // ❌ rates 在依賴中
```

**解決方案**：
1. **分離資料和順序**：維護兩個獨立的狀態
   - `ratesData`: Map<symbol, rateData> - 儲存最新資料
   - `sortedSymbols`: string[] - 儲存排序後的 symbol 順序

2. **只在排序改變時更新順序**：
   ```typescript
   const sortedSymbols = useMemo(() => {
     // 只在 sortBy 或 sortDirection 改變時執行
     const symbols = Array.from(ratesData.keys());
     return symbols.sort(compareFn);
   }, [sortBy, sortDirection]); // ✅ 不包含 ratesData

   const displayRates = useMemo(() => {
     // 根據固定順序提取最新資料
     return sortedSymbols.map(symbol => ratesData.get(symbol));
   }, [sortedSymbols, ratesData]); // ✅ 順序固定，只更新值
   ```

### Alternatives Considered

1. **React.memo + key 穩定性**
   - 使用 React.memo 包裝 RateRow 組件
   - 確保每個 row 的 key 固定為 symbol
   - **拒絕原因**：治標不治本，useMemo 依然會重新執行排序，只是子組件不重新渲染

2. **useRef 儲存排序結果**
   - 使用 useRef 儲存上次排序的結果
   - 比對排序參數是否改變，未改變則返回 ref 中的結果
   - **拒絕原因**：複雜度較高，且需要手動管理 ref 更新時機，容易出錯

3. **完全受控的順序陣列**
   - 父組件維護 sortedOrder 狀態，子組件只負責渲染
   - **選擇此方案**：最清晰的職責分離，符合 React 單向資料流

### Implementation Pattern

```typescript
// useMarketRates.ts - 資料管理
export function useMarketRates() {
  const [ratesMap, setRatesMap] = useState<Map<string, MarketRate>>(new Map());

  // WebSocket 更新：只更新 map 中對應的項目
  const handleRatesUpdate = useCallback((event: RatesUpdateEvent) => {
    setRatesMap(prev => {
      const next = new Map(prev);
      event.data.rates.forEach(rate => {
        next.set(rate.symbol, rate);
      });
      return next;
    });
  }, []);

  return { ratesMap, /* ... */ };
}

// RatesTable.tsx - 顯示邏輯
export function RatesTable({ ratesMap, sortBy, sortDirection }) {
  // 排序：只依賴排序參數
  const sortedSymbols = useMemo(() => {
    const symbols = Array.from(ratesMap.keys());
    return symbols.sort((a, b) => {
      const rateA = ratesMap.get(a)!;
      const rateB = ratesMap.get(b)!;
      return compareFn(rateA, rateB, sortBy, sortDirection);
    });
  }, [sortBy, sortDirection]); // ✅ 不依賴 ratesMap

  // 渲染：根據固定順序提取最新值
  return (
    <tbody>
      {sortedSymbols.map(symbol => {
        const rate = ratesMap.get(symbol);
        return rate ? <RateRow key={symbol} rate={rate} /> : null;
      })}
    </tbody>
  );
}
```

## Decision 2: 穩定排序演算法

### Decision
使用 JavaScript 原生 `Array.sort()` 搭配**明確的次要排序鍵（交易對名稱）** 確保穩定性。

### Rationale

**JavaScript Sort 穩定性**：
- ES2019+ (Chrome 70+, Firefox 3+): `Array.sort()` 保證穩定排序
- 相同值的元素保持原始順序

**實作策略**：
```typescript
function stableSortComparator(
  a: MarketRate,
  b: MarketRate,
  sortBy: SortField,
  direction: SortDirection
): number {
  // 主要排序欄位
  let result = 0;
  switch (sortBy) {
    case 'spread':
      result = (a.bestPair?.spreadPercent ?? 0) - (b.bestPair?.spreadPercent ?? 0);
      break;
    case 'symbol':
      result = a.symbol.localeCompare(b.symbol);
      break;
    // ... 其他欄位
  }

  // 次要排序：交易對名稱（字母順序）
  if (result === 0) {
    result = a.symbol.localeCompare(b.symbol);
  }

  return direction === 'asc' ? result : -result;
}
```

### Alternatives Considered

1. **自實作穩定排序（Merge Sort）**
   - 保證 O(n log n) 穩定排序
   - **拒絕原因**：原生 sort 已足夠，無需重複造輪子

2. **維護原始索引**
   - 在資料中加入 originalIndex 欄位
   - **拒絕原因**：增加複雜度，且次要排序鍵已能達成目標

## Decision 3: State 管理分離

### Decision
採用**單一資料來源 (Single Source of Truth)** 模式，將資料儲存與顯示邏輯分離。

### Rationale

**架構設計**：
```
useMarketRates (資料層)
    ↓
  ratesMap (Map<symbol, rate>)
    ↓
useTableSort (邏輯層)
    ↓
sortBy, sortDirection
    ↓
RatesTable (顯示層)
    ↓
sortedSymbols (順序快照)
```

**職責分離**：
1. **useMarketRates**: 負責 WebSocket 訂閱和資料更新，不關心排序
2. **useTableSort**: 負責排序狀態管理（sortBy, direction），不關心資料內容
3. **RatesTable**: 結合資料和排序邏輯，產生最終顯示順序

**好處**：
- 資料更新不影響排序邏輯
- 排序變更不需要重新 fetch 資料
- 各層可獨立測試

### Implementation Pattern

```typescript
// page.tsx - 組合層
export default function MarketMonitorPage() {
  const { ratesMap, isConnected } = useMarketRates();
  const { sortBy, sortDirection, toggleSort } = useTableSort();

  return (
    <RatesTable
      ratesMap={ratesMap}
      sortBy={sortBy}
      sortDirection={sortDirection}
      onSort={toggleSort}
    />
  );
}
```

## Decision 4: localStorage 最佳實踐

### Decision
使用**Graceful Degradation（優雅降級）** 策略，localStorage 失敗時功能照常運作，只是不保存偏好。

### Rationale

**錯誤場景**：
1. 隱私模式/無痕模式：localStorage 被禁用
2. 儲存空間已滿：QuotaExceededError
3. 瀏覽器不支援：Safari 私密瀏覽

**處理策略**：
```typescript
function saveToLocalStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    // 記錄錯誤但不中斷流程
    console.warn(`Failed to save ${key} to localStorage:`, error);
    // 功能繼續運作，只是不保存偏好
  }
}

function loadFromLocalStorage(key: string, defaultValue: string): string {
  try {
    const saved = localStorage.getItem(key);
    return saved ?? defaultValue;
  } catch (error) {
    console.warn(`Failed to load ${key} from localStorage:`, error);
    return defaultValue;
  }
}
```

**瀏覽器相容性檢查**：
```typescript
function isLocalStorageAvailable(): boolean {
  try {
    const testKey = '__localStorage_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}
```

### Alternatives Considered

1. **使用 IndexedDB**
   - 更大的儲存空間和更好的效能
   - **拒絕原因**：過度設計，排序偏好只需幾 bytes

2. **Cookie 儲存**
   - 伺服器也能讀取
   - **拒絕原因**：增加每次請求的資料量，且不需要伺服器知道排序偏好

3. **Session Storage**
   - 只在當前 tab 有效
   - **拒絕原因**：用戶期望跨 tab 共享排序偏好

## Best Practices Summary

### Performance Optimization
1. **Memoization 策略**：
   - 排序結果使用 useMemo，依賴 [sortBy, sortDirection]
   - 資料提取使用 useMemo，依賴 [sortedSymbols, ratesMap]

2. **避免不必要的重新渲染**：
   - RateRow 使用 React.memo
   - 傳入 callback 使用 useCallback

3. **Map vs Array**：
   - 資料儲存用 Map（O(1) 查找）
   - 顯示順序用 Array（保持順序）

### Testing Strategy
1. **Unit Tests**：
   - 排序演算法正確性
   - localStorage 錯誤處理
   - Hook 狀態管理

2. **Integration Tests**：
   - WebSocket 更新不觸發重排
   - 排序切換正確運作
   - 群組切換保持排序

3. **E2E Tests**：
   - 用戶操作排序後列表穩定
   - 重新載入頁面恢復排序設定

## Implementation Checklist

- [ ] 修改 useMarketRates 使用 Map 儲存資料
- [ ] 修改 RatesTable 實作快照排序
- [ ] 修改 useTableSort 預設排序為 symbol (字母順序)
- [ ] 加入穩定排序的次要鍵（symbol）
- [ ] 加入 localStorage 錯誤處理
- [ ] 撰寫 unit tests
- [ ] 撰寫 E2E tests
- [ ] 更新文檔
