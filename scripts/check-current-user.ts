/**
 * 檢查目前登入用戶的 API Key 狀態
 *
 * 使用方式：
 * 1. 從瀏覽器開發者工具複製 token cookie 值
 * 2. 設定環境變數 TEST_TOKEN 並執行此腳本
 */

import { PrismaClient } from '@/generated/prisma/client';
import { decodeToken } from '../src/lib/jwt';

const prisma = new PrismaClient();

async function checkCurrentUser() {
  // 從命令列參數或環境變數獲取 token
  const token = process.argv[2] || process.env.TEST_TOKEN;

  if (!token) {
    console.log('請提供 JWT token 作為參數或設定 TEST_TOKEN 環境變數');
    console.log('使用方式: pnpm tsx scripts/check-current-user.ts <your-jwt-token>');
    console.log('\n你可以從瀏覽器開發者工具 > Application > Cookies > token 複製');
    process.exit(1);
  }

  console.log('=== 檢查目前登入用戶 ===\n');

  // 解碼 token（不驗證）
  const decoded = decodeToken(token);
  if (!decoded) {
    console.error('無法解碼 token');
    process.exit(1);
  }

  console.log('Token 內容:');
  console.log('  userId:', decoded.userId);
  console.log('  email:', decoded.email);

  // 從資料庫查詢用戶
  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    include: {
      apiKeys: {
        select: { id: true, exchange: true, isActive: true }
      }
    }
  });

  if (!user) {
    console.log('\n❌ 用戶不存在於資料庫中');
    process.exit(1);
  }

  console.log('\n資料庫用戶資訊:');
  console.log('  ID:', user.id);
  console.log('  Email:', user.email);
  console.log('  API Keys:', user.apiKeys.length > 0 ? '' : '無');

  for (const key of user.apiKeys) {
    console.log(`    - ${key.exchange}: ${key.isActive ? '啟用' : '停用'}`);
  }

  if (user.apiKeys.length === 0) {
    console.log('\n⚠️  此用戶沒有設定任何 API Key!');
    console.log('   請到設定頁面新增 API Key，或使用有 API Key 的帳號登入');
  }

  await prisma.$disconnect();
}

checkCurrentUser().catch(console.error);
