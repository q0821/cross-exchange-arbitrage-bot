# Implementation Plan: 分單持倉合併顯示與批量平倉

**Branch**: `069-position-group-close` | **Date**: 2026-01-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/069-position-group-close/spec.md`

## Summary

實作分單開倉持倉的合併顯示與批量平倉功能：
1. 在 Position 模型新增 `groupId` 欄位，分單開倉時分配相同的 groupId
2. 前端將相同 groupId 的持倉合併顯示為「組合持倉」卡片
3. 提供批量平倉 API，一次性平倉組合內所有持倉並取消條件單
4. 向後相容：沒有 groupId 的持倉維持原有顯示和操作方式

## Technical Context

**Language/Version**: TypeScript 5.8 + Node.js 20.x LTS
**Primary Dependencies**: Next.js 15, React 19, Prisma 7.x, CCXT 4.x, Socket.io 4.8.1, Decimal.js
**Storage**: PostgreSQL 15 + TimescaleDB（擴展現有 Position 模型）
**Testing**: Vitest 4.x（單元測試 + 整合測試）
**Target Platform**: Web application (Next.js App Router)
**Project Type**: Web（前端 + 後端）
**Performance Goals**: 批量平倉 5 組持倉 < 30 秒
**Constraints**: 串行平倉避免併發問題，向後相容現有持倉
**Scale/Scope**: 單一用戶最多 10 組分單持倉

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 狀態 | 說明 |
|------|------|------|
| **I. 交易安全優先（不可妥協）** | ✅ Pass | 批量平倉複用現有 PositionCloser，維持 Saga Pattern 補償機制 |
| **II. 完整可觀測性（不可妥協）** | ✅ Pass | 批量平倉記錄完整審計日誌，每組平倉結果獨立記錄 |
| **III. 防禦性程式設計** | ✅ Pass | 部分失敗時繼續處理剩餘持倉，錯誤優雅處理 |
| **IV. 資料完整性（不可妥協）** | ✅ Pass | Position 新增 groupId 欄位需產生 Migration 檔案 |
| **V. 漸進式交付** | ✅ Pass | 分階段實作：P1（合併顯示 + 批量平倉）→ P2（統計資訊） |
| **VI. 系統架構邊界** | ✅ Pass | groupId 邏輯在後端處理，前端僅負責顯示 |
| **VII. 測試驅動開發（不可妥協）** | ✅ Pass | 先寫測試再實作，覆蓋批量平倉邏輯 |

## Project Structure

### Documentation (this feature)

```text
specs/069-position-group-close/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (API contracts)
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
# 後端修改
prisma/
├── schema.prisma                    # Position 新增 groupId 欄位
└── migrations/                      # 新增 Migration 檔案

src/
├── services/
│   └── trading/
│       ├── PositionOrchestrator.ts  # 修改：分單開倉時分配 groupId
│       ├── PositionCloser.ts        # 新增：批量平倉方法
│       └── PositionGroupService.ts  # 新增：組合持倉聚合邏輯
├── lib/
│   └── position-group.ts            # 新增：組合持倉計算工具
└── types/
    └── position-group.ts            # 新增：組合持倉類型定義

# API 路由
app/api/
├── positions/
│   ├── route.ts                     # 修改：回傳 groupId，支援分組查詢
│   └── group/
│       └── [groupId]/
│           └── close/route.ts       # 新增：批量平倉 API

# 前端修改
app/(dashboard)/positions/
├── page.tsx                         # 修改：支援組合持倉顯示
├── components/
│   ├── PositionCard.tsx             # 修改：支援組合卡片模式
│   ├── PositionGroupCard.tsx        # 新增：組合持倉卡片元件
│   ├── PositionGroupExpanded.tsx    # 新增：展開的持倉列表
│   └── BatchCloseDialog.tsx         # 新增：批量平倉確認對話框
└── hooks/
    ├── usePositions.ts              # 修改：支援分組邏輯
    └── useBatchClose.ts             # 新增：批量平倉 Hook

# 測試
tests/
├── unit/
│   ├── services/
│   │   └── PositionGroupService.test.ts
│   └── lib/
│       └── position-group.test.ts
└── integration/
    └── batch-close.test.ts
```

**Structure Decision**: 採用現有 Web 應用結構，擴展 Position 相關服務和元件。

## Complexity Tracking

> 無違規需要說明。所有修改都符合 Constitution 原則。

## Implementation Phases

### Phase 1: Database Schema (P1)

**目標**: Position 模型新增 groupId 欄位

**修改檔案**:
- `prisma/schema.prisma` - 新增 groupId 欄位
- `prisma/migrations/xxx_add_position_group_id.sql` - Migration 檔案

**驗收標準**:
- [ ] Migration 成功執行
- [ ] Prisma Client 正確生成 groupId 類型

---

### Phase 2: Backend Services (P1)

**目標**: 實作批量平倉服務和 API

**修改檔案**:
- `src/types/position-group.ts` - 類型定義
- `src/lib/position-group.ts` - 聚合計算工具
- `src/services/trading/PositionGroupService.ts` - 組合持倉服務
- `src/services/trading/PositionOrchestrator.ts` - 分配 groupId
- `src/services/trading/PositionCloser.ts` - 批量平倉方法
- `app/api/positions/route.ts` - 分組查詢支援
- `app/api/positions/group/[groupId]/close/route.ts` - 批量平倉 API

**驗收標準**:
- [ ] 分單開倉時正確分配 groupId
- [ ] 批量平倉 API 正常運作
- [ ] 單元測試覆蓋批量平倉邏輯

---

### Phase 3: Frontend Components (P1)

**目標**: 實作組合持倉顯示和批量平倉 UI

**修改檔案**:
- `app/(dashboard)/positions/page.tsx` - 分組顯示邏輯
- `app/(dashboard)/positions/hooks/usePositions.ts` - 分組 Hook
- `app/(dashboard)/positions/hooks/useBatchClose.ts` - 批量平倉 Hook
- `app/(dashboard)/positions/components/PositionGroupCard.tsx` - 組合卡片
- `app/(dashboard)/positions/components/PositionGroupExpanded.tsx` - 展開列表
- `app/(dashboard)/positions/components/BatchCloseDialog.tsx` - 平倉對話框

**驗收標準**:
- [ ] 組合持倉正確合併顯示
- [ ] 批量平倉進度正確顯示
- [ ] 向後相容單獨持倉

---

### Phase 4: Integration Testing (P1)

**目標**: 端到端整合測試

**測試檔案**:
- `tests/integration/batch-close.test.ts`

**驗收標準**:
- [ ] 分單開倉 → 組合顯示 → 批量平倉流程完整
- [ ] 部分失敗場景正確處理

---

### Phase 5: Statistics Display (P2)

**目標**: 組合持倉統計資訊顯示

**修改檔案**:
- `app/(dashboard)/positions/components/PositionGroupCard.tsx` - 統計顯示

**驗收標準**:
- [ ] 顯示總資金費率收益
- [ ] 顯示平均開倉價格
- [ ] 計算誤差 < 0.01%

---

## Design Artifacts

| Artifact | Status | Link |
|----------|--------|------|
| Research | ✅ Complete | [research.md](./research.md) |
| Data Model | ✅ Complete | [data-model.md](./data-model.md) |
| API Contracts | ✅ Complete | [contracts/api.md](./contracts/api.md) |
| Quickstart | ✅ Complete | [quickstart.md](./quickstart.md) |
| Tasks | ✅ Complete | [tasks.md](./tasks.md) |

## Next Steps

1. 執行 `/speckit.tasks` 生成 tasks.md
2. 按 Phase 順序實作
3. 每個 Phase 完成後更新驗收標準
