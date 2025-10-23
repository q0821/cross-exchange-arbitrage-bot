# Quick Start: 套利機會自動偵測系統

**Feature**: 005-arbitrage-opportunity-detection
**Date**: 2025-10-21
**Branch**: `005-arbitrage-opportunity-detection`

## 概述

本指南幫助開發者快速開始實作套利機會自動偵測系統。遵循本指南，你將能在 30 分鐘內建立基礎架構並通過第一個測試。

---

## 前置條件

### 已完成的功能

- ✅ **User Story 1（即時監控）**: `FundingRateMonitor` 服務已實作並運作中
- ✅ **PostgreSQL + TimescaleDB**: 資料庫已設定並執行
- ✅ **Prisma ORM**: Schema 已定義並可進行 migrations

### 開發環境

- Node.js 20.x LTS
- TypeScript 5.3+
- PostgreSQL 15 + TimescaleDB extension
- pnpm 8.x

### 驗證環境

```bash
# 檢查 Node.js 版本
node --version  # 應顯示 v20.x.x

# 檢查 PostgreSQL 連線
psql -U postgres -d arbitrage_bot -c "SELECT version();"

# 檢查現有測試通過
pnpm test

# 確認分支正確
git branch --show-current  # 應顯示 005-arbitrage-opportunity-detection
```

---

## 步驟 1: 資料庫 Schema 更新（15 分鐘）

### 1.1 建立 Prisma Schema

編輯 `/Users/hd/WORK/case/cross-exchange-arbitrage-bot/prisma/schema.prisma`，新增以下模型：

```prisma
// Enums
enum OpportunityStatus {
  ACTIVE
  EXPIRED
  CLOSED
}

enum DisappearReason {
  RATE_DROPPED
  DATA_UNAVAILABLE
  MANUAL_CLOSE
  SYSTEM_ERROR
}

enum NotificationType {
  OPPORTUNITY_APPEARED
  OPPORTUNITY_DISAPPEARED
  OPPORTUNITY_UPDATED
}

enum NotificationChannel {
  TERMINAL
  LOG
  WEBHOOK
  TELEGRAM
}

enum Severity {
  INFO
  WARNING
  CRITICAL
}

// Models
model ArbitrageOpportunity {
  id                      String              @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  symbol                  String              @db.VarChar(20)
  long_exchange           String              @db.VarChar(50)
  short_exchange          String              @db.VarChar(50)
  long_funding_rate       Decimal             @db.Decimal(10, 8)
  short_funding_rate      Decimal             @db.Decimal(10, 8)
  rate_difference         Decimal             @db.Decimal(10, 8)
  expected_return_rate    Decimal             @db.Decimal(10, 8)
  status                  OpportunityStatus   @default(ACTIVE)
  detected_at             DateTime            @default(now()) @db.Timestamptz
  expired_at              DateTime?           @db.Timestamptz
  closed_at               DateTime?           @db.Timestamptz
  max_rate_difference     Decimal?            @db.Decimal(10, 8)
  max_rate_difference_at  DateTime?           @db.Timestamptz
  notification_count      Int                 @default(0)
  last_notification_at    DateTime?           @db.Timestamptz
  created_at              DateTime            @default(now()) @db.Timestamptz
  updated_at              DateTime            @updatedAt @db.Timestamptz

  history                 OpportunityHistory?
  notifications           NotificationLog[]

  @@index([status], map: "idx_opportunity_status")
  @@index([detected_at(sort: Desc)], map: "idx_opportunity_detected")
  @@index([symbol, detected_at(sort: Desc)], map: "idx_opportunity_symbol_detected")
  @@index([expired_at], map: "idx_opportunity_expired")
  @@map("arbitrage_opportunities")
}

model OpportunityHistory {
  id                        String            @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  opportunity_id            String            @unique @db.Uuid
  symbol                    String            @db.VarChar(20)
  long_exchange             String            @db.VarChar(50)
  short_exchange            String            @db.VarChar(50)
  initial_rate_difference   Decimal           @db.Decimal(10, 8)
  max_rate_difference       Decimal           @db.Decimal(10, 8)
  avg_rate_difference       Decimal           @db.Decimal(10, 8)
  duration_ms               BigInt
  duration_minutes          Decimal           @db.Decimal(10, 2)
  total_notifications       Int
  detected_at               DateTime          @db.Timestamptz
  expired_at                DateTime          @db.Timestamptz
  disappear_reason          DisappearReason
  created_at                DateTime          @default(now()) @db.Timestamptz

  opportunity               ArbitrageOpportunity @relation(fields: [opportunity_id], references: [id], onDelete: Restrict)

  @@index([symbol], map: "idx_history_symbol")
  @@index([detected_at(sort: Desc)], map: "idx_history_detected")
  @@index([duration_ms(sort: Desc)], map: "idx_history_duration")
  @@index([max_rate_difference(sort: Desc)], map: "idx_history_max_diff")
  @@map("opportunity_history")
}

model NotificationLog {
  id                       String              @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  opportunity_id           String              @db.Uuid
  symbol                   String              @db.VarChar(20)
  notification_type        NotificationType
  channel                  NotificationChannel
  severity                 Severity            @default(INFO)
  message                  String              @db.Text
  rate_difference          Decimal             @db.Decimal(10, 8)
  sent_at                  DateTime            @default(now()) @db.Timestamptz
  is_debounced             Boolean             @default(false)
  debounce_skipped_count   Int                 @default(0)

  opportunity              ArbitrageOpportunity @relation(fields: [opportunity_id], references: [id], onDelete: Cascade)

  @@index([opportunity_id], map: "idx_notification_opportunity")
  @@index([symbol], map: "idx_notification_symbol")
  @@index([sent_at(sort: Desc)], map: "idx_notification_sent")
  @@index([notification_type], map: "idx_notification_type")
  @@map("notification_logs")
}
```

### 1.2 建立 Migration

```bash
# 生成 migration
pnpm prisma migrate dev --name add-opportunity-detection

# 驗證 migration 成功
pnpm prisma migrate status
```

### 1.3 設定 TimescaleDB（僅 NotificationLog）

建立 migration 檔案 `prisma/migrations/[timestamp]_setup_timescaledb/migration.sql`：

```sql
-- 將 notification_logs 轉換為 hypertable
SELECT create_hypertable(
  'notification_logs',
  'sent_at',
  chunk_time_interval => INTERVAL '7 days',
  if_not_exists => TRUE
);

-- 設定 90 天自動保留策略
SELECT add_retention_policy('notification_logs', INTERVAL '90 days');
```

執行 migration:

```bash
pnpm prisma migrate deploy
```

---

## 步驟 2: 建立領域模型（10 分鐘）

### 2.1 建立 ArbitrageOpportunity 模型

建立檔案 `src/models/ArbitrageOpportunity.ts`:

```typescript
/**
 * ArbitrageOpportunity Domain Model
 */

import { z } from 'zod';
import type { ArbitrageOpportunity as PrismaOpportunity, OpportunityStatus } from '@prisma/client';
import Decimal from 'decimal.js';

/**
 * 套利機會驗證 Schema
 */
export const ArbitrageOpportunitySchema = z.object({
  symbol: z.string().min(1).max(20),
  longExchange: z.string().min(1).max(50),
  shortExchange: z.string().min(1).max(50),
  longFundingRate: z.number(),
  shortFundingRate: z.number(),
  rateDifference: z.number().positive(),
  expectedReturnRate: z.number().positive(),
  status: z.enum(['ACTIVE', 'EXPIRED', 'CLOSED']).default('ACTIVE'),
}).refine(
  (data) => Math.abs(data.rateDifference - (data.shortFundingRate - data.longFundingRate)) < 0.00000001,
  { message: 'rate_difference must equal short_funding_rate - long_funding_rate' }
).refine(
  (data) => Math.abs(data.expectedReturnRate - (data.rateDifference * 3 * 365)) < 0.0001,
  { message: 'expected_return_rate must equal rate_difference × 3 × 365' }
);

/**
 * 建立套利機會
 */
export function createArbitrageOpportunity(input: {
  symbol: string;
  longExchange: string;
  shortExchange: string;
  longFundingRate: number;
  shortFundingRate: number;
}): Omit<PrismaOpportunity, 'id' | 'created_at' | 'updated_at' | 'expired_at' | 'closed_at' | 'max_rate_difference' | 'max_rate_difference_at' | 'last_notification_at'> {
  const rateDifference = input.shortFundingRate - input.longFundingRate;
  const expectedReturnRate = rateDifference * 3 * 365; // 每天 3 次結算，年化收益

  // 驗證
  ArbitrageOpportunitySchema.parse({
    ...input,
    rateDifference,
    expectedReturnRate,
  });

  return {
    symbol: input.symbol,
    long_exchange: input.longExchange,
    short_exchange: input.shortExchange,
    long_funding_rate: new Decimal(input.longFundingRate),
    short_funding_rate: new Decimal(input.shortFundingRate),
    rate_difference: new Decimal(rateDifference),
    expected_return_rate: new Decimal(expectedReturnRate),
    status: 'ACTIVE' as OpportunityStatus,
    detected_at: new Date(),
    notification_count: 0,
  };
}

/**
 * 計算年化收益率
 */
export function calculateAnnualizedReturn(rateDifference: number): number {
  return rateDifference * 3 * 365; // 每天 3 次結算（每 8 小時）
}

/**
 * 判斷嚴重程度
 */
export function getSeverity(rateDifference: number, thresholds: {
  minimum: number;
  warning: number;
  critical: number;
}): 'INFO' | 'WARNING' | 'CRITICAL' {
  if (rateDifference >= thresholds.critical) return 'CRITICAL';
  if (rateDifference >= thresholds.warning) return 'WARNING';
  return 'INFO';
}
```

---

## 步驟 3: 實作儲存庫（Repository）（15 分鐘）

### 3.1 建立 ArbitrageOpportunityRepository

建立檔案 `src/repositories/ArbitrageOpportunityRepository.ts`:

```typescript
/**
 * ArbitrageOpportunityRepository
 */

import { PrismaClient, Prisma, type ArbitrageOpportunity, type OpportunityStatus } from '@prisma/client';
import type {
  IArbitrageOpportunityRepository,
  CreateOpportunityInput,
  UpdateOpportunityInput,
  OpportunityQueryFilter,
  OpportunityQuerySort,
  OpportunityStatistics,
} from '../types/service-interfaces.js';
import { logger } from '../lib/logger.js';

export class ArbitrageOpportunityRepository implements IArbitrageOpportunityRepository {
  constructor(private prisma: PrismaClient) {}

  async create(input: CreateOpportunityInput): Promise<ArbitrageOpportunity> {
    try {
      const opportunity = await this.prisma.arbitrageOpportunity.create({
        data: {
          symbol: input.symbol,
          long_exchange: input.longExchange,
          short_exchange: input.shortExchange,
          long_funding_rate: new Prisma.Decimal(input.longFundingRate),
          short_funding_rate: new Prisma.Decimal(input.shortFundingRate),
          rate_difference: new Prisma.Decimal(input.rateDifference),
          expected_return_rate: new Prisma.Decimal(input.expectedReturnRate),
          detected_at: input.detectedAt ?? new Date(),
        },
      });

      logger.info({ symbol: opportunity.symbol, id: opportunity.id }, 'Arbitrage opportunity created');
      return opportunity;
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error), input }, 'Failed to create opportunity');
      throw error;
    }
  }

  async findById(id: string): Promise<ArbitrageOpportunity | null> {
    return this.prisma.arbitrageOpportunity.findUnique({ where: { id } });
  }

  async findBySymbol(symbol: string, status?: OpportunityStatus): Promise<ArbitrageOpportunity | null> {
    return this.prisma.arbitrageOpportunity.findFirst({
      where: {
        symbol,
        ...(status && { status }),
      },
      orderBy: { detected_at: 'desc' },
    });
  }

  async findMany(filter: OpportunityQueryFilter, sort?: OpportunityQuerySort, limit?: number): Promise<ArbitrageOpportunity[]> {
    const where: Prisma.ArbitrageOpportunityWhereInput = {};

    if (filter.symbol) where.symbol = filter.symbol;
    if (filter.status) {
      where.status = Array.isArray(filter.status) ? { in: filter.status } : filter.status;
    }
    if (filter.detectedAfter || filter.detectedBefore) {
      where.detected_at = {
        ...(filter.detectedAfter && { gte: filter.detectedAfter }),
        ...(filter.detectedBefore && { lte: filter.detectedBefore }),
      };
    }

    const orderBy: Prisma.ArbitrageOpportunityOrderByWithRelationInput = sort
      ? { [sort.field]: sort.order }
      : { detected_at: 'desc' };

    return this.prisma.arbitrageOpportunity.findMany({
      where,
      orderBy,
      ...(limit && { take: limit }),
    });
  }

  async findActive(sort?: OpportunityQuerySort): Promise<ArbitrageOpportunity[]> {
    return this.findMany({ status: 'ACTIVE' }, sort);
  }

  async update(id: string, input: UpdateOpportunityInput): Promise<ArbitrageOpportunity> {
    const data: Prisma.ArbitrageOpportunityUpdateInput = {};

    if (input.status) data.status = input.status;
    if (input.expiredAt) data.expired_at = input.expiredAt;
    if (input.closedAt) data.closed_at = input.closedAt;
    if (input.maxRateDifference !== undefined) {
      data.max_rate_difference = new Prisma.Decimal(input.maxRateDifference);
    }
    if (input.maxRateDifferenceAt) data.max_rate_difference_at = input.maxRateDifferenceAt;
    if (input.notificationCount !== undefined) data.notification_count = input.notificationCount;
    if (input.lastNotificationAt) data.last_notification_at = input.lastNotificationAt;

    return this.prisma.arbitrageOpportunity.update({ where: { id }, data });
  }

  async markAsExpired(id: string): Promise<ArbitrageOpportunity> {
    return this.update(id, { status: 'EXPIRED', expiredAt: new Date() });
  }

  async close(id: string): Promise<ArbitrageOpportunity> {
    return this.update(id, { status: 'CLOSED', closedAt: new Date() });
  }

  async incrementNotificationCount(id: string): Promise<ArbitrageOpportunity> {
    return this.prisma.arbitrageOpportunity.update({
      where: { id },
      data: {
        notification_count: { increment: 1 },
        last_notification_at: new Date(),
      },
    });
  }

  async updateMaxRateDifference(id: string, rateDifference: number): Promise<ArbitrageOpportunity> {
    const opportunity = await this.findById(id);
    if (!opportunity) throw new Error(`Opportunity not found: ${id}`);

    const currentMax = opportunity.max_rate_difference?.toNumber() ?? 0;
    if (rateDifference > currentMax) {
      return this.update(id, {
        maxRateDifference: rateDifference,
        maxRateDifferenceAt: new Date(),
      });
    }

    return opportunity;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.arbitrageOpportunity.delete({ where: { id } });
  }

  async deleteExpired(daysAgo: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysAgo);

    const result = await this.prisma.arbitrageOpportunity.deleteMany({
      where: {
        status: 'EXPIRED',
        expired_at: { lt: cutoffDate },
      },
    });

    return result.count;
  }

  async getStatistics(symbol?: string, startDate?: Date, endDate?: Date): Promise<OpportunityStatistics> {
    const where: Prisma.ArbitrageOpportunityWhereInput = {};
    if (symbol) where.symbol = symbol;
    if (startDate || endDate) {
      where.detected_at = {
        ...(startDate && { gte: startDate }),
        ...(endDate && { lte: endDate }),
      };
    }

    const [total, active, expired, aggregates] = await Promise.all([
      this.prisma.arbitrageOpportunity.count({ where }),
      this.prisma.arbitrageOpportunity.count({ where: { ...where, status: 'ACTIVE' } }),
      this.prisma.arbitrageOpportunity.count({ where: { ...where, status: 'EXPIRED' } }),
      this.prisma.arbitrageOpportunity.aggregate({
        where,
        _avg: {
          rate_difference: true,
          notification_count: true,
        },
        _max: {
          rate_difference: true,
        },
      }),
    ]);

    // 計算平均持續時間需要查詢 OpportunityHistory
    const historyStats = await this.prisma.opportunityHistory.aggregate({
      where: symbol ? { symbol } : undefined,
      _avg: {
        duration_minutes: true,
      },
      _max: {
        duration_minutes: true,
      },
    });

    return {
      totalOpportunities: total,
      activeOpportunities: active,
      expiredOpportunities: expired,
      avgDurationMinutes: historyStats._avg.duration_minutes?.toNumber() ?? 0,
      maxDurationMinutes: historyStats._max.duration_minutes?.toNumber() ?? 0,
      avgRateDifference: aggregates._avg.rate_difference?.toNumber() ?? 0,
      maxRateDifference: aggregates._max.rate_difference?.toNumber() ?? 0,
      avgNotifications: aggregates._avg.notification_count ?? 0,
    };
  }
}
```

---

## 步驟 4: 第一個測試（5 分鐘）

建立檔案 `tests/integration/ArbitrageOpportunityRepository.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { ArbitrageOpportunityRepository } from '../../src/repositories/ArbitrageOpportunityRepository.js';

describe('ArbitrageOpportunityRepository', () => {
  const prisma = new PrismaClient();
  const repository = new ArbitrageOpportunityRepository(prisma);

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // 清理測試資料
    await prisma.arbitrageOpportunity.deleteMany();
  });

  it('should create an arbitrage opportunity', async () => {
    const input = {
      symbol: 'BTCUSDT',
      longExchange: 'Binance',
      shortExchange: 'OKX',
      longFundingRate: 0.0001,
      shortFundingRate: 0.0066,
      rateDifference: 0.0065,
      expectedReturnRate: 0.0065 * 3 * 365,
    };

    const opportunity = await repository.create(input);

    expect(opportunity).toBeDefined();
    expect(opportunity.symbol).toBe('BTCUSDT');
    expect(opportunity.status).toBe('ACTIVE');
    expect(opportunity.rate_difference.toNumber()).toBeCloseTo(0.0065, 8);
  });

  it('should find opportunity by symbol', async () => {
    const input = {
      symbol: 'ETHUSDT',
      longExchange: 'OKX',
      shortExchange: 'Binance',
      longFundingRate: 0.0002,
      shortFundingRate: 0.0052,
      rateDifference: 0.0050,
      expectedReturnRate: 0.0050 * 3 * 365,
    };

    await repository.create(input);
    const found = await repository.findBySymbol('ETHUSDT', 'ACTIVE');

    expect(found).toBeDefined();
    expect(found?.symbol).toBe('ETHUSDT');
  });

  it('should find active opportunities', async () => {
    await repository.create({
      symbol: 'BTCUSDT',
      longExchange: 'Binance',
      shortExchange: 'OKX',
      longFundingRate: 0.0001,
      shortFundingRate: 0.0066,
      rateDifference: 0.0065,
      expectedReturnRate: 0.0065 * 3 * 365,
    });

    const active = await repository.findActive();
    expect(active).toHaveLength(1);
    expect(active[0].status).toBe('ACTIVE');
  });
});
```

執行測試:

```bash
pnpm test ArbitrageOpportunityRepository
```

---

## 步驟 5: 驗證完成（5 分鐘）

### 5.1 執行所有測試

```bash
pnpm test
```

預期：所有測試通過 ✅

### 5.2 檢查資料庫

```bash
psql -U postgres -d arbitrage_bot -c "\dt arbitrage*"
```

預期：應看到 `arbitrage_opportunities` 資料表

### 5.3 驗證 Prisma Client

```bash
pnpm prisma generate
```

預期：無錯誤訊息

---

## 下一步

你已經完成基礎架構！接下來可以：

1. 實作 `OpportunityDetector` 服務（參考 `contracts/OpportunityDetector.interface.ts`）
2. 實作 `NotificationService`（參考 `contracts/NotificationService.interface.ts`）
3. 實作防抖動機制（參考 `research.md` 的 R1 決策）
4. 建立 CLI 指令（參考 `contracts/CLI.commands.md`）

---

## 常見問題

### Q: Migration 失敗，顯示 "hypertable already exists"

**A**: 執行以下指令檢查並刪除現有 hypertable:

```sql
SELECT drop_chunks('notification_logs', older_than => INTERVAL '0 seconds');
DROP TABLE notification_logs CASCADE;
```

然後重新執行 migration。

### Q: 測試失敗，顯示 "Cannot connect to database"

**A**: 確認 PostgreSQL 正在執行，並檢查 `.env` 檔案的 `DATABASE_URL` 是否正確。

```bash
# 檢查 PostgreSQL 狀態
pg_isready -U postgres

# 測試連線
psql -U postgres -d arbitrage_bot -c "SELECT 1;"
```

### Q: Prisma 型別錯誤

**A**: 重新生成 Prisma Client:

```bash
pnpm prisma generate
```

---

## 參考資源

- [Data Model Specification](./data-model.md)
- [Service Contracts](./contracts/)
- [Research Decisions](./research.md)
- [Implementation Plan](./plan.md)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Vitest Documentation](https://vitest.dev)

---

## 支援

如遇問題，請：

1. 檢查 `logs/` 目錄的錯誤日誌
2. 查閱 `research.md` 的技術決策
3. 參考 `contracts/` 的介面定義
4. 提交 GitHub Issue（如果是 bug）

祝開發順利！ 🚀
