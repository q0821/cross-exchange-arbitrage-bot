# Technical Research: 可配置年化收益門檻

**Feature**: 036-opportunity-threshold-settings
**Date**: 2025-12-18
**Status**: Complete

## Research Summary

此功能為純前端用戶偏好設定，使用 localStorage 儲存門檻值，無需外部依賴或新技術選型。

## Existing Pattern Analysis

### 1. 偏好設定儲存模式 (preferences.ts)

現有 `timeBasis` 偏好設定已建立完整模式：

```typescript
// app/(dashboard)/market-monitor/utils/preferences.ts

const TIME_BASIS_KEY = 'market-monitor-time-basis';
const DEFAULT_TIME_BASIS: TimeBasis = 8;

export function getTimeBasisPreference(): TimeBasis {
  if (typeof window === 'undefined') {
    return DEFAULT_TIME_BASIS;
  }
  try {
    const stored = localStorage.getItem(TIME_BASIS_KEY);
    // ... validation and return
  } catch (error) {
    console.error('Failed to load time basis preference:', error);
    return DEFAULT_TIME_BASIS;
  }
}
```

**可複用模式**:
- SSR 相容性檢查 (`typeof window === 'undefined'`)
- try-catch 包裹 localStorage 操作
- 驗證儲存值有效性
- 無效值自動重設

### 2. 費率計算架構 (rateCalculations.ts)

現有門檻常數定義：

```typescript
// app/(dashboard)/market-monitor/utils/rateCalculations.ts:26-38

export const DEFAULT_OPPORTUNITY_THRESHOLD_ANNUALIZED = 800;
export const APPROACHING_THRESHOLD_RATIO = 0.75;
export const DEFAULT_APPROACHING_THRESHOLD_ANNUALIZED =
  DEFAULT_OPPORTUNITY_THRESHOLD_ANNUALIZED * APPROACHING_THRESHOLD_RATIO;
```

使用位置：

```typescript
// app/(dashboard)/market-monitor/utils/rateCalculations.ts:190-199

let status: 'opportunity' | 'approaching' | 'normal' = 'normal';
if (bestPair) {
  const annualizedReturn = bestPair.annualizedReturn;
  if (annualizedReturn >= DEFAULT_OPPORTUNITY_THRESHOLD_ANNUALIZED) {
    status = 'opportunity';
  } else if (annualizedReturn >= DEFAULT_APPROACHING_THRESHOLD_ANNUALIZED) {
    status = 'approaching';
  }
}
```

**修改方案**: 新增 `opportunityThreshold` 參數，保留常數作為預設值

### 3. Hook 整合模式 (useMarketRates.ts)

現有 Hook 結構：

```typescript
export function useMarketRates(): UseMarketRatesReturn {
  const [timeBasis, setTimeBasisState] = useState<TimeBasis>(() => getTimeBasisPreference());

  // timeBasis 變更時重新計算
  useEffect(() => {
    setRatesMap((prev) => {
      prev.forEach((rate, symbol) => {
        const recalculatedRate = recalculateBestPair(rate, timeBasis);
        next.set(symbol, recalculatedRate);
      });
      return next;
    });
  }, [timeBasis]);
}
```

**可複用模式**:
- 使用 `useState` 初始化時讀取偏好
- 使用 `useEffect` 監聽變更並重新計算

### 4. 設定頁面結構

現有設定頁面位置：
- `/settings/api-keys/page.tsx` - API 金鑰設定
- `/settings/notifications/page.tsx` - 通知設定 (webhook)

**模式**: 每個設定類別有獨立子目錄和 `page.tsx`

## Technical Decisions

### D1: localStorage Key 命名

**決定**: `market-monitor-opportunity-threshold`
**理由**: 與現有 `market-monitor-time-basis` 保持一致的命名空間

### D2: 跨標籤頁同步

**決定**: 使用 `window.addEventListener('storage', handler)`
**理由**:
- 瀏覽器原生支援
- 無需額外依賴
- 僅在其他標籤頁修改時觸發，避免重複處理

```typescript
useEffect(() => {
  const handleStorage = (e: StorageEvent) => {
    if (e.key === OPPORTUNITY_THRESHOLD_KEY) {
      const newValue = parseInt(e.newValue || '', 10);
      if (!isNaN(newValue) && isValidThreshold(newValue)) {
        setThresholdState(newValue);
      }
    }
  };
  window.addEventListener('storage', handleStorage);
  return () => window.removeEventListener('storage', handleStorage);
}, []);
```

### D3: 輸入驗證

**決定**: 前端即時驗證 + 儲存前再次驗證
**範圍**: 1% - 10000%
**理由**:
- 1% 為最低有意義門檻
- 10000% 為極高年化收益，實際上幾乎不可能達到

### D4: UI 元件架構

**決定**: 獨立 `OpportunityThresholdSettings.tsx` 元件
**理由**:
- 可重用性（未來可能在其他地方使用）
- 關注點分離
- 便於測試

## Dependencies

**無需新增依賴** - 所有功能使用現有依賴實現：
- React 18 (useState, useEffect, useCallback)
- Next.js 14 App Router
- Tailwind CSS

## Risk Mitigation

| 風險 | 緩解措施 |
|------|----------|
| localStorage 不可用 | 檢測可用性，降級使用預設值 |
| 無效儲存值 | 驗證後重設為預設值 |
| SSR hydration mismatch | 使用 `useEffect` 延遲讀取 localStorage |
| 跨標籤頁競爭條件 | 每次讀取使用最新值，不快取 |

## Conclusion

此功能可完全使用現有模式和依賴實現，無需引入新技術或外部依賴。
