# Data Model: 分單持倉合併顯示與批量平倉

**Feature**: 069-position-group-close
**Date**: 2026-01-25
**Status**: Draft

## Entity Changes

### Position (Extended)

擴展現有 Position 模型，新增 groupId 欄位用於關聯分單開倉的持倉。

```prisma
model Position {
  // ... 現有欄位 ...

  // ===== 分單開倉組別 (Feature 069) =====
  groupId String? @db.Uuid  // 分單開倉組別 ID，null 表示單獨開倉

  // ... 現有關聯 ...

  @@index([groupId])  // 新增索引加速查詢
  @@index([userId, groupId])  // 複合索引：查詢用戶的組合持倉
}
```

#### Field Details

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `groupId` | UUID | Yes | 分單開倉組別識別碼，null 表示非分單開倉 |

#### Constraints

- `groupId` 使用 UUID v4 格式
- 相同 `groupId` 的持倉必須屬於同一用戶
- 相同 `groupId` 的持倉必須具有相同的 `symbol`、`longExchange`、`shortExchange`

---

## Virtual Entities (Non-Database)

### PositionGroup

前端和 API 層使用的虛擬資料結構，用於組合顯示。

```typescript
/**
 * 組合持倉資料結構
 */
interface PositionGroup {
  /** 組別 ID */
  groupId: string;

  /** 交易對符號 */
  symbol: string;

  /** 做多交易所 */
  longExchange: string;

  /** 做空交易所 */
  shortExchange: string;

  /** 組內持倉列表 */
  positions: Position[];

  /** 聚合統計 */
  aggregate: PositionGroupAggregate;
}

/**
 * 組合持倉聚合統計
 */
interface PositionGroupAggregate {
  /** 總數量（以做多方為準） */
  totalQuantity: Decimal;

  /** 加權平均做多開倉價格 */
  avgLongEntryPrice: Decimal;

  /** 加權平均做空開倉價格 */
  avgShortEntryPrice: Decimal;

  /** 總資金費率收益（快取值） */
  totalFundingPnL: Decimal | null;

  /** 總未實現損益 */
  totalUnrealizedPnL: Decimal | null;

  /** 組內持倉數量 */
  positionCount: number;

  /** 最早開倉時間 */
  firstOpenedAt: Date | null;

  /** 停損設定（如果所有持倉設定相同） */
  stopLossPercent: Decimal | null;

  /** 停利設定（如果所有持倉設定相同） */
  takeProfitPercent: Decimal | null;
}
```

---

## API Response Types

### GET /api/positions Response

```typescript
interface PositionsResponse {
  /** 單獨開倉的持倉列表（無 groupId） */
  positions: Position[];

  /** 組合持倉列表（有 groupId） */
  groups: PositionGroup[];
}
```

### POST /api/positions/group/:groupId/close Request

```typescript
interface BatchCloseRequest {
  /** 平倉原因（可選） */
  reason?: 'MANUAL';
}
```

### POST /api/positions/group/:groupId/close Response

```typescript
interface BatchCloseResponse {
  /** 總體狀態 */
  status: 'success' | 'partial' | 'failed';

  /** 成功平倉數量 */
  successCount: number;

  /** 失敗平倉數量 */
  failedCount: number;

  /** 各組平倉結果 */
  results: BatchClosePositionResult[];

  /** 總損益（成功平倉的部分） */
  totalPnL: Decimal | null;
}

interface BatchClosePositionResult {
  /** Position ID */
  positionId: string;

  /** 是否成功 */
  success: boolean;

  /** 成功時的 Trade ID */
  tradeId?: string;

  /** 失敗原因 */
  error?: string;

  /** 該組損益 */
  pnL?: Decimal;
}
```

---

## Migration Strategy

### Migration File: `xxx_add_position_group_id.sql`

```sql
-- 新增 groupId 欄位
ALTER TABLE "positions" ADD COLUMN "groupId" UUID;

-- 建立索引
CREATE INDEX IF NOT EXISTS "idx_positions_group_id" ON "positions"("groupId");
CREATE INDEX IF NOT EXISTS "idx_positions_user_group" ON "positions"("userId", "groupId");

-- 註解
COMMENT ON COLUMN "positions"."groupId" IS 'Feature 069: 分單開倉組別 ID，null 表示單獨開倉';
```

### Rollback

```sql
-- 移除索引
DROP INDEX IF EXISTS "idx_positions_user_group";
DROP INDEX IF EXISTS "idx_positions_group_id";

-- 移除欄位
ALTER TABLE "positions" DROP COLUMN IF EXISTS "groupId";
```

---

## Validation Rules

### groupId Assignment

1. 單獨開倉（`positionCount = 1`）：`groupId = null`
2. 分單開倉（`positionCount > 1`）：
   - 第一組：生成新 UUID
   - 後續組：使用相同 UUID

### Batch Close Prerequisites

1. 所有組內持倉必須為 `status = OPEN`
2. 組內持倉必須屬於同一用戶
3. 不能同時對同一組進行多次批量平倉（使用分散式鎖）

---

## Performance Considerations

### Indexes

| Index | Columns | Purpose |
|-------|---------|---------|
| `idx_positions_group_id` | `groupId` | 按組別查詢持倉 |
| `idx_positions_user_group` | `userId, groupId` | 用戶的組合持倉查詢 |

### Query Patterns

```sql
-- 查詢用戶所有組合持倉
SELECT * FROM positions
WHERE "userId" = $1 AND "groupId" IS NOT NULL AND status = 'OPEN'
ORDER BY "groupId", "createdAt";

-- 查詢特定組別的持倉
SELECT * FROM positions
WHERE "groupId" = $1 AND status = 'OPEN';

-- 查詢用戶單獨開倉的持倉
SELECT * FROM positions
WHERE "userId" = $1 AND "groupId" IS NULL AND status = 'OPEN';
```

---

## References

- Spec: `specs/069-position-group-close/spec.md`
- Research: `specs/069-position-group-close/research.md`
- Existing Schema: `prisma/schema.prisma:206-272`
