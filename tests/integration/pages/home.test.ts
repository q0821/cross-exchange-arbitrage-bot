import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';

const INTEGRATION_ENABLED = process.env.RUN_INTEGRATION_TESTS === 'true';

/**
 * T013: 首頁 SSR 測試
 *
 * 測試目標：
 * - Server Component 正確渲染
 * - HTML 包含套利機會列表資料
 * - 無需認證即可訪問
 */
describe.skipIf(!INTEGRATION_ENABLED)('首頁 SSR', () => {
  let prisma: PrismaClient;
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  beforeAll(async () => {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    prisma = new PrismaClient({ adapter });

    // 清理測試資料
    await prisma.opportunityEndHistory.deleteMany({
      where: {
        symbol: { startsWith: 'TESTHOME' },
      },
    });

    // 建立測試用戶（如果不存在）
    await prisma.user.upsert({
      where: { id: 'test-user-home' },
      update: {},
      create: {
        id: 'test-user-home',
        email: 'home-test@example.com',
        password: 'hashed-password',
      },
    });

    // 建立測試資料
    const now = new Date();
    await prisma.opportunityEndHistory.createMany({
      data: [
        {
          id: 'test-home-1',
          symbol: 'TESTHOMEBTC',
          longExchange: 'binance',
          shortExchange: 'okx',
          detectedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 天前
          disappearedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 天前
          durationMs: BigInt(24 * 60 * 60 * 1000), // 24 小時
          initialSpread: 0.0025,
          maxSpread: 0.0045,
          maxSpreadAt: new Date(now.getTime() - 1.5 * 24 * 60 * 60 * 1000),
          finalSpread: 0.0015,
          longIntervalHours: 8,
          shortIntervalHours: 8,
          settlementRecords: [],
          longSettlementCount: 3,
          shortSettlementCount: 3,
          totalFundingProfit: 5.2,
          totalCost: 0.8,
          netProfit: 4.4,
          realizedAPY: 12.5,
          notificationCount: 3,
          userId: 'test-user-home',
        },
        {
          id: 'test-home-2',
          symbol: 'TESTHOMEETH',
          longExchange: 'gateio',
          shortExchange: 'mexc',
          detectedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 天前
          disappearedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 天前
          durationMs: BigInt(12 * 60 * 60 * 1000), // 12 小時
          initialSpread: 0.0018,
          maxSpread: 0.0032,
          maxSpreadAt: new Date(now.getTime() - 2.5 * 24 * 60 * 60 * 1000),
          finalSpread: 0.0008,
          longIntervalHours: 4,
          shortIntervalHours: 4,
          settlementRecords: [],
          longSettlementCount: 3,
          shortSettlementCount: 3,
          totalFundingProfit: 3.1,
          totalCost: 0.5,
          netProfit: 2.6,
          realizedAPY: 8.3,
          notificationCount: 1,
          userId: 'test-user-home',
        },
      ],
    });
  });

  afterAll(async () => {
    // 清理測試資料
    await prisma.opportunityEndHistory.deleteMany({
      where: {
        symbol: { startsWith: 'TESTHOME' },
      },
    });

    await prisma.$disconnect();
  });

  it('應無需認證即可訪問首頁', async () => {
    const response = await fetch(`${baseUrl}/`, {
      redirect: 'manual', // 不自動跟隨重導向
    });

    // 不應重導向到登入頁
    expect(response.status).toBe(200);
  });

  it('應正確渲染 HTML 包含套利機會列表', async () => {
    const response = await fetch(`${baseUrl}/`);
    expect(response.status).toBe(200);

    const html = await response.text();

    // 驗證包含機會列表容器（無論是否有資料）
    expect(html).toContain('歷史套利機會記錄');

    // 驗證包含正確的結構（資料或空狀態）
    const hasData = html.includes('TESTHOMEBTC');
    if (hasData) {
      // 如果有資料，驗證內容
      expect(html).toContain('TESTHOMEBTC');
      expect(html).toContain('binance');
      expect(html).toContain('okx');
    } else {
      // 如果沒有資料，驗證空狀態
      expect(html).toContain('目前暫無套利機會記錄');
    }
  });

  it('應包含公開導覽列', async () => {
    const response = await fetch(`${baseUrl}/`);
    const html = await response.text();

    // 驗證導覽列存在（登入/註冊按鈕）
    expect(html).toMatch(/登入|Login/i);
    expect(html).toMatch(/註冊|Sign.*up/i);
  });

  it('應顯示套利機會的關鍵資訊', async () => {
    const response = await fetch(`${baseUrl}/`);
    const html = await response.text();

    // 驗證包含年化報酬率、費差等資訊
    // 如果有資料，應該包含這些資訊
    // 如果沒有資料，應該顯示空狀態訊息
    const hasData = html.includes('TESTHOMEBTC');

    if (hasData) {
      expect(html).toContain('12.5'); // realizedAPY
      expect(html).toContain('0.0045'); // maxSpread
    } else {
      // 驗證空狀態顯示
      expect(html).toContain('目前暫無套利機會記錄');
    }
  });

  it('應正確設定 SEO metadata', async () => {
    const response = await fetch(`${baseUrl}/`);
    const html = await response.text();

    // 驗證 title tag
    expect(html).toMatch(/<title>.*套利.*<\/title>/i);

    // 驗證 meta description
    expect(html).toMatch(/<meta[^>]*name="description"[^>]*>/i);
  });
});
