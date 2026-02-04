// @vitest-environment node
/**
 * LogRenderer 單元測試
 *
 * @feature 071-cli-status-dashboard
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LogRenderer } from '@/cli/status-dashboard/renderers/LogRenderer';
import type {
  DashboardState,
  SystemStatus,
  BusinessMetrics,
  ConnectionStatus,
  ErrorStats,
} from '@/cli/status-dashboard/types';
import * as loggerModule from '@/lib/logger';

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
  },
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    debug: vi.fn(),
  })),
}));

describe('LogRenderer', () => {
  let mockLogger: { info: ReturnType<typeof vi.fn>; debug: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      debug: vi.fn(),
    };
    vi.mocked(loggerModule.createLogger).mockReturnValue(mockLogger as ReturnType<typeof loggerModule.createLogger>);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createMockState = (overrides: Partial<DashboardState> = {}): DashboardState => ({
    system: null,
    business: null,
    connection: null,
    errors: null,
    lastUpdated: new Date('2026-02-04T14:30:00Z'),
    collectSuccess: true,
    ...overrides,
  });

  describe('render()', () => {
    it('應該輸出結構化 JSON 日誌', () => {
      const renderer = new LogRenderer();
      const state = createMockState();

      renderer.render(state);

      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('應該包含所有必要欄位', () => {
      const renderer = new LogRenderer();
      const systemStatus: SystemStatus = {
        uptimeSeconds: 8130,
        uptimeFormatted: '2h 15m 30s',
        heapUsedMB: 384,
        heapTotalMB: 512,
        heapUsagePercent: 75,
        proxyEnabled: true,
        proxyUrl: '192.168.2.254:3128',
        publicIp: '203.0.113.42',
      };
      const businessMetrics: BusinessMetrics = {
        activeOpportunities: 12,
        monitoredSymbols: 85,
        connectedExchanges: 5,
        exchangeList: ['Binance', 'OKX', 'Gate.io', 'BingX', 'MEXC'],
      };
      const connectionStatus: ConnectionStatus = {
        exchanges: [
          { exchange: 'Binance', wsStatus: 'connected', dataSourceMode: 'websocket', lastDataTime: new Date() },
        ],
        overallHealth: 80,
        connectedCount: 4,
        totalCount: 5,
      };
      const errorStats: ErrorStats = {
        totalErrors: 3,
        lastErrorTime: new Date('2026-02-04T14:00:00Z'),
      };

      const state = createMockState({
        system: systemStatus,
        business: businessMetrics,
        connection: connectionStatus,
        errors: errorStats,
      });

      renderer.render(state);

      const logCall = mockLogger.info.mock.calls[0];
      const logData = logCall[0];

      expect(logData).toMatchObject({
        uptime: '2h 15m 30s',
        memory: {
          used: 384,
          total: 512,
          percent: 75,
        },
        proxy: {
          enabled: true,
          url: '192.168.2.254:3128',
        },
        publicIp: '203.0.113.42',
        opportunities: 12,
        symbols: 85,
        exchanges: 5,
        wsStatus: {
          connected: 4,
          total: 5,
        },
        errors: 3,
      });
    });

    it('系統狀態為 null 時應該使用預設值', () => {
      const renderer = new LogRenderer();
      const state = createMockState({ system: null });

      renderer.render(state);

      const logCall = mockLogger.info.mock.calls[0];
      const logData = logCall[0];

      expect(logData.uptime).toBe('載入中...');
      expect(logData.memory).toEqual({ used: 0, total: 0, percent: 0 });
    });
  });

  describe('cleanup()', () => {
    it('cleanup() 不應拋出錯誤', () => {
      const renderer = new LogRenderer();

      expect(() => renderer.cleanup()).not.toThrow();
    });
  });
});
