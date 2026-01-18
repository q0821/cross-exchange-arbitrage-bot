import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';

const INTEGRATION_ENABLED = process.env.RUN_INTEGRATION_TESTS === 'true';

describe.skipIf(!INTEGRATION_ENABLED)('GET /api/public/opportunities', () => {
  let prisma: PrismaClient;
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  beforeAll(async () => {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    prisma = new PrismaClient({ adapter });

    // 清理測試資料
    await prisma.opportunityEndHistory.deleteMany({
      where: {
        symbol: { startsWith: 'TESTAPI' },
      },
    });

    // 建立測試用戶（如果不存在）
    await prisma.user.upsert({
      where: { id: 'test-api-user' },
      update: {},
      create: {
        id: 'test-api-user',
        email: 'api-test@example.com',
        password: 'hashed-password',
      },
    });

    // 建立測試資料
    const now = new Date();
    await prisma.opportunityEndHistory.createMany({
      data: [
        {
          id: 'test-api-hist-1',
          symbol: 'TESTAPIBTC',
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
          userId: 'test-api-user',
        },
        {
          id: 'test-api-hist-2',
          symbol: 'TESTAPIETH',
          longExchange: 'gateio',
          shortExchange: 'mexc',
          detectedAt: new Date(now.getTime() - 50 * 24 * 60 * 60 * 1000), // 50 天前
          disappearedAt: new Date(now.getTime() - 49 * 24 * 60 * 60 * 1000), // 49 天前
          durationMs: BigInt(12 * 60 * 60 * 1000), // 12 小時
          initialSpread: 0.0018,
          maxSpread: 0.0032,
          maxSpreadAt: new Date(now.getTime() - 49.5 * 24 * 60 * 60 * 1000),
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
          userId: 'test-api-user',
        },
      ],
    });
  });

  afterAll(async () => {
    // 清理測試資料
    await prisma.opportunityEndHistory.deleteMany({
      where: {
        symbol: { startsWith: 'TESTAPI' },
      },
    });

    await prisma.$disconnect();
  });

  describe('正常請求', () => {
    it('應回傳正確的 JSON 格式', async () => {
      const response = await fetch(`${baseUrl}/api/public/opportunities`);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('application/json');

      const data = await response.json();

      // 驗證回應結構
      expect(data).toHaveProperty('data');
      expect(data).toHaveProperty('pagination');
      expect(data).toHaveProperty('filter');

      // 驗證 pagination 結構
      expect(data.pagination).toHaveProperty('page');
      expect(data.pagination).toHaveProperty('limit');
      expect(data.pagination).toHaveProperty('total');
      expect(data.pagination).toHaveProperty('totalPages');

      // 驗證 filter 結構
      expect(data.filter).toHaveProperty('days');
    });

    it('應回傳去識別化的資料（不包含 userId）', async () => {
      const response = await fetch(`${baseUrl}/api/public/opportunities`);
      const data = await response.json();

      if (data.data.length > 0) {
        const firstItem = data.data[0];

        // 應包含的欄位
        expect(firstItem).toHaveProperty('id');
        expect(firstItem).toHaveProperty('symbol');
        expect(firstItem).toHaveProperty('longExchange');
        expect(firstItem).toHaveProperty('shortExchange');
        expect(firstItem).toHaveProperty('maxSpread');
        expect(firstItem).toHaveProperty('finalSpread');
        expect(firstItem).toHaveProperty('realizedAPY');
        expect(firstItem).toHaveProperty('durationMs');
        expect(firstItem).toHaveProperty('appearedAt');
        expect(firstItem).toHaveProperty('disappearedAt');

        // 不應包含的敏感欄位
        expect(firstItem).not.toHaveProperty('userId');
        expect(firstItem).not.toHaveProperty('notificationCount');
        expect(firstItem).not.toHaveProperty('settlementRecords');
      }
    });

    it('應支援時間範圍篩選（days=7）', async () => {
      const response = await fetch(`${baseUrl}/api/public/opportunities?days=7`);
      const data = await response.json();

      expect(data.filter.days).toBe(7);

      // 驗證資料在 7 天內
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      data.data.forEach((item: { disappearedAt: string }) => {
        const disappearedAt = new Date(item.disappearedAt);
        expect(disappearedAt.getTime()).toBeGreaterThanOrEqual(sevenDaysAgo.getTime());
      });
    });

    it('應支援分頁（page, limit）', async () => {
      const response = await fetch(`${baseUrl}/api/public/opportunities?page=1&limit=10`);
      const data = await response.json();

      expect(data.pagination.page).toBe(1);
      expect(data.pagination.limit).toBe(10);
      expect(data.data.length).toBeLessThanOrEqual(10);
    });
  });

  describe('參數驗證', () => {
    // 避免觸發速率限制
    beforeEach(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2100)); // 等待速率限制窗口重置
    });

    it('應拒絕無效的 page 參數', async () => {
      const response = await fetch(`${baseUrl}/api/public/opportunities?page=0`);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toHaveProperty('error');
    });

    it('應拒絕無效的 limit 參數（超過最大值）', async () => {
      const response = await fetch(`${baseUrl}/api/public/opportunities?limit=200`);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toHaveProperty('error');
    });

    it('應拒絕無效的 days 參數', async () => {
      const response = await fetch(`${baseUrl}/api/public/opportunities?days=15`);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toHaveProperty('error');
    });
  });

  describe('速率限制', () => {
    it('應在超過速率限制時回傳 429', async () => {
      // 連續發送 31 次請求（超過 30 req/min 限制）
      const requests: Promise<Response>[] = [];
      for (let i = 0; i < 31; i++) {
        requests.push(fetch(`${baseUrl}/api/public/opportunities`));
      }

      const responses = await Promise.all(requests);

      // 應該有至少一個 429 回應
      const tooManyRequests = responses.filter((r) => r.status === 429);
      expect(tooManyRequests.length).toBeGreaterThan(0);

      // 驗證 429 回應包含正確的 headers
      const rateLimitResponse = tooManyRequests[0];
      expect(rateLimitResponse.headers.get('Retry-After')).toBeTruthy();

      const errorData = await rateLimitResponse.json();
      expect(errorData).toHaveProperty('error');
      expect(errorData.error).toContain('Too many requests');
    });

    it('應設定正確的 X-RateLimit-* headers', async () => {
      const response = await fetch(`${baseUrl}/api/public/opportunities`);

      // 驗證 rate limit headers
      expect(response.headers.has('X-RateLimit-Limit')).toBe(true);
      expect(response.headers.has('X-RateLimit-Remaining')).toBe(true);
    });
  });
});
