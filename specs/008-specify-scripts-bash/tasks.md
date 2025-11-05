# Tasks: 市場監控頁面交易所快速連結

**Feature**: 008-specify-scripts-bash
**Branch**: `008-specify-scripts-bash`
**Input**: Design documents from `/specs/008-specify-scripts-bash/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: 測試任務已包含（符合專案憲法 Principle III 的測試要求）

**Organization**: 任務按用戶故事分組，確保每個故事可獨立實作和測試

## Format: `[ID] [P?] [Story] Description`
- **[P]**: 可並行執行（不同檔案，無依賴）
- **[Story]**: 任務屬於哪個用戶故事（例如 US1, US2）
- 包含明確的檔案路徑

## Path Conventions
- **單一專案結構**: `src/`, `app/`, `tests/` 位於 repository root
- 路徑基於 plan.md 中定義的專案結構

---

## Phase 1: Setup (共享基礎設施)

**Purpose**: 專案初始化和基本依賴安裝

- [x] T001 安裝 Radix UI Tooltip 依賴：`pnpm add @radix-ui/react-tooltip` ✅
- [x] T002 [P] 複製類型定義檔案從 `specs/008-specify-scripts-bash/contracts/types.ts` 到 `src/types/exchange-links.ts` ✅
- [x] T003 [P] 驗證類型定義檔案已正確匯出並可被 TypeScript 編譯器識別 ✅

**Checkpoint**: 依賴已安裝，類型定義已就位 ✅

---

## Phase 2: Foundational (阻塞性前置需求)

**Purpose**: 核心工具模組，所有用戶故事都依賴

**⚠️ CRITICAL**: 此階段完成前，用戶故事無法開始實作

- [x] T004 [P] 建立 URL Builder 模組於 `src/lib/exchanges/url-builder.ts`（包含 `getExchangeContractUrl` 函數） ✅
- [x] T005 [P] 建立交易所配置常數於 `src/lib/exchanges/constants.ts`（包含 `EXCHANGE_CONFIGS` 映射） ✅
- [x] T006 [P] 匯出 URL Builder 公共 API 於 `src/lib/exchanges/index.ts` ✅
- [x] T007 撰寫 URL Builder 單元測試於 `tests/unit/lib/url-builder.test.ts`（測試所有 4 個交易所的 URL 生成） ✅
- [x] T008 驗證單元測試通過：`pnpm test url-builder.test.ts` ✅ (21/21 tests passed)

**Checkpoint**: 基礎設施已就緒，用戶故事實作可並行開始 ✅

---

## Phase 3: User Story 1 - 快速訪問交易所合約頁面 (Priority: P1) 🎯 MVP

**Goal**: 在市場監控頁面的每個交易所欄位中新增可點擊的圖示，讓用戶可以在新分頁中開啟該交易所的合約頁面

**Independent Test**: 在市場監控頁面上，點擊任意交易所的圖示連結，驗證是否正確開啟新分頁並導航到該交易所對應交易對的合約頁面

### Implementation for User Story 1

- [x] T009 [P] [US1] 建立 ExchangeLink 元件於 `src/components/market/ExchangeLink.tsx`（包含 Tooltip 和圖示） ✅
- [x] T010 [P] [US1] 匯出 ExchangeLink 元件於 `src/components/market/index.ts` ✅
- [x] T011 [US1] 整合 ExchangeLink 到 RateRow 元件於 `app/(dashboard)/market-monitor/components/RateRow.tsx`（在 Binance 費率旁新增連結） ✅
- [x] T012 [US1] 整合 ExchangeLink 到 RateRow 元件於 `app/(dashboard)/market-monitor/components/RateRow.tsx`（在 OKX 費率旁新增連結） ✅
- [x] T013 [US1] 整合 ExchangeLink 到 RateRow 元件於 `app/(dashboard)/market-monitor/components/RateRow.tsx`（在 MEXC 費率旁新增連結） ✅
- [x] T014 [US1] 整合 ExchangeLink 到 RateRow 元件於 `app/(dashboard)/market-monitor/components/RateRow.tsx`（在 Gate.io 費率旁新增連結） ✅
- [x] T015 [US1] 處理不可用狀態：當交易所資料為空或不可用時，ExchangeLink 顯示為灰色且不可點擊 ✅ (已在 ExchangeLink 元件中實作)
- [ ] T016 [US1] 本地測試驗證：啟動 `pnpm dev` 並手動測試所有 4 個交易所的連結功能

### Tests for User Story 1

- [ ] T017 [P] [US1] 撰寫 ExchangeLink 元件測試於 `tests/unit/components/ExchangeLink.test.tsx`（測試正常渲染和禁用狀態）
- [ ] T018 [P] [US1] 撰寫 E2E 測試於 `tests/e2e/market-monitor-exchange-links.spec.ts`（測試 Binance 連結點擊）
- [ ] T019 [P] [US1] 撰寫 E2E 測試於 `tests/e2e/market-monitor-exchange-links.spec.ts`（測試 OKX 連結點擊）
- [ ] T020 [P] [US1] 撰寫 E2E 測試於 `tests/e2e/market-monitor-exchange-links.spec.ts`（測試 MEXC 連結點擊）
- [ ] T021 [P] [US1] 撰寫 E2E 測試於 `tests/e2e/market-monitor-exchange-links.spec.ts`（測試 Gate.io 連結點擊）
- [ ] T022 [US1] 執行所有測試並確保通過：`pnpm test && pnpm test:e2e market-monitor-exchange-links.spec.ts`

**Checkpoint**: 用戶故事 1 完成，所有 4 個交易所的連結功能可用且測試通過

---

## Phase 4: User Story 2 - 視覺化識別交易所連結 (Priority: P2)

**Goal**: 增強用戶體驗，提供明確的視覺回饋和 Tooltip 提示

**Independent Test**: 在市場監控頁面上，將滑鼠移到交易所圖示上，驗證是否顯示 Tooltip 並有 hover 效果

### Implementation for User Story 2

- [ ] T023 [P] [US2] 實作 hover 視覺效果於 `src/components/market/ExchangeLink.tsx`（滑鼠游標變為手指、顏色變化）
- [ ] T024 [P] [US2] 實作 focus indicator 於 `src/components/market/ExchangeLink.tsx`（鍵盤導航時的 focus ring）
- [ ] T025 [US2] 實作 Tooltip 內容於 `src/components/market/ExchangeLink.tsx`（顯示「前往 [交易所] 查看 [交易對]」）
- [ ] T026 [US2] 測試 Tooltip 顯示和隱藏行為（hover 200ms 後顯示，移開後隱藏）
- [ ] T027 [US2] 驗證無障礙屬性：`aria-label` 正確設置，鍵盤可導航

### Tests for User Story 2

- [ ] T028 [P] [US2] 撰寫 Tooltip 顯示測試於 `tests/e2e/market-monitor-exchange-links.spec.ts`（測試 hover 後 Tooltip 出現）
- [ ] T029 [P] [US2] 撰寫鍵盤導航測試於 `tests/e2e/market-monitor-exchange-links.spec.ts`（測試 Tab 鍵可訪問連結）
- [ ] T030 [US2] 執行所有測試並確保通過：`pnpm test:e2e market-monitor-exchange-links.spec.ts`

**Checkpoint**: 用戶故事 2 完成，視覺體驗和無障礙性增強

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: 跨用戶故事的改進和最終驗證

- [ ] T031 [P] TypeScript 編譯檢查：`pnpm build` 確認無錯誤
- [ ] T032 [P] ESLint 檢查：`pnpm lint` 確認無警告
- [ ] T033 [P] 執行完整測試套件：`pnpm test && pnpm test:e2e` 確保所有測試通過
- [ ] T034 程式碼審查準備：確認所有函數有 TSDoc 註解，無 console.log 或 debugger 語句
- [ ] T035 驗證 quickstart.md 的檢查清單：確保所有驗收標準滿足
- [ ] T036 [P] 在多個瀏覽器測試（Chrome, Firefox, Safari）
- [ ] T037 [P] 在行動裝置測試（iOS 和 Android）
- [ ] T038 更新 CLAUDE.md 或專案文件（如果需要）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 無依賴 - 可立即開始
- **Foundational (Phase 2)**: 依賴 Setup 完成 - 阻塞所有用戶故事
- **User Stories (Phase 3-4)**: 都依賴 Foundational phase 完成
  - US1 和 US2 可並行執行（如果有多位開發者）
  - 或按優先順序順序執行（P1 → P2）
- **Polish (Phase 5)**: 依賴所有用戶故事完成

### User Story Dependencies

- **User Story 1 (P1)**: 可在 Foundational 完成後開始 - 無其他用戶故事依賴
- **User Story 2 (P2)**: 可在 Foundational 完成後開始 - 實際上擴展 US1，但可獨立測試視覺增強

### Within Each User Story

- 實作任務（T009-T016 for US1）應該在測試任務（T017-T022 for US1）之前或同時進行
- ExchangeLink 元件（T009）必須完成才能整合到 RateRow（T011-T014）
- 本地測試（T016）應在自動化測試（T017-T022）之前執行，確保基本功能正常

### Parallel Opportunities

**Setup Phase (Phase 1)**:
- T002 和 T003 可並行執行

**Foundational Phase (Phase 2)**:
- T004, T005, T006 可並行執行（不同檔案）
- T007 必須在 T004-T006 完成後執行

**User Story 1 (Phase 3)**:
- T009 和 T010 可並行執行
- T011, T012, T013, T014 可順序執行（修改同一檔案）或小心合併
- T017, T018, T019, T020, T021 可並行執行（不同測試案例）

**User Story 2 (Phase 4)**:
- T023 和 T024 可並行執行
- T028 和 T029 可並行執行

**Polish Phase (Phase 5)**:
- T031, T032, T036, T037 可並行執行

---

## Parallel Example: User Story 1

### 並行執行 US1 的實作任務

```bash
# 同時建立元件和匯出（不同檔案）:
Task Agent 1: "建立 ExchangeLink 元件於 src/components/market/ExchangeLink.tsx"
Task Agent 2: "匯出 ExchangeLink 元件於 src/components/market/index.ts"

# 同時撰寫所有測試（不同測試案例）:
Task Agent 1: "撰寫 E2E 測試 - Binance 連結"
Task Agent 2: "撰寫 E2E 測試 - OKX 連結"
Task Agent 3: "撰寫 E2E 測試 - MEXC 連結"
Task Agent 4: "撰寫 E2E 測試 - Gate.io 連結"
```

### 並行執行兩個用戶故事

```bash
# 在 Foundational 完成後，兩個開發者可並行工作:
Developer A: 完成 Phase 3 (US1) 所有任務
Developer B: 在 US1 基本完成後，開始 Phase 4 (US2) 任務
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. **Complete Phase 1**: Setup (T001-T003) → ~15 分鐘
2. **Complete Phase 2**: Foundational (T004-T008) → ~1 小時
3. **Complete Phase 3**: User Story 1 (T009-T022) → ~2-3 小時
4. **STOP and VALIDATE**: 測試 User Story 1 是否獨立運作
5. **部署/展示**: MVP 功能完整，用戶可點擊圖示跳轉到交易所

**Total MVP Time**: ~4-4.5 小時

### Incremental Delivery

1. **Foundation Ready** (Phase 1-2) → URL Builder 和類型定義完成
2. **Add User Story 1** (Phase 3) → 測試獨立 → 部署/展示（MVP！）
3. **Add User Story 2** (Phase 4) → 測試獨立 → 部署/展示（增強版）
4. **Polish** (Phase 5) → 最終品質保證 → 生產部署

每個故事都增加價值而不破壞之前的功能。

### Parallel Team Strategy

如果有多位開發者：

1. **團隊一起完成** Setup + Foundational (Phase 1-2)
2. **Foundational 完成後**:
   - Developer A: 完成 User Story 1 核心實作（T009-T016）
   - Developer B: 同時撰寫 User Story 1 測試（T017-T022）
3. **US1 完成後**:
   - Developer A: 開始 User Story 2 實作（T023-T027）
   - Developer B: 撰寫 User Story 2 測試（T028-T030）
4. **最後一起完成** Polish (Phase 5)

---

## Testing Checkpoints

### After Foundational (Phase 2)

- [ ] `pnpm test url-builder.test.ts` 通過
- [ ] 可以成功生成 4 個交易所的 URL
- [ ] 類型檢查無錯誤：`pnpm tsc --noEmit`

### After User Story 1 (Phase 3)

- [ ] 可以在市場監控頁面看到所有圖示
- [ ] 點擊每個圖示可正確開啟對應交易所頁面
- [ ] 不可用的交易對顯示為灰色
- [ ] 所有單元測試通過：`pnpm test`
- [ ] 所有 E2E 測試通過：`pnpm test:e2e market-monitor-exchange-links.spec.ts`

### After User Story 2 (Phase 4)

- [ ] Hover 時顯示 Tooltip
- [ ] Tooltip 內容清晰描述操作
- [ ] 鍵盤導航可訪問所有連結
- [ ] Focus 時有明顯的 focus indicator
- [ ] 所有無障礙測試通過

### Final Validation (Phase 5)

- [ ] 所有測試通過（單元 + E2E）
- [ ] TypeScript 編譯成功
- [ ] ESLint 檢查無警告
- [ ] 在 3 個主要瀏覽器測試通過
- [ ] 在行動裝置測試通過
- [ ] quickstart.md 檢查清單全部滿足

---

## Notes

- **[P] tasks** = 不同檔案，無依賴，可並行執行
- **[Story] label** = 將任務映射到特定用戶故事，便於追蹤
- **每個用戶故事應該可獨立完成和測試**
- **在實作前先執行測試，確保測試失敗**（TDD 方法）
- **每完成一個任務或邏輯組提交一次**
- **在任何檢查點停下來驗證故事獨立性**
- **避免**：模糊的任務、相同檔案衝突、破壞獨立性的跨故事依賴

## Task Summary

- **Total Tasks**: 38 tasks
- **Setup Phase**: 3 tasks
- **Foundational Phase**: 5 tasks
- **User Story 1**: 14 tasks
- **User Story 2**: 8 tasks
- **Polish Phase**: 8 tasks

**Estimated Time**:
- MVP (Phase 1-3): 4-4.5 hours
- Full Feature (Phase 1-5): 6-7 hours

**Parallel Opportunities**:
- 10+ tasks可並行執行（標記為 [P]）
- 兩個用戶故事可由不同開發者並行開發
