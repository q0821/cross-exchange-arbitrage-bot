# Quickstart: 平台管理後臺

**Feature**: 068-admin-dashboard
**Date**: 2026-01-23

## 快速開始

### 1. 環境設置

```bash
# 確保在 feature branch
git checkout 068-admin-dashboard

# 安裝依賴
pnpm install

# 啟動資料庫
pnpm docker:up

# 執行 migration（schema 變更後）
pnpm db:migrate

# 產生 Prisma Client
pnpm db:generate
```

### 2. 建立管理員帳戶

由於管理員不提供自助註冊，需透過 seed script 或直接操作資料庫：

**方法 A: Seed Script（推薦）**

```typescript
// prisma/seed-admin.ts
import { PrismaClient } from '@/generated/prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@example.com';
  const password = 'AdminSecure123!';
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      password: passwordHash,
      role: 'ADMIN',
      isActive: true,
    },
  });

  console.log(`Admin user created: ${email}`);
  console.log(`Password: ${password}`);
}

main();
```

執行：
```bash
pnpm tsx prisma/seed-admin.ts
```

**方法 B: 直接 SQL**

```sql
INSERT INTO "users" (id, email, password, role, "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'admin@example.com',
  '$2b$10$...', -- bcrypt hash of password
  'ADMIN',
  true,
  NOW(),
  NOW()
);
```

### 3. 啟動開發伺服器

```bash
pnpm dev:pretty
```

### 4. 存取管理後臺

- 管理員登入：http://localhost:3000/admin-login
- 管理後臺首頁：http://localhost:3000/admin/dashboard

## 開發指引

### 專案結構

```
app/
├── (admin)/
│   ├── admin/
│   │   ├── layout.tsx          # Admin 佈局
│   │   ├── dashboard/page.tsx  # 儀表板
│   │   ├── users/page.tsx      # 用戶列表
│   │   └── trades/page.tsx     # 交易列表
│   └── admin-login/page.tsx    # 登入頁面

src/
├── services/admin/             # Admin 服務層
├── lib/admin/                  # Admin 工具函數
└── types/admin.ts              # Admin 類型定義

app/api/admin/                  # Admin API Routes
```

### TDD 開發流程

遵循 Constitution Principle VII:

1. **Red Phase** - 先寫測試，確認失敗
```bash
# 執行測試（應該失敗）
pnpm test tests/unit/services/admin/AdminUserService.test.ts
```

2. **Green Phase** - 寫最少程式碼讓測試通過
```bash
# 執行測試（應該通過）
pnpm test tests/unit/services/admin/AdminUserService.test.ts
```

3. **Refactor Phase** - 重構，確保測試仍通過
```bash
# 執行所有測試
pnpm test
```

### 測試指令

```bash
# 單元測試
pnpm test tests/unit/services/admin/

# 整合測試
RUN_INTEGRATION_TESTS=true pnpm test tests/integration/admin/

# E2E 測試
pnpm test:e2e tests/e2e/admin/
```

### Schema 變更流程

```bash
# 1. 修改 prisma/schema.prisma

# 2. 產生 migration
pnpm prisma migrate dev --name add_admin_fields

# 3. 確認 migration 檔案已建立
ls prisma/migrations/

# 4. 產生 Prisma Client
pnpm db:generate

# 5. 同步提交
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(068): add User role and isActive fields"
```

### 常用 API 測試

```bash
# 管理員登入
curl -X POST http://localhost:3000/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"AdminSecure123!"}'

# 取得儀表板數據
curl http://localhost:3000/api/admin/dashboard \
  -H "Cookie: token=<jwt_token>"

# 取得用戶列表
curl "http://localhost:3000/api/admin/users?page=1&limit=20" \
  -H "Cookie: token=<jwt_token>"
```

## 驗收檢查清單

### P1 功能

- [ ] 管理員可登入後臺
- [ ] 儀表板顯示平台統計數據
- [ ] 用戶列表支援分頁、搜尋、篩選
- [ ] 可查看用戶詳情和交易記錄
- [ ] 交易記錄顯示開倉時資金費率

### P2 功能

- [ ] 可新增用戶（自動產生密碼）
- [ ] 可編輯用戶 email
- [ ] 可重設用戶密碼
- [ ] 可停用/啟用用戶
- [ ] 停用用戶後 session 即時失效
- [ ] 平台交易列表支援篩選

### P3 功能

- [ ] 可刪除用戶（需二次確認）
- [ ] 有活躍持倉的用戶無法刪除
- [ ] 交易記錄可匯出 CSV

### 品質要求

- [ ] 所有測試通過
- [ ] TypeScript 無錯誤
- [ ] ESLint 無警告
- [ ] Migration 檔案已提交
- [ ] 審計日誌記錄正確
