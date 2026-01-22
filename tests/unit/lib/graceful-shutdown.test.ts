import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  closeWithTimeout,
  createShutdownHandler,
  type ShutdownServices,
} from '@/lib/graceful-shutdown';

describe('graceful-shutdown', () => {
  // Mock logger
  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(() => mockLogger),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('closeWithTimeout', () => {
    it('應該在 callback 成功時 resolve', async () => {
      const closeFn = vi.fn((cb: (err?: Error) => void) => {
        setTimeout(() => cb(), 100);
      });

      const promise = closeWithTimeout(closeFn, 5000, 'TestService');
      vi.advanceTimersByTime(100);

      await expect(promise).resolves.toBeUndefined();
      expect(closeFn).toHaveBeenCalledTimes(1);
    });

    it('應該在 callback 回傳錯誤時 reject', async () => {
      const error = new Error('Close failed');
      const closeFn = vi.fn((cb: (err?: Error) => void) => {
        setTimeout(() => cb(error), 100);
      });

      const promise = closeWithTimeout(closeFn, 5000, 'TestService');
      vi.advanceTimersByTime(100);

      await expect(promise).rejects.toThrow('Close failed');
    });

    it('應該在超時時 reject 並包含服務名稱', async () => {
      const closeFn = vi.fn((_cb: (err?: Error) => void) => {
        // 永遠不呼叫 callback，模擬卡住
      });

      const promise = closeWithTimeout(closeFn, 1000, 'HangingService');
      vi.advanceTimersByTime(1000);

      await expect(promise).rejects.toThrow('HangingService close timeout after 1000ms');
    });

    it('應該在成功時清除 timeout', async () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      const closeFn = vi.fn((cb: (err?: Error) => void) => {
        cb();
      });

      await closeWithTimeout(closeFn, 5000, 'TestService');

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });
  });

  describe('createShutdownHandler', () => {
    // Mock services
    const createMockServices = (): ShutdownServices => ({
      stopMonitorService: vi.fn().mockResolvedValue(undefined),
      stopOIRefreshService: vi.fn().mockResolvedValue(undefined),
      stopAssetSnapshotScheduler: vi.fn().mockResolvedValue(undefined),
      stopConditionalOrderMonitor: vi.fn().mockResolvedValue(undefined),
      closeRedisClient: vi.fn().mockResolvedValue(undefined),
    });

    // Mock servers
    const createMockServers = () => ({
      httpServer: {
        close: vi.fn((cb: (err?: Error) => void) => cb()),
      } as unknown as import('http').Server,
      io: {
        close: vi.fn((cb: (err?: Error) => void) => cb()),
      } as unknown as import('socket.io').Server,
    });

    // Mock Prisma
    const createMockPrisma = () => ({
      $disconnect: vi.fn().mockResolvedValue(undefined),
    }) as unknown as import('@/generated/prisma/client').PrismaClient;

    it('應該按正確順序關閉所有服務', async () => {
      const services = createMockServices();
      const servers = createMockServers();
      const prisma = createMockPrisma();
      const mockExit = vi.fn();

      const callOrder: string[] = [];

      // 追蹤呼叫順序
      (services.stopMonitorService as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        callOrder.push('stopMonitorService');
      });
      (services.closeRedisClient as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        callOrder.push('closeRedisClient');
      });
      (prisma.$disconnect as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        callOrder.push('prisma.$disconnect');
      });
      (servers.io.close as ReturnType<typeof vi.fn>).mockImplementation((cb: (err?: Error) => void) => {
        callOrder.push('io.close');
        cb();
      });
      (servers.httpServer.close as ReturnType<typeof vi.fn>).mockImplementation((cb: (err?: Error) => void) => {
        callOrder.push('httpServer.close');
        cb();
      });

      const shutdown = createShutdownHandler(services, servers, prisma, {
        logger: mockLogger as unknown as typeof import('@/lib/logger').logger,
        exit: mockExit,
      });

      await shutdown();

      // 驗證關閉順序：背景服務 → Redis → Prisma → Socket.io → HTTP
      expect(callOrder.indexOf('closeRedisClient')).toBeGreaterThan(
        callOrder.indexOf('stopMonitorService'),
      );
      expect(callOrder.indexOf('prisma.$disconnect')).toBeGreaterThan(
        callOrder.indexOf('closeRedisClient'),
      );
      expect(callOrder.indexOf('io.close')).toBeGreaterThan(
        callOrder.indexOf('prisma.$disconnect'),
      );
      expect(callOrder.indexOf('httpServer.close')).toBeGreaterThan(
        callOrder.indexOf('io.close'),
      );

      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it('應該在成功時呼叫 exit(0)', async () => {
      const services = createMockServices();
      const servers = createMockServers();
      const prisma = createMockPrisma();
      const mockExit = vi.fn();

      const shutdown = createShutdownHandler(services, servers, prisma, {
        logger: mockLogger as unknown as typeof import('@/lib/logger').logger,
        exit: mockExit,
      });

      await shutdown();

      expect(mockExit).toHaveBeenCalledWith(0);
      expect(mockLogger.info).toHaveBeenCalledWith('Graceful shutdown completed');
    });

    it('應該在錯誤時呼叫 exit(1)', async () => {
      const services = createMockServices();
      const servers = createMockServers();
      const prisma = createMockPrisma();
      const mockExit = vi.fn();

      // 模擬 Redis 關閉失敗
      (services.closeRedisClient as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Redis close failed'),
      );

      const shutdown = createShutdownHandler(services, servers, prisma, {
        logger: mockLogger as unknown as typeof import('@/lib/logger').logger,
        exit: mockExit,
      });

      await shutdown();

      expect(mockExit).toHaveBeenCalledWith(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.any(Error) }),
        'Error during graceful shutdown',
      );
    });

    it('應該在超時時強制 exit(1)', async () => {
      const services = createMockServices();
      const servers = createMockServers();
      const prisma = createMockPrisma();
      const mockExit = vi.fn();

      // 模擬服務永遠不完成
      (services.stopMonitorService as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise(() => {}), // 永遠不 resolve
      );

      const shutdown = createShutdownHandler(services, servers, prisma, {
        timeout: 1000,
        logger: mockLogger as unknown as typeof import('@/lib/logger').logger,
        exit: mockExit,
      });

      // 開始 shutdown（不 await，因為會卡住）
      shutdown();

      // 推進時間觸發超時
      vi.advanceTimersByTime(1000);

      expect(mockExit).toHaveBeenCalledWith(1);
      expect(mockLogger.error).toHaveBeenCalledWith('Graceful shutdown timeout, forcing exit');
    });

    it('應該並行停止所有背景服務', async () => {
      const services = createMockServices();
      const servers = createMockServers();
      const prisma = createMockPrisma();
      const mockExit = vi.fn();

      const startTimes: Record<string, number> = {};
      const endTimes: Record<string, number> = {};

      // 追蹤每個服務的開始和結束時間
      const createTrackedMock = (name: string, delay: number) => {
        return vi.fn().mockImplementation(async () => {
          startTimes[name] = Date.now();
          await new Promise((resolve) => setTimeout(resolve, delay));
          endTimes[name] = Date.now();
        });
      };

      services.stopMonitorService = createTrackedMock('monitor', 100);
      services.stopOIRefreshService = createTrackedMock('oi', 200);
      services.stopAssetSnapshotScheduler = createTrackedMock('asset', 150);
      services.stopConditionalOrderMonitor = createTrackedMock('conditional', 50);

      const shutdown = createShutdownHandler(services, servers, prisma, {
        logger: mockLogger as unknown as typeof import('@/lib/logger').logger,
        exit: mockExit,
      });

      vi.useRealTimers(); // 使用真實計時器測試並行
      await shutdown();

      // 所有服務應該幾乎同時開始（差距小於 50ms）
      const startTimesArr = Object.values(startTimes);
      const maxStartDiff = Math.max(...startTimesArr) - Math.min(...startTimesArr);
      expect(maxStartDiff).toBeLessThan(50);
    });

    it('應該即使部分服務失敗也繼續關閉流程', async () => {
      const services = createMockServices();
      const servers = createMockServers();
      const prisma = createMockPrisma();
      const mockExit = vi.fn();

      // 模擬部分服務失敗
      (services.stopMonitorService as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Monitor stop failed'),
      );
      (services.stopOIRefreshService as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('OI stop failed'),
      );

      const shutdown = createShutdownHandler(services, servers, prisma, {
        logger: mockLogger as unknown as typeof import('@/lib/logger').logger,
        exit: mockExit,
      });

      await shutdown();

      // 應該記錄警告但繼續關閉
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ service: 'MonitorService' }),
        'Service failed to stop',
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ service: 'OIRefreshService' }),
        'Service failed to stop',
      );

      // Redis、Prisma、Socket.io、HTTP 應該仍被呼叫
      expect(services.closeRedisClient).toHaveBeenCalled();
      expect(prisma.$disconnect).toHaveBeenCalled();
      expect(servers.io.close).toHaveBeenCalled();
      expect(servers.httpServer.close).toHaveBeenCalled();

      // 最終應該成功退出
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it('應該使用自訂的 timeout 設定', async () => {
      const services = createMockServices();
      const servers = createMockServers();
      const prisma = createMockPrisma();
      const mockExit = vi.fn();

      // 模擬服務永遠不完成
      (services.stopMonitorService as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise(() => {}),
      );

      const shutdown = createShutdownHandler(services, servers, prisma, {
        timeout: 500, // 自訂 500ms 超時
        logger: mockLogger as unknown as typeof import('@/lib/logger').logger,
        exit: mockExit,
      });

      shutdown();

      // 推進 499ms，應該還沒超時
      vi.advanceTimersByTime(499);
      expect(mockExit).not.toHaveBeenCalled();

      // 推進到 500ms，應該超時
      vi.advanceTimersByTime(1);
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('應該在 Socket.io 關閉超時時 reject', async () => {
      const services = createMockServices();
      const servers = createMockServers();
      const prisma = createMockPrisma();
      const mockExit = vi.fn();

      // 模擬 Socket.io 關閉卡住
      (servers.io.close as ReturnType<typeof vi.fn>).mockImplementation(
        (_cb: (err?: Error) => void) => {
          // 永遠不呼叫 callback
        },
      );

      const shutdown = createShutdownHandler(services, servers, prisma, {
        serviceTimeout: 1000,
        logger: mockLogger as unknown as typeof import('@/lib/logger').logger,
        exit: mockExit,
      });

      const shutdownPromise = shutdown();

      // 使用 advanceTimersByTimeAsync 來正確處理 Promise + fake timers
      await vi.advanceTimersByTimeAsync(1000);

      await shutdownPromise;

      expect(mockExit).toHaveBeenCalledWith(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.any(Error) }),
        'Error during graceful shutdown',
      );
    });

    it('應該在 HTTP server 關閉失敗時 reject', async () => {
      const services = createMockServices();
      const servers = createMockServers();
      const prisma = createMockPrisma();
      const mockExit = vi.fn();

      // 模擬 HTTP server 關閉失敗
      (servers.httpServer.close as ReturnType<typeof vi.fn>).mockImplementation(
        (cb: (err?: Error) => void) => {
          cb(new Error('Server not running'));
        },
      );

      const shutdown = createShutdownHandler(services, servers, prisma, {
        logger: mockLogger as unknown as typeof import('@/lib/logger').logger,
        exit: mockExit,
      });

      await shutdown();

      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });
});
