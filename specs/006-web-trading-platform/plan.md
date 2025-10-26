# Implementation Plan: Web 多用戶套利交易平台

**Branch**: `006-web-trading-platform` | **Date**: 2025-10-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-web-trading-platform/spec.md`

## Summary

將現有的 CLI 套利監控工具重構為一個完整的 Web 多用戶平台。核心需求包括：

1. **多用戶系統**：支援用戶註冊、登入、會話管理（Email + Password 認證）
2. **API Key 管理**：安全的加密存儲和管理 Binance 和 OKX 的 API Key
3. **即時監控**：透過 WebSocket 推送即時套利機會給用戶瀏覽器
4. **手動交易**：一鍵開倉和平倉功能，同時在兩個交易所執行
5. **收益追蹤**：完整的歷史記錄、收益統計和趨勢圖表

**技術方法**：採用 Next.js 14 全棧架構（App Router + Server Actions），整合 Socket.io 提供即時數據推送，重用既有的套利偵測邏輯和交易所 API 封裝，擴展 PostgreSQL + TimescaleDB 資料庫以支援多用戶。

## Technical Context

**Language/Version**: TypeScript 5.3+ with Node.js 20.x LTS
**Primary Dependencies**:
- Frontend/Backend: Next.js 14 (App Router), React 18+, TailwindCSS 3+, shadcn/ui
- Real-time: Socket.io 4.x (server + client)
- Database: PostgreSQL 15+ with TimescaleDB extension (既有), Prisma 5.x ORM (既有)
- Authentication: bcrypt (密碼雜湊), jsonwebtoken (JWT Token)
- Encryption: Node.js crypto module (API Key 加密，AES-256-GCM)
- Exchange APIs: Binance Futures API, ccxt 4.x (OKX)
- Utilities: Decimal.js (金融計算), Pino (日誌), Zod (驗證)

**Storage**:
- PostgreSQL 15+ with TimescaleDB (既有)
- 新增表：User, ApiKey, Position, Trade, AuditLog
- 保留表：ArbitrageOpportunity, OpportunityHistory, NotificationLog

**Testing**:
- Unit: Vitest (既有)
- Integration: Vitest + Prisma migrations + Docker Compose PostgreSQL
- E2E: Playwright (新增，用於 Web UI 測試)
- Contract: API 合約測試（使用 OpenAPI schema 驗證）

**Target Platform**:
- Server: Linux server (Node.js 20.x LTS runtime)
- Client: Modern browsers (Chrome 90+, Firefox 88+, Safari 14+)
- Deployment: Vercel (推薦) 或自架 Docker container

**Project Type**: Web application (全棧)

**Performance Goals**:
- WebSocket 即時推送延遲 < 1 秒
- API 端點回應時間 < 200ms (p95)
- 同時支援 10+ 用戶線上使用
- 開倉/平倉操作總執行時間 < 5 秒

**Constraints**:
- API Key 加密/解密延遲 < 100ms
- 資料庫查詢回應時間 < 100ms (p95)
- WebSocket 連線穩定性 > 99%（1 小時內不斷線）
- 交易執行成功率 > 95%（排除餘額不足和網路問題）

**Scale/Scope**:
- 初期用戶數：< 10 人（小團隊內部使用）
- 支援交易對：USDT 永續合約（初期約 10-20 個交易對）
- 預期程式碼規模：~15,000 LOC (含測試)
- Web 頁面數：~8 個主要頁面（登入、註冊、API Key 管理、套利機會、持倉管理、交易歷史、收益統計、設定）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Core Principle I: Trading Safety First ✅

**Status**: PASS with mitigations

**Relevant Requirements from Spec**:
- FR-030: 系統必須同時在兩個交易所執行開倉操作（一個 Long，一個 Short）
- FR-034: 系統必須處理部分開倉失敗的情況（自動嘗試平倉已成功的部分）
- FR-029: 系統必須在執行開倉前驗證用戶在兩個交易所的可用餘額是否足夠
- FR-035: 系統必須防止並發開倉（用戶快速多次點擊開倉按鈕）

**Compliance**:
- ✅ Transaction compensation: 設計 `TradingService` 實作 Saga pattern（開倉失敗時自動回滾）
- ✅ Atomic dual-exchange operations: 使用事務性狀態機追蹤雙邊執行
- ✅ Balance validation: 在 `PositionValidator` 中實作預先驗證
- ✅ Position state persistence: 使用 Prisma Transaction 確保狀態原子性更新
- ✅ Explicit user confirmation: 所有交易都需要用戶在 UI 確認對話框中明確點擊「確認開倉」或「確認平倉」

**Design Decisions**:
- 實作 `TradeOrchestrator` 服務來協調雙邊交易和補償邏輯
- Position 狀態機：PENDING → OPENING → OPEN → CLOSING → CLOSED (或 FAILED/PARTIAL)
- 所有交易執行都寫入 AuditLog，包含每個步驟的時間戳和狀態

### Core Principle II: Complete Observability ✅

**Status**: PASS

**Compliance**:
- ✅ Structured logging: 繼續使用 Pino (既有)，擴展到所有新模組
- ✅ Error context: `ErrorHandler` middleware 統一錯誤格式（包含 exchange, symbol, timestamp, stack trace）
- ✅ Trade lifecycle tracing: 每個交易從偵測到平倉都有完整的日誌鏈（使用 correlation ID）
- ✅ Performance metrics: 記錄 API latency, execution time, funding rate update frequency
- ✅ No console.log: 強制使用 Pino logger

**Design Decisions**:
- 新增 `TelemetryService` 收集和聚合效能指標
- 實作請求 correlation ID（透過 middleware）來追蹤完整的請求鏈
- 所有關鍵操作（登入、API Key 變更、開倉、平倉）都寫入 AuditLog 表

### Core Principle III: Defensive Programming ✅

**Status**: PASS

**Compliance**:
- ✅ Retry logic: 使用既有的 `retryWithBackoff` 工具函式，應用於所有交易所 API 呼叫
- ✅ Graceful error handling: FR-056 明確要求最多 3 次重試，使用指數退避策略
- ✅ WebSocket reconnection: Socket.io 內建自動重連機制，設定 `reconnection: true`
- ✅ Data validation: 使用 Zod schemas 驗證所有來自交易所的資料和用戶輸入
- ✅ Graceful degradation: FR-058 要求單一交易所故障時暫停該交易所的機會偵測，但不影響其他功能

**Design Decisions**:
- 擴展既有的 `ExchangeConnector` 基礎類別，新增統一的錯誤處理和重試邏輯
- 實作 `CircuitBreaker` pattern 來防止對故障的交易所過度重試
- 設定驗證：使用 Zod schema 在啟動時驗證環境變數（fail-fast）

### Core Principle IV: Data Integrity ✅

**Status**: PASS

**Compliance**:
- ✅ Prisma migrations: 所有資料庫變更都透過 `prisma migrate dev` 產生遷移檔案
- ✅ TimescaleDB hypertables: 繼續使用既有的 hypertable 設計（FundingRateHistory, PriceHistory）
- ✅ Immutable records: FundingRateHistory 和 PriceHistory 保持 append-only
- ✅ State transitions: Position 表記錄狀態變化，OpportunityHistory 追蹤機會生命週期
- ✅ Decimal type: 所有金額計算使用 `Decimal.js`（既有標準）

**Design Decisions**:
- 新增的 Trade 表設計為 immutable（一旦平倉記錄建立就不可修改）
- Position 表使用 `status` 欄位追蹤狀態轉換，並記錄每次狀態變化的時間戳
- API Key 加密：使用 AES-256-GCM 模式，密鑰從環境變數讀取（`ENCRYPTION_KEY`）

### Core Principle V: Incremental Delivery ✅

**Status**: PASS

**Compliance**:
- ✅ MVP scope: 規格中明確定義 P1-P5 優先級，P1-P2 完成後即有可用的監控系統
- ✅ Independent testing: 每個 User Story 都有獨立的測試方法描述
- ✅ Testnet first: 開發計畫包含在 testnet 環境測試交易功能（P3-P4）後才上線
- ✅ E2E testing: 新增 Playwright E2E 測試覆蓋完整的用戶流程

**Design Decisions**:
- Phase 結構遵循規格的優先級：
  - **Phase 1 (P1)**: 用戶系統 + API Key 管理
  - **Phase 2 (P2)**: 即時監控 + WebSocket 推送
  - **Phase 3 (P3)**: 開倉功能（testnet 環境）
  - **Phase 4 (P4)**: 平倉功能（testnet 環境）
  - **Phase 5 (P5)**: 收益統計和歷史分析
- 每個 Phase 完成後都有獨立的測試和部署里程碑

### Trading Safety Requirements ⚠️

**Status**: PARTIAL - 需要額外設計

**Gaps Identified**:
- ⚠️ Maximum Position Size: 規格中假設固定槓桿倍數（Assumption #3），但憲法要求可配置的 position size limit
- ⚠️ Total Exposure Limit: 規格未明確提及總倉位限制
- ⚠️ Stop-Loss Enforcement: 規格的 Out of Scope #4 明確排除了止損功能
- ⚠️ Slippage Protection: 規格提到使用市價單可能有滑點（Assumption #5），但未設定門檻

**Mitigation**:
- Position Size Limit: 在設定頁面新增「單筆最大倉位」配置（預設 10,000 USDT），系統在開倉前驗證
- Total Exposure Limit: 新增用戶級別的「總倉位上限」配置，所有 OPEN 狀態的 Position 總和不得超過此值
- Stop-Loss: 標記為 **Phase 6 (未來版本)**，初期版本依賴用戶手動監控和平倉
- Slippage Protection: 在開倉前檢查預估滑點（基於 order book depth），超過 0.5% 時警告用戶並要求二次確認

**Constitution Compliance**: CONDITIONAL PASS
- 除了 Stop-Loss 功能延後到未來版本，其他要求都可以在當前設計中滿足
- Stop-Loss 的缺席需要在 Complexity Tracking 中說明

### Emergency Procedures ✅

**Status**: PASS

**Compliance**:
- ✅ Manual Override: Web UI 提供「強制平倉」功能，不受策略規則限制
- ✅ Circuit Breaker: 實作錯誤率監控，3 次失敗 / 5 分鐘自動暫停（符合憲法預設值）
- ⚠️ Notification Escalation: 規格的 Out of Scope #8 排除了 Telegram 通知

**Mitigation**:
- Telegram 通知標記為 **Phase 6 (未來版本)**
- 初期版本使用 Web 內通知 + Email 通知（新增到 Phase 5）

## Project Structure

### Documentation (this feature)

```
specs/006-web-trading-platform/
├── plan.md              # 本檔案 (技術實作計畫)
├── research.md          # Phase 0 產出 (技術決策研究)
├── data-model.md        # Phase 1 產出 (資料模型設計)
├── quickstart.md        # Phase 1 產出 (開發環境快速啟動指南)
├── contracts/           # Phase 1 產出 (API 合約定義)
│   ├── openapi.yaml     # REST API 規格
│   └── websocket.md     # WebSocket 事件規格
├── checklists/          # 品質檢查清單
│   └── requirements.md  # 規格品質檢查（已完成）
└── tasks.md             # Phase 2 產出 (/speckit.tasks 指令)
```

### Source Code (repository root)

由於這是一個 Next.js 14 全棧應用，採用 **App Router** 架構，前後端程式碼會整合在同一個專案中。同時需要保留既有的 CLI 工具和核心服務程式碼。

```
# Next.js 應用（新增）
app/                              # Next.js 14 App Router
├── (auth)/                       # 認證相關頁面群組
│   ├── login/
│   │   └── page.tsx              # 登入頁面
│   └── register/
│       └── page.tsx              # 註冊頁面
├── (dashboard)/                  # 需要認證的頁面群組
│   ├── layout.tsx                # Dashboard 共用 layout
│   ├── opportunities/
│   │   ├── page.tsx              # 套利機會列表頁面
│   │   └── [id]/
│   │       └── page.tsx          # 套利機會詳情頁面
│   ├── positions/
│   │   └── page.tsx              # 持倉管理頁面
│   ├── history/
│   │   └── page.tsx              # 交易歷史頁面
│   ├── stats/
│   │   └── page.tsx              # 收益統計頁面
│   └── settings/
│       ├── page.tsx              # 設定首頁
│       └── api-keys/
│           └── page.tsx          # API Key 管理頁面
├── api/                          # API Routes
│   ├── auth/
│   │   ├── register/
│   │   │   └── route.ts          # POST /api/auth/register
│   │   ├── login/
│   │   │   └── route.ts          # POST /api/auth/login
│   │   └── logout/
│   │       └── route.ts          # POST /api/auth/logout
│   ├── api-keys/
│   │   ├── route.ts              # GET/POST /api/api-keys
│   │   └── [id]/
│   │       └── route.ts          # GET/PATCH/DELETE /api/api-keys/:id
│   ├── opportunities/
│   │   ├── route.ts              # GET /api/opportunities
│   │   └── [id]/
│   │       └── route.ts          # GET /api/opportunities/:id
│   ├── positions/
│   │   ├── route.ts              # GET/POST /api/positions
│   │   └── [id]/
│   │       ├── route.ts          # GET /api/positions/:id
│   │       └── close/
│   │           └── route.ts      # POST /api/positions/:id/close
│   ├── trades/
│   │   └── route.ts              # GET /api/trades (交易歷史)
│   └── stats/
│       └── route.ts              # GET /api/stats (收益統計)
├── layout.tsx                    # 全域 layout
├── page.tsx                      # 首頁（導向 login 或 dashboard）
└── globals.css                   # 全域樣式

components/                       # React 元件（新增）
├── ui/                           # shadcn/ui 基礎元件
│   ├── button.tsx
│   ├── input.tsx
│   ├── dialog.tsx
│   ├── table.tsx
│   └── ...                       # 其他 shadcn/ui 元件
├── auth/
│   ├── LoginForm.tsx             # 登入表單元件
│   └── RegisterForm.tsx          # 註冊表單元件
├── opportunities/
│   ├── OpportunityList.tsx       # 套利機會列表元件
│   ├── OpportunityCard.tsx       # 單個套利機會卡片
│   └── OpenPositionDialog.tsx    # 開倉確認對話框
├── positions/
│   ├── PositionList.tsx          # 持倉列表元件
│   └── ClosePositionDialog.tsx   # 平倉確認對話框
├── stats/
│   ├── RevenueChart.tsx          # 收益趨勢圖表
│   └── StatsSummary.tsx          # 統計摘要元件
└── common/
    ├── Navbar.tsx                # 導航欄
    ├── Sidebar.tsx               # 側邊欄
    └── LoadingSpinner.tsx        # 載入動畫

# 既有核心程式碼（保留並擴展）
src/
├── models/                       # 領域模型（保留並擴展）
│   ├── ArbitrageOpportunity.ts   # ✅ 既有
│   ├── OpportunityHistory.ts     # ✅ 既有
│   ├── User.ts                   # ⭐ 新增
│   ├── ApiKey.ts                 # ⭐ 新增
│   ├── Position.ts               # ⭐ 新增
│   ├── Trade.ts                  # ⭐ 新增
│   └── AuditLog.ts               # ⭐ 新增
├── services/                     # 業務邏輯服務（保留並擴展）
│   ├── monitor/
│   │   └── OpportunityDetector.ts  # ✅ 既有（核心偵測邏輯）
│   ├── trading/                  # ⭐ 新增：交易執行服務
│   │   ├── TradeOrchestrator.ts  # 協調雙邊交易和補償
│   │   ├── PositionManager.ts    # 持倉管理
│   │   └── PositionValidator.ts  # 開倉前驗證（餘額、限額）
│   ├── auth/                     # ⭐ 新增：認證服務
│   │   ├── AuthService.ts        # 註冊、登入、會話管理
│   │   └── SessionManager.ts     # JWT Token 管理
│   ├── apikey/                   # ⭐ 新增：API Key 管理服務
│   │   ├── ApiKeyService.ts      # 新增、驗證、加密/解密
│   │   └── ApiKeyValidator.ts    # 驗證 API Key 有效性和權限
│   ├── notification/
│   │   ├── NotificationService.ts  # ✅ 既有（擴展支援 Web 推送）
│   │   └── channels/
│   │       ├── TerminalChannel.ts  # ✅ 既有
│   │       ├── LogChannel.ts       # ✅ 既有
│   │       └── WebSocketChannel.ts # ⭐ 新增
│   └── validation/
│       └── FundingRateValidator.ts  # ✅ 既有
├── repositories/                 # 資料存取層（保留並擴展）
│   ├── ArbitrageOpportunityRepository.ts  # ✅ 既有
│   ├── OpportunityHistoryRepository.ts    # ✅ 既有
│   ├── NotificationLogRepository.ts       # ✅ 既有
│   ├── UserRepository.ts         # ⭐ 新增
│   ├── ApiKeyRepository.ts       # ⭐ 新增
│   ├── PositionRepository.ts     # ⭐ 新增
│   ├── TradeRepository.ts        # ⭐ 新增
│   └── AuditLogRepository.ts     # ⭐ 新增
├── connectors/                   # 交易所 API 適配器（保留並改造）
│   ├── ExchangeConnector.ts      # ✅ 既有基礎類別（擴展支援多用戶 API Key）
│   ├── BinanceConnector.ts       # ✅ 既有（改造支援用戶級 API Key）
│   └── OkxConnector.ts           # ✅ 既有（改造支援用戶級 API Key）
├── lib/                          # 工具函式（保留並擴展）
│   ├── logger.ts                 # ✅ 既有 (Pino logger)
│   ├── config.ts                 # ✅ 既有
│   ├── retry.ts                  # ✅ 既有 (retryWithBackoff)
│   ├── debounce.ts               # ✅ 既有
│   ├── encryption.ts             # ⭐ 新增 (AES-256-GCM API Key 加密)
│   ├── jwt.ts                    # ⭐ 新增 (JWT Token 產生和驗證)
│   ├── validation.ts             # ⭐ 新增 (Zod schemas)
│   └── errors.ts                 # ⭐ 新增 (統一錯誤類別)
├── websocket/                    # ⭐ 新增：WebSocket 服務
│   ├── SocketServer.ts           # Socket.io 伺服器初始化
│   ├── handlers/
│   │   ├── OpportunityHandler.ts # 套利機會即時推送
│   │   └── PositionHandler.ts    # 持倉更新即時推送
│   └── middleware/
│       └── AuthMiddleware.ts     # WebSocket 連線認證
├── middleware/                   # ⭐ 新增：HTTP 中介軟體
│   ├── authMiddleware.ts         # API Routes 認證檢查
│   ├── errorHandler.ts           # 統一錯誤處理
│   └── correlationId.ts          # 請求追蹤 ID
├── types/                        # TypeScript 型別定義（保留並擴展）
│   ├── events.ts                 # ✅ 既有
│   ├── opportunity-detection.ts  # ✅ 既有
│   ├── service-interfaces.ts     # ✅ 既有
│   ├── auth.ts                   # ⭐ 新增
│   ├── trading.ts                # ⭐ 新增
│   └── websocket.ts              # ⭐ 新增
└── cli/                          # ✅ 既有 CLI 工具（保留，暫時與 Web 並存）
    └── index.ts

# 資料庫（擴展）
prisma/
├── schema.prisma                 # ⭐ 擴展：新增 User, ApiKey, Position, Trade, AuditLog 模型
└── migrations/
    └── 20251027_add_web_platform_models/  # ⭐ 新增遷移

# 測試（擴展）
tests/
├── unit/                         # ✅ 既有（擴展覆蓋新模組）
│   ├── services/
│   │   ├── auth/
│   │   │   └── AuthService.test.ts       # ⭐ 新增
│   │   ├── trading/
│   │   │   ├── TradeOrchestrator.test.ts # ⭐ 新增
│   │   │   └── PositionValidator.test.ts # ⭐ 新增
│   │   └── ...
│   └── lib/
│       ├── encryption.test.ts    # ⭐ 新增
│       └── jwt.test.ts           # ⭐ 新增
├── integration/                  # ✅ 既有（擴展覆蓋新 API）
│   ├── auth/
│   │   └── auth.test.ts          # ⭐ 新增（註冊/登入流程）
│   ├── api-keys/
│   │   └── api-keys.test.ts      # ⭐ 新增（API Key CRUD）
│   ├── trading/
│   │   ├── open-position.test.ts # ⭐ 新增（開倉流程）
│   │   └── close-position.test.ts # ⭐ 新增（平倉流程）
│   └── ...
├── e2e/                          # ⭐ 新增：Playwright E2E 測試
│   ├── auth.spec.ts              # 註冊/登入流程
│   ├── api-keys.spec.ts          # API Key 管理流程
│   ├── opportunities.spec.ts     # 監控套利機會流程
│   ├── trading.spec.ts           # 開倉/平倉流程
│   └── stats.spec.ts             # 收益統計查看流程
└── contract/                     # ⭐ 新增：API 合約測試
    ├── api/
    │   └── openapi.test.ts       # 驗證 API 回應符合 OpenAPI schema
    └── websocket/
        └── events.test.ts        # 驗證 WebSocket 事件格式

# 配置檔案（新增和更新）
next.config.js                    # ⭐ 新增：Next.js 配置
tailwind.config.js                # ⭐ 新增：TailwindCSS 配置
tsconfig.json                     # ✅ 既有（更新以支援 Next.js）
.env.example                      # ✅ 既有（擴展新增的環境變數）
playwright.config.ts              # ⭐ 新增：Playwright E2E 測試配置
```

**Structure Decision**:

採用 **Next.js 14 全棧架構（App Router）** 與 **既有核心服務並存** 的混合結構：

1. **前端和 API Routes**: 放在專案根目錄的 `app/` 和 `components/` 目錄中，遵循 Next.js 14 App Router 標準結構
2. **核心業務邏輯**: 保留在既有的 `src/` 目錄中，包含 models, services, repositories, connectors
3. **共用工具**: 既有的 `src/lib/` 工具函式可以被 Next.js API Routes 和前端元件共用
4. **測試**: 既有的 `tests/` 目錄擴展，新增 E2E 和合約測試

**優點**：
- ✅ 最大化重用既有程式碼（OpportunityDetector, ExchangeConnector, Repository 層）
- ✅ Next.js 全棧架構簡化部署（前後端一體）
- ✅ 保留 CLI 工具供開發和除錯使用
- ✅ 漸進式遷移（可以先完成 Web UI，逐步淘汰 CLI）

**注意事項**：
- Next.js 的 API Routes 會呼叫 `src/services/` 中的既有業務邏輯
- WebSocket 服務（Socket.io）需要自訂 Next.js server（在 `server.ts` 中初始化）
- 資料庫連線使用既有的 Prisma Client 單例模式

## Complexity Tracking

*Constitution violations that require justification:*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Trading Safety: Stop-Loss 功能延後 | 規格明確排除進階風險管理功能（Out of Scope #4），初期版本專注於手動交易和監控 | 自動止損需要複雜的觸發邏輯、回測驗證和額外的測試成本，不符合 MVP 範圍。用戶可以透過手動監控和平倉來管理風險。 |
| Emergency Procedures: Telegram 通知延後 | 規格明確排除 Email/Telegram 通知（Out of Scope #8），初期版本使用 Web 內通知 | Telegram Bot 整合需要額外的基礎設施（Bot Token, Chat ID 管理）和測試。Web 內通知已足以支援小團隊使用。Email 通知可在 Phase 5 或 Phase 6 加入。 |

**Mitigation Strategy**:

1. **Stop-Loss 替代方案**（Phase 1-5）：
   - 在持倉管理頁面清楚顯示即時 PnL，使用顏色標示虧損程度（綠色獲利、黃色小虧、紅色大虧）
   - 當未實現虧損超過 -10% 時，在 UI 顯示警告提示
   - 提供「一鍵平倉所有虧損倉位」功能

2. **Telegram 通知替代方案**（Phase 1-5）：
   - Web 內通知使用 WebSocket 即時推送關鍵事件（開倉成功、平倉成功、錯誤警告）
   - 使用瀏覽器通知 API（需要用戶授權）來推送桌面通知
   - 在 Phase 5 或 Phase 6 加入 Email 通知作為補充

3. **未來版本規劃**（Phase 6+）：
   - 實作自動止損功能（基於百分比或絕對金額）
   - 整合 Telegram Bot 支援即時通知
   - 新增追蹤止損功能

**Justification**: 這些延後的功能都不影響核心的套利交易流程（監控 → 開倉 → 平倉 → 收益追蹤），且規格明確將它們排除在初期範圍外。專注於 MVP 可以更快交付價值給用戶，並在實際使用後根據反饋決定是否需要這些進階功能。
