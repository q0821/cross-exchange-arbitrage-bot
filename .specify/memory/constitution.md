<!--
Sync Impact Report - Constitution v1.2.0
Created: 2025-10-19
Last Updated: 2025-12-23

Changes in v1.2.0:
- Added Principle VII: Test-Driven Development (TDD) Discipline (NON-NEGOTIABLE)
  - Mandates strict Red-Green-Refactor cycle
  - Prohibits writing production code without tests first
  - Requires test failure verification before implementation
  - Establishes TDD execution flow for all implementations
- Templates requiring updates:
  ✅ plan-template.md - already has Constitution Check section
  ✅ spec-template.md - no changes needed
  ✅ tasks-template.md - already mentions "tests MUST be written and FAIL before implementation"
- Follow-up TODOs: None

Changes in v1.1.0:
- Added Principle VI: System Architecture Boundaries
  - Defines CLI vs Web responsibility separation
  - Establishes data flow pattern (CLI → DB → Web)
  - Enforces single source of truth (Database)
  - Prevents security issues (API keys only in CLI)
- Templates requiring updates:
  ✅ plan-template.md - no changes needed (architecture boundaries are feature-specific)
  ✅ spec-template.md - no changes needed (specs should follow Principle VI)
  ✅ tasks-template.md - no changes needed (tasks should respect boundaries)
- Follow-up TODOs: None

Changes in v1.0.0 (Initial):
- Initial constitution established (from template)
- Added 5 core principles for trading platform
- Added Trading Safety section
- Added Development Workflow section
-->

# Cross-Exchange Arbitrage Bot Constitution

## Core Principles

### I. Trading Safety First (NON-NEGOTIABLE)

**MUST** requirements for any code that executes real trades or manages positions:

- All trade execution MUST implement transaction compensation (Saga pattern or equivalent)
- Dual-exchange operations MUST be atomic or have automatic rollback on single-side failure
- Balance validation MUST occur before any order placement
- Position state MUST be persisted before execution and updated atomically after completion
- No trade execution without explicit user confirmation (manual mode) or validated trigger conditions (auto mode)

**Rationale**: This platform manages real funds. A single bug in trade execution can result in unhedged exposure or capital loss. Safety mechanisms are not optional.

### II. Complete Observability (NON-NEGOTIABLE)

**MUST** requirements for logging and monitoring:

- All critical operations (trades, position changes, API calls) MUST be logged with structured context
- Error logs MUST include: error type, exchange name, symbol, timestamp, stack trace, and remediation hint
- Trade lifecycle MUST be fully traceable: opportunity detection → execution → settlement → P&L
- Performance metrics MUST be captured: API latency, execution time, funding rate update frequency
- Use Pino structured logging exclusively (no console.log in production code)

**Rationale**: When trades fail or unexpected behavior occurs, we need complete audit trails for debugging and compliance.

### III. Defensive Programming

**MUST** requirements for error handling and resilience:

- All external API calls MUST have retry logic with exponential backoff
- Network errors, rate limits, and timeouts MUST be handled gracefully
- WebSocket disconnections MUST trigger automatic reconnection
- Invalid data from exchanges MUST be rejected with validation errors (use Zod schemas)
- System MUST degrade gracefully: if one exchange is down, continue monitoring the other

**SHOULD** guidelines:

- Prefer fail-fast for configuration errors (startup validation)
- Prefer fail-safe for runtime errors (log and continue monitoring)

**Rationale**: Exchanges have variable reliability. The system must operate continuously even when individual services fail.

### IV. Data Integrity

**MUST** requirements for data management:

- Database schema changes MUST use Prisma migrations (no manual schema edits)
- Time-series data (funding rates) MUST use TimescaleDB hypertables for efficient queries
- Funding rate records MUST be immutable once created (append-only)
- Position records MUST capture state transitions (PENDING → OPEN → CLOSED)
- Financial calculations MUST use `Decimal` type (never JavaScript `Number` for money)

**Rationale**: Incorrect data can lead to wrong trading decisions. Financial precision and audit trails are critical.

### V. Incremental Delivery

**MUST** requirements for development workflow:

- MVP scope: User Story 1 (monitoring) + User Story 2 (detection) MUST be completed before trading features
- Each User Story MUST be independently testable before integration
- Trading features (US3-US5) MUST be tested in testnet/sandbox environments before mainnet
- No feature deployment without successful end-to-end testing in test environment

**Rationale**: Trading platforms require thorough validation. Rushing to production without proper testing risks capital.

### VI. System Architecture Boundaries

**MUST** requirements for CLI vs Web separation:

- **CLI Responsibilities**:
  - Background monitoring (funding rates, prices, arbitrage opportunities)
  - Data collection and calculation (validation, assessment, metrics)
  - Writing results to database (opportunities, validations, price data)
  - Logging and error tracking
  - NO complex UI display (simple status logs only)

- **Web Responsibilities**:
  - Query database for display (arbitrage opportunities, historical data)
  - Real-time updates via WebSocket (price tickers, funding rate changes)
  - User interactions (manual trading, configuration)
  - Data visualization (charts, tables, dashboards)
  - NO business logic or calculations (read-only data consumption)

**Data Flow Pattern**:

```
CLI Monitor → Database (Single Source of Truth) → Web API → Web UI
     ↓                      ↑                          ↓
  Connectors          Prisma ORM                 WebSocket Server
     ↓                      ↑                          ↓
Exchange APIs         TimescaleDB                 React Client
```

**MUST** requirements for data flow:

- CLI MUST write all calculated results to database (no direct CLI-to-Web communication)
- Web MUST read from database only (no direct exchange API calls from Web)
- WebSocket updates MUST be triggered by database changes or scheduled polling
- Database is the single source of truth for all application state
- API keys and credentials MUST only exist in CLI environment (never exposed to Web)

**SHOULD** guidelines:

- Prefer database triggers or event emitters for real-time Web updates
- Prefer REST API for historical data queries
- Prefer WebSocket for live price/rate streaming
- Cache frequently accessed data in Web backend (with TTL)

**Rationale**: Clear separation of concerns prevents complexity creep. CLI focuses on reliable data collection, Web focuses on user experience. Database acts as the contract between both systems, enabling independent development and scaling.

### VII. Test-Driven Development (TDD) Discipline (NON-NEGOTIABLE)

**MUST** requirements for all implementation work:

- All production code MUST be written using strict TDD workflow
- Tests MUST be written BEFORE any production code
- Tests MUST be run and verified to FAIL before implementing production code
- Only the minimum code necessary to pass the test MUST be written
- Refactoring MUST only occur after tests pass (never during Red or Green phases)

**TDD Execution Flow** (MUST follow in order):

1. **🔴 Red Phase - Write Failing Test First**
   - Write a single test case for the expected behavior
   - Run the test and verify it FAILS
   - The test failure message MUST clearly indicate what is missing
   - DO NOT proceed to Green phase until test failure is verified

2. **🟢 Green Phase - Minimal Implementation**
   - Write the MINIMUM code to make the test pass
   - DO NOT add extra functionality, optimizations, or "nice-to-haves"
   - Run the test and verify it PASSES
   - DO NOT proceed to Refactor phase until test passes

3. **🔵 Refactor Phase - Improve Code Quality**
   - Improve code structure, naming, and clarity
   - Run ALL tests after each refactoring step
   - If any test fails, revert the refactoring change
   - Only proceed to next test cycle when all tests pass

**TDD Prohibitions**:

- ❌ Writing production code without a failing test first
- ❌ Writing more than one failing test at a time
- ❌ Writing more code than necessary to pass the current test
- ❌ Skipping the Red phase ("I know this will work")
- ❌ Skipping the Refactor phase due to time pressure
- ❌ Mocking everything - prefer integration tests where feasible

**SHOULD** guidelines:

- Prefer small, focused tests over large, complex ones
- Prefer testing behavior over implementation details
- Prefer real dependencies over mocks when performance allows
- Name tests using Given-When-Then or Arrange-Act-Assert patterns

**Rationale**: TDD ensures code quality, prevents regression bugs, and forces thoughtful API design. In a trading system where bugs can cause financial losses, TDD discipline is not optional - it is a safety mechanism. Writing tests first guarantees that every piece of production code has corresponding test coverage.

## Trading Safety Requirements

### Position Management

- **Maximum Position Size**: Single position MUST NOT exceed user-configured limit (default: 10,000 USDT)
- **Total Exposure Limit**: Sum of all open positions MUST NOT exceed user-configured cap
- **Stop-Loss Enforcement**: All positions MUST have stop-loss triggers to prevent unlimited losses
- **Slippage Protection**: Orders MUST be rejected if expected slippage exceeds threshold (default: 0.5%)

### Risk Controls

- **Pre-Trade Validation Checklist**:
  1. Sufficient balance on both exchanges
  2. Position size within limits
  3. Funding rate spread still valid (not expired)
  4. Market liquidity sufficient (check order book depth)

- **Post-Trade Validation**:
  1. Both orders filled successfully
  2. Actual execution prices within expected range
  3. Position records created in database
  4. Margin requirements satisfied

### Emergency Procedures

- **Manual Override**: CLI commands MUST allow emergency position closure regardless of strategy rules
- **Circuit Breaker**: System MUST pause auto-trading if error rate exceeds threshold (default: 3 failures in 5 minutes)
- **Notification Escalation**: Critical errors MUST trigger immediate Telegram alerts

## Development Workflow

### Code Organization

- **Directory Structure**: Follow plan.md specification
  - Core business logic: `src/services/`
  - Exchange adapters: `src/connectors/`
  - Data models: `src/models/`
  - Utilities: `src/lib/`

- **Naming Conventions**:
  - Files: camelCase (e.g., `fundingRateMonitor.ts`)
  - Classes: PascalCase (e.g., `class FundingRateMonitor`)
  - Constants: UPPER_SNAKE_CASE (e.g., `MAX_RETRY_ATTEMPTS`)

### Testing Requirements

- **Unit Tests**: MUST cover all business logic in `src/services/`
- **Integration Tests**: MUST test exchange connector interactions with mocked APIs
- **E2E Tests**: MUST validate complete trade flows in testnet
- **Coverage Target**: 85% minimum (enforced by CI)

### Quality Gates

Before merging to main branch:

1. ✅ All tests passing
2. ✅ No TypeScript errors
3. ✅ ESLint checks passing
4. ✅ Build succeeds
5. ✅ Constitution compliance verified

### Configuration Management

- **Environment-Specific Config**:
  - Development: `.env` (not committed)
  - Production: Environment variables or secret management

- **Sensitive Data**:
  - API keys MUST NEVER be committed to git
  - Use `.env.example` for documentation

- **Feature Flags**:
  - Auto-trading MUST be disabled by default
  - Testnet mode MUST be explicitly configurable

## Governance

### Amendment Process

1. Propose change via GitHub issue with rationale
2. Discuss impact on existing code and workflows
3. Update constitution with semantic version bump:
   - **MAJOR**: Backward-incompatible principle changes (e.g., removing safety requirement)
   - **MINOR**: New principle added or existing principle expanded
   - **PATCH**: Clarifications, typo fixes, non-semantic updates
4. Update dependent templates and documentation
5. Commit with message: `docs: amend constitution to v[X.Y.Z] ([change summary])`

### Compliance Verification

- All code reviews MUST verify adherence to Core Principles
- Pull requests touching trade execution MUST be reviewed by 2+ developers
- Constitution violations MUST be justified in writing or code must be revised
- Complexity additions (new patterns, abstractions) MUST be justified against Principle V (Incremental Delivery)

### Living Document

- This constitution evolves with the project
- Principles should be challenged if they block necessary improvements
- But convenience is not sufficient justification for weakening safety (Principle I)

**Version**: 1.2.0 | **Ratified**: 2025-10-19 | **Last Amended**: 2025-12-23
