/**
 * CLI 狀態儀表板 - 主入口模組
 *
 * @description 提供工廠函數和 TTY 偵測邏輯
 * @feature 071-cli-status-dashboard
 */

import { StatusDashboard } from './StatusDashboard';
import { TtyRenderer } from './renderers/TtyRenderer';
import { LogRenderer } from './renderers/LogRenderer';
import { SystemStatusCollector } from './collectors/SystemStatusCollector';
import { BusinessMetricsCollector } from './collectors/BusinessMetricsCollector';
import { ConnectionStatusCollector } from './collectors/ConnectionStatusCollector';
import { ErrorStatsCollector } from './collectors/ErrorStatsCollector';
import { loadConfigFromEnv } from './types';
import type { DashboardConfig, IDashboardRenderer } from './types';

// 匯出型別
export type { DashboardConfig, DashboardState, IDashboardRenderer, IStatusCollector } from './types';

// 匯出類別
export { StatusDashboard } from './StatusDashboard';
export { TtyRenderer } from './renderers/TtyRenderer';
export { LogRenderer } from './renderers/LogRenderer';
export { SystemStatusCollector } from './collectors/SystemStatusCollector';
export { BusinessMetricsCollector } from './collectors/BusinessMetricsCollector';
export { ConnectionStatusCollector } from './collectors/ConnectionStatusCollector';
export { ErrorStatsCollector } from './collectors/ErrorStatsCollector';

/**
 * 根據環境選擇渲染器
 *
 * @param config 儀表板配置
 * @returns 適合的渲染器實例
 */
export function selectRenderer(config: DashboardConfig): IDashboardRenderer {
  // 強制 TTY 模式
  if (config.forceTty) {
    return new TtyRenderer();
  }

  // 自動偵測 TTY
  const isTty = process.stdout.isTTY ?? false;

  if (isTty) {
    return new TtyRenderer();
  }

  return new LogRenderer();
}

/**
 * 建立狀態儀表板實例（含所有收集器）
 *
 * @param configOverrides 配置覆寫（選填）
 * @returns StatusDashboard 實例
 */
export function createStatusDashboard(
  configOverrides?: Partial<DashboardConfig>
): StatusDashboard {
  const envConfig = loadConfigFromEnv();
  const config: DashboardConfig = {
    ...envConfig,
    ...configOverrides,
  };

  const renderer = selectRenderer(config);
  const dashboard = new StatusDashboard(config, renderer);

  // 註冊所有收集器
  dashboard.registerCollector('system', new SystemStatusCollector());
  dashboard.registerCollector('business', new BusinessMetricsCollector());
  dashboard.registerCollector('connection', new ConnectionStatusCollector());
  dashboard.registerCollector('errors', new ErrorStatsCollector());

  return dashboard;
}
