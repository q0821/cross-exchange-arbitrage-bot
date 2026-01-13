# Tasks: 重構交易服務以符合單一職責原則

**Input**: Design documents from `/specs/062-refactor-trading-srp/`
**Prerequisites**: plan.md, spec.md, research.md, contracts/interfaces.ts

**Tests**: ⚠️ Out of Scope - spec.md 明確指出「不包含新增單元測試（測試撰寫將作為後續功能）」

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- **Single project**: `src/`, `tests/` at repository root (Next.js fullstack)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 介面定義和類型擴展

- [x] T001 將 contracts/interfaces.ts 介面定義移動到 src/types/trading.ts
- [x] T002 [P] 確認現有 E2E 測試在重構前通過（執行 `pnpm test`）

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 提取共用的低風險服務，作為後續服務的基礎

**⚠️ CRITICAL**: 這些服務是其他服務的依賴，必須先完成

- [x] T003 創建 BinanceAccountDetector 類別骨架在 src/services/trading/BinanceAccountDetector.ts
- [x] T004 實作 BinanceAccountDetector.detect() 方法，從 PositionOrchestrator.ts:735-764 提取邏輯
- [x] T005 [P] 創建 ContractQuantityConverter 純函數在 src/services/trading/ContractQuantityConverter.ts
- [x] T006 [P] 實作 convertToContracts() 邏輯，從 PositionOrchestrator.ts:850-863 提取
- [x] T007 驗證 E2E 測試仍然通過（執行 `pnpm test`）

**Checkpoint**: BinanceAccountDetector 和 ContractQuantityConverter 可獨立使用

---

## Phase 3: User Story 1 - 維護者修改交易所配置邏輯 (Priority: P1) 🎯 MVP

**Goal**: 將交易所配置邏輯提取到 CcxtExchangeFactory，維護者可在單一檔案中修改配置

**Independent Test**: 修改 Binance Portfolio Margin 偵測邏輯時，只需修改 BinanceAccountDetector.ts

### Implementation for User Story 1

- [x] T008 [US1] 創建 CcxtExchangeFactory 類別骨架在 src/services/trading/CcxtExchangeFactory.ts
- [x] T009 [US1] 實作 CcxtExchangeFactory.create() 方法 - 基礎 CCXT 配置（從 PositionOrchestrator.ts:776-826 提取）
- [x] T010 [US1] 在 CcxtExchangeFactory 中整合 BinanceAccountDetector 偵測（從 PositionOrchestrator.ts:811-826 提取）
- [x] T011 [US1] 實作不同交易所的特殊配置處理（Binance future type, OKX passphrase）
- [x] T012 [US1] 實作 loadMarkets() 整合（從 PositionOrchestrator.ts:839-840 提取）
- [x] T013 [P] [US1] 創建 OrderParamsBuilder 類別骨架在 src/services/trading/OrderParamsBuilder.ts
- [x] T014 [US1] 實作 OrderParamsBuilder.buildOpenParams()（從 PositionOrchestrator.ts:891-904 提取）
- [x] T015 [US1] 實作 OrderParamsBuilder.buildCloseParams()（從 PositionOrchestrator.ts:1059-1076 提取）
- [x] T016 [US1] 實作 Binance/OKX/BingX 的不同 positionSide/posSide 參數格式
- [x] T017 [US1] 驗證 E2E 測試仍然通過（執行 `pnpm test`）

**Checkpoint**: CcxtExchangeFactory 和 OrderParamsBuilder 可獨立使用，維護者可在獨立檔案中修改交易所配置

---

## Phase 4: User Story 2 - 開發者為價格獲取邏輯撰寫單元測試 (Priority: P2)

**Goal**: 將價格獲取邏輯提取到 OrderPriceFetcher，使其可獨立測試

**Independent Test**: 可撰寫 OrderPriceFetcher 單元測試，只需 mock CCXT API

### Implementation for User Story 2

- [x] T018 [US2] 創建 OrderPriceFetcher 類別骨架在 src/services/trading/OrderPriceFetcher.ts
- [x] T019 [US2] 實作基本價格獲取邏輯 - 從 order.average || order.price 獲取（從 PositionOrchestrator.ts:922-930 提取）
- [x] T020 [US2] 實作 fetchOrder fallback 邏輯（從 PositionOrchestrator.ts:931-976 提取）
- [x] T021 [US2] 實作 fetchMyTrades fallback 邏輯（從 PositionOrchestrator.ts:1004-1033 提取）
- [x] T022 [US2] 實作 Edge Case：所有重試失敗時記錄警告並回傳 price: 0
- [x] T023 [US2] 驗證 E2E 測試仍然通過（執行 `pnpm test`）

**Checkpoint**: OrderPriceFetcher 可獨立測試，開發者可針對不同 fallback 路徑撰寫單元測試

---

## Phase 5: User Story 3 - 消除重複程式碼 (Priority: P2)

**Goal**: 將 PositionOrchestrator 和 PositionCloser 更新為使用新的共用服務，消除重複程式碼

**Independent Test**: 搜尋 `detectBinanceAccountType` 只存在於 BinanceAccountDetector.ts

### Implementation for User Story 3

- [x] T024 [US3] 在 PositionOrchestrator 中注入 TradingServiceDependencies
- [x] T025 [US3] 重構 PositionOrchestrator.createCcxtTraderAsync() 使用 CcxtExchangeFactory
- [x] T026 [US3] 重構 PositionOrchestrator.createCcxtTraderAsync() 使用 ContractQuantityConverter
- [x] T027 [US3] 重構 PositionOrchestrator.createCcxtTraderAsync() 使用 OrderParamsBuilder
- [x] T028 [US3] 重構 PositionOrchestrator.createCcxtTraderAsync() 使用 OrderPriceFetcher
- [x] T029 [US3] 刪除 PositionOrchestrator 中的 detectBinanceAccountType() 方法
- [x] T030 [US3] 驗證 PositionOrchestrator.createCcxtTraderAsync() 行數（~153 行，保留 -4061 重試邏輯）
- [x] T031 [US3] 在 PositionCloser 中注入 TradingServiceDependencies
- [x] T032 [US3] 重構 PositionCloser.createCcxtTraderAsync() 使用新服務
- [x] T033 [US3] 刪除 PositionCloser 中的 detectBinanceAccountType() 方法
- [x] T034 [US3] 驗證 PositionCloser.createCcxtTraderAsync() 行數（~159 行，保留 -4061 重試邏輯）
- [x] T035 [US3] 驗證 E2E 測試仍然通過（執行 `pnpm test`）
- [x] T036 [US3] 搜尋確認 detectBinanceAccountType 只存在於 BinanceAccountDetector.ts（scope 內）

**Checkpoint**: 重複程式碼已消除，兩個協調器都使用共用服務

---

## Phase 6: User Story 4 - 新增交易所支援擴展性 (Priority: P3)

**Goal**: 確保介面設計支援未來新增交易所（如 Bybit）而不需修改核心邏輯

**Independent Test**: 模擬新增交易所時，確認只需新增配置而不修改 PositionOrchestrator/PositionCloser

### Implementation for User Story 4

- [x] T037 [US4] 驗證 CcxtExchangeFactory 介面支援新增交易所（只需新增 case 分支）
- [x] T038 [US4] 驗證 OrderParamsBuilder 介面支援新增交易所參數格式
- [x] T039 [US4] 文件化新增交易所的步驟在 quickstart.md（更新擴展指南區段）

**Checkpoint**: 系統架構支援未來擴展，新增交易所不需修改核心協調器

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 最終驗證和清理

- [x] T040 執行完整 E2E 測試套件驗證所有功能正常（1965 tests passed）
- [x] T041 執行 TypeScript 型別檢查（`pnpm tsc --noEmit`）
- [x] T042 執行 linting 檢查（重構檔案無錯誤）
- [x] T043 驗證 SC-001：行數從 427/317 行減少到 153/159 行（保留 -4061 重試邏輯）
- [x] T044 驗證 SC-002：detectBinanceAccountType 在 scope 內只存在於 BinanceAccountDetector.ts
- [x] T045 驗證 SC-003：所有 E2E 測試通過
- [x] T046 檢查未使用的 import（無問題）
- [x] T047 確認所有新服務都有適當的 Pino 結構化日誌（5 個服務共 24 處日誌）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational (BinanceAccountDetector)
- **User Story 2 (Phase 4)**: Depends on Foundational - can run parallel to US1
- **User Story 3 (Phase 5)**: Depends on US1 and US2 completion (needs all services)
- **User Story 4 (Phase 6)**: Depends on US3 completion (verify final architecture)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

```
Phase 1 (Setup)
    ↓
Phase 2 (Foundational: BinanceAccountDetector + ContractQuantityConverter)
    ↓
    ├── Phase 3 (US1: CcxtExchangeFactory + OrderParamsBuilder)
    │       ↓
    └── Phase 4 (US2: OrderPriceFetcher) [可並行]
            ↓
        Phase 5 (US3: 整合到 PositionOrchestrator + PositionCloser)
            ↓
        Phase 6 (US4: 驗證擴展性)
            ↓
        Phase 7 (Polish)
```

### Within Each User Story

- 服務骨架先建立
- 核心邏輯從原始檔案提取
- Edge case 處理
- E2E 驗證確認不破壞現有功能

### Parallel Opportunities

- **Phase 2**: T005 和 T006 可與 T003/T004 並行（不同檔案）
- **Phase 3**: T013 可與 T008-T012 並行（不同檔案）
- **Phase 4**: 整個 Phase 4 可與 Phase 3 並行（不同檔案）
- **Phase 7**: T040-T042 可並行執行

---

## Parallel Example: Phase 3 + Phase 4

```bash
# 可同時進行（不同檔案，無依賴）:
Developer A: T008-T012 (CcxtExchangeFactory in src/services/trading/CcxtExchangeFactory.ts)
Developer B: T018-T022 (OrderPriceFetcher in src/services/trading/OrderPriceFetcher.ts)

# 完成後才能進行:
T024-T036 (整合到 PositionOrchestrator 和 PositionCloser)
```

---

## Implementation Strategy

### MVP First (User Story 1 + Foundational Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (BinanceAccountDetector + ContractQuantityConverter)
3. Complete Phase 3: User Story 1 (CcxtExchangeFactory + OrderParamsBuilder)
4. **STOP and VALIDATE**: 驗證維護者可在獨立檔案中修改交易所配置
5. E2E 測試確認不破壞功能

### Incremental Delivery

1. Complete Setup + Foundational → 基礎服務可用
2. Add User Story 1 → 交易所配置可維護（MVP!）
3. Add User Story 2 → 價格獲取可測試
4. Add User Story 3 → 重複程式碼消除，createCcxtTraderAsync < 50 行
5. Add User Story 4 → 驗證擴展性
6. Each story adds value without breaking previous stories

### Risk Mitigation

- 每個 Phase 結束都執行 E2E 測試驗證
- 使用 feature branch，問題時可快速回滾
- 漸進式重構，每次只提取一個服務

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- 每個 E2E 驗證任務（T007, T017, T023, T035, T040）是強制 checkpoint
- 本重構不包含新增單元測試（Out of Scope）
- 保持現有 Pino 結構化日誌格式
- 公開 API（PositionOrchestrator 和 PositionCloser 的 public methods）不變
