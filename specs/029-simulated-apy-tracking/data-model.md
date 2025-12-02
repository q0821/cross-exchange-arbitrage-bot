# Data Model: Simulated APY Tracking

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                            User                                  │
│  (existing model from Feature 006)                              │
└───────────────────────┬─────────────────────────────────────────┘
                        │ 1:N
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SimulatedTracking                             │
│                                                                  │
│  id                  String     @id @cuid                       │
│  userId              String     → User                          │
│  symbol              String     (e.g., "BTCUSDT")              │
│  longExchange        String     (e.g., "binance")              │
│  shortExchange       String     (e.g., "okx")                  │
│  simulatedCapital    Decimal    (USDT amount)                  │
│  autoStopOnExpire    Boolean    (default: true)                │
│  initialSpread       Decimal    (spread at start)              │
│  initialAPY          Decimal    (APY at start)                 │
│  initialLongRate     Decimal    (long rate at start)           │
│  initialShortRate    Decimal    (short rate at start)          │
│  longIntervalHours   Int        (1, 4, or 8)                   │
│  shortIntervalHours  Int        (1, 4, or 8)                   │
│  status              Enum       (ACTIVE, STOPPED, EXPIRED)     │
│  startedAt           DateTime   (tracking start)               │
│  stoppedAt           DateTime?  (when stopped/expired)         │
│  totalFundingProfit  Decimal    (cumulative profit)            │
│  totalSettlements    Int        (settlement count)             │
│  maxSpread           Decimal    (highest spread seen)          │
│  minSpread           Decimal    (lowest spread seen)           │
│  createdAt           DateTime                                   │
│  updatedAt           DateTime                                   │
│                                                                  │
│  @@unique([userId, symbol, longExchange, shortExchange, status])│
│  @@index([userId, status])                                      │
└───────────────────────┬─────────────────────────────────────────┘
                        │ 1:N
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    TrackingSnapshot                              │
│                                                                  │
│  id                  String     @id @cuid                       │
│  trackingId          String     → SimulatedTracking             │
│  snapshotType        Enum       (SETTLEMENT, PERIODIC)         │
│  longRate            Decimal    (rate at snapshot time)        │
│  shortRate           Decimal    (rate at snapshot time)        │
│  spread              Decimal    (longRate - shortRate)         │
│  annualizedReturn    Decimal    (APY percentage)               │
│  longPrice           Decimal?   (price on long exchange)       │
│  shortPrice          Decimal?   (price on short exchange)      │
│  priceDiffPercent    Decimal?   (price difference %)           │
│  settlementSide      Enum?      (LONG, SHORT, BOTH)            │
│  fundingProfit       Decimal?   (profit from this settlement)  │
│  cumulativeProfit    Decimal    (running total)                │
│  recordedAt          DateTime                                   │
│                                                                  │
│  @@index([trackingId, recordedAt DESC])                         │
└─────────────────────────────────────────────────────────────────┘
```

## Prisma Schema

```prisma
// ===== Simulated APY Tracking (Feature 029) =====

model SimulatedTracking {
  id                String   @id @default(cuid())
  userId            String

  // Arbitrage opportunity identification
  symbol            String   @db.VarChar(20)
  longExchange      String   @db.VarChar(20)
  shortExchange     String   @db.VarChar(20)

  // Simulation settings
  simulatedCapital  Decimal  @db.Decimal(18, 8)
  autoStopOnExpire  Boolean  @default(true)

  // Initial state snapshot
  initialSpread     Decimal  @db.Decimal(10, 6)
  initialAPY        Decimal  @db.Decimal(10, 2)
  initialLongRate   Decimal  @db.Decimal(10, 8)
  initialShortRate  Decimal  @db.Decimal(10, 8)

  // Exchange settlement intervals
  longIntervalHours    Int   @db.SmallInt
  shortIntervalHours   Int   @db.SmallInt

  // Tracking status
  status            TrackingStatus @default(ACTIVE)

  // Timestamps
  startedAt         DateTime @default(now()) @db.Timestamptz
  stoppedAt         DateTime? @db.Timestamptz

  // Cumulative statistics (updated on each snapshot)
  totalFundingProfit   Decimal  @default(0) @db.Decimal(18, 8)
  totalSettlements     Int      @default(0)
  maxSpread            Decimal  @default(0) @db.Decimal(10, 6)
  minSpread            Decimal  @default(0) @db.Decimal(10, 6)

  createdAt         DateTime @default(now()) @db.Timestamptz
  updatedAt         DateTime @updatedAt @db.Timestamptz

  // Relations
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  snapshots         TrackingSnapshot[]

  // Constraints
  @@unique([userId, symbol, longExchange, shortExchange, status])
  @@index([userId, status])
  @@index([symbol])
  @@index([startedAt(sort: Desc)])
  @@map("simulated_trackings")
}

enum TrackingStatus {
  ACTIVE
  STOPPED
  EXPIRED
}

model TrackingSnapshot {
  id                String   @id @default(cuid())
  trackingId        String

  // Snapshot type
  snapshotType      SnapshotType

  // Rate data
  longRate          Decimal  @db.Decimal(10, 8)
  shortRate         Decimal  @db.Decimal(10, 8)
  spread            Decimal  @db.Decimal(10, 6)
  annualizedReturn  Decimal  @db.Decimal(10, 2)

  // Price data (optional)
  longPrice         Decimal? @db.Decimal(18, 8)
  shortPrice        Decimal? @db.Decimal(18, 8)
  priceDiffPercent  Decimal? @db.Decimal(10, 4)

  // Settlement-specific fields
  settlementSide    SettlementSide?
  fundingProfit     Decimal? @db.Decimal(18, 8)
  cumulativeProfit  Decimal  @db.Decimal(18, 8)

  recordedAt        DateTime @default(now()) @db.Timestamptz

  // Relations
  tracking          SimulatedTracking @relation(fields: [trackingId], references: [id], onDelete: Cascade)

  // Indexes
  @@index([trackingId, recordedAt(sort: Desc)])
  @@index([trackingId, snapshotType])
  @@map("tracking_snapshots")
}

enum SnapshotType {
  SETTLEMENT
  PERIODIC
}

enum SettlementSide {
  LONG
  SHORT
  BOTH
}
```

## Validation Rules

### SimulatedTracking

| Field | Rule |
|-------|------|
| symbol | Required, 1-20 chars, uppercase alphanumeric |
| longExchange | Required, enum: binance, okx, mexc, gateio |
| shortExchange | Required, enum: binance, okx, mexc, gateio, must differ from longExchange |
| simulatedCapital | Required, positive number, min: 100, max: 1,000,000 |
| autoStopOnExpire | Optional, default: true |

### TrackingSnapshot

| Field | Rule |
|-------|------|
| snapshotType | Required, enum: SETTLEMENT, PERIODIC |
| settlementSide | Required if snapshotType = SETTLEMENT |
| fundingProfit | Required if snapshotType = SETTLEMENT |

## State Transitions

```
                    ┌─────────────┐
                    │   ACTIVE    │
                    └──────┬──────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
    User clicks      APY < 800%      30 days
    "Stop"           (if auto-stop)   passed
           │               │               │
           ▼               ▼               │
    ┌──────────┐    ┌──────────┐          │
    │ STOPPED  │    │ EXPIRED  │          │
    └──────────┘    └──────────┘          │
           │               │               │
           └───────────────┴───────────────┘
                           │
                           ▼
                    After 30 days
                    → DELETE record
```

## Zod Schemas (TypeScript)

```typescript
import { z } from 'zod';

export const CreateTrackingSchema = z.object({
  symbol: z.string().min(1).max(20).toUpperCase(),
  longExchange: z.enum(['binance', 'okx', 'mexc', 'gateio']),
  shortExchange: z.enum(['binance', 'okx', 'mexc', 'gateio']),
  simulatedCapital: z.number().min(100).max(1000000),
  autoStopOnExpire: z.boolean().default(true),
}).refine(data => data.longExchange !== data.shortExchange, {
  message: 'Long and short exchanges must be different',
  path: ['shortExchange'],
});

export const TrackingQuerySchema = z.object({
  status: z.enum(['ACTIVE', 'STOPPED', 'EXPIRED', 'all']).optional().default('all'),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  offset: z.coerce.number().min(0).optional().default(0),
});

export const SnapshotQuerySchema = z.object({
  type: z.enum(['SETTLEMENT', 'PERIODIC', 'all']).optional().default('all'),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
});
```
