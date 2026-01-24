# Data Model: 平台管理後臺

**Feature**: 068-admin-dashboard
**Date**: 2026-01-23

## 1. Schema 變更

### 1.1 User 模型擴展

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique @db.VarChar(255)
  password  String   @db.VarChar(255)

  // === 新增欄位 (Feature 068) ===
  role      UserRole @default(USER)      // 用戶角色
  isActive  Boolean  @default(true)      // 帳戶啟用狀態

  // === 現有欄位 ===
  createdAt DateTime @default(now()) @db.Timestamptz
  updatedAt DateTime @updatedAt @db.Timestamptz
  timeBasisPreference Int @default(8)
  tokenVersion        Int       @default(0)
  failedLoginAttempts Int       @default(0)
  lockedUntil         DateTime? @db.Timestamptz
  passwordChangedAt   DateTime? @db.Timestamptz

  // Relations (保持不變)
  apiKeys                 ApiKey[]
  positions               Position[]
  trades                  Trade[]
  auditLogs               AuditLog[]
  notificationWebhooks    NotificationWebhook[]
  opportunityEndHistories OpportunityEndHistory[]
  simulatedTrackings      SimulatedTracking[]
  assetSnapshots          AssetSnapshot[]
  tradingSettings         TradingSettings?
  passwordResetTokens     PasswordResetToken[]

  @@index([email])
  @@index([isActive])  // 新增索引
  @@map("users")
}

enum UserRole {
  USER   // 一般用戶
  ADMIN  // 管理員

  @@map("user_role")
}
```

### 1.2 Migration 檔案

```sql
-- Migration: add_admin_fields
-- Description: 新增用戶角色和啟用狀態欄位 (Feature 068)

-- 建立 enum
CREATE TYPE "user_role" AS ENUM ('USER', 'ADMIN');

-- 新增欄位
ALTER TABLE "users" ADD COLUMN "role" "user_role" NOT NULL DEFAULT 'USER';
ALTER TABLE "users" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- 建立索引
CREATE INDEX "users_isActive_idx" ON "users"("isActive");
```

## 2. 資料類型定義

### 2.1 JWT Payload 擴展

```typescript
// src/lib/jwt.ts
export interface JwtPayload {
  userId: string;
  email: string;
  tokenVersion: number;
  role: UserRole;  // 新增
}
```

### 2.2 Admin Dashboard 統計

```typescript
// src/types/admin.ts
export interface DashboardStats {
  users: UserStats;
  positions: PositionStats;
  trades: TradeStats;
}

export interface UserStats {
  total: number;
  active: number;
  inactive: number;
  todayNew: number;
  weekActive: number;   // 過去 7 天有登入的用戶數
  monthActive: number;  // 過去 30 天有登入的用戶數
}

export interface PositionStats {
  activeCount: number;
  byExchange: Record<string, number>;  // { binance: 10, okx: 5, ... }
}

export interface TradeStats {
  closedCount: number;
  totalPnL: string;      // Decimal string
  averageROI: string;    // Decimal string (%)
  todayCount: number;
  todayPnL: string;      // Decimal string
}
```

### 2.3 用戶列表與詳情

```typescript
// src/types/admin.ts
export interface AdminUserListItem {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  lastLoginAt?: Date;      // 從 AuditLog 查詢
  positionCount: number;   // 活躍持倉數
  tradeCount: number;      // 總交易數
}

export interface AdminUserDetail extends AdminUserListItem {
  failedLoginAttempts: number;
  lockedUntil?: Date;
  passwordChangedAt?: Date;
  timeBasisPreference: number;
  apiKeyCount: number;
  totalPnL: string;        // 總損益
}

export interface AdminUserListQuery {
  page?: number;           // 預設 1
  limit?: number;          // 預設 20
  search?: string;         // email 搜尋
  status?: 'all' | 'active' | 'inactive';
  sortBy?: 'createdAt' | 'email';
  sortOrder?: 'asc' | 'desc';
}

export interface AdminUserListResponse {
  items: AdminUserListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
```

### 2.4 用戶管理操作

```typescript
// src/types/admin.ts
export interface CreateUserRequest {
  email: string;
  role?: UserRole;  // 預設 USER
}

export interface CreateUserResponse {
  user: AdminUserListItem;
  initialPassword: string;  // 自動產生的初始密碼
}

export interface UpdateUserRequest {
  email?: string;
}

export interface ResetPasswordResponse {
  newPassword: string;  // 自動產生的新密碼
}

export interface SuspendUserRequest {
  confirm: boolean;       // 必須明確確認
  hasActivePositions?: boolean;  // 後端會驗證，前端可預先提示
}
```

### 2.5 交易列表

```typescript
// src/types/admin.ts
export interface AdminTradeListItem {
  id: string;
  userId: string;
  userEmail: string;
  symbol: string;
  longExchange: string;
  shortExchange: string;
  openedAt: Date;
  closedAt: Date;
  holdingDuration: number;  // seconds
  priceDiffPnL: string;
  fundingRatePnL: string;
  totalPnL: string;
  roi: string;
  status: TradeWebStatus;
}

export interface AdminTradeListQuery {
  page?: number;
  limit?: number;
  userId?: string;
  symbol?: string;
  startDate?: Date;
  endDate?: Date;
  sortBy?: 'closedAt' | 'totalPnL';
  sortOrder?: 'asc' | 'desc';
}

export interface AdminTradeListResponse {
  items: AdminTradeListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
```

### 2.6 持倉詳情（含開倉資金費率）

```typescript
// src/types/admin.ts
export interface AdminPositionDetail {
  id: string;
  userId: string;
  userEmail: string;
  symbol: string;
  status: PositionWebStatus;

  // 開倉資訊
  longExchange: string;
  longEntryPrice: string;
  longPositionSize: string;
  longLeverage: number;
  shortExchange: string;
  shortEntryPrice: string;
  shortPositionSize: string;
  shortLeverage: number;

  // 開倉時資金費率 (spec 明確要求)
  openFundingRateLong: string;
  openFundingRateShort: string;

  // 停損停利
  stopLossEnabled: boolean;
  stopLossPercent?: string;
  takeProfitEnabled: boolean;
  takeProfitPercent?: string;

  // 時間
  openedAt?: Date;
  closedAt?: Date;
  createdAt: Date;

  // 平倉資訊（如果已平倉）
  trade?: {
    longExitPrice: string;
    shortExitPrice: string;
    priceDiffPnL: string;
    fundingRatePnL: string;
    totalPnL: string;
    roi: string;
    holdingDuration: number;
  };
}
```

## 3. 審計日誌擴展

### 3.1 新增 Action 類型

```typescript
// src/types/trading.ts (擴展)
export type AdminAuditAction =
  | 'ADMIN_USER_CREATE'
  | 'ADMIN_USER_UPDATE'
  | 'ADMIN_USER_SUSPEND'
  | 'ADMIN_USER_ENABLE'
  | 'ADMIN_USER_DELETE'
  | 'ADMIN_USER_RESET_PASSWORD'
  | 'ADMIN_TRADE_EXPORT';

export type AuditAction =
  | ... // 現有的
  | AdminAuditAction;
```

### 3.2 審計日誌 Details 結構

```typescript
// Admin 操作的 details 欄位結構
interface AdminUserCreateDetails {
  targetUserId: string;
  targetEmail: string;
  role: UserRole;
}

interface AdminUserUpdateDetails {
  targetUserId: string;
  changes: {
    email?: { from: string; to: string };
  };
}

interface AdminUserSuspendDetails {
  targetUserId: string;
  targetEmail: string;
  hadActivePositions: boolean;
  confirmedWithWarning: boolean;
}

interface AdminUserDeleteDetails {
  targetUserId: string;
  targetEmail: string;
  relatedDataDeleted: {
    positions: number;
    trades: number;
    apiKeys: number;
  };
}

interface AdminUserResetPasswordDetails {
  targetUserId: string;
  targetEmail: string;
}

interface AdminTradeExportDetails {
  filters: AdminTradeListQuery;
  exportedCount: number;
}
```

## 4. 關聯圖

```
                    ┌─────────────────┐
                    │      User       │
                    │─────────────────│
                    │ id              │
                    │ email           │
                    │ role ◄──────────┼── 新增 (USER|ADMIN)
                    │ isActive ◄──────┼── 新增 (Boolean)
                    │ tokenVersion    │
                    │ ...             │
                    └────────┬────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
          ▼                  ▼                  ▼
    ┌──────────┐      ┌──────────┐      ┌──────────┐
    │ Position │      │  Trade   │      │ AuditLog │
    │──────────│      │──────────│      │──────────│
    │ userId   │      │ userId   │      │ userId   │
    │ symbol   │      │ totalPnL │      │ action   │ ◄── 新增 ADMIN_* actions
    │ status   │      │ roi      │      │ details  │
    │ open-    │      │ ...      │      │ ...      │
    │ Funding- │      └──────────┘      └──────────┘
    │ RateLong │
    │ open-    │
    │ Funding- │
    │ RateShort│
    └──────────┘
```

## 5. 驗證規則

### 5.1 新增用戶

| 欄位 | 規則 |
|------|------|
| email | 必填、有效 email 格式、唯一 |
| role | 可選、預設 USER |

### 5.2 更新用戶

| 欄位 | 規則 |
|------|------|
| email | 有效 email 格式、唯一（排除自己） |

### 5.3 停用用戶

| 條件 | 處理 |
|------|------|
| 有活躍持倉 | 回傳警告訊息，要求確認 |
| 無活躍持倉 | 直接停用 |
| 停用自己 | 禁止 |

### 5.4 刪除用戶

| 條件 | 處理 |
|------|------|
| 有活躍持倉 | 禁止刪除 |
| 無活躍持倉 | 允許刪除，連帶刪除關聯資料 |
| 刪除自己 | 禁止 |

## 6. 索引策略

### 6.1 現有索引（足夠使用）

- `users`: `@@index([email])`
- `positions`: `@@index([userId, status])`
- `trades`: `@@index([userId, createdAt(sort: Desc)])`
- `audit_logs`: `@@index([userId, createdAt(sort: Desc)])`

### 6.2 新增索引

- `users`: `@@index([isActive])` - 用於篩選啟用/停用用戶列表
