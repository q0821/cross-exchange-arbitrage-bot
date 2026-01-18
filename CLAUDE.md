# cross-exchange-arbitrage-bot Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-01-17

## Active Technologies
- TypeScript 5.8 + Node.js 20.x LTS
- Next.js 15, React 19, Tailwind CSS, Radix UI, Socket.io 4.8.1
- Prisma 7.x (ORM), CCXT 4.x (多交易所抽象)
- PostgreSQL 15+ with TimescaleDB extension
- Vitest 4.x, Decimal.js
- TypeScript 5.6 + Node.js 20.x LTS + CCXT 4.x (WebSocket watch* methods), ws 8.x, @binance/connector 3.x (REST only) (052-specify-scripts-bash)
- PostgreSQL 15 + TimescaleDB (現有 Position 模型) (052-specify-scripts-bash)
- TypeScript 5.6 + Node.js 20.x LTS + ws 8.x (WebSocket), Decimal.js (精度計算), Zod (訊息驗證), Pino (日誌) (054-native-websocket-clients)
- PostgreSQL 15 + TimescaleDB (現有 ApiKey 模型) (054-native-websocket-clients)
- TypeScript 5.8 + Node.js 20.x LTS + CCXT 4.x (交易所抽象), Prisma 7.x (ORM), Next.js 15 (Web) (056-fix-balance-display)
- TypeScript 5.8 + Node.js 20.x LTS + Next.js 15, Prisma 7.x, Vitest 4.x, Pino (logging) (057-notification-price-filter)
- PostgreSQL 15 + TimescaleDB (existing `NotificationWebhook` table) (057-notification-price-filter)
- TypeScript 5.8 + Node.js 20.x LTS + Next.js 15, React 19, axios (Discord/Slack webhook) (058-notification-open-link)
- N/A (無新增資料儲存需求) (058-notification-open-link)
- TypeScript 5.8 + Node.js 20.x LTS + CCXT 4.x (交易所抽象), Prisma 7.x (ORM), Next.js 15 (Web), Pino (logging) (062-refactor-trading-srp)
- PostgreSQL 15+ with TimescaleDB (無 schema 變更) (062-refactor-trading-srp)
- TypeScript 5.8 + Node.js 20.x LTS + TanStack Query 5.x (新增), React 19, Next.js 15, Socket.io-client 4.x (063-frontend-data-caching)
- N/A (客戶端記憶體快取，無持久化儲存) (063-frontend-data-caching)

## Project Structure
```
src/
tests/
```

## Key Files
| 檔案 | 用途 |
|:-----|:-----|
| `CHANGELOG.md` | 專案變更日誌（版本歷史、修復記錄） |
| `package.json` | 專案配置與腳本 |
| `prisma/schema.prisma` | 資料庫 Schema 定義 |
| `config/symbols.json` | 交易對監控清單 |

## Commands

### 開發
```bash
pnpm dev              # 啟動開發伺服器
pnpm dev:pretty       # 啟動開發伺服器（美化日誌）
pnpm build            # 建置生產版本
```

### 測試
```bash
pnpm test             # 執行所有測試（單元 + Hooks）
pnpm test:coverage    # 執行測試並產生覆蓋率報告
pnpm test:e2e         # 執行 Playwright E2E 測試
pnpm lint             # ESLint 檢查
```

### 資料庫
```bash
pnpm docker:up        # 啟動 PostgreSQL + Redis（Docker）
pnpm db:migrate       # 執行資料庫遷移
pnpm db:generate      # 產生 Prisma Client
```

## Code Style
TypeScript 5.8+ with strict mode: Follow standard conventions

## Code Quality Guidelines

以下準則來自過往 code review 的經驗，請在撰寫程式碼時遵循：

### 1. 錯誤處理策略
- **禁止**：回傳預設值（如 `0`, `null`, `undefined`）來隱藏錯誤
- **應該**：拋出明確的錯誤（如 `TradingError`）讓調用方決定如何處理
- **範例**：價格獲取失敗時應拋出 `TradingError('PRICE_FETCH_FAILED', ...)` 而非回傳 `{ price: 0 }`

### 2. 邊界條件驗證
- 數學計算前必須驗證：除數不為 0、輸入值在有效範圍內
- 陣列操作前檢查索引範圍、物件存在性
- **範例**：`if (contractSize <= 0) throw new TradingError('INVALID_CONTRACT_SIZE', ...)`

### 3. 狀態初始化完整性
- 重新創建物件實例後，確保所有必要的初始化步驟都有執行
- **範例**：CCXT exchange 重建後必須再次呼叫 `loadMarkets()`

### 4. 類型安全
- **禁止**：使用 `any` 繞過型別檢查
- **應該**：定義明確的介面（interface）來描述外部 API 回應結構
- **範例**：為 CCXT 交易所方法定義 `CcxtBinanceExchange` 介面

### 5. 配置可調性
- **禁止**：在程式碼中寫死魔術數字（magic numbers）
- **應該**：使用命名常數、類別屬性或建構函數參數
- **範例**：`private readonly ORDER_SETTLEMENT_DELAY = 500` 取代寫死的 `setTimeout(resolve, 500)`

### 6. 命名清晰度
- 參數名稱應清楚表達其用途，避免歧義
- **範例**：平倉時的 `side` 參數容易與訂單方向混淆，應改為 `positionSide` 明確表示「持倉方向」

### 7. 提交前驗證
- 提交到 main 之前必須通過 ESLint 和 TypeScript check
- 指令：`pnpm lint` + `pnpm exec tsc --noEmit`

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

## Feature 050: 停損停利觸發偵測與自動平倉

### Key Paths
- **條件單監控服務**: `src/services/monitor/ConditionalOrderMonitor.ts` - 每 30 秒輪詢檢查條件單狀態
- **交易所查詢服務**: `src/lib/exchange-query-service.ts` - 查詢條件單和訂單歷史
- **監控初始化**: `src/lib/monitor-init.ts` - Singleton 模式初始化和優雅關閉
- **WebSocket 事件推送**: `src/services/websocket/TriggerProgressEmitter.ts` - 觸發事件即時推送
- **通知工具**: `src/services/notification/utils.ts` - 觸發通知訊息構建

### API Endpoints
- `GET /api/monitor/status` - 獲取條件單監控服務狀態

### Environment Variables
- `ENABLE_CONDITIONAL_ORDER_MONITOR=true` - 啟用條件單觸發監控服務

### Data Model (Prisma)
- `CloseReason` enum - 新增平倉原因（MANUAL, LONG_SL_TRIGGERED, LONG_TP_TRIGGERED, SHORT_SL_TRIGGERED, SHORT_TP_TRIGGERED, BOTH_TRIGGERED）
- `Position.closeReason` - 記錄持倉平倉原因

### WebSocket Events
- `position:trigger:detected` - 觸發偵測到
- `position:trigger:close:progress` - 觸發平倉進度
- `position:trigger:close:success` - 觸發平倉成功
- `position:trigger:close:failed` - 觸發平倉失敗

### Trigger Types
- `LONG_SL` - 多方停損觸發
- `LONG_TP` - 多方停利觸發
- `SHORT_SL` - 空方停損觸發
- `SHORT_TP` - 空方停利觸發
- `BOTH` - 雙邊同時觸發

## Feature 052: WebSocket 即時數據訂閱

### Key Paths
- **WebSocket 管理器**: `src/lib/websocket.ts` - WebSocketManager 基類（自動重連、心跳）
- **價格監控服務**: `src/services/monitor/PriceMonitor.ts` - DataSourceManager 整合
- **數據源管理器**: `src/services/monitor/DataSourceManager.ts` - WebSocket/REST 混合策略
- **資金費率快取**: `src/services/monitor/RatesCache.ts` - 接收 WebSocket 更新

### Exchange Connectors (WebSocket 訂閱)
- **Binance**: `src/connectors/binance.ts` - markPrice、fundingRate、ticker、balanceUpdate 訂閱
- **OKX**: `src/connectors/okx.ts` - markPrice、fundingRate、ticker、balanceUpdate 訂閱
- **Gate.io**: `src/connectors/gateio.ts` - markPrice、fundingRate、ticker、balanceUpdate 訂閱
- **MEXC**: `src/connectors/mexc.ts` - markPrice、fundingRate、ticker 訂閱（REST fallback for balance）
- **BingX**: `src/connectors/bingx.ts` - markPrice、fundingRate、ticker 訂閱

### WebSocket Clients
- **Binance WS**: `src/services/websocket/BinanceWsClient.ts` - markPrice/fundingRate 即時訂閱
- **Binance UserData**: `src/services/websocket/BinanceUserDataWs.ts` - 用戶帳戶餘額即時更新
- **Balance WS Handler**: `src/services/websocket/BalanceWsHandler.ts` - 餘額變更聚合處理
- **Balance Update Emitter**: `src/services/websocket/BalanceUpdateEmitter.ts` - Socket.io 餘額推送

### API Endpoints
- `GET /api/monitor/ws-status` - 取得 WebSocket 連線狀態

### Frontend Components
- `app/(dashboard)/assets/page.tsx` - 資產總覽（含 WebSocket 即時更新）
- `app/(dashboard)/assets/hooks/useBalanceSocket.ts` - 餘額 WebSocket Hook

### WebSocket Events (Client → Server)
- `balance:update` - 餘額即時更新
- `balance:snapshot` - 餘額快照

### Connector Subscription Types
```typescript
type: 'markPrice' | 'fundingRate' | 'ticker' | 'balanceUpdate'
```

### Data Flow
1. Exchange WebSocket → Connector.subscribeWS() → EventEmitter
2. DataSourceManager 監聽 Connector events → RatesCache.update()
3. BalanceWsHandler 監聽 balanceUpdate → BalanceUpdateEmitter → Socket.io
4. Frontend useBalanceSocket hook → UI 即時更新

### Environment Variables
- `NEXT_PUBLIC_WS_URL` - WebSocket 服務 URL（預設使用相對路徑）

## Feature 060: 分單開倉（獨立持倉）

### Key Paths
- **數量分配工具**: `src/lib/split-quantity.ts` - splitQuantity() 大組優先分配算法
- **開倉 Hook**: `app/(dashboard)/market-monitor/hooks/useOpenPosition.ts` - executeSplitOpen() 串行開倉
- **開倉對話框**: `app/(dashboard)/market-monitor/components/OpenPositionDialog.tsx` - 組數輸入和進度顯示

### Frontend Components
- `OpenPositionDialog.tsx` - 新增開倉組數輸入欄位（1-10 組）
- `useOpenPosition.ts` - 新增 `executeSplitOpen`, `currentGroup`, `totalGroups`

### Hooks
- `useOpenPosition.ts`:
  - `executeSplitOpen(data, positionCount)` - 串行執行分單開倉
  - `currentGroup` - 當前開倉組數（用於進度顯示）
  - `totalGroups` - 總組數（用於進度顯示）

### Utility Functions
- `splitQuantity(total: number, count: number): number[]` - 將總數量分配到指定組數
- `validateSplitQuantity(total, quantities): boolean` - 驗證分配結果

### Constraints
- 最大 10 組，最小 1 組
- 每組數量不得小於 MIN_QUANTITY (0.0001)
- 串行執行，失敗時立即停止後續開倉
- 已成功的持倉保持完整

## Testing

### 測試架構
```
tests/
├── unit/           # 單元測試 (1,886 案例)
├── integration/    # 整合測試 (103 案例) - 需要 PostgreSQL
├── hooks/          # React Query Hooks 測試 (33 案例)
├── e2e/            # Playwright E2E 測試 (23 案例)
├── performance/    # 效能測試 (11 案例)
└── setup.ts        # 測試設定
```

### 測試環境變數
- `.env.test.example` - 測試環境變數範本（已提交 Git）
- `.env.test` - 本地測試環境變數（不提交）

**關鍵環境變數**：
| 變數 | 用途 |
|:-----|:-----|
| `RUN_INTEGRATION_TESTS=true` | 啟用整合測試 |
| `PERFORMANCE_TEST=true` | 啟用效能測試（需真實 WebSocket） |

### 測試文件
- `docs/test/test.md` - 測試統計摘要
- `docs/test/integration-test.md` - 整合測試詳細分析（INT-001 ~ INT-104）
- `docs/test/e2e-test.md` - E2E 測試詳細分析（E2E-001 ~ E2E-023）
- `docs/test/performance-test.md` - 效能測試詳細分析（PERF-001 ~ PERF-010）

## CI/CD

### GitHub Actions 工作流程
| 檔案 | 用途 | 觸發條件 |
|:-----|:-----|:---------|
| `.github/workflows/ci.yml` | Lint + 型別檢查 + 單元測試 | 每次 push/PR |
| `.github/workflows/integration.yml` | 整合測試（PostgreSQL） | push to main |
| `.github/workflows/e2e.yml` | Playwright E2E 測試 | push to main |

### 觸發策略
- **Push to main**：執行所有測試（完整測試）
- **PR to main**：CI 必跑，Integration/E2E 依檔案變更觸發
- **手動觸發**：所有工作流程支援 `workflow_dispatch`

<!-- MANUAL ADDITIONS END -->
