# WebSocket Events: 停損停利觸發偵測與自動平倉

**Feature**: 050-sl-tp-trigger-monitor
**Created**: 2025-12-29

---

## 事件概覽

此功能主要是後端監控服務，透過 WebSocket 推送觸發事件通知給前端。

---

## 觸發事件 (Server → Client)

### 1. 條件單觸發開始處理

**Event**: `trigger:detected`

**Payload**:
```typescript
interface TriggerDetectedEvent {
  positionId: string;
  symbol: string;
  triggerType: 'LONG_SL' | 'LONG_TP' | 'SHORT_SL' | 'SHORT_TP' | 'BOTH';
  triggeredExchange: string;
  triggeredAt: string; // ISO 8601
}
```

**Example**:
```json
{
  "positionId": "cm123abc",
  "symbol": "BTCUSDT",
  "triggerType": "LONG_SL",
  "triggeredExchange": "binance",
  "triggeredAt": "2025-12-29T10:30:00.000Z"
}
```

---

### 2. 自動平倉進度

**Event**: `trigger:close:progress`

**Payload**:
```typescript
interface TriggerCloseProgressEvent {
  positionId: string;
  step: 'CLOSING_OTHER_SIDE' | 'CANCELING_ORDERS' | 'UPDATING_STATUS';
  message: string;
}
```

**Example**:
```json
{
  "positionId": "cm123abc",
  "step": "CLOSING_OTHER_SIDE",
  "message": "正在平倉空方 OKX..."
}
```

---

### 3. 自動平倉成功

**Event**: `trigger:close:success`

**Payload**:
```typescript
interface TriggerCloseSuccessEvent {
  positionId: string;
  symbol: string;
  triggerType: 'LONG_SL' | 'LONG_TP' | 'SHORT_SL' | 'SHORT_TP' | 'BOTH';
  closeReason: CloseReason;
  closedAt: string; // ISO 8601
  pnl: {
    priceDiffPnL: number;
    fundingRatePnL: number;
    totalFees: number;
    totalPnL: number;
    roi: number; // percentage
  };
}
```

**Example**:
```json
{
  "positionId": "cm123abc",
  "symbol": "BTCUSDT",
  "triggerType": "LONG_SL",
  "closeReason": "LONG_SL_TRIGGERED",
  "closedAt": "2025-12-29T10:30:05.000Z",
  "pnl": {
    "priceDiffPnL": -5.23,
    "fundingRatePnL": 2.15,
    "totalFees": 1.20,
    "totalPnL": -4.28,
    "roi": -0.43
  }
}
```

---

### 4. 自動平倉失敗

**Event**: `trigger:close:failed`

**Payload**:
```typescript
interface TriggerCloseFailedEvent {
  positionId: string;
  symbol: string;
  triggerType: 'LONG_SL' | 'LONG_TP' | 'SHORT_SL' | 'SHORT_TP' | 'BOTH';
  error: string;
  requiresManualIntervention: boolean;
  failedSide?: {
    exchange: string;
    side: 'LONG' | 'SHORT';
  };
}
```

**Example**:
```json
{
  "positionId": "cm123abc",
  "symbol": "BTCUSDT",
  "triggerType": "LONG_SL",
  "error": "OKX API 連線超時",
  "requiresManualIntervention": true,
  "failedSide": {
    "exchange": "okx",
    "side": "SHORT"
  }
}
```

---

### 5. 部分平倉

**Event**: `trigger:close:partial`

**Payload**:
```typescript
interface TriggerClosePartialEvent {
  positionId: string;
  symbol: string;
  triggerType: 'LONG_SL' | 'LONG_TP' | 'SHORT_SL' | 'SHORT_TP';
  closedSide: {
    exchange: string;
    side: 'LONG' | 'SHORT';
    price: number;
    quantity: number;
  };
  failedSide: {
    exchange: string;
    side: 'LONG' | 'SHORT';
    error: string;
  };
  requiresManualIntervention: boolean;
}
```

**Example**:
```json
{
  "positionId": "cm123abc",
  "symbol": "BTCUSDT",
  "triggerType": "LONG_SL",
  "closedSide": {
    "exchange": "okx",
    "side": "SHORT",
    "price": 94000.50,
    "quantity": 0.01
  },
  "failedSide": {
    "exchange": "binance",
    "side": "LONG",
    "error": "Insufficient margin"
  },
  "requiresManualIntervention": true
}
```

---

## 訂閱機制

前端需要訂閱用戶的觸發事件：

```typescript
// Client-side subscription
socket.on('trigger:detected', (event: TriggerDetectedEvent) => {
  // 顯示觸發通知
  showToast(`${event.symbol} ${getTriggerTypeLabel(event.triggerType)} 已觸發`);
});

socket.on('trigger:close:success', (event: TriggerCloseSuccessEvent) => {
  // 更新持倉列表
  refreshPositions();
  showToast(`${event.symbol} 已自動平倉，損益: ${event.pnl.totalPnL} USDT`);
});

socket.on('trigger:close:failed', (event: TriggerCloseFailedEvent) => {
  // 顯示錯誤警告
  if (event.requiresManualIntervention) {
    showAlert(`${event.symbol} 自動平倉失敗，請手動處理！`);
  }
});
```

---

## 事件流程圖

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ConditionalOrderMonitor                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ 偵測到觸發
                                      ▼
                        ┌───────────────────────────┐
                        │    trigger:detected       │ ──→ Client
                        └───────────────────────────┘
                                      │
                                      ▼
                        ┌───────────────────────────┐
                        │  trigger:close:progress   │ ──→ Client (多次)
                        │  step: CLOSING_OTHER_SIDE │
                        └───────────────────────────┘
                                      │
                                      ▼
                        ┌───────────────────────────┐
                        │  trigger:close:progress   │ ──→ Client
                        │  step: CANCELING_ORDERS   │
                        └───────────────────────────┘
                                      │
                                      ▼
                        ┌───────────────────────────┐
                        │  trigger:close:progress   │ ──→ Client
                        │  step: UPDATING_STATUS    │
                        └───────────────────────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    ▼                                   ▼
        ┌───────────────────────┐           ┌───────────────────────┐
        │ trigger:close:success │           │ trigger:close:failed  │
        └───────────────────────┘           │   or                  │
                    │                       │ trigger:close:partial │
                    ▼                       └───────────────────────┘
               Position                                │
              狀態更新                                  ▼
                                              需要手動處理
```
