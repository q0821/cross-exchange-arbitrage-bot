# cross-exchange-arbitrage-bot Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-01-18

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
- TypeScript 5.8 + Node.js 20.x LTS + Next.js 15, React 19, Prisma 7.x, Tailwind CSS, Radix UI (064-public-landing-page)
- PostgreSQL 15 + TimescaleDB（現有 `OpportunityEndHistory` 模型） (064-public-landing-page)
- TypeScript 5.8 + Node.js 20.x LTS + EventEmitter (Node.js built-in), CCXT 4.x, Prisma 7.x (066-specify-scripts-bash)
- PostgreSQL 15 + TimescaleDB (existing, no changes) (066-specify-scripts-bash)
- TypeScript 5.8 + Node.js 20.x LTS + Next.js 15, React 19, Socket.io 4.8.1, CCXT 4.x, Prisma 7.x, Decimal.js (067-position-exit-monitor)
- PostgreSQL 15 + TimescaleDB（擴展 TradingSettings 和 Position 模型） (067-position-exit-monitor)
- PostgreSQL 15+ with TimescaleDB (現有資料庫擴展) (068-admin-dashboard)
- TypeScript 5.8 + Node.js 20.x LTS + Next.js 15, React 19, Prisma 7.x, CCXT 4.x, Socket.io 4.8.1, Decimal.js (069-position-group-close)
- PostgreSQL 15 + TimescaleDB（擴展現有 Position 模型） (069-position-group-close)

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

## Logging Strategy

專案使用 Pino 作為日誌框架，依照 level 分流到不同目錄：

### Log 目錄結構
```
logs/
├── YYYY-MM-DD.log      # 完整日誌（所有 level）
├── warning/
│   └── YYYY-MM-DD.log  # 警告日誌（warn only）
└── critical/
    └── YYYY-MM-DD.log  # 嚴重錯誤（error, fatal）
```

### Log Level 說明
| Level | 目錄 | 說明 |
|:------|:-----|:-----|
| trace, debug, info | `logs/` | 一般日誌，完整記錄 |
| warn | `logs/warning/` | 警告，需關注但非緊急 |
| error, fatal | `logs/critical/` | 嚴重錯誤，需立即處理 |

### 使用方式
```typescript
import { logger, createLogger } from '@/lib/logger';

// 使用預設 logger
logger.info('message');

// 使用領域 logger
const tradingLogger = createLogger('trading');
tradingLogger.error({ orderId }, 'Order failed');
```

### 預設領域 Logger
- `exchangeLogger` - 交易所 API 相關
- `tradingLogger` - 交易操作相關
- `arbitrageLogger` - 套利邏輯相關
- `wsLogger` - WebSocket 相關
- `dbLogger` - 資料庫相關

### 分析 Log
使用 `/analyze-log` skill 快速分析日誌：
```bash
/analyze-log
```

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

### 診斷工具
```bash
# 測試交易所 API 連線
pnpm tsx scripts/diagnostics/test-binance-api.ts
pnpm tsx scripts/diagnostics/test-gateio-api.ts
pnpm tsx scripts/diagnostics/test-mexc-api.ts

# 查詢持倉狀態
pnpm tsx scripts/diagnostics/test-okx-position.ts

# 詳細說明請參考：scripts/diagnostics/README.md
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

### 8. Prisma 7 測試相容性
- **禁止**：在測試中直接使用 `new PrismaClient()` 初始化
- **應該**：使用專案提供的 `createPrismaClient()` 工廠函數
- **原因**：Prisma 7 使用 "client" engine 需要 adapter（`@prisma/adapter-pg`）
- **範例**：
  ```typescript
  // ❌ 錯誤 - Prisma 7 會報錯
  import { PrismaClient } from '@prisma/client'
  const prisma = new PrismaClient()

  // ✅ 正確 - 使用工廠函數
  import { createPrismaClient } from '@/src/lib/db'
  const prisma = createPrismaClient()
  ```
- **注意**：整合測試需要在測試檔案中加上 `// @vitest-environment node` 避免 jsdom 環境與 CCXT 的相容性問題

### 9. Prisma Migration 安全準則

此準則來自 Feature 065 開發過程中遇到的 migration drift 問題分析。

#### 問題根源
- **Checksum 不符**：migration 檔案在執行後被修改，導致 Prisma 驗證失敗
- **孤兒 migration**：本地執行 `prisma migrate dev` 但未提交，造成其他開發者無法同步
- **Schema 與 migration 不同步**：從 schema.prisma 移除 model 但沒有產生對應的 DROP migration

#### 禁止事項
- ❌ **永遠不要修改已執行的 migration 檔案**（包括格式化、空白調整）
- ❌ **不要在本地執行 `prisma migrate dev` 後忘記提交**
- ❌ **不要直接從 schema.prisma 移除 model 而不產生 migration**
- ❌ **不要手動編輯 `_prisma_migrations` 表**（除非修復問題）

#### 正確做法
- ✅ **Schema 變更後立即執行 `prisma migrate dev`** 產生 migration 檔案
- ✅ **migration 檔案必須與 schema.prisma 一起 commit**（Constitution Principle IV）
- ✅ **刪除 model 也需要 migration**：使用 `DROP TABLE IF EXISTS` 確保冪等性
- ✅ **使用 IF EXISTS / IF NOT EXISTS** 讓 migration 可重複執行
- ✅ **PR 前檢查**：確認 `prisma/migrations/` 資料夾有對應的變更

#### 修復 Migration Drift 的標準流程
```bash
# 1. 查看 drift 狀態
pnpm prisma migrate status

# 2. 如果有 checksum 不符，更新資料庫中的 checksum
UPDATE _prisma_migrations
SET checksum = '<new_checksum>'
WHERE migration_name = '<migration_name>';

# 3. 如果有孤兒 migration，刪除資料庫記錄
DELETE FROM _prisma_migrations
WHERE migration_name = '<orphan_migration>';

# 4. 手動建立清理 migration（如果需要 DROP TABLE）
# 使用 IF EXISTS 確保冪等性
```

#### Migration 檔案範例（冪等設計）
```sql
-- 移除表（冪等）
DROP TABLE IF EXISTS "old_table" CASCADE;

-- 建立枚舉（冪等）
DO $$ BEGIN
    CREATE TYPE "my_status" AS ENUM ('ACTIVE', 'ENDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 建立表（冪等）
CREATE TABLE IF NOT EXISTS "my_table" (...);

-- 建立索引（冪等）
CREATE INDEX IF NOT EXISTS "my_index" ON "my_table"(...);
```

### 10. 修改現有程式碼的影響評估
- **必須**：修改已存在的程式碼前，仔細檢查是否會對舊有的 spec/feature 產生影響
- **必須**：清楚向開發者說明可能的影響範圍，包括：
  - 哪些現有功能可能受影響
  - 是否需要同步更新相關的測試
  - 是否需要更新相關的文件或 spec
- **範例**：修改 `FundingRateMonitor` 的事件發送邏輯時，需檢查所有監聽該事件的服務（如 Feature 022, 026, 027, 029, 065）是否會受影響
- **建議**：若影響範圍較大，考慮採用獨立的邏輯（如 Feature 065 的獨立生命週期設計）避免耦合

### 11. CCXT 實例創建規範
- **禁止**：直接使用 `new ccxt.binance()` 或類似方式創建 CCXT 實例
- **應該**：使用 `src/lib/ccxt-factory.ts` 的工廠函數創建實例
- **原因**：確保統一配置（proxy、timeout、rate limit 等），避免配置不一致問題
- **範例**：
  ```typescript
  // ❌ 錯誤 - 可能遺漏統一配置
  import ccxt from 'ccxt';
  const exchange = new ccxt.binance({ apiKey, secret });

  // ✅ 正確 - 使用統一工廠
  import { createCcxtExchange } from '@/lib/ccxt-factory';
  const exchange = createCcxtExchange('binance', { apiKey, secret });
  ```
- **統一工廠提供的函數**：
  - `createCcxtExchange(exchangeId, config)` - 基礎創建函數，支援所有交易所
  - `createPublicExchange(exchangeId)` - 公開 API 實例（無需認證）
- **適用範圍**：所有 connectors、services、scripts 皆已整併使用統一工廠

## ⚠️ Speckit 工作流程強制要求 (NON-NEGOTIABLE)

### TDD 與 Constitution 合規性檢查

**在執行 `/speckit.implement` 之前，必須嚴格遵守以下規則：**

1. **Constitution 合規性檢查**
   - 所有 7 項 Constitution 原則必須通過審查
   - 參考：`.specify/memory/constitution.md`
   - 特別注意 NON-NEGOTIABLE 原則：
     - Principle I: Trading Safety First（交易安全）
     - Principle IV: Data Integrity（資料完整性 + Migration 檔案）
     - Principle VII: TDD Discipline（測試驅動開發）

2. **TDD 強制執行（Principle VII）**
   - tasks.md 必須包含 `[TEST]` 標記的測試任務
   - 每個 Implementation 任務之前必須有對應的測試任務
   - 測試必須先寫、先執行、先驗證 FAIL（Red Phase）
   - 實作只寫最小程式碼讓測試通過（Green Phase）
   - 重構階段確保所有測試仍然 PASS（Refactor Phase）

3. **tasks.md 必要結構**
   ```
   每個 Phase 必須包含：

   ### Tests for [Phase Name] (RED Phase) 🔴
   - [ ] Txxx [TEST] 測試描述
     - **執行測試，驗證 FAIL**

   ### Implementation for [Phase Name] (GREEN Phase) 🟢
   - [ ] Txxx 實作描述
     - **執行 Txxx 測試，驗證 PASS**

   ### Refactor for [Phase Name] 🔵
   - [ ] Txxx 重構描述
     - **執行所有測試，驗證全部 PASS**
   ```

4. **禁止事項**
   - ❌ 跳過測試直接實作
   - ❌ tasks.md 中沒有 `[TEST]` 任務
   - ❌ 違反 Constitution 任一 NON-NEGOTIABLE 原則
   - ❌ schema.prisma 變更沒有對應的 migration 檔案

5. **執行 `/speckit.implement` 前的檢查清單**
   - [ ] Constitution 7 項原則全部 ✅ Pass
   - [ ] tasks.md 包含測試任務（[TEST] 標記）
   - [ ] 測試任務排在對應實作任務之前
   - [ ] 有明確的 Red-Green-Refactor 流程標示

**違反這些規則的 implement 將導致程式碼品質下降和潛在的生產環境問題。**

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

## Feature 065: ArbitrageOpportunity 即時追蹤記錄

### Key Paths
- **Domain Model**: `src/models/ArbitrageOpportunity.ts` - 套利機會類型定義
- **Repository**: `src/repositories/ArbitrageOpportunityRepository.ts` - 套利機會資料存取層
- **Tracker**: `src/services/monitor/ArbitrageOpportunityTracker.ts` - 監聽事件並記錄機會
- **MonitorService**: `src/services/MonitorService.ts` - 整合 Tracker 到監測服務

### API Endpoints
- `GET /api/public/opportunities` - 公開 API 查詢歷史套利機會
  - Query Parameters: `page`, `limit`, `days` (7/30/90), `status` (ACTIVE/ENDED/all)

### Data Model (Prisma)
- `ArbitrageOpportunity` - 套利機會記錄
  - `symbol`: 交易對符號
  - `longExchange`, `shortExchange`: 做多/做空交易所
  - `status`: ACTIVE | ENDED
  - `detectedAt`, `endedAt`, `durationMs`: 時間資訊
  - `initialSpread`, `maxSpread`, `currentSpread`: 費差統計
  - `initialAPY`, `maxAPY`, `currentAPY`: 年化報酬
  - `longIntervalHours`, `shortIntervalHours`: 費率結算週期

### EventEmitter Events
- `opportunity-detected` - 機會偵測（觸發 upsert）
- `opportunity-disappeared` - 機會消失（觸發 markAsEnded）

### Frontend Integration
- Server-Side Helper: `src/lib/get-public-opportunities.ts`
- 公開首頁顯示歷史套利機會列表

### Tests
- Unit: `tests/unit/repositories/ArbitrageOpportunityRepository.test.ts` (16 案例)
- Unit: `tests/unit/services/ArbitrageOpportunityTracker.test.ts` (9 案例)
- Integration: `tests/integration/ArbitrageOpportunityFlow.test.ts` (5 案例)

## Feature 068: Admin Dashboard (平台管理後臺)

### Key Paths
- **Admin Auth**: `src/lib/admin/middleware.ts` - Admin JWT 驗證中間件
- **Admin Auth Service**: `src/services/admin/AdminAuthService.ts` - 管理員登入、帳戶鎖定
- **Dashboard Service**: `src/services/admin/AdminDashboardService.ts` - 平台統計數據
- **User Service**: `src/services/admin/AdminUserService.ts` - 用戶 CRUD、停用/啟用
- **Trade Service**: `src/services/admin/AdminTradeService.ts` - 持倉查詢、交易記錄匯出

### API Endpoints
- `POST /api/admin/auth/login` - 管理員登入
- `GET /api/admin/dashboard` - 平台統計數據
- `GET /api/admin/users` - 用戶列表（分頁、搜尋、篩選）
- `POST /api/admin/users` - 新增用戶（自動產生密碼）
- `GET /api/admin/users/[id]` - 用戶詳情
- `PATCH /api/admin/users/[id]` - 更新用戶資訊
- `DELETE /api/admin/users/[id]` - 刪除用戶（需確認文字）
- `POST /api/admin/users/[id]/suspend` - 停用用戶
- `POST /api/admin/users/[id]/enable` - 啟用用戶
- `POST /api/admin/users/[id]/reset-password` - 重設密碼
- `GET /api/admin/users/[id]/trades` - 用戶持倉/交易記錄（支援 CSV 匯出）
- `GET /api/admin/trades` - 平台所有交易列表

### Frontend Pages
- `app/(admin)/admin-login/page.tsx` - 管理員登入頁
- `app/(admin)/admin/layout.tsx` - 管理後臺版面（側邊欄）
- `app/(admin)/admin/dashboard/page.tsx` - 平台儀表板
- `app/(admin)/admin/users/page.tsx` - 用戶列表
- `app/(admin)/admin/users/new/page.tsx` - 新增用戶
- `app/(admin)/admin/users/[id]/page.tsx` - 用戶詳情（含停用/啟用/刪除功能）
- `app/(admin)/admin/users/[id]/components/PositionsTab.tsx` - 用戶持倉標籤
- `app/(admin)/admin/users/[id]/components/PositionDetailCard.tsx` - 持倉詳情卡片
- `app/(admin)/admin/trades/page.tsx` - 平台交易列表

### Data Model (Prisma)
- `User.role` - 用戶角色 (`USER` | `ADMIN`)
- `User.isActive` - 帳戶狀態
- `User.failedLoginAttempts` - 登入失敗次數
- `User.lockedUntil` - 帳戶鎖定時間
- `User.tokenVersion` - Token 版本（停用時遞增以失效 session）
- `AdminAuditLog` - 管理員操作審計日誌

### Security Features
- JWT Token 驗證（含 role 和 tokenVersion）
- 登入失敗 5 次後鎖定 15 分鐘
- 停用帳戶時 session 即時失效
- 刪除用戶需輸入確認文字 "DELETE"
- 管理員無法刪除自己
- 有活躍持倉的用戶無法刪除

### Tests
- Unit: `tests/unit/lib/admin/middleware.test.ts` (10 案例)
- Unit: `tests/unit/services/admin/AdminAuthService.test.ts` (24 案例)
- Unit: `tests/unit/services/admin/AdminDashboardService.test.ts` (5 案例)
- Unit: `tests/unit/services/admin/AdminUserService.test.ts` (27 案例)
- Unit: `tests/unit/services/admin/AdminTradeService.test.ts` (12 案例)
- **Total: 78 案例**

## Feature 069: 分單持倉合併顯示與批量平倉

### Key Paths
- **組合持倉服務**: `src/services/trading/PositionGroupService.ts` - 組合持倉查詢與驗證
- **組合計算工具**: `src/lib/position-group.ts` - 分組計算、聚合統計
- **組合類型定義**: `src/types/position-group.ts` - PositionGroup、Aggregate 類型
- **批量平倉**: `src/services/trading/PositionCloser.ts` - closeBatchPositions 方法
- **WebSocket 進度**: `src/services/websocket/PositionProgressEmitter.ts` - 批量平倉進度推送

### API Endpoints
- `GET /api/positions` - 查詢持倉列表（支援 grouped=true 參數）
- `POST /api/positions/group/[groupId]/close` - 批量平倉指定組內所有持倉

### Frontend Components
- `app/(dashboard)/positions/components/PositionGroupCard.tsx` - 組合持倉卡片
- `app/(dashboard)/positions/components/PositionGroupExpanded.tsx` - 組合持倉展開詳情
- `app/(dashboard)/positions/components/BatchCloseDialog.tsx` - 批量平倉對話框
- `app/(dashboard)/positions/hooks/useBatchClose.ts` - 批量平倉邏輯管理

### Hooks
- `hooks/queries/usePositionsQuery.ts` - useGroupedPositionsQuery 查詢組合持倉
- `app/(dashboard)/market-monitor/hooks/useOpenPosition.ts` - executeSplitOpen 分單開倉

### Data Model (Prisma)
- `Position.groupId` - 組合 ID (UUID)，用於關聯分單開倉的持倉
- `CloseReason.BATCH_CLOSE` - 批量平倉的平倉原因

### WebSocket Events
- `batch:close:progress` - 批量平倉進度
- `batch:close:position:complete` - 單個持倉平倉完成
- `batch:close:complete` - 批量平倉完成
- `batch:close:failed` - 批量平倉失敗

### User Stories
1. **US1 組合持倉顯示**: 分單開倉後，相同 groupId 的持倉合併顯示為「組合持倉」卡片
2. **US2 批量平倉**: 一鍵平倉組合內所有持倉，自動取消條件單
3. **US3 向後相容**: 沒有 groupId 的持倉維持原有獨立顯示和操作
4. **US4 統計資訊**: 組合持倉顯示加權平均開倉價格、總數量、總收益

### Tests
- Unit: `tests/unit/lib/position-group.test.ts` (16 案例)
- Unit: `tests/unit/lib/position-group-aggregate.test.ts` (23 案例)
- Unit: `tests/unit/services/PositionGroupService.test.ts` (12 案例)
- Unit: `tests/unit/services/PositionOrchestrator.groupId.test.ts` (7 案例)
- Unit: `tests/unit/services/PositionCloser.batch.test.ts` (9 案例)
- Integration: `tests/integration/position-group-open.test.ts` (7 案例)
- Integration: `tests/integration/batch-close.test.ts` (9 案例)
- Integration: `tests/integration/position-backward-compat.test.ts` (8 案例)
- **Total: 91 案例**

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

## Recent Changes
- 069-position-group-close: Added TypeScript 5.8 + Node.js 20.x LTS + Next.js 15, React 19, Prisma 7.x, CCXT 4.x, Socket.io 4.8.1, Decimal.js
- 068-admin-dashboard: Added TypeScript 5.8 + Node.js 20.x LTS + Next.js 15, React 19, Prisma 7.x, Tailwind CSS, Radix UI
- 067-position-exit-monitor: Added TypeScript 5.8 + Node.js 20.x LTS + Next.js 15, React 19, Socket.io 4.8.1, CCXT 4.x, Prisma 7.x, Decimal.js
