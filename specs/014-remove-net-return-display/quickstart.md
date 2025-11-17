# Quick Start Guide: 移除淨收益欄位功能

**Feature**: 014-remove-net-return-display
**Branch**: `014-remove-net-return-display`
**Date**: 2025-01-17

## Overview

本指南幫助開發者快速理解和驗證「移除淨收益欄位」功能的實施和效果。

## What Changed?

### User-Facing Changes

**Before** (舊版 UI):
- 市場監控表格顯示「淨收益」欄位（綠/黃/紅顏色編碼）
- 淨收益計算：`費率差異 - |價差| - 手續費`
- 高收益機會標記（⭐）基於 `netReturn > 0.5%`

**After** (新版 UI):
- 移除「淨收益」欄位
- 新增「預估手續費」欄位（固定顯示 0.2%）
- 顯示三個獨立指標：費率差異、價差、手續費
- 高收益機會標記基於 `spreadPercent > 0.5%`

### Technical Changes

- **Frontend**: 8 個檔案修改（元件、類型、utils）
- **Backend**: 2 個檔案修改（API route, WebSocket handler）
- **Documentation**: 1 個新增文件（手續費規範）
- **Code Cleanup**: 移除 `net-return-calculator.ts` 和相關測試

## Quick Verification

### 1. 視覺驗證（5 分鐘）

#### Step 1: 啟動開發伺服器

```bash
pnpm dev
```

#### Step 2: 訪問市場監控頁面

```
http://localhost:3000/market-monitor
```

#### Step 3: 檢查 UI 變更

檢查清單：
- [ ] 表格**不顯示**「淨收益」欄位
- [ ] 表格顯示「預估手續費」欄位（0.2%）
- [ ] 點擊手續費欄位的說明圖示，顯示 Tooltip 包含：
  - 建倉做多 (Long Open): 0.05%
  - 建倉做空 (Short Open): 0.05%
  - 平倉做多 (Long Close): 0.05%
  - 平倉做空 (Short Close): 0.05%
  - 總計: 0.20%
- [ ] 排序功能無「淨收益」選項
- [ ] 高收益標記（⭐）顯示在費率差異 > 0.5% 的交易對上

### 2. API 驗證（2 分鐘）

#### Test GET /api/market-rates

```bash
curl http://localhost:3000/api/market-rates | jq '.rates[0].bestPair'
```

**Expected Output** (應該**沒有** `netReturn` 欄位):

```json
{
  "longExchange": "BINANCE",
  "shortExchange": "OKX",
  "spreadPercent": 0.5,
  "priceDiffPercent": 0.15,
  "annualizedReturn": 547.5,
  // 注意：沒有 "netReturn" 欄位
  "longFundingRate": 0.01,
  "shortFundingRate": -0.04,
  "longPrice": 50000.5,
  "shortPrice": 50075.75
}
```

#### Verify No netReturn Field

```bash
curl http://localhost:3000/api/market-rates | jq '.rates[0].bestPair | has("netReturn")'
```

**Expected Output**: `false`

### 3. 手續費規範驗證（1 分鐘）

#### Check Documentation File

```bash
cat docs/trading-fees.md
```

**Expected Content**:
- 手續費計算公式: 0.05% × 4 = 0.2%
- 4 筆交易明細（建倉/平倉 多方/空方）
- 說明統一使用 Taker fee

---

## Development Workflow

### For Frontend Developers

#### 1. 理解類型變更

```typescript
// OLD: app/(dashboard)/market-monitor/types.ts
interface BestArbitragePair {
  spreadPercent: number;
  priceDiffPercent: number;
  netReturn: number;  // ❌ 已移除
  // ...
}

// NEW: app/(dashboard)/market-monitor/types.ts
interface BestArbitragePair {
  spreadPercent: number;
  priceDiffPercent: number;
  // netReturn 欄位移除
  // ...
}
```

#### 2. 使用新元件

```typescript
// OLD: RateRow.tsx
import { NetProfitTooltip } from './NetProfitTooltip';

<NetProfitTooltip netReturn={rate.bestPair.netReturn} />

// NEW: RateRow.tsx
import { FeeEstimateTooltip } from './FeeEstimateTooltip';

<FeeEstimateTooltip />  // 無需傳遞參數，固定值 0.2%
```

#### 3. 更新高收益判斷邏輯

```typescript
// OLD: RateRow.tsx
const isHighOpportunity = rate.bestPair?.netReturn && rate.bestPair.netReturn > 0.5;

// NEW: RateRow.tsx
const isHighOpportunity = rate.bestPair?.spreadPercent && rate.bestPair.spreadPercent > 0.5;
```

### For Backend Developers

#### 1. 移除 netReturn 計算

```typescript
// OLD: app/api/market-rates/route.ts
const TOTAL_COST_RATE = 0.005;
const netSpread = (spreadPercent / 100) - TOTAL_COST_RATE;
const netAnnualized = netSpread * 365 * 3 * 100;

return {
  // ...
  netReturn: netAnnualized,  // ❌ 移除
};

// NEW: app/api/market-rates/route.ts
return {
  // ...
  // netReturn 欄位移除
};
```

#### 2. 移除 WebSocket 推送

```typescript
// OLD: MarketRatesHandler.ts
netReturn: rate.bestPair.netReturn ?? calculateNetReturn(...),

// NEW: MarketRatesHandler.ts
// netReturn 欄位移除
```

---

## Testing Guide

### Unit Tests

#### Run Frontend Tests

```bash
pnpm test app/(dashboard)/market-monitor
```

**Expected**: 所有測試通過，無 `netReturn` 相關測試

#### Run Backend Tests

```bash
pnpm test app/api/market-rates
```

**Expected**: API 返回數據不包含 `netReturn` 欄位

### E2E Tests

#### Run Playwright Tests

```bash
pnpm test:e2e market-monitor
```

**Test Cases**:
- 驗證市場監控頁面顯示三個欄位
- 驗證不顯示淨收益欄位
- 驗證手續費 Tooltip 正確顯示
- 驗證排序功能正常運作

---

## Common Issues & Solutions

### Issue 1: TypeScript 編譯錯誤

**Error**:
```
Property 'netReturn' does not exist on type 'BestArbitragePair'
```

**Solution**:
```typescript
// 移除所有使用 netReturn 的代碼
// ❌ const value = rate.bestPair.netReturn;
// ✅ const value = rate.bestPair.spreadPercent;
```

### Issue 2: 前端顯示 undefined

**Error**: 手續費欄位顯示 `undefined`

**Solution**:
```typescript
// 確保使用 FeeEstimateTooltip 元件
// ✅ <FeeEstimateTooltip />
// 此元件內部使用固定值 0.2%
```

### Issue 3: API 仍然返回 netReturn

**Error**: API 返回數據包含 `netReturn` 欄位

**Solution**:
```bash
# 檢查是否已移除計算邏輯
grep -r "netReturn" app/api/market-rates/

# 重啟開發伺服器
pnpm dev
```

---

## Documentation References

### Feature Documentation

- [Spec](./spec.md): 功能規格（用戶故事、需求、成功標準）
- [Plan](./plan.md): 技術計劃（架構、設計、Constitution Check）
- [Research](./research.md): 技術調研（決策、理由、替代方案）
- [Data Model](./data-model.md): 資料模型（無變更）
- [API Changes](./contracts/api-changes.md): API 合約變更

### Project Documentation

- [Trading Fees](../../docs/trading-fees.md): 手續費計算規範 ⭐ **NEW**
- [Constitution](../../.specify/memory/constitution.md): 專案原則
- [CLAUDE.md](../../CLAUDE.md): 開發指南

---

## Feature Checklist

開發者可使用此檢查清單確認功能完整性：

### Frontend Changes

- [ ] `RatesTable.tsx`: 移除淨收益欄位，新增手續費欄位
- [ ] `RateRow.tsx`: 移除 `NetProfitTooltip`，使用 `FeeEstimateTooltip`
- [ ] `FeeEstimateTooltip.tsx`: 新增元件顯示手續費明細
- [ ] `types.ts`: 移除 `netReturn` 類型定義
- [ ] `sortComparator.ts`: 移除 netReturn 排序邏輯
- [ ] `useTableSort.ts`: 確認預設排序不是 netReturn
- [ ] 高收益標記邏輯更新為 `spreadPercent > 0.5%`

### Backend Changes

- [ ] `app/api/market-rates/route.ts`: 移除 netReturn 計算
- [ ] `MarketRatesHandler.ts`: 移除 netReturn WebSocket 推送

### Code Cleanup

- [ ] 移除 `src/lib/net-return-calculator.ts`
- [ ] 移除 `tests/unit/lib/net-return-calculator.test.ts`

### Documentation

- [ ] 建立 `docs/trading-fees.md` 手續費規範文件
- [ ] 更新 API 文件（移除 netReturn 欄位說明）

### Testing

- [ ] 單元測試通過
- [ ] E2E 測試通過
- [ ] 視覺驗證通過
- [ ] API 驗證通過

---

## Next Steps

完成驗證後，進入下一階段：

1. **Code Review**: 提交 PR 並請求 code review
2. **Testing**: 在 staging 環境進行完整測試
3. **Deployment**: 部署到 production 環境
4. **Monitoring**: 監控用戶反饋和錯誤日誌

---

## Support

如有問題，請參考：

- **Spec 文件**: [spec.md](./spec.md)
- **技術計劃**: [plan.md](./plan.md)
- **API 文件**: [contracts/api-changes.md](./contracts/api-changes.md)
- **專案 Constitution**: [.specify/memory/constitution.md](../../.specify/memory/constitution.md)

或聯繫專案維護者。
