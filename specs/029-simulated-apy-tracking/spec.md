# Feature Specification: Simulated APY Tracking

**Feature Branch**: `029-simulated-apy-tracking`
**Created**: 2025-12-02
**Status**: Draft
**Input**: User description: "記錄模擬的套利 APY - 讓用戶手動標記追蹤套利機會，系統在每次資金費率結算時記錄快照，計算模擬收益。資料保留30天，每用戶最多5個活躍追蹤。"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Start Tracking an Arbitrage Opportunity (Priority: P1)

As a user viewing the Market Monitor, I want to click a "Track" button on any arbitrage opportunity row to start simulating returns, so I can evaluate the opportunity's performance over time without risking real capital.

**Why this priority**: This is the core entry point for the entire feature. Without the ability to start tracking, no other functionality can work.

**Independent Test**: Can be fully tested by clicking "Track" on a row, entering simulated capital, and verifying the tracking is created and visible in the tracking list.

**Acceptance Scenarios**:

1. **Given** I am logged in and viewing Market Monitor, **When** I click "Track" on an opportunity row, **Then** a dialog opens asking for simulated capital amount
2. **Given** the tracking dialog is open, **When** I enter 10000 USDT and confirm, **Then** the tracking starts and the button changes to "Tracking"
3. **Given** I already have 5 active trackings, **When** I try to start a 6th, **Then** I see an error message about the limit

---

### User Story 2 - View Active Trackings and Cumulative Returns (Priority: P1)

As a user with active trackings, I want to view all my tracked opportunities on a dedicated page showing current APY, cumulative simulated profit, and settlement count, so I can monitor performance at a glance.

**Why this priority**: Users need to see the results of their trackings. This delivers the core value proposition of the feature.

**Independent Test**: Can be tested by navigating to the tracking page and verifying all active trackings display current statistics.

**Acceptance Scenarios**:

1. **Given** I have active trackings, **When** I navigate to the Simulated Tracking page, **Then** I see a list of all active trackings with current APY and profit
2. **Given** a tracking has had 3 funding settlements, **When** I view the tracking, **Then** I see the cumulative profit calculated from those settlements
3. **Given** I have no active trackings, **When** I visit the page, **Then** I see an empty state with guidance to start tracking

---

### User Story 3 - Record Settlement Snapshots Automatically (Priority: P1)

As a user with active trackings, I want the system to automatically record a snapshot at each funding rate settlement time, so I have accurate historical data of returns.

**Why this priority**: This is the data engine that powers the feature. Without automatic snapshots, the tracking has no value.

**Independent Test**: Can be tested by creating a tracking and verifying snapshots are recorded at the next hourly settlement time.

**Acceptance Scenarios**:

1. **Given** I have an active tracking for BTC with 8h settlement interval, **When** the hourly settlement occurs, **Then** a snapshot is recorded with current rates and calculated profit
2. **Given** a settlement occurs, **When** the snapshot is recorded, **Then** it includes: long rate, short rate, spread, APY, and simulated profit amount
3. **Given** both exchanges have different settlement times, **When** each settles, **Then** snapshots are recorded for each settlement independently

---

### User Story 4 - Stop Tracking Manually (Priority: P2)

As a user, I want to stop tracking an opportunity at any time, so I can close out the simulation and see final results.

**Why this priority**: Users need control over their trackings. This is essential for a complete user experience but not critical for MVP value.

**Independent Test**: Can be tested by stopping an active tracking and verifying it moves to history with final statistics.

**Acceptance Scenarios**:

1. **Given** I have an active tracking, **When** I click "Stop Tracking", **Then** the tracking stops and records final statistics
2. **Given** I stop a tracking, **When** I view tracking history, **Then** I see the stopped tracking with total duration and final profit

---

### User Story 5 - View Tracking History and Details (Priority: P2)

As a user, I want to view detailed history of a tracking including all settlement snapshots, so I can analyze performance over time.

**Why this priority**: Provides deeper insights but users can derive value from aggregate statistics alone.

**Independent Test**: Can be tested by clicking into a tracking detail page and verifying snapshot history is displayed.

**Acceptance Scenarios**:

1. **Given** I click on a tracking, **When** the detail page loads, **Then** I see a timeline of all settlement snapshots
2. **Given** a tracking has 10 snapshots, **When** I view details, **Then** I can see each snapshot's APY, spread, and profit

---

### User Story 6 - Auto-Stop When Opportunity Disappears (Priority: P3)

As a user, I want to choose whether my tracking auto-stops when the opportunity drops below the APY threshold, so I can control how long my simulations run.

**Why this priority**: Nice-to-have control option. Most users will benefit from reasonable default behavior.

**Independent Test**: Can be tested by setting auto-stop preference and verifying behavior when APY drops below threshold.

**Acceptance Scenarios**:

1. **Given** I enable auto-stop when starting a tracking, **When** APY drops below 800%, **Then** the tracking stops automatically with status "EXPIRED"
2. **Given** I disable auto-stop, **When** APY drops below threshold, **Then** the tracking continues recording snapshots

---

### Edge Cases

- What happens when a user deletes their account? All trackings and snapshots are deleted (cascade)
- How does system handle network errors during snapshot recording? Retry once, skip if still failing
- What happens to trackings older than 30 days? Automatically cleaned up by scheduled job
- What if an exchange rate is temporarily unavailable? Skip snapshot for that settlement, continue on next
- What happens if user tracks the same opportunity twice? Prevent duplicate active trackings for same symbol/exchange pair

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow logged-in users to start tracking any arbitrage opportunity from Market Monitor
- **FR-002**: System MUST require users to specify simulated capital amount (in USDT) when starting a tracking
- **FR-003**: System MUST limit each user to maximum 5 active trackings simultaneously
- **FR-004**: System MUST prevent duplicate active trackings for the same symbol and exchange pair
- **FR-005**: System MUST record a snapshot at each funding rate settlement time for active trackings
- **FR-006**: System MUST calculate simulated profit based on user's capital and current funding rates
- **FR-007**: System MUST allow users to stop any active tracking at any time
- **FR-008**: System MUST allow users to choose whether tracking auto-stops when APY drops below threshold
- **FR-009**: System MUST display tracking status on Market Monitor rows (tracked/not tracked)
- **FR-010**: System MUST provide a dedicated page listing all active and historical trackings
- **FR-011**: System MUST provide a detail page showing all snapshots for a specific tracking
- **FR-012**: System MUST retain tracking data for 30 days after tracking stops
- **FR-013**: System MUST automatically clean up expired tracking data (older than 30 days)

### Key Entities

- **SimulatedTracking**: Represents a user's tracking of an arbitrage opportunity, including symbol, exchanges, simulated capital, start/stop times, cumulative statistics, and user preferences
- **TrackingSnapshot**: A point-in-time record during tracking, capturing rates, spread, APY, prices, and calculated profit at each settlement

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can start tracking an opportunity within 10 seconds (3 clicks: Track button -> enter amount -> confirm)
- **SC-002**: Settlement snapshots are recorded within 2 minutes of actual settlement time
- **SC-003**: Users can view all active trackings and their current status on a single page
- **SC-004**: Cumulative profit calculations match manual calculation within 0.01% tolerance
- **SC-005**: Data cleanup runs automatically, keeping storage growth bounded to 30-day window
- **SC-006**: 95% of users can find and use the tracking feature without documentation

## Assumptions

- Users are already authenticated (existing auth system)
- Market Monitor already displays arbitrage opportunities with real-time data
- Settlement times are determinable from exchange APIs (existing functionality)
- System has access to current funding rates at settlement time (existing RatesCache)
