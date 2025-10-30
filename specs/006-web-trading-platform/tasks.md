# Implementation Tasks: Web 多用戶套利交易平台

## Overview

**Feature**: Web 多用戶套利交易平台
**Branch**: 006-web-trading-platform
**Total User Stories**: 5 (US1-US5)
**Estimated Duration**: 6 weeks

## Phase 1: Setup & Infrastructure (Week 0)

Goal: Initialize project structure, configure environment, set up database

Tasks:
- [ ] T001 Create Next.js 14 project structure per plan.md project layout
- [ ] T002 [P] Install core dependencies: next@14, react@18, typescript@5.3, prisma@5, socket.io@4, next-auth@5
- [ ] T003 [P] Configure TypeScript (tsconfig.json) for Next.js App Router + strict mode
- [ ] T004 [P] Set up ESLint and Prettier configurations
- [ ] T005 Configure environment variables (.env.example) per quickstart.md: DATABASE_URL, NEXTAUTH_SECRET, ENCRYPTION_MASTER_KEY, REDIS_URL
- [ ] T006 Set up Docker Compose for PostgreSQL 15 + TimescaleDB + Redis 7
- [ ] T007 Initialize Prisma schema with database connection and initial configuration
- [ ] T008 [P] Create src/lib/logger.ts using Pino for structured logging (Constitution Principle II)
- [ ] T009 [P] Create src/lib/encryption.ts with AES-256-GCM utilities for API key encryption
- [ ] T010 [P] Create src/lib/redis.ts for Redis client connection
- [ ] T011 Run Docker Compose to start database and Redis services

## Phase 2: Foundational Services (Week 0)

Goal: Implement cross-cutting concerns needed by all user stories

Tasks:
- [ ] T012 [P] Create Prisma schema for User, ApiKey, Position, Trade, AuditLog entities per data-model.md
- [ ] T013 [P] Create Prisma schema for existing ArbitrageOpportunity, FundingRate entities (if not exist)
- [ ] T014 Run Prisma migration: `prisma migrate dev --name initial_schema`
- [ ] T015 [P] Create src/middleware/correlationIdMiddleware.ts for request tracing
- [ ] T016 [P] Create src/middleware/errorHandler.ts for standardized error responses
- [ ] T017 [P] Create src/types/service-interfaces.ts for common types (ApiResponse, PaginationParams, etc.)
- [ ] T018 [P] Create src/lib/zod-schemas.ts with validation schemas from data-model.md
- [ ] T019 [P] Set up NextAuth.js configuration in app/api/auth/[...nextauth]/route.ts with Credentials Provider
- [ ] T020 Create src/repositories/AuditLogRepository.ts for audit logging (Constitution Principle II)

## Phase 3: User Story 1 - User Registration and API Key Setup (Week 1, Priority: P1)

**Goal**: New users can register, login, and manage API keys
**Independent Test**: Create account → Login → Add Binance API Key → Add OKX API Key → View API key list

### Database & Models (US1)

- [ ] T021 [P] [US1] Create src/models/User.ts with bcrypt password hashing
- [ ] T022 [P] [US1] Create src/models/ApiKey.ts with encryption/decryption methods
- [ ] T023 [P] [US1] Create src/repositories/UserRepository.ts for user CRUD operations
- [ ] T024 [P] [US1] Create src/repositories/ApiKeyRepository.ts for API key CRUD operations

### Services (US1)

- [ ] T025 [US1] Create src/services/auth/AuthService.ts for registration and login logic
- [ ] T026 [US1] Create src/services/auth/SessionManager.ts for NextAuth session handling
- [ ] T027 [P] [US1] Create src/services/apikey/ApiKeyValidator.ts to validate API keys with exchange APIs (FR-010, FR-012)
- [ ] T028 [P] [US1] Create src/connectors/BinanceConnector.ts wrapper for Binance API (if not exist)
- [ ] T029 [P] [US1] Create src/connectors/OkxConnector.ts wrapper for OKX API (if not exist)

### API Routes (US1)

- [ ] T030 [P] [US1] Implement POST /api/auth/register in app/api/auth/register/route.ts per openapi.yaml
- [ ] T031 [P] [US1] Implement POST /api/auth/login via NextAuth credentials provider
- [ ] T032 [P] [US1] Implement GET /api/auth/me in app/api/auth/me/route.ts
- [ ] T033 [P] [US1] Implement GET /api/apikeys in app/api/apikeys/route.ts (list user's API keys)
- [ ] T034 [P] [US1] Implement POST /api/apikeys in app/api/apikeys/route.ts (add new API key with validation)
- [ ] T035 [P] [US1] Implement DELETE /api/apikeys/[id]/route.ts (delete API key)
- [ ] T036 [P] [US1] Implement PATCH /api/apikeys/[id]/route.ts (enable/disable API key)

### Frontend Components (US1)

- [ ] T037 [P] [US1] Create app/(auth)/register/page.tsx for user registration UI
- [ ] T038 [P] [US1] Create app/(auth)/login/page.tsx for user login UI
- [ ] T039 [US1] Create app/(dashboard)/layout.tsx with navigation and logout button
- [ ] T040 [P] [US1] Create app/(dashboard)/settings/api-keys/page.tsx for API key management UI
- [ ] T041 [P] [US1] Create components/ApiKeyForm.tsx for adding Binance/OKX API keys
- [ ] T042 [P] [US1] Create components/ApiKeyList.tsx for displaying API key list (masked keys)

### Testing (US1)

- [ ] T043 [US1] End-to-end test: Complete registration → login → add API keys flow in testnet

## Phase 4: User Story 2 - Real-time Opportunity Monitoring (Week 2, Priority: P2)

**Goal**: Users see real-time arbitrage opportunities via WebSocket
**Independent Test**: Login → Navigate to opportunities page → See live updates (no manual refresh)

### WebSocket Infrastructure (US2)

- [ ] T044 [US2] Create src/lib/socket-server.ts for Socket.io server initialization
- [ ] T045 [US2] Integrate Socket.io server with Next.js in app/api/socket/route.ts or custom server
- [ ] T046 [P] [US2] Create src/services/websocket/ConnectionManager.ts for managing user connections and rooms
- [ ] T047 [P] [US2] Implement JWT authentication on WebSocket handshake per websocket.md

### Opportunity Detection Service (US2)

- [ ] T048 [US2] Refactor existing src/services/monitor/OpportunityDetector.ts to support multi-user broadcasting
- [ ] T049 [US2] Create src/services/notification/WebSocketBroadcaster.ts to push opportunity events
- [ ] T050 [P] [US2] Implement throttling logic (max 1 update/second per opportunity) per FR-022

### API Routes (US2)

- [ ] T051 [P] [US2] Implement GET /api/opportunities in app/api/opportunities/route.ts (REST fallback)

### Frontend Components (US2)

- [ ] T052 [US2] Create hooks/useWebSocket.ts for Socket.io client connection with reconnection logic per clarification #3
- [ ] T053 [P] [US2] Create app/(dashboard)/opportunities/page.tsx for opportunity list UI
- [ ] T054 [P] [US2] Create components/OpportunityCard.tsx to display single opportunity (exchange badges, funding rates)
- [ ] T055 [P] [US2] Create components/ConnectionStatus.tsx to show WebSocket connection state
- [ ] T056 [US2] Integrate React Query for opportunity data caching and optimistic updates

### Testing (US2)

- [ ] T057 [US2] Load test with k6: 10 concurrent WebSocket connections per SC-006
- [ ] T058 [US2] End-to-end test: Login → View opportunities → Verify real-time updates

## Phase 5: User Story 3 - Manual Position Opening (Week 3, Priority: P3)

**Goal**: Users can open arbitrage positions from opportunities
**Independent Test**: Select opportunity → Enter position size → Confirm → See new position in list

### Services (US3)

- [ ] T059 [P] [US3] Create src/services/trading/PositionValidator.ts for balance validation per FR-029 (clarification #1)
- [ ] T060 [P] [US3] Create src/services/trading/TradeOrchestrator.ts for Saga pattern coordination per research.md
- [ ] T061 [US3] Implement src/services/trading/TradeOrchestrator.openPosition() with dual-exchange logic
- [ ] T062 [US3] Implement rollback logic with retry strategy (immediate, 1s, 2s) per clarification #5 and FR-033
- [ ] T063 [P] [US3] Create src/services/trading/DistributedLockService.ts using Redis for concurrent open prevention per FR-034
- [ ] T064 [P] [US3] Create src/repositories/PositionRepository.ts for position CRUD operations

### API Routes (US3)

- [ ] T065 [P] [US3] Implement POST /api/positions in app/api/positions/route.ts per openapi.yaml
- [ ] T066 [P] [US3] Implement GET /api/positions in app/api/positions/route.ts (list user's open positions)

### Frontend Components (US3)

- [ ] T067 [P] [US3] Create app/(dashboard)/positions/page.tsx for position management UI
- [ ] T068 [P] [US3] Create components/OpenPositionDialog.tsx with position size input and confirmation
- [ ] T069 [P] [US3] Add "Open Position" button to OpportunityCard component
- [ ] T070 [US3] Implement button disable logic (5 seconds or completion) per FR-034

### WebSocket Events (US3)

- [ ] T071 [P] [US3] Implement position:update event emission in TradeOrchestrator per websocket.md
- [ ] T072 [P] [US3] Implement position:rollback event for partial failure notifications
- [ ] T073 [P] [US3] Add WebSocket event handlers in frontend for position updates

### Testing (US3)

- [ ] T074 [US3] Testnet test: Open position with Binance testnet + OKX sandbox
- [ ] T075 [US3] Test partial failure scenario: Manually trigger one exchange failure, verify rollback
- [ ] T076 [US3] Test concurrent open prevention: Rapid button clicks should be blocked

## Phase 6: User Story 4 - Manual Position Closing (Week 4, Priority: P4)

**Goal**: Users can close positions and see realized P&L
**Independent Test**: Select open position → Confirm close → See position moved to history with P&L

### Services (US4)

- [ ] T077 [US4] Implement src/services/trading/TradeOrchestrator.closePosition() with dual-exchange logic
- [ ] T078 [P] [US4] Create src/services/trading/PnLCalculator.ts for P&L calculation (price差 + funding rate)
- [ ] T079 [P] [US4] Implement funding rate accumulation query per clarification #1 (retrospective API query)
- [ ] T080 [P] [US4] Create src/repositories/TradeRepository.ts for trade history CRUD operations

### API Routes (US4)

- [ ] T081 [P] [US4] Implement POST /api/positions/[id]/close in app/api/positions/[id]/close/route.ts per openapi.yaml

### Frontend Components (US4)

- [ ] T082 [P] [US4] Create components/ClosePositionDialog.tsx with estimated P&L preview
- [ ] T083 [P] [US4] Add "Close Position" button to position list items
- [ ] T084 [P] [US4] Create components/PositionCard.tsx with real-time unrealized P&L display

### WebSocket Events (US4)

- [ ] T085 [P] [US4] Implement trade:complete event emission in TradeOrchestrator per websocket.md
- [ ] T086 [P] [US4] Add WebSocket event handlers in frontend for trade completion notifications

### Testing (US4)

- [ ] T087 [US4] Testnet test: Complete full cycle (open → hold → close position)
- [ ] T088 [US4] Verify P&L calculation accuracy against exchange records per SC-007

## Phase 7: User Story 5 - Historical Trades and Statistics (Week 5, Priority: P5)

**Goal**: Users can view trade history and performance statistics
**Independent Test**: Navigate to history page → See all closed trades → Filter by date/symbol → View charts

### Services (US5)

- [ ] T089 [P] [US5] Create src/services/analytics/TradeStatsCalculator.ts for statistics computation (total P&L, win rate)
- [ ] T090 [P] [US5] Implement daily P&L aggregation query using TimescaleDB time_bucket

### API Routes (US5)

- [ ] T091 [P] [US5] Implement GET /api/trades in app/api/trades/route.ts with pagination and filters per openapi.yaml
- [ ] T092 [P] [US5] Implement GET /api/trades/stats in app/api/trades/stats/route.ts
- [ ] T093 [P] [US5] Implement CSV export endpoint (optional enhancement)

### Frontend Components (US5)

- [ ] T094 [P] [US5] Create app/(dashboard)/history/page.tsx for trade history UI
- [ ] T095 [P] [US5] Create components/TradeHistoryTable.tsx with pagination and filters
- [ ] T096 [P] [US5] Create components/StatsCard.tsx for displaying summary statistics
- [ ] T097 [P] [US5] Create components/PnLChart.tsx for daily P&L trend visualization (using recharts or similar)

### Testing (US5)

- [ ] T098 [US5] End-to-end test: Verify trade history matches closed positions
- [ ] T099 [US5] Test filtering and pagination with large dataset

## Phase 8: Production Hardening (Week 6)

**Goal**: Prepare for production deployment with security, performance, and monitoring

### Security & Validation (Phase 8)

- [ ] T100 [P] Implement rate limiting middleware using Redis per research.md decision #3
- [ ] T101 [P] Add CSRF protection for all mutation endpoints
- [ ] T102 [P] Implement brute-force protection for login endpoint (5 attempts → 15 min lockout per Risks section)
- [ ] T103 [P] Audit all API endpoints for authentication requirement (use middleware)
- [ ] T104 [P] Review and secure ENCRYPTION_MASTER_KEY handling per clarification #2

### Performance Optimization (Phase 8)

- [ ] T105 [P] Optimize database queries with proper indexes per data-model.md
- [ ] T106 [P] Implement React Query caching strategy for frequently accessed data
- [ ] T107 [P] Add database connection pooling configuration
- [ ] T108 Load test entire system with k6: Verify SC-002 (1s latency), SC-004/SC-005 (5s execution time)

### Monitoring & Observability (Phase 8)

- [ ] T109 [P] Implement health check endpoint GET /api/health per openapi.yaml
- [ ] T110 [P] Add structured logging for all critical operations (Constitution Principle II)
- [ ] T111 [P] Set up error alerting for critical failures (database down, exchange API persistent failures)
- [ ] T112 [P] Create audit log viewer UI for administrators (optional)

### Documentation (Phase 8)

- [ ] T113 [P] Update quickstart.md with any deployment-specific changes
- [ ] T114 [P] Create API documentation from openapi.yaml using Swagger UI or similar
- [ ] T115 [P] Document environment variables and configuration options
- [ ] T116 Final review: Constitution compliance checklist verification

## Dependencies & Execution Strategy

### User Story Completion Order

```
Phase 1 (Setup) → Phase 2 (Foundational)
                      ↓
                    US1 (P1) ← MUST complete first
                      ↓
                    US2 (P2) ← Depends on US1 (needs login + API keys)
                      ↓
                    US3 (P3) ← Depends on US1, US2 (needs opportunities to open)
                      ↓
                    US4 (P4) ← Depends on US3 (needs open positions to close)
                      ↓
                    US5 (P5) ← Depends on US4 (needs closed trades for history)
                      ↓
                 Phase 8 (Hardening)
```

### Parallel Execution Opportunities

**Within US1**: Tasks T021-T042 can be executed in parallel groups:
- Group 1 (Models): T021, T022 in parallel
- Group 2 (Repos): T023, T024 in parallel (after Group 1)
- Group 3 (Services): T025-T029 in parallel (after Group 2)
- Group 4 (Routes): T030-T036 in parallel (after Group 3)
- Group 5 (Frontend): T037-T042 in parallel (after Group 4)

**Within US2**: Tasks T044-T056 can be partially parallelized:
- T046, T047, T050, T051 can run in parallel
- Frontend tasks T053-T056 can run in parallel

**Cross-Phase**: Phase 8 tasks T100-T116 are mostly parallelizable (marked with [P])

### MVP Scope Recommendation

**Minimum Viable Product**: Complete US1 + US2 only
- Rationale: Users can register, manage API keys, and monitor real-time opportunities
- This demonstrates core platform value without trading risk
- Testable in production with real users before implementing actual trading features

**Next Increment**: Add US3 + US4 (complete trading cycle)
**Final Increment**: Add US5 (analytics)

## Task Summary

- **Total Tasks**: 116 tasks
- **Setup Phase**: 11 tasks
- **Foundational Phase**: 9 tasks
- **US1 (P1)**: 23 tasks (registration, login, API key management)
- **US2 (P2)**: 15 tasks (WebSocket, opportunity monitoring)
- **US3 (P3)**: 18 tasks (position opening)
- **US4 (P4)**: 12 tasks (position closing, P&L)
- **US5 (P5)**: 11 tasks (trade history, statistics)
- **Production Hardening**: 17 tasks

- **Parallelizable Tasks**: 72 tasks marked with [P]
- **Sequential Tasks**: 44 tasks (require prior completion)

## Constitution Compliance Checklist

- [x] **Principle I (Trading Safety)**: Saga pattern (T060-T062), balance validation (T059), distributed locks (T063)
- [x] **Principle II (Observability)**: Pino logging (T008), audit logs (T020), traceability (T015)
- [x] **Principle III (Defensive Programming)**: Error handling (T016), WebSocket reconnection (T052), validation (T018)
- [x] **Principle IV (Data Integrity)**: Prisma migrations (T014), TimescaleDB setup (T006), Decimal types (in data-model.md)
- [x] **Principle V (Incremental Delivery)**: US1-US2 as MVP, testnet testing (T074, T087), independent story testing

**Deviation**: Stop-loss enforcement deferred to future phase (documented in plan.md Complexity Tracking)
