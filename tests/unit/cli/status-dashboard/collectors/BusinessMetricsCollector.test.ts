// @vitest-environment node
/**
 * BusinessMetricsCollector 單元測試
 *
 * @feature 071-cli-status-dashboard
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BusinessMetricsCollector } from '@/cli/status-dashboard/collectors/BusinessMetricsCollector';

// Mock 依賴
vi.mock('@/services/MonitorService', () => ({
  getMonitorInstance: vi.fn(),
  getTrackerInstance: vi.fn(),
}));

vi.mock('@/lib/exchanges/constants', () => ({
  ACTIVE_EXCHANGES: ['binance', 'okx', 'gateio', 'bingx', 'mexc'],
  EXCHANGE_CONFIGS: {
    binance: { displayName: 'Binance' },
    okx: { displayName: 'OKX' },
    gateio: { displayName: 'Gate.io' },
    bingx: { displayName: 'BingX' },
    mexc: { displayName: 'MEXC' },
  },
}));

import { getMonitorInstance, getTrackerInstance } from '@/services/MonitorService';

describe('BusinessMetricsCollector', () => {
  let mockMonitor: {
    getStats: ReturnType<typeof vi.fn>;
    getStatus: ReturnType<typeof vi.fn>;
  };
  let mockTracker: {
    getTopAPY: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // 設定 getMonitorInstance mock
    mockMonitor = {
      getStats: vi.fn().mockReturnValue({
        activeOpportunities: 12,
        errorCount: 3,
      }),
      getStatus: vi.fn().mockReturnValue({
        isRunning: true,
        symbols: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'],
        connectedExchanges: ['binance', 'okx', 'gateio'],
      }),
    };
    vi.mocked(getMonitorInstance).mockReturnValue(
      mockMonitor as unknown as ReturnType<typeof getMonitorInstance>
    );

    // 設定 getTrackerInstance mock
    mockTracker = {
      getTopAPY: vi.fn().mockReturnValue(1250.5),
    };
    vi.mocked(getTrackerInstance).mockReturnValue(
      mockTracker as unknown as ReturnType<typeof getTrackerInstance>
    );
  });

  describe('collect()', () => {
    it('應該收集完整的業務指標', async () => {
      const collector = new BusinessMetricsCollector();
      const result = await collector.collect();

      expect(result).not.toBeNull();
      expect(result).toMatchObject({
        activeOpportunities: 12,
        topAPY: 1250.5,
        monitoredSymbols: 3,
        connectedExchanges: 5,
        exchangeList: ['Binance', 'OKX', 'Gate.io', 'BingX', 'MEXC'],
      });
    });

    it('監控服務未初始化時應使用預設值', async () => {
      vi.mocked(getMonitorInstance).mockReturnValue(null);
      vi.mocked(getTrackerInstance).mockReturnValue(null);

      const collector = new BusinessMetricsCollector();
      const result = await collector.collect();

      expect(result?.activeOpportunities).toBe(0);
      expect(result?.topAPY).toBeNull();
      expect(result?.monitoredSymbols).toBe(0);
    });

    it('應該正確取得 ACTIVE_EXCHANGES 的數量', async () => {
      const collector = new BusinessMetricsCollector();
      const result = await collector.collect();

      expect(result?.connectedExchanges).toBe(5);
    });

    it('無活躍機會時 topAPY 應為 null', async () => {
      mockTracker.getTopAPY.mockReturnValue(null);

      const collector = new BusinessMetricsCollector();
      const result = await collector.collect();

      expect(result?.topAPY).toBeNull();
    });
  });

  describe('getName()', () => {
    it('應該回傳正確的收集器名稱', () => {
      const collector = new BusinessMetricsCollector();
      expect(collector.getName()).toBe('BusinessMetricsCollector');
    });
  });
});
