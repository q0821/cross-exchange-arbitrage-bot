# Research: 統一持倉 groupId 架構

**Feature**: 070-unified-groupid
**Date**: 2026-01-30

## 研究摘要

此為內部架構重構，不涉及新技術或外部依賴。以下是對現有實作的分析和決策記錄。

---

## 1. 現有實作分析

### 1.1 資料庫 Schema

**現況**：
```prisma
// prisma/schema.prisma:266
groupId String? @db.Uuid  // 分單開倉組別 ID，null 表示單獨開倉
```

**決策**: 將 `groupId` 改為必填（移除 `?`）
**理由**: 統一資料結構，所有持倉都屬於一個 group（即使 group 只有 1 個持倉）
**替代方案考慮**:
- 維持 nullable + 應用層處理 → 拒絕，增加複雜度
- 新增 PositionGroup table → 拒絕，過度工程化

### 1.2 開倉邏輯

**現況** (PositionOrchestrator.ts):
- 分單開倉：傳入 groupId
- 單獨開倉：groupId = undefined（存為 null）

**決策**: 單獨開倉時自動生成 UUID
**理由**: 統一開倉流程，減少條件判斷
**實作方式**: 使用 `PositionGroupService.generateGroupId()`

### 1.3 API 回應格式

**現況** (GET /api/positions?grouped=true):
```json
{
  "positions": [...],  // 無 groupId 的持倉
  "groups": [...]      // 有 groupId 的持倉組
}
```

**決策**: 統一為 groups 格式
```json
{
  "groups": [...]  // 所有持倉，每個 group 包含 1+ 個持倉
}
```
**理由**: 前端只需處理單一資料結構

### 1.4 Migration 策略

**決策**: 兩階段 migration
1. Data migration: 為現有 null groupId 持倉生成獨立 UUID
2. Schema migration: 將 groupId 改為 NOT NULL

**理由**: Prisma 要求先處理現有資料，才能加上 NOT NULL 約束
**風險評估**:
- 資料量小（數百筆），可在服務運行期間執行
- 使用 PostgreSQL gen_random_uuid() 確保 UUID 唯一性

---

## 2. 影響範圍分析

### 2.1 需修改的檔案

| 檔案 | 修改類型 | 說明 |
|------|----------|------|
| prisma/schema.prisma | Schema | groupId: String? → String |
| src/services/trading/PositionOrchestrator.ts | 邏輯 | 單獨開倉生成 groupId |
| src/services/trading/PositionGroupService.ts | 邏輯 | 移除 null 處理 |
| src/lib/position-group.ts | 邏輯 | 簡化 toGroupedPositionsResponse |
| src/types/position-group.ts | 類型 | 移除 positions 陣列 |
| app/api/positions/route.ts | API | 統一回應格式 |
| 前端組件 | UI | 移除條件渲染 |

### 2.2 不需修改的檔案

| 檔案 | 原因 |
|------|------|
| PositionCloser.ts | 平倉邏輯不依賴 groupId nullable |
| ConditionalOrderService.ts | 停損停利不涉及 group 概念 |

---

## 3. 測試策略

### 3.1 單元測試

- `PositionGroupService.test.ts`: 更新現有測試，移除 null groupId 測試案例
- `position-group.test.ts`: 更新 toGroupedPositionsResponse 測試

### 3.2 整合測試

- `position-group-open.test.ts`: 驗證單獨開倉有 groupId
- `position-backward-compat.test.ts`: 驗證 migration 後資料正確

### 3.3 Migration 測試

- 建立測試資料（含 null groupId）
- 執行 migration
- 驗證所有持倉都有 groupId

---

## 4. 實作順序建議

1. **Phase 1: Migration**
   - 建立 data migration script
   - 建立 schema migration
   - 測試 migration 可重複執行

2. **Phase 2: Backend**
   - 更新 PositionOrchestrator
   - 更新 PositionGroupService
   - 更新 API route

3. **Phase 3: Frontend**
   - 更新持倉列表顯示
   - 移除條件渲染邏輯

4. **Phase 4: Cleanup**
   - 移除廢棄的 positions 陣列處理
   - 更新相關測試

---

## 5. 決策記錄摘要

| 決策 | 選擇 | 替代方案 |
|------|------|----------|
| groupId 類型 | 必填 String | 維持 nullable |
| Migration 方式 | Prisma migrate | 手動 SQL |
| API 格式 | 只有 groups | 維持 positions + groups |
| UUID 生成 | 應用層 randomUUID() | DB gen_random_uuid() |
