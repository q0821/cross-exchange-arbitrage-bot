# Technical Research: 分單開倉（獨立持倉）

**Feature**: 060-split-position-open
**Date**: 2026-01-07

## Research Questions

### Q1: 分單開倉的實作層級

**決策**: 在前端 Hook 層實作，循環調用現有開倉 API

**理由**:
1. 現有 `PositionOrchestrator` 已經實作完整的單次開倉流程（Saga Pattern）
2. 每組持倉本質上就是獨立的開倉操作，無需修改後端
3. 前端控制串行執行邏輯，可以提供即時進度反饋
4. 符合 Constitution Principle V（增量交付）- 最小化修改範圍

**替代方案考慮**:
- 後端批量開倉 API：需要重寫 PositionOrchestrator，風險高
- WebSocket 控制：過度複雜，不符合串行執行需求

### Q2: 數量分配策略

**決策**: 使用「大組優先」分配策略

**算法**:
```
總數量 = 1000, 組數 = 3
基本數量 = 1000 / 3 = 333 (取整)
餘數 = 1000 % 3 = 1
分配結果 = [334, 333, 333] (第一組多 1)
```

**理由**:
1. 簡單易理解
2. 差異最小化（最多相差 1 單位）
3. 第一組較大可以在第一次執行時驗證流動性

### Q3: 進度顯示方式

**決策**: 使用現有的 Toast + Loading 狀態

**理由**:
1. 現有 `useOpenPosition` 已有 `isLoading` 狀態
2. 可以擴展 loading 訊息顯示「正在建立第 N/M 組...」
3. 不需要新增 WebSocket 事件

**實作細節**:
- 新增 `currentGroup` 和 `totalGroups` 狀態
- 在每組開倉前更新狀態
- Loading 覆蓋層顯示進度文字

### Q4: 錯誤處理策略

**決策**: 「快速失敗」- 某組失敗時立即停止後續開倉

**理由**:
1. 符合 Constitution Principle I（Trading Safety First）
2. 避免在問題未解決時繼續消耗資金
3. 已成功的持倉保持完整，用戶可以正常管理

**錯誤訊息格式**:
```
已完成 {completed}/{total} 組，第 {current} 組失敗：{error}
```

### Q5: 最小交易量驗證

**決策**: 在前端驗證，使用現有的 `MIN_QUANTITY` 常數

**驗證邏輯**:
```
每組數量 = 總數量 / 組數
if (每組數量 < MIN_QUANTITY) {
  顯示錯誤：「每組數量不得小於 {MIN_QUANTITY}」
}
```

**理由**:
1. 快速反饋，在用戶調整組數時立即提示
2. 避免在開倉過程中才發現數量不合法

### Q6: 組數上限

**決策**: 最大 10 組

**理由**:
1. 串行執行，10 組約需 50-100 秒（每組 5-10 秒）
2. 超過 10 組的需求罕見，可能是操作錯誤
3. 符合交易所速率限制考量

## 現有程式碼分析

### 前端 - OpenPositionDialog.tsx

- 位置：`app/(dashboard)/market-monitor/components/OpenPositionDialog.tsx`
- 已有參數：`quantity`, `leverage`, `stopLossEnabled`, `stopLossPercent`, `takeProfitEnabled`, `takeProfitPercent`
- **需新增**：`positionCount` 參數（預設 1，範圍 1-10）

### 前端 - useOpenPosition.ts

- 位置：`app/(dashboard)/market-monitor/hooks/useOpenPosition.ts`
- 現有 `executeOpen` 方法調用 `/api/positions/open`
- **需修改**：新增 `executeSplitOpen` 方法，循環調用 `executeOpen`
- **需新增**：`currentGroup`, `totalGroups` 狀態用於進度顯示

### 後端 - /api/positions/open

- 位置：`app/api/positions/open/route.ts`
- **無需修改**：每次調用建立一個獨立持倉，已滿足需求

### 後端 - PositionOrchestrator.ts

- 位置：`src/services/trading/PositionOrchestrator.ts`
- **無需修改**：Saga Pattern 已處理單次開倉的完整流程

## 風險評估

| 風險 | 可能性 | 影響 | 緩解措施 |
|------|--------|------|----------|
| 串行執行時間過長 | 中 | 中 | 顯示進度，用戶可預期 |
| 中間組失敗導致部分開倉 | 低 | 中 | 已成功持倉可正常管理 |
| 交易所速率限制 | 低 | 高 | 限制最大組數為 10 |
| 用戶誤操作設定過多組數 | 中 | 低 | 預設 1 組，顯示每組數量預覽 |

## 結論

此功能實作複雜度低，主要修改前端組件和 Hook：
1. OpenPositionDialog.tsx - 新增組數輸入欄位
2. useOpenPosition.ts - 新增分單開倉邏輯

後端完全無需修改，複用現有的開倉 API 和 PositionOrchestrator。
