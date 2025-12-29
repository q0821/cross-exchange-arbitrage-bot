/**
 * monitor-status.test.ts
 * Feature: 050-sl-tp-trigger-monitor (Phase 7: Integration)
 *
 * T044: 監控狀態查詢 API 測試
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock monitor-init
vi.mock('@/lib/monitor-init', () => ({
  getMonitorStatus: vi.fn(),
  initializeConditionalOrderMonitor: vi.fn(),
}));

// Mock auth
vi.mock('@/lib/jwt', () => ({
  verifyToken: vi.fn().mockResolvedValue({ userId: 'test-user-id' }),
}));

describe('T044: Monitor Status API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/monitor/status', () => {
    it('should return monitor status when initialized', async () => {
      const { getMonitorStatus } = await import('@/lib/monitor-init');
      (getMonitorStatus as ReturnType<typeof vi.fn>).mockReturnValue({
        initialized: true,
        isRunning: true,
        intervalMs: 30000,
      });

      const { GET } = await import('@/app/api/monitor/status/route');

      const request = new NextRequest('http://localhost:3000/api/monitor/status');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        status: 'ok',
        monitor: {
          initialized: true,
          isRunning: true,
          intervalMs: 30000,
        },
        timestamp: expect.any(String),
      });
    });

    it('should return not initialized status when monitor not created', async () => {
      const { getMonitorStatus } = await import('@/lib/monitor-init');
      (getMonitorStatus as ReturnType<typeof vi.fn>).mockReturnValue({
        initialized: false,
        isRunning: false,
        intervalMs: 0,
      });

      const { GET } = await import('@/app/api/monitor/status/route');

      const request = new NextRequest('http://localhost:3000/api/monitor/status');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        status: 'ok',
        monitor: {
          initialized: false,
          isRunning: false,
          intervalMs: 0,
        },
        timestamp: expect.any(String),
      });
    });

    it('should return stopped status when monitor initialized but not running', async () => {
      const { getMonitorStatus } = await import('@/lib/monitor-init');
      (getMonitorStatus as ReturnType<typeof vi.fn>).mockReturnValue({
        initialized: true,
        isRunning: false,
        intervalMs: 30000,
      });

      const { GET } = await import('@/app/api/monitor/status/route');

      const request = new NextRequest('http://localhost:3000/api/monitor/status');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.monitor.initialized).toBe(true);
      expect(data.monitor.isRunning).toBe(false);
    });
  });
});
