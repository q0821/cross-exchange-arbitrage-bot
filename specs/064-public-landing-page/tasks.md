# Tasks: 公開套利機會歷史首頁

**Input**: Design documents from `/specs/064-public-landing-page/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/api.md ✓

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

**⚠️ TDD Mandate**: 遵循 Constitution Principle VII - 所有實作必須先寫測試、驗證失敗、再實作

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- **[TEST]**: 測試任務，必須在對應實作之前完成且驗證失敗
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 專案結構和基礎設定

- [x] T001 建立 `app/(public)/components/` 目錄結構
- [x] T002 [P] 建立型別定義檔 `src/types/public-opportunity.ts`
- [x] T003 [P] 建立查詢參數 Schema `src/models/PublicOpportunity.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 核心基礎設施，必須在任何 User Story 開始前完成

**⚠️ CRITICAL**: 所有 User Story 都依賴此階段完成

### Tests for Foundational (RED Phase - Write First, Verify FAIL) 🔴

- [x] T004 [P] [TEST] 速率限制器單元測試 `tests/unit/lib/rate-limiter.test.ts`
  - 測試：請求計數正確
  - 測試：窗口過期後重置
  - 測試：超過限制回傳 false
  - ✅ **執行測試，驗證 FAIL**
- [x] T005 [P] [TEST] 速率限制中間件單元測試 `tests/unit/middleware/rateLimitMiddleware.test.ts`
  - 測試：正常請求通過
  - 測試：超限回傳 429
  - 測試：正確設定 X-RateLimit-* headers
  - ✅ **執行測試，驗證 FAIL**
- [x] T006 [P] [TEST] Repository findAllPublic 單元測試 `tests/unit/repositories/OpportunityEndHistoryRepository.public.test.ts`
  - 測試：正確過濾時間範圍
  - 測試：正確分頁
  - 測試：不包含 userId, notificationCount
  - ✅ **執行測試，驗證 FAIL**
- [x] T007 [P] [TEST] 公開 API 整合測試 `tests/integration/api/public-opportunities.test.ts`
  - 測試：GET /api/public/opportunities 回傳正確格式
  - 測試：無效參數回傳 400
  - 測試：速率限制生效回傳 429
  - ✅ **執行測試，驗證 FAIL**

### Implementation for Foundational (GREEN Phase - Minimal Code) 🟢

- [x] T008 實作速率限制器核心邏輯 `src/lib/rate-limiter.ts`
  - In-memory Map + 滑動窗口算法
  - 支援 30 req/min 配置
  - ✅ **執行 T004 測試，6 passed**
- [x] T009 實作速率限制中間件 `src/middleware/rateLimitMiddleware.ts`
  - 從 request 獲取 IP
  - 設定 rate limit headers (`X-RateLimit-*`)
  - 回傳 429 Too Many Requests
  - ✅ **執行 T005 測試，5 passed**
- [x] T010 擴展 `src/repositories/OpportunityEndHistoryRepository.ts`
  - 新增 `findAllPublic(options)` 方法
  - 實作 `toPublicDTO()` 轉換（排除 userId, notificationCount, settlementRecords）
  - 支援 days 時間範圍篩選、分頁
  - ✅ **執行 T006 測試，10 passed**
- [x] T011 建立公開 API endpoint `app/api/public/opportunities/route.ts`
  - GET handler with query params validation (Zod)
  - 套用速率限制中間件
  - 回傳去識別化資料和 pagination info
  - 使用 Pino structured logging
  - ✅ **已實作（整合測試需要 Next.js server）**

### Refactor for Foundational (REFACTOR Phase) 🔵

- [x] T012 重構：檢視 Foundational 程式碼品質
  - 確保命名清晰、結構合理
  - ✅ **執行所有 Phase 2 測試，21 passed**

**Checkpoint**: Foundation ready - User Story 實作可以開始

---

## Phase 3: User Story 1 - 訪客瀏覽套利機會歷史 (Priority: P1) 🎯 MVP

**Goal**: 訪客（未登入用戶）可直接訪問首頁，瀏覽歷史套利機會列表

**Independent Test**: 無痕瀏覽器訪問 `/`，應顯示套利機會列表

### Tests for User Story 1 (RED Phase) 🔴

- [x] T013 [P] [TEST] [US1] 首頁 SSR 測試 `tests/integration/pages/home.test.ts`
  - 測試：Server Component 正確渲染
  - 測試：HTML 包含套利機會列表資料
  - 測試：無需認證即可訪問
  - ✅ **執行測試，驗證 FAIL**
- [x] T014 [P] [TEST] [US1] 已登入用戶重導向測試 `tests/integration/pages/home-redirect.test.ts`
  - 測試：已登入用戶訪問 `/` 重導向到 `/market-monitor`
  - ✅ **執行測試，驗證 FAIL**

### Implementation for User Story 1 (GREEN Phase) 🟢

- [x] T015 [P] [US1] 建立公開導覽列元件 `app/(public)/components/PublicNav.tsx`
  - Logo
  - 登入/註冊按鈕（導向 `/login`, `/register`）
- [x] T016 [P] [US1] 建立套利機會列表元件 `app/(public)/components/OpportunityList.tsx`
  - 接收 `PublicOpportunityDTO[]` 資料
  - 顯示列表或空狀態
- [x] T017 [P] [US1] 建立套利機會卡片元件 `app/(public)/components/OpportunityCard.tsx`
  - 顯示單筆機會摘要資訊
- [x] T018 [P] [US1] 建立載入骨架屏元件 `app/(public)/components/OpportunityListSkeleton.tsx`
- [x] T019 [US1] 修改首頁 `app/page.tsx` 為公開 Landing Page (Server Component)
  - 移除舊的重導向邏輯
  - 伺服器端獲取資料（SSR）
  - 組合 PublicNav + HeroSection + OpportunityList
  - 建立 `src/lib/get-public-opportunities.ts` 輔助函數
  - ✅ **執行 T013 測試，8 passed**
- [x] T020 [US1] 實作已登入用戶重導向邏輯
  - 檢查 session/token
  - 已登入則重導向到 `/market-monitor`
  - ✅ **執行 T014 測試，8 passed**

### Refactor for User Story 1 🔵

- [x] T021 [US1] 重構：檢視 US1 程式碼品質
  - ✅ **執行所有 US1 測試，8 passed**

**Checkpoint**: User Story 1 功能完整，訪客可瀏覽首頁

---

## Phase 4: User Story 2 - 查看套利機會詳細資訊 (Priority: P2)

**Goal**: 訪客可查看每筆套利機會的詳細資訊欄位

**Independent Test**: 在列表中看到每筆機會的完整資訊欄位

### Tests for User Story 2 (RED Phase) 🔴

- [ ] T022 [TEST] [US2] 持續時間格式化工具測試 `tests/unit/lib/format-duration.test.ts`
  - 測試：毫秒轉換為「X 小時 Y 分鐘」
  - 測試：邊界案例（0ms, 超過 24 小時）
  - **執行測試，驗證 FAIL**
- [ ] T023 [TEST] [US2] OpportunityCard 顯示欄位測試 `tests/unit/components/OpportunityCard.test.tsx`
  - 測試：顯示所有必要欄位（symbol, exchanges, spreads, APY, duration）
  - **執行測試，驗證 FAIL**

### Implementation for User Story 2 (GREEN Phase) 🟢

- [ ] T024 [US2] 實作持續時間格式化工具 `src/lib/format-duration.ts`
  - 將 `durationMs` 轉換為 "X 小時 Y 分鐘" 格式
  - **執行 T022 測試，驗證 PASS**
- [ ] T025 [US2] 擴展 OpportunityCard 元件顯示完整欄位
  - 交易對 (`symbol`)
  - 多方/空方交易所 (`longExchange`, `shortExchange`)
  - 最大/最終費差 (`maxSpread`, `finalSpread`)
  - 年化報酬率 (`realizedAPY`)
  - 持續時間（人類可讀格式）
  - 機會消失時間 (`disappearedAt`)
  - **執行 T023 測試，驗證 PASS**
- [ ] T026 [US2] 實作費率/百分比格式化顯示
  - spread 顯示 4 位小數
  - APY 顯示 2 位小數 + %

### Refactor for User Story 2 🔵

- [ ] T027 [US2] 重構：檢視 US2 程式碼品質
  - **執行所有 US2 測試，驗證全部 PASS**

**Checkpoint**: User Story 1 + 2 功能完整

---

## Phase 5: User Story 3 - 分頁瀏覽歷史記錄 (Priority: P2)

**Goal**: 訪客可透過分頁機制瀏覽更多歷史記錄

**Independent Test**: 當記錄超過 20 筆時，可透過分頁切換

### Tests for User Story 3 (RED Phase) 🔴

- [ ] T028 [P] [TEST] [US3] 分頁元件測試 `tests/unit/components/Pagination.test.tsx`
  - 測試：正確顯示頁碼
  - 測試：上下頁按鈕狀態
  - **執行測試，驗證 FAIL**
- [ ] T029 [P] [TEST] [US3] 時間範圍篩選元件測試 `tests/unit/components/TimeRangeFilter.test.tsx`
  - 測試：7/30/90 天切換
  - 測試：預設選中 90 天
  - **執行測試，驗證 FAIL**
- [ ] T030 [TEST] [US3] 公開 API Hook 測試 `tests/hooks/usePublicOpportunities.test.ts`
  - 測試：正確呼叫 API 並處理回應
  - 測試：loading/error 狀態處理
  - **執行測試，驗證 FAIL**

### Implementation for User Story 3 (GREEN Phase) 🟢

- [ ] T031 [US3] 建立分頁元件 `app/(public)/components/Pagination.tsx`
  - 顯示當前頁/總頁數
  - 上一頁/下一頁按鈕
  - 頁碼快捷連結
  - **執行 T028 測試，驗證 PASS**
- [ ] T032 [US3] 建立時間範圍篩選元件 `app/(public)/components/TimeRangeFilter.tsx` (Client Component)
  - 7/30/90 天切換按鈕
  - 預設選中 90 天
  - **執行 T029 測試，驗證 PASS**
- [ ] T033 [US3] 實作客戶端資料獲取 Hook `app/(public)/hooks/usePublicOpportunities.ts`
  - 呼叫 `/api/public/opportunities`
  - 處理 loading、error 狀態
  - 支援分頁和篩選參數
  - **執行 T030 測試，驗證 PASS**
- [ ] T034 [US3] 整合分頁和篩選到首頁
  - URL query params 同步 (`?page=2&days=30`)
  - 切換時顯示載入指示器

### Refactor for User Story 3 🔵

- [ ] T035 [US3] 重構：檢視 US3 程式碼品質
  - **執行所有 US3 測試，驗證全部 PASS**

**Checkpoint**: User Story 1 + 2 + 3 功能完整

---

## Phase 6: User Story 4 - 首頁品牌與行動呼籲 (Priority: P3)

**Goal**: 首頁包含品牌資訊和引導註冊/登入的 CTA

**Independent Test**: 首頁頂部顯示品牌 Logo、簡介、登入/註冊按鈕

### Tests for User Story 4 (RED Phase) 🔴

- [ ] T036 [TEST] [US4] HeroSection 元件測試 `tests/unit/components/HeroSection.test.tsx`
  - 測試：顯示系統名稱
  - 測試：顯示 CTA 按鈕
  - **執行測試，驗證 FAIL**

### Implementation for User Story 4 (GREEN Phase) 🟢

- [ ] T037 [US4] 建立品牌區塊元件 `app/(public)/components/HeroSection.tsx`
  - 系統名稱標題
  - 產品簡介文字
  - 主要 CTA 按鈕（註冊/開始使用）
  - **執行 T036 測試，驗證 PASS**
- [ ] T038 [US4] 設計響應式版面配置
  - 桌面版：品牌區塊 + 列表並排
  - 行動版：垂直堆疊
- [ ] T039 [US4] 建立頁尾元件 `app/(public)/components/Footer.tsx`（可選）
  - 版權資訊
  - 連結（隱私政策、服務條款等）

### Refactor for User Story 4 🔵

- [ ] T040 [US4] 重構：檢視 US4 程式碼品質
  - **執行所有 US4 測試，驗證全部 PASS**

**Checkpoint**: 所有 User Story 功能完整

---

## Phase 7: SEO & Polish

**Purpose**: SEO 優化和跨 Story 的改善

### SEO Optimization

- [ ] T041 [P] 設定首頁 metadata `app/page.tsx`
  - title, description
  - Open Graph tags (og:title, og:description, og:type)
  - Twitter card tags
- [ ] T042 [P] 驗證 SSR 輸出包含完整 HTML 內容

### Error Handling & Observability

- [ ] T043 建立錯誤邊界元件 `app/(public)/components/ErrorBoundary.tsx`
- [ ] T044 實作 API 錯誤處理和重試按鈕
- [ ] T045 確保所有關鍵操作使用 Pino structured logging

### Final Validation

- [ ] T046 執行 quickstart.md 驗證步驟
- [ ] T047 執行 Lighthouse 效能測試（目標 90+）
- [ ] T048 驗證 requirements checklist 所有項目
- [ ] T049 執行所有測試套件，確保 100% PASS

---

## Dependencies & Execution Order

### TDD Flow Reminder (MUST Follow)

```
每個功能區塊：

1. 🔴 RED: 寫測試 → 執行 → 驗證 FAIL
2. 🟢 GREEN: 寫最小實作 → 執行測試 → 驗證 PASS
3. 🔵 REFACTOR: 改善程式碼 → 執行所有測試 → 驗證全部 PASS
```

### Phase Dependencies

```
Phase 1: Setup
    ↓
Phase 2: Foundational (Tests T004-T007 → Impl T008-T011)
    ↓ (BLOCKS all user stories)
┌───────────────────────────────────────────────────┐
│  Phase 3: US1 (P1) 🎯 MVP                         │
│      Tests T013-T014 → Impl T015-T020             │
│      ↓                                            │
│  Phase 4: US2 (P2) - 依賴 US1 元件                │
│      Tests T022-T023 → Impl T024-T026             │
│      ↓                                            │
│  Phase 5: US3 (P2) - 依賴 US1 列表元件            │
│      Tests T028-T030 → Impl T031-T034             │
│      ↓                                            │
│  Phase 6: US4 (P3) - 可與 US2/US3 平行            │
│      Tests T036 → Impl T037-T039                  │
└───────────────────────────────────────────────────┘
    ↓
Phase 7: SEO & Polish (T041-T049)
```

### Parallel Opportunities

- T002, T003 可平行執行（Setup 型別定義）
- T004, T005, T006, T007 可平行執行（Foundational 測試）
- T013, T014 可平行執行（US1 測試）
- T015, T016, T017, T018 可平行執行（US1 元件，不同檔案）
- T028, T029, T030 可平行執行（US3 測試）
- T041, T042 可平行執行（SEO 任務）

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (TDD: T004-T012)
3. Complete Phase 3: User Story 1 (TDD: T013-T021)
4. **STOP and VALIDATE**: 測試首頁是否正常顯示列表
5. 可先部署 MVP

### Incremental Delivery

1. Setup + Foundational → 基礎完成（所有測試 PASS）
2. + US1 → 測試 → 部署 (MVP!)
3. + US2 → 測試 → 部署 (詳細資訊)
4. + US3 → 測試 → 部署 (分頁篩選)
5. + US4 → 測試 → 部署 (品牌 CTA)
6. + SEO → 最終發布

---

## Notes

- **[TEST]** 任務 = 必須先完成且驗證 FAIL（Red Phase）
- **[P]** 任務 = 不同檔案、無依賴，可平行執行
- **[USx]** 標籤 = 對應到特定 User Story
- 每完成一個 TDD 循環後提交 commit
- 在任何 Checkpoint 停下來驗證 Story 功能
- **Constitution Principle VII 強制要求**：不允許跳過測試直接實作
