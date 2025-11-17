# cross-exchange-arbitrage-bot Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-10-17

## Active Technologies
- TypeScript 5.3+ + Node.js 20.x LTS + binance-connector-node 3.x, okx-node-sdk 1.x, ccxt 4.x (備援), Prisma 5.x (ORM), ws 8.x (WebSocket) (001-funding-rate-arbitrage)
- TypeScript 5.3+ with Node.js 20.x LTS (004-fix-okx-add-price-display)
- PostgreSQL 15 + TimescaleDB extension (已配置於 Docker Compose) (004-fix-okx-add-price-display)
- PostgreSQL 15+ with TimescaleDB extension (existing), Redis 7+ (rate limiting & locks) (006-web-trading-platform)
- TypeScript 5.6 + Node.js 20.x LTS + React 18, Next.js 14 App Router, Tailwind CSS, Radix UI Tooltip, Lucide Reac (008-specify-scripts-bash)
- N/A（純前端功能，無資料持久化） (008-specify-scripts-bash)
- TypeScript 5.6, Node.js 20.x LTS + React 18, Next.js 14 App Router, Radix UI (現有依賴，無需新增) (009-specify-scripts-bash)
- 瀏覽器 localStorage (用於儲存排序偏好) (009-specify-scripts-bash)
- TypeScript 5.6 + Node.js 20.x LTS + Next.js 14.2.33 (App Router), React 18, Tailwind CSS, Socket.io 4.8.1 (011-price-spread-net-return)
- N/A（純前端擴展，使用現有記憶體快取 RatesCache） (011-price-spread-net-return)
- PostgreSQL 15 + TimescaleDB (已配置於 Docker Compose) (012-specify-scripts-bash)
- TypeScript 5.6 + Node.js 20.x LTS + Next.js 14 App Router (前端), Prisma 5.x (資料模型), Socket.io 4.8.1 (WebSocket) (013-specify-scripts-bash)
- PostgreSQL 15+ with TimescaleDB (保留歷史資料，標記模型為廢棄) (013-specify-scripts-bash)
- TypeScript 5.6 + Node.js 20.x LTS + React 18, Next.js 14 App Router, Tailwind CSS, Socket.io 4.8.1 (WebSocket) (014-remove-net-return-display)
- N/A（純 UI 重構，不涉及資料模型變更；手續費規範為 Markdown 文件） (014-remove-net-return-display)

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
- 014-remove-net-return-display: Added TypeScript 5.6 + Node.js 20.x LTS + React 18, Next.js 14 App Router, Tailwind CSS, Socket.io 4.8.1 (WebSocket)
- 013-specify-scripts-bash: Added TypeScript 5.6 + Node.js 20.x LTS + Next.js 14 App Router (前端), Prisma 5.x (資料模型), Socket.io 4.8.1 (WebSocket)
- 012-specify-scripts-bash: Added TypeScript 5.6 + Node.js 20.x LTS

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
