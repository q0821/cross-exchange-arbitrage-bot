/**
 * Admin Seed Script (Feature 068)
 *
 * 建立初始管理員帳戶
 *
 * 執行方式：
 * pnpm tsx prisma/seed-admin.ts
 *
 * 或指定 email 和密碼：
 * ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=MySecure123! pnpm tsx prisma/seed-admin.ts
 */

import bcrypt from 'bcrypt';
import { prisma } from '@lib/db';

async function main() {
  const email = process.env.ADMIN_EMAIL || 'admin@example.com';
  const password = process.env.ADMIN_PASSWORD || 'AdminSecure123!';

  // 密碼強度驗證
  if (password.length < 8) {
    console.error('Error: Password must be at least 8 characters long');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      // 如果已存在，更新為 ADMIN 角色
      role: 'ADMIN',
      isActive: true,
    },
    create: {
      email,
      password: passwordHash,
      role: 'ADMIN',
      isActive: true,
    },
  });

  console.log('');
  console.log('='.repeat(50));
  console.log('Admin user created/updated successfully!');
  console.log('='.repeat(50));
  console.log('');
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
  console.log(`  User ID:  ${user.id}`);
  console.log(`  Role:     ${user.role}`);
  console.log(`  Active:   ${user.isActive}`);
  console.log('');
  console.log('Please save these credentials securely.');
  console.log('You can now login at: /admin-login');
  console.log('='.repeat(50));
}

main()
  .catch((e) => {
    console.error('Error creating admin user:', e);
    process.exit(1);
  })
  .finally(() => {
    // prisma singleton 會在 process exit 時自動斷開連線
    process.exit(0);
  });
