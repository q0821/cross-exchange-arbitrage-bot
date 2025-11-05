# Implementation Plan: Web 多用戶套利交易平台

**Branch**: `006-web-trading-platform` | **Date**: 2025-10-30 | **Spec**: [spec.md](./spec.md)

## Summary

將現有 CLI 套利監控工具重構為完整的 Web 多用戶平台，支援用戶註冊登入、API Key 管理、即時套利機會監控 (WebSocket 推送)、手動開倉平倉交易執行、歷史收益和開關倉記錄追蹤。技術核心：Next.js 14 App Router + Socket.io + NextAuth.js + Prisma ORM + PostgreSQL/TimescaleDB + Redis。

## Technical Context

**Language/Version**: TypeScript 5.3+ with Node.js 20.x LTS  
**Primary Dependencies**: 
- Next.js 14.2+ (App Router)
- Socket.io 4.8+ (WebSocket)
- NextAuth.js v5 (Authentication)
- Prisma 5.x (ORM)
- React Query v5 (State management)
- Zod 3.x (Validation)

**Storage**: PostgreSQL 15+ with TimescaleDB extension (existing), Redis 7+ (rate limiting & locks)  
**Testing**: Vitest (unit), Playwright (E2E), k6 (load testing)  
**Target Platform**: Web (Next.js SSR + client-side React)  
**Project Type**: Web application (Next.js full-stack)  

**Performance Goals**: 
- WebSocket message delivery: <1s latency (FR-022, SC-006)
- Open/close position: <5s total execution time (SC-004, SC-005)
- Support 10 concurrent WebSocket connections (SC-006)
- API Key encryption/decryption: <100ms overhead (SC-010)

**Constraints**: 
- Fixed leverage: 3x (assumption #3)
- Market orders only (FR-031)
- No auto-trading in MVP (out of scope #1)
- Testnet testing required before mainnet (Constitution V)

**Scale/Scope**: 
- Initial users: 10 concurrent users (assumption #1)
- Trading pairs: USDT perpetual contracts only (assumption #2)
- Exchanges: Binance + OKX only (out of scope #7)


## Constitution Check

### Principle I: Trading Safety First (NON-NEGOTIABLE)
✅ **Transaction Compensation**: Saga pattern implemented  
✅ **Dual-Exchange Atomicity**: Rollback on partial failure (FR-033, 3 retries)  
✅ **Balance Validation**: Pre-trade balance check with 10% buffer (FR-029)  
✅ **Position State Persistence**: Database transactions ensure consistency  
✅ **Explicit User Confirmation**: Manual confirmation required for all trades

### Principle II: Complete Observability (NON-NEGOTIABLE)
✅ **Structured Logging**: Pino for all critical operations  
✅ **Trade Traceability**: Full lifecycle logged  
✅ **Error Context**: All errors include exchange, symbol, timestamp  
✅ **Performance Metrics**: API latency, WebSocket latency tracked

### Principle III: Defensive Programming
✅ **Retry Logic**: Exponential backoff for API calls (FR-056)  
✅ **WebSocket Reconnection**: Infinite retry with exponential backoff  
✅ **Input Validation**: Zod schemas for all user inputs  
✅ **Graceful Degradation**: System continues if one exchange down  
✅ **Fail-Fast**: Startup validation for env vars

### Principle IV: Data Integrity
✅ **Prisma Migrations**: All schema changes via migrations  
✅ **TimescaleDB**: FundingRate table uses hypertable  
✅ **Immutable Records**: Trade records append-only  
✅ **Decimal Type**: All financial calculations use Decimal

### Principle V: Incremental Delivery
✅ **MVP Scope**: US1-US2 (monitoring) before US3-US5 (trading)
✅ **Independent Testing**: Each user story testable independently
✅ **Testnet First**: API keys support testnet environment
⚠️ **Deferred**: Stop-loss enforcement - justification below


## Cost Calculation Module

### Design Rationale
To ensure users don't lose money on arbitrage trades, we implement a comprehensive cost calculation system that accounts for:
- Trading fees (Taker fees on both exchanges)
- Slippage (market order execution variance)
- Price differences (mark price variance between exchanges)
- Safety margin (buffer for unexpected costs)

This module provides **conservative estimates** to ensure profitability even with single 8-hour holding period (1 funding rate settlement).

### Cost Structure

| Cost Type | Rate | Calculation | Example ($100,000) |
|-----------|------|-------------|-------------------|
| Trading Fees | 0.2% | Taker Fee 0.05% × 4 (open 2 + close 2) | $200 |
| Slippage | 0.1% | Conservative market order estimate | $100 |
| Price Difference | 0.05% | Inter-exchange mark price variance | $50 |
| Safety Margin | 0.02% | Buffer for unexpected costs | $20 |
| **Total Cost** | **0.37%** | Sum of all components | **$370** |

### Net Profit Formula

```typescript
// Net profit calculation
netProfit = fundingRateDiff - TOTAL_COST;

// Annualized net return
// (3 settlements/day × 365 days = 1095)
annualizedNetReturn = netProfit × 1095;

// Valid opportunity check
isValidOpportunity = netProfit > 0;
```

### Example Scenarios

| Funding Rate Diff | Net Profit | Annualized Return | Status |
|------------------|------------|-------------------|--------|
| 0.37% | 0.00% | 0.00% | Break-even (threshold) |
| 0.40% | 0.03% | 32.85% | Valid opportunity ✓ |
| 0.50% | 0.13% | 142.35% | Strong opportunity ✓ |
| 0.30% | -0.07% | -76.65% | Loss (rejected) ✗ |

### Implementation

**Module**: `src/lib/cost-calculator.ts`
- `CostBreakdown` interface
- `calculateTotalCost()` function
- `calculateNetProfit()` function
- `calculateNetAnnualizedReturn()` function

**Constants**: `src/lib/cost-constants.ts`
- `TAKER_FEE_RATE = 0.0005` (0.05%)
- `SLIPPAGE_RATE = 0.001` (0.1%)
- `PRICE_DIFF_RATE = 0.0005` (0.05%)
- `SAFETY_MARGIN_RATE = 0.0002` (0.02%)
- `TOTAL_COST_RATE = 0.0037` (0.37%)
- `FUNDING_SETTLEMENTS_PER_YEAR = 1095`

**Integration Points**:
1. `OpportunityDetector.ts`: Update threshold to `0.0037` (0.37%)
2. `opportunity-helpers.ts`: Add `calculateNetProfit()` function
3. `OpportunityCard.tsx`: Display net profit and net annualized return
4. Database: Store both gross and net profit values


## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected |
|-----------|------------|------------------------------|
| Stop-Loss Enforcement deferred | MVP focuses on manual trading; requires 24/7 monitoring | Auto-monitoring adds complexity (job scheduler, alerts); risk mitigated by position limits and manual monitoring |


## Project Structure

### Documentation

```
specs/006-web-trading-platform/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    ├── openapi.yaml
    └── websocket.md
```

### Source Code

```
app/                     # Next.js 14 App Router
├── (auth)/              # Auth pages
│   ├── login/
│   └── register/
├── (dashboard)/         # Protected pages
│   ├── opportunities/
│   ├── positions/
│   ├── trades/
│   └── apikeys/
└── api/                 # API Routes

src/
├── services/            # Business logic
│   ├── auth/
│   ├── apikey/
│   ├── monitor/
│   ├── trading/
│   └── websocket/
├── models/
├── repositories/
├── lib/
│   ├── env.ts
│   ├── encryption.ts
│   ├── redis.ts
│   └── websocket.ts
└── middleware/

components/
├── ui/
├── opportunities/
├── positions/
└── trades/

tests/
├── unit/
├── e2e/
└── load/

prisma/
├── schema.prisma
├── migrations/
└── seed.ts
```

**Structure Decision**: Web application with Next.js 14 App Router. Backend in `app/api/` routes and `src/services/`. Frontend components in `app/` and `components/`. Existing `src/` retained for compatibility.


## Implementation Strategy

### Phase 1: Authentication & User Management (US1) - Week 1

**Goal**: Users can register, login, manage API keys

**Tasks**:
1. Set up NextAuth.js with Credentials provider
2. Implement user registration endpoint
3. Implement login/logout flows
4. Create dashboard layout
5. Implement API key encryption (AES-256-GCM)
6. Create API key management UI
7. Implement API key validation
8. Add AuditLog tracking
9. Write unit tests
10. Write E2E tests

**Deliverable**: User registration, login, encrypted API key management

---

### Phase 2: WebSocket & Opportunity Monitoring (US2) - Week 2

**Goal**: Real-time arbitrage opportunities via WebSocket

**Tasks**:
1. Set up Socket.io server
2. Implement opportunity detection
3. Implement WebSocket events
4. Create opportunities list UI
5. Implement React Query
6. Add reconnection handling
7. Implement throttling
8. Add performance monitoring
9. Write unit tests
10. Write k6 load tests (SC-006)

**Deliverable**: Live arbitrage opportunities, auto-updated

---

### Phase 3: Position Opening (US3) - Week 3

**Goal**: Open positions from opportunities

**Tasks**:
1. Implement balance validation
2. Implement Saga pattern
3. Implement rollback logic
4. Create open position UI
5. Add distributed locks (Redis)
6. Implement WebSocket position updates
7. Add state persistence
8. Implement error handling
9. Write unit tests
10. Write E2E tests (testnet)

**Deliverable**: Open positions with rollback safety

---

### Phase 4: Position Closing & P&L (US4) - Week 4

**Goal**: Close positions and view P&L

**Tasks**:
1. Implement position closing
2. Implement funding rate P&L
3. Implement price diff P&L
4. Create position detail UI
5. Create close confirmation
6. Handle partial failures
7. Create Trade records
8. Add trade completion events
9. Write unit tests
10. Write E2E tests

**Deliverable**: Close positions with accurate P&L

---

### Phase 5: Trade History & Statistics (US5) - Week 5

**Goal**: View trade history and stats

**Tasks**:
1. Implement trade history query
2. Implement statistics calculation
3. Create history table UI
4. Create statistics dashboard
5. Implement CSV export
6. Add filters
7. Write unit tests
8. Write E2E tests

**Deliverable**: Trade history, stats, export

---

### Phase 6: Production Hardening - Week 6

**Goal**: Production-ready system

**Tasks**:
1. Comprehensive error handling
2. Add circuit breaker
3. Implement rate limiting
4. Add health check endpoint
5. Set up Pino logging
6. Configure production env
7. Set up Docker Compose
8. Write deployment docs
9. Security audit
10. Load testing and optimization

**Deliverable**: Production-ready with observability


## Risk Mitigation

### Technical Risks

1. **WebSocket Connection Stability**
   - Mitigation: Infinite retry with exponential backoff, connection status UI
   - Testing: k6 load tests, network interruption simulation

2. **Exchange API Delays/Failures**
   - Mitigation: Retry with backoff, circuit breaker, 5s timeout
   - Monitoring: Log errors, alert on circuit open

3. **Partial Open/Close Failures**
   - Mitigation: Saga pattern, 3 retries within 3-4s
   - Fallback: Mark PARTIAL, log to AuditLog, user notification

4. **Concurrent Trading Race Conditions**
   - Mitigation: Redis locks, button disable, backend debouncing
   - Testing: E2E concurrent requests

### Security Risks

1. **API Key Leakage**
   - Mitigation: AES-256-GCM, master key in env, HTTPS only
   - Monitoring: Log access, rate limit decryption

2. **Password Brute Force**
   - Mitigation: Bcrypt (12 rounds), rate limiting (5/15min)
   - Implementation: Redis-backed limiter

3. **Session Hijacking**
   - Mitigation: HttpOnly cookies, 24h expiration, HTTPS, CSRF protection

### Business Risks

1. **Market Risk**
   - User Communication: Display disclaimer
   - Position Limits: Max 10,000 USDT (FR-028)

2. **Execution Slippage**
   - Display: Show estimated slippage
   - Logging: Record actual vs expected prices

3. **User Operation Errors**
   - UX: Clear confirmation dialogs
   - Testing: E2E error scenarios

## Testnet Strategy

**Phase 1-2**: Development only (no exchange)  
**Phase 3-4**: **Mandatory testnet testing**
- Binance Futures Testnet
- OKX Demo Trading
- Default TESTNET environment
- E2E tests against testnet

**Phase 5-6**: Mainnet support (opt-in)

## Dependencies

### External APIs
- Binance Futures API
- OKX API

### Reused Components
- OpportunityDetector service
- Exchange connectors
- Repository layer
- Prisma schema (extended)

### New Dependencies
- NextAuth.js v5
- Socket.io 4.8+
- React Query v5
- ioredis
- k6, p-retry, opossum

## Success Metrics

Key metrics from spec.md:
- SC-001: Setup in 5 minutes
- SC-002: Update latency < 1s
- SC-003: Success rate > 95%
- SC-004/005: Execution < 5s
- SC-006: 10 users, <1s latency
- SC-011: WebSocket stable 1+ hour

## Next Steps

1. Review and approve this plan
2. Run Prisma migrations
3. Generate tasks.md with `/speckit.tasks`
4. Begin Phase 1 implementation

