# Implementation Plan: 分單開倉（獨立持倉）

**Branch**: `060-split-position-open` | **Date**: 2026-01-07 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/060-split-position-open/spec.md`

## Summary

在開倉對話框中新增「開倉組數」參數，允許用戶將單一開倉拆分為多個獨立持倉。前端 Hook 串行調用現有開倉 API，每組持倉獨立管理。此功能減少大額交易滑價，並支援分批平倉。

## Technical Context

**Language/Version**: TypeScript 5.8 + Node.js 20.x LTS
**Primary Dependencies**: Next.js 15, React 19, Radix UI (Dialog), Sonner (Toast)
**Storage**: PostgreSQL 15 + TimescaleDB（複用現有 Position 模型）
**Testing**: Vitest 4.x
**Target Platform**: Web (Next.js App Router)
**Project Type**: Web application
**Performance Goals**: 每組開倉 5-10 秒，10 組總計 < 120 秒
**Constraints**: 串行執行，最大 10 組，每組數量 >= MIN_QUANTITY
**Scale/Scope**: 現有用戶規模，無新增負載

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- ✅ **Principle I (Trading Safety First)**: 複用現有 Saga Pattern 開倉流程，每組獨立交易確保原子性
- ✅ **Principle II (Complete Observability)**: 每組開倉都有獨立日誌和持倉記錄
- ✅ **Principle III (Defensive Programming)**: 某組失敗時立即停止，已成功組保留
- ✅ **Principle IV (Data Integrity)**: 複用現有 Position 模型，無資料模型變更
- ✅ **Principle V (Incremental Delivery)**: 最小化修改範圍，僅前端變更
- ✅ **Principle VI (System Architecture Boundaries)**: 前端 Hook 控制邏輯，複用後端 API
- ✅ **Principle VII (TDD Discipline)**: 新增單元測試驗證數量分配邏輯

## Project Structure

### Documentation (this feature)

```
specs/060-split-position-open/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (無新增模型)
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (無新增 API)
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```
app/
├── (dashboard)/
│   └── market-monitor/
│       ├── components/
│       │   └── OpenPositionDialog.tsx   # [MODIFY] 新增組數輸入欄位
│       └── hooks/
│           └── useOpenPosition.ts       # [MODIFY] 新增分單開倉邏輯

tests/
├── unit/
│   └── hooks/
│       └── splitQuantity.test.ts        # [NEW] 數量分配測試
```

**Structure Decision**: 前端單一修改點，無後端變更

## Complexity Tracking

*No violations - straightforward feature addition*

## Phase 0: Research

### 技術決策

1. **實作層級**：前端 Hook 層，循環調用現有 API
   - 複用 PositionOrchestrator Saga Pattern
   - 無需後端修改

2. **數量分配**：大組優先策略
   - `quantities[0] = Math.ceil(total / count)`
   - `quantities[1..n-1] = Math.floor(total / count)`

3. **進度顯示**：擴展現有 loading 狀態
   - 新增 `currentGroup` 和 `totalGroups` 狀態
   - Loading 覆蓋層顯示「正在建立第 N/M 組...」

4. **錯誤處理**：快速失敗
   - 某組失敗立即停止
   - 已成功持倉保留

## Phase 1: Design

### 1.1 前端組件修改

**OpenPositionDialog.tsx**:

```typescript
// 新增狀態
const [positionCount, setPositionCount] = useState<number>(1);

// 計算每組數量
const quantityPerGroup = useMemo(() => {
  if (positionCount <= 0) return 0;
  return Math.floor((quantity * 10000) / positionCount) / 10000;
}, [quantity, positionCount]);

// 驗證每組數量
useEffect(() => {
  if (quantityPerGroup > 0 && quantityPerGroup < MIN_QUANTITY) {
    setValidationError(`每組數量不得小於 ${MIN_QUANTITY}`);
  }
}, [quantityPerGroup]);
```

### 1.2 Hook 修改

**useOpenPosition.ts**:

```typescript
// 新增狀態
const [currentGroup, setCurrentGroup] = useState(0);
const [totalGroups, setTotalGroups] = useState(0);

// 數量分配函式
function splitQuantity(total: number, count: number): number[] {
  const base = Math.floor((total * 10000) / count) / 10000;
  const remainder = total - base * count;
  return Array.from({ length: count }, (_, i) =>
    i === 0 ? base + remainder : base
  );
}

// 分單開倉執行
async function executeSplitOpen(
  data: OpenPositionData,
  positionCount: number
): Promise<void> {
  if (positionCount === 1) {
    return executeOpen(data);
  }

  const quantities = splitQuantity(data.quantity, positionCount);
  setTotalGroups(positionCount);

  for (let i = 0; i < positionCount; i++) {
    setCurrentGroup(i + 1);

    await executeOpen({
      ...data,
      quantity: quantities[i],
    });

    if (error) break;
  }

  setCurrentGroup(0);
  setTotalGroups(0);
}
```

### 1.3 進度顯示

```typescript
// Loading 覆蓋層文字
const loadingText = totalGroups > 1
  ? `正在建立第 ${currentGroup}/${totalGroups} 組持倉...`
  : '開倉中...';
```

## Dependencies

```
OpenPositionDialog.tsx
├── useOpenPosition.ts (修改 executeOpen 接口)
│   └── splitQuantity 函式 (新增)
└── 現有 /api/positions/open (無修改)
```

## Phase 2 Tasks Preview

1. T001: 新增 `splitQuantity` 函式和單元測試
2. T002: 修改 `useOpenPosition` 新增分單開倉邏輯
3. T003: 修改 `OpenPositionDialog` 新增組數輸入欄位
4. T004: 更新進度顯示文字
5. T005: 執行完整測試

---

**下一步**: 執行 `/speckit.tasks` 生成詳細任務清單
