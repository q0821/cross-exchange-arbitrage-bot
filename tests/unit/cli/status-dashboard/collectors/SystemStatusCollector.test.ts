// @vitest-environment node
/**
 * SystemStatusCollector 單元測試
 *
 * @feature 071-cli-status-dashboard
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SystemStatusCollector } from '@/cli/status-dashboard/collectors/SystemStatusCollector';

// Mock 依賴
vi.mock('@/lib/public-ip', () => ({
  getPublicIp: vi.fn(),
}));

vi.mock('@/lib/memory-monitor', () => ({
  getMemoryStats: vi.fn(),
}));

vi.mock('@/services/MonitorService', () => ({
  getMonitorInstance: vi.fn(),
}));

import { getPublicIp } from '@/lib/public-ip';
import { getMemoryStats } from '@/lib/memory-monitor';
import { getMonitorInstance } from '@/services/MonitorService';

describe('SystemStatusCollector', () => {
  let mockMonitor: {
    getFormattedUptime: ReturnType<typeof vi.fn>;
    getStats: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // 設定 getMonitorInstance mock
    mockMonitor = {
      getFormattedUptime: vi.fn().mockReturnValue('1h 30m 0s'),
      getStats: vi.fn().mockReturnValue({
        errorCount: 5,
        activeOpportunities: 10,
      }),
    };
    vi.mocked(getMonitorInstance).mockReturnValue(mockMonitor as unknown as ReturnType<typeof getMonitorInstance>);

    // 設定 getMemoryStats mock（回傳值已是 MB 單位）
    vi.mocked(getMemoryStats).mockReturnValue({
      heapUsed: 100, // 100 MB
      heapTotal: 200, // 200 MB
      external: 10,
      rss: 250,
      arrayBuffers: 5,
      heapUsagePercent: 50,
    });

    // 設定 getPublicIp mock
    vi.mocked(getPublicIp).mockResolvedValue('1.2.3.4');
  });

  afterEach(() => {
    // 清理環境變數
    delete process.env.PROXY_URL;
  });

  describe('collect()', () => {
    it('應該收集完整的系統狀態', async () => {
      const collector = new SystemStatusCollector();
      const result = await collector.collect();

      expect(result).not.toBeNull();
      expect(result).toMatchObject({
        uptimeFormatted: '1h 30m 0s',
        heapUsedMB: 100,
        heapTotalMB: 200,
        heapUsagePercent: 50,
        proxyEnabled: false,
        proxyUrl: null,
        publicIp: '1.2.3.4',
      });
    });

    it('應該正確計算 uptimeSeconds', async () => {
      const collector = new SystemStatusCollector();
      const result = await collector.collect();

      expect(result?.uptimeSeconds).toBeGreaterThanOrEqual(0);
    });

    it('應該正確讀取 PROXY_URL 環境變數', async () => {
      process.env.PROXY_URL = 'http://proxy.example.com:8080';

      const collector = new SystemStatusCollector();
      const result = await collector.collect();

      expect(result?.proxyEnabled).toBe(true);
      expect(result?.proxyUrl).toBe('http://proxy.example.com:8080');
    });

    it('PROXY_URL 為空字串時 proxyEnabled 應為 false', async () => {
      process.env.PROXY_URL = '';

      const collector = new SystemStatusCollector();
      const result = await collector.collect();

      expect(result?.proxyEnabled).toBe(false);
      expect(result?.proxyUrl).toBeNull();
    });

    it('publicIp 取得失敗時應為 null', async () => {
      vi.mocked(getPublicIp).mockResolvedValue(null);

      const collector = new SystemStatusCollector();
      const result = await collector.collect();

      expect(result?.publicIp).toBeNull();
    });

    it('記憶體統計取得失敗時應使用預設值', async () => {
      vi.mocked(getMemoryStats).mockImplementation(() => {
        throw new Error('記憶體監控未初始化');
      });

      const collector = new SystemStatusCollector();
      const result = await collector.collect();

      expect(result?.heapUsedMB).toBe(0);
      expect(result?.heapTotalMB).toBe(0);
      expect(result?.heapUsagePercent).toBe(0);
    });
  });

  describe('getName()', () => {
    it('應該回傳正確的收集器名稱', () => {
      const collector = new SystemStatusCollector();
      expect(collector.getName()).toBe('SystemStatusCollector');
    });
  });
});
