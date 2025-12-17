# WebSocket Events: 平倉功能

**Feature**: 035-close-position
**Date**: 2025-12-17

## Event Namespace

平倉事件使用現有的 Socket.io 連接，在 `position` 命名空間下新增事件。

## Server → Client Events

### `position:close:progress`

平倉進度更新事件

```typescript
interface CloseProgressEvent {
  positionId: string;
  step: 'validating' | 'closing_long' | 'closing_short' | 'calculating_pnl' | 'completing';
  progress: number; // 0-100
  message: string;
  exchange?: string; // 當 step 為 closing_long/short 時提供
}
```

**Example**:
```json
{
  "positionId": "clxxx123",
  "step": "closing_long",
  "progress": 40,
  "message": "正在 Binance 平倉多頭...",
  "exchange": "binance"
}
```

**Progress Mapping**:
| Step | Progress | Message |
|------|----------|---------|
| validating | 10 | 驗證持倉狀態... |
| closing_long | 30-50 | 正在 {exchange} 平倉多頭... |
| closing_short | 50-70 | 正在 {exchange} 平倉空頭... |
| calculating_pnl | 80 | 計算損益中... |
| completing | 100 | 平倉完成 |

---

### `position:close:success`

平倉成功事件

```typescript
interface CloseSuccessEvent {
  positionId: string;
  trade: {
    id: string;
    priceDiffPnL: string;
    fundingRatePnL: string;
    totalPnL: string;
    roi: string;
    holdingDuration: number; // seconds
  };
  longClose: {
    exchange: string;
    orderId: string;
    price: string;
    quantity: string;
    fee: string;
  };
  shortClose: {
    exchange: string;
    orderId: string;
    price: string;
    quantity: string;
    fee: string;
  };
}
```

**Example**:
```json
{
  "positionId": "clxxx123",
  "trade": {
    "id": "clyyy456",
    "priceDiffPnL": "-1.25",
    "fundingRatePnL": "0",
    "totalPnL": "-2.25",
    "roi": "-0.45",
    "holdingDuration": 86400
  },
  "longClose": {
    "exchange": "binance",
    "orderId": "123456789",
    "price": "42150.50",
    "quantity": "0.0237",
    "fee": "0.50"
  },
  "shortClose": {
    "exchange": "okx",
    "orderId": "987654321",
    "price": "42148.30",
    "quantity": "0.0237",
    "fee": "0.49"
  }
}
```

---

### `position:close:failed`

平倉失敗事件

```typescript
interface CloseFailedEvent {
  positionId: string;
  error: string;
  errorCode: 'EXCHANGE_ERROR' | 'INSUFFICIENT_MARGIN' | 'NETWORK_ERROR' | 'TIMEOUT' | 'UNKNOWN';
  details?: {
    exchange?: string;
    originalError?: string;
  };
}
```

**Example**:
```json
{
  "positionId": "clxxx123",
  "error": "Binance API 返回錯誤：Insufficient margin",
  "errorCode": "EXCHANGE_ERROR",
  "details": {
    "exchange": "binance",
    "originalError": "APIError(code=-2019): Margin is insufficient"
  }
}
```

---

### `position:close:partial`

部分平倉事件（一邊成功，另一邊失敗）

```typescript
interface ClosePartialEvent {
  positionId: string;
  message: string;
  closedSide: {
    exchange: string;
    side: 'LONG' | 'SHORT';
    orderId: string;
    price: string;
    quantity: string;
    fee: string;
  };
  failedSide: {
    exchange: string;
    side: 'LONG' | 'SHORT';
    error: string;
    errorCode: string;
  };
}
```

**Example**:
```json
{
  "positionId": "clxxx123",
  "message": "部分平倉成功，請手動處理 OKX 空頭倉位",
  "closedSide": {
    "exchange": "binance",
    "side": "LONG",
    "orderId": "123456789",
    "price": "42150.50",
    "quantity": "0.0237",
    "fee": "0.50"
  },
  "failedSide": {
    "exchange": "okx",
    "side": "SHORT",
    "error": "Network timeout",
    "errorCode": "TIMEOUT"
  }
}
```

---

## Room Management

平倉進度事件發送到特定的 room：

```typescript
// Room 名稱格式
const roomName = `position:${positionId}`;

// 用戶加入 room（在開始平倉時）
socket.join(roomName);

// 發送事件到 room
io.to(roomName).emit('position:close:progress', event);

// 平倉完成後用戶離開 room
socket.leave(roomName);
```

## Client Usage Example

```typescript
// 前端監聽平倉事件
const socket = io();

// 監聽進度
socket.on('position:close:progress', (event: CloseProgressEvent) => {
  setProgress(event.progress);
  setMessage(event.message);
});

// 監聽成功
socket.on('position:close:success', (event: CloseSuccessEvent) => {
  showSuccessDialog(event.trade);
  refreshPositions();
});

// 監聽失敗
socket.on('position:close:failed', (event: CloseFailedEvent) => {
  showErrorDialog(event.error);
});

// 監聯部分成功
socket.on('position:close:partial', (event: ClosePartialEvent) => {
  showPartialCloseAlert(event);
});

// 加入 room（開始平倉前）
const joinPositionRoom = (positionId: string) => {
  socket.emit('position:join', { positionId });
};

// 離開 room（平倉完成後）
const leavePositionRoom = (positionId: string) => {
  socket.emit('position:leave', { positionId });
};
```
