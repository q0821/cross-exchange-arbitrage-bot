# Quickstart: 分單持倉合併顯示與批量平倉

**Feature**: 069-position-group-close
**Date**: 2026-01-25

## Overview

本功能實現分單開倉持倉的合併顯示與批量平倉：
1. Position 模型新增 `groupId` 欄位
2. 前端將相同 groupId 的持倉合併顯示為「組合持倉」卡片
3. 提供批量平倉 API，一次性平倉組合內所有持倉

## Prerequisites

- Node.js 20.x LTS
- PostgreSQL 15+ with TimescaleDB
- Redis (for distributed locks)
- pnpm

## Quick Setup

### 1. Apply Database Migration

```bash
# 生成 migration 檔案
pnpm prisma migrate dev --name add_position_group_id

# 驗證 migration
pnpm prisma migrate status
```

### 2. Generate Prisma Client

```bash
pnpm prisma generate
```

### 3. Start Development Server

```bash
pnpm dev
```

## Key Files

### Backend

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Position 模型新增 groupId |
| `src/services/trading/PositionOrchestrator.ts` | 分單開倉時分配 groupId |
| `src/services/trading/PositionCloser.ts` | 新增批量平倉方法 |
| `src/services/trading/PositionGroupService.ts` | 組合持倉聚合邏輯 |
| `src/lib/position-group.ts` | 組合持倉計算工具 |
| `src/types/position-group.ts` | 組合持倉類型定義 |
| `app/api/positions/group/[groupId]/close/route.ts` | 批量平倉 API |

### Frontend

| File | Purpose |
|------|---------|
| `app/(dashboard)/positions/page.tsx` | 持倉列表（支援組合顯示） |
| `app/(dashboard)/positions/components/PositionGroupCard.tsx` | 組合持倉卡片 |
| `app/(dashboard)/positions/components/PositionGroupExpanded.tsx` | 展開的持倉列表 |
| `app/(dashboard)/positions/components/BatchCloseDialog.tsx` | 批量平倉對話框 |
| `app/(dashboard)/positions/hooks/usePositions.ts` | 持倉查詢（含分組） |
| `app/(dashboard)/positions/hooks/useBatchClose.ts` | 批量平倉 Hook |

## Usage Examples

### 1. 分單開倉（前端流程）

```typescript
// hooks/useOpenPosition.ts
const executeSplitOpen = async (params: OpenPositionParams, count: number) => {
  let groupId: string | undefined;

  for (let i = 0; i < count; i++) {
    const result = await openPosition({
      ...params,
      groupId, // 第一組為 undefined，後續使用回傳的 groupId
    });

    if (i === 0) {
      groupId = result.position.groupId;
    }
  }
};
```

### 2. 查詢組合持倉

```typescript
// hooks/usePositions.ts
const { data } = useQuery({
  queryKey: ['positions', { grouped: true }],
  queryFn: () => fetch('/api/positions?grouped=true').then(r => r.json()),
});

// data.positions: 單獨開倉的持倉
// data.groups: 組合持倉（含聚合統計）
```

### 3. 批量平倉

```typescript
// hooks/useBatchClose.ts
const { mutateAsync: batchClose, isPending } = useMutation({
  mutationFn: (groupId: string) =>
    fetch(`/api/positions/group/${groupId}/close`, { method: 'POST' })
      .then(r => r.json()),
});

// 使用
await batchClose('550e8400-e29b-41d4-a716-446655440000');
```

### 4. WebSocket 進度監聽

```typescript
// 監聽批量平倉進度
socket.on('position:batch:close:progress', (data) => {
  console.log(`平倉進度: ${data.current}/${data.total}`);
});

socket.on('position:batch:close:success', (data) => {
  console.log(`平倉完成，總損益: ${data.totalPnL}`);
});
```

## Testing

### Run Tests

```bash
# 單元測試
pnpm test tests/unit/services/PositionGroupService.test.ts
pnpm test tests/unit/lib/position-group.test.ts

# 整合測試（需要 PostgreSQL）
RUN_INTEGRATION_TESTS=true pnpm test tests/integration/batch-close.test.ts
```

### Manual Testing

1. 使用分單開倉功能開 3 組持倉
2. 進入持倉列表，確認顯示為一個組合卡片
3. 展開查看各組詳細資訊
4. 點擊「全部平倉」按鈕
5. 確認平倉對話框顯示正確統計
6. 執行平倉，觀察進度指示
7. 確認所有持倉已平倉，條件單已取消

## Architecture Decisions

### Why groupId in Position (not separate table)?

1. **簡單性**：避免額外的 JOIN 查詢
2. **效能**：單一索引即可查詢組合
3. **向後相容**：nullable 欄位不影響現有資料

### Why Serial Batch Close (not Parallel)?

1. **避免 Rate Limit**：交易所 API 限制
2. **避免競態條件**：多個平倉同時執行可能衝突
3. **可追蹤進度**：串行執行可以精確回報進度

### Why Virtual PositionGroup (not Database Entity)?

1. **即時計算**：確保數據一致性
2. **無冗餘**：避免維護額外的聚合表
3. **彈性**：聚合邏輯可隨時調整

## Troubleshooting

### Migration Failed

```bash
# 檢查 migration 狀態
pnpm prisma migrate status

# 如果有 drift，重置 checksum
psql -c "UPDATE _prisma_migrations SET checksum = '<new>' WHERE migration_name = '<name>';"
```

### Batch Close Stuck

1. 檢查 Redis 鎖狀態
2. 確認交易所 API 連線正常
3. 查看後端日誌（`pnpm dev:pretty`）

### GroupId Not Generated

確認使用分單開倉功能（positionCount > 1），單獨開倉不會生成 groupId。

## References

- [Spec](./spec.md)
- [Research](./research.md)
- [Data Model](./data-model.md)
- [API Contracts](./contracts/api.md)
- [Plan](./plan.md)
