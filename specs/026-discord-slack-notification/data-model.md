# Data Model: Discord/Slack 套利機會即時推送通知

## Prisma Schema

### NotificationWebhook 模型

```prisma
// ===== 通知 Webhook 設定 (Feature 026) =====
model NotificationWebhook {
  id        String   @id @default(cuid())
  userId    String
  platform  String   @db.VarChar(20)  // 'discord' | 'slack'
  webhookUrl String  @db.Text         // 加密儲存
  name      String   @db.VarChar(100) // 用戶自訂名稱
  isEnabled Boolean  @default(true)
  threshold Decimal  @default(800) @db.Decimal(10, 4) // 年化收益閾值 %
  createdAt DateTime @default(now()) @db.Timestamptz
  updatedAt DateTime @updatedAt @db.Timestamptz

  // Relations
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, isEnabled])
  @@index([platform])
  @@map("notification_webhooks")
}
```

### User 模型更新

```prisma
model User {
  // ... existing fields ...

  // 新增關聯
  notificationWebhooks NotificationWebhook[]
}
```

## 欄位說明

| 欄位 | 類型 | 說明 |
|------|------|------|
| id | String (cuid) | 唯一識別碼 |
| userId | String | 關聯用戶 ID |
| platform | String | 通知平台: 'discord' 或 'slack' |
| webhookUrl | Text | Webhook URL（加密儲存） |
| name | String | 用戶自訂名稱（如「我的 Discord 伺服器」） |
| isEnabled | Boolean | 是否啟用 |
| threshold | Decimal | 觸發閾值（年化收益百分比），預設 800% |
| createdAt | DateTime | 建立時間 |
| updatedAt | DateTime | 更新時間 |

## 索引設計

- `[userId, isEnabled]`: 快速查詢用戶啟用的 Webhooks
- `[platform]`: 按平台類型統計

## 驗證規則

| 欄位 | 驗證規則 |
|------|----------|
| platform | 必須是 'discord' 或 'slack' |
| webhookUrl | 必須是有效 URL，Discord 格式: `https://discord.com/api/webhooks/*`，Slack 格式: `https://hooks.slack.com/services/*` |
| name | 長度 1-100 字元 |
| threshold | 範圍 0-10000（百分比） |

## 安全考量

### Webhook URL 加密

使用與 API Key 相同的加密方式：

```typescript
// 加密儲存
import { encrypt, decrypt } from '../lib/crypto';

// 儲存時加密
const encryptedUrl = encrypt(webhookUrl);

// 讀取時解密（僅在發送通知時）
const decryptedUrl = decrypt(webhook.webhookUrl);
```

## 資料範例

```json
{
  "id": "clx1234567890",
  "userId": "user_abc123",
  "platform": "discord",
  "webhookUrl": "encrypted:...",
  "name": "我的套利通知頻道",
  "isEnabled": true,
  "threshold": 800.0000,
  "createdAt": "2025-11-29T10:00:00.000Z",
  "updatedAt": "2025-11-29T10:00:00.000Z"
}
```

## 狀態轉換

```
建立 → 啟用中
     ↓
   停用中
     ↓
   啟用中
     ↓
   刪除
```

## 與現有模型的關係

```
User (1) ──── (*) NotificationWebhook
```

- 一個用戶可以有多個 Webhook 設定
- 刪除用戶時，級聯刪除所有 Webhook 設定
