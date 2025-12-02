# Research: Simulated APY Tracking

## Technical Decisions

### 1. Snapshot Recording Trigger Mechanism

**Decision**: Integrate with existing RatesCache update cycle

**Rationale**:
- RatesCache already receives real-time funding rate updates
- NotificationService (Feature 027) already hooks into this for settlement detection
- Reusing the same pattern ensures consistency and reduces complexity

**Alternatives Considered**:
- Cron job polling database - Rejected: less accurate timing, more database load
- WebSocket event listener - Rejected: adds complexity, RatesCache already handles this
- Separate background worker - Rejected: unnecessary when we can hook into existing flow

### 2. Settlement Time Detection

**Decision**: Use existing `isSettlementTime()` logic from NotificationService

**Rationale**:
- Already implemented and tested for Feature 027
- Handles different exchange settlement intervals (1h, 4h, 8h)
- ±2 minute tolerance window already defined

**Implementation Reference**: `src/services/notification/NotificationService.ts`

### 3. Simulated Profit Calculation

**Decision**: Calculate based on funding rate at settlement time × simulated capital

**Formula**:
```
settlementProfit = simulatedCapital × (longRate - shortRate)

Where:
- For long position: profit = -rate × capital (negative rate = earn, positive = pay)
- For short position: profit = +rate × capital (positive rate = earn, negative = pay)
- Combined: netProfit = shortRate - longRate (spread benefit)
```

**Rationale**:
- Matches real arbitrage profit mechanics
- Uses Decimal type for precision (Prisma Decimal → BigNumber in JS)
- Consistent with existing APY calculation in `src/lib/calculations.ts`

### 4. Data Retention Strategy

**Decision**: Scheduled cleanup job running daily at 3:00 AM

**Rationale**:
- Low traffic time minimizes impact
- 30-day retention is business requirement
- Using Prisma `deleteMany` with date filter is efficient

**Implementation**:
```typescript
// Delete trackings where:
// - status != ACTIVE
// - stoppedAt < (now - 30 days)
```

### 5. Active Tracking Limit Enforcement

**Decision**: Database unique constraint + application-level count check

**Rationale**:
- Unique constraint prevents race conditions for duplicate tracking
- Count check before create provides user-friendly error
- Constraint: `@@unique([userId, symbol, longExchange, shortExchange, status])` where status = ACTIVE

### 6. Real-time Status Updates on Market Monitor

**Decision**: Use React Query with periodic refetch + WebSocket for immediate updates

**Rationale**:
- Market Monitor already uses React Query for data fetching
- WebSocket can push tracking status changes
- Avoids full page reload while keeping UI responsive

**Implementation Pattern**:
- Initial load: fetch user's active trackings
- Cache tracking IDs in React state
- Show "Tracking" badge on rows matching cached IDs
- WebSocket updates on tracking start/stop

## Technology Choices Best Practices

### Prisma with PostgreSQL Arrays

**Best Practice**: Use native PostgreSQL arrays sparingly, prefer JSON for complex nested data

**Application**:
- `TrackingSnapshot.snapshotType` uses enum (simple, finite values)
- No arrays needed in this feature - all relationships are proper foreign keys

### Next.js API Routes with Authentication

**Best Practice**: Reuse existing `authenticate()` middleware pattern

**Reference**: `src/middleware/authMiddleware.ts`
- All tracking APIs require authentication
- User ID extracted from JWT token
- Ownership validation on all operations

### Decimal Handling in TypeScript

**Best Practice**: Convert Prisma Decimal to number only at API boundaries

**Implementation**:
```typescript
// Repository layer: keep as Decimal
// API response: convert to number via .toNumber()
// Calculations: use Decimal.js methods for precision
```

## Integration Patterns

### Integration with RatesCache

**Pattern**: Service injection via singleton

```typescript
// In RatesCache.setAll():
const trackingService = SimulatedTrackingService.getInstance();
if (this.isSettlementTime()) {
  await trackingService.recordSettlementSnapshots(rates);
}
```

### Integration with Market Monitor UI

**Pattern**: Composition via props drilling + context

```typescript
// RateRow receives tracking status as prop
// TrackButton renders based on isTracked prop
// Dialog uses React Portal for modal
```

## Unresolved Items

None - all technical decisions resolved based on existing patterns in codebase.
