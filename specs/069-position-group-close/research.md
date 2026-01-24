# Technical Research: 分單持倉合併顯示與批量平倉

**Feature**: 069-position-group-close
**Date**: 2026-01-25
**Status**: Complete

## Research Questions

### RQ-001: How should groupId be generated and stored?

**Decision**: 使用 UUID v4 作為 groupId，儲存在 Position 模型中作為可選欄位。

**Rationale**:
1. UUID v4 具有足夠的唯一性，無需擔心碰撞
2. 可選欄位（nullable）確保向後相容性
3. 在 `PositionOrchestrator.openPosition()` 中分配 groupId
4. 分單開倉時，第一組持倉生成新 UUID，後續組使用相同 UUID

**Existing Pattern**:
```typescript
// Position 模型現有 id 使用 cuid()
id String @id @default(cuid())
```

**Recommendation**: 使用 `crypto.randomUUID()` 生成 UUID v4。

---

### RQ-002: What is the best approach for batch close?

**Decision**: 複用現有 `PositionCloser` 進行串行平倉。

**Rationale**:
1. `PositionCloser` 已實現完整的平倉邏輯（雙邊平倉、條件單取消、PnL 計算）
2. 串行執行避免 API rate limit 和併發競態條件
3. 每組平倉獨立處理，部分失敗不影響其他組
4. 複用現有 WebSocket 進度推送機制

**Existing Code** (`src/services/trading/PositionCloser.ts:1-50`):
```typescript
export class PositionCloser {
  async closePosition(params: ClosePositionParams): Promise<BilateralCloseResult> {
    // 已實現：取得鎖 → 平倉 Long → 平倉 Short → 取消條件單 → 更新 Position → 建立 Trade
  }
}
```

**Recommendation**: 新增 `closeBatchPositions(groupId: string)` 方法，內部循環呼叫 `closePosition()`。

---

### RQ-003: How to aggregate statistics for position groups?

**Decision**: 在 API 層計算聚合統計，不儲存在資料庫。

**Rationale**:
1. 即時計算確保數據一致性
2. 避免資料庫冗餘和同步問題
3. 聚合計算邏輯簡單（加總、加權平均）
4. Position 記錄數量有限（單用戶最多 10 組）

**Aggregation Formulas**:
```typescript
// 總數量
totalQuantity = Σ(position.longPositionSize)

// 加權平均開倉價格
avgEntryPrice = Σ(position.longEntryPrice × position.longPositionSize) / totalQuantity

// 總資金費率收益
totalFundingPnL = Σ(position.cachedFundingPnL)
```

**Recommendation**: 在 `/api/positions` 回傳時計算，或在前端 `usePositions` hook 中聚合。

---

### RQ-004: Frontend architecture for group display?

**Decision**: 新增 `PositionGroupCard` 元件，可展開顯示組內持倉。

**Rationale**:
1. 保持現有 `PositionCard` 不變，向後相容
2. `PositionGroupCard` 封裝組合顯示邏輯
3. 使用 Radix UI Collapsible 實現展開/收合
4. 批量平倉使用獨立的 `BatchCloseDialog`

**Existing Components**:
- `app/(dashboard)/positions/page.tsx` - 持倉列表頁面
- `app/(dashboard)/positions/components/PositionCard.tsx` - 單一持倉卡片
- `app/(dashboard)/positions/components/ClosePositionDialog.tsx` - 平倉對話框

**Recommendation**: 在 `page.tsx` 中根據 `groupId` 分組渲染 `PositionGroupCard` 或 `PositionCard`。

---

### RQ-005: How to handle conditional orders in batch close?

**Decision**: 批量平倉時自動取消所有相關條件單。

**Rationale**:
1. 現有 `PositionCloser.closePosition()` 已包含條件單取消邏輯
2. 每組平倉時會自動處理該組的停損/停利訂單
3. 無需額外實作，複用現有邏輯即可

**Existing Code** (`src/services/trading/PositionCloser.ts`):
```typescript
// 平倉後會呼叫 ConditionalOrderAdapterFactory 取消條件單
const adapter = ConditionalOrderAdapterFactory.createAdapter(exchange, apiKey);
await adapter.cancelConditionalOrders(position);
```

---

## Implementation Recommendations

### Phase 1: Backend (Prisma + API)

1. **Schema Migration**:
   ```prisma
   model Position {
     // 新增欄位
     groupId String? @db.Uuid  // 分單開倉組別 ID

     @@index([groupId])  // 加速查詢
   }
   ```

2. **PositionOrchestrator 修改**:
   - 新增 `groupId` 參數支援
   - 分單開倉時分配相同 groupId

3. **PositionCloser 擴展**:
   - 新增 `closeBatchPositions(groupId)` 方法
   - 串行執行，支援進度回報

4. **API 路由**:
   - `GET /api/positions` - 回傳 groupId，前端分組
   - `POST /api/positions/group/:groupId/close` - 批量平倉

### Phase 2: Frontend (React + UI)

1. **新增元件**:
   - `PositionGroupCard.tsx` - 組合持倉卡片
   - `PositionGroupExpanded.tsx` - 展開的持倉列表
   - `BatchCloseDialog.tsx` - 批量平倉對話框

2. **修改 hooks**:
   - `usePositions.ts` - 加入分組邏輯
   - `useBatchClose.ts` - 批量平倉狀態管理

### Phase 3: Testing

1. **Unit Tests**:
   - `PositionGroupService.test.ts` - 聚合計算
   - `position-group.test.ts` - 工具函數

2. **Integration Tests**:
   - `batch-close.test.ts` - 批量平倉流程

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| 批量平倉 API rate limit | Low | Medium | 串行執行 + 延遲間隔 |
| 部分平倉失敗 | Medium | Low | 繼續處理剩餘，回報結果 |
| 前端效能（大量持倉） | Low | Low | 虛擬列表或分頁 |
| Migration 失敗 | Low | High | 使用 IF EXISTS 確保冪等 |

---

## References

- Prisma Schema: `prisma/schema.prisma:206-272`
- PositionCloser: `src/services/trading/PositionCloser.ts`
- PositionOrchestrator: `src/services/trading/PositionOrchestrator.ts`
- Position Components: `app/(dashboard)/positions/components/`
