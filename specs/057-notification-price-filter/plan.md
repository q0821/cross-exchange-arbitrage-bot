# Implementation Plan: 通知價差過濾

**Branch**: `057-notification-price-filter` | **Date**: 2026-01-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/057-notification-price-filter/spec.md`

## Summary

新增 Webhook 設定中的「價差過濾」開關，讓用戶可選擇只在淨收益 > 0 且價差方向正確時才收到通知。此功能擴展現有的 `NotificationService` 過濾邏輯，並在 `NotificationWebhook` 模型新增 `requireFavorablePrice` 欄位。

## Technical Context

**Language/Version**: TypeScript 5.8 + Node.js 20.x LTS
**Primary Dependencies**: Next.js 15, Prisma 7.x, Vitest 4.x, Pino (logging)
**Storage**: PostgreSQL 15 + TimescaleDB (existing `NotificationWebhook` table)
**Testing**: Vitest (unit + integration)
**Target Platform**: Web application (Next.js App Router)
**Project Type**: Web application (frontend + backend monorepo)
**Performance Goals**: 價差過濾判斷 < 10ms 額外延遲
**Constraints**: 後向兼容 - 現有 Webhook 預設關閉過濾
**Scale/Scope**: 現有用戶基礎，無新規模需求

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Trading Safety First | ✅ N/A | 此功能不涉及交易執行 |
| II. Complete Observability | ✅ Pass | 過濾決策將被記錄到日誌 |
| III. Defensive Programming | ✅ Pass | 處理價格數據不完整的邊界案例 |
| IV. Data Integrity | ✅ Pass | 使用 Prisma migration 修改 schema |
| V. Incremental Delivery | ✅ Pass | 單一功能，可獨立測試和部署 |
| VI. System Architecture Boundaries | ✅ Pass | 符合 Web 層只讀取/顯示的原則 |
| VII. TDD Discipline | ✅ Required | 所有實作必須遵循 TDD 流程 |

**Gate Result**: ✅ PASS - 無違規，可繼續

## Project Structure

### Documentation (this feature)

```
specs/057-notification-price-filter/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── api-changes.md   # API 變更說明
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```
prisma/
└── schema.prisma                    # 新增 requireFavorablePrice 欄位

src/
├── models/
│   └── FundingRate.ts               # 新增 isPriceDirectionCorrect 到 BestArbitragePair
├── services/
│   └── notification/
│       ├── NotificationService.ts   # 新增 passesPriceFilter() 方法
│       └── types.ts                 # 更新 WebhookConfig 類型
└── repositories/
    └── NotificationWebhookRepository.ts  # 處理新欄位 CRUD

app/
├── api/
│   └── notifications/
│       └── webhooks/
│           ├── route.ts             # POST 處理新欄位
│           └── [id]/
│               └── route.ts         # PUT 處理新欄位
└── (dashboard)/
    └── settings/
        └── notifications/
            └── page.tsx             # UI Toggle 開關

tests/
├── unit/
│   └── services/
│       └── NotificationService.passesPriceFilter.test.ts
└── integration/
    └── notification-price-filter.test.ts
```

**Structure Decision**: Web application structure - 前後端同一 monorepo，API routes 在 `app/api/`，前端頁面在 `app/(dashboard)/`。

## Key Implementation Points

### 1. 過濾邏輯 (核心)

```typescript
// NotificationService.ts
private passesPriceFilter(rate: FundingRatePair, requireFavorablePrice: boolean): boolean {
  if (!requireFavorablePrice) return true;

  const bestPair = rate.bestPair;
  if (!bestPair) return false;

  // 條件 1: 淨收益 > 0
  const netReturn = bestPair.netReturn ?? 0;
  if (netReturn <= 0) return false;

  // 條件 2: 價差方向正確
  const isPriceDirectionCorrect = bestPair.isPriceDirectionCorrect ?? true;
  return isPriceDirectionCorrect;
}
```

### 2. 資料模型變更

- `NotificationWebhook.requireFavorablePrice: Boolean @default(false)`
- `BestArbitragePair.isPriceDirectionCorrect?: boolean`

### 3. 後向兼容策略

- Migration 使用 `@default(false)`
- 現有 Webhook 不受影響
- 新建 Webhook 預設也是關閉

## Dependencies

| Dependency | Purpose | Already Exists |
|------------|---------|----------------|
| `netReturn` field | 淨收益計算 | ✅ Feature 012 |
| `isPriceDiffFavorableForBestPair()` | 價差方向判斷 | ✅ RateDifferenceCalculator |
| `TOTAL_COST_RATE` | 成本常數 | ✅ cost-constants.ts |
| `MAX_ACCEPTABLE_ADVERSE_PRICE_DIFF` | 容忍值常數 | ✅ cost-constants.ts |
