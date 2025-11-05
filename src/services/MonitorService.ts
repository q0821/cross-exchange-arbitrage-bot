/**
 * Monitor Service
 * 在 Web 服務器中啟動 FundingRateMonitor
 *
 * 這樣 CLI Monitor 和 Web 服務器可以共享同一個 RatesCache 實例
 */

import { FundingRateMonitor } from './monitor/FundingRateMonitor';
import { logger } from '../lib/logger';
import { readFileSync } from 'fs';
import { join } from 'path';

interface SymbolsConfig {
  groups: {
    [key: string]: {
      name: string;
      symbols: string[];
    };
  };
}

let monitorInstance: FundingRateMonitor | null = null;

/**
 * 啟動內建的資金費率監控服務
 */
export async function startMonitorService(): Promise<void> {
  if (monitorInstance) {
    logger.warn('Monitor service is already running');
    return;
  }

  try {
    // 讀取交易對配置
    const configPath = join(process.cwd(), 'config', 'symbols.json');
    const configContent = readFileSync(configPath, 'utf-8');
    const config: SymbolsConfig = JSON.parse(configContent);

    // 使用 top10 群組的交易對
    const symbols = config.groups.top10?.symbols || [];

    if (symbols.length === 0) {
      logger.warn('No symbols configured for monitoring');
      return;
    }

    logger.info(
      {
        symbols: symbols.length,
        group: 'top10',
      },
      'Starting built-in funding rate monitor',
    );

    // 創建 Monitor 實例
    // 注意：FundingRateMonitor 使用位置參數，不是對象參數
    const updateInterval = parseInt(process.env.FUNDING_RATE_CHECK_INTERVAL_MS || '300000', 10);
    const minSpreadThreshold = parseFloat(process.env.MIN_SPREAD_THRESHOLD || '0.005');

    // 從環境變數讀取要監控的交易所列表（逗號分隔），預設為所有 4 個交易所
    const exchangesEnv = process.env.MONITORED_EXCHANGES || 'binance,okx,mexc,gateio';
    const exchanges = exchangesEnv.split(',').map((e) => e.trim()) as ('binance' | 'okx' | 'mexc' | 'gateio')[];

    monitorInstance = new FundingRateMonitor(
      symbols,                                            // 第1個參數：交易對數組
      updateInterval,                                     // 第2個參數：更新間隔（從環境變數讀取）
      minSpreadThreshold,                                 // 第3個參數：最小差價閾值（從環境變數讀取）
      process.env.BINANCE_TESTNET === 'true',            // 第4個參數：是否測試網
      {
        exchanges,                                        // 指定要監控的交易所列表
      },
    );

    // 監聽錯誤
    monitorInstance.on('error', (error) => {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        'Monitor service error',
      );
    });

    // 啟動監控
    await monitorInstance.start();

    logger.info('Built-in funding rate monitor started successfully');
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      'Failed to start monitor service',
    );
    throw error;
  }
}

/**
 * 停止監控服務
 */
export async function stopMonitorService(): Promise<void> {
  if (!monitorInstance) {
    return;
  }

  try {
    await monitorInstance.stop();
    monitorInstance = null;
    logger.info('Built-in funding rate monitor stopped');
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      'Failed to stop monitor service',
    );
  }
}

/**
 * 獲取監控實例
 */
export function getMonitorInstance(): FundingRateMonitor | null {
  return monitorInstance;
}
