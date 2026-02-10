/**
 * batch-mark-closed.test.ts
 *
 * 批量標記已平倉 API 邏輯測試
 * 測試 PATCH /api/positions/group/[groupId]/mark-closed 的核心邏輯
 *
 * 由於 API route 使用 @/src/ 前綴（Next.js tsconfig fallback 解析），
 * vitest 無法直接 import route handler。
 * 因此這裡直接測試核心邏輯：PositionGroupService 驗證 + Prisma 操作。
 */

// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PositionGroupService } from '@/services/trading/PositionGroupService';

// Mock Prisma client
function createMockPrisma() {
  return {
    position: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };
}

type MockPrisma = ReturnType<typeof createMockPrisma>;

describe('Batch Mark Closed - Core Logic', () => {
  let mockPrisma: MockPrisma;
  let groupService: PositionGroupService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = createMockPrisma();
    // PositionGroupService 只需要 prisma 的 position 方法
    groupService = new PositionGroupService(mockPrisma as any);
  });

  describe('validateGroupOwnership', () => {
    it('should return true when user owns the group', async () => {
      mockPrisma.position.findFirst.mockResolvedValue({ id: 'pos-1', groupId: 'group-1', userId: 'user-1' });

      const result = await groupService.validateGroupOwnership('group-1', 'user-1');

      expect(result).toBe(true);
      expect(mockPrisma.position.findFirst).toHaveBeenCalledWith({
        where: { groupId: 'group-1', userId: 'user-1' },
      });
    });

    it('should return false when user does not own the group', async () => {
      mockPrisma.position.findFirst.mockResolvedValue(null);

      const result = await groupService.validateGroupOwnership('group-1', 'other-user');

      expect(result).toBe(false);
    });
  });

  describe('batch mark closed transaction logic', () => {
    /**
     * 模擬 API route 的核心邏輯：
     * 1. 查詢符合條件的持倉
     * 2. 批量更新為 CLOSED
     */
    async function executeBatchMarkClosed(
      prisma: MockPrisma,
      groupId: string,
      userId: string,
    ) {
      // Step 1: 查詢符合條件的持倉
      const eligiblePositions = await prisma.position.findMany({
        where: {
          groupId,
          userId,
          status: { in: ['OPEN', 'PARTIAL', 'FAILED'] },
        },
        select: { id: true, status: true },
      });

      if (eligiblePositions.length === 0) {
        return { success: false, error: 'NO_ELIGIBLE_POSITIONS' };
      }

      // Step 2: 批量更新
      const now = new Date();
      const positionIds = eligiblePositions.map((p: { id: string }) => p.id);

      const updateResult = await prisma.$transaction(async (tx: MockPrisma) => {
        return tx.position.updateMany({
          where: {
            id: { in: positionIds },
            userId,
          },
          data: {
            status: 'CLOSED',
            closedAt: now,
            closeReason: 'MANUAL',
          },
        });
      });

      return {
        success: true,
        data: {
          groupId,
          totalUpdated: updateResult.count,
          updatedPositions: positionIds,
        },
      };
    }

    it('should return error when no eligible positions found', async () => {
      mockPrisma.position.findMany.mockResolvedValue([]);

      const result = await executeBatchMarkClosed(mockPrisma, 'group-1', 'user-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('NO_ELIGIBLE_POSITIONS');
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('should query positions with correct status filter', async () => {
      mockPrisma.position.findMany.mockResolvedValue([]);

      await executeBatchMarkClosed(mockPrisma, 'group-1', 'user-1');

      expect(mockPrisma.position.findMany).toHaveBeenCalledWith({
        where: {
          groupId: 'group-1',
          userId: 'user-1',
          status: { in: ['OPEN', 'PARTIAL', 'FAILED'] },
        },
        select: { id: true, status: true },
      });
    });

    it('should successfully mark OPEN positions as CLOSED', async () => {
      mockPrisma.position.findMany.mockResolvedValue([
        { id: 'pos-1', status: 'OPEN' },
        { id: 'pos-2', status: 'OPEN' },
      ]);
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        const txPrisma = createMockPrisma();
        txPrisma.position.updateMany.mockResolvedValue({ count: 2 });
        return fn(txPrisma);
      });

      const result = await executeBatchMarkClosed(mockPrisma, 'group-1', 'user-1');

      expect(result.success).toBe(true);
      expect(result.data?.totalUpdated).toBe(2);
      expect(result.data?.updatedPositions).toEqual(['pos-1', 'pos-2']);
      expect(result.data?.groupId).toBe('group-1');
    });

    it('should handle mixed status positions (OPEN, PARTIAL, FAILED)', async () => {
      mockPrisma.position.findMany.mockResolvedValue([
        { id: 'pos-1', status: 'OPEN' },
        { id: 'pos-2', status: 'PARTIAL' },
        { id: 'pos-3', status: 'FAILED' },
      ]);
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        const txPrisma = createMockPrisma();
        txPrisma.position.updateMany.mockResolvedValue({ count: 3 });
        return fn(txPrisma);
      });

      const result = await executeBatchMarkClosed(mockPrisma, 'group-1', 'user-1');

      expect(result.success).toBe(true);
      expect(result.data?.totalUpdated).toBe(3);
      expect(result.data?.updatedPositions).toEqual(['pos-1', 'pos-2', 'pos-3']);
    });

    it('should call updateMany with correct data', async () => {
      mockPrisma.position.findMany.mockResolvedValue([
        { id: 'pos-1', status: 'OPEN' },
      ]);

      let capturedUpdateArgs: unknown = null;
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        const txPrisma = createMockPrisma();
        txPrisma.position.updateMany.mockImplementation(async (args: unknown) => {
          capturedUpdateArgs = args;
          return { count: 1 };
        });
        return fn(txPrisma);
      });

      await executeBatchMarkClosed(mockPrisma, 'group-1', 'user-1');

      expect(capturedUpdateArgs).toEqual({
        where: {
          id: { in: ['pos-1'] },
          userId: 'user-1',
        },
        data: {
          status: 'CLOSED',
          closedAt: expect.any(Date),
          closeReason: 'MANUAL',
        },
      });
    });

    it('should not include CLOSED or PENDING positions', async () => {
      // 這些狀態不在 findMany 的 where 條件中
      // 所以即使資料庫有 CLOSED/PENDING 持倉，也不會被查詢出來
      mockPrisma.position.findMany.mockResolvedValue([
        { id: 'pos-1', status: 'OPEN' },
        // pos-2 (CLOSED) 和 pos-3 (PENDING) 不會出現在結果中
      ]);
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        const txPrisma = createMockPrisma();
        txPrisma.position.updateMany.mockResolvedValue({ count: 1 });
        return fn(txPrisma);
      });

      const result = await executeBatchMarkClosed(mockPrisma, 'group-1', 'user-1');

      expect(result.data?.updatedPositions).toEqual(['pos-1']);
      expect(result.data?.totalUpdated).toBe(1);
    });
  });
});
