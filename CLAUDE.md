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
- TypeScript 5.6 + Node.js 20.x LTS (現有專案配置) (016-specify-scripts-bash)
- TypeScript 5.6 + Node.js 20.x LTS + CCXT 4.x (多交易所抽象), Binance Connector 3.x, OKX SDK 1.x (017-funding-rate-intervals)
- N/A（間隔資訊僅記憶體快取，不持久化至資料庫） (017-funding-rate-intervals)
- TypeScript 5.6 + Node.js 20.x LTS + Socket.io 4.8.1 (WebSocket), Next.js 14 (Web framework), Prisma 5.x (ORM - 用於 REST API) (019-fix-time-basis-switching)
- PostgreSQL 15 + TimescaleDB（現有資料庫，本次修復不涉及 schema 變更） (019-fix-time-basis-switching)
- N/A（純前端功能，不涉及資料持久化） (020-copy-arbitrage-info)
- N/A（不涉及資料庫變更，僅修改記憶體中的計算邏輯） (022-specify-scripts-bash)
- TypeScript 5.6 + Node.js 20.x LTS + React 18, Next.js 14 App Router (現有依賴，無需新增) (023-fix-copy-message-display)
- N/A（純前端顯示修改，不涉及資料持久化） (023-fix-copy-message-display)
- TypeScript 5.6 + Node.js 20.x LTS + CCXT 4.x (多交易所抽象), axios (HTTP 請求), pino (結構化日誌) (024-fix-okx-funding-normalization)
- TypeScript 5.6 + Node.js 20.x LTS + React 18, Next.js 14 App Router, Radix UI Tooltip (現有依賴，無需新增) (025-payback-periods-indicator)
- N/A（純前端計算，不涉及資料持久化） (025-payback-periods-indicator)
- TypeScript 5.6 + Node.js 20.x LTS + Next.js 14 App Router, Prisma 5.x, Socket.io 4.8.1 (WebSocket), axios (HTTP requests) (026-discord-slack-notification)
- PostgreSQL 15+ (NotificationWebhook 模型) (026-discord-slack-notification)
- TypeScript 5.6 + Node.js 20.x LTS + Next.js 14 App Router, Prisma 5.x, Socket.io 4.8.1, axios, pino (027-opportunity-end-notification)
- PostgreSQL 15 + TimescaleDB（現有 NotificationWebhook 模型擴展 + OpportunityHistory 啟用） (027-opportunity-end-notification)
- TypeScript 5.6 + Node.js 20.x LTS + Next.js 14 (App Router), React 18, Prisma 5.x, Socket.io 4.8.1, Tailwind CSS (029-simulated-apy-tracking)
- PostgreSQL 15 + TimescaleDB (existing infrastructure) (029-simulated-apy-tracking)
- TypeScript 5.6 + Node.js 20.x LTS + React 18, Next.js 14 App Router, Radix UI Tooltip (已安裝) (030-specify-scripts-bash)
- N/A（純前端功能，資料已存在於 API 回應中） (030-specify-scripts-bash)
- TypeScript 5.6 + Node.js 20.x LTS + Next.js 14.2.33 (App Router), Prisma 5.22.0, Socket.io 4.8.1, Recharts 2.15.4, CCXT 4.5.11, @binance/connector 3.6.1 (031-asset-tracking-history)
- PostgreSQL 15 + TimescaleDB extension (existing) (031-asset-tracking-history)
- TypeScript 5.6 + Node.js 20.x LTS + CCXT 4.x (多交易所抽象庫，已安裝) (032-mexc-gateio-assets)
- PostgreSQL 15 + TimescaleDB (現有 AssetSnapshot 模型已有 mexcBalanceUSD 和 gateioBalanceUSD 欄位) (032-mexc-gateio-assets)

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
- 032-mexc-gateio-assets: Added TypeScript 5.6 + Node.js 20.x LTS + CCXT 4.x (多交易所抽象庫，已安裝)
- 031-asset-tracking-history: Added TypeScript 5.6 + Node.js 20.x LTS + Next.js 14.2.33 (App Router), Prisma 5.22.0, Socket.io 4.8.1, Recharts 2.15.4, CCXT 4.5.11, @binance/connector 3.6.1
- 030-specify-scripts-bash: Added TypeScript 5.6 + Node.js 20.x LTS + React 18, Next.js 14 App Router, Radix UI Tooltip (已安裝)

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
