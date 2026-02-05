/**
 * SystemStatusCollector - 系統狀態收集器
 *
 * @description 收集系統運行時間、記憶體使用量、Proxy 狀態和公開 IP
 * @feature 071-cli-status-dashboard
 */

import { getPublicIp } from '@/lib/public-ip';
import { getMemoryStats } from '@/lib/memory-monitor';
import { getMonitorInstance } from '@/services/MonitorService';
import type { IStatusCollector, SystemStatus } from '../types';

export class SystemStatusCollector implements IStatusCollector<SystemStatus> {
  private readonly startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  /**
   * 收集系統狀態
   */
  async collect(): Promise<SystemStatus> {
    const [uptime, memory, proxy, publicIp] = await Promise.all([
      this.collectUptime(),
      this.collectMemory(),
      this.collectProxy(),
      this.collectPublicIp(),
    ]);

    return {
      ...uptime,
      ...memory,
      ...proxy,
      publicIp,
    };
  }

  /**
   * 取得收集器名稱
   */
  getName(): string {
    return 'SystemStatusCollector';
  }

  /**
   * 收集運行時間
   */
  private collectUptime(): {
    uptimeSeconds: number;
    uptimeFormatted: string;
  } {
    try {
      const monitor = getMonitorInstance();
      if (monitor) {
        const formatted = monitor.getFormattedUptime();
        const seconds = Math.floor((Date.now() - this.startTime) / 1000);
        return {
          uptimeSeconds: seconds,
          uptimeFormatted: formatted,
        };
      }
    } catch {
      // 監控服務尚未初始化
    }

    // 使用本地計算的運行時間
    const seconds = Math.floor((Date.now() - this.startTime) / 1000);
    return {
      uptimeSeconds: seconds,
      uptimeFormatted: this.formatUptime(seconds),
    };
  }

  /**
   * 收集記憶體狀態
   */
  private collectMemory(): {
    heapUsedMB: number;
    heapTotalMB: number;
    heapUsagePercent: number;
  } {
    try {
      const stats = getMemoryStats();
      // getMemoryStats() 已回傳 MB 單位，直接四捨五入到整數
      return {
        heapUsedMB: Math.round(stats.heapUsed),
        heapTotalMB: Math.round(stats.heapTotal),
        heapUsagePercent: stats.heapUsagePercent,
      };
    } catch {
      // 記憶體監控尚未初始化
      return {
        heapUsedMB: 0,
        heapTotalMB: 0,
        heapUsagePercent: 0,
      };
    }
  }

  /**
   * 收集 Proxy 狀態
   */
  private collectProxy(): {
    proxyEnabled: boolean;
    proxyUrl: string | null;
  } {
    const proxyUrl = process.env.PROXY_URL?.trim() || null;
    return {
      proxyEnabled: !!proxyUrl,
      proxyUrl,
    };
  }

  /**
   * 收集公開 IP
   */
  private async collectPublicIp(): Promise<string | null> {
    return getPublicIp();
  }

  /**
   * 格式化運行時間
   */
  private formatUptime(totalSeconds: number): string {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);

    return parts.join(' ');
  }
}
