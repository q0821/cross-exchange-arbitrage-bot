# Implementation Plan: ArbitrageOpportunity 即時追蹤記錄

**Branch**: `065-arbitrage-opportunity-tracking` | **Date**: 2026-01-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/065-arbitrage-opportunity-tracking/spec.md`

## Summary

建立獨立的 `ArbitrageOpportunity` 資料模型，在監測服務偵測到套利機會時立即記錄，不依賴用戶或 Webhook 通知。此功能讓公開首頁能顯示歷史套利機會，即使系統沒有任何註冊用戶。技術上將在 `FundingRateMonitor` 的 `opportunity-detected` 和 `opportunity-disappeared` 事件中注入記錄邏輯。

## Technical Context

**Language/Version**: TypeScript 5.8 + Node.js 20.x LTS
**Primary Dependencies**: Prisma 7.x (ORM), Next.js 15 (Web API)
**Storage**: PostgreSQL 15 + TimescaleDB
**Testing**: Vitest 4.x
**Target Platform**: Linux server (Docker) + Web browser
**Project Type**: Web application (CLI + Frontend)
**Performance Goals**: 機會記錄 < 5 秒，公開 API 回應 < 3 秒
**Constraints**: 不改變現有 `OpportunityEndHistory` 架構，保持向後相容
**Scale/Scope**: 預估每日 50-200 筆機會記錄

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Trading Safety First | ✅ Pass | 本功能僅記錄觀測資料，不執行交易，無安全風險 |
| II. Complete Observability | ✅ Pass | 新增結構化日誌記錄機會生命週期 |
| III. Defensive Programming | ✅ Pass | 資料庫寫入失敗不影響監測主流程，使用 try-catch 處理 |
| IV. Data Integrity (Migration Mandate) | ⚠️ Required | 新增 `ArbitrageOpportunity` model 需要 migration 檔案 |
| V. Incremental Delivery | ✅ Pass | 獨立功能，不影響現有系統 |
| VI. System Architecture Boundaries | ✅ Pass | CLI 負責記錄，Web 負責讀取顯示，符合資料流模式 |
| VII. TDD Discipline | ⚠️ Required | 必須先寫測試再實作 |

**Required Actions:**
- Migration 檔案必須與 schema 變更一起 commit
- 測試必須先寫、先執行驗證 FAIL，再實作

## Project Structure

### Documentation (this feature)

```
specs/065-arbitrage-opportunity-tracking/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```
# 現有專案結構（Web application）
prisma/
├── schema.prisma         # 新增 ArbitrageOpportunity model
└── migrations/           # 新增 migration 檔案

src/
├── models/
│   └── ArbitrageOpportunity.ts      # 新增：Domain model
├── repositories/
│   └── ArbitrageOpportunityRepository.ts  # 新增：資料存取層
├── services/
│   └── monitor/
│       ├── FundingRateMonitor.ts    # 修改：注入記錄邏輯
│       └── ArbitrageOpportunityTracker.ts  # 新增：機會追蹤服務
└── lib/
    └── get-public-opportunities.ts  # 修改：改用新 model

app/
└── api/
    └── public/
        └── opportunities/
            └── route.ts             # 修改：改用新 repository

tests/
├── unit/
│   ├── models/
│   │   └── ArbitrageOpportunity.test.ts
│   ├── repositories/
│   │   └── ArbitrageOpportunityRepository.test.ts
│   └── services/
│       └── ArbitrageOpportunityTracker.test.ts
└── integration/
    └── ArbitrageOpportunityFlow.test.ts
```

**Structure Decision**: 採用現有的 Web application 結構，新增獨立的 Repository 和 Service，遵循現有程式碼模式。

## Complexity Tracking

*無 Constitution 違規需要記錄*

## Phase 0: Research (已完成內聯分析)

### 現有相關程式碼分析

1. **FundingRateMonitor** (`src/services/monitor/FundingRateMonitor.ts`)
   - Line 527-595: 已有 `opportunity-detected` 和 `opportunity-disappeared` 事件
   - 使用 `activeOpportunities` Set 追蹤當前活躍機會
   - 適合注入 ArbitrageOpportunityTracker 監聽這些事件

2. **OpportunityEndHistory** (`prisma/schema.prisma:377-426`)
   - 需要 `userId`（必填欄位）
   - 僅在 Webhook 通知成功後創建
   - 不適合作為系統級公開資料來源

3. **RateDifferenceCalculator** (`src/services/monitor/RateDifferenceCalculator.ts`)
   - `isArbitrageOpportunity()` 判斷條件：spread ≥ 0.5% AND priceDiff ≥ -0.05%
   - 可直接復用判斷邏輯

4. **Public API** (`app/api/public/opportunities/route.ts`)
   - 目前使用 `OpportunityEndHistoryRepository.getPublicOpportunities()`
   - 需要改為使用新的 `ArbitrageOpportunityRepository`

### 技術決策

| 決策點 | 選擇 | 理由 |
|--------|------|------|
| 記錄觸發方式 | EventEmitter 監聽 | 不侵入 FundingRateMonitor 核心邏輯 |
| 資料存取模式 | Repository Pattern | 遵循現有程式碼慣例 |
| 機會識別 | symbol + longExchange + shortExchange | 唯一識別一個套利組合 |
| 狀態管理 | ACTIVE / ENDED enum | 簡單明確 |
