# Research & Technical Decisions: 移除淨收益欄位

**Feature**: 014-remove-net-return-display
**Date**: 2025-01-17
**Status**: Complete

## Overview

本文檔記錄移除淨收益欄位功能的技術調研和決策過程。由於這是一個純 UI 重構功能，Technical Context 中沒有需要澄清的技術未知項（NEEDS CLARIFICATION）。以下記錄關鍵技術決策和理由。

## Key Technical Decisions

### Decision 1: 移除 vs 重構淨收益欄位

**Decision**: 完全移除「淨收益」欄位和相關計算邏輯

**Rationale**:
- **問題分析**: 淨收益計算公式（`netReturn = spreadPercent - |priceDiffPercent| - tradingCostRate`）隱含假設持倉 1 個資金費率週期（8 小時），但：
  - 資金費率是週期性收益（每 8 小時結算一次）
  - 價差是即時成本（開倉時一次性發生）
  - 持倉時間越長，價差成本相對影響越小
  - 這個計算方式對長期持倉策略不準確，容易誤導用戶
- **用戶反饋**: 用戶表示「資金費率是每幾小時就收一次，拿他跟價差直接相減，感覺不太對」
- **解決方案**: 提供原始數據（費率差、價差、手續費），讓用戶根據自己的策略自行判斷

**Alternatives Considered**:

| Alternative | Why Rejected |
|-------------|--------------|
| 保留淨收益但加上免責聲明 | 用戶仍可能忽略警告，繼續依賴誤導性數據 |
| 提供多週期淨收益計算（1/3/7 天） | 增加複雜度，且仍無法涵蓋所有持倉策略 |
| 改為年化收益顯示 | 年化收益假設持倉一年，對短期套利同樣不準確 |
| 改名為「參考淨收益」 | 僅改名稱不解決計算邏輯問題 |

**Best Practice Reference**:
- 金融產品設計原則：避免提供可能誤導的衍生指標，優先提供原始數據
- UI/UX 最佳實踐：簡化數據呈現，讓用戶專注於核心指標

---

### Decision 2: 手續費計算標準化

**Decision**: 統一使用 Taker fee 0.05% × 4 筆交易 = 0.2%

**Rationale**:
- **用戶明確要求**: 「手續費的部分請幫我把它寫入專案的文件規範中，固定算 0.05% * 4，多方、空方建倉及平倉都用 taker 計算」
- **簡化假設**: 套利交易通常需要快速執行，使用 Taker 訂單（市價單）而非 Maker 訂單（限價單）更符合實際情況
- **保守估計**: Taker fee 通常高於 Maker fee，使用 Taker fee 提供保守的成本估計

**Formula**:
```
總手續費 = Taker fee × 4 筆交易
         = 0.05% × 4
         = 0.2%

4 筆交易：
1. 建倉做多 (Long Open)   - Taker 0.05%
2. 建倉做空 (Short Open)  - Taker 0.05%
3. 平倉做多 (Long Close)  - Taker 0.05%
4. 平倉做空 (Short Close) - Taker 0.05%
```

**Assumptions**:
- 所有交易所使用相同的 Taker fee（0.05%）
- 不考慮 VIP 會員等級折扣
- 不考慮交易量折扣
- 套利交易必須在兩個交易所同時開倉和平倉（4 筆交易）

**Alternatives Considered**:

| Alternative | Why Rejected |
|-------------|--------------|
| 使用 Maker fee 計算 | 套利需要快速執行，Maker 訂單可能無法及時成交 |
| 支援不同交易所費率 | 增加複雜度，且主流交易所 Taker fee 接近 0.05% |
| 支援 VIP 等級折扣 | 用戶等級不同，難以提供統一標準 |
| 動態查詢交易所費率 | 增加 API 調用，且費率變動不頻繁 |

**Documentation**: 將在 `docs/trading-fees.md` 中正式文件化此標準。

---

### Decision 3: UI 元件重構方式

**Decision**: 移除 `NetProfitTooltip.tsx`，新增 `FeeEstimateTooltip.tsx`

**Rationale**:
- **語義清晰**: 新元件名稱明確表達用途（手續費估算）
- **可重用性**: `FeeEstimateTooltip` 可在未來其他頁面重用（如交易確認頁面）
- **程式碼清理**: 移除舊元件避免維護負擔

**Implementation Approach**:
```typescript
// FeeEstimateTooltip.tsx
export function FeeEstimateTooltip() {
  return (
    <Tooltip>
      <TooltipTrigger>
        <span className="text-gray-600">0.2%</span>
        <Info className="inline w-4 h-4 ml-1" />
      </TooltipTrigger>
      <TooltipContent>
        <div className="space-y-2">
          <h4 className="font-semibold">手續費明細</h4>
          <table className="text-sm">
            <tr><td>建倉做多 (Long Open)</td><td>0.05%</td></tr>
            <tr><td>建倉做空 (Short Open)</td><td>0.05%</td></tr>
            <tr><td>平倉做多 (Long Close)</td><td>0.05%</td></tr>
            <tr><td>平倉做空 (Short Close)</td><td>0.05%</td></tr>
            <tr className="font-semibold border-t">
              <td>總計</td><td>0.20%</td>
            </tr>
          </table>
          <p className="text-xs text-gray-500">
            所有交易使用 Taker fee 計算
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
```

**Alternatives Considered**:

| Alternative | Why Rejected |
|-------------|--------------|
| 重構 NetProfitTooltip | 舊元件與淨收益計算耦合，重構不如新建 |
| 不提供 Tooltip | 手續費明細對用戶理解成本結構很重要 |
| 使用 Modal 顯示明細 | Tooltip 更輕量，不打斷用戶流程 |

---

### Decision 4: 後端 API 修改範圍

**Decision**: 僅移除 `netReturn` 欄位返回，保留其他計算邏輯

**Rationale**:
- **向後兼容**: 其他欄位（`spreadPercent`, `priceDiffPercent`, `annualizedReturn`）保持不變
- **最小修改**: 降低引入 bug 的風險
- **保留後端邏輯**: `NetProfitCalculator.ts` 保留供其他功能使用（如套利評估）

**API Changes**:
- `/app/api/market-rates/route.ts`: 移除 `netReturn` 計算和返回
- `/src/websocket/handlers/MarketRatesHandler.ts`: 移除 `netReturn` WebSocket 推送

**Preserved**:
- `src/services/calculation/NetProfitCalculator.ts`: 保留供後端套利評估使用
- `src/lib/cost-calculator.ts`: 保留供其他功能使用

**Alternatives Considered**:

| Alternative | Why Rejected |
|-------------|--------------|
| 完全移除所有淨收益計算代碼 | 後端套利評估仍需要淨收益計算 |
| 保留 API 返回但前端不顯示 | 浪費網路頻寬，且容易引起混淆 |
| 重新命名為 referenceReturn | 不解決計算邏輯問題 |

---

### Decision 5: 排序功能處理

**Decision**: 移除「淨收益」排序選項，不新增替代排序欄位

**Rationale**:
- **已有替代方案**: 用戶可使用「費率差異」排序（`spreadPercent`）替代淨收益排序
- **簡化 UI**: 減少排序選項，降低用戶認知負擔
- **技術簡單**: 僅需移除 `sortComparator.ts` 中的相關代碼

**Impact Analysis**:
- 移除 `SortField` 類型中的 `'netReturn'` 選項
- 更新 `sortComparator.ts` 移除 netReturn 比較器
- 檢查 `useTableSort.ts` 確保預設排序不是 netReturn

**Alternatives Considered**:

| Alternative | Why Rejected |
|-------------|--------------|
| 新增「手續費」排序選項 | 手續費是固定值（0.2%），排序無意義 |
| 新增「淨利潤」排序（費率差 - 手續費） | 仍然忽略價差和持倉週期問題 |
| 保留淨收益排序但隱藏欄位 | 技術債務，增加維護負擔 |

---

### Decision 6: 高收益機會標記邏輯

**Decision**: 更新判斷邏輯為 `spreadPercent > 0.5%`

**Rationale**:
- **當前邏輯**: `netReturn > 0.5%` 會被移除
- **替代邏輯**: 使用費率差異（`spreadPercent`）作為判斷依據更直接
- **業務意義**: 費率差異 > 0.5% 表示有明顯的套利機會（即使考慮手續費和價差）

**Implementation**:
```typescript
// RateRow.tsx (Before)
const isHighOpportunity = rate.bestPair?.netReturn && rate.bestPair.netReturn > 0.5;

// RateRow.tsx (After)
const isHighOpportunity = rate.bestPair?.spreadPercent && rate.bestPair.spreadPercent > 0.5;
```

**Threshold Justification**:
- 費率差異 0.5% > 手續費 0.2%，留有 0.3% 緩衝
- 考慮價差（通常 < 0.2%），仍有潛在套利空間
- 閾值可在未來根據實際情況調整

**Alternatives Considered**:

| Alternative | Why Rejected |
|-------------|--------------|
| 移除高收益標記功能 | 標記對用戶快速識別機會有幫助 |
| 使用複雜公式（費率差 - 價差 - 手續費） | 回到原問題，忽略持倉週期 |
| 使用年化收益判斷 | 年化收益對短期套利參考價值有限 |

---

## Implementation Notes

### Testing Strategy

1. **單元測試**:
   - `FeeEstimateTooltip.tsx`: 測試渲染和內容正確性
   - `sortComparator.ts`: 測試移除 netReturn 後排序邏輯正確
   - API route: 測試返回數據不包含 netReturn

2. **整合測試**:
   - WebSocket handler: 測試推送數據不包含 netReturn
   - 前端元件整合: 測試資料列正確顯示三個獨立指標

3. **E2E 測試**:
   - 驗證市場監控頁面顯示三個欄位（費率差、價差、手續費）
   - 驗證不顯示「淨收益」欄位
   - 驗證手續費 Tooltip 正確顯示明細
   - 驗證排序功能正常運作
   - 驗證高收益標記基於費率差異判斷

### Migration Considerations

**Breaking Changes**: 無

- API 向後兼容：移除 `netReturn` 欄位不影響現有客戶端（前端會自動適配）
- 資料庫 schema 無變更
- WebSocket 協議向後兼容

**Deployment Strategy**:

1. 部署後端 API 和 WebSocket 修改（移除 netReturn）
2. 部署前端 UI 修改
3. 驗證功能正常運作
4. 移除未使用的程式碼（`net-return-calculator.ts`）

### Documentation Updates Required

1. **User Documentation**:
   - 更新使用者指南，說明新的指標顯示方式
   - 新增手續費計算說明

2. **Technical Documentation**:
   - 建立 `docs/trading-fees.md` 手續費規範文件
   - 更新 CLAUDE.md 專案指南（如需要）
   - 更新 API 文件（移除 netReturn 欄位說明）

3. **Code Comments**:
   - 在 `FeeEstimateTooltip.tsx` 中說明固定值 0.2% 的來源
   - 在 `RateRow.tsx` 中說明高收益判斷邏輯變更

## Risk Assessment

**Low Risk**:
- 純 UI 修改，不影響交易邏輯
- 不修改資料庫 schema
- 向後兼容

**Mitigation**:
- 完整的單元測試和 E2E 測試覆蓋
- 分階段部署（後端 → 前端 → 清理）
- 保留回滾選項（保留舊元件直到驗證完成）

## Conclusion

所有技術決策基於用戶需求、最佳實踐和專案規範制定。無未解決的技術問題（NEEDS CLARIFICATION），可直接進入 Phase 1 設計階段。
