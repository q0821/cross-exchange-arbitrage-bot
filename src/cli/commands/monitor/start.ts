import { Command } from 'commander';
import { createPrismaClient } from '@/lib/prisma-factory';
import { FundingRateMonitor } from '../../../services/monitor/FundingRateMonitor.js';
import { FundingRateValidator } from '../../../services/validation/FundingRateValidator.js';
import { FundingRateValidationRepository } from '../../../repositories/FundingRateValidationRepository.js';
import { OkxConnectorAdapter } from '../../../adapters/OkxConnectorAdapter.js';
import { OkxCCXT } from '../../../lib/ccxt/OkxCCXT.js';
import { OKXConnector } from '../../../connectors/okx.js';
import { BinanceConnector } from '../../../connectors/binance.js';
import { logger } from '../../../lib/logger.js';
import { MonitorOutputFormatter } from '../../../lib/formatters/MonitorOutputFormatter.js';
import { oiCache } from '../../../lib/cache.js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 專案根目錄（通過尋找 package.json）
function findProjectRoot(): string {
  let currentDir = __dirname;

  // 最多往上找 10 層
  for (let i = 0; i < 10; i++) {
    const packageJsonPath = join(currentDir, 'package.json');
    if (existsSync(packageJsonPath)) {
      return currentDir;
    }
    currentDir = dirname(currentDir);
  }

  // 如果找不到，使用 process.cwd()
  return process.cwd();
}

/**
 * 從交易所 API 自動獲取所有可用的交易對（舊版基於交易量）
 * @deprecated 改用 fetchSymbolsByOI (Feature 010)
 * @internal 保留作為備用選項
 */
// @ts-expect-error - Kept for potential future use
async function fetchAvailableSymbols(
  isTestnet: boolean,
  minVolume: number
): Promise<string[]> {
  const ccxt = await import('ccxt');

  logger.info('正在從交易所獲取可用交易對...');

  try {
    // 1. 獲取 Binance 永續合約交易對
    const binanceExchange = new (ccxt as any).binance({
      options: {
        defaultType: 'future',
        testnet: isTestnet,
      },
    });

    await binanceExchange.loadMarkets();
    const binanceTickers = await binanceExchange.fetchTickers();

    // 過濾 USDT 永續合約且交易量達標
    const binanceSymbols = new Set<string>();
    Object.keys(binanceExchange.markets).forEach((marketId) => {
      const market = binanceExchange.markets[marketId];
      if (
        market.quote === 'USDT' &&
        market.swap &&
        market.active
      ) {
        // 轉換為標準格式：BTC/USDT:USDT -> BTCUSDT
        const symbol = market.base + 'USDT';

        // 檢查交易量
        const ticker = binanceTickers[marketId];
        const volume = ticker ? ticker.quoteVolume || 0 : 0;

        if (volume >= minVolume) {
          binanceSymbols.add(symbol);
        }
      }
    });

    logger.info({
      count: binanceSymbols.size,
      minVolume,
    }, 'Binance 可用交易對');

    // 2. 獲取 OKX 永續合約交易對
    const okxExchange = new (ccxt as any).okx({
      options: {
        defaultType: 'swap',
        sandboxMode: isTestnet,
      },
    });

    await okxExchange.loadMarkets();
    const okxTickers = await okxExchange.fetchTickers();

    const okxSymbols = new Set<string>();
    Object.keys(okxExchange.markets).forEach((marketId) => {
      const market = okxExchange.markets[marketId];
      if (
        market.quote === 'USDT' &&
        market.swap &&
        market.active
      ) {
        // 轉換為 Binance 格式：BTC/USDT:USDT -> BTCUSDT
        const symbol = market.base + 'USDT';

        // 檢查交易量
        const ticker = okxTickers[marketId];
        const volume = ticker ? ticker.quoteVolume || 0 : 0;

        if (volume >= minVolume) {
          okxSymbols.add(symbol);
        }
      }
    });

    logger.info({
      count: okxSymbols.size,
      minVolume,
    }, 'OKX 可用交易對');

    // 3. 取交集（兩個交易所都支援的交易對）
    const commonSymbols = [...binanceSymbols].filter((symbol) =>
      okxSymbols.has(symbol)
    );

    logger.info({
      total: commonSymbols.length,
      binance: binanceSymbols.size,
      okx: okxSymbols.size,
    }, '兩個交易所共同支援的交易對');

    return commonSymbols.sort();
  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : String(error),
    }, '獲取交易對失敗');
    throw new Error('無法從交易所獲取交易對，請使用 -s 參數手動指定');
  }
}

/**
 * 從配置檔案讀取交易對群組
 */
function loadSymbolGroup(groupName: string): string[] {
  try {
    const projectRoot = findProjectRoot();
    const configPath = join(projectRoot, 'config/symbols.json');

    logger.debug({ configPath }, '載入配置檔案');

    const config = JSON.parse(readFileSync(configPath, 'utf-8'));

    if (!config.groups[groupName]) {
      throw new Error(`找不到群組: ${groupName}。可用群組: ${Object.keys(config.groups).join(', ')}`);
    }

    logger.info({
      group: groupName,
      name: config.groups[groupName].name,
      count: config.groups[groupName].symbols.length,
    }, '從配置檔案載入交易對群組');

    return config.groups[groupName].symbols;
  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : String(error),
      groupName,
    }, '載入交易對群組失敗');
    throw error;
  }
}

/**
 * 基於 Open Interest 從 Binance 獲取交易對 (Feature 010)
 * 使用 OICache 實現 15 分鐘 TTL 快取，減少 API 呼叫
 */
async function fetchSymbolsByOI(
  isTestnet: boolean,
  topN: number,
  minOI?: number
): Promise<string[]> {
  logger.info({ topN, minOI }, '正在基於 Open Interest 獲取交易對...');

  try {
    // 1. 檢查快取
    const cached = oiCache.get(topN);
    if (cached) {
      logger.info({
        topN,
        totalSymbols: cached.totalSymbols,
        selectedSymbols: cached.rankings.length,
        cacheAge: Math.round((Date.now() - cached.generatedAt) / 1000) + 's',
      }, 'OI cache hit - 使用快取資料');

      return cached.rankings.map(r => r.symbol);
    }

    logger.info('OI cache miss - 從 Binance API 獲取...');

    // 2. 建立 Binance connector
    const binance = new BinanceConnector(isTestnet);
    await binance.connect();

    // 3. 獲取 OI 排名前 N 的交易對
    const ranking = await binance.getTopSymbolsByOI(topN, minOI);

    // 4. 儲存到快取
    oiCache.set(topN, ranking);

    // 5. 驗證交易對在 OKX 上也可用
    logger.info('驗證交易對在 OKX 上的可用性...');
    const okxExchange = await import('ccxt').then((ccxt) => new (ccxt as any).okx({
      options: {
        defaultType: 'swap',
        sandboxMode: isTestnet,
      },
    }));

    await okxExchange.loadMarkets();
    const okxSymbols = new Set<string>();
    Object.keys(okxExchange.markets).forEach((marketId) => {
      const market = okxExchange.markets[marketId];
      if (market.quote === 'USDT' && market.swap && market.active) {
        const symbol = market.base + 'USDT';
        okxSymbols.add(symbol);
      }
    });

    // 6. 過濾出兩個交易所都支援的交易對
    const validSymbols = ranking.rankings
      .map(r => r.symbol)
      .filter(symbol => okxSymbols.has(symbol));

    logger.info({
      totalFromBinance: ranking.rankings.length,
      validOnBoth: validSymbols.length,
      filtered: ranking.rankings.length - validSymbols.length,
      topSymbol: validSymbols[0],
      topOI: ranking.rankings[0]?.openInterestUSD,
    }, '基於 OI 獲取交易對完成');

    // 斷開連線
    await binance.disconnect();

    return validSymbols;
  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : String(error),
      topN,
      minOI,
    }, '基於 OI 獲取交易對失敗');
    throw new Error('無法基於 Open Interest 獲取交易對，請檢查網路連線和 API 可用性');
  }
}

export function createMonitorStartCommand(): Command {
  const command = new Command('start');

  command
    .description('啟動資金費率監控服務')
    .option('-s, --symbols <symbols>', '監控的交易對（逗號分隔，或使用 "auto" 自動獲取）', 'BTCUSDT,ETHUSDT,SOLUSDT')
    .option('-g, --group <name>', '使用配置檔案的交易對群組（top10, top20, defi, layer1, meme）')
    .option('--auto-fetch', '自動從交易所 API 獲取所有可用交易對（基於 Open Interest 或交易量）')
    .option('--top <n>', '獲取 OI 排名前 N 個交易對（需搭配 --auto-fetch，預設 50）', '50')
    .option('--min-oi <usdt>', '最小 Open Interest 門檻（美元，可選）')
    .option('--min-volume <usdt>', '最小 24 小時交易量過濾（USDT，僅用於舊版 auto-fetch）', '1000000')
    .option('-i, --interval <ms>', '更新間隔（毫秒）', '5000')
    .option('-t, --threshold <percent>', '套利閾值（百分比，包含所有交易成本）', '0.5')
    .option('--testnet', '使用測試網', false)
    .option('--format <mode>', '輸出格式 (table|plain|json)', undefined)
    .option('--enable-validation', '啟用 OKX 資金費率雙重驗證（需要資料庫）', false)
    .option('--enable-price-monitor', '啟用即時價格監控（REST 輪詢）', false)
    .option('--enable-arbitrage-assessment', '啟用套利可行性評估', false)
    .option('--arbitrage-capital <usdt>', '套利使用的資金量（USDT）', '10000')
    .option('--maker-fee <rate>', 'Maker 手續費率（例如：0.0002 = 0.02%）', '0.0002')
    .option('--taker-fee <rate>', 'Taker 手續費率（例如：0.0005 = 0.05%）', '0.0005')
    .option('--min-profit <rate>', '最小利潤閾值（例如：0.0001 = 0.01%）', '0.0001')
    .action(async (options) => {
      try {
        logger.info('啟動監控服務...');

        // 解析交易對
        let symbols: string[];

        if (options.autoFetch) {
          // Feature 010: 基於 Open Interest 自動獲取
          const topN = parseInt(options.top, 10);
          const minOI = options.minOi ? parseFloat(options.minOi) : undefined;

          // 驗證參數範圍
          if (topN < 1 || topN > 500) {
            throw new Error('--top 參數必須在 1-500 之間');
          }

          symbols = await fetchSymbolsByOI(options.testnet, topN, minOI);

          if (symbols.length === 0) {
            throw new Error('未找到符合條件的交易對');
          }

          console.log(`\n✅ 基於 Open Interest 自動獲取到 ${symbols.length} 個交易對`);
          console.log(`📊 參數: top=${topN}${minOI ? `, minOI=${minOI.toLocaleString()} USD` : ''}`);
          console.log(`📋 交易對: ${symbols.slice(0, 10).join(', ')}${symbols.length > 10 ? ` ... 等 ${symbols.length} 個` : ''}\n`);
        } else if (options.group) {
          // 從配置檔案讀取群組
          symbols = loadSymbolGroup(options.group);
          console.log(`\n✅ 使用群組 "${options.group}" (${symbols.length} 個交易對)\n`);
        } else {
          // 使用指定的交易對
          symbols = options.symbols.split(',').map((s: string) => s.trim());
        }

        // 解析其他參數
        const interval = parseInt(options.interval, 10);
        const threshold = parseFloat(options.threshold) / 100; // 轉換為小數
        const isTestnet = options.testnet;
        const enableValidation = options.enableValidation;
        const enablePriceMonitor = options.enablePriceMonitor;
        const enableArbitrageAssessment = options.enableArbitrageAssessment;
        const arbitrageCapital = parseFloat(options.arbitrageCapital);
        const makerFee = parseFloat(options.makerFee);
        const takerFee = parseFloat(options.takerFee);
        const minProfit = parseFloat(options.minProfit);

        logger.info({
          symbols,
          interval,
          threshold: (threshold * 100).toFixed(2) + '%',
          testnet: isTestnet,
          enableValidation,
          enablePriceMonitor,
          enableArbitrageAssessment,
          arbitrageCapital: enableArbitrageAssessment ? arbitrageCapital : undefined,
          fees: enableArbitrageAssessment ? { makerFee, takerFee, minProfit } : undefined,
        }, '監控參數');

        // 初始化 Prisma Client（用於儲存驗證記錄）
        logger.info('初始化資料庫連線...');
        const prisma = createPrismaClient();
        logger.info('資料庫連線已建立');

        // 建立驗證器（如果啟用）
        let validator: FundingRateValidator | undefined;
        if (enableValidation) {
          logger.info('初始化資金費率驗證器...');

          // 建立 OKX Connector（用於驗證）
          const okxConnector = new OKXConnector(isTestnet);
          await okxConnector.connect();

          // 建立 Adapter
          const okxAdapter = new OkxConnectorAdapter(okxConnector);

          // 建立 CCXT
          const okxCCXT = new OkxCCXT(isTestnet);

          // 建立 Repository
          const repository = new FundingRateValidationRepository(prisma);

          // 建立 Validator
          validator = new FundingRateValidator(repository, okxAdapter, okxCCXT);

          logger.info('資金費率驗證器已初始化');
        }

        // 建立監控服務
        const monitor = new FundingRateMonitor(symbols, interval, threshold, isTestnet, {
          validator,
          enableValidation,
          enablePriceMonitor,
          enableArbitrageAssessment,
          arbitrageCapital,
          arbitrageConfig: enableArbitrageAssessment ? {
            makerFeeRate: makerFee,
            takerFeeRate: takerFee,
            minProfitThreshold: minProfit,
          } : undefined,
        });

        // 建立輸出格式化器
        const formatter = new MonitorOutputFormatter(options.format);

        logger.info({
          outputMode: formatter.getOutputMode(),
          terminalInfo: formatter.getTerminalInfo()
        }, '輸出格式化器已初始化');

        // 儲存所有交易對的最新資料
        const latestPairs = new Map();

        // 監聽事件
        monitor.on('rate-updated', (pair) => {
          // 更新該交易對的最新資料
          latestPairs.set(pair.symbol, pair);

          // 收集所有已有資料的交易對
          const pairs = Array.from(latestPairs.values());

          // 取得統計資訊
          const stats = monitor.getStats();

          // 渲染狀態摘要（在表格上方）
          const statusHeader = formatter.renderStatusHeader(stats);

          // 渲染表格
          const tableOutput = formatter.renderTable(pairs, threshold * 100);

          // 合併輸出並刷新終端
          const combinedOutput = statusHeader ? `${statusHeader}${tableOutput}` : tableOutput;
          formatter.refresh(combinedOutput);
        });

        monitor.on('error', (error) => {
          logger.error({
            error: error.message,
          }, '監控服務錯誤');
        });

        monitor.on('status-changed', (status) => {
          logger.info({
            isRunning: status.isRunning,
            totalUpdates: status.totalUpdates,
            errors: status.errors,
          }, '監控狀態變更');
        });

        // 啟動監控
        await monitor.start();

        logger.info({
          symbols,
          interval,
          threshold: (threshold * 100).toFixed(2) + '%',
          environment: isTestnet ? '測試網' : '正式網'
        }, '監控服務已啟動');

        // 處理 Ctrl+C
        process.on('SIGINT', async () => {
          // 清除 log-update 顯示
          formatter.done();

          logger.info('正在停止監控服務...');
          await monitor.stop();

          // 關閉 Prisma 連線
          logger.info('關閉資料庫連線...');
          await prisma.$disconnect();

          logger.info('監控服務已停止');
          process.exit(0);
        });

        // 保持程序運行
        await new Promise(() => {
          // 永久等待，直到收到 SIGINT
        });
      } catch (error) {
        logger.error({
          error: error instanceof Error ? error.message : String(error),
        }, '啟動監控失敗');
        process.exit(1);
      }
    });

  return command;
}
