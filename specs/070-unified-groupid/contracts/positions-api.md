# API Contract: Positions API Changes

**Feature**: 070-unified-groupid
**Date**: 2026-01-30

## GET /api/positions

### Query Parameters

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| grouped | boolean | 否 | 是否以 group 格式回傳（預設 false） |
| status | string | 否 | 狀態過濾（逗號分隔） |
| limit | number | 否 | 回傳數量上限（預設 50） |
| offset | number | 否 | 分頁偏移（預設 0） |

### Response Format (grouped=true)

**變更前**:
```typescript
interface GroupedPositionsResponse {
  positions: PositionInfo[];  // 無 groupId 的持倉
  groups: PositionGroup[];    // 有 groupId 的持倉組
  total: number;
}
```

**變更後**:
```typescript
interface GroupedPositionsResponse {
  groups: PositionGroup[];    // 所有持倉（每個 group 包含 1+ 個持倉）
  total: number;
}
```

### PositionGroup Structure

```typescript
interface PositionGroup {
  groupId: string;           // UUID, 必填
  symbol: string;
  longExchange: string;
  shortExchange: string;
  positions: PositionInfo[];  // 該 group 的持倉列表
  aggregate: {
    totalQuantity: string;
    avgLongEntryPrice: string;
    avgShortEntryPrice: string;
    totalFundingPnL: string | null;
    totalUnrealizedPnL: string | null;
    positionCount: number;    // 可能為 1（單獨開倉）
    firstOpenedAt: string | null;
    stopLossPercent: string | null;
    takeProfitPercent: string | null;
  };
}
```

### PositionInfo Structure

```typescript
interface PositionInfo {
  id: string;
  userId: string;
  symbol: string;
  longExchange: string;
  shortExchange: string;
  leverage: number;
  status: PositionStatus;
  createdAt: string;
  updatedAt: string;
  groupId: string;           // 變更：從 string | null 改為 string（必填）
  // ... 其他欄位不變
}
```

### Example Response

```json
{
  "success": true,
  "data": {
    "groups": [
      {
        "groupId": "550e8400-e29b-41d4-a716-446655440000",
        "symbol": "BTCUSDT",
        "longExchange": "binance",
        "shortExchange": "okx",
        "positions": [
          {
            "id": "pos-1",
            "groupId": "550e8400-e29b-41d4-a716-446655440000",
            "status": "OPEN"
          }
        ],
        "aggregate": {
          "positionCount": 1,
          "totalQuantity": "0.1"
        }
      },
      {
        "groupId": "660e8400-e29b-41d4-a716-446655440001",
        "symbol": "ETHUSDT",
        "longExchange": "binance",
        "shortExchange": "okx",
        "positions": [
          { "id": "pos-2", "groupId": "660e8400-e29b-41d4-a716-446655440001" },
          { "id": "pos-3", "groupId": "660e8400-e29b-41d4-a716-446655440001" }
        ],
        "aggregate": {
          "positionCount": 2,
          "totalQuantity": "0.5"
        }
      }
    ],
    "total": 3
  }
}
```

---

## POST /api/positions/open

### Request Body

無變更。開倉請求不需要指定 groupId：
- 分單開倉：系統自動生成 groupId 供所有子持倉共用
- 單獨開倉：系統自動生成獨立的 groupId

### Response

```typescript
interface OpenPositionResponse {
  success: boolean;
  data: {
    positionId: string;
    groupId: string;        // 必填，不再可能為 null
    status: PositionStatus;
  };
}
```

---

## Breaking Changes Summary

| 項目 | 變更前 | 變更後 | 影響 |
|------|--------|--------|------|
| `GroupedPositionsResponse.positions` | 存在 | 移除 | 前端需更新 |
| `PositionInfo.groupId` | `string \| null` | `string` | TypeScript 類型更新 |
| `PositionGroup.aggregate.positionCount` | >= 2 | >= 1 | 可能為單一持倉 |
