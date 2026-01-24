# Research: 平台管理後臺

**Feature**: 068-admin-dashboard
**Date**: 2026-01-23

## 1. 現有架構分析

### 1.1 認證系統

**現有實作位置**：
- `src/lib/jwt.ts` - JWT Token 生成與驗證
- `src/middleware/authMiddleware.ts` - 認證中介軟體
- `src/services/auth/AuthService.ts` - 用戶認證服務
- `src/services/auth/SessionManager.ts` - Session 管理

**關鍵發現**：
- JWT Payload 包含 `userId`, `email`, `tokenVersion`
- 使用 Cookie + Bearer Token 雙重支援
- `tokenVersion` 機制用於密碼變更後使舊 session 失效
- `withAuth()` 高階函數可用於保護 API Routes

**擴展方向**：
- JWT Payload 新增 `role` 欄位
- 建立 `withAdminAuth()` 中介軟體驗證 admin 角色
- Admin 登入獨立路由，避免與一般用戶混淆

### 1.2 User 模型

**現有欄位** (`prisma/schema.prisma:113-143`)：
```prisma
model User {
  id                  String    @id @default(cuid())
  email               String    @unique
  password            String    // bcrypt hashed
  timeBasisPreference Int       @default(8)
  tokenVersion        Int       @default(0)
  failedLoginAttempts Int       @default(0)
  lockedUntil         DateTime?
  passwordChangedAt   DateTime?
  // ... relations
}
```

**需要新增**：
- `role` - 角色欄位 (enum: USER | ADMIN)
- `isActive` - 帳戶啟用狀態 (Boolean, default: true)

**Migration 考量**：
- 現有用戶預設 `role = USER`
- 現有用戶預設 `isActive = true`
- 管理員帳戶透過 seed script 或直接 DB 建立

### 1.3 審計日誌系統

**現有實作位置**：
- `src/services/trading/AuditLogger.ts` - 交易審計
- `src/repositories/AuditLogRepository.ts` - 審計日誌 Repository

**現有 Action 類型**：
- `LOGIN`, `LOGOUT`
- `APIKEY_ADD`, `APIKEY_DELETE`, `APIKEY_STATUS_CHANGE`
- `POSITION_OPEN_*`, `POSITION_CLOSE_*`
- `SUSPICIOUS_ACTIVITY`

**需要新增的 Admin Actions**：
- `ADMIN_USER_CREATE` - 管理員建立用戶
- `ADMIN_USER_UPDATE` - 管理員更新用戶
- `ADMIN_USER_SUSPEND` - 管理員停用用戶
- `ADMIN_USER_ENABLE` - 管理員啟用用戶
- `ADMIN_USER_DELETE` - 管理員刪除用戶
- `ADMIN_USER_RESET_PASSWORD` - 管理員重設密碼

### 1.4 現有資料模型

**Position 模型** - 已有開倉時資金費率：
```prisma
openFundingRateLong   Decimal  @db.Decimal(10, 8)
openFundingRateShort  Decimal  @db.Decimal(10, 8)
```

**Trade 模型** - 完整損益資訊：
```prisma
priceDiffPnL    Decimal  // 幣價損益
fundingRatePnL  Decimal  // 資金費率損益
totalPnL        Decimal  // 總損益
roi             Decimal  // ROI
holdingDuration Int      // 持倉時長（秒）
```

## 2. 技術決策

### 2.1 Admin 路由架構

**選擇**：Next.js 15 Route Groups

```
app/
├── (admin)/
│   ├── admin/           # /admin/*
│   └── admin-login/     # /admin-login
└── (dashboard)/         # 現有用戶路由
```

**理由**：
- 路由群組不影響 URL 結構
- 可獨立設定 layout、middleware
- 避免與現有路由衝突

### 2.2 權限驗證策略

**選擇**：JWT Payload 擴展 + 中介軟體

```typescript
// JwtPayload 擴展
interface JwtPayload {
  userId: string;
  email: string;
  tokenVersion: number;
  role: 'USER' | 'ADMIN';  // 新增
}

// Admin 中介軟體
export async function withAdminAuth(
  handler: (request: NextRequest, user: JwtPayload) => Promise<NextResponse>,
) {
  return async (request: NextRequest) => {
    const user = await authenticate(request);
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return handler(request, user);
  };
}
```

**理由**：
- 複用現有 JWT 機制
- 最小化程式碼變更
- 權限檢查在 API 層統一處理

### 2.3 Session 即時失效

**機制**：`tokenVersion` 遞增

當管理員停用或刪除用戶時：
1. 遞增用戶的 `tokenVersion`
2. 該用戶的所有現有 JWT 即時失效
3. 下次 API 請求時驗證失敗，強制登出

**已有實作**：`src/middleware/authMiddleware.ts:56-69`

### 2.4 儀表板統計查詢

**效能考量**：
- 使用 `COUNT(*)` 而非載入全部資料
- 日期範圍查詢使用索引
- 考慮快取熱門統計數據

**現有索引** (`prisma/schema.prisma`)：
- `positions`: `@@index([userId, status])`, `@@index([createdAt(sort: Desc)])`
- `trades`: `@@index([userId, createdAt(sort: Desc)])`, `@@index([createdAt(sort: Desc)])`
- `users`: `@@index([email])`

**可能需要新增索引**：
- `users`: `@@index([isActive])` - 用於篩選啟用/停用用戶

## 3. 安全考量

### 3.1 停用用戶與活躍持倉

**風險**：停用有活躍持倉的用戶可能導致無法平倉

**解決方案**：
1. 停用前檢查是否有 `status = OPEN` 的持倉
2. 有活躍持倉時顯示警告，要求管理員確認
3. 審計日誌記錄警告被確認的情況

### 3.2 刪除用戶與資料完整性

**風險**：刪除用戶可能導致交易記錄孤立

**解決方案**：
1. 禁止刪除有活躍持倉的用戶
2. 使用 `onDelete: Cascade` 自動清理關聯資料（已設定）
3. 或考慮「軟刪除」模式（設定 `deletedAt` 而非實際刪除）

**建議**：先實作硬刪除（符合 spec），未來可考慮軟刪除

### 3.3 管理員帳戶保護

**策略**：
- 管理員無法停用/刪除自己
- 管理員無法降級自己的角色
- 審計日誌記錄所有管理員操作

## 4. API 設計

### 4.1 儀表板 API

```
GET /api/admin/dashboard
Response: {
  users: {
    total: number,
    active: number,
    inactive: number,
    todayNew: number,
    weekActive: number,
    monthActive: number
  },
  positions: {
    activeCount: number,
    byExchange: { [exchange: string]: number }
  },
  trades: {
    closedCount: number,
    totalPnL: string,
    averageROI: string,
    todayCount: number,
    todayPnL: string
  }
}
```

### 4.2 用戶管理 API

```
GET    /api/admin/users              # 列表（分頁、搜尋、篩選）
POST   /api/admin/users              # 新增
GET    /api/admin/users/:id          # 詳情
PATCH  /api/admin/users/:id          # 更新
DELETE /api/admin/users/:id          # 刪除
POST   /api/admin/users/:id/suspend  # 停用
POST   /api/admin/users/:id/enable   # 啟用
POST   /api/admin/users/:id/reset-password  # 重設密碼
GET    /api/admin/users/:id/trades   # 用戶交易記錄
```

### 4.3 交易列表 API

```
GET /api/admin/trades               # 平台所有交易
GET /api/admin/trades/export        # 匯出 CSV
```

## 5. 風險與緩解

| 風險 | 影響 | 緩解措施 |
|------|------|----------|
| Session 即時失效未生效 | 停用用戶仍可操作 | 使用現有 tokenVersion 機制，經過測試驗證 |
| 儀表板查詢過慢 | 用戶體驗差 | 使用 COUNT，必要時加快取 |
| 管理員誤刪用戶 | 資料損失 | 二次確認、禁止刪除有持倉用戶 |
| 並發停用導致競態條件 | 資料不一致 | 使用資料庫事務 |

## 6. 相依性

### 6.1 現有模組相依

- `src/lib/jwt.ts` - 需擴展 JwtPayload
- `src/middleware/authMiddleware.ts` - 需新增 admin 驗證
- `src/repositories/AuditLogRepository.ts` - 需新增 admin actions
- `prisma/schema.prisma` - 需擴展 User 模型

### 6.2 不影響現有功能

- 現有用戶登入流程不變（role = USER）
- 現有 API 權限驗證不變
- 現有交易功能不變

## 7. 結論

此功能可以安全地實作，主要是擴展現有系統而非重建：

1. **User 模型擴展**：新增 `role` 和 `isActive` 欄位，配合 Migration
2. **認證擴展**：JWT Payload 新增 role，建立 admin 中介軟體
3. **新增服務層**：AdminUserService, AdminDashboardService, AdminTradeService
4. **新增 API 路由**：`/api/admin/*` 系列
5. **新增前端頁面**：`/admin/*` 系列

預估工作量集中在前端 UI 實作和測試編寫。
