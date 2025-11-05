# cross-exchange-arbitrage-bot Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-10-17

## Active Technologies
- TypeScript 5.3+ + Node.js 20.x LTS + binance-connector-node 3.x, okx-node-sdk 1.x, ccxt 4.x (備援), Prisma 5.x (ORM), ws 8.x (WebSocket) (001-funding-rate-arbitrage)
- TypeScript 5.3+ with Node.js 20.x LTS (004-fix-okx-add-price-display)
- PostgreSQL 15 + TimescaleDB extension (已配置於 Docker Compose) (004-fix-okx-add-price-display)
- PostgreSQL 15+ with TimescaleDB extension (existing), Redis 7+ (rate limiting & locks) (006-web-trading-platform)

## Project Structure
```
src/
tests/
```

## Commands
npm test && npm run lint

## Code Style
TypeScript 5.3+ + Node.js 20.x LTS: Follow standard conventions

## Recent Changes
- 006-web-trading-platform: Added TypeScript 5.3+ with Node.js 20.x LTS
- 006-web-trading-platform: Added TypeScript 5.3+ with Node.js 20.x LTS
- 005-arbitrage-opportunity-detection: Added TypeScript 5.3+ with Node.js 20.x LTS

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
