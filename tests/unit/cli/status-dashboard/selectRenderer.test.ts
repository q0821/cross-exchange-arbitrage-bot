// @vitest-environment node
/**
 * selectRenderer 和 detectTty 單元測試
 *
 * @feature 071-cli-status-dashboard
 */

import { describe, it, expect, afterEach } from 'vitest';
import type { DashboardConfig } from '@/cli/status-dashboard/types';
import { selectRenderer, detectTty } from '@/cli/status-dashboard';
import { TtyRenderer } from '@/cli/status-dashboard/renderers/TtyRenderer';
import { LogRenderer } from '@/cli/status-dashboard/renderers/LogRenderer';

describe('detectTty', () => {
  const originalStdout = process.stdout.isTTY;
  const originalStderr = process.stderr.isTTY;
  const originalStdin = process.stdin.isTTY;

  afterEach(() => {
    // 恢復原始值
    Object.defineProperty(process.stdout, 'isTTY', {
      value: originalStdout,
      writable: true,
    });
    Object.defineProperty(process.stderr, 'isTTY', {
      value: originalStderr,
      writable: true,
    });
    Object.defineProperty(process.stdin, 'isTTY', {
      value: originalStdin,
      writable: true,
    });
  });

  it('stdout 為 TTY 時應返回 true', () => {
    Object.defineProperty(process.stdout, 'isTTY', { value: true, writable: true });
    Object.defineProperty(process.stderr, 'isTTY', { value: false, writable: true });
    Object.defineProperty(process.stdin, 'isTTY', { value: false, writable: true });

    expect(detectTty()).toBe(true);
  });

  it('stderr 為 TTY 時應返回 true（pipe 環境）', () => {
    // 模擬 pipe 環境：stdout 被重定向，但 stderr 仍連接終端機
    Object.defineProperty(process.stdout, 'isTTY', { value: false, writable: true });
    Object.defineProperty(process.stderr, 'isTTY', { value: true, writable: true });
    Object.defineProperty(process.stdin, 'isTTY', { value: false, writable: true });

    expect(detectTty()).toBe(true);
  });

  it('stdin 為 TTY 時應返回 true', () => {
    Object.defineProperty(process.stdout, 'isTTY', { value: false, writable: true });
    Object.defineProperty(process.stderr, 'isTTY', { value: false, writable: true });
    Object.defineProperty(process.stdin, 'isTTY', { value: true, writable: true });

    expect(detectTty()).toBe(true);
  });

  it('所有 stream 都非 TTY 時應返回 false', () => {
    Object.defineProperty(process.stdout, 'isTTY', { value: false, writable: true });
    Object.defineProperty(process.stderr, 'isTTY', { value: false, writable: true });
    Object.defineProperty(process.stdin, 'isTTY', { value: false, writable: true });

    expect(detectTty()).toBe(false);
  });

  it('isTTY 為 undefined 時應返回 false', () => {
    Object.defineProperty(process.stdout, 'isTTY', { value: undefined, writable: true });
    Object.defineProperty(process.stderr, 'isTTY', { value: undefined, writable: true });
    Object.defineProperty(process.stdin, 'isTTY', { value: undefined, writable: true });

    expect(detectTty()).toBe(false);
  });
});

describe('selectRenderer', () => {
  const originalStdout = process.stdout.isTTY;
  const originalStderr = process.stderr.isTTY;
  const originalStdin = process.stdin.isTTY;

  const defaultConfig: DashboardConfig = {
    enabled: true,
    refreshIntervalMs: 10000,
    forceTty: false,
  };

  afterEach(() => {
    // 恢復原始值
    Object.defineProperty(process.stdout, 'isTTY', {
      value: originalStdout,
      writable: true,
    });
    Object.defineProperty(process.stderr, 'isTTY', {
      value: originalStderr,
      writable: true,
    });
    Object.defineProperty(process.stdin, 'isTTY', {
      value: originalStdin,
      writable: true,
    });
  });

  it('forceTty=true 時應返回 TtyRenderer', () => {
    Object.defineProperty(process.stdout, 'isTTY', { value: false, writable: true });
    Object.defineProperty(process.stderr, 'isTTY', { value: false, writable: true });
    Object.defineProperty(process.stdin, 'isTTY', { value: false, writable: true });

    const config: DashboardConfig = { ...defaultConfig, forceTty: true };
    const renderer = selectRenderer(config);

    expect(renderer).toBeInstanceOf(TtyRenderer);
  });

  it('TTY 環境應返回 TtyRenderer', () => {
    Object.defineProperty(process.stdout, 'isTTY', { value: true, writable: true });
    Object.defineProperty(process.stderr, 'isTTY', { value: false, writable: true });
    Object.defineProperty(process.stdin, 'isTTY', { value: false, writable: true });

    const renderer = selectRenderer(defaultConfig);

    expect(renderer).toBeInstanceOf(TtyRenderer);
  });

  it('pipe 環境（stderr 為 TTY）應返回 TtyRenderer', () => {
    // 模擬 `cmd | pino-pretty` 環境
    Object.defineProperty(process.stdout, 'isTTY', { value: false, writable: true });
    Object.defineProperty(process.stderr, 'isTTY', { value: true, writable: true });
    Object.defineProperty(process.stdin, 'isTTY', { value: false, writable: true });

    const renderer = selectRenderer(defaultConfig);

    expect(renderer).toBeInstanceOf(TtyRenderer);
  });

  it('非 TTY 環境應返回 LogRenderer', () => {
    Object.defineProperty(process.stdout, 'isTTY', { value: false, writable: true });
    Object.defineProperty(process.stderr, 'isTTY', { value: false, writable: true });
    Object.defineProperty(process.stdin, 'isTTY', { value: false, writable: true });

    const renderer = selectRenderer(defaultConfig);

    expect(renderer).toBeInstanceOf(LogRenderer);
  });
});
