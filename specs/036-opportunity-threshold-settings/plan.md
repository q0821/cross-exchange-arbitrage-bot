# Implementation Plan: 可配置年化收益門檻

**Branch**: `036-opportunity-threshold-settings` | **Date**: 2025-12-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/036-opportunity-threshold-settings/spec.md`

## Summary

用戶需要自訂開倉機會的年化收益門檻（目前硬編碼為 800%）。此功能將在設定頁面提供門檻配置介面，使用 localStorage 儲存用戶偏好，並在市場監控頁面即時套用動態門檻。

## Technical Context

**Language/Version**: TypeScript 5.6 + Node.js 20.x LTS
**Primary Dependencies**: Next.js 14 App Router, React 18, Tailwind CSS
**Storage**: 瀏覽器 localStorage（純前端功能，不涉及資料庫）
**Testing**: Vitest (單元測試)
**Target Platform**: Web Browser (Chrome, Firefox, Safari, Edge)
**Project Type**: Web application (前端功能)
**Performance Goals**: 門檻變更後 <100ms 更新狀態顯示
**Constraints**: localStorage 不可用時需降級處理（使用預設值 800%）
**Scale/Scope**: 單一用戶前端偏好設定

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Trading Safety First | ✅ N/A | 不涉及交易執行，僅影響 UI 顯示 |
| II. Complete Observability | ✅ Pass | 前端偏好設定無需後端日誌 |
| III. Defensive Programming | ✅ Pass | 需處理 localStorage 不可用、無效輸入等 edge cases |
| IV. Data Integrity | ✅ N/A | 不涉及資料庫操作 |
| V. Incremental Delivery | ✅ Pass | 獨立功能，可逐步交付 |
| VI. System Architecture Boundaries | ✅ Pass | 符合 Web Responsibilities：用戶互動、配置、數據可視化 |

**結論**: 此功能完全符合 Constitution，是純前端用戶偏好設定功能。

## Project Structure

### Documentation (this feature)

```
specs/036-opportunity-threshold-settings/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (N/A - no database)
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```
app/(dashboard)/
├── market-monitor/
│   ├── hooks/
│   │   └── useOpportunityThreshold.ts    # 新增：門檻狀態 Hook
│   └── utils/
│       ├── preferences.ts                 # 擴展：新增門檻讀寫函數
│       └── rateCalculations.ts            # 修改：接受動態門檻參數
└── settings/
    └── trading/
        ├── page.tsx                       # 新增：交易設定頁面
        └── components/
            └── OpportunityThresholdSettings.tsx  # 新增：門檻設定元件

tests/
└── unit/
    └── market-monitor/
        └── opportunityThreshold.test.ts   # 新增：門檻功能測試
```

**Structure Decision**: 遵循現有專案結構，在 `app/(dashboard)/settings/` 下新增 `trading` 子目錄，與現有的 `api-keys` 和 `notifications` 設定頁面保持一致。

## Complexity Tracking

*無 Constitution 違規需要追蹤*

---

# Phase 0: Research

## Existing Code Analysis

### 1. 現有門檻常數位置

```typescript
// app/(dashboard)/market-monitor/utils/rateCalculations.ts:26-38
export const DEFAULT_OPPORTUNITY_THRESHOLD_ANNUALIZED = 800;
export const APPROACHING_THRESHOLD_RATIO = 0.75;
export const DEFAULT_APPROACHING_THRESHOLD_ANNUALIZED =
  DEFAULT_OPPORTUNITY_THRESHOLD_ANNUALIZED * APPROACHING_THRESHOLD_RATIO;
```

### 2. 現有偏好設定模式

`preferences.ts` 已有 `timeBasis` 的讀寫函數，可直接複製模式：

```typescript
// app/(dashboard)/market-monitor/utils/preferences.ts
const TIME_BASIS_KEY = 'market-monitor-time-basis';
export function getTimeBasisPreference(): TimeBasis { ... }
export function setTimeBasisPreference(timeBasis: TimeBasis): void { ... }
```

### 3. 費率計算調用點

`recalculateBestPair()` 函數需要修改，新增 `opportunityThreshold` 參數：

```typescript
// app/(dashboard)/market-monitor/utils/rateCalculations.ts:190-199
if (annualizedReturn >= DEFAULT_OPPORTUNITY_THRESHOLD_ANNUALIZED) {
  status = 'opportunity';
} else if (annualizedReturn >= DEFAULT_APPROACHING_THRESHOLD_ANNUALIZED) {
  status = 'approaching';
}
```

### 4. 調用鏈

```
useMarketRates.ts
  └─> recalculateBestPair(rate, timeBasis)
        └─> DEFAULT_OPPORTUNITY_THRESHOLD_ANNUALIZED (硬編碼)
```

## Technical Decisions

### D1: 儲存位置

**選擇**: localStorage
**理由**: 與 `timeBasis` 偏好設定一致，無需後端 API，符合 Principle VI

### D2: 門檻傳遞方式

**選擇**: 新增 `useOpportunityThreshold` Hook，整合到 `useMarketRates`
**理由**: 保持與 `timeBasis` 相同的模式，利用 React 狀態管理即時更新

### D3: 跨標籤頁同步

**選擇**: 監聽 `storage` 事件
**理由**: 瀏覽器原生支援，無需額外依賴

---

# Phase 1: Design

## Data Model

**N/A** - 此功能不涉及資料庫操作，僅使用 localStorage

### localStorage Schema

```typescript
// Key: 'market-monitor-opportunity-threshold'
// Value: string (number as string)
// Example: '500' (表示 500% 年化收益門檻)
// Default: '800'
// Valid range: 1-10000
```

## API Design

**N/A** - 此功能不需要後端 API

## UI Design

### 交易設定頁面 (`/settings/trading`)

```
┌─────────────────────────────────────────────────────────────┐
│  交易設定                                                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  年化收益門檻                                                 │
│  ┌────────────────────┐                                      │
│  │      800         % │                                      │
│  └────────────────────┘                                      │
│  快速選擇：                                                   │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌───────┐                        │
│  │ 300% │ │ 500% │ │ 800% │ │ 1000% │                        │
│  └──────┘ └──────┘ └──────┘ └───────┘                        │
│                                                              │
│  接近門檻: 600% (主門檻的 75%)                                │
│                                                              │
│  ┌──────────────────┐  ┌─────────────────┐                   │
│  │      儲存        │  │  重設為預設值    │                   │
│  └──────────────────┘  └─────────────────┘                   │
│                                                              │
│  說明                                                        │
│  ────────────────────────────────────────                    │
│  • 當交易對的年化收益 ≥ 門檻時，顯示為「機會」並可開倉          │
│  • 接近門檻用於提前提示潛在機會                                │
│  • 此設定僅影響前端顯示，不影響通知推送門檻                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Approach

### 步驟 1: 擴展 preferences.ts

新增門檻讀寫函數：

```typescript
const OPPORTUNITY_THRESHOLD_KEY = 'market-monitor-opportunity-threshold';
const DEFAULT_OPPORTUNITY_THRESHOLD = 800;
const MIN_THRESHOLD = 1;
const MAX_THRESHOLD = 10000;

export function getOpportunityThresholdPreference(): number { ... }
export function setOpportunityThresholdPreference(threshold: number): void { ... }
export function isLocalStorageAvailable(): boolean { ... }
```

### 步驟 2: 建立 useOpportunityThreshold Hook

```typescript
export function useOpportunityThreshold(): {
  threshold: number;
  approachingThreshold: number;
  setThreshold: (value: number) => void;
  resetToDefault: () => void;
  isLocalStorageAvailable: boolean;
}
```

### 步驟 3: 修改 rateCalculations.ts

將 `recalculateBestPair()` 函數新增 `opportunityThreshold` 參數：

```typescript
export function recalculateBestPair(
  rate: MarketRate,
  timeBasis: TimeBasis,
  opportunityThreshold: number = DEFAULT_OPPORTUNITY_THRESHOLD_ANNUALIZED
): MarketRate
```

### 步驟 4: 修改 useMarketRates.ts

整合 `useOpportunityThreshold`，在 `timeBasis` 或 `opportunityThreshold` 變更時重新計算

### 步驟 5: 建立設定頁面

新增 `/settings/trading/page.tsx` 和 `OpportunityThresholdSettings.tsx` 元件

### 步驟 6: 跨標籤頁同步

在 `useOpportunityThreshold` 中監聽 `storage` 事件

## Risk Assessment

| 風險 | 影響 | 緩解措施 |
|------|------|----------|
| localStorage 不可用（隱私模式） | 低 | 降級使用預設值 800%，顯示提示 |
| 無效輸入值 | 低 | 輸入驗證 + 範圍限制 (1-10000) |
| 跨標籤頁同步延遲 | 極低 | `storage` 事件通常 <50ms |
