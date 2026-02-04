// @vitest-environment node
/**
 * TtyRenderer 單元測試
 *
 * @feature 071-cli-status-dashboard
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TtyRenderer } from '@/cli/status-dashboard/renderers/TtyRenderer';
import type { DashboardState, SystemStatus } from '@/cli/status-dashboard/types';

describe('TtyRenderer', () => {
  let originalWrite: typeof process.stdout.write;
  let writtenOutput: string;

  beforeEach(() => {
    writtenOutput = '';
    originalWrite = process.stdout.write;
    process.stdout.write = vi.fn((chunk: string | Uint8Array) => {
      writtenOutput += chunk.toString();
      return true;
    }) as typeof process.stdout.write;
  });

  afterEach(() => {
    process.stdout.write = originalWrite;
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
    it('應該輸出 ANSI 清屏控制碼', () => {
      const renderer = new TtyRenderer();
      const state = createMockState();

      renderer.render(state);

      // 檢查清屏控制碼
      expect(writtenOutput).toContain('\x1B[2J');
      expect(writtenOutput).toContain('\x1B[0;0H');
    });

    it('應該顯示儀表板框線', () => {
      const renderer = new TtyRenderer();
      const state = createMockState();

      renderer.render(state);

      expect(writtenOutput).toContain('╔');
      expect(writtenOutput).toContain('╚');
    });

    it('應該顯示標題', () => {
      const renderer = new TtyRenderer();
      const state = createMockState();

      renderer.render(state);

      expect(writtenOutput).toContain('狀態儀表板');
    });

    it('應該顯示最後更新時間', () => {
      const renderer = new TtyRenderer();
      const state = createMockState();

      renderer.render(state);

      expect(writtenOutput).toContain('最後更新');
    });
  });

  describe('系統狀態區塊', () => {
    it('system 為 null 時應顯示載入中', () => {
      const renderer = new TtyRenderer();
      const state = createMockState({ system: null });

      renderer.render(state);

      expect(writtenOutput).toContain('載入中');
    });

    it('應該正確顯示系統狀態', () => {
      const renderer = new TtyRenderer();
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
      const state = createMockState({ system: systemStatus });

      renderer.render(state);

      expect(writtenOutput).toContain('2h 15m 30s');
      expect(writtenOutput).toContain('384');
      expect(writtenOutput).toContain('512');
      expect(writtenOutput).toContain('75%');
      expect(writtenOutput).toContain('啟用');
      expect(writtenOutput).toContain('203.0.113.42');
    });

    it('publicIp 為 null 時應顯示無法取得', () => {
      const renderer = new TtyRenderer();
      const systemStatus: SystemStatus = {
        uptimeSeconds: 0,
        uptimeFormatted: '0s',
        heapUsedMB: 100,
        heapTotalMB: 200,
        heapUsagePercent: 50,
        proxyEnabled: false,
        proxyUrl: null,
        publicIp: null,
      };
      const state = createMockState({ system: systemStatus });

      renderer.render(state);

      expect(writtenOutput).toContain('無法取得');
    });
  });

  describe('cleanup()', () => {
    it('應該輸出清屏', () => {
      const renderer = new TtyRenderer();

      renderer.cleanup();

      expect(writtenOutput).toContain('\x1B[2J');
    });
  });
});
