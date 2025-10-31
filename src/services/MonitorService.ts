/**
 * Monitor Service
 * 在 Web 服務器中啟動 FundingRateMonitor
 *
 * 這樣 CLI Monitor 和 Web 服務器可以共享同一個 RatesCache 實例
 */

import { FundingRateMonitor } from './monitor/FundingRateMonitor';
import { FundingRateStore } from '../models/FundingRate';
import { RateDifferenceCalculator } from './monitor/RateDifferenceCalculator';
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
    const store = new FundingRateStore();
    const calculator = new RateDifferenceCalculator(0.005); // 0.5% threshold

    monitorInstance = new FundingRateMonitor({
      binanceApiKey: process.env.BINANCE_API_KEY || '',
      binanceApiSecret: process.env.BINANCE_API_SECRET || '',
      okxApiKey: process.env.OKX_API_KEY || '',
      okxApiSecret: process.env.OKX_API_SECRET || '',
      okxPassphrase: process.env.OKX_PASSPHRASE || '',
      symbols,
      updateInterval: 300000, // 5 分鐘
      isTestnet: process.env.BINANCE_TESTNET === 'true',
      store,
      calculator,
    });

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
