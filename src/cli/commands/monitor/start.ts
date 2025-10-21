import { Command } from 'commander';
import { PrismaClient } from '@prisma/client';
import { FundingRateMonitor } from '../../../services/monitor/FundingRateMonitor.js';
import { FundingRateValidator } from '../../../services/validation/FundingRateValidator.js';
import { FundingRateValidationRepository } from '../../../repositories/FundingRateValidationRepository.js';
import { OkxConnectorAdapter } from '../../../adapters/OkxConnectorAdapter.js';
import { OkxCCXT } from '../../../lib/ccxt/OkxCCXT.js';
import { OKXConnector } from '../../../connectors/okx.js';
import { logger } from '../../../lib/logger.js';
import { MonitorOutputFormatter } from '../../../lib/formatters/MonitorOutputFormatter.js';

export function createMonitorStartCommand(): Command {
  const command = new Command('start');

  command
    .description('啟動資金費率監控服務')
    .option('-s, --symbols <symbols>', '監控的交易對（逗號分隔）', 'BTCUSDT,ETHUSDT,SOLUSDT')
    .option('-i, --interval <ms>', '更新間隔（毫秒）', '5000')
    .option('-t, --threshold <percent>', '套利閾值（百分比）', '0.05')
    .option('--testnet', '使用測試網', false)
    .option('--format <mode>', '輸出格式 (table|plain|json)', undefined)
    .option('--enable-validation', '啟用 OKX 資金費率雙重驗證（需要資料庫）', false)
    .action(async (options) => {
      try {
        logger.info('啟動監控服務...');

        // 解析參數
        const symbols = options.symbols.split(',').map((s: string) => s.trim());
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

        // 建立驗證器（如果啟用）
        let validator: FundingRateValidator | undefined;
        let prisma: PrismaClient | undefined;
        if (enableValidation) {
          logger.info('初始化資金費率驗證器...');

          // 初始化 Prisma Client
          prisma = new PrismaClient();

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

        monitor.on('opportunity-detected', (pair) => {
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

          // 如果啟用了驗證，關閉 Prisma 連線
          if (prisma) {
            logger.info('關閉資料庫連線...');
            await prisma.$disconnect();
          }

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
