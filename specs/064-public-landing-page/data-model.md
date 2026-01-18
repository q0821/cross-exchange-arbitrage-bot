# Data Model: 公開套利機會歷史首頁

**Feature**: 064-public-landing-page
**Date**: 2026-01-18

## 1. 現有模型（無變更）

此功能使用現有的 `OpportunityEndHistory` 模型，無需 schema 變更。

### OpportunityEndHistory

**位置**: `prisma/schema.prisma`

```prisma
model OpportunityEndHistory {
  id                   String   @id @default(cuid())
  symbol               String   @db.VarChar(20)
  longExchange         String   @db.VarChar(20)
  shortExchange        String   @db.VarChar(20)
  detectedAt           DateTime @db.Timestamptz
  disappearedAt        DateTime @db.Timestamptz
  durationMs           BigInt
  initialSpread        Decimal  @db.Decimal(10, 6)
  maxSpread            Decimal  @db.Decimal(10, 6)
  maxSpreadAt          DateTime @db.Timestamptz
  finalSpread          Decimal  @db.Decimal(10, 6)
  longIntervalHours    Int      @db.SmallInt
  shortIntervalHours   Int      @db.SmallInt
  settlementRecords    Json     @default("[]") @db.JsonB
  longSettlementCount  Int      @db.SmallInt
  shortSettlementCount Int      @db.SmallInt
  totalFundingProfit   Decimal  @db.Decimal(10, 6)
  totalCost            Decimal  @db.Decimal(10, 6)
  netProfit            Decimal  @db.Decimal(10, 6)
  realizedAPY          Decimal  @db.Decimal(10, 2)
  notificationCount    Int      @default(1)
  userId               String
  createdAt            DateTime @default(now()) @db.Timestamptz

  @@index([disappearedAt(sort: Desc)])
}
```

## 2. 公開 DTO（去識別化）

### PublicOpportunityDTO

用於公開 API 回應，排除敏感欄位。

```typescript
// src/types/public-opportunity.ts

export interface PublicOpportunityDTO {
  id: string;
  symbol: string;
  longExchange: string;
  shortExchange: string;
  detectedAt: string;           // ISO 8601
  disappearedAt: string;        // ISO 8601
  durationMs: number;
  durationFormatted: string;    // "2 小時 30 分鐘"
  initialSpread: number;
  maxSpread: number;
  maxSpreadAt: string;          // ISO 8601
  finalSpread: number;
  longIntervalHours: number;
  shortIntervalHours: number;
  longSettlementCount: number;
  shortSettlementCount: number;
  totalFundingProfit: number;
  totalCost: number;
  netProfit: number;
  realizedAPY: number;
}
```

### 排除欄位

| 欄位 | 原因 |
|------|------|
| `userId` | 用戶隱私 |
| `notificationCount` | 用戶行為資料 |
| `settlementRecords` | 詳細交易資料，過於敏感 |
| `createdAt` | 內部管理用，與 `disappearedAt` 重複 |

## 3. 查詢參數 Schema

### PublicOpportunityQuerySchema

```typescript
// src/models/PublicOpportunity.ts
import { z } from 'zod';

export const PublicOpportunityQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  days: z.coerce.number().refine(
    (val) => [7, 30, 90].includes(val),
    { message: 'days must be 7, 30, or 90' }
  ).default(90),
});

export type PublicOpportunityQuery = z.infer<typeof PublicOpportunityQuerySchema>;
```

## 4. API 回應結構

### PublicOpportunitiesResponse

```typescript
// src/types/public-opportunity.ts

export interface PublicOpportunitiesResponse {
  success: boolean;
  data: PublicOpportunityDTO[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filter: {
    days: number;
  };
}
```

## 5. Repository 擴展

### findAllPublic 方法

```typescript
// src/repositories/OpportunityEndHistoryRepository.ts

async findAllPublic(options: {
  days: number;
  page: number;
  limit: number;
}): Promise<{ data: PublicOpportunityDTO[]; total: number }> {
  const { days, page, limit } = options;
  const offset = (page - 1) * limit;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const [records, total] = await Promise.all([
    this.prisma.opportunityEndHistory.findMany({
      where: {
        disappearedAt: { gte: startDate },
      },
      orderBy: { disappearedAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        symbol: true,
        longExchange: true,
        shortExchange: true,
        detectedAt: true,
        disappearedAt: true,
        durationMs: true,
        initialSpread: true,
        maxSpread: true,
        maxSpreadAt: true,
        finalSpread: true,
        longIntervalHours: true,
        shortIntervalHours: true,
        longSettlementCount: true,
        shortSettlementCount: true,
        totalFundingProfit: true,
        totalCost: true,
        netProfit: true,
        realizedAPY: true,
        // 排除: userId, notificationCount, settlementRecords, createdAt
      },
    }),
    this.prisma.opportunityEndHistory.count({
      where: {
        disappearedAt: { gte: startDate },
      },
    }),
  ]);

  return {
    data: records.map(this.toPublicDTO),
    total,
  };
}
```

## 6. 資料庫索引

現有索引已足夠：

```prisma
@@index([disappearedAt(sort: Desc)])
```

此索引支援：
- 按 `disappearedAt` 倒序排列
- 時間範圍過濾（WHERE disappearedAt >= ?）
