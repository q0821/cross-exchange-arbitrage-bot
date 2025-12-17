# Research: 一鍵平倉功能

**Feature**: 035-close-position
**Date**: 2025-12-17

## Research Topics

### 1. 平倉與開倉的架構差異

**Decision**: 平倉不實作回滾機制，改用 PARTIAL 狀態標記

**Rationale**:
- 開倉失敗時回滾是為了避免單邊敞口
- 平倉失敗時，用戶本來就有敞口，再次嘗試平倉或保持原狀都是合理選擇
- 強制回滾（重新開倉）可能造成額外損失和複雜性
- 標記 PARTIAL 狀態讓用戶知情並決定後續處理

**Alternatives Considered**:
| 方案 | 優點 | 缺點 |
|------|------|------|
| 回滾（重新開倉） | 保持對沖 | 可能在不利價格重新開倉、增加手續費 |
| 不處理 | 簡單 | 用戶可能不知道有未平倉位 |
| PARTIAL 狀態 ✓ | 用戶知情、可選擇 | 需要 UI 提示 |

---

### 2. 損益計算公式

**Decision**: 採用以下損益計算公式

**價差損益 (priceDiffPnL)**:
```
多頭損益 = (exitPrice - entryPrice) * positionSize
空頭損益 = (entryPrice - exitPrice) * positionSize
priceDiffPnL = 多頭損益 + 空頭損益
```

**資金費率損益 (fundingRatePnL)**:
```
fundingRatePnL = 持倉期間累計收到的資金費率收益
```
> 注意：資金費率收益需要從 Position 記錄或外部來源獲取，本次實作簡化為 0（未來可擴展）

**總損益 (totalPnL)**:
```
totalPnL = priceDiffPnL + fundingRatePnL - 交易手續費
```

**投資報酬率 (ROI)**:
```
ROI = totalPnL / (開倉保證金總額) * 100%
```

**Rationale**:
- 對沖套利的主要收益來自資金費率差異，但平倉時的價差損益也需計算
- 完美對沖情況下 priceDiffPnL 趨近於 0，但市場波動和執行滑點會產生差異
- ROI 計算基於實際使用的保證金，便於用戶評估資金效率

---

### 3. 分散式鎖鍵值設計

**Decision**: 使用 `position:close:${positionId}` 作為鎖鍵

**Rationale**:
- 開倉鎖使用 `position:open:${userId}:${symbol}` 防止同一用戶對同一交易對重複開倉
- 平倉鎖應基於 positionId，因為用戶可能對同一交易對有多個持倉（未來擴展）
- 鎖鍵包含操作類型（close）避免與開倉鎖衝突

**Alternatives Considered**:
| 方案 | 優點 | 缺點 |
|------|------|------|
| `position:${positionId}` | 通用 | 可能與其他操作衝突 |
| `position:close:${userId}:${symbol}` | 與開倉一致 | 用戶可能有多個同交易對持倉 |
| `position:close:${positionId}` ✓ | 精確、可擴展 | 需要先獲取 positionId |

---

### 4. 平倉進度事件設計

**Decision**: 擴展現有 PositionProgressEmitter，新增平倉相關事件

**新增事件類型**:
```typescript
type ClosePositionStep =
  | 'validating'      // 驗證倉位狀態
  | 'closing_long'    // 平倉多頭
  | 'closing_short'   // 平倉空頭
  | 'calculating_pnl' // 計算損益
  | 'completing';     // 完成

interface CloseProgressEvent {
  positionId: string;
  step: ClosePositionStep;
  progress: number; // 0-100
  message: string;
  exchange?: SupportedExchange;
}

interface CloseSuccessEvent {
  positionId: string;
  trade: {
    id: string;
    priceDiffPnL: string;
    fundingRatePnL: string;
    totalPnL: string;
    roi: string;
    holdingDuration: number;
  };
}

interface CloseFailedEvent {
  positionId: string;
  error: string;
  errorCode: string;
  partialClosed?: {
    exchange: SupportedExchange;
    orderId: string;
    side: 'LONG' | 'SHORT';
  };
}
```

**Rationale**:
- 複用現有 WebSocket 架構和事件模式
- 與開倉事件結構一致，前端可複用處理邏輯
- 包含 PARTIAL 情況的詳細資訊

---

### 5. 現有基礎架構分析

**可複用的組件**:

| 組件 | 用途 | 複用方式 |
|------|------|----------|
| PositionLockService | 分散式鎖 | 直接使用，調整鎖鍵格式 |
| AuditLogger | 審計日誌 | 擴展：新增平倉相關 action |
| PositionProgressEmitter | WebSocket 推送 | 擴展：新增平倉事件方法 |
| ExchangeTrader interface | 交易所操作 | 已有 closePosition 方法定義 |

**需新增的組件**:

| 組件 | 用途 |
|------|------|
| PositionCloser | 平倉協調服務（類似 PositionOrchestrator） |
| pnl-calculator | 損益計算工具函數 |
| ClosePositionDialog | 平倉確認對話框 |
| useClosePosition | 前端平倉狀態管理 hook |

---

### 6. Trade 模型確認

**現有 Trade 模型欄位**（已存在於 schema.prisma:494-525）:

```prisma
model Trade {
  id                  String       @id @default(cuid())
  userId              String
  positionId          String       @unique
  symbol              String
  longExchange        String
  longEntryPrice      Decimal
  longExitPrice       Decimal      // ← 平倉時填入
  longPositionSize    Decimal
  shortExchange       String
  shortEntryPrice     Decimal
  shortExitPrice      Decimal      // ← 平倉時填入
  shortPositionSize   Decimal
  openedAt            DateTime
  closedAt            DateTime     // ← 平倉時填入
  holdingDuration     Int          // ← 計算填入
  priceDiffPnL        Decimal      // ← 計算填入
  fundingRatePnL      Decimal      // ← 計算填入
  totalPnL            Decimal      // ← 計算填入
  roi                 Decimal      // ← 計算填入
  status              TradeWebStatus @default(SUCCESS)
}
```

**結論**: Trade 模型已完整定義，平倉功能只需填入計算結果，無需 schema 變更。

---

## Summary

| Topic | Decision |
|-------|----------|
| 失敗處理 | PARTIAL 狀態標記，不回滾 |
| 損益計算 | priceDiffPnL + fundingRatePnL - 手續費 |
| 分散式鎖 | `position:close:${positionId}` |
| WebSocket | 擴展現有 Emitter，新增 close 事件 |
| 數據模型 | 複用現有 Trade 模型，無需 migration |
