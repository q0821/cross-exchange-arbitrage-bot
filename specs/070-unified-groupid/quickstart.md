# Quickstart: 統一持倉 groupId 架構

**Feature**: 070-unified-groupid
**Date**: 2026-01-30

## 概述

此功能將所有持倉的 `groupId` 欄位從可選改為必填，統一資料結構和 API 回應格式。

## 實作步驟

### Step 1: 執行 Migration

```bash
# 確保資料庫可連線
pnpm docker:up

# 執行 migration（會自動處理現有 null groupId 資料）
pnpm db:migrate
```

### Step 2: 驗證資料

```bash
# 確認沒有 null groupId
pnpm tsx -e "
import { prisma } from './src/lib/db';
const count = await prisma.position.count({ where: { groupId: null } });
console.log('Null groupId count:', count);
await prisma.\$disconnect();
"
```

### Step 3: 測試 API

```bash
# 執行單元測試
pnpm test tests/unit/services/PositionGroupService.test.ts

# 執行整合測試
RUN_INTEGRATION_TESTS=true pnpm test tests/integration/position-group-*.test.ts
```

## 關鍵變更

### 資料庫

```prisma
// Before
groupId String? @db.Uuid

// After
groupId String @db.Uuid @default(dbgenerated("gen_random_uuid()"))
```

### API 回應

```typescript
// Before
{
  positions: [...],  // 無 groupId 的持倉
  groups: [...]      // 有 groupId 的持倉組
}

// After
{
  groups: [...]      // 所有持倉，每個 group 包含 1+ 個持倉
}
```

### 前端

- 移除對 `positions` 陣列的處理
- 統一使用 `groups` 陣列渲染
- `positionCount` 可能為 1（單獨開倉）

## 回滾指南

如需回滾：

```bash
# 回滾 migration
npx prisma migrate resolve --rolled-back <migration-name>

# 恢復 schema.prisma 為舊版本
git checkout HEAD~1 -- prisma/schema.prisma

# 重新生成 Prisma Client
pnpm db:generate
```

## 驗證清單

- [ ] 所有持倉都有 groupId（無 null）
- [ ] 單獨開倉會自動生成 groupId
- [ ] API 回應只包含 groups 陣列
- [ ] 前端正確顯示所有持倉
- [ ] 所有測試通過
