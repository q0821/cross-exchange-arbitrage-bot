# Implementation Plan: Discord/Slack 套利機會即時推送通知

**Branch**: `026-discord-slack-notification` | **Date**: 2025-11-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/026-discord-slack-notification/spec.md`

## Summary

實作套利機會即時推送通知功能，當年化收益超過用戶設定閾值（預設 800%）時，自動推送到用戶配置的 Discord/Slack Webhook。通知內容包含完整套利資訊：原始費率（含 time basis）、標準化 8h 費率、價差分析、回本週期等。

## Technical Context

**Language/Version**: TypeScript 5.6 + Node.js 20.x LTS
**Primary Dependencies**: Next.js 14 App Router, Prisma 5.x, Socket.io 4.8.1 (WebSocket), axios (HTTP requests)
**Storage**: PostgreSQL 15+ (NotificationWebhook 模型)
**Testing**: vitest + @testing-library/react
**Target Platform**: Web (Next.js), Server-side notification service
**Project Type**: Web application (existing structure)
**Performance Goals**: 通知在 5 秒內送達所有啟用的 Webhooks
**Constraints**: 同一機會 5 分鐘內不重複推送
**Scale/Scope**: 支援每用戶多個 Webhooks，每個 Webhook 獨立閾值設定

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Trading Safety First | N/A | 此功能為通知系統，不涉及交易執行 |
| II. Complete Observability | PASS | 通知發送記錄將使用結構化日誌（Pino） |
| III. Defensive Programming | PASS | Webhook 發送失敗不影響其他 Webhooks 或系統運作 |
| IV. Data Integrity | PASS | 使用 Prisma migrations，閾值使用 Decimal 類型 |
| V. Incremental Delivery | PASS | MVP 先實作基本 Webhook CRUD + 通知發送 |
| VI. System Architecture Boundaries | PASS | Web 負責 Webhook 設定 UI，CLI/Server 負責通知發送 |

## Project Structure

### Documentation (this feature)

```
specs/026-discord-slack-notification/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── openapi.yaml     # Webhook CRUD API 規格
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```
# 新增檔案
src/
├── services/
│   └── notification/
│       ├── NotificationService.ts     # 核心通知服務
│       ├── DiscordNotifier.ts         # Discord 訊息格式化
│       ├── SlackNotifier.ts           # Slack 訊息格式化
│       └── types.ts                   # 通知相關類型定義
├── repositories/
│   └── NotificationWebhookRepository.ts
└── models/
    └── NotificationWebhook.ts         # 領域模型

app/
├── api/
│   └── notifications/
│       └── webhooks/
│           ├── route.ts               # GET (list) + POST (create)
│           └── [id]/
│               ├── route.ts           # GET + PUT + DELETE
│               └── test/
│                   └── route.ts       # POST (test webhook)
└── (dashboard)/
    └── settings/
        └── notifications/
            └── page.tsx               # Webhook 管理頁面

# 修改檔案
prisma/schema.prisma                   # 新增 NotificationWebhook 模型
app/(dashboard)/DashboardLayoutClient.tsx  # 新增導航連結
src/services/monitor/RatesCache.ts     # 整合通知觸發點

tests/
├── unit/
│   └── services/
│       └── notification/
│           ├── NotificationService.test.ts
│           ├── DiscordNotifier.test.ts
│           └── SlackNotifier.test.ts
└── integration/
    └── notifications/
        └── webhooks.test.ts
```

**Structure Decision**: 遵循現有專案結構，新增 `src/services/notification/` 目錄存放通知相關服務，API 路由放在 `app/api/notifications/webhooks/`。

## Complexity Tracking

*No complexity violations detected.*
