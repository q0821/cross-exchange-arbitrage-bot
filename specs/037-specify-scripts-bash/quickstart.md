# Quickstart: 手動標記持倉已平倉

## 功能說明

此功能讓用戶能夠手動將已在交易所平倉的持倉標記為「已平倉」狀態。

## 使用方式

### 透過 UI

1. 前往「持倉管理」頁面 (`/positions`)
2. 找到需要標記的持倉卡片
3. 點擊「標記已平倉」按鈕
4. 持倉將從活躍列表中移除

### 透過 API

```bash
# 標記持倉為已平倉
curl -X PATCH http://localhost:3000/api/positions/{positionId} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{"action": "markAsClosed"}'
```

**成功回應**:
```json
{
  "success": true,
  "data": {
    "id": "clxxxxxxxxxxxxx",
    "status": "CLOSED",
    "closedAt": "2025-12-19T12:00:00.000Z"
  }
}
```

## 狀態限制

只有以下狀態的持倉可以手動標記為已平倉：

| 狀態 | 可標記 | 說明 |
|------|--------|------|
| OPEN | 是 | 持倉中 |
| PARTIAL | 是 | 部分成功，需手動處理 |
| FAILED | 是 | 開倉失敗 |
| PENDING | 否 | 尚未開始開倉 |
| OPENING | 否 | 正在開倉中 |
| CLOSING | 否 | 正在系統平倉中 |
| CLOSED | 否 | 已經是已平倉狀態 |

## 相關檔案

- API: `app/api/positions/[id]/route.ts`
- UI: `app/(dashboard)/positions/components/PositionCard.tsx`
- 頁面: `app/(dashboard)/positions/page.tsx`
