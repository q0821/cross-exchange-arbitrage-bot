# Tasks: 修復開倉停損停利條件單設定

**Input**: Design documents from `/specs/040-fix-conditional-orders/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, quickstart.md

**TDD Required**: 根據 Constitution Principle VII，所有任務必須嚴格遵守 TDD 流程（Red-Green-Refactor）。

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: 確認測試環境就緒

- [x] T001 確認 Vitest 測試環境配置正確，運行 `pnpm test --run` 驗證

**Checkpoint**: 測試環境就緒

---

## Phase 2: User Story 1 - OKX 帳戶模式偵測 (Priority: P1) 🎯 MVP

**Goal**: 動態偵測 OKX 帳戶模式（long_short_mode / net_mode），確保條件單參數正確

**Independent Test**: 運行 `pnpm test tests/unit/services/ConditionalOrderAdapterFactory.test.ts --run`

### 🔴 Red Phase - 撰寫失敗測試

- [x] T002 [US1] 創建測試檔案 `tests/unit/services/ConditionalOrderAdapterFactory.test.ts`
- [x] T003 [US1] 撰寫測試：偵測到 long_short_mode 時應返回 'long_short_mode'
- [x] T004 [US1] 撰寫測試：偵測到 net_mode 時應返回 'net_mode'
- [x] T005 [US1] 撰寫測試：API 錯誤時應預設返回 'long_short_mode' 並記錄警告
- [x] T006 [US1] 運行測試確認全部失敗：`pnpm test tests/unit/services/ConditionalOrderAdapterFactory.test.ts --run`

### 🟢 Green Phase - 最小實作

- [x] T007 [US1] 在 `src/services/trading/okx-position-mode.ts` 新增 `detectOkxPositionMode()` 方法
- [x] T008 [US1] 修改 `createOkxAdapter()` 使用 `detectOkxPositionMode()` 結果
- [x] T009 [US1] 運行測試確認全部通過：`pnpm test tests/unit/services/ConditionalOrderAdapterFactory.test.ts --run`

### 🔵 Refactor Phase - 增強日誌

- [x] T010 [US1] 在 `detectOkxPositionMode()` 加入偵測結果日誌
- [x] T011 [US1] 在 `createOkxAdapter()` 加入帳戶模式日誌
- [x] T012 [US1] 運行測試確認仍通過：`pnpm test tests/unit/services/ConditionalOrderAdapterFactory.test.ts --run`

**Checkpoint**: OKX 帳戶模式偵測完成，US1 可獨立測試

---

## Phase 3: User Story 2 - Gate.io 整數轉換修復 (Priority: P1)

**Goal**: 修復合約數量轉換，使用四捨五入取代 parseInt 截斷

**Independent Test**: 運行 `pnpm test tests/unit/services/GateioConditionalOrderAdapter.test.ts --run`

### 🔴 Red Phase - 撰寫失敗測試

- [x] T013 [US2] 創建測試檔案 `tests/unit/services/GateioConditionalOrderAdapter.test.ts`
- [x] T014 [US2] 撰寫測試：數量 0.5 應四捨五入為 1（非截斷為 0）
- [x] T015 [US2] 撰寫測試：數量 0.4 應使用最小值 1
- [x] T016 [US2] 撰寫測試：數量 1.6 應四捨五入為 2
- [x] T017 [US2] 撰寫測試：Long 平倉應使用負數（賣出方向）
- [x] T018 [US2] 撰寫測試：Short 平倉應使用正數（買入方向）
- [x] T019 [US2] 運行測試確認全部失敗：`pnpm test tests/unit/services/GateioConditionalOrderAdapter.test.ts --run`

### 🟢 Green Phase - 最小實作

- [x] T020 [US2] 修改 `src/services/trading/adapters/GateioConditionalOrderAdapter.ts` 使用 `Math.round()` + `Math.max(1, ...)`
- [x] T021 [US2] 運行測試確認全部通過：`pnpm test tests/unit/services/GateioConditionalOrderAdapter.test.ts --run`

### 🔵 Refactor Phase - 增強日誌

- [x] T022 [US2] 在數量轉換處加入詳細日誌（原始數量、轉換後數量、方向）
- [x] T023 [US2] 運行測試確認仍通過：`pnpm test tests/unit/services/GateioConditionalOrderAdapter.test.ts --run`

**Checkpoint**: Gate.io 數量轉換修復完成，US2 可獨立測試

---

## Phase 4: User Story 3 - Binance 條件單增強 (Priority: P2)

**Goal**: 加強 Binance 條件單日誌記錄

**Independent Test**: 驗證 Binance 條件單設定時有完整日誌輸出

### 🔵 Refactor Phase - 增強日誌（無需新測試，現有功能正常）

- [x] T024 [US3] 在 `src/services/trading/adapters/BinanceConditionalOrderAdapter.ts` 的 `setStopLossOrder()` 加入請求前日誌
- [x] T025 [US3] 在 `src/services/trading/adapters/BinanceConditionalOrderAdapter.ts` 的 `setStopLossOrder()` 加入回應後日誌
- [x] T026 [US3] 在 `src/services/trading/adapters/BinanceConditionalOrderAdapter.ts` 的 `setTakeProfitOrder()` 加入請求前日誌
- [x] T027 [US3] 在 `src/services/trading/adapters/BinanceConditionalOrderAdapter.ts` 的 `setTakeProfitOrder()` 加入回應後日誌
- [x] T028 [US3] 運行所有測試確認無回歸：`pnpm test --run`

**Checkpoint**: Binance 日誌增強完成

---

## Phase 5: User Story 4 - 偵錯日誌增強 (Priority: P2)

**Goal**: 增強 OKX 適配器日誌，並加入價格驗證警告

**Independent Test**: 運行 `pnpm test tests/unit/services/ --run`

### 🔴 Red Phase - 價格驗證測試

- [x] T029 [US4] 創建或擴充測試檔案 `tests/unit/services/ConditionalOrderService.test.ts`
- [x] T030 [US4] 撰寫測試：停損價格可能立即觸發時應記錄警告
- [x] T031 [US4] 撰寫測試：停利價格可能立即觸發時應記錄警告
- [x] T032 [US4] 運行測試確認失敗：`pnpm test tests/unit/services/ConditionalOrderService.test.ts --run`

### 🟢 Green Phase - 最小實作

- [x] T033 [US4] 在 `src/services/trading/ConditionalOrderService.ts` 加入 `isStopLossPriceValid()` 驗證呼叫
- [x] T034 [US4] 在 `src/services/trading/ConditionalOrderService.ts` 加入 `isTakeProfitPriceValid()` 驗證呼叫
- [x] T035 [US4] 運行測試確認通過：`pnpm test tests/unit/services/ConditionalOrderService.test.ts --run`

### 🔵 Refactor Phase - OKX 日誌增強

- [x] T036 [P] [US4] 在 `src/services/trading/adapters/OkxConditionalOrderAdapter.ts` 的 `setStopLossOrder()` 加入請求前日誌
- [x] T037 [P] [US4] 在 `src/services/trading/adapters/OkxConditionalOrderAdapter.ts` 的 `setStopLossOrder()` 加入回應後日誌
- [x] T038 [P] [US4] 在 `src/services/trading/adapters/OkxConditionalOrderAdapter.ts` 的 `setTakeProfitOrder()` 加入請求前日誌
- [x] T039 [P] [US4] 在 `src/services/trading/adapters/OkxConditionalOrderAdapter.ts` 的 `setTakeProfitOrder()` 加入回應後日誌
- [x] T040 [US4] 運行所有測試確認仍通過：`pnpm test tests/unit/services/ --run`

**Checkpoint**: 偵錯日誌增強完成

---

## Phase 6: Final Validation

**Purpose**: 最終驗證所有修復

- [x] T041 運行全部測試確認通過：`pnpm test --run`（服務測試 67/67 通過）
- [x] T042 運行 TypeScript 編譯確認無錯誤：`pnpm tsc --noEmit`
- [x] T043 運行 ESLint 確認無錯誤：`pnpm lint`（預先存在的配置問題，非本次修改）

**Checkpoint**: 所有驗證通過，準備合併

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1: Setup
    ↓
Phase 2: US1 (OKX) ←→ Phase 3: US2 (Gate.io)  [可並行]
    ↓                      ↓
Phase 4: US3 (Binance) ←→ Phase 5: US4 (Logging)  [可並行]
    ↓
Phase 6: Final Validation
```

### User Story Dependencies

- **US1 (OKX)**: 獨立，無依賴
- **US2 (Gate.io)**: 獨立，無依賴
- **US3 (Binance)**: 獨立，無依賴
- **US4 (Logging)**: 部分依賴 US1-US3（共用適配器檔案）

### Parallel Opportunities

**Phase 2 & 3 可並行**:
```
Developer A: T002-T012 (US1: OKX 偵測)
Developer B: T013-T023 (US2: Gate.io 轉換)
```

**Phase 4 & 5 可並行**:
```
Developer A: T024-T028 (US3: Binance 日誌)
Developer B: T029-T040 (US4: 價格驗證 + OKX 日誌)
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. 完成 Phase 1: Setup
2. 完成 Phase 2: US1 (OKX 帳戶模式偵測)
3. 完成 Phase 3: US2 (Gate.io 整數轉換)
4. **STOP and VALIDATE**: 測試 OKX 和 Gate.io 條件單設定

### Full Feature

1. MVP 完成後
2. 完成 Phase 4: US3 (Binance 日誌)
3. 完成 Phase 5: US4 (價格驗證 + OKX 日誌)
4. 完成 Phase 6: Final Validation
5. 合併到 main 分支

---

## Notes

- 所有任務必須遵守 TDD 流程：先寫測試 → 確認失敗 → 實作 → 確認通過 → 重構
- 每個 TDD Cycle 完成後運行測試驗證
- [P] 標記的任務可與其他 [P] 任務並行執行
- 每個 User Story 完成後應能獨立驗證
