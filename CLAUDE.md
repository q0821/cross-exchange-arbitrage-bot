# cross-exchange-arbitrage-bot Development Guidelines

## Active Technologies
- TypeScript 5.8 + Node.js 20.x LTS
- Next.js 15, React 19, Tailwind CSS, Radix UI, Socket.io 4.8.1
- Prisma 7.x (ORM), CCXT 4.x (多交易所抽象)
- PostgreSQL 15+ with TimescaleDB extension
- Vitest 4.x, Decimal.js, TanStack Query 5.x
- TypeScript 5.8 + Node.js 20.x LTS + Pino (logger)、既有 MonitorStatsTracker、getMemoryStats()、DataSourceManager (071-cli-status-dashboard)
- N/A（僅讀取現有資料，不持久化） (071-cli-status-dashboard)

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

## 記憶體洩漏排查與修復經驗

### 背景

運行 3 小時後，Heap 從 750 MB 穩定增長到 1.2 GB，峰值達 2 GB。透過 Heap Snapshot 分析發現 string/array/object 物件持續大量創建。

### 排查工具

1. **記憶體監控日誌**：`logs/memory/YYYY-MM-DD.log`
2. **Heap Snapshot 分析**：`pnpm tsx scripts/diagnostics/analyze-heap.ts <snapshot-file>`
3. **資料結構統計**：查看 `DataStructureRegistry` 中各服務的 sizes 和 listeners

### 常見記憶體洩漏模式

#### 1. 高頻物件重建（P0 優先級）

**問題**：每 N 秒全量重建物件，即使資料未變更
```typescript
// ❌ 錯誤：每次都重建所有物件
private formatRates(rates: any[]): any[] {
  return rates.map(rate => ({ ...格式化邏輯 }));
}
```

**解法**：差異快取，只在資料變更時重建
```typescript
// ✅ 正確：使用 hash 比對，快取未變更的物件
private lastFormattedRates: Map<string, FormattedRate> = new Map();
private lastRatesHash: Map<string, string> = new Map();

private formatRates(rates: any[]): FormattedRate[] {
  for (const rate of rates) {
    const hash = this.computeRateHash(rate);
    if (hash === this.lastRatesHash.get(rate.symbol)) {
      result.push(this.lastFormattedRates.get(rate.symbol)!);
      continue;
    }
    // 只有變更時才重建
    const formatted = this.buildFormattedRate(rate);
    this.lastFormattedRates.set(rate.symbol, formatted);
    this.lastRatesHash.set(rate.symbol, hash);
    result.push(formatted);
  }
  return result;
}
```

#### 2. 重複呼叫相同方法（P1 優先級）

**問題**：同一週期內多次呼叫 `getAll()` 等方法
```typescript
// ❌ 錯誤：getAll() 被呼叫兩次
const rates = ratesCache.getAll();
const stats = ratesCache.getStats(); // 內部又呼叫 getAll()
```

**解法**：參數化方法，允許傳入已有資料
```typescript
// ✅ 正確：傳入 rates 避免重複呼叫
const rates = ratesCache.getAll();
const stats = ratesCache.getStats(rates);
```

#### 3. 無限增長的快取（P1 優先級）

**問題**：快取只增不減，沒有大小限制
```typescript
// ❌ 錯誤：無限增長
this.markPriceCache.set(symbol, markPrice);
```

**解法**：實作 LRU 淘汰機制
```typescript
// ✅ 正確：LRU 快取（利用 Map 的插入順序）
private readonly MAX_CACHE_SIZE = 500;

// 刪除再插入確保順序（LRU）
this.markPriceCache.delete(symbol);
this.markPriceCache.set(symbol, markPrice);

// 超過限制時淘汰最舊項目
if (this.markPriceCache.size > this.MAX_CACHE_SIZE) {
  const firstKey = this.markPriceCache.keys().next().value;
  if (firstKey) this.markPriceCache.delete(firstKey);
}
```

#### 4. Event Listener 累積

**問題**：重複註冊監聽器未正確清理
```typescript
// ❌ 錯誤：每次連線都註冊新監聽器
socket.on('event', handler);
```

**解法**：追蹤已註冊狀態，斷線時清理
```typescript
// ✅ 正確：使用 WeakSet 追蹤，防止重複註冊
private registeredSockets: WeakSet<Socket> = new WeakSet();
private socketListeners: WeakMap<Socket, SocketListeners> = new WeakMap();

register(socket: Socket): void {
  if (this.registeredSockets.has(socket)) return; // 防止重複
  // ...註冊監聯器
  this.registeredSockets.add(socket);
  this.socketListeners.set(socket, { ...handlers });
}

unregister(socket: Socket): void {
  const listeners = this.socketListeners.get(socket);
  if (!listeners) return;
  socket.off('event', listeners.handler); // 清理
  this.socketListeners.delete(socket);
  this.registeredSockets.delete(socket);
}
```

### 記憶體監控環境變數

| 環境變數 | 預設值 | 說明 |
|:---------|:-------|:-----|
| `ENABLE_MEMORY_MONITOR` | `true` | 是否啟用記憶體監控 |
| `MEMORY_MONITOR_INTERVAL_MS` | `300000` | 監控間隔（5 分鐘） |
| `ENABLE_HEAP_SNAPSHOT` | `false` | 是否啟用 heap snapshot（效能影響大） |
| `HEAP_SNAPSHOT_THRESHOLD_MB` | `100` | Heap 增長閾值才觸發 snapshot |

### 診斷指令

```bash
# 查看最新記憶體快照
tail -1 logs/memory/$(date +%Y-%m-%d).log | jq .

# 查看 Heap 趨勢（應該穩定，不持續增長）
cat logs/memory/$(date +%Y-%m-%d).log | jq -r '.heap.used' | tail -20

# 查看 Event Listeners 數量（應該穩定）
cat logs/memory/$(date +%Y-%m-%d).log | jq -r '.summary.totalEventListeners' | uniq

# 查看增長最快的資料結構
tail -1 logs/memory/$(date +%Y-%m-%d).log | jq '.summary.topGrowers'

# 臨時啟用 heap snapshot 進行深度分析
ENABLE_HEAP_SNAPSHOT=true MEMORY_MONITOR_INTERVAL_MS=60000 pnpm dev
```

### 關鍵檔案

| 檔案 | 用途 |
|:-----|:-----|
| `src/lib/memory-monitor.ts` | 記憶體監控核心 |
| `src/lib/heap-snapshot.ts` | Heap snapshot 抓取與分析 |
| `src/lib/data-structure-registry.ts` | 資料結構註冊與統計 |
| `docs/logging-and-memory-monitoring.md` | 完整文檔 |

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

## CI/CD

| 檔案 | 用途 | 觸發條件 |
|:-----|:-----|:---------|
| `.github/workflows/ci.yml` | Lint + 型別檢查 + 單元測試 | 每次 push/PR |
| `.github/workflows/integration.yml` | 整合測試（PostgreSQL） | push to main |
| `.github/workflows/e2e.yml` | Playwright E2E 測試 | push to main |

## Recent Changes
- 071-cli-status-dashboard: Added TypeScript 5.8 + Node.js 20.x LTS + Pino (logger)、既有 MonitorStatsTracker、getMemoryStats()、DataSourceManager
