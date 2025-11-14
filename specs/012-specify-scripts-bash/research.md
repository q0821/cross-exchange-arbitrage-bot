# Technical Research: 標準化資金費率時間與淨收益計算

**Feature**: 012-specify-scripts-bash
**Date**: 2025-01-15
**Status**: Completed

## Overview

本文件記錄標準化資金費率和淨收益計算功能的技術研究結果，包含技術選型、最佳實踐和實作考量。

## Research Areas

### 1. 資金費率時間標準化

#### Decision: 使用乘法因子進行時間標準化

**Rationale**:
- 簡單且精確：`standardizedRate = originalRate * (targetPeriodHours / originalPeriodHours)`
- 範例：0.01%/hour × (8 / 1) = 0.08%/8hours
- 使用 Decimal.js 確保浮點數精確度，避免 JavaScript Number 的精度問題

**Alternatives Considered**:
- ❌ **年化後再換算**：複雜且容易出錯，需要考慮複利效應
- ❌ **查表法**：不靈活，無法處理非標準結算週期

**Implementation Pattern**:
```typescript
import Decimal from 'decimal.js';

function normalizeRate(
  rate: Decimal,
  originalPeriodHours: number,
  targetPeriodHours: number
): Decimal {
  const factor = new Decimal(targetPeriodHours).div(originalPeriodHours);
  return rate.mul(factor);
}
```

---

### 2. 結算週期識別

#### Decision: 從交易所 API 取得結算週期資訊

**Rationale**:
- Binance: `/fapi/v1/premiumIndex` 回傳 `nextFundingTime`，可推算結算週期（檢查兩次 funding time 的間隔）
- OKX: `/api/v5/public/funding-rate` 明確提供 `fundingInterval`（例如 "8H", "1H"）
- MEXC & Gate.io: 通過 ccxt 的 `fetchFundingRate` 取得，需要額外解析

**Alternatives Considered**:
- ❌ **硬編碼各交易所週期**：不靈活，交易所可能調整週期
- ❌ **讓用戶手動設定**：增加操作複雜度，容易出錯

**Implementation Pattern**:
```typescript
async function detectFundingInterval(exchange: string, symbol: string): Promise<number> {
  if (exchange === 'binance') {
    // 查詢兩次 nextFundingTime 計算間隔
    const data = await binanceConnector.getFundingRate(symbol);
    return calculateInterval(data.nextFundingTime);
  } else if (exchange === 'okx') {
    // OKX 直接提供 fundingInterval
    const data = await okxConnector.getFundingRate(symbol);
    return parseFundingInterval(data.fundingInterval); // "8H" → 8
  }
  // 其他交易所使用 ccxt fallback
}
```

---

### 3. 淨收益計算公式

#### Decision: 淨收益 = 費率差收益 - 總手續費 (0.2%)

**Rationale**:
- 套利涉及 4 筆交易：
  1. Long 交易所建倉（Taker 0.05%）
  2. Long 交易所平倉（Taker 0.05%）
  3. Short 交易所建倉（Taker 0.05%）
  4. Short 交易所平倉（Taker 0.05%）
- 總手續費 = 4 × 0.05% = 0.2%
- 不考慮滑點和資金成本（用戶需求明確）

**Alternatives Considered**:
- ❌ **包含滑點**：用戶明確表示不需要（Q1: A）
- ❌ **動態手續費率**：簡化為固定 Taker 費率，用戶可自訂

**Implementation Pattern**:
```typescript
function calculateNetProfit(
  rateDifference: Decimal, // 標準化後的費率差
  takerFeeRate: Decimal = new Decimal(0.0005) // Default 0.05%
): Decimal {
  const totalFees = takerFeeRate.mul(4); // 4 trades
  return rateDifference.sub(totalFees);
}
```

---

### 4. 用戶偏好設定儲存

#### Decision: 使用 localStorage (前端) + UserPreferences model (後端，未來擴展)

**Rationale**:
- **Phase 1 (MVP)**: 使用 localStorage 儲存時間基準偏好
  - 簡單快速，無需後端 API
  - 適合單一用戶的設定
- **Phase 2 (未來)**: 新增 `UserPreferences` model 同步到伺服器
  - 跨裝置同步
  - 多用戶環境必須

**Alternatives Considered**:
- ❌ **立即實作資料庫儲存**：過度工程化，MVP 不需要
- ❌ **URL query parameters**：不持久，使用者體驗差

**Implementation Pattern (Phase 1)**:
```typescript
// Frontend localStorage
const TIME_BASIS_KEY = 'market-monitor-time-basis';

function saveTimeBasis(hours: 1 | 8 | 24) {
  localStorage.setItem(TIME_BASIS_KEY, hours.toString());
}

function loadTimeBasis(): 1 | 8 | 24 {
  const stored = localStorage.getItem(TIME_BASIS_KEY);
  return stored ? (parseInt(stored) as 1 | 8 | 24) : 8; // Default 8h
}
```

---

### 5. WebSocket 資料結構擴展

#### Decision: 向後相容擴展，新增選填欄位

**Rationale**:
- 現有 WebSocket 事件：`market-rates-update`
- 擴展資料結構新增：
  - `normalizedRate`: 標準化後費率
  - `originalFundingInterval`: 原始結算週期
  - `targetTimeBasis`: 目標時間基準
  - `netProfit`: 淨收益
  - `netProfitDetails`: 淨收益計算詳情
- 舊版客戶端忽略新欄位，新版客戶端優先使用新欄位

**Alternatives Considered**:
- ❌ **新增獨立事件**：增加複雜度，客戶端需要訂閱多個事件
- ❌ **版本化 API**：過度工程化，不符合 Incremental Delivery

**Implementation Pattern**:
```typescript
interface MarketRate {
  exchange: string;
  symbol: string;
  fundingRate: string; // Original rate (for backward compat)

  // NEW fields (optional for backward compat)
  normalizedRate?: string;
  originalFundingInterval?: number; // in hours
  targetTimeBasis?: number; // 1 | 8 | 24
  netProfit?: string;
  netProfitDetails?: {
    rateDifference: string;
    totalFees: string;
    netProfit: string;
  };
}
```

---

### 6. 前端排序與篩選

#### Decision: 前端 State 管理 + useMemo 優化

**Rationale**:
- 資料量小（~50 交易對 × 4 交易所 = 200 筆）
- 前端排序效能足夠（< 10ms）
- 使用 React useMemo 避免不必要的重新計算
- 使用 localStorage 持久化排序偏好（參考 Feature 009 實作）

**Alternatives Considered**:
- ❌ **後端排序**：增加 WebSocket 複雜度，不必要
- ❌ **資料庫查詢排序**：違反 Constitution VI（Web 不查資料庫）

**Implementation Pattern** (參考 Feature 009):
```typescript
const sortedRates = useMemo(() => {
  return [...rates].sort((a, b) => {
    if (sortBy === 'netProfit') {
      return new Decimal(b.netProfit || 0)
        .sub(new Decimal(a.netProfit || 0))
        .toNumber();
    }
    // ... other sorting logic
  });
}, [rates, sortBy, sortDirection]);
```

---

## Technology Stack Summary

### Frontend
- **Framework**: Next.js 14 App Router
- **State Management**: React hooks (useState, useMemo)
- **WebSocket**: Socket.io-client 4.8
- **Persistence**: localStorage
- **Math**: Decimal.js (if needed for client-side calculations)
- **UI**: Tailwind CSS + Radix UI (existing)

### Backend (CLI Monitor + WebSocket Server)
- **Runtime**: Node.js 20.x + TypeScript 5.6
- **WebSocket**: Socket.io 4.8
- **Math**: Decimal.js 10.x (MUST for financial calculations)
- **Validation**: Zod schemas
- **Logging**: Pino (existing)

### Testing
- **Unit**: Vitest
- **Integration**: Vitest + in-memory test fixtures
- **E2E**: Playwright

---

## Best Practices

### Financial Calculations
1. **ALWAYS use Decimal.js** for rates, fees, and profits
2. **Round only for display** (keep full precision in calculations)
3. **Validate inputs** with Zod schemas before calculations
4. **Log all calculations** with structured context

### Error Handling
1. **Graceful degradation**: Show "N/A" if normalization fails
2. **Fallback to original rate**: If detection fails, use raw rate with warning
3. **User feedback**: Toast notifications for errors

### Performance
1. **Debounce WebSocket updates**: Max 1 update per 5 seconds per symbol
2. **Memoize sorted lists**: Use React.useMemo with precise dependencies
3. **Lazy load components**: Code-split heavy UI components

### Testing Strategy
1. **Unit test edge cases**:
   - Zero rates
   - Negative rates
   - Very large numbers (> 1e6)
   - Division by zero scenarios
2. **Integration test WebSocket flow**:
   - Normalize → Broadcast → Client receives
3. **E2E test user interactions**:
   - Change time basis selector
   - Sort by net profit
   - Verify values display correctly

---

## Migration Plan

### Phase 1: Backend Changes
1. Implement `FundingRateNormalizer` service
2. Implement `NetProfitCalculator` service
3. Extend `MarketRatesHandler` to include new fields
4. Add unit tests

### Phase 2: Frontend Changes
1. Update `useMarketRates` hook to handle new fields
2. Add `TimeBasisSelector` component
3. Update `RatesTable` and `RateRow` to display new data
4. Add frontend utilities for formatting
5. Add E2E tests

### Phase 3: Testing & Rollout
1. Manual testing in development
2. Deploy to staging
3. Monitor logs for calculation errors
4. Gradual rollout (Feature 009 pattern)

---

## Open Questions (Resolved)

All questions resolved during spec clarification:
- ✅ Q: Include slippage? → A: No
- ✅ Q: Default fee rates? → A: Taker 0.05% per trade, 4 trades total
- ✅ Q: Other costs? → A: Only trading fees

---

## References

- Decimal.js documentation: https://mikemcl.github.io/decimal.js/
- Feature 009 (穩定排序): `/specs/009-specify-scripts-bash/`
- Constitution Principle VI: Architecture Boundaries
- Binance Futures API: https://binance-docs.github.io/apidocs/futures/en/
- OKX API: https://www.okx.com/docs-v5/en/

