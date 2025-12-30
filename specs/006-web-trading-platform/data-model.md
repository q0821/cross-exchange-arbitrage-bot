# Data Model

## Overview

The data model extends the existing Prisma schema to support multi-user web platform functionality while maintaining compatibility with the existing CLI monitoring system. The schema follows Constitution requirements for data integrity: TimescaleDB for time-series data, Decimal types for financial calculations, and immutable funding rate records.

## Core Entities

### User

Represents a platform user with email/password authentication.

**Prisma Schema**:
```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique @db.VarChar(255)
  password  String   @db.VarChar(255) // bcrypt hashed
  createdAt DateTime @default(now()) @db.Timestamptz
  updatedAt DateTime @updatedAt @db.Timestamptz

  // Relations
  apiKeys    ApiKey[]
  positions  Position[]
  trades     Trade[]
  auditLogs  AuditLog[]

  @@index([email])
  @@map("users")
}
```

**Validation Rules**:
- `email`: Must match RFC 5322 format (use Zod: `z.string().email()`)
- `password`: Min 8 characters, at least one digit and one letter (validated before bcrypt hashing)
- `password` storage: bcrypt with salt rounds = 12

**Maps to User Stories**: US1 (registration and login)

---

### ApiKey

Stores encrypted API credentials for Binance and OKX exchanges per user.

**Prisma Schema**:
```prisma
model ApiKey {
  id                  String         @id @default(cuid())
  userId              String
  exchange            String         @db.VarChar(50) // "binance" | "okx"
  environment         ApiEnvironment @default(MAINNET)
  label               String         @db.VarChar(100)
  encryptedKey        String         @db.Text
  encryptedSecret     String         @db.Text
  encryptedPassphrase String?        @db.Text // OKX only
  isActive            Boolean        @default(true)
  lastValidatedAt     DateTime?      @db.Timestamptz
  createdAt           DateTime       @default(now()) @db.Timestamptz
  updatedAt           DateTime       @updatedAt @db.Timestamptz

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, exchange, label])
  @@index([userId, isActive])
  @@index([exchange])
  @@map("api_keys")
}

enum ApiEnvironment {
  MAINNET
  TESTNET
}
```

**Validation Rules**:
- `encryptedKey`, `encryptedSecret`, `encryptedPassphrase`: AES-256-GCM encrypted with master key from env var
- `label`: User-defined nickname for API key (e.g., "My Trading Account")
- `environment`: Default MAINNET, support TESTNET for testing
- Before saving: Call exchange API to verify credentials (FR-010)
- Check permissions: Must have read + trade permissions (FR-012)

**Encryption Details** (FR-011):
- Algorithm: AES-256-GCM
- Master key: 32-byte key from `process.env.ENCRYPTION_MASTER_KEY`
- IV (Initialization Vector): Random 16-byte per encryption, stored with ciphertext
- Format: `{iv}:{authTag}:{ciphertext}` (base64 encoded)

**Maps to User Stories**: US1 (API Key management)

---

### Position

Tracks user's open arbitrage positions across two exchanges.

**Prisma Schema**:
```prisma
model Position {
  id                   String            @id @default(cuid())
  userId               String
  symbol               String            @db.VarChar(20)
  longExchange         String            @db.VarChar(50)
  longOrderId          String?           @db.VarChar(100)
  longEntryPrice       Decimal           @db.Decimal(18, 8)
  longPositionSize     Decimal           @db.Decimal(18, 8)
  longLeverage         Int               @default(3)
  shortExchange        String            @db.VarChar(50)
  shortOrderId         String?           @db.VarChar(100)
  shortEntryPrice      Decimal           @db.Decimal(18, 8)
  shortPositionSize    Decimal           @db.Decimal(18, 8)
  shortLeverage        Int               @default(3)
  status               PositionWebStatus @default(PENDING)
  openFundingRateLong  Decimal           @db.Decimal(10, 8)
  openFundingRateShort Decimal           @db.Decimal(10, 8)
  unrealizedPnL        Decimal?          @db.Decimal(18, 8)
  openedAt             DateTime?         @db.Timestamptz
  closedAt             DateTime?         @db.Timestamptz
  failureReason        String?           @db.Text
  createdAt            DateTime          @default(now()) @db.Timestamptz
  updatedAt            DateTime          @updatedAt @db.Timestamptz

  user  User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  trade Trade?

  @@index([userId, status])
  @@index([symbol, status])
  @@index([createdAt(sort: Desc)])
  @@map("positions")
}

enum PositionWebStatus {
  PENDING
  OPENING
  OPEN
  CLOSING
  CLOSED
  FAILED
  PARTIAL
}
```

**Status Transitions** (State Machine):
```
PENDING → OPENING → OPEN → CLOSING → CLOSED
              ↓        ↓        ↓
           FAILED   PARTIAL  PARTIAL
```

**Validation Rules**:
- `longPositionSize` and `shortPositionSize`: Must be equal (hedge position)
- `longLeverage` and `shortLeverage`: Fixed at 3x for MVP (as per assumptions)
- `unrealizedPnL`: Calculated on-demand, cached in DB for performance
- Before creating: Verify user has sufficient balance on both exchanges (FR-029)

**Calculations**:
- Unrealized PnL (FR-037):
  ```typescript
  const priceDiff = (currentLongPrice - longEntryPrice) * longPositionSize 
                  - (currentShortPrice - shortEntryPrice) * shortPositionSize;
  const fundingPnL = await getFundingFeesFromExchange(openedAt, now);
  const unrealizedPnL = priceDiff + fundingPnL;
  ```

**Maps to User Stories**: US3 (open position), US4 (view positions)

---

### Trade

Records completed (closed) arbitrage trades with full P&L breakdown.

**Prisma Schema**:
```prisma
model Trade {
  id                  String         @id @default(cuid())
  userId              String
  positionId          String         @unique
  symbol              String         @db.VarChar(20)
  longExchange        String         @db.VarChar(50)
  longEntryPrice      Decimal        @db.Decimal(18, 8)
  longExitPrice       Decimal        @db.Decimal(18, 8)
  longPositionSize    Decimal        @db.Decimal(18, 8)
  shortExchange       String         @db.VarChar(50)
  shortEntryPrice     Decimal        @db.Decimal(18, 8)
  shortExitPrice      Decimal        @db.Decimal(18, 8)
  shortPositionSize   Decimal        @db.Decimal(18, 8)
  openedAt            DateTime       @db.Timestamptz
  closedAt            DateTime       @db.Timestamptz
  holdingDuration     Int            // seconds
  priceDiffPnL        Decimal        @db.Decimal(18, 8)
  fundingRatePnL      Decimal        @db.Decimal(18, 8)
  totalPnL            Decimal        @db.Decimal(18, 8)
  roi                 Decimal        @db.Decimal(10, 4)
  status              TradeWebStatus @default(SUCCESS)
  createdAt           DateTime       @default(now()) @db.Timestamptz

  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  position Position @relation(fields: [positionId], references: [id], onDelete: Restrict)

  @@index([userId, createdAt(sort: Desc)])
  @@index([symbol, createdAt(sort: Desc)])
  @@index([createdAt(sort: Desc)])
  @@map("trades")
}

enum TradeWebStatus {
  SUCCESS
  PARTIAL
  FAILED
}
```

**Calculations** (FR-041):
- Price Difference P&L:
  ```typescript
  const longPnL = (longExitPrice - longEntryPrice) * longPositionSize;
  const shortPnL = (shortEntryPrice - shortExitPrice) * shortPositionSize;
  const priceDiffPnL = longPnL + shortPnL;
  ```
  
- Funding Rate P&L (FR-044):
  ```typescript
  const fundingRatePnL = await queryFundingFeesFromExchange(
    longExchange, 
    shortExchange, 
    openedAt, 
    closedAt
  );
  ```

- Total P&L:
  ```typescript
  const totalPnL = priceDiffPnL + fundingRatePnL;
  ```

- ROI:
  ```typescript
  const capital = (longPositionSize * longEntryPrice / longLeverage) 
                + (shortPositionSize * shortEntryPrice / shortLeverage);
  const roi = (totalPnL / capital) * 100;
  ```

**Validation Rules**:
- `totalPnL`: Must equal `priceDiffPnL + fundingRatePnL`
- `holdingDuration`: Must match `closedAt - openedAt` in seconds
- Once created, Trade record is immutable (for audit integrity)

**Maps to User Stories**: US4 (close position), US5 (view history)

---

### AuditLog

Tracks all critical user operations for security and compliance.

**Prisma Schema**:
```prisma
model AuditLog {
  id        String   @id @default(cuid())
  userId    String?
  action    String   @db.VarChar(50)
  resource  String?  @db.VarChar(100)
  details   Json?    @db.JsonB
  ipAddress String?  @db.VarChar(45)
  createdAt DateTime @default(now()) @db.Timestamptz

  user User? @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([userId, createdAt(sort: Desc)])
  @@index([action, createdAt(sort: Desc)])
  @@index([createdAt(sort: Desc)])
  @@map("audit_logs")
}
```

**Action Types** (FR-053):
- `LOGIN`: User login (successful or failed)
- `LOGOUT`: User logout
- `REGISTER`: New user registration
- `APIKEY_ADD`: Add new API key
- `APIKEY_DELETE`: Delete API key
- `APIKEY_TOGGLE`: Enable/disable API key
- `POSITION_OPEN`: Attempt to open position
- `POSITION_CLOSE`: Attempt to close position
- `POSITION_ROLLBACK`: Rollback attempt after partial failure

**Details Field Examples**:
```typescript
// LOGIN
{ success: true, email: "user@example.com" }

// POSITION_OPEN
{ 
  symbol: "BTCUSDT", 
  longExchange: "binance", 
  shortExchange: "okx",
  positionSize: 1000,
  status: "success" | "failed" | "partial"
}
```

**Maps to User Stories**: All user stories (auditing requirement FR-053)

---

## Existing Entities (Reused from CLI System)

> ⚠️ **已廢棄 (2025-12-30)**: `ArbitrageOpportunity` 模型已移除，由 Market Monitor 即時計算取代。

### ~~ArbitrageOpportunity~~ (已廢棄)

~~Stores detected funding rate arbitrage opportunities (reused from feature 005).~~

**目前實作**: Market Monitor 透過 WebSocket 即時推送費率資料，前端即時計算套利機會，無需持久化。

**Maps to User Stories**: US2 (monitor opportunities)

---

### FundingRate

TimescaleDB hypertable for historical funding rate data (reused from feature 004).

**Prisma Schema**: See lines 16-32 in `prisma/schema.prisma`

**Usage in Web Platform**:
- Display current funding rates in opportunity list (US2)
- Historical data for P&L calculation validation

**Maps to User Stories**: US2 (display funding rates)

---

## Entity Relationships

```
User (1) ──── (N) ApiKey
  │
  ├── (N) Position ──── (1) Trade
  │
  └── (N) AuditLog

FundingRate (shared data, not user-specific)
Market rates (real-time via WebSocket, not persisted)
```

## Index Strategy

**Performance Considerations**:
1. **User lookup**: Index on `users.email` for login queries
2. **Position listing**: Composite index on `[userId, status]` for "My Positions" page
3. **Trade history**: Index on `[userId, createdAt DESC]` for chronological queries
4. **Audit log search**: Composite index on `[action, createdAt DESC]` for admin queries

**Query Patterns**:
- Get user's active positions: `WHERE userId = ? AND status IN ('OPEN', 'CLOSING')`
- Get user's trade history: `WHERE userId = ? ORDER BY createdAt DESC LIMIT 50`
- Get recent audit logs: `WHERE action = ? ORDER BY createdAt DESC LIMIT 100`

## Database Migrations

**Migration Strategy**:
1. All schema changes via Prisma migrations (`prisma migrate dev`)
2. No manual SQL edits (Constitution IV: Data Integrity)
3. Test migrations in development before production
4. Backup database before running migrations in production

**Seed Data** (for development):
- Create test user with bcrypt password
- Create test API keys (encrypted, pointing to testnet)
- Create sample opportunities and positions

## Data Validation

**Zod Schemas** (Constitution III: Defensive Programming):

```typescript
// User registration
const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[0-9]/, "Password must contain at least one digit")
    .regex(/[a-zA-Z]/, "Password must contain at least one letter"),
});

// API Key creation
const ApiKeySchema = z.object({
  exchange: z.enum(["binance", "okx"]),
  environment: z.enum(["MAINNET", "TESTNET"]),
  label: z.string().min(1).max(100),
  apiKey: z.string().min(10),
  secretKey: z.string().min(10),
  passphrase: z.string().optional(),
});

// Position creation
const OpenPositionSchema = z.object({
  opportunityId: z.string().cuid(),
  positionSizeUsdt: z.number()
    .positive()
    .max(10000, "Position size exceeds maximum"),
});

// Position closure
const ClosePositionSchema = z.object({
  positionId: z.string().cuid(),
});
```

## Financial Precision

**Decimal Usage** (Constitution IV):
- All price fields: `Decimal(18, 8)` - 8 decimal places for crypto precision
- All funding rate fields: `Decimal(10, 8)` - 8 decimal places for rate precision
- All P&L fields: `Decimal(18, 8)` - 8 decimal places for USDT amounts
- ROI field: `Decimal(10, 4)` - 4 decimal places for percentage

**TypeScript Integration**:
```typescript
import { Decimal } from "decimal.js";

// Always use Decimal for calculations
const pnl = new Decimal(longPnL).plus(shortPnL);

// Convert to number only for display
const displayPnl = pnl.toNumber();
```

## Data Retention

**Policies** (for future consideration):
- `AuditLog`: Retain for 1 year (compliance)
- `Trade`: Retain indefinitely (user's historical performance)
- `FundingRate`: Retain for 3 months (TimescaleDB automatic compression)

