/**
 * Seed Asset Snapshots
 * 為測試用戶建立模擬的資產快照資料
 *
 * Feature 031: Asset Tracking History (T045)
 *
 * Usage:
 *   pnpm tsx scripts/seed-asset-snapshots.ts [userId] [days]
 *
 * Examples:
 *   pnpm tsx scripts/seed-asset-snapshots.ts                    # 使用預設值
 *   pnpm tsx scripts/seed-asset-snapshots.ts cm123abc 30        # 指定用戶和天數
 */

import { PrismaClient } from '@prisma/client';
import { subHours } from 'date-fns';

const prisma = new PrismaClient();

// 預設參數
const DEFAULT_DAYS = 30;

// 模擬餘額配置
const INITIAL_BALANCES = {
  binance: 5000,
  okx: 3000,
  mexc: 0, // 未設定
  gateio: 0, // 未設定
};

// 每小時變動範圍 (百分比)
const HOURLY_CHANGE_RANGE = {
  min: -0.5,
  max: 0.8,
};

/**
 * 產生隨機變動
 */
function randomChange(): number {
  const { min, max } = HOURLY_CHANGE_RANGE;
  return min + Math.random() * (max - min);
}

/**
 * 建立模擬快照資料
 */
async function seedSnapshots(userId: string, days: number) {
  console.log(`開始建立 ${days} 天的模擬快照資料...`);
  console.log(`用戶 ID: ${userId}`);

  // 計算總快照數（每小時一筆）
  const totalSnapshots = days * 24;
  const now = new Date();

  // 追蹤當前餘額
  let currentBalances = { ...INITIAL_BALANCES };

  // 從過去開始建立
  const snapshots = [];

  for (let i = totalSnapshots; i >= 0; i--) {
    const recordedAt = subHours(now, i);

    // 計算各交易所餘額（隨機波動）
    if (i < totalSnapshots) {
      // 除了第一筆外，都有波動
      if (currentBalances.binance > 0) {
        const change = 1 + randomChange() / 100;
        currentBalances.binance *= change;
      }
      if (currentBalances.okx > 0) {
        const change = 1 + randomChange() / 100;
        currentBalances.okx *= change;
      }
    }

    // 確保餘額不為負
    currentBalances.binance = Math.max(0, currentBalances.binance);
    currentBalances.okx = Math.max(0, currentBalances.okx);

    const totalBalance =
      currentBalances.binance +
      currentBalances.okx +
      currentBalances.mexc +
      currentBalances.gateio;

    snapshots.push({
      userId,
      binanceBalanceUSD: currentBalances.binance > 0 ? currentBalances.binance : null,
      okxBalanceUSD: currentBalances.okx > 0 ? currentBalances.okx : null,
      mexcBalanceUSD: currentBalances.mexc > 0 ? currentBalances.mexc : null,
      gateioBalanceUSD: currentBalances.gateio > 0 ? currentBalances.gateio : null,
      totalBalanceUSD: totalBalance,
      binanceStatus: currentBalances.binance > 0 ? 'success' : 'no_api_key',
      okxStatus: currentBalances.okx > 0 ? 'success' : 'no_api_key',
      mexcStatus: 'no_api_key',
      gateioStatus: 'no_api_key',
      recordedAt,
    });
  }

  // 批次寫入資料庫
  console.log(`建立 ${snapshots.length} 筆快照...`);

  const result = await prisma.assetSnapshot.createMany({
    data: snapshots,
    skipDuplicates: true,
  });

  console.log(`成功建立 ${result.count} 筆快照`);

  // 顯示統計
  const stats = await prisma.assetSnapshot.aggregate({
    where: { userId },
    _count: true,
    _min: { recordedAt: true },
    _max: { recordedAt: true },
  });

  console.log('\n統計資訊:');
  console.log(`  總筆數: ${stats._count}`);
  console.log(`  起始時間: ${stats._min.recordedAt?.toISOString()}`);
  console.log(`  結束時間: ${stats._max.recordedAt?.toISOString()}`);
}

/**
 * 取得第一個用戶 ID（如果沒有指定）
 */
async function getFirstUserId(): Promise<string | null> {
  const user = await prisma.user.findFirst({
    select: { id: true },
  });
  return user?.id ?? null;
}

/**
 * 清除用戶的所有快照（可選）
 */
async function clearSnapshots(userId: string) {
  const result = await prisma.assetSnapshot.deleteMany({
    where: { userId },
  });
  console.log(`已清除 ${result.count} 筆現有快照`);
}

async function main() {
  try {
    // 解析命令列參數
    const args = process.argv.slice(2);
    let userId: string | undefined = args[0];
    const days = parseInt(args[1] ?? '', 10) || DEFAULT_DAYS;

    // 如果沒有指定用戶 ID，使用第一個用戶
    if (!userId) {
      const firstUserId = await getFirstUserId();
      if (!firstUserId) {
        console.error('錯誤: 找不到任何用戶，請先建立用戶');
        process.exit(1);
      }
      userId = firstUserId;
      console.log(`未指定用戶 ID，使用第一個用戶: ${userId}`);
    }

    // 驗證用戶存在
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      console.error(`錯誤: 找不到用戶 ${userId}`);
      process.exit(1);
    }

    console.log(`用戶: ${user.email}`);

    // 詢問是否清除現有資料（這裡直接清除）
    await clearSnapshots(userId);

    // 建立模擬資料
    await seedSnapshots(userId, days);

    console.log('\n完成！');
  } catch (error) {
    console.error('錯誤:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
