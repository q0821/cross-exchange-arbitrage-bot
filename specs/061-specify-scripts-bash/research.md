# Research: 用戶密碼管理

**Feature**: 061-password-management
**Date**: 2026-01-09

## Research Tasks

### 1. Email Service Selection

**Question**: 專案需要郵件發送功能，應選擇哪個郵件服務？

**Options Evaluated**:

| Option | Pros | Cons |
|--------|------|------|
| **Resend** | 現代 API、React Email 支援、免費額度 3000/月、TypeScript 原生 | 需要額外 API key、第三方依賴 |
| **Nodemailer** | 零依賴、支援任意 SMTP、成熟穩定 | 需自行設定 SMTP、模板功能較弱 |
| **SendGrid** | 企業級、高送達率 | 複雜定價、過度設計 |

**Decision**: Nodemailer + 環境變數 SMTP 配置

**Rationale**:
1. 專案已有 Telegram 通知機制，郵件只是補充
2. Nodemailer 支援任意 SMTP（Gmail、Mailgun、自建等）
3. 不需要額外的第三方 API key 管理
4. 使用者可根據自身需求配置 SMTP 服務
5. 未來可輕易切換到 Resend（只需替換 transport）

**Alternatives Rejected**:
- Resend：需要額外帳號和 API key，對單用戶系統過於複雜
- SendGrid：企業級定價不適合個人專案

---

### 2. Password Reset Token 安全性

**Question**: 密碼重設 token 應如何生成和儲存？

**Best Practices Researched**:
- Token 應使用 crypto.randomBytes(32) 生成（256 bits entropy）
- Token 應雜湊後儲存（防止資料庫洩漏時被利用）
- Token 應有過期時間（1 小時符合業界標準）
- Token 應為一次性使用

**Decision**: 使用 crypto.randomBytes + bcrypt 雜湊儲存

**Implementation**:
```typescript
// 生成 token（傳送給用戶）
const rawToken = crypto.randomBytes(32).toString('hex');

// 雜湊儲存（存入資料庫）
const hashedToken = await bcrypt.hash(rawToken, 10);

// 驗證時比對
const isValid = await bcrypt.compare(rawToken, hashedToken);
```

---

### 3. Session 失效策略

**Question**: 密碼變更後如何使其他 session 失效？

**Options Evaluated**:

| Option | Pros | Cons |
|--------|------|------|
| **JWT 黑名單（Redis）** | 即時失效、精確控制 | 需要 Redis、增加複雜度 |
| **JWT 版本號** | 簡單實作、無需 Redis | 需修改 User 模型 |
| **短效 JWT + Refresh Token** | 業界標準 | 需要重構現有認證 |

**Decision**: JWT 版本號（tokenVersion 欄位）

**Rationale**:
1. 專案已有 Redis（可選），但不強制依賴
2. 在 User 模型新增 `tokenVersion` 欄位
3. 密碼變更時遞增 tokenVersion
4. JWT 驗證時檢查 tokenVersion 是否匹配

**Implementation**:
```typescript
// User 模型新增
tokenVersion: number @default(0)

// 密碼變更後
await prisma.user.update({
  where: { id: userId },
  data: {
    password: newPasswordHash,
    tokenVersion: { increment: 1 }
  }
});

// JWT payload 包含 tokenVersion
{ userId, email, tokenVersion }

// 驗證時檢查
if (payload.tokenVersion !== user.tokenVersion) {
  throw new AuthError('Session invalidated');
}
```

---

### 4. 暴力破解保護實作

**Question**: 如何追蹤失敗嘗試並實作帳戶鎖定？

**Decision**: 在 User 模型新增追蹤欄位

**Implementation**:
```typescript
// User 模型新增
failedLoginAttempts: number @default(0)
lockedUntil: DateTime?

// 登入失敗時
if (failedLoginAttempts >= 5) {
  lockedUntil = now + 15 minutes
}

// 登入前檢查
if (lockedUntil && lockedUntil > now) {
  throw new AuthError('Account locked');
}

// 登入成功時重置
failedLoginAttempts = 0
lockedUntil = null
```

---

### 5. 密碼強度計算

**Question**: 如何計算密碼強度並提供即時回饋？

**Decision**: 前端即時驗證 + 後端最終驗證

**Strength Levels**:
- **弱**: 長度 < 8 或僅數字/字母
- **中**: 長度 >= 8，包含大小寫字母和數字
- **強**: 長度 >= 12，包含大小寫字母、數字和特殊符號

**Implementation**:
```typescript
function calculatePasswordStrength(password: string): 'weak' | 'medium' | 'strong' {
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  if (password.length >= 12 && hasLower && hasUpper && hasDigit && hasSpecial) {
    return 'strong';
  }
  if (password.length >= 8 && hasLower && hasUpper && hasDigit) {
    return 'medium';
  }
  return 'weak';
}
```

---

### 6. 郵件模板設計

**Question**: 郵件模板應包含哪些資訊？

**Decision**: 純文字 + HTML 雙版本

**Templates Required**:

1. **密碼重設郵件**
   - 主旨：「重設您的密碼」
   - 內容：重設連結、有效期限（1 小時）、安全提示

2. **帳戶鎖定通知**
   - 主旨：「您的帳戶已被暫時鎖定」
   - 內容：鎖定原因、解鎖時間、安全建議

---

## Summary

| Item | Decision |
|------|----------|
| Email Service | Nodemailer + SMTP 環境變數 |
| Token Security | crypto.randomBytes + bcrypt 雜湊 |
| Session Invalidation | JWT tokenVersion 欄位 |
| Brute Force Protection | User 模型追蹤欄位 |
| Password Strength | 前端即時 + 後端驗證 |
| Email Templates | 純文字 + HTML 雙版本 |

## Environment Variables (New)

```env
# Email Configuration (optional, if not set, email features disabled)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@your-domain.com
```
