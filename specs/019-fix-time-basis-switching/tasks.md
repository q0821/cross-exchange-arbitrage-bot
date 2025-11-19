# Tasks: 修復時間基準切換功能

**Input**: Design documents from `/specs/019-fix-time-basis-switching/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: 測試任務已包含在內，基於 spec.md 和 quickstart.md 的驗證需求。

**Organization**: 任務按用戶故事分組，每個故事都可以獨立實作和測試。

## Format: `[ID] [P?] [Story] Description`
- **[P]**: 可並行執行（不同檔案，無依賴）
- **[Story]**: 此任務屬於哪個用戶故事（例如 US1, US2, US3）
- 描述中包含精確的檔案路徑

## Path Conventions
- **專案類型**: Web 應用（Next.js App Router，前後端共存）
- **後端路徑**: `src/` (服務層), `app/api/` (REST API)
- **前端路徑**: `app/(dashboard)/market-monitor/`
- **測試路徑**: `tests/unit/`, `tests/integration/`

---

## Phase 1: Setup（共享基礎設施）

**Purpose**: 專案初始化和基本結構（本次為錯誤修復，Setup 最小化）

- [ ] T001 確認開發環境就緒（Node.js 20.x, pnpm, TypeScript 5.6+）
- [ ] T002 [P] 檢查所有相關檔案存在並可讀寫
- [ ] T003 [P] 建立測試檔案目錄結構

**完成標準**: 開發環境就緒，可以開始修改程式碼

---

## Phase 2: Foundational（阻塞性前置條件）

**Purpose**: 在任何用戶故事實作前必須完成的核心基礎設施

**⚠️ CRITICAL**: 此階段完成前，無法開始任何用戶故事的工作

**本次修復無 Foundational 階段** - 所有必要基礎設施已存在，可以直接進入用戶故事實作

**Checkpoint**: 基礎就緒 - 可以開始並行實作用戶故事

---

## Phase 3: User Story 1 - 選擇 4 小時時間基準 (Priority: P1) 🎯 MVP

**Goal**: 修復 WebSocket handler 不接受 4 小時時間基準的問題，使用戶可以選擇 4h 而不會收到錯誤

**Independent Test**: 在前端選擇 4 小時時間基準，驗證 WebSocket 不返回錯誤訊息，且時間基準選擇器正確顯示「4 小時」為選中狀態

**Acceptance Scenarios**:
- **Given** 用戶已登入市場監控頁面，**When** 用戶點擊時間基準選擇器並選擇「4 小時」，**Then** WebSocket 不會返回錯誤訊息
- **Given** 用戶已選擇 4 小時時間基準，**When** WebSocket 推送費率更新，**Then** 前端正確接收並顯示資料

### Tests for User Story 1

- [x] T004 [P] [US1] 建立 WebSocket handler 單元測試檔案 `tests/unit/websocket/MarketRatesHandler.test.ts`
- [x] T005 [P] [US1] 撰寫測試：驗證 `timeBasis = 4` 被接受（預期失敗）
- [x] T006 [P] [US1] 撰寫測試：驗證 `timeBasis = 6` 被拒絕並返回正確錯誤訊息（預期通過）

### Implementation for User Story 1

- [x] T007 [US1] 修改 WebSocket 驗證邏輯：在 `src/websocket/handlers/MarketRatesHandler.ts:78` 的陣列中加入 `4`
- [x] T008 [US1] 更新錯誤訊息：在 `src/websocket/handlers/MarketRatesHandler.ts:86` 的 `expected` 陣列中加入 `4`
- [x] T009 [US1] 執行單元測試並確認 T005 現在通過
- [ ] T010 [US1] 手動測試：啟動開發伺服器，在前端選擇 4h，驗證無錯誤

**Checkpoint**: User Story 1 完成 - 用戶可以成功選擇 4 小時時間基準且不會收到錯誤

---

## Phase 4: User Story 2 - 查看完整的標準化費率資訊 (Priority: P2)

**Goal**: 修復 REST API 缺少標準化費率資料的問題，使頁面重新載入後仍能顯示完整的標準化資訊

**Independent Test**: 刷新頁面後，檢查各交易所的費率資料是否包含 `normalized` 和 `originalInterval` 欄位，並有視覺指示說明已標準化

**Acceptance Scenarios**:
- **Given** 用戶已選擇特定時間基準，**When** 用戶刷新頁面，**Then** 頁面顯示的費率資料包含標準化費率和原始週期資訊
- **Given** 某交易所的原始費率週期與選擇的時間基準不同，**When** 頁面載入完成，**Then** 該交易所的費率顯示為標準化後的值並有 tooltip 說明

### Tests for User Story 2

- [x] T011 [P] [US2] 建立 REST API 整合測試檔案 `tests/integration/api/market-rates.test.ts`
- [x] T012 [P] [US2] 撰寫測試：驗證 API 回傳包含 `normalized` 欄位（預期失敗）
- [x] T013 [P] [US2] 撰寫測試：驗證 API 回傳包含 `originalInterval` 欄位（預期失敗）

### Implementation for User Story 2

- [x] T014 [US2] 修改 REST API 回傳資料格式：在 `app/api/market-rates/route.ts:64-72` 加入 `normalized` 和 `originalInterval` 欄位
- [x] T015 [US2] 驗證 WebSocket formatRates 函數也包含相同欄位：檢查 `src/websocket/handlers/MarketRatesHandler.ts:336-344`
- [x] T016 [US2] 如果 WebSocket 缺少欄位，同步修改 WebSocket handler
- [x] T017 [US2] 執行整合測試並確認 T012 和 T013 現在通過
- [ ] T018 [US2] 手動測試：刷新頁面，使用開發者工具檢查 API 回應包含新欄位

**Checkpoint**: User Story 2 完成 - 頁面刷新後仍能看到完整的標準化費率資訊

---

## Phase 5: User Story 3 - 查看基於時間基準的正確費率差 (Priority: P1)

**Goal**: 修復費率差計算錯誤，使用標準化費率而非原始費率進行計算，確保切換時間基準時費率差正確更新

**Independent Test**: 選擇不同時間基準，驗證費率差和年化收益是否相應變化。特別是當兩個交易所的原始週期不同時（例如 Binance 8h vs OKX 4h），切換時間基準應該會改變費率差的數值

**Acceptance Scenarios**:
- **Given** Binance 8h/0.01% 且 OKX 4h/0.005%，**When** 選擇 8h 基準，**Then** 費率差應基於兩者標準化為 8h 後的費率計算（接近 0%）
- **Given** Binance 8h/0.01% 且 OKX 4h/0.005%，**When** 選擇 4h 基準，**Then** 費率差應基於兩者標準化為 4h 後的費率計算（接近 0%）
- **Given** 用戶正在查看某交易對的費率差，**When** 切換時間基準，**Then** 費率差和年化收益會相應更新

### Tests for User Story 3

- [x] T019 [P] [US3] 建立費率計算單元測試檔案 `tests/unit/models/FundingRate.test.ts`
- [x] T020 [P] [US3] 撰寫測試：驗證不同時間基準下的費率差計算正確性（預期失敗）
- [x] T021 [P] [US3] 撰寫測試：驗證標準化資料缺失時的降級行為（回退到原始費率）

### Implementation for User Story 3

- [x] T022 [US3] 在 `src/models/FundingRate.ts` 頂部新增輔助函數 `getNormalizedRate(data, timeBasis)`
- [x] T023 [US3] 更新函數簽名：在 `src/models/FundingRate.ts:168` 的 `createMultiExchangeFundingRatePair` 加入 `timeBasis` 參數（預設 8）
- [x] T024 [US3] 修改費率提取邏輯：在 `src/models/FundingRate.ts:191-193` 使用 `getNormalizedRate` 函數而非直接使用 `rate.fundingRate`
- [x] T025 [US3] 執行單元測試並確認 T020 和 T021 現在通過
- [ ] T026 [US3] 整合測試：驗證前端切換時間基準時費率差正確變化

**Checkpoint**: User Story 3 完成 - 費率差計算基於標準化費率，切換時間基準時正確更新

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 影響多個用戶故事的改進和最終驗證

- [x] T027 [P] 執行完整的測試套件：`pnpm test`
- [x] T028 [P] TypeScript 型別檢查：`pnpm tsc --noEmit`
- [x] T029 [P] Linting 檢查：`pnpm lint`
- [ ] T030 建置專案：`pnpm build`
- [ ] T031 [P] E2E 測試：啟動開發伺服器，手動測試完整的時間基準切換流程
- [ ] T032 [P] 效能驗證：測量 WebSocket 事件處理時間 <100ms, REST API 回應時間 <520ms
- [ ] T033 [P] 向後相容性測試：驗證選擇 1h/8h/24h 仍正常運作
- [ ] T034 執行 `quickstart.md` 中的驗證清單
- [ ] T035 [P] 更新文件：如果需要，更新任何受影響的開發文件
- [x] T036 Code review 準備：整理 commit 訊息和變更摘要

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 無依賴 - 可立即開始
- **Foundational (Phase 2)**: 不適用（本次修復無此階段）
- **User Stories (Phase 3-5)**: 理論上可並行，但建議按優先級順序執行（P1 → P2 → P1）
  - US1 (P1): WebSocket 驗證修復
  - US2 (P2): REST API 資料擴展
  - US3 (P1): 費率差計算修復（**依賴 US2 完成**，因為需要標準化資料）
- **Polish (Phase 6)**: 依賴所有用戶故事完成

### User Story Dependencies

- **User Story 1 (P1)**: 可在 Setup 後立即開始 - 無其他依賴
- **User Story 2 (P2)**: 可在 Setup 後立即開始 - 無其他依賴
- **User Story 3 (P1)**: 建議在 US2 完成後開始 - 需要 `normalized` 資料存在於 RatesCache 中才能正確測試

**建議執行順序**: US1 → US2 → US3

**理由**:
- US1 最簡單，快速驗證
- US2 為 US3 提供完整的資料支援
- US3 是核心修復，需要 US2 的資料完整性

### Within Each User Story

- 測試 MUST 在實作前撰寫並驗證失敗
- 單元測試可以並行撰寫（標記 [P]）
- 實作任務必須按順序執行
- 驗證測試通過後再進入下一個故事

### Parallel Opportunities

**Setup Phase (Phase 1)**:
- T002 和 T003 可以並行執行

**User Story 1**:
- T004, T005, T006 可以並行撰寫測試

**User Story 2**:
- T011, T012, T013 可以並行撰寫測試

**User Story 3**:
- T019, T020, T021 可以並行撰寫測試

**Polish Phase (Phase 6)**:
- T027, T028, T029, T031, T032, T033, T035 可以並行執行

**不同 User Story 之間**:
- US1 和 US2 可以並行開發（如果有兩個開發者）
- US3 應該在 US2 完成後開始

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "撰寫測試：驗證 timeBasis = 4 被接受" (T005)
Task: "撰寫測試：驗證 timeBasis = 6 被拒絕" (T006)

# Sequential implementation:
Task: "修改 WebSocket 驗證邏輯" (T007) → "更新錯誤訊息" (T008) → "執行測試" (T009)
```

---

## Parallel Example: User Story 2

```bash
# Launch all tests for User Story 2 together:
Task: "撰寫測試：驗證 API 回傳包含 normalized 欄位" (T012)
Task: "撰寫測試：驗證 API 回傳包含 originalInterval 欄位" (T013)

# Sequential implementation:
Task: "修改 REST API" (T014) → "驗證 WebSocket" (T015) → "執行測試" (T017)
```

---

## Parallel Example: User Story 3

```bash
# Launch all tests for User Story 3 together:
Task: "撰寫測試：驗證費率差計算正確性" (T020)
Task: "撰寫測試：驗證降級行為" (T021)

# Sequential implementation:
Task: "新增輔助函數" (T022) → "更新函數簽名" (T023) → "修改費率提取邏輯" (T024) → "執行測試" (T025)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 3: User Story 1 (T004-T010)
3. **STOP and VALIDATE**: 手動測試 US1 - 選擇 4h 時間基準應該不會出錯
4. 如果驗證通過，可以單獨部署這個修復

**MVP Value**: 解除用戶選擇 4h 時的阻礙，立即消除困惑和錯誤

### Incremental Delivery

1. MVP (US1): 修復 WebSocket 驗證 → 用戶可以選擇 4h
2. US2: 修復 REST API 資料 → 頁面刷新後資料完整
3. US3: 修復費率差計算 → 切換時間基準時數據正確
4. Polish: 完整測試和優化 → 生產就緒

**每個階段都增加價值且不破壞先前的功能**

### Parallel Team Strategy

如果有多個開發者：

1. Setup: 一起完成（快速）
2. 並行開發：
   - **Developer A**: US1 (WebSocket 修復) - 獨立
   - **Developer B**: US2 (REST API 修復) - 獨立
3. 串行開發：
   - **Developer A or B**: US3 (費率差計算) - 依賴 US2

**時間估算**:
- US1: 30 分鐘（包含測試）
- US2: 45 分鐘（包含測試）
- US3: 1.5 小時（包含測試和整合驗證）
- Polish: 30 分鐘

**總時間**（串行）: ~3 小時
**總時間**（並行）: ~2.5 小時

---

## Notes

- **[P] 任務**: 不同檔案，無依賴，可並行執行
- **[Story] 標籤**: 將任務映射到特定用戶故事，便於追蹤
- **每個用戶故事都應該可以獨立完成和測試**
- **先驗證測試失敗再實作**（TDD 方法）
- **每完成一個任務或邏輯組就 commit**
- **在任何 checkpoint 停下來驗證故事的獨立性**
- **避免**: 模糊的任務、同檔案衝突、破壞獨立性的跨故事依賴

---

## Validation Checklist (from quickstart.md)

完成所有任務後，請逐項檢查：

### 功能驗證

- [ ] **P1-1**: 用戶可以在前端選擇 4 小時時間基準
- [ ] **P1-2**: WebSocket 不會返回錯誤訊息
- [ ] **P2-1**: 頁面刷新後仍能看到標準化費率資訊
- [ ] **P2-2**: Tooltip 正確顯示原始週期和標準化說明
- [ ] **P1-3**: 切換時間基準時，費率差和年化收益正確更新

### 技術驗證

- [ ] **TypeScript**: 無型別錯誤 (`pnpm tsc --noEmit`)
- [ ] **Linting**: 無 ESLint 錯誤 (`pnpm lint`)
- [ ] **單元測試**: 所有測試通過 (`pnpm test`)
- [ ] **整合測試**: WebSocket 和 REST API 測試通過
- [ ] **建置**: 專案可以成功建置 (`pnpm build`)

### 向後相容性驗證

- [ ] **舊版客戶端**: 選擇 1h/8h/24h 仍正常運作
- [ ] **REST API**: 回應格式不破壞現有客戶端
- [ ] **WebSocket**: 事件名稱和結構未變更
- [ ] **效能**: API 回應時間 <520ms (P95)

---

## Task Summary

**Total Tasks**: 36
**By Phase**:
- Setup (Phase 1): 3 tasks
- User Story 1 (Phase 3): 7 tasks (3 tests + 4 implementation)
- User Story 2 (Phase 4): 8 tasks (3 tests + 5 implementation)
- User Story 3 (Phase 5): 8 tasks (3 tests + 5 implementation)
- Polish (Phase 6): 10 tasks

**By User Story**:
- US1 (P1): 7 tasks
- US2 (P2): 8 tasks
- US3 (P1): 8 tasks
- Cross-cutting: 13 tasks

**Parallel Opportunities**: 20 tasks marked [P] (~56% parallelizable)

**Independent Test Criteria**:
- US1: 選擇 4h 不出錯
- US2: 刷新頁面仍看到標準化資訊
- US3: 切換時間基準時費率差正確變化

**Suggested MVP Scope**: User Story 1 only (7 tasks, ~30 minutes)

**Format Validation**: ✅ All tasks follow the checklist format (checkbox + ID + optional [P] + [Story] label + description with file path)
