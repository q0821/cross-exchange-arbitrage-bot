# Quickstart: 用戶密碼管理

**Feature**: 061-password-management
**Date**: 2026-01-09

## Prerequisites

- Node.js 20.x LTS
- PostgreSQL 15+ with TimescaleDB
- pnpm package manager
- SMTP 服務（可選，用於郵件發送）

## Environment Setup

### 1. 新增環境變數

在 `.env` 檔案中新增以下配置：

```env
# Email Configuration (optional)
# 如果未設定，郵件功能將被停用，但其他功能正常運作
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM="Arbitrage Platform" <noreply@your-domain.com>

# Password Reset Configuration
PASSWORD_RESET_EXPIRY_HOURS=1
PASSWORD_RESET_RATE_LIMIT_SECONDS=60

# Account Lockout Configuration
ACCOUNT_LOCKOUT_THRESHOLD=5
ACCOUNT_LOCKOUT_DURATION_MINUTES=15
```

### 2. Gmail SMTP 設定（如使用 Gmail）

1. 前往 [Google 帳戶設定](https://myaccount.google.com/security)
2. 啟用「兩步驟驗證」
3. 在「應用程式密碼」中建立新密碼
4. 使用產生的 16 字元密碼作為 `SMTP_PASS`

### 3. 資料庫遷移

```bash
# 建立並執行遷移
pnpm prisma migrate dev --name add_password_management

# 驗證遷移結果
pnpm prisma studio
```

## Development Workflow

### 1. 啟動開發伺服器

```bash
pnpm dev
```

### 2. 執行測試

```bash
# 執行所有密碼相關測試
pnpm test --run tests/unit/services/PasswordResetService.test.ts
pnpm test --run tests/unit/lib/password-strength.test.ts
pnpm test --run tests/integration/api/auth/

# 執行單一測試
pnpm test --run -t "should change password successfully"
```

### 3. 測試郵件發送（開發環境）

使用 [Ethereal Email](https://ethereal.email/) 進行開發測試：

```typescript
// 自動取得測試帳號
import nodemailer from 'nodemailer';

const testAccount = await nodemailer.createTestAccount();
console.log('Test account:', testAccount);
// 使用 testAccount.user 和 testAccount.pass 設定 SMTP
```

## API Usage Examples

### 變更密碼

```bash
curl -X POST http://localhost:3000/api/auth/change-password \
  -H "Content-Type: application/json" \
  -H "Cookie: auth_token=YOUR_JWT_TOKEN" \
  -d '{
    "currentPassword": "OldPassword123",
    "newPassword": "NewPassword456",
    "confirmPassword": "NewPassword456"
  }'
```

### 忘記密碼

```bash
curl -X POST http://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com"
  }'
```

### 重設密碼

```bash
curl -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "RESET_TOKEN_FROM_EMAIL",
    "newPassword": "NewPassword789",
    "confirmPassword": "NewPassword789"
  }'
```

### 檢查密碼強度

```bash
curl -X POST http://localhost:3000/api/auth/password-strength \
  -H "Content-Type: application/json" \
  -d '{
    "password": "MySecureP@ss123"
  }'
```

## Frontend Pages

| Page | Path | Description |
|------|------|-------------|
| 安全設定 | `/settings/security` | 變更密碼表單 |
| 忘記密碼 | `/forgot-password` | 輸入 email 請求重設 |
| 重設密碼 | `/reset-password?token=xxx` | 設定新密碼 |

## Testing Checklist

### P1: 變更密碼
- [ ] 正確的目前密碼 + 符合規則的新密碼 → 成功
- [ ] 錯誤的目前密碼 → 失敗
- [ ] 新密碼不符合強度要求 → 失敗
- [ ] 新密碼與確認密碼不一致 → 失敗
- [ ] 變更成功後其他 session 失效

### P2: 忘記密碼
- [ ] 已註冊 email → 發送郵件
- [ ] 未註冊 email → 顯示相同訊息（防探測）
- [ ] 連結有效期內點擊 → 可設定新密碼
- [ ] 連結過期後點擊 → 顯示過期訊息
- [ ] 連結使用後再點擊 → 顯示已使用訊息
- [ ] 60 秒內重複請求 → 拒絕

### P3: 密碼強度
- [ ] 僅數字 → 弱
- [ ] 大小寫 + 數字 → 中
- [ ] 大小寫 + 數字 + 特殊符號 + 12字元 → 強

### 安全性
- [ ] 5 次失敗 → 鎖定 15 分鐘
- [ ] 鎖定時發送郵件通知
- [ ] 所有操作記錄審計日誌

## Troubleshooting

### 郵件發送失敗

1. 確認 SMTP 設定正確
2. 檢查防火牆是否阻擋 SMTP 端口
3. Gmail 需使用應用程式密碼

### Token 驗證失敗

1. 確認 token 未過期（1 小時）
2. 確認 token 未被使用過
3. 檢查 URL 編碼問題

### 帳戶被鎖定

1. 等待 15 分鐘自動解鎖
2. 使用忘記密碼功能重設密碼（會解除鎖定）
