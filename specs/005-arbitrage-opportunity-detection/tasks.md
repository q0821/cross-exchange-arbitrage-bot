# Implementation Tasks: 套利機會自動偵測系統

**Feature**: 005-arbitrage-opportunity-detection
**Branch**: `005-arbitrage-opportunity-detection`
**Generated**: 2025-10-21
**Status**: Ready for Implementation

---

## Overview

This document provides a comprehensive, ordered task list for implementing the **Arbitrage Opportunity Detection System**. Tasks are organized by user story to enable independent, incremental delivery.

### User Stories Summary

| Story | Priority | Goal | Independent Test |
|-------|----------|------|------------------|
| **US1** | P1 | 自動偵測套利機會並即時通知 | 模擬費率數據驗證偵測和通知 |
| **US2** | P1 | 多幣別機會排序與優先級 | 模擬多機會驗證排序邏輯 |
| **US3** | P2 | 機會生命週期追蹤與歷史記錄 | 模擬機會記錄驗證歷史查詢 |
| **US4** | P3 | 多通道通知機制 | 配置不同通道驗證通知發送 |

### Implementation Strategy

- **MVP Scope**: User Story 1 (P1) - 核心偵測與通知功能
- **Parallel Opportunities**: 標記 `[P]` 的任務可並行執行（不同檔案、無相依性）
- **Incremental Testing**: 每個 User Story 可獨立測試驗證
- **Dependencies**: Phase 2 (Foundational) 必須在所有 User Stories 之前完成

---

## Phase 1: Setup (專案初始化)

**Goal**: 建立資料庫 schema、基礎設施和型別定義

**Status**: ⏳ Pending

### Tasks

- [ ] T001 建立 Prisma schema 定義 (ArbitrageOpportunity, OpportunityHistory, NotificationLog) 於 `prisma/schema.prisma`
- [ ] T002 生成 Prisma migration 檔案 `pnpm prisma migrate dev --name add-opportunity-detection`
- [ ] T003 建立 TimescaleDB hypertable migration 於 `prisma/migrations/[timestamp]_setup_timescaledb/migration.sql`
- [ ] T004 執行所有 migrations `pnpm prisma migrate deploy`
- [ ] T005 [P] 建立事件型別定義於 `src/types/events.ts` (OpportunityDetectorEvents, NotificationServiceEvents)
- [ ] T006 [P] 建立服務介面型別於 `src/types/service-interfaces.ts` (IOpportunityDetector, INotificationService, IArbitrageOpportunityRepository)
- [ ] T007 生成 Prisma Client `pnpm prisma generate`

**Completion Criteria**:
- ✅ 所有 migrations 成功執行
- ✅ Prisma Client 生成無錯誤
- ✅ 資料庫包含 3 個新資料表 (arbitrage_opportunities, opportunity_history, notification_logs)
- ✅ NotificationLog 已轉換為 TimescaleDB hypertable

---

## Phase 2: Foundational (基礎元件)

**Goal**: 建立跨 User Story 共用的基礎元件（領域模型、儲存庫、工具函式）

**Status**: ⏳ Pending
**Depends On**: Phase 1 完成

### Tasks

#### 領域模型

- [ ] T008 [P] 建立 ArbitrageOpportunity 領域模型於 `src/models/ArbitrageOpportunity.ts`
  - 包含 `createArbitrageOpportunity()` 工廠函式
  - 包含 `calculateAnnualizedReturn()` 計算函式
  - 包含 `getSeverity()` 判斷函式
  - 包含 Zod validation schema

- [ ] T009 [P] 建立 OpportunityHistory 領域模型於 `src/models/OpportunityHistory.ts`
  - 包含 `createOpportunityHistory()` 工廠函式
  - 包含統計計算邏輯

#### 儲存庫層

- [ ] T010 實作 ArbitrageOpportunityRepository 於 `src/repositories/ArbitrageOpportunityRepository.ts`
  - 實作所有 CRUD 方法
  - 實作 `findActive()`, `findBySymbol()` 查詢方法
  - 實作 `markAsExpired()`, `incrementNotificationCount()` 更新方法
  - 實作 `getStatistics()` 統計方法

- [ ] T011 [P] 實作 OpportunityHistoryRepository 於 `src/repositories/OpportunityHistoryRepository.ts`
  - 實作 `create()`, `findByOpportunityId()` 方法
  - 實作 `findRecent()`, `findMany()` 查詢方法
  - 實作 `calculatePassRate()`, `getDurationStats()` 統計方法

- [ ] T012 [P] 實作 NotificationLogRepository 於 `src/repositories/NotificationLogRepository.ts`
  - 實作 `create()`, `findByOpportunityId()` 方法
  - 實作 `getDebounceStats()` 統計方法

#### 工具函式

- [ ] T013 [P] 實作 NotificationDebouncer 於 `src/lib/debounce.ts`
  - 實作 per-symbol debounce 管理
  - 實作 `notify()`, `notifyImmediate()` 方法
  - 實作 `getStats()`, `getAllStats()` 統計方法
  - 包含完整的 TypeScript 泛型支援

**Completion Criteria**:
- ✅ 所有領域模型包含 Zod validation
- ✅ 所有儲存庫方法包含錯誤處理和日誌記錄
- ✅ NotificationDebouncer 支援 per-symbol 獨立計時器
- ✅ 所有單元測試通過 (如果撰寫)

---

## Phase 3: User Story 1 - 自動偵測套利機會並即時通知 (P1)

**Goal**: 實作核心偵測邏輯，當費率差異達到閾值時自動發送通知

**Status**: ⏳ Pending
**Depends On**: Phase 2 完成

### Independent Test Criteria

✅ **Given** 系統設定閾值 0.05%，**When** 模擬 BTC 費率差異 0.06%，**Then** 系統偵測機會並記錄到資料庫
✅ **Given** 系統偵測到機會，**When** 費率差異回落至 0.04%，**Then** 系統標記機會為 EXPIRED
✅ **Given** 系統運行中，**When** 動態調整閾值為 0.08%，**Then** 系統重新評估所有活躍機會

### Tasks

#### 核心服務

- [ ] T014 [US1] 實作 OpportunityDetector 服務於 `src/services/monitor/OpportunityDetector.ts`
  - 實作 `handleRateUpdate()` 方法（接收 FundingRateMonitor 事件）
  - 實作機會出現邏輯（費率差異 >= 閾值）
  - 實作機會消失邏輯（費率差異 < 閾值）
  - 實作機會更新邏輯（費率變化追蹤）
  - 使用 EventEmitter 發送型別安全事件
  - 整合 NotificationDebouncer (30 秒防抖動)

- [ ] T015 [US1] 實作 NotificationService 服務於 `src/services/notification/NotificationService.ts`
  - 實作渠道註冊/移除邏輯
  - 實作 `notifyOpportunityAppeared()` 方法
  - 實作 `notifyOpportunityDisappeared()` 方法
  - 實作 graceful degradation (Promise.allSettled)
  - 實作通知統計追蹤

- [ ] T016 [P] [US1] 實作 TerminalChannel 於 `src/services/notification/channels/TerminalChannel.ts`
  - 實作 `send()` 方法（終端輸出）
  - 使用 chalk 著色（INFO: cyan, WARNING: yellow, CRITICAL: red）
  - 實作 `test()` 連線測試

- [ ] T017 [P] [US1] 實作 LogChannel 於 `src/services/notification/channels/LogChannel.ts`
  - 實作 `send()` 方法（Pino 日誌）
  - 實作 `test()` 連線測試

#### 整合邏輯

- [ ] T018 [US1] 整合 OpportunityDetector 到 FundingRateMonitor 於 `src/services/monitor/FundingRateMonitor.ts`
  - 訂閱 'rate-updated' 事件
  - 呼叫 `detector.handleRateUpdate(pair)`
  - 建立 ArbitrageOpportunity 記錄（當機會出現）
  - 更新 ArbitrageOpportunity 狀態（當機會消失）

- [ ] T019 [US1] 連接 OpportunityDetector 和 NotificationService
  - OpportunityDetector 訂閱 'opportunity:appeared' → NotificationService
  - OpportunityDetector 訂閱 'opportunity:disappeared' → NotificationService
  - 建立 NotificationLog 記錄

#### CLI 指令 (基礎)

- [ ] T020 [US1] 實作 CLI 指令 `arb opportunities config` 於 `src/cli/commands/opportunities/config.ts`
  - 實作閾值查看功能
  - 實作閾值更新功能 (`--threshold`, `--warning`, `--critical`)
  - 實作防抖動配置 (`--debounce`, `--symbol-debounce`)
  - 實作 `--reset` 重置為預設值
  - 支援 table 和 json 輸出格式

- [ ] T021 [US1] 註冊 CLI 指令到 Commander.js 於 `src/cli/index.ts`
  - 建立 `opportunities` 子指令群組
  - 註冊 `config` 子指令

**Completion Criteria**:
- ✅ OpportunityDetector 能偵測費率差異 >= 閾值的機會
- ✅ OpportunityDetector 能偵測機會消失（費率 < 閾值）
- ✅ 通知成功發送到 Terminal 和 Log 渠道
- ✅ 防抖動機制運作正常（30 秒內同 symbol 只通知一次）
- ✅ 機會記錄成功寫入資料庫
- ✅ CLI 指令可查看和更新配置

---

## Phase 4: User Story 2 - 多幣別機會排序與優先級 (P1)

**Goal**: 支援多幣別同時偵測，並按照費率差異排序顯示

**Status**: ✅ Completed (2025-10-23)
**Depends On**: User Story 1 完成

### Independent Test Criteria

✅ **Given** 系統同時偵測到 BTC (0.06%)、ETH (0.08%)、SOL (0.07%) 三個機會，**When** 查詢機會列表，**Then** 按照 ETH > SOL > BTC 排序
✅ **Given** 系統有 5 個活躍機會，**When** 其中 2 個費率變化，**Then** 系統即時更新排序
✅ **Given** 某個機會消失，**When** 從列表移除，**Then** 剩餘機會自動調整排序

### Tasks

#### 排序與計算邏輯

- [x] T022 [P] [US2] 新增排序方法到 OpportunityDetector 於 `src/services/monitor/OpportunityDetector.ts` ✅ 2025-10-23
  - 實作 `getActiveOpportunitiesSorted()` 方法（按 rate_difference DESC 排序）
  - 實作機會自動重新排序邏輯（當費率更新時）

- [x] T023 [P] [US2] 新增統計計算方法到 ArbitrageOpportunityRepository ✅ 2025-10-23
  - 實作 `findActiveWithStats()` 方法（包含年化收益率、持續時間）
  - 實作 `findMany()` 方法（支援多條件篩選）
  - 優化查詢效能（使用索引）

#### CLI 指令 (列表與排序)

- [x] T024 [US2] 實作 CLI 指令 `arb opportunities list` 於 `src/cli/commands/opportunities/list.ts` ✅ 2025-10-23
  - 實作機會列表查詢（預設按 rate_difference DESC 排序）
  - 實作篩選功能 (`--symbol`, `--min-spread`)
  - 實作限制數量 (`--limit`, 預設 10)
  - 實作 `--all` 顯示所有狀態機會（包含 EXPIRED, CLOSED）
  - 支援三種輸出格式：table（預設）、json、csv
  - 使用 cli-table3 實作 table 輸出
  - 顯示欄位：Symbol, Long Exchange, Short Exchange, Spread %, Annual%, Duration, Notif.
  - 優化表格佈局和欄位顯示

- [x] T025 [US2] 註冊 `list` 指令到 Commander.js 於 `src/cli/index.ts` ✅ 2025-10-22

#### 年化收益率顯示

- [x] T026 [P] [US2] 新增年化收益率格式化工具於 `src/lib/formatters/OpportunityFormatter.ts` ✅ 2025-10-23
  - 實作 `formatAnnualizedReturn()` 方法
  - 實作 `formatDuration()` 方法（毫秒轉為 "Xm Ys" 格式）
  - 實作 `formatDurationMs()` 方法（支援 bigint 型別）
  - 實作 `formatSpread()` 方法（Decimal 轉為百分比字串）
  - 實作 `formatDateTime()` 和 `formatShortDateTime()` 方法
  - 實作 `formatNotificationCount()` 方法
  - 實作 `truncate()` 字串截斷工具

**Completion Criteria**:
- ✅ 系統能同時追蹤 10+ 個幣別的機會
- ✅ CLI `list` 指令正確顯示排序後的機會列表
- ✅ 年化收益率計算正確（費率差 × 3 × 365）
- ✅ 機會列表即時更新（當費率變化時）
- ✅ Table 輸出格式清晰易讀

---

## Phase 5: User Story 3 - 機會生命週期追蹤與歷史記錄 (P2)

**Goal**: 追蹤機會完整生命週期，提供歷史記錄查詢和統計

**Status**: ⏳ Pending
**Depends On**: User Story 2 完成

### Independent Test Criteria

✅ **Given** 系統偵測到新機會，**When** 機會出現，**Then** 記錄開始時間和初始費率差異
✅ **Given** 機會持續 15 分鐘，**When** 費率波動，**Then** 記錄最大費率差異和發生時間
✅ **Given** 機會已消失，**When** 查詢歷史，**Then** 顯示完整生命週期資訊
✅ **Given** 累積 100 筆記錄，**When** 查詢最近 24 小時，**Then** 返回符合時間範圍的記錄和統計摘要

### Tasks

#### 生命週期追蹤邏輯

- [ ] T027 [US3] 增強 OpportunityDetector 追蹤最大費率差異於 `src/services/monitor/OpportunityDetector.ts`
  - 在 `handleRateUpdate()` 中比較當前費率與最大費率
  - 呼叫 `repository.updateMaxRateDifference()` 更新記錄

- [ ] T028 [US3] 實作機會消失時自動建立歷史記錄於 `src/services/monitor/OpportunityDetector.ts`
  - 在 `handleOpportunityDisappeared()` 中建立 OpportunityHistory
  - 計算平均費率差異（從 NotificationLog 聚合）
  - 計算持續時間（expired_at - detected_at）
  - 記錄消失原因（RATE_DROPPED, DATA_UNAVAILABLE, etc.）

#### 歷史查詢邏輯

- [ ] T029 [P] [US3] 實作歷史記錄聚合查詢於 `src/repositories/OpportunityHistoryRepository.ts`
  - 實作 `getSummaryStats()` 方法（總機會數、平均持續時間、最大費率差）
  - 實作 `getBySymbolStats()` 方法（per-symbol 統計）
  - 實作 `getDisappearReasonStats()` 方法（消失原因分佈）

#### CLI 指令 (歷史查詢)

- [ ] T030 [US3] 實作 CLI 指令 `arb opportunities history` 於 `src/cli/commands/opportunities/history.ts`
  - 實作時間範圍查詢 (`--hours`, `--days`)
  - 實作符號篩選 (`--symbol`)
  - 實作持續時間篩選 (`--min-duration`, `--max-duration`)
  - 實作三種輸出格式：table（預設）、json、summary
  - Table 格式：顯示 Symbol, Detected At, Duration, Spread %, Max %, Notifications, Reason
  - Summary 格式：顯示統計摘要（總機會數、平均持續時間、By Symbol, By Reason）
  - 實作限制數量 (`--limit`, 預設 20)

- [ ] T031 [US3] 註冊 `history` 指令到 Commander.js 於 `src/cli/index.ts`

**Completion Criteria**:
- ✅ 機會消失時自動建立 OpportunityHistory 記錄
- ✅ 歷史記錄包含完整生命週期資訊（開始時間、持續時長、最大費率差、消失時間）
- ✅ CLI `history` 指令能查詢指定時間範圍的記錄
- ✅ Summary 輸出顯示統計摘要（總機會數、平均持續時長、By Symbol, By Reason）
- ✅ 歷史查詢回應時間 < 3 秒（30 天資料範圍）

---

## Phase 6: User Story 4 - 多通道通知機制 (P3)

**Goal**: 支援多種通知渠道（Webhook, Telegram），可配置通知詳細程度

**Status**: ⏳ Pending
**Depends On**: User Story 1 完成（不依賴 US2, US3）

### Independent Test Criteria

✅ **Given** 設定通知方式為「終端輸出 + 日誌 + Webhook」，**When** 偵測到機會，**Then** 通知同時發送到三個渠道
✅ **Given** 設定通知詳細程度為「簡潔」，**When** 收到通知，**Then** 只顯示關鍵資訊
✅ **Given** 設定通知詳細程度為「詳細」，**When** 收到通知，**Then** 顯示進階資訊
✅ **Given** Webhook 失敗，**When** 其他渠道仍運作，**Then** 不影響系統整體功能

### Tasks

#### 新增通知渠道

- [ ] T032 [P] [US4] 實作 WebhookChannel 於 `src/services/notification/channels/WebhookChannel.ts`
  - 實作 `send()` 方法（HTTP POST/PUT 請求）
  - 實作重試邏輯（使用 lib/retry.ts）
  - 實作逾時處理（預設 5 秒）
  - 實作 `test()` 連線測試
  - 包含錯誤處理和 graceful degradation

- [ ] T033 [P] [US4] 實作 TelegramChannel 於 `src/services/notification/channels/TelegramChannel.ts`
  - 實作 `send()` 方法（Telegram Bot API）
  - 支援 Markdown 格式化
  - 實作 `test()` 連線測試
  - 包含錯誤處理和 graceful degradation

#### 通知詳細程度配置

- [ ] T034 [US4] 新增訊息格式化邏輯到 NotificationService
  - 實作 `formatMessage()` 方法（支援 verbose level: simple, detailed）
  - Simple 格式：Symbol, Spread %, Annual%
  - Detailed 格式：+ Long/Short Exchange, Long/Short Rate, Next Funding Time, Historical Avg

- [ ] T035 [P] [US4] 實作通知配置管理於 `src/lib/config.ts`
  - 新增 `notifications.channels` 配置陣列
  - 新增 `notifications.verbosity` 配置（simple | detailed）
  - 新增 `notifications.webhookUrl` 配置
  - 新增 `notifications.telegramBotToken` 和 `telegramChatId` 配置

#### 渠道註冊與管理

- [ ] T036 [US4] 更新 NotificationService 初始化邏輯
  - 根據配置自動註冊渠道
  - 實作 `enableChannel()` 和 `disableChannel()` 方法
  - 實作 `testAllChannels()` 方法（測試所有已註冊渠道）

#### CLI 指令更新

- [ ] T037 [US4] 更新 `arb opportunities config` 指令支援通知配置
  - 新增 `--channel <CHANNEL>` 選項（啟用/停用渠道）
  - 新增 `--verbosity <LEVEL>` 選項（simple | detailed）
  - 新增 `--webhook-url <URL>` 選項
  - 新增 `--telegram-token <TOKEN>` 和 `--telegram-chat-id <ID>` 選項
  - 新增 `--test-notifications` 選項（測試所有渠道）

**Completion Criteria**:
- ✅ 支援 4 種通知渠道（Terminal, Log, Webhook, Telegram）
- ✅ Webhook 和 Telegram 渠道實作錯誤處理和重試邏輯
- ✅ 通知詳細程度可配置（simple, detailed）
- ✅ 單一渠道失敗不影響其他渠道（graceful degradation）
- ✅ CLI 指令可配置所有通知選項

---

## Phase 7: Polish & Cross-Cutting Concerns (收尾與跨功能優化)

**Goal**: 完善錯誤處理、日誌記錄、文件、整合測試

**Status**: ⏳ Pending
**Depends On**: 所有 User Stories 完成

### Tasks

#### 錯誤處理與日誌

- [ ] T038 [P] 檢視所有服務的錯誤處理邏輯
  - 確保所有 async 方法使用 try-catch
  - 確保所有錯誤包含完整上下文（symbol, timestamp, error type）
  - 確保所有錯誤記錄到 Pino logger

- [ ] T039 [P] 新增結構化日誌欄位到所有關鍵操作
  - OpportunityDetector: `opportunity:appeared`, `opportunity:disappeared`, `opportunity:updated`
  - NotificationService: `notification:sent`, `notification:failed`
  - Repositories: `create`, `update`, `delete` 操作

#### 效能優化

- [ ] T040 [P] 優化資料庫查詢效能
  - 檢視所有查詢是否使用索引
  - 實作查詢快取（如需要）
  - 確保歷史查詢回應時間 < 3 秒（30 天資料）

- [ ] T041 [P] 優化機會偵測效能
  - 確保偵測延遲 < 5 秒（從費率變化到通知）
  - 確保支援同時監控 10+ 幣別

#### 文件

- [ ] T042 [P] 更新 README.md
  - 新增套利機會偵測功能說明
  - 新增 CLI 指令使用範例
  - 新增配置說明

- [ ] T043 [P] 建立 API 文件
  - 文件化所有服務介面
  - 文件化所有事件型別
  - 文件化所有 Repository 方法

#### 整合測試 (Optional - 如果需要端到端驗證)

- [ ] T044 [P] 建立整合測試於 `tests/integration/opportunity-detection.test.ts`
  - 測試完整流程：費率更新 → 偵測 → 通知 → 資料庫記錄
  - 測試機會生命週期：出現 → 更新 → 消失 → 歷史記錄
  - 測試多幣別同時偵測和排序
  - 測試防抖動機制

- [ ] T045 [P] 建立 CLI 指令測試於 `tests/integration/cli-commands.test.ts`
  - 測試 `arb opportunities list`
  - 測試 `arb opportunities history`
  - 測試 `arb opportunities config`

#### 清理與重構

- [ ] T046 [P] 程式碼審查與重構
  - 移除未使用的 imports 和程式碼
  - 統一命名規範
  - 確保型別安全（無 `any` 型別）

- [ ] T047 最終驗證所有 User Stories 的 Independent Test Criteria
  - 執行 US1 獨立測試
  - 執行 US2 獨立測試
  - 執行 US3 獨立測試
  - 執行 US4 獨立測試

**Completion Criteria**:
- ✅ 所有錯誤都有適當的處理和日誌記錄
- ✅ 效能目標達成（<5s 偵測延遲、<3s 歷史查詢）
- ✅ 文件完整且最新
- ✅ 所有整合測試通過（如有撰寫）
- ✅ 所有 User Stories 獨立測試通過

---

## Dependencies & Execution Order

### Story Completion Order

```
Phase 1 (Setup) → Phase 2 (Foundational)
                        ↓
                   Phase 3 (US1) ←─┐
                        ↓           │
                   Phase 4 (US2)    │ (US4 不依賴 US2, US3)
                        ↓           │
                   Phase 5 (US3)    │
                        ↓           │
                   Phase 6 (US4) ───┘
                        ↓
                   Phase 7 (Polish)
```

### Parallel Execution Opportunities

#### Phase 1 (Setup)
- T005, T006 可並行（不同檔案）

#### Phase 2 (Foundational)
- T008, T009 可並行（不同領域模型）
- T011, T012 可並行（不同 Repository）
- T013 可與 T008-T012 並行（獨立工具）

#### Phase 3 (US1)
- T016, T017 可並行（不同 Channel 實作）

#### Phase 4 (US2)
- T022, T023, T026 可並行（不同檔案）

#### Phase 5 (US3)
- T029 可與 T027, T028 並行（不同檔案）

#### Phase 6 (US4)
- T032, T033, T035 可並行（不同檔案）

#### Phase 7 (Polish)
- T038, T039, T040, T041, T042, T043, T044, T045, T046 可並行

---

## Task Summary

| Phase | Task Count | Parallelizable | Description |
|-------|------------|----------------|-------------|
| Phase 1: Setup | 7 | 2 | 資料庫 schema 和型別定義 |
| Phase 2: Foundational | 6 | 5 | 領域模型、儲存庫、工具函式 |
| Phase 3: US1 (P1) | 8 | 3 | 核心偵測與通知功能 |
| Phase 4: US2 (P1) | 5 | 3 | 多幣別排序與列表 |
| Phase 5: US3 (P2) | 5 | 1 | 生命週期追蹤與歷史 |
| Phase 6: US4 (P3) | 6 | 3 | 多通道通知機制 |
| Phase 7: Polish | 10 | 9 | 錯誤處理、效能、文件、測試 |
| **Total** | **47** | **26** | |

---

## MVP Scope Recommendation

**建議的 MVP 範圍**: Phase 1 + Phase 2 + Phase 3 (User Story 1)

**包含功能**:
- ✅ 自動偵測套利機會（費率差異 >= 閾值）
- ✅ 即時通知（Terminal + Log）
- ✅ 防抖動機制（30 秒窗口）
- ✅ 機會記錄持久化到資料庫
- ✅ CLI 配置指令（查看/更新閾值）

**排除功能**:
- ❌ 多幣別排序列表（US2）
- ❌ 歷史記錄查詢（US3）
- ❌ 多通道通知（US4）

**MVP 任務數**: 21 (T001-T021)
**預估工時**: 2-3 天（有經驗的開發者）

---

## Format Validation

✅ **All tasks follow the required checklist format**:
- [x] Every task starts with `- [ ]` (checkbox)
- [x] Every task has a Task ID (T001-T047)
- [x] Parallelizable tasks marked with `[P]`
- [x] User story tasks marked with `[US1]`, `[US2]`, `[US3]`, `[US4]`
- [x] Every task has a clear description with file path
- [x] Tasks are organized by phase/user story
- [x] Dependencies clearly documented

---

## Quick Start

1. **開始 MVP 開發**:
   ```bash
   # 切換到功能分支
   git checkout 005-arbitrage-opportunity-detection

   # 執行 Phase 1 (T001-T007)
   # 遵循 specs/005-arbitrage-opportunity-detection/quickstart.md
   ```

2. **獨立驗證 US1**:
   - 完成 Phase 1, 2, 3 所有任務
   - 執行 US1 獨立測試（模擬費率數據）
   - 驗證偵測和通知功能正常運作

3. **繼續 US2, US3, US4**:
   - 每個 User Story 可獨立實作和測試
   - 不需等待其他 User Story 完成

4. **最終 Polish**:
   - 完成所有 User Stories 後
   - 執行 Phase 7 收尾任務

---

**準備開始實作！所有任務已就緒。** 🚀
