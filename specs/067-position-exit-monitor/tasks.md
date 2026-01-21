# Tasks: 持倉平倉建議監控 (Position Exit Monitor)

**Input**: Design documents from `/specs/067-position-exit-monitor/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

---

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup - 資料模型與基礎設施

**Purpose**: 擴展 Prisma schema 並建立核心型別定義

### Tests for Phase 1 (RED Phase) 🔴

- [ ] T001 [TEST] 建立 TradingSettings exitSuggestion 欄位的 Repository 測試 `tests/unit/repositories/TradingSettingsRepository.exitSuggestion.test.ts`
  - 測試 getByUserId 返回 exitSuggestion 欄位
  - 測試 update 更新 exitSuggestion 欄位
  - **執行測試，驗證 FAIL**

- [ ] T002 [TEST] 建立 Position exitSuggestion 欄位的更新測試 `tests/unit/repositories/PositionRepository.exitSuggestion.test.ts`
  - 測試 updateExitSuggestionStatus 更新平倉建議狀態
  - 測試 findOpenPositionsBySymbol 查詢條件
  - **執行測試，驗證 FAIL**

### Implementation for Phase 1 (GREEN Phase) 🟢

- [ ] T003 [P] 擴展 Prisma Schema - TradingSettings 模型 `prisma/schema.prisma`
  - 新增 exitSuggestionEnabled (Boolean, default: true)
  - 新增 exitSuggestionThreshold (Decimal(10,2), default: 100)
  - 新增 exitNotificationEnabled (Boolean, default: true)

- [ ] T004 [P] 擴展 Prisma Schema - Position 模型 `prisma/schema.prisma`
  - 新增 cachedFundingPnL (Decimal(18,8), nullable)
  - 新增 cachedFundingPnLUpdatedAt (DateTime, nullable)
  - 新增 exitSuggested (Boolean, default: false)
  - 新增 exitSuggestedAt (DateTime, nullable)
  - 新增 exitSuggestedReason (VarChar(50), nullable)

- [ ] T005 執行 Prisma Migration `prisma/migrations/*_add_exit_suggestion_fields/`
  - `pnpm prisma migrate dev --name add_exit_suggestion_fields`
  - **執行 T001, T002 測試，驗證 PASS**

- [ ] T006 [P] 定義 TypeScript 型別 `src/services/monitor/types.ts`
  - ExitSuggestionReason type ('APY_NEGATIVE' | 'PROFIT_LOCKABLE')
  - ExitSuggestion interface
  - ExitSuggestionMessage interface

**Checkpoint**: Schema 擴展完成，可以開始實作核心監控服務

---

## Phase 2: User Story 1 - 接收平倉建議通知 (Priority: P1) 🎯 MVP

**Goal**: 用戶開倉後，系統監控持倉狀態，當符合條件時透過 WebSocket 和 Discord/Slack 發送平倉建議

**Independent Test**: 開啟測試持倉，模擬 APY 變化，驗證通知正確發送

### Tests for User Story 1 (RED Phase) 🔴

- [ ] T007 [P] [US1] [TEST] 核心監控服務單元測試 `tests/unit/services/PositionExitMonitor.test.ts`
  - 測試 shouldSuggestClose() 在 APY < 0% 時返回 APY_NEGATIVE
  - 測試 shouldSuggestClose() 在 APY < threshold 且 fundingPnL > priceDiffLoss 時返回 PROFIT_LOCKABLE
  - 測試 shouldSuggestClose() 在不符合條件時返回 null
  - 測試 handleRateUpdated() 查詢 OPEN 持倉並檢查條件
  - 測試防抖動機制（1 分鐘內不重複通知）
  - **執行測試，驗證 FAIL**

- [ ] T008 [P] [US1] [TEST] 累計費率收益計算測試 `tests/unit/lib/FundingPnLCalculator.test.ts`
  - 測試 getCumulativeFundingPnL() 計算正確
  - 測試快取機制（5 分鐘 TTL）
  - 測試多方/空方收益加總
  - **執行測試，驗證 FAIL**

- [ ] T009 [P] [US1] [TEST] WebSocket 推送測試 `tests/unit/services/PositionExitEmitter.test.ts`
  - 測試 emitExitSuggested() 發送正確事件格式
  - 測試 emitExitCanceled() 發送正確事件格式
  - **執行測試，驗證 FAIL**

- [ ] T010 [P] [US1] [TEST] 通知服務擴展測試 `tests/unit/notification/ExitSuggestionNotification.test.ts`
  - 測試 formatExitSuggestionMessage() 格式化正確
  - 測試 DiscordNotifier.sendExitSuggestionNotification()
  - 測試 SlackNotifier.sendExitSuggestionNotification()
  - **執行測試，驗證 FAIL**

- [ ] T011 [US1] [TEST] 整合測試 `tests/integration/PositionExitMonitorFlow.test.ts`
  - 測試完整流程：rate-updated → 檢查持倉 → 發送通知
  - 測試 APY 回升時發送 canceled 事件
  - **執行測試，驗證 FAIL**

### Implementation for User Story 1 (GREEN Phase) 🟢

#### 核心監控服務

- [ ] T012 [US1] 實作累計費率收益計算器 `src/lib/funding-pnl-calculator.ts`
  - getCumulativeFundingPnL(position, exchangeConnectors): Promise<Decimal>
  - 使用 CCXT fetchFundingHistory 查詢結算記錄
  - 實作 5 分鐘 TTL 快取邏輯
  - 更新 Position.cachedFundingPnL 和 cachedFundingPnLUpdatedAt
  - **執行 T008 測試，驗證 PASS**

- [ ] T013 [US1] 實作核心監控服務 `src/services/monitor/PositionExitMonitor.ts`
  - attach(monitor: EventEmitter): void - 監聽 rate-updated 事件
  - handleRateUpdated(data: FundingRatePair): Promise<void>
  - shouldSuggestClose(): { suggest: boolean; reason: ExitSuggestionReason | null }
  - checkOpenPositions(symbol: string, currentAPY: number): Promise<void>
  - calculatePriceDiffLoss(position, currentPrices): Decimal
  - 實作防抖動機制（Map<positionId, lastNotifiedAt>）
  - **執行 T007 測試，驗證 PASS**

- [ ] T014 [US1] 實作服務初始化 `src/lib/position-exit-monitor-init.ts`
  - initPositionExitMonitor(): PositionExitMonitor
  - 單例模式（globalThis._positionExitMonitor）
  - 整合到 gracefulShutdown
  - 環境變數 ENABLE_POSITION_EXIT_MONITOR 控制

#### WebSocket 推送

- [ ] T015 [US1] 實作 WebSocket 推送服務 `src/services/websocket/PositionExitEmitter.ts`
  - emitExitSuggested(userId, data: ExitSuggestedEvent): void
  - emitExitCanceled(userId, data: ExitCanceledEvent): void
  - 參照 TriggerProgressEmitter 模式
  - **執行 T009 測試，驗證 PASS**

#### Discord/Slack 通知

- [ ] T016 [P] [US1] 擴展通知型別 `src/services/notification/types.ts`
  - 新增 ExitSuggestionMessage interface

- [ ] T017 [P] [US1] 擴展通知格式化工具 `src/services/notification/utils.ts`
  - formatExitSuggestionMessage(message: ExitSuggestionMessage): string
  - 格式：🔔 平倉建議、原因、APY、累計收益、價差損失、淨收益

- [ ] T018 [US1] 擴展 DiscordNotifier `src/services/notification/DiscordNotifier.ts`
  - sendExitSuggestionNotification(webhookUrl, message): Promise<NotificationResult>

- [ ] T019 [US1] 擴展 SlackNotifier `src/services/notification/SlackNotifier.ts`
  - sendExitSuggestionNotification(webhookUrl, message): Promise<NotificationResult>
  - **執行 T010 測試，驗證 PASS**

#### 整合

- [ ] T020 [US1] 整合 PositionExitMonitor 到 MonitorService `src/services/MonitorService.ts`
  - 在 FundingRateMonitor 初始化後 attach PositionExitMonitor
  - **執行 T011 整合測試，驗證 PASS**

**Checkpoint**: User Story 1 完成 - 用戶可以收到平倉建議通知

---

## Phase 3: User Story 2 - 設定平倉建議偏好 (Priority: P2)

**Goal**: 用戶可以在設定頁面調整平倉建議的相關參數

**Independent Test**: 修改設定後驗證系統行為相應改變

### Tests for User Story 2 (RED Phase) 🔴

- [ ] T021 [P] [US2] [TEST] API 端點測試 `tests/unit/api/settings-trading.exitSuggestion.test.ts`
  - 測試 GET /api/settings/trading 返回 exitSuggestion 欄位
  - 測試 PATCH /api/settings/trading 更新 exitSuggestion 欄位
  - 測試驗證 exitSuggestionThreshold 範圍 (0-500)
  - **執行測試，驗證 FAIL**

### Implementation for User Story 2 (GREEN Phase) 🟢

- [ ] T022 [US2] 擴展 TradingSettingsRepository `src/repositories/TradingSettingsRepository.ts`
  - 在 getByUserId 返回新增欄位
  - 在 update 處理新增欄位更新

- [ ] T023 [US2] 擴展 API 端點 `app/api/settings/trading/route.ts`
  - GET: 返回 exitSuggestionEnabled, exitSuggestionThreshold, exitNotificationEnabled
  - PATCH: 接受並更新這三個欄位
  - 驗證 exitSuggestionThreshold 在 0-500 範圍內
  - **執行 T021 測試，驗證 PASS**

- [ ] T024 [US2] 建立前端設定元件 `app/(dashboard)/settings/trading/components/ExitSuggestionSettings.tsx`
  - 平倉建議啟用開關
  - APY 閾值輸入框（0-500%）
  - Discord/Slack 通知啟用開關
  - 使用 Radix UI Switch 和 Input

- [ ] T025 [US2] 整合到交易設定頁面 `app/(dashboard)/settings/trading/page.tsx`
  - 引入 ExitSuggestionSettings 元件
  - 整合表單提交邏輯

**Checkpoint**: User Story 2 完成 - 用戶可以自訂平倉建議設定

---

## Phase 4: User Story 3 - 在持倉頁面看到平倉建議警告 (Priority: P3)

**Goal**: 用戶在持倉列表頁面可以即時看到哪些持倉被建議平倉

**Independent Test**: 前端 UI 直接驗證警告顯示

### Tests for User Story 3 (RED Phase) 🔴

- [ ] T026 [P] [US3] [TEST] WebSocket Hook 測試 `tests/hooks/useExitSuggestion.test.ts`
  - 測試 onSuggested callback 觸發
  - 測試 onCanceled callback 觸發
  - **執行測試，驗證 FAIL**

### Implementation for User Story 3 (GREEN Phase) 🟢

- [ ] T027 [US3] 建立警告元件 `app/(dashboard)/positions/components/ExitSuggestionWarning.tsx`
  - 顯示建議原因（APY 轉負 / 獲利可鎖定）
  - 顯示關鍵數據（當前 APY、淨收益）
  - 使用醒目的警告樣式（黃色/橙色）

- [ ] T028 [US3] 建立 WebSocket Hook `app/(dashboard)/positions/hooks/useExitSuggestion.ts`
  - 監聽 position:exit:suggested 事件
  - 監聯 position:exit:canceled 事件
  - 提供 onSuggested, onCanceled callback
  - **執行 T026 測試，驗證 PASS**

- [ ] T029 [US3] 擴展 PositionCard 元件 `app/(dashboard)/positions/components/PositionCard.tsx`
  - 當 position.exitSuggested 為 true 時顯示 ExitSuggestionWarning
  - 傳入 reason 和 suggestedAt

- [ ] T030 [US3] 整合 WebSocket 到持倉頁面 `app/(dashboard)/positions/page.tsx`
  - 使用 useExitSuggestion hook
  - onSuggested: 顯示 toast 通知
  - onCanceled: 顯示 toast 通知（建議取消）

**Checkpoint**: User Story 3 完成 - 用戶可以在持倉頁面看到平倉建議警告

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: 文件更新與程式碼清理

- [ ] T031 [P] 更新 CLAUDE.md 新增 Feature 067 相關資訊
- [ ] T032 [P] 執行 quickstart.md 驗證流程
- [ ] T033 執行所有測試確保通過 `pnpm test`
- [ ] T034 執行 lint 和型別檢查 `pnpm lint && pnpm exec tsc --noEmit`

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup) ──────────────────────────────┐
                                              ▼
Phase 2 (US1: 平倉建議通知) ◄── P1 MVP ───────┤
                                              │
Phase 3 (US2: 設定偏好) ◄── P2 ───────────────┤
                                              │
Phase 4 (US3: 前端警告) ◄── P3 ───────────────┤
                                              ▼
Phase 5 (Polish) ─────────────────────────────┘
```

### User Story Dependencies

- **US1 (P1)**: 依賴 Phase 1 完成，無其他依賴
- **US2 (P2)**: 依賴 Phase 1 完成，與 US1 可並行
- **US3 (P3)**: 依賴 US1 的 WebSocket 事件定義

### Parallel Opportunities

**Phase 1 並行任務**:
- T003 + T004: Schema 擴展（不同 model）
- T001 + T002: 測試檔案（不同檔案）

**Phase 2 並行任務**:
- T007 + T008 + T009 + T010: 所有測試（不同檔案）
- T016 + T017: 通知型別和格式化工具

**Phase 3 並行任務**:
- T021: API 測試
- T024 + T025: 前端元件

**Phase 4 並行任務**:
- T026: Hook 測試
- T027 + T028: 前端元件

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. 完成 Phase 1: Setup（Schema + Types）
2. 完成 Phase 2: User Story 1（核心功能）
3. **驗證**: 測試平倉建議通知流程
4. 可交付 MVP

### Full Feature

1. MVP + Phase 3: User Story 2（設定頁面）
2. MVP + Phase 4: User Story 3（前端警告）
3. Phase 5: Polish

---

## Notes

- TDD 流程：RED（測試失敗）→ GREEN（實作通過）→ REFACTOR
- 每個 Checkpoint 後驗證功能獨立可用
- 遵循現有專案模式（參照 ArbitrageOpportunityTracker, TriggerProgressEmitter）
- 使用 Decimal.js 確保精度計算
