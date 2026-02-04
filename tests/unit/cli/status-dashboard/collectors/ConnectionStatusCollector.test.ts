// @vitest-environment node
/**
 * ConnectionStatusCollector 單元測試
 *
 * @feature 071-cli-status-dashboard
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConnectionStatusCollector } from '@/cli/status-dashboard/collectors/ConnectionStatusCollector';

// Mock 依賴
vi.mock('@/services/monitor/DataSourceManager', () => ({
  DataSourceManager: {
    getInstance: vi.fn(),
  },
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

import { DataSourceManager } from '@/services/monitor/DataSourceManager';
import type { DataSourceSummary } from '@/types/data-source';

describe('ConnectionStatusCollector', () => {
  let mockDataSourceManager: {
    getSummary: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    const mockSummary: DataSourceSummary = {
      total: 5,
      websocketCount: 4,
      restCount: 1,
      hybridCount: 0,
      byExchange: {
        binance: { fundingRate: 'websocket' },
        okx: { fundingRate: 'websocket' },
        gateio: { fundingRate: 'websocket' },
        bingx: { fundingRate: 'websocket' },
        mexc: { fundingRate: 'rest' },
      } as DataSourceSummary['byExchange'],
    };

    mockDataSourceManager = {
      getSummary: vi.fn().mockReturnValue(mockSummary),
    };
    vi.mocked(DataSourceManager.getInstance).mockReturnValue(
      mockDataSourceManager as unknown as ReturnType<typeof DataSourceManager.getInstance>
    );
  });

  describe('collect()', () => {
    it('應該收集完整的連線狀態', async () => {
      const collector = new ConnectionStatusCollector();
      const result = await collector.collect();

      expect(result).not.toBeNull();
      expect(result?.totalCount).toBe(5);
      expect(result?.connectedCount).toBe(4);
      expect(result?.overallHealth).toBe(80); // 4/5 * 100
    });

    it('應該正確轉換各交易所狀態', async () => {
      const collector = new ConnectionStatusCollector();
      const result = await collector.collect();

      expect(result?.exchanges).toHaveLength(5);

      const binance = result?.exchanges.find((e) => e.exchange === 'Binance');
      expect(binance?.wsStatus).toBe('connected');
      expect(binance?.dataSourceMode).toBe('websocket');

      const mexc = result?.exchanges.find((e) => e.exchange === 'MEXC');
      expect(mexc?.wsStatus).toBe('disconnected');
      expect(mexc?.dataSourceMode).toBe('rest');
    });

    it('DataSourceManager 未初始化時應使用預設值', async () => {
      vi.mocked(DataSourceManager.getInstance).mockImplementation(() => {
        throw new Error('未初始化');
      });

      const collector = new ConnectionStatusCollector();
      const result = await collector.collect();

      expect(result?.exchanges).toHaveLength(5);
      expect(result?.connectedCount).toBe(0);
      expect(result?.overallHealth).toBe(0);
    });
  });

  describe('getName()', () => {
    it('應該回傳正確的收集器名稱', () => {
      const collector = new ConnectionStatusCollector();
      expect(collector.getName()).toBe('ConnectionStatusCollector');
    });
  });
});
