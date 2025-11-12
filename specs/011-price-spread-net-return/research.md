# Technical Research: Web 市場監控整合價差顯示與淨收益計算

**Feature**: 011-price-spread-net-return
**Created**: 2025-11-12
**Purpose**: Document technical decisions, alternatives considered, and rationale for implementation choices

---

## Executive Summary

此功能為 Web 市場監控頁面新增價差和淨收益欄位，無需任何新依賴或架構變更。所有必要資料已存在於現有系統中（RatesCache），只需擴展 WebSocket 推送和前端顯示邏輯。主要技術決策包括：淨收益計算公式、顏色指示器實作方式、排序機制擴展、WebSocket 資料格式和錯誤處理策略。

---

## Decision 1: 淨收益計算公式

### Context

用戶希望看到「真實淨收益」，即扣除價差和交易手續費後的實際獲利百分比。系統已有資金費率差異（`spreadPercent`）和價差（`priceDiffPercent`），需要決定如何整合這些數值並計算淨收益。

### Research Findings

**現有資料**（來自程式碼檢查）：
- `spreadPercent`：資金費率差異百分比（例如 0.15 表示 0.15%）
- `priceDiffPercent`：做空價格與做多價格的差異百分比（可正可負）
- `TOTAL_TRADING_COST_RATE`：定義在 `src/lib/cost-constants.ts`，值為 0.003（0.3%）

**計算公式選項**：

| 選項 | 公式 | 優點 | 缺點 |
|------|------|------|------|
| A | `spreadPercent - priceDiffPercent - 0.3` | 簡單直接 | 未考慮價差方向（可能為負） |
| B | `spreadPercent - Math.abs(priceDiffPercent) - 0.3` | 處理正負價差 | 需要額外的絕對值計算 |
| C | 使用 Decimal.js 高精度計算 | 絕對精確 | 過度設計，百分比不需要高精度 |
| D | 在前端計算 | 減輕後端負擔 | 違反架構原則，計算應在後端 |

### Decision

**選擇選項 B**：`netReturn = spreadPercent - Math.abs(priceDiffPercent) - TRADING_FEE_PERCENT`

### Rationale

1. **正確處理價差方向**：
   - 正價差（做空價格 > 做多價格）：有利於套利 → 減去正值
   - 負價差（做空價格 < 做多價格）：不利於套利 → 減去絕對值仍為正值損失
   - 使用 `Math.abs()` 確保價差始終作為成本扣除

2. **符合財務邏輯**：
   - 資金費率收益（spreadPercent）
   - 減去價差成本（|priceDiffPercent|）
   - 減去交易手續費（0.3%）
   - = 真實淨收益

3. **效能足夠**：
   - JavaScript Number 精度對百分比計算足夠（約 15-17 位有效數字）
   - 套利百分比通常在 ±5% 範圍內，不需要 Decimal.js

4. **符合架構**：
   - 計算在後端（WebSocket handler）執行
   - 前端僅接收和顯示結果

### Source Code Reference

```typescript
// src/lib/cost-constants.ts
export const TOTAL_TRADING_COST_RATE = 0.003; // 0.3%

// 實作位置：src/websocket/handlers/MarketRatesHandler.ts
const netReturn = rate.bestPair.spreadPercent
                  - Math.abs(rate.bestPair.priceDiffPercent ?? 0)
                  - (TOTAL_TRADING_COST_RATE * 100); // 轉換為百分比
```

### Alternatives Not Chosen

- **選項 A**（未處理負價差）：會導致負價差時淨收益過高，財務邏輯錯誤
- **選項 C**（Decimal.js）：過度工程，增加複雜度和包大小，無實際益處
- **選項 D**（前端計算）：違反 Constitution Principle VI（Web 不應執行業務邏輯）

---

## Decision 2: 顏色指示器實作方式

### Context

淨收益欄位需要使用顏色指示器標示有利（綠色）、持平（黃色）或不利（紅色）的機會。需要決定使用什麼技術實作顏色指示器，以及如何定義顏色閾值。

### Research Findings

**現有技術棧**：
- Tailwind CSS 3.4.18（專案已使用）
- 現有欄位使用 Tailwind 顏色類別（例如 `text-green-600`、`bg-gray-50`）
- 專案無自訂 CSS 模組或 styled-components

**實作選項**：

| 選項 | 技術 | 優點 | 缺點 |
|------|------|------|------|
| A | 純文字顏色 | 最簡單 | 不夠明顯，對色盲用戶不友善 |
| B | 背景顏色 + 文字顏色 | 明顯，符合無障礙標準 | 需要更多 CSS 類別 |
| C | 圖標（emoji/SVG） | 視覺化 | 不夠直觀，增加複雜度 |
| D | Progress bar | 視覺化程度高 | 過度設計，不適合百分比 |

**顏色閾值選項**：

| 方案 | 綠色閾值 | 黃色範圍 | 紅色閾值 | 依據 |
|------|----------|----------|----------|------|
| 激進 | > 0% | -0.1% ~ 0% | < -0.1% | 任何正收益都標為綠色 |
| 穩健 | > 0.1% | -0.05% ~ 0.1% | < -0.05% | 需要明顯正收益才標綠色 |
| 保守 | > 0.2% | 0% ~ 0.2% | < 0% | 只有高收益才標綠色 |

### Decision

**實作方式**：選擇選項 B（背景顏色 + 文字顏色）

**閾值方案**：選擇穩健方案（> 0.1% 綠色、-0.05% ~ 0.1% 黃色、< -0.05% 紅色）

### Rationale

**實作方式**：
1. **明顯性**：背景顏色比純文字顏色更容易識別
2. **無障礙**：符合 WCAG AA 標準，對色盲用戶友善（使用淺色背景 + 深色文字）
3. **一致性**：與專案現有的 Tailwind CSS 使用模式一致
4. **簡單性**：無需引入新依賴或複雜邏輯

**閾值方案**：
1. **排除噪音**：0.1% 綠色閾值過濾掉微小波動，避免用戶誤判
2. **容錯範圍**：-0.05% ~ 0.1% 黃色範圍提供「可接受」的判斷空間
3. **風險警示**：< -0.05% 紅色警告明顯不利的機會
4. **用戶反饋**：基於 spec.md 中用戶需求「避免賺資金費率、賠價差」

### Implementation

```tsx
// 顏色邏輯（app/(dashboard)/market-monitor/components/RateRow.tsx）
function getNetReturnColor(netReturn: number): {
  bg: string;
  text: string;
  label: string;
} {
  if (netReturn > 0.1) {
    return {
      bg: 'bg-green-100',
      text: 'text-green-800',
      label: '優勢',
    };
  } else if (netReturn >= -0.05 && netReturn <= 0.1) {
    return {
      bg: 'bg-yellow-100',
      text: 'text-yellow-800',
      label: '持平',
    };
  } else {
    return {
      bg: 'bg-red-100',
      text: 'text-red-800',
      label: '不利',
    };
  }
}
```

### Alternatives Not Chosen

- **選項 A**（純文字顏色）：對視覺辨識較弱，不符合無障礙標準
- **選項 C**（圖標）：增加理解成本，用戶需要學習圖標含義
- **選項 D**（Progress bar）：過度視覺化，不適合單一數值顯示

---

## Decision 3: 排序機制擴展

### Context

需要支援按價差和淨收益排序，同時保持 Feature 009 已實作的穩定排序特性（相同數值的項目不會跳動）。

### Research Findings

**現有排序實作**（Feature 009）：
- 檔案：`app/(dashboard)/market-monitor/utils/sortComparator.ts`
- 機制：使用快照排序（snapshot sorting），WebSocket 更新時不重新排序
- 次要排序 key：symbol（交易對名稱字母順序）
- 支援欄位：symbol、spread、annualizedReturn

**擴展選項**：

| 選項 | 方法 | 優點 | 缺點 |
|------|------|------|------|
| A | 直接修改 `sortComparator.ts` 新增 case | 簡單，遵循現有模式 | 無 |
| B | 建立新的排序函數 | 隔離變更 | 重複程式碼，違反 DRY 原則 |
| C | 使用第三方排序庫（lodash） | 功能豐富 | 增加依賴，過度設計 |

### Decision

**選擇選項 A**：直接修改 `sortComparator.ts`，新增 `priceDiff` 和 `netReturn` 兩個 case

### Rationale

1. **遵循現有模式**：
   - Feature 009 已建立清晰的排序架構
   - 新增 case 與現有 case（spread、annualizedReturn）結構一致
   - 保持程式碼可讀性和維護性

2. **保持穩定排序**：
   - 使用相同的次要排序 key（symbol）
   - 繼承快照排序機制，避免 WebSocket 更新導致跳動

3. **最小化變更**：
   - 只需修改一個檔案（sortComparator.ts）和類型定義（types.ts）
   - 無需引入新依賴或複雜邏輯

### Implementation

```typescript
// app/(dashboard)/market-monitor/utils/sortComparator.ts

export function stableSortComparator(
  a: MarketRate,
  b: MarketRate,
  sortBy: SortField,
  sortDirection: SortDirection
): number {
  let result = 0;

  switch (sortBy) {
    case 'symbol':
      result = a.symbol.localeCompare(b.symbol);
      break;

    case 'spread':
      const spreadA = a.bestPair?.spreadPercent ?? 0;
      const spreadB = b.bestPair?.spreadPercent ?? 0;
      result = spreadA - spreadB;
      break;

    // ... 現有 cases ...

    case 'priceDiff':  // NEW
      const priceDiffA = a.bestPair?.priceDiffPercent ?? 0;
      const priceDiffB = b.bestPair?.priceDiffPercent ?? 0;
      result = priceDiffA - priceDiffB;
      break;

    case 'netReturn':  // NEW
      const netReturnA = a.bestPair?.netReturn ?? 0;
      const netReturnB = a.bestPair?.netReturn ?? 0;
      result = netReturnA - netReturnB;
      break;

    default:
      result = a.symbol.localeCompare(b.symbol);
  }

  // 次要排序：symbol name（確保穩定性）
  if (result === 0) {
    result = a.symbol.localeCompare(b.symbol);
  }

  // 套用排序方向
  return sortDirection === 'asc' ? result : -result;
}
```

### Alternatives Not Chosen

- **選項 B**（新排序函數）：重複程式碼，違反 DRY 原則，增加維護成本
- **選項 C**（第三方庫）：過度設計，專案已有完善的排序實作

---

## Decision 4: WebSocket 資料格式

### Context

需要決定如何在 WebSocket 推送中傳遞價差和淨收益資料。需要考慮向後相容性、資料結構一致性和前端解析複雜度。

### Research Findings

**現有 WebSocket 資料格式**（MarketRatesHandler.ts）：

```typescript
interface MarketRateUpdate {
  symbol: string;
  exchanges: {
    [key: string]: {
      rate: number;
      ratePercent?: string;
      price?: number;
    };
  };
  bestPair?: {
    longExchange: string;
    shortExchange: string;
    spread: number;
    spreadPercent: number;
    annualizedReturn: number;
  };
  status: string;
  timestamp: number;
}
```

**擴展選項**：

| 選項 | 位置 | 結構 | 影響 |
|------|------|------|------|
| A | 在 `bestPair` 中新增欄位 | 平面結構 | 最小，向後相容 |
| B | 新增頂層 `analysis` 物件 | 巢狀結構 | 需要修改前端解析 |
| C | 單獨的 WebSocket 事件 | 獨立事件 | 增加複雜度，兩次推送 |

### Decision

**選擇選項 A**：在現有 `bestPair` 物件中新增 `priceDiffPercent` 和 `netReturn` 欄位

### Rationale

1. **向後相容**：
   - 新增欄位不影響現有客戶端（舊客戶端忽略新欄位）
   - 無需版本控制或遷移邏輯

2. **結構一致**：
   - 價差和淨收益都是「最佳套利對」的屬性
   - 與現有欄位（spreadPercent、annualizedReturn）語義一致

3. **最小化變更**：
   - 只需修改 `formatRates()` 函數
   - 前端無需修改 WebSocket 訂閱邏輯

4. **效能**：
   - 單一推送，無額外網路開銷
   - 資料大小增加微小（兩個數值欄位）

### Implementation

```typescript
// src/websocket/handlers/MarketRatesHandler.ts

private formatRates(rates: any[]): any[] {
  return rates.map((rate) => {
    const bestPair = rate.bestPair ? {
      longExchange: rate.bestPair.longExchange,
      shortExchange: rate.bestPair.shortExchange,
      spread: rate.bestPair.spreadPercent / 100,
      spreadPercent: rate.bestPair.spreadPercent,
      annualizedReturn: rate.bestPair.spreadAnnualized,
      // NEW FIELDS
      priceDiffPercent: rate.bestPair.priceDiffPercent ?? null,
      netReturn: this.calculateNetReturn(rate.bestPair) ?? null,
    } : null;

    return { ...rate, bestPair };
  });
}

private calculateNetReturn(bestPair: any): number | null {
  if (!bestPair || bestPair.priceDiffPercent == null) {
    return null;
  }

  const netReturn = bestPair.spreadPercent
                    - Math.abs(bestPair.priceDiffPercent)
                    - (TOTAL_TRADING_COST_RATE * 100);

  return netReturn;
}
```

### Alternatives Not Chosen

- **選項 B**（`analysis` 物件）：增加巢狀層級，前端需要修改解析邏輯
- **選項 C**（獨立事件）：過度複雜，兩次推送增加延遲和錯誤風險

---

## Decision 5: 錯誤處理策略

### Context

需要決定當價差或淨收益資料無法取得或計算時，系統應如何處理。選項包括：顯示錯誤訊息、隱藏整行、顯示預設值或顯示 "N/A"。

### Research Findings

**可能的錯誤場景**：
1. 價格資料暫時無法取得 → `priceDiffPercent` 為 `null` 或 `undefined`
2. WebSocket 連線中斷 → 資料過時但仍顯示
3. 計算異常（例如 NaN） → 數值無效
4. 單一交易所下線 → 無法計算套利對

**處理選項**：

| 選項 | 行為 | 優點 | 缺點 |
|------|------|------|------|
| A | 顯示 "N/A" | 不隱藏資訊，用戶知道缺失 | 可能降低信任感 |
| B | 隱藏整行 | 只顯示有效資料 | 用戶不知道有哪些交易對缺失 |
| C | 顯示預設值（0%） | 避免空白 | 誤導用戶，0% 不等於缺失 |
| D | 顯示錯誤訊息 | 明確告知問題 | UI 過於嚴肅，影響體驗 |

### Decision

**選擇選項 A**：顯示 "N/A"（Not Available）

### Rationale

1. **符合 Constitution Principle III（防禦性編程）**：
   - Fail-safe 模式，單一欄位錯誤不影響其他欄位
   - 系統持續運作，不因部分資料缺失而崩潰

2. **資訊透明**：
   - 用戶知道價差或淨收益資料暫時不可用
   - 仍可看到其他有效資訊（費率、價格等）

3. **一致性**：
   - 與現有欄位處理方式一致（例如 OI 欄位移除前也使用 "N/A"）

4. **避免誤導**：
   - 顯示 0% 會誤導用戶認為淨收益為零
   - 隱藏整行會讓用戶不知道有哪些交易對存在但資料缺失

### Implementation

```typescript
// 後端：src/websocket/handlers/MarketRatesHandler.ts
priceDiffPercent: rate.bestPair.priceDiffPercent ?? null,
netReturn: this.calculateNetReturn(rate.bestPair) ?? null,

// 前端：app/(dashboard)/market-monitor/components/RateRow.tsx
function formatPercent(value: number | null): string {
  if (value == null || isNaN(value)) {
    return 'N/A';
  }
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}
```

### Alternatives Not Chosen

- **選項 B**（隱藏整行）：用戶失去資訊，不知道有哪些交易對缺失資料
- **選項 C**（顯示 0%）：誤導用戶，0% 不等於資料缺失
- **選項 D**（錯誤訊息）：過於嚴肅，影響 UI 美觀和用戶體驗

---

## Risk Analysis

### Identified Risks

| Risk ID | Description | Impact | Probability | Mitigation Strategy |
|---------|-------------|--------|-------------|---------------------|
| R1 | 淨收益計算公式錯誤 | High | Low | 詳細單元測試，手動驗證公式 |
| R2 | 顏色閾值不符用戶期望 | Low | Medium | 在文件中明確說明，未來可配置 |
| R3 | 表格寬度不足 | Medium | Low | 調整現有欄位寬度，使用響應式設計 |
| R4 | 排序性能問題 | Medium | Low | Feature 009 已優化，支援 100+ 項目 |
| R5 | WebSocket 推送延遲 | Low | Low | 計算簡單（< 10ms），不影響效能 |

### Risk Mitigation Details

**R1 - 淨收益計算公式錯誤**：
- 撰寫單元測試覆蓋所有情境（正價差、負價差、零價差）
- 手動驗證公式與財務邏輯一致性
- Code review 時重點檢查計算邏輯

**R2 - 顏色閾值不符用戶期望**：
- 在 spec.md 和 quickstart.md 中明確記錄閾值定義
- 在 UI 提供 tooltip 說明顏色含義
- 未來可考慮提供用戶自訂閾值功能

**R3 - 表格寬度不足**：
- 調整現有欄位寬度（例如縮小交易所費率欄位）
- 考慮使用水平滾動或隱藏不常用欄位
- 優先顯示價差和淨收益（核心指標）

**R4 - 排序性能問題**：
- Feature 009 已實作高效排序（O(n log n)）
- 使用快照排序，避免重複計算
- 監控實際效能，如有問題再優化

**R5 - WebSocket 推送延遲**：
- 淨收益計算非常簡單（一個減法），< 10ms
- 不影響現有 5 秒推送頻率
- 無需特殊優化

---

## Performance Considerations

### Computational Complexity

1. **淨收益計算**：O(1) - 簡單減法
2. **顏色判斷**：O(1) - 3 個條件判斷
3. **排序**：O(n log n) - 標準排序演算法
4. **WebSocket 推送**：O(n) - 遍歷所有交易對

### Memory Impact

- 每個交易對新增 2 個數值欄位（priceDiffPercent、netReturn）
- 記憶體增加：30 交易對 × 2 欄位 × 8 bytes = 480 bytes（negligible）
- 前端記憶體影響：< 1KB（包含 React state）

### Network Impact

- WebSocket 資料大小增加：每個交易對 +40 bytes（兩個 JSON 數值欄位）
- 30 交易對總增加：1.2 KB
- 相對於現有資料大小（~15 KB），增加 8%
- 不影響網路傳輸效能

---

## Technology Stack

### No New Dependencies

此功能**不引入任何新依賴**，完全基於現有技術棧：

- **語言**：TypeScript 5.6
- **後端**：Node.js 20.x, Socket.io 4.8.1
- **前端**：React 18, Next.js 14.2.33, Tailwind CSS 3.4.18
- **測試**：Vitest (單元測試), Playwright (E2E 測試)

### Leveraged Existing Features

- **Feature 009**：穩定排序機制（stableSortComparator）
- **RatesCache**：記憶體快取（已包含 priceDiffPercent）
- **MarketRatesHandler**：WebSocket 推送機制
- **cost-constants.ts**：交易手續費常數定義

---

## Testing Strategy

### Unit Tests

1. **淨收益計算測試**（tests/unit/lib/net-return-calculator.test.ts）：
   - 正價差情境：spreadPercent=0.5, priceDiffPercent=0.15 → netReturn=0.05
   - 負價差情境：spreadPercent=0.5, priceDiffPercent=-0.15 → netReturn=0.05
   - 零價差情境：spreadPercent=0.5, priceDiffPercent=0 → netReturn=0.2
   - 缺失資料情境：priceDiffPercent=null → netReturn=null

2. **排序邏輯測試**（擴展現有 sortComparator.test.ts）：
   - 按價差排序（升序/降序）
   - 按淨收益排序（升序/降序）
   - 穩定排序驗證（相同數值保持順序）

### Integration Tests

3. **WebSocket 推送測試**（擴展現有 MarketRatesHandler.test.ts）：
   - 驗證 priceDiffPercent 和 netReturn 正確推送
   - 驗證資料格式符合 TypeScript 介面定義

### E2E Tests

4. **價差顯示測試**（tests/e2e/market-monitor-price-spread.spec.ts）：
   - 開啟市場監控頁面，驗證價差欄位存在
   - 驗證價差數值正確顯示（格式化為百分比）
   - 驗證價差為 "N/A" 時的錯誤處理

5. **淨收益顯示測試**：
   - 驗證淨收益欄位存在
   - 驗證顏色指示器正確（綠色/黃色/紅色）
   - 驗證數值正確計算

6. **排序功能測試**：
   - 點擊價差欄位標題，驗證排序正確
   - 點擊淨收益欄位標題，驗證排序正確
   - 驗證穩定排序（相同數值不跳動）

---

## Documentation Updates

### Required Documentation

1. **CHANGELOG.md**：
   - 新增 [0.7.0] 版本條目
   - 記錄 Feature 011 完成細節
   - 列出新增欄位和計算公式

2. **quickstart.md**（本功能）：
   - 測試指南
   - 驗證淨收益計算
   - 顏色閾值說明

3. **contracts/websocket.md**（本功能）：
   - WebSocket 事件 schema
   - 新增欄位定義

4. **data-model.md**（本功能）：
   - TypeScript 介面定義
   - 資料流向圖

---

## Summary

此功能的技術決策已完成，所有關鍵選擇都有明確的依據和替代方案分析。主要優勢：

✅ **無新依賴**：完全基於現有技術棧
✅ **最小化變更**：只修改 7 個檔案
✅ **符合架構**：遵循 Constitution 所有原則
✅ **可測試性**：每個決策都可驗證
✅ **效能**：計算簡單，無顯著影響

**準備進入 Phase 1**：生成 data-model.md、contracts/websocket.md、quickstart.md
