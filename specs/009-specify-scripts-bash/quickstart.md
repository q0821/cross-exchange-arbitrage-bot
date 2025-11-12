# Quickstart: 市場監控頁面穩定排序

**Feature**: 009-specify-scripts-bash
**Branch**: `009-specify-scripts-bash`
**Goal**: 實作穩定排序機制，防止 WebSocket 更新觸發列表重新排列

## Prerequisites

- Node.js 20.x LTS
- pnpm installed
- Project dependencies installed (`pnpm install`)
- PostgreSQL 15+ with TimescaleDB running (for backend data)
- Basic understanding of React hooks and Next.js App Router

## Development Setup

### 1. Checkout Feature Branch

```bash
git checkout 009-specify-scripts-bash
```

### 2. Install Dependencies (if needed)

```bash
pnpm install
```

### 3. Start Development Server

```bash
# Terminal 1: Start backend (CLI monitor service)
pnpm dev:cli

# Terminal 2: Start frontend (Next.js)
pnpm dev
```

### 4. Access Market Monitor Page

Navigate to: `http://localhost:3000/market-monitor`

## Key Files to Modify

### 1. Data Management Hook
**File**: `app/(dashboard)/market-monitor/hooks/useMarketRates.ts`

**Current Issue**: 資料儲存在 array，每次更新都產生新 array
**Fix**: 改用 Map 儲存資料，只更新對應 symbol 的值

```typescript
// Before (array-based)
const [rates, setRates] = useState<MarketRate[]>([]);

// After (Map-based)
const [ratesMap, setRatesMap] = useState<Map<string, MarketRate>>(new Map());

// Update function
const handleRatesUpdate = useCallback((event: RatesUpdateEvent) => {
  setRatesMap(prev => {
    const next = new Map(prev);
    event.data.rates.forEach(rate => {
      next.set(rate.symbol, rate);  // O(1) update
    });
    return next;
  });
}, []);
```

### 2. Display Component
**File**: `app/(dashboard)/market-monitor/components/RatesTable.tsx`

**Current Issue**: `useMemo` 依賴 `rates`，每次更新都重新排序
**Fix**: 分離排序邏輯和資料提取

```typescript
// Snapshot sorting: only re-compute when sort criteria change
const sortedSymbols = useMemo(() => {
  const symbols = Array.from(ratesMap.keys());
  return symbols.sort((a, b) => {
    const rateA = ratesMap.get(a)!;
    const rateB = ratesMap.get(b)!;

    // Primary sort field
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
      // ... other fields
    }

    // Secondary sort: symbol name (ensures stability)
    if (result === 0) {
      result = a.localeCompare(b);
    }

    return sortDirection === 'asc' ? result : -result;
  });
}, [sortBy, sortDirection]); // ✅ Only depends on sort criteria

// Render using fixed order
return (
  <tbody>
    {sortedSymbols.map(symbol => {
      const rate = ratesMap.get(symbol);
      return rate ? <RateRow key={symbol} rate={rate} /> : null;
    })}
  </tbody>
);
```

### 3. Sort Management Hook
**File**: `app/(dashboard)/market-monitor/hooks/useTableSort.ts`

**Changes**:
- 改變預設排序為 `symbol` (字母順序)
- 加入 localStorage 錯誤處理

```typescript
const DEFAULT_SORT_BY: SortField = 'symbol';  // Changed from 'spread'
const DEFAULT_SORT_DIRECTION: SortDirection = 'asc';

// localStorage with graceful degradation
function saveToLocalStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.warn(`Failed to save ${key}:`, error);
    // Feature continues to work, just doesn't persist
  }
}
```

## Testing the Fix

### Manual Testing

1. **Verify Stable Sorting**:
   - Open Market Monitor page
   - Note the position of "BTCUSDT" in the list
   - Wait for WebSocket updates (check console for "rates:update" events)
   - Verify "BTCUSDT" stays in the same position
   - Only the rate values should change, not the position

2. **Test Custom Sorting**:
   - Click "費率差異" column header
   - List should re-order by spread (descending)
   - Wait for WebSocket updates
   - Verify list order remains stable

3. **Test Sort Persistence**:
   - Set sort to "年化收益" (annualized return)
   - Refresh the page
   - Verify sort preference is restored

4. **Test Group Switching**:
   - Set sort to "symbol" (ascending)
   - Switch from "全部交易對" to "top10"
   - Verify new group is sorted by symbol
   - Switch back to "全部交易對"
   - Verify still sorted by symbol

### Automated Testing

```bash
# Unit tests
pnpm test tests/unit/market-monitor/

# E2E tests (requires dev server running)
pnpm test:e2e tests/e2e/market-monitor-sorting.spec.ts
```

## Performance Validation

### Check Re-render Behavior

Install React DevTools and enable Profiler:

1. Open Market Monitor page
2. Start Profiler recording
3. Wait for 5 WebSocket updates
4. Stop recording
5. Check flamegraph:
   - **Expected**: Only individual RateRow components re-render
   - **Not Expected**: Entire RatesTable re-renders or re-orders

### Check Sort Performance

1. Click column header to trigger sort
2. Measure time to completion (should be <500ms for 30 items)
3. Use Performance tab in DevTools if needed

## Common Issues

### Issue 1: List Still Jumps Around

**Symptom**: Trading pairs change position on WebSocket updates
**Cause**: `useMemo` still has `ratesMap` in dependencies
**Fix**: Remove `ratesMap` from `sortedSymbols` useMemo dependencies

### Issue 2: Sort Not Persisting

**Symptom**: Sort preference lost on page refresh
**Cause**: localStorage blocked (private browsing) or quota exceeded
**Check**: Open Console, look for "Failed to save" warnings
**Expected**: Feature still works, just doesn't persist preferences

### Issue 3: Initial Sort Incorrect

**Symptom**: Page loads with wrong sort order
**Cause**: `initialSymbols` passed to useMemo before `ratesMap` populated
**Fix**: Ensure `sortedSymbols` only computes after `ratesMap` has data

## Development Workflow

### 1. Implement Changes

Follow the order in `tasks.md` (generated by `/speckit.tasks`):
1. Modify `useMarketRates.ts` to use Map
2. Modify `RatesTable.tsx` for snapshot sorting
3. Update `useTableSort.ts` default and localStorage handling
4. Add stable sort secondary key

### 2. Write Tests

```bash
# Create test file
touch tests/unit/market-monitor/useStableSort.test.ts

# Write unit tests for:
# - stableSortComparator function
# - localStorage save/load functions
# - Sort toggle logic
```

### 3. Run Tests

```bash
pnpm test --run
```

### 4. Manual QA

Follow "Testing the Fix" section above

### 5. Commit Changes

```bash
git add app/(dashboard)/market-monitor/
git commit -m "feat: implement stable sorting for market monitor

- Change useMarketRates to use Map for O(1) updates
- Implement snapshot sorting in RatesTable
- Update default sort to symbol (alphabetical)
- Add stable sort with secondary key
- Add localStorage graceful degradation"
```

## Success Criteria Validation

Before marking feature as complete, verify all success criteria from spec.md:

- [ ] **SC-001**: Observe list for 2 minutes, verify 100% position stability
- [ ] **SC-002**: Sort completes within 500ms (measure with DevTools)
- [ ] **SC-003**: List order consistent over 5 minutes with 6+ updates/min
- [ ] **SC-004**: Sort preference restores correctly on page reload
- [ ] **SC-005**: Group switch completes with sorting within 1 second
- [ ] **SC-006**: User testing shows 95%+ can use sort without help

## References

- [Feature Spec](./spec.md) - User requirements and acceptance criteria
- [Technical Plan](./plan.md) - Architecture and technical context
- [Research](./research.md) - Technical decisions and rationale
- [Data Model](./data-model.md) - State management architecture
- [Tasks](./tasks.md) - Detailed implementation checklist (generated by `/speckit.tasks`)

## Questions?

If you encounter issues not covered here, check:
1. Console for errors or warnings
2. React DevTools Profiler for re-render issues
3. Network tab for WebSocket connection status
4. `research.md` for detailed technical decisions
