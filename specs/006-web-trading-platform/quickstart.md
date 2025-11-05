# Quickstart Guide

## Prerequisites

- Node.js 20.x LTS
- pnpm 8.0+
- PostgreSQL 15+ with TimescaleDB extension
- Redis 7+

## Environment Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment

Create `.env` file:

```bash
DATABASE_URL="postgresql://user:pass@localhost:5432/arbitrage_db"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"
ENCRYPTION_MASTER_KEY="generate-32-byte-hex-key"
REDIS_URL="redis://localhost:6379"
```

### 3. Start Infrastructure

```bash
pnpm docker:up
```

### 4. Initialize Database

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed  # Optional: test data
```

### 5. Start Development Server

```bash
pnpm dev
```

Visit http://localhost:3000

## Testing the Application

### Register & Login
1. Navigate to http://localhost:3000
2. Register with email/password
3. Auto-login after registration

### Add API Keys
1. Dashboard → API Keys
2. Add Binance/OKX testnet keys
3. System validates and encrypts

### Monitor Opportunities
1. Dashboard → Opportunities
2. Real-time updates via WebSocket

### Execute Trade
1. Select opportunity
2. Enter position size
3. Confirm open position
4. Monitor in Positions tab

## Running Tests

```bash
pnpm test              # Unit tests
pnpm test:e2e          # E2E tests
pnpm test:coverage     # Coverage report
```

## Useful Commands

```bash
pnpm dev              # Development server
pnpm build            # Production build
pnpm db:studio        # Database UI
pnpm lint             # Code linting
pnpm format           # Code formatting
pnpm docker:up        # Start services
pnpm docker:down      # Stop services
```

## Troubleshooting

- **Database error**: Check PostgreSQL running (`docker ps`)
- **Redis error**: Check Redis running (`docker ps`)
- **API key validation failed**: Use testnet keys, verify permissions
- **WebSocket not connecting**: Clear cookies, re-login

## Next Steps

- Read [Implementation Plan](./plan.md)
- Review [Data Model](./data-model.md)
- Check [API Contracts](./contracts/)

