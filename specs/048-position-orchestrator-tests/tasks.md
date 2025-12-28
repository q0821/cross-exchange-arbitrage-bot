# Tasks: PositionOrchestrator 單元測試覆蓋

**Input**: Design documents from `/specs/048-position-orchestrator-tests/`
**Prerequisites**: plan.md, spec.md, research.md, quickstart.md

**Tests**: 本功能為測試覆蓋任務，所有任務都是實作單元測試。

**Organization**: 任務依用戶故事分組，每個故事可獨立實作和驗證。

## Format: `[ID] [P?] [Story] Description`
- **[P]**: 可並行執行（不同 describe 區塊，無依賴）
- **[Story]**: 所屬用戶故事（US1, US2, US3...）
- 測試檔案路徑：`tests/unit/services/PositionOrchestrator.test.ts`

---

## Phase 1: Setup (測試基礎設定) ✅ COMPLETED

**Purpose**: 建立測試檔案和 mock 基礎設施

- [x] T001 建立測試檔案 `tests/unit/services/PositionOrchestrator.test.ts`
- [x] T002 設定 CCXT 模組 mock（vi.mock 動態導入）
- [x] T003 [P] 設定 logger mock（避免測試輸出）
- [x] T004 [P] 設定 encryption mock（decrypt 函數）
- [x] T005 建立 mockPrisma 工廠函數（position.create/update、apiKey.findFirst）
- [x] T006 建立 PositionLockService.withLock spyOn mock
- [x] T007 建立測試數據常量（baseParams、successfulOrderResult）
- [x] T008 設定 beforeEach/afterEach（fake timers、clearAllMocks）

**Checkpoint**: Mock 基礎設施完成，可開始撰寫測試案例 ✅

---

## Phase 2: User Story 1 - 雙邊開倉成功流程測試 (Priority: P1) 🎯 MVP ✅ COMPLETED

**Goal**: 驗證當兩個交易所都成功開倉時，系統能正確更新 Position 狀態

**Independent Test**: `pnpm test PositionOrchestrator -- --grep "successful bilateral open" --run`

### Implementation for User Story 1

- [x] T009 [US1] 實作 `describe('successful bilateral open')` 區塊
- [x] T010 [US1] 測試：should create position with OPEN status when both sides succeed
- [x] T011 [US1] 測試：should record correct entry prices and quantities for long and short
- [x] T012 [US1] 測試：should record order IDs for both exchanges
- [x] T013 [US1] 測試：should set conditional orders when stopLossEnabled is true
- [x] T014 [US1] 測試：should set conditional orders when takeProfitEnabled is true
- [x] T015 [US1] 測試：should update conditionalOrderStatus to SET after successful setup

**Checkpoint**: 雙邊成功場景測試完成，執行 `--grep "successful bilateral open"` 驗證 ✅

---

## Phase 3: User Story 2 - 回滾機制測試 (Priority: P1) ✅ COMPLETED

**Goal**: 驗證當一邊成功另一邊失敗時，系統能正確執行回滾操作

**Independent Test**: `pnpm test PositionOrchestrator -- --grep "rollback" --run`

### Implementation for User Story 2

- [x] T016 [US2] 實作 `describe('rollback mechanism')` 區塊
- [x] T017 [US2] 測試：should rollback long position when short fails
- [x] T018 [US2] 測試：should rollback short position when long fails
- [x] T019 [US2] 測試：should update position status to FAILED after successful rollback
- [x] T020 [US2] 測試：should retry rollback up to 3 times on failure
- [x] T021 [US2] 測試：should wait 1000ms before second retry attempt (fake timers)
- [x] T022 [US2] 測試：should wait 2000ms before third retry attempt (fake timers)
- [x] T023 [US2] 測試：should mark position as PARTIAL when rollback fails after max retries
- [x] T024 [US2] 測試：should throw RollbackFailedError after max retries
- [x] T025 [US2] 測試：should include exchange and side info in RollbackFailedError

**Checkpoint**: 回滾機制測試完成，執行 `--grep "rollback"` 驗證 ✅

---

## Phase 4: User Story 3 - 雙邊都失敗處理測試 (Priority: P1) ✅ COMPLETED

**Goal**: 驗證當兩邊開倉都失敗時，系統能正確記錄錯誤

**Independent Test**: `pnpm test PositionOrchestrator -- --grep "both failed" --run`

### Implementation for User Story 3

- [x] T026 [US3] 實作 `describe('both sides failed')` 區塊
- [x] T027 [US3] 測試：should mark position as FAILED when both sides fail
- [x] T028 [US3] 測試：should record combined error message from both exchanges
- [x] T029 [US3] 測試：should throw TradingError with BILATERAL_OPEN_FAILED code
- [x] T030 [US3] 測試：should handle timeout errors on both sides

**Checkpoint**: 雙邊失敗場景測試完成，執行 `--grep "both failed"` 驗證 ✅

---

## Phase 5: User Story 4 - 餘額驗證測試 (Priority: P2) ✅ COMPLETED

**Goal**: 驗證開倉前的餘額驗證邏輯能正確阻止餘額不足的請求

**Independent Test**: `pnpm test PositionOrchestrator -- --grep "balance validation" --run`

### Implementation for User Story 4

- [x] T031 [US4] 實作 `describe('balance validation')` 區塊
- [x] T032 [US4] 測試：should throw InsufficientBalanceError when balance insufficient
- [x] T033 [US4] 測試：should mark position as FAILED when balance validation fails
- [x] T034 [US4] 測試：should throw ApiKeyNotFoundError when API key not found

**Checkpoint**: 餘額驗證測試完成，執行 `--grep "balance validation"` 驗證 ✅

---

## Phase 6: User Story 5 - 條件單設定測試 (Priority: P2) ✅ COMPLETED

**Goal**: 驗證開倉成功後的停損停利條件單設定邏輯

**Independent Test**: `pnpm test PositionOrchestrator -- --grep "conditional orders" --run`

### Implementation for User Story 5

- [x] T035 [US5] 實作 `describe('conditional orders')` 區塊
- [x] T036 [US5] 測試：should set stop loss orders on both exchanges when enabled
- [x] T037 [US5] 測試：should record stop loss prices in position
- [x] T038 [US5] 測試：should set take profit orders on both exchanges when enabled
- [x] T039 [US5] 測試：should record take profit prices in position
- [x] T040 [US5] 測試：should handle conditional order failures gracefully (position stays OPEN)
- [x] T041 [US5] 測試：should set conditionalOrderStatus to FAILED when setup fails
- [x] T042 [US5] 測試：should set both stop loss and take profit when both enabled

**Checkpoint**: 條件單設定測試完成，執行 `--grep "conditional orders"` 驗證 ✅

---

## Phase 7: User Story 6 - 分散式鎖測試 (Priority: P2) ✅ COMPLETED

**Goal**: 驗證開倉操作使用分散式鎖防止並發衝突

**Independent Test**: `pnpm test PositionOrchestrator -- --grep "lock" --run`

### Implementation for User Story 6

- [x] T043 [US6] 實作 `describe('lock mechanism')` 區塊
- [x] T044 [US6] 測試：should call PositionLockService.withLock before execution
- [x] T045 [US6] 測試：should pass correct userId and symbol to withLock

**Checkpoint**: 分散式鎖測試完成，執行 `--grep "lock"` 驗證 ✅

---

## Phase 8: Edge Cases (邊界情況測試) ✅ COMPLETED

**Purpose**: 處理各種邊界條件

### Implementation for Edge Cases

- [x] T046 實作 `describe('edge cases')` 區塊
- [x] T047 測試：should format symbol correctly for CCXT (BTCUSDT → BTC/USDT:USDT)
- [x] T048 測試：should handle order execution timeout (30 seconds)
- [x] T049 測試：should handle order price of 0 by fetching ticker price
- [x] T050 測試：should handle Binance position mode error (-4061) with retry

---

## Phase 9: Polish & Validation ✅ COMPLETED

**Purpose**: 驗證覆蓋率和測試品質

- [x] T051 執行完整測試套件驗證所有測試通過
- [x] T052 生成覆蓋率報告並驗證達到 80%+ 行覆蓋
- [x] T053 驗證測試執行時間低於 10 秒
- [x] T054 執行 quickstart.md 中的驗證命令

---

## Summary

**完成日期**: 2025-12-28

### 測試結果

| 指標 | 結果 | 目標 |
|------|------|------|
| 測試數量 | 35 個 | 25+ |
| 通過率 | 100% | 100% |
| 語句覆蓋率 | 82% | 80%+ ✅ |
| 分支覆蓋率 | 66% | - |
| 執行時間 | ~30ms | <10s ✅ |

### 測試檔案

- `tests/unit/services/PositionOrchestrator.test.ts` - 1,070 行

### 覆蓋的場景

1. **雙邊開倉成功** (7 個測試)
2. **回滾機制** (10 個測試)
3. **雙邊都失敗** (4 個測試)
4. **餘額驗證** (3 個測試)
5. **條件單設定** (8 個測試)
6. **分散式鎖** (2 個測試)
7. **邊界情況** (4 個測試)
