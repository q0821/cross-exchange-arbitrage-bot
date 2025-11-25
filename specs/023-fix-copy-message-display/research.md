# Research & Technical Decisions: 修正複製套利訊息顯示

**Feature**: 023-fix-copy-message-display
**Created**: 2025-11-25
**Status**: Complete

## Overview

本文檔記錄修正複製套利訊息顯示功能的技術研究和決策過程，解決 `formatPercentageRange()` 錯誤計算問題並改善訊息內容。

## Research Areas

### 1. 訊息格式化策略

#### Problem
當前的 `formatPercentageRange()` 函數錯誤地將已經是百分比的數值（如 0.5 表示 0.5%）再乘以 100，導致：
- `spreadPercent = 0.5` → 顯示為「約 40-60%」（錯誤！）
- 應該顯示「約 0.4-0.6%」或直接使用更有意義的年化收益

#### Decision: 分層格式化策略

**選擇的方案**：針對不同類型的數值使用不同的格式化策略

| 數值類型 | 格式化策略 | 原因 |
|---------|----------|------|
| 年化收益 | ±10% 範圍估值 | 提供合理的波動範圍，幫助用戶理解預期收益的不確定性 |
| 單次費率收益 | 精確值（保留 2 位小數） | 單次收益較小，精確值更有參考價值 |
| 價格偏差 | 精確值 + 正負號 + 說明 | 價格偏差關係到平倉風險，需要精確值和明確說明 |

**Implementation**:
```typescript
// 年化收益：使用 ±10% 範圍
function formatAnnualizedReturn(value: number): string {
  const min = Math.round(value * 0.9);
  const max = Math.round(value * 1.1);
  return `約 ${min}-${max}%`;
}

// 單次費率收益：精確值
function formatSingleReturn(value: number): string {
  return `約 ${value.toFixed(2)}%`;
}

// 價格偏差：精確值 + 說明
function formatPriceDiff(value: number | null): string {
  if (value === null) return 'N/A（無價格數據）';
  const sign = value >= 0 ? '+' : '';
  const explanation = value >= 0 ? '✓ 做空方價格較高，有利平倉' : '✗ 做多方價格較高，不利平倉';
  return `${sign}${value.toFixed(2)}% (${explanation})`;
}
```

#### Alternatives Considered

1. **全部使用 ±20% 範圍**（現有做法）
   - ❌ 拒絕：波動範圍太大，不準確
   - ❌ 對於小數值（如 0.5%）會顯示 0.4-0.6%，失去意義

2. **全部使用精確值**
   - ❌ 拒絕：年化收益是預估值，顯示精確值（如 547.5%）會給用戶錯誤的精確性印象
   - ❌ 不符合「套利機會是預估」的事實

3. **移除所有範圍，只顯示中間值**
   - ❌ 拒絕：沒有傳達不確定性資訊

#### Rationale

- **年化收益**：±10% 範圍合理反映費率波動和市場變化
- **單次收益**：較小的數值使用精確值更清晰
- **價格偏差**：影響平倉決策，必須精確並加說明

---

### 2. 函數設計模式

#### Problem
當前 `formatArbitrageMessage()` 函數職責過多：
- 格式化多種不同類型的數值
- 組裝完整訊息
- 處理邊界情況

#### Decision: 單一職責原則 (SRP)

**選擇的方案**：將格式化邏輯拆分成多個專門函數

```typescript
// 主函數：組裝訊息
export function formatArbitrageMessage(
  rate: MarketRate,
  timeBasis: TimeBasis
): string

// 輔助函數：各司其職
function formatAnnualizedReturn(annualizedReturn: number): string
function formatSingleFundingReturn(spreadPercent: number, timeBasis: TimeBasis): string
function formatPriceDiffWithExplanation(priceDiffPercent: number | null): string
function formatSymbolDisplay(symbol: string): string  // 已存在
function getExchangeDisplayName(exchange: ExchangeName): string  // 已存在
```

**Function Naming Conventions**:
- 動詞 + 名詞：`formatXxx`, `getXxx`, `calculateXxx`
- 返回類型明確：返回 `string` 的函數名稱以 `format` 開頭
- 參數明確：使用完整的參數名稱（如 `annualizedReturn` 而非 `ar`）

#### Alternatives Considered

1. **單一大函數處理所有格式化**
   - ❌ 拒絕：違反單一職責原則，難以測試和維護

2. **使用類別 (Class) 封裝**
   - ❌ 拒絕：過度設計，簡單的格式化函數不需要狀態管理

3. **使用配置物件傳遞格式化選項**
   - ❌ 拒絕：增加複雜度，當前需求不需要高度可配置性

#### Rationale

- 每個函數只做一件事，易於測試
- 函數可獨立重用
- 清晰的命名慣例提高代碼可讀性
- 符合 TypeScript/React 社群慣例

---

### 3. 時間基準傳遞方式

#### Problem
訊息需要顯示「每 X 小時結算一次」，需要知道當前的時間基準。

#### Decision: 通過參數傳遞

**選擇的方案**：修改 `formatArbitrageMessage()` 簽名，接受 `timeBasis` 參數

```typescript
export function formatArbitrageMessage(
  rate: MarketRate,
  timeBasis: TimeBasis = 8  // 預設 8 小時
): string {
  // ...
}
```

**在 RateRow.tsx 中**：
```typescript
// 從 page context 或 props 獲取當前時間基準
const currentTimeBasis = useTimeBasis(); // 或從 props

const handleCopy = async () => {
  const message = formatArbitrageMessage(rate, currentTimeBasis);
  await navigator.clipboard.writeText(message);
};
```

#### Alternatives Considered

1. **從 MarketRate 物件中推斷時間基準**
   - ❌ 拒絕：`MarketRate` 不包含當前選擇的時間基準資訊
   - ❌ 會導致複雜的推斷邏輯

2. **使用 React Context 全局狀態**
   - ❌ 拒絕：增加依賴，格式化函數應該是純函數
   - ❌ 難以在非 React 環境中測試

3. **硬編碼為 8 小時**
   - ❌ 拒絕：用戶可以切換時間基準，硬編碼會顯示錯誤資訊

#### Rationale

- 保持函數純淨（pure function），易於測試
- 明確的參數傳遞，不依賴全局狀態
- 靈活支援不同時間基準
- 預設值處理向後兼容性

---

### 4. 測試策略

#### Problem
需要測試：
- 格式化函數的正確性
- 複製功能（涉及 clipboard API）
- 不同邊界情況（null 值、零值、負值）

#### Decision: 分層測試策略

**Layer 1: 單元測試格式化函數**
```typescript
// tests/unit/frontend/formatArbitrageMessage.test.ts
describe('formatAnnualizedReturn', () => {
  it('should format with ±10% range', () => {
    expect(formatAnnualizedReturn(800)).toBe('約 720-880%');
  });

  it('should handle zero', () => {
    expect(formatAnnualizedReturn(0)).toBe('約 0%');
  });
});

describe('formatPriceDiffWithExplanation', () => {
  it('should show positive diff as favorable', () => {
    expect(formatPriceDiffWithExplanation(0.15))
      .toContain('+0.15%');
    expect(formatPriceDiffWithExplanation(0.15))
      .toContain('✓ 做空方價格較高，有利平倉');
  });

  it('should show negative diff as unfavorable', () => {
    expect(formatPriceDiffWithExplanation(-0.10))
      .toContain('-0.10%');
    expect(formatPriceDiffWithExplanation(-0.10))
      .toContain('✗ 做多方價格較高，不利平倉');
  });

  it('should handle null price data', () => {
    expect(formatPriceDiffWithExplanation(null))
      .toBe('N/A（無價格數據）');
  });
});
```

**Layer 2: 整合測試完整訊息**
```typescript
describe('formatArbitrageMessage', () => {
  it('should format complete message correctly', () => {
    const mockRate: MarketRate = { /* ... */ };
    const message = formatArbitrageMessage(mockRate, 8);

    expect(message).toContain('BTC/USDT');
    expect(message).toContain('預估年化收益');
    expect(message).toContain('每 8 小時結算一次');
  });
});
```

**Layer 3: Mock clipboard API**
```typescript
// 在 RateRow 測試中
describe('RateRow copy functionality', () => {
  it('should copy formatted message to clipboard', async () => {
    const mockClipboard = {
      writeText: vi.fn().mockResolvedValue(undefined)
    };
    Object.assign(navigator, { clipboard: mockClipboard });

    // ... render component and click copy button

    expect(mockClipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('預估年化收益')
    );
  });
});
```

#### Alternatives Considered

1. **快照測試 (Snapshot Testing)**
   - ⚠️ 部分使用：僅用於完整訊息格式驗證
   - ❌ 不單獨使用：快照測試對於數值格式化太脆弱

2. **E2E 測試**
   - ❌ 拒絕：過於重量級，格式化邏輯不需要 E2E
   - ✅ 可在後續手動測試中驗證

3. **Property-based Testing**
   - ❌ 拒絕：對於簡單的格式化函數過度設計

#### Rationale

- 單元測試提供快速反饋和高覆蓋率
- Mock clipboard API 避免瀏覽器環境依賴
- 分層測試確保各層級正確性
- 符合 Vitest 測試框架最佳實踐

---

## Implementation Decisions Summary

| Decision Area | Choice | Rationale |
|--------------|--------|-----------|
| 年化收益格式化 | ±10% 範圍估值 | 反映不確定性但不過於寬鬆 |
| 單次收益格式化 | 精確值（2 位小數） | 小數值需要精確性 |
| 價格偏差格式化 | 精確值 + 正負說明 | 影響決策，必須清晰 |
| 函數設計 | 單一職責原則 (SRP) | 易測試、易維護、可重用 |
| 時間基準傳遞 | 函數參數傳遞 | 純函數，易測試，靈活 |
| 測試策略 | 分層單元測試 + Mock | 快速、可靠、高覆蓋率 |

## Best Practices Applied

### TypeScript Best Practices
- ✅ 使用明確的類型註解（`TimeBasis`, `MarketRate`, etc.）
- ✅ 處理 `null` 和 `undefined` 情況
- ✅ 使用聯合類型表示可能的值（如 `number | null`）
- ✅ 避免 `any` 類型

### React/Next.js Best Practices
- ✅ 保持組件純淨，將邏輯抽取到 util 函數
- ✅ 使用 hooks 管理狀態（`useState` for copy status）
- ✅ 使用 async/await 處理異步操作

### 代碼可維護性
- ✅ 單一職責原則
- ✅ 清晰的命名慣例
- ✅ 充分的註解和文檔
- ✅ 邊界情況處理

## Next Steps

Phase 0 完成。接續：
1. Phase 1: 生成 data-model.md（類型定義）
2. Phase 1: 生成 contracts/（函數簽名）
3. Phase 1: 生成 quickstart.md（開發指南）
4. Phase 2: 生成 tasks.md（任務清單）
5. Implementation: 執行任務

## References

- TypeScript 文檔: https://www.typescriptlang.org/docs/
- React Testing Library: https://testing-library.com/docs/react-testing-library/intro/
- Vitest: https://vitest.dev/
- 現有代碼: `app/(dashboard)/market-monitor/utils/formatArbitrageMessage.ts`
