import { Command } from 'commander';
import { FundingRateMonitor } from '../../../services/monitor/FundingRateMonitor.js';
import { logger } from '../../../lib/logger.js';

export function createMonitorStartCommand(): Command {
  const command = new Command('start');

  command
    .description('啟動資金費率監控服務')
    .option('-s, --symbols <symbols>', '監控的交易對（逗號分隔）', 'BTCUSDT,ETHUSDT,SOLUSDT')
    .option('-i, --interval <ms>', '更新間隔（毫秒）', '5000')
    .option('-t, --threshold <percent>', '套利閾值（百分比）', '0.05')
    .option('--testnet', '使用測試網', false)
    .action(async (options) => {
      try {
        logger.info('啟動監控服務...');

        // 解析參數
        const symbols = options.symbols.split(',').map((s: string) => s.trim());
        const interval = parseInt(options.interval, 10);
        const threshold = parseFloat(options.threshold) / 100; // 轉換為小數
        const isTestnet = options.testnet;

        logger.info({
          symbols,
          interval,
          threshold: (threshold * 100).toFixed(2) + '%',
          testnet: isTestnet,
        }, '監控參數');

        // 建立監控服務
        const monitor = new FundingRateMonitor(symbols, interval, threshold, isTestnet);

        // 監聽事件
        monitor.on('rate-updated', (pair) => {
          const isOpportunity = monitor['calculator'].isArbitrageOpportunity(pair);

          console.log(`\n[${new Date().toLocaleTimeString()}] ${pair.symbol}`);
          console.log(`  Binance: ${pair.binance.getFundingRatePercent()}`);
          console.log(`  OKX: ${pair.okx.getFundingRatePercent()}`);
          console.log(`  利差: ${pair.spreadPercent.toFixed(4)}% ${isOpportunity ? '✅ 套利機會' : ''}`);
        });

        monitor.on('opportunity-detected', (pair) => {
          console.log('\n' + '='.repeat(50));
          console.log('🎯 發現套利機會！');
          console.log(monitor['calculator'].generateOpportunityReport(pair));
          console.log('='.repeat(50));
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

        console.log('\n✅ 監控服務已啟動');
        console.log(`📊 監控交易對: ${symbols.join(', ')}`);
        console.log(`⏱️  更新間隔: ${interval}ms`);
        console.log(`🎯 套利閾值: ${(threshold * 100).toFixed(2)}%`);
        console.log(`🌐 環境: ${isTestnet ? '測試網' : '正式網'}`);
        console.log('\n按 Ctrl+C 停止監控\n');

        // 處理 Ctrl+C
        process.on('SIGINT', async () => {
          console.log('\n\n正在停止監控服務...');
          await monitor.stop();
          console.log('✅ 監控服務已停止');
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
        console.error('\n❌ 啟動失敗:', error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return command;
}
