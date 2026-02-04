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
// Feature 026: 導入 db.ts 以初始化 NotificationService
import '../lib/db';
// 記憶體監控
import { startMemoryMonitor, stopMemoryMonitor } from '../lib/memory-monitor';
// 記憶體洩漏追蹤（追蹤 timers、handles、detached contexts）
import { memoryLeakTracker } from '../lib/memory-leak-tracker';
import { ACTIVE_EXCHANGES } from '../lib/exchanges/constants';
// Feature 065: 套利機會追蹤
import { ArbitrageOpportunityTracker } from './monitor/ArbitrageOpportunityTracker';
import { ArbitrageOpportunityRepository } from '../repositories/ArbitrageOpportunityRepository';
// Feature 067: 持倉平倉建議監控
import { PositionExitMonitor } from './monitor/PositionExitMonitor';

interface SymbolsConfig {
  groups: {
    [key: string]: {
      name: string;
      symbols: string[];
    };
  };
}

let monitorInstance: FundingRateMonitor | null = null;
let trackerInstance: ArbitrageOpportunityTracker | null = null;
// Feature 067: 持倉平倉建議監控實例
let positionExitMonitorInstance: PositionExitMonitor | null = null;

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

    // 使用 top100_oi 群組的交易對（OI 前 100，每 30 分鐘自動更新）
    // 如果為空，fallback 到 top30 群組
    let symbols = config.groups.top100_oi?.symbols || [];
    let groupUsed = 'top100_oi';

    if (symbols.length === 0) {
      logger.warn('top100_oi group is empty, falling back to top30');
      symbols = config.groups.top30?.symbols || [];
      groupUsed = 'top30';
    }

    if (symbols.length === 0) {
      logger.warn('No symbols configured for monitoring in both top100_oi and top30 groups');
      // 使用最小的預設交易對確保服務能啟動
      symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
      groupUsed = 'default_fallback';
      logger.info('Using minimal default symbols: BTCUSDT, ETHUSDT, SOLUSDT');
    }

    logger.info(
      {
        symbols: symbols.length,
        group: groupUsed,
      },
      `Starting built-in funding rate monitor with ${groupUsed} group`,
    );

    // 創建 Monitor 實例
    // 注意：FundingRateMonitor 使用位置參數，不是對象參數
    const updateInterval = parseInt(process.env.FUNDING_RATE_CHECK_INTERVAL_MS || '300000', 10);
    const minSpreadThreshold = parseFloat(process.env.MIN_SPREAD_THRESHOLD || '0.005');

    // 從環境變數讀取要監控的交易所列表（逗號分隔），預設為 ACTIVE_EXCHANGES
    const exchangesEnv = process.env.MONITORED_EXCHANGES;
    const exchanges = exchangesEnv
      ? exchangesEnv.split(',').map((e) => e.trim()) as ('binance' | 'okx' | 'mexc' | 'gateio' | 'bingx')[]
      : [...ACTIVE_EXCHANGES];

    // 從環境變數讀取是否啟用 WebSocket 價格監控
    const enablePriceMonitor = process.env.ENABLE_PRICE_MONITOR !== 'false'; // 預設啟用

    monitorInstance = new FundingRateMonitor(
      symbols,                                            // 第1個參數：交易對數組
      updateInterval,                                     // 第2個參數：更新間隔（從環境變數讀取）
      minSpreadThreshold,                                 // 第3個參數：最小差價閾值（從環境變數讀取）
      process.env.BINANCE_TESTNET === 'true',            // 第4個參數：是否測試網
      {
        exchanges,                                        // 指定要監控的交易所列表
        enablePriceMonitor,                               // 啟用 WebSocket 價格監控
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

    // Feature 065: 初始化套利機會追蹤器
    const repository = new ArbitrageOpportunityRepository();
    trackerInstance = new ArbitrageOpportunityTracker(repository);
    trackerInstance.attach(monitorInstance);
    logger.info('ArbitrageOpportunityTracker initialized and attached');

    // Feature 067: 初始化持倉平倉建議監控器
    // 只有在環境變數啟用時才初始化（預設關閉，避免影響現有用戶）
    const enableExitMonitor = process.env.ENABLE_POSITION_EXIT_MONITOR === 'true';
    if (enableExitMonitor) {
      positionExitMonitorInstance = new PositionExitMonitor();
      positionExitMonitorInstance.attach(monitorInstance);
      logger.info('[Feature 067] PositionExitMonitor initialized and attached');
    } else {
      logger.debug('[Feature 067] PositionExitMonitor disabled (set ENABLE_POSITION_EXIT_MONITOR=true to enable)');
    }

    // 啟動記憶體監控（每 1 分鐘記錄一次）
    // Production 環境預設停用，可透過 ENABLE_MEMORY_MONITOR=true 強制啟用
    const isProduction = process.env.NODE_ENV === 'production';
    const enableMemoryMonitor = isProduction
      ? process.env.ENABLE_MEMORY_MONITOR === 'true'
      : process.env.ENABLE_MEMORY_MONITOR !== 'false';

    const memoryMonitorInterval = parseInt(process.env.MEMORY_MONITOR_INTERVAL_MS || '60000', 10);

    if (enableMemoryMonitor) {
      startMemoryMonitor(memoryMonitorInterval);
      logger.info({ interval: memoryMonitorInterval }, 'Memory monitor started');
    } else {
      logger.debug('Memory monitor disabled (set ENABLE_MEMORY_MONITOR=true to enable in production)');
    }

    // 啟動記憶體洩漏追蹤器（追蹤 timers、handles、detached contexts）
    // Production 環境預設停用，可透過 ENABLE_MEMORY_LEAK_TRACKER=true 強制啟用
    const enableMemoryLeakTracker = isProduction
      ? process.env.ENABLE_MEMORY_LEAK_TRACKER === 'true'
      : process.env.ENABLE_MEMORY_LEAK_TRACKER !== 'false';

    if (enableMemoryLeakTracker) {
      memoryLeakTracker.start(memoryMonitorInterval);
      logger.info({ interval: memoryMonitorInterval }, 'Memory leak tracker started');
    } else {
      logger.debug('Memory leak tracker disabled (set ENABLE_MEMORY_LEAK_TRACKER=true to enable in production)');
    }

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
  // 停止記憶體監控
  stopMemoryMonitor();

  // 停止記憶體洩漏追蹤器
  memoryLeakTracker.stop();

  // Feature 067: 解除持倉平倉建議監控器綁定
  if (positionExitMonitorInstance) {
    positionExitMonitorInstance.detach();
    positionExitMonitorInstance = null;
    logger.info('[Feature 067] PositionExitMonitor detached');
  }

  // Feature 065: 解除追蹤器綁定
  if (trackerInstance) {
    trackerInstance.detach();
    trackerInstance = null;
    logger.info('ArbitrageOpportunityTracker detached');
  }

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

/**
 * 獲取套利機會追蹤器實例
 * Feature 065: 提供給外部模組（如 CLI Dashboard）存取追蹤器
 */
export function getTrackerInstance(): ArbitrageOpportunityTracker | null {
  return trackerInstance;
}
