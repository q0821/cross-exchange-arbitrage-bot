# Implementation Plan: 套利機會結束監測和通知

**Branch**: `027-opportunity-end-notification` | **Date**: 2025-12-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/027-opportunity-end-notification/spec.md`

## Summary

實現套利機會結束監測功能：當已通知的套利機會費差降低到用戶閾值以下時，發送結束通知並記錄歷史。核心技術方案是擴展現有 NotificationService，新增機會追蹤機制（TrackedOpportunity Map），在每次費率更新時檢查機會是否結束，並支援多空雙方不同結算週期的模擬收益計算。

## Technical Context

**Language/Version**: TypeScript 5.6 + Node.js 20.x LTS
**Primary Dependencies**: Next.js 14 App Router, Prisma 5.x, Socket.io 4.8.1, axios, pino
**Storage**: PostgreSQL 15 + TimescaleDB（現有 NotificationWebhook 模型擴展 + OpportunityEndHistory 啟用）
**Testing**: Vitest + @testing-library/react
**Target Platform**: Linux server (Docker) + Web browser
**Project Type**: Web application (Next.js full-stack)
**Performance Goals**: 結束通知在機會結束後 1 分鐘內發送
**Constraints**: 記憶體追蹤機會狀態（服務重啟遺失追蹤資料）
**Scale/Scope**: 支援 100+ 活躍機會追蹤，100+ 用戶 Webhook

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Trading Safety First | N/A | 本功能不涉及交易執行，僅為通知功能 |
| II. Complete Observability | ✅ | 所有通知發送記錄到 log，機會歷史記錄到資料庫 |
| III. Defensive Programming | ✅ | 使用防抖動機制避免重複通知，Webhook 發送有重試和超時處理 |
| IV. Data Integrity | ✅ | OpportunityEndHistory 使用 Prisma migration，財務計算使用 Decimal |
| V. Incremental Delivery | ✅ | 按 P1→P2→P3 優先級分階段實現，每個 User Story 可獨立測試 |
| VI. System Architecture | ✅ | CLI 監控寫入資料庫，Web 只讀取顯示，符合分離原則 |

**Gate Result**: ✅ PASS - 所有相關原則符合

## Project Structure

### Documentation (this feature)

```
specs/027-opportunity-end-notification/
├── spec.md              # 功能規格 (已完成)
├── plan.md              # 本文件
├── research.md          # Phase 0 研究輸出
├── data-model.md        # Phase 1 資料模型
├── quickstart.md        # Phase 1 快速入門
├── contracts/           # Phase 1 API 合約
│   └── websocket.md     # WebSocket 事件規格
└── tasks.md             # Phase 2 任務清單 (/speckit.tasks)
```

### Source Code (repository root)

```
src/
├── services/
│   └── notification/
│       ├── NotificationService.ts    # 修改：新增機會追蹤和結束檢測
│       ├── DiscordNotifier.ts        # 修改：新增 sendDisappearedNotification()
│       ├── SlackNotifier.ts          # 修改：新增 sendDisappearedNotification()
│       ├── types.ts                  # 修改：新增 TrackedOpportunity, OpportunityDisappearedMessage
│       └── utils.ts                  # 修改：新增時間格式化函式
├── repositories/
│   ├── NotificationWebhookRepository.ts  # 修改：處理 notifyOnDisappear 欄位
│   └── OpportunityEndHistoryRepository.ts   # 新增：機會歷史 CRUD
└── models/
    └── OpportunityEndHistory.ts             # 新增：Domain Model

prisma/
├── schema.prisma                         # 修改：NotificationWebhook + OpportunityEndHistory
└── migrations/
    └── [timestamp]_add_opportunity_end_notification/

app/
├── api/notifications/webhooks/
│   └── route.ts                          # 修改：支援 notifyOnDisappear
└── (dashboard)/settings/notifications/
    └── page.tsx                          # 修改：新增結束通知開關

tests/
├── unit/
│   └── services/
│       └── NotificationService.test.ts   # 新增：機會追蹤和結束檢測測試
└── integration/
    └── opportunity-end-notification.test.ts  # 新增：整合測試
```

**Structure Decision**: 使用現有 Web application 結構，擴展 notification 服務模組

## Complexity Tracking

*No violations - complexity is justified by feature requirements*

| 新增複雜度 | 理由 | 替代方案評估 |
|-----------|------|-------------|
| TrackedOpportunity Map | 追蹤機會生命週期，計算統計資訊 | 無狀態方案無法提供持續時間和統計 |
| 多結算週期支援 | 多空雙方可能有不同結算週期 | 假設固定 8h 會導致收益計算不準確 |
| OpportunityEndHistory 表 | 持久化歷史記錄供未來分析 | 僅記憶體會在重啟後遺失所有歷史 |
