---
description: "Task list for Feature 011 - Web 市場監控整合價差顯示與淨收益計算"
---

# Tasks: Web 市場監控整合價差顯示與淨收益計算

**Input**: Design documents from `/specs/011-price-spread-net-return/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/websocket.md

**Tests**: 本功能包含測試任務。測試策略：先寫單元測試（計算邏輯）和 E2E 測試（顯示和排序）以確保正確性。

**Organization**: 任務按 User Story 分組，每個 Story 可獨立實作和測試。

## Format: `[ID] [P?] [Story] Description`
- **[P]**: 可並行執行（不同檔案，無依賴關係）
- **[Story]**: 所屬 User Story（例如 US1, US2, US3）
- 包含明確的檔案路徑

## Path Conventions
- 後端：`src/` 位於專案根目錄
- 前端：`app/` 位於專案根目錄（Next.js App Router）
- 測試：`tests/` 位於專案根目錄

---

## Phase 1: Setup（共用基礎設施）

**Purpose**: 專案初始化和基本結構準備

- [X] T001 [P] 確認 TypeScript 5.6 和 Node.js 20.x LTS 環境配置
- [X] T002 [P] 確認 Next.js 14.2.33、React 18、Tailwind CSS、Socket.io 4.8.1 依賴已安裝
- [X] T003 [P] 確認 Vitest 和 Playwright 測試環境正常運作

---

## Phase 2: Foundational（阻塞性先決條件）

**Purpose**: 所有 User Story 都依賴的核心基礎設施

**⚠️ CRITICAL**: 在此階段完成前，不可開始任何 User Story 的實作

- [X] T004 驗證 RatesCache 中已包含 priceDiffPercent 資料（由 RateDifferenceCalculator 計算）
- [X] T005 驗證 src/lib/cost-constants.ts 中 TOTAL_TRADING_COST_RATE 常數正確定義（0.003 = 0.3%）
- [X] T006 [P] 建立 src/lib/net-return-calculator.ts 淨收益計算工具函數
- [X] T007 [P] 為淨收益計算函數撰寫單元測試 tests/unit/lib/net-return-calculator.test.ts

**Checkpoint**: 基礎設施就緒 - User Story 實作現在可以並行開始

---

## Phase 3: User Story 1 - 顯示交易所間價差（Priority: P1）🎯 MVP

**Goal**: 在市場監控表格中顯示做多交易所和做空交易所之間的現貨價格差異百分比，讓交易員快速判斷價差是否會侵蝕資金費率收益

**Independent Test**: 開啟市場監控頁面 (http://localhost:3000/market-monitor)，在「最佳套利對」欄位中應看到「價差」欄位顯示百分比（例如 +0.15% 或 -0.05%），數值與後端計算一致

### 實作 User Story 1

- [X] T008 [P] [US1] 擴展 app/(dashboard)/market-monitor/types.ts 中的 BestArbitragePair 介面，新增 priceDiffPercent?: number | null 欄位
- [X] T009 [P] [US1] 修改 src/websocket/handlers/MarketRatesHandler.ts 的 formatRates() 方法，在推送資料中包含 priceDiffPercent
- [X] T010 [US1] 修改 app/(dashboard)/market-monitor/components/RatesTable.tsx，新增「價差」欄位標題（<th>價差</th>）
- [X] T011 [US1] 修改 app/(dashboard)/market-monitor/components/RateRow.tsx，新增價差資料顯示單元格，格式化為百分比（2 位小數，正值顯示 +，負值顯示 -）
- [X] T012 [US1] 處理價差資料缺失情況，當 priceDiffPercent 為 null 或 undefined 時顯示 "N/A"
- [X] T013 [US1] 為 MarketRatesHandler 新增 Pino 日誌，記錄推送的價差資料（symbol, priceDiffPercent）

### 測試 User Story 1

- [ ] T014 [P] [US1] 撰寫 E2E 測試 tests/e2e/market-monitor-price-spread.spec.ts，驗證價差欄位正確顯示
- [ ] T015 [P] [US1] 驗證價差格式化邏輯（正值顯示 +，負值顯示 -，2 位小數）
- [ ] T016 [P] [US1] 驗證價格資料缺失時顯示 "N/A"

**Checkpoint**: 此階段完成後，User Story 1 應完全功能正常且可獨立測試

---

## Phase 4: User Story 2 - 顯示淨收益（動態計算）（Priority: P1）🎯 MVP

**Goal**: 顯示扣除價差和交易手續費後的真實淨收益，使用顏色指示器標示有利（綠色）、持平（黃色）或不利（紅色）的機會，幫助交易員準確評估套利機會

**Independent Test**: 開啟市場監控頁面，驗證「淨收益」欄位顯示的數值等於「費率差異 - |價差| - 0.3%」，並檢查顏色指示器（綠色 > 0.1%，黃色 -0.05% ~ 0.1%，紅色 < -0.05%）

### 實作 User Story 2

- [X] T017 [P] [US2] 擴展 app/(dashboard)/market-monitor/types.ts 中的 BestArbitragePair 介面，新增 netReturn?: number | null 欄位
- [X] T018 [US2] 修改 src/websocket/handlers/MarketRatesHandler.ts 的 formatRates() 方法，使用 net-return-calculator 計算淨收益並推送
- [X] T019 [US2] 在 MarketRatesHandler 中新增淨收益計算日誌（symbol, spreadPercent, priceDiffPercent, netReturn）
- [X] T020 [US2] 修改 app/(dashboard)/market-monitor/components/RatesTable.tsx，新增「淨收益」欄位標題（<th>淨收益</th>）
- [X] T021 [US2] 修改 app/(dashboard)/market-monitor/components/RateRow.tsx，新增淨收益資料顯示單元格，格式化為百分比（2 位小數）
- [X] T022 [US2] 在 RateRow.tsx 中實作顏色指示器邏輯（綠色：netReturn > 0.1，黃色：-0.05 ≤ netReturn ≤ 0.1，紅色：< -0.05）
- [X] T023 [US2] 使用 Tailwind CSS 類別實作顏色樣式（bg-green-100/text-green-800, bg-yellow-100/text-yellow-800, bg-red-100/text-red-800）
- [X] T024 [US2] 處理淨收益計算失敗情況，當 netReturn 為 null 或 undefined 時顯示 "N/A"（無顏色指示器）
- [ ] T025 [US2] 驗證顏色指示器符合 WCAG AA 無障礙標準（對比度檢查）

### 測試 User Story 2

- [ ] T026 [P] [US2] 撰寫 E2E 測試 tests/e2e/market-monitor-net-return.spec.ts，驗證淨收益欄位正確顯示
- [ ] T027 [P] [US2] 驗證淨收益計算公式正確性（spreadPercent - |priceDiffPercent| - 0.3）
- [ ] T028 [P] [US2] 驗證顏色指示器正確性（綠色 > 0.1%，黃色 -0.05% ~ 0.1%，紅色 < -0.05%）
- [ ] T029 [P] [US2] 驗證負淨收益機會仍正常顯示（不被過濾）
- [ ] T030 [P] [US2] 驗證 WebSocket 更新時淨收益和顏色即時更新

**Checkpoint**: 此階段完成後，User Stories 1 和 2 應都能獨立工作

---

## Phase 5: User Story 3 - 按價差和淨收益排序（Priority: P2）

**Goal**: 支援按價差或淨收益對套利機會列表進行排序（升序/降序），並保持穩定排序特性（相同數值的項目不跳動），幫助交易員快速找到最佳機會

**Independent Test**: 點擊「價差」或「淨收益」欄位標題，列表應按該欄位數值重新排序（預設降序），再次點擊切換為升序。驗證排序正確性（數值順序正確）和穩定性（相同數值的項目保持相對位置）

### 實作 User Story 3

- [X] T031 [P] [US3] 擴展 app/(dashboard)/market-monitor/types.ts 中的 SortField 型別，新增 'priceDiff' 和 'netReturn' 選項
- [X] T032 [P] [US3] 更新 VALID_SORT_FIELDS 常數陣列，包含新的排序欄位
- [X] T033 [US3] 修改 app/(dashboard)/market-monitor/utils/sortComparator.ts，新增 priceDiff 和 netReturn 的比較邏輯
- [X] T034 [US3] 在 sortComparator 中處理 null 和 undefined 值（排至列表末尾或使用 0 作為預設值）
- [X] T035 [US3] 實作次要排序 key（symbol 字母順序），確保相同價差或淨收益的項目穩定排序
- [X] T036 [US3] 修改 app/(dashboard)/market-monitor/components/RatesTable.tsx，為價差和淨收益欄位標題新增排序按鈕（可點擊）
- [X] T037 [US3] 修改 app/(dashboard)/market-monitor/hooks/useTableSort.ts，確保支援新的排序欄位
- [ ] T038 [US3] 驗證穩定排序機制（基於 Feature 009）正確處理 WebSocket 更新（列表不跳動）
- [ ] T039 [US3] 新增前端日誌，記錄排序操作（sortBy, sortDirection, itemCount）

### 測試 User Story 3

- [ ] T040 [P] [US3] 撰寫單元測試 tests/unit/utils/sortComparator.test.ts，驗證價差和淨收益排序邏輯
- [ ] T041 [P] [US3] 驗證降序排列正確性（最大值在最上方）
- [ ] T042 [P] [US3] 驗證升序排列正確性（最小值在最上方）
- [ ] T043 [P] [US3] 驗證次要排序 key（symbol）正確性
- [ ] T044 [P] [US3] 撰寫 E2E 測試 tests/e2e/market-monitor-sorting.spec.ts，驗證點擊欄位標題觸發排序
- [ ] T045 [P] [US3] 驗證 WebSocket 更新時列表順序保持穩定（不跳動）
- [ ] T046 [P] [US3] 效能測試：驗證 100 個交易對排序操作 < 1 秒

**Checkpoint**: 所有 User Stories 現在應該都能獨立功能正常

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 影響多個 User Stories 的改進和最終驗證

- [ ] T047 [P] 執行 quickstart.md 中的手動測試步驟（6 步驟）
- [ ] T048 [P] 驗證所有 10 項功能需求（FR-001 到 FR-010）
- [ ] T049 [P] 驗證所有 7 項成功標準（SC-001 到 SC-007）
- [ ] T050 [P] 執行瀏覽器相容性測試（Chrome、Firefox、Safari、Edge）
- [ ] T051 [P] 執行所有邊緣案例測試（7 個情境）
- [ ] T052 Code cleanup：移除不必要的 console.log，確保日誌使用 Pino（後端）或 console.error（前端錯誤）
- [ ] T053 [P] 更新 TypeScript 型別定義，確保前後端 BestArbitragePair 介面同步
- [ ] T054 [P] 檢查表格寬度，確保新欄位不影響整體佈局（小螢幕測試）
- [ ] T055 執行完整測試套件（單元測試 + E2E 測試），確保覆蓋率 > 85%
- [ ] T056 效能測試：驗證 WebSocket 推送延遲 < 100ms（使用 Chrome DevTools）
- [ ] T057 執行 pnpm build 確保生產環境編譯成功

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup（Phase 1）**: 無依賴 - 可立即開始
- **Foundational（Phase 2）**: 依賴 Setup 完成 - **阻塞所有 User Stories**
- **User Stories（Phase 3-5）**: 所有依賴 Foundational 階段完成
  - User Story 1（P1）: 可在 Foundational 完成後立即開始
  - User Story 2（P1）: **依賴 User Story 1** 的型別定義（BestArbitragePair 擴展）
  - User Story 3（P2）: **依賴 User Story 1 和 2** 的欄位存在
- **Polish（Phase 6）**: 依賴所有期望的 User Stories 完成

### User Story Dependencies

- **User Story 1（P1）**: 可在 Foundational（Phase 2）後開始 - 無其他 Story 依賴
- **User Story 2（P1）**: **依賴 US1 的型別定義**（BestArbitragePair 介面已擴展 priceDiffPercent）- 但可獨立測試淨收益顯示
- **User Story 3（P2）**: **依賴 US1 和 US2**（需要價差和淨收益欄位已存在）- 但排序邏輯可獨立測試

### Within Each User Story

- 型別定義在實作之前（T008 在 T009-T011 之前）
- 後端推送在前端顯示之前（T009 在 T010-T011 之前）
- 核心實作在測試之前（T010-T012 在 T014-T016 之前）
- Story 完成後再移動到下一個優先級

### Parallel Opportunities

- **Setup 階段**: T001、T002、T003 可並行執行（環境驗證）
- **Foundational 階段**: T006、T007 可並行執行（計算工具和測試）
- **User Story 1**: T008、T009 可並行執行（型別定義和後端修改）
- **User Story 1 測試**: T014、T015、T016 可並行執行（不同測試檔案）
- **User Story 2**: T017（型別）可與 T018（後端）並行執行
- **User Story 2 測試**: T026、T027、T028、T029、T030 可並行執行
- **User Story 3**: T031、T032、T033 可並行執行（型別、常數、比較邏輯在不同檔案）
- **User Story 3 測試**: T040-T046 可並行執行
- **Polish 階段**: T047、T048、T049、T050、T051、T052、T053、T054 可並行執行

**注意**: User Story 2 和 User Story 3 不可與 User Story 1 並行執行（有依賴關係），但 US2 和 US3 的測試可以提前準備測試程式碼架構。

---

## Parallel Example: User Story 1

```bash
# 並行啟動 User Story 1 的型別定義和後端修改（不同檔案）:
Task: "擴展 app/(dashboard)/market-monitor/types.ts 中的 BestArbitragePair 介面"
Task: "修改 src/websocket/handlers/MarketRatesHandler.ts 的 formatRates() 方法"

# 並行啟動 User Story 1 的所有測試（不同測試檔案）:
Task: "撰寫 E2E 測試 tests/e2e/market-monitor-price-spread.spec.ts"
Task: "驗證價差格式化邏輯單元測試"
Task: "驗證價格資料缺失處理單元測試"
```

---

## Parallel Example: User Story 2

```bash
# 並行啟動 User Story 2 的型別定義和後端修改（不同檔案）:
Task: "擴展 app/(dashboard)/market-monitor/types.ts 中的 BestArbitragePair 介面"
Task: "修改 src/websocket/handlers/MarketRatesHandler.ts 的 formatRates() 方法"

# 並行啟動 User Story 2 的所有測試（不同測試檔案）:
Task: "撰寫 E2E 測試 tests/e2e/market-monitor-net-return.spec.ts"
Task: "驗證淨收益計算公式單元測試"
Task: "驗證顏色指示器單元測試"
Task: "驗證負淨收益顯示測試"
Task: "驗證 WebSocket 更新測試"
```

---

## Parallel Example: User Story 3

```bash
# 並行啟動 User Story 3 的型別、常數和比較邏輯（不同檔案）:
Task: "擴展 app/(dashboard)/market-monitor/types.ts 中的 SortField 型別"
Task: "更新 VALID_SORT_FIELDS 常數陣列"
Task: "修改 app/(dashboard)/market-monitor/utils/sortComparator.ts"

# 並行啟動 User Story 3 的所有測試（不同測試檔案）:
Task: "撰寫單元測試 tests/unit/utils/sortComparator.test.ts"
Task: "驗證降序排列正確性"
Task: "驗證升序排列正確性"
Task: "驗證次要排序 key 正確性"
Task: "撰寫 E2E 測試 tests/e2e/market-monitor-sorting.spec.ts"
Task: "驗證 WebSocket 更新穩定性"
Task: "效能測試 100 個交易對排序"
```

---

## Implementation Strategy

### MVP First（僅 User Story 1 + User Story 2）

1. 完成 Phase 1: Setup（環境驗證）
2. 完成 Phase 2: Foundational（**關鍵 - 阻塞所有 Stories**）
3. 完成 Phase 3: User Story 1（價差顯示）
4. 完成 Phase 4: User Story 2（淨收益顯示 + 顏色指示器）
5. **STOP 並驗證**: 獨立測試 User Story 1 和 2
6. 準備部署/展示（如果就緒）

### Incremental Delivery

1. 完成 Setup + Foundational → 基礎就緒
2. 新增 User Story 1 → 獨立測試 → 部署/展示（功能增量！）
3. 新增 User Story 2 → 獨立測試 → 部署/展示（MVP 完成！）
4. 新增 User Story 3 → 獨立測試 → 部署/展示（完整功能！）
5. 每個 Story 都增加價值而不破壞先前的 Stories

### Parallel Team Strategy

若有多位開發者：

1. 團隊一起完成 Setup + Foundational
2. Foundational 完成後：
   - Developer A: User Story 1（價差顯示）
   - Developer B: 準備 User Story 2 的測試程式碼（等待 US1 型別定義）
   - Developer C: 準備 User Story 3 的排序邏輯（等待 US1 和 US2 完成）
3. Stories 依序完成並獨立整合（US1 → US2 → US3）

**注意**: 由於 User Story 2 和 3 依賴 User Story 1 的型別定義和欄位，建議採用**順序執行**（US1 → US2 → US3）以避免整合問題。

---

## Notes

- [P] 任務 = 不同檔案，無依賴關係
- [Story] 標籤將任務映射到特定 User Story 以便追蹤
- 每個 User Story 應該可獨立完成和測試
- 在實作前驗證測試失敗
- 每個任務或邏輯群組後提交
- 在任何檢查點停止以獨立驗證 Story
- 避免：模糊任務、相同檔案衝突、破壞獨立性的跨 Story 依賴

---

## Task Summary

- **Total Tasks**: 57 個任務
- **Setup**: 3 個任務
- **Foundational**: 4 個任務（**關鍵阻塞點**）
- **User Story 1（P1）**: 9 個任務（6 實作 + 3 測試）
- **User Story 2（P1）**: 14 個任務（9 實作 + 5 測試）
- **User Story 3（P2）**: 16 個任務（9 實作 + 7 測試）
- **Polish**: 11 個任務（最終驗證和優化）

**Parallel Opportunities**: 約 35 個任務可並行執行（標記 [P]）

**Suggested MVP Scope**: User Story 1 + User Story 2（P1 功能，核心價值）

**Estimated Effort**:
- Setup + Foundational: 1-2 小時
- User Story 1: 1-2 小時
- User Story 2: 2-3 小時
- User Story 3: 1-2 小時
- Polish: 1 小時
- **Total**: 6-10 小時（單人順序執行）或 4-6 小時（團隊並行執行）

**Format Validation**: ✅ 所有任務遵循清單格式（checkbox、ID、標籤、檔案路徑）
