# Phase 0: Research & Technical Decisions

**Feature**: 價差回本週期指標
**Branch**: `025-payback-periods-indicator`
**Date**: 2025-01-28

## Research Questions

### Q1: 計算邏輯的正確性驗證

**Question**: 回本次數計算公式是否符合實際套利場景？

**Research**:
- 公式：回本次數 = |價差百分比| ÷ 費率差異百分比
- 情境 1：價差 -0.15%（不利），費率差 0.05%
  - 回本次數 = 0.15 ÷ 0.05 = 3.0 次
  - 驗證：收取 3 次 0.05% 資費 = 0.15%，抵銷價差 ✅
- 情境 2：價差 +0.10%（有利），費率差 0.03%
  - 立即有正報酬，無需回本 ✅
- 情境 3：價差 -0.50%（嚴重不利），費率差 0.01%
  - 回本次數 = 0.50 ÷ 0.01 = 50 次
  - 警告訊息：次數過多，不建議開倉 ✅

**Decision**: ✅ 公式經過驗證正確，符合套利回本邏輯

---

### Q2: 前端計算 vs 後端計算

**Question**: 回本次數應該在前端還是後端計算？

**Research**:
- **前端計算優點**：
  - ✅ 即時響應，無需額外 API 請求
  - ✅ 減輕後端負載（200+ 交易對）
  - ✅ 數據來源已在前端（`BestArbitragePair` via WebSocket）
  - ✅ 計算簡單（單一除法運算，< 0.1ms）
- **後端計算優點**：
  - ❌ 需新增欄位到 WebSocket payload（增加頻寬）
  - ❌ 增加後端計算負擔（每 5 秒 200+ 對）
  - ❌ 不符合 Principle VI（Web 應負責 Data visualization）

**Decision**: ✅ 前端計算，理由：
1. 符合系統架構邊界（Web 負責視覺化）
2. 性能更優（避免重複計算和網路傳輸）
3. 數據已經可用（不需要額外資料來源）

---

### Q3: UI 顯示位置選擇

**Question**: 回本指標應該如何顯示在表格中？

**Research Options**:
1. **新增獨立欄位** ❌
   - 缺點：表格已有 9 個欄位，新增會導致視覺混亂
   - 缺點：需要調整表格佈局和響應式設計
2. **放在價差欄位下方** ✅
   - 優點：語義相關（回本指標基於價差計算）
   - 優點：不破壞現有佈局
   - 優點：與 US-005（歷史最小/最大值）顯示方式一致
3. **Tooltip 顯示** ❌
   - 缺點：關鍵資訊應可見，不應隱藏在 hover 中
   - 缺點：不符合 P1 優先級（核心價值是快速判斷）

**Decision**: ✅ 在價差欄位下方顯示（選項 2），詳細計算放 Tooltip
- 主要指標：直接可見（例如「⚠️ 需 3.0 次資費回本」）
- 詳細資訊：Tooltip 提供（計算過程、預估時間）

---

### Q4: 邊界情況處理策略

**Question**: 如何處理特殊情況（null、零、極大值）？

**Research**:

| 情況 | 處理策略 | 顯示內容 | 顏色 |
|------|---------|---------|------|
| 價格數據為 null | 優雅降級 | `N/A（無價格數據）` | 灰色 |
| 價差 ≥ 0（有利） | 正面標記 | `✓ 價差有利` | 綠色 |
| 費率差 = 0 | 無法回本 | `無法回本（費率差為零）` | 紅色 |
| 回本次數 > 100 | 警告 | `回本次數過多 (X+ 次)` | 紅色 |
| 回本次數 1-100 | 正常顯示 | `⚠️ 需 X.X 次資費回本` | 橙色 |
| 費率差為負數 | 錯誤情況 | `無效數據` | 紅色 |

**Decision**: ✅ 使用類型化結果物件，避免 undefined 錯誤：
```typescript
interface PaybackResult {
  status: 'favorable' | 'payback_needed' | 'too_many' | 'impossible' | 'no_data'
  periods?: number
  displayText: string
  color: 'green' | 'orange' | 'red' | 'gray'
}
```

---

### Q5: 時間基準整合

**Question**: 如何與現有時間基準切換功能整合？

**Research**:
- 現有時間基準：1h / 4h / 8h / 24h（來自 `timeBasis` state）
- 回本時間計算：回本次數 × 時間基準（小時）
- 範例：
  - 回本 3.0 次 × 8h 基準 = 24 小時
  - 回本 3.0 次 × 1h 基準 = 3 小時

**Decision**: ✅ Tooltip 中顯示預估回本時間，根據當前時間基準動態計算
- 計算公式：`estimatedHours = paybackPeriods * timeBasis`
- 顯示格式：
  - < 24 小時：「約 X.X 小時」
  - ≥ 24 小時：「約 X.X 天」
- 當時間基準切換時，自動重新計算所有預估時間

---

### Q6: 效能考量

**Question**: 200+ 個交易對同時計算回本次數是否會造成效能問題？

**Research**:
- 單次計算複雜度：O(1)（一個除法運算 + 條件判斷）
- 預估單次計算時間：< 0.1ms
- 200 個交易對總計算時間：< 20ms
- React 渲染優化：使用 `React.memo` 避免不必要的重新渲染

**Decision**: ✅ 效能無憂，但加入優化措施：
1. 使用 `React.memo` 包裹 `RateRow` 組件
2. 僅在 `priceDiffPercent` 或 `spreadPercent` 變化時重新計算
3. 計算函數使用 pure function（無副作用，易於優化）

---

### Q7: 測試策略

**Question**: 如何確保回本指標的正確性和穩定性？

**Research**:

**單元測試** (Vitest):
- `calculatePaybackPeriods()` 函數測試
  - 正常情況：價差不利，費率差正常
  - 邊界情況：null、零、極大值
  - 精度測試：確保小數點精度正確
- `formatArbitrageMessage()` 擴展測試
  - 複製訊息包含回本資訊
  - 不同情況下的訊息格式

**整合測試** (手動):
- 時間基準切換後，回本時間預估正確更新
- WebSocket 數據更新後，回本指標即時刷新
- Tooltip 顯示正確計算過程

**Decision**: ✅ 測試範圍：
- 必須：單元測試覆蓋所有邊界情況（目標：100% 覆蓋率）
- 建議：手動驗證 UI 交互（Tooltip、時間基準切換）
- 不需要：E2E 測試（此功能為純展示邏輯，無複雜交互）

---

### Q8: 使用者誤解風險緩解

**Question**: 如何避免使用者誤解「回本次數」為保證獲利？

**Research**:
- 風險：用戶可能認為回本次數是固定的
- 事實：費率差異會隨時間波動

**Decision**: ✅ 在 Tooltip 中加入免責說明：
```
⚠️ 注意：回本次數基於當前費率差計算，實際費率可能波動。
此指標僅供參考，不構成投資建議。
```

---

## Technical Decisions Summary

| 決策編號 | 問題 | 決定 | 理由 |
|---------|------|------|------|
| TD-001 | 計算位置 | 前端計算 | 性能更優，符合架構邊界 |
| TD-002 | UI 顯示位置 | 價差欄位下方 | 語義相關，不破壞佈局 |
| TD-003 | 邊界處理 | 類型化結果物件 | 避免 undefined，易於維護 |
| TD-004 | 時間基準 | Tooltip 動態顯示 | 整合現有功能，提供詳細資訊 |
| TD-005 | 效能優化 | React.memo + pure function | 確保 200+ 交易對流暢運行 |
| TD-006 | 測試策略 | 單元測試 + 手動驗證 | 平衡測試成本與品質 |
| TD-007 | 風險緩解 | Tooltip 免責說明 | 避免使用者誤解 |

---

## Dependencies Validation

**Existing Dependencies** (無需新增):
- ✅ `@radix-ui/react-tooltip`: 已在 package.json 中（版本 ^1.2.8）
- ✅ React 18: 現有依賴
- ✅ Next.js 14: 現有架構
- ✅ TypeScript 5.6: 現有配置

**Data Dependencies**:
- ✅ `BestArbitragePair.priceDiffPercent`: 已在資料結構中
- ✅ `BestArbitragePair.spreadPercent`: 已在資料結構中
- ✅ `timeBasis` state: 已在 market-monitor 頁面中

**No New Dependencies Required** ✅

---

## Risks Identified

| 風險 | 嚴重性 | 緩解措施 | 狀態 |
|------|--------|---------|------|
| 效能風險（交易對過多） | 低 | React.memo 優化 | ✅ 已規劃 |
| 使用者誤解風險 | 中 | Tooltip 免責說明 | ✅ 已規劃 |
| 資料不完整風險 | 低 | 優雅降級（顯示 N/A） | ✅ 已規劃 |
| 計算精度風險 | 低 | toFixed(1) + 單元測試 | ✅ 已規劃 |
| 視覺混亂風險 | 低 | 整合到現有欄位 | ✅ 已規劃 |

---

## Phase 0 Conclusion

**所有技術決策已完成** ✅

- 無 NEEDS CLARIFICATION 標記
- 計算邏輯經過驗證
- UI 設計符合現有架構
- 效能考量已納入
- 測試策略已定義
- 風險緩解措施已規劃

**準備進入 Phase 1: Design & Contracts**
