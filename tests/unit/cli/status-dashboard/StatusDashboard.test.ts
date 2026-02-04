// @vitest-environment node
/**
 * StatusDashboard 單元測試
 *
 * @feature 071-cli-status-dashboard
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StatusDashboard } from '@/cli/status-dashboard/StatusDashboard';
import type {
  DashboardConfig,
  IDashboardRenderer,
  IStatusCollector,
  SystemStatus,
} from '@/cli/status-dashboard/types';

describe('StatusDashboard', () => {
  let mockRenderer: IDashboardRenderer;
  let mockConfig: DashboardConfig;

  beforeEach(() => {
    vi.useFakeTimers();

    mockRenderer = {
      render: vi.fn(),
      cleanup: vi.fn(),
    };

    mockConfig = {
      enabled: true,
      refreshIntervalMs: 10000,
      forceTty: false,
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('生命週期', () => {
    it('start() 應該初始化並首次渲染', async () => {
      const dashboard = new StatusDashboard(mockConfig, mockRenderer);

      await dashboard.start();

      expect(mockRenderer.render).toHaveBeenCalledTimes(1);
      expect(mockRenderer.render).toHaveBeenCalledWith(
        expect.objectContaining({
          lastUpdated: expect.any(Date),
        })
      );
    });

    it('stop() 應該清理 interval 和渲染器', async () => {
      const dashboard = new StatusDashboard(mockConfig, mockRenderer);

      await dashboard.start();
      dashboard.stop();

      expect(mockRenderer.cleanup).toHaveBeenCalledTimes(1);
    });

    it('stop() 在未啟動時不應拋出錯誤', () => {
      const dashboard = new StatusDashboard(mockConfig, mockRenderer);

      expect(() => dashboard.stop()).not.toThrow();
    });

    it('重複呼叫 start() 不應重複初始化', async () => {
      const dashboard = new StatusDashboard(mockConfig, mockRenderer);

      await dashboard.start();
      await dashboard.start();

      // 只應該渲染一次（首次啟動時）
      expect(mockRenderer.render).toHaveBeenCalledTimes(1);
    });
  });

  describe('refresh()', () => {
    it('refresh() 應該重新渲染狀態', async () => {
      const dashboard = new StatusDashboard(mockConfig, mockRenderer);

      await dashboard.start();
      await dashboard.refresh();

      expect(mockRenderer.render).toHaveBeenCalledTimes(2);
    });

    it('refresh() 在停止後不應渲染', async () => {
      const dashboard = new StatusDashboard(mockConfig, mockRenderer);

      await dashboard.start();
      dashboard.stop();

      const renderCountBeforeRefresh = (mockRenderer.render as ReturnType<typeof vi.fn>).mock.calls.length;
      await dashboard.refresh();

      expect(mockRenderer.render).toHaveBeenCalledTimes(renderCountBeforeRefresh);
    });
  });

  describe('收集器整合', () => {
    it('應該收集所有註冊的收集器資料', async () => {
      const mockSystemStatus: SystemStatus = {
        uptimeSeconds: 3600,
        uptimeFormatted: '1h 0m 0s',
        heapUsedMB: 100,
        heapTotalMB: 200,
        heapUsagePercent: 50,
        proxyEnabled: false,
        proxyUrl: null,
        publicIp: '1.2.3.4',
      };

      const mockCollector: IStatusCollector<SystemStatus> = {
        collect: vi.fn().mockResolvedValue(mockSystemStatus),
        getName: vi.fn().mockReturnValue('SystemStatusCollector'),
      };

      const dashboard = new StatusDashboard(mockConfig, mockRenderer);
      dashboard.registerCollector('system', mockCollector);

      await dashboard.start();

      expect(mockCollector.collect).toHaveBeenCalled();
      expect(mockRenderer.render).toHaveBeenCalledWith(
        expect.objectContaining({
          system: mockSystemStatus,
        })
      );
    });

    it('單一收集器失敗不應影響其他收集器', async () => {
      const failingCollector: IStatusCollector<SystemStatus> = {
        collect: vi.fn().mockRejectedValue(new Error('測試錯誤')),
        getName: vi.fn().mockReturnValue('FailingCollector'),
      };

      const dashboard = new StatusDashboard(mockConfig, mockRenderer);
      dashboard.registerCollector('system', failingCollector);

      // 不應拋出錯誤
      await expect(dashboard.start()).resolves.not.toThrow();

      // 應該仍然渲染（system 為 null）
      expect(mockRenderer.render).toHaveBeenCalledWith(
        expect.objectContaining({
          system: null,
          collectSuccess: false,
        })
      );
    });
  });

  describe('disabled 模式', () => {
    it('enabled=false 時 start() 不應執行任何操作', async () => {
      const disabledConfig: DashboardConfig = {
        ...mockConfig,
        enabled: false,
      };

      const dashboard = new StatusDashboard(disabledConfig, mockRenderer);
      await dashboard.start();

      expect(mockRenderer.render).not.toHaveBeenCalled();
    });
  });
});
