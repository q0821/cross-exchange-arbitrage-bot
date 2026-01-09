# Data Model: 用戶密碼管理

**Feature**: 061-password-management
**Date**: 2026-01-09

## Entity Relationship Diagram

```
┌─────────────────────────────────────┐
│              User                    │
├─────────────────────────────────────┤
│ id: String (PK)                     │
│ email: String (UNIQUE)              │
│ password: String                    │
│ + tokenVersion: Int = 0             │ ← NEW
│ + failedLoginAttempts: Int = 0      │ ← NEW
│ + lockedUntil: DateTime?            │ ← NEW
│ + passwordChangedAt: DateTime?      │ ← NEW
│ createdAt: DateTime                 │
│ updatedAt: DateTime                 │
└──────────────┬──────────────────────┘
               │ 1:N
               ▼
┌─────────────────────────────────────┐
│       PasswordResetToken             │ ← NEW MODEL
├─────────────────────────────────────┤
│ id: String (PK)                     │
│ userId: String (FK → User)          │
│ tokenHash: String                   │
│ expiresAt: DateTime                 │
│ usedAt: DateTime?                   │
│ createdAt: DateTime                 │
│ ipAddress: String?                  │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│           AuditLog                   │ (EXISTING)
├─────────────────────────────────────┤
│ id: String (PK)                     │
│ userId: String? (FK → User)         │
│ action: String                      │
│   + "PASSWORD_CHANGE"               │ ← NEW ACTION
│   + "PASSWORD_RESET_REQUEST"        │ ← NEW ACTION
│   + "PASSWORD_RESET_COMPLETE"       │ ← NEW ACTION
│   + "LOGIN_FAILED"                  │ ← NEW ACTION
│   + "ACCOUNT_LOCKED"                │ ← NEW ACTION
│   + "ACCOUNT_UNLOCKED"              │ ← NEW ACTION
│ resource: String?                   │
│ details: Json?                      │
│ ipAddress: String?                  │
│ createdAt: DateTime                 │
└─────────────────────────────────────┘
```

## Prisma Schema Changes

### User Model (Modified)

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique @db.VarChar(255)
  password  String   @db.VarChar(255) // bcrypt hashed

  // 用戶偏好設定
  timeBasisPreference Int @default(8)

  // ===== 密碼管理 (Feature 061) =====
  tokenVersion        Int       @default(0)                // JWT 版本號，密碼變更時遞增
  failedLoginAttempts Int       @default(0)                // 連續登入失敗次數
  lockedUntil         DateTime? @db.Timestamptz            // 帳戶鎖定截止時間
  passwordChangedAt   DateTime? @db.Timestamptz            // 最後密碼變更時間

  createdAt DateTime @default(now()) @db.Timestamptz
  updatedAt DateTime @updatedAt @db.Timestamptz

  // Relations
  apiKeys                 ApiKey[]
  positions               Position[]
  trades                  Trade[]
  auditLogs               AuditLog[]
  notificationWebhooks    NotificationWebhook[]
  opportunityEndHistories OpportunityEndHistory[]
  simulatedTrackings      SimulatedTracking[]
  assetSnapshots          AssetSnapshot[]
  tradingSettings         TradingSettings?
  passwordResetTokens     PasswordResetToken[]        // NEW

  @@index([email])
  @@map("users")
}
```

### PasswordResetToken Model (New)

```prisma
// ===== 密碼重設 Token (Feature 061) =====
model PasswordResetToken {
  id        String    @id @default(cuid())
  userId    String
  tokenHash String    @db.VarChar(255)              // bcrypt hashed token
  expiresAt DateTime  @db.Timestamptz               // 過期時間（建立後 1 小時）
  usedAt    DateTime? @db.Timestamptz               // 使用時間（null = 未使用）
  ipAddress String?   @db.VarChar(45)               // 請求 IP
  createdAt DateTime  @default(now()) @db.Timestamptz

  // Relations
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt(sort: Desc)])
  @@index([expiresAt])
  @@map("password_reset_tokens")
}
```

## Field Specifications

### User Model - New Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| tokenVersion | Int | default: 0 | JWT 驗證版本號，每次密碼變更時遞增 |
| failedLoginAttempts | Int | default: 0, min: 0 | 連續登入失敗次數，成功登入後重置為 0 |
| lockedUntil | DateTime? | nullable | 帳戶鎖定截止時間，null 表示未鎖定 |
| passwordChangedAt | DateTime? | nullable | 最後密碼變更時間，用於審計 |

### PasswordResetToken Model

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | String | PK, cuid | 唯一識別碼 |
| userId | String | FK → User | 關聯用戶 |
| tokenHash | String | max: 255 | bcrypt 雜湊後的 token |
| expiresAt | DateTime | required | 過期時間（建立後 1 小時） |
| usedAt | DateTime? | nullable | 使用時間，null 表示未使用 |
| ipAddress | String? | max: 45 | 請求來源 IP（支援 IPv6） |
| createdAt | DateTime | default: now() | 建立時間 |

## Validation Rules

### Password

- 最小長度：8 字元
- 必須包含：大寫字母、小寫字母、數字
- 最大長度：128 字元（防止 bcrypt DoS）

### PasswordResetToken

- tokenHash：64 字元 hex 字串（crypto.randomBytes(32)）
- expiresAt：必須 > createdAt
- 同一用戶同時只能有一個有效（未使用、未過期）的 token

## State Transitions

### Account Lock State

```
UNLOCKED ──[5 failed attempts]──► LOCKED
    ▲                                │
    │                                │
    └────[15 minutes elapsed]────────┘

    └────[password reset]────────────┘
```

### Password Reset Token State

```
CREATED ──[user clicks link]──► USED
    │
    └──[1 hour elapsed]──► EXPIRED
```

## Indexes

### User Model

- `email` (existing) - 登入查詢
- No additional indexes needed for new fields

### PasswordResetToken Model

- `(userId, createdAt DESC)` - 查詢用戶最新 token
- `expiresAt` - 清理過期 token

## Migration Notes

### Migration: add_password_management

```sql
-- Add new fields to User
ALTER TABLE users ADD COLUMN token_version INT DEFAULT 0;
ALTER TABLE users ADD COLUMN failed_login_attempts INT DEFAULT 0;
ALTER TABLE users ADD COLUMN locked_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN password_changed_at TIMESTAMPTZ;

-- Create PasswordResetToken table
CREATE TABLE password_reset_tokens (
  id VARCHAR(30) PRIMARY KEY,
  user_id VARCHAR(30) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_password_reset_tokens_user_created
  ON password_reset_tokens(user_id, created_at DESC);
CREATE INDEX idx_password_reset_tokens_expires
  ON password_reset_tokens(expires_at);
```

## Audit Log Actions

| Action | Trigger | Details JSON |
|--------|---------|--------------|
| PASSWORD_CHANGE | 用戶變更密碼 | `{ method: 'change' }` |
| PASSWORD_RESET_REQUEST | 請求密碼重設 | `{ email: string }` |
| PASSWORD_RESET_COMPLETE | 完成密碼重設 | `{ tokenId: string }` |
| LOGIN_FAILED | 登入失敗 | `{ reason: 'invalid_password' \| 'account_locked' }` |
| ACCOUNT_LOCKED | 帳戶被鎖定 | `{ failedAttempts: 5, lockedUntil: DateTime }` |
| ACCOUNT_UNLOCKED | 帳戶解鎖 | `{ method: 'timeout' \| 'password_reset' }` |
