# WebSocket Events: 手動開倉功能

**Date**: 2025-12-17
**Feature**: 033-manual-open-position

## Overview

開倉功能使用 WebSocket 來實時更新開倉進度和狀態變化。

## Events

### Client → Server

#### `position:open:subscribe`

訂閱特定持倉的狀態更新。

```typescript
interface PositionSubscribePayload {
  positionId: string;
}
```

**Example**:
```json
{
  "event": "position:open:subscribe",
  "data": {
    "positionId": "clxxx123"
  }
}
```

#### `position:open:unsubscribe`

取消訂閱持倉狀態更新。

```typescript
interface PositionUnsubscribePayload {
  positionId: string;
}
```

---

### Server → Client

#### `position:open:progress`

開倉進度更新。

```typescript
interface PositionProgressPayload {
  positionId: string;
  step: 'validating' | 'executing_long' | 'executing_short' | 'completing' | 'rolling_back';
  progress: number; // 0-100
  message: string;
  exchange?: string;
}
```

**Progress Steps**:

| Step | Progress | Message |
|------|----------|---------|
| validating | 10 | 正在驗證餘額... |
| executing_long | 30 | 正在 {exchange} 開多倉... |
| executing_short | 60 | 正在 {exchange} 開空倉... |
| completing | 90 | 正在完成開倉... |
| rolling_back | 50 | 正在回滾 {exchange} 倉位... |

**Example**:
```json
{
  "event": "position:open:progress",
  "data": {
    "positionId": "clxxx123",
    "step": "executing_long",
    "progress": 30,
    "message": "正在 Binance 開多倉...",
    "exchange": "binance"
  }
}
```

#### `position:open:success`

開倉成功。

```typescript
interface PositionSuccessPayload {
  positionId: string;
  longTrade: {
    exchange: string;
    orderId: string;
    price: string;
    quantity: string;
    fee: string;
  };
  shortTrade: {
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
  "event": "position:open:success",
  "data": {
    "positionId": "clxxx123",
    "longTrade": {
      "exchange": "binance",
      "orderId": "123456789",
      "price": "42150.50",
      "quantity": "0.05",
      "fee": "0.42"
    },
    "shortTrade": {
      "exchange": "okx",
      "orderId": "987654321",
      "price": "42148.30",
      "quantity": "0.05",
      "fee": "0.41"
    }
  }
}
```

#### `position:open:failed`

開倉失敗。

```typescript
interface PositionFailedPayload {
  positionId: string;
  error: string;
  errorCode: string;
  details?: {
    exchange?: string;
    rolledBack?: boolean;
    requiresManualIntervention?: boolean;
  };
}
```

**Error Codes**:

| Code | Description |
|------|-------------|
| INSUFFICIENT_BALANCE | 餘額不足 |
| API_ERROR | 交易所 API 錯誤 |
| NETWORK_TIMEOUT | 網路超時 |
| RATE_LIMITED | 請求頻率限制 |
| ROLLBACK_FAILED | 回滾失敗，需手動處理 |
| LOCK_CONFLICT | 並發衝突 |

**Example**:
```json
{
  "event": "position:open:failed",
  "data": {
    "positionId": "clxxx123",
    "error": "OKX 開倉失敗，已嘗試回滾 Binance 倉位",
    "errorCode": "API_ERROR",
    "details": {
      "exchange": "okx",
      "rolledBack": true,
      "requiresManualIntervention": false
    }
  }
}
```

#### `position:open:rollback_failed`

回滾失敗，需要手動處理。

```typescript
interface RollbackFailedPayload {
  positionId: string;
  exchange: string;
  orderId: string;
  side: 'LONG' | 'SHORT';
  quantity: string;
  message: string;
}
```

**Example**:
```json
{
  "event": "position:open:rollback_failed",
  "data": {
    "positionId": "clxxx123",
    "exchange": "binance",
    "orderId": "123456789",
    "side": "LONG",
    "quantity": "0.05",
    "message": "無法自動回滾，請手動在 Binance 平倉 0.05 BTC 的多倉"
  }
}
```

---

## Room Management

每個開倉操作創建一個獨立的 room：

```typescript
const roomName = `position:${positionId}`;

// 用戶訂閱
socket.join(roomName);

// 發送進度
io.to(roomName).emit('position:open:progress', payload);

// 完成後離開
socket.leave(roomName);
```

---

## Error Handling

### 連線斷開重連

如果用戶在開倉過程中斷線重連：

1. 重新訂閱 `position:open:subscribe`
2. Server 返回當前狀態（如果仍在執行中）
3. 如果已完成，返回最終結果

### 重複訂閱

同一用戶對同一 positionId 多次訂閱時，只保留一個訂閱。
