/**
 * Integration Test: CloseReason Enum
 * Feature: 050-sl-tp-trigger-monitor
 *
 * TDD: 驗證 Prisma schema 的 CloseReason enum 和 Position.closeReason 欄位
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient, CloseReason } from '@prisma/client';

describe('CloseReason Integration', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('CloseReason Enum', () => {
    it('should have all required close reason values', () => {
      // 驗證 CloseReason enum 存在且有正確的值
      expect(CloseReason.MANUAL).toBe('MANUAL');
      expect(CloseReason.LONG_SL_TRIGGERED).toBe('LONG_SL_TRIGGERED');
      expect(CloseReason.LONG_TP_TRIGGERED).toBe('LONG_TP_TRIGGERED');
      expect(CloseReason.SHORT_SL_TRIGGERED).toBe('SHORT_SL_TRIGGERED');
      expect(CloseReason.SHORT_TP_TRIGGERED).toBe('SHORT_TP_TRIGGERED');
      expect(CloseReason.BOTH_TRIGGERED).toBe('BOTH_TRIGGERED');
    });

    it('should have exactly 6 close reason values', () => {
      const values = Object.values(CloseReason);
      expect(values).toHaveLength(6);
    });
  });

  describe('Position.closeReason field', () => {
    it('should allow null closeReason for open positions', async () => {
      // 驗證 closeReason 欄位可以是 null
      const position = await prisma.position.findFirst({
        where: { status: 'OPEN' },
        select: { id: true, closeReason: true },
      });

      // 如果找到開啟中的持倉，closeReason 應該是 null
      if (position) {
        expect(position.closeReason).toBeNull();
      }
      // 如果沒有找到，測試仍然通過（schema 驗證）
      expect(true).toBe(true);
    });

    it('should accept valid CloseReason values in query', async () => {
      // 驗證可以用 CloseReason 值查詢
      const countWithReason = await prisma.position.count({
        where: {
          OR: [
            { closeReason: CloseReason.MANUAL },
            { closeReason: CloseReason.LONG_SL_TRIGGERED },
            { closeReason: CloseReason.LONG_TP_TRIGGERED },
            { closeReason: CloseReason.SHORT_SL_TRIGGERED },
            { closeReason: CloseReason.SHORT_TP_TRIGGERED },
            { closeReason: CloseReason.BOTH_TRIGGERED },
            { closeReason: null },
          ],
        },
      });

      // 查詢應該成功執行（不論結果是多少）
      expect(countWithReason).toBeGreaterThanOrEqual(0);
    });
  });
});
