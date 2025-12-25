# Research: MEXC 交易所開倉限制處理

**Feature**: 044-mexc-trading-restriction
**Date**: 2025-12-25

## 背景

MEXC 交易所不支援通過 API 進行合約開倉交易（參見 GitHub Issue 報告）。本研究記錄實作決策和替代方案評估。

## 研究項目

### 1. 限制交易所配置方式

**決策**: 使用集中式配置檔案 `src/lib/trading-restrictions.ts`

**理由**:
- 易於維護：未來若其他交易所也有類似限制，可快速擴展
- 單一事實來源：所有元件引用同一配置
- 類型安全：TypeScript 型別定義確保正確使用

**替代方案**:

| 方案 | 優點 | 缺點 | 決定 |
|------|------|------|------|
| 硬編碼在各元件 | 簡單快速 | 難以維護、重複代碼 | ❌ 拒絕 |
| 環境變數 | 可動態調整 | 過度複雜、需重啟服務 | ❌ 拒絕 |
| 資料庫配置 | 可管理界面調整 | 過度工程、需 API 支援 | ❌ 拒絕 |
| **集中式常量** | 類型安全、易維護 | 需重新部署 | ✅ 採用 |

### 2. UI 禁用狀態表現

**決策**: 使用禁用狀態 + 警告色 + Tooltip 組合

**理由**:
- 禁用狀態：明確阻止點擊，符合預期行為
- 警告色：視覺上區分於「無套利機會」的禁用狀態
- Tooltip：提供說明，減少用戶困惑

**配色方案**:
- 原有禁用色：`bg-gray-100` + `text-gray-400`（無套利機會）
- MEXC 限制色：`bg-amber-50` + `text-amber-600`（警告，但有原因）

### 3. 警告橫幅設計

**決策**: 使用現有的警告樣式模式

**參考**: 現有 `RateRow.tsx` 中的價差風險警告（第 331-402 行）

**元素**:
- 黃色/琥珀色背景：`bg-amber-50 border-amber-200`
- 警告圖示：Lucide `AlertTriangle`
- 外部連結：`https://futures.mexc.com/exchange`（開新分頁）

### 4. MEXC 交易所連結

**決策**: 使用 MEXC Futures 交易頁面

**連結**: `https://futures.mexc.com/exchange`

**驗證**: 此 URL 為 MEXC 合約交易的主頁面，用戶可從此進入手動交易。

## 技術細節

### 限制檢查函數

```typescript
// src/lib/trading-restrictions.ts
export type RestrictedExchangeId = 'mexc';

export interface ExchangeRestriction {
  exchangeId: RestrictedExchangeId;
  restrictionType: 'api_trading_disabled';
  message: string;
  externalUrl: string;
}

export const RESTRICTED_EXCHANGES: Record<RestrictedExchangeId, ExchangeRestriction> = {
  mexc: {
    exchangeId: 'mexc',
    restrictionType: 'api_trading_disabled',
    message: 'MEXC 不支援 API 開倉，請手動建倉',
    externalUrl: 'https://futures.mexc.com/exchange',
  },
};

export function isExchangeRestricted(exchangeId: string): boolean {
  return exchangeId in RESTRICTED_EXCHANGES;
}

export function getExchangeRestriction(exchangeId: string): ExchangeRestriction | null {
  return RESTRICTED_EXCHANGES[exchangeId as RestrictedExchangeId] ?? null;
}

export function isArbitragePairRestricted(longExchange: string, shortExchange: string): boolean {
  return isExchangeRestricted(longExchange) || isExchangeRestricted(shortExchange);
}
```

## 結論

此功能的技術複雜度低，主要工作為：
1. 新增一個配置檔案（約 30 行）
2. 修改 `OpenPositionButton.tsx`（約 20 行）
3. 修改 `OpenPositionDialog.tsx`（約 40 行）

預估工作量：1-2 小時
