# WebSocket Event Specifications

## Overview

The platform uses Socket.io for real-time bidirectional communication. WebSocket events enable instant updates for arbitrage opportunities, position changes, and trade completions.

## Connection & Authentication

### Handshake

Client connects with JWT token:
```typescript
const socket = io("http://localhost:3000", {
  auth: { token: sessionToken },
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 30000,
  reconnectionAttempts: Infinity
});
```

Server validates token and joins user to personal room.

## Event Types

### 1. opportunity:new
**Direction**: Server → Client
**Trigger**: New arbitrage opportunity detected

**Payload**:
```typescript
{
  id: string;
  symbol: string;
  longExchange: string;
  shortExchange: string;
  longPrice: number;
  shortPrice: number;
  longFundingRate: number;
  shortFundingRate: number;
  rateDifference: number;
  expectedReturnRate: number;
  detectedAt: string;
}
```

### 2. opportunity:update
**Direction**: Server → Client
**Trigger**: Opportunity data changed
Throttled to max 1 update/second per opportunity.

### 3. opportunity:expired
**Direction**: Server → Client
**Trigger**: Opportunity no longer valid

### 4. position:update
**Direction**: Server → Client (user-specific)
**Trigger**: Position status or PnL changed

### 5. trade:complete
**Direction**: Server → Client (user-specific)
**Trigger**: Position closed, trade record created

## Client-to-Server Events

### subscribe:opportunities
Subscribe to opportunity updates for specific symbols.

### ping/pong
Heartbeat mechanism for connection health.

## Reconnection Strategy

- Exponential backoff: 1s, 2s, 4s...max 30s
- Infinite retry attempts
- Auto-resubscribe on reconnect

## Performance

- Support 10 concurrent connections (SC-006)
- Message delivery latency < 1 second
- Test with k6 load testing tool

