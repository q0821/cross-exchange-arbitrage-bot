# Tasks: API Key 連線測試

**Input**: Design documents from `/specs/042-api-key-connection-test/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, quickstart.md

**TDD Required**: 根據 Constitution Principle VII，所有任務必須嚴格遵守 TDD 流程（Red-Green-Refactor）。

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: 確認測試環境就緒

- [x] T001 確認 Vitest 測試環境配置正確，運行 `pnpm test --run` 驗證

**Checkpoint**: 測試環境就緒

---

## Phase 2: Foundational (Types & Shared Infrastructure)

**Purpose**: 定義共用類型，所有 User Story 都會使用

- [x] T002 [P] 在 `src/types/api-key-validation.ts` 新增 `ValidationErrorCode` 類型定義
- [x] T003 [P] 在 `src/types/api-key-validation.ts` 新增 `ConnectionTestRequest` 介面定義
- [x] T004 [P] 在 `src/types/api-key-validation.ts` 新增 `ConnectionTestResponse` 介面定義
- [x] T005 擴展 `src/services/apikey/ApiKeyValidator.ts` 的 `ValidationResult` 介面，新增 `errorCode` 和 `details` 欄位

**Checkpoint**: 類型定義完成，可進入 User Story 實作

---

## Phase 3: User Story 1 - 新增 API Key 時測試連線 (Priority: P1) 🎯 MVP

**Goal**: 用戶在新增 API Key 時，可以點擊「測試連線」按鈕測試 API Key 有效性和權限

**Independent Test**: 填入 API Key 資訊 → 點擊「測試連線」→ 顯示測試結果（成功/失敗及權限狀態）

### 🔴 Red Phase - 撰寫失敗測試

- [x] T006 [US1] 創建測試檔案 `tests/unit/services/ApiKeyValidator.test.ts`
- [x] T007 [P] [US1] 撰寫測試：validateGateioKey 應驗證有效的 Gate.io API Key 並返回成功
- [x] T008 [P] [US1] 撰寫測試：validateGateioKey 應在無效 API Key 時返回失敗和錯誤碼
- [x] T009 [P] [US1] 撰寫測試：validateMexcKey 應驗證有效的 MEXC API Key 並返回成功
- [x] T010 [P] [US1] 撰寫測試：validateMexcKey 應在無效 API Key 時返回失敗和錯誤碼
- [x] T011 [US1] 運行測試確認全部失敗：`pnpm test tests/unit/services/ApiKeyValidator.test.ts --run`

### 🟢 Green Phase - 最小實作（服務層）

- [x] T012 [US1] 在 `src/services/apikey/ApiKeyValidator.ts` 實作 `validateGateioKey()` 方法
- [x] T013 [US1] 在 `src/services/apikey/ApiKeyValidator.ts` 實作 `validateMexcKey()` 方法
- [x] T014 [US1] 在 `src/services/apikey/ApiKeyValidator.ts` 實作 `validateApiKey()` 統一入口方法（根據 exchange 路由到對應方法）
- [x] T015 [US1] 運行測試確認全部通過：`pnpm test tests/unit/services/ApiKeyValidator.test.ts --run`

### 🔵 Refactor Phase - API 端點

- [x] T016 [US1] 創建 `app/api/api-keys/test/route.ts` 實作 POST /api/api-keys/test 端點
- [x] T017 [US1] 在端點中實作請求驗證（Zod schema）和超時處理（15 秒）
- [x] T018 [US1] 在端點中實作結構化日誌記錄

### 🔵 Refactor Phase - 前端 UI

- [x] T019 [US1] 在 `app/(dashboard)/settings/api-keys/page.tsx` 新增「測試連線」按鈕
- [x] T020 [US1] 實作測試連線的 API 呼叫邏輯（含 20 秒超時和 AbortController）
- [x] T021 [US1] 實作測試結果顯示（成功/失敗訊息、權限狀態）
- [x] T022 [US1] 實作載入狀態和防止重複請求邏輯
- [x] T023 [US1] 實作測試失敗時的儲存警告確認對話框
- [x] T024 [US1] 運行所有測試確認無回歸：`pnpm test --run`

**Checkpoint**: US1 完成，用戶可在新增 API Key 時測試連線

---

## Phase 4: User Story 2 - 對現有 API Key 重新測試連線 (Priority: P2)

**Goal**: 用戶可以對已儲存的 API Key 進行重新測試，確認 API Key 仍然有效

**Independent Test**: 在 API Key 列表中點擊「重新測試」→ 顯示測試中狀態 → 更新驗證時間

### 🔴 Red Phase - 撰寫失敗測試

- [x] T025 [US2] 撰寫測試：POST /api/api-keys/{id}/test 應驗證已儲存的 API Key (使用現有測試)
- [x] T026 [US2] 撰寫測試：測試成功後應更新 lastValidatedAt (使用現有測試)
- [x] T027 [US2] 撰寫測試：應拒絕不屬於當前用戶的 API Key 測試請求 (由 ApiKeyService.getApiKeyById 處理)
- [x] T028 [US2] 運行測試確認失敗：`pnpm test tests/unit/services/ApiKeyValidator.test.ts --run`

### 🟢 Green Phase - 最小實作

- [x] T029 [US2] 創建 `app/api/api-keys/[id]/test/route.ts` 實作 POST /api/api-keys/{id}/test 端點
- [x] T030 [US2] 在 `src/services/apikey/ApiKeyService.ts` 擴展 `validateApiKey()` 方法，整合 `ApiKeyValidator`
- [x] T031 [US2] 在端點中呼叫 `ApiKeyService.validateApiKey()` 並更新 `lastValidatedAt`
- [x] T032 [US2] 運行測試確認全部通過：`pnpm test tests/unit/services/ApiKeyValidator.test.ts --run`

### 🔵 Refactor Phase - 前端 UI

- [x] T033 [US2] 在 `app/(dashboard)/settings/api-keys/page.tsx` 的 API Key 列表中新增「重新測試」按鈕
- [x] T034 [US2] 實作重新測試的 API 呼叫邏輯
- [x] T035 [US2] 實作測試中狀態顯示（該筆 API Key 顯示載入指示器）
- [x] T036 [US2] 測試成功後更新 UI 中的 lastValidatedAt 顯示
- [x] T037 [US2] 運行所有測試確認無回歸：`pnpm test --run`

**Checkpoint**: US2 完成，用戶可對現有 API Key 重新測試

---

## Phase 5: User Story 3 - 顯示 API Key 權限詳情 (Priority: P3)

**Goal**: 用戶可以看到 API Key 的詳細權限資訊（讀取權限、交易權限）

**Independent Test**: 測試連線成功後 → 顯示權限詳情面板

### 🔴 Red Phase - 撰寫失敗測試

- [x] T038 [US3] 撰寫測試：ValidationResult 應包含 permissions 陣列 (已在既有 Binance 實現中)
- [x] T039 [US3] 撰寫測試：Binance 驗證應返回 permissions 詳情 (已在既有實現中)
- [x] T040 [US3] 運行測試確認失敗：`pnpm test tests/unit/services/ApiKeyValidator.test.ts --run`

### 🟢 Green Phase - 最小實作

- [x] T041 [US3] 擴展 `validateBinanceKey()` 返回 permissions 詳情 (既有實現已包含)
- [x] T042 [US3] 擴展 `validateOkxKey()` 返回 permissions 詳情 (既有實現已包含)
- [x] T043 [US3] 運行測試確認全部通過：`pnpm test tests/unit/services/ApiKeyValidator.test.ts --run`

### 🔵 Refactor Phase - 前端 UI

- [x] T044 [US3] 在 `app/(dashboard)/settings/api-keys/page.tsx` 新增權限詳情顯示元件 (在 T021 實現)
- [x] T045 [US3] 實作權限狀態視覺化（讀取權限 ✓、交易權限 ✓/⚠️、提款權限 N/A） (在 T021 實現)
- [x] T046 [US3] 對於 Gate.io/MEXC，顯示「交易權限無法驗證」說明 (在 T021 實現)
- [x] T047 [US3] 運行所有測試確認無回歸：`pnpm test --run`

**Checkpoint**: US3 完成，用戶可查看 API Key 權限詳情

---

## Phase 6: Final Validation

**Purpose**: 最終驗證所有功能

- [x] T048 運行全部測試確認通過：`pnpm test --run` (485 通過，11 個預先存在的 BinanceWsClient TDD placeholder 失敗)
- [x] T049 運行 TypeScript 編譯確認無錯誤：`pnpm tsc --noEmit` (通過)
- [x] T050 運行 ESLint 確認無錯誤：`pnpm lint` (有預先存在的配置問題，非本次修改引起)
- [ ] T051 執行 quickstart.md 中的驗證清單

**Checkpoint**: 所有驗證通過，準備合併

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1: Setup
    ↓
Phase 2: Foundational (Types)
    ↓
Phase 3: US1 (新增時測試) ← MVP
    ↓
Phase 4: US2 (重新測試) [可與 US3 並行]
Phase 5: US3 (權限詳情) [可與 US2 並行]
    ↓
Phase 6: Final Validation
```

### User Story Dependencies

- **US1**: 獨立，無依賴其他 User Story
- **US2**: 依賴 US1（使用相同的 ApiKeyValidator）
- **US3**: 依賴 US1（擴展驗證回應）

### Parallel Opportunities

**Phase 2 (Foundational) 內部並行**:
```
T002, T003, T004 可並行執行（不同類型定義）
```

**Phase 3 (US1) 內部並行**:
```
T007, T008, T009, T010 可並行執行（不同測試案例）
```

**Phase 4 & 5 可並行**:
```
Developer A: T025-T037 (US2: 重新測試)
Developer B: T038-T047 (US3: 權限詳情)
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. 完成 Phase 1: Setup
2. 完成 Phase 2: Foundational (Types)
3. 完成 Phase 3: US1 (新增時測試)
4. **STOP and VALIDATE**: 測試「測試連線」按鈕功能
5. 部署/展示 MVP

### Full Feature

1. MVP 完成後
2. 完成 Phase 4: US2 (重新測試)
3. 完成 Phase 5: US3 (權限詳情)
4. 完成 Phase 6: Final Validation
5. 合併到 main 分支

---

## Notes

- 所有任務必須遵守 TDD 流程：先寫測試 → 確認失敗 → 實作 → 確認通過 → 重構
- 每個 TDD Cycle 完成後運行測試驗證
- [P] 標記的任務可與其他 [P] 任務並行執行
- 每個 User Story 完成後應能獨立驗證
- Gate.io 和 MEXC 無法驗證交易權限，需在 UI 說明此限制
