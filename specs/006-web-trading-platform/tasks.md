# Implementation Tasks: Web 多用戶套利交易平台

**Feature**: 006-web-trading-platform
**Branch**: `006-web-trading-platform`
**Date**: 2025-10-27

## 概述

本文件定義 Web 多用戶套利交易平台的完整開發任務清單。任務按用戶故事優先級組織，確保每個階段都是獨立可測試和可交付的增量。

**總任務數**: 98 個任務
**預估總工時**: 120-150 小時（3-4 週，全職開發）

---

## 用戶故事對應

| Phase | User Story | 優先級 | 任務數 | 預估工時 |
|-------|-----------|-------|-------|---------|
| Phase 1 | Setup | N/A | 8 | 4-6 小時 |
| Phase 2 | Foundational | N/A | 12 | 8-12 小時 |
| Phase 3 | P1: 用戶註冊和 API Key 設定 | P1 | 15 | 20-25 小時 |
| Phase 4 | P2: 即時套利機會監控 | P2 | 12 | 15-20 小時 |
| Phase 5 | P3: 手動開倉執行 | P3 | 13 | 25-30 小時 |
| Phase 6 | P4: 手動平倉執行 | P4 | 10 | 20-25 小時 |
| Phase 7 | P5: 歷史收益和統計 | P5 | 8 | 15-20 小時 |

---

## Phase 1: Setup（專案初始化）

**目標**: 設定 Next.js 14 全棧專案、整合 Socket.io、配置 TypeScript 和測試環境

### Tasks

- [x] T001 安裝 Next.js 14 依賴：執行 `pnpm add next@14 react@18 react-dom@18`
- [x] T002 安裝 Socket.io 依賴：執行 `pnpm add socket.io@4 socket.io-client@4`
- [x] T003 安裝認證依賴：執行 `pnpm add bcrypt@5 jsonwebtoken@9 @types/bcrypt @types/jsonwebtoken`
- [x] T004 安裝 UI 依賴：執行 `pnpm add tailwindcss@3 @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-tabs`
- [x] T005 安裝圖表依賴：執行 `pnpm add recharts@2`
- [x] T006 安裝驗證依賴：執行 `pnpm add zod@3`
- [x] T007 安裝測試依賴：執行 `pnpm add -D playwright@1 @playwright/test`
- [x] T008 建立 Next.js 配置檔案 `next.config.js` 和 TailwindCSS 配置 `tailwind.config.js`

### 驗收標準

- ✅ 所有依賴安裝成功
- ✅ `pnpm dev` 可以啟動（即使顯示預設 Next.js 頁面）
- ✅ TypeScript 編譯無錯誤

---

## Phase 2: Foundational（基礎設施）

**目標**: 建立共用的基礎設施，包含資料庫 Schema、工具函式、中介軟體等，這些是所有用戶故事的前置依賴

### Tasks

#### 資料庫 Schema（T009-T011）

- [x] T009 更新 Prisma Schema：在 `prisma/schema.prisma` 中新增 User, ApiKey, Position, Trade, AuditLog 模型
- [x] T010 更新 ArbitrageOpportunity 模型：新增 longExchange 和 shortExchange 欄位到 `prisma/schema.prisma`
- [x] T011 建立並執行資料庫遷移：`pnpm prisma db push` (開發環境使用)

#### 工具函式（T012-T016，可並行）

- [x] T012 [P] 實作 API Key 加密工具：在 `src/lib/encryption.ts` 中實作 AES-256-GCM 加密/解密函式
- [x] T013 [P] 實作 JWT 工具：在 `src/lib/jwt.ts` 中實作 Token 產生、驗證和解析函式
- [x] T014 [P] 建立 Zod 驗證 Schema：在 `src/lib/validation.ts` 中定義 Email、密碼、API Key 等驗證規則
- [x] T015 [P] 建立統一錯誤類別：在 `src/lib/errors.ts` 中擴展既有錯誤類別以支援 Web 平台
- [x] T016 [P] 實作 Correlation ID 工具：在 `src/lib/correlationId.ts` 中實作請求追蹤 ID 產生函式

#### HTTP 中介軟體（T017-T019，可並行）

- [x] T017 [P] 實作認證中介軟體：在 `src/middleware/authMiddleware.ts` 中驗證 JWT Token（從 Cookie 讀取）
- [x] T018 [P] 實作錯誤處理中介軟體：在 `src/middleware/errorHandler.ts` 中統一處理錯誤並回傳標準格式
- [x] T019 [P] 實作 Correlation ID 中介軟體：在 `src/middleware/correlationIdMiddleware.ts` 中為每個請求產生追蹤 ID

#### WebSocket 基礎（T020）

- [x] T020 建立 Socket.io 伺服器：在 `src/websocket/SocketServer.ts` 中初始化 Socket.io 並實作認證中介軟體

### 驗收標準

- ✅ 資料庫遷移成功，所有表都已建立
- ✅ `pnpm prisma studio` 可以查看新表
- ✅ 工具函式單元測試通過（如果有編寫測試）
- ✅ Socket.io 伺服器可以啟動並接受連線

---

## Phase 3: User Story 1 - 用戶註冊和 API Key 設定 (P1)

**目標**: 實作完整的用戶認證系統和 API Key 管理功能

**獨立測試標準**: 用戶可以註冊、登入、新增/查看/刪除 API Key，且 API Key 被加密儲存

### Tasks

#### 領域模型（T021-T022，可並行）

- [x] T021 [P] [US1] 建立 User 模型：在 `src/models/User.ts` 中實作 User 領域邏輯（密碼驗證等）
- [x] T022 [P] [US1] 建立 ApiKey 模型：在 `src/models/ApiKey.ts` 中實作 ApiKey 領域邏輯（遮罩顯示等）

#### Repository 層（T023-T024，可並行）

- [x] T023 [P] [US1] 建立 UserRepository：在 `src/repositories/UserRepository.ts` 中實作用戶 CRUD 操作
- [x] T024 [P] [US1] 建立 ApiKeyRepository：在 `src/repositories/ApiKeyRepository.ts` 中實作 API Key CRUD 操作

#### Service 層（T025-T027a）

- [x] T025 [US1] 實作 AuthService：在 `src/services/auth/AuthService.ts` 中實作註冊、登入、登出邏輯
- [x] T026 [US1] 實作 SessionManager：在 `src/services/auth/SessionManager.ts` 中實作 JWT Token 管理
- [x] T027 [US1] 實作 ApiKeyService：在 `src/services/apikey/ApiKeyService.ts` 中實作 API Key 新增、驗證、加密/解密邏輯
- [ ] T027a [US1] 實作 ApiKeyValidator：在 `src/services/apikey/ApiKeyValidator.ts` 中實作 API Key 權限驗證邏輯
  - 驗證 API Key 是否具有必要的交易權限（讀取帳戶資訊、開倉、平倉）- 對應 FR-012
  - 透過呼叫交易所 API 測試連線並檢查權限（如 Binance `/fapi/v2/account`、OKX `/api/v5/account/balance`）
  - 記錄驗證結果和權限詳情到 AuditLog

#### API Routes（T028-T032，部分可並行）

- [x] T028 [P] [US1] 實作註冊 API：在 `app/api/auth/register/route.ts` 中處理 POST /api/auth/register
- [x] T029 [P] [US1] 實作登入 API：在 `app/api/auth/login/route.ts` 中處理 POST /api/auth/login
- [x] T030 [P] [US1] 實作登出 API：在 `app/api/auth/logout/route.ts` 中處理 POST /api/auth/logout
- [x] T031 [US1] 實作 API Keys 列表和新增：在 `app/api/api-keys/route.ts` 中處理 GET/POST /api/api-keys
- [x] T032 [US1] 實作 API Key 詳情和刪除：在 `app/api/api-keys/[id]/route.ts` 中處理 GET/PATCH/DELETE /api/api-keys/:id

#### 前端頁面（T033-T035，可並行）

- [x] T033 [P] [US1] 建立登入頁面：在 `app/(auth)/login/page.tsx` 中實作登入表單和 UI
- [x] T034 [P] [US1] 建立註冊頁面：在 `app/(auth)/register/page.tsx` 中實作註冊表單和 UI
- [x] T035 [US1] 建立 API Key 管理頁面：在 `app/(dashboard)/settings/api-keys/page.tsx` 中實作 API Key 列表、新增、刪除 UI

### 驗收標準（獨立可測試）

**手動測試流程**:
1. ✅ 訪問 `/register`，輸入 Email 和密碼，成功註冊
2. ✅ 訪問 `/login`，輸入剛註冊的帳號，成功登入
3. ✅ 訪問 `/settings/api-keys`，看到空的 API Key 列表
4. ✅ 點擊「新增 API Key」，輸入 Binance API Key 資訊，成功新增
5. ✅ 在列表中看到新增的 API Key（Key 部分遮罩，如 "kMzF****dE2p"）
6. ✅ 點擊「刪除」，成功刪除 API Key
7. ✅ 登出後無法訪問 `/settings/api-keys`（跳轉到登入頁面）

**資料庫驗證**:
- ✅ `users` 表中有新註冊的用戶
- ✅ 密碼經過 bcrypt 雜湊（無法直接看到明文）
- ✅ `api_keys` 表中的 `encryptedKey` 和 `encryptedSecret` 是加密後的內容（不是明文）

---

## Phase 4: User Story 2 - 即時套利機會監控 (P2)

**目標**: 實作 WebSocket 即時推送套利機會給已登入用戶

**獨立測試標準**: 用戶登入後可以在 Web 界面看到即時更新的套利機會列表（每秒更新），顯示價格、費率、預期收益率和開多/開空交易所

**依賴**: P1 完成（需要用戶認證）

### Tasks

#### Repository 層（T036）

- [x] T036 [US2] 建立 ArbitrageOpportunityRepository：在 `src/repositories/ArbitrageOpportunityRepository.ts` 中擴展查詢方法（已存在）

#### WebSocket Handlers（T037-T038）

- [x] T037 [US2] 實作 OpportunityHandler：在 `src/websocket/handlers/OpportunityHandler.ts` 中處理套利機會訂閱和推送邏輯
- [x] T038 [US2] 註冊 WebSocket Handlers：在 `src/websocket/SocketServer.ts` 中註冊 OpportunityHandler

#### Service 層（T039-T040）

- [x] T039 [US2] 擴展 OpportunityDetector：在既有的 `src/services/monitor/OpportunityDetector.ts` 中新增 WebSocket 推送邏輯（透過 WebSocketChannel）
- [x] T040 [US2] 建立 WebSocketChannel：在 `src/services/notification/channels/WebSocketChannel.ts` 中實作 WebSocket 通知渠道

#### API Routes（T041）

- [x] T041 [US2] 實作套利機會列表 API：在 `app/api/opportunities/route.ts` 中處理 GET /api/opportunities

#### 前端頁面和元件（T042-T046，部分可並行）

- [x] T042 [P] [US2] 建立 useWebSocket Hook：在 `hooks/useWebSocket.ts` 中封裝 Socket.io 客戶端邏輯
- [x] T043 [P] [US2] 建立 OpportunityCard 元件：在 `components/opportunities/OpportunityCard.tsx` 中顯示單個套利機會
- [x] T044 [P] [US2] 建立 OpportunityList 元件：在 `components/opportunities/OpportunityList.tsx` 中顯示機會列表並監聽 WebSocket 更新
- [x] T045 [US2] 建立套利機會列表頁面：在 `app/(dashboard)/opportunities/page.tsx` 中整合 OpportunityList 元件
- [x] T046 [US2] 建立套利機會詳情頁面：在 `app/(dashboard)/opportunities/[id]/page.tsx` 中顯示單個機會詳情

#### 自訂 Next.js Server（T047）

- [x] T047 [US2] 建立自訂 Server：在 `server.ts` 中整合 Next.js 和 Socket.io（共用 port）

### 驗收標準（獨立可測試）

**手動測試流程**:
1. ✅ 啟動開發伺服器 `pnpm dev`（使用自訂 server.ts）
2. ✅ 登入後訪問 `/opportunities`，看到套利機會列表
3. ✅ 打開瀏覽器 Console，看到 WebSocket 連線成功訊息（"Connected to server"）
4. ✅ 觀察列表中的價格和費率每秒自動更新（無需重新整理頁面）
5. ✅ 看到每個機會清楚標示「在 [交易所 A] 開多，在 [交易所 B] 開空」
6. ✅ 點擊某個機會，進入詳情頁面，看到完整資訊（兩個交易所的價格、費率、預期年化收益率）
7. ✅ 模擬新機會產生（可透過手動插入資料庫記錄），確認頁面即時顯示新機會

**WebSocket 測試** (瀏覽器 Console):
```javascript
// 應該看到這些事件
socket.on('opportunity:new', (data) => console.log('New:', data));
socket.on('opportunity:update', (data) => console.log('Update:', data));
socket.on('opportunity:expired', (data) => console.log('Expired:', data));
```

---

## Phase 5: User Story 3 - 手動開倉執行 (P3)

**目標**: 實作一鍵開倉功能，同時在兩個交易所開立對沖倉位

**獨立測試標準**: 用戶可以選擇套利機會、輸入倉位大小、確認後系統同時在兩個交易所開倉，並在「持倉管理」頁面看到新倉位

**依賴**: P1 和 P2 完成（需要用戶認證和 API Key）

### Tasks

#### 領域模型（T048）

- [ ] T048 [US3] 建立 Position 模型：在 `src/models/Position.ts` 中實作 Position 領域邏輯（狀態機、PnL 計算等）

#### Repository 層（T049-T050）

- [ ] T049 [US3] 建立 PositionRepository：在 `src/repositories/PositionRepository.ts` 中實作持倉 CRUD 操作
- [ ] T050 [US3] 建立 AuditLogRepository：在 `src/repositories/AuditLogRepository.ts` 中實作審計日誌記錄

#### Service 層（T051-T054b）

- [ ] T051 [US3] 擴展 ExchangeConnector：改造 `src/connectors/ExchangeConnector.ts` 支援動態注入用戶 API Key
- [ ] T052 [US3] 實作 PositionValidator：在 `src/services/trading/PositionValidator.ts` 中實作開倉前驗證
  - 餘額驗證：依照 plan.md 的「Trading Parameters & Validation Logic」實作餘額檢查（對應 FR-029）
  - 限額驗證：檢查單筆倉位和總倉位是否超過用戶配置的上限
  - API Key 驗證：確認 API Key 有效且具有交易權限
- [ ] T053 [US3] 實作 TradeOrchestrator：在 `src/services/trading/TradeOrchestrator.ts` 中協調雙邊開倉和補償邏輯（Saga pattern）
- [ ] T054 [US3] 實作 PositionManager：在 `src/services/trading/PositionManager.ts` 中實作持倉管理邏輯
- [ ] T054a [US3] 實作 FundingRateAccumulator：在 `src/services/trading/FundingRateAccumulator.ts` 中實作資金費率累計計算服務（對應 FR-044）
  - 追蹤持倉期間的資金費率結算（每 8 小時）
  - 計算累計資金費率收支並更新到 Position 記錄
  - 提供即時查詢接口供 PnL 計算使用
- [ ] T054b [US3] 實作開倉防抖動機制（對應 FR-034）
  - 前端：在 OpenPositionDialog 中實作按鈕禁用邏輯（點擊後禁用 5 秒或操作完成）
  - 後端：在 TradeOrchestrator 中使用 Redis 分散式鎖確保同一用戶同一時間只能執行一次開倉操作
  - 記錄並發嘗試到 AuditLog

#### API Routes（T055-T056）

- [ ] T055 [US3] 實作開倉 API：在 `app/api/positions/route.ts` 中處理 POST /api/positions
- [ ] T056 [US3] 實作持倉列表和詳情 API：在 `app/api/positions/route.ts` 和 `app/api/positions/[id]/route.ts` 中處理 GET /api/positions

#### WebSocket Handlers（T057）

- [ ] T057 [US3] 實作 PositionHandler：在 `src/websocket/handlers/PositionHandler.ts` 中處理持倉更新推送

#### 前端元件和頁面（T058-T060，可並行）

- [ ] T058 [P] [US3] 建立 OpenPositionDialog 元件：在 `components/opportunities/OpenPositionDialog.tsx` 中實作開倉確認對話框
- [ ] T059 [P] [US3] 建立 PositionList 元件：在 `components/positions/PositionList.tsx` 中顯示持倉列表和即時 PnL
- [ ] T060 [US3] 建立持倉管理頁面：在 `app/(dashboard)/positions/page.tsx` 中整合 PositionList 元件

### 驗收標準（獨立可測試）

**前置條件**: 已設定有效的 Binance 和 OKX API Key（testnet 或 mainnet）

**手動測試流程**:
1. ✅ 訪問 `/opportunities`，找到一個套利機會
2. ✅ 點擊「開倉」按鈕，彈出確認對話框
3. ✅ 對話框顯示：
   - 交易對和交易所資訊（例如 "在 Binance 開多，在 OKX 開空"）
   - 輸入框：倉位大小（預設 1000 USDT）
   - 顯示：預計槓桿倍數（3x）
   - 顯示：預估所需保證金（333 USDT per side）
4. ✅ 輸入倉位大小（例如 500 USDT），點擊「確認開倉」
5. ✅ 看到執行進度提示（"正在開倉中..."）
6. ✅ 開倉成功後，自動跳轉到 `/positions` 頁面
7. ✅ 在持倉列表中看到新開立的倉位，狀態為 "OPEN"
8. ✅ 倉位詳情顯示：
   - 交易對（BTCUSDT）
   - 兩邊的交易所、方向（Long/Short）、開倉價格、倉位大小
   - 當前未實現 PnL（每 5 秒更新）
   - 開倉時間
9. ✅ 如果餘額不足，看到錯誤訊息「餘額不足，無法開倉」
10. ✅ 如果部分開倉失敗（例如 Binance 成功、OKX 失敗），看到警告訊息並在持倉列表中標記為 "PARTIAL"

**資料庫驗證**:
- ✅ `positions` 表中有新記錄，status = "OPEN"
- ✅ `audit_logs` 表中有開倉操作記錄（action = "POSITION_OPEN"）

**WebSocket 驗證**:
- ✅ 開倉成功後收到 `position:opened` 事件
- ✅ 持倉頁面即時顯示未實現 PnL 變化（每 5 秒推送 `position:updated`）

---

## Phase 6: User Story 4 - 手動平倉執行 (P4)

**目標**: 實作一鍵平倉功能，同時在兩個交易所關閉對沖倉位並計算實現 PnL

**獨立測試標準**: 用戶可以從持倉列表選擇要平倉的倉位，確認後系統同時在兩個交易所平倉，並在「交易歷史」頁面看到已平倉記錄和收益

**依賴**: P3 完成（需要先有持倉）

### Tasks

#### 領域模型（T061）

- [ ] T061 [US4] 建立 Trade 模型：在 `src/models/Trade.ts` 中實作 Trade 領域邏輯（PnL 計算、收益分項等）

#### Repository 層（T062）

- [ ] T062 [US4] 建立 TradeRepository：在 `src/repositories/TradeRepository.ts` 中實作交易記錄 CRUD 操作

#### Service 層（T063-T064）

- [ ] T063 [US4] 擴展 TradeOrchestrator：在 `src/services/trading/TradeOrchestrator.ts` 中新增平倉邏輯（包含補償）
- [ ] T064 [US4] 實作 PnL 計算邏輯：在 `src/services/trading/PositionManager.ts` 中實作實現 PnL 計算（價差 + 資金費率）

#### API Routes（T065-T066）

- [ ] T065 [US4] 實作平倉 API：在 `app/api/positions/[id]/close/route.ts` 中處理 POST /api/positions/:id/close
- [ ] T066 [US4] 實作交易歷史 API：在 `app/api/trades/route.ts` 中處理 GET /api/trades

#### 前端元件和頁面（T067-T069，可並行）

- [ ] T067 [P] [US4] 建立 ClosePositionDialog 元件：在 `components/positions/ClosePositionDialog.tsx` 中實作平倉確認對話框
- [ ] T068 [P] [US4] 建立 TradeList 元件：在 `components/trades/TradeList.tsx` 中顯示交易歷史列表
- [ ] T069 [US4] 建立交易歷史頁面：在 `app/(dashboard)/history/page.tsx` 中整合 TradeList 元件

#### WebSocket 更新（T070）

- [ ] T070 [US4] 擴展 PositionHandler：在 `src/websocket/handlers/PositionHandler.ts` 中新增平倉事件推送（`position:closed`）

### 驗收標準（獨立可測試）

**前置條件**: 已有至少一個 OPEN 狀態的持倉（從 P3 開倉）

**手動測試流程**:
1. ✅ 訪問 `/positions`，看到當前持倉列表
2. ✅ 選擇一個持倉，看到當前未實現 PnL（例如 "+25.50 USDT"）
3. ✅ 點擊「平倉」按鈕，彈出平倉確認對話框
4. ✅ 對話框顯示：
   - 當前倉位詳細資訊（交易對、交易所、方向、大小）
   - 預估平倉價格（當前市價）
   - 預估實現 PnL：
     - 價差收益：+18.30 USDT
     - 資金費率收益：+7.20 USDT
     - 總收益：+25.50 USDT
5. ✅ 點擊「確認平倉」
6. ✅ 看到執行進度提示（"正在平倉中..."）
7. ✅ 平倉成功後，該倉位從持倉列表中消失
8. ✅ 訪問 `/history`，看到新增的交易記錄
9. ✅ 交易記錄顯示：
   - 開倉和平倉時間
   - 開倉和平倉價格
   - 持倉時間（例如 "2 小時 35 分鐘"）
   - 實現 PnL 分項（價差收益、資金費率收益）
   - 收益率（例如 "+2.55%"）
10. ✅ 如果部分平倉失敗，持倉狀態標記為 "PARTIAL"，並顯示錯誤訊息

**資料庫驗證**:
- ✅ `positions` 表中該倉位的 status 更新為 "CLOSED"，`closedAt` 有值
- ✅ `trades` 表中有新記錄，包含完整的開平倉資訊和 PnL
- ✅ `audit_logs` 表中有平倉操作記錄（action = "POSITION_CLOSE"）

**WebSocket 驗證**:
- ✅ 平倉成功後收到 `position:closed` 事件，payload 包含 Trade 資訊

---

## Phase 7: User Story 5 - 歷史收益和統計 (P5)

**目標**: 實作收益統計和趨勢圖表，讓用戶查看歷史交易記錄和收益分析

**獨立測試標準**: 用戶可以查看總收益、收益率、勝率等統計資料，以及每日收益趨勢圖

**依賴**: P4 完成（需要交易歷史數據）

### Tasks

#### Service 層（T071）

- [ ] T071 [US5] 實作 StatsService：在 `src/services/stats/StatsService.ts` 中實作收益統計計算邏輯

#### API Routes（T072）

- [ ] T072 [US5] 實作收益統計 API：在 `app/api/stats/route.ts` 中處理 GET /api/stats

#### 前端元件和頁面（T073-T078，部分可並行）

- [ ] T073 [P] [US5] 建立 StatsSummary 元件：在 `components/stats/StatsSummary.tsx` 中顯示統計摘要（總收益、收益率、勝率等）
- [ ] T074 [P] [US5] 建立 RevenueChart 元件：在 `components/stats/RevenueChart.tsx` 中使用 Recharts 繪製每日收益趨勢圖
- [ ] T075 [US5] 建立收益統計頁面：在 `app/(dashboard)/stats/page.tsx` 中整合 StatsSummary 和 RevenueChart 元件
- [ ] T076 [P] [US5] 擴展 TradeList 元件：在 `components/trades/TradeList.tsx` 中新增按交易對和日期範圍篩選功能
- [ ] T077 [P] [US5] 實作交易記錄匯出功能：在交易歷史頁面新增「匯出 CSV」按鈕
- [ ] T078 [US5] 建立 Dashboard 首頁：在 `app/(dashboard)/page.tsx` 中整合統計摘要和最近交易列表

#### Email 通知服務（T078a-T078b，對應 Constitution Emergency Procedures）

- [ ] T078a [US5] 實作 Email 通知服務：在 `src/services/notification/channels/EmailChannel.ts` 中使用 Nodemailer 實作 Email 發送
  - 配置 SMTP 連線（支援 Gmail、SendGrid 等）
  - 實作 Email 模板（開倉成功、平倉成功、錯誤警告、餘額不足警告）
  - 整合到既有的 NotificationService 作為新的通知渠道
- [ ] T078b [US5] 添加 Email 通知配置頁面：在 `app/(dashboard)/settings/notifications/page.tsx` 中允許用戶配置
  - Email 地址設定
  - 通知類型選擇（開倉成功、平倉成功、錯誤、警告等）
  - 測試發送功能（發送測試郵件）

### 驗收標準（獨立可測試）

**前置條件**: 已有至少 3-5 筆已平倉的交易記錄

**手動測試流程**:
1. ✅ 訪問 `/stats`，看到收益統計頁面
2. ✅ 頂部顯示統計摘要卡片：
   - 總實現收益：+1,250.80 USDT
   - 總收益率：+8.34%
   - 總交易次數：15
   - 勝率：80% (12 獲利 / 15 總交易)
3. ✅ 中間顯示每日收益趨勢圖（折線圖或柱狀圖）
   - X 軸：日期
   - Y 軸：當日收益（USDT）
   - 滑鼠 hover 顯示詳細資訊（日期、收益、交易次數）
4. ✅ 底部顯示最近交易列表（最多 20 筆）
5. ✅ 訪問 `/history`，使用篩選功能：
   - 按交易對篩選（例如只顯示 BTCUSDT）
   - 按日期範圍篩選（例如最近 7 天）
   - 篩選後列表正確更新
6. ✅ 點擊「匯出 CSV」按鈕，下載包含所有交易記錄的 CSV 檔案
7. ✅ 打開 CSV 檔案，驗證資料正確（交易對、開平倉時間、PnL 等）

**Dashboard 首頁測試**:
1. ✅ 登入後自動跳轉到 `/` (Dashboard 首頁)
2. ✅ 首頁顯示：
   - 統計摘要卡片（同 `/stats` 頁面）
   - 當前活躍套利機會（前 5 個）
   - 當前持倉列表（如果有）
   - 最近交易記錄（最新 5 筆）

---

## Phase 8: Polish & Cross-Cutting Concerns（完善和橫切關注點）

**目標**: 完善 UI/UX、錯誤處理、日誌記錄、E2E 測試等橫切關注點

### Tasks

#### UI/UX 完善（T079-T083，可並行）

- [ ] T079 [P] 建立共用 Layout：在 `app/(dashboard)/layout.tsx` 中實作側邊欄、導航欄、登出按鈕
- [ ] T080 [P] 建立 LoadingSpinner 元件：在 `components/common/LoadingSpinner.tsx` 中實作載入動畫
- [ ] T081 [P] 建立 ErrorBoundary 元件：在 `components/common/ErrorBoundary.tsx` 中捕獲 React 錯誤並顯示友善訊息
- [ ] T082 [P] 實作 Toast 通知系統：使用 `sonner` 或 `react-hot-toast` 顯示成功/錯誤訊息
- [ ] T083 [P] 優化 Loading States：為所有異步操作新增 loading 狀態（開倉、平倉、API 請求等）

#### 錯誤處理和日誌（T084-T086，可並行）

- [ ] T084 [P] 擴展 Pino Logger：在所有關鍵操作中新增結構化日誌（correlation ID, userId, 操作詳情）
- [ ] T085 [P] 實作全域錯誤處理：在 Next.js App Router 中實作 `error.tsx` 和 `global-error.tsx`
- [ ] T086 [P] 實作 AuditLog 記錄：在所有關鍵操作（登入、API Key 變更、開平倉）中寫入 AuditLog

#### 安全性加固（T087-T089，可並行）

- [ ] T087 [P] 實作 Rate Limiting：使用 `express-rate-limit` 或自訂邏輯限制 API 請求頻率
- [ ] T088 [P] 實作 CSRF 保護：在所有 POST/PUT/DELETE 請求中驗證 CSRF Token
- [ ] T089 [P] 實作 Input Sanitization：在所有 API Routes 中使用 Zod 驗證和清理用戶輸入

#### E2E 測試（T090-T094，可並行）

- [ ] T090 [P] 編寫 E2E 測試：註冊和登入流程 (`tests/e2e/auth.spec.ts`)
- [ ] T091 [P] 編寫 E2E 測試：API Key 管理流程 (`tests/e2e/api-keys.spec.ts`)
- [ ] T092 [P] 編寫 E2E 測試：監控套利機會流程 (`tests/e2e/opportunities.spec.ts`)
- [ ] T093 [P] 編寫 E2E 測試：開倉和平倉流程 (`tests/e2e/trading.spec.ts`)
- [ ] T094 [P] 編寫 E2E 測試：收益統計查看流程 (`tests/e2e/stats.spec.ts`)

#### 文檔和部署（T095-T098，可並行）

- [ ] T095 [P] 更新 README.md：新增 Web 平台的安裝和使用說明
- [ ] T096 [P] 建立 Docker Compose：新增 `docker-compose.yml` 包含 Next.js app, PostgreSQL, Redis (如果需要)
- [ ] T097 [P] 建立 Dockerfile：為 Next.js 應用建立生產環境 Dockerfile
- [ ] T098 [P] 建立部署文檔：在 `docs/deployment.md` 中記錄部署流程（Docker, Vercel 替代方案, 環境變數設定等）

### 驗收標準

- ✅ 所有 E2E 測試通過 (`pnpm test:e2e`)
- ✅ 錯誤處理完善，所有錯誤都有友善的用戶訊息
- ✅ 日誌記錄完整，可以追蹤每個請求和關鍵操作
- ✅ 安全性檢查通過（無明顯的 XSS, CSRF, SQL Injection 漏洞）
- ✅ Docker 部署成功，可以使用 `docker-compose up` 啟動完整服務

---

## 依賴關係圖

```
Phase 1 (Setup) ───────────────────────┐
                                        ↓
Phase 2 (Foundational) ────────────────┼──────────────────────┐
                                        ↓                      ↓
Phase 3 (P1: 用戶和 API Key) ──────────┼──────┐               ↓
                                        ↓      ↓               ↓
Phase 4 (P2: 即時監控) ────────────────→┼──────┼──────┐        ↓
                                        ↓      ↓      ↓        ↓
Phase 5 (P3: 手動開倉) ────────────────→┼──────┼──────┼────┐   ↓
                                        ↓      ↓      ↓    ↓   ↓
Phase 6 (P4: 手動平倉) ────────────────→┼──────┼──────┼────┼───┤
                                        ↓      ↓      ↓    ↓   ↓
Phase 7 (P5: 收益統計) ────────────────→───────┼──────┼────┼───┤
                                                ↓      ↓    ↓   ↓
Phase 8 (Polish) ───────────────────────────────────────────→ 完成
```

**關鍵路徑**: Phase 1 → Phase 2 → Phase 3 → Phase 5 → Phase 6 → Phase 7

**可並行的 Phases**:
- Phase 4 (即時監控) 可以與 Phase 5 (開倉) 並行開發（雖然 Phase 4 先完成更好，因為開倉時需要查看機會）
- Phase 8 (Polish) 中的大部分任務可以在 Phase 3-7 之間穿插進行

---

## 並行執行建議

### Phase 3 (P1) 並行策略

**可以同時進行的任務組**:

**組 1: 領域模型和 Repository**（2 人）
- T021, T022 (領域模型)
- T023, T024 (Repository)

**組 2: Service 層**（1 人）
- T025, T026, T027

**組 3: API Routes**（2 人）
- T028, T029, T030 (認證 API)
- T031, T032 (API Key API)

**組 4: 前端**（1-2 人）
- T033, T034, T035

### Phase 5 (P3) 並行策略

**組 1: Service 層**（1-2 人）
- T051, T052, T053, T054

**組 2: API 和 WebSocket**（1 人）
- T055, T056, T057

**組 3: 前端**（1-2 人）
- T058, T059, T060

---

## MVP 範圍建議

**最小可行產品 (MVP)**: Phase 1 + Phase 2 + Phase 3 (P1)

**理由**:
- 完成 P1 後，用戶已經可以：
  - 註冊和登入
  - 管理 API Key
  - 驗證 API Key 加密存儲功能
- 這是一個完整、獨立、可測試的功能增量
- 可以收集用戶反饋，決定是否繼續開發 P2-P5

**推薦的 MVP+ 範圍**: MVP + Phase 4 (P2: 即時監控)
- 用戶可以看到即時的套利機會
- 展示 WebSocket 即時推送的核心價值
- 為後續的交易功能奠定基礎

**完整產品範圍**: Phase 1-7
- 包含所有用戶故事（P1-P5）
- 完整的交易週期（監控 → 開倉 → 平倉 → 收益追蹤）

---

## 預估工時分配

| 開發人員數 | 全職工作 | 完成 MVP | 完成 MVP+ | 完成完整版本 |
|-----------|---------|---------|-----------|------------|
| 1 人      | 全職    | 1-1.5 週 | 2-2.5 週  | 3-4 週     |
| 2 人      | 全職    | 3-5 天   | 1-1.5 週  | 2-2.5 週   |
| 3 人      | 全職    | 2-3 天   | 5-7 天    | 1.5-2 週   |

**假設**: 全職 = 每天 8 小時，高效開發（無重大阻礙）

---

## 風險和緩解策略

### 高風險任務

1. **T053: TradeOrchestrator (Saga pattern)**
   - 風險：雙邊開倉失敗的補償邏輯複雜，容易出錯
   - 緩解：先實作簡單版本（best effort rollback），後續迭代完善

2. **T047: 自訂 Next.js Server**
   - 風險：整合 Socket.io 可能與 Next.js 有相容性問題
   - 緩解：參考官方範例，使用 `next/dist/server/next-server` API

3. **T064: PnL 計算邏輯**
   - 風險：資金費率累計計算複雜，可能有精度問題
   - 緩解：使用 `Decimal.js` 確保精確度，編寫詳細的單元測試

4. **T089-T094: E2E 測試**
   - 風險：E2E 測試不穩定（flaky tests），耗時長
   - 緩解：使用 Playwright 的自動等待機制，避免硬編碼延遲

### 依賴外部服務的風險

- **交易所 API 穩定性**: 測試時使用 testnet，避免影響真實資金
- **資料庫遷移失敗**: 在執行遷移前備份資料庫
- **WebSocket 連線不穩定**: 實作自動重連機制，並在 UI 顯示連線狀態

---

## Phase 8: Future Enhancements（Phase 6+ 未來版本）

**目標**: 實作 Constitution 要求但在 MVP 階段延後的進階功能

**注意**: 這些任務標記為未來版本，不在當前 /implement 範圍內，但記錄在此以確保 Constitution 合規性的完整追蹤。

### Tasks

#### Trading Safety Requirements（對應 Constitution Trading Safety）

- [ ] T099 [FUTURE] 實作自動止損功能
  - 在 `src/services/trading/StopLossService.ts` 中實作基於百分比或絕對金額的止損觸發邏輯
  - 持續監控持倉的未實現 PnL，當虧損達到設定門檻時自動觸發平倉
  - 實作回測驗證機制確保止損邏輯的正確性
  - 在用戶設定頁面允許配置止損參數（預設 -10%）
  - **對應需求**: Constitution Trading Safety Requirements - Stop-Loss Enforcement

- [ ] T100 [FUTURE] 實作追蹤止損功能
  - 在 StopLossService 中擴展支援追蹤止損（trailing stop-loss）
  - 當 PnL 達到一定獲利後，自動調整止損線以鎖定部分利潤
  - **對應需求**: Constitution Trading Safety Requirements - Advanced Risk Management

- [ ] T101 [FUTURE] 實作滑點保護和預警機制
  - 在開倉前檢查預估滑點（基於 order book depth）
  - 當預估滑點超過門檻（預設 0.5%）時顯示警告並要求二次確認
  - 記錄實際成交滑點並在 UI 顯示
  - **對應需求**: Constitution Trading Safety Requirements - Slippage Protection

#### Emergency Procedures（對應 Constitution Emergency Procedures）

- [ ] T102 [FUTURE] 整合 Telegram Bot 通知服務
  - 在 `src/services/notification/channels/TelegramChannel.ts` 中實作 Telegram Bot API 整合
  - 實作 Bot Token 和 Chat ID 管理（支援多用戶）
  - 發送關鍵事件通知（開倉、平倉、錯誤、警告）
  - 在用戶設定頁面允許配置 Telegram 通知選項
  - **對應需求**: Constitution Emergency Procedures - Notification Escalation

- [ ] T103 [FUTURE] 實作進階錯誤監控和告警
  - 整合 Sentry 或類似的錯誤追蹤服務
  - 實作錯誤聚合和分類邏輯
  - 當錯誤率超過門檻時觸發緊急通知（Email + Telegram）
  - **對應需求**: Constitution Emergency Procedures - Circuit Breaker Enhancement

#### Advanced Features（對應 User Feedback）

- [ ] T104 [FUTURE] 支援限價單（Limit Order）
  - 擴展 TradeOrchestrator 支援限價單類型
  - 允許用戶在開倉時選擇市價單或限價單
  - 實作限價單的監控和自動取消邏輯（如價格超時）
  - **對應需求**: spec.md FR-031 未來版本擴展

- [ ] T105 [FUTURE] 支援可配置槓桿倍數
  - 在用戶設定頁面允許配置槓桿倍數（1x-10x）
  - 更新 PositionValidator 的餘額驗證邏輯以支援動態槓桿
  - 在開倉確認對話框顯示槓桿選項
  - **對應需求**: spec.md Glossary 和 plan.md Trading Parameters 未來版本擴展

### 驗收標準（未來版本）

這些任務將在 MVP 上線並收集用戶反饋後，根據實際需求優先級決定是否實作。每個任務實作前需要：

1. 用戶需求驗證：確認此功能對實際用戶有價值
2. 技術方案設計：完成詳細的技術設計和架構評審
3. 憲法合規檢查：確認實作方案符合 Constitution 所有原則
4. 測試計畫：制定完整的單元測試、整合測試和 E2E 測試計畫

---

## 下一步

任務清單已準備就緒，您可以：

1. **開始實作 MVP** (Phase 1-3):
   ```bash
   /speckit.implement
   ```

2. **檢視和調整任務**:
   - 如果發現任務粒度不合適，可以手動調整 `tasks.md`
   - 如果需要新增測試任務，可以在對應的 Phase 中新增

3. **選擇開發模式**:
   - 單人開發：按順序執行（T001 → T002 → ...）
   - 多人協作：根據「並行執行建議」分配任務

4. **追蹤進度**:
   - 在 `tasks.md` 中勾選已完成的任務 `- [x]`
   - 使用 Git commit message 引用任務 ID（例如 `git commit -m "T021: 建立 User 模型"`）

---

**準備好開始實作了嗎？ 🚀**

執行 `/speckit.implement` 來開始自動執行任務，或手動勾選 tasks.md 中的任務開始開發！
