# Data Model: 手動標記持倉已平倉

**Feature**: 037-mark-position-closed
**Date**: 2025-12-19

## 現有模型更新

### Position (持倉)

此功能使用現有 Position 模型，無需新增欄位。

**相關欄位**:

| 欄位 | 類型 | 說明 |
|------|------|------|
| id | String | 主鍵 (cuid) |
| userId | String | 用戶 ID (外鍵) |
| status | PositionWebStatus | 持倉狀態 |
| closedAt | DateTime? | 平倉時間 |
| updatedAt | DateTime | 更新時間 (自動) |

**狀態轉換規則**:

```
允許的轉換 (手動標記):
- OPEN → CLOSED
- PARTIAL → CLOSED
- FAILED → CLOSED

禁止的轉換:
- PENDING → CLOSED (尚未開倉)
- OPENING → CLOSED (正在開倉中)
- CLOSING → CLOSED (正在系統平倉中)
- CLOSED → CLOSED (已經平倉)
```

### PositionWebStatus (枚舉)

現有枚舉，無需修改：

```prisma
enum PositionWebStatus {
  PENDING   // 待開倉
  OPENING   // 開倉中
  OPEN      // 持倉中
  CLOSING   // 平倉中
  CLOSED    // 已平倉
  FAILED    // 失敗
  PARTIAL   // 部分成功，需手動處理
}
```

## Schema 變更

**無 schema 變更** - 此功能僅使用現有欄位。
