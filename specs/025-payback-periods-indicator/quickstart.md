# Quickstart: 價差回本週期指標

**Feature**: `025-payback-periods-indicator`
**Estimated Reading Time**: 5 minutes
**Date**: 2025-01-28

---

## 🎯 What This Feature Does

幫助交易者快速評估套利機會的風險：
- ✅ **價差有利**：顯示綠色標記 `✓ 價差有利`，建倉立即有正報酬
- ⚠️ **價差不利**：顯示橙色警告 `⚠️ 需 X.X 次資費回本`，告知需要收取多少次資金費率才能抵銷損失
- ❌ **高風險**：顯示紅色警告 `❌ 回本次數過多`，提醒交易者避開此機會

---

## 🚀 Quick Demo

### Before (現況)
```
市場監控表格顯示：
BTC/USDT  | 價差: -0.15%  | 費率差: 0.05%
```
**問題**：交易者不知道 -0.15% 的價差需要多久才能回本

### After (加入此功能後)
```
市場監控表格顯示：
BTC/USDT
├─ 價差: -0.15%
└─ ⚠️ 需 3.0 次資費回本  ← 新增指標
   (Hover 顯示 Tooltip: 預估 24 小時回本)
```
**效果**：交易者立刻知道需要 3 次資費（約 1 天）就能回本，可以放心開倉

---

## 📋 User Scenarios

### Scenario 1: 快速篩選機會（最常見）

**情境**：交易者查看 200+ 個交易對，想找出最佳套利機會

**操作**：
1. 開啟市場監控頁面 (`/market-monitor`)
2. 掃視「價差」欄位下方的回本指標
3. 優先選擇：
   - ✅ 綠色「價差有利」的機會（立即獲利）
   - ⚠️ 橙色「需 1-5 次回本」的機會（短期回本）
4. 避開：
   - ❌ 紅色「回本次數過多」的機會（高風險）

**時間節省**：從 5 分鐘手動計算 → 5 秒視覺掃描

---

### Scenario 2: 詳細評估單一機會

**情境**：交易者對某個交易對感興趣，想了解詳細回本資訊

**操作**:
1. 找到感興趣的交易對（例如 ETH/USDT）
2. 將滑鼠移到回本指標上
3. Tooltip 顯示：
   ```
   價差回本詳情：
   當前價差: -0.15%
   費率差異: 0.05%
   回本次數: 0.15% ÷ 0.05% = 3.0 次
   預估時間: 約 24.0 小時（基於 8h 結算週期）

   ⚠️ 注意：回本次數基於當前費率差計算，實際費率可能波動。
   ```
4. 根據資訊決定是否開倉

**效果**：清楚了解回本邏輯和時間預估

---

### Scenario 3: 切換時間基準查看不同結算週期

**情境**：交易者想比較不同結算週期下的回本時間

**操作**:
1. 查看某交易對的回本指標：`⚠️ 需 3.0 次資費回本`
2. 點擊時間基準切換按鈕：`8h` → `1h`
3. Tooltip 中的預估時間自動更新：
   - 8h 基準：`約 24.0 小時`
   - 1h 基準：`約 3.0 小時` ✨
4. 發現某些交易對在 1h 結算週期下回本更快

**效果**：幫助選擇最適合的交易對和結算週期

---

### Scenario 4: 複製訊息分享給團隊

**情境**：交易者想將套利機會分享給團隊成員

**操作**:
1. 找到一個好機會（例如 BTC/USDT）
2. 點擊該行的「複製」按鈕
3. 複製的訊息自動包含回本資訊：
   ```
   📊 套利機會分析
   交易對: BTC/USDT
   做多: 幣安 (100.00 USDT)
   做空: OKX (99.85 USDT)
   價差: -0.15%
   費率差: 0.05%
   ⏱️ 價差回本: 需收取 3.0 次資費（約 24 小時）  ← 新增
   ```
4. 貼到團隊群組，成員立即了解風險

**效果**：溝通更高效，決策更透明

---

## 🛠️ Technical Overview (For Developers)

### Implementation Summary

```typescript
// 1. 新增計算函數 (app/(dashboard)/market-monitor/utils/rateCalculations.ts)
function calculatePaybackPeriods(
  priceDiffPercent: number | null,
  spreadPercent: number,
  timeBasis: number
): PaybackResult {
  // 邊界情況
  if (priceDiffPercent === null) return { status: 'no_data', ... }
  if (priceDiffPercent >= 0) return { status: 'favorable', ... }
  if (spreadPercent === 0) return { status: 'impossible', ... }

  // 計算回本次數
  const periods = Math.abs(priceDiffPercent) / spreadPercent

  if (periods > 100) return { status: 'too_many', periods, ... }
  return { status: 'payback_needed', periods, ... }
}

// 2. 在 RateRow 組件中使用 (components/RateRow.tsx)
const payback = calculatePaybackPeriods(
  pair.priceDiffPercent,
  pair.spreadPercent,
  timeBasis
)

// 3. 渲染指標
<div className={`text-${payback.color}-500`}>
  {payback.displayText}
</div>

// 4. 加入 Tooltip (使用 Radix UI)
<Tooltip>
  <TooltipTrigger>{payback.displayText}</TooltipTrigger>
  <TooltipContent>{payback.details.formula}</TooltipContent>
</Tooltip>
```

### Files to Modify

| File | Action | Lines of Code |
|------|--------|---------------|
| `utils/rateCalculations.ts` | 新增 `calculatePaybackPeriods()` | ~80 lines |
| `components/RateRow.tsx` | 顯示回本指標 + Tooltip | ~40 lines |
| `utils/formatArbitrageMessage.ts` | 擴展複製訊息 | ~20 lines |
| `tests/unit/calculatePaybackPeriods.test.ts` | 單元測試 | ~100 lines |

**Total**: ~240 lines of code (含測試)

---

## ✅ Acceptance Criteria (How to Verify)

### P1 - 核心功能（必須在 MVP 實作）

- [ ] 當價差不利時，顯示「⚠️ 需 X.X 次資費回本」
- [ ] 當價差有利時，顯示「✓ 價差有利」（綠色）
- [ ] 回本次數精確到小數點後 1 位
- [ ] 回本次數 > 100 時，顯示「❌ 回本次數過多 (X+ 次)」
- [ ] 計算正確：回本次數 = |價差| ÷ 費率差

### P2 - 輔助功能（可稍後實作）

- [ ] Tooltip 顯示詳細計算過程（當前價差、費率差、公式、預估時間）
- [ ] 時間基準切換時，Tooltip 中的預估時間自動更新
- [ ] 複製訊息包含回本資訊
- [ ] Tooltip 包含免責說明

### P3 - 邊界處理（最後完善）

- [ ] 無價格數據時，顯示「N/A（無價格數據）」
- [ ] 費率差為零時，顯示「無法回本（費率差為零）」
- [ ] 數據恢復後，回本指標即時更新

---

## 🧪 Testing Guide

### Manual Test Cases

#### Test 1: 價差不利，合理回本次數
```
Input: 價差 = -0.15%, 費率差 = 0.05%, 時間基準 = 8h
Expected: "⚠️ 需 3.0 次資費回本" (橙色)
Tooltip: "預估時間: 約 24.0 小時"
```

#### Test 2: 價差有利
```
Input: 價差 = +0.15%, 費率差 = 0.03%, 時間基準 = 8h
Expected: "✓ 價差有利" (綠色)
Tooltip: "價差有利表示建倉即有正報酬"
```

#### Test 3: 回本次數過多
```
Input: 價差 = -0.50%, 費率差 = 0.01%, 時間基準 = 8h
Expected: "❌ 回本次數過多 (50+ 次)" (紅色)
Tooltip: "預估時間: 約 400.0 小時（約 16.7 天）"
         "⚠️ 注意：回本次數過多，費率可能在持倉期間波動，風險較高"
```

#### Test 4: 無價格數據
```
Input: 價差 = null, 費率差 = 0.05%
Expected: "N/A（無價格數據）" (灰色)
Tooltip: 不顯示
```

#### Test 5: 時間基準切換
```
Steps:
1. 查看某交易對回本指標（時間基準 = 8h）
2. 切換到 1h 基準
3. 驗證 Tooltip 中的預估時間更新（24h → 3h）
```

### Unit Test Command

```bash
pnpm test calculatePaybackPeriods
```

**Expected Coverage**: 100% (所有分支和邊界情況)

---

## 📊 Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| 判斷時間 | < 30 秒 | 用戶從看到機會到決定是否開倉 |
| 虧損減少 | 50% | 追蹤因價差不利而開倉後虧損的案例 |
| 計算準確性 | 100% | 與手動計算對比誤差 < 0.1 次 |
| UI 響應時間 | < 100ms | 200 個交易對同時渲染 |
| Tooltip 顯示速度 | < 0.5s | 滑鼠 hover 到顯示的時間 |

---

## 🚧 Known Limitations

1. **費率波動風險**: 回本次數基於當前費率差計算，實際費率會隨時間波動
   - **緩解措施**: Tooltip 包含免責說明

2. **不考慮手續費**: 回本計算僅考慮價差和資費，不包含開倉/平倉手續費
   - **理由**: 手續費已在其他欄位顯示，避免重複計算

3. **純前端計算**: 不儲存歷史回本次數資料
   - **理由**: 符合 MVP 範圍，未來可擴展

---

## 🔗 Related Documentation

- [Feature Specification](./spec.md) - 完整需求文件
- [Implementation Plan](./plan.md) - 技術實作計劃
- [Data Model](./data-model.md) - 資料結構定義
- [Calculation Contract](./contracts/payback-calculation.md) - 計算函數規範

---

## 🎓 Learning Resources

### Understanding Funding Rates
- 資金費率是永續合約的持倉成本（或收益）
- 正費率：多頭支付給空頭
- 負費率：空頭支付給多頭
- 結算週期：1h / 4h / 8h（視交易所而定）

### Price Difference Direction
- **正價差**：做空價 > 做多價（建倉立即獲利）
- **負價差**：做空價 < 做多價（建倉虧損，需透過資費回本）

### Payback Period Concept
```
範例：
建倉時虧損 0.15%（價差不利）
每次收取資費 0.05%（費率差）
需要收取 3 次資費才能抵銷虧損
在 8h 結算週期下，需要 24 小時回本
```

---

## 💡 Tips for Best Results

1. **優先選擇價差有利的機會**：建倉立即獲利，風險最低
2. **回本次數 < 5 為佳**：短期內即可回本，降低費率波動風險
3. **避開回本次數 > 20 的機會**：時間過長，費率可能逆轉
4. **結合費率差欄位判斷**：費率差越大，回本越快
5. **使用 Tooltip 了解詳情**：不要只看表面數字，理解計算邏輯

---

## 🆘 Troubleshooting

### Q: 為什麼有些交易對顯示「N/A（無價格數據）」？

**A**: 可能原因：
1. 交易所 API 暫時無回應
2. 該交易對在某個交易所不存在
3. WebSocket 連接中斷

**解決方法**: 等待數據更新（每 5 秒推送一次），或檢查 WebSocket 連接狀態

---

### Q: 回本次數是否保證準確？

**A**: 回本次數基於**當前**費率差計算，實際費率會隨市場波動。此指標僅供參考，不構成投資建議。

---

### Q: 為什麼時間基準切換後，回本次數不變，只有預估時間改變？

**A**: 回本次數 = |價差| ÷ 費率差（與結算週期無關）
預估時間 = 回本次數 × 時間基準（受結算週期影響）

範例：
- 回本次數 = 3 次（固定）
- 8h 基準：3 × 8 = 24 小時
- 1h 基準：3 × 1 = 3 小時

---

## ✨ Next Steps

1. ✅ 閱讀完此 Quickstart
2. ⏳ 等待功能實作完成
3. ⏳ 在測試環境驗證功能
4. ⏳ 提供回饋和改進建議
5. ⏳ 上線到生產環境

---

**準備好了嗎？** 開始使用價差回本週期指標，讓套利交易更安全、更高效！ 🚀
