# Quickstart: Simulated APY Tracking

## Overview

This feature allows users to simulate arbitrage returns by tracking opportunities without risking real capital. The system records snapshots at each funding rate settlement time and calculates cumulative simulated profits.

## Key Concepts

### What is Simulated Tracking?

1. **User selects an opportunity** from Market Monitor (e.g., BTC: Long Binance, Short OKX)
2. **User enters simulated capital** (e.g., 10,000 USDT)
3. **System records snapshots** at each funding settlement (every 1h, 4h, or 8h depending on exchange)
4. **Simulated profit accumulates** based on actual funding rates

### Profit Calculation

```
Per Settlement Profit = Capital × (Short Rate - Long Rate)

Example with 10,000 USDT:
- Long Rate (Binance): -0.0012 (negative = you receive)
- Short Rate (OKX): +0.0058 (positive = you receive)
- Settlement Profit = 10,000 × (0.0058 - (-0.0012))
                    = 10,000 × 0.0070
                    = 70 USDT
```

## User Workflows

### Starting a Tracking

1. Navigate to **Market Monitor**
2. Find an opportunity with high APY
3. Click the **Track** button on the row
4. Enter your simulated capital (default: 10,000 USDT)
5. Choose auto-stop preference (default: stop when APY drops below 800%)
6. Click **Start Tracking**

### Viewing Trackings

1. Navigate to **Simulated Tracking** page from sidebar
2. View all active trackings with current profit
3. Click any tracking to see detailed snapshot history

### Stopping a Tracking

1. From the tracking list or detail page
2. Click **Stop Tracking**
3. View final statistics and total profit

## Limitations

| Limit | Value |
|-------|-------|
| Max active trackings per user | 5 |
| Data retention | 30 days after stop |
| Min simulated capital | 100 USDT |
| Max simulated capital | 1,000,000 USDT |

## Technical Notes

### Snapshot Recording

- **Settlement snapshots**: Recorded when funding rates settle (hourly for most exchanges)
- **Timing tolerance**: ±2 minutes from exact settlement time
- **Rate source**: Same data as Market Monitor display

### Data Accuracy

- Uses **Decimal** type for all financial calculations (no floating-point errors)
- Rates captured at settlement time, not averaged
- Prices optional (may be unavailable for some exchanges)

## Example Usage

### Scenario: Testing BTC Arbitrage

1. You see BTCUSDT showing 850% APY (Long Binance, Short OKX)
2. You want to test if this opportunity is stable over 24 hours
3. Start tracking with 10,000 USDT simulated capital
4. After 24 hours, you've recorded 3 settlements (8-hour intervals)
5. Total simulated profit: 210 USDT (70 USDT per settlement)
6. You decide to open a real position based on the stable performance

### Scenario: Comparing Opportunities

1. Track multiple opportunities simultaneously (up to 5)
2. Compare actual performance over the same time period
3. Identify which pairs have the most consistent spreads
4. Stop underperformers, keep tracking winners

## API Quick Reference

| Action | Endpoint | Method |
|--------|----------|--------|
| Start tracking | `/api/simulated-tracking` | POST |
| List trackings | `/api/simulated-tracking` | GET |
| Get detail | `/api/simulated-tracking/{id}` | GET |
| Stop tracking | `/api/simulated-tracking/{id}/stop` | POST |
| Get snapshots | `/api/simulated-tracking/{id}/snapshots` | GET |
| Delete | `/api/simulated-tracking/{id}` | DELETE |

See [API Contracts](./contracts/api.md) for full specification.
