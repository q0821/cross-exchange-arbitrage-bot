# Data Model: 交易所 WebSocket 即時數據訂閱

**Feature**: 052-specify-scripts-bash
**Date**: 2025-12-31

## 概述

此功能不新增資料庫模型，主要使用記憶體內狀態管理 WebSocket 連線和訂閱。

## 現有模型（使用）

### Position (現有)

用於比對 WebSocket 接收的持倉變更事件。

```prisma
model Position {
  id                    String    @id @default(cuid())
  userId                String
  symbol                String
  status                PositionStatus @default(OPEN)

  // 停損停利設定
  stopLossEnabled       Boolean   @default(false)
  stopLossPercent       Decimal?
  takeProfitEnabled     Boolean   @default(false)
  takeProfitPercent     Decimal?
  conditionalOrderStatus ConditionalOrderStatus @default(PENDING)

  // 觸發價格
  longStopLossPrice     Decimal?
  shortStopLossPrice    Decimal?
  longTakeProfitPrice   Decimal?
  shortTakeProfitPrice  Decimal?

  // 平倉原因 (Feature 050)
  closeReason           CloseReason?

  // ... 其他欄位
}

enum CloseReason {
  MANUAL
  LONG_SL_TRIGGERED
  LONG_TP_TRIGGERED
  SHORT_SL_TRIGGERED
  SHORT_TP_TRIGGERED
  BOTH_TRIGGERED
}
```

## 記憶體內狀態模型

### WebSocketSubscription

```typescript
interface WebSocketSubscription {
  type: 'fundingRate' | 'position' | 'order' | 'balance';
  exchange: ExchangeName;
  symbol?: string;           // 可選，公開頻道可訂閱全部
  callback: (data: any) => void;
  createdAt: Date;
}
```

### ConnectionState

```typescript
interface ConnectionState {
  exchange: ExchangeName;
  type: 'public' | 'private';
  status: 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
  lastHeartbeat: Date | null;
  reconnectAttempts: number;
  error?: string;
}
```

### ListenKeyState (Binance/BingX)

```typescript
interface ListenKeyState {
  exchange: 'binance' | 'bingx';
  userId: string;
  listenKey: string;
  createdAt: Date;
  expiresAt: Date;
  lastRenewed: Date;
}
```

### UserPrivateConnection

```typescript
interface UserPrivateConnection {
  userId: string;
  exchange: ExchangeName;
  apiKeyId: string;           // 關聯到 ApiKey 模型
  connection: WebSocket | CcxtExchange;
  subscriptions: Set<string>; // 訂閱的頻道
  listenKey?: string;         // Binance/BingX 專用
  authenticatedAt: Date;
  status: 'authenticating' | 'authenticated' | 'failed';
}
```

### TriggerEvent

```typescript
interface TriggerEvent {
  positionId: string;
  exchange: ExchangeName;
  symbol: string;
  triggerType: 'LONG_SL' | 'LONG_TP' | 'SHORT_SL' | 'SHORT_TP';
  triggerPrice: Decimal;
  detectedAt: Date;
  source: 'websocket' | 'rest';  // 區分來源
}
```

## 資料流

```
Exchange WebSocket
       │
       ▼
┌──────────────────┐
│  WsAdapter       │  ← 各交易所獨立實作
│  (parse message) │
└──────────────────┘
       │
       ▼
┌──────────────────┐
│  PrivateWsManager│  ← 路由到對應 Handler
└──────────────────┘
       │
       ├─────────────────────────────┐
       ▼                             ▼
┌──────────────────┐     ┌──────────────────┐
│ PositionWsHandler│     │  RatesCache      │
│ (compare DB)     │     │  (update cache)  │
└──────────────────┘     └──────────────────┘
       │
       ▼
┌──────────────────┐
│ TriggerDetector  │  ← 偵測停損/停利觸發
└──────────────────┘
       │
       ▼
┌──────────────────┐
│ PositionCloser   │  ← 執行對沖腿平倉
└──────────────────┘
```

## 快取策略

| 資料類型 | 儲存位置 | TTL | 更新來源 |
|---------|---------|-----|---------|
| 資金費率 | RatesCache | 5 分鐘 | WebSocket / REST |
| 連線狀態 | PrivateWsManager | N/A | 即時 |
| listenKey | ListenKeyManager | 60 分鐘 (Binance) | 自動續期 |
| 用戶訂閱 | PrivateWsManager | Session | 用戶操作 |

## 無需新增的模型

以下資料不需要持久化：

1. **WebSocket 連線狀態** - 重啟後自動重建
2. **訂閱清單** - 重啟後從資料庫載入活躍 Position 重建
3. **listenKey** - 重啟後重新取得
4. **觸發事件** - 已由現有 Position.closeReason 記錄
