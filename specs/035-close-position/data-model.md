# Data Model: 一鍵平倉功能

**Feature**: 035-close-position
**Date**: 2025-12-17

## Overview

本功能使用現有的 Position 和 Trade 模型，無需新增 Prisma migration。以下文件描述實體關係和狀態轉換。

## Entity Relationship

```
┌─────────────┐       1:1        ┌─────────────┐
│   Position  │──────────────────│    Trade    │
│  (持倉記錄)  │                  │  (績效記錄)  │
└─────────────┘                  └─────────────┘
      │                                │
      │ N:1                            │ N:1
      ▼                                ▼
┌─────────────┐                  ┌─────────────┐
│    User     │                  │    User     │
│   (用戶)    │                  │   (用戶)    │
└─────────────┘                  └─────────────┘
```

## Position Model (現有)

**Table**: `positions`

| Field | Type | Description | 平倉時更新 |
|-------|------|-------------|-----------|
| id | cuid | 主鍵 | - |
| userId | String | 用戶 ID | - |
| symbol | String | 交易對 (e.g., BTCUSDT) | - |
| longExchange | String | 做多交易所 | - |
| shortExchange | String | 做空交易所 | - |
| longEntryPrice | Decimal | 多頭開倉價 | - |
| shortEntryPrice | Decimal | 空頭開倉價 | - |
| longPositionSize | Decimal | 多頭倉位數量 | - |
| shortPositionSize | Decimal | 空頭倉位數量 | - |
| longLeverage | Int | 多頭槓桿 | - |
| shortLeverage | Int | 空頭槓桿 | - |
| status | PositionWebStatus | 狀態 | ✅ OPEN → CLOSING → CLOSED |
| openFundingRateLong | Decimal | 開倉時多頭費率 | - |
| openFundingRateShort | Decimal | 開倉時空頭費率 | - |
| unrealizedPnL | Decimal? | 未實現損益 | - |
| openedAt | DateTime? | 開倉時間 | - |
| closedAt | DateTime? | 平倉時間 | ✅ 填入平倉完成時間 |
| failureReason | String? | 失敗原因 | ✅ 填入錯誤訊息 (如失敗) |
| createdAt | DateTime | 創建時間 | - |
| updatedAt | DateTime | 更新時間 | ✅ 自動更新 |

### Position Status Flow (平倉)

```
     ┌───────┐
     │ OPEN  │ ← 只有此狀態可執行平倉
     └───┬───┘
         │ 用戶確認平倉
         ▼
   ┌─────────────┐
   │   CLOSING   │ ← 執行中狀態
   └──────┬──────┘
          │
    ┌─────┴─────┐
    │           │
    ▼           ▼
┌────────┐ ┌─────────┐
│ CLOSED │ │ PARTIAL │
│ (成功) │ │(部分成功)│
└────────┘ └─────────┘
```

## Trade Model (現有)

**Table**: `trades`

| Field | Type | Description | 計算方式 |
|-------|------|-------------|----------|
| id | cuid | 主鍵 | auto |
| userId | String | 用戶 ID | 從 Position 繼承 |
| positionId | String | 關聯持倉 ID | 外鍵 |
| symbol | String | 交易對 | 從 Position 繼承 |
| longExchange | String | 做多交易所 | 從 Position 繼承 |
| longEntryPrice | Decimal | 多頭開倉價 | 從 Position 繼承 |
| longExitPrice | Decimal | 多頭平倉價 | **平倉成交價** |
| longPositionSize | Decimal | 多頭倉位 | 從 Position 繼承 |
| shortExchange | String | 做空交易所 | 從 Position 繼承 |
| shortEntryPrice | Decimal | 空頭開倉價 | 從 Position 繼承 |
| shortExitPrice | Decimal | 空頭平倉價 | **平倉成交價** |
| shortPositionSize | Decimal | 空頭倉位 | 從 Position 繼承 |
| openedAt | DateTime | 開倉時間 | 從 Position 繼承 |
| closedAt | DateTime | 平倉時間 | **平倉完成時間** |
| holdingDuration | Int | 持倉時間(秒) | `closedAt - openedAt` |
| priceDiffPnL | Decimal | 價差損益 | **計算公式見下** |
| fundingRatePnL | Decimal | 資金費率損益 | **簡化為 0** |
| totalPnL | Decimal | 總損益 | `priceDiffPnL + fundingRatePnL - fees` |
| roi | Decimal | ROI (%) | `totalPnL / margin * 100` |
| status | TradeWebStatus | 狀態 | SUCCESS / PARTIAL |
| createdAt | DateTime | 創建時間 | auto |

### PnL Calculation Formulas

```typescript
// 價差損益
const longPnL = (longExitPrice - longEntryPrice) * longPositionSize;
const shortPnL = (shortEntryPrice - shortExitPrice) * shortPositionSize;
const priceDiffPnL = longPnL + shortPnL;

// 資金費率損益 (本次實作簡化)
const fundingRatePnL = 0; // TODO: 未來從費率結算記錄累計

// 總損益
const fees = longFee + shortFee; // 開倉 + 平倉手續費
const totalPnL = priceDiffPnL + fundingRatePnL - fees;

// ROI
const margin = (longEntryPrice * longPositionSize / leverage)
             + (shortEntryPrice * shortPositionSize / leverage);
const roi = (totalPnL / margin) * 100;

// 持倉時間
const holdingDuration = Math.floor((closedAt - openedAt) / 1000); // seconds
```

## AuditLog Model (現有，擴展 action)

**Table**: `audit_logs`

新增 action 類型：

| Action | Description | Triggered |
|--------|-------------|-----------|
| POSITION_CLOSE_STARTED | 平倉開始 | 用戶確認平倉後 |
| POSITION_CLOSE_SUCCESS | 平倉成功 | 雙邊都平倉成功 |
| POSITION_CLOSE_FAILED | 平倉失敗 | 平倉執行錯誤 |
| POSITION_CLOSE_PARTIAL | 部分平倉 | 一邊成功一邊失敗 |

## Type Definitions (新增)

```typescript
// src/types/trading.ts 擴展

// 平倉請求
export interface ClosePositionRequest {
  positionId: string;
}

// 平倉響應
export interface ClosePositionResponse {
  success: boolean;
  position: PositionInfo;
  trade?: TradeInfo;
  message: string;
}

// 平倉進度步驟
export type ClosePositionStep =
  | 'validating'
  | 'closing_long'
  | 'closing_short'
  | 'calculating_pnl'
  | 'completing';

// 平倉進度事件
export interface CloseProgressEvent {
  positionId: string;
  step: ClosePositionStep;
  progress: number;
  message: string;
  exchange?: SupportedExchange;
}

// 平倉成功事件
export interface CloseSuccessEvent {
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

// 平倉失敗事件
export interface CloseFailedEvent {
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

## Validation Rules

### Position Close Preconditions

| Rule | Validation |
|------|------------|
| 狀態必須為 OPEN | `position.status === 'OPEN'` |
| 必須是持倉所有者 | `position.userId === currentUserId` |
| 不可有進行中的操作 | 分散式鎖檢查 |

### Trade Creation Rules

| Rule | Validation |
|------|------------|
| positionId 唯一 | Trade.positionId 唯一約束 |
| 數值為正 | exitPrice > 0, positionSize > 0 |
| 時間順序 | closedAt > openedAt |

## No Schema Changes Required

本功能使用現有模型，不需要 Prisma migration：

- ✅ Position 模型已有 CLOSING, CLOSED 狀態
- ✅ Position 模型已有 closedAt 欄位
- ✅ Trade 模型已有完整的績效欄位
- ✅ AuditLog 模型可動態擴展 action 類型（字串欄位）
