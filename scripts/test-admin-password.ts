/**
 * 測試 admin 帳戶密碼
 */
import { prisma } from '../src/lib/db';
import bcrypt from 'bcrypt';

async function main() {
  const admin = await prisma.user.findFirst({
    where: { email: 'q0821yeh@gmail.com' },
    select: { password: true, email: true },
  });

  if (!admin) {
    console.log('Admin not found');
    process.exit(1);
  }

  console.log('Email:', admin.email);
  console.log('Hash length:', admin.password.length);
  console.log('Hash preview:', admin.password.substring(0, 30));

  // 測試常見密碼
  const testPasswords = ['AdminSecure123!', 'admin', 'password', '123456'];

  for (const pwd of testPasswords) {
    const match = await bcrypt.compare(pwd, admin.password);
    console.log(`Password "${pwd}" matches:`, match);
  }

  process.exit(0);
}

main();
