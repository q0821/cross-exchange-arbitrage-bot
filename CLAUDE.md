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
- PostgreSQL 15 + TimescaleDB（現有 HedgePosition、TradeRecord 模型） (033-manual-open-position)
- TypeScript 5.6 + Node.js 20.x LTS + Next.js 14 App Router, Prisma 5.x, Socket.io 4.8.1, CCXT 4.x, Decimal.js (035-close-position)
- PostgreSQL 15 + TimescaleDB (現有 Position、Trade 模型) (035-close-position)
- TypeScript 5.6 + Node.js 20.x LTS + Next.js 14 App Router, Prisma 5.x, React 18 (037-specify-scripts-bash)
- PostgreSQL 15 + TimescaleDB (現有 Position 模型) (037-specify-scripts-bash)
- TypeScript 5.6 + Node.js 20.x LTS + Next.js 14 App Router, CCXT 4.x, Prisma 5.x, Socket.io 4.8.1 (038-specify-scripts-bash)
- PostgreSQL 15 + TimescaleDB (現有 Position 模型擴展) (038-specify-scripts-bash)
- TypeScript 5.6 + Node.js 20.x LTS + Next.js 14 App Router, Prisma 5.x ORM (039-specify-scripts-bash)
- PostgreSQL 15 + TimescaleDB (via Docker Compose) (039-specify-scripts-bash)
- TypeScript 5.6 + Node.js 20.x LTS + CCXT 4.x（多交易所抽象）, Prisma 5.x（ORM）, Pino（日誌）, Vitest（測試） (040-fix-conditional-orders)
- PostgreSQL 15 + TimescaleDB（現有 Position 模型已有條件單欄位） (040-fix-conditional-orders)
- PostgreSQL 15 + TimescaleDB（現有 Trade 模型已有 fundingRatePnL 欄位） (041-funding-rate-pnl-display)
- TypeScript 5.6 + Node.js 20.x LTS + Next.js 14 App Router, CCXT 4.x（多交易所抽象）, Prisma 5.x (ORM), Pino（結構化日誌） (042-api-key-connection-test)
- PostgreSQL 15 + TimescaleDB（現有 ApiKey 模型已有 `lastValidatedAt` 欄位） (042-api-key-connection-test)
- TypeScript 5.6+ with Node.js 20.x LTS + CCXT 4.x（BingX connector）, Prisma 5.x（ORM）, Next.js 14（Web）, Socket.io 4.8.1（WebSocket） (043-bingx-integration)
- PostgreSQL 15 + TimescaleDB（現有 ApiKey、Position、Trade 模型） (043-bingx-integration)

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
- 044-mexc-trading-restriction: Added TypeScript 5.6 + Node.js 20.x LTS + React 18, Next.js 14 App Router, Radix UI Tooltip (現有依賴，無需新增)
- 043-bingx-integration: Added TypeScript 5.6+ with Node.js 20.x LTS + CCXT 4.x（BingX connector）, Prisma 5.x（ORM）, Next.js 14（Web）, Socket.io 4.8.1（WebSocket）
- 042-api-key-connection-test: Added TypeScript 5.6 + Node.js 20.x LTS + Next.js 14 App Router, CCXT 4.x（多交易所抽象）, Prisma 5.x (ORM), Pino（結構化日誌）

<!-- MANUAL ADDITIONS START -->

## Feature 033: Manual Open Position

### Key Paths
- **開倉服務**: `src/services/trading/PositionOrchestrator.ts` - Saga Pattern 雙邊開倉協調器
- **分散式鎖**: `src/services/trading/PositionLockService.ts` - Redis 分散式鎖
- **餘額驗證**: `src/services/trading/BalanceValidator.ts` - 保證金計算
- **審計日誌**: `src/services/trading/AuditLogger.ts` - 交易操作記錄
- **WebSocket 進度**: `src/services/websocket/PositionProgressEmitter.ts` - 開倉進度推送

### API Endpoints
- `GET /api/balances` - 查詢用戶交易所餘額
- `POST /api/positions/open` - 執行雙邊開倉
- `GET /api/positions` - 查詢持倉列表
- `GET /api/market-data/refresh` - 刷新市場數據

### Frontend Components
- `app/(dashboard)/market-monitor/components/OpenPositionDialog.tsx` - 開倉對話框
- `app/(dashboard)/market-monitor/components/OpenPositionButton.tsx` - 開倉按鈕
- `app/(dashboard)/market-monitor/components/PositionProgressOverlay.tsx` - 進度覆蓋層
- `app/(dashboard)/market-monitor/components/RollbackFailedAlert.tsx` - 回滾失敗警告
- `app/(dashboard)/positions/page.tsx` - 持倉列表頁面
- `app/(dashboard)/positions/components/PositionCard.tsx` - 持倉卡片

### Hooks
- `app/(dashboard)/market-monitor/hooks/useOpenPosition.ts` - 開倉邏輯管理

## Feature 035: Close Position (一鍵平倉)

### Key Paths
- **平倉服務**: `src/services/trading/PositionCloser.ts` - 雙邊平倉協調器
- **審計日誌**: `src/services/trading/AuditLogger.ts` - 平倉操作記錄
- **WebSocket 進度**: `src/services/websocket/PositionProgressEmitter.ts` - 平倉進度推送
- **PnL 計算**: `src/lib/pnl-calculator.ts` - 損益計算工具

### API Endpoints
- `POST /api/positions/[id]/close` - 執行雙邊平倉
- `GET /api/positions/[id]/market-data` - 獲取平倉前市場數據
- `GET /api/trades` - 查詢交易績效歷史

### Frontend Components
- `app/(dashboard)/positions/page.tsx` - 持倉列表頁面（含平倉功能）
- `app/(dashboard)/positions/components/PositionCard.tsx` - 持倉卡片
- `app/(dashboard)/positions/components/ClosePositionDialog.tsx` - 平倉確認對話框
- `app/(dashboard)/positions/components/CloseProgressOverlay.tsx` - 平倉進度覆蓋層
- `app/(dashboard)/positions/components/PartialCloseAlert.tsx` - 部分平倉警告
- `app/(dashboard)/positions/components/ClosePositionErrorBoundary.tsx` - 錯誤邊界
- `app/(dashboard)/trades/page.tsx` - 交易歷史頁面
- `app/(dashboard)/trades/components/TradeCard.tsx` - 交易績效卡片
- `app/(dashboard)/trades/components/TradeCardSkeleton.tsx` - 載入骨架

### Hooks
- `app/(dashboard)/positions/hooks/useClosePosition.ts` - 平倉邏輯管理（含 WebSocket 監聽）

### WebSocket Events
- `position:close:progress` - 平倉進度更新
- `position:close:success` - 平倉成功
- `position:close:failed` - 平倉失敗
- `position:close:partial` - 部分平倉

## Feature 038: Stop Loss / Take Profit (開倉停損停利)

### Key Paths
- **條件單服務**: `src/services/trading/ConditionalOrderService.ts` - 統一管理停損停利訂單設定
- **觸發價格計算**: `src/lib/conditional-order-calculator.ts` - 計算停損停利觸發價格
- **適配器工廠**: `src/services/trading/ConditionalOrderAdapterFactory.ts` - 創建交易所特定適配器
- **Binance 適配器**: `src/services/trading/adapters/BinanceConditionalOrderAdapter.ts`
- **OKX 適配器**: `src/services/trading/adapters/OkxConditionalOrderAdapter.ts`
- **Gate.io 適配器**: `src/services/trading/adapters/GateioConditionalOrderAdapter.ts`
- **MEXC 適配器**: `src/services/trading/adapters/MexcConditionalOrderAdapter.ts`
- **交易設定 Repository**: `src/repositories/TradingSettingsRepository.ts` - 用戶預設值管理

### API Endpoints
- `GET /api/settings/trading` - 獲取用戶交易設定
- `PATCH /api/settings/trading` - 更新用戶交易設定

### Frontend Components
- `app/(dashboard)/market-monitor/components/OpenPositionDialog.tsx` - 開倉對話框（含停損停利設定）
- `app/(dashboard)/positions/components/PositionCard.tsx` - 持倉卡片（顯示停損停利狀態）
- `app/(dashboard)/positions/components/ConditionalOrderWarning.tsx` - 條件單警告元件
- `app/(dashboard)/settings/trading/page.tsx` - 交易設定頁面
- `app/(dashboard)/settings/trading/components/StopLossTakeProfitSettings.tsx` - 停損停利預設值設定

### Hooks
- `app/(dashboard)/market-monitor/hooks/useTradingSettings.ts` - 獲取用戶交易設定

### WebSocket Events
- `position:conditional:progress` - 條件單設定進度
- `position:conditional:success` - 條件單設定成功
- `position:conditional:failed` - 條件單設定失敗
- `position:conditional:partial` - 條件單部分設定成功

### Data Model (Prisma)
- `TradingSettings` - 用戶交易設定（停損停利預設值）
- `Position` 擴展欄位:
  - `stopLossEnabled`, `stopLossPercent` - 停損設定
  - `takeProfitEnabled`, `takeProfitPercent` - 停利設定
  - `conditionalOrderStatus` - 條件單狀態 (PENDING, SETTING, SET, PARTIAL, FAILED)
  - `longStopLossPrice`, `shortStopLossPrice` - 停損觸發價
  - `longTakeProfitPrice`, `shortTakeProfitPrice` - 停利觸發價

## Feature 043: BingX 交易所整合

### Key Paths
- **交易所連接器**: `src/connectors/bingx.ts` - BingxConnector (IExchangeConnector 實作)
- **用戶連接器**: `src/services/assets/UserConnectorFactory.ts` - BingxUserConnector 類別
- **條件單適配器**: `src/services/trading/adapters/BingxConditionalOrderAdapter.ts` - 停損停利訂單
- **適配器工廠**: `src/services/trading/ConditionalOrderAdapterFactory.ts` - BingX 適配器創建
- **符號轉換**: `src/services/trading/adapters/ConditionalOrderAdapter.ts` - convertSymbolForExchange()

### Frontend Components
- `app/(dashboard)/market-monitor/components/RatesTable.tsx` - BingX 欄位標題
- `app/(dashboard)/market-monitor/components/RateRow.tsx` - BingX 費率顯示
- `app/(dashboard)/market-monitor/types.ts` - ExchangeName 含 'bingx'
- `app/(dashboard)/market-monitor/utils/formatArbitrageMessage.ts` - BingX 顯示名稱

### Symbol Formats
- 內部格式：`BTCUSDT`
- CCXT swap 格式：`BTC/USDT:USDT`
- API 請求格式：`BTC-USDT`（部分 endpoint）

### BingX API 特性
- 使用 CCXT 4.x 作為統一封裝
- 支援 Hedge Mode（雙向持倉）
- 資金費率間隔：1h/4h/8h（透過 FundingIntervalCache 快取）
- 條件單類型：STOP_MARKET、TAKE_PROFIT_MARKET

### Data Model (Prisma)
- `ApiKey` - exchange 欄位支援 'bingx'
- `AssetSnapshot` - bingxBalanceUSD, bingxStatus 欄位
- 其餘模型（Position、Trade）無需修改，已是通用設計

<!-- MANUAL ADDITIONS END -->
