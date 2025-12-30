# Quick Start: 可配置年化收益門檻

**Feature**: 036-opportunity-threshold-settings
**Time to First Working State**: ~10 分鐘

## Prerequisites

- Node.js 20.x 已安裝
- 專案依賴已安裝 (`pnpm install`)
- 開發伺服器已啟動 (`pnpm dev`)

## Step 1: 驗證現有功能

1. 開啟瀏覽器，前往 `http://localhost:3000/market-monitor`
2. 確認市場監控頁面正常顯示費率資料
3. 觀察目前使用硬編碼的 800% 門檻

## Step 2: 擴展偏好設定工具

編輯 `app/(dashboard)/market-monitor/utils/preferences.ts`：

```typescript
// 新增門檻相關常數和函數
const OPPORTUNITY_THRESHOLD_KEY = 'market-monitor-opportunity-threshold';
const DEFAULT_OPPORTUNITY_THRESHOLD = 800;
const MIN_THRESHOLD = 1;
const MAX_THRESHOLD = 10000;

export function getOpportunityThresholdPreference(): number {
  if (typeof window === 'undefined') {
    return DEFAULT_OPPORTUNITY_THRESHOLD;
  }

  try {
    const stored = localStorage.getItem(OPPORTUNITY_THRESHOLD_KEY);
    if (!stored) {
      return DEFAULT_OPPORTUNITY_THRESHOLD;
    }

    const parsed = parseInt(stored, 10);
    if (isNaN(parsed) || parsed < MIN_THRESHOLD || parsed > MAX_THRESHOLD) {
      return DEFAULT_OPPORTUNITY_THRESHOLD;
    }

    return parsed;
  } catch (error) {
    console.error('Failed to load opportunity threshold preference:', error);
    return DEFAULT_OPPORTUNITY_THRESHOLD;
  }
}

export function setOpportunityThresholdPreference(threshold: number): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (threshold < MIN_THRESHOLD || threshold > MAX_THRESHOLD) {
      console.error('Invalid threshold:', threshold);
      return;
    }

    localStorage.setItem(OPPORTUNITY_THRESHOLD_KEY, threshold.toString());
  } catch (error) {
    console.error('Failed to save opportunity threshold preference:', error);
  }
}
```

## Step 3: 建立門檻 Hook

建立 `app/(dashboard)/market-monitor/hooks/useOpportunityThreshold.ts`：

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getOpportunityThresholdPreference,
  setOpportunityThresholdPreference,
} from '../utils/preferences';
import { APPROACHING_THRESHOLD_RATIO } from '../utils/rateCalculations';

const OPPORTUNITY_THRESHOLD_KEY = 'market-monitor-opportunity-threshold';
const DEFAULT_OPPORTUNITY_THRESHOLD = 800;

export function useOpportunityThreshold() {
  const [threshold, setThresholdState] = useState<number>(DEFAULT_OPPORTUNITY_THRESHOLD);
  const [isReady, setIsReady] = useState(false);

  // 初始化時從 localStorage 讀取
  useEffect(() => {
    setThresholdState(getOpportunityThresholdPreference());
    setIsReady(true);
  }, []);

  // 跨標籤頁同步
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === OPPORTUNITY_THRESHOLD_KEY && e.newValue) {
        const newValue = parseInt(e.newValue, 10);
        if (!isNaN(newValue)) {
          setThresholdState(newValue);
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const setThreshold = useCallback((value: number) => {
    setThresholdState(value);
    setOpportunityThresholdPreference(value);
  }, []);

  const resetToDefault = useCallback(() => {
    setThreshold(DEFAULT_OPPORTUNITY_THRESHOLD);
  }, [setThreshold]);

  return {
    threshold,
    approachingThreshold: threshold * APPROACHING_THRESHOLD_RATIO,
    setThreshold,
    resetToDefault,
    isReady,
  };
}
```

## Step 4: 測試門檻功能

在瀏覽器開發者工具 Console 中測試：

```javascript
// 設定新門檻
localStorage.setItem('market-monitor-opportunity-threshold', '500');

// 重新載入頁面，觀察變化
location.reload();
```

## Step 5: 建立設定頁面

建立 `app/(dashboard)/settings/trading/page.tsx`：

```typescript
'use client';

import { useOpportunityThreshold } from '../../market-monitor/hooks/useOpportunityThreshold';

export default function TradingSettingsPage() {
  const { threshold, approachingThreshold, setThreshold, resetToDefault } = useOpportunityThreshold();

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">交易設定</h1>

      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-4">年化收益門檻</h2>

        <div className="mb-4">
          <input
            type="number"
            value={threshold}
            onChange={(e) => setThreshold(parseInt(e.target.value, 10) || 800)}
            className="border rounded px-3 py-2 w-32"
            min={1}
            max={10000}
          />
          <span className="ml-2">%</span>
        </div>

        <div className="text-sm text-gray-500 mb-4">
          接近門檻: {approachingThreshold}% (主門檻的 75%)
        </div>

        <button
          onClick={resetToDefault}
          className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200"
        >
          重設為預設值 (800%)
        </button>
      </div>
    </div>
  );
}
```

## Verification

1. 前往 `http://localhost:3000/settings/trading`
2. 修改門檻值
3. 前往 `http://localhost:3000/market-monitor`
4. 確認狀態計算使用新門檻

## Common Issues

### localStorage 不可用

如果使用隱私模式或禁用了 localStorage，功能會降級使用預設值 800%。

### SSR Hydration Mismatch

確保使用 `useEffect` 延遲讀取 localStorage，避免 SSR 和 CSR 值不一致。

## Next Steps

- 完善 UI 設計（快速選擇按鈕、驗證錯誤提示）
- 整合到 `useMarketRates` Hook
- 新增單元測試
