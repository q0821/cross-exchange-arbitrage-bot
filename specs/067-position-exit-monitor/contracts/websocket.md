# WebSocket Events Contract

## 概述

Feature 067 定義以下 WebSocket 事件用於即時推送平倉建議。

---

## 事件定義

### position:exit:suggested

當持倉被建議平倉時發送。

**方向**: Server → Client

**事件資料**:

```typescript
interface ExitSuggestedEvent {
  /** 持倉 ID */
  positionId: string;

  /** 交易對符號 */
  symbol: string;

  /** 建議原因 */
  reason: 'APY_NEGATIVE' | 'PROFIT_LOCKABLE';

  /** 原因描述 */
  reasonDescription: string;

  /** 當前 APY (%) */
  currentAPY: number;

  /** 累計費率收益 (USDT) */
  fundingPnL: number;

  /** 價差損失 (USDT) */
  priceDiffLoss: number;

  /** 淨收益 (USDT) */
  netProfit: number;

  /** 做多交易所 */
  longExchange: string;

  /** 做空交易所 */
  shortExchange: string;

  /** 當前做多價格 */
  currentLongPrice: number;

  /** 當前做空價格 */
  currentShortPrice: number;

  /** 價格是否過時 */
  stalePrice: boolean;

  /** 建議時間 (ISO 8601) */
  suggestedAt: string;
}
```

**範例**:

```json
{
  "positionId": "clx123abc",
  "symbol": "BTCUSDT",
  "reason": "APY_NEGATIVE",
  "reasonDescription": "APY 已轉負，繼續持有會虧損",
  "currentAPY": -50.2,
  "fundingPnL": 12.35,
  "priceDiffLoss": 8.20,
  "netProfit": 4.15,
  "longExchange": "binance",
  "shortExchange": "okx",
  "currentLongPrice": 65432.10,
  "currentShortPrice": 65450.00,
  "stalePrice": false,
  "suggestedAt": "2026-01-21T10:30:00.000Z"
}
```

---

### position:exit:canceled

當平倉建議取消（APY 回升）時發送。

**方向**: Server → Client

**事件資料**:

```typescript
interface ExitCanceledEvent {
  /** 持倉 ID */
  positionId: string;

  /** 交易對符號 */
  symbol: string;

  /** 當前 APY (%) */
  currentAPY: number;

  /** 取消時間 (ISO 8601) */
  canceledAt: string;
}
```

**範例**:

```json
{
  "positionId": "clx123abc",
  "symbol": "BTCUSDT",
  "currentAPY": 150.5,
  "canceledAt": "2026-01-21T10:35:00.000Z"
}
```

---

## 客戶端使用方式

### Socket.io Client (React)

```typescript
import { useEffect } from 'react';
import { useSocket } from '@/hooks/useSocket';

function useExitSuggestion(onSuggested: (data: ExitSuggestedEvent) => void) {
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;

    socket.on('position:exit:suggested', onSuggested);
    socket.on('position:exit:canceled', (data: ExitCanceledEvent) => {
      // 處理建議取消
    });

    return () => {
      socket.off('position:exit:suggested');
      socket.off('position:exit:canceled');
    };
  }, [socket, onSuggested]);
}
```

---

## 發送頻率

- 同一持倉 1 分鐘內最多發送 1 次 `position:exit:suggested`
- `position:exit:canceled` 無防抖動限制

---

## 錯誤處理

如果 Socket.io 服務未初始化，事件將被靜默跳過（記錄 debug 日誌）。
