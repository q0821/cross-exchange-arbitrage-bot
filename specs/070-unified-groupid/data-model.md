# Data Model: 統一持倉 groupId 架構

**Feature**: 070-unified-groupid
**Date**: 2026-01-30

## Entity Changes

### Position (修改)

**變更前**:
```prisma
model Position {
  // ... other fields
  groupId String? @db.Uuid  // nullable
}
```

**變更後**:
```prisma
model Position {
  // ... other fields
  groupId String @db.Uuid @default(dbgenerated("gen_random_uuid()"))  // required with default
}
```

**欄位變更**:

| 欄位 | 變更前 | 變更後 | 說明 |
|------|--------|--------|------|
| groupId | String? (nullable) | String (required) | 所有持倉必須有 groupId |

**新增約束**:
- `@default(dbgenerated("gen_random_uuid()"))`: 新建持倉自動生成 UUID

---

## Validation Rules

### groupId

| 規則 | 說明 |
|------|------|
| 格式 | UUID v4 |
| 必填 | 是（不可為 null） |
| 唯一性 | 不唯一（同 group 的持倉共享相同 groupId） |
| 預設值 | 資料庫層自動生成 |

---

## State Transitions

Position 的狀態轉換不受此變更影響：

```
PENDING → OPENING → OPEN → CLOSING → CLOSED
                      ↓
                   FAILED
                      ↓
                   PARTIAL
```

groupId 在 Position 建立時設定，之後不可變更。

---

## Migration Strategy

### Step 1: Data Migration

為現有 null groupId 的持倉生成獨立 UUID：

```sql
-- 為每個 null groupId 的持倉生成獨立 UUID
UPDATE positions
SET "groupId" = gen_random_uuid()
WHERE "groupId" IS NULL;
```

### Step 2: Schema Migration

將 groupId 改為 NOT NULL：

```sql
-- 加上 NOT NULL 約束
ALTER TABLE positions ALTER COLUMN "groupId" SET NOT NULL;

-- 加上預設值（新建持倉自動生成）
ALTER TABLE positions ALTER COLUMN "groupId" SET DEFAULT gen_random_uuid();
```

### Prisma Migration 指令

```bash
# 1. 修改 schema.prisma
# 2. 產生 migration
npx prisma migrate dev --name unified-groupid

# Migration 檔案會自動處理資料更新和 schema 變更
```

---

## Relationships

Position 與 PositionGroup 的關係（邏輯層面，非資料庫層面）：

```
PositionGroup (logical)
    │
    ├── Position (groupId = "uuid-1")
    ├── Position (groupId = "uuid-1")
    └── Position (groupId = "uuid-1")

PositionGroup (single position)
    │
    └── Position (groupId = "uuid-2")
```

**注意**: PositionGroup 不是資料庫 table，而是由相同 groupId 的 Position 在應用層組成的邏輯概念。

---

## Data Volume Assumptions

| 項目 | 估計值 |
|------|--------|
| 現有持倉數量 | 數百筆 |
| 需要補 groupId 的持倉 | 預估 < 100 筆 |
| Migration 時間 | < 1 秒 |
| 影響 | 可在服務運行期間執行 |
