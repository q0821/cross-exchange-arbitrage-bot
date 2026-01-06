# Data Model: 通知價差過濾

**Feature**: 057-notification-price-filter
**Date**: 2026-01-06

## Entity Changes

### 1. NotificationWebhook (Database)

**Location**: `prisma/schema.prisma` (line ~330)

**New Field**:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `requireFavorablePrice` | Boolean | `false` | 是否啟用價差過濾 |

**Prisma Schema Addition**:

```prisma
model NotificationWebhook {
  // ... existing fields ...

  requireFavorablePrice Boolean @default(false)  // Feature 057
}
```

**Migration Name**: `add_require_favorable_price_to_webhook`

---

### 2. BestArbitragePair (TypeScript Interface)

**Location**: `src/models/FundingRate.ts` (line ~172)

**New Field**:

| Field | Type | Optional | Description |
|-------|------|----------|-------------|
| `isPriceDirectionCorrect` | boolean | Yes | 價差方向是否正確（空方 >= 多方，或在容忍範圍內） |

**Updated Interface**:

```typescript
export interface BestArbitragePair {
  longExchange: ExchangeName;
  shortExchange: ExchangeName;
  spreadPercent: number;
  spreadAnnualized: number;
  priceDiffPercent?: number;
  netReturn?: number;
  isPriceDirectionCorrect?: boolean;  // Feature 057: NEW
}
```

---

### 3. WebhookConfig (TypeScript Interface)

**Location**: `src/services/notification/types.ts`

**New Field**:

| Field | Type | Description |
|-------|------|-------------|
| `requireFavorablePrice` | boolean | 是否啟用價差過濾 |

**Updated Interface**:

```typescript
export interface WebhookConfig {
  id: string;
  userId: string;
  platform: NotificationPlatform;
  webhookUrl: string;
  name: string;
  isEnabled: boolean;
  threshold: number;
  notifyOnDisappear: boolean;
  notificationMinutes: number[];
  requireFavorablePrice: boolean;  // Feature 057: NEW
}
```

---

## Validation Rules

### requireFavorablePrice

- **Type**: Boolean
- **Required**: No (has default)
- **Default**: `false`
- **Validation**: N/A (boolean toggle)

### isPriceDirectionCorrect

- **Calculated from**: `(shortPrice - longPrice) / shortPrice >= -0.0005`
- **When undefined**: Treated as `true` (backward compatible)
- **Set in**: `createMultiExchangeFundingRatePair()` function

---

## State Transitions

N/A - 此功能不涉及狀態機。`requireFavorablePrice` 是簡單的 Boolean 開關。

---

## Data Flow

```
User toggles "requireFavorablePrice" in UI
    ↓
API PATCH /api/notifications/webhooks/[id]
    ↓
NotificationWebhookRepository.update()
    ↓
Prisma updates database
    ↓
NotificationService.checkAndNotify() reads webhook config
    ↓
passesPriceFilter() checks:
    - bestPair.netReturn > 0?
    - bestPair.isPriceDirectionCorrect === true?
    ↓
If both true OR requireFavorablePrice is false → Send notification
If either false AND requireFavorablePrice is true → Skip notification
```

---

## Migration Strategy

1. Create migration with `@default(false)`
2. No data backfill needed (existing webhooks get default value)
3. Zero downtime deployment
