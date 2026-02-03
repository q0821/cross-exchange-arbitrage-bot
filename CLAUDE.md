# cross-exchange-arbitrage-bot Development Guidelines

## Active Technologies
- TypeScript 5.8 + Node.js 20.x LTS
- Next.js 15, React 19, Tailwind CSS, Radix UI, Socket.io 4.8.1
- Prisma 7.x (ORM), CCXT 4.x (多交易所抽象)
- PostgreSQL 15+ with TimescaleDB extension
- Vitest 4.x, Decimal.js, TanStack Query 5.x
- TypeScript 5.8+ / Node.js 20.x LTS + Prisma 7.x, Next.js 15, React 19, CCXT 4.x (070-unified-groupid)

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

### 2. 邊界條件驗證
- 數學計算前必須驗證：除數不為 0、輸入值在有效範圍內
- 陣列操作前檢查索引範圍、物件存在性

### 3. 狀態初始化完整性
- 重新創建物件實例後，確保所有必要的初始化步驟都有執行
- **範例**：CCXT exchange 重建後必須再次呼叫 `loadMarkets()`

### 4. 類型安全
- **禁止**：使用 `any` 繞過型別檢查
- **應該**：定義明確的介面（interface）來描述外部 API 回應結構

### 5. 配置可調性
- **禁止**：在程式碼中寫死魔術數字（magic numbers）
- **應該**：使用命名常數、類別屬性或建構函數參數

### 6. 命名清晰度
- 參數名稱應清楚表達其用途，避免歧義

### 7. 提交前驗證
- 提交到 main 之前必須通過 ESLint 和 TypeScript check
- 指令：`pnpm lint` + `pnpm exec tsc --noEmit`
- **重要**：commit 前應執行 `pnpm build` 確保所有引用的模組都存在，避免部署失敗
- **常見錯誤**：程式碼引用了未追蹤（untracked）的檔案，本地 TypeScript check 可能通過但部署時會失敗

### 8. Prisma 7 測試相容性
- **禁止**：在測試中直接使用 `new PrismaClient()` 初始化
- **應該**：使用專案提供的 `createPrismaClient()` 工廠函數
- **注意**：整合測試需要在測試檔案中加上 `// @vitest-environment node`

### 9. Prisma Migration 安全準則

#### 禁止事項
- ❌ **永遠不要修改已執行的 migration 檔案**（包括格式化、空白調整）
- ❌ **不要在本地執行 `prisma migrate dev` 後忘記提交**
- ❌ **不要直接從 schema.prisma 移除 model 而不產生 migration**

#### 正確做法
- ✅ **Schema 變更後立即執行 `prisma migrate dev`** 產生 migration 檔案
- ✅ **migration 檔案必須與 schema.prisma 一起 commit**
- ✅ **使用 IF EXISTS / IF NOT EXISTS** 讓 migration 可重複執行

#### 修復 Migration Drift 的標準流程
```bash
# 1. 查看 drift 狀態
pnpm prisma migrate status

# 2. 如果有 checksum 不符，更新資料庫中的 checksum
UPDATE _prisma_migrations SET checksum = '<new>' WHERE migration_name = '<name>';

# 3. 如果有孤兒 migration，刪除資料庫記錄
DELETE FROM _prisma_migrations WHERE migration_name = '<orphan>';
```

### 10. 修改現有程式碼的影響評估
- **必須**：修改已存在的程式碼前，仔細檢查是否會對舊有的 spec/feature 產生影響
- **必須**：清楚向開發者說明可能的影響範圍

### 11. CCXT 實例創建規範
- **禁止**：直接使用 `new ccxt.binance()` 或類似方式創建 CCXT 實例
- **應該**：使用 `src/lib/ccxt-factory.ts` 的工廠函數創建實例
- **統一工廠函數**：`createCcxtExchange(exchangeId, config)`, `createPublicExchange(exchangeId)`

### 12. 資金費率結算週期（Funding Interval）
- **重要事實**：所有交易所（Binance、OKX、Gate.io、BingX、MEXC）的資金費率結算週期都是**動態的**，支援 1h、4h、8h 三種週期
- **禁止**：假設任何交易所使用固定 8 小時週期
- **應該**：使用 `FundingIntervalCache` 或 `connector.getFundingInterval(symbol)` 動態取得
- **關鍵檔案**：
  - `src/lib/FundingIntervalCache.ts` - 快取各交易對的結算週期
  - `src/lib/FundingRate.ts` - `getNormalizedRate()` 標準化計算
- **WebSocket 流程**：必須在 `FundingRateReceived` 事件中包含 `fundingInterval` 欄位

## ⚠️ Speckit 工作流程強制要求 (NON-NEGOTIABLE)

**在執行 `/speckit.implement` 之前，必須嚴格遵守以下規則：**

1. **Constitution 合規性檢查** - 所有 7 項原則必須通過（參考 `.specify/memory/constitution.md`）
2. **TDD 強制執行** - tasks.md 必須包含 `[TEST]` 標記，測試先寫、先執行、先驗證 FAIL
3. **禁止事項**：跳過測試直接實作、schema.prisma 變更沒有對應的 migration 檔案

---

## Feature 參考

### Feature 033: Manual Open Position
- **核心服務**: `src/services/trading/PositionOrchestrator.ts` - Saga Pattern 雙邊開倉
- **API**: `POST /api/positions/open`, `GET /api/balances`

### Feature 035: Close Position (一鍵平倉)
- **核心服務**: `src/services/trading/PositionCloser.ts` - 雙邊平倉協調器
- **API**: `POST /api/positions/[id]/close`

### Feature 038: Stop Loss / Take Profit
- **核心服務**: `src/services/trading/ConditionalOrderService.ts` - 停損停利訂單
- **適配器**: `src/services/trading/adapters/` - 各交易所條件單適配器
- **API**: `GET/PATCH /api/settings/trading`
- **Data Model**: `TradingSettings`, `Position` 擴展欄位（stopLoss*, takeProfit*, conditionalOrderStatus）

### Feature 043: BingX 交易所整合
- **連接器**: `src/connectors/bingx.ts` - BingxConnector
- **條件單適配器**: `src/services/trading/adapters/BingxConditionalOrderAdapter.ts`
- **Symbol 格式**: 內部 `BTCUSDT`, CCXT `BTC/USDT:USDT`, API `BTC-USDT`

### Feature 050: 停損停利觸發偵測與自動平倉
- **核心服務**: `src/services/monitor/ConditionalOrderMonitor.ts` - 每 30 秒輪詢
- **環境變數**: `ENABLE_CONDITIONAL_ORDER_MONITOR=true`
- **Data Model**: `CloseReason` enum（MANUAL, LONG_SL_TRIGGERED, LONG_TP_TRIGGERED...）

### Feature 052: WebSocket 即時數據訂閱
- **核心服務**: `src/services/monitor/DataSourceManager.ts` - WebSocket/REST 混合策略
- **WebSocket 管理器**: `src/lib/websocket.ts`
- **API**: `GET /api/monitor/ws-status`

### Feature 060: 分單開倉（獨立持倉）
- **數量分配**: `src/lib/split-quantity.ts` - splitQuantity() 大組優先分配
- **限制**: 最大 10 組、每組不小於 0.0001

### Feature 065: ArbitrageOpportunity 即時追蹤
- **核心服務**: `src/services/monitor/ArbitrageOpportunityTracker.ts`
- **Repository**: `src/repositories/ArbitrageOpportunityRepository.ts`
- **API**: `GET /api/public/opportunities`

### Feature 068: Admin Dashboard
- **核心服務**: `src/services/admin/` - AdminAuthService, AdminUserService, AdminTradeService
- **API**: `/api/admin/*` - 管理員登入、用戶 CRUD、交易記錄
- **安全**: JWT Token + role 驗證、登入失敗 5 次鎖定 15 分鐘

### Feature 069: 分單持倉合併顯示與批量平倉
- **核心服務**: `src/services/trading/PositionGroupService.ts`
- **計算工具**: `src/lib/position-group.ts`
- **API**: `GET /api/positions?grouped=true`, `POST /api/positions/group/[groupId]/close`
- **Data Model**: `Position.groupId`, `CloseReason.BATCH_CLOSE`

---

## Testing

### 測試架構
```
tests/
├── unit/           # 單元測試 - 需要 PostgreSQL
├── integration/    # 整合測試 - 需要 PostgreSQL
├── hooks/          # React Query Hooks 測試
├── e2e/            # Playwright E2E 測試
└── performance/    # 效能測試
```

### 關鍵環境變數
| 變數 | 用途 |
|:-----|:-----|
| `RUN_INTEGRATION_TESTS=true` | 啟用整合測試 |
| `PERFORMANCE_TEST=true` | 啟用效能測試 |

### Production 環境變數（Debug 功能控制）
| 變數 | 預設值 | 說明 |
|:-----|:-------|:-----|
| `NODE_ENV` | `development` | `production` 時自動停用 ReactQueryDevtools |
| `ENABLE_MEMORY_MONITOR` | dev: `true`, prod: `false` | 記憶體使用量監控（每分鐘記錄） |
| `ENABLE_MEMORY_LEAK_TRACKER` | dev: `true`, prod: `false` | 記憶體洩漏追蹤（timers、handles、detached contexts） |

**注意**：Zeabur 等 production 環境會自動設定 `NODE_ENV=production`，debug 功能會自動停用。

## CI/CD

| 檔案 | 用途 | 觸發條件 |
|:-----|:-----|:---------|
| `.github/workflows/ci.yml` | Lint + 型別檢查 + 單元測試 | 每次 push/PR |
| `.github/workflows/integration.yml` | 整合測試（PostgreSQL） | push to main |
| `.github/workflows/e2e.yml` | Playwright E2E 測試 | push to main |

## Recent Changes
- 070-unified-groupid: Added TypeScript 5.8+ / Node.js 20.x LTS + Prisma 7.x, Next.js 15, React 19, CCXT 4.x
