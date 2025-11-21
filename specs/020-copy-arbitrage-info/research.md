# Technical Research: 一鍵複製套利機會資訊

**Feature**: 020-copy-arbitrage-info
**Date**: 2025-11-21
**Status**: Complete

## Overview

本文件記錄功能實作前的技術研究和決策過程，包含 Clipboard API 使用、範圍估值演算法、React 狀態管理模式和交易所名稱映射規則。

## Research Areas

### 1. Clipboard API 最佳實踐

#### Research Question
如何正確使用 `navigator.clipboard.writeText()` API，包含錯誤處理、瀏覽器相容性和權限管理？

#### Findings

**1.1 API 基本用法**
```typescript
try {
  await navigator.clipboard.writeText(text);
  // 成功
} catch (err) {
  // 處理錯誤
  console.error('Failed to copy:', err);
}
```

**1.2 瀏覽器相容性**
- **支援版本**:
  - Chrome 66+（2018 年 4 月）
  - Firefox 63+（2018 年 10 月）
  - Safari 13.1+（2020 年 3 月）
  - Edge 79+（2020 年 1 月）
- **市場覆蓋率**: > 95% 的現代瀏覽器用戶
- **安全上下文要求**: 必須在 HTTPS 或 localhost 環境中

**1.3 權限處理**
- Clipboard API 在用戶操作（如點擊）觸發時不需要額外權限請求
- 瀏覽器會在背景自動處理權限
- 如果權限被拒絕，`writeText()` 會拋出異常

**1.4 錯誤類型**
```typescript
// DOMException: NotAllowedError
// - 原因: 用戶拒絕權限或不是安全上下文
// - 處理: 顯示錯誤訊息，建議檢查權限設定

// TypeError: undefined
// - 原因: navigator.clipboard 不存在（舊瀏覽器）
// - 處理: 檢查 API 可用性，提供 fallback
```

#### Decision

**採用方案**: 使用 `navigator.clipboard.writeText()` 搭配 try-catch 錯誤處理

**Rationale**:
- 無需外部依賴，減少套件體積
- 原生 API 效能最佳
- 現代瀏覽器覆蓋率充足（95%+）
- 錯誤處理機制簡單明確

**Alternatives Considered**:
1. **clipboard.js 套件**
   - ❌ 新增外部依賴（增加 3KB）
   - ❌ 維護負擔（需定期更新）
   - ✅ 支援更舊的瀏覽器

2. **document.execCommand('copy')**
   - ❌ 已廢棄的 API
   - ❌ 需要額外的 DOM 操作（創建隱藏 textarea）
   - ❌ 效能較差

**Implementation Notes**:
- 使用 async/await 模式
- 在組件內檢查 `navigator.clipboard` 可用性
- 錯誤訊息對用戶友善（中文，具體指導）

---

### 2. 範圍估值演算法

#### Research Question
如何計算「約 6-9%」這種範圍估值？具體的 ±20% 波動範圍如何實現？

#### Findings

**2.1 演算法設計**
```typescript
function calculateRange(value: number): { min: number; max: number } {
  const margin = 0.20; // 20% 波動範圍
  const min = value * (1 - margin);
  const max = value * (1 + margin);
  return {
    min: Math.round(min),
    max: Math.round(max)
  };
}

// Example:
// value = 7.5% → min = 6%, max = 9% → "約 6-9%"
```

**2.2 特殊情況處理**
| 情況 | 輸入值 | 輸出 | 處理方式 |
|------|--------|------|----------|
| 小數值 | 0.5% | 0-1% | 允許 min = 0 |
| 負值 | -2% | N/A | 顯示 "N/A"（不應出現） |
| NaN | NaN | N/A | 顯示 "N/A" |
| 極大值 | 100% | 80-120% | 正常計算（理論上不會出現） |
| 零值 | 0% | 0% | 顯示 "約 0%" |

**2.3 格式化規則**
- 四捨五入到整數百分比
- 如果 min === max，僅顯示單一值（如「約 5%」）
- 範圍使用連字號（-）連接
- 前綴「約」表示估算值

#### Decision

**採用方案**: ±20% 波動範圍，四捨五入到整數百分比

**Rationale**:
- 20% 波動範圍符合套利市場的實際變化
- 整數百分比更易於閱讀和理解
- 「約」前綴明確告知用戶這是估算值

**Alternatives Considered**:
1. **±10% 波動範圍**
   - ❌ 範圍過窄，不符合實際波動
   - ❌ 可能誤導用戶（實際值可能超出範圍）

2. **保留小數點**
   - ❌ 增加閱讀負擔（如「約 6.3-8.7%」）
   - ❌ 給人「精確」的錯覺（實際是估算）

3. **使用 σ（標準差）**
   - ❌ 需要歷史數據計算
   - ❌ 增加複雜度
   - ❌ 用戶不理解統計概念

**Implementation Example**:
```typescript
// formatPercentageRange.ts
export function formatPercentageRange(value: number | null): string {
  if (value === null || isNaN(value) || value < 0) {
    return 'N/A';
  }

  if (value === 0) {
    return '約 0%';
  }

  const min = Math.max(0, Math.round(value * 0.8));
  const max = Math.round(value * 1.2);

  if (min === max) {
    return `約 ${min}%`;
  }

  return `約 ${min}-${max}%`;
}
```

---

### 3. React 狀態管理模式

#### Research Question
如何管理複製按鈕的狀態（idle/copying/success/error）並避免 memory leak？

#### Findings

**3.1 狀態設計**
```typescript
type CopyStatus = 'idle' | 'copying' | 'success' | 'error';

const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle');
```

**3.2 狀態轉換**
```
idle → copying → success → (2秒後) → idle
              ↘ error → (2秒後) → idle
```

**3.3 Timer 清理機制**
```typescript
useEffect(() => {
  if (copyStatus === 'success' || copyStatus === 'error') {
    const timer = setTimeout(() => {
      setCopyStatus('idle');
    }, 2000);

    // 清理函數：組件卸載或狀態變更時清除 timer
    return () => clearTimeout(timer);
  }
}, [copyStatus]);
```

**3.4 Memory Leak 預防**
- **問題**: 如果用戶在 2 秒倒數期間快速切換頁面，setTimeout 可能在組件卸載後執行
- **解決**: 使用 useEffect 返回清理函數
- **驗證**: React 18 的 Strict Mode 會自動檢測

#### Decision

**採用方案**: useState + useEffect 搭配清理函數

**Rationale**:
- React 標準做法，清晰明確
- 自動清理機制防止 memory leak
- 狀態機模式易於測試和維護

**Alternatives Considered**:
1. **useRef 儲存 timer ID**
   - ✅ 更細粒度的控制
   - ❌ 增加複雜度（需手動清理）
   - ❌ 不必要（useEffect 已足夠）

2. **第三方狀態管理（Zustand/Jotai）**
   - ❌ 新增依賴
   - ❌ 過度設計（局部狀態已足夠）

3. **useReducer**
   - ✅ 更嚴謹的狀態轉換
   - ❌ 增加程式碼行數（對簡單狀態機不必要）

**Implementation Pattern**:
```typescript
const RateRow: React.FC<Props> = ({ rate }) => {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formatArbitrageMessage(rate));
      setCopyStatus('success');
    } catch (err) {
      console.error('Copy failed:', err);
      setCopyStatus('error');
    }
  };

  useEffect(() => {
    if (copyStatus !== 'idle') {
      const timer = setTimeout(() => setCopyStatus('idle'), 2000);
      return () => clearTimeout(timer);
    }
  }, [copyStatus]);

  return (
    <button onClick={handleCopy}>
      {copyStatus === 'success' ? <Check /> : <Copy />}
    </button>
  );
};
```

---

### 4. 交易所名稱映射

#### Research Question
如何將 `ExchangeName` 類型（如 'binance', 'gateio'）映射為大寫顯示名稱（如 'BINANCE', 'GATE'）？

#### Findings

**4.1 現有類型定義**
```typescript
// app/(dashboard)/market-monitor/types.ts
export type ExchangeName = 'binance' | 'okx' | 'mexc' | 'gateio';
```

**4.2 映射規則**
| 內部名稱 | 顯示名稱 | 說明 |
|---------|---------|------|
| binance | BINANCE | 直接大寫 |
| okx     | OKX     | 直接大寫 |
| mexc    | MEXC    | 直接大寫 |
| gateio  | GATE    | 簡化為 GATE（品牌名稱） |

**4.3 實作方式**
```typescript
const EXCHANGE_DISPLAY_NAMES: Record<ExchangeName, string> = {
  binance: 'BINANCE',
  okx: 'OKX',
  mexc: 'MEXC',
  gateio: 'GATE'
};

function getExchangeDisplayName(exchange: ExchangeName): string {
  return EXCHANGE_DISPLAY_NAMES[exchange] || exchange.toUpperCase();
}
```

#### Decision

**採用方案**: Record 映射表 + fallback 大寫轉換

**Rationale**:
- 明確定義每個交易所的顯示名稱
- 支援特殊情況（如 gateio → GATE）
- Fallback 機制確保新增交易所時不會出錯
- 類型安全（TypeScript 會檢查 Record keys）

**Alternatives Considered**:
1. **直接 .toUpperCase()**
   - ❌ 無法處理特殊情況（gateio → GATEIO，不正確）
   - ❌ 不靈活（未來可能需要其他特殊映射）

2. **switch-case 語句**
   - ❌ 冗長
   - ❌ 容易忘記 default case

3. **動態從 API 獲取**
   - ❌ 增加 API 請求
   - ❌ 顯示名稱是靜態的（不需要動態獲取）

**Implementation Notes**:
- 將映射表定義為常數（EXCHANGE_DISPLAY_NAMES）
- 放在 `formatArbitrageMessage.ts` 檔案頂部
- 確保與 `ExchangeName` 類型同步

---

## Summary of Decisions

| 研究領域 | 決策 | 關鍵理由 |
|---------|------|---------|
| Clipboard API | 使用原生 API + try-catch | 無依賴、效能佳、覆蓋率 95%+ |
| 範圍估值 | ±20% 波動，整數百分比 | 符合實際市場、易讀性高 |
| 狀態管理 | useState + useEffect 清理 | 標準做法、防止 memory leak |
| 交易所映射 | Record 映射表 + fallback | 類型安全、支援特殊情況 |

## Implementation Checklist

基於以上研究，實作時需要：

- [x] 使用 `navigator.clipboard.writeText()` 的 async/await 模式
- [x] 實作 try-catch 錯誤處理和用戶友善的錯誤訊息
- [x] 實作 ±20% 範圍估值演算法，處理邊界情況（負值、NaN、零）
- [x] 使用 useState 管理複製狀態（idle/success/error）
- [x] 使用 useEffect 搭配清理函數管理 2 秒倒數 timer
- [x] 定義 EXCHANGE_DISPLAY_NAMES 映射表
- [x] 實作 getExchangeDisplayName 函數搭配 fallback 機制
- [x] 撰寫單元測試覆蓋所有決策的邊界情況

## Next Steps

1. 進入 Phase 1：設計 data model 和 contracts
2. 基於此研究結果實作 `formatArbitrageMessage.ts`
3. 修改 `RateRow.tsx` 組件整合複製功能
4. 撰寫測試驗證所有決策正確實作

**Research Status**: ✅ COMPLETE
**Ready for Phase 1**: ✅ YES
