import { Command } from 'commander';
import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { FundingRateMonitor } from '../../../services/monitor/FundingRateMonitor.js';
import { FundingRateValidator } from '../../../services/validation/FundingRateValidator.js';
import { FundingRateValidationRepository } from '../../../repositories/FundingRateValidationRepository.js';
import { ArbitrageOpportunityRepository } from '../../../repositories/ArbitrageOpportunityRepository.js';
import { OkxConnectorAdapter } from '../../../adapters/OkxConnectorAdapter.js';
import { OkxCCXT } from '../../../lib/ccxt/OkxCCXT.js';
import { OKXConnector } from '../../../connectors/okx.js';
import { logger } from '../../../lib/logger.js';
import { MonitorOutputFormatter } from '../../../lib/formatters/MonitorOutputFormatter.js';
import type { CreateOpportunityData } from '../../../types/opportunity-detection.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 從交易所 API 自動獲取所有可用的交易對
 */
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
    const configPath = join(__dirname, '../../../../../config/symbols.json');
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

export function createMonitorStartCommand(): Command {
  const command = new Command('start');

  command
    .description('啟動資金費率監控服務')
    .option('-s, --symbols <symbols>', '監控的交易對（逗號分隔，或使用 "auto" 自動獲取）', 'BTCUSDT,ETHUSDT,SOLUSDT')
    .option('-g, --group <name>', '使用配置檔案的交易對群組（top10, top20, defi, layer1, meme）')
    .option('--auto-fetch', '自動從交易所 API 獲取所有可用交易對')
    .option('--min-volume <usdt>', '最小 24 小時交易量過濾（USDT，僅用於 auto-fetch）', '1000000')
    .option('-i, --interval <ms>', '更新間隔（毫秒）', '5000')
    .option('-t, --threshold <percent>', '套利閾值（百分比，包含所有交易成本）', '0.37')
    .option('--testnet', '使用測試網', false)
    .option('--format <mode>', '輸出格式 (table|plain|json)', undefined)
    .option('--enable-validation', '啟用 OKX 資金費率雙重驗證（需要資料庫）', false)
    .action(async (options) => {
      try {
        logger.info('啟動監控服務...');

        // 解析交易對
        let symbols: string[];

        if (options.autoFetch) {
          // 自動從交易所 API 獲取
          const minVolume = parseFloat(options.minVolume);
          symbols = await fetchAvailableSymbols(options.testnet, minVolume);

          if (symbols.length === 0) {
            throw new Error('未找到符合條件的交易對');
          }

          console.log(`\n✅ 自動獲取到 ${symbols.length} 個交易對（最小交易量 >= ${minVolume.toLocaleString()} USDT）`);
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

        logger.info({
          symbols,
          interval,
          threshold: (threshold * 100).toFixed(2) + '%',
          testnet: isTestnet,
          enableValidation,
        }, '監控參數');

        // 初始化 Prisma Client 和 Repository（用於儲存套利機會）
        logger.info('初始化資料庫連線...');
        const prisma = new PrismaClient();
        const opportunityRepository = new ArbitrageOpportunityRepository(prisma);
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

        monitor.on('opportunity-detected', async (pair) => {
          // 記錄到日誌檔案
          logger.info({
            symbol: pair.symbol,
            spread: pair.spreadPercent,
            binanceRate: pair.binance.fundingRate,
            okxRate: pair.okx.fundingRate,
            spreadAnnualized: pair.spreadAnnualized
          }, '套利機會偵測');

          // 使用格式化的機會報告輸出到終端
          const report = formatter.renderOpportunityReport(pair, threshold * 100);
          console.log(report);

          // 寫入資料庫（如果尚未存在）
          try {
            // 檢查是否已有該 symbol 的 ACTIVE 機會
            const existing = await prisma.arbitrageOpportunity.findFirst({
              where: {
                symbol: pair.symbol,
                status: 'ACTIVE',
              },
            });

            if (existing) {
              logger.debug({
                symbol: pair.symbol,
                existingId: existing.id,
              }, '機會已存在於資料庫，跳過寫入');
              return;
            }

            // 判斷哪個交易所費率較高（做空）、哪個較低（做多）
            const binanceRate = pair.binance.fundingRate;
            const okxRate = pair.okx.fundingRate;

            const longExchange = binanceRate < okxRate ? 'binance' : 'okx';
            const shortExchange = binanceRate < okxRate ? 'okx' : 'binance';
            const longFundingRate = Math.min(binanceRate, okxRate);
            const shortFundingRate = Math.max(binanceRate, okxRate);

            // 計算費率差異（以小數表示）
            const rateDifference = Math.abs(binanceRate - okxRate);

            // 計算預期年化收益率（以小數表示）
            // 資金費率每 8 小時收取一次，一天 3 次，一年 365 天
            const expectedReturnRate = rateDifference * 3 * 365;

            // 建立套利機會資料
            const opportunityData: CreateOpportunityData = {
              symbol: pair.symbol,
              longExchange,
              shortExchange,
              longFundingRate: new Decimal(longFundingRate),
              shortFundingRate: new Decimal(shortFundingRate),
              rateDifference: new Decimal(rateDifference),
              expectedReturnRate: new Decimal(expectedReturnRate),
              detectedAt: pair.recordedAt,
            };

            // 儲存到資料庫
            const savedOpportunity = await opportunityRepository.create(opportunityData);

            logger.info({
              opportunityId: savedOpportunity.id,
              symbol: pair.symbol,
              rateDifference: rateDifference.toFixed(6),
              expectedReturnRate: (expectedReturnRate * 100).toFixed(2) + '%',
            }, '套利機會已儲存到資料庫');
          } catch (error) {
            logger.error({
              error: error instanceof Error ? error.message : String(error),
              symbol: pair.symbol,
            }, '儲存套利機會失敗');
          }
        });

        monitor.on('opportunity-disappeared', async (symbol) => {
          // 從資料庫刪除該 symbol 的所有 ACTIVE 機會
          try {
            const deletedCount = await prisma.arbitrageOpportunity.deleteMany({
              where: {
                symbol,
                status: 'ACTIVE',
              },
            });

            logger.info({
              symbol,
              deletedCount: deletedCount.count,
            }, '套利機會已從資料庫刪除');

            if (deletedCount.count > 0) {
              console.log(`\n❌ 機會消失：${symbol}（已從資料庫刪除 ${deletedCount.count} 筆）`);
            }
          } catch (error) {
            logger.error({
              error: error instanceof Error ? error.message : String(error),
              symbol,
            }, '刪除套利機會失敗');
          }
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
