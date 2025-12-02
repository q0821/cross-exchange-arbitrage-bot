# Implementation Plan: Simulated APY Tracking

**Branch**: `029-simulated-apy-tracking` | **Date**: 2025-12-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/029-simulated-apy-tracking/spec.md`

## Summary

This feature enables users to manually track arbitrage opportunities by simulating returns over time. Users click "Track" on any opportunity in Market Monitor, enter simulated capital, and the system records snapshots at each funding rate settlement. Data is retained for 30 days with a maximum of 5 active trackings per user.

## Technical Context

**Language/Version**: TypeScript 5.6 + Node.js 20.x LTS
**Primary Dependencies**: Next.js 14 (App Router), React 18, Prisma 5.x, Socket.io 4.8.1, Tailwind CSS
**Storage**: PostgreSQL 15 + TimescaleDB (existing infrastructure)
**Testing**: Vitest for unit tests, integration tests with test database
**Target Platform**: Web application (browser)
**Project Type**: Web (Next.js full-stack)
**Performance Goals**: Snapshot recording within 2 minutes of settlement time
**Constraints**: Maximum 5 active trackings per user, 30-day data retention
**Scale/Scope**: Per-user feature, bounded by tracking limits

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Trading Safety First | N/A | This is simulation only, no real trades |
| II. Complete Observability | PASS | Will use Pino logging for all operations |
| III. Defensive Programming | PASS | Will handle API errors gracefully, skip failed snapshots |
| IV. Data Integrity | PASS | Using Prisma migrations, Decimal for financial data |
| V. Incremental Delivery | PASS | 6 user stories prioritized P1/P2/P3 for incremental release |
| VI. System Architecture Boundaries | PASS | Web reads from DB, CLI/background service writes snapshots |

**Gate Status**: PASSED - All applicable principles satisfied.

## Project Structure

### Documentation (this feature)

```
specs/029-simulated-apy-tracking/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (API specs)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```
# Web application structure (Next.js App Router)
app/
├── (dashboard)/
│   ├── market-monitor/
│   │   └── components/
│   │       ├── TrackButton.tsx          # NEW: Track button for table rows
│   │       └── StartTrackingDialog.tsx  # NEW: Dialog for entering capital
│   └── simulated-tracking/              # NEW: Dedicated tracking page
│       ├── page.tsx                     # Tracking list page
│       ├── [id]/
│       │   └── page.tsx                 # Tracking detail page
│       └── components/
│           ├── ActiveTrackingCard.tsx
│           ├── TrackingHistoryTable.tsx
│           └── SnapshotTimeline.tsx
├── api/
│   └── simulated-tracking/              # NEW: API routes
│       ├── route.ts                     # POST (create), GET (list)
│       ├── [id]/
│       │   ├── route.ts                 # GET (detail), DELETE
│       │   ├── stop/
│       │   │   └── route.ts             # POST (stop tracking)
│       │   └── snapshots/
│       │       └── route.ts             # GET (list snapshots)

src/
├── models/
│   └── SimulatedTracking.ts             # NEW: Zod schemas
├── repositories/
│   ├── SimulatedTrackingRepository.ts   # NEW
│   └── TrackingSnapshotRepository.ts    # NEW
├── services/
│   └── tracking/
│       ├── SimulatedTrackingService.ts  # NEW: Core business logic
│       └── index.ts
└── jobs/
    └── cleanupExpiredTrackings.ts       # NEW: 30-day cleanup

prisma/
└── schema.prisma                        # ADD: SimulatedTracking, TrackingSnapshot models

tests/
├── unit/
│   └── services/
│       └── SimulatedTrackingService.test.ts
└── integration/
    └── simulated-tracking.test.ts
```

**Structure Decision**: Using existing Next.js App Router structure. New tracking feature follows established patterns from notification webhooks (Feature 026) and opportunity history (Feature 027).

## Complexity Tracking

No constitution violations requiring justification. Feature uses established patterns.
