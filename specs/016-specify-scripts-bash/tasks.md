# Tasks: 擴大交易對監控規模

**Input**: Design documents from `/specs/016-specify-scripts-bash/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: 此功能包含手動驗證測試，不需要單元測試（純配置變更）

**Organization**: 任務按 User Story 組織，以支援獨立實作和測試

## Format: `[ID] [P?] [Story] Description`
- **[P]**: 可並行執行（不同檔案，無依賴）
- **[Story]**: 此任務屬於哪個 User Story（例如 US1, US2, US3）
- 包含明確的檔案路徑

## Path Conventions
- **Single project**: Repository root 的 `config/`, `src/`, `tests/`
- 此專案為單一專案結構（CLI + Web）

---

## Phase 1: Setup (共享基礎設施)

**Purpose**: 專案初始化和基本結構（此功能無需 Setup，使用現有基礎設施）

✅ **無需 Setup 階段** - 所有基礎設施已存在

---

## Phase 2: Foundational (阻塞性前置需求)

**Purpose**: 所有 User Story 開始前必須完成的核心基礎設施

⚠️ **CRITICAL**: 在此階段完成前，無法開始任何 User Story 工作

- [ ] T001 備份現有配置檔案 config/symbols.json 至 config/symbols.json.backup
- [ ] T002 驗證環境前置需求：Node.js >= 20.0.0, pnpm >= 8.0.0, Binance API 金鑰已設定

**Checkpoint**: 基礎準備完成 - User Story 實作可以開始

---

## Phase 3: User Story 1 - 執行腳本擴大監控清單 (Priority: P1) 🎯 MVP

**Goal**: 將系統監控的交易對從 30 個擴大至 100 個，以增加套利機會偵測數量

**Independent Test**: 執行 OI 更新腳本後，驗證 `config/symbols.json` 包含 100 個交易對，系統能成功啟動並獲取這些交易對的資金費率數據

### 實作 User Story 1

- [ ] T003 [US1] 執行 OI 更新腳本：`OI_TOP_N=100 pnpm update-oi-symbols`
- [ ] T004 [US1] 驗證腳本執行成功：檢查終端輸出顯示「已抓取 100 個交易對」且無錯誤訊息
- [ ] T005 [US1] 驗證配置檔案更新：執行 `cat config/symbols.json | jq '.groups.top100_oi.symbols | length'` 確認輸出為 100
- [ ] T006 [US1] 驗證配置結構完整：檢查 config/symbols.json 中 top100_oi.name 和 lastUpdate 欄位已正確更新
- [ ] T007 [US1] 重啟監控服務：執行 `pnpm dev` 或 `pnpm start`
- [ ] T008 [US1] 驗證服務啟動日誌：檢查日誌包含「Monitoring 100 symbols across 4 exchanges」
- [ ] T009 [US1] 驗證資金費率數據獲取：檢查日誌顯示「Successfully fetched rates for XX/100 symbols」且成功率 > 95%
- [ ] T010 [US1] 驗證前端頁面顯示：訪問 http://localhost:3000/market-monitor 確認顯示 ~100 個交易對
- [ ] T011 [US1] 驗證前端頁面載入時間：使用瀏覽器開發者工具確認載入時間 < 3 秒
- [ ] T012 [US1] 驗證 WebSocket 連接：確認前端右上角狀態指示顯示已連接，資料持續更新
- [ ] T013 [US1] 驗證 API 響應：執行 `curl http://localhost:3000/api/market-rates | jq '.rates | length'` 確認輸出為 100
- [ ] T014 [US1] 驗證市場統計：執行 `curl http://localhost:3000/api/market-stats | jq '.totalSymbols'` 確認輸出為 100

**Checkpoint**: 此時，User Story 1 應完全功能正常且可獨立測試。系統成功監控 100 個交易對。

---

## Phase 4: User Story 2 - 驗證交易對跨交易所可用性 (Priority: P2)

**Goal**: 確保新增的交易對在所有支援的交易所（Binance、OKX、MEXC、Gate.io）都有支援，以便系統能正確進行跨交易所套利分析

**Independent Test**: 系統啟動時自動驗證每個交易對在所有 4 個交易所的可用性，並在日誌中報告驗證結果

### 實作 User Story 2

- [ ] T015 [US2] 收集系統運行 1 個完整週期（5 分鐘）的日誌：執行 `tail -f logs/app.log` 或檢視終端輸出
- [ ] T016 [US2] 分析交易對可用性：統計每個交易對在 4 個交易所的可用狀態（成功/失敗）
- [ ] T017 [US2] 驗證錯誤處理機制：確認部分交易對在某交易所不可用時，系統優雅處理且不影響其他交易對
- [ ] T018 [US2] 計算交易所覆蓋率：統計在所有 4 個交易所都可用的交易對百分比（預期 70-80%）
- [ ] T019 [US2] 記錄不可用的交易對：建立清單記錄哪些交易對在哪些交易所不可用（可儲存至 logs/unavailable-pairs.txt）
- [ ] T020 [US2] 驗證套利計算仍正常運作：確認即使部分交易所缺少某些交易對，套利機會偵測仍正常

**Checkpoint**: 此時，User Stories 1 和 2 應都能獨立運作。系統已驗證交易對可用性並優雅處理不可用情況。

---

## Phase 5: User Story 3 - 監控系統效能和 API 使用率 (Priority: P3)

**Goal**: 監控系統的 API 使用率和效能指標，確保擴大監控規模後系統仍在可接受的負載範圍內運作

**Independent Test**: 系統運作 24 小時後，檢查日誌中的 API 呼叫統計和效能指標，確認沒有超過速率限制，且響應時間在可接受範圍內

### 實作 User Story 3

- [ ] T021 [P] [US3] 建立效能監控腳本：建立 scripts/monitor-performance.sh 用於收集系統效能數據
- [ ] T022 [US3] 監控 API 呼叫頻率：在系統運行期間統計每個交易所每分鐘的 API 呼叫次數
- [ ] T023 [US3] 驗證 API 速率限制未觸發：檢查日誌確認無 "rate limit" 或 "429" 錯誤訊息
- [ ] T024 [US3] 監控 API 響應時間：收集並計算平均響應時間，確認在正常範圍（< 500ms）
- [ ] T025 [US3] 監控記憶體使用量：執行 `node -e "console.log(process.memoryUsage())"` 並與擴展前比較，確認增加 < 1MB
- [ ] T026 [US3] 收集 24 小時運行統計：記錄系統連續運行 24 小時的穩定性、錯誤率、API 成功率
- [ ] T027 [US3] 生成效能報告：建立報告文件 logs/performance-report-100-pairs.md 包含所有效能指標
- [ ] T028 [US3] 驗證效能符合目標：確認所有指標符合 research.md 中的預期（API 使用率 < 50%, 記憶體 < 1MB 增加, 載入時間 < 3s）

**Checkpoint**: 所有 User Stories 應現在都能獨立運作。系統效能已驗證符合預期。

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 影響多個 User Stories 的改進和文件化

- [ ] T029 [P] 更新專案文件：更新 README.md 說明監控交易對數量從 30 增加至 100（如需要）
- [ ] T030 [P] 建立變更日誌：在 CHANGELOG.md 記錄此功能的配置變更
- [ ] T031 執行 quickstart.md 完整驗證：依照 quickstart.md 步驟完整執行一次，確認所有步驟正確
- [ ] T032 驗證回滾程序：測試使用備份恢復配置檔案，確認可成功回滾至 30 個交易對
- [ ] T033 [P] 清理備份檔案：視需要保留或移除 config/symbols.json.backup
- [ ] T034 提交變更：執行 `git add config/symbols.json` 並提交配置變更（如需納入版本控制）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: 無依賴 - 可立即開始
- **User Story 1 (Phase 3)**: 依賴 Foundational 完成
- **User Story 2 (Phase 4)**: 依賴 User Story 1 完成（需要系統已在監控 100 個交易對）
- **User Story 3 (Phase 5)**: 依賴 User Story 1 完成（需要系統已在監控 100 個交易對）
- **Polish (Phase 6)**: 依賴所有需要的 User Stories 完成

### User Story Dependencies

- **User Story 1 (P1)**: 可在 Foundational (Phase 2) 後開始 - 無其他 Story 依賴
- **User Story 2 (P2)**: 依賴 User Story 1（需先擴大至 100 個交易對）- 但可獨立測試
- **User Story 3 (P3)**: 依賴 User Story 1（需先擴大至 100 個交易對）- 但可獨立測試

**注意**: User Story 2 和 3 可在 User Story 1 完成後並行執行（不同團隊成員）

### Within Each User Story

- User Story 1: 嚴格順序執行（腳本 → 驗證 → 重啟 → 測試）
- User Story 2: 嚴格順序執行（收集日誌 → 分析 → 驗證）
- User Story 3: 部分可並行（T021 腳本建立可提前，其他需順序執行）

### Parallel Opportunities

- **Phase 2**: T001 和 T002 可並行
- **Phase 6**: T029, T030, T033 可並行
- **User Story 2 vs User Story 3**: 在 US1 完成後可由不同人員並行執行

---

## Parallel Example: After User Story 1 Completes

```bash
# User Story 2 和 3 可同時開始（不同開發者）:
Developer A 執行 User Story 2:
  Task: "收集系統運行 1 個完整週期（5 分鐘）的日誌"
  Task: "分析交易對可用性"
  ...

Developer B 執行 User Story 3:
  Task: "建立效能監控腳本 scripts/monitor-performance.sh"
  Task: "監控 API 呼叫頻率"
  ...
```

---

## Implementation Strategy

### MVP First (僅 User Story 1)

1. Complete Phase 2: Foundational
2. Complete Phase 3: User Story 1
3. **STOP and VALIDATE**: 獨立測試 User Story 1
4. 驗證系統成功監控 100 個交易對，套利機會數量增加
5. 如符合預期，可停在此處或繼續 US2/US3

### Incremental Delivery

1. Complete Foundational → 基礎準備完成
2. Add User Story 1 → 獨立測試 → **部署/展示（MVP！）**
3. Add User Story 2 → 獨立測試 → 部署/展示（增加可用性驗證）
4. Add User Story 3 → 獨立測試 → 部署/展示（增加效能監控）
5. 每個 Story 增加價值而不破壞先前的 Stories

### Parallel Team Strategy

如有多位開發者：

1. 團隊一起完成 Foundational
2. 團隊一起完成 User Story 1（關鍵 MVP）
3. User Story 1 完成後：
   - Developer A: User Story 2（交易對可用性驗證）
   - Developer B: User Story 3（效能監控）
4. Stories 獨立完成並整合

---

## Notes

- **[P] 任務** = 不同檔案，無依賴關係
- **[Story] 標籤**將任務映射到特定 User Story 以便追溯
- 每個 User Story 應可獨立完成和測試
- 此功能無需單元測試（純配置變更），僅需手動驗證
- 在每個 Checkpoint 停止以獨立驗證 Story
- 避免：模糊任務、相同檔案衝突、破壞獨立性的跨 Story 依賴

---

## Task Summary

**總任務數**: 34 個任務

**每個 User Story 的任務數**:
- Foundational: 2 個任務
- User Story 1 (P1 - MVP): 12 個任務
- User Story 2 (P2): 6 個任務
- User Story 3 (P3): 8 個任務
- Polish: 6 個任務

**並行機會**:
- Phase 2: 2 個任務可並行
- Phase 6: 3 個任務可並行
- User Story 2 和 3 在 US1 完成後可並行執行

**建議 MVP 範圍**: User Story 1 (P1)
- 預估工時：1-2 小時（包含驗證）
- 交付價值：系統成功監控 100 個交易對，套利機會數量增加至 15-30 個/天

**獨立測試準則**:
- **US1**: 系統啟動日誌顯示監控 100 個交易對，前端頁面顯示 100 個交易對，API 返回 100 個交易對數據
- **US2**: 日誌記錄每個交易對在各交易所的可用狀態，系統優雅處理不可用情況
- **US3**: 效能報告顯示所有指標符合預期（API 使用率、記憶體、響應時間）

**格式驗證**: ✅ 所有任務遵循檢查清單格式（checkbox、ID、標籤、檔案路徑）
