/**
 * monitor-init.test.ts
 * Feature: 050-sl-tp-trigger-monitor (Phase 7: Integration)
 *
 * T040-T043: 監控服務初始化和優雅關閉測試
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before importing
vi.mock('@/lib/db', () => ({
  prisma: {
    position: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    notificationWebhook: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    apiKey: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/services/monitor/ConditionalOrderMonitor', () => ({
  ConditionalOrderMonitor: vi.fn().mockImplementation(() => ({
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    isRunning: false,
    intervalMs: 30000,
  })),
}));

describe('monitor-init', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset module state
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // T040: 建立監控服務初始化模組
  describe('T040: initializeConditionalOrderMonitor()', () => {
    it('should create and return a ConditionalOrderMonitor instance', async () => {
      const { initializeConditionalOrderMonitor } = await import('@/lib/monitor-init');

      const monitor = initializeConditionalOrderMonitor();

      expect(monitor).toBeDefined();
      expect(monitor.start).toBeDefined();
      expect(monitor.stop).toBeDefined();
    });

    it('should initialize with custom interval if provided', async () => {
      const { initializeConditionalOrderMonitor } = await import('@/lib/monitor-init');

      const customIntervalMs = 60000;
      const monitor = initializeConditionalOrderMonitor({ intervalMs: customIntervalMs });

      expect(monitor).toBeDefined();
    });

    it('should start the monitor automatically when autoStart is true', async () => {
      const { initializeConditionalOrderMonitor } = await import('@/lib/monitor-init');

      const monitor = initializeConditionalOrderMonitor({ autoStart: true });

      // Give time for async start
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(monitor.start).toHaveBeenCalled();
    });

    it('should not start the monitor when autoStart is false', async () => {
      const { initializeConditionalOrderMonitor } = await import('@/lib/monitor-init');

      const monitor = initializeConditionalOrderMonitor({ autoStart: false });

      expect(monitor.start).not.toHaveBeenCalled();
    });
  });

  // T041: 實作 singleton pattern
  describe('T041: Singleton pattern', () => {
    it('should return the same instance on multiple calls', async () => {
      const { getConditionalOrderMonitor, initializeConditionalOrderMonitor } = await import('@/lib/monitor-init');

      // Initialize first
      initializeConditionalOrderMonitor();

      const instance1 = getConditionalOrderMonitor();
      const instance2 = getConditionalOrderMonitor();

      expect(instance1).toBe(instance2);
    });

    it('should throw error if getConditionalOrderMonitor called before initialization', async () => {
      // Reset modules to clear singleton
      vi.resetModules();

      // Re-mock after reset
      vi.mock('@/lib/db', () => ({
        prisma: {
          position: { findMany: vi.fn().mockResolvedValue([]) },
          notificationWebhook: { findMany: vi.fn().mockResolvedValue([]) },
          apiKey: { findFirst: vi.fn().mockResolvedValue(null) },
        },
      }));

      vi.mock('@/lib/logger', () => ({
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      }));

      vi.mock('@/services/monitor/ConditionalOrderMonitor', () => ({
        ConditionalOrderMonitor: vi.fn().mockImplementation(() => ({
          start: vi.fn().mockResolvedValue(undefined),
          stop: vi.fn().mockResolvedValue(undefined),
          isRunning: false,
          intervalMs: 30000,
        })),
      }));

      const { getConditionalOrderMonitor } = await import('@/lib/monitor-init');

      expect(() => getConditionalOrderMonitor()).toThrow('ConditionalOrderMonitor not initialized');
    });

    it('should allow re-initialization with resetMonitor()', async () => {
      const {
        initializeConditionalOrderMonitor,
        getConditionalOrderMonitor,
        resetMonitor
      } = await import('@/lib/monitor-init');

      // Initialize first instance
      initializeConditionalOrderMonitor();
      const instance1 = getConditionalOrderMonitor();

      // Reset
      await resetMonitor();

      // Initialize second instance
      initializeConditionalOrderMonitor();
      const instance2 = getConditionalOrderMonitor();

      // Should be different instances (new mock object)
      expect(instance1).not.toBe(instance2);
    });
  });

  // T043: 實作 SIGINT/SIGTERM 信號處理
  describe('T043: Graceful shutdown', () => {
    it('should stop the monitor on graceful shutdown', async () => {
      const { initializeConditionalOrderMonitor, gracefulShutdown } = await import('@/lib/monitor-init');

      const monitor = initializeConditionalOrderMonitor();

      await gracefulShutdown();

      expect(monitor.stop).toHaveBeenCalled();
    });

    it('should handle shutdown when monitor is not running', async () => {
      const { gracefulShutdown } = await import('@/lib/monitor-init');

      // Should not throw even if monitor not initialized
      await expect(gracefulShutdown()).resolves.not.toThrow();
    });

    it('should register signal handlers when setupSignalHandlers is called', async () => {
      const { setupSignalHandlers } = await import('@/lib/monitor-init');

      const processOnSpy = vi.spyOn(process, 'on');

      setupSignalHandlers();

      // Should register both SIGINT and SIGTERM handlers
      expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));

      processOnSpy.mockRestore();
    });
  });

  // getMonitorStatus
  describe('getMonitorStatus()', () => {
    it('should return monitor status when initialized', async () => {
      const { initializeConditionalOrderMonitor, getMonitorStatus } = await import('@/lib/monitor-init');

      initializeConditionalOrderMonitor();

      const status = getMonitorStatus();

      expect(status).toEqual({
        initialized: true,
        isRunning: expect.any(Boolean),
        intervalMs: expect.any(Number),
      });
    });

    it('should return not initialized status when monitor not created', async () => {
      vi.resetModules();

      // Re-mock
      vi.mock('@/lib/db', () => ({
        prisma: {
          position: { findMany: vi.fn().mockResolvedValue([]) },
          notificationWebhook: { findMany: vi.fn().mockResolvedValue([]) },
          apiKey: { findFirst: vi.fn().mockResolvedValue(null) },
        },
      }));

      vi.mock('@/lib/logger', () => ({
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      }));

      vi.mock('@/services/monitor/ConditionalOrderMonitor', () => ({
        ConditionalOrderMonitor: vi.fn().mockImplementation(() => ({
          start: vi.fn().mockResolvedValue(undefined),
          stop: vi.fn().mockResolvedValue(undefined),
          isRunning: false,
          intervalMs: 30000,
        })),
      }));

      const { getMonitorStatus } = await import('@/lib/monitor-init');

      const status = getMonitorStatus();

      expect(status).toEqual({
        initialized: false,
        isRunning: false,
        intervalMs: 0,
      });
    });
  });
});
