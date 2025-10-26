# WebSocket Events Specification

**Feature**: 006-web-trading-platform
**Version**: 1.0.0
**Date**: 2025-10-27

## 概述

本文件定義 Web 多用戶套利交易平台的 WebSocket 事件規格。WebSocket 用於即時推送套利機會更新、持倉變化和系統通知給已登入用戶的瀏覽器。

### 技術棧

- **Server**: Socket.io 4.x (Node.js)
- **Client**: Socket.io-client 4.x (React)
- **Transport**: WebSocket (自動降級到 long-polling)
- **Port**: 與 HTTP 服務共用 port (3000)

---

## 連線建立

### 1. 客戶端連線

```typescript
import { io, Socket } from 'socket.io-client';

const socket: Socket = io('http://localhost:3000', {
  withCredentials: true,  // 發送 HttpOnly Cookie (JWT Token)
  reconnection: true,     // 自動重連
  reconnectionDelay: 1000,
  reconnectionAttempts: 5,
});

// 連線成功
socket.on('connect', () => {
  console.log('Connected to server, socket ID:', socket.id);
});

// 連線錯誤
socket.on('connect_error', (error) => {
  console.error('Connection error:', error.message);
});

// 斷線
socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});
```

### 2. 伺服器端認證

伺服器在建立連線時驗證用戶 JWT Token（從 Cookie 讀取）：

```typescript
// src/websocket/middleware/AuthMiddleware.ts

io.use((socket, next) => {
  const token = socket.handshake.headers.cookie
    ?.split('; ')
    .find(row => row.startsWith('token='))
    ?.split('=')[1];

  if (!token) {
    return next(new Error('Authentication error: No token provided'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.data.userId = decoded.userId;  // 儲存 userId 到 socket.data
    next();
  } catch (error) {
    next(new Error('Authentication error: Invalid token'));
  }
});
```

### 3. 用戶房間（Room）

每個用戶加入自己的私有房間，確保只收到自己的數據：

```typescript
io.on('connection', (socket) => {
  const userId = socket.data.userId;
  socket.join(`user:${userId}`);  // 加入用戶私有房間
  console.log(`User ${userId} joined room: user:${userId}`);
});
```

---

## 事件列表

### Client → Server 事件 (Emit)

| 事件名稱 | 描述 | 參數 |
|---------|------|------|
| `subscribe:opportunities` | 訂閱套利機會更新 | `{ symbols?: string[] }` |
| `unsubscribe:opportunities` | 取消訂閱套利機會更新 | `{}` |
| `subscribe:positions` | 訂閱持倉更新 | `{}` |
| `unsubscribe:positions` | 取消訂閱持倉更新 | `{}` |

### Server → Client 事件 (On)

| 事件名稱 | 描述 | Payload Schema |
|---------|------|---------------|
| `opportunity:new` | 新套利機會偵測到 | `OpportunityPayload` |
| `opportunity:update` | 套利機會更新（價格或費率變化） | `OpportunityPayload` |
| `opportunity:expired` | 套利機會過期 | `OpportunityExpiredPayload` |
| `position:opened` | 持倉開倉成功 | `PositionPayload` |
| `position:updated` | 持倉狀態更新 | `PositionPayload` |
| `position:closed` | 持倉平倉成功 | `TradePay load` |
| `position:failed` | 開倉或平倉失敗 | `ErrorPayload` |
| `notification` | 系統通知 | `NotificationPayload` |
| `error` | WebSocket 錯誤 | `ErrorPayload` |

---

## 事件詳細規格

### 1. 訂閱套利機會更新

**事件**: `subscribe:opportunities`

**Client → Server**:
```typescript
socket.emit('subscribe:opportunities', {
  symbols: ['BTCUSDT', 'ETHUSDT'],  // 可選，篩選特定交易對
});
```

**Server → Client**:
```typescript
socket.on('opportunity:new', (data: OpportunityPayload) => {
  console.log('New opportunity:', data);
});

socket.on('opportunity:update', (data: OpportunityPayload) => {
  console.log('Opportunity updated:', data);
});

socket.on('opportunity:expired', (data: OpportunityExpiredPayload) => {
  console.log('Opportunity expired:', data.id);
});
```

**OpportunityPayload Schema**:
```typescript
interface OpportunityPayload {
  id: string;
  symbol: string;
  longExchange: 'binance' | 'okx';
  shortExchange: 'binance' | 'okx';
  prices: {
    long: number;
    short: number;
  };
  fundingRates: {
    long: number;
    short: number;
  };
  spreadBps: number;         // 費率差異（basis points）
  annualizedReturn: number;  // 預期年化收益率（%）
  status: 'ACTIVE' | 'EXPIRED';
  detectedAt: string;        // ISO 8601 timestamp
}
```

**OpportunityExpiredPayload Schema**:
```typescript
interface OpportunityExpiredPayload {
  id: string;
  symbol: string;
  expiredAt: string;  // ISO 8601 timestamp
}
```

**推送頻率**: 每 1 秒推送一次（如果有更新）

---

### 2. 訂閱持倉更新

**事件**: `subscribe:positions`

**Client → Server**:
```typescript
socket.emit('subscribe:positions', {});
```

**Server → Client**:
```typescript
socket.on('position:opened', (data: PositionPayload) => {
  console.log('Position opened:', data);
});

socket.on('position:updated', (data: PositionPayload) => {
  console.log('Position updated:', data);
});

socket.on('position:closed', (data: TradePayload) => {
  console.log('Position closed, trade created:', data);
});

socket.on('position:failed', (data: ErrorPayload) => {
  console.error('Position operation failed:', data);
});
```

**PositionPayload Schema**:
```typescript
interface PositionPayload {
  id: string;
  symbol: string;
  longSide: {
    exchange: 'binance' | 'okx';
    orderId: string | null;
    entryPrice: number;
    positionSize: number;
    leverage: number;
  };
  shortSide: {
    exchange: 'binance' | 'okx';
    orderId: string | null;
    entryPrice: number;
    positionSize: number;
    leverage: number;
  };
  status: 'PENDING' | 'OPENING' | 'OPEN' | 'CLOSING' | 'CLOSED' | 'FAILED' | 'PARTIAL';
  unrealizedPnL: number | null;  // 僅 status=OPEN 時有值
  openedAt: string | null;       // ISO 8601 timestamp
  closedAt: string | null;
  createdAt: string;
}
```

**TradePayload Schema**:
```typescript
interface TradePayload {
  id: string;
  positionId: string;
  symbol: string;
  longSide: {
    exchange: string;
    entryPrice: number;
    exitPrice: number;
    positionSize: number;
  };
  shortSide: {
    exchange: string;
    entryPrice: number;
    exitPrice: number;
    positionSize: number;
  };
  openedAt: string;
  closedAt: string;
  holdingDuration: number;  // 秒
  pnl: {
    priceDiff: number;
    fundingRate: number;
    total: number;
  };
  roi: number;              // 收益率（%）
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
}
```

**推送時機**:
- `position:opened`: 雙邊開倉成功時
- `position:updated`: 狀態變化或 PnL 更新時（每 5 秒）
- `position:closed`: 雙邊平倉成功且建立 Trade 記錄後
- `position:failed`: 開倉或平倉失敗時

---

### 3. 系統通知

**事件**: `notification`

**Server → Client**:
```typescript
socket.on('notification', (data: NotificationPayload) => {
  console.log('Notification:', data);
  // 顯示 toast 通知給用戶
});
```

**NotificationPayload Schema**:
```typescript
interface NotificationPayload {
  id: string;
  type: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';
  title: string;
  message: string;
  timestamp: string;  // ISO 8601 timestamp
  data?: any;         // 可選的額外資料
}
```

**通知類型範例**:

1. **INFO**: 一般資訊
   ```typescript
   {
     type: 'INFO',
     title: '新機會偵測到',
     message: 'BTCUSDT 出現年化 15.5% 的套利機會'
   }
   ```

2. **WARNING**: 警告
   ```typescript
   {
     type: 'WARNING',
     title: '未實現虧損警告',
     message: '您的 ETHUSDT 持倉未實現虧損達 -8%'
   }
   ```

3. **ERROR**: 錯誤
   ```typescript
   {
     type: 'ERROR',
     title: '開倉失敗',
     message: 'Binance 餘額不足，無法開倉'
   }
   ```

4. **SUCCESS**: 成功
   ```typescript
   {
     type: 'SUCCESS',
     title: '平倉成功',
     message: 'BTCUSDT 持倉平倉成功，實現收益 +125.50 USDT'
   }
   ```

---

### 4. 錯誤處理

**事件**: `error`

**Server → Client**:
```typescript
socket.on('error', (data: ErrorPayload) => {
  console.error('WebSocket error:', data);
});
```

**ErrorPayload Schema**:
```typescript
interface ErrorPayload {
  code: string;           // 錯誤代碼（例如 "POSITION_OPEN_FAILED"）
  message: string;        // 錯誤訊息
  timestamp: string;      // ISO 8601 timestamp
  details?: any;          // 可選的詳細資訊
}
```

**常見錯誤代碼**:

| Code | 描述 |
|------|------|
| `AUTH_FAILED` | 認證失敗（Token 無效或過期） |
| `SUBSCRIPTION_FAILED` | 訂閱失敗 |
| `POSITION_OPEN_FAILED` | 開倉失敗 |
| `POSITION_CLOSE_FAILED` | 平倉失敗 |
| `EXCHANGE_API_ERROR` | 交易所 API 錯誤 |
| `RATE_LIMIT_EXCEEDED` | API 速率限制 |
| `INTERNAL_ERROR` | 伺服器內部錯誤 |

---

## 使用範例

### React Hook 範例

```typescript
// hooks/useWebSocket.ts

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export function useWebSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const newSocket = io('http://localhost:3000', {
      withCredentials: true,
      reconnection: true,
    });

    newSocket.on('connect', () => {
      console.log('Connected');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected');
      setIsConnected(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  return { socket, isConnected };
}
```

```typescript
// components/opportunities/OpportunityList.tsx

import { useEffect, useState } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';

export function OpportunityList() {
  const { socket, isConnected } = useWebSocket();
  const [opportunities, setOpportunities] = useState<OpportunityPayload[]>([]);

  useEffect(() => {
    if (!socket || !isConnected) return;

    // 訂閱套利機會更新
    socket.emit('subscribe:opportunities', {});

    // 監聽新機會
    socket.on('opportunity:new', (data: OpportunityPayload) => {
      setOpportunities(prev => [...prev, data]);
    });

    // 監聽機會更新
    socket.on('opportunity:update', (data: OpportunityPayload) => {
      setOpportunities(prev =>
        prev.map(opp => opp.id === data.id ? data : opp)
      );
    });

    // 監聽機會過期
    socket.on('opportunity:expired', (data: OpportunityExpiredPayload) => {
      setOpportunities(prev => prev.filter(opp => opp.id !== data.id));
    });

    // 清理
    return () => {
      socket.emit('unsubscribe:opportunities', {});
      socket.off('opportunity:new');
      socket.off('opportunity:update');
      socket.off('opportunity:expired');
    };
  }, [socket, isConnected]);

  return (
    <div>
      {/* 渲染 opportunities */}
    </div>
  );
}
```

---

## 效能考慮

### 1. 推送頻率限制

- **套利機會更新**: 最多每 1 秒推送一次（防止過度推送）
- **持倉 PnL 更新**: 最多每 5 秒推送一次
- **使用防抖動 (Debounce)**: 避免在短時間內多次推送相同事件

### 2. 用戶房間隔離

- 每個用戶只收到自己的持倉更新
- 套利機會更新可以廣播給所有訂閱的用戶，但需要檢查用戶是否有對應的 API Key

### 3. 連線管理

- 使用 Socket.io 的 `rooms` 機制管理用戶訂閱
- 斷線時自動清理訂閱，重連後需要重新訂閱
- 伺服器端定期清理閒置連線（超過 1 小時無活動）

---

## 安全性

### 1. 認證

- 所有 WebSocket 連線必須通過 JWT Token 認證
- Token 儲存在 HttpOnly Cookie 中，防止 XSS 攻擊
- Token 過期時自動斷線，客戶端需重新登入

### 2. 資料隔離

- 用戶只能訂閱和接收自己的持倉更新
- 套利機會更新對所有用戶可見（公共數據）
- 使用用戶私有房間（`user:${userId}`）確保隔離

### 3. Rate Limiting

- 限制每個用戶的訂閱數量（最多 10 個 symbol）
- 限制事件發送頻率（每秒最多 10 個事件）

---

## 測試

### 單元測試範例

```typescript
// tests/websocket/OpportunityHandler.test.ts

import { Server } from 'socket.io';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';

describe('OpportunityHandler', () => {
  let io: Server;
  let clientSocket: ClientSocket;

  beforeAll((done) => {
    io = new Server(3001);
    clientSocket = ioClient('http://localhost:3001', {
      withCredentials: true,
    });
    clientSocket.on('connect', done);
  });

  afterAll(() => {
    io.close();
    clientSocket.disconnect();
  });

  it('should emit opportunity:new when user subscribes', (done) => {
    clientSocket.emit('subscribe:opportunities', {});

    clientSocket.on('opportunity:new', (data) => {
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('symbol');
      expect(data.status).toBe('ACTIVE');
      done();
    });

    // 模擬新機會偵測
    io.to(`user:${userId}`).emit('opportunity:new', mockOpportunity);
  });
});
```

---

## 下一步

- **Phase 1 (續)**: 產生快速開始指南 (quickstart.md)
- **Phase 2**: 產生開發任務清單 (tasks.md) - 使用 `/speckit.tasks` 指令
