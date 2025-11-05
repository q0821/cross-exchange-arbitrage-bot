# Technical Research & Decisions

## Decision 1: Authentication Mechanism

**Decision**: NextAuth.js v5 (Auth.js) with Credentials Provider

**Rationale**:
- **Pros**:
  - First-party Next.js integration with App Router support
  - Built-in session management with JWT or database sessions
  - Support for middleware-based authentication guards
  - Email/password authentication via Credentials provider
  - Extensible for future OAuth providers (Google, GitHub)
  - Industry-standard security practices (CSRF protection, secure cookies)
  
- **Cons**:
  - Requires additional configuration for custom user model
  - JWT size limitations (but acceptable for user ID + basic claims)

**Alternatives Considered**:
- **Custom JWT implementation**: More control but reinvents security wheel, prone to errors
- **Passport.js**: Legacy approach, poor Next.js 14 App Router integration
- **Lucia Auth**: Modern alternative but smaller ecosystem, less mature

**Implementation Notes**:
- Use `authorize()` callback to verify bcrypt hashed passwords
- Store session in HttpOnly cookies (secure by default)
- Session expiry: 24 hours (as per FR-006)
- Integrate with Prisma User model
- Use middleware for route protection (`/dashboard/*` requires auth)

---

## Decision 2: WebSocket Implementation

**Decision**: Socket.io v4.8+ (both server and client)

**Rationale**:
- **Pros**:
  - Automatic reconnection with exponential backoff (built-in)
  - Fallback to HTTP long-polling if WebSocket unavailable
  - Room-based broadcasting (isolate events per user)
  - Binary data support (efficient for large payloads)
  - Heartbeat mechanism for connection health monitoring
  - Middleware support for authentication
  
- **Cons**:
  - Slightly higher overhead than native WebSocket
  - Requires Socket.io client library (adds ~10KB gzipped)

**Alternatives Considered**:
- **Native WebSocket (ws library)**: Lower overhead but requires manual reconnection, room management, and fallback logic
- **Ably/Pusher**: Third-party services, adds cost and external dependency
- **Server-Sent Events (SSE)**: Unidirectional only, no client-to-server events

**Implementation Notes**:
- Authentication: Verify JWT token in Socket.io middleware before connection handshake
- Event types: `opportunity:new`, `opportunity:update`, `opportunity:expired`, `position:update`, `trade:complete`
- Reconnection config: `reconnectionDelay: 1000`, `reconnectionDelayMax: 30000`, `reconnectionAttempts: Infinity`
- Use Redis adapter for horizontal scaling (deferred to Phase 6, single instance for MVP)
- Emit to user-specific rooms: `socket.to(userId).emit(...)`

---

## Decision 3: API Rate Limiting Strategy

**Decision**: Redis-backed sliding window rate limiter with ioredis

**Rationale**:
- **Pros**:
  - Accurate rate limiting across multiple server instances
  - Sliding window algorithm (more fair than fixed window)
  - Redis already in tech stack (used for distributed locks in FR-034)
  - Sub-millisecond performance
  
- **Cons**:
  - Requires Redis running (adds operational dependency)
  - Slightly more complex than in-memory rate limiting

**Alternatives Considered**:
- **In-memory rate limiter (memory-cache)**: Fast but doesn't work across instances, resets on server restart
- **Database-based rate limiting**: Too slow for high-frequency API calls
- **Upstash Rate Limit**: Serverless option but adds external dependency and cost

**Implementation Notes**:
- Rate limit per user per endpoint: 100 requests/minute for read operations, 10 requests/minute for trade execution
- Use user ID as rate limit key
- Return 429 status with Retry-After header
- Implement exponential backoff on client side when 429 received
- Log rate limit violations to AuditLog for abuse detection (FR-054)

---

## Decision 4: Dual-Exchange Transaction Compensation Pattern

**Decision**: Saga Pattern with Compensating Transactions + Best-Effort Rollback

**Rationale**:
- **Pros**:
  - Handles distributed transaction failures gracefully
  - Clear audit trail of each step (open on Exchange A → open on Exchange B → rollback if needed)
  - Aligns with Constitution's "Transaction Compensation" requirement
  - Supports partial failure scenarios (one exchange succeeds, one fails)
  
- **Cons**:
  - Increased code complexity (state machine for position status)
  - Rollback not guaranteed (exchange may be down during compensation)

**Alternatives Considered**:
- **2-Phase Commit (2PC)**: Not supported by exchange APIs, requires distributed transaction coordinator
- **Manual intervention only**: Violates constitution safety requirements, too risky

**Implementation Notes**:
- Position status flow: `PENDING → OPENING → OPEN | FAILED | PARTIAL`
- Rollback strategy (FR-033):
  1. Immediate retry (0s)
  2. Retry after 1s
  3. Retry after 2s
  4. If all fail: Mark as `PARTIAL`, log to AuditLog, notify user
- Use database transactions to ensure position state consistency
- Store intermediate state before each exchange API call
- Timeout for each exchange operation: 5 seconds (fail fast)

---

## Decision 5: Funding Rate Settlement Tracking

**Decision**: Retrospective API Query (as clarified in spec)

**Rationale**:
- **Pros**:
  - Simpler implementation (no background job to monitor 8-hour cycles)
  - Always accurate (queries real settlement data from exchange)
  - Reduces system complexity and potential bugs
  
- **Cons**:
  - Slight delay when calculating PnL (requires API call to exchange)
  - Dependent on exchange API providing historical funding fee data

**Alternatives Considered**:
- **Real-time tracking**: Background job to record every 8-hour settlement → More complex, prone to missed settlements if system down
- **Estimated calculation**: Calculate based on funding rate history → Inaccurate, exchanges may charge different fees

**Implementation Notes**:
- Binance API: `GET /fapi/v1/income` with `incomeType=FUNDING_FEE`
- OKX API: `GET /api/v5/account/bills` with `type=8` (funding fee)
- Query range: from position `openedAt` to `closedAt` or current time
- Cache results to avoid repeated queries (invalidate on position update)
- Handle API errors gracefully: if query fails, display PnL without funding component + warning message

---

## Decision 6: Load Testing Strategy (SC-006)

**Decision**: k6 (open-source load testing tool)

**Rationale**:
- **Pros**:
  - Native WebSocket support (critical for testing SC-006)
  - JavaScript test scripts (familiar to team)
  - Detailed metrics (latency percentiles, connection success rate)
  - Free and open-source
  - Docker support for CI/CD integration
  
- **Cons**:
  - Requires learning k6-specific API
  - Less feature-rich UI compared to paid tools

**Alternatives Considered**:
- **Artillery**: Good alternative but less precise WebSocket control
- **JMeter**: Java-based, heavier, outdated UI
- **Locust**: Python-based, team more familiar with JS/TS

**Implementation Notes**:
- Test scenario for SC-006:
  - Ramp up to 10 concurrent WebSocket connections
  - Each connection subscribes to opportunity updates
  - Measure message delivery latency (server emit → client receive)
  - Run for 5 minutes minimum
  - Assert: p95 latency < 1000ms, no connection drops
- Store test scripts in `tests/load/`
- Run in CI before merge to main branch (optional: separate load test environment)

---

## Decision 7: Error Handling for Exchange API Failures

**Decision**: Retry with Exponential Backoff + Circuit Breaker

**Rationale**:
- **Pros**:
  - Aligns with Constitution III (Defensive Programming)
  - Handles transient network errors automatically
  - Circuit breaker prevents cascading failures (if exchange is down, stop retrying immediately)
  - Allows system to recover when exchange comes back online
  
- **Cons**:
  - Adds latency for failed requests (up to ~14 seconds for 3 retries)
  - Requires state management for circuit breaker

**Alternatives Considered**:
- **No retry**: Fail immediately → Too brittle, poor user experience
- **Infinite retry**: Can block system indefinitely
- **Fixed interval retry**: Hammers failing service, no backoff relief

**Implementation Notes**:
- Retry configuration (per FR-056):
  - Max attempts: 3
  - Backoff: 1s, 2s, 4s (exponential)
  - Timeout per attempt: 5s
- Circuit breaker thresholds:
  - Open circuit after 5 consecutive failures
  - Half-open state after 30s cooldown
  - Close circuit after 2 consecutive successes
- Use existing libraries: `p-retry` for retry logic, `opossum` for circuit breaker
- Log all retry attempts and circuit state changes to SystemEvent table

---

## Decision 8: Frontend State Management

**Decision**: React Query (TanStack Query) v5

**Rationale**:
- **Pros**:
  - Server state synchronization (auto-refetch, cache invalidation)
  - Optimistic updates for better UX
  - Built-in loading/error states
  - Automatic deduplication of requests
  - SSR support with Next.js
  
- **Cons**:
  - Learning curve for team unfamiliar with React Query
  - Adds ~40KB to bundle size

**Alternatives Considered**:
- **Redux Toolkit**: Over-engineered for this use case, requires more boilerplate
- **Zustand**: Good for client state but lacks server state features (caching, refetching)
- **Native React state + useEffect**: Too much manual work, easy to get wrong

**Implementation Notes**:
- Use for API data fetching (opportunities, positions, trades)
- WebSocket events trigger `queryClient.invalidateQueries()` to refetch data
- Optimistic updates for trade execution (show pending state immediately)
- Configure cache time: 5 minutes for static data, 30 seconds for opportunities
- SSR hydration for initial page load (opportunities list)

---

## Decision 9: Database Connection Pooling

**Decision**: Prisma's built-in connection pool (default config)

**Rationale**:
- **Pros**:
  - Zero additional configuration needed
  - Handles connection lifecycle automatically
  - Sufficient for 10 concurrent users (MVP scale)
  
- **Cons**:
  - Limited control over pool behavior
  - No connection pooling across multiple server instances (requires external pooler like PgBouncer)

**Alternatives Considered**:
- **PgBouncer**: Overkill for MVP scale (10 users), adds operational complexity
- **Custom pool with pg library**: Reinvents Prisma's work

**Implementation Notes**:
- Default pool size: 10 connections (Prisma's default)
- If scaling beyond 10 users, migrate to PgBouncer in transaction mode
- Monitor connection pool metrics via Prisma's built-in logging
- Set connection timeout: 5 seconds

---

## Decision 10: Environment Configuration Management

**Decision**: .env files + Zod validation at startup

**Rationale**:
- **Pros**:
  - Simple for MVP (no external secret management service needed)
  - Zod schema ensures all required env vars are present
  - Type-safe access to config throughout app
  - Fail-fast on missing config (Constitution III: Defensive Programming)
  
- **Cons**:
  - Less secure than HashiCorp Vault or AWS Secrets Manager
  - Manual secret rotation

**Alternatives Considered**:
- **Vault/AWS Secrets Manager**: Over-engineered for 10-user MVP
- **No validation**: Easy to deploy broken config

**Implementation Notes**:
- Required environment variables:
  - `DATABASE_URL`: PostgreSQL connection string
  - `NEXTAUTH_SECRET`: Random 32-byte string for session signing
  - `NEXTAUTH_URL`: Application URL (e.g., `http://localhost:3000`)
  - `ENCRYPTION_MASTER_KEY`: 32-byte AES-256-GCM key for API key encryption (FR-011)
  - `REDIS_URL`: Redis connection string (for rate limiting and locks)
- Validation schema in `src/lib/env.ts` using Zod
- Exit process if validation fails (fail-fast)
- Document all variables in `.env.example`

