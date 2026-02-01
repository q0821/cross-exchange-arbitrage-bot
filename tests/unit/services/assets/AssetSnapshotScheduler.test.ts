import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock 用的變數
let mockFindUsersWithApiKeys = vi.fn();
let mockCreateSnapshotForUser = vi.fn();
let mockCleanupOldSnapshots = vi.fn();

// Mock PrismaClient
vi.mock('@/generated/prisma/client', () => ({
  PrismaClient: class MockPrismaClient {},
}));

// Mock AssetSnapshotService
vi.mock('@/services/assets/AssetSnapshotService', () => ({
  AssetSnapshotService: class MockAssetSnapshotService {
    createSnapshotForUser = mockCreateSnapshotForUser;
    cleanupOldSnapshots = mockCleanupOldSnapshots;
  },
}));

// Mock AssetSnapshotRepository
vi.mock('@/repositories/AssetSnapshotRepository', () => ({
  AssetSnapshotRepository: class MockAssetSnapshotRepository {
    findUsersWithApiKeys = mockFindUsersWithApiKeys;
  },
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('AssetSnapshotScheduler', () => {
  let scheduler: typeof import('@/services/assets/AssetSnapshotScheduler');

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // 重置 mock 函數
    mockFindUsersWithApiKeys = vi.fn().mockResolvedValue([]);
    mockCreateSnapshotForUser = vi.fn().mockResolvedValue({ userId: 'test', totalUSD: 1000 });
    mockCleanupOldSnapshots = vi.fn().mockResolvedValue(0);

    // 設定環境變數
    process.env.ENABLE_ASSET_SNAPSHOT = 'true';
    process.env.ASSET_SNAPSHOT_INTERVAL_MS = '3600000';

    // 清除模組快取以獲得新的實例
    vi.resetModules();

    // 重新載入模組
    scheduler = await import('@/services/assets/AssetSnapshotScheduler');
  });

  afterEach(async () => {
    vi.useRealTimers();
    // 停止排程器
    await scheduler.stopAssetSnapshotScheduler();
    delete process.env.ENABLE_ASSET_SNAPSHOT;
    delete process.env.ASSET_SNAPSHOT_INTERVAL_MS;
  });

  describe('並發控制', () => {
    it('當任務正在執行時，manualRun 應該跳過', async () => {
      // 模擬找到多個用戶
      mockFindUsersWithApiKeys.mockResolvedValue([
        { id: 'user1' },
        { id: 'user2' },
      ]);

      // 模擬慢速的快照創建（讓第一個任務持續執行）
      let resolveFirst: () => void;
      const firstPromise = new Promise<void>((resolve) => {
        resolveFirst = resolve;
      });

      mockCreateSnapshotForUser.mockImplementationOnce(async () => {
        await firstPromise;
        return { userId: 'user1', totalUSD: 1000 };
      });

      const mockPrisma = {} as import('@/generated/prisma/client').PrismaClient;
      const schedulerInstance = scheduler.getAssetSnapshotScheduler(mockPrisma);

      // 第一次呼叫開始執行
      const firstCall = schedulerInstance.manualRun();

      // 等待一下讓第一個任務開始
      await vi.advanceTimersByTimeAsync(10);

      // 立即進行第二次呼叫（應該被跳過）
      const secondResult = await schedulerInstance.manualRun();

      // 第二次呼叫應該立即返回 success: false
      expect(secondResult).toEqual({ success: false, snapshotCount: 0 });

      // 完成第一個任務
      resolveFirst!();
      await vi.advanceTimersByTimeAsync(10);
      const firstResult = await firstCall;
      expect(firstResult.success).toBe(true);
    });

    it('任務完成後應該允許新的任務執行', async () => {
      mockFindUsersWithApiKeys.mockResolvedValue([{ id: 'user1' }]);
      mockCreateSnapshotForUser.mockResolvedValue({ userId: 'user1', totalUSD: 1000 });

      const mockPrisma = {} as import('@/generated/prisma/client').PrismaClient;
      const schedulerInstance = scheduler.getAssetSnapshotScheduler(mockPrisma);

      // 第一次執行
      const firstResult = await schedulerInstance.manualRun();
      expect(firstResult.success).toBe(true);

      // 第二次執行（任務已完成，應該可以執行）
      const secondResult = await schedulerInstance.manualRun();
      expect(secondResult.success).toBe(true);
    });

    it('任務失敗後應該重置 isJobRunning 標誌', async () => {
      mockFindUsersWithApiKeys.mockRejectedValueOnce(new Error('Database error'));

      const mockPrisma = {} as import('@/generated/prisma/client').PrismaClient;
      const schedulerInstance = scheduler.getAssetSnapshotScheduler(mockPrisma);

      // 第一次執行（會失敗）
      const firstResult = await schedulerInstance.manualRun();
      expect(firstResult.success).toBe(false);

      // 修復問題後第二次執行應該可以進行
      mockFindUsersWithApiKeys.mockResolvedValue([{ id: 'user1' }]);
      mockCreateSnapshotForUser.mockResolvedValue({ userId: 'user1', totalUSD: 1000 });

      const secondResult = await schedulerInstance.manualRun();
      expect(secondResult.success).toBe(true);
    });
  });

  describe('getStatus', () => {
    it('應該返回正確的排程器狀態', () => {
      const mockPrisma = {} as import('@/generated/prisma/client').PrismaClient;
      const schedulerInstance = scheduler.getAssetSnapshotScheduler(mockPrisma);

      const status = schedulerInstance.getStatus();

      expect(status).toHaveProperty('isRunning');
      expect(status).toHaveProperty('lastRunTime');
      expect(status).toHaveProperty('nextRunTime');
      expect(status).toHaveProperty('totalSnapshots');
      expect(status).toHaveProperty('consecutiveFailures');
    });
  });
});
